import { getInsforgeClient } from '@/src/services/insforge'
import type { AcceptedInvite } from '@/src/features/dashboard/types'
import { getListChannel, publishRealtimeEvent, publishUserListsChanged } from '@/src/features/dashboard/services/realtimeService'
import { firstRpcRow } from '@/src/utils/rpc'

export function acceptListInvite(token: string) {
  return getInsforgeClient().database.rpc('accept_list_invite', { invite_token: token })
}

export function normalizeAcceptedInvite(data: unknown): AcceptedInvite | undefined {
  return firstRpcRow<AcceptedInvite>(data)
}

export function publishInviteAcceptedEvents(accepted: AcceptedInvite, userId: string) {
  const timestamp = new Date().toISOString()

  return Promise.all([
    publishRealtimeEvent(getListChannel(accepted.list_id), 'members_changed', {
      action: 'joined_by_link',
      target_user_id: userId,
      timestamp,
    }),
    publishUserListsChanged(userId, accepted.list_id, 'shared', userId),
    publishUserListsChanged(accepted.owner_id, accepted.list_id, 'shared', userId),
  ])
}
