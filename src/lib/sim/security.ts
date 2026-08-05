/**
 * Scenario 5 — Adaptive AI Security & Threat Prevention.  **SIMULATED.**
 *
 * ⚠️ READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * The deck frames this capability as *behavioural biometrics* monitoring internal
 * staff and external clients continuously. This module does no such thing. It
 * collects nothing, profiles nobody, and touches no biometric signal. It derives
 * a baseline from a seeded access log and scores deviations from it with fixed
 * arithmetic.
 *
 * That distinction is not pedantry. Behavioural monitoring of employees is
 * PDPA-sensitive in Malaysia and would need a data-protection assessment, a
 * lawful basis, and staff notification before a single keystroke were recorded.
 * Presenting this simulation as live biometric monitoring would misrepresent both
 * the product and Planworth's obligations. The UI labels it as a simulated
 * detection trace; keep it that way.
 *
 * What it legitimately demonstrates is the *mechanism*: establish what normal
 * looks like, score departures from it, and escalate proportionately.
 */

export interface AccessEvent {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  ipAddress: string;
  geoLabel: string;
  deviceLabel: string;
  occurredAt: Date;
  recordsTouched: number;
  sortOrder: number;
}

export type Severity = "BASELINE" | "NOTICE" | "ANOMALY" | "BLOCKED";
export type ResponseAction = "NONE" | "STEP_UP_AUTH" | "API_THROTTLE" | "SESSION_LOCK";

export interface DeviationReason {
  label: string;
  detail: string;
  points: number;
}

export interface ScoredEvent extends AccessEvent {
  anomalyScore: number; // 0–100
  severity: Severity;
  /** Primary response, for the enum column. */
  response: ResponseAction;
  /** Everything the simulation would trigger, in order. */
  responseActions: ResponseAction[];
  reasons: DeviationReason[];
}

export interface Baseline {
  geoLabel: string;
  deviceLabel: string;
  earliestHour: number;
  latestHour: number;
  /** Largest single-action record count seen inside the baseline. */
  typicalMaxRecords: number;
  /** How many events the baseline was derived from. */
  sampleSize: number;
  description: string;
}

const WEIGHT = {
  geo: 45,
  device: 20,
  hour: 18,
  volume: 25,
} as const;

/** An hour either side of the observed window is not suspicious on its own. */
const HOUR_GRACE = 1;

/** Volume only starts scoring above this multiple of the baseline maximum. */
const VOLUME_TRIGGER_MULTIPLE = 3;

function mode<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = 0;
  for (const [v, n] of counts) {
    if (n > bestCount) {
      best = v;
      bestCount = n;
    }
  }
  return best;
}

const RESPONSE_LABEL: Record<ResponseAction, string> = {
  NONE: "No action",
  STEP_UP_AUTH: "Step-up authentication",
  API_THROTTLE: "API throttling",
  SESSION_LOCK: "Session lock",
};

export function responseLabel(action: ResponseAction): string {
  return RESPONSE_LABEL[action];
}

/**
 * Derive "normal" from the log itself: the most common location and device, and
 * the hour window in which that combination appears.
 */
export function deriveBaseline(events: AccessEvent[]): Baseline {
  const geoLabel = mode(events.map((e) => e.geoLabel)) ?? "Unknown";
  const deviceLabel = mode(events.map((e) => e.deviceLabel)) ?? "Unknown";

  const inBaseline = events.filter(
    (e) => e.geoLabel === geoLabel && e.deviceLabel === deviceLabel,
  );
  const hours = inBaseline.map((e) => e.occurredAt.getUTCHours());
  const earliestHour = hours.length ? Math.min(...hours) : 0;
  const latestHour = hours.length ? Math.max(...hours) : 23;
  const typicalMaxRecords = inBaseline.length
    ? Math.max(...inBaseline.map((e) => e.recordsTouched))
    : 0;

  return {
    geoLabel,
    deviceLabel,
    earliestHour,
    latestHour,
    typicalMaxRecords,
    sampleSize: inBaseline.length,
    description: `Derived from ${inBaseline.length} of ${events.length} logged actions: ${geoLabel}, ${deviceLabel}, between ${String(earliestHour).padStart(2, "0")}:00 and ${String(latestHour).padStart(2, "0")}:59, never more than ${typicalMaxRecords.toLocaleString("en-MY")} records in one action.`,
  };
}

function severityFor(score: number, recordsTouched: number, baseline: Baseline): {
  severity: Severity;
  responseActions: ResponseAction[];
} {
  // A high score combined with a bulk read is the case the deck illustrates:
  // throttle the API and lock the session rather than merely challenging.
  const bulkRead =
    baseline.typicalMaxRecords > 0 &&
    recordsTouched > baseline.typicalMaxRecords * VOLUME_TRIGGER_MULTIPLE;

  if (score >= 75 && bulkRead) {
    return {
      severity: "BLOCKED",
      responseActions: ["API_THROTTLE", "SESSION_LOCK"],
    };
  }
  if (score >= 75) {
    return { severity: "ANOMALY", responseActions: ["SESSION_LOCK"] };
  }
  if (score >= 40) {
    return { severity: "ANOMALY", responseActions: ["STEP_UP_AUTH"] };
  }
  if (score >= 15) {
    return { severity: "NOTICE", responseActions: ["NONE"] };
  }
  return { severity: "BASELINE", responseActions: ["NONE"] };
}

export function scoreEvents(events: AccessEvent[]): {
  baseline: Baseline;
  scored: ScoredEvent[];
} {
  const ordered = [...events].sort((a, b) => a.sortOrder - b.sortOrder);
  const baseline = deriveBaseline(ordered);

  const scored: ScoredEvent[] = ordered.map((e) => {
    const reasons: DeviationReason[] = [];
    let score = 0;

    if (e.geoLabel !== baseline.geoLabel) {
      score += WEIGHT.geo;
      reasons.push({
        label: "Location deviation",
        detail: `Request originated from ${e.geoLabel}; this actor's baseline is ${baseline.geoLabel}.`,
        points: WEIGHT.geo,
      });
    }

    if (e.deviceLabel !== baseline.deviceLabel) {
      score += WEIGHT.device;
      reasons.push({
        label: "Unrecognised device",
        detail: `${e.deviceLabel} has not been seen on this account before.`,
        points: WEIGHT.device,
      });
    }

    const hour = e.occurredAt.getUTCHours();
    const outsideWindow =
      hour < baseline.earliestHour - HOUR_GRACE ||
      hour > baseline.latestHour + HOUR_GRACE;
    if (outsideWindow) {
      score += WEIGHT.hour;
      reasons.push({
        label: "Outside working pattern",
        detail: `${String(hour).padStart(2, "0")}:${String(e.occurredAt.getUTCMinutes()).padStart(2, "0")} falls outside this actor's observed ${String(baseline.earliestHour).padStart(2, "0")}:00–${String(baseline.latestHour).padStart(2, "0")}:59 window.`,
        points: WEIGHT.hour,
      });
    }

    if (
      baseline.typicalMaxRecords > 0 &&
      e.recordsTouched > baseline.typicalMaxRecords
    ) {
      const multiple = e.recordsTouched / baseline.typicalMaxRecords;
      // Ramps from 0 at 1× the baseline maximum to full weight at 10×.
      const t = Math.max(0, Math.min(1, (multiple - 1) / 9));
      const points = Math.round(t * WEIGHT.volume);
      if (points > 0) {
        score += points;
        reasons.push({
          label: "Volume deviation",
          detail: `${e.recordsTouched.toLocaleString("en-MY")} records in a single action — ${multiple.toFixed(1)}× the largest volume in this actor's baseline (${baseline.typicalMaxRecords.toLocaleString("en-MY")}).`,
          points,
        });
      }
    }

    score = Math.min(100, score);
    const { severity, responseActions } = severityFor(
      score,
      e.recordsTouched,
      baseline,
    );

    if (reasons.length === 0) {
      reasons.push({
        label: "Consistent with baseline",
        detail:
          "Location, device, hour and volume all match this actor's established pattern.",
        points: 0,
      });
    }

    return {
      ...e,
      anomalyScore: score,
      severity,
      response: responseActions[0] ?? "NONE",
      responseActions,
      reasons,
    };
  });

  return { baseline, scored };
}

/** The scoring weights, surfaced in the UI so the arithmetic is inspectable. */
export const SECURITY_WEIGHTS = WEIGHT;
