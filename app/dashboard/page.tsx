'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { insforge } from '@/lib/insforge'
import MobileDashboardNav from '@/app/dashboard/_components/MobileDashboardNav'
import { CreateListModal } from '@/components/dashboard/CreateListModal'
import { DashboardListCard } from '@/components/dashboard/DashboardListCard'
import { FloatingActionButton } from '@/components/ui/FloatingActionButton'

type ShoppingList = {
  id: string
  name: string
  owner_id: string
}

type ShoppingListShare = {
  list_id: string
  user_id: string
}

type DashboardList = ShoppingList & {
  access: 'owner' | 'shared'
  role?: string
}

type RealtimePayload = {
  meta?: {
    channel?: string
  }
}

type ListsCacheEntry = {
  savedAt: number
  lists: DashboardList[]
}

type AuthErrorLike = {
  status?: unknown
  statusCode?: unknown
  error?: unknown
  message?: unknown
}

const LISTS_CACHE_TTL_MS = 5 * 60 * 1000
const LISTS_MIN_REFETCH_GAP_MS = 8 * 1000
const LISTS_CACHE_PREFIX = 'dashboard_lists_cache_v1:'

function isAuthError(error: unknown) {
  if (typeof error === 'string') {
    const normalized = error.toLowerCase()
    return normalized.includes('invalid token') || normalized.includes('unauthorized') || normalized.includes('token expired') || normalized.includes('session invalid')
  }

  const details = (error ?? {}) as AuthErrorLike
  const status = typeof details.status === 'number' ? details.status : typeof details.statusCode === 'number' ? details.statusCode : null
  const code = typeof details.error === 'string' ? details.error.toLowerCase() : ''
  const message = typeof details.message === 'string' ? details.message.toLowerCase() : error instanceof Error ? error.message.toLowerCase() : ''

  return (
    status === 401 ||
    status === 403 ||
    code === 'invalid_token' ||
    code === 'unauthorized' ||
    code === 'token_expired' ||
    message.includes('invalid token') ||
    message.includes('unauthorized') ||
    message.includes('token expired') ||
    message.includes('session invalid')
  )
}

function getListsCacheKey(userId: string) {
  return `${LISTS_CACHE_PREFIX}${userId}`
}

function readCachedLists(userId: string): DashboardList[] | null {
  try {
    const raw = localStorage.getItem(getListsCacheKey(userId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as ListsCacheEntry
    if (!parsed?.savedAt || !Array.isArray(parsed?.lists)) return null
    if (Date.now() - parsed.savedAt > LISTS_CACHE_TTL_MS) return null

    return parsed.lists
  } catch {
    return null
  }
}

function writeCachedLists(userId: string, lists: DashboardList[]) {
  try {
    const payload: ListsCacheEntry = { savedAt: Date.now(), lists }
    localStorage.setItem(getListsCacheKey(userId), JSON.stringify(payload))
  } catch {
    // Ignore storage write failures (private mode, quota, etc.)
  }
}

function reconcileLists(previous: DashboardList[], incoming: DashboardList[]) {
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
  const loadListsRef = useRef<((options?: { force?: boolean; keepCurrentUI?: boolean; retried?: boolean }) => Promise<void>) | null>(null)

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

  const loadLists = useCallback(async (options?: { force?: boolean; keepCurrentUI?: boolean; retried?: boolean }) => {
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

    const { data: ownLists, error: ownError } = await insforge.database
      .from('shopping_lists')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })

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

    const { data: shares, error: sharesError } = await insforge.database
      .from('list_shares')
      .select('*')
      .eq('user_id', user.id)

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
      const { data, error: sharedError } = await insforge.database
        .from('shopping_lists')
        .select('*')
        .in('id', sharedIds)
        .order('updated_at', { ascending: false })

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

    const mergedLists: DashboardList[] = [
      ...(ownLists || []).map((list) => ({ ...list, access: 'owner' as const })),
      ...sharedLists.map((list) => ({ ...list, access: 'shared' as const, role: 'editor' })),
    ]

    mergedLists.sort((a, b) => a.name.localeCompare(b.name, 'es'))

    applyLists(mergedLists)
    setError('')
    setLoading(false)
  }, [user, applyLists, refreshUser])

  useEffect(() => {
    loadListsRef.current = loadLists
  }, [loadLists])

  useEffect(() => {
    if (!user) return

    let cancelled = false
    const channel = `user:${user.id}:lists`

    const realtimeHandler = (payload: RealtimePayload) => {
      // The server prefixes meta.channel with "realtime:" — normalise before comparing
      const metaChannel = payload.meta?.channel?.replace(/^realtime:/, '')
      if (metaChannel === channel) {
        void loadLists({ keepCurrentUI: true })
      }
    }

    async function doSubscribe() {
      if (cancelled) return

      if (!insforge.realtime.isConnected) {
        await insforge.realtime.connect()
      }

      if (cancelled) return

      const result = await insforge.realtime.subscribe(channel)
      if (!result.ok) {
        console.error(`[Dashboard] Failed to subscribe to ${channel}:`, result.error?.message)
      }
    }

    const handleConnect = () => {
      if (!cancelled) {
        insforge.realtime.subscribe(channel).then((result) => {
          if (!result.ok) {
            console.error(`[Dashboard] Re-subscribe failed for ${channel}:`, result.error?.message)
          }
        })
      }
    }

    insforge.realtime.on('user_lists_changed', realtimeHandler)
    insforge.realtime.on('connect', handleConnect)

    doSubscribe()

    return () => {
      cancelled = true
      insforge.realtime.off('user_lists_changed', realtimeHandler)
      insforge.realtime.off('connect', handleConnect)
      insforge.realtime.unsubscribe(channel)
    }
  }, [user, loadLists])

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

    const { data, error: createError } = await insforge.database
      .from('shopping_lists')
      .insert([{ name: newListName.trim(), owner_id: user.id }])
      .select()
      .single()

    if (createError) {
      setError(createError.message)
      setCreating(false)
      return
    }

    setNewListName('')
    setCreating(false)
    setShowCreateModal(false)
    if (data?.id) {
      await insforge.realtime.publish(`user:${user.id}:lists`, 'user_lists_changed', {
        list_id: data.id,
        action: 'created',
      })
      router.push(`/dashboard/${data.id}`)
    } else {
      void loadLists({ force: true })
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredLists = normalizedSearch
    ? lists.filter((list) => list.name.toLowerCase().includes(normalizedSearch))
    : lists

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
