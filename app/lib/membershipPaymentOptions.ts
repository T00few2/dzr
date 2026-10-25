export type PaymentOption = {
  id: string
  label: string
  coversYears: number[]
}

function membershipYear(now: Date): number {
  const year = now.getUTCFullYear()
  return Number.isInteger(year) ? year : new Date().getUTCFullYear()
}

export function normalizePaymentOptions(input: unknown): PaymentOption[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const options: PaymentOption[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const record = raw as { id?: unknown; label?: unknown; coversYears?: unknown }
    const id = String(record.id || '').trim()
    const years = Array.isArray(record.coversYears)
      ? [...new Set(record.coversYears.map(Number).filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100))].sort((a, b) => a - b)
      : []
    if (!id || !years.length || seen.has(id)) continue
    seen.add(id)
    const label = String(record.label || id).trim() || id
    options.push({ id, label, coversYears: years })
  }
  return options
}

// An empty saved list must not stop signup. Every successful 2026 payment
// covered the current calendar year, so that is the safe fallback.
export function resolvePaymentOptions(input: unknown, now = new Date()): PaymentOption[] {
  const saved = normalizePaymentOptions(input)
  if (saved.length) return saved
  const year = membershipYear(now)
  return [{ id: 'current', label: String(year), coversYears: [year] }]
}

export function usesPaymentOptionFallback(input: unknown): boolean {
  return normalizePaymentOptions(input).length === 0
}
