'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/src/store/UserContext'
import MobileDashboardNav from '@/src/layout/MobileDashboardNav'
import { ProductCreateModal } from '@/src/features/products/components/ProductCreateModal'
import { ProductEditorModal } from '@/src/features/products/components/ProductEditorModal'
import { ProductCard } from '@/src/features/products/components/ProductCard'
import { FloatingActionButton } from '@/src/components/atoms/FloatingActionButton'
import type { LoadProductsOptions, PriceHistory, Product, ProductHistoryEditMap } from '@/src/features/products/types'
import { isAuthError, isAuthErrorMessage } from '@/src/utils/authErrors'
import { readLocalCache, writeLocalCache } from '@/src/utils/localCache'
import { deletePriceHistoryEntry, fetchProductPriceHistory, fetchProductsByUser, insertPriceHistory, insertProduct, reconcileProducts, updatePriceHistoryEntry, updateProductCurrentPrice, updateProductDetails } from '@/src/features/products/services/productsService'
import { useProductsDerivedState } from '@/src/features/products/hooks/useProductsDerivedState'

const PRODUCTS_CACHE_TTL_MS = 5 * 60 * 1000
const PRODUCTS_CACHE_PREFIX = 'products_cache_v1:'
const PRODUCTS_MIN_REFETCH_GAP_MS = 8 * 1000

function getProductsCacheKey(userId: string) {
  return `${PRODUCTS_CACHE_PREFIX}${userId}`
}

function readCachedProducts(userId: string): Product[] | null {
  return readLocalCache<Product[]>(getProductsCacheKey(userId), PRODUCTS_CACHE_TTL_MS, 'products')
}

function writeCachedProducts(userId: string, products: Product[]) {
  writeLocalCache(getProductsCacheKey(userId), products, 'products')
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
  const [editingHistory, setEditingHistory] = useState<ProductHistoryEditMap>({})
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

  const loadProducts = useCallback(async (options?: LoadProductsOptions) => {
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

    let { data, error } = await fetchProductsByUser(user.id)

    if (isAuthError(error)) {
      await refreshUser()
      ;({ data, error } = await fetchProductsByUser(user.id))
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
    const { data, error } = await fetchProductPriceHistory(productId)

    if (error) {
      setError(error.message)
      setPriceHistory([])
      setEditingHistory({})
      return
    }

    const history = data || []
    setPriceHistory(history)
    setEditingHistory(
      history.reduce<ProductHistoryEditMap>((acc, item) => {
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

    const { data, error: insertError } = await insertProduct(title, description, price)

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
      await insertPriceHistory(data.id, price)
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
    const { data, error } = await updateProductDetails(selectedProduct.id, editorForm.title.trim(), editorForm.description.trim() || null)

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

    const insertHistory = () => insertPriceHistory(selectedProduct.id, parsedPrice, user.id)

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

    const updateProductPrice = () => updateProductCurrentPrice(selectedProduct.id, parsedPrice)

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

    const { error } = await updatePriceHistoryEntry(entryId, parsedPrice)

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

    const { error } = await deletePriceHistoryEntry(entryId)

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

  const { filteredProducts } = useProductsDerivedState({ products, search })

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
        <div className="mx-auto w-full max-w-4xl space-y-10">
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
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
