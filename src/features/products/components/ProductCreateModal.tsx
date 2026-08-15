import { AppModal, ModalHeader } from '@/src/components/organisms/AppModal'
import { PrimaryButton } from '@/src/components/atoms/FormControls'
import { ProductFields } from '@/src/features/products/components/ProductFields'
import type { ProductCreateModalProps } from '@/src/features/products/types'

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
        <ProductFields
          value={newProduct}
          onChange={(field, value) => setNewProduct((current) => ({ ...current, [field]: value }))}
          showDescription
          showPrice
          autoFocus
          titlePlaceholder="Ej: Leche semidesnatada"
          pricePlaceholder="0.00"
        />

        <PrimaryButton type="submit" disabled={creating || !newProduct.title.trim()} className="mt-2 w-full">
          {creating ? 'Creando producto...' : 'Crear producto'}
        </PrimaryButton>
      </form>
    </AppModal>
  )
}
