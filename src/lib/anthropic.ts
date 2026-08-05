import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { resolveSecret } from "./secrets";

/**
 * The ONLY place the Anthropic API key is read. Server-only — never bundled to
 * the client. The CSP (connect-src 'self') forbids the browser from reaching
 * api.anthropic.com directly; all model traffic proxies through our own route
 * handlers.
 *
 * The key comes from ANTHROPIC_API_KEY, which in production is a `secret://`
 * Infisical handle resolved at runtime (see lib/secrets.ts). In local dev the
 * resolver is disabled and a plain value from the shell is used.
 */

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

/**
 * True when a key is present. The two real scenarios call this first so they can
 * render an honest "AI backend not configured" state instead of a stack trace —
 * the three simulated scenarios never need it.
 */
export function isAiConfigured(): boolean {
  const raw = process.env.ANTHROPIC_API_KEY;
  return typeof raw === "string" && raw.trim().length > 0;
}

export async function getAnthropic(): Promise<Anthropic> {
  if (globalForAnthropic.anthropic) return globalForAnthropic.anthropic;

  const apiKey = await resolveSecret(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set (or its Infisical handle did not resolve). " +
        "Set it in your shell for local dev, or configure the Infisical resolver for production.",
    );
  }
  globalForAnthropic.anthropic = new Anthropic({
    apiKey,
    // Two retries on 429/5xx is the SDK default; make the intent explicit.
    maxRetries: 2,
    // Well under Railway's request ceiling. Streaming calls set their own.
    timeout: 60_000,
  });
  return globalForAnthropic.anthropic;
}

/** Exact model id — no date suffix. */
export const PLANWORTH_MODEL = "claude-opus-5";

/**
 * Server-side refusal fallback. Claude Opus 5's safety classifiers can decline a
 * request and return HTTP 200 with `stop_reason: "refusal"` and empty content.
 * `fallbacks: "default"` lets the API re-serve the request on Anthropic's
 * recommended substitute instead of the caller getting a blank response.
 *
 * Requires the beta endpoint, and the parameter is newer than this SDK's
 * typings — hence the loose type and `attemptWithFallback` below.
 */
const REFUSAL_FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
} as const;

/**
 * Run a request with refusal fallback enabled, and retry once WITHOUT it if the
 * API rejects those parameters.
 *
 * The belt-and-braces exists for a specific reason: this is a demo that will be
 * driven live in front of a prospect. A refusal on a benign financing
 * conversation is unlikely, so the fallback is a nice-to-have — but a 400 from an
 * unrecognised beta parameter would break the headline feature outright. Trying
 * the better request first and degrading quietly is the right trade here.
 *
 * `run` receives the extra params to spread into its request. It is called at
 * most twice.
 */
export async function attemptWithFallback<T>(
  run: (extra: Record<string, unknown>) => Promise<T>,
): Promise<{ result: T; fallbackEnabled: boolean }> {
  try {
    const result = await run({ ...REFUSAL_FALLBACK });
    return { result, fallbackEnabled: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Only swallow the shape of failure this guard is for. Anything else — auth,
    // rate limit, network — must surface to the caller unchanged.
    const looksLikeUnsupportedParam =
      /fallback|beta|unexpected|unrecognized|unrecognised|not supported|invalid_request/i.test(
        message,
      );
    if (!looksLikeUnsupportedParam) throw err;
    console.warn(
      "[anthropic] refusal-fallback params rejected, retrying without them:",
      message.slice(0, 200),
    );
    const result = await run({});
    return { result, fallbackEnabled: false };
  }
}

/**
 * Thinking is ON BY DEFAULT on Claude Opus 5, and `max_tokens` caps thinking
 * plus visible output together. Budgets below therefore carry deliberate
 * headroom above the answer length we actually want, or responses truncate
 * mid-sentence.
 */
export const TOKEN_BUDGET = {
  /** Conversational triage turn — short answers, room to reason. */
  concierge: 8_000,
  /** Document extraction — structured output, but reasoning over a scan. */
  extraction: 12_000,
} as const;

/** Rough USD-per-token for Claude Opus 5, used only for demo cost display. */
const USD_PER_INPUT_TOKEN = 5 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 25 / 1_000_000;

/** Cost in USD millionths, kept integral so it can live in an Int column. */
export function costMicros(inputTokens: number, outputTokens: number): number {
  const usd = inputTokens * USD_PER_INPUT_TOKEN + outputTokens * USD_PER_OUTPUT_TOKEN;
  return Math.round(usd * 1_000_000);
}
