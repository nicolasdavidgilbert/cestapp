'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/src/store/UserContext'
import MobileDashboardNav from '@/src/layout/MobileDashboardNav'
import { CreateListModal } from '@/src/features/dashboard/components/CreateListModal'
import { DashboardListCard } from '@/src/features/dashboard/components/DashboardListCard'
import { FloatingActionButton } from '@/src/components/atoms/FloatingActionButton'
import type { DashboardList, LoadListsHandler, LoadListsOptions, ShoppingList, ShoppingListShare } from '@/src/features/dashboard/types'
import { isAuthError } from '@/src/utils/authErrors'
import { readLocalCache, writeLocalCache } from '@/src/utils/localCache'
import { createShoppingList, fetchListShares, fetchOwnLists, fetchSharedLists, mergeDashboardLists, publishDashboardListEvent, reconcileLists } from '@/src/features/dashboard/services/listsService'
import { useDashboardListsRealtime } from '@/src/features/dashboard/hooks/useDashboardListsRealtime'
import { useDashboardListsDerivedState } from '@/src/features/dashboard/hooks/useDashboardListsDerivedState'

const LISTS_CACHE_TTL_MS = 5 * 60 * 1000
const LISTS_MIN_REFETCH_GAP_MS = 8 * 1000
const LISTS_CACHE_PREFIX = 'dashboard_lists_cache_v1:'

function getListsCacheKey(userId: string) {
  return `${LISTS_CACHE_PREFIX}${userId}`
}

function readCachedLists(userId: string): DashboardList[] | null {
  return readLocalCache<DashboardList[]>(getListsCacheKey(userId), LISTS_CACHE_TTL_MS, 'lists')
}

function writeCachedLists(userId: string, lists: DashboardList[]) {
  writeLocalCache(getListsCacheKey(userId), lists, 'lists')
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading, refreshUser } = useUser()
  const [lists, setLists] = useState<DashboardList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [newListName, setNewListName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const lastFetchAtRef = useRef(0)
  const hydratedFromCacheRef = useRef(false)
  const loadListsRef = useRef<LoadListsHandler | null>(null)

  const applyLists = useCallback(
    (nextLists: DashboardList[]) => {
      if (!user) return

      setLists((previous) => {
        const reconciled = reconcileLists(previous, nextLists)
        if (reconciled !== previous) {
          writeCachedLists(user.id, reconciled)
        }
        return reconciled
      })
    },
    [user]
  )

  const loadLists = useCallback(async (options?: LoadListsOptions) => {
    if (!user) return
    const force = options?.force ?? false
    const keepCurrentUI = options?.keepCurrentUI ?? false
    const retried = options?.retried ?? false
    const now = Date.now()
    if (!force && now - lastFetchAtRef.current < LISTS_MIN_REFETCH_GAP_MS) {
      return
    }
    lastFetchAtRef.current = now

    if (!keepCurrentUI) {
      setLoading(true)
    }

    const { data: ownLists, error: ownError } = await fetchOwnLists(user.id)

    if (ownError) {
      if (isAuthError(ownError) && !retried) {
        await refreshUser()
        lastFetchAtRef.current = 0
        return loadListsRef.current?.({ force: true, keepCurrentUI: true, retried: true })
      }

      setError(ownError.message)
      applyLists([])
      setLoading(false)
      return
    }

    const { data: shares, error: sharesError } = await fetchListShares(user.id)

    if (sharesError) {
      if (isAuthError(sharesError) && !retried) {
        await refreshUser()
        lastFetchAtRef.current = 0
        return loadListsRef.current?.({ force: true, keepCurrentUI: true, retried: true })
      }

      setError(sharesError.message)
      applyLists((ownLists || []).map((list) => ({ ...list, access: 'owner' as const })))
      setLoading(false)
      return
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
        if (isAuthError(sharedError) && !retried) {
          await refreshUser()
          lastFetchAtRef.current = 0
          return loadListsRef.current?.({ force: true, keepCurrentUI: true, retried: true })
        }

        setError(sharedError.message)
      } else {
        sharedLists = data || []
      }
    }

    const mergedLists = mergeDashboardLists(ownLists || [], (shares as ShoppingListShare[]) || [], sharedLists)

    applyLists(mergedLists)
    setError('')
    setLoading(false)
  }, [user, applyLists, refreshUser])

  useEffect(() => {
    loadListsRef.current = loadLists
  }, [loadLists])

  const handleDashboardListsChanged = useCallback(() => {
    void loadLists({ keepCurrentUI: true })
  }, [loadLists])

  useDashboardListsRealtime({
    userId: user?.id,
    onListsChanged: handleDashboardListsChanged,
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) {
      const cachedLists = readCachedLists(user.id)
      if (cachedLists) {
        hydratedFromCacheRef.current = true
        queueMicrotask(() => {
          applyLists(cachedLists)
        })
      } else {
        hydratedFromCacheRef.current = false
      }

      queueMicrotask(() => {
        void loadLists({ force: true, keepCurrentUI: hydratedFromCacheRef.current })
      })
    }
  }, [user, loadLists, applyLists])

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
    return (
      <main className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-secondary" />
          <p className="text-sm font-bold uppercase tracking-widest text-secondary">Sincronizando listas</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="min-h-screen w-full px-4 sm:px-6 py-8 pb-40">
        <div className="mx-auto w-full max-w-4xl space-y-10">
          <header className="flex min-h-[9rem] flex-col justify-between gap-6 sm:min-h-[9.5rem]">
            <div className="space-y-1.5 px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">Tu Centro de Control</span>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60">
                Mis Listas
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="group relative flex-1">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-muted-foreground group-focus-within:text-secondary transition-colors">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Busca por nombre de lista..."
                  className="w-full rounded-2xl border border-border bg-muted/20 py-4 pl-14 pr-6 text-sm text-foreground placeholder-muted-foreground outline-none backdrop-blur-md transition-all focus:border-secondary/50 focus:bg-muted/40 focus:ring-4 focus:ring-secondary/10"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground shadow-xl shadow-secondary/20 transition-all hover:scale-105 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </header>

          {error && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-6 py-4 text-sm font-medium text-destructive backdrop-blur-md">
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            </div>
          )}

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
            <section className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="h-20 w-20 flex items-center justify-center rounded-3xl bg-muted/20 text-muted-foreground ring-1 ring-border/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground">
                  {lists.length === 0 ? 'Todavía no tienes listas' : 'Sin resultados'}
                </h2>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  {lists.length === 0
                    ? 'Comienza creando tu primera lista de la compra ahora mismo.'
                    : 'Prueba con otros términos de búsqueda.'}
                </p>
              </div>
              {lists.length === 0 && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center justify-center rounded-xl bg-muted/20 px-6 py-3 text-sm font-bold text-foreground ring-1 ring-border/20 transition-all hover:bg-muted/40 active:scale-95"
                >
                  Crear mi primera lista
                </button>
              )}
            </section>
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
