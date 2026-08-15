'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import MobileDashboardNav from '@/src/layout/MobileDashboardNav'
import { ProductCreateModal } from '@/src/features/products/components/ProductCreateModal'
import { ProductEditorModal } from '@/src/features/products/components/ProductEditorModal'
import { ProductCard } from '@/src/features/products/components/ProductCard'
import { FloatingActionButton } from '@/src/components/atoms/FloatingActionButton'
import { EmptyState, InlineAlert, ProtectedPageLoader } from '@/src/components/atoms/AsyncPageState'
import { CollectionPageHeader } from '@/src/components/organisms/CollectionPageHeader'
import type { PriceHistory, ProductHistoryEditMap } from '@/src/features/products/types'
import type { ProductRecord } from '@/src/types/product'
import type { CollectionLoadResult } from '@/src/types/collection'
import { isAuthErrorMessage } from '@/src/utils/authErrors'
import { deletePriceHistoryEntry, fetchProductPriceHistory, fetchProductsByUser, insertPriceHistory, insertProduct, reconcileProducts, updatePriceHistoryEntry, updateProductCurrentPrice, updateProductDetails } from '@/src/features/products/services/productsService'
import { useProductsDerivedState } from '@/src/features/products/hooks/useProductsDerivedState'
import { useCachedCollection } from '@/src/hooks/useCachedCollection'
import { useProtectedUser } from '@/src/hooks/useProtectedUser'
import { createOptimisticId, parseOptionalPrice, parseRequiredPrice } from '@/src/utils/productValues'

const PRODUCTS_CACHE_TTL_MS = 5 * 60 * 1000
const PRODUCTS_CACHE_PREFIX = 'products_cache_v1:'
const PRODUCTS_MIN_REFETCH_GAP_MS = 8 * 1000

export default function ProductsPage() {
  const router = useRouter()
  const { user, loading: authLoading, refreshUser } = useProtectedUser()
  const [search, setSearch] = useState('')
  const [newProduct, setNewProduct] = useState({ title: '', description: '', price: '' })
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editorForm, setEditorForm] = useState({ title: '', description: '' })
  const [savingProduct, setSavingProduct] = useState(false)
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [editingHistory, setEditingHistory] = useState<ProductHistoryEditMap>({})
  const [newHistoryPrice, setNewHistoryPrice] = useState('')
  const [savingHistoryId, setSavingHistoryId] = useState<string | null>(null)
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null)
  const [addingHistory, setAddingHistory] = useState(false)
  const fetchProductCollection = useCallback(async (userId: string): Promise<CollectionLoadResult<ProductRecord>> => {
    const { data, error } = await fetchProductsByUser(userId)
    return { data: data || undefined, error: error || undefined }
  }, [])

  const {
    items: products,
    setItems: setProducts,
    loading,
    error,
    setError,
  } = useCachedCollection<ProductRecord>({
    userId: user?.id,
    cachePrefix: PRODUCTS_CACHE_PREFIX,
    legacyValueKey: 'products',
    ttlMs: PRODUCTS_CACHE_TTL_MS,
    minRefetchGapMs: PRODUCTS_MIN_REFETCH_GAP_MS,
    load: fetchProductCollection,
    reconcile: reconcileProducts,
    refreshUser,
  })

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
  }, [setError])

  async function createProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!newProduct.title.trim() || !user) return

    const title = newProduct.title.trim()
    const description = newProduct.description.trim() || null
    const price = parseOptionalPrice(newProduct.price)
    if (price === undefined) {
      setError('Introduce un precio válido.')
      return
    }
    const optimisticId = createOptimisticId('optimistic-product')
    const now = new Date().toISOString()
    const optimisticProduct: ProductRecord = {
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
      return [optimisticProduct, ...previous]
    })
    setNewProduct({ title: '', description: '', price: '' })
    setShowCreateModal(false)
    setCreating(false)

    const { data, error: insertError } = await insertProduct(title, description, price)

    if (insertError || !data) {
      setProducts((previous) => {
        return previous.filter((product) => product.id !== optimisticId)
      })
      setError(insertError?.message ?? 'No se pudo crear el producto.')
      return
    }

    if (price !== null) {
      await insertPriceHistory(data.id, price)
    }

    setProducts((previous) => {
      return previous.map((product) => (product.id === optimisticId ? data : product))
    })
  }

  async function openProductEditor(product: ProductRecord) {
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
      const updatedProduct = data as ProductRecord
      setSelectedProduct(updatedProduct)
      setProducts((current) => current.map((product) => (product.id === updatedProduct.id ? updatedProduct : product)))
    }

    setSavingProduct(false)
  }

  async function addNewHistoryPrice() {
    if (!selectedProduct || !user) return
    const parsedPrice = parseRequiredPrice(newHistoryPrice)
    if (parsedPrice === undefined) return

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
      setProducts((current) => current.map((product) => (product.id === productData.id ? productData : product)))
    }

    await loadHistory(selectedProduct.id)
    setAddingHistory(false)
  }

  async function saveHistoryEntry(entryId: string) {
    if (!selectedProduct) return
    const rawValue = editingHistory[entryId] ?? ''
    const parsedPrice = parseRequiredPrice(rawValue)
    if (parsedPrice === undefined) return

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
    return <ProtectedPageLoader label="Sincronizando productos" />
  }

  return (
    <>
      <main className="min-h-screen w-full px-4 sm:px-6 py-8 pb-40">
        <div className="mx-auto w-full max-w-4xl space-y-10">
          <CollectionPageHeader
            title="Catálogo"
            subtitle="Gestiona productos, descripciones y precios."
            search={search}
            searchPlaceholder="Busca por nombre o descripción..."
            onSearchChange={setSearch}
            onCreate={() => setShowCreateModal(true)}
          />

          <InlineAlert message={error} />

          {loading && products.length === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-3xl border border-border bg-muted/40" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              }
              title={products.length === 0 ? 'Catálogo sin ítems' : 'Sin resultados'}
              description={products.length === 0
                ? 'Tus productos creados aparecerán aquí para ser reutilizados en cualquier lista.'
                : 'Prueba con otros términos de búsqueda.'}
              actionLabel={products.length === 0 ? 'Crear mi primer producto' : undefined}
              onAction={products.length === 0 ? () => setShowCreateModal(true) : undefined}
            />
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
