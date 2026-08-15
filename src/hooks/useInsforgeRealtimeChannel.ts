'use client'

import { useEffect } from 'react'
import { useInsforgeClient } from '@/src/hooks/useInsforgeClient'

type UseInsforgeRealtimeChannelOptions = {
  channel?: string
  logPrefix: string
}

export function useInsforgeRealtimeChannel({
  channel,
  logPrefix,
}: UseInsforgeRealtimeChannelOptions) {
  const insforge = useInsforgeClient()

  useEffect(() => {
    if (!channel) return

    let cancelled = false
    let subscribed = false

    // React Strict Mode mounts, cleans up, and mounts effects again in development.
    // Deferring acquisition lets that probe cancel before it produces network traffic.
    const subscribeTimeout = window.setTimeout(() => {
      void (async () => {
        try {
          await insforge.realtime.connect()
          if (cancelled) return

          subscribed = true
          const result = await insforge.realtime.subscribe(channel)
          if (result.ok || cancelled) return
          if (result.error.code === 'SUBSCRIPTION_CANCELLED' || result.error.code === 'DISCONNECTED') return

          console.error(
            logPrefix + ' Failed to subscribe to ' + channel + ':',
            result.error.code + ': ' + result.error.message,
          )
        } catch (error: unknown) {
          if (!cancelled) console.error(logPrefix + ' Failed to subscribe to ' + channel + ':', error)
        }
      })()
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(subscribeTimeout)
      if (subscribed) insforge.realtime.unsubscribe(channel)
    }
  }, [channel, insforge, logPrefix])

  return insforge
}
