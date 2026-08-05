import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getAnthropic,
  isAiConfigured,
  attemptWithFallback,
  PLANWORTH_MODEL,
  TOKEN_BUDGET,
  costMicros,
} from "@/lib/anthropic";
import {
  buildTriageSystemPrompt,
  extractMatch,
  MATCH_OPEN,
  TRIAGE_PROMPT_VERSION,
} from "@/lib/prompts/triage";
import { findProduct } from "@/lib/products";
import { prisma } from "@/lib/prisma";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Scenario 2 — the conversational triage concierge. A REAL streamed Claude call.
 *
 * Shape of the response: Server-Sent Events, one JSON object per `data:` line.
 *   { type: "token", text }   incremental prose
 *   { type: "match", ... }    the structured product match, once
 *   { type: "done", usage }   end of turn
 *   { type: "error", message }
 *
 * The structured match rides in a sentinel-delimited block at the end of the
 * model's output. This handler withholds any text from the sentinel onward, so
 * the block never reaches the browser — the prospect sees prose, the relationship
 * manager sees the structured hand-off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TURNS = 24;
const MAX_MESSAGE_CHARS = 1_200;

/** Per-IP: 20 turns a minute is generous for a human, useless for a loop. */
const RATE_LIMIT = 20;
const RATE_WINDOW_SECONDS = 60;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

function digest(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function sse(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(request: Request) {
  // ── Guard the wallet before anything else ──
  const limit = rateLimit(
    clientKey(request, "concierge"),
    RATE_LIMIT,
    RATE_WINDOW_SECONDS,
  );
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `Too many messages. Try again in ${limit.retryAfterSeconds}s.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "ANTHROPIC_API_KEY is not set on the server, so the live concierge is unavailable. The three simulated scenarios are unaffected.",
      },
      { status: 503 },
    );
  }

  // ── Validate ──
  let body: { messages?: IncomingMessage[]; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Body must be JSON." },
      { status: 400 },
    );
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  if (incoming.length === 0) {
    return NextResponse.json(
      { error: "bad_request", message: "At least one message is required." },
      { status: 400 },
    );
  }
  if (incoming.length > MAX_TURNS) {
    return NextResponse.json(
      {
        error: "too_long",
        message: `This demo caps a conversation at ${MAX_TURNS} turns. Reset to start again.`,
      },
      { status: 400 },
    );
  }

  const messages = incoming.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    // Hard cap per message. The model is instructed to treat user text as data,
    // but a length cap is the part that does not depend on the model complying.
    content: String(m.content ?? "").slice(0, MAX_MESSAGE_CHARS),
  }));
  if (messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "bad_request", message: "The last message must be from the user." },
      { status: 400 },
    );
  }

  const sessionId = String(body.sessionId ?? "anonymous").slice(0, 64);
  const system = buildTriageSystemPrompt();

  // ── Log before a single token streams ──
  // If the audit write fails, the call does not happen. An unlogged model
  // invocation is worse than a failed one in a financial-services context.
  let auditId: string;
  try {
    const entry = await prisma.auditEntry.create({
      data: {
        sessionId,
        actor: "Website visitor (demo)",
        scenario: "triage",
        surface: "POST /api/concierge",
        mode: "real",
        model: PLANWORTH_MODEL,
        promptVersion: TRIAGE_PROMPT_VERSION,
        inputDigest: digest(`${system}\n@@@\n${JSON.stringify(messages)}`),
        outcome: "streaming",
        meta: { turns: messages.length },
      },
    });
    auditId = entry.id;
  } catch (err) {
    console.error("[/api/concierge] audit write failed, refusing to call model:", err);
    return NextResponse.json(
      {
        error: "audit_unavailable",
        message:
          "The audit log is unavailable, so the model was not called. Check the database connection.",
      },
      { status: 503 },
    );
  }

  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      let emittedUpTo = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: string | null = null;

      /**
       * Emit everything that is safely beyond any partial sentinel.
       *
       * The sentinel can straddle chunk boundaries, so we hold back the last
       * (sentinel.length - 1) characters until we know they are not the start of
       * one. Once the sentinel appears, nothing after it is ever emitted.
       */
      function flush(final: boolean) {
        const sentinelAt = fullText.indexOf(MATCH_OPEN);
        const ceiling =
          sentinelAt !== -1
            ? sentinelAt
            : final
              ? fullText.length
              : Math.max(0, fullText.length - (MATCH_OPEN.length - 1));

        if (ceiling > emittedUpTo) {
          const text = fullText.slice(emittedUpTo, ceiling);
          emittedUpTo = ceiling;
          if (text) controller.enqueue(sse({ type: "token", text }));
        }
      }

      try {
        const anthropic = await getAnthropic();

        const { result: message } = await attemptWithFallback(async (extra) => {
          const llm = anthropic.beta.messages.stream({
            model: PLANWORTH_MODEL,
            max_tokens: TOKEN_BUDGET.concierge,
            system,
            messages,
            ...extra,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);

          llm.on("text", (delta: string) => {
            fullText += delta;
            flush(false);
          });

          return await llm.finalMessage();
        });

        flush(true);

        inputTokens = message.usage?.input_tokens ?? 0;
        outputTokens = message.usage?.output_tokens ?? 0;
        stopReason = message.stop_reason ?? null;

        // A classifier decline arrives as a 200 with empty content — check the
        // stop reason rather than assuming content[0] exists.
        if (stopReason === "refusal") {
          controller.enqueue(
            sse({
              type: "error",
              message:
                "The model declined to answer that. Try rephrasing the enquiry in terms of the financing you need.",
            }),
          );
        }

        // ── Structured hand-off ──
        const { match, malformed } = extractMatch(fullText);
        if (match) {
          const product = findProduct(match.productId);
          if (product) {
            controller.enqueue(
              sse({
                type: "match",
                product: {
                  id: product.id,
                  name: product.name,
                  category: product.category,
                  shortPitch: product.shortPitch,
                  requiredDocs: product.requiredDocs,
                  typicalTenor: product.typicalTenor,
                  facilityRange: product.facilityRange,
                },
                confidence: match.confidence,
                rationale: match.rationale,
                prefill: match.prefill,
                missing: match.missing,
              }),
            );
          } else {
            // The model named an id that is not in the catalogue. Drop it rather
            // than surface a product that does not exist.
            console.warn(
              "[/api/concierge] model returned unknown productId:",
              match.productId,
            );
          }
        } else if (malformed) {
          console.warn("[/api/concierge] malformed match block discarded");
        }

        controller.enqueue(
          sse({
            type: "done",
            usage: {
              inputTokens,
              outputTokens,
              latencyMs: Date.now() - startedAt,
              model: PLANWORTH_MODEL,
            },
          }),
        );

        await prisma.auditEntry
          .update({
            where: { id: auditId },
            data: {
              outputDigest: digest(fullText),
              inputTokens,
              outputTokens,
              latencyMs: Date.now() - startedAt,
              costMicros: costMicros(inputTokens, outputTokens),
              outcome: match
                ? `matched:${match.productId} (${match.confidence})`
                : stopReason === "refusal"
                  ? "refused"
                  : "conversation",
              meta: {
                turns: messages.length,
                stopReason,
                matchedProductId: match?.productId ?? null,
                malformedMatch: malformed,
              },
            },
          })
          .catch((err) =>
            console.error("[/api/concierge] audit update failed:", err),
          );
      } catch (err) {
        console.error("[/api/concierge] stream error:", err);
        controller.enqueue(
          sse({
            type: "error",
            message:
              "The concierge could not complete that turn. The error is in the server log.",
          }),
        );
        await prisma.auditEntry
          .update({
            where: { id: auditId },
            data: {
              outcome: "error",
              latencyMs: Date.now() - startedAt,
              meta: {
                error: err instanceof Error ? err.message.slice(0, 300) : "unknown",
              },
            },
          })
          .catch(() => {});
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
