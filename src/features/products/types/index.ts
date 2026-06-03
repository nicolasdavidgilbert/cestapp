import type { Dispatch, FormEvent, SetStateAction } from 'react'

export type Product = {
  id: string
  title: string
  description: string | null
  current_price: number | null
  created_at: string
  updated_at: string
}

export type PriceHistory = {
  id: string
  product_id: string
  price: number
  created_at: string
  created_by: string | null
}

export type NewProductDraft = {
  title: string
  description: string
  price: string
}

export type ProductsCacheEntry = {
  savedAt: number
  products: Product[]
}

export type ProductEditorForm = {
  title: string
  description: string
}

export type ProductCardProps = {
  product: Product
  onOpen: (product: Product) => void
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
  product: Product | null
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

export type AuthErrorLike = {
  status?: unknown
  statusCode?: unknown
  error?: unknown
  message?: unknown
}

export type ProductHistoryEditMap = Record<string, string>

export type LoadProductsOptions = {
  force?: boolean
  keepCurrentUI?: boolean
}

export type ProductsDerivedStateInput = {
  products: Product[]
  search: string
}

export type ProductsDerivedState = {
  filteredProducts: Product[]
}
