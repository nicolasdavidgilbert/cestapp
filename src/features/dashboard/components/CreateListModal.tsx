import { AppModal, ModalHeader } from '@/src/components/organisms/AppModal'
import { PrimaryButton, TextInput } from '@/src/components/atoms/FormControls'
import type { CreateListModalProps } from '@/src/features/dashboard/types'

export function CreateListModal({
  open,
  creating,
  listName,
  onListNameChange,
  onClose,
  onSubmit,
}: CreateListModalProps) {
  const closeIfIdle = () => {
    if (!creating) onClose()
  }

  return (
    <AppModal
      open={open}
      onClose={closeIfIdle}
      overlayClassName="items-end backdrop-blur-sm p-4 sm:items-center sm:p-6"
      panelClassName="w-full max-w-md animate-in slide-in-from-bottom duration-300 rounded-[2.5rem] p-8 [background:linear-gradient(135deg,var(--background),var(--muted))]"
    >
      <ModalHeader
        title="Nueva Lista"
        subtitle="Comienza tu compra"
        onClose={closeIfIdle}
        closeDisabled={creating}
        className="mb-8 border-0 bg-transparent p-0"
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-secondary ml-1">Nombre de la lista</label>
          <TextInput
            type="text"
            value={listName}
            onChange={(event) => onListNameChange(event.target.value)}
            placeholder="Ej: Súper semanal, Cena familia..."
            autoFocus
          />
        </div>

        <PrimaryButton type="submit" disabled={creating || !listName.trim()} className="w-full">
          {creating ? 'Creando lista...' : 'Crear lista inteligente'}
        </PrimaryButton>
      </form>
    </AppModal>
  )
}
