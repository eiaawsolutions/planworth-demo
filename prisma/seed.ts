/**
 * Seed — Planworth Intelligent Ecosystem demo.
 *
 * EVERYTHING HERE IS FICTIONAL. Company names, registration numbers, contract
 * references, IP addresses and staff names are all invented. `isDemoFixture`
 * stays true on every Client row and this file never sets it false.
 *
 * Where the numbers come from:
 *   · The deck cites RM4bn disbursed across 40,000+ transactions. Seeding that
 *     volume would be theatre, so we seed SIX clients whose aggregate reads as a
 *     plausible slice of that book, and the risk page says so on screen rather
 *     than implying it is the whole dataset.
 *   · The cash-flow series reproduces the seasonal shape on slide 5, including
 *     the Q3 trough the engagement scenario detects.
 *   · The document fixtures include the exact worked example printed on slide 8
 *     (invoice #1024 / 25 Oct 2024 / 50,000 / ACME CORP) so the audience
 *     recognises it, plus Malaysian fixtures that show real-world fit, plus one
 *     deliberate mismatch so the anomaly path is demonstrable.
 *   · IP addresses use 203.0.113.0/24 (TEST-NET-3, reserved for documentation)
 *     rather than any real address.
 */

import {
  PrismaClient,
  ClientSegment,
  ApplicationStage,
  LeadSource,
  DocumentKind,
  ExtractionVerdict,
  CampaignChannel,
  CampaignStatus,
  SecuritySeverity,
  SecurityResponse,
  type ProductCategory,
} from "@prisma/client";
import { PRODUCTS } from "../src/lib/products";
import { DOCUMENT_FIXTURES } from "../src/lib/fixtures";
import { sen } from "../src/lib/money";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────

interface ClientSeed {
  key: string;
  name: string;
  registrationNo: string;
  sector: string;
  segment: ClientSegment;
  relationshipMonths: number;
  approvedLimit: number;
  history: {
    transactionsObserved: number;
    totalDisbursed: number;
    onTimeSettlementPct: number;
    avgDaysToSettle: number;
    worstArrearsDays: number;
    distinctCounterparties: number;
    disputeRatePct: number;
  };
}

const CLIENTS: ClientSeed[] = [
  {
    key: "bina-harmoni",
    name: "Bina Harmoni Sdn Bhd",
    registrationNo: "202201004821",
    sector: "Construction — building works",
    segment: ClientSegment.GOVERNMENT_CONTRACTOR,
    relationshipMonths: 52,
    approvedLimit: 3_500_000,
    history: {
      transactionsObserved: 214,
      totalDisbursed: 41_200_000,
      onTimeSettlementPct: 97,
      avgDaysToSettle: 34,
      worstArrearsDays: 4,
      distinctCounterparties: 9,
      disputeRatePct: 1,
    },
  },
  {
    key: "tegas-elektrik",
    name: "Tegas Elektrik Sdn Bhd",
    registrationNo: "201901022114",
    sector: "Mechanical & electrical subcontracting",
    segment: ClientSegment.GLC_VENDOR,
    relationshipMonths: 34,
    approvedLimit: 1_200_000,
    history: {
      transactionsObserved: 128,
      totalDisbursed: 18_600_000,
      onTimeSettlementPct: 94,
      avgDaysToSettle: 41,
      worstArrearsDays: 12,
      distinctCounterparties: 6,
      disputeRatePct: 2,
    },
  },
  {
    key: "sinar-logistik",
    name: "Sinar Logistik Sdn Bhd",
    registrationNo: "202003017756",
    sector: "Logistics & haulage",
    segment: ClientSegment.SME,
    relationshipMonths: 21,
    approvedLimit: 800_000,
    history: {
      transactionsObserved: 66,
      totalDisbursed: 6_400_000,
      onTimeSettlementPct: 89,
      avgDaysToSettle: 47,
      worstArrearsDays: 21,
      distinctCounterparties: 4,
      disputeRatePct: 3,
    },
  },
  {
    key: "amanah-teknik",
    name: "Amanah Teknik Resources Sdn Bhd",
    registrationNo: "202205009903",
    sector: "Engineering services",
    segment: ClientSegment.SME,
    relationshipMonths: 11,
    approvedLimit: 400_000,
    history: {
      transactionsObserved: 22,
      totalDisbursed: 1_900_000,
      onTimeSettlementPct: 82,
      avgDaysToSettle: 58,
      worstArrearsDays: 34,
      distinctCounterparties: 3,
      disputeRatePct: 6,
    },
  },
  {
    key: "perdana-supply",
    name: "Perdana Supply Chain Sdn Bhd",
    registrationNo: "201703001248",
    sector: "Industrial distribution",
    segment: ClientSegment.CORPORATE,
    relationshipMonths: 78,
    approvedLimit: 8_000_000,
    history: {
      transactionsObserved: 402,
      totalDisbursed: 96_800_000,
      onTimeSettlementPct: 98,
      avgDaysToSettle: 29,
      worstArrearsDays: 3,
      distinctCounterparties: 21,
      disputeRatePct: 1,
    },
  },
  {
    key: "karya-muhibbah",
    name: "Karya Muhibbah Enterprise",
    registrationNo: "202401002277",
    sector: "Civil works",
    segment: ClientSegment.SME,
    relationshipMonths: 5,
    approvedLimit: 150_000,
    history: {
      transactionsObserved: 7,
      totalDisbursed: 480_000,
      onTimeSettlementPct: 71,
      avgDaysToSettle: 68,
      worstArrearsDays: 52,
      distinctCounterparties: 2,
      disputeRatePct: 12,
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Scenario 1 — the seasonal cash-flow series from slide 5
// ─────────────────────────────────────────────────────────────

/**
 * Sinar Logistik's net working-capital position by month, in ringgit.
 * Reproduces the deck's curve: builds to an April peak, collapses into a Q3
 * trough (July), then recovers through Q4. July is the gap the engagement
 * simulation is meant to find.
 */
const CASHFLOW_RINGGIT: Array<[string, number]> = [
  ["Jan", 420_000],
  ["Feb", 505_000],
  ["Mar", 610_000],
  ["Apr", 735_000],
  ["May", 540_000],
  ["Jun", 300_000],
  ["Jul", 95_000],
  ["Aug", 240_000],
  ["Sep", 385_000],
  ["Oct", 470_000],
  ["Nov", 405_000],
  ["Dec", 560_000],
];

// ─────────────────────────────────────────────────────────────
// Applications
// ─────────────────────────────────────────────────────────────

interface ApplicationSeed {
  reference: string;
  clientKey: string;
  productId: string;
  stage: ApplicationStage;
  declaredAmount: number | null;
  awardingBody: string | null;
  contractReference: string | null;
  enquiryNote?: string;
}

const APPLICATIONS: ApplicationSeed[] = [
  {
    reference: "APP-2026-0301",
    clientKey: "bina-harmoni",
    productId: "contract-progress-claim-financing",
    stage: ApplicationStage.UNDER_REVIEW,
    declaredAmount: 50_000,
    awardingBody: "ACME CORP",
    contractReference: "AC/2024/1024",
    enquiryNote:
      "Reproduces the worked example printed on slide 8 of the brief, so the audience sees the exact figures the deck promised.",
  },
  {
    reference: "APP-2026-0412",
    clientKey: "bina-harmoni",
    productId: "contract-financing-works",
    stage: ApplicationStage.DISBURSED,
    declaredAmount: 3_480_000,
    awardingBody: "Jabatan Kerja Raya Selangor",
    contractReference: "JKR/S/2025/118",
  },
  {
    reference: "APP-2026-0498",
    clientKey: "tegas-elektrik",
    productId: "invoice-financing",
    stage: ApplicationStage.DOCUMENTS_RECEIVED,
    declaredAmount: 486_300,
    awardingBody: "Jabatan Kerja Raya Selangor",
    contractReference: "JKR/S/2025/118-ME",
  },
  {
    // The deliberate mismatch. The applicant declared 724,500; the certified
    // claim reads 742,500 — a digit transposition, which is exactly the error a
    // human re-keying the figure would make.
    reference: "APP-2026-0517",
    clientKey: "tegas-elektrik",
    productId: "progress-billing-discounting",
    stage: ApplicationStage.UNDER_REVIEW,
    declaredAmount: 724_500,
    awardingBody: "MRT Corp Sdn Bhd",
    contractReference: "MRTC/PKG/2025/44",
  },
  {
    reference: "APP-2026-0455",
    clientKey: "perdana-supply",
    productId: "po-financing",
    stage: ApplicationStage.APPROVED,
    declaredAmount: 1_250_000,
    awardingBody: "Tenaga Nasional Berhad",
    contractReference: "TNB/PO/2026/44127",
  },
  {
    reference: "APP-2026-0530",
    clientKey: "sinar-logistik",
    productId: "invoice-financing",
    stage: ApplicationStage.QUALIFIED,
    declaredAmount: 168_400,
    awardingBody: null,
    contractReference: null,
  },
  {
    reference: "APP-2026-0544",
    clientKey: "karya-muhibbah",
    productId: "pre-financing",
    stage: ApplicationStage.ENQUIRY,
    declaredAmount: 310_000,
    awardingBody: "Majlis Perbandaran Klang",
    contractReference: "MPK/2026/007",
  },
];

// Document fixtures for scenario 3 live in src/lib/fixtures.ts, imported above —
// the eval harness asserts against the same ground truth, so they cannot drift.

// ─────────────────────────────────────────────────────────────
// Scenario 5 — the access trace from slide 10
// ─────────────────────────────────────────────────────────────

const SECURITY_ACTOR = "Nurul Huda binti Ismail";
const SECURITY_ROLE = "Credit Operations Analyst";

interface SecuritySeed {
  action: string;
  ipAddress: string;
  geoLabel: string;
  deviceLabel: string;
  hour: number;
  minute: number;
  recordsTouched: number;
}

/**
 * A single working day. The first five rows establish the baseline the deck
 * describes (normal login, Kuala Lumpur); the last two are the deviation —
 * off-hours access from a foreign address followed by a bulk export.
 */
const SECURITY_TRACE: SecuritySeed[] = [
  {
    action: "Signed in",
    ipAddress: "203.0.113.17",
    geoLabel: "Kuala Lumpur, MY",
    deviceLabel: "Windows 11 · Edge",
    hour: 8,
    minute: 41,
    recordsTouched: 0,
  },
  {
    action: "Opened client file — Bina Harmoni Sdn Bhd",
    ipAddress: "203.0.113.17",
    geoLabel: "Kuala Lumpur, MY",
    deviceLabel: "Windows 11 · Edge",
    hour: 9,
    minute: 2,
    recordsTouched: 1,
  },
  {
    action: "Exported progress-claim report",
    ipAddress: "203.0.113.17",
    geoLabel: "Kuala Lumpur, MY",
    deviceLabel: "Windows 11 · Edge",
    hour: 9,
    minute: 37,
    recordsTouched: 12,
  },
  {
    action: "Opened client file — Tegas Elektrik Sdn Bhd",
    ipAddress: "203.0.113.17",
    geoLabel: "Kuala Lumpur, MY",
    deviceLabel: "Windows 11 · Edge",
    hour: 11,
    minute: 15,
    recordsTouched: 1,
  },
  {
    action: "Ran portfolio query — settlement ageing",
    ipAddress: "203.0.113.17",
    geoLabel: "Kuala Lumpur, MY",
    deviceLabel: "Windows 11 · Edge",
    hour: 13,
    minute: 52,
    recordsTouched: 340,
  },
  {
    action: "Signed in",
    ipAddress: "203.0.113.204",
    geoLabel: "Ho Chi Minh City, VN",
    deviceLabel: "Unrecognised device · Chrome",
    hour: 23,
    minute: 47,
    recordsTouched: 0,
  },
  {
    action: "Requested full client export",
    ipAddress: "203.0.113.204",
    geoLabel: "Ho Chi Minh City, VN",
    deviceLabel: "Unrecognised device · Chrome",
    hour: 23,
    minute: 49,
    recordsTouched: 4_120,
  },
];

// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("→ clearing existing demo fixtures");
  // Order matters: children before parents.
  await prisma.extractedField.deleteMany();
  await prisma.documentRecord.deleteMany();
  await prisma.application.deleteMany();
  await prisma.cashflowPoint.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.securityEvent.deleteMany();
  await prisma.creditHistory.deleteMany();
  await prisma.client.deleteMany();
  await prisma.product.deleteMany();
  await prisma.auditEntry.deleteMany();

  console.log(`→ seeding ${PRODUCTS.length} products`);
  for (const [index, p] of PRODUCTS.entries()) {
    await prisma.product.create({
      data: {
        id: p.id,
        name: p.name,
        category: p.category as ProductCategory,
        shortPitch: p.shortPitch,
        description: p.description,
        triggerSignals: p.triggerSignals,
        requiredDocs: p.requiredDocs,
        typicalTenor: p.typicalTenor,
        facilityRange: p.facilityRange,
        requiresAwardingBody: p.requiresAwardingBody,
        sortOrder: index,
      },
    });
  }

  console.log(`→ seeding ${CLIENTS.length} clients + credit history`);
  const clientIdByKey = new Map<string, string>();
  const observedTo = new Date("2026-07-31T00:00:00Z");
  for (const c of CLIENTS) {
    const observedFrom = new Date(observedTo);
    observedFrom.setMonth(observedFrom.getMonth() - c.relationshipMonths);

    const created = await prisma.client.create({
      data: {
        name: c.name,
        registrationNo: c.registrationNo,
        sector: c.sector,
        segment: c.segment,
        relationshipMonths: c.relationshipMonths,
        approvedLimitSen: sen(c.approvedLimit),
        isDemoFixture: true,
        creditHistory: {
          create: {
            transactionsObserved: c.history.transactionsObserved,
            totalDisbursedSen: sen(c.history.totalDisbursed),
            onTimeSettlementPct: c.history.onTimeSettlementPct,
            avgDaysToSettle: c.history.avgDaysToSettle,
            worstArrearsDays: c.history.worstArrearsDays,
            distinctCounterparties: c.history.distinctCounterparties,
            disputeRatePct: c.history.disputeRatePct,
            observedFrom,
            observedTo,
          },
        },
      },
    });
    clientIdByKey.set(c.key, created.id);
  }

  console.log("→ seeding cash-flow series (Sinar Logistik, 12 months)");
  const sinarId = clientIdByKey.get("sinar-logistik")!;
  for (const [monthIndex, [label, ringgit]] of CASHFLOW_RINGGIT.entries()) {
    await prisma.cashflowPoint.create({
      data: {
        clientId: sinarId,
        monthIndex,
        label,
        netPositionSen: sen(ringgit),
      },
    });
  }

  console.log(`→ seeding ${APPLICATIONS.length} applications`);
  const applicationIdByRef = new Map<string, string>();
  for (const a of APPLICATIONS) {
    const created = await prisma.application.create({
      data: {
        reference: a.reference,
        clientId: clientIdByKey.get(a.clientKey)!,
        productId: a.productId,
        stage: a.stage,
        source: LeadSource.SEEDED_HISTORICAL,
        declaredAmountSen: a.declaredAmount == null ? null : sen(a.declaredAmount),
        awardingBody: a.awardingBody,
        contractReference: a.contractReference,
        enquiryNote: a.enquiryNote ?? null,
      },
    });
    applicationIdByRef.set(a.reference, created.id);
  }

  console.log(`→ seeding ${DOCUMENT_FIXTURES.length} document fixtures`);
  for (const d of DOCUMENT_FIXTURES) {
    await prisma.documentRecord.create({
      data: {
        applicationId: applicationIdByRef.get(d.applicationReference)!,
        kind: d.kind as DocumentKind,
        label: d.label,
        assetPath: d.assetPath,
        mimeType: "image/png",
        isDeliberateMismatch: d.isDeliberateMismatch,
        verdict: ExtractionVerdict.PENDING,
      },
    });
  }

  console.log("→ seeding engagement campaign (detected, not sent)");
  await prisma.campaign.create({
    data: {
      clientId: sinarId,
      channel: CampaignChannel.WHATSAPP,
      status: CampaignStatus.DETECTED,
      triggerMonth: "Jul",
      triggerRationale:
        "Projected net working-capital position for July falls to RM 95,000 — 79% below the trailing six-month average of RM 452,000. The same trough appeared in the prior two years, so this is a seasonal pattern rather than a one-off.",
      offerHeadline: "Mid-month funding for July",
      offerBody:
        "Based on your haulage settlement pattern we have set aside a short-tenor invoice financing line for July. Draw what you need against invoices already issued, repay as your customers settle.",
      offerAmountSen: sen(350_000),
    },
  });

  console.log(`→ seeding ${SECURITY_TRACE.length} security events`);
  const tegasId = clientIdByKey.get("tegas-elektrik")!;
  for (const [index, e] of SECURITY_TRACE.entries()) {
    const occurredAt = new Date("2026-07-28T00:00:00Z");
    occurredAt.setUTCHours(e.hour, e.minute, 0, 0);
    await prisma.securityEvent.create({
      data: {
        clientId: e.recordsTouched === 1 ? tegasId : null,
        actor: SECURITY_ACTOR,
        actorRole: SECURITY_ROLE,
        action: e.action,
        ipAddress: e.ipAddress,
        geoLabel: e.geoLabel,
        deviceLabel: e.deviceLabel,
        occurredAt,
        // Severity, score and response are all computed by src/lib/sim/security.ts
        // at render time. The seed stores only the observed facts.
        severity: SecuritySeverity.BASELINE,
        response: SecurityResponse.NONE,
        recordsTouched: e.recordsTouched,
        sortOrder: index,
      },
    });
  }

  const counts = {
    products: await prisma.product.count(),
    clients: await prisma.client.count(),
    applications: await prisma.application.count(),
    documents: await prisma.documentRecord.count(),
    cashflowPoints: await prisma.cashflowPoint.count(),
    securityEvents: await prisma.securityEvent.count(),
    campaigns: await prisma.campaign.count(),
  };
  console.log("✓ seed complete", counts);
}

main()
  .catch((e) => {
    console.error("✗ seed failed");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
