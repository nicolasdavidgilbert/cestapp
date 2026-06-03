import { createClient } from '@insforge/sdk'

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!

export const insforge = createClient({
  baseUrl,
  anonKey,
  autoRefreshToken: false,
})

export const insforgeServer = createClient({
  baseUrl,
  anonKey,
  isServerMode: true,
  autoRefreshToken: false,
})