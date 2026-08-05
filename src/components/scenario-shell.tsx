import Link from "next/link";
import { Crest } from "./crest";
import { GoldRule } from "./atoms";
import { ModeRibbon, FixtureNotice } from "./mode-ribbon";
import { SCENARIOS, type Scenario } from "@/lib/scenarios";

/* ── Site chrome ──────────────────────────────────────────────*/

export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="pw-ground-navy sticky top-0 z-40 text-on-navy">
      <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-5 py-3 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-sm text-gold-light transition-opacity hover:opacity-80"
        >
          <Crest size={34} />
          <span className="flex flex-col leading-none">
            <span className="pw-serif text-[15px] text-on-navy">
              The Intelligent Ecosystem
            </span>
            <span className="mt-0.5 text-[9.5px] font-semibold tracking-[0.2em] uppercase text-on-navy-muted">
              Planworth × Claritas
            </span>
          </span>
        </Link>

        <nav
          aria-label="Scenarios"
          className="ml-auto hidden items-center gap-1 lg:flex"
        >
          {SCENARIOS.map((s) => {
            const active = s.slug === current;
            return (
              <Link
                key={s.slug}
                href={`/scenario/${s.slug}`}
                aria-current={active ? "page" : undefined}
                className="rounded px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase transition-colors"
                style={{
                  color: active ? "#0b1b32" : "rgba(242,242,234,0.72)",
                  background: active ? "#d7c89f" : "transparent",
                }}
              >
                {s.number}
              </Link>
            );
          })}
          <Link
            href="/architecture"
            aria-current={current === "architecture" ? "page" : undefined}
            className="ml-2 rounded px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase transition-colors"
            style={{
              color: current === "architecture" ? "#0b1b32" : "rgba(242,242,234,0.72)",
              background: current === "architecture" ? "#d7c89f" : "transparent",
            }}
          >
            Architecture
          </Link>
        </nav>

        <Link
          href="/"
          className="ml-auto text-[11px] font-semibold tracking-[0.14em] uppercase text-on-navy-muted transition-colors hover:text-gold-light lg:ml-0"
        >
          Overview
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-paper">
      <div className="mx-auto max-w-[1180px] px-5 py-8 md:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl">
            <p className="text-[12px] leading-relaxed text-muted">
              Prepared by <strong className="font-semibold text-navy">EIAAW Solutions Sdn Bhd</strong>{" "}
              as a working preview of the Intelligent Ecosystem brief for Planworth
              Global Factoring Sdn Bhd.
            </p>
            <FixtureNotice className="mt-2" />
          </div>
          <div className="flex flex-col gap-1 text-[11px] text-muted-soft md:text-right">
            <span>Two scenarios call Claude directly. Three are simulations.</span>
            <span>Each page states which, and why.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Scenario page frame ──────────────────────────────────────*/

export function ScenarioShell({
  scenario,
  children,
}: {
  scenario: Scenario;
  children: React.ReactNode;
}) {
  const index = SCENARIOS.findIndex((s) => s.slug === scenario.slug);
  const prev = index > 0 ? SCENARIOS[index - 1] : null;
  const next = index < SCENARIOS.length - 1 ? SCENARIOS[index + 1] : null;

  return (
    <>
      <SiteHeader current={scenario.slug} />

      <main className="flex-1">
        {/* Hero */}
        <section className="pw-ground-cream border-b border-line">
          <div className="mx-auto max-w-[1180px] px-5 pt-10 pb-9 md:px-8 md:pt-14">
            <p className="pw-eyebrow">{scenario.pillarLabel}</p>

            <div className="mt-4 flex items-start gap-4 md:gap-6">
              <span
                className="pw-serif pw-num shrink-0 text-[clamp(2.6rem,6vw,4.2rem)] leading-[0.85] text-navy-slate"
                aria-hidden="true"
              >
                {scenario.number}
              </span>
              <div className="min-w-0">
                <h1 className="pw-serif text-[clamp(1.65rem,3.6vw,2.6rem)] leading-[1.08] text-navy">
                  {scenario.title}
                </h1>
                <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-muted">
                  {scenario.promise}
                </p>
              </div>
            </div>

            <GoldRule className="mt-8 mb-7 max-w-md" />

            <div className="grid gap-7 md:grid-cols-2 md:gap-10">
              <div>
                <h2 className="pw-eyebrow">The context</h2>
                <p className="mt-2.5 text-[14px] leading-relaxed text-navy/85">
                  {scenario.context}
                </p>
              </div>
              <div>
                <h2 className="pw-eyebrow">The AI scenario</h2>
                <p className="mt-2.5 text-[14px] leading-relaxed text-navy/85">
                  {scenario.aiScenario}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <ModeRibbon mode={scenario.mode} note={scenario.modeNote} />
            </div>
          </div>
        </section>

        {/* The interactive demo */}
        <div className="mx-auto max-w-[1180px] px-5 py-10 md:px-8 md:py-14">
          {children}
        </div>

        {/* Operational delta for this scenario + prev/next */}
        <section className="border-t border-line bg-paper-warm">
          <div className="mx-auto max-w-[1180px] px-5 py-9 md:px-8">
            <h2 className="pw-eyebrow">
              The operational delta — {scenario.delta.dimension}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-line bg-cream px-5 py-4">
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-soft">
                  Standard CRM
                </p>
                <p className="mt-2 text-[14px] leading-snug text-muted">
                  {scenario.delta.standard}
                </p>
              </div>
              <div className="pw-card rounded-lg px-5 py-4" style={{ borderColor: "rgba(167,149,111,0.55)" }}>
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-navy-slate">
                  AI-enhanced
                </p>
                <p className="mt-2 text-[14px] leading-snug text-navy">
                  {scenario.delta.enhanced}
                </p>
              </div>
            </div>

            <nav
              aria-label="Scenario navigation"
              className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between"
            >
              {prev ? (
                <Link
                  href={`/scenario/${prev.slug}`}
                  className="group max-w-[46%] text-[12px] text-muted transition-colors hover:text-navy"
                >
                  <span className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-soft">
                    ← Scenario {prev.number}
                  </span>
                  <span className="mt-0.5 block leading-snug">{prev.title}</span>
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link
                  href={`/scenario/${next.slug}`}
                  className="group max-w-[46%] text-[12px] text-muted transition-colors hover:text-navy sm:text-right"
                >
                  <span className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-soft">
                    Scenario {next.number} →
                  </span>
                  <span className="mt-0.5 block leading-snug">{next.title}</span>
                </Link>
              ) : (
                <Link
                  href="/architecture"
                  className="max-w-[46%] text-[12px] text-muted transition-colors hover:text-navy sm:text-right"
                >
                  <span className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-soft">
                    Next →
                  </span>
                  <span className="mt-0.5 block leading-snug">
                    Native architectural integration
                  </span>
                </Link>
              )}
            </nav>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/* ── Panel ────────────────────────────────────────────────────*/

export function Panel({
  step,
  title,
  children,
  className = "",
}: {
  step?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`pw-card rounded-xl p-5 md:p-6 ${className}`}>
      {step && title ? (
        <>
          <div className="flex items-baseline gap-3">
            <span className="pw-serif text-[15px] leading-none text-navy-slate italic">
              {step}
            </span>
            <h2 className="text-[10px] font-semibold tracking-[0.22em] uppercase text-navy-slate">
              {title}
            </h2>
          </div>
          <div className="mt-4">{children}</div>
        </>
      ) : (
        children
      )}
    </section>
  );
}
