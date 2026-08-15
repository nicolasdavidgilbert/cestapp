import type { ReactNode } from 'react'
import { cn } from '@/src/utils/classNames'

export function ProtectedPageLoader({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-secondary" />
        <p className="text-sm font-bold uppercase tracking-widest text-secondary">{label}</p>
      </div>
    </main>
  )
}

export function InlineAlert({
  message,
  compact = false,
}: {
  message?: string
  compact?: boolean
}) {
  if (!message) return null

  return (
    <div
      className={cn(
        'rounded-2xl border border-destructive/20 bg-destructive/10 text-sm font-medium text-destructive',
        compact ? 'px-4 py-3' : 'px-6 py-4 backdrop-blur-md',
      )}
    >
      {message}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <section className="flex flex-col items-center justify-center py-20 text-center space-y-6">
      <div className="h-20 w-20 flex items-center justify-center rounded-3xl bg-muted/20 text-muted-foreground ring-1 ring-border/20">
        {icon}
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center rounded-xl bg-muted/20 px-6 py-3 text-sm font-bold text-foreground ring-1 ring-border/20 transition-all hover:bg-muted/40 active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </section>
  )
}
