import { AppModal, ModalHeader } from '@/src/components/organisms/AppModal'
import { PrimaryButton, TextInput } from '@/src/components/atoms/FormControls'
import { ProductFields } from '@/src/features/products/components/ProductFields'
import type { AddProductModalProps } from '@/src/features/dashboard/types'

export function AddProductModal({
  open,
  products,
  filteredProducts,
  items,
  productSearch,
  setProductSearch,
  quickProductPrice,
  setQuickProductPrice,
  newProduct,
  setNewProduct,
  creatingProduct,
  onClose,
  onAddExistingProduct,
  onCreateMissingProduct,
  onCreateAndAddProduct,
}: AddProductModalProps) {
  const addedProductIds = new Set(items.map((item) => item.product_id))
  const orderedFilteredProducts = [
    ...filteredProducts.filter((product) => !addedProductIds.has(product.id)),
    ...filteredProducts.filter((product) => addedProductIds.has(product.id)),
  ]

  return (
    <AppModal
      open={open}
      onClose={onClose}
      panelClassName="w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-[2.5rem] overflow-hidden"
    >
      <ModalHeader
        title="Gestionar Productos"
        subtitle="Añade o crea nuevos ítems"
        onClose={onClose}
        closeButtonClassName="h-12 w-12 rounded-2xl"
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-10">
        <div className="space-y-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">Tu Catálogo</span>
          <div className="relative">
            <TextInput
              type="text"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Buscar producto..."
              className="pr-12"
              autoFocus
            />
            {productSearch && (
              <button
                type="button"
                onClick={() => {
                  setProductSearch('')
                  setQuickProductPrice('')
                }}
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-destructive transition-all hover:bg-destructive/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {products.length === 0 ? (
              <p className="col-span-full py-10 text-center text-xs text-muted-foreground italic">No tienes productos guardados en tu catálogo.</p>
            ) : filteredProducts.length === 0 ? (
              <form onSubmit={onCreateMissingProduct} className="col-span-full rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{productSearch.trim()}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nuevo producto</p>
                  </div>
                  <TextInput
                    type="text"
                    value={quickProductPrice}
                    onChange={(event) => setQuickProductPrice(event.target.value)}
                    placeholder="Precio"
                    inputSize="compact"
                    className="sm:w-28"
                  />
                  <button
                    type="submit"
                    disabled={creatingProduct || !productSearch.trim()}
                    className="rounded-xl bg-foreground px-4 py-2 text-xs font-bold text-background transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  >
                    {creatingProduct ? 'Creando...' : 'Crear y añadir'}
                  </button>
                </div>
              </form>
            ) : (
              orderedFilteredProducts.map((product) => {
                const isAdded = addedProductIds.has(product.id)
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => onAddExistingProduct(product.id)}
                    className="flex items-center justify-between rounded-[1.25rem] border border-border bg-muted/40 p-4 text-left transition-all hover:bg-muted/60 hover:border-secondary/20"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-foreground leading-tight">{product.title}</p>
                      <p className="text-[10px] font-bold text-secondary">{product.current_price ? `${product.current_price.toFixed(2)} EUR` : 'S/P'}</p>
                    </div>
                    <div className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all ${isAdded ? 'bg-primary text-primary-foreground' : 'bg-muted/20 text-muted-foreground'}`}>
                      {isAdded ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="space-y-6 pt-4 border-t border-border">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">Nuevo Producto Rápido</span>
          <form onSubmit={onCreateAndAddProduct} className="grid gap-4">
            <ProductFields
              value={newProduct}
              onChange={(field, value) => setNewProduct((current) => ({ ...current, [field]: value }))}
              showPrice
              showLabels={false}
              className="sm:grid-cols-2"
            />
            <PrimaryButton
              type="submit"
              disabled={creatingProduct || !newProduct.title.trim()}
              tone="foreground"
              className="w-full animate-pulse-once"
            >
              {creatingProduct ? 'Creando...' : 'Crear y Añadir'}
            </PrimaryButton>
          </form>
        </div>
      </div>
    </AppModal>
  )
}
