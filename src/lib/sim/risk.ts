/**
 * Scenario 4 — Dynamic Credit & Risk Scoring.  **SIMULATED.**
 *
 * The deck describes an ML core ingesting 40,000+ historical transactions and
 * continuously adjusting risk profiles. That model would be trained on
 * Planworth's own book, which we do not have.
 *
 * What this module does instead is an explicit weighted scorecard: seven factors,
 * fixed weights that sum to 100, every contribution returned so the UI can list
 * them. It is a deterministic function of its inputs — run it twice on the same
 * client and you get the same number, which is precisely what a trained model
 * would NOT guarantee. That difference is the honest thing to show.
 *
 * If this is ever replaced with a real model, keep `scoreClient`'s return shape:
 * the UI depends on factors being enumerable and explainable.
 */

export interface CreditHistoryInput {
  transactionsObserved: number;
  totalDisbursedSen: bigint;
  onTimeSettlementPct: number;
  avgDaysToSettle: number;
  worstArrearsDays: number;
  distinctCounterparties: number;
  disputeRatePct: number;
}

export interface ClientInput {
  relationshipMonths: number;
  approvedLimitSen: bigint;
}

export type RiskBand = "PRIME" | "STANDARD" | "WATCH" | "ELEVATED";

export interface ScoreFactor {
  label: string;
  /** The observed input, formatted for display. */
  observed: string;
  /** Why it scored the way it did. */
  detail: string;
  /** Points awarded out of `maxWeight`. */
  points: number;
  maxWeight: number;
}

export interface RiskAssessment {
  score: number; // 0–100
  band: RiskBand;
  bandLabel: string;
  bandRationale: string;
  factors: ScoreFactor[];
  /** Mean facility per observed transaction. */
  avgTicketSen: bigint;
  currentLimitSen: bigint;
  recommendedLimitSen: bigint;
  deltaSen: bigint;
  /** Which constraint decided the recommendation. */
  limitBasis: string;
}

const ROUNDING_SEN = 50_000_00n;

function roundDownTo(value: bigint, multiple: bigint): bigint {
  if (value <= 0n) return 0n;
  return value - (value % multiple);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation of `value` between `worst` and `best`, scaled to `weight`. */
function scale(value: number, worst: number, best: number, weight: number): number {
  if (best === worst) return 0;
  const t = clamp((value - worst) / (best - worst), 0, 1);
  return Math.round(t * weight * 10) / 10;
}

const BAND_MULTIPLIER: Record<RiskBand, number> = {
  PRIME: 1.35,
  STANDARD: 1.0,
  WATCH: 0.85,
  ELEVATED: 0.6,
};

const BAND_LABEL: Record<RiskBand, string> = {
  PRIME: "Prime",
  STANDARD: "Standard",
  WATCH: "Watch",
  ELEVATED: "Elevated",
};

function bandFor(score: number): RiskBand {
  if (score >= 85) return "PRIME";
  if (score >= 70) return "STANDARD";
  if (score >= 55) return "WATCH";
  return "ELEVATED";
}

function formatRinggit(amount: bigint): string {
  return `RM ${(Number(amount) / 100).toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

export function scoreClient(
  client: ClientInput,
  history: CreditHistoryInput,
): RiskAssessment {
  const factors: ScoreFactor[] = [];

  // 1 — Settlement reliability (35). The single strongest signal.
  const reliability = scale(history.onTimeSettlementPct, 60, 100, 35);
  factors.push({
    label: "Settlement reliability",
    observed: `${history.onTimeSettlementPct}% on time`,
    detail:
      "Share of facilities settled on or before the due date. Scaled from 60% (no points) to 100% (full weight).",
    points: reliability,
    maxWeight: 35,
  });

  // 2 — Payment velocity (20). 30 days is the target, 90 is the floor.
  const velocity = scale(history.avgDaysToSettle, 90, 30, 20);
  factors.push({
    label: "Payment velocity",
    observed: `${history.avgDaysToSettle} days average`,
    detail:
      "Mean days to settle. 30 days scores full weight, 90 days or worse scores nothing.",
    points: velocity,
    maxWeight: 20,
  });

  // 3 — Track record depth (15). Log-ish: the first 50 transactions tell you
  // most of what you need, so don't reward volume linearly.
  const depthT = clamp(
    Math.log10(Math.max(history.transactionsObserved, 1)) / Math.log10(250),
    0,
    1,
  );
  const depth = Math.round(depthT * 15 * 10) / 10;
  factors.push({
    label: "Track record depth",
    observed: `${history.transactionsObserved} transactions`,
    detail:
      "Observed facility count, on a logarithmic scale — the first 50 transactions carry most of the information, so volume beyond that adds little.",
    points: depth,
    maxWeight: 15,
  });

  // 4 — Relationship tenure (10). Capped at five years.
  const tenure = scale(client.relationshipMonths, 0, 60, 10);
  factors.push({
    label: "Relationship tenure",
    observed: `${client.relationshipMonths} months`,
    detail: "Time on Planworth's book, scaled to a five-year cap.",
    points: tenure,
    maxWeight: 10,
  });

  // 5 — Arrears severity (10). A penalty: never late scores full weight.
  const arrears = scale(history.worstArrearsDays, 60, 0, 10);
  factors.push({
    label: "Arrears severity",
    observed:
      history.worstArrearsDays === 0
        ? "No arrears on record"
        : `Worst arrears ${history.worstArrearsDays} days`,
    detail:
      "Worst single arrears event. Never late scores full weight; 60 days or worse scores nothing.",
    points: arrears,
    maxWeight: 10,
  });

  // 6 — Counterparty diversification (5). Concentration is a real risk for
  // contractors dependent on a single awarding body.
  const diversification = scale(history.distinctCounterparties, 1, 12, 5);
  factors.push({
    label: "Counterparty diversification",
    observed: `${history.distinctCounterparties} distinct buyers`,
    detail:
      "Distinct awarding bodies or buyers seen. A single counterparty concentrates risk regardless of how well it pays.",
    points: diversification,
    maxWeight: 5,
  });

  // 7 — Dispute rate (5). Penalty.
  const disputes = scale(history.disputeRatePct, 15, 0, 5);
  factors.push({
    label: "Claim dispute rate",
    observed: `${history.disputeRatePct}% disputed`,
    detail:
      "Share of claims disputed or written back. Zero scores full weight; 15% or worse scores nothing.",
    points: disputes,
    maxWeight: 5,
  });

  const score = Math.round(
    factors.reduce((sum, f) => sum + f.points, 0),
  );
  const band = bandFor(score);

  const avgTicketSen =
    history.transactionsObserved > 0
      ? history.totalDisbursedSen / BigInt(history.transactionsObserved)
      : 0n;

  // Two constraints, and we take the tighter of the two:
  //   · the band multiplier applied to the existing limit
  //   · ten times the average ticket — a limit far above what the client has
  //     ever actually drawn is not a useful recommendation
  const bandCandidate = BigInt(
    Math.round(Number(client.approvedLimitSen) * BAND_MULTIPLIER[band]),
  );
  const throughputCandidate = avgTicketSen * 10n;

  let recommendedLimitSen: bigint;
  let limitBasis: string;
  if (band === "PRIME" || band === "STANDARD") {
    if (throughputCandidate < bandCandidate) {
      recommendedLimitSen = throughputCandidate;
      limitBasis = `Capped at ten times the average ticket of ${formatRinggit(avgTicketSen)} — the band alone would have supported ${formatRinggit(bandCandidate)}, but the client has never drawn at that scale.`;
    } else {
      recommendedLimitSen = bandCandidate;
      limitBasis = `${BAND_LABEL[band]} band multiplier (${BAND_MULTIPLIER[band]}×) applied to the current limit.`;
    }
  } else {
    // Never let the throughput cap *raise* a limit for a Watch/Elevated client.
    recommendedLimitSen = bandCandidate;
    limitBasis = `${BAND_LABEL[band]} band multiplier (${BAND_MULTIPLIER[band]}×) applied to the current limit. The throughput cap is not used to raise a limit in this band.`;
  }

  recommendedLimitSen = roundDownTo(recommendedLimitSen, ROUNDING_SEN);

  const bandRationale: Record<RiskBand, string> = {
    PRIME:
      "Consistent on-time settlement across a deep track record. The simulation would raise the facility automatically and notify the relationship manager.",
    STANDARD:
      "Sound history with no material concerns. The facility holds at its current level pending the next review.",
    WATCH:
      "Slower settlement or a thin track record. The facility is trimmed and the account is flagged for manual review before the next drawdown.",
    ELEVATED:
      "Short history combined with arrears or disputes. The simulation would reduce exposure and require underwriter sign-off on any drawdown.",
  };

  return {
    score,
    band,
    bandLabel: BAND_LABEL[band],
    bandRationale: bandRationale[band],
    factors,
    avgTicketSen,
    currentLimitSen: client.approvedLimitSen,
    recommendedLimitSen,
    deltaSen: recommendedLimitSen - client.approvedLimitSen,
    limitBasis,
  };
}

/** Total weight of the scorecard, asserted by the eval harness. */
export const TOTAL_WEIGHT = 100;
