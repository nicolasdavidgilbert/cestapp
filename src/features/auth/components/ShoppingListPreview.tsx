import { cn } from '@/src/utils/classNames'

export type ShoppingListPreviewItem = {
  label: string
  quantity: string
  done: boolean
}

export function ShoppingListPreview({
  items,
  variant = 'hero',
  animated = false,
}: {
  items: ShoppingListPreviewItem[]
  variant?: 'compact' | 'hero'
  animated?: boolean
}) {
  const compact = variant === 'compact'

  return (
    <div
      className={cn(
        'border border-border shadow-2xl backdrop-blur-2xl',
        compact
          ? 'rounded-[2.5rem] bg-muted p-6'
          : 'relative rounded-[2.5rem] bg-muted/20 p-6 [background:linear-gradient(135deg,rgba(var(--foreground-rgb),0.05),rgba(var(--foreground-rgb),0.02))]',
        animated && 'animate-pulse',
      )}
    >
      <div className={cn('flex items-center justify-between', compact ? 'mb-4' : 'mb-6 border-b border-border pb-4')}>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Lista Semanal</h3>
          {!compact && <p className="text-xs text-muted-foreground">Sincronizado hace un momento</p>}
        </div>
        {compact ? (
          <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground">{items.length} items</span>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/20 text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
        )}
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.label}
            className={cn(
              'flex items-center justify-between rounded-2xl border border-border bg-muted/20 px-4 transition-all hover:bg-muted/40',
              compact ? 'py-3' : 'group py-3.5',
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex items-center justify-center rounded-lg border font-bold transition-all',
                  compact ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-xs',
                  item.done
                    ? compact
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-secondary bg-secondary text-secondary-foreground'
                    : 'border-border bg-muted/20 text-transparent',
                )}
              >
                ✓
              </div>
              <span className={cn('text-sm font-medium transition-all', item.done ? 'text-muted-foreground line-through decoration-secondary/50' : 'text-foreground')}>
                {item.label}
              </span>
            </div>
            <span className={cn('rounded-full bg-secondary/10 text-[11px] font-bold text-secondary', compact ? 'px-2 py-0.5' : 'px-2.5 py-1')}>
              {item.quantity}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
