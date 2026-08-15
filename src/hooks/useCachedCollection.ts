'use client'

import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import type {
  CollectionLoadOptions,
  CollectionLoadResult,
  CollectionUpdater,
} from '@/src/types/collection'
import { isAuthError } from '@/src/utils/authErrors'
import { readLocalCache, writeLocalCache } from '@/src/utils/localCache'

type UseCachedCollectionOptions<T> = {
  userId?: string
  cachePrefix: string
  legacyValueKey?: string
  ttlMs: number
  minRefetchGapMs: number
  load: (userId: string) => Promise<CollectionLoadResult<T>>
  reconcile: (previous: T[], incoming: T[]) => T[]
  refreshUser: () => Promise<void>
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : typeof (error as { message?: unknown } | null)?.message === 'string'
      ? (error as { message: string }).message
      : 'No se pudieron cargar los datos.'
}

export function useCachedCollection<T>({
  userId,
  cachePrefix,
  legacyValueKey,
  ttlMs,
  minRefetchGapMs,
  load,
  reconcile,
  refreshUser,
}: UseCachedCollectionOptions<T>) {
  const [items, setItemsState] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const lastFetchAtRef = useRef(0)
  const activeUserIdRef = useRef(userId)
  const previousCacheKeyRef = useRef<string | null>(null)

  activeUserIdRef.current = userId

  const cacheKey = userId ? cachePrefix + userId : undefined

  const writeCache = useCallback((nextItems: T[]) => {
    if (cacheKey) writeLocalCache(cacheKey, nextItems, legacyValueKey)
  }, [cacheKey, legacyValueKey])

  const setItems: CollectionUpdater<T> = useCallback((value: SetStateAction<T[]>) => {
    setItemsState((previous) => {
      const nextItems = typeof value === 'function'
        ? (value as (current: T[]) => T[])(previous)
        : value
      writeCache(nextItems)
      return nextItems
    })
  }, [writeCache])

  const applyItems = useCallback((incoming: T[]) => {
    setItemsState((previous) => {
      const nextItems = reconcile(previous, incoming)
      if (nextItems !== previous) writeCache(nextItems)
      return nextItems
    })
  }, [reconcile, writeCache])

  const reload = useCallback(async (options?: CollectionLoadOptions) => {
    if (!userId) return

    const force = options?.force ?? false
    const keepCurrentUI = options?.keepCurrentUI ?? false
    const now = Date.now()
    if (!force && now - lastFetchAtRef.current < minRefetchGapMs) return
    lastFetchAtRef.current = now
    if (!keepCurrentUI) setLoading(true)

    try {
      let result = await load(userId)
      if (result.error && isAuthError(result.error)) {
        await refreshUser()
        lastFetchAtRef.current = Date.now()
        result = await load(userId)
      }

      if (activeUserIdRef.current !== userId) return

      if (result.data) applyItems(result.data)
      else if (result.error) applyItems([])

      setError(result.error ? errorMessage(result.error) : '')
    } catch (loadError) {
      if (activeUserIdRef.current === userId) {
        applyItems([])
        setError(errorMessage(loadError))
      }
    } finally {
      if (activeUserIdRef.current === userId) setLoading(false)
    }
  }, [applyItems, load, minRefetchGapMs, refreshUser, userId])

  useEffect(() => {
    if (previousCacheKeyRef.current !== cacheKey) {
      previousCacheKeyRef.current = cacheKey ?? null
      lastFetchAtRef.current = 0
      setItemsState([])
      setError('')
    }

    if (!userId || !cacheKey) {
      setLoading(true)
      return
    }

    const cachedItems = readLocalCache<T[]>(cacheKey, ttlMs, legacyValueKey)
    if (cachedItems) applyItems(cachedItems)

    queueMicrotask(() => {
      void reload({ force: true, keepCurrentUI: Boolean(cachedItems) })
    })
  }, [applyItems, cacheKey, legacyValueKey, reload, ttlMs, userId])

  return {
    items,
    setItems,
    applyItems,
    loading,
    error,
    setError,
    reload,
  }
}
