import type { FormEvent } from 'react'
import { AppModal, ModalHeader } from '@/src/components/organisms/AppModal'
import { PrimaryButton, TextInput } from '@/src/components/atoms/FormControls'
import type { ProductEditorModalProps } from '@/src/features/products/types'

export function ProductEditorModal({
  open,
  product,
  editorForm,
  setEditorForm,
  savingProduct,
  priceHistory,
  editingHistory,
  setEditingHistory,
  newHistoryPrice,
  setNewHistoryPrice,
  addingHistory,
  savingHistoryId,
  deletingHistoryId,
  onClose,
  onSaveProduct,
  onAddHistoryPrice,
  onSaveHistoryEntry,
  onDeleteHistoryEntry,
}: ProductEditorModalProps) {
  if (!product) return null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSaveProduct()
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      overlayClassName="bg-background/90 p-0 sm:p-6 lg:p-12"
      panelClassName="w-full max-w-5xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-[2.5rem] overflow-hidden"
    >
      <ModalHeader
        title="Detalle del Producto"
        subtitle={`ID: ${product.id.slice(0, 8)}`}
        onClose={onClose}
        className="p-6 sm:p-8"
        closeButtonClassName="h-12 w-12 rounded-2xl"
      />

      <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8 sm:space-y-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">Atributos Básicos</span>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground ml-1">Nombre</label>
              <TextInput
                type="text"
                value={editorForm.title}
                onChange={(event) => setEditorForm({ ...editorForm, title: event.target.value })}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground ml-1">Descripción</label>
              <TextInput
                type="text"
                value={editorForm.description}
                onChange={(event) => setEditorForm({ ...editorForm, description: event.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <PrimaryButton
            type="submit"
            disabled={savingProduct || !editorForm.title.trim()}
            tone="foreground"
            className="px-8 py-3 text-sm"
          >
            {savingProduct ? 'Guardando...' : 'Actualizar Información'}
          </PrimaryButton>
        </form>

        <section className="space-y-6 pt-10 border-t border-border">
          <div className="flex items-end justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">Historial de Precios</span>
            <div className="text-right">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Valor de Mercado Actual</p>
              <p className="text-3xl font-black text-primary">
                {product.current_price !== null ? `${product.current_price.toFixed(2)}` : '-'}
                <span className="text-xs ml-1">EUR</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row bg-muted/20 p-5 sm:p-6 rounded-3xl ring-1 ring-border/20">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-bold text-muted-foreground ml-1">Nuevo Punto de Precio</label>
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={newHistoryPrice}
                onChange={(event) => setNewHistoryPrice(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <button
              type="button"
              onClick={onAddHistoryPrice}
              disabled={!newHistoryPrice || addingHistory}
              className="group relative flex items-center justify-center overflow-hidden rounded-2xl bg-secondary px-8 py-4 text-sm font-bold text-secondary-foreground shadow-xl shadow-secondary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 self-end"
            >
              {addingHistory ? 'Registrando...' : 'Registrar Precio'}
            </button>
          </div>

          <div className="space-y-3">
            {priceHistory.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted-foreground font-medium italic bg-muted/20 rounded-[2rem]">Sin registros históricos aún.</p>
            ) : (
              <div className="grid gap-3">
                {priceHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between rounded-2xl bg-muted/40 p-4 ring-1 ring-border/20 hover:bg-muted/60 transition-all"
                  >
                    <div className="space-y-1 min-w-[140px]">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Fecha de Registro</p>
                      <p className="text-xs font-bold text-foreground">
                        {new Date(entry.created_at).toLocaleDateString()} · {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex flex-1 items-center gap-3">
                      <input
                        type="number"
                        step="0.01"
                        value={editingHistory[entry.id] ?? ''}
                        onChange={(event) => setEditingHistory({ ...editingHistory, [entry.id]: event.target.value })}
                        className="h-10 grow rounded-xl border border-border bg-muted/20 px-4 text-sm text-foreground outline-none focus:border-secondary/40"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSaveHistoryEntry(entry.id)}
                          disabled={savingHistoryId === entry.id}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 text-primary hover:bg-primary/20 transition-all"
                          title="Guardar cambios"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteHistoryEntry(entry.id)}
                          disabled={deletingHistoryId === entry.id}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 text-destructive hover:bg-destructive/20 transition-all"
                          title="Eliminar entrada"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppModal>
  )
}
