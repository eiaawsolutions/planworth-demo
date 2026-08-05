/**
 * Reply inspector — `npm run eval:inspect [substring ...]`
 *
 * The harness truncates model replies to keep its output readable, which is fine
 * for pass/fail but useless when it flags something as "needs a human read". This
 * prints the FULL reply for matching golden-set openers and adversarial probes, so
 * a warning can actually be judged rather than guessed at.
 *
 * With no arguments it runs every case, which is expensive — pass a substring to
 * narrow it:
 *
 *   npm run eval:inspect "bidding on a new government"
 *   npm run eval:inspect "90-day terms" "JKR contract"
 *
 * Needs ANTHROPIC_API_KEY. Prints the structured match block separately from the
 * prose so you can see exactly what the relationship manager would receive.
 */

import Anthropic from "@anthropic-ai/sdk";
import { buildTriageSystemPrompt, extractMatch } from "../src/lib/prompts/triage";
import {
  TRIAGE_GOLDEN,
  INJECTION_PROBES,
  REVIEW_PATTERNS,
  reviewPatternFires,
} from "./cases/triage";

const MODEL = "claude-opus-5";

const key = process.env.ANTHROPIC_API_KEY;
if (!key || !key.trim()) {
  console.error(
    "ANTHROPIC_API_KEY is not set. This tool makes live model calls by design.",
  );
  process.exit(1);
}
const client = new Anthropic({ apiKey: key, maxRetries: 2, timeout: 120_000 });

const filters = process.argv.slice(2).map((s) => s.toLowerCase());
const matches = (text: string) =>
  filters.length === 0 || filters.some((f) => text.toLowerCase().includes(f));

interface Case {
  kind: "golden" | "probe";
  label: string;
  message: string;
  acceptable?: string[];
}

const cases: Case[] = [
  ...TRIAGE_GOLDEN.map(
    (c): Case => ({
      kind: "golden",
      label: c.opener,
      message: c.opener,
      acceptable: c.acceptable,
    }),
  ),
  ...INJECTION_PROBES.map(
    (p): Case => ({ kind: "probe", label: p.label, message: p.message }),
  ),
].filter((c) => matches(c.label) || matches(c.message));

if (cases.length === 0) {
  console.error(
    `No cases matched ${JSON.stringify(filters)}. Run with no arguments to list all.`,
  );
  process.exit(1);
}

const RULE = "─".repeat(72);

async function main() {
  const system = buildTriageSystemPrompt();
  console.log(`\nInspecting ${cases.length} case(s) on ${MODEL}\n`);

  for (const c of cases) {
    console.log(RULE);
    console.log(`[${c.kind}] ${c.label}`);
    if (c.acceptable) console.log(`acceptable: ${c.acceptable.join(", ")}`);
    console.log(RULE);
    console.log(`\n> ${c.message}\n`);

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8_000,
      system,
      messages: [{ role: "user", content: c.message }],
    });

    if (message.stop_reason === "refusal") {
      console.log("[model declined this request]\n");
      continue;
    }

    const block = message.content.find((b) => b.type === "text");
    const raw = block && block.type === "text" ? block.text : "";
    const { prose, match, malformed } = extractMatch(raw);

    console.log("── prose the prospect sees ──");
    console.log(prose || "(empty)");

    console.log("\n── structured hand-off ──");
    if (match) {
      console.log(JSON.stringify(match, null, 2));
      if (c.acceptable) {
        const hit = c.acceptable.includes(match.productId);
        console.log(
          `\nverdict: ${hit ? "MATCH" : "MISS"} (${match.productId} vs ${c.acceptable.join(" | ")})`,
        );
      }
    } else if (malformed) {
      console.log("(a match block was present but malformed)");
    } else {
      console.log(
        "(none — the model is still qualifying, so no product was tagged this turn)",
      );
    }

    const flagged = REVIEW_PATTERNS.filter((rp) => reviewPatternFires(rp, prose));
    if (flagged.length) {
      console.log(
        `\n── review patterns matched: ${flagged.map((f) => f.label).join(", ")} ──`,
      );
      for (const f of flagged) {
        const m = prose.match(f.pattern);
        if (m) console.log(`  ${f.label}: …${m[0]}…`);
      }
    }

    console.log(
      `\ntokens in/out: ${message.usage?.input_tokens ?? 0}/${message.usage?.output_tokens ?? 0}\n`,
    );
  }
  console.log(RULE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
