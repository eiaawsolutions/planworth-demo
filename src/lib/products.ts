/**
 * Planworth financing product catalogue.
 *
 * ⚠️ NEEDS CLIENT CONFIRMATION. The Intelligent Ecosystem deck states Planworth
 * offers "over 15 distinct, complex products" but never enumerates them. This
 * catalogue is assembled from Planworth's public product pages and the sibling
 * AI-integration proposal (which names invoice financing, PO financing, contract
 * progress claim financing, performance bonds and letters of undertaking
 * explicitly). Treat facility ranges and tenors as indicative placeholders until
 * Planworth confirms them — they are the most likely thing to be wrong here.
 *
 * This file is the single source of truth for both the database seed and the
 * grounding block in the triage system prompt, so the model can never be
 * grounded on a catalogue that has drifted from what the UI shows.
 */

export type ProductCategory =
  | "INVOICE_FINANCING"
  | "PO_FINANCING"
  | "CONTRACT_FINANCING"
  | "GUARANTEE"
  | "SUPPLY_CHAIN";

export interface ProductSeed {
  id: string;
  name: string;
  category: ProductCategory;
  shortPitch: string;
  description: string;
  /** Situations that point at this product — the model reasons over these. */
  triggerSignals: string[];
  requiredDocs: string[];
  typicalTenor: string;
  facilityRange: string;
  /** Only meaningful against a government / GLC award. */
  requiresAwardingBody: boolean;
}

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  INVOICE_FINANCING: "Invoice & receivables",
  PO_FINANCING: "Purchase order & pre-delivery",
  CONTRACT_FINANCING: "Contract & progress claims",
  GUARANTEE: "Bonds & guarantees",
  SUPPLY_CHAIN: "Supply chain",
};

export const PRODUCTS: ProductSeed[] = [
  // ── Invoice & receivables ──────────────────────────────────
  {
    id: "invoice-financing",
    name: "Invoice Financing",
    category: "INVOICE_FINANCING",
    shortPitch:
      "Draw against invoices you have already issued, instead of waiting out the payment term.",
    description:
      "Advance against verified, unpaid invoices raised on creditworthy buyers. The buyer settles on the original term; Planworth advances a percentage up front and releases the balance on settlement.",
    triggerSignals: [
      "already delivered and invoiced, waiting to be paid",
      "buyer is on 60 or 90 day terms",
      "cash is tied up in receivables",
      "need working capital against outstanding invoices",
    ],
    requiredDocs: [
      "Invoice(s)",
      "Delivery order / proof of delivery",
      "Buyer purchase order",
      "6 months bank statements",
    ],
    typicalTenor: "30 – 120 days, matched to the invoice term",
    facilityRange: "RM 50,000 – RM 10,000,000",
    requiresAwardingBody: false,
  },
  {
    id: "invoice-factoring-recourse",
    name: "Invoice Factoring (With Recourse)",
    category: "INVOICE_FINANCING",
    shortPitch:
      "Sell your receivables book to Planworth and hand over collection, while retaining the credit risk.",
    description:
      "A factoring facility where the receivable is assigned to Planworth, which then manages collection from the buyer. With recourse: if the buyer does not pay, the receivable reverts to the client.",
    triggerSignals: [
      "want someone else to chase collections",
      "recurring receivables from a stable buyer base",
      "prefer to assign the receivable rather than borrow against it",
    ],
    requiredDocs: [
      "Aged receivables listing",
      "Sample invoices and delivery orders",
      "Buyer list with terms",
      "Audited accounts (latest 2 years)",
    ],
    typicalTenor: "Revolving, reviewed annually",
    facilityRange: "RM 250,000 – RM 15,000,000",
    requiresAwardingBody: false,
  },
  {
    id: "progress-billing-discounting",
    name: "Progress Billing Discounting",
    category: "INVOICE_FINANCING",
    shortPitch:
      "Discount a certified progress bill the moment it is certified, not when it is finally paid.",
    description:
      "Short-tenor discounting against an interim bill that has been certified by the awarding party's consultant or quantity surveyor but not yet settled.",
    triggerSignals: [
      "progress bill has been certified but not paid",
      "consultant has signed off the claim",
      "waiting on an interim certificate to be honoured",
    ],
    requiredDocs: [
      "Certified interim bill",
      "Consultant / QS certificate",
      "Contract agreement",
    ],
    typicalTenor: "30 – 90 days",
    facilityRange: "RM 100,000 – RM 8,000,000",
    requiresAwardingBody: false,
  },

  // ── Purchase order & pre-delivery ──────────────────────────
  {
    id: "po-financing",
    name: "Purchase Order Financing",
    category: "PO_FINANCING",
    shortPitch:
      "Fund the cost of fulfilling a confirmed order before you have delivered anything.",
    description:
      "Financing released against a confirmed purchase order so the client can pay suppliers and fulfil the order. Repaid from the proceeds of the resulting invoice.",
    triggerSignals: [
      "won an order but cannot fund the supplier",
      "need to buy stock or materials to fulfil a confirmed PO",
      "order is bigger than our usual capacity",
      "supplier wants payment before we get paid",
    ],
    requiredDocs: [
      "Confirmed purchase order",
      "Supplier quotation or proforma invoice",
      "Company profile",
      "6 months bank statements",
    ],
    typicalTenor: "60 – 150 days",
    facilityRange: "RM 100,000 – RM 10,000,000",
    requiresAwardingBody: false,
  },
  {
    id: "pre-financing",
    name: "Pre-Financing (Mobilisation)",
    category: "PO_FINANCING",
    shortPitch:
      "Front-end funding to mobilise on a newly awarded contract before the first claim is certified.",
    description:
      "Working capital released at the very start of a contract — site setup, mobilisation, initial materials, early payroll — before any progress claim exists to finance against. Common on newly awarded government and GLC works, where mobilisation cost lands well before the first certified claim.",
    triggerSignals: [
      "bidding on or just awarded a new contract and need start-up funding",
      "need to mobilise on site before the first claim",
      "letter of award received, no claim certified yet",
      "tendering for a government job and worried about upfront cost",
      "awarded a government or GLC contract",
    ],
    requiredDocs: [
      "Letter of award or tender documents",
      "Contract sum breakdown",
      "Mobilisation cost schedule",
      "Company and directors' profile",
    ],
    typicalTenor: "3 – 12 months, aligned to the works programme",
    facilityRange: "RM 200,000 – RM 12,000,000",
    requiresAwardingBody: true,
  },
  {
    id: "supplier-payment-financing",
    name: "Supplier Payment Financing",
    category: "PO_FINANCING",
    shortPitch:
      "Planworth pays your supplier directly so you can extend your own payable term.",
    description:
      "Planworth settles the supplier invoice on the client's behalf at the due date, and the client repays Planworth on an extended term.",
    triggerSignals: [
      "supplier will not extend credit",
      "need to pay a supplier now and repay later",
      "want to stretch payables without straining the supplier relationship",
    ],
    requiredDocs: [
      "Supplier invoice",
      "Purchase order",
      "Supplier agreement or terms",
    ],
    typicalTenor: "60 – 180 days",
    facilityRange: "RM 100,000 – RM 6,000,000",
    requiresAwardingBody: false,
  },

  // ── Contract & progress claims ─────────────────────────────
  {
    id: "contract-progress-claim-financing",
    name: "Contract Progress Claim Financing",
    category: "CONTRACT_FINANCING",
    shortPitch:
      "Finance each certified progress claim across the life of a works contract.",
    description:
      "A revolving facility against successive certified progress claims on a construction, supply or services contract. The core product for government and GLC contractors on long works programmes.",
    triggerSignals: [
      "running a works contract with monthly progress claims",
      "claims are certified but payment takes too long",
      "need a rolling facility across the whole contract, not one invoice",
      "government contract with staged claims",
    ],
    requiredDocs: [
      "Contract agreement / letter of award",
      "Certified progress claims to date",
      "Works programme",
      "Latest audited accounts",
    ],
    typicalTenor: "Revolving over the contract period",
    facilityRange: "RM 250,000 – RM 20,000,000",
    requiresAwardingBody: true,
  },
  {
    id: "contract-financing-works",
    name: "Contract Financing (Works & Services)",
    category: "CONTRACT_FINANCING",
    shortPitch:
      "A single facility sized against the whole contract value rather than claim by claim.",
    description:
      "Term financing sized on the total contract value, drawn down against the works programme. Suits contractors who want one facility for the contract instead of managing claim-level advances.",
    triggerSignals: [
      "want one facility for the entire contract",
      "multi-year works or services contract",
      "prefer scheduled drawdowns over per-claim financing",
    ],
    requiredDocs: [
      "Contract agreement",
      "Contract sum and payment schedule",
      "Works programme",
      "Audited accounts (latest 2 years)",
    ],
    typicalTenor: "12 – 60 months",
    facilityRange: "RM 500,000 – RM 25,000,000",
    requiresAwardingBody: true,
  },
  {
    id: "retention-sum-financing",
    name: "Retention Sum Financing",
    category: "CONTRACT_FINANCING",
    shortPitch:
      "Release the retention held back on a completed contract instead of waiting out the defects period.",
    description:
      "Advance against retention monies withheld by the awarding party pending expiry of the defects liability period.",
    triggerSignals: [
      "retention is held until the defects period ends",
      "contract is practically complete but money is still withheld",
      "want to unlock retention sums across several finished jobs",
    ],
    requiredDocs: [
      "Certificate of practical completion",
      "Final account / retention statement",
      "Contract agreement",
    ],
    typicalTenor: "6 – 24 months",
    facilityRange: "RM 50,000 – RM 5,000,000",
    requiresAwardingBody: true,
  },
  {
    id: "variation-order-financing",
    name: "Variation Order Financing",
    category: "CONTRACT_FINANCING",
    shortPitch:
      "Fund approved additional scope that was never in your original cash-flow plan.",
    description:
      "Financing against approved variation orders — additional works instructed after the contract was priced, which typically must be executed before they can be claimed.",
    triggerSignals: [
      "client instructed extra work not in the original contract",
      "approved variation order we have to fund ourselves",
      "scope has grown but the contract sum has not been paid up",
    ],
    requiredDocs: [
      "Approved variation order",
      "Revised contract sum",
      "Consultant instruction",
    ],
    typicalTenor: "3 – 18 months",
    facilityRange: "RM 100,000 – RM 8,000,000",
    requiresAwardingBody: true,
  },

  // ── Bonds & guarantees ─────────────────────────────────────
  {
    id: "performance-bond",
    name: "Performance Bond",
    category: "GUARANTEE",
    shortPitch:
      "The security your awarding party requires before letting you start.",
    description:
      "A bond issued in favour of the awarding party guaranteeing the contractor's performance, typically 5% of contract value. Usually a condition precedent to signing.",
    triggerSignals: [
      "awarding party demands a performance bond before signing",
      "need 5 percent bond to accept the award",
      "cannot tie up cash in a bank-issued bond",
    ],
    requiredDocs: [
      "Letter of award",
      "Bond format required by the awarding party",
      "Company and directors' profile",
    ],
    typicalTenor: "Contract period plus defects liability",
    facilityRange: "RM 50,000 – RM 10,000,000",
    requiresAwardingBody: true,
  },
  {
    id: "letter-of-undertaking",
    name: "Letter of Undertaking",
    category: "GUARANTEE",
    shortPitch:
      "A written undertaking from Planworth that satisfies an awarding party or supplier that funding is in place.",
    description:
      "An undertaking issued to an awarding party, principal or supplier confirming Planworth will fund the client's obligation on agreed terms. Frequently used at the tender and pre-award stage, where a bidder must evidence financial capacity before any contract exists to finance against.",
    triggerSignals: [
      "tender requires proof of financial capacity",
      "bidding for a job and need to show funding is arranged",
      "awarding body wants written confirmation of financing",
      "supplier wants assurance before releasing goods",
      "need a letter confirming funds for a government submission",
    ],
    requiredDocs: [
      "Tender or award documents",
      "Scope and value of the obligation",
      "Company profile",
    ],
    typicalTenor: "Matched to the underlying obligation",
    facilityRange: "Sized to the obligation",
    requiresAwardingBody: true,
  },
  {
    id: "advance-payment-guarantee",
    name: "Advance Payment Guarantee",
    category: "GUARANTEE",
    shortPitch:
      "Unlock the advance payment your contract allows by guaranteeing its proper use.",
    description:
      "A guarantee issued to the awarding party securing an advance payment made to the contractor, so that advance can be released early in the contract.",
    triggerSignals: [
      "contract allows an advance payment but requires a guarantee",
      "want to draw the mobilisation advance in the contract",
    ],
    requiredDocs: [
      "Contract clause permitting the advance",
      "Letter of award",
      "Required guarantee format",
    ],
    typicalTenor: "Until the advance is fully recouped",
    facilityRange: "RM 50,000 – RM 8,000,000",
    requiresAwardingBody: true,
  },
  {
    id: "tender-bond",
    name: "Tender / Bid Bond",
    category: "GUARANTEE",
    shortPitch: "The bond you need in hand to submit the bid at all.",
    description:
      "A bond issued in favour of the awarding party at tender submission, guaranteeing the bidder will honour its bid if selected. Released when the tender is decided.",
    triggerSignals: [
      "tender submission requires a bid bond",
      "need a bond just to enter the tender",
      "closing date is near and the bond is not in place",
    ],
    requiredDocs: [
      "Tender documents",
      "Bond format and validity required",
      "Company profile",
    ],
    typicalTenor: "Tender validity period",
    facilityRange: "RM 20,000 – RM 3,000,000",
    requiresAwardingBody: true,
  },

  // ── Supply chain ───────────────────────────────────────────
  {
    id: "buyer-finance",
    name: "Buyer Finance",
    category: "SUPPLY_CHAIN",
    shortPitch:
      "Let your customers buy on longer terms without your own cash flow absorbing it.",
    description:
      "Planworth finances the client's buyers so the client is paid at delivery while the buyer settles on an extended term. Used to win volume without carrying the receivable.",
    triggerSignals: [
      "customers are asking for longer credit terms",
      "want to offer terms without funding them ourselves",
      "losing orders because competitors give better terms",
    ],
    requiredDocs: [
      "Buyer list and trading history",
      "Sample invoices",
      "Standard terms of sale",
    ],
    typicalTenor: "Revolving, buyer terms up to 120 days",
    facilityRange: "RM 500,000 – RM 20,000,000",
    requiresAwardingBody: false,
  },
  {
    id: "supply-chain-financing",
    name: "Supply Chain Financing (Payables)",
    category: "SUPPLY_CHAIN",
    shortPitch:
      "A programme that pays your whole supplier base early while you keep your own term.",
    description:
      "An anchor-led payables programme: Planworth settles approved supplier invoices early at a discount, and the anchor buyer repays at its normal term. Suits larger corporates and GLCs with a broad supplier base.",
    triggerSignals: [
      "many suppliers asking to be paid earlier",
      "want a programme rather than one-off financing",
      "large organisation looking to support its supplier base",
      "anchor buyer with a long payables tail",
    ],
    requiredDocs: [
      "Supplier master list",
      "Payables ageing",
      "Approved payables process documentation",
      "Audited accounts",
    ],
    typicalTenor: "Revolving programme, annual review",
    facilityRange: "RM 2,000,000 upwards",
    requiresAwardingBody: false,
  },
];

/** Deck claim: "over 15 distinct, complex products". */
export const PRODUCT_COUNT = PRODUCTS.length;

export function findProduct(id: string): ProductSeed | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/**
 * The grounding block injected into the triage system prompt. Generated from the
 * same array the UI and database use, so the model can never be grounded on a
 * catalogue that has drifted out of sync.
 */
export function productCatalogueForPrompt(): string {
  return PRODUCTS.map((p) =>
    [
      `### ${p.name}`,
      `id: ${p.id}`,
      `category: ${CATEGORY_LABEL[p.category]}`,
      `what it is: ${p.description}`,
      `indicative tenor: ${p.typicalTenor}`,
      `indicative facility: ${p.facilityRange}`,
      p.requiresAwardingBody
        ? `requires an awarding body / contract award: yes`
        : `requires an awarding body / contract award: no`,
      `points at this product when: ${p.triggerSignals.join("; ")}`,
      `documents underwriting will ask for: ${p.requiredDocs.join(", ")}`,
    ].join("\n"),
  ).join("\n\n");
}
