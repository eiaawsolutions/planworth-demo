/**
 * Scenario 1 — Hyper-Personalized Omni-Channel Engagement.  **SIMULATED.**
 *
 * The deck shows predictive models anticipating a client's funding need before
 * they apply. Doing that for real needs Planworth's historical interaction and
 * settlement data; what this module does instead is a transparent, deterministic
 * gap detection over a seeded cash-flow series — and it returns the arithmetic
 * alongside the answer so the UI can show its work rather than assert a result.
 *
 * There is no model here, no training, and no confidence score. If someone later
 * swaps this for a real forecaster, the shape of `detectFundingGap`'s return
 * value is the contract to preserve.
 */

export interface CashflowMonth {
  monthIndex: number;
  label: string;
  netPositionSen: bigint;
}

export interface ReasoningStep {
  label: string;
  detail: string;
  /** Pre-formatted for display; the caller owns currency formatting. */
  value?: string;
}

export interface FundingGap {
  monthIndex: number;
  label: string;
  netPositionSen: bigint;
  /** How far below the coverage floor this month sits. */
  shortfallSen: bigint;
  /** Percent below the baseline average, 0–100. */
  belowBaselinePct: number;
}

export interface EngagementDetection {
  /** Mean net position across the observed series. */
  baselineSen: bigint;
  /** Months below this are treated as a funding gap. */
  coverageFloorSen: bigint;
  coverageFloorPct: number;
  gaps: FundingGap[];
  /** The deepest gap — what the campaign is built around. */
  primaryGap: FundingGap | null;
  /** True when the gap sits at the end of a multi-month decline. */
  isSustainedDecline: boolean;
  /** Facility the simulation would set aside, rounded for presentability. */
  recommendedFacilitySen: bigint;
  steps: ReasoningStep[];
}

/** Months below this share of the baseline average count as a funding gap. */
const COVERAGE_FLOOR_PCT = 35;

/** Facility sizing is rounded up to a multiple of this, in sen. */
const ROUNDING_SEN = 50_000_00n;

function mean(values: bigint[]): bigint {
  if (values.length === 0) return 0n;
  const total = values.reduce((acc, v) => acc + v, 0n);
  return total / BigInt(values.length);
}

function roundUpTo(value: bigint, multiple: bigint): bigint {
  if (value <= 0n) return 0n;
  const remainder = value % multiple;
  return remainder === 0n ? value : value + (multiple - remainder);
}

function formatRinggit(amount: bigint): string {
  const ringgit = Number(amount) / 100;
  return `RM ${ringgit.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

/**
 * Find the months where projected working capital drops below the coverage
 * floor, and size a facility against the deepest one.
 */
export function detectFundingGap(series: CashflowMonth[]): EngagementDetection {
  const ordered = [...series].sort((a, b) => a.monthIndex - b.monthIndex);
  const steps: ReasoningStep[] = [];

  if (ordered.length === 0) {
    return {
      baselineSen: 0n,
      coverageFloorSen: 0n,
      coverageFloorPct: COVERAGE_FLOOR_PCT,
      gaps: [],
      primaryGap: null,
      isSustainedDecline: false,
      recommendedFacilitySen: 0n,
      steps: [{ label: "No data", detail: "No cash-flow series was available for this client." }],
    };
  }

  const baselineSen = mean(ordered.map((m) => m.netPositionSen));
  steps.push({
    label: "Establish the baseline",
    detail: `Mean net working-capital position across the ${ordered.length} observed months.`,
    value: formatRinggit(baselineSen),
  });

  const coverageFloorSen =
    (baselineSen * BigInt(COVERAGE_FLOOR_PCT)) / 100n;
  steps.push({
    label: "Set the coverage floor",
    detail: `A month is treated as a funding gap when the position falls below ${COVERAGE_FLOOR_PCT}% of that baseline. This threshold is a fixed rule in this demo, not a learned parameter.`,
    value: formatRinggit(coverageFloorSen),
  });

  const gaps: FundingGap[] = ordered
    .filter((m) => m.netPositionSen < coverageFloorSen)
    .map((m) => {
      const belowBaselinePct =
        baselineSen === 0n
          ? 0
          : Math.round(
              Number(((baselineSen - m.netPositionSen) * 100n) / baselineSen),
            );
      return {
        monthIndex: m.monthIndex,
        label: m.label,
        netPositionSen: m.netPositionSen,
        shortfallSen: coverageFloorSen - m.netPositionSen,
        belowBaselinePct,
      };
    });

  steps.push({
    label: "Scan the series",
    detail:
      gaps.length === 0
        ? "No month breaches the coverage floor."
        : `${gaps.length} month${gaps.length === 1 ? "" : "s"} breach the floor: ${gaps.map((g) => g.label).join(", ")}.`,
    value: gaps.length === 0 ? "No gap" : `${gaps.length} flagged`,
  });

  // Deepest gap by absolute position, not by shortfall — the month with least
  // cash on hand is the one a relationship manager should act on.
  const primaryGap =
    gaps.length === 0
      ? null
      : gaps.reduce((worst, g) =>
          g.netPositionSen < worst.netPositionSen ? g : worst,
        );

  let isSustainedDecline = false;
  if (primaryGap) {
    const idx = ordered.findIndex((m) => m.monthIndex === primaryGap.monthIndex);
    // Two consecutive falls into the gap read as seasonal pressure rather than a
    // single bad month, which changes how the offer should be framed.
    isSustainedDecline =
      idx >= 2 &&
      ordered[idx].netPositionSen < ordered[idx - 1].netPositionSen &&
      ordered[idx - 1].netPositionSen < ordered[idx - 2].netPositionSen;

    steps.push({
      label: "Classify the gap",
      detail: isSustainedDecline
        ? `${primaryGap.label} sits at the end of a three-month decline, so this reads as seasonal pressure rather than a one-off month.`
        : `${primaryGap.label} is an isolated dip — the months either side hold up.`,
      value: isSustainedDecline ? "Sustained decline" : "Isolated dip",
    });
  }

  // Size the facility to close the gap back to the baseline, not merely to the
  // floor — clearing the floor by a ringgit is not a useful offer.
  const rawFacility = primaryGap
    ? baselineSen - primaryGap.netPositionSen
    : 0n;
  const recommendedFacilitySen = roundUpTo(rawFacility, ROUNDING_SEN);

  if (primaryGap) {
    steps.push({
      label: "Size the facility",
      detail: `Enough to restore ${primaryGap.label} to the baseline (${formatRinggit(baselineSen)} − ${formatRinggit(primaryGap.netPositionSen)}), rounded up to the nearest RM 50,000.`,
      value: formatRinggit(recommendedFacilitySen),
    });
  }

  return {
    baselineSen,
    coverageFloorSen,
    coverageFloorPct: COVERAGE_FLOOR_PCT,
    gaps,
    primaryGap,
    isSustainedDecline,
    recommendedFacilitySen,
    steps,
  };
}
