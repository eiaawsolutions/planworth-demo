import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { scenarioBySlug } from "@/lib/scenarios";
import {
  scoreEvents,
  responseLabel,
  SECURITY_WEIGHTS,
  type AccessEvent,
  type Severity,
} from "@/lib/sim/security";
import { ScenarioShell, Panel } from "@/components/scenario-shell";
import { GoldRule, Pill, type PillTone } from "@/components/atoms";

export const metadata: Metadata = {
  title: "Adaptive Security & Threat Prevention",
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<Severity, PillTone> = {
  BASELINE: "neutral",
  NOTICE: "gold",
  ANOMALY: "caution",
  BLOCKED: "critical",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  BASELINE: "Baseline",
  NOTICE: "Notice",
  ANOMALY: "Anomaly",
  BLOCKED: "Blocked",
};

function timeOf(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export default async function SecurityPage() {
  const scenario = scenarioBySlug("security");
  if (!scenario) notFound();

  const rows = await prisma.securityEvent.findMany({
    orderBy: { sortOrder: "asc" },
  });

  if (rows.length === 0) {
    return (
      <ScenarioShell scenario={scenario}>
        <Panel>
          <p className="text-[14px] text-muted">
            No seeded access log found. Run <code>npm run db:seed</code>.
          </p>
        </Panel>
      </ScenarioShell>
    );
  }

  const events: AccessEvent[] = rows.map((r) => ({
    id: r.id,
    actor: r.actor,
    actorRole: r.actorRole,
    action: r.action,
    ipAddress: r.ipAddress,
    geoLabel: r.geoLabel,
    deviceLabel: r.deviceLabel,
    occurredAt: r.occurredAt,
    recordsTouched: r.recordsTouched,
    sortOrder: r.sortOrder,
  }));

  const { baseline, scored } = scoreEvents(events);
  const escalated = scored.filter((e) => e.severity === "ANOMALY" || e.severity === "BLOCKED");

  return (
    <ScenarioShell scenario={scenario}>
      <div className="flex flex-col gap-6">
        {/* The PDPA position, stated plainly and early */}
        <Panel className="!border-verdict-halt/30">
          <p className="pw-eyebrow">Before reading the trace</p>
          <p className="mt-2.5 max-w-3xl text-[14px] leading-relaxed text-navy/90">
            The brief describes this capability as{" "}
            <em>behavioural biometrics</em> monitoring staff continuously. This
            demo does nothing of the kind: it collects no biometric signal,
            profiles no person, and stores nothing beyond the seeded log below.
          </p>
          <p className="mt-2.5 max-w-3xl text-[13px] leading-relaxed text-muted">
            That distinction is worth stating rather than glossing. Continuous
            behavioural monitoring of employees engages the Personal Data
            Protection Act 2010 — it would need a lawful basis, a data-protection
            impact assessment and staff notification before a single keystroke was
            recorded. What follows demonstrates the <strong className="font-semibold text-navy">mechanism</strong>{" "}
            — establish normal, score departures from it, respond proportionately
            — on invented data.
          </p>
        </Panel>

        {/* Derived baseline */}
        <Panel step="01" title="What normal looks like">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <h3 className="pw-serif text-[19px] leading-tight text-navy">
                {scored[0].actor}
              </h3>
              <p className="mt-1 text-[12.5px] text-muted">{scored[0].actorRole}</p>
            </div>
            <Pill tone="neutral">
              Derived from {baseline.sampleSize} of {scored.length} actions
            </Pill>
          </div>

          <GoldRule className="my-5" />

          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="pw-eyebrow">Usual location</dt>
              <dd className="mt-1.5 text-[14px] font-semibold text-navy">
                {baseline.geoLabel}
              </dd>
            </div>
            <div>
              <dt className="pw-eyebrow">Usual device</dt>
              <dd className="mt-1.5 text-[14px] font-semibold text-navy">
                {baseline.deviceLabel}
              </dd>
            </div>
            <div>
              <dt className="pw-eyebrow">Active window</dt>
              <dd className="pw-num mt-1.5 text-[14px] font-semibold text-navy">
                {String(baseline.earliestHour).padStart(2, "0")}:00 –{" "}
                {String(baseline.latestHour).padStart(2, "0")}:59
              </dd>
            </div>
            <div>
              <dt className="pw-eyebrow">Largest single read</dt>
              <dd className="pw-num mt-1.5 text-[14px] font-semibold text-navy">
                {baseline.typicalMaxRecords.toLocaleString("en-MY")} records
              </dd>
            </div>
          </dl>

          <div className="mt-5 rounded-lg border border-line bg-cream px-4 py-3">
            <p className="pw-eyebrow">Scoring weights</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
              Location deviation {SECURITY_WEIGHTS.geo} · unrecognised device{" "}
              {SECURITY_WEIGHTS.device} · outside working pattern{" "}
              {SECURITY_WEIGHTS.hour} · volume deviation up to{" "}
              {SECURITY_WEIGHTS.volume}. Fixed values, summed and capped at 100 —
              not learned, not weighted per person.
            </p>
          </div>
        </Panel>

        {/* The trace */}
        <Panel step="02" title="The day, scored">
          <ol className="flex flex-col">
            {scored.map((e) => {
              const isEscalated =
                e.severity === "ANOMALY" || e.severity === "BLOCKED";
              return (
                <li
                  key={e.id}
                  className="border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <span className="pw-num shrink-0 pt-0.5 text-[13px] font-semibold text-navy-slate">
                      {timeOf(e.occurredAt)}
                    </span>

                    <div className="min-w-[200px] flex-1">
                      <p className="text-[14px] font-semibold text-navy">
                        {e.action}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {e.geoLabel} · {e.ipAddress} · {e.deviceLabel}
                        {e.recordsTouched > 0
                          ? ` · ${e.recordsTouched.toLocaleString("en-MY")} record${e.recordsTouched === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <span
                        className="pw-num pw-serif text-[19px] leading-none"
                        style={{
                          color: isEscalated ? "#8c2f2f" : "#2e3548",
                        }}
                      >
                        {e.anomalyScore}
                      </span>
                      <Pill tone={SEVERITY_TONE[e.severity]} dot={isEscalated}>
                        {SEVERITY_LABEL[e.severity]}
                      </Pill>
                    </div>
                  </div>

                  {/* Reasons */}
                  <ul className="mt-3 ml-[52px] flex flex-col gap-1.5">
                    {e.reasons.map((r, i) => (
                      <li
                        key={`${r.label}-${i}`}
                        className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] leading-relaxed"
                      >
                        <span className="font-semibold text-navy">
                          {r.label}
                        </span>
                        {r.points > 0 ? (
                          <span className="pw-num text-[11px] font-semibold text-verdict-flag">
                            +{r.points}
                          </span>
                        ) : null}
                        <span className="text-muted">{r.detail}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Response */}
                  {e.responseActions[0] !== "NONE" ? (
                    <div className="mt-3 ml-[52px] flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-navy-slate">
                        Response
                      </span>
                      {e.responseActions.map((a) => (
                        <Pill key={a} tone="critical">
                          {responseLabel(a)}
                        </Pill>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Panel>

        {/* Outcome */}
        <Panel step="03" title="Outcome">
          {escalated.length > 0 ? (
            <div className="flex flex-col gap-4">
              <p className="text-[14.5px] leading-relaxed text-navy/90">
                {escalated.length} of {scored.length} actions departed far enough
                from the baseline to trigger a response. The final action —{" "}
                <strong className="font-semibold">
                  {escalated[escalated.length - 1].action.toLowerCase()}
                </strong>{" "}
                from {escalated[escalated.length - 1].geoLabel}, touching{" "}
                {escalated[escalated.length - 1].recordsTouched.toLocaleString("en-MY")}{" "}
                records — combined a location change, an unknown device, an
                off-hours timestamp and a bulk read, which is the case the brief
                illustrates.
              </p>

              <div className="pw-ground-navy rounded-xl p-5 text-on-navy">
                <p className="pw-eyebrow-gold">Actions taken</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {escalated[escalated.length - 1].responseActions.map((a) => (
                    <li key={a} className="flex items-baseline gap-2.5 text-[14px]">
                      <span aria-hidden="true" className="text-gold-light">
                        ·
                      </span>
                      <span>{responseLabel(a)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[12.5px] leading-relaxed text-on-navy-muted">
                  In a live deployment the same trace would raise a case for the
                  security team rather than resolving itself. A lock that no human
                  reviews is an outage waiting to happen, and a false positive on a
                  legitimate late-night export is a real cost.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[14px] text-muted">
              Every action in this trace is consistent with the derived baseline.
            </p>
          )}
        </Panel>
      </div>
    </ScenarioShell>
  );
}
