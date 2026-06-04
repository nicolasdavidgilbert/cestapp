const DEFAULT_AUTH_REDIRECT_PATH = '/dashboard'
const ALLOWED_AUTH_REDIRECT_PREFIXES = ['/dashboard', '/products', '/invite']

function getCurrentOrigin() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

function isAllowedRedirectPath(pathname: string) {
  return ALLOWED_AUTH_REDIRECT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}

export function sanitizeRedirectPath(path: string | null | undefined) {
  const rawValue = (path ?? '').trim()
  if (!rawValue) return DEFAULT_AUTH_REDIRECT_PATH

  const appOrigin = getCurrentOrigin()
  let redirectUrl: URL

  try {
    redirectUrl = new URL(rawValue, appOrigin)
  } catch {
    return DEFAULT_AUTH_REDIRECT_PATH
  }

  if (redirectUrl.origin !== appOrigin) {
    return DEFAULT_AUTH_REDIRECT_PATH
  }

  const isRelativePath = rawValue.startsWith('/') && !rawValue.startsWith('//')
  const isSameOriginAbsoluteUrl = rawValue.startsWith(appOrigin + '/')

  if (!isRelativePath && !isSameOriginAbsoluteUrl) {
    return DEFAULT_AUTH_REDIRECT_PATH
  }

  if (!isAllowedRedirectPath(redirectUrl.pathname)) {
    return DEFAULT_AUTH_REDIRECT_PATH
  }

  return redirectUrl.pathname + redirectUrl.search + redirectUrl.hash
}
