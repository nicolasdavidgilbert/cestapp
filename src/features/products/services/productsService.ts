import { getInsforgeClient } from '@/src/services/insforge'
import type { Product } from '@/src/features/products/types'

export function fetchProductsByUser(userId: string) {
  return getInsforgeClient().database
    .from('products')
    .select('*')
    .eq('created_by', userId)
    .order('updated_at', { ascending: false })
}

export function fetchProductPriceHistory(productId: string) {
  return getInsforgeClient().database
    .from('price_history')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
}

export function insertProduct(title: string, description: string | null, price: number | null) {
  return getInsforgeClient().database
    .from('products')
    .insert([{ title, description, current_price: price }])
    .select('*')
    .single()
}

export function updateProductDetails(productId: string, title: string, description: string | null) {
  return getInsforgeClient().database
    .from('products')
    .update({ title, description, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single()
}

export function insertPriceHistory(productId: string, price: number, createdBy?: string) {
  return getInsforgeClient().database.from('price_history').insert([
    {
      product_id: productId,
      price,
      ...(createdBy ? { created_by: createdBy } : {}),
    },
  ])
}

export function updateProductCurrentPrice(productId: string, price: number) {
  return getInsforgeClient().database
    .from('products')
    .update({ current_price: price, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single()
}

export function updatePriceHistoryEntry(entryId: string, price: number) {
  return getInsforgeClient().database.from('price_history').update({ price }).eq('id', entryId)
}

export function deletePriceHistoryEntry(entryId: string) {
  return getInsforgeClient().database.from('price_history').delete().eq('id', entryId)
}

export function reconcileProducts(previous: Product[], incoming: Product[]) {
  const previousById = new Map(previous.map((item) => [item.id, item]))
  const reconciled = incoming.map((nextItem) => {
    const prevItem = previousById.get(nextItem.id)
    if (
      prevItem &&
      prevItem.title === nextItem.title &&
      prevItem.description === nextItem.description &&
      prevItem.current_price === nextItem.current_price &&
      prevItem.updated_at === nextItem.updated_at
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
