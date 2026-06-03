'use client'
import { useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { insforge } from '@/lib/insforge'
import { ListRealtime, type ListChangedRealtimePayload } from './ListRealtime'
import { PrimaryButton, TextInput } from '@/components/ui/FormControls'
import { AddProductModal } from '@/components/dashboard/list/AddProductModal'
import { FloatingActionButton } from '@/components/ui/FloatingActionButton'
import { CheckedListItemRow, PendingListItemRow } from '@/components/dashboard/list/ListItemRow'

type ShoppingList = {
  id: string
  name: string
  owner_id: string
}

type Product = {
  id: string
  title: string
  current_price: number | null
}

type ListItem = {
  id: string
  list_id: string
  product_id: string
  quantity: number
  checked: boolean
  product?: Product
}

type ShoppingListShare = {
  id: string
  list_id: string
  user_id: string
  shared_email: string | null
}

type InviteLink = {
  id: string
  list_id: string
  token: string
  created_by: string
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
}

type CreatedListProduct = {
  created_id: string
  title: string
  current_price: number | null
}

type ShareByEmailResult = {
  shared_user_id: string
  shared_email: string
  already_shared: boolean
}

type DashboardTab = 'products' | 'settings' | 'stats'
type InviteExpiryOption = 'never' | '1d' | '7d' | '30d'

const inviteExpiryOptions: { value: InviteExpiryOption; label: string; days: number | null }[] = [
  { value: 'never', label: 'Sin caducidad', days: null },
  { value: '1d', label: '24 h', days: 1 },
  { value: '7d', label: '7 días', days: 7 },
  { value: '30d', label: '30 días', days: 30 },
]

function getInviteExpiryDate(option: InviteExpiryOption) {
  const selected = inviteExpiryOptions.find((item) => item.value === option)
  if (!selected?.days) return null

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + selected.days)
  return expiresAt.toISOString()
}

function formatInviteStatus(invite: InviteLink) {
  if (!invite.expires_at) return 'Activo · Sin caducidad'

  const expiresAt = new Date(invite.expires_at)
  if (expiresAt.getTime() <= Date.now()) return 'Expirado'

  return `Activo · Caduca ${expiresAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`
}


export default function ListDetailPage() {
  const router = useRouter()
  const params = useParams()
  const listId = params.id as string
  const { user, loading: authLoading } = useUser()
  const [list, setList] = useState<ShoppingList | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [members, setMembers] = useState<ShoppingListShare[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [newProduct, setNewProduct] = useState({ title: '', description: '', price: '' })
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<DashboardTab>('products')
  const [listNameDraft, setListNameDraft] = useState('')
  const [savingListName, setSavingListName] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharingEmail, setSharingEmail] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [quickProductPrice, setQuickProductPrice] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [inviteExpiry, setInviteExpiry] = useState<InviteExpiryOption>('7d')
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([])
  const [loadingInviteLinks, setLoadingInviteLinks] = useState(false)
  const [generatingInviteLink, setGeneratingInviteLink] = useState(false)
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null)
  const [copiedLinkToken, setCopiedLinkToken] = useState<string | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set())
  const [removingCheckedItems, setRemovingCheckedItems] = useState(false)

  const listChannel = `list:${listId}`
  const canManageMembers = list?.owner_id === user?.id

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message)
    window.setTimeout(() => {
      setSuccessMessage((current) => (current === message ? '' : current))
    }, 1800)
  }, [])

  const loadMembers = useCallback(async () => {
    const { data, error } = await insforge.database.rpc('list_share_members', {
      target_list_id: listId,
    })

    if (error) {
      setError(error.message)
      return
    }

    setMembers((data as ShoppingListShare[]) || [])
  }, [listId])

  const loadInviteLinks = useCallback(async () => {
    if (!canManageMembers) {
      setInviteLinks([])
      return
    }

    setLoadingInviteLinks(true)
    const { data, error } = await insforge.database
      .from('list_invite_links')
      .select('*')
      .eq('list_id', listId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(6)

    if (error) {
      setError(error.message)
      setLoadingInviteLinks(false)
      return
    }

    setInviteLinks((data as InviteLink[]) || [])
    setLoadingInviteLinks(false)
  }, [canManageMembers, listId])

  const loadData = useCallback(async () => {
    if (!user) return
    setError('')

    const [listRes, itemsRes, ownProductsRes] = await Promise.all([
      insforge.database.from('shopping_lists').select('*').eq('id', listId).single(),
      insforge.database.from('shopping_list_items').select('*').eq('list_id', listId),
      insforge.database
        .from('products')
        .select('id, title, current_price')
        .eq('created_by', user.id)
        .order('title'),
    ])

    const firstError = listRes.error ?? itemsRes.error ?? ownProductsRes.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    if (!listRes.data) {
      setError('No se encontró la lista.')
      setLoading(false)
      return
    }

    if (listRes.data.owner_id !== user.id) {
      const { data: membership } = await insforge.database
        .from('list_shares')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!membership) {
        setError('No tienes permisos para ver esta lista.')
        setLoading(false)
        return
      }
    }

    const nextList = listRes.data as ShoppingList
    setList(nextList)
    setListNameDraft(nextList.name)

    let listProducts: Product[] = []
    if ((itemsRes.data || []).length > 0) {
      const { data: listProductsData, error: listProductsError } = await insforge.database.rpc(
        'list_visible_products',
        {
          target_list_id: listId,
        }
      )

      if (listProductsError) {
        setError(listProductsError.message)
        setLoading(false)
        return
      }

      listProducts = (listProductsData as Product[]) || []
    }

    if (itemsRes.data) {
      const itemsWithProducts = itemsRes.data.map((item) => ({
        ...item,
        product: listProducts.find((product) => product.id === item.product_id),
      }))
      setItems(itemsWithProducts as ListItem[])
    } else {
      setItems([])
    }

    setProducts((ownProductsRes.data as Product[]) || [])
    setLoading(false)
  }, [listId, user])

  const publishListEvent = useCallback(
    async (eventName: string, payload: Record<string, unknown>) => {
      if (!user) return
      await insforge.realtime.publish(listChannel, eventName, {
        ...payload,
        list_id: listId,
        user_id: user.id,
        timestamp: new Date().toISOString(),
      })
    },
    [listChannel, listId, user]
  )

  const publishUserListsEvent = useCallback(
    async (targetUserId: string, action: string) => {
      if (!targetUserId) return
      await insforge.realtime.publish(`user:${targetUserId}:lists`, 'user_lists_changed', {
        list_id: listId,
        action,
        by: user?.id,
        timestamp: new Date().toISOString(),
      })
    },
    [listId, user?.id]
  )

  const applyRealtimeListChange = useCallback(
    (payload: ListChangedRealtimePayload) => {
      switch (payload.action) {
        case 'item_added':
        case 'product_created': {
          if (!payload.item) {
            void loadData()
            return
          }

          const incomingItem = {
            ...payload.item,
            product: payload.product ?? payload.item.product,
          }

          setItems((current) => {
            const existingById = current.some((item) => item.id === incomingItem.id)
            if (existingById) {
              return current.map((item) => (item.id === incomingItem.id ? incomingItem : item))
            }

            const existingByProduct = current.some((item) => item.product_id === incomingItem.product_id)
            if (existingByProduct) {
              return current.map((item) =>
                item.product_id === incomingItem.product_id
                  ? { ...item, quantity: incomingItem.quantity, checked: incomingItem.checked }
                  : item
              )
            }

            return [incomingItem, ...current]
          })

          if (payload.product) {
            setProducts((current) => {
              const exists = current.some((product) => product.id === payload.product!.id)
              return exists
                ? current.map((product) => (product.id === payload.product!.id ? payload.product! : product))
                : [payload.product!, ...current]
            })
          }
          return
        }

        case 'item_checked': {
          if (!payload.item_id || typeof payload.checked !== 'boolean') {
            void loadData()
            return
          }

          setItems((current) =>
            current.map((item) => (item.id === payload.item_id ? { ...item, checked: payload.checked! } : item))
          )
          return
        }

        case 'item_quantity': {
          if (!payload.item_id || typeof payload.quantity !== 'number') {
            void loadData()
            return
          }

          setItems((current) =>
            current.map((item) => (item.id === payload.item_id ? { ...item, quantity: payload.quantity! } : item))
          )
          return
        }

        case 'item_removed': {
          if (!payload.item_id) {
            void loadData()
            return
          }

          setItems((current) => current.filter((item) => item.id !== payload.item_id))
          return
        }

        default:
          void loadData()
      }
    },
    [loadData]
  )

  const handleMembersRealtimeChange = useCallback(() => {
    void loadMembers()
    void loadData()
  }, [loadData, loadMembers])

  const handleInviteLinksRealtimeChange = useCallback(() => {
    void loadInviteLinks()
  }, [loadInviteLinks])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && listId) {
      queueMicrotask(() => {
        void loadData()
      })
    }
  }, [user, listId, loadData])

  useEffect(() => {
    if (!canManageMembers) return

    queueMicrotask(() => {
      void loadMembers()
      void loadInviteLinks()
    })
  }, [canManageMembers, loadInviteLinks, loadMembers])

  function buildInviteUrl(token: string) {
    if (typeof window === 'undefined') return `/invite/${token}`
    return `${window.location.origin}/invite/${token}`
  }

  async function addMemberByEmail() {
    if (!canManageMembers || !user) return
    const targetEmail = shareEmail.trim().toLowerCase()
    if (!targetEmail) return
    if (targetEmail === user.email.toLowerCase()) {
      setError('No necesitas compartir la lista contigo mismo.')
      return
    }

    setSharingEmail(true)
    setError('')

    const { data, error } = await insforge.database.rpc('share_list_with_email', {
      target_list_id: listId,
      target_email: targetEmail,
    })

    if (error) {
      setError(error.message)
      setSharingEmail(false)
      return
    }

    const shareResult = (Array.isArray(data) ? data[0] : data) as ShareByEmailResult | undefined
    if (!shareResult) {
      setError('No se pudo compartir la lista con ese email.')
      setSharingEmail(false)
      return
    }

    if (shareResult.already_shared) {
      setError('Ese usuario ya tiene acceso a la lista.')
      setSharingEmail(false)
      return
    }

    setShareEmail('')
    showSuccess('Acceso compartido')
    await loadMembers()
    await publishListEvent('members_changed', {
      action: 'added_by_email',
      target_user_id: shareResult.shared_user_id,
      target_email: shareResult.shared_email,
    })
    await publishUserListsEvent(shareResult.shared_user_id, 'shared')
    await publishUserListsEvent(user.id, 'shared')
    setSharingEmail(false)
  }

  async function createInviteLink() {
    if (!canManageMembers || !user) return

    setGeneratingInviteLink(true)
    setError('')
    const { data, error } = await insforge.database
      .from('list_invite_links')
      .insert([
        {
          list_id: listId,
          created_by: user.id,
          expires_at: getInviteExpiryDate(inviteExpiry),
        },
      ])
      .select('*')
      .single()

    if (error) {
      setError(error.message)
      setGeneratingInviteLink(false)
      return
    }

    if (data) {
      await loadInviteLinks()
      await publishListEvent('invite_links_changed', { action: 'created', invite_id: data.id })
      await publishUserListsEvent(user.id, 'updated')
      showSuccess('Enlace creado')
    }
    setGeneratingInviteLink(false)
  }

  async function revokeInviteLink(invite: InviteLink) {
    if (!canManageMembers || !user) return

    setRevokingInviteId(invite.id)
    setError('')
    const { error } = await insforge.database
      .from('list_invite_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', invite.id)

    if (error) {
      setError(error.message)
      setRevokingInviteId(null)
      return
    }

    await loadInviteLinks()
    await publishListEvent('invite_links_changed', { action: 'revoked', invite_id: invite.id })
    showSuccess('Enlace revocado')
    setRevokingInviteId(null)
  }

  async function copyInviteLink(token: string) {
    const inviteUrl = buildInviteUrl(token)
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopiedLinkToken(token)
      showSuccess('Enlace copiado')
      window.setTimeout(() => {
        setCopiedLinkToken((current) => (current === token ? null : current))
      }, 1600)
    } catch {
      setError('No se pudo copiar el enlace.')
    }
  }

  async function updateListName() {
    if (!canManageMembers || !list) return
    const nextName = listNameDraft.trim()
    if (!nextName) return
    if (nextName === list.name) return

    setSavingListName(true)
    setError('')
    const { data, error } = await insforge.database
      .from('shopping_lists')
      .update({
        name: nextName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', list.id)
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSavingListName(false)
      return
    }

    if (data) {
      const updatedList = data as ShoppingList
      setList(updatedList)
      setListNameDraft(updatedList.name)
      await publishListEvent('list_changed', { action: 'list_renamed', list_name: nextName })
      await publishUserListsEvent(user!.id, 'updated')
      await Promise.all(members.map((member) => publishUserListsEvent(member.user_id, 'updated')))
    }

    setSavingListName(false)
  }

  async function removeMember(member: ShoppingListShare) {
    if (!canManageMembers) return
    const memberLabel = member.shared_email || member.user_id
    if (!window.confirm(`Quitar acceso a ${memberLabel}?`)) return

    setRemovingMemberId(member.id)
    setError('')
    const { error } = await insforge.database.from('list_shares').delete().eq('id', member.id)

    if (error) {
      setError(error.message)
      setRemovingMemberId(null)
      return
    }

    await loadMembers()
    await publishListEvent('members_changed', { action: 'removed', target_user_id: member.user_id })
    await publishUserListsEvent(member.user_id, 'unshared')
    await publishUserListsEvent(user!.id, 'shared')
    showSuccess('Acceso retirado')
    setRemovingMemberId(null)
  }

  async function addExistingProduct(productId: string) {
    setError('')
    const existingItem = items.find((item) => item.product_id === productId)
    const optimisticItemId = `optimistic-item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const selectedProduct =
      products.find((product) => product.id === productId) ??
      existingItem?.product ?? {
        id: productId,
        title: 'Producto',
        current_price: null,
      }

    if (existingItem) {
      setItems((current) =>
        current.map((item) =>
          item.id === existingItem.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        )
      )
    } else {
      const optimisticItem: ListItem = {
        id: optimisticItemId,
        list_id: listId,
        product_id: productId,
        quantity: 1,
        checked: false,
        product: selectedProduct,
      }
      setItems((current) => [optimisticItem, ...current])
    }

    setShowAddProduct(false)
    setProductSearch('')
    showSuccess(existingItem ? 'Cantidad actualizada' : 'Producto añadido')

    const response = existingItem
      ? await insforge.database
          .from('shopping_list_items')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id)
          .select('*')
          .single()
      : await insforge.database
          .from('shopping_list_items')
          .insert([
            {
              list_id: listId,
              product_id: productId,
              quantity: 1,
            },
          ])
          .select('*')
          .single()

    if (response.error) {
      if (existingItem) {
        setItems((current) =>
          current.map((item) =>
            item.id === existingItem.id
              ? {
                  ...item,
                  quantity: existingItem.quantity,
                }
              : item
          )
        )
      } else {
        setItems((current) => current.filter((item) => item.id !== optimisticItemId))
      }
      setError(response.error.message)
      return
    }

    const syncedItem = response.data ? ({ ...(response.data as ListItem), product: selectedProduct } as ListItem) : null

    if (!existingItem && syncedItem) {
      const createdItem = response.data as ListItem
      setItems((current) =>
        current.map((item) =>
          item.id === optimisticItemId
            ? {
                ...createdItem,
                product: selectedProduct,
              }
            : item
        )
      )
    }

    try {
      await publishListEvent(
        'list_changed',
        existingItem
          ? {
              action: 'item_quantity',
              item_id: syncedItem?.id ?? existingItem.id,
              product_id: productId,
              quantity: syncedItem?.quantity ?? existingItem.quantity + 1,
            }
          : {
              action: 'item_added',
              item: syncedItem,
              product: selectedProduct,
              product_id: productId,
            }
      )
    } catch {
      setError('Se agregó el producto, pero no se pudo notificar en tiempo real.')
    }
  }

  async function createProductWithValues(titleInput: string, descriptionInput: string, priceInput: string) {
    const title = titleInput.trim()
    if (!title) return

    const description = descriptionInput.trim() || null
    const parsedPrice = priceInput.trim() ? Number(priceInput.replace(',', '.')) : null
    const price = parsedPrice !== null && Number.isFinite(parsedPrice) ? parsedPrice : null
    const optimisticProductId = `optimistic-product-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const optimisticItemId = `optimistic-item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const optimisticProduct: Product = {
      id: optimisticProductId,
      title,
      current_price: price,
    }
    const optimisticItem: ListItem = {
      id: optimisticItemId,
      list_id: listId,
      product_id: optimisticProductId,
      quantity: 1,
      checked: false,
      product: optimisticProduct,
    }

    setCreatingProduct(true)
    setError('')
    setItems((current) => [optimisticItem, ...current])
    setProducts((current) => [optimisticProduct, ...current])
    setNewProduct({ title: '', description: '', price: '' })
    setQuickProductPrice('')
    setProductSearch('')
    setShowAddProduct(false)
    showSuccess('Producto añadido')

    const { data, error } = await insforge.database.rpc('create_product_for_list', {
      target_list_id: listId,
      product_title: title,
      product_description: description,
      product_price: price,
    })

    if (error) {
      setItems((current) => current.filter((item) => item.id !== optimisticItemId))
      setProducts((current) => current.filter((product) => product.id !== optimisticProductId))
      setError(error.message)
      setCreatingProduct(false)
      return
    }

    const created = (Array.isArray(data) ? data[0] : data) as CreatedListProduct | undefined
    if (!created) {
      setItems((current) => current.filter((item) => item.id !== optimisticItemId))
      setProducts((current) => current.filter((product) => product.id !== optimisticProductId))
      setError('No se pudo crear el producto.')
      setCreatingProduct(false)
      return
    }

    const [productRes, itemRes] = await Promise.all([
      insforge.database.from('products').select('id, title, current_price').eq('id', created.created_id).single(),
      insforge.database
        .from('shopping_list_items')
        .select('*')
        .eq('list_id', listId)
        .eq('product_id', created.created_id)
        .single(),
    ])

    const nextProduct: Product =
      !productRes.error && productRes.data
        ? (productRes.data as Product)
        : {
            id: created.created_id,
            title: created.title,
            current_price: created.current_price,
          }

    setProducts((current) =>
      current.map((product) => (product.id === optimisticProductId ? nextProduct : product))
    )

    const syncedProductItem = !itemRes.error && itemRes.data
      ? ({ ...(itemRes.data as ListItem), product: nextProduct } as ListItem)
      : null

    if (syncedProductItem) {
      const nextItem = itemRes.data as ListItem
      setItems((current) =>
        current.map((item) =>
          item.id === optimisticItemId
            ? {
                ...nextItem,
                product: nextProduct,
              }
            : item
        )
      )
    } else {
      await loadData()
    }

    await publishListEvent('list_changed', {
      action: 'product_created',
      item: syncedProductItem,
      product: nextProduct,
      product_id: created.created_id,
    })
    await publishUserListsEvent(user!.id, 'updated')
    const memberIds = members.map((member) => member.user_id)
    await Promise.all(memberIds.map((memberId) => publishUserListsEvent(memberId, 'updated')))
    setCreatingProduct(false)
  }

  async function createAndAddProduct(e: React.FormEvent) {
    e.preventDefault()
    await createProductWithValues(newProduct.title, newProduct.description, newProduct.price)
  }

  async function createMissingProduct(e: React.FormEvent) {
    e.preventDefault()
    await createProductWithValues(productSearch, '', quickProductPrice)
  }

  async function toggleChecked(item: ListItem) {
    const nextValue = !item.checked
    const previousChecked = item.checked

    // Optimistic update
    setItems(current => current.map(i => i.id === item.id ? { ...i, checked: nextValue } : i))
    setUpdatingItems(prev => new Set(prev).add(item.id))
    setError('')

    const { error } = await insforge.database
      .from('shopping_list_items')
      .update({ checked: nextValue })
      .eq('id', item.id)

    if (error) {
      setItems(current => current.map(i => i.id === item.id ? { ...i, checked: previousChecked } : i))
      setError(`Error al marcar item: ${error.message}`)
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      return
    }

    try {
      await publishListEvent('list_changed', {
        action: 'item_checked',
        checked: nextValue,
        item_id: item.id,
        product_id: item.product_id,
      })
    } catch {
      setError('Se guardó el cambio, pero no se pudo notificar en tiempo real.')
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  async function updateQuantity(item: ListItem, delta: number) {
    const newQuantity = item.quantity + delta
    const previousIndex = items.findIndex((i) => i.id === item.id)

    if (newQuantity < 1) {
      const itemLabel = item.product?.title || 'este producto'
      if (!window.confirm(`¿Quitar ${itemLabel} de la lista?`)) return

      // Optimistic delete when decrementing below one. Explicit delete still asks for confirmation.
      setItems(current => current.filter(i => i.id !== item.id))
    } else {
      // Optimistic update
      setItems(current => current.map(i => i.id === item.id ? { ...i, quantity: newQuantity } : i))
    }
    
    setUpdatingItems(prev => new Set(prev).add(item.id))
    setError('')

    const { error } =
      newQuantity < 1
        ? await insforge.database.from('shopping_list_items').delete().eq('id', item.id)
        : await insforge.database
            .from('shopping_list_items')
            .update({ quantity: newQuantity })
            .eq('id', item.id)

    if (error) {
      setItems(current => {
        if (newQuantity < 1) {
          const alreadyPresent = current.some((i) => i.id === item.id)
          if (alreadyPresent) return current
          const next = [...current]
          const insertAt = previousIndex >= 0 ? Math.min(previousIndex, next.length) : next.length
          next.splice(insertAt, 0, item)
          return next
        }

        return current.map((i) => (i.id === item.id ? { ...i, quantity: item.quantity } : i))
      })
      setError(`Error al actualizar cantidad: ${error.message}`)
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      return
    }

    try {
      await publishListEvent(
        'list_changed',
        newQuantity < 1
          ? {
              action: 'item_removed',
              item_id: item.id,
              product_id: item.product_id,
            }
          : {
              action: 'item_quantity',
              item_id: item.id,
              product_id: item.product_id,
              quantity: newQuantity,
            }
      )
    } catch {
      setError('Se guardó el cambio, pero no se pudo notificar en tiempo real.')
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  async function removeItem(itemId: string) {
    const previousItem = items.find((item) => item.id === itemId)
    const previousIndex = items.findIndex((item) => item.id === itemId)
    const itemLabel = previousItem?.product?.title || 'este producto'
    if (!window.confirm(`Quitar ${itemLabel} de la lista?`)) return

    // Optimistic delete
    setItems(current => current.filter(i => i.id !== itemId))
    setUpdatingItems(prev => new Set(prev).add(itemId))
    setError('')

    const { error } = await insforge.database.from('shopping_list_items').delete().eq('id', itemId)
    
    if (error) {
      if (previousItem) {
        setItems(current => {
          const alreadyPresent = current.some((item) => item.id === itemId)
          if (alreadyPresent) return current
          const next = [...current]
          const insertAt = previousIndex >= 0 ? Math.min(previousIndex, next.length) : next.length
          next.splice(insertAt, 0, previousItem)
          return next
        })
      }
      setError(`Error al eliminar item: ${error.message}`)
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
      return
    }

    try {
      await publishListEvent('list_changed', {
        action: 'item_removed',
        item_id: itemId,
        product_id: previousItem?.product_id,
      })
    } catch {
      setError('Se guardó el cambio, pero no se pudo notificar en tiempo real.')
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }

  async function removeCheckedItems() {
    const itemsToRemove = items.filter((item) => item.checked)
    if (itemsToRemove.length === 0) return

    const confirmMessage = itemsToRemove.length === 1
      ? 'Eliminar el producto seleccionado de la lista?'
      : "Eliminar los " + itemsToRemove.length + " productos seleccionados de la lista?"

    if (!window.confirm(confirmMessage)) return

    const idsToRemove = new Set(itemsToRemove.map((item) => item.id))
    const previousItems = items

    setRemovingCheckedItems(true)
    setUpdatingItems((prev) => new Set([...prev, ...idsToRemove]))
    setItems((current) => current.filter((item) => !idsToRemove.has(item.id)))
    setError('')

    const { error } = await insforge.database
      .from('shopping_list_items')
      .delete()
      .in('id', Array.from(idsToRemove))

    if (error) {
      setItems(previousItems)
      setError("Error al eliminar productos: " + error.message)
      setUpdatingItems((prev) => {
        const next = new Set(prev)
        idsToRemove.forEach((itemId) => next.delete(itemId))
        return next
      })
      setRemovingCheckedItems(false)
      return
    }

    try {
      await Promise.all(itemsToRemove.map((item) =>
        publishListEvent('list_changed', {
          action: 'item_removed',
          item_id: item.id,
          product_id: item.product_id,
        })
      ))
      showSuccess(itemsToRemove.length === 1 ? 'Producto eliminado' : 'Productos eliminados')
    } catch {
      setError('Se guardó el cambio, pero no se pudo notificar en tiempo real.')
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev)
        idsToRemove.forEach((itemId) => next.delete(itemId))
        return next
      })
      setRemovingCheckedItems(false)
    }
  }

  async function deleteList() {
    if (!confirm('¿Eliminar esta lista?')) return
    setError('')

    const memberIds = members.map((member) => member.user_id)
    const { error } = await insforge.database.from('shopping_lists').delete().eq('id', listId)
    if (error) {
      setError(error.message)
      return
    }

    await Promise.all(memberIds.map((memberId) => publishUserListsEvent(memberId, 'deleted')))
    await publishUserListsEvent(user!.id, 'deleted')
    router.push('/dashboard')
  }

  const uncheckedItems = items.filter((item) => !item.checked)
  const checkedItems = items.filter((item) => item.checked)
  const checkedTotal = checkedItems.reduce(
    (sum, item) => sum + (item.product?.current_price || 0) * item.quantity,
    0
  )
  const total = items.reduce((sum, item) => sum + (item.product?.current_price || 0) * item.quantity, 0)
  const remainingTotal = Math.max(total - checkedTotal, 0)
  const progress = total > 0 ? (checkedTotal / total) * 100 : 0
  const normalizedProductSearch = productSearch.trim().toLowerCase()
  const filteredProducts = normalizedProductSearch
    ? products.filter((product) => product.title.toLowerCase().includes(normalizedProductSearch))
    : products
  const suggestedProducts = products.filter((product) => !items.some((item) => item.product_id === product.id)).slice(0, 3)

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-secondary" />
          <p className="text-sm font-bold uppercase tracking-widest text-secondary">Sincronizando lista</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen w-full px-4 sm:px-6 py-10 pb-40">
      <ListRealtime
        canManageMembers={canManageMembers}
        listId={listId}
        onInviteLinksChanged={handleInviteLinksRealtimeChange}
        onListChanged={applyRealtimeListChange}
        onMembersChanged={handleMembersRealtimeChange}
        userId={user.id}
      />
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-muted/20 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 transition-transform group-hover:-translate-x-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Volver al Panel
              </Link>
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60">
                    {list?.name || 'Cargando...'}
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium tracking-tight sm:text-sm">Gestiona productos, cantidades y presupuesto.</p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                  <div className="rounded-2xl border border-border bg-muted/20 px-2 py-2 backdrop-blur-sm sm:min-w-[130px] sm:px-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                    <p className="text-sm font-black text-foreground sm:text-base">{total.toFixed(2)} <span className="text-[9px] font-bold text-secondary sm:text-[10px]">EUR</span></p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/20 px-2 py-2 backdrop-blur-sm sm:min-w-[130px] sm:px-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Pendiente</p>
                    <p className="text-sm font-black text-foreground sm:text-base">{remainingTotal.toFixed(2)} <span className="text-[9px] font-bold text-secondary sm:text-[10px]">EUR</span></p>
                  </div>
                  <div className="rounded-2xl border border-secondary/30 bg-secondary/10 px-2 py-2 backdrop-blur-sm sm:hidden">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-secondary/80">En carrito</p>
                    <p className="text-sm font-black text-foreground">{checkedTotal.toFixed(2)} <span className="text-[9px] font-bold text-secondary">EUR</span></p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[250px]">
              <div className="relative hidden overflow-hidden rounded-2xl border border-secondary/20 bg-secondary/5 p-4 backdrop-blur-md sm:block">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-50" />
                <div className="relative space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-secondary/80">En carrito</p>
                  <p className="text-2xl font-black text-foreground">{checkedTotal.toFixed(2)} <span className="text-xs font-bold text-secondary">EUR</span></p>
                  <div className="mt-2 w-full h-1 bg-muted/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-secondary to-secondary/80 transition-all duration-700 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
              {activeTab === 'products' && (
                <div className="hidden sm:block">
                  <button
                    onClick={() => setShowAddProduct(true)}
                    className="group relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 px-4 py-3 text-xs font-bold uppercase tracking-widest text-secondary-foreground shadow-lg shadow-secondary/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
                  >
                    <span className="absolute inset-0 bg-foreground/10 opacity-0 transition-opacity group-hover:opacity-100" />
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="relative w-4 h-4 mr-2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span className="relative">Añadir Producto</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex w-full items-center gap-1 rounded-2xl border border-border bg-muted/20 p-1.5 backdrop-blur-md overflow-x-auto sm:overflow-x-visible">
            {([
              { id: 'products', label: 'Productos', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg> },
              { id: 'settings', label: 'Gestión', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg> },
              { id: 'stats', label: 'Estadísticas', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" /></svg> },
            ] as { id: DashboardTab; label: string; icon: ReactNode }[]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground shadow-lg shadow-secondary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                {tab.icon}
                <span className="hidden min-[400px]:inline">{tab.label}</span>
                <span className="min-[400px]:hidden">{tab.id === 'products' ? 'Prods' : tab.id === 'settings' ? 'Gest' : 'Est'}</span>
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-6 py-4 text-sm font-medium text-destructive backdrop-blur-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 py-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-muted/20" />
            ))}
          </div>
        ) : activeTab === 'products' ? (
          <div className="space-y-8">
            {uncheckedItems.length === 0 && checkedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="h-24 w-24 flex items-center justify-center rounded-[2rem] bg-muted/20 text-muted-foreground ring-1 ring-border/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-foreground tracking-tight">Tu lista está vacía</h2>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">Añade productos de tu catálogo o crea nuevos para empezar a comprar.</p>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => setShowAddProduct(true)}
                    className="group relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 px-8 py-4 text-base font-bold text-secondary-foreground shadow-xl shadow-secondary/20 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <span className="absolute inset-0 bg-foreground/10 opacity-0 transition-opacity group-hover:opacity-100" />
                    Añadir mi primer producto
                  </button>
                  {suggestedProducts.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {suggestedProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => void addExistingProduct(product.id)}
                          className="rounded-full border border-border bg-muted/20 px-3 py-1.5 text-[10px] font-bold text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground"
                        >
                          {product.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <section className="space-y-6">
                {uncheckedItems.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary ml-1">Por comprar</p>
                    <div className="space-y-3">
                      {uncheckedItems.map((item) => (
                        <PendingListItemRow
                          key={item.id}
                          item={item}
                          updating={updatingItems.has(item.id)}
                          onToggleChecked={(nextItem) => void toggleChecked(nextItem)}
                          onUpdateQuantity={(nextItem, delta) => void updateQuantity(nextItem, delta)}
                          onRemove={(itemId) => void removeItem(itemId)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {checkedItems.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/70 ml-1">En el carrito</p>
                      <button
                        type="button"
                        onClick={() => void removeCheckedItems()}
                        disabled={removingCheckedItems}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/10 px-3 text-[10px] font-bold uppercase tracking-widest text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground disabled:cursor-wait disabled:opacity-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-3.5 w-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        {removingCheckedItems ? 'Eliminando' : 'Vaciar'}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {checkedItems.map((item) => (
                        <CheckedListItemRow
                          key={item.id}
                          item={item}
                          updating={updatingItems.has(item.id)}
                          onToggleChecked={(nextItem) => void toggleChecked(nextItem)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
            
          </div>
        ) : activeTab === 'settings' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="rounded-3xl sm:rounded-[2.5rem] border border-border bg-muted/20 p-6 sm:p-10 backdrop-blur-md space-y-10">
              <div className="space-y-8">
                <div className="space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">General</span>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground ml-1">Nombre de la lista</label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <TextInput
                        type="text"
                        value={listNameDraft}
                        onChange={(e) => setListNameDraft(e.target.value)}
                        disabled={!canManageMembers}
                        placeholder="Nombre de la lista"
                      />
                      {canManageMembers && (
                        <PrimaryButton
                          type="button"
                          onClick={() => void updateListName()}
                          disabled={savingListName || !listNameDraft.trim()}
                          tone="foreground"
                          className="shrink-0 px-8 py-3 text-sm"
                        >
                          {savingListName ? 'Guardando...' : 'Actualizar'}
                        </PrimaryButton>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">Compartir con Email</span>
                  {!canManageMembers ? (
                    <p className="rounded-2xl bg-secondary/10 p-4 text-xs font-medium text-secondary ring-1 ring-secondary/20">
                      Solo el propietario puede gestionar los accesos compartidos.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <TextInput
                          type="email"
                          value={shareEmail}
                          onChange={(e) => setShareEmail(e.target.value)}
                          placeholder="email@ejemplo.com"
                        />
                        <PrimaryButton
                          type="button"
                          onClick={() => void addMemberByEmail()}
                          disabled={sharingEmail || !shareEmail.trim()}
                          className="shrink-0 px-8 py-3 text-sm"
                        >
                          {sharingEmail ? 'Compartiendo...' : 'Compartir'}
                        </PrimaryButton>
                      </div>
                      
                      {members.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Miembros actuales</p>
                          <div className="grid gap-2">
                            {members.map((member) => (
                              <div key={member.id} className="flex items-center justify-between rounded-xl bg-muted/20 p-3 ring-1 ring-border/20">
                                <div className="min-w-0 mr-2">
                                  <span className="block truncate text-sm font-medium text-muted-foreground">{member.shared_email || member.user_id}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary/70">Editor</span>
                                </div>
                                <button
                                  onClick={() => removeMember(member)}
                                  disabled={removingMemberId === member.id}
                                  className="text-xs font-bold text-destructive hover:text-destructive/80 p-2 shrink-0"
                                >
                                  {removingMemberId === member.id ? '...' : 'Quitar'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">Enlaces de Invitación</span>
                  {canManageMembers && (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground max-w-[240px]">Envía un enlace rápido por WhatsApp o Telegram.</p>
                        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                          <select
                            value={inviteExpiry}
                            onChange={(e) => setInviteExpiry(e.target.value as InviteExpiryOption)}
                            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground outline-none transition-all hover:bg-muted/40 dark:bg-muted dark:text-foreground sm:flex-none"
                          >
                            {inviteExpiryOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => void createInviteLink()}
                            disabled={generatingInviteLink}
                            className="flex flex-1 items-center justify-center rounded-xl bg-muted/20 px-4 py-2 text-xs font-bold text-foreground ring-1 ring-border/40 transition-all hover:bg-muted/40 disabled:opacity-50 sm:flex-none"
                          >
                            {generatingInviteLink ? 'Generando...' : 'Nuevo Enlace'}
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        {loadingInviteLinks ? (
                          <div className="h-20 animate-pulse rounded-2xl bg-muted/20" />
                        ) : inviteLinks.length === 0 ? (
                          <p className="text-center py-6 text-xs text-muted-foreground font-medium italic">No hay enlaces activos en este momento.</p>
                        ) : (
                          inviteLinks.map((invite) => (
                            <div key={invite.id} className="flex flex-col gap-3 rounded-2xl bg-muted/40 p-4 ring-1 ring-border/20">
                              <div className="space-y-1">
                                <p className="truncate text-xs font-medium text-muted-foreground tracking-tight">{buildInviteUrl(invite.token)}</p>
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now() ? 'text-destructive' : 'text-secondary'}`}>
                                  {formatInviteStatus(invite)}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => void copyInviteLink(invite.token)}
                                  className={`flex-1 flex items-center justify-center rounded-xl py-2.5 text-[10px] font-bold uppercase transition-all ${
                                    copiedLinkToken === invite.token ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                                  }`}
                                >
                                  {copiedLinkToken === invite.token ? 'Enlace Copiado' : 'Copiar URL'}
                                </button>
                                <button
                                  onClick={() => revokeInviteLink(invite)}
                                  disabled={revokingInviteId === invite.id}
                                  className="flex-1 flex items-center justify-center rounded-xl bg-destructive/10 py-2.5 text-[10px] font-bold uppercase text-destructive hover:bg-destructive/20 transition-all"
                                >
                                  Revocar
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {canManageMembers && (
                <div className="pt-10 space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-destructive/80">Zona de Riesgo</span>
                  <button
                    onClick={() => void deleteList()}
                    className="flex w-full items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 py-4 text-sm font-bold text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground"
                  >
                    Eliminar Lista Permanentemente
                  </button>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="h-24 w-24 flex items-center justify-center rounded-[2rem] bg-accent/60 text-accent-foreground ring-1 ring-accent/40">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground tracking-tight">Estamos preparando tus datos</h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">Pronto podrás visualizar informes detallados sobre tus hábitos de compra y ahorro.</p>
            </div>
          </div>
        )}
      </div>

      {successMessage && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-2xl border border-border bg-foreground px-4 py-3 text-xs font-bold text-background shadow-xl">
          {successMessage}
        </div>
      )}

      <FloatingActionButton
        visible={!showAddProduct}
        ariaLabel="Añadir producto"
        onClick={() => setShowAddProduct(true)}
      />

      <AddProductModal
        open={showAddProduct}
        products={products}
        filteredProducts={filteredProducts}
        items={items}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        quickProductPrice={quickProductPrice}
        setQuickProductPrice={setQuickProductPrice}
        newProduct={newProduct}
        setNewProduct={setNewProduct}
        creatingProduct={creatingProduct}
        onClose={() => setShowAddProduct(false)}
        onAddExistingProduct={(productId) => void addExistingProduct(productId)}
        onCreateMissingProduct={createMissingProduct}
        onCreateAndAddProduct={createAndAddProduct}
      />
    </main>
  )
}
