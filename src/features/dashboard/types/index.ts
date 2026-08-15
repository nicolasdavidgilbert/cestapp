import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import type { NewProductDraft, ProductSummary } from '@/src/types/product'
import type { RealtimePayload } from '@/src/types/realtime'

export type { NewProductDraft, ProductSummary } from '@/src/types/product'
export type { RealtimePayload } from '@/src/types/realtime'

export type ListItem = {
  id: string
  list_id: string
  product_id: string
  quantity: number
  checked: boolean
  product?: ProductSummary
}

export type ShoppingList = {
  id: string
  name: string
  owner_id: string
}

export type ShoppingListShare = {
  id: string
  list_id: string
  user_id: string
  shared_email: string | null
  avatar_url: string | null
}

export type DashboardList = ShoppingList & {
  access: 'owner' | 'shared'
  role?: string
}

export type RealtimeProduct = {
  id: string
  title: string
  current_price: number | null
}

export type RealtimeListItem = {
  id: string
  list_id: string
  product_id: string
  quantity: number
  checked: boolean
  product?: RealtimeProduct
}

export type ListChangedRealtimePayload = RealtimePayload & {
  action?: string
  checked?: boolean
  item?: RealtimeListItem
  item_id?: string
  list_name?: string
  product?: RealtimeProduct
  product_id?: string
  quantity?: number
  user_id?: string
}

export type InviteLink = {
  id: string
  list_id: string
  token: string
  created_by: string
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
}

export type CreatedListProduct = {
  created_id: string
  title: string
  current_price: number | null
}

export type ShareByEmailResult = {
  shared_user_id: string
  shared_email: string
  already_shared: boolean
}

export type DashboardTab = 'products' | 'settings' | 'stats'
export type InviteExpiryOption = 'never' | '1d' | '7d' | '30d'

export type AcceptedInvite = {
  list_id: string
  list_name: string
  owner_id: string
  already_member: boolean
}

export type ProfileFields = {
  name: string
  avatar_url: string
}

export type AddProductModalProps = {
  open: boolean
  products: ProductSummary[]
  filteredProducts: ProductSummary[]
  items: ListItem[]
  productSearch: string
  setProductSearch: (value: string) => void
  quickProductPrice: string
  setQuickProductPrice: (value: string) => void
  newProduct: NewProductDraft
  setNewProduct: Dispatch<SetStateAction<NewProductDraft>>
  creatingProduct: boolean
  onClose: () => void
  onAddExistingProduct: (productId: string) => void
  onCreateMissingProduct: (event: FormEvent) => void
  onCreateAndAddProduct: (event: FormEvent) => void
}

export type ListItemRowProps = {
  item: ListItem
  updating: boolean
  onToggleChecked: (item: ListItem) => void
  onUpdateQuantity: (item: ListItem, delta: number) => void
  onRemove: (itemId: string) => void
}

export type CheckedListItemRowProps = {
  item: ListItem
  updating: boolean
  onToggleChecked: (item: ListItem) => void
}

export type ListRealtimeProps = {
  listId: string
  userId: string
  canManageMembers: boolean
  onListChanged: (payload: ListChangedRealtimePayload) => void
  onMembersChanged: () => void
  onInviteLinksChanged: () => void
}

export type CreateListModalProps = {
  open: boolean
  creating: boolean
  listName: string
  onListNameChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}

export type DashboardListCardProps = {
  list: DashboardList
}

export type DashboardTabDefinition = {
  id: DashboardTab
  label: string
  icon: ReactNode
}

export type LoadListsOptions = {
  force?: boolean
  keepCurrentUI?: boolean
  retried?: boolean
}

export type LoadListsHandler = (options?: LoadListsOptions) => Promise<void>

export type InviteExpiryDefinition = {
  value: InviteExpiryOption
  label: string
  days: number | null
}

export type RealtimeEventPayload = Record<string, unknown>

export type ProfileData = Record<string, unknown>

export type ProfileFormProps = {
  email: string
  initialProfile: ProfileFields
  currentProfile: ProfileData
  onSave: (profile: ProfileData) => Promise<{ error?: string }>
}

export type DashboardListsRealtimeOptions = {
  userId?: string
  onListsChanged: () => void
}

export type ListDerivedStateInput = {
  items: ListItem[]
  products: ProductSummary[]
  productSearch: string
}

export type ListDerivedState = {
  uncheckedItems: ListItem[]
  checkedItems: ListItem[]
  checkedTotal: number
  total: number
  remainingTotal: number
  progress: number
  filteredProducts: ProductSummary[]
  suggestedProducts: ProductSummary[]
}

export type DashboardListsDerivedStateInput = {
  lists: DashboardList[]
  search: string
}

export type DashboardListsDerivedState = {
  filteredLists: DashboardList[]
}
