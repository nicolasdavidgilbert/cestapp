export function readLocalCache<T>(key: string, ttlMs: number, legacyValueKey?: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const savedAt = parsed.savedAt
    if (typeof savedAt !== 'number') return null
    if (Date.now() - savedAt > ttlMs) return null

    if ('value' in parsed) return parsed.value as T
    if (legacyValueKey && legacyValueKey in parsed) return parsed[legacyValueKey] as T

    return null
  } catch {
    return null
  }
}

export function writeLocalCache<T>(key: string, value: T, legacyValueKey?: string) {
  try {
    const payload = legacyValueKey
      ? { savedAt: Date.now(), value, [legacyValueKey]: value }
      : { savedAt: Date.now(), value }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // Ignore storage write failures.
  }
}
