import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Read-only view of the audit trail for ONE session.
 *
 * Why this exists: both live routes write an `AuditEntry` before a token is
 * generated, and the UI tells the visitor so. Until now there was no way to see
 * it, which made that an assertion rather than a demonstration — a weak position
 * in front of a lender whose interest in an AI system is mostly about whether it
 * can be audited.
 *
 * Why it is session-scoped and mandatory: this app is unauthenticated and shared
 * by link. An unfiltered endpoint would let any visitor enumerate every other
 * visitor's session — worse than having no viewer at all. `session` is required;
 * omitting it is a 400, never "return everything".
 *
 * Digests only. The audit rows never contained prompt or response text (just
 * sha256 prefixes), and this endpoint does not widen that.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = 60;
const RATE_WINDOW_SECONDS = 60;
const MAX_ROWS = 50;

export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "audit"), RATE_LIMIT, RATE_WINDOW_SECONDS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: `Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const sessionId = new URL(request.url).searchParams.get("session")?.trim();
  if (!sessionId) {
    return NextResponse.json(
      {
        error: "session_required",
        message:
          "A session id is required. This endpoint is deliberately scoped to one session and will not return the whole table.",
      },
      { status: 400 },
    );
  }

  try {
    const rows = await prisma.auditEntry.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      select: {
        id: true,
        createdAt: true,
        scenario: true,
        surface: true,
        mode: true,
        model: true,
        promptVersion: true,
        inputDigest: true,
        outputDigest: true,
        inputTokens: true,
        outputTokens: true,
        latencyMs: true,
        costMicros: true,
        outcome: true,
        actor: true,
      },
    });

    return NextResponse.json(
      {
        sessionId,
        count: rows.length,
        truncated: rows.length === MAX_ROWS,
        entries: rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          // Present cost as a readable string; the column is USD millionths.
          costUsd:
            r.costMicros == null ? null : (r.costMicros / 1_000_000).toFixed(4),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[/api/audit] query failed:", err);
    return NextResponse.json(
      {
        error: "unavailable",
        message: "The audit log could not be read. The database may be unreachable.",
      },
      { status: 503 },
    );
  }
}
