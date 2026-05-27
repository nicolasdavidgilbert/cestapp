import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { AppModal, ModalHeader } from '@/components/ui/AppModal'
import { PrimaryButton, TextInput } from '@/components/ui/FormControls'

type NewProductDraft = {
  title: string
  description: string
  price: string
}

type ProductCreateModalProps = {
  open: boolean
  creating: boolean
  newProduct: NewProductDraft
  setNewProduct: Dispatch<SetStateAction<NewProductDraft>>
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}

export function ProductCreateModal({
  open,
  creating,
  newProduct,
  setNewProduct,
  onClose,
  onSubmit,
}: ProductCreateModalProps) {
  const closeIfIdle = () => {
    if (!creating) onClose()
  }

  return (
    <AppModal
      open={open}
      onClose={closeIfIdle}
      overlayClassName="items-end backdrop-blur-sm p-4 sm:items-center sm:p-6"
      panelClassName="w-full max-w-xl animate-in slide-in-from-bottom duration-300 rounded-[2.5rem] p-8"
    >
      <ModalHeader
        title="Nuevo Producto"
        subtitle="Añade tu producto al catálogo"
        onClose={closeIfIdle}
        closeDisabled={creating}
        className="mb-8 border-0 bg-transparent p-0"
      />

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="ml-1 text-xs font-bold uppercase tracking-widest text-secondary">Nombre del producto</label>
          <TextInput
            type="text"
            value={newProduct.title}
            onChange={(event) => setNewProduct({ ...newProduct, title: event.target.value })}
            placeholder="Ej: Leche semidesnatada"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <label className="ml-1 text-xs font-bold uppercase tracking-widest text-secondary">Descripción</label>
          <TextInput
            type="text"
            value={newProduct.description}
            onChange={(event) => setNewProduct({ ...newProduct, description: event.target.value })}
            placeholder="Marca, tamaño o notas..."
          />
        </div>

        <div className="space-y-2">
          <label className="ml-1 text-xs font-bold uppercase tracking-widest text-secondary">Precio inicial (EUR)</label>
          <TextInput
            type="number"
            step="0.01"
            min="0"
            value={newProduct.price}
            onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })}
            placeholder="0.00"
          />
        </div>

        <PrimaryButton type="submit" disabled={creating || !newProduct.title.trim()} className="mt-2 w-full">
          {creating ? 'Creando producto...' : 'Crear producto'}
        </PrimaryButton>
      </form>
    </AppModal>
  )
}
