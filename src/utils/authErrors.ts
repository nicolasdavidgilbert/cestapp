import type { AuthErrorLike } from '@/src/types/auth'

export function isAuthErrorMessage(message: string | null | undefined) {
  const normalized = (message ?? '').toLowerCase()
  return (
    normalized.includes('invalid token') ||
    normalized.includes('unauthorized') ||
    normalized.includes('token expired') ||
    normalized.includes('session invalid')
  )
}

export function isAuthError(error: unknown) {
  if (typeof error === 'string') return isAuthErrorMessage(error)

  const details = (error ?? {}) as AuthErrorLike
  const status = typeof details.status === 'number' ? details.status : typeof details.statusCode === 'number' ? details.statusCode : null
  const code = typeof details.error === 'string' ? details.error.toLowerCase() : ''
  const message = typeof details.message === 'string' ? details.message : error instanceof Error ? error.message : ''

  return status === 401 || status === 403 || code === 'invalid_token' || code === 'unauthorized' || code === 'token_expired' || isAuthErrorMessage(message)
}
