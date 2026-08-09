import { getInsforgeClient } from '@/src/services/insforge'
import type { DashboardList, ShoppingList, ShoppingListShare } from '@/src/features/dashboard/types'

export function fetchOwnLists(userId: string) {
  return getInsforgeClient().database
    .from('shopping_lists')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
}

export function fetchListShares(userId: string) {
  return getInsforgeClient().database
    .from('list_shares')
    .select('*')
    .eq('user_id', userId)
}

export function fetchSharedLists(sharedIds: string[]) {
  return getInsforgeClient().database
    .from('shopping_lists')
    .select('*')
    .in('id', sharedIds)
    .order('updated_at', { ascending: false })
}

export function createShoppingList(name: string, ownerId: string) {
  return getInsforgeClient().database
    .from('shopping_lists')
    .insert([{ name, owner_id: ownerId }])
    .select()
    .single()
}

export function mergeDashboardLists(ownLists: ShoppingList[], shares: ShoppingListShare[], sharedLists: ShoppingList[]) {
  const ownListIds = new Set(ownLists.map((list) => list.id))
  const sharedShares = shares.filter((share) => !ownListIds.has(share.list_id))
  const sharedListIds = new Set(sharedShares.map((share) => share.list_id))

  const mergedLists: DashboardList[] = [
    ...ownLists.map((list) => ({ ...list, access: 'owner' as const })),
    ...sharedLists
      .filter((list) => sharedListIds.has(list.id))
      .map((list) => ({ ...list, access: 'shared' as const, role: 'editor' })),
  ]

  mergedLists.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return mergedLists
}

export function reconcileLists(previous: DashboardList[], incoming: DashboardList[]) {
  const previousById = new Map(previous.map((item) => [item.id, item]))
  const reconciled = incoming.map((nextItem) => {
    const prevItem = previousById.get(nextItem.id)
    if (
      prevItem &&
      prevItem.name === nextItem.name &&
      prevItem.owner_id === nextItem.owner_id &&
      prevItem.access === nextItem.access &&
      prevItem.role === nextItem.role
    ) {
      return prevItem
    }

    return nextItem
  })

  const unchanged =
    reconciled.length === previous.length &&
    reconciled.every((item, index) => item === previous[index])

  return unchanged ? previous : reconciled
}

export function publishDashboardListEvent(userId: string, listId: string, action: string) {
  return getInsforgeClient().realtime.publish('user:' + userId + ':lists', 'user_lists_changed', {
    list_id: listId,
    action,
  })
}
