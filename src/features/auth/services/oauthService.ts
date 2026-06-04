import { Capacitor, registerPlugin } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import type { NativeBrowserPlugin } from '@/src/features/auth/types'
export { sanitizeRedirectPath } from '@/src/features/auth/services/redirectService'

const NativeBrowser = registerPlugin<NativeBrowserPlugin>('NativeBrowser')

export const CAPACITOR_APP_SCHEME = 'site.insforge.cestapp'
export const OAUTH_REDIRECT_PATH_KEY = 'oauth_redirect_path'
export const OAUTH_CODE_VERIFIER_KEY = 'oauth_code_verifier'

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
  const expectedProtocol = CAPACITOR_APP_SCHEME + ':'
  const isExpectedCallbackLocation =
    incomingUrl.hostname === 'oauth-callback' || incomingUrl.pathname === '/oauth-callback'

  return incomingUrl.protocol === expectedProtocol && isExpectedCallbackLocation
}

export function canUseWebOAuth() {
  const hostname = window.location.hostname
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  return window.isSecureContext || isLocalhost
}

export async function openOAuthUrlInNativeBrowser(url: string) {
  try {
    await Browser.open({ url })
    return
  } catch (browserError) {
    console.warn('Capacitor Browser.open failed, trying Android ACTION_VIEW fallback.', browserError)
  }

  try {
    await NativeBrowser.open({ url })
  } catch (nativeBrowserError) {
    console.error('Native browser fallback failed.', nativeBrowserError)
    throw nativeBrowserError
  }
}

export function closeOAuthBrowser() {
  return Browser.close()
}
