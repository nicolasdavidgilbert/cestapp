'use client'

import { useEffect } from 'react'
import { useInsforgeRealtimeChannel } from '@/src/hooks/useInsforgeRealtimeChannel'
import type { ListRealtimeProps } from '@/src/features/dashboard/types'

export function useListRealtime({
  listId,
  userId,
  canManageMembers,
  onListChanged,
  onMembersChanged,
  onInviteLinksChanged,
}: ListRealtimeProps) {
  const channel = listId && userId ? 'list:' + listId : undefined
  const insforge = useInsforgeRealtimeChannel({ channel, logPrefix: '[ListRealtime]' })

  useEffect(() => {
    if (!channel) return

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

    return () => {
      insforge.realtime.off('list_changed', listUpdatesHandler)
      if (canManageMembers) {
        insforge.realtime.off('members_changed', membersUpdatesHandler)
        insforge.realtime.off('invite_links_changed', inviteLinksUpdatesHandler)
      }
    }
  }, [canManageMembers, channel, insforge, onInviteLinksChanged, onListChanged, onMembersChanged, userId])
}
