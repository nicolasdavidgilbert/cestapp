'use client'

import { useMemo } from 'react'
import type { ProductsDerivedState, ProductsDerivedStateInput } from '@/src/features/products/types'

export function useProductsDerivedState({ products, search }: ProductsDerivedStateInput): ProductsDerivedState {
  return useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const filteredProducts = normalizedSearch
      ? products.filter((product) => {
          const title = product.title.toLowerCase()
          const description = product.description?.toLowerCase() ?? ''
          return title.includes(normalizedSearch) || description.includes(normalizedSearch)
        })
      : products

    return { filteredProducts }
  }, [products, search])
}
