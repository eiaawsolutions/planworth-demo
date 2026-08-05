import type { ReasoningStep } from "@/lib/sim/engagement";

/**
 * Renders a simulation's working.
 *
 * Every simulated scenario returns its steps alongside its result, and this is
 * where they land. The point is that a viewer can audit the number rather than
 * take it on trust — which is the whole difference between an honest simulation
 * and a fake model.
 */
export function ReasoningSteps({ steps }: { steps: ReasoningStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => (
        <li
          key={`${step.label}-${i}`}
          className="flex gap-4 border-b border-line py-3.5 last:border-b-0 last:pb-0 first:pt-0"
        >
          <span
            className="pw-num mt-0.5 shrink-0 text-[11px] font-semibold text-navy-slate"
            aria-hidden="true"
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-navy">{step.label}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {step.detail}
            </p>
          </div>
          {step.value ? (
            <span className="pw-num pw-serif shrink-0 self-start text-[15px] text-navy">
              {step.value}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
