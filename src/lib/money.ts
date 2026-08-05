/**
 * Money is stored in **sen** (1/100 MYR) as BigInt everywhere in this project.
 * Financing amounts run to eight figures and float arithmetic on ringgit would
 * drift; integers avoid the question entirely.
 */

/** Ringgit → sen. Use in seeds and form parsing, never for display. */
export function sen(ringgit: number): bigint {
  return BigInt(Math.round(ringgit * 100));
}

/** Sen → ringgit as a number. Only for charting, never for arithmetic. */
export function toRinggit(amount: bigint): number {
  return Number(amount) / 100;
}

const MYR = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const MYR_PRECISE = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "RM 486,300" — the default for UI. */
export function formatMyr(amount: bigint | null | undefined): string {
  if (amount == null) return "—";
  return MYR.format(toRinggit(amount)).replace("MYR", "RM").trim();
}

/** "RM 486,300.00" — where cents matter, e.g. an extracted document field. */
export function formatMyrPrecise(amount: bigint | null | undefined): string {
  if (amount == null) return "—";
  return MYR_PRECISE.format(toRinggit(amount)).replace("MYR", "RM").trim();
}

/** "RM 4.0bn" / "RM 486k" — for the data-foundation stat row. */
export function formatMyrCompact(amount: bigint): string {
  const ringgit = toRinggit(amount);
  if (ringgit >= 1_000_000_000) return `RM ${(ringgit / 1_000_000_000).toFixed(1)}bn`;
  if (ringgit >= 1_000_000) return `RM ${(ringgit / 1_000_000).toFixed(1)}m`;
  if (ringgit >= 1_000) return `RM ${Math.round(ringgit / 1_000)}k`;
  return `RM ${ringgit.toFixed(0)}`;
}

/** Signed delta, e.g. "+RM 1,500,000" for a recommended limit increase. */
export function formatMyrDelta(amount: bigint): string {
  const sign = amount > 0n ? "+" : amount < 0n ? "−" : "";
  const magnitude = amount < 0n ? -amount : amount;
  return `${sign}${formatMyr(magnitude)}`;
}
