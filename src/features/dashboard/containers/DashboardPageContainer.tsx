'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import MobileDashboardNav from '@/src/layout/MobileDashboardNav'
import { CreateListModal } from '@/src/features/dashboard/components/CreateListModal'
import { DashboardListCard } from '@/src/features/dashboard/components/DashboardListCard'
import { FloatingActionButton } from '@/src/components/atoms/FloatingActionButton'
import { EmptyState, InlineAlert, ProtectedPageLoader } from '@/src/components/atoms/AsyncPageState'
import { CollectionPageHeader } from '@/src/components/organisms/CollectionPageHeader'
import type { DashboardList, ShoppingList, ShoppingListShare } from '@/src/features/dashboard/types'
import type { CollectionLoadResult } from '@/src/types/collection'
import { createShoppingList, fetchListShares, fetchOwnLists, fetchSharedLists, mergeDashboardLists, publishDashboardListEvent, reconcileLists } from '@/src/features/dashboard/services/listsService'
import { useDashboardListsRealtime } from '@/src/features/dashboard/hooks/useDashboardListsRealtime'
import { useDashboardListsDerivedState } from '@/src/features/dashboard/hooks/useDashboardListsDerivedState'
import { useCachedCollection } from '@/src/hooks/useCachedCollection'
import { useProtectedUser } from '@/src/hooks/useProtectedUser'

const LISTS_CACHE_TTL_MS = 5 * 60 * 1000
const LISTS_MIN_REFETCH_GAP_MS = 8 * 1000
const LISTS_CACHE_PREFIX = 'dashboard_lists_cache_v1:'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading, refreshUser } = useProtectedUser()
  const [search, setSearch] = useState('')
  const [newListName, setNewListName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const fetchDashboardLists = useCallback(async (userId: string): Promise<CollectionLoadResult<DashboardList>> => {
    const { data: ownLists, error: ownError } = await fetchOwnLists(userId)

    if (ownError) {
      return { error: ownError }
    }

    const { data: shares, error: sharesError } = await fetchListShares(userId)
    const ownedLists = (ownLists || []).map((list) => ({ ...list, access: 'owner' as const }))

    if (sharesError) {
      return { data: ownedLists, error: sharesError }
    }

    const ownListIds = new Set((ownLists || []).map((list) => list.id))
    const sharedShares = (shares as ShoppingListShare[]).filter(
      (share) => !ownListIds.has(share.list_id)
    )

    let sharedLists: ShoppingList[] = []
    if (sharedShares.length > 0) {
      const sharedIds = Array.from(new Set(sharedShares.map((share) => share.list_id)))
      const { data, error: sharedError } = await fetchSharedLists(sharedIds)

      if (sharedError) {
        return {
          data: mergeDashboardLists(ownLists || [], (shares as ShoppingListShare[]) || [], []),
          error: sharedError,
        }
      } else {
        sharedLists = data || []
      }
    }

    const mergedLists = mergeDashboardLists(ownLists || [], (shares as ShoppingListShare[]) || [], sharedLists)

    return { data: mergedLists }
  }, [])

  const {
    items: lists,
    loading,
    error,
    setError,
    reload: loadLists,
  } = useCachedCollection<DashboardList>({
    userId: user?.id,
    cachePrefix: LISTS_CACHE_PREFIX,
    legacyValueKey: 'lists',
    ttlMs: LISTS_CACHE_TTL_MS,
    minRefetchGapMs: LISTS_MIN_REFETCH_GAP_MS,
    load: fetchDashboardLists,
    reconcile: reconcileLists,
    refreshUser,
  })

  const handleDashboardListsChanged = useCallback(() => {
    void loadLists({ keepCurrentUI: true })
  }, [loadLists])

  useDashboardListsRealtime({
    userId: user?.id,
    onListsChanged: handleDashboardListsChanged,
  })

  async function createList(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !newListName.trim()) return

    setCreating(true)
    setError('')

    const { data, error: createError } = await createShoppingList(newListName.trim(), user.id)

    if (createError) {
      setError(createError.message)
      setCreating(false)
      return
    }

    setNewListName('')
    setCreating(false)
    setShowCreateModal(false)
    if (data?.id) {
      await publishDashboardListEvent(user.id, data.id, 'created')
      router.push(`/dashboard/${data.id}`)
    } else {
      void loadLists({ force: true })
    }
  }

  const { filteredLists } = useDashboardListsDerivedState({ lists, search })

  if (authLoading || !user) {
    return <ProtectedPageLoader label="Sincronizando listas" />
  }

  return (
    <>
      <main className="min-h-screen w-full px-4 sm:px-6 py-8 pb-40">
        <div className="mx-auto w-full max-w-4xl space-y-10">
          <CollectionPageHeader
            eyebrow="Tu Centro de Control"
            title="Mis Listas"
            search={search}
            searchPlaceholder="Busca por nombre de lista..."
            onSearchChange={setSearch}
            onCreate={() => setShowCreateModal(true)}
          />

          <InlineAlert message={error} />

          {loading && lists.length === 0 ? (
            <section className="grid gap-6 sm:grid-cols-2">
              {[0, 1, 2, 3].map((skeleton) => (
                <div
                  key={skeleton}
                  className="h-40 animate-pulse rounded-[2rem] border border-border bg-muted/20"
                />
              ))}
            </section>
          ) : filteredLists.length === 0 ? (
            <EmptyState
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title={lists.length === 0 ? 'Todavía no tienes listas' : 'Sin resultados'}
              description={lists.length === 0
                ? 'Comienza creando tu primera lista de la compra ahora mismo.'
                : 'Prueba con otros términos de búsqueda.'}
              actionLabel={lists.length === 0 ? 'Crear mi primera lista' : undefined}
              onAction={lists.length === 0 ? () => setShowCreateModal(true) : undefined}
            />
          ) : (
            <section className="grid gap-6 sm:grid-cols-2">
              {filteredLists.map((list) => (
                <DashboardListCard key={list.id} list={list} />
              ))}
            </section>
          )}
        </div>
      </main>

      <FloatingActionButton
        visible={!showCreateModal}
        ariaLabel="Crear lista nueva"
        onClick={() => setShowCreateModal(true)}
        className="bottom-28 !z-[60]"
      />

      <CreateListModal
        open={showCreateModal}
        creating={creating}
        listName={newListName}
        onListNameChange={setNewListName}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createList}
      />

      <MobileDashboardNav />
    </>
  )
}
