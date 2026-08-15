import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { NewProductDraft, ProductRecord } from '@/src/types/product'

export type { NewProductDraft, ProductRecord } from '@/src/types/product'

export type PriceHistory = {
  id: string
  product_id: string
  price: number
  created_at: string
  created_by: string | null
}

export type ProductEditorForm = {
  title: string
  description: string
}

export type ProductCardProps = {
  product: ProductRecord
  onOpen: (product: ProductRecord) => void
}

export type ProductCreateModalProps = {
  open: boolean
  creating: boolean
  newProduct: NewProductDraft
  setNewProduct: Dispatch<SetStateAction<NewProductDraft>>
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}

export type ProductEditorModalProps = {
  open: boolean
  product: ProductRecord | null
  editorForm: ProductEditorForm
  setEditorForm: Dispatch<SetStateAction<ProductEditorForm>>
  savingProduct: boolean
  priceHistory: PriceHistory[]
  editingHistory: ProductHistoryEditMap
  setEditingHistory: Dispatch<SetStateAction<ProductHistoryEditMap>>
  newHistoryPrice: string
  setNewHistoryPrice: Dispatch<SetStateAction<string>>
  addingHistory: boolean
  savingHistoryId: string | null
  deletingHistoryId: string | null
  onClose: () => void
  onSaveProduct: () => void
  onAddHistoryPrice: () => void
  onSaveHistoryEntry: (entryId: string) => void
  onDeleteHistoryEntry: (entryId: string) => void
}

export type ProductHistoryEditMap = Record<string, string>

export type ProductsDerivedStateInput = {
  products: ProductRecord[]
  search: string
}

export type ProductsDerivedState = {
  filteredProducts: ProductRecord[]
}
