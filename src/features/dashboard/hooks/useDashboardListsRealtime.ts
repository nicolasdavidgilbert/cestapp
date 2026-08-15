'use client'

import { useEffect } from 'react'
import { useInsforgeClient } from '@/src/hooks/useInsforgeClient'
import type { DashboardListsRealtimeOptions, RealtimePayload } from '@/src/features/dashboard/types'

export function useDashboardListsRealtime({ userId, onListsChanged }: DashboardListsRealtimeOptions) {
  const insforge = useInsforgeClient()

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    const channel = 'user:' + userId + ':lists'

    const realtimeHandler = (payload: RealtimePayload) => {
      const metaChannel = payload.meta?.channel?.replace(/^realtime:/, '')
      if (metaChannel === channel) {
        onListsChanged()
      }
    }

    insforge.realtime.on('user_lists_changed', realtimeHandler)
    void insforge.realtime.subscribe(channel).then((result) => {
      if (result.ok || cancelled) return
      if (result.error.code === 'SUBSCRIPTION_CANCELLED' || result.error.code === 'DISCONNECTED') return

      console.error(
        '[Dashboard] Failed to subscribe to ' + channel + ':',
        result.error.code + ': ' + result.error.message,
      )
    }).catch((error: unknown) => {
      if (!cancelled) console.error('[Dashboard] Failed to subscribe to ' + channel + ':', error)
    })

    return () => {
      cancelled = true
      insforge.realtime.off('user_lists_changed', realtimeHandler)
      insforge.realtime.unsubscribe(channel)
    }
  }, [insforge, onListsChanged, userId])
}
