"use client";

import { useEffect, useRef, useState } from "react";
import { Pill, GoldRule } from "./atoms";

/**
 * The client half of scenario 2. Consumes the SSE stream from /api/concierge and
 * renders the conversation plus the structured hand-off.
 *
 * Model output is rendered as PLAIN TEXT, never as HTML or markdown. The prompt
 * asks for prose without markup, but the renderer does not depend on that holding
 * — LLM output is untrusted input and gets no innerHTML path.
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface MatchPayload {
  product: {
    id: string;
    name: string;
    category: string;
    shortPitch: string;
    requiredDocs: string[];
    typicalTenor: string;
    facilityRange: string;
  };
  confidence: "high" | "medium" | "low";
  rationale: string;
  prefill: {
    awardingBody?: string | null;
    declaredAmountMyr?: number | null;
    contractReference?: string | null;
    stage?: string | null;
  };
  missing: string[];
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  model: string;
}

const OPENERS = [
  // The exact line printed on slide 6 of the brief.
  "I am bidding on a new government job.",
  "My buyer is on 90-day terms and I can't pay my supplier this month.",
  "We've just been awarded a JKR contract and need funds to mobilise.",
  "My customers keep asking for longer credit terms than I can afford to give.",
];

function newSessionId() {
  return `demo-${Math.random().toString(36).slice(2, 10)}`;
}

export function Concierge({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [match, setMatch] = useState<MatchPayload | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(newSessionId);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, partial]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setPartial("");
    setError(null);
    setStreaming(true);

    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, sessionId }),
      });

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => null);
        setError(
          payload?.message ??
            "The concierge is unavailable right now. Check the server log.",
        );
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      // Read until the stream closes, parsing complete `data:` frames.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          if (payload.type === "token" && typeof payload.text === "string") {
            assembled += payload.text;
            setPartial(assembled);
          } else if (payload.type === "match") {
            setMatch(payload as unknown as MatchPayload);
          } else if (payload.type === "done") {
            setUsage(payload.usage as Usage);
          } else if (payload.type === "error") {
            setError(String(payload.message ?? "Something went wrong."));
          }
        }
      }

      if (assembled.trim()) {
        setMessages([...next, { role: "assistant", content: assembled.trim() }]);
      }
      setPartial("");
    } catch {
      setError("The connection dropped mid-reply. Try again.");
    } finally {
      setStreaming(false);
    }
  }

  function reset() {
    setMessages([]);
    setPartial("");
    setMatch(null);
    setUsage(null);
    setError(null);
  }

  if (!configured) {
    return (
      <div className="pw-card rounded-xl p-6">
        <Pill tone="caution" dot>
          AI backend not configured
        </Pill>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-navy/85">
          This scenario makes a live Claude call, and no{" "}
          <code className="text-[13px]">ANTHROPIC_API_KEY</code> is set on the
          server — so rather than show a canned transcript pretending to be a
          model, it shows you this.
        </p>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
          Set the key and reload. The three simulated scenarios need no key and
          work as they are.
        </p>
      </div>
    );
  }

  const empty = messages.length === 0 && !partial;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ── Conversation ── */}
      <div className="pw-card flex flex-col overflow-hidden rounded-xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-navy-slate">
            Planworth concierge
          </span>
          <Pill tone="positive" dot>
            Live
          </Pill>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={reset}
              className="ml-auto text-[11px] font-semibold tracking-[0.12em] uppercase text-muted transition-colors hover:text-navy"
            >
              Reset
            </button>
          ) : null}
        </div>

        <div
          ref={scrollRef}
          className="flex max-h-[440px] min-h-[300px] flex-col gap-4 overflow-y-auto px-5 py-5"
        >
          {empty ? (
            <div>
              <p className="text-[14px] leading-relaxed text-muted">
                Type the situation the way a prospect would say it — not a product
                name. Or start with one of these:
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {OPENERS.map((o, i) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => send(o)}
                    className="rounded-lg border border-line bg-cream px-4 py-2.5 text-left text-[13.5px] leading-snug text-navy transition-colors hover:border-gold-deep hover:bg-paper"
                  >
                    &ldquo;{o}&rdquo;
                    {i === 0 ? (
                      <span className="mt-1 block text-[11px] text-muted-soft">
                        The example printed on slide 6 of the brief
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-navy px-4 py-2.5 text-[14px] leading-relaxed text-on-navy"
                    : "max-w-[92%] rounded-2xl rounded-bl-sm border border-line bg-cream px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-navy"
                }
              >
                {m.content}
              </div>
            </div>
          ))}

          {partial ? (
            <div className="flex justify-start">
              <div
                aria-live="polite"
                className="max-w-[92%] rounded-2xl rounded-bl-sm border border-line bg-cream px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-navy"
              >
                {partial}
                <span className="ml-0.5 inline-block h-[14px] w-[2px] animate-pulse bg-gold-deep align-middle" />
              </div>
            </div>
          ) : null}

          {streaming && !partial ? (
            <p className="text-[12.5px] text-muted-soft">Thinking…</p>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-verdict-halt/30 bg-cream px-4 py-3">
              <p className="text-[13px] leading-relaxed text-verdict-halt">{error}</p>
            </div>
          ) : null}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-end gap-2 border-t border-line px-4 py-3"
        >
          <label htmlFor="concierge-input" className="sr-only">
            Describe your financing situation
          </label>
          <textarea
            id="concierge-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={2}
            maxLength={1200}
            disabled={streaming}
            placeholder="e.g. We've won a supply contract but can't pay the supplier until we're paid…"
            className="min-h-[46px] flex-1 resize-none rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[14px] leading-snug text-navy placeholder:text-muted-soft focus:border-gold-deep focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={streaming || !draft.trim()}
            className="shrink-0 rounded-lg bg-navy px-5 py-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-on-navy transition-colors hover:bg-navy-soft disabled:opacity-40"
          >
            {streaming ? "…" : "Send"}
          </button>
        </form>
      </div>

      {/* ── Structured hand-off ── */}
      <div className="flex flex-col gap-4">
        <div className="pw-card rounded-xl p-5">
          <p className="pw-eyebrow">Structured hand-off</p>

          {match ? (
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill
                    tone={
                      match.confidence === "high"
                        ? "positive"
                        : match.confidence === "medium"
                          ? "gold"
                          : "caution"
                    }
                    dot
                  >
                    {match.confidence} confidence
                  </Pill>
                  <Pill tone="neutral">{match.product.id}</Pill>
                </div>
                <h3 className="pw-serif mt-3 text-[20px] leading-tight text-navy">
                  {match.product.name}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                  {match.product.shortPitch}
                </p>
              </div>

              <GoldRule />

              <div>
                <p className="pw-eyebrow">For the relationship manager</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-navy/85">
                  {match.rationale}
                </p>
              </div>

              <div>
                <p className="pw-eyebrow">Captured from the conversation</p>
                <dl className="mt-2.5 flex flex-col gap-2">
                  <PrefillRow
                    label="Awarding body / buyer"
                    value={match.prefill.awardingBody}
                  />
                  <PrefillRow
                    label="Contract / LO amount"
                    value={
                      match.prefill.declaredAmountMyr != null
                        ? `RM ${match.prefill.declaredAmountMyr.toLocaleString("en-MY")}`
                        : null
                    }
                  />
                  <PrefillRow
                    label="Contract reference"
                    value={match.prefill.contractReference}
                  />
                  <PrefillRow label="Stage" value={match.prefill.stage} />
                </dl>
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-soft">
                  Blank means the prospect has not said — the concierge is
                  instructed never to guess an amount, a buyer or a reference.
                </p>
              </div>

              {match.missing.length > 0 ? (
                <div>
                  <p className="pw-eyebrow">Still needed by underwriting</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {match.missing.map((m) => (
                      <li
                        key={m}
                        className="flex gap-2 text-[13px] leading-snug text-muted"
                      >
                        <span aria-hidden="true" className="text-navy-slate">
                          ·
                        </span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-lg border border-line bg-cream px-4 py-3">
                <p className="text-[12px] leading-relaxed text-muted">
                  <strong className="font-semibold text-navy">
                    Nothing has been written to a CRM.
                  </strong>{" "}
                  This is the payload that would be posted, shown rather than
                  saved — nothing a prospect types in a chat window has been
                  verified, and storing it as a qualified lead would misrepresent
                  it. In a live deployment this posts to Claritas only after the
                  identity behind it is confirmed.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
              Once the concierge settles on a facility, the structured hand-off
              appears here — product, reasoning, whatever it captured, and what
              underwriting still needs.
            </p>
          )}
        </div>

        {usage ? (
          <div className="rounded-xl border border-line bg-paper-warm px-5 py-4">
            <p className="pw-eyebrow">Last call</p>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Model</dt>
                <dd className="pw-num text-navy">{usage.model}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Latency</dt>
                <dd className="pw-num text-navy">
                  {(usage.latencyMs / 1000).toFixed(1)}s
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Input tokens</dt>
                <dd className="pw-num text-navy">
                  {usage.inputTokens.toLocaleString("en-MY")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Output tokens</dt>
                <dd className="pw-num text-navy">
                  {usage.outputTokens.toLocaleString("en-MY")}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted-soft">
              Every call is written to an append-only audit row with the prompt
              version, token counts, latency and cost — the trail an approval
              workflow needs.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PrefillRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-b-0">
      <dt className="shrink-0 text-[12px] text-muted">{label}</dt>
      <dd
        className={
          value
            ? "pw-num text-right text-[13px] font-semibold text-navy"
            : "text-right text-[12px] text-muted-soft"
        }
      >
        {value || "not stated"}
      </dd>
    </div>
  );
}
