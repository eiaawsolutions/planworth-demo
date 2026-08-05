import Link from "next/link";
import type { Metadata } from "next";
import { Crest } from "@/components/crest";
import { GoldRule, Pill, StatTile } from "@/components/atoms";
import { SiteFooter, SiteHeader } from "@/components/scenario-shell";
import { FixtureNotice } from "@/components/mode-ribbon";
import { SCENARIOS, PILLAR_1_LABEL, PILLAR_2_LABEL } from "@/lib/scenarios";
import { PRODUCT_COUNT } from "@/lib/products";

export const metadata: Metadata = {
  title: "The Intelligent Ecosystem — Planworth × Claritas",
  robots: "noindex, nofollow",
};

const pillarOne = SCENARIOS.filter((s) => s.pillar === 1);
const pillarTwo = SCENARIOS.filter((s) => s.pillar === 2);
const realCount = SCENARIOS.filter((s) => s.mode === "real").length;
const simulatedCount = SCENARIOS.length - realCount;

export default function OverviewPage() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ── Slide 1 — title ───────────────────────────────── */}
        <section className="pw-ground-navy relative overflow-hidden text-on-navy">
          <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
            <div className="flex flex-col items-center text-center">
              <div className="text-gold">
                <Crest size={104} />
              </div>

              <h1 className="pw-serif mt-8 text-[clamp(2.1rem,6vw,3.9rem)] leading-[1.02] tracking-[-0.015em]">
                The Intelligent{" "}
                <span className="text-gold-light">Ecosystem</span>
              </h1>

              <p className="pw-serif mt-3 text-[clamp(1.05rem,2.6vw,1.6rem)] leading-snug text-gold-light">
                AI-Driven Growth and Optimisation for Planworth
              </p>

              <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-on-navy-muted">
                Strategic Implementation Brief · Integrated Marketing &amp; CRM
                System
              </p>

              <GoldRule className="mt-9 w-full max-w-xs" />

              <p className="mt-9 max-w-2xl text-[15px] leading-relaxed text-on-navy/90">
                A working preview of the five AI scenarios in the brief. Two of
                them run on Claude for real; three are transparent simulations,
                because they depend on Planworth&rsquo;s own transaction history.
                Each page says which it is, and why.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/scenario/triage"
                  className="rounded-lg bg-gold-light px-6 py-3 text-[11.5px] font-semibold tracking-[0.16em] uppercase text-navy transition-colors hover:bg-gold"
                >
                  Start with the live one
                </Link>
                <Link
                  href="#the-multiplier"
                  className="rounded-lg px-6 py-3 text-[11.5px] font-semibold tracking-[0.16em] uppercase text-on-navy transition-colors hover:text-gold-light"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(167,149,111,0.6)" }}
                >
                  See all five
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Slide 2 — the data foundation ─────────────────── */}
        <section className="border-b border-line bg-cream">
          <div className="mx-auto max-w-[1180px] px-5 py-14 md:px-8 md:py-18">
            <h2 className="pw-serif text-[clamp(1.5rem,3.2vw,2.3rem)] leading-tight text-navy">
              The scale of the financial engine
            </h2>

            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div>
                <p className="pw-eyebrow">The leader</p>
                <p className="pw-serif mt-3 text-[clamp(1.15rem,2.4vw,1.5rem)] leading-snug text-navy">
                  The largest non-bank alternative financing provider in Malaysia
                  — the partner of choice for government agencies, GLCs and major
                  associations.
                </p>
                <GoldRule className="mt-6 max-w-[220px]" />
              </div>

              <div>
                <p className="pw-eyebrow">The data foundation</p>
                <div className="mt-5 grid gap-8 sm:grid-cols-3">
                  <StatTile
                    value="RM 4bn+"
                    label="Disbursed"
                    detail="A substantial historical financing footprint."
                  />
                  <StatTile
                    value="40,000+"
                    label="Transactions"
                    detail="A proprietary dataset mapping SME payment behaviour."
                  />
                  <StatTile
                    value="RM 5bn+"
                    label="Contract value supported"
                    detail="Across supply, services and works."
                  />
                </div>
              </div>
            </div>

            <div className="mt-10 rounded-xl border border-line bg-paper px-5 py-5 md:px-7">
              <p className="text-[14.5px] leading-relaxed text-navy">
                Claritas CRM provides the structural foundation to organise that
                volume of data.{" "}
                <strong className="font-semibold">
                  The next step is making it predictive.
                </strong>
              </p>
              <p className="mt-2.5 text-[12px] leading-relaxed text-muted-soft">
                The three figures above are Planworth&rsquo;s own published
                claims, reproduced from the brief. Claritas Consulting (asia)
                Sdn Bhd has not independently verified them, and none of the
                data in this demo is derived from them — see the note on what is
                real below.
              </p>
            </div>
          </div>
        </section>

        {/* ── Slide 3 — the AI multiplier ───────────────────── */}
        <section id="the-multiplier" className="scroll-mt-16 border-b border-line bg-paper-warm">
          <div className="mx-auto max-w-[1180px] px-5 py-14 md:px-8 md:py-18">
            <h2 className="pw-serif text-[clamp(1.5rem,3.2vw,2.3rem)] leading-tight text-navy">
              Activating the ecosystem — the AI multiplier
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
              Data in a CRM tells you what happened. The five scenarios below are
              what it takes to anticipate what happens next.
            </p>

            {/* The CRM core the scenarios attach to */}
            <div className="mt-9 flex justify-center">
              <div
                className="pw-ground-navy rounded-xl px-7 py-5 text-center text-on-navy"
                style={{ boxShadow: "inset 0 0 0 1px rgba(167,149,111,0.5)" }}
              >
                <p className="pw-serif text-[17px] leading-none">Claritas CRM</p>
                <p className="mt-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase text-on-navy-muted">
                  Static historical data
                </p>
              </div>
            </div>

            <div className="mt-9 grid gap-9 lg:grid-cols-2 lg:gap-12">
              <PillarColumn
                label={PILLAR_1_LABEL}
                sub="Capturing market interest and delivering a frictionless, customer-first experience."
                scenarios={pillarOne}
              />
              <PillarColumn
                label={PILLAR_2_LABEL}
                sub="Accelerating approvals, managing risk dynamically, and securing the dataset."
                scenarios={pillarTwo}
              />
            </div>
          </div>
        </section>

        {/* ── What is actually real ─────────────────────────── */}
        <section className="border-b border-line bg-cream">
          <div className="mx-auto max-w-[1180px] px-5 py-14 md:px-8">
            <h2 className="pw-serif text-[clamp(1.4rem,3vw,2.05rem)] leading-tight text-navy">
              What is real in this demo, and what is not
            </h2>
            <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-muted">
              A demo that blurs this line is worth less than one that draws it.
              Here is the whole of it.
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div
                className="pw-card rounded-xl px-5 py-5 md:px-6"
                style={{ borderColor: "rgba(47,107,79,0.30)" }}
              >
                <div className="flex items-center gap-3">
                  <Pill tone="positive" dot>
                    {realCount} live
                  </Pill>
                  <h3 className="text-[13px] font-semibold text-navy">
                    Genuinely running on Claude
                  </h3>
                </div>
                <ul className="mt-4 flex flex-col gap-3">
                  {SCENARIOS.filter((s) => s.mode === "real").map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={`/scenario/${s.slug}`}
                        className="text-[14px] font-semibold text-navy underline decoration-gold-deep decoration-1 underline-offset-4 transition-colors hover:text-navy-slate"
                      >
                        {s.number}. {s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
                  The conversation, the product match, the field extraction and
                  the reconciliation verdict are all produced by a live model
                  call. Only the documents and client records are fixtures.
                </p>
              </div>

              <div
                className="pw-card rounded-xl px-5 py-5 md:px-6"
                style={{ borderColor: "rgba(167,149,111,0.55)" }}
              >
                <div className="flex items-center gap-3">
                  <Pill tone="gold" dot>
                    {simulatedCount} simulated
                  </Pill>
                  <h3 className="text-[13px] font-semibold text-navy">
                    Deterministic simulations
                  </h3>
                </div>
                <ul className="mt-4 flex flex-col gap-3">
                  {SCENARIOS.filter((s) => s.mode === "simulated").map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={`/scenario/${s.slug}`}
                        className="text-[14px] font-semibold text-navy underline decoration-gold-deep decoration-1 underline-offset-4 transition-colors hover:text-navy-slate"
                      >
                        {s.number}. {s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
                  These three need Planworth&rsquo;s own history — the 40,000+
                  transactions cited above — to become real. Rather than fake a
                  trained model, each runs an explicit formula and shows its
                  working on screen. The mechanism is demonstrable; the
                  intelligence is the part that comes with your data.
                </p>
              </div>
            </div>

            <FixtureNotice className="mt-6" />
          </div>
        </section>

        {/* ── Slide 11 — the operational delta ──────────────── */}
        <section className="border-b border-line bg-paper-warm">
          <div className="mx-auto max-w-[1180px] px-5 py-14 md:px-8">
            <h2 className="pw-serif text-[clamp(1.4rem,3vw,2.05rem)] leading-tight text-navy">
              The operational delta
            </h2>
            <p className="mt-3 text-[14.5px] text-muted">
              Standard CRM against AI-enhanced CRM, dimension by dimension.
            </p>

            <div className="mt-7 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <caption className="sr-only">
                  Comparison of standard CRM and AI-enhanced CRM across five
                  operational dimensions
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="w-[26%] border-b border-line-strong pb-3 text-[10px] font-semibold tracking-[0.2em] uppercase text-navy-slate"
                    >
                      Dimension
                    </th>
                    <th
                      scope="col"
                      className="w-[37%] border-b border-line-strong pb-3 text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-soft"
                    >
                      Standard CRM
                    </th>
                    <th
                      scope="col"
                      className="w-[37%] border-b-2 border-gold-deep pb-3 text-[10px] font-semibold tracking-[0.2em] uppercase text-navy"
                    >
                      AI-enhanced CRM
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SCENARIOS.map((s) => (
                    <tr key={s.slug} className="align-top">
                      <th
                        scope="row"
                        className="border-b border-line py-4 pr-6 text-[14px] font-semibold text-navy"
                      >
                        <Link
                          href={`/scenario/${s.slug}`}
                          className="underline decoration-gold-deep decoration-1 underline-offset-4 transition-colors hover:text-navy-slate"
                        >
                          {s.delta.dimension}
                        </Link>
                      </th>
                      <td className="border-b border-line py-4 pr-6 text-[13.5px] leading-snug text-muted">
                        {s.delta.standard}
                      </td>
                      <td
                        className="border-b border-line py-4 pl-5 text-[13.5px] leading-snug font-medium text-navy"
                        style={{ borderLeft: "1px solid rgba(167,149,111,0.45)" }}
                      >
                        {s.delta.enhanced}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Slide 13 — closing ────────────────────────────── */}
        <section className="pw-ground-navy text-on-navy">
          <div className="mx-auto max-w-[1180px] px-5 py-16 md:px-8 md:py-20">
            <h2 className="pw-serif text-[clamp(1.6rem,3.6vw,2.6rem)] leading-tight">
              Engineering market dominance
            </h2>
            <p className="pw-serif mt-5 max-w-3xl text-[clamp(1.05rem,2.2vw,1.4rem)] leading-relaxed text-on-navy/90">
              Infuse the Claritas CRM foundation with these five scenarios and
              Planworth&rsquo;s digital infrastructure stops being a record of
              the past and becomes an active participant in growth.
            </p>

            {/*
              Slide 13 presents three outcome boxes. Rendering them as three
              identical cards would land straight in the default
              three-across-feature-strip pattern, so they are set as a numbered
              band divided by gold hairlines instead — same content, deliberate
              composition.
            */}
            <ol className="mt-11 grid gap-px overflow-hidden rounded-xl md:grid-cols-3" style={{ background: "rgba(167,149,111,0.45)" }}>
              {[
                {
                  n: "01",
                  text: "Deliver an absolute customer-first experience.",
                },
                {
                  n: "02",
                  text: "Scale operations without linear headcount growth.",
                },
                {
                  n: "03",
                  text: "Hold the position as Malaysia's leading financing partner for business.",
                },
              ].map((item) => (
                <li key={item.n} className="pw-ground-navy px-6 py-7">
                  <span
                    className="pw-serif pw-num block text-[26px] leading-none text-gold-light"
                    aria-hidden="true"
                  >
                    {item.n}
                  </span>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-on-navy/90">
                    {item.text}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-12 flex flex-wrap items-center gap-3">
              <Link
                href="/scenario/engagement"
                className="rounded-lg bg-gold-light px-6 py-3 text-[11.5px] font-semibold tracking-[0.16em] uppercase text-navy transition-colors hover:bg-gold"
              >
                Walk the five scenarios
              </Link>
              <Link
                href="/architecture"
                className="rounded-lg px-6 py-3 text-[11.5px] font-semibold tracking-[0.16em] uppercase text-on-navy transition-colors hover:text-gold-light"
                style={{ boxShadow: "inset 0 0 0 1px rgba(167,149,111,0.6)" }}
              >
                How it integrates
              </Link>
            </div>

            <p className="mt-10 text-[11.5px] leading-relaxed text-on-navy-muted">
              Catalogue in this demo: {PRODUCT_COUNT} financing products, assembled
              from Planworth&rsquo;s public material and pending confirmation.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/* ── Pillar column for the multiplier hub ─────────────────────*/

function PillarColumn({
  label,
  sub,
  scenarios,
}: {
  label: string;
  sub: string;
  scenarios: typeof SCENARIOS;
}) {
  return (
    <div>
      <h3 className="pw-eyebrow">{label}</h3>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">{sub}</p>
      <ul className="mt-5 flex flex-col gap-3">
        {scenarios.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/scenario/${s.slug}`}
              className="pw-card group flex items-start gap-4 rounded-xl px-5 py-4 transition-shadow hover:shadow-[0_1px_0_rgba(167,149,111,0.7),0_8px_24px_-12px_rgba(11,27,50,0.30)]"
            >
              <span
                className="pw-serif pw-num shrink-0 text-[24px] leading-none text-navy-slate"
                aria-hidden="true"
              >
                {s.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-semibold leading-snug text-navy">
                    {s.title}
                  </span>
                  <Pill tone={s.mode === "real" ? "positive" : "gold"}>
                    {s.mode === "real" ? "Live" : "Simulated"}
                  </Pill>
                </span>
                <span className="mt-1.5 block text-[13px] leading-snug text-muted">
                  {s.promise}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
