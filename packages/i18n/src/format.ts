/**
 * Locale-aware formatting helpers shared by the web client and the server (for
 * PDFs/emails). Always go through these instead of hand-formatting numbers or
 * dates so EN/RO/HU output stays correct and consistent (ADR-000 §7).
 */

export function formatNumber(locale: string, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value)
}

export function formatDate(locale: string, date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function formatPercent(locale: string, ratio: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio)
}
