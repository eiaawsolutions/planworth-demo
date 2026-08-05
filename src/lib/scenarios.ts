/**
 * The five scenarios from Planworth_Intelligent_Ecosystem.pptx, as data.
 *
 * `context` and `aiScenario` are paraphrased from each slide's own two-part
 * framing ("The Context" / "The AI Scenario"). `delta` reproduces that
 * scenario's row from the Operational Delta table on slide 11.
 *
 * `mode` is load-bearing, not decorative: "real" means a Claude call actually
 * happens, "simulated" means a deterministic function in src/lib/sim/ produces
 * the result. The shell renders a different ribbon for each and the hub sorts
 * them, so mislabelling one here mislabels it everywhere.
 */

export type ScenarioMode = "real" | "simulated";

export interface Scenario {
  slug: string;
  /** Position in the deck's own numbering (slides 5, 6, 8, 9, 10). */
  number: 1 | 2 | 3 | 4 | 5;
  pillar: 1 | 2;
  pillarLabel: string;
  title: string;
  /** The one-line promise, close to the slide's subtitle. */
  promise: string;
  context: string;
  aiScenario: string;
  mode: ScenarioMode;
  /** Why it is real, or what a real version would need. */
  modeNote: string;
  /** Slide 11's Operational Delta row. */
  delta: {
    dimension: string;
    standard: string;
    enhanced: string;
  };
}

export const PILLAR_1_LABEL = "Pillar 1 · Building a competitive edge";
export const PILLAR_2_LABEL = "Pillar 2 · Optimising day-to-day workflows";

export const SCENARIOS: Scenario[] = [
  {
    slug: "engagement",
    number: 1,
    pillar: 1,
    pillarLabel: PILLAR_1_LABEL,
    title: "Hyper-Personalised Omni-Channel Engagement",
    promise: "Reach the client before they know they need you.",
    context:
      "Claritas already unifies voice, chat, web, social, email and SMS with analytics. That gives a complete record of what a client has done — but not of what they are about to need.",
    aiScenario:
      "Read the client's seasonal working-capital pattern, find the month where the position drops below what their obligations require, and put a pre-approved offer in front of them on the channel they actually reply on.",
    mode: "simulated",
    modeNote:
      "A real forecaster would be trained on Planworth's settlement and interaction history. This demo runs a transparent gap-detection rule over a seeded twelve-month series and shows the arithmetic behind every step.",
    delta: {
      dimension: "Lead nurturing",
      standard: "Manual analysis and reactive marketing campaigns.",
      enhanced: "Predictive triggers anticipating cash-flow gaps.",
    },
  },
  {
    slug: "triage",
    number: 2,
    pillar: 1,
    pillarLabel: PILLAR_1_LABEL,
    title: "Conversational AI for Instant Solution Matching",
    promise: "Sixteen products, one conversation, no manual sorting.",
    context:
      "Planworth's catalogue spans invoice, purchase-order, contract, bond and supply-chain facilities. A prospect who does not already know the product names has to guess which door to knock on — and a mis-routed enquiry costs days.",
    aiScenario:
      "An assistant that asks the two or three qualifying questions a relationship manager would ask, resolves the right facility from the full catalogue, and hands over a structured, product-tagged application instead of an unclassified enquiry.",
    mode: "real",
    modeNote:
      "This is a live Claude call, streamed, grounded on the same product catalogue the rest of the app uses. The conversation and the product match are genuinely model-produced.",
    delta: {
      dimension: "Solution triage",
      standard: "Human routing and manual context gathering.",
      enhanced: "Instant conversational matching across the full catalogue.",
    },
  },
  {
    slug: "idp",
    number: 3,
    pillar: 2,
    pillarLabel: PILLAR_2_LABEL,
    title: "Intelligent Document Processing",
    promise: "Read the claim, check it against the file, flag what disagrees.",
    context:
      "Every Planworth product is triggered by a paper artefact — an invoice, a purchase order, a certified progress claim — and the business promises fast approval. Each artefact has to be read, checked and keyed inside that window.",
    aiScenario:
      "Extract the key fields from the document as submitted, cross-reference them against the figures already in the CRM, and put a reconciled file in front of the analyst — with any disagreement surfaced before they open it.",
    mode: "real",
    modeNote:
      "A live Claude call reads the actual document image, including a deliberately degraded scan. The extraction and the reconciliation verdict are genuinely model-produced; only the documents themselves are fixtures.",
    delta: {
      dimension: "Document processing",
      standard: "Manual data entry and cross-referencing.",
      enhanced: "Instant extraction with automatic anomaly flagging.",
    },
  },
  {
    slug: "risk",
    number: 4,
    pillar: 2,
    pillarLabel: PILLAR_2_LABEL,
    title: "Dynamic Credit & Risk Scoring",
    promise: "Move from a limit reviewed annually to one that keeps up.",
    context:
      "Planworth's book records how thousands of clients have actually behaved — how promptly they settle, how often a claim is disputed, how concentrated their buyers are. A static limit reviewed once a year cannot use any of it.",
    aiScenario:
      "Score each client continuously against their own repayment record, and let a consistently strong performer's facility rise without waiting for the next review cycle.",
    mode: "simulated",
    modeNote:
      "The deck's ML core would be trained on Planworth's 40,000+ transaction history, which has not been provided. This demo uses an explicit seven-factor scorecard with fixed weights, and lists every contribution — so what you see is a formula, not inference dressed up as one.",
    delta: {
      dimension: "Risk management",
      standard: "Static credit limits reviewed periodically.",
      enhanced: "Dynamic profiling that keeps the risk dial current.",
    },
  },
  {
    slug: "security",
    number: 5,
    pillar: 2,
    pillarLabel: PILLAR_2_LABEL,
    title: "Adaptive Security & Threat Prevention",
    promise: "Know what normal looks like, so the abnormal is obvious.",
    context:
      "Planworth holds commercially sensitive positions for thousands of Malaysian businesses, and states data integrity and client confidentiality as a first-order commitment. Static access rules cannot tell a legitimate late-night export from an exfiltration attempt.",
    aiScenario:
      "Establish what an individual's normal access pattern looks like, score each action against it, and respond proportionately — challenge, throttle, or lock the session.",
    mode: "simulated",
    modeNote:
      "The brief frames this as behavioural biometrics on staff. This demo collects nothing and profiles nobody: it scores a seeded access log with fixed arithmetic. Real behavioural monitoring of employees would need a PDPA assessment, a lawful basis and staff notification first.",
    delta: {
      dimension: "Threat prevention",
      standard: "Static security rules and access controls.",
      enhanced: "Behavioural baselines with context-aware session locking.",
    },
  },
];

export function scenarioBySlug(slug: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.slug === slug);
}

export const REAL_SCENARIOS = SCENARIOS.filter((s) => s.mode === "real");
export const SIMULATED_SCENARIOS = SCENARIOS.filter((s) => s.mode === "simulated");
