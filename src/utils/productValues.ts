export function parseOptionalPrice(value: string): number | null | undefined {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export function parseRequiredPrice(value: string): number | undefined {
  const parsed = parseOptionalPrice(value)
  return typeof parsed === 'number' ? parsed : undefined
}

export function createOptimisticId(prefix: string) {
  const suffix =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Date.now() + '-' + Math.random().toString(36).slice(2, 10)

  return prefix + '-' + suffix
}
