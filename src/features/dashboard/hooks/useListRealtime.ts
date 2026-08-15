'use client'

import { useEffect } from 'react'
import { useInsforgeClient } from '@/src/hooks/useInsforgeClient'
import type { ListRealtimeProps } from '@/src/features/dashboard/types'

export function useListRealtime({
  listId,
  userId,
  canManageMembers,
  onListChanged,
  onMembersChanged,
  onInviteLinksChanged,
}: ListRealtimeProps) {
  const insforge = useInsforgeClient()

  useEffect(() => {
    if (!listId || !userId) return

    let cancelled = false
    const channel = 'list:' + listId

    const listUpdatesHandler = (payload: Parameters<typeof onListChanged>[0]) => {
      const metaChannel = payload.meta?.channel?.replace(/^realtime:/, '')
      if (metaChannel !== channel || payload.meta?.senderId === userId) return
      onListChanged(payload)
    }

    const membersUpdatesHandler = (payload: Parameters<typeof onListChanged>[0]) => {
      const metaChannel = payload.meta?.channel?.replace(/^realtime:/, '')
      if (metaChannel !== channel || payload.meta?.senderId === userId) return
      onMembersChanged()
    }

    const inviteLinksUpdatesHandler = (payload: Parameters<typeof onListChanged>[0]) => {
      const metaChannel = payload.meta?.channel?.replace(/^realtime:/, '')
      if (metaChannel !== channel || payload.meta?.senderId === userId) return
      onInviteLinksChanged()
    }

    insforge.realtime.on('list_changed', listUpdatesHandler)
    if (canManageMembers) {
      insforge.realtime.on('members_changed', membersUpdatesHandler)
      insforge.realtime.on('invite_links_changed', inviteLinksUpdatesHandler)
    }

    void insforge.realtime.subscribe(channel).then((result) => {
      if (result.ok || cancelled) return
      if (result.error.code === 'SUBSCRIPTION_CANCELLED' || result.error.code === 'DISCONNECTED') return

      console.error(
        '[ListRealtime] Failed to subscribe to ' + channel + ':',
        result.error.code + ': ' + result.error.message,
      )
    }).catch((error: unknown) => {
      if (!cancelled) console.error('[ListRealtime] Failed to subscribe to ' + channel + ':', error)
    })

    return () => {
      cancelled = true
      insforge.realtime.off('list_changed', listUpdatesHandler)
      if (canManageMembers) {
        insforge.realtime.off('members_changed', membersUpdatesHandler)
        insforge.realtime.off('invite_links_changed', inviteLinksUpdatesHandler)
      }
      insforge.realtime.unsubscribe(channel)
    }
  }, [canManageMembers, insforge, listId, onInviteLinksChanged, onListChanged, onMembersChanged, userId])
}
