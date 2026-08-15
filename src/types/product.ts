export type ProductSummary = {
  id: string
  title: string
  current_price: number | null
}

export type ProductRecord = ProductSummary & {
  description: string | null
  created_at: string
  updated_at: string
}

export type NewProductDraft = {
  title: string
  description: string
  price: string
}
