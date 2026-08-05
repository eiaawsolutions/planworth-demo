import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { scenarioBySlug } from "@/lib/scenarios";
import { scoreClient, TOTAL_WEIGHT, type RiskBand } from "@/lib/sim/risk";
import { formatMyr, formatMyrDelta } from "@/lib/money";
import { ScenarioShell, Panel } from "@/components/scenario-shell";
import { FactorBar, GoldRule, Pill, ScoreRing, type PillTone } from "@/components/atoms";

export const metadata: Metadata = {
  title: "Dynamic Credit & Risk Scoring",
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

const BAND_TONE: Record<RiskBand, PillTone> = {
  PRIME: "positive",
  STANDARD: "neutral",
  WATCH: "caution",
  ELEVATED: "critical",
};

const BAND_STROKE: Record<RiskBand, string> = {
  PRIME: "#2f6b4f",
  STANDARD: "#bfa373",
  WATCH: "#9a4a24",
  ELEVATED: "#8c2f2f",
};

export default async function RiskPage({
  searchParams,
}: {
  // Next 16: request APIs are async.
  searchParams: Promise<{ client?: string }>;
}) {
  const scenario = scenarioBySlug("risk");
  if (!scenario) notFound();

  const { client: selectedId } = await searchParams;

  const clients = await prisma.client.findMany({
    where: { creditHistory: { isNot: null } },
    include: { creditHistory: true },
    orderBy: { name: "asc" },
  });

  if (clients.length === 0) {
    return (
      <ScenarioShell scenario={scenario}>
        <Panel>
          <p className="text-[14px] text-muted">
            No seeded credit history found. Run <code>npm run db:seed</code>.
          </p>
        </Panel>
      </ScenarioShell>
    );
  }

  // Score every client, then pick the one to detail.
  const assessed = clients.map((c) => ({
    client: c,
    assessment: scoreClient(
      {
        relationshipMonths: c.relationshipMonths,
        approvedLimitSen: c.approvedLimitSen,
      },
      c.creditHistory!,
    ),
  }));

  const ranked = [...assessed].sort(
    (a, b) => b.assessment.score - a.assessment.score,
  );

  const selected =
    assessed.find((a) => a.client.id === selectedId) ?? ranked[0];

  const portfolioTransactions = clients.reduce(
    (sum, c) => sum + (c.creditHistory?.transactionsObserved ?? 0),
    0,
  );

  return (
    <ScenarioShell scenario={scenario}>
      <div className="flex flex-col gap-6">
        {/* Honest framing of the dataset */}
        <Panel>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="pw-eyebrow">The dataset behind these scores</p>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-navy/85">
                {clients.length} seeded clients and{" "}
                <span className="pw-num font-semibold">
                  {portfolioTransactions.toLocaleString("en-MY")}
                </span>{" "}
                observed transactions. The brief cites 40,000+ transactions across
                RM 4 billion — this is a deliberately small, inspectable slice of
                that shape, not a sample of it.
              </p>
            </div>
            <Pill tone="gold" dot>
              Seven-factor scorecard
            </Pill>
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          {/* Portfolio */}
          <Panel step="01" title="Portfolio, scored">
            <ul className="flex flex-col">
              {ranked.map(({ client, assessment }) => {
                const isSelected = client.id === selected.client.id;
                return (
                  <li key={client.id} className="border-b border-line last:border-b-0">
                    <Link
                      href={`/scenario/risk?client=${client.id}`}
                      aria-current={isSelected ? "true" : undefined}
                      className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-cream"
                      style={
                        isSelected
                          ? { background: "rgba(191,163,115,0.13)" }
                          : undefined
                      }
                    >
                      <span
                        className="pw-num pw-serif w-[38px] shrink-0 text-right text-[20px] leading-none text-navy"
                        aria-hidden="true"
                      >
                        {assessment.score}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-navy">
                          {client.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-muted">
                          {client.sector}
                        </span>
                      </span>
                      <span className="shrink-0">
                        <Pill tone={BAND_TONE[assessment.band]}>
                          {assessment.bandLabel}
                        </Pill>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[12px] leading-relaxed text-muted-soft">
              Select a client to see the full scorecard. Scores are recomputed on
              every request — there is no stored score anywhere in the database.
            </p>
          </Panel>

          {/* Selected scorecard */}
          <Panel step="02" title="Scorecard">
            <div className="flex flex-wrap items-start gap-6">
              <ScoreRing
                score={selected.assessment.score}
                strokeColor={BAND_STROKE[selected.assessment.band]}
                caption={selected.assessment.bandLabel}
              />
              <div className="min-w-[220px] flex-1">
                <h3 className="pw-serif text-[20px] leading-tight text-navy">
                  {selected.client.name}
                </h3>
                <p className="mt-1 text-[12.5px] text-muted">
                  {selected.client.sector} ·{" "}
                  {selected.client.relationshipMonths} months on book ·{" "}
                  {selected.client.creditHistory!.transactionsObserved} facilities
                  observed
                </p>
                <p className="mt-3 text-[13.5px] leading-relaxed text-navy/85">
                  {selected.assessment.bandRationale}
                </p>
              </div>
            </div>

            <GoldRule className="my-6" />

            {/* Factors */}
            <div className="flex flex-col gap-4">
              {selected.assessment.factors.map((f) => (
                <div key={f.label}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold text-navy">
                      {f.label}
                    </span>
                    <span className="pw-num text-[12px] text-muted">
                      {f.observed}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <FactorBar points={f.points} maxWeight={f.maxWeight} />
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-soft">
                    {f.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-baseline justify-between border-t border-line-strong pt-4">
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-navy-slate">
                Total
              </span>
              <span className="pw-serif pw-num text-[22px] text-navy">
                {selected.assessment.score} / {TOTAL_WEIGHT}
              </span>
            </div>
          </Panel>
        </div>

        {/* The recommendation */}
        <Panel step="03" title="What the simulation would do next">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="pw-eyebrow">Current limit</p>
              <p className="pw-serif pw-num mt-2 text-[26px] leading-none text-navy">
                {formatMyr(selected.assessment.currentLimitSen)}
              </p>
            </div>
            <div>
              <p className="pw-eyebrow">Recommended</p>
              <p className="pw-serif pw-num mt-2 text-[26px] leading-none text-navy">
                {formatMyr(selected.assessment.recommendedLimitSen)}
              </p>
            </div>
            <div>
              <p className="pw-eyebrow">Change</p>
              <p
                className="pw-serif pw-num mt-2 text-[26px] leading-none"
                style={{
                  color:
                    selected.assessment.deltaSen > 0n
                      ? "#2f6b4f"
                      : selected.assessment.deltaSen < 0n
                        ? "#8c2f2f"
                        : "#2e3548",
                }}
              >
                {selected.assessment.deltaSen === 0n
                  ? "No change"
                  : formatMyrDelta(selected.assessment.deltaSen)}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-line bg-cream px-4 py-3.5">
            <p className="pw-eyebrow">How the limit was reached</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {selected.assessment.limitBasis}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Average facility drawn to date:{" "}
              <span className="pw-num font-semibold text-navy">
                {formatMyr(selected.assessment.avgTicketSen)}
              </span>
              .
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-line bg-paper-warm px-4 py-3.5">
            <p className="text-[12.5px] leading-relaxed text-muted">
              <strong className="font-semibold text-navy">
                A limit change is a credit decision, not an output.
              </strong>{" "}
              Even in a live deployment this would be a recommendation carrying its
              reasoning to a human with delegated authority — an automatic increase
              on a model&rsquo;s say-so is not something a lender should build, and
              nothing here writes back to a facility.
            </p>
          </div>
        </Panel>
      </div>
    </ScenarioShell>
  );
}
