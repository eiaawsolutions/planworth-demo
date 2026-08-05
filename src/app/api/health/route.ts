import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/anthropic";

/**
 * Health check for Railway (`healthcheckPath` in railway.json) and for answering
 * "is it the app or the environment?" without opening a scenario page.
 *
 * Reports capability, never configuration values. `secretMode` says whether the
 * key is expected to arrive as an Infisical handle or as a raw value; it never
 * reveals either. `ai` is a boolean, not a key prefix.
 *
 * The distinction that actually matters operationally: a missing API key is NOT
 * unhealthy. The three simulated scenarios work without one, and the two live
 * ones say so honestly — so the process is fine and Railway should keep it in
 * rotation. Only a dead database makes this 503.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch (err) {
    console.error("[/api/health] database unreachable:", err);
  }

  const raw = process.env.ANTHROPIC_API_KEY ?? "";
  const secretMode = raw.startsWith("secret://")
    ? "infisical-handle"
    : raw.trim()
      ? "raw-value"
      : "unset";

  const body = {
    status: db ? "ok" : "degraded",
    db,
    ai: isAiConfigured(),
    secretMode,
    resolverEnabled: process.env.INFISICAL_RESOLVER_ENABLED === "true",
    // Which scenarios are usable in this environment right now.
    scenarios: {
      simulated: db ? "available" : "unavailable (needs the database)",
      live: isAiConfigured()
        ? db
          ? "available"
          : "partly available (document reconciliation needs the database)"
        : "unavailable (no API key configured)",
    },
  };

  return NextResponse.json(body, {
    status: db ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
