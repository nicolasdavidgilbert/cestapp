import type { SetStateAction } from 'react'

export type CollectionLoadOptions = {
  force?: boolean
  keepCurrentUI?: boolean
}

export type CollectionLoadResult<T> = {
  data?: T[]
  error?: unknown
}

export type CollectionUpdater<T> = (value: SetStateAction<T[]>) => void
