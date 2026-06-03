import type { CheckedListItemRowProps, ListItemRowProps } from '@/src/features/dashboard/types'

export function PendingListItemRow({ item, updating, onToggleChecked, onUpdateQuantity, onRemove }: ListItemRowProps) {
  return (
    <div className="group relative flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 p-3 backdrop-blur-sm transition-all hover:bg-muted/40 sm:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => onToggleChecked(item)}
          disabled={updating}
          className={`group/check relative flex h-7 w-7 items-center justify-center rounded-xl border-2 border-border bg-muted/20 text-transparent transition-all hover:border-secondary/50 active:scale-90 ${updating ? 'opacity-50 cursor-wait' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-4 h-4 group-hover/check:text-secondary/20">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h4 className="truncate text-sm font-bold text-foreground tracking-tight">{item.product?.title || 'Producto desconocido'}</h4>
          <p className="text-xs font-semibold text-secondary/60">
            {item.product?.current_price ? `${(item.product.current_price * item.quantity).toFixed(2)} EUR` : 'Sin precio'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-6">
        <div className={`flex items-center gap-1.5 rounded-xl border border-border bg-muted/20 p-1 ring-1 ring-border/20 ${updating ? 'opacity-50 pointer-events-none' : ''}`}>
          <button
            type="button"
            onClick={() => onUpdateQuantity(item, -1)}
            disabled={updating}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
            </svg>
          </button>
          <span className="w-6 text-center text-xs font-bold text-foreground">{item.quantity}</span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(item, 1)}
            disabled={updating}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/20 hover:text-primary transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={updating}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground disabled:opacity-30 sm:h-8 sm:w-8"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export function CheckedListItemRow({ item, updating, onToggleChecked }: CheckedListItemRowProps) {
  return (
    <div className="group relative flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4 transition-all hover:bg-muted/50">
      <div className="flex items-center gap-4 flex-1">
        <button
          type="button"
          onClick={() => onToggleChecked(item)}
          disabled={updating}
          className={`flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-90 ${updating ? 'opacity-50 cursor-wait' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </button>
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-foreground/75 tracking-tight line-through decoration-primary/50">{item.product?.title}</h4>
          <p className="text-xs font-semibold text-muted-foreground">
            {item.product?.current_price ? `${(item.product.current_price * item.quantity).toFixed(2)} EUR` : '-'}
          </p>
        </div>
      </div>
      <span className="text-xs font-black text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-full">{item.quantity} ud.</span>
    </div>
  )
}
