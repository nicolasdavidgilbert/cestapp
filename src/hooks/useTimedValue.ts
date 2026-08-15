'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useTimedValue<T>(initialValue: T, defaultDurationMs: number) {
  const [value, setValue] = useState<T>(initialValue)
  const timeoutRef = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setValue(initialValue)
  }, [initialValue])

  const show = useCallback((nextValue: T, durationMs = defaultDurationMs) => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    setValue(nextValue)
    timeoutRef.current = window.setTimeout(() => {
      setValue(initialValue)
      timeoutRef.current = null
    }, durationMs)
  }, [defaultDurationMs, initialValue])

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
  }, [])

  return { value, show, clear, setValue }
}
