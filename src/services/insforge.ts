import { Capacitor } from '@capacitor/core'
import {
  AuthChangeEvent,
  createClient,
  type InsForgeClient,
} from '@insforge/sdk'
import { createBrowserClient as createInsforgeBrowserClient } from '@insforge/sdk/ssr'
import {
  INSFORGE_ANON_KEY,
  INSFORGE_AUTH_COOKIE_SETTINGS,
  INSFORGE_BASE_URL,
} from '@/src/services/insforgeConfig'

type ClientListener = () => void

const listeners = new Set<ClientListener>()

function createBrowserClient(accessToken?: string) {
  if (Capacitor.isNativePlatform() || accessToken) {
    return createClient({
      baseUrl: INSFORGE_BASE_URL,
      anonKey: INSFORGE_ANON_KEY,
      ...(accessToken ? { accessToken } : {}),
    })
  }

  // This client reads the short-lived access cookie and delegates renewal to
  // the server. It deliberately leaves OAuth callbacks to the server route.
  return createInsforgeBrowserClient({
    baseUrl: INSFORGE_BASE_URL,
    anonKey: INSFORGE_ANON_KEY,
    ...INSFORGE_AUTH_COOKIE_SETTINGS,
    refreshUrl: '/api/auth/refresh',
  }) as unknown as InsForgeClient
}

let currentClient = createBrowserClient()

export function getInsforgeClient() {
  return currentClient
}

function getBrowserAccessToken() {
  if (typeof document === 'undefined') return null

  const cookieName = INSFORGE_AUTH_COOKIE_SETTINGS.names.accessToken
  for (const part of document.cookie.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (rawName !== cookieName) continue

    const value = rawValue.join('=')
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  return null
}

export function establishInsforgeSession(accessToken?: string) {
  const nextAccessToken = accessToken ?? getBrowserAccessToken()
  if (!nextAccessToken) return false

  currentClient.setAccessToken(nextAccessToken, AuthChangeEvent.SIGNED_IN)
  return true
}

export function refreshInsforgeSession(accessToken: string) {
  currentClient.setAccessToken(accessToken, AuthChangeEvent.TOKEN_REFRESHED)
}

export function replaceInsforgeClient(accessToken?: string) {
  const previousClient = currentClient
  currentClient = createBrowserClient(accessToken)

  previousClient.realtime.disconnect()

  for (const listener of listeners) {
    listener()
  }

  return currentClient
}

export function subscribeToInsforgeClient(listener: ClientListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getInsforgeClientSnapshot(): InsForgeClient {
  return currentClient
}
