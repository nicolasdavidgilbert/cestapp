import type { AuthErrorLike } from '@/src/types/auth'

export function getAuthErrorStatus(error: unknown) {
  const details = (error ?? {}) as AuthErrorLike
  return typeof details.statusCode === 'number'
    ? details.statusCode
    : typeof details.status === 'number'
      ? details.status
      : 500
}

export function getAuthErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message
    ? error.message
    : typeof (error as AuthErrorLike | null)?.message === 'string'
      ? (error as AuthErrorLike).message!
      : fallback
}

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
  const status = getAuthErrorStatus(error)
  const code = typeof details.error === 'string' ? details.error.toLowerCase() : ''
  const message = typeof details.message === 'string' ? details.message : error instanceof Error ? error.message : ''

  return status === 401 || status === 403 || code === 'invalid_token' || code === 'unauthorized' || code === 'token_expired' || isAuthErrorMessage(message)
}

export function isInvalidAuthSessionError(error: unknown) {
  const details = (error ?? {}) as AuthErrorLike & { code?: unknown }
  const status = getAuthErrorStatus(error)
  const providerCode = typeof details.error === 'string' ? details.error.toLowerCase() : ''
  const nativeCode = typeof details.code === 'string' ? details.code.toUpperCase() : ''
  const message = getAuthErrorMessage(error, '').toLowerCase()

  return (
    status === 401 ||
    status === 403 ||
    nativeCode === 'NO_SESSION' ||
    nativeCode === 'INVALID_SESSION' ||
    nativeCode === 'HTTP_401' ||
    nativeCode === 'HTTP_403' ||
    providerCode.includes('invalid_token') ||
    providerCode.includes('unauthorized') ||
    providerCode.includes('token_expired') ||
    providerCode.includes('refresh_token') ||
    message.includes('sesión no válida') ||
    message.includes('session invalid') ||
    message.includes('unauthorized') ||
    message.includes('invalid token') ||
    message.includes('token expired') ||
    (message.includes('refresh token') && message.includes('invalid'))
  )
}
