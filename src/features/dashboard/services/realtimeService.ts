import { getInsforgeClient } from '@/src/services/insforge'
import type { RealtimePayload } from '@/src/types/realtime'

export function getListChannel(listId: string) {
  return 'list:' + listId
}

export function getUserListsChannel(userId: string) {
  return 'user:' + userId + ':lists'
}

export function getRealtimePayloadChannel(payload: RealtimePayload) {
  return payload.meta?.channel?.replace(/^realtime:/, '')
}

export function isRemoteChannelPayload(
  payload: RealtimePayload,
  channel: string,
  currentUserId?: string,
) {
  return (
    getRealtimePayloadChannel(payload) === channel &&
    (!currentUserId || payload.meta?.senderId !== currentUserId)
  )
}

export function publishRealtimeEvent(
  channel: string,
  eventName: string,
  payload: Record<string, unknown>,
) {
  return getInsforgeClient().realtime.publish(channel, eventName, payload)
}

export function publishUserListsChanged(
  targetUserId: string,
  listId: string,
  action: string,
  by?: string,
) {
  return publishRealtimeEvent(getUserListsChannel(targetUserId), 'user_lists_changed', {
    list_id: listId,
    action,
    by,
    timestamp: new Date().toISOString(),
  })
}
