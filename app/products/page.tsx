'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { insforge } from '@/lib/insforge'
import MobileDashboardNav from '@/app/dashboard/_components/MobileDashboardNav'
import { ProductCreateModal } from '@/components/products/ProductCreateModal'
import { ProductEditorModal } from '@/components/products/ProductEditorModal'
import { ProductCard } from '@/components/products/ProductCard'
import { FloatingActionButton } from '@/components/ui/FloatingActionButton'

type Product = {
  id: string
  title: string
  description: string | null
  current_price: number | null
  created_at: string
  updated_at: string
}

type PriceHistory = {
  id: string
  product_id: string
  price: number
  created_at: string
  created_by: string | null
}

type ProductsCacheEntry = {
  savedAt: number
  products: Product[]
}

type AuthErrorLike = {
  status?: unknown
  statusCode?: unknown
  error?: unknown
  message?: unknown
}

const PRODUCTS_CACHE_TTL_MS = 5 * 60 * 1000
const PRODUCTS_CACHE_PREFIX = 'products_cache_v1:'
const PRODUCTS_MIN_REFETCH_GAP_MS = 8 * 1000

function isAuthErrorMessage(message: string | null | undefined) {
  const normalized = (message ?? '').toLowerCase()
  return (
    normalized.includes('invalid token') ||
    normalized.includes('unauthorized') ||
    normalized.includes('token expired') ||
    normalized.includes('session invalid')
  )
}

function isAuthError(error: unknown) {
  if (typeof error === 'string') return isAuthErrorMessage(error)

  const details = (error ?? {}) as AuthErrorLike
  const status = typeof details.status === 'number' ? details.status : typeof details.statusCode === 'number' ? details.statusCode : null
  const code = typeof details.error === 'string' ? details.error.toLowerCase() : ''
  const message = typeof details.message === 'string' ? details.message : error instanceof Error ? error.message : ''

  return status === 401 || status === 403 || code === 'invalid_token' || code === 'unauthorized' || code === 'token_expired' || isAuthErrorMessage(message)
}

function getProductsCacheKey(userId: string) {
  return `${PRODUCTS_CACHE_PREFIX}${userId}`
}

function readCachedProducts(userId: string): Product[] | null {
  try {
    const raw = localStorage.getItem(getProductsCacheKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProductsCacheEntry
    if (!parsed?.savedAt || !Array.isArray(parsed?.products)) return null
    if (Date.now() - parsed.savedAt > PRODUCTS_CACHE_TTL_MS) return null
    return parsed.products
  } catch {
    return null
  }
}

function writeCachedProducts(userId: string, products: Product[]) {
  try {
    const payload: ProductsCacheEntry = { savedAt: Date.now(), products }
    localStorage.setItem(getProductsCacheKey(userId), JSON.stringify(payload))
  } catch {
    // Ignore storage write failures.
  }
}

function reconcileProducts(previous: Product[], incoming: Product[]) {
  const previousById = new Map(previous.map((item) => [item.id, item]))
  const reconciled = incoming.map((nextItem) => {
    const prevItem = previousById.get(nextItem.id)
    if (
      prevItem &&
      prevItem.title === nextItem.title &&
      prevItem.description === nextItem.description &&
      prevItem.current_price === nextItem.current_price &&
      prevItem.updated_at === nextItem.updated_at
    ) {
      return prevItem
    }

    return nextItem
  })

  const unchanged =
    reconciled.length === previous.length &&
    reconciled.every((item, index) => item === previous[index])

  return unchanged ? previous : reconciled
}


export default function ProductsPage() {
  const router = useRouter()
  const { user, loading: authLoading, refreshUser } = useUser()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newProduct, setNewProduct] = useState({ title: '', description: '', price: '' })
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editorForm, setEditorForm] = useState({ title: '', description: '' })
  const [savingProduct, setSavingProduct] = useState(false)
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [editingHistory, setEditingHistory] = useState<Record<string, string>>({})
  const [newHistoryPrice, setNewHistoryPrice] = useState('')
  const [savingHistoryId, setSavingHistoryId] = useState<string | null>(null)
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null)
  const [addingHistory, setAddingHistory] = useState(false)
  const [error, setError] = useState('')
  const lastFetchAtRef = useRef(0)
  const hydratedFromCacheRef = useRef(false)

  const applyProducts = useCallback(
    (nextProducts: Product[]) => {
      if (!user) return
      setProducts((previous) => {
        const reconciled = reconcileProducts(previous, nextProducts)
        if (reconciled !== previous) {
          writeCachedProducts(user.id, reconciled)
        }
        return reconciled
      })
    },
    [user]
  )

  const loadProducts = useCallback(async (options?: { force?: boolean; keepCurrentUI?: boolean }) => {
    if (!user) return
    const force = options?.force ?? false
    const keepCurrentUI = options?.keepCurrentUI ?? false
    const now = Date.now()
    if (!force && now - lastFetchAtRef.current < PRODUCTS_MIN_REFETCH_GAP_MS) {
      return
    }
    lastFetchAtRef.current = now

    if (!keepCurrentUI) {
      setLoading(true)
    }

    const fetchProducts = () =>
      insforge.database
        .from('products')
        .select('*')
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false })

    let { data, error } = await fetchProducts()

    if (isAuthError(error)) {
      await refreshUser()
      ;({ data, error } = await fetchProducts())
    }

    if (error) {
      setError(error.message)
      applyProducts([])
    } else if (data) {
      setError('')
      applyProducts(data)
    }

    setLoading(false)
  }, [user, applyProducts, refreshUser])

  const loadHistory = useCallback(async (productId: string) => {
    const { data, error } = await insforge.database
      .from('price_history')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setPriceHistory([])
      setEditingHistory({})
      return
    }

    const history = data || []
    setPriceHistory(history)
    setEditingHistory(
      history.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = String(item.price)
        return acc
      }, {})
    )
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) {
      const cachedProducts = readCachedProducts(user.id)
      if (cachedProducts) {
        hydratedFromCacheRef.current = true
        queueMicrotask(() => {
          applyProducts(cachedProducts)
        })
      } else {
        hydratedFromCacheRef.current = false
      }

      queueMicrotask(() => {
        void loadProducts({ force: true, keepCurrentUI: hydratedFromCacheRef.current })
      })
    }
  }, [user, loadProducts, applyProducts])

  async function createProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!newProduct.title.trim() || !user) return

    const title = newProduct.title.trim()
    const description = newProduct.description.trim() || null
    const price = newProduct.price ? parseFloat(newProduct.price) : null
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const now = new Date().toISOString()
    const optimisticProduct: Product = {
      id: optimisticId,
      title,
      description,
      current_price: price,
      created_at: now,
      updated_at: now,
    }

    setCreating(true)
    setError('')
    setProducts((previous) => {
      const nextProducts = [optimisticProduct, ...previous]
      writeCachedProducts(user.id, nextProducts)
      return nextProducts
    })
    setNewProduct({ title: '', description: '', price: '' })
    setShowCreateModal(false)
    setCreating(false)

    const { data, error: insertError } = await insforge.database
      .from('products')
      .insert([
        {
          title,
          description,
          current_price: price,
        },
      ])
      .select('*')
      .single()

    if (insertError || !data) {
      setProducts((previous) => {
        const nextProducts = previous.filter((product) => product.id !== optimisticId)
        writeCachedProducts(user.id, nextProducts)
        return nextProducts
      })
      setError(insertError?.message ?? 'No se pudo crear el producto.')
      return
    }

    if (price !== null) {
      await insforge.database.from('price_history').insert([
        {
        product_id: data.id,
          price,
        },
      ])
    }

    setProducts((previous) => {
      const nextProducts = previous.map((product) => (product.id === optimisticId ? data : product))
      writeCachedProducts(user.id, nextProducts)
      return nextProducts
    })
  }

  async function openProductEditor(product: Product) {
    setError('')
    setSelectedProduct(product)
    setEditorForm({
      title: product.title,
      description: product.description || '',
    })
    setNewHistoryPrice(product.current_price !== null ? String(product.current_price) : '')
    setShowEditor(true)
    await loadHistory(product.id)
  }

  async function saveProductChanges() {
    if (!selectedProduct) return
    if (!editorForm.title.trim()) return

    setSavingProduct(true)
    setError('')
    const { data, error } = await insforge.database
      .from('products')
      .update({
        title: editorForm.title.trim(),
        description: editorForm.description.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedProduct.id)
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSavingProduct(false)
      return
    }

    if (data) {
      const updatedProduct = data as Product
      setSelectedProduct(updatedProduct)
      setProducts((current) => current.map((product) => (product.id === updatedProduct.id ? updatedProduct : product)))
    }

    setSavingProduct(false)
  }

  async function addNewHistoryPrice() {
    if (!selectedProduct || !user) return
    const parsedPrice = Number(newHistoryPrice.replace(',', '.'))
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) return

    setAddingHistory(true)
    setError('')

    const insertHistory = () =>
      insforge.database.from('price_history').insert([
        {
        product_id: selectedProduct.id,
          price: parsedPrice,
          created_by: user.id,
        },
      ])

    let { error: historyError } = await insertHistory()
    if (historyError && isAuthErrorMessage(historyError.message)) {
      await refreshUser()
      ;({ error: historyError } = await insertHistory())
    }

    if (historyError) {
      if (isAuthErrorMessage(historyError.message)) {
        setError('Tu sesión expiró. Inicia sesión de nuevo para actualizar precios.')
        setAddingHistory(false)
        router.push('/sign-in?redirect=/products')
        return
      }

      setError(historyError.message)
      setAddingHistory(false)
      return
    }

    const updateProductPrice = () =>
      insforge.database
        .from('products')
        .update({
          current_price: parsedPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedProduct.id)
        .select()
        .single()

    let { data: productData, error: productError } = await updateProductPrice()
    if (productError && isAuthErrorMessage(productError.message)) {
      await refreshUser()
      ;({ data: productData, error: productError } = await updateProductPrice())
    }

    if (productError) {
      if (isAuthErrorMessage(productError.message)) {
        setError('Tu sesión expiró. Inicia sesión de nuevo para actualizar precios.')
        setAddingHistory(false)
        router.push('/sign-in?redirect=/products')
        return
      }

      setError(productError.message)
      setAddingHistory(false)
      return
    }

    if (productData) {
      setSelectedProduct(productData)
      setProducts(products.map((product) => (product.id === productData.id ? productData : product)))
    }

    await loadHistory(selectedProduct.id)
    setAddingHistory(false)
  }

  async function saveHistoryEntry(entryId: string) {
    if (!selectedProduct) return
    const rawValue = editingHistory[entryId] ?? ''
    const parsedPrice = Number(rawValue.replace(',', '.'))
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) return

    setSavingHistoryId(entryId)
    setError('')

    const { error } = await insforge.database
      .from('price_history')
      .update({ price: parsedPrice })
      .eq('id', entryId)

    if (error) {
      setError(error.message)
      setSavingHistoryId(null)
      return
    }

    await loadHistory(selectedProduct.id)
    setSavingHistoryId(null)
  }

  async function deleteHistoryEntry(entryId: string) {
    if (!selectedProduct) return

    setDeletingHistoryId(entryId)
    setError('')

    const { error } = await insforge.database.from('price_history').delete().eq('id', entryId)

    if (error) {
      setError(error.message)
      setDeletingHistoryId(null)
      return
    }

    await loadHistory(selectedProduct.id)
    setDeletingHistoryId(null)
  }

  function closeEditor() {
    setShowEditor(false)
    setSelectedProduct(null)
    setPriceHistory([])
    setEditingHistory({})
    setNewHistoryPrice('')
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredProducts = normalizedSearch
    ? products.filter((product) => {
        const title = product.title.toLowerCase()
        const description = product.description?.toLowerCase() ?? ''
        return title.includes(normalizedSearch) || description.includes(normalizedSearch)
      })
    : products

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-secondary" />
          <p className="text-sm font-bold uppercase tracking-widest text-secondary">Sincronizando productos</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="min-h-screen w-full px-4 sm:px-6 py-8 pb-40">
        <div className="mx-auto w-full max-w-6xl space-y-10">
          <header className="flex min-h-[9rem] flex-col justify-between gap-6 sm:min-h-[9.5rem]">
            <div className="space-y-1.5 px-1">
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60">
                Catálogo
              </h1>
              <p className="max-w-2xl text-sm font-medium tracking-tight text-muted-foreground">
                Gestiona productos, descripciones y precios.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="group relative flex-1">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-muted-foreground group-focus-within:text-secondary transition-colors">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Busca por nombre o descripción..."
                  className="w-full rounded-2xl border border-border bg-muted/20 py-4 pl-14 pr-6 text-sm text-foreground placeholder-muted-foreground outline-none backdrop-blur-md transition-all focus:border-secondary/50 focus:bg-muted/40 focus:ring-4 focus:ring-secondary/10"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground shadow-xl shadow-secondary/20 transition-all hover:scale-105 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </header>

          {error && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-6 py-4 text-sm font-medium text-destructive backdrop-blur-md">
              {error}
            </div>
          )}

          {loading && products.length === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-3xl border border-border bg-muted/40" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
              <div className="h-24 w-24 flex items-center justify-center rounded-[2rem] bg-muted/40 text-muted-foreground ring-1 ring-border/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-foreground tracking-tight">
                  {products.length === 0 ? 'Catálogo sin ítems' : 'Sin resultados'}
                </h2>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  {products.length === 0
                    ? 'Tus productos creados aparecerán aquí para ser reutilizados en cualquier lista.'
                    : 'Prueba con otros términos de búsqueda.'}
                </p>
              </div>
              {products.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center justify-center rounded-xl bg-muted/40 px-6 py-3 text-sm font-bold text-foreground ring-1 ring-border/20 transition-all hover:bg-muted/60 active:scale-95"
                >
                  Crear mi primer producto
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={(nextProduct) => void openProductEditor(nextProduct)} />
              ))}
            </div>
          )}
        </div>
      </main>

      <FloatingActionButton
        visible={!showCreateModal}
        ariaLabel="Crear producto nuevo"
        onClick={() => setShowCreateModal(true)}
        className="bottom-28 !z-[60]"
      />

      <ProductCreateModal
        open={showCreateModal}
        creating={creating}
        newProduct={newProduct}
        setNewProduct={setNewProduct}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createProduct}
      />

      <ProductEditorModal
        open={showEditor}
        product={selectedProduct}
        editorForm={editorForm}
        setEditorForm={setEditorForm}
        savingProduct={savingProduct}
        priceHistory={priceHistory}
        editingHistory={editingHistory}
        setEditingHistory={setEditingHistory}
        newHistoryPrice={newHistoryPrice}
        setNewHistoryPrice={setNewHistoryPrice}
        addingHistory={addingHistory}
        savingHistoryId={savingHistoryId}
        deletingHistoryId={deletingHistoryId}
        onClose={closeEditor}
        onSaveProduct={() => void saveProductChanges()}
        onAddHistoryPrice={() => void addNewHistoryPrice()}
        onSaveHistoryEntry={(entryId) => void saveHistoryEntry(entryId)}
        onDeleteHistoryEntry={(entryId) => void deleteHistoryEntry(entryId)}
      />

      <MobileDashboardNav />
    </>
  )
}
