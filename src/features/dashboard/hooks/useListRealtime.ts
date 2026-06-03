'use client'

import { useEffect } from 'react'
import { insforge } from '@/src/services/insforge'
import type { ListRealtimeProps } from '@/src/features/dashboard/types'

export function useListRealtime({
  listId,
  userId,
  canManageMembers,
  onListChanged,
  onMembersChanged,
  onInviteLinksChanged,
}: ListRealtimeProps) {
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

    async function doSubscribe() {
      if (cancelled) return

      if (!insforge.realtime.isConnected) {
        await insforge.realtime.connect()
      }

      if (cancelled) return
      const result = await insforge.realtime.subscribe(channel)
      if (!result.ok) {
        console.error('[ListRealtime] Failed to subscribe to ' + channel + ':', result.error?.message)
      }
    }

    const handleConnect = () => {
      if (!cancelled) {
        insforge.realtime.subscribe(channel).then((result) => {
          if (!result.ok) {
            console.error('[ListRealtime] Re-subscribe failed for ' + channel + ':', result.error?.message)
          }
        })
      }
    }

    const handleDisconnect = () => {
      if (!cancelled) void doSubscribe()
    }

    insforge.realtime.on('list_changed', listUpdatesHandler)
    if (canManageMembers) {
      insforge.realtime.on('members_changed', membersUpdatesHandler)
      insforge.realtime.on('invite_links_changed', inviteLinksUpdatesHandler)
    }
    insforge.realtime.on('connect', handleConnect)
    insforge.realtime.on('disconnect', handleDisconnect)

    void doSubscribe()

    return () => {
      cancelled = true
      insforge.realtime.off('list_changed', listUpdatesHandler)
      if (canManageMembers) {
        insforge.realtime.off('members_changed', membersUpdatesHandler)
        insforge.realtime.off('invite_links_changed', inviteLinksUpdatesHandler)
      }
      insforge.realtime.off('connect', handleConnect)
      insforge.realtime.off('disconnect', handleDisconnect)
      insforge.realtime.unsubscribe(channel)
    }
  }, [canManageMembers, listId, onInviteLinksChanged, onListChanged, onMembersChanged, userId])
}
