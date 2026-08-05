/* ══════════════════════════════════════════════════════════════
   Shared primitives.

   Ported from the sibling Claritas × Bank Muamalat demo and recoloured to the
   Planworth palette. One rule carried over from globals.css: gold is decoration
   on cream, never text. So where a ring stroke or a rule is gold, the numeral or
   label beside it stays navy.

   Deliberately NOT a client module: none of these need state or effects, so
   keeping them server-renderable means a server component can use them without
   opening a client boundary. Both the concierge and the document inspector
   import them from inside their own client components, which works either way.
   ══════════════════════════════════════════════════════════════ */

/* ── Score ring ───────────────────────────────────────────────
   Slide 9's risk dial. The stroke colour carries the band; the numeral is
   always navy so it never fails contrast on cream.                          */

export function ScoreRing({
  score,
  size = 132,
  stroke = 7,
  strokeColor = "#bfa373",
  caption,
}: {
  score: number;
  size?: number;
  stroke?: number;
  strokeColor?: string;
  caption?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, score)) / 100) * c;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score ${score} out of 100${caption ? `, ${caption}` : ""}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(11,27,50,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="pw-serif pw-num text-navy"
          style={{ fontSize: size * 0.32, lineHeight: 1, fontWeight: 500 }}
        >
          {score}
        </span>
        {caption ? (
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-slate">
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ── Panel label ──────────────────────────────────────────────
   The step-number-plus-title pairing used at the head of each panel.        */

export function PanelLabel({
  step,
  title,
  className = "",
}: {
  step: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-3 ${className}`}>
      <span className="pw-serif text-[15px] leading-none text-navy-slate italic">
        {step}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-navy-slate">
        {title}
      </span>
    </div>
  );
}

/* ── Pills ────────────────────────────────────────────────────
   All four variants are AA-safe on cream: the tint is a low-alpha wash and the
   text is a full-strength ink, never the gold.                              */

export type PillTone = "neutral" | "positive" | "caution" | "critical" | "gold";

const PILL_TONE: Record<PillTone, { text: string; wash: string; ring: string }> = {
  neutral: {
    text: "#2e3548",
    wash: "rgba(46,53,72,0.08)",
    ring: "rgba(46,53,72,0.24)",
  },
  positive: {
    text: "#2f6b4f",
    wash: "rgba(47,107,79,0.10)",
    ring: "rgba(47,107,79,0.30)",
  },
  caution: {
    text: "#9a4a24",
    wash: "rgba(154,74,36,0.10)",
    ring: "rgba(154,74,36,0.30)",
  },
  critical: {
    text: "#8c2f2f",
    wash: "rgba(140,47,47,0.10)",
    ring: "rgba(140,47,47,0.32)",
  },
  // Gold ring + navy text: the accent reads without gold ever being the text.
  gold: {
    text: "#0b1b32",
    wash: "rgba(191,163,115,0.14)",
    ring: "rgba(167,149,111,0.55)",
  },
};

export function Pill({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  dot?: boolean;
}) {
  const s = PILL_TONE[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase"
      style={{
        color: s.text,
        background: s.wash,
        boxShadow: `inset 0 0 0 1px ${s.ring}`,
      }}
    >
      {dot ? (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: s.text }}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}

/* ── Stat tile ────────────────────────────────────────────────
   Slide 2's data-foundation figures.                                        */

export function StatTile({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="pw-serif pw-num text-[clamp(1.9rem,3.4vw,2.75rem)] leading-none text-navy">
        {value}
      </span>
      <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-navy-slate">
        {label}
      </span>
      {detail ? (
        <span className="text-[13px] leading-snug text-muted">{detail}</span>
      ) : null}
    </div>
  );
}

/* ── Weighted-factor bar ──────────────────────────────────────
   Shows points awarded out of a maximum weight. The filled portion is gold
   (decoration); every number and label is navy.                             */

export function FactorBar({
  points,
  maxWeight,
}: {
  points: number;
  maxWeight: number;
}) {
  const pct = maxWeight === 0 ? 0 : Math.round((points / maxWeight) * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-[6px] flex-1 overflow-hidden rounded-full"
        style={{ background: "rgba(11,27,50,0.09)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #a7956f 0%, #bfa373 100%)",
            transition: "width 900ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>
      <span className="pw-num w-[74px] shrink-0 text-right text-[12px] text-navy">
        {points.toFixed(1)} / {maxWeight}
      </span>
    </div>
  );
}

/* ── Gold hairline ────────────────────────────────────────────*/

export function GoldRule({ className = "" }: { className?: string }) {
  return <div className={`pw-rule-gold ${className}`} aria-hidden="true" />;
}
