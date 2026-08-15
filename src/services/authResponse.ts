import 'server-only'

export const AUTH_NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
} as const

export function authJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: AUTH_NO_STORE_HEADERS,
  })
}
