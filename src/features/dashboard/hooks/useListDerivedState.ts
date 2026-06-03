'use client'

import { useMemo } from 'react'
import type { ListDerivedState, ListDerivedStateInput } from '@/src/features/dashboard/types'

export function useListDerivedState({ items, products, productSearch }: ListDerivedStateInput): ListDerivedState {
  return useMemo(() => {
    const uncheckedItems = items.filter((item) => !item.checked)
    const checkedItems = items.filter((item) => item.checked)
    const checkedTotal = checkedItems.reduce(
      (sum, item) => sum + (item.product?.current_price || 0) * item.quantity,
      0
    )
    const total = items.reduce((sum, item) => sum + (item.product?.current_price || 0) * item.quantity, 0)
    const remainingTotal = Math.max(total - checkedTotal, 0)
    const progress = total > 0 ? (checkedTotal / total) * 100 : 0
    const normalizedProductSearch = productSearch.trim().toLowerCase()
    const filteredProducts = normalizedProductSearch
      ? products.filter((product) => product.title.toLowerCase().includes(normalizedProductSearch))
      : products
    const suggestedProducts = products
      .filter((product) => !items.some((item) => item.product_id === product.id))
      .slice(0, 3)

    return {
      uncheckedItems,
      checkedItems,
      checkedTotal,
      total,
      remainingTotal,
      progress,
      filteredProducts,
      suggestedProducts,
    }
  }, [items, productSearch, products])
}
