import { createClient, type InsForgeClient } from '@insforge/sdk'

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!

type ClientListener = () => void

const listeners = new Set<ClientListener>()

function createBrowserClient(accessToken?: string) {
  return createClient({
    baseUrl,
    anonKey,
    autoRefreshToken: false,
    ...(accessToken ? { edgeFunctionToken: accessToken } : {}),
  })
}

let currentClient = createBrowserClient()

export const insforgeServer = createClient({
  baseUrl,
  anonKey,
  isServerMode: true,
  autoRefreshToken: false,
})

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
