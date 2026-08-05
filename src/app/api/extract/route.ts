import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
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
  EXTRACTION_SCHEMA,
  EXTRACT_PROMPT_VERSION,
  EXTRACT_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
  type ExtractionResult,
} from "@/lib/prompts/extract";
import { reconcile } from "@/lib/reconcile";
import { prisma } from "@/lib/prisma";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Scenario 3 — Intelligent Document Processing. A REAL Claude vision call.
 *
 * Reads a bundled fixture page, extracts its fields against a strict schema,
 * reconciles them against the application record, and persists both the fields and
 * the verdict so the result is auditable after the fact.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Extraction is the expensive call on this app; keep the ceiling tight. */
const RATE_LIMIT = 8;
const RATE_WINDOW_SECONDS = 60;

function digest(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

/** Fixture filenames are a closed set of PNGs — anything else is rejected. */
const FIXTURE_NAME = /^[a-z0-9][a-z0-9._-]*\.png$/;

/**
 * Resolve a fixture filename to an absolute path.
 *
 * Two things are going on here. First, the value comes from our own database, but
 * it is still validated: "it came from our DB" is exactly the assumption that
 * turns a later admin-editable field into a file-disclosure bug, so only a bare
 * whitelisted filename is accepted — no separators, so no traversal is
 * expressible in the first place.
 *
 * Second, the directory prefix is kept static. A `readFile` on a fully dynamic
 * path makes the bundler trace the whole project into the server output (it warns
 * about exactly this); joining a constant directory with a validated basename
 * keeps the trace scoped.
 */
function resolveFixture(assetPath: string): string | null {
  if (!assetPath.startsWith("/fixtures/")) return null;
  const name = assetPath.slice("/fixtures/".length);
  if (!FIXTURE_NAME.test(name)) return null;
  return path.join(process.cwd(), "public", "fixtures", name);
}

export async function POST(request: Request) {
  const limit = rateLimit(
    clientKey(request, "extract"),
    RATE_LIMIT,
    RATE_WINDOW_SECONDS,
  );
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `Too many extractions. Try again in ${limit.retryAfterSeconds}s.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "ANTHROPIC_API_KEY is not set on the server, so live extraction is unavailable.",
      },
      { status: 503 },
    );
  }

  let body: { documentId?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Body must be JSON." },
      { status: 400 },
    );
  }

  const documentId = String(body.documentId ?? "");
  if (!documentId) {
    return NextResponse.json(
      { error: "bad_request", message: "documentId is required." },
      { status: 400 },
    );
  }

  const document = await prisma.documentRecord.findUnique({
    where: { id: documentId },
    include: { application: { include: { client: true, product: true } } },
  });
  if (!document) {
    return NextResponse.json(
      { error: "not_found", message: "No such document fixture." },
      { status: 404 },
    );
  }

  const fixturePath = resolveFixture(document.assetPath);
  if (!fixturePath) {
    return NextResponse.json(
      { error: "bad_fixture", message: "Fixture path is not permitted." },
      { status: 400 },
    );
  }

  let base64: string;
  try {
    base64 = (await readFile(fixturePath)).toString("base64");
  } catch (err) {
    console.error("[/api/extract] fixture read failed:", err);
    return NextResponse.json(
      {
        error: "fixture_missing",
        message:
          "The fixture image is missing. Run scripts/generate-fixtures.ps1 to regenerate the document set.",
      },
      { status: 500 },
    );
  }

  const sessionId = String(body.sessionId ?? "anonymous").slice(0, 64);
  const userPrompt = buildExtractionUserPrompt(document.label);

  // ── Log before the call ──
  let auditId: string;
  try {
    const entry = await prisma.auditEntry.create({
      data: {
        sessionId,
        actor: process.env.DEMO_OPERATOR ?? "Credit Operations (demo)",
        scenario: "idp",
        surface: "POST /api/extract",
        mode: "real",
        model: PLANWORTH_MODEL,
        promptVersion: EXTRACT_PROMPT_VERSION,
        inputDigest: digest(
          `${EXTRACT_SYSTEM_PROMPT}\n@@@\n${userPrompt}\n@@@\n${document.assetPath}`,
        ),
        outcome: "extracting",
        meta: {
          documentId: document.id,
          applicationRef: document.application.reference,
        },
      },
    });
    auditId = entry.id;
  } catch (err) {
    console.error("[/api/extract] audit write failed, refusing to call model:", err);
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

  try {
    const anthropic = await getAnthropic();

    const { result: message } = await attemptWithFallback(async (extra) =>
      anthropic.beta.messages.create({
        model: PLANWORTH_MODEL,
        max_tokens: TOKEN_BUDGET.extraction,
        system: EXTRACT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: base64,
                },
              },
              { type: "text", text: userPrompt },
            ],
          },
        ],
        output_config: {
          format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
        },
        ...extra,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    );

    const latencyMs = Date.now() - startedAt;

    // A classifier decline is a 200 with no usable content — check first.
    if (message.stop_reason === "refusal") {
      await prisma.auditEntry.update({
        where: { id: auditId },
        data: { outcome: "refused", latencyMs },
      });
      return NextResponse.json(
        {
          error: "refused",
          message: "The model declined to process this document.",
        },
        { status: 422 },
      );
    }

    const textBlock = message.content.find(
      (b: { type: string }) => b.type === "text",
    ) as { type: "text"; text: string } | undefined;

    if (!textBlock) {
      throw new Error("No text block in the extraction response.");
    }

    let extraction: ExtractionResult;
    try {
      extraction = JSON.parse(textBlock.text) as ExtractionResult;
    } catch {
      throw new Error(
        `Extraction did not return valid JSON: ${textBlock.text.slice(0, 200)}`,
      );
    }

    // ── Reconcile against the CRM record ──
    const reconciliation = reconcile(extraction, {
      declaredAmountSen: document.application.declaredAmountSen,
      awardingBody: document.application.awardingBody,
      contractReference: document.application.contractReference,
      clientName: document.application.client.name,
    });

    // ── Persist ──
    await prisma.$transaction([
      prisma.extractedField.deleteMany({ where: { documentId: document.id } }),
      prisma.extractedField.createMany({
        data: reconciliation.fields.map((f) => ({
          documentId: document.id,
          name: f.name,
          extractedText: f.extractedText,
          crmValue: f.crmValue,
          matches: f.matches,
          note: f.note,
        })),
      }),
      prisma.documentRecord.update({
        where: { id: document.id },
        data: {
          verdict: reconciliation.verdict,
          verdictRationale: reconciliation.rationale,
          extractedAt: new Date(),
          latencyMs,
        },
      }),
    ]);

    const inputTokens = message.usage?.input_tokens ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;

    await prisma.auditEntry.update({
      where: { id: auditId },
      data: {
        outputDigest: digest(textBlock.text),
        inputTokens,
        outputTokens,
        latencyMs,
        costMicros: costMicros(inputTokens, outputTokens),
        outcome: `verdict:${reconciliation.verdict}`,
        meta: {
          documentId: document.id,
          applicationRef: document.application.reference,
          legibility: extraction.legibility,
          stopReason: message.stop_reason ?? null,
        },
      },
    });

    return NextResponse.json({
      extraction,
      reconciliation: {
        ...reconciliation,
        amountDeltaSen: reconciliation.amountDeltaSen?.toString() ?? null,
      },
      usage: {
        inputTokens,
        outputTokens,
        latencyMs,
        model: PLANWORTH_MODEL,
      },
    });
  } catch (err) {
    console.error("[/api/extract] extraction failed:", err);
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
    return NextResponse.json(
      {
        error: "extraction_failed",
        message:
          "The extraction did not complete. The error is in the server log.",
      },
      { status: 500 },
    );
  }
}
