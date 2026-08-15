'use client'

import { useEffect } from 'react'
import { useInsforgeRealtimeChannel } from '@/src/hooks/useInsforgeRealtimeChannel'
import type { DashboardListsRealtimeOptions, RealtimePayload } from '@/src/features/dashboard/types'
import { getUserListsChannel, isRemoteChannelPayload } from '@/src/features/dashboard/services/realtimeService'

export function useDashboardListsRealtime({ userId, onListsChanged }: DashboardListsRealtimeOptions) {
  const channel = userId ? getUserListsChannel(userId) : undefined
  const insforge = useInsforgeRealtimeChannel({ channel, logPrefix: '[Dashboard]' })

  useEffect(() => {
    if (!channel) return

    const realtimeHandler = (payload: RealtimePayload) => {
      if (isRemoteChannelPayload(payload, channel)) {
        onListsChanged()
      }
    }

    insforge.realtime.on('user_lists_changed', realtimeHandler)

    return () => {
      insforge.realtime.off('user_lists_changed', realtimeHandler)
    }
  }, [channel, insforge, onListsChanged])
}
