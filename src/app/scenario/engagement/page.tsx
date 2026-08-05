import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { scenarioBySlug } from "@/lib/scenarios";
import { detectFundingGap, type CashflowMonth } from "@/lib/sim/engagement";
import { formatMyr } from "@/lib/money";
import { ScenarioShell, Panel } from "@/components/scenario-shell";
import { ReasoningSteps } from "@/components/reasoning-steps";
import { CashflowChart } from "@/components/cashflow-chart";
import { Pill, GoldRule } from "@/components/atoms";

export const metadata: Metadata = {
  title: "Hyper-Personalised Omni-Channel Engagement",
  robots: "noindex, nofollow",
};

// Reads the seeded series on every request; nothing here is cached because the
// point of the page is that the numbers are computed, not stored.
export const dynamic = "force-dynamic";

export default async function EngagementPage() {
  const scenario = scenarioBySlug("engagement");
  if (!scenario) notFound();

  const client = await prisma.client.findFirst({
    where: { cashflowPoints: { some: {} } },
    include: {
      cashflowPoints: { orderBy: { monthIndex: "asc" } },
      campaigns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!client) {
    return (
      <ScenarioShell scenario={scenario}>
        <Panel>
          <p className="text-[14px] text-muted">
            No seeded cash-flow series found. Run <code>npm run db:seed</code>.
          </p>
        </Panel>
      </ScenarioShell>
    );
  }

  const series: CashflowMonth[] = client.cashflowPoints.map((p) => ({
    monthIndex: p.monthIndex,
    label: p.label,
    netPositionSen: p.netPositionSen,
  }));

  const detection = detectFundingGap(series);
  const campaign = client.campaigns[0] ?? null;

  return (
    <ScenarioShell scenario={scenario}>
      <div className="flex flex-col gap-6">
        {/* Client context */}
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="pw-eyebrow">Client under review</p>
              <h2 className="pw-serif mt-2 text-[22px] leading-tight text-navy">
                {client.name}
              </h2>
              <p className="mt-1.5 text-[13px] text-muted">
                {client.sector} · {client.registrationNo} ·{" "}
                {client.relationshipMonths} months on book
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Pill tone="gold">Approved limit {formatMyr(client.approvedLimitSen)}</Pill>
              <Pill tone="neutral">Fictional fixture</Pill>
            </div>
          </div>
        </Panel>

        {/* The curve */}
        <Panel step="01" title="Read the seasonal pattern">
          <CashflowChart
            series={series}
            baselineSen={detection.baselineSen}
            coverageFloorSen={detection.coverageFloorSen}
            primaryGap={detection.primaryGap}
          />
        </Panel>

        {/* The working */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Panel step="02" title="How the gap was found">
            <ReasoningSteps steps={detection.steps} />
            <div className="mt-5 rounded-lg border border-line bg-cream px-4 py-3">
              <p className="text-[12px] leading-relaxed text-muted">
                Every figure above is arithmetic over the twelve seeded months —
                you can check it by hand. A trained forecaster would weigh
                interaction history, sector seasonality and buyer behaviour as
                well, and would not be reproducible this way.
              </p>
            </div>
          </Panel>

          {/* The resulting outreach */}
          <Panel step="03" title="What it would send">
            {detection.primaryGap && campaign ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="caution" dot>
                    Gap in {detection.primaryGap.label}
                  </Pill>
                  <Pill tone="neutral">
                    {detection.primaryGap.belowBaselinePct}% below baseline
                  </Pill>
                </div>

                {/* Message preview, in the spirit of slide 5's phone mock */}
                <div className="pw-ground-navy rounded-xl p-4 text-on-navy">
                  <div className="flex items-center gap-2 border-b border-gold-deep/40 pb-2.5">
                    <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gold-light">
                      WhatsApp · Planworth
                    </span>
                    <span className="ml-auto text-[10px] text-on-navy-muted">
                      Draft
                    </span>
                  </div>
                  <p className="pw-serif mt-3 text-[16px] leading-snug text-on-navy">
                    {campaign.offerHeadline}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-on-navy/85">
                    {campaign.offerBody}
                  </p>
                  {campaign.offerAmountSen ? (
                    <p className="pw-num mt-3 text-[13px] font-semibold text-gold-light">
                      Indicative line: {formatMyr(campaign.offerAmountSen)}
                    </p>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <span className="rounded-md bg-gold-light px-3 py-1.5 text-[11px] font-semibold text-navy">
                      View offer
                    </span>
                    <span
                      className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-on-navy-muted"
                      style={{ boxShadow: "inset 0 0 0 1px rgba(167,149,111,0.5)" }}
                    >
                      Not now
                    </span>
                  </div>
                </div>

                <GoldRule />

                <div>
                  <p className="pw-eyebrow">Why this month</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">
                    {campaign.triggerRationale}
                  </p>
                </div>

                <div className="rounded-lg border border-line bg-cream px-4 py-3">
                  <p className="text-[12px] leading-relaxed text-muted">
                    <strong className="font-semibold text-navy">
                      Nothing is sent.
                    </strong>{" "}
                    This is a drafted message held for relationship-manager
                    approval. The demo has no WhatsApp Business connection, and a
                    live deployment would need one plus the client&rsquo;s
                    marketing consent on record before any message went out.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[14px] text-muted">
                No month in this series breaches the coverage floor, so the
                simulation proposes no outreach.
              </p>
            )}
          </Panel>
        </div>

        {/* Sizing summary */}
        {detection.primaryGap ? (
          <Panel step="04" title="The facility it would set aside">
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="pw-eyebrow">Baseline position</p>
                <p className="pw-serif pw-num mt-2 text-[26px] leading-none text-navy">
                  {formatMyr(detection.baselineSen)}
                </p>
              </div>
              <div>
                <p className="pw-eyebrow">
                  {detection.primaryGap.label} position
                </p>
                <p className="pw-serif pw-num mt-2 text-[26px] leading-none text-verdict-halt">
                  {formatMyr(detection.primaryGap.netPositionSen)}
                </p>
              </div>
              <div>
                <p className="pw-eyebrow">Facility proposed</p>
                <p className="pw-serif pw-num mt-2 text-[26px] leading-none text-navy">
                  {formatMyr(detection.recommendedFacilitySen)}
                </p>
              </div>
            </div>
          </Panel>
        ) : null}
      </div>
    </ScenarioShell>
  );
}
