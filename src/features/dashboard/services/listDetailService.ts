import { getInsforgeClient } from '@/src/services/insforge'
import type { InviteExpiryOption, InviteLink } from '@/src/features/dashboard/types'
import { publishRealtimeEvent, publishUserListsChanged } from '@/src/features/dashboard/services/realtimeService'

export const inviteExpiryOptions = [
  { value: 'never', label: 'Sin caducidad', days: null },
  { value: '1d', label: '24 h', days: 1 },
  { value: '7d', label: '7 días', days: 7 },
  { value: '30d', label: '30 días', days: 30 },
] as const

export function getInviteExpiryDate(option: InviteExpiryOption) {
  const selected = inviteExpiryOptions.find((item) => item.value === option)
  if (!selected?.days) return null

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + selected.days)
  return expiresAt.toISOString()
}

export function formatInviteStatus(invite: InviteLink) {
  if (!invite.expires_at) return 'Activo · Sin caducidad'

  const expiresAt = new Date(invite.expires_at)
  if (expiresAt.getTime() <= Date.now()) return 'Expirado'

  return 'Activo · Caduca ' + expiresAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

export function fetchListShareMembers(listId: string) {
  return getInsforgeClient().database.rpc('list_share_members', { target_list_id: listId })
}

export function fetchActiveInviteLinks(listId: string) {
  return getInsforgeClient().database
    .from('list_invite_links')
    .select('*')
    .eq('list_id', listId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(6)
}

export function fetchListById(listId: string) {
  return getInsforgeClient().database.from('shopping_lists').select('*').eq('id', listId).single()
}

export function fetchListItems(listId: string) {
  return getInsforgeClient().database.from('shopping_list_items').select('*').eq('list_id', listId)
}

export function fetchOwnListProducts(userId: string) {
  return getInsforgeClient().database
    .from('products')
    .select('id, title, current_price')
    .eq('created_by', userId)
    .order('title')
}

export function fetchListMembership(listId: string, userId: string) {
  return getInsforgeClient().database
    .from('list_shares')
    .select('*')
    .eq('list_id', listId)
    .eq('user_id', userId)
    .maybeSingle()
}

export function fetchVisibleListProducts(listId: string) {
  return getInsforgeClient().database.rpc('list_visible_products', { target_list_id: listId })
}

export function publishListRealtimeEvent(listChannel: string, eventName: string, payload: Record<string, unknown>) {
  return publishRealtimeEvent(listChannel, eventName, payload)
}

export function publishUserListsRealtimeEvent(targetUserId: string, listId: string, action: string, by?: string) {
  return publishUserListsChanged(targetUserId, listId, action, by)
}

export function shareListWithEmail(listId: string, targetEmail: string) {
  return getInsforgeClient().database.rpc('share_list_with_email', {
    target_list_id: listId,
    target_email: targetEmail,
  })
}

export function createInviteLinkRecord(listId: string, createdBy: string, expiresAt: string | null) {
  return getInsforgeClient().database
    .from('list_invite_links')
    .insert([{ list_id: listId, created_by: createdBy, expires_at: expiresAt }])
    .select('*')
    .single()
}

export function revokeInviteLinkRecord(inviteId: string) {
  return getInsforgeClient().database
    .from('list_invite_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
}

export function updateShoppingListName(listId: string, name: string) {
  return getInsforgeClient().database
    .from('shopping_lists')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', listId)
    .select()
    .single()
}

export function deleteListShare(shareId: string) {
  return getInsforgeClient().database.from('list_shares').delete().eq('id', shareId)
}

export function incrementListItemQuantity(itemId: string, quantity: number) {
  return getInsforgeClient().database
    .from('shopping_list_items')
    .update({ quantity })
    .eq('id', itemId)
    .select('*')
    .single()
}

export function insertListItem(listId: string, productId: string) {
  return getInsforgeClient().database
    .from('shopping_list_items')
    .insert([{ list_id: listId, product_id: productId, quantity: 1 }])
    .select('*')
    .single()
}

export function createProductForList(listId: string, title: string, description: string | null, price: number | null) {
  return getInsforgeClient().database.rpc('create_product_for_list', {
    target_list_id: listId,
    product_title: title,
    product_description: description,
    product_price: price,
  })
}

export function fetchListProductSummary(productId: string) {
  return getInsforgeClient().database.from('products').select('id, title, current_price').eq('id', productId).single()
}

export function fetchListItemByProduct(listId: string, productId: string) {
  return getInsforgeClient().database
    .from('shopping_list_items')
    .select('*')
    .eq('list_id', listId)
    .eq('product_id', productId)
    .single()
}

export function updateListItemChecked(itemId: string, checked: boolean) {
  return getInsforgeClient().database.from('shopping_list_items').update({ checked }).eq('id', itemId)
}

export function updateListItemQuantity(itemId: string, quantity: number) {
  return getInsforgeClient().database.from('shopping_list_items').update({ quantity }).eq('id', itemId)
}

export function deleteListItem(itemId: string) {
  return getInsforgeClient().database.from('shopping_list_items').delete().eq('id', itemId)
}

export function deleteListItems(itemIds: string[]) {
  return getInsforgeClient().database.from('shopping_list_items').delete().in('id', itemIds)
}

export function deleteShoppingList(listId: string) {
  return getInsforgeClient().database.from('shopping_lists').delete().eq('id', listId)
}
