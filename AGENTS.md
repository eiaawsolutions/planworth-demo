<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Planworth Intelligent Ecosystem — demo

A prospect demo for **Planworth Global Factoring Sdn Bhd**, built from
`Planworth_Intelligent_Ecosystem.pptx` (13 slides, "Strategic Implementation
Brief: Integrated Marketing & CRM System"). It demonstrates the five AI
scenarios that deck sells, as an AI layer sitting beside Claritas CRM.

## The one rule that matters most

**Two of the five scenarios are real. Three are simulations, and the UI says so.**

| Scenario | Route | Status |
|---|---|---|
| Hyper-Personalized Omni-Channel Engagement | `/scenario/engagement` | Simulated |
| Conversational AI for Instant Solution Matching | `/scenario/triage` | **Real Claude** (streaming) |
| Intelligent Document Processing | `/scenario/idp` | **Real Claude** (extraction) |
| Dynamic Credit & Risk Scoring | `/scenario/risk` | Simulated |
| Adaptive AI Security & Threat Prevention | `/scenario/security` | Simulated |

Engagement, risk and security all depend on Planworth's historical dataset
(the deck cites RM4bn disbursed across 40,000+ transactions), which we do not
have. They are implemented as **transparent deterministic functions in
`src/lib/sim/` that return their result together with the reasoning behind
it**, so the mechanism is demonstrable without pretending a model was trained.

Never relabel a simulated surface as real, never hide the disclaimer, and never
add a fake confidence score to make a simulation look like inference. Scenario 5
in particular must not imply that real behavioural biometrics are being
collected from staff — that is the deck's claim, and it is PDPA-sensitive.

## Data

Every seeded record is a fictional fixture flagged `isDemoFixture: true`.
There are no live client records in this project and none may be added: the
EIAAW lead-generation contract requires a server-side verification gate before
any real prospect is stored, and this demo has no such gate.

## Conventions

- Server-only secrets go through `src/lib/secrets.ts` → `src/lib/anthropic.ts`.
  `getAnthropic()` is the single place the API key is read. Never import the
  Anthropic SDK directly in a component.
- The CSP in `next.config.ts` sets `connect-src 'self'` — the browser can never
  reach `api.anthropic.com`. All model traffic proxies through a route handler.
- `font-src 'self' data:` — fonts must be self-hosted. Use `next/font/google`,
  which downloads at build time; do not add a `<link>` to fonts.googleapis.com.
- Design tokens live in `src/app/globals.css` under `@theme inline`. Colours are
  sampled from the deck itself; do not invent new brand colours.
- Every page sets `robots: "noindex, nofollow"` in its `metadata`.
