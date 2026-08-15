import { Capacitor } from '@capacitor/core'
import { createClient, type InsForgeClient } from '@insforge/sdk'
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

export function replaceInsforgeClient(accessToken?: string) {
  const previousClient = currentClient
  currentClient = createBrowserClient(accessToken)

  if (previousClient.realtime.isConnected) {
    previousClient.realtime.disconnect()
  }

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
