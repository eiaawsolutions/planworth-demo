import type { CashflowMonth, FundingGap } from "@/lib/sim/engagement";

/**
 * The seasonal curve from slide 5, with the detected gap marked.
 *
 * Pure server-rendered SVG — no charting library and no client JS. A twelve-point
 * line does not justify a runtime dependency, and this way it renders in the
 * initial HTML and prints correctly.
 */
export function CashflowChart({
  series,
  baselineSen,
  coverageFloorSen,
  primaryGap,
}: {
  series: CashflowMonth[];
  baselineSen: bigint;
  coverageFloorSen: bigint;
  primaryGap: FundingGap | null;
}) {
  const W = 760;
  const H = 260;
  const PAD = { top: 24, right: 20, bottom: 34, left: 20 };

  const ordered = [...series].sort((a, b) => a.monthIndex - b.monthIndex);
  if (ordered.length === 0) return null;

  const values = ordered.map((m) => Number(m.netPositionSen) / 100);
  const baseline = Number(baselineSen) / 100;
  const floor = Number(coverageFloorSen) / 100;

  const maxV = Math.max(...values, baseline) * 1.12;
  const minV = 0;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (ordered.length === 1 ? plotW / 2 : (i / (ordered.length - 1)) * plotW);
  const y = (v: number) =>
    PAD.top + plotH - ((v - minV) / (maxV - minV)) * plotH;

  const linePath = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");

  const areaPath =
    `${linePath} L ${x(values.length - 1).toFixed(1)} ${(PAD.top + plotH).toFixed(1)}` +
    ` L ${x(0).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`;

  const gapIndex = primaryGap
    ? ordered.findIndex((m) => m.monthIndex === primaryGap.monthIndex)
    : -1;

  const summary = primaryGap
    ? `Line chart of monthly net working-capital position. The lowest point is ${primaryGap.label}, at RM ${(Number(primaryGap.netPositionSen) / 100).toLocaleString("en-MY")}, which is ${primaryGap.belowBaselinePct}% below the baseline average of RM ${baseline.toLocaleString("en-MY")}.`
    : `Line chart of monthly net working-capital position. No month falls below the coverage floor.`;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={summary}
      >
        <defs>
          <linearGradient id="cf-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bfa373" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#bfa373" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke="#2e3548"
          strokeWidth="1"
          strokeDasharray="5 4"
          strokeOpacity="0.45"
        />
        <text
          x={W - PAD.right}
          y={y(baseline) - 7}
          textAnchor="end"
          className="pw-num"
          fontSize="10"
          fill="#2e3548"
          fontWeight="600"
          letterSpacing="0.06em"
        >
          BASELINE
        </text>

        {/* Coverage floor */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(floor)}
          y2={y(floor)}
          stroke="#9a4a24"
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity="0.6"
        />
        <text
          x={W - PAD.right}
          y={y(floor) + 13}
          textAnchor="end"
          fontSize="10"
          fill="#9a4a24"
          fontWeight="600"
          letterSpacing="0.06em"
        >
          COVERAGE FLOOR
        </text>

        {/* Series */}
        <path d={areaPath} fill="url(#cf-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#0b1b32"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Points */}
        {values.map((v, i) => {
          const isGap = i === gapIndex;
          return (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={isGap ? 5.5 : 2.6}
              fill={isGap ? "#8c2f2f" : "#0b1b32"}
              stroke={isGap ? "#f2f2ea" : "none"}
              strokeWidth={isGap ? 2 : 0}
            />
          );
        })}

        {/* Gap callout */}
        {gapIndex >= 0 && primaryGap ? (
          <g>
            <line
              x1={x(gapIndex)}
              x2={x(gapIndex)}
              y1={y(values[gapIndex]) + 10}
              y2={PAD.top + plotH + 4}
              stroke="#8c2f2f"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <text
              x={x(gapIndex)}
              y={y(values[gapIndex]) - 14}
              textAnchor="middle"
              fontSize="10.5"
              fill="#8c2f2f"
              fontWeight="700"
              letterSpacing="0.08em"
            >
              GAP DETECTED
            </text>
          </g>
        ) : null}

        {/* Month labels */}
        {ordered.map((m, i) => (
          <text
            key={m.monthIndex}
            x={x(i)}
            y={H - 12}
            textAnchor="middle"
            fontSize="11"
            fill={i === gapIndex ? "#8c2f2f" : "#2e3548"}
            fontWeight={i === gapIndex ? 700 : 500}
          >
            {m.label}
          </text>
        ))}
      </svg>
      <figcaption className="mt-3 text-[12px] leading-relaxed text-muted">
        Net working-capital position by month. The baseline is the mean across the
        series; the coverage floor sits at 35% of it.
      </figcaption>
    </figure>
  );
}
