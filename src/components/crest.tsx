/**
 * A geometric reduction of the crest on slide 1 of the brief — a shield inside
 * outspread wings, drawn as gold hairlines.
 *
 * Deliberately abstract rather than a traced copy: this is EIAAW's rendering of
 * the motif for a demo, and passing off a facsimile of a client's actual mark
 * would be the wrong call. Stroke-only, matching the deck's line treatment, and
 * no gold fills anywhere.
 */
export function Crest({
  size = 96,
  className = "",
  strokeOpacity = 1,
}: {
  size?: number;
  className?: string;
  strokeOpacity?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <g
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeOpacity={strokeOpacity}
      >
        {/* Outer arc — the containing circle of the original lockup */}
        <circle cx="60" cy="60" r="52" strokeOpacity={0.35 * strokeOpacity} />

        {/* Shield */}
        <path d="M60 26 L88 36 V64 C88 82 74 92 60 98 C46 92 32 82 32 64 V36 Z" />
        {/* Inner shield, offset — the deck nests two outlines */}
        <path
          d="M60 36 L79 43 V63 C79 76 70 83 60 88 C50 83 41 76 41 63 V43 Z"
          strokeOpacity={0.5 * strokeOpacity}
        />

        {/* Left wing — three sweeping feathers */}
        <path d="M32 44 C18 40 10 32 8 22 C20 26 28 32 32 38" />
        <path d="M32 56 C16 54 6 46 2 36 C16 40 27 46 32 51" strokeOpacity={0.7 * strokeOpacity} />
        <path d="M33 67 C19 68 9 63 4 55 C17 57 28 61 33 63" strokeOpacity={0.45 * strokeOpacity} />

        {/* Right wing — mirrored */}
        <path d="M88 44 C102 40 110 32 112 22 C100 26 92 32 88 38" />
        <path d="M88 56 C104 54 114 46 118 36 C104 40 93 46 88 51" strokeOpacity={0.7 * strokeOpacity} />
        <path d="M87 67 C101 68 111 63 116 55 C103 57 92 61 87 63" strokeOpacity={0.45 * strokeOpacity} />

        {/* Crown of the shield — the small vertical accent */}
        <path d="M60 26 V16" strokeOpacity={0.6 * strokeOpacity} />
        <path d="M52 20 L60 14 L68 20" strokeOpacity={0.6 * strokeOpacity} />

        {/* Interior device — an upward chevron, standing in for the eagle */}
        <path d="M50 70 L60 58 L70 70" strokeOpacity={0.8 * strokeOpacity} />
        <path d="M53 78 L60 70 L67 78" strokeOpacity={0.5 * strokeOpacity} />
      </g>
    </svg>
  );
}
