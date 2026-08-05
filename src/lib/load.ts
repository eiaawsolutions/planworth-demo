import "server-only";

/**
 * Run a data query without letting a failure escape into a blank page.
 *
 * The scenario pages are `force-dynamic` server components that read Prisma. If
 * the database is unreachable, an unguarded query throws during render and the
 * visitor gets a blank or error page — which, in the middle of a client
 * presentation, is the worst available outcome. Wrapping the read lets each page
 * render its own composed "data unavailable" panel instead.
 *
 * Distinguishes "the query failed" from "the query returned nothing", because the
 * two need different copy: one is a hosting problem, the other is an unseeded
 * environment.
 */
export async function tryLoad<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    console.error("[tryLoad] query failed:", err);
    return { ok: false };
  }
}
