import { Capacitor, registerPlugin } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import type { NativeBrowserPlugin } from '@/src/features/auth/types'
export { sanitizeRedirectPath } from '@/src/features/auth/services/redirectService'

const NativeBrowser = registerPlugin<NativeBrowserPlugin>('NativeBrowser')

export const CAPACITOR_APP_SCHEME = 'site.insforge.cestapp'
export const OAUTH_REDIRECT_PATH_KEY = 'oauth_redirect_path'
export const OAUTH_CODE_VERIFIER_KEY = 'oauth_code_verifier'
const NATIVE_OAUTH_HOST = 'accounts.google.com'
const NATIVE_OAUTH_PATH = '/o/oauth2/v2/auth'

export function isNativeCapacitorApp() {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function getNativeOAuthRedirectUrl() {
  return CAPACITOR_APP_SCHEME + '://oauth-callback'
}

export function isExpectedNativeOAuthCallback(incomingUrl: URL) {
  return (
    incomingUrl.protocol === `${CAPACITOR_APP_SCHEME}:` &&
    incomingUrl.hostname === 'oauth-callback' &&
    (incomingUrl.pathname === '' || incomingUrl.pathname === '/') &&
    !incomingUrl.username &&
    !incomingUrl.password &&
    !incomingUrl.port &&
    !incomingUrl.hash
  )
}

export function isTrustedNativeOAuthUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    return (
      url.protocol === 'https:' &&
      url.hostname === NATIVE_OAUTH_HOST &&
      url.pathname === NATIVE_OAUTH_PATH &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === '443')
    )
  } catch {
    return false
  }
}

export function canUseWebOAuth() {
  const hostname = window.location.hostname
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  return window.isSecureContext || isLocalhost
}

export async function openOAuthUrlInNativeBrowser(url: string) {
  if (!isTrustedNativeOAuthUrl(url)) {
    throw new Error('InsForge devolvió una URL OAuth no autorizada.')
  }

  const trustedUrl = new URL(url).toString()
  try {
    await Browser.open({ url: trustedUrl })
    return
  } catch (browserError) {
    console.warn('Capacitor Browser.open failed, trying Android ACTION_VIEW fallback.', browserError)
  }

  try {
    await NativeBrowser.open({ url: trustedUrl })
  } catch (nativeBrowserError) {
    console.error('Native browser fallback failed.', nativeBrowserError)
    throw nativeBrowserError
  }
}

export function closeOAuthBrowser() {
  return Browser.close()
}
