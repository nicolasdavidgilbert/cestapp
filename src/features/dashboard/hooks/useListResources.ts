'use client'

import { useCallback, useEffect, useState } from 'react'
import type { InviteLink, ListItem, ShoppingList, ShoppingListShare } from '@/src/features/dashboard/types'
import type { ProductSummary } from '@/src/types/product'
import {
  fetchActiveInviteLinks,
  fetchListById,
  fetchListItems,
  fetchListMembership,
  fetchListShareMembers,
  fetchOwnListProducts,
  fetchVisibleListProducts,
} from '@/src/features/dashboard/services/listDetailService'

export function useListResources({ listId, userId }: { listId: string; userId?: string }) {
  const [list, setList] = useState<ShoppingList | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [members, setMembers] = useState<ShoppingListShare[]>([])
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([])
  const [listNameDraft, setListNameDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingInviteLinks, setLoadingInviteLinks] = useState(false)
  const [error, setError] = useState('')

  const canManageMembers = list?.owner_id === userId

  const loadMembers = useCallback(async () => {
    const { data, error: membersError } = await fetchListShareMembers(listId)

    if (membersError) {
      setError(membersError.message)
      return
    }

    setMembers((data as ShoppingListShare[]) || [])
  }, [listId])

  const loadInviteLinks = useCallback(async () => {
    if (!canManageMembers) {
      setInviteLinks([])
      return
    }

    setLoadingInviteLinks(true)
    const { data, error: inviteError } = await fetchActiveInviteLinks(listId)

    if (inviteError) {
      setError(inviteError.message)
      setLoadingInviteLinks(false)
      return
    }

    setInviteLinks((data as InviteLink[]) || [])
    setLoadingInviteLinks(false)
  }, [canManageMembers, listId])

  const loadData = useCallback(async () => {
    if (!userId) return
    setError('')

    const [listRes, itemsRes, ownProductsRes] = await Promise.all([
      fetchListById(listId),
      fetchListItems(listId),
      fetchOwnListProducts(userId),
    ])

    const firstError = listRes.error ?? itemsRes.error ?? ownProductsRes.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    if (!listRes.data) {
      setError('No se encontró la lista.')
      setLoading(false)
      return
    }

    if (listRes.data.owner_id !== userId) {
      const { data: membership } = await fetchListMembership(listId, userId)

      if (!membership) {
        setError('No tienes permisos para ver esta lista.')
        setLoading(false)
        return
      }
    }

    const nextList = listRes.data as ShoppingList
    setList(nextList)
    setListNameDraft(nextList.name)

    let listProducts: ProductSummary[] = []
    if ((itemsRes.data || []).length > 0) {
      const { data: listProductsData, error: listProductsError } = await fetchVisibleListProducts(listId)

      if (listProductsError) {
        setError(listProductsError.message)
        setLoading(false)
        return
      }

      listProducts = (listProductsData as ProductSummary[]) || []
    }

    setItems(
      (itemsRes.data || []).map((item) => ({
        ...item,
        product: listProducts.find((product) => product.id === item.product_id),
      })) as ListItem[],
    )
    setProducts((ownProductsRes.data as ProductSummary[]) || [])
    setLoading(false)
  }, [listId, userId])

  useEffect(() => {
    if (!userId || !listId) return
    queueMicrotask(() => void loadData())
  }, [listId, loadData, userId])

  useEffect(() => {
    if (!canManageMembers) return
    queueMicrotask(() => {
      void loadMembers()
      void loadInviteLinks()
    })
  }, [canManageMembers, loadInviteLinks, loadMembers])

  return {
    canManageMembers,
    error,
    inviteLinks,
    items,
    list,
    listNameDraft,
    loading,
    loadingInviteLinks,
    members,
    products,
    loadData,
    loadInviteLinks,
    loadMembers,
    setError,
    setInviteLinks,
    setItems,
    setList,
    setListNameDraft,
    setMembers,
    setProducts,
  }
}
