export function firstRpcRow<T>(data: unknown): T | undefined {
  const row = Array.isArray(data) ? data[0] : data
  return row && typeof row === 'object' ? row as T : undefined
}
