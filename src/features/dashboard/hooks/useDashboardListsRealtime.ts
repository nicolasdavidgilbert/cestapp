'use client'

import { useEffect } from 'react'
import { insforge } from '@/src/services/insforge'
import type { DashboardListsRealtimeOptions, RealtimePayload } from '@/src/features/dashboard/types'

export function useDashboardListsRealtime({ userId, onListsChanged }: DashboardListsRealtimeOptions) {
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

    async function doSubscribe() {
      if (cancelled) return

      if (!insforge.realtime.isConnected) {
        await insforge.realtime.connect()
      }

      if (cancelled) return

      const result = await insforge.realtime.subscribe(channel)
      if (!result.ok) {
        console.error('[Dashboard] Failed to subscribe to ' + channel + ':', result.error?.message)
      }
    }

    const handleConnect = () => {
      if (!cancelled) {
        insforge.realtime.subscribe(channel).then((result) => {
          if (!result.ok) {
            console.error('[Dashboard] Re-subscribe failed for ' + channel + ':', result.error?.message)
          }
        })
      }
    }

    insforge.realtime.on('user_lists_changed', realtimeHandler)
    insforge.realtime.on('connect', handleConnect)

    void doSubscribe()

    return () => {
      cancelled = true
      insforge.realtime.off('user_lists_changed', realtimeHandler)
      insforge.realtime.off('connect', handleConnect)
      insforge.realtime.unsubscribe(channel)
    }
  }, [onListsChanged, userId])
}
