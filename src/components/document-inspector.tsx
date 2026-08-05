"use client";

import Image from "next/image";
import { useState } from "react";
import { GoldRule, Pill, type PillTone } from "./atoms";
import { AuditTrail } from "./audit-trail";

/**
 * The client half of scenario 3. Sends a fixture to /api/extract and renders the
 * extraction beside the CRM record it was reconciled against.
 *
 * Every value shown here comes back from a live model call — nothing is
 * pre-computed. The fixture that disagrees with its application is marked, but
 * only after extraction, so the audience watches the check happen rather than
 * being told the answer first.
 */

export interface DocumentSummary {
  id: string;
  kind: string;
  label: string;
  assetPath: string;
  isDeliberateMismatch: boolean;
  applicationReference: string;
  clientName: string;
  declaredAmount: string | null;
  awardingBody: string | null;
  contractReference: string | null;
}

interface FieldComparison {
  name: string;
  extractedText: string;
  crmValue: string | null;
  matches: boolean;
  note: string;
  informationalOnly: boolean;
}

interface ExtractResponse {
  extraction: {
    documentType: string;
    documentNumber: string;
    documentDate: string;
    documentDateAsPrinted: string;
    totalAmount: string;
    currency: string;
    issuer: string;
    counterparty: string;
    contractReference: string;
    legibility: "clean" | "degraded" | "partially_illegible";
    legibilityNotes: string;
  };
  reconciliation: {
    verdict: "ANOMALY_FREE" | "MISMATCH_FLAGGED" | "UNREADABLE";
    rationale: string;
    fields: FieldComparison[];
    amountDeltaSen: string | null;
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    model: string;
  };
}

const KIND_LABEL: Record<string, string> = {
  INVOICE: "Invoice",
  PURCHASE_ORDER: "Purchase order",
  PROGRESS_CLAIM: "Progress claim",
  LETTER_OF_AWARD: "Letter of award",
};

const VERDICT: Record<
  ExtractResponse["reconciliation"]["verdict"],
  { label: string; tone: PillTone }
> = {
  ANOMALY_FREE: { label: "Anomaly free — ready for approval", tone: "positive" },
  MISMATCH_FLAGGED: { label: "Mismatch flagged — held for analyst", tone: "critical" },
  UNREADABLE: { label: "Unreadable — clearer copy needed", tone: "caution" },
};

const LEGIBILITY: Record<string, { label: string; tone: PillTone }> = {
  clean: { label: "Clean page", tone: "neutral" },
  degraded: { label: "Degraded scan", tone: "caution" },
  partially_illegible: { label: "Partially illegible", tone: "caution" },
};

function newSessionId() {
  return `demo-${Math.random().toString(36).slice(2, 10)}`;
}

export function DocumentInspector({
  documents,
  configured,
}: {
  documents: DocumentSummary[];
  configured: boolean;
}) {
  const [selectedId, setSelectedId] = useState(documents[0]?.id ?? "");
  // Sent with every extraction so the audit rows are attributable to this
  // browser session, and so the audit panel below can scope its read to them.
  const [sessionId] = useState(newSessionId);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, ExtractResponse>>({});
  const [error, setError] = useState<string | null>(null);

  const selected = documents.find((d) => d.id === selectedId) ?? documents[0];
  const current = selected ? result[selected.id] : undefined;

  async function extract() {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selected.id, sessionId }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.message ?? "Extraction failed.");
        return;
      }
      setResult((prev) => ({ ...prev, [selected.id]: payload as ExtractResponse }));
    } catch {
      setError("The request did not complete. Check the server log.");
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <div className="pw-card rounded-xl p-6">
        <p className="text-[14px] leading-relaxed text-navy/90">
          This environment has no demonstration documents loaded, so there is
          nothing to extract from.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Document picker */}
      <div className="pw-card rounded-xl p-5">
        <p className="pw-eyebrow">Submitted documents</p>
        <ul className="mt-4 grid gap-2.5 lg:grid-cols-2">
          {documents.map((d) => {
            const active = d.id === selected.id;
            const done = result[d.id];
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(d.id);
                    setError(null);
                  }}
                  aria-pressed={active}
                  className="w-full rounded-lg border px-4 py-3 text-left transition-colors"
                  style={{
                    borderColor: active ? "#a7956f" : "rgba(11,27,50,0.12)",
                    background: active ? "rgba(191,163,115,0.10)" : "#fbfbf7",
                  }}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-navy-slate">
                      {KIND_LABEL[d.kind] ?? d.kind}
                    </span>
                    {done ? (
                      <Pill tone={VERDICT[done.reconciliation.verdict].tone}>
                        {done.reconciliation.verdict === "ANOMALY_FREE"
                          ? "Clear"
                          : done.reconciliation.verdict === "MISMATCH_FLAGGED"
                            ? "Flagged"
                            : "Unreadable"}
                      </Pill>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[13.5px] leading-snug font-semibold text-navy">
                    {d.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    {d.applicationReference} · {d.clientName}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* The page itself */}
        <div className="pw-card flex flex-col overflow-hidden rounded-xl">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-navy-slate">
              As submitted
            </span>
            {current ? (
              <Pill tone={LEGIBILITY[current.extraction.legibility]?.tone ?? "neutral"}>
                {LEGIBILITY[current.extraction.legibility]?.label ??
                  current.extraction.legibility}
              </Pill>
            ) : null}
          </div>

          <div className="bg-cream p-4">
            <Image
              src={selected.assetPath}
              alt={`Scanned page: ${selected.label}`}
              width={1000}
              height={900}
              className="h-auto w-full rounded border border-line"
              // Fixture pages are small and we want the first one instantly.
              priority={documents[0]?.id === selected.id}
            />
          </div>

          <div className="border-t border-line px-5 py-4">
            <p className="pw-eyebrow">What the CRM already holds</p>
            <dl className="mt-3 flex flex-col gap-2">
              <CrmRow label="Application" value={selected.applicationReference} />
              <CrmRow label="Client" value={selected.clientName} />
              <CrmRow label="Declared amount" value={selected.declaredAmount} />
              <CrmRow label="Awarding body / buyer" value={selected.awardingBody} />
              <CrmRow label="Contract reference" value={selected.contractReference} />
            </dl>
          </div>
        </div>

        {/* Extraction + reconciliation */}
        <div className="flex flex-col gap-4">
          <div className="pw-card rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="pw-eyebrow">Extraction &amp; reconciliation</p>
              <button
                type="button"
                onClick={extract}
                disabled={busy || !configured}
                className="rounded-lg bg-navy px-5 py-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-on-navy transition-colors hover:bg-navy-soft disabled:opacity-40"
              >
                {busy ? "Reading…" : current ? "Re-run" : "Extract & check"}
              </button>
            </div>

            {!configured ? (
              <div className="mt-4">
                <Pill tone="caution" dot>
                  AI backend not configured
                </Pill>
                <p className="mt-3 text-[13.5px] leading-relaxed text-navy/85">
                  This scenario reads the page with a live Claude call, and no{" "}
                  <code className="text-[13px]">ANTHROPIC_API_KEY</code> is set on
                  the server. Rather than display a pre-baked extraction dressed up
                  as a model output, it shows you this.
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-lg border border-verdict-halt/30 bg-cream px-4 py-3">
                <p className="text-[13px] leading-relaxed text-verdict-halt">
                  {error}
                </p>
              </div>
            ) : null}

            {busy && !current ? (
              <p className="mt-4 text-[13px] text-muted">
                Reading the page and cross-checking it against the application…
              </p>
            ) : null}

            {current ? (
              <div className="mt-5 flex flex-col gap-5">
                {/* Verdict */}
                <div>
                  <Pill tone={VERDICT[current.reconciliation.verdict].tone} dot>
                    {VERDICT[current.reconciliation.verdict].label}
                  </Pill>
                  <p className="mt-3 text-[14px] leading-relaxed text-navy/90">
                    {current.reconciliation.rationale}
                  </p>
                </div>

                <GoldRule />

                {/* Field-by-field */}
                <div className="flex flex-col">
                  {current.reconciliation.fields.map((f) => (
                    <div
                      key={f.name}
                      className="border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-navy">
                          {f.name}
                        </span>
                        {f.informationalOnly ? (
                          <Pill tone="neutral">Informational</Pill>
                        ) : f.matches ? (
                          <Pill tone="positive">Agrees</Pill>
                        ) : (
                          <Pill tone="critical" dot>
                            Disagrees
                          </Pill>
                        )}
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="rounded border border-line bg-cream px-3 py-2">
                          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-soft">
                            On the document
                          </p>
                          <p className="pw-num mt-1 text-[13px] font-semibold text-navy">
                            {f.extractedText}
                          </p>
                        </div>
                        <div className="rounded border border-line bg-cream px-3 py-2">
                          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-soft">
                            In the CRM
                          </p>
                          <p
                            className={
                              f.crmValue
                                ? "pw-num mt-1 text-[13px] font-semibold text-navy"
                                : "mt-1 text-[12px] text-muted-soft"
                            }
                          >
                            {f.crmValue ?? "nothing recorded"}
                          </p>
                        </div>
                      </div>

                      <p className="mt-2 text-[12px] leading-relaxed text-muted">
                        {f.note}
                      </p>
                    </div>
                  ))}
                </div>

                {current.extraction.legibilityNotes ? (
                  <div className="rounded-lg border border-line bg-paper-warm px-4 py-3">
                    <p className="pw-eyebrow">On the page quality</p>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                      {current.extraction.legibilityNotes}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {current ? (
            <div className="rounded-xl border border-line bg-paper-warm px-5 py-4">
              <p className="pw-eyebrow">Last call</p>
              <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Model</dt>
                  <dd className="pw-num text-navy">{current.usage.model}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Latency</dt>
                  <dd className="pw-num text-navy">
                    {(current.usage.latencyMs / 1000).toFixed(1)}s
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Input tokens</dt>
                  <dd className="pw-num text-navy">
                    {current.usage.inputTokens.toLocaleString("en-MY")}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Output tokens</dt>
                  <dd className="pw-num text-navy">
                    {current.usage.outputTokens.toLocaleString("en-MY")}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[11.5px] leading-relaxed text-muted-soft">
                The extracted fields and the verdict are written to the database, so
                the reconciliation can be reviewed after the fact rather than only
                being seen once.
              </p>
            </div>
          ) : null}

          <AuditTrail sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
}

function CrmRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-b-0">
      <dt className="shrink-0 text-[12px] text-muted">{label}</dt>
      <dd
        className={
          value
            ? "pw-num text-right text-[13px] font-semibold text-navy"
            : "text-right text-[12px] text-muted-soft"
        }
      >
        {value ?? "nothing recorded"}
      </dd>
    </div>
  );
}
