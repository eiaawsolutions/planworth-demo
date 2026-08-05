import type { ExtractionResult } from "@/lib/prompts/extract";

/**
 * Cross-references an extraction against what the CRM already holds.
 *
 * Kept out of the route handler so the eval harness can exercise it directly on
 * known inputs — the reconciliation rules are where a silent bug would be most
 * expensive, because a wrong "Anomaly free" is worse than no check at all.
 */

export type Verdict = "ANOMALY_FREE" | "MISMATCH_FLAGGED" | "UNREADABLE";

export interface CrmRecord {
  declaredAmountSen: bigint | null;
  awardingBody: string | null;
  contractReference: string | null;
  /** Planworth's own client — the applicant. */
  clientName: string;
}

export interface FieldComparison {
  name: string;
  extractedText: string;
  crmValue: string | null;
  matches: boolean;
  /** Why it matched or did not. Always populated. */
  note: string;
  /** True when there was nothing on the CRM side to compare against. */
  informationalOnly: boolean;
}

export interface Reconciliation {
  verdict: Verdict;
  rationale: string;
  fields: FieldComparison[];
  /** Populated when the amounts disagree — the number a human will care about. */
  amountDeltaSen: bigint | null;
}

/** Company-name noise that should never decide a mismatch. */
const COMPANY_NOISE =
  /\b(sdn\.?\s*bhd\.?|berhad|bhd\.?|s\/b|pte\.?\s*ltd\.?|ltd\.?|limited|corp\.?|corporation|inc\.?|enterprise|resources|holdings)\b/g;

function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(COMPANY_NOISE, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseRef(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "742500.00" → 74250000n. Returns null on anything unparseable. */
export function parseAmountToSen(raw: string): bigint | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const sen = frac.padEnd(2, "0").slice(0, 2);
  return BigInt(whole) * 100n + BigInt(sen);
}

function formatSen(amount: bigint): string {
  return `RM ${(Number(amount) / 100).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Two company names refer to the same party if either normalised form contains
 * the other.
 *
 * Containment is only allowed once the shorter name is long enough to be
 * distinctive. Stripping suffixes can leave a very short stem — "MRT Corp Sdn
 * Bhd" reduces to "mrt" — and a three-character containment test would happily
 * match that inside an unrelated name. Below the threshold, require equality.
 */
const MIN_CONTAINMENT_LENGTH = 5;

function namesAgree(a: string, b: string): boolean {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  if (shorter.length < MIN_CONTAINMENT_LENGTH) return false;
  return na.includes(nb) || nb.includes(na);
}

export function reconcile(
  extraction: ExtractionResult,
  crm: CrmRecord,
): Reconciliation {
  const fields: FieldComparison[] = [];
  let amountDeltaSen: bigint | null = null;

  // ── Document number: informational, nothing to compare against ──
  fields.push({
    name: "Document number",
    extractedText: extraction.documentNumber || "—",
    crmValue: null,
    matches: true,
    note: extraction.documentNumber
      ? "Read from the page. No corresponding value is held in the CRM to check it against."
      : "Not readable on this page.",
    informationalOnly: true,
  });

  // ── Date: informational ──
  fields.push({
    name: "Document date",
    extractedText: extraction.documentDateAsPrinted || extraction.documentDate || "—",
    crmValue: null,
    matches: true,
    note: extraction.documentDate
      ? `Normalised to ${extraction.documentDate}.`
      : "Not readable on this page.",
    informationalOnly: true,
  });

  // ── Amount: the field that matters ──
  const extractedSen = parseAmountToSen(extraction.totalAmount);
  if (crm.declaredAmountSen == null) {
    fields.push({
      name: "Claim total",
      extractedText: extractedSen ? formatSen(extractedSen) : extraction.totalAmount || "—",
      crmValue: null,
      matches: true,
      note: "The application does not declare an amount, so there is nothing to reconcile against.",
      informationalOnly: true,
    });
  } else if (extractedSen == null) {
    fields.push({
      name: "Claim total",
      extractedText: extraction.totalAmount || "—",
      crmValue: formatSen(crm.declaredAmountSen),
      matches: false,
      note: "No total could be read from the page, so the declared amount cannot be confirmed.",
      informationalOnly: false,
    });
  } else {
    const matches = extractedSen === crm.declaredAmountSen;
    if (!matches) amountDeltaSen = extractedSen - crm.declaredAmountSen;
    fields.push({
      name: "Claim total",
      extractedText: formatSen(extractedSen),
      crmValue: formatSen(crm.declaredAmountSen),
      matches,
      note: matches
        ? "Matches the amount declared on the application to the sen."
        : `Disagrees with the declared amount by ${formatSen(
            amountDeltaSen! < 0n ? -amountDeltaSen! : amountDeltaSen!,
          )}. The document reads ${formatSen(extractedSen)}; the application declares ${formatSen(crm.declaredAmountSen)}.`,
      informationalOnly: false,
    });
  }

  // ── The two parties ──
  //
  // Which side of the document a given organisation appears on depends on who
  // raised it: a contractor issues an invoice to the awarding body, but the
  // awarding body issues the letter of award back. So both parties are checked
  // against both sides rather than assuming a fixed arrangement — otherwise every
  // buyer-issued document reconciles as a mismatch.
  const partiesOnDocument = [extraction.issuer, extraction.counterparty].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  const partiesLabel = partiesOnDocument.length
    ? partiesOnDocument.join("  ·  ")
    : "—";

  // Applicant — confirms the document actually belongs to this application.
  const applicantFound = partiesOnDocument.some((p) =>
    namesAgree(p, crm.clientName),
  );
  fields.push({
    name: "Applicant on the document",
    extractedText: partiesLabel,
    crmValue: crm.clientName,
    matches: applicantFound,
    note: applicantFound
      ? "The applicant appears as one of the two parties, so this document belongs to this application."
      : "The applicant is not named on this page. The document may have been filed against the wrong application.",
    informationalOnly: partiesOnDocument.length === 0,
  });

  // Awarding body / buyer.
  if (!crm.awardingBody) {
    fields.push({
      name: "Awarding body / buyer",
      extractedText: partiesLabel,
      crmValue: null,
      matches: true,
      note: "The application records no awarding body or buyer to compare against.",
      informationalOnly: true,
    });
  } else if (partiesOnDocument.length === 0) {
    fields.push({
      name: "Awarding body / buyer",
      extractedText: "—",
      crmValue: crm.awardingBody,
      matches: false,
      note: "Neither party could be read from the page.",
      informationalOnly: false,
    });
  } else {
    const matches = partiesOnDocument.some((p) =>
      namesAgree(p, crm.awardingBody!),
    );
    fields.push({
      name: "Awarding body / buyer",
      extractedText: partiesLabel,
      crmValue: crm.awardingBody,
      matches,
      note: matches
        ? "The awarding body on file appears as one of the two parties, ignoring corporate suffixes."
        : "The awarding body recorded on the application is not named on this page.",
      informationalOnly: false,
    });
  }

  // ── Contract reference ──
  if (!crm.contractReference) {
    fields.push({
      name: "Contract reference",
      extractedText: extraction.contractReference || "—",
      crmValue: null,
      matches: true,
      note: "The application records no contract reference to compare against.",
      informationalOnly: true,
    });
  } else if (!extraction.contractReference) {
    fields.push({
      name: "Contract reference",
      extractedText: "—",
      crmValue: crm.contractReference,
      matches: true,
      note: "No contract reference printed on this page. Not treated as a mismatch — many documents legitimately omit it.",
      informationalOnly: true,
    });
  } else {
    const matches =
      normaliseRef(extraction.contractReference) ===
      normaliseRef(crm.contractReference);
    fields.push({
      name: "Contract reference",
      extractedText: extraction.contractReference,
      crmValue: crm.contractReference,
      matches,
      note: matches
        ? "Matches the reference on the application."
        : "Does not match the reference on the application.",
      informationalOnly: false,
    });
  }

  // ── Verdict ──
  const comparable = fields.filter((f) => !f.informationalOnly);
  const failures = comparable.filter((f) => !f.matches);

  let verdict: Verdict;
  let rationale: string;

  if (extractedSen == null && crm.declaredAmountSen != null) {
    verdict = "UNREADABLE";
    rationale =
      "The headline total could not be read from this page, so the application cannot be reconciled. It needs a clearer copy before it goes to underwriting.";
  } else if (failures.length === 0) {
    verdict = "ANOMALY_FREE";
    rationale =
      comparable.length === 0
        ? "Nothing on the application to reconcile against, but every field on the page was read cleanly."
        : `All ${comparable.length} reconcilable field${comparable.length === 1 ? "" : "s"} agree with the application. Ready for approval.`;
  } else {
    verdict = "MISMATCH_FLAGGED";
    const names = failures.map((f) => f.name.toLowerCase()).join(" and ");
    rationale = `The ${names} on this document ${failures.length === 1 ? "does" : "do"} not agree with the application. Held for an analyst before it goes any further.`;
  }

  return { verdict, rationale, fields, amountDeltaSen };
}
