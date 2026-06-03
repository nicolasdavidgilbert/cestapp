'use client'

import { useMemo } from 'react'
import type { DashboardListsDerivedState, DashboardListsDerivedStateInput } from '@/src/features/dashboard/types'

export function useDashboardListsDerivedState({ lists, search }: DashboardListsDerivedStateInput): DashboardListsDerivedState {
  return useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const filteredLists = normalizedSearch
      ? lists.filter((list) => list.name.toLowerCase().includes(normalizedSearch))
      : lists

    return { filteredLists }
  }, [lists, search])
}
