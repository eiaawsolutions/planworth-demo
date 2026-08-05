"use client";

import { useState } from "react";
import { Pill } from "./atoms";

/**
 * On-demand view of the audit rows for the current session.
 *
 * Both live routes write an `AuditEntry` before a token is generated, and the UI
 * says so. Until this existed, that was a claim the audience had to take on
 * trust — which is a weak position in front of a lender, for whom "can this be
 * audited" is closer to the buying question than "is the output good".
 *
 * Fetched on demand rather than on mount: it is a supporting detail, not the
 * headline, and it should not cost a request on every page view.
 */

interface AuditEntryRow {
  id: string;
  createdAt: string;
  scenario: string;
  surface: string;
  mode: string;
  model: string | null;
  promptVersion: string | null;
  inputDigest: string;
  outputDigest: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  costUsd: string | null;
  outcome: string | null;
  actor: string;
}

export function AuditTrail({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AuditEntryRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/audit?session=${encodeURIComponent(sessionId)}`);
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.message ?? "The audit log could not be read.");
        return;
      }
      setRows(payload.entries as AuditEntryRow[]);
    } catch {
      // Deliberately not swallowed silently — an audit panel that shows nothing
      // without saying why is worse than one that admits it failed.
      setError("The audit log request did not complete.");
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows === null && !busy) void load();
  }

  return (
    <div className="rounded-xl border border-line bg-paper-warm px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="pw-eyebrow">Audit trail</p>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="ml-auto text-[11px] font-semibold tracking-[0.12em] uppercase text-muted transition-colors hover:text-navy"
        >
          {open ? "Hide" : rows === null ? "Show this session" : "Show"}
        </button>
      </div>

      {!open ? (
        <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
          Every model call on this page wrote an append-only row before a single
          token was generated. Open this to read them.
        </p>
      ) : (
        <div className="mt-4">
          {busy ? (
            <p className="text-[13px] text-muted">Reading the log…</p>
          ) : error ? (
            <p className="text-[13px] leading-relaxed text-verdict-halt">{error}</p>
          ) : rows && rows.length > 0 ? (
            <>
              <ul className="flex flex-col">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className="border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={r.mode === "real" ? "positive" : "gold"}>
                        {r.scenario}
                      </Pill>
                      <span className="pw-num text-[11.5px] text-muted">
                        {new Date(r.createdAt).toLocaleTimeString("en-MY", {
                          hour12: false,
                        })}
                      </span>
                      {r.outcome ? (
                        <span className="text-[12px] font-semibold text-navy">
                          {r.outcome}
                        </span>
                      ) : null}
                    </div>

                    <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px] sm:grid-cols-3">
                      <Row label="model" value={r.model} />
                      <Row label="prompt" value={r.promptVersion} />
                      <Row
                        label="tokens"
                        value={
                          r.inputTokens != null
                            ? `${r.inputTokens} in / ${r.outputTokens ?? 0} out`
                            : null
                        }
                      />
                      <Row
                        label="latency"
                        value={r.latencyMs != null ? `${(r.latencyMs / 1000).toFixed(1)}s` : null}
                      />
                      <Row label="cost" value={r.costUsd ? `USD ${r.costUsd}` : null} />
                      <Row label="input sha" value={r.inputDigest.slice(0, 12) || null} />
                    </dl>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-soft">
                Digests, not content — the log records a sha256 prefix of what was
                sent and returned, never the prompt or the reply. Scoped to this
                browser session only.
              </p>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted">
              No rows yet for this session. Run a call above and reopen this.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-soft">{label}</dt>
      <dd
        className={
          value ? "pw-num truncate text-right text-navy" : "text-right text-muted-soft"
        }
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}
