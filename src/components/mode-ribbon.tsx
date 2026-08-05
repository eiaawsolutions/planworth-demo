import { Pill } from "./atoms";
import type { ScenarioMode } from "@/lib/scenarios";

/**
 * The honesty component.
 *
 * Two of the five scenarios call Claude for real; three are deterministic
 * simulations. This ribbon says which, on every scenario page, above the fold,
 * without a dismiss control. It is not a legal disclaimer bolted on at the end —
 * it is the first thing the audience reads about that scenario, because "which
 * half of this is real" is the first question a technical reviewer will ask.
 */
export function ModeRibbon({
  mode,
  note,
}: {
  mode: ScenarioMode;
  note: string;
}) {
  const isReal = mode === "real";

  return (
    <div
      className="pw-card rounded-lg px-5 py-4"
      style={{
        borderColor: isReal ? "rgba(47,107,79,0.30)" : "rgba(167,149,111,0.55)",
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone={isReal ? "positive" : "gold"} dot>
          {isReal ? "Live model call" : "Simulated"}
        </Pill>
        <span className="text-[12px] font-semibold tracking-[0.14em] uppercase text-navy-slate">
          {isReal
            ? "This scenario really runs on Claude"
            : "This scenario is a deterministic simulation"}
        </span>
      </div>
      <p className="mt-2.5 max-w-3xl text-[13.5px] leading-relaxed text-muted">
        {note}
      </p>
    </div>
  );
}

/**
 * The persistent, page-level fixture notice. Distinct from the ribbon above:
 * the ribbon is about whether the *AI* is real, this is about whether the *data*
 * is. Both matter and they are not the same claim.
 */
export function FixtureNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-snug text-muted-soft ${className}`}>
      Every client, contract, figure and document in this demo is a fictional
      fixture. No live Planworth records are present.
    </p>
  );
}
