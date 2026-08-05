"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Last-resort boundary.
 *
 * The scenario pages degrade on their own (see components/data-unavailable.tsx),
 * so reaching this means something genuinely unanticipated happened. It exists so
 * that outcome is a composed page in the client's brand rather than an unstyled
 * Next.js error screen appearing mid-presentation.
 *
 * Deliberately does NOT print the error message. A stack trace or a database
 * connection string on screen in front of a client is worse than a vague apology.
 * The message goes to the server log, where it belongs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[boundary] unhandled error:", error);
  }, [error]);

  return (
    <div className="pw-ground-navy flex min-h-[70vh] flex-col items-center justify-center px-6 py-20 text-center text-on-navy">
      <p className="pw-eyebrow-gold">Planworth Intelligent Ecosystem</p>
      <h1 className="pw-serif mt-4 text-[clamp(1.5rem,3.4vw,2.3rem)] leading-tight">
        This page didn&rsquo;t load
      </h1>
      <p className="mt-4 max-w-md text-[14px] leading-relaxed text-on-navy/85">
        Something unexpected happened rendering this scenario. The details are in
        the server log.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-gold-light px-6 py-3 text-[11.5px] font-semibold tracking-[0.16em] uppercase text-navy transition-colors hover:bg-gold"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg px-6 py-3 text-[11.5px] font-semibold tracking-[0.16em] uppercase text-on-navy transition-colors hover:text-gold-light"
          style={{ boxShadow: "inset 0 0 0 1px rgba(167,149,111,0.6)" }}
        >
          Back to the overview
        </Link>
      </div>

      {error.digest ? (
        <p className="pw-num mt-8 text-[11px] text-on-navy-muted">
          Reference {error.digest}
        </p>
      ) : null}
    </div>
  );
}
