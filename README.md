# Planworth Intelligent Ecosystem — demo

A working preview of the five AI scenarios in **The Intelligent Ecosystem**, the
strategic implementation brief prepared for **Planworth Global Factoring Sdn Bhd**
(Integrated Marketing & CRM System). Built by EIAAW Solutions.

The brief sells five capabilities layered on top of the proposed Claritas CRM.
This app makes them clickable — and is explicit about which of them are real.

---

## The one thing to understand first

**Two of the five scenarios call Claude for real. Three are deterministic
simulations. Every page says which, and why.**

| # | Scenario | Route | Status |
| --- | --- | --- | --- |
| 1 | Hyper-Personalised Omni-Channel Engagement | `/scenario/engagement` | Simulated |
| 2 | Conversational AI for Instant Solution Matching | `/scenario/triage` | **Live Claude** |
| 3 | Intelligent Document Processing | `/scenario/idp` | **Live Claude** |
| 4 | Dynamic Credit & Risk Scoring | `/scenario/risk` | Simulated |
| 5 | Adaptive Security & Threat Prevention | `/scenario/security` | Simulated |

Scenarios 1, 4 and 5 all depend on Planworth's own history — the brief cites
RM 4 billion disbursed across 40,000+ transactions — which has not been provided.
Rather than fake a trained model, each runs an explicit formula in `src/lib/sim/`
and **returns its reasoning alongside its result**, so the UI can show the working.
The mechanism is demonstrable; the intelligence is the part that arrives with the
data.

Scenario 5 deserves a specific note: the brief frames it as *behavioural
biometrics* on staff. This demo collects nothing and profiles nobody. Real
behavioural monitoring of employees engages the PDPA and would need a lawful
basis, an impact assessment and staff notification first. Do not present it as
live monitoring.

Every client, contract, figure and document is a fictional fixture.
`Client.isDemoFixture` is `true` everywhere and the seed never sets it false.

---

## Running it

Prerequisites: Node 20.9+, Docker (for the local database).

```bash
# 1. Dependencies
npm install

# 2. A local Postgres on 5434 (5432/5433 are usually taken by other projects)
docker run -d --name planworth-demo-db \
  -e POSTGRES_USER=planworth \
  -e POSTGRES_PASSWORD=planworth_demo_pw \
  -e POSTGRES_DB=planworth_demo \
  -p 5434:5432 --restart unless-stopped postgres:17-alpine

# 3. Environment — copy the template, then see "Secrets" below
cp .env.example .env

# 4. Schema + fixtures
npx prisma migrate dev
npm run db:seed

# 5. Go
npm run dev
```

Without an `ANTHROPIC_API_KEY` the app runs fine: the three simulated scenarios
are fully functional, and the two live ones render an honest *"AI backend not
configured"* state rather than a canned transcript dressed up as a model.

To exercise the live scenarios, put a key in your shell and restart:

```powershell
$env:ANTHROPIC_API_KEY = "<value>"; npm run dev
```

### Regenerating the document fixtures

The five pages the IDP scenario reads are generated, not committed by hand:

```bash
powershell -ExecutionPolicy Bypass -File scripts/generate-fixtures.ps1
```

They are deliberately rendered as page **images** — one of them skewed, grainy and
contrast-crushed — because the brief frames scenario 3 as OCR and NLP. Extracting
from a clean digital PDF's text layer would not demonstrate that.

---

## Verifying it

```bash
npm run eval                                  # the harness described below
npm run eval:inspect "some opener substring"   # full replies for flagged cases
npm run lint
npm run typecheck
npm run build
```

`npm run eval` has two halves.

**Part A — deterministic, no key, no cost. 62 checks.** Money handling, the
product catalogue, match-block parsing, the reconciliation rules, all three
simulations, and WCAG contrast for every colour pair actually used (read from
`globals.css`, so a palette tweak that drops text below 4.5:1 fails a check). This
is the half that catches the expensive bugs: a wrong *"Anomaly free"* verdict, a
scorecard whose weights stop summing to 100.

**Part B — live model, needs `ANTHROPIC_API_KEY` and spends money. 48 checks.** A
12-case triage golden set, five adversarial probes (prompt extraction, authority
spoofing, pricing extraction, role reset, invented product), and document
extraction against ground truth for all five fixtures. When no key is present it
**skips loudly** rather than passing quietly.

### Last recorded full run

`110 passed · 0 failed · 0 to review · 0 skipped` on `claude-opus-5`.

- All 12 golden-set openers matched an acceptable product on the **first turn**.
- All 5 adversarial probes held: no prompt leakage, no approval or pre-approval
  claim, no rate quoted, no role reset, no invented product.
- All 5 document fixtures extracted correctly on every field — including the
  degraded scan, which read `742,500.00` and was **not** silently corrected to the
  declared `724,500.00`, and both buyer-issued documents, which got issuer and
  counterparty the right way round.

Part B calls the model directly, so it measures prompt quality rather than
transport. The routes' sentinel stripping and rate limiting are **not** covered by
it — that gap is real and worth closing with an integration test against a running
server.

When the harness flags something as *"needs a human read"*, use
`npm run eval:inspect "<substring>"` to print the full reply and the structured
hand-off. Judging a warning from a 120-character truncation is guessing.

---

## How it is put together

```text
src/
  app/
    page.tsx                    overview — slides 1, 2, 3, 11, 13
    architecture/               slide 12, plus what this demo does NOT have
    scenario/<slug>/            one page per scenario
    error.tsx                   last-resort boundary (no stack traces on screen)
    api/concierge/route.ts      scenario 2 — SSE stream
    api/extract/route.ts        scenario 3 — vision + structured output
    api/audit/route.ts          read-only audit rows, scoped to one session
    api/health/route.ts         Railway healthcheck + "app or environment?"
  lib/
    load.ts                    tryLoad() — a dead DB degrades, never blank-pages
    scenarios.ts               the five scenarios as data, incl. real/simulated
    products.ts                the 16-product catalogue (ONE source of truth:
                               seed, UI and prompt grounding all read it)
    fixtures.ts                the document set + ground truth (seed + evals)
    prompts/                   versioned system prompts
    reconcile.ts               extraction vs CRM — verdict logic
    sim/                       the three deterministic simulations
    anthropic.ts               the only place the API key is read
    secrets.ts                 Infisical resolver
    rate-limit.ts              in-memory per-IP ceiling
```

Design tokens live in `src/app/globals.css`, sampled from the deck's own slides.
**One colour rule:** gold measures 1.9:1 on cream and gold-deep 2.6:1, so on cream
gold is decoration only — hairlines, rules, borders, bar fills. Text and numerals
use navy or navy-slate. Gold is text only on navy. The eval harness reads those
very tokens and asserts it.

### Notable decisions

- **Nothing is written to a CRM from the concierge.** It produces the structured
  hand-off payload and displays it. Nothing a prospect types in a chat window has
  been verified, and storing it as a qualified lead would misrepresent it — the
  EIAAW lead-generation contract requires a server-side verification gate before
  any real prospect is persisted, and this demo has none.
- **The verdict is computed in application code, never by the model.** The
  extractor reads fields; `reconcile.ts` decides. A model that both extracts and
  judges can talk itself into agreeing with the file.
- **The extractor is told not to correct what it reads.** The mismatch fixture is a
  digit transposition (742,500 on the page vs 724,500 declared). An extractor that
  helpfully "fixes" the figure hides exactly the discrepancy the scenario exists
  to catch.
- **Both document parties are extracted, not one.** A purchase order is issued by
  the buyer and a letter of award by the awarding body, so a fixed-side comparison
  flags valid documents as mismatches. Two of the five fixtures are buyer-issued
  specifically to keep that path tested.
- **Audit before inference.** Both live routes write an `AuditEntry` *before* a
  token is generated. If the audit write fails the model is not called — an
  unlogged invocation is worse than a failed one here. `/api/audit` then makes
  those rows readable, **scoped to one session and required to be**: this app is
  unauthenticated and shared by link, so an unfiltered endpoint would let any
  visitor enumerate every other visitor's session. Digests only — the rows never
  contained prompt or reply text.
- **A dead database degrades; it never blank-pages.** The four DB-backed scenario
  pages wrap their reads in `tryLoad()` and render a composed panel instead of
  throwing. Verified by actually stopping the database: all four returned 200 with
  the panel, `/api/health` returned 503, and the three pages that need no database
  were unaffected.
- **No developer instructions in client-facing copy.** Nobody in the room has a
  terminal, so an empty environment explains itself in plain language rather than
  telling a CTO to run a seed script.

---

## Secrets

Per the EIAAW deploy contract, `.env.example` ships with `secret://` Infisical
handles, not raw-value placeholders. The only raw secrets that belong in any
environment are the three `INFISICAL_*` bootstrap credentials; everything else is
a handle resolved at runtime by `src/lib/secrets.ts`.

Local dev runs with the resolver **off** (`INFISICAL_RESOLVER_ENABLED=false`) and
takes `ANTHROPIC_API_KEY` from the shell. Nothing in this repository should ever
contain a resolved secret value.

---

## Deploying

Railway, Nixpacks. `railway.json` holds the build and start commands;
`nixpacks.toml` overrides only the install phase — it forces `npm install` over
`npm ci` because the lockfile is authored on Windows and omits Linux-only optional
native dependencies that Tailwind's oxide pulls in. Removing that file will break
the build on Railway.

`healthcheckPath` points at `/api/health`, which returns 200 while the database
answers and 503 when it does not. Note what it deliberately does **not** treat as
unhealthy: a missing `ANTHROPIC_API_KEY`. The three simulated scenarios work
without one and the two live ones say so honestly, so the process is fine and
Railway should keep it in rotation. It reports capability (`db`, `ai`,
`secretMode`) and never a configuration value.

Attach the Postgres plugin and reference it as `${{Postgres.DATABASE_URL}}`.
`npm run start` runs `prisma migrate deploy` before `next start`, so the schema is
applied on deploy. The seed is **not** run automatically — run `npm run db:seed`
once against the deployed database.

---

## Known limitations

Stated here rather than discovered later. `/architecture` carries the full list.

- **No Claritas CRM connection.** Every record is a local fixture.
- **No WhatsApp Business API.** Scenario 1 drafts a message and stops. It has no
  channel and no consent record to send against.
- **Rate limiting is in-process memory.** It resets on deploy and does not
  coordinate across instances. Production wants Redis or the platform limiter.
- **The product catalogue needs Planworth's confirmation.** The brief says "over 15
  distinct, complex products" without listing them, so the 16 here are assembled
  from public material. The tenors and facility ranges are indicative placeholders
  and are the most likely thing in this repo to be wrong.
- **No PDPA data-residency controls.** Model calls leave Malaysia. A regulated
  deployment needs that assessed and, if required, region-pinned inference.
- **No human approval queue.** The scenarios show what would be routed for
  sign-off; the queue that holds it does not exist here.
- **The routes themselves are not integration-tested.** Part B exercises the
  prompts by calling the model directly. The SSE sentinel stripping in
  `/api/concierge`, the rate limiter, and the audit-before-inference guard are
  covered by reading the code, not by a test against a running server.
- **`package.json#prisma` deprecation warning.** Prisma 6 accepts the `seed` hook
  there; Prisma 7 will want `prisma.config.ts`. Harmless until that upgrade.
- **No visual regression coverage.** Layout was verified structurally (every wide
  element sits inside an `overflow-x-auto` container) but never screenshotted at
  mobile, tablet and desktop widths.
- **Not deployed.** No Railway project, URL or service name exists yet, so nothing
  here has run anywhere but localhost. Record all three in this file once it does.
- **The seed is not run on deploy.** `npm run start` runs `prisma migrate deploy`
  only. A freshly provisioned environment starts empty — which now degrades
  gracefully rather than crashing, but still shows nothing until seeded once.
- **The source deck is not in the repo.** The UI cites slides 5, 6, 8, 10, 11 and
  12 of `Planworth_Intelligent_Ecosystem.pptx`, which lives outside this directory.
  A future maintainer cannot check a single citation. Committing a client's deck may
  not be appropriate, but its path and date should be recorded somewhere.
- **The lockfile is authored on Windows.** `nixpacks.toml` therefore uses
  `npm install` rather than `npm ci`, which means the lockfile is not authoritative
  on Railway's Linux builder: a build that succeeds today could resolve different
  patch versions later. Survivable for a demo, but it is the one non-deterministic
  step in the deploy.
- **No spend cap.** The in-memory rate limiter resets on deploy, so the only real
  ceiling on a public URL is the Anthropic account's own. Worth a daily cap before
  the link is shared widely.
- **Cost constants are hardcoded.** `src/lib/anthropic.ts` carries USD 5/25 per
  MTok for the display-only cost figure. Harmless, but it will silently drift.
- **Human-in-the-loop is asserted, not actionable.** The scenarios correctly say
  nothing is sent and nothing is written to a CRM, but there is no approve / amend /
  reject control that records a decision into the audit trail. That is the natural
  next feature, and the audit surface now exists to hold it.
- **The demo dead-ends.** There is no outbound call to action — no way for a viewer
  to reach the EIAAW deal owner from inside the app. Deliberately *not* a lead
  capture form: the EIAAW lead-generation contract requires a server-side
  verification gate before any prospect is persisted, and this app has none. A
  `mailto:` or a tagged link out is the whole of the fix.
- **No presenter walkthrough.** Five scenarios across five routes with only
  prev/next links means the presenter improvises and a client clicking through
  alone afterwards has no guided order.

### One thing to raise with Planworth

The brief's slide 6 shows *"I am bidding on a new government job"* resolving to
**Pre-Financing or a Letter of Undertaking**. Run live, the concierge answers
**Tender / Bid Bond** — which is arguably more correct, because at genuine
bid-submission stage a bid bond is what you need to submit at all; pre-financing
and a letter of undertaking both sit closer to award. The golden set accepts all
three.

This is worth clarifying rather than papering over: if "bidding" in the brief means
*pursuing or newly awarded*, the deck is right and the catalogue's trigger signals
should say so. If it means *at tender submission*, the deck's own example is
slightly off. A five-minute question in discovery settles it.

---

Prepared by Claritas Consulting (asia) Sdn Bhd. Confidential — not for distribution.
