import React from 'react'

type ToastProps = {
  message?: string | null
}

export function Toast({ message }: ToastProps) {
  if (!message) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-2xl border border-border bg-foreground px-4 py-3 text-xs font-bold text-background shadow-xl">
      {message}
    </div>
  )
}
