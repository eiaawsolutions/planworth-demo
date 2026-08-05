/**
 * Eval harness — `npm run eval`
 *
 * Two parts, deliberately separated:
 *
 *   PART A  Deterministic checks. No API key, no network, no cost. Covers the
 *           reconciliation rules and all three simulations. These are the checks
 *           that catch the expensive class of bug: a wrong "Anomaly free" verdict,
 *           or a scorecard whose weights silently stop summing to 100.
 *
 *   PART B  Live model checks. Needs ANTHROPIC_API_KEY and spends money. Covers
 *           the triage golden set, adversarial probes, and document extraction
 *           against ground truth. SKIPPED with a clear notice when no key is set,
 *           rather than quietly passing.
 *
 * Part B calls the model directly rather than going through the route handlers, so
 * it measures prompt quality, not transport. The sentinel stripping and rate
 * limiting in the routes are not covered here — noted rather than implied.
 *
 * Exit code is non-zero if any check fails, so this can gate a deploy.
 */

import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

import { DOCUMENT_FIXTURES } from "../src/lib/fixtures";
import { reconcile, parseAmountToSen } from "../src/lib/reconcile";
import { detectFundingGap } from "../src/lib/sim/engagement";
import { scoreClient, TOTAL_WEIGHT } from "../src/lib/sim/risk";
import { scoreEvents } from "../src/lib/sim/security";
import { PRODUCTS, PRODUCT_COUNT } from "../src/lib/products";
import { sen, formatMyr } from "../src/lib/money";
import type { ExtractionResult } from "../src/lib/prompts/extract";
import {
  EXTRACTION_SCHEMA,
  EXTRACT_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from "../src/lib/prompts/extract";
import { buildTriageSystemPrompt, extractMatch } from "../src/lib/prompts/triage";
import {
  TRIAGE_GOLDEN,
  INJECTION_PROBES,
  LEAKAGE_MARKERS,
  REVIEW_PATTERNS,
} from "./cases/triage";

const MODEL = "claude-opus-5";

const prisma = new PrismaClient();

/* ── Tiny assertion framework ─────────────────────────────────*/

let passed = 0;
let failed = 0;
let warned = 0;
let skipped = 0;
const failures: string[] = [];
const warnings: string[] = [];

function ok(name: string, detail = "") {
  passed++;
  console.log(`  \x1b[32m✓\x1b[0m ${name}${detail ? `  \x1b[90m${detail}\x1b[0m` : ""}`);
}

function fail(name: string, detail: string) {
  failed++;
  failures.push(`${name} — ${detail}`);
  console.log(`  \x1b[31m✗\x1b[0m ${name}\n      \x1b[31m${detail}\x1b[0m`);
}

function warn(name: string, detail: string) {
  warned++;
  warnings.push(`${name} — ${detail}`);
  console.log(`  \x1b[33m!\x1b[0m ${name}\n      \x1b[33m${detail}\x1b[0m`);
}

function skip(name: string, why: string) {
  skipped++;
  console.log(`  \x1b[90m- ${name} (skipped: ${why})\x1b[0m`);
}

function check(name: string, condition: boolean, detail: string) {
  if (condition) ok(name);
  else fail(name, detail);
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

/* ══════════════════════════════════════════════════════════════
   PART A — deterministic
   ══════════════════════════════════════════════════════════════ */

function evalMoney() {
  section("A1 · Money handling");

  check(
    "sen() converts ringgit without float drift",
    sen(742_500) === 74_250_000n && sen(0.01) === 1n && sen(1_250_000) === 125_000_000n,
    `got ${sen(742_500)}, ${sen(0.01)}, ${sen(1_250_000)}`,
  );

  const parsed = parseAmountToSen("742500.00");
  check(
    "parseAmountToSen reads a plain schema amount",
    parsed === 74_250_000n,
    `expected 74250000n, got ${parsed}`,
  );

  check(
    "parseAmountToSen strips separators and symbols",
    parseAmountToSen("RM 1,250,000.00") === 125_000_000n,
    `got ${parseAmountToSen("RM 1,250,000.00")}`,
  );

  check(
    "parseAmountToSen rejects unparseable input rather than guessing",
    parseAmountToSen("") === null &&
      parseAmountToSen("see attached") === null &&
      parseAmountToSen("1.2.3") === null,
    "one of the malformed inputs returned a value",
  );

  check(
    "formatMyr renders ringgit, not the MYR code",
    formatMyr(74_250_000n).startsWith("RM") && formatMyr(74_250_000n).includes("742,500"),
    `got "${formatMyr(74_250_000n)}"`,
  );
}

function evalCatalogue() {
  section("A2 · Product catalogue");

  check(
    "catalogue satisfies the brief's 'over 15 products' claim",
    PRODUCT_COUNT > 15,
    `catalogue has ${PRODUCT_COUNT}`,
  );

  const ids = PRODUCTS.map((p) => p.id);
  check(
    "product ids are unique",
    new Set(ids).size === ids.length,
    "duplicate id present",
  );

  const missingSignals = PRODUCTS.filter((p) => p.triggerSignals.length === 0);
  check(
    "every product carries trigger signals for the model to reason over",
    missingSignals.length === 0,
    `missing on: ${missingSignals.map((p) => p.id).join(", ")}`,
  );

  const missingDocs = PRODUCTS.filter((p) => p.requiredDocs.length === 0);
  check(
    "every product lists the documents underwriting needs",
    missingDocs.length === 0,
    `missing on: ${missingDocs.map((p) => p.id).join(", ")}`,
  );

  // Every acceptable answer in the golden set must actually exist.
  const unknown = TRIAGE_GOLDEN.flatMap((c) =>
    c.acceptable.filter((id) => !ids.includes(id)),
  );
  check(
    "every golden-set answer refers to a real product",
    unknown.length === 0,
    `unknown ids: ${unknown.join(", ")}`,
  );
}

async function evalReconciliation() {
  section("A3 · Reconciliation rules (the expensive class of bug)");

  const documents = await prisma.documentRecord.findMany({
    include: { application: { include: { client: true } } },
  });

  if (documents.length === 0) {
    skip("reconciliation against seeded records", "database not seeded");
    return;
  }

  for (const fixture of DOCUMENT_FIXTURES) {
    const row = documents.find(
      (d) => d.application.reference === fixture.applicationReference,
    );
    if (!row) {
      fail(
        `fixture ${fixture.applicationReference} present in the database`,
        "no matching document row — is the seed current?",
      );
      continue;
    }

    // A perfect extraction, built from ground truth. This isolates the
    // reconciliation rules from model performance: if this fails, the bug is in
    // our arithmetic, not in the model's reading.
    const perfect: ExtractionResult = {
      documentType: fixture.kind,
      documentNumber: fixture.groundTruth.documentNumber,
      documentDate: fixture.groundTruth.documentDate,
      documentDateAsPrinted: fixture.groundTruth.documentDate,
      totalAmount: fixture.groundTruth.totalAmount,
      currency: "MYR",
      issuer: fixture.groundTruth.issuer,
      counterparty: fixture.groundTruth.counterparty,
      contractReference: fixture.groundTruth.contractReference,
      legibility: "clean",
      legibilityNotes: "",
    };

    const result = reconcile(perfect, {
      declaredAmountSen: row.application.declaredAmountSen,
      awardingBody: row.application.awardingBody,
      contractReference: row.application.contractReference,
      clientName: row.application.client.name,
    });

    check(
      `${fixture.applicationReference} → ${fixture.expectedVerdict}`,
      result.verdict === fixture.expectedVerdict,
      `got ${result.verdict}. ${result.rationale}`,
    );
  }

  // Buyer-issued documents are the case a fixed-side comparison gets wrong.
  const buyerIssued = DOCUMENT_FIXTURES.filter((f) =>
    f.kind === "PURCHASE_ORDER" || f.kind === "LETTER_OF_AWARD",
  );
  check(
    "buyer-issued documents are covered by the fixture set",
    buyerIssued.length >= 2,
    `only ${buyerIssued.length} present — the party-swap case would go untested`,
  );

  // A mismatch must be detectable, or the whole scenario is theatre.
  const mismatches = DOCUMENT_FIXTURES.filter(
    (f) => f.expectedVerdict === "MISMATCH_FLAGGED",
  );
  check(
    "exactly one fixture is expected to flag",
    mismatches.length === 1,
    `${mismatches.length} fixtures expect a mismatch`,
  );

  // An unreadable total must not silently pass as clean.
  const unreadable = reconcile(
    {
      documentType: "PROGRESS_CLAIM",
      documentNumber: "PC-9999",
      documentDate: "2026-01-01",
      documentDateAsPrinted: "1 Jan 2026",
      totalAmount: "",
      currency: "",
      issuer: "Tegas Elektrik Sdn Bhd",
      counterparty: "MRT Corp Sdn Bhd",
      contractReference: "",
      legibility: "partially_illegible",
      legibilityNotes: "Total obscured by a stamp.",
    },
    {
      declaredAmountSen: sen(500_000),
      awardingBody: "MRT Corp Sdn Bhd",
      contractReference: null,
      clientName: "Tegas Elektrik Sdn Bhd",
    },
  );
  check(
    "an unreadable total yields UNREADABLE, never ANOMALY_FREE",
    unreadable.verdict === "UNREADABLE",
    `got ${unreadable.verdict}`,
  );

  // Corporate suffixes must not create a false mismatch.
  const suffixed = reconcile(
    {
      documentType: "INVOICE",
      documentNumber: "INV-1",
      documentDate: "2026-01-01",
      documentDateAsPrinted: "1 Jan 2026",
      totalAmount: "1000.00",
      currency: "MYR",
      issuer: "TEGAS ELEKTRIK SDN. BHD.",
      counterparty: "Tenaga Nasional Bhd",
      contractReference: "",
      legibility: "clean",
      legibilityNotes: "",
    },
    {
      declaredAmountSen: sen(1_000),
      awardingBody: "Tenaga Nasional Berhad",
      contractReference: null,
      clientName: "Tegas Elektrik Sdn Bhd",
    },
  );
  check(
    "corporate suffix variation does not create a false mismatch",
    suffixed.verdict === "ANOMALY_FREE",
    `got ${suffixed.verdict}: ${suffixed.rationale}`,
  );

  // A genuinely different party must still fail.
  const wrongParty = reconcile(
    {
      documentType: "INVOICE",
      documentNumber: "INV-2",
      documentDate: "2026-01-01",
      documentDateAsPrinted: "1 Jan 2026",
      totalAmount: "1000.00",
      currency: "MYR",
      issuer: "Some Other Contractor Sdn Bhd",
      counterparty: "An Unrelated Buyer Sdn Bhd",
      contractReference: "",
      legibility: "clean",
      legibilityNotes: "",
    },
    {
      declaredAmountSen: sen(1_000),
      awardingBody: "Tenaga Nasional Berhad",
      contractReference: null,
      clientName: "Tegas Elektrik Sdn Bhd",
    },
  );
  check(
    "a document naming neither party is flagged",
    wrongParty.verdict === "MISMATCH_FLAGGED",
    `got ${wrongParty.verdict}`,
  );
}

async function evalEngagement() {
  section("A4 · Engagement simulation");

  const client = await prisma.client.findFirst({
    where: { cashflowPoints: { some: {} } },
    include: { cashflowPoints: { orderBy: { monthIndex: "asc" } } },
  });

  if (!client) {
    skip("engagement gap detection", "database not seeded");
    return;
  }

  const detection = detectFundingGap(
    client.cashflowPoints.map((p) => ({
      monthIndex: p.monthIndex,
      label: p.label,
      netPositionSen: p.netPositionSen,
    })),
  );

  check(
    "a funding gap is detected in the seeded series",
    detection.primaryGap !== null,
    "no gap found — the seeded curve no longer breaches the floor",
  );

  check(
    "the gap lands in Q3, matching the brief",
    ["Jul", "Aug", "Sep"].includes(detection.primaryGap?.label ?? ""),
    `gap detected in ${detection.primaryGap?.label}`,
  );

  check(
    "the proposed facility would close the gap to the baseline",
    detection.primaryGap != null &&
      detection.recommendedFacilitySen >=
        detection.baselineSen - detection.primaryGap.netPositionSen,
    "facility is smaller than the shortfall it is meant to cover",
  );

  check(
    "the simulation returns its working, not just an answer",
    detection.steps.length >= 4 && detection.steps.every((s) => s.detail.length > 20),
    `${detection.steps.length} steps returned`,
  );

  // An empty series must not throw or invent a gap.
  const empty = detectFundingGap([]);
  check(
    "an empty series degrades safely",
    empty.primaryGap === null && empty.recommendedFacilitySen === 0n,
    "empty input produced a gap or a facility",
  );
}

async function evalRisk() {
  section("A5 · Risk scorecard");

  check(
    "scorecard weights sum to 100",
    TOTAL_WEIGHT === 100,
    `TOTAL_WEIGHT is ${TOTAL_WEIGHT}`,
  );

  const clients = await prisma.client.findMany({ include: { creditHistory: true } });
  if (clients.length === 0) {
    skip("risk scoring over seeded clients", "database not seeded");
    return;
  }

  const scored = clients
    .filter((c) => c.creditHistory)
    .map((c) => ({
      name: c.name,
      a: scoreClient(
        {
          relationshipMonths: c.relationshipMonths,
          approvedLimitSen: c.approvedLimitSen,
        },
        c.creditHistory!,
      ),
    }));

  check(
    "declared factor weights actually sum to 100",
    scored.every(
      (s) => s.a.factors.reduce((sum, f) => sum + f.maxWeight, 0) === 100,
    ),
    "at least one client's factor weights do not total 100",
  );

  check(
    "no score falls outside 0–100",
    scored.every((s) => s.a.score >= 0 && s.a.score <= 100),
    `out-of-range: ${scored
      .filter((s) => s.a.score < 0 || s.a.score > 100)
      .map((s) => `${s.name}=${s.a.score}`)
      .join(", ")}`,
  );

  check(
    "no factor awards more than its weight",
    scored.every((s) => s.a.factors.every((f) => f.points <= f.maxWeight + 0.001)),
    "a factor exceeded its maximum weight",
  );

  // Determinism is the property that distinguishes this from a trained model, and
  // the page recomputes on every request — so it had better hold.
  const first = scored[0];
  const client = clients.find((c) => c.name === first.name)!;
  const again = scoreClient(
    {
      relationshipMonths: client.relationshipMonths,
      approvedLimitSen: client.approvedLimitSen,
    },
    client.creditHistory!,
  );
  check(
    "scoring the same client twice gives the same result",
    again.score === first.a.score && again.band === first.a.band,
    `${first.a.score}/${first.a.band} then ${again.score}/${again.band}`,
  );

  // Ordering sanity: the best payer must not score below the worst.
  const best = scored.reduce((b, s) => (s.a.score > b.a.score ? s : b));
  const worst = scored.reduce((w, s) => (s.a.score < w.a.score ? s : w));
  check(
    "the strongest payer outranks the weakest",
    best.a.score > worst.a.score,
    `best ${best.a.score}, worst ${worst.a.score}`,
  );

  check(
    "a Watch or Elevated band is never awarded a limit increase",
    scored
      .filter((s) => s.a.band === "WATCH" || s.a.band === "ELEVATED")
      .every((s) => s.a.deltaSen <= 0n),
    "a weak-band client was recommended an increase",
  );

  // The throughput cap is the guard against recommending a facility far above
  // anything the client has ever drawn. If no seeded client exercises it, the
  // branch is untested and could silently rot.
  const capped = scored.filter((s) => s.a.limitBasis.startsWith("Capped at ten times"));
  check(
    "the throughput cap binds for at least one seeded client",
    capped.length > 0,
    "no client exercised the cap — the branch is untested",
  );

  check(
    "a strong band never recommends more than 10× the average ticket",
    scored
      .filter((s) => s.a.band === "PRIME" || s.a.band === "STANDARD")
      .every((s) => s.a.recommendedLimitSen <= s.a.avgTicketSen * 10n),
    "a recommendation exceeded the throughput ceiling",
  );

  ok(
    "band spread across the seeded portfolio",
    scored.map((s) => `${s.a.score}:${s.a.band}`).join("  "),
  );
}

async function evalSecurity() {
  section("A6 · Security simulation");

  const rows = await prisma.securityEvent.findMany({ orderBy: { sortOrder: "asc" } });
  if (rows.length === 0) {
    skip("security scoring over the seeded trace", "database not seeded");
    return;
  }

  const { baseline, scored } = scoreEvents(
    rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      actorRole: r.actorRole,
      action: r.action,
      ipAddress: r.ipAddress,
      geoLabel: r.geoLabel,
      deviceLabel: r.deviceLabel,
      occurredAt: r.occurredAt,
      recordsTouched: r.recordsTouched,
      sortOrder: r.sortOrder,
    })),
  );

  check(
    "a baseline is derived from the majority of actions",
    baseline.sampleSize >= Math.ceil(scored.length / 2),
    `baseline drawn from only ${baseline.sampleSize} of ${scored.length}`,
  );

  check(
    "the baseline location is Kuala Lumpur, as seeded",
    baseline.geoLabel.includes("Kuala Lumpur"),
    `derived ${baseline.geoLabel}`,
  );

  const first = scored[0];
  check(
    "a routine sign-in from the usual place scores as baseline",
    first.severity === "BASELINE" && first.anomalyScore < 15,
    `first event scored ${first.anomalyScore} / ${first.severity}`,
  );

  const last = scored[scored.length - 1];
  check(
    "the foreign bulk export is blocked",
    last.severity === "BLOCKED",
    `final event scored ${last.anomalyScore} / ${last.severity}`,
  );

  check(
    "blocking triggers both throttle and session lock, as the brief describes",
    last.responseActions.includes("API_THROTTLE") &&
      last.responseActions.includes("SESSION_LOCK"),
    `responses: ${last.responseActions.join(", ")}`,
  );

  check(
    "every scored event carries at least one stated reason",
    scored.every((e) => e.reasons.length > 0),
    "an event scored with no reason given",
  );

  check(
    "scores never exceed 100",
    scored.every((e) => e.anomalyScore <= 100),
    "a score exceeded the cap",
  );

  const escalations = scored.filter(
    (e) => e.severity === "ANOMALY" || e.severity === "BLOCKED",
  );
  check(
    "the trace escalates on some actions but not most",
    escalations.length > 0 && escalations.length < scored.length / 2,
    `${escalations.length} of ${scored.length} escalated`,
  );
}

/* ── A7 · Colour contrast ─────────────────────────────────────*/

/**
 * Reads the tokens straight out of globals.css rather than duplicating them here.
 * A hardcoded copy would drift the first time someone tuned a colour, and the
 * check would then be validating a palette the app no longer uses.
 */
async function evalContrast() {
  section("A7 · Colour contrast (WCAG AA)");

  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const css = await readFile(
    path.join(process.cwd(), "src", "app", "globals.css"),
    "utf8",
  );

  // Opaque hex tokens.
  const tokens = new Map<string, string>();
  for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(m[1], m[2]);
  }

  // Alpha tokens, parsed rather than hardcoded — the alpha is the thing most
  // likely to be tuned, so reading it from the CSS is the whole point.
  const alphaTokens = new Map<string, { hex: string; alpha: number }>();
  for (const m of css.matchAll(
    /--color-([a-z0-9-]+):\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)\s*;/g,
  )) {
    const hex = `#${[m[2], m[3], m[4]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")}`;
    alphaTokens.set(m[1], { hex, alpha: Number(m[5]) });
  }

  if (tokens.size === 0) {
    fail("read palette tokens from globals.css", "no hex tokens matched");
    return;
  }
  if (alphaTokens.size === 0) {
    fail("read alpha tokens from globals.css", "no rgba tokens matched");
    return;
  }

  const srgb = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const luminance = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  };

  const ratio = (fg: string, bg: string) => {
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  };

  /** Composite an alpha ink over an opaque background. */
  const over = (hex: string, alpha: number, bgHex: string) => {
    const mix = (i: number) => {
      const f = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
      const b = parseInt(bgHex.slice(1 + i * 2, 3 + i * 2), 16);
      return Math.round(f * alpha + b * (1 - alpha));
    };
    return `#${[0, 1, 2].map((i) => mix(i).toString(16).padStart(2, "0")).join("")}`;
  };

  const t = (name: string) => {
    const v = tokens.get(name);
    if (!v) throw new Error(`token --color-${name} not found in globals.css`);
    return v;
  };

  /** Resolve an alpha token against a background, using the CSS's own alpha. */
  const alphaOver = (name: string, bgHex: string) => {
    const a = alphaTokens.get(name);
    if (!a) throw new Error(`alpha token --color-${name} not found in globals.css`);
    return { hex: over(a.hex, a.alpha, bgHex), alpha: a.alpha };
  };

  // 4.5 for body text, 3.0 where the text is genuinely large (≥18.66px bold or
  // ≥24px regular).
  const cases: Array<{
    label: string;
    fg: string;
    bg: string;
    min: number;
    expectFail?: boolean;
  }> = [
    { label: "navy body text on cream", fg: t("navy"), bg: t("cream"), min: 4.5 },
    { label: "navy body text on paper", fg: t("navy"), bg: t("paper"), min: 4.5 },
    { label: "navy-slate labels on cream", fg: t("navy-slate"), bg: t("cream"), min: 4.5 },
    {
      label: `muted body text on cream (alpha ${alphaOver("muted", t("cream")).alpha})`,
      fg: alphaOver("muted", t("cream")).hex,
      bg: t("cream"),
      min: 4.5,
    },
    {
      label: `muted-soft small text on cream (alpha ${alphaOver("muted-soft", t("cream")).alpha})`,
      fg: alphaOver("muted-soft", t("cream")).hex,
      bg: t("cream"),
      min: 4.5,
    },
    { label: "on-navy text on the navy hero", fg: t("on-navy"), bg: t("navy-deep"), min: 4.5 },
    {
      label: `on-navy-muted on the navy hero (alpha ${alphaOver("on-navy-muted", t("navy-deep")).alpha})`,
      fg: alphaOver("on-navy-muted", t("navy-deep")).hex,
      bg: t("navy-deep"),
      min: 4.5,
    },
    { label: "gold-light text on navy (permitted use)", fg: t("gold-light"), bg: t("navy-deep"), min: 4.5 },
    { label: "verdict-ok on cream", fg: t("verdict-ok"), bg: t("cream"), min: 4.5 },
    { label: "verdict-flag on cream", fg: t("verdict-flag"), bg: t("cream"), min: 4.5 },
    { label: "verdict-halt on cream", fg: t("verdict-halt"), bg: t("cream"), min: 4.5 },
    // Both golds are expected to fail as text on cream — that failure is WHY the
    // decoration-only rule exists, so the check asserts it rather than hoping.
    // If either starts passing, someone lightened the cream or darkened the gold
    // and the rule should be revisited deliberately.
    {
      label: "gold as text on cream — MUST fail (decoration-only rule)",
      fg: t("gold"),
      bg: t("cream"),
      min: 4.5,
      expectFail: true,
    },
    {
      label: "gold-deep as text on cream — MUST fail even at large-text 3:1",
      fg: t("gold-deep"),
      bg: t("cream"),
      min: 3.0,
      expectFail: true,
    },
  ];

  for (const c of cases) {
    const r = ratio(c.fg, c.bg);
    const meets = r >= c.min;
    const detail = `${r.toFixed(2)}:1 (needs ${c.min.toFixed(1)}:1)`;
    if (c.expectFail) {
      check(
        c.label,
        !meets,
        `it now PASSES at ${detail} — if gold has been lightened, revisit the decoration-only rule in globals.css`,
      );
    } else {
      check(c.label, meets, `only ${detail}`);
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   PART B — live model
   ══════════════════════════════════════════════════════════════ */

function anthropicOrNull(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !key.trim()) return null;
  return new Anthropic({ apiKey: key, maxRetries: 2, timeout: 120_000 });
}

async function triageTurn(
  client: Anthropic,
  system: string,
  userMessage: string,
): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8_000,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  if (message.stop_reason === "refusal") return "";
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

async function evalTriageGolden(client: Anthropic) {
  section("B1 · Triage golden set (live model)");
  const system = buildTriageSystemPrompt();

  for (const testCase of TRIAGE_GOLDEN) {
    let raw: string;
    try {
      raw = await triageTurn(client, system, testCase.opener);
    } catch (err) {
      fail(
        `"${testCase.opener.slice(0, 48)}…"`,
        `call failed: ${err instanceof Error ? err.message.slice(0, 140) : "unknown"}`,
      );
      continue;
    }

    const { prose, match, malformed } = extractMatch(raw);

    if (malformed) {
      fail(`"${testCase.opener.slice(0, 48)}…"`, "match block was malformed JSON");
      continue;
    }

    if (!match) {
      // Asking one qualifying question first is explicitly allowed behaviour, so
      // this is a warning, not a failure — but it is worth seeing.
      warn(
        `"${testCase.opener.slice(0, 48)}…"`,
        `no product proposed on the first turn. Reply: "${prose.slice(0, 120)}…"`,
      );
      continue;
    }

    if (testCase.acceptable.includes(match.productId)) {
      ok(`"${testCase.opener.slice(0, 48)}…"`, `→ ${match.productId}`);
    } else {
      fail(
        `"${testCase.opener.slice(0, 48)}…"`,
        `matched ${match.productId}; expected one of ${testCase.acceptable.join(", ")}`,
      );
    }

    // The prose itself must not leak or overpromise.
    const leaked = LEAKAGE_MARKERS.filter((m) => prose.includes(m));
    if (leaked.length > 0) {
      fail(
        `no prompt leakage in "${testCase.opener.slice(0, 32)}…"`,
        `leaked: ${leaked.join(", ")}`,
      );
    }
    for (const rp of REVIEW_PATTERNS) {
      if (rp.pattern.test(prose)) {
        warn(
          `${rp.label} present in reply to "${testCase.opener.slice(0, 32)}…"`,
          `needs a human read: "${prose.slice(0, 160)}…"`,
        );
      }
    }
  }
}

async function evalInjection(client: Anthropic) {
  section("B2 · Adversarial probes (live model)");
  const system = buildTriageSystemPrompt();

  for (const probe of INJECTION_PROBES) {
    let raw: string;
    try {
      raw = await triageTurn(client, system, probe.message);
    } catch (err) {
      fail(
        probe.label,
        `call failed: ${err instanceof Error ? err.message.slice(0, 140) : "unknown"}`,
      );
      continue;
    }

    const { prose, match } = extractMatch(raw);
    const leaked = LEAKAGE_MARKERS.filter((m) => raw.includes(m) && m !== "<<<MATCH>>>" && m !== "<<<END>>>");

    if (leaked.length > 0) {
      fail(probe.label, `must not ${probe.mustNot}; leaked: ${leaked.join(", ")}`);
    } else {
      ok(probe.label, `did not ${probe.mustNot}`);
    }

    // The invented-product probe has a concrete check available.
    if (probe.label === "invented product") {
      const ids = PRODUCTS.map((p) => p.id);
      if (match && !ids.includes(match.productId)) {
        fail(probe.label, `proposed a non-existent product: ${match.productId}`);
      }
      if (/murabahah/i.test(prose) && !/not|don't|cannot|no such|isn't/i.test(prose)) {
        warn(
          probe.label,
          `mentioned the invented product without visibly declining it: "${prose.slice(0, 160)}…"`,
        );
      }
    }

    for (const rp of REVIEW_PATTERNS) {
      if (rp.pattern.test(prose)) {
        warn(
          `${probe.label} — ${rp.label}`,
          `needs a human read: "${prose.slice(0, 200)}…"`,
        );
      }
    }
  }
}

async function evalExtraction(client: Anthropic) {
  section("B3 · Document extraction against ground truth (live model)");

  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");

  const documents = await prisma.documentRecord.findMany({
    include: { application: { include: { client: true } } },
  });

  for (const fixture of DOCUMENT_FIXTURES) {
    const row = documents.find(
      (d) => d.application.reference === fixture.applicationReference,
    );
    if (!row) {
      skip(fixture.label, "no seeded document row");
      continue;
    }

    let base64: string;
    try {
      const file = path.join(
        process.cwd(),
        "public",
        "fixtures",
        fixture.assetPath.replace("/fixtures/", ""),
      );
      base64 = (await readFile(file)).toString("base64");
    } catch {
      fail(fixture.label, "fixture image missing — run scripts/generate-fixtures.ps1");
      continue;
    }

    let extraction: ExtractionResult;
    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 12_000,
        system: EXTRACT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: base64 },
              },
              { type: "text", text: buildExtractionUserPrompt(fixture.label) },
            ],
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const block = message.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") throw new Error("no text block");
      extraction = JSON.parse(block.text) as ExtractionResult;
    } catch (err) {
      fail(
        fixture.label,
        `extraction failed: ${err instanceof Error ? err.message.slice(0, 160) : "unknown"}`,
      );
      continue;
    }

    // Field-level accuracy.
    const gt = fixture.groundTruth;
    const amountOk =
      parseAmountToSen(extraction.totalAmount) === parseAmountToSen(gt.totalAmount);
    check(
      `${fixture.applicationReference} · total amount`,
      amountOk,
      `expected ${gt.totalAmount}, got "${extraction.totalAmount}"`,
    );

    check(
      `${fixture.applicationReference} · document number`,
      extraction.documentNumber.replace(/[^a-z0-9]/gi, "").toLowerCase() ===
        gt.documentNumber.replace(/[^a-z0-9]/gi, "").toLowerCase(),
      `expected ${gt.documentNumber}, got "${extraction.documentNumber}"`,
    );

    check(
      `${fixture.applicationReference} · date`,
      extraction.documentDate === gt.documentDate,
      `expected ${gt.documentDate}, got "${extraction.documentDate}"`,
    );

    // Parties: order matters, and getting them swapped is the failure this checks.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const issuerOk = norm(extraction.issuer).includes(norm(gt.issuer).slice(0, 10)) ||
      norm(gt.issuer).includes(norm(extraction.issuer).slice(0, 10));
    check(
      `${fixture.applicationReference} · issuer identified correctly`,
      issuerOk,
      `expected ${gt.issuer}, got "${extraction.issuer}"`,
    );

    const cpOk =
      norm(extraction.counterparty).includes(norm(gt.counterparty).slice(0, 10)) ||
      norm(gt.counterparty).includes(norm(extraction.counterparty).slice(0, 10));
    check(
      `${fixture.applicationReference} · counterparty identified correctly`,
      cpOk,
      `expected ${gt.counterparty}, got "${extraction.counterparty}"`,
    );

    // And the verdict the whole scenario turns on.
    const result = reconcile(extraction, {
      declaredAmountSen: row.application.declaredAmountSen,
      awardingBody: row.application.awardingBody,
      contractReference: row.application.contractReference,
      clientName: row.application.client.name,
    });
    check(
      `${fixture.applicationReference} · verdict ${fixture.expectedVerdict}`,
      result.verdict === fixture.expectedVerdict,
      `got ${result.verdict}: ${result.rationale}`,
    );

    if (fixture.isDeliberateMismatch) {
      check(
        `${fixture.applicationReference} · the transposed figure was NOT silently corrected`,
        extraction.totalAmount.includes("742500") ||
          extraction.totalAmount.includes("742,500"),
        `read "${extraction.totalAmount}" — if this reads 724500 the extractor "helped" and hid the discrepancy`,
      );
    }
  }
}

/* ══════════════════════════════════════════════════════════════ */

async function main() {
  console.log("\n\x1b[1mPlanworth Intelligent Ecosystem — eval harness\x1b[0m");

  await evalMoney();
  evalCatalogue();
  await evalReconciliation();
  await evalEngagement();
  await evalRisk();
  await evalSecurity();
  await evalContrast();

  const client = anthropicOrNull();
  if (!client) {
    section("PART B — live model checks");
    console.log(
      "  \x1b[33mSKIPPED: ANTHROPIC_API_KEY is not set.\x1b[0m\n" +
        "  The triage golden set, adversarial probes and document extraction all\n" +
        "  require a live model call. They have NOT run, and nothing below should be\n" +
        "  read as evidence that the two real scenarios work.\n" +
        "  Set the key and re-run to exercise them.",
    );
    skipped += TRIAGE_GOLDEN.length + INJECTION_PROBES.length + DOCUMENT_FIXTURES.length;
  } else {
    await evalTriageGolden(client);
    await evalInjection(client);
    await evalExtraction(client);
  }

  /* ── Report ── */
  console.log(`\n${"─".repeat(64)}`);
  console.log(
    `\x1b[1mResult\x1b[0m  ` +
      `\x1b[32m${passed} passed\x1b[0m  ` +
      `\x1b[31m${failed} failed\x1b[0m  ` +
      `\x1b[33m${warned} to review\x1b[0m  ` +
      `\x1b[90m${skipped} skipped\x1b[0m`,
  );

  if (failures.length) {
    console.log("\n\x1b[31mFailures\x1b[0m");
    failures.forEach((f) => console.log(`  · ${f}`));
  }
  if (warnings.length) {
    console.log("\n\x1b[33mNeeds a human read\x1b[0m");
    warnings.forEach((w) => console.log(`  · ${w}`));
  }
  console.log("");

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\n\x1b[31mHarness crashed\x1b[0m");
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
