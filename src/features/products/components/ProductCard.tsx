import type { ProductCardProps } from '@/src/features/products/types'

export function ProductCard({ product, onOpen }: ProductCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      className="group relative flex flex-col items-start rounded-[2rem] border border-border bg-muted/20 p-6 text-left backdrop-blur-sm transition-all hover:bg-muted/40 hover:border-secondary/30 hover:-translate-y-1"
    >
      <div className="w-full flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground leading-tight tracking-tight group-hover:text-secondary transition-colors">{product.title}</h3>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Actualizado: {new Date(product.updated_at).toLocaleDateString()}
          </p>
        </div>
        <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-muted/40 text-secondary ring-1 ring-border/20 transition-all group-hover:bg-secondary group-hover:text-secondary-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        </div>
      </div>

      {product.description && (
        <p className="mt-4 line-clamp-2 text-xs font-medium text-muted-foreground leading-relaxed">
          {product.description}
        </p>
      )}

      <div className="mt-8 pt-6 border-t border-border w-full flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Último Precio</span>
        <span className="text-xl font-black text-foreground">
          {product.current_price !== null ? `${product.current_price.toFixed(2)}` : '-'}
          <span className="text-[10px] ml-1 text-secondary">EUR</span>
        </span>
      </div>
    </button>
  )
}
