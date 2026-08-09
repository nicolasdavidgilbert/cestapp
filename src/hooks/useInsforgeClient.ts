'use client'

import { useSyncExternalStore } from 'react'
import {
  getInsforgeClientSnapshot,
  subscribeToInsforgeClient,
} from '@/src/services/insforge'

export function useInsforgeClient() {
  return useSyncExternalStore(
    subscribeToInsforgeClient,
    getInsforgeClientSnapshot,
    getInsforgeClientSnapshot,
  )
}
