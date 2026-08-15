'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { ListItem, RealtimeEventPayload } from '@/src/features/dashboard/types'
import type { ProductSummary } from '@/src/types/product'
import {
  deleteListItem,
  deleteListItems,
  incrementListItemQuantity,
  insertListItem,
  updateListItemChecked,
  updateListItemQuantity,
} from '@/src/features/dashboard/services/listDetailService'
import { createOptimisticId } from '@/src/utils/productValues'

type UseListItemMutationsOptions = {
  listId: string
  items: ListItem[]
  products: ProductSummary[]
  setItems: Dispatch<SetStateAction<ListItem[]>>
  setError: Dispatch<SetStateAction<string>>
  setProductSearch: Dispatch<SetStateAction<string>>
  setShowAddProduct: Dispatch<SetStateAction<boolean>>
  publishListEvent: (eventName: string, payload: RealtimeEventPayload) => Promise<void>
  showSuccess: (message: string) => void
}

export function useListItemMutations({
  listId,
  items,
  products,
  setItems,
  setError,
  setProductSearch,
  setShowAddProduct,
  publishListEvent,
  showSuccess,
}: UseListItemMutationsOptions) {
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set())
  const [removingCheckedItems, setRemovingCheckedItems] = useState(false)

  const finishUpdating = (itemIds: Iterable<string>) => {
    setUpdatingItems((previous) => {
      const next = new Set(previous)
      for (const itemId of itemIds) next.delete(itemId)
      return next
    })
  }

  async function addExistingProduct(productId: string) {
    setError('')
    const existingItem = items.find((item) => item.product_id === productId)
    const optimisticItemId = createOptimisticId('optimistic-item')
    const selectedProduct =
      products.find((product) => product.id === productId) ??
      existingItem?.product ?? {
        id: productId,
        title: 'Producto',
        current_price: null,
      }

    if (existingItem) {
      setItems((current) =>
        current.map((item) =>
          item.id === existingItem.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      )
    } else {
      const optimisticItem: ListItem = {
        id: optimisticItemId,
        list_id: listId,
        product_id: productId,
        quantity: 1,
        checked: false,
        product: selectedProduct,
      }
      setItems((current) => [optimisticItem, ...current])
    }

    setShowAddProduct(false)
    setProductSearch('')
    showSuccess(existingItem ? 'Cantidad actualizada' : 'Producto añadido')

    const response = existingItem
      ? await incrementListItemQuantity(existingItem.id, existingItem.quantity + 1)
      : await insertListItem(listId, productId)

    if (response.error) {
      if (existingItem) {
        setItems((current) =>
          current.map((item) =>
            item.id === existingItem.id ? { ...item, quantity: existingItem.quantity } : item,
          ),
        )
      } else {
        setItems((current) => current.filter((item) => item.id !== optimisticItemId))
      }
      setError(response.error.message)
      return
    }

    const syncedItem = response.data
      ? ({ ...(response.data as ListItem), product: selectedProduct } as ListItem)
      : null

    if (!existingItem && syncedItem) {
      setItems((current) =>
        current.map((item) => (item.id === optimisticItemId ? syncedItem : item)),
      )
    }

    try {
      await publishListEvent(
        'list_changed',
        existingItem
          ? {
              action: 'item_quantity',
              item_id: syncedItem?.id ?? existingItem.id,
              product_id: productId,
              quantity: syncedItem?.quantity ?? existingItem.quantity + 1,
            }
          : {
              action: 'item_added',
              item: syncedItem,
              product: selectedProduct,
              product_id: productId,
            },
      )
    } catch {
      setError('Se agregó el producto, pero no se pudo notificar en tiempo real.')
    }
  }

  async function toggleChecked(item: ListItem) {
    const nextValue = !item.checked
    setItems((current) => current.map((currentItem) =>
      currentItem.id === item.id ? { ...currentItem, checked: nextValue } : currentItem,
    ))
    setUpdatingItems((previous) => new Set(previous).add(item.id))
    setError('')

    const { error } = await updateListItemChecked(item.id, nextValue)
    if (error) {
      setItems((current) => current.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, checked: item.checked } : currentItem,
      ))
      setError(`Error al marcar item: ${error.message}`)
      finishUpdating([item.id])
      return
    }

    try {
      await publishListEvent('list_changed', {
        action: 'item_checked',
        checked: nextValue,
        item_id: item.id,
        product_id: item.product_id,
      })
    } catch {
      setError('Se guardó el cambio, pero no se pudo notificar en tiempo real.')
    } finally {
      finishUpdating([item.id])
    }
  }

  async function updateQuantity(item: ListItem, delta: number) {
    const newQuantity = item.quantity + delta
    const previousIndex = items.findIndex((currentItem) => currentItem.id === item.id)

    if (newQuantity < 1) {
      const itemLabel = item.product?.title || 'este producto'
      if (!window.confirm(`¿Quitar ${itemLabel} de la lista?`)) return
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
    } else {
      setItems((current) => current.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, quantity: newQuantity } : currentItem,
      ))
    }

    setUpdatingItems((previous) => new Set(previous).add(item.id))
    setError('')

    const { error } = newQuantity < 1
      ? await deleteListItem(item.id)
      : await updateListItemQuantity(item.id, newQuantity)

    if (error) {
      setItems((current) => {
        if (newQuantity < 1) {
          if (current.some((currentItem) => currentItem.id === item.id)) return current
          const next = [...current]
          const insertAt = previousIndex >= 0 ? Math.min(previousIndex, next.length) : next.length
          next.splice(insertAt, 0, item)
          return next
        }
        return current.map((currentItem) =>
          currentItem.id === item.id ? { ...currentItem, quantity: item.quantity } : currentItem,
        )
      })
      setError(`Error al actualizar cantidad: ${error.message}`)
      finishUpdating([item.id])
      return
    }

    try {
      await publishListEvent('list_changed', newQuantity < 1
        ? { action: 'item_removed', item_id: item.id, product_id: item.product_id }
        : { action: 'item_quantity', item_id: item.id, product_id: item.product_id, quantity: newQuantity })
    } catch {
      setError('Se guardó el cambio, pero no se pudo notificar en tiempo real.')
    } finally {
      finishUpdating([item.id])
    }
  }

  async function removeItem(itemId: string) {
    const previousItem = items.find((item) => item.id === itemId)
    const previousIndex = items.findIndex((item) => item.id === itemId)
    const itemLabel = previousItem?.product?.title || 'este producto'
    if (!window.confirm(`Quitar ${itemLabel} de la lista?`)) return

    setItems((current) => current.filter((item) => item.id !== itemId))
    setUpdatingItems((previous) => new Set(previous).add(itemId))
    setError('')

    const { error } = await deleteListItem(itemId)
    if (error) {
      if (previousItem) {
        setItems((current) => {
          if (current.some((item) => item.id === itemId)) return current
          const next = [...current]
          const insertAt = previousIndex >= 0 ? Math.min(previousIndex, next.length) : next.length
          next.splice(insertAt, 0, previousItem)
          return next
        })
      }
      setError(`Error al eliminar item: ${error.message}`)
      finishUpdating([itemId])
      return
    }

    try {
      await publishListEvent('list_changed', {
        action: 'item_removed',
        item_id: itemId,
        product_id: previousItem?.product_id,
      })
    } catch {
      setError('Se guardó el cambio, pero no se pudo notificar en tiempo real.')
    } finally {
      finishUpdating([itemId])
    }
  }

  async function removeCheckedItems() {
    const itemsToRemove = items.filter((item) => item.checked)
    if (itemsToRemove.length === 0) return

    const confirmMessage = itemsToRemove.length === 1
      ? 'Eliminar el producto seleccionado de la lista?'
      : `Eliminar los ${itemsToRemove.length} productos seleccionados de la lista?`
    if (!window.confirm(confirmMessage)) return

    const idsToRemove = new Set(itemsToRemove.map((item) => item.id))
    const previousItems = items
    setRemovingCheckedItems(true)
    setUpdatingItems((previous) => new Set([...previous, ...idsToRemove]))
    setItems((current) => current.filter((item) => !idsToRemove.has(item.id)))
    setError('')

    const { error } = await deleteListItems(Array.from(idsToRemove))
    if (error) {
      setItems(previousItems)
      setError(`Error al eliminar productos: ${error.message}`)
      finishUpdating(idsToRemove)
      setRemovingCheckedItems(false)
      return
    }

    try {
      await Promise.all(itemsToRemove.map((item) => publishListEvent('list_changed', {
        action: 'item_removed',
        item_id: item.id,
        product_id: item.product_id,
      })))
      showSuccess(itemsToRemove.length === 1 ? 'Producto eliminado' : 'Productos eliminados')
    } catch {
      setError('Se guardó el cambio, pero no se pudo notificar en tiempo real.')
    } finally {
      finishUpdating(idsToRemove)
      setRemovingCheckedItems(false)
    }
  }

  return {
    addExistingProduct,
    removeCheckedItems,
    removeItem,
    removingCheckedItems,
    toggleChecked,
    updateQuantity,
    updatingItems,
  }
}
