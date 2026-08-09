import { getInsforgeClient } from '@/src/services/insforge'
import type { AcceptedInvite } from '@/src/features/dashboard/types'

export function acceptListInvite(token: string) {
  return getInsforgeClient().database.rpc('accept_list_invite', { invite_token: token })
}

export function normalizeAcceptedInvite(data: unknown): AcceptedInvite | undefined {
  return (Array.isArray(data) ? data[0] : data) as AcceptedInvite | undefined
}

export function publishInviteAcceptedEvents(accepted: AcceptedInvite, userId: string) {
  const timestamp = new Date().toISOString()

  return Promise.all([
    getInsforgeClient().realtime.publish('list:' + accepted.list_id, 'members_changed', {
      action: 'joined_by_link',
      target_user_id: userId,
      timestamp,
    }),
    getInsforgeClient().realtime.publish('user:' + userId + ':lists', 'user_lists_changed', {
      list_id: accepted.list_id,
      action: 'shared',
      by: userId,
      timestamp,
    }),
    getInsforgeClient().realtime.publish('user:' + accepted.owner_id + ':lists', 'user_lists_changed', {
      list_id: accepted.list_id,
      action: 'shared',
      by: userId,
      timestamp,
    }),
  ])
}
