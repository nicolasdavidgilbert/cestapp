'use client'

import { useEffect } from 'react'
import { useInsforgeRealtimeChannel } from '@/src/hooks/useInsforgeRealtimeChannel'
import type { DashboardListsRealtimeOptions, RealtimePayload } from '@/src/features/dashboard/types'

export function useDashboardListsRealtime({ userId, onListsChanged }: DashboardListsRealtimeOptions) {
  const channel = userId ? 'user:' + userId + ':lists' : undefined
  const insforge = useInsforgeRealtimeChannel({ channel, logPrefix: '[Dashboard]' })

  useEffect(() => {
    if (!channel) return

    const realtimeHandler = (payload: RealtimePayload) => {
      const metaChannel = payload.meta?.channel?.replace(/^realtime:/, '')
      if (metaChannel === channel) {
        onListsChanged()
      }
    }

    insforge.realtime.on('user_lists_changed', realtimeHandler)

    return () => {
      insforge.realtime.off('user_lists_changed', realtimeHandler)
    }
  }, [channel, insforge, onListsChanged])
}
