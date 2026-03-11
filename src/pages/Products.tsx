import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Package, Trash2, Search, X, Upload, Pencil, ChevronUp, ChevronDown, Loader2, FileSpreadsheet } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { Product } from '../types'
import CategoryDropdown from '../components/ui/CategoryDropdown'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import PageContent from '../components/layout/PageContent'
import { parseProductFile, type ProductImportRow } from '../utils/parseProductImport'
import { useAccessDirectory } from '../hooks/useAccessDirectory'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from '../components/ui/Table'

interface ProfileRow {
  store_id: string | null
}

interface DeleteDialogState {
  open: boolean
  ids: string[]
  label: string
}

const demoProducts: Product[] = [
  { id: '1', name: 'Chicken Meal', sku: 'MEAL-001', price: 129, stock: 40, category: 'Meals', unit: 'unit', created_at: new Date().toISOString() },
  { id: '2', name: 'Iced Tea', sku: 'DRINK-001', price: 45, stock: 120, category: 'Drinks', unit: 'unit', created_at: new Date().toISOString() },
  { id: '3', name: 'Rice', sku: 'ADDON-001', price: 20, stock: 200, category: 'Add-ons', unit: 'kg', created_at: new Date().toISOString() },
]

const EMPTY_PRODUCTS: Product[] = []

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const PRODUCT_UNITS = [
  { value: 'unit', label: 'Unit' },
  { value: 'kg', label: 'KG' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'L', label: 'Liter (L)' },
  { value: 'ml', label: 'ML' },
  { value: 'pack', label: 'Pack' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'can', label: 'Can' },
  { value: 'bag', label: 'Bag' },
  { value: 'box', label: 'Box' },
  { value: 'serving', label: 'Serving' },
  { value: 'slice', label: 'Slice' },
] as const

export type ProductUnitValue = (typeof PRODUCT_UNITS)[number]['value']

function getUnitLabel(value: string | null | undefined): string {
  if (!value) return 'Unit'
  const found = PRODUCT_UNITS.find((u) => u.value === value)
  return found ? found.label : value
}

const UNIT_LABEL_MAP = new Map(PRODUCT_UNITS.map((u) => [u.value, u.label]))
function getUnitLabelFast(value: string | null | undefined): string {
  if (!value) return 'Unit'
  return UNIT_LABEL_MAP.get(value) ?? value
}

type ProductSearchFieldFilter = 'all' | 'name' | 'sku'
const PRODUCT_SEARCH_FIELD_OPTIONS: { value: ProductSearchFieldFilter; label: string }[] = [
  { value: 'all', label: 'All fields' },
  { value: 'name', label: 'Name' },
  { value: 'sku', label: 'SKU' },
]

interface ProductTableRowProps {
  product: Product
  isSelected: boolean
  canWrite: boolean
  onToggleSelect: (id: string) => void
  onEdit: (product: Product) => void
  onDelete: (id: string, name: string) => void
  isEditPending: boolean
  isDeletePending: boolean
}

const ProductTableRow = memo(function ProductTableRow({
  product,
  isSelected,
  canWrite,
  onToggleSelect,
  onEdit,
  onDelete,
  isEditPending,
  isDeletePending,
}: ProductTableRowProps) {
  const categoryDisplay = product.category || 'Uncategorized'
  const skuDisplay = product.sku || '-'
  const priceFormatted = formatCurrency(product.price)
  const unitLabel = getUnitLabelFast(product.unit)
  const isLowStock = product.stock <= 10

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <input
          type="checkbox"
          checked={isSelected}
          disabled={!canWrite}
          onChange={() => onToggleSelect(product.id)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 min-w-0">
          <Package size={15} className="text-slate-400 shrink-0" />
          <span className="font-medium text-slate-700 truncate" title={product.name}>{product.name}</span>
        </div>
      </TableCell>
      <TableCell className="text-slate-500 truncate" title={categoryDisplay}>{categoryDisplay}</TableCell>
      <TableCell className="text-slate-500 font-mono text-xs truncate" title={product.sku ?? undefined}>{skuDisplay}</TableCell>
      <TableCell className="text-right font-medium text-slate-700">{priceFormatted}</TableCell>
      <TableCell className="text-right">
        <span className={isLowStock ? 'text-amber-600 font-semibold' : 'text-slate-700'}>{product.stock}</span>
      </TableCell>
      <TableCell className="text-slate-500">{unitLabel}</TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(product)}
            disabled={!canWrite || isEditPending}
            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md px-2 py-1"
          >
            <Pencil size={14} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(product.id, product.name)}
            disabled={!canWrite || isDeletePending}
            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md px-2 py-1"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
})

export default function Products() {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canAccess } = useAccessDirectory()
  const canWriteProducts = !isSupabaseConfigured || canAccess('products.write')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showForm, setShowForm] = useState(location.pathname === '/products/new')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    ids: [],
    label: '',
  })
  const selectAllRef = useRef<HTMLInputElement>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState<'dropzone' | 'preview'>('dropzone')
  const [importFileResults, setImportFileResults] = useState<{ id: string; file: File; result: ParseResult }[]>([])
  const [importRows, setImportRows] = useState<ProductImportRow[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importPage, setImportPage] = useState(1)
  const [importDragging, setImportDragging] = useState(false)
  const [importParsing, setImportParsing] = useState(false)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  const IMPORT_PAGE_SIZE = 10

  const [productsPageSize, setProductsPageSize] = useState<50 | 100>(50)
  const [productsPage, setProductsPage] = useState(1)

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState<ProductUnitValue>('unit')

  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  useEffect(() => {
    setShowForm(location.pathname === '/products/new')
  }, [location.pathname])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(t)
  }, [search])

  const profileQuery = useQuery({
    queryKey: ['profile-store', user?.id],
    enabled: Boolean(isSupabaseConfigured && user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user!.id)
        .single<ProfileRow>()

      if (error) throw error
      return data
    },
  })

  const storeId = profileQuery.data?.store_id ?? null

  const productsQuery = useQuery({
    queryKey: ['products', storeId],
    enabled: Boolean(isSupabaseConfigured ? storeId : true),
    queryFn: async () => {
      if (!isSupabaseConfigured) return demoProducts
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Product[]
    },
    staleTime: 60 * 1000,
  })

  const addProductMutation = useMutation({
    mutationFn: async (payload: { name: string; sku: string | null; price: number; stock: number; category: string; unit: string }) => {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured.')
      }
      if (!storeId) {
        throw new Error('No store found for this account.')
      }

      const { error } = await supabase.from('products').insert([
        {
          ...payload,
          store_id: storeId,
        },
      ])

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      resetForm()
      setShowForm(false)
      showSuccess('Product added successfully.')
      navigate('/products')
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to add product.')
    },
  })

  const updateProductMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; sku: string | null; price: number; stock: number; category: string; unit: string }) => {
      if (!isSupabaseConfigured || !storeId) throw new Error('Supabase and store are required.')
      const { error } = await supabase
        .from('products')
        .update({
          name: payload.name,
          sku: payload.sku,
          price: payload.price,
          stock: payload.stock,
          category: payload.category,
          unit: payload.unit,
        })
        .eq('id', payload.id)
        .eq('store_id', storeId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      resetForm()
      setEditingProduct(null)
      setShowForm(false)
      showSuccess('Product updated successfully.')
      navigate('/products')
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to update product.')
    },
  })

  function resetForm() {
    setName('')
    setSku('')
    setPrice('')
    setStock('')
    setCategory('')
    setUnit('unit')
    setEditingProduct(null)
  }

  const deleteProductsMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      if (!isSupabaseConfigured) {
        throw new Error('Delete is disabled in demo mode.')
      }
      if (!productIds.length) return
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', productIds)
        .eq('store_id', storeId)

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      setSelectedIds([])
      setDeleteDialog({ open: false, ids: [], label: '' })
      showSuccess('Selected product(s) deleted successfully.')
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to delete product.')
      setDeleteDialog({ open: false, ids: [], label: '' })
    },
  })

  const bulkImportMutation = useMutation({
    mutationFn: async (rows: ProductImportRow[]) => {
      if (!isSupabaseConfigured || !storeId) throw new Error('Supabase and a store are required to import.')
      if (!rows.length) return
      const payload = rows.map((r) => ({
        store_id: storeId,
        name: r.name,
        sku: r.sku,
        price: r.price,
        stock: r.stock,
        category: r.category,
        unit: 'unit',
      }))
      const { error } = await supabase.from('products').insert(payload)
      if (error) throw error
    },
    onSuccess: async (_, rows) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      showSuccess(`${rows.length} product(s) imported successfully.`)
      setImportOpen(false)
      setImportStep('dropzone')
      setImportFileResults([])
      setImportRows([])
      setImportErrors([])
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to import products.')
    },
  })

  function handleOpenForm() {
    if (!canWriteProducts) {
      showError('Read-only access: you cannot add products.')
      return
    }
    resetForm()
    setShowForm(true)
    navigate('/products/new')
  }

  function handleCloseForm() {
    setShowForm(false)
    resetForm()
    navigate('/products')
  }

  const handleEditProduct = useCallback((product: Product) => {
    setEditingProduct(product)
    setName(product.name)
    setSku(product.sku ?? '')
    setPrice(String(product.price))
    setStock(String(product.stock))
    setCategory(product.category || '')
    setUnit((PRODUCT_UNITS.some((u) => u.value === product.unit) ? product.unit : 'unit') as ProductUnitValue)
  }, [])

  function handleSubmitProduct(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      showError('Product name is required.')
      return
    }

    const parsedPrice = Number(price)
    const parsedStock = Number(stock)

    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      showError('Price must be greater than 0.')
      return
    }
    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      showError('Stock cannot be negative.')
      return
    }

    if (editingProduct) {
      updateProductMutation.mutate({
        id: editingProduct.id,
        name: name.trim(),
        sku: sku.trim() || null,
        price: parsedPrice,
        stock: parsedStock,
        category: category.trim() || 'Uncategorized',
        unit,
      })
    } else {
      addProductMutation.mutate({
        name: name.trim(),
        sku: sku.trim() || null,
        price: parsedPrice,
        stock: parsedStock,
        category: category.trim() || 'Uncategorized',
        unit,
      })
    }
  }

  const products = productsQuery.data ?? EMPTY_PRODUCTS
  const categories = useMemo(
    () => ['all', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))],
    [products],
  )

  const [searchFieldFilter, setSearchFieldFilter] = useState<ProductSearchFieldFilter>('all')
  const [sortKey, setSortKey] = useState<'name' | 'category' | 'sku' | 'price' | 'stock'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filteredProducts = useMemo(() => {
    const keyword = debouncedSearch.toLowerCase()
    return products.filter((p) => {
      let matchesSearch = true
      if (keyword) {
        if (searchFieldFilter === 'name') {
          matchesSearch = p.name.toLowerCase().includes(keyword)
        } else if (searchFieldFilter === 'sku') {
          matchesSearch = (p.sku ?? '').toLowerCase().includes(keyword)
        } else {
          matchesSearch =
            p.name.toLowerCase().includes(keyword) ||
            (p.sku ?? '').toLowerCase().includes(keyword)
        }
      }
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [products, debouncedSearch, categoryFilter, searchFieldFilter])

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts]
    const mult = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortKey === 'name') return mult * (a.name.localeCompare(b.name))
      if (sortKey === 'category') return mult * ((a.category ?? '').localeCompare(b.category ?? ''))
      if (sortKey === 'sku') return mult * ((a.sku ?? '').localeCompare(b.sku ?? ''))
      if (sortKey === 'price') return mult * (a.price - b.price)
      if (sortKey === 'stock') return mult * (a.stock - b.stock)
      return 0
    })
    return list
  }, [filteredProducts, sortKey, sortDir])

  const paginatedProducts = useMemo(
    () =>
      sortedProducts.slice(
        (productsPage - 1) * productsPageSize,
        productsPage * productsPageSize,
      ),
    [sortedProducts, productsPage, productsPageSize],
  )

  const totalProductsPages = Math.ceil(sortedProducts.length / productsPageSize) || 1

  useEffect(() => {
    setProductsPage(1)
  }, [debouncedSearch, categoryFilter, searchFieldFilter, productsPageSize, sortKey, sortDir])

  useEffect(() => {
    if (productsPage > totalProductsPages) setProductsPage(Math.max(1, totalProductsPages))
  }, [productsPage, totalProductsPages])

  const handleSort = (key: 'name' | 'category' | 'sku' | 'price' | 'stock') => {
    setSortKey(key)
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    setProductsPage(1)
  }

  const SortIcon = ({ column }: { column: 'name' | 'category' | 'sku' | 'price' | 'stock' }) =>
    sortKey === column ? (
      sortDir === 'asc' ? <ChevronUp size={18} className="inline ml-1 text-indigo-600" /> : <ChevronDown size={18} className="inline ml-1 text-indigo-600" />
    ) : (
      <ChevronDown size={18} className="inline ml-1 text-slate-300" />
    )

  const filteredIds = useMemo(() => paginatedProducts.map((p) => p.id), [paginatedProducts])
  const selectedInViewCount = useMemo(
    () => filteredIds.filter((id) => selectedIds.includes(id)).length,
    [filteredIds, selectedIds],
  )
  const allVisibleSelected = filteredIds.length > 0 && selectedInViewCount === filteredIds.length
  const hasSomeVisibleSelected = selectedInViewCount > 0 && !allVisibleSelected

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasSomeVisibleSelected
    }
  }, [hasSomeVisibleSelected])

  const toggleSelectAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)))
      return
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])))
  }, [allVisibleSelected, filteredIds])

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const openDeleteSingle = useCallback((productId: string, productName: string) => {
    if (!canWriteProducts) {
      return
    }
    setDeleteDialog({
      open: true,
      ids: [productId],
      label: `Are you sure you want to delete "${productName}"?`,
    })
  }, [canWriteProducts])

  function openDeleteBulk() {
    if (!canWriteProducts) return
    if (!selectedIds.length) return
    setDeleteDialog({
      open: true,
      ids: selectedIds,
      label: `Are you sure you want to delete ${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''}?`,
    })
  }

  function closeDeleteDialog() {
    setDeleteDialog({ open: false, ids: [], label: '' })
  }

  function closeImportModal() {
    setImportOpen(false)
    setImportStep('dropzone')
    setImportFileResults([])
    setImportRows([])
    setImportErrors([])
    setImportPage(1)
  }

  const ACCEPT_IMPORT = '.csv,.xlsx,.xls'

  async function addImportFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => {
      const n = f.name.toLowerCase()
      return n.endsWith('.csv') || n.endsWith('.xlsx') || n.endsWith('.xls')
    })
    if (list.length === 0) {
      showError('Please use .csv, .xlsx, or .xls files.')
      return
    }
    setImportParsing(true)
    try {
      const results = await Promise.all(
        list.map(async (file) => {
          const result = await parseProductFile(file)
          return { id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`, file, result }
        }),
      )
      setImportFileResults((prev) => [...prev, ...results])
    } finally {
      setImportParsing(false)
    }
  }

  function removeImportFile(id: string) {
    setImportFileResults((prev) => prev.filter((r) => r.id !== id))
  }

  function continueToPreview() {
    const allRows: ProductImportRow[] = []
    const allErrors: string[] = []
    importFileResults.forEach(({ file, result }) => {
      result.rows.forEach((r) => allRows.push(r))
      result.errors.forEach((e) => allErrors.push(`${file.name}: ${e}`))
    })
    setImportRows(allRows)
    setImportErrors(allErrors)
    setImportPage(1)
    setImportStep('preview')
  }

  const importValidRowCount = importFileResults.reduce((sum, r) => sum + r.result.rows.length, 0)
  const hasImportValidFiles = importValidRowCount > 0

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    e.target.value = ''
    if (!files?.length) return
    await addImportFiles(files)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageContent className="space-y-5">
        <div className="flex items-center gap-2">
          <Package size={24} className="text-slate-600" />
          <h1 className="text-xl font-bold text-slate-800">Products</h1>
        </div>

        {!isSupabaseConfigured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Demo mode: product changes are disabled until Supabase is connected.
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="products-search-field-filter" className="text-sm font-medium text-slate-600">
                Filter by:
              </label>
              <Select
                id="products-search-field-filter"
                value={searchFieldFilter}
                onChange={(e) => setSearchFieldFilter(e.target.value as ProductSearchFieldFilter)}
                className="min-w-[120px]"
              >
                {PRODUCT_SEARCH_FIELD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <CategoryDropdown
              value={categoryFilter}
              options={categories}
              onChange={setCategoryFilter}
            />

            {selectedIds.length > 0 && (
              <button
                onClick={openDeleteBulk}
                disabled={!canWriteProducts}
                className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
              >
                <Trash2 size={14} />
                Delete selected ({selectedIds.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenForm}
              disabled={!canWriteProducts}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              Add Product
            </button>
            <button
              type="button"
              onClick={() => {
                setImportOpen(true)
                setImportStep('dropzone')
                setImportFileResults([])
              }}
              disabled={!isSupabaseConfigured || !storeId || !canWriteProducts}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Upload size={16} />
              Import CSV / Excel
            </button>
          </div>
        </div>

        {showForm && !editingProduct && (
          <form onSubmit={handleSubmitProduct} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">New Product</h3>
              <button
                type="button"
                onClick={handleCloseForm}
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Product name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Product name"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Price</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Stock</label>
                <input
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Stock"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Unit</label>
                <Select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as ProductUnitValue)}
                >
                  {PRODUCT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Category (optional)</label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category (optional)"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">SKU (optional)</label>
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="SKU (optional)"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button
                type="button"
                onClick={handleCloseForm}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canWriteProducts}
                loading={addProductMutation.isPending}
              >
                Save Product
              </Button>
            </div>
          </form>
        )}

        <Modal
          open={Boolean(editingProduct)}
          onClose={() => { setEditingProduct(null); resetForm() }}
          title="Edit Product"
          maxWidthClassName="max-w-2xl"
        >
          {editingProduct && (
              <form onSubmit={handleSubmitProduct} className="space-y-4">

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Product name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Product name"
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Price</label>
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Stock</label>
                    <input
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Stock"
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Unit</label>
                    <Select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value as ProductUnitValue)}
                    >
                      {PRODUCT_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Category (optional)</label>
                    <input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Category (optional)"
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">SKU (optional)</label>
                    <input
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="SKU (optional)"
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => { setEditingProduct(null); resetForm() }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canWriteProducts}
                    loading={updateProductMutation.isPending}
                  >
                    Update Product
                  </Button>
                </div>
              </form>
          )}
        </Modal>

        {filteredProducts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Show per page:</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setProductsPageSize(50)}
                  className={`px-3 py-1.5 text-sm font-medium ${productsPageSize === 50 ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  50
                </button>
                <button
                  type="button"
                  onClick={() => setProductsPageSize(100)}
                  className={`px-3 py-1.5 text-sm font-medium ${productsPageSize === 100 ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  100
                </button>
              </div>
              <span className="text-sm text-slate-500">
                Showing {(productsPage - 1) * productsPageSize + 1}–{Math.min(productsPage * productsPageSize, filteredProducts.length)} of {filteredProducts.length}
              </span>
            </div>
            {totalProductsPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProductsPage((p) => Math.max(1, p - 1))}
                  disabled={productsPage <= 1}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {productsPage} of {totalProductsPages}
                </span>
                <button
                  type="button"
                  onClick={() => setProductsPage((p) => Math.min(totalProductsPages, p + 1))}
                  disabled={productsPage >= totalProductsPages}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <TableContainer>
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[3%]" />
                <col className="w-[25%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
                <col className="w-[20%]" />
              </colgroup>
              <TableHead>
                <TableHeaderRow>
                  <TableHeaderCell className="w-10">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={!canWriteProducts}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center gap-1 py-2.5 px-2 -my-1 -mx-1 rounded hover:text-slate-700 hover:bg-slate-100 focus:outline-none">
                      Product <SortIcon column="name" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <button type="button" onClick={() => handleSort('category')} className="inline-flex items-center gap-1 py-2.5 px-2 -my-1 -mx-1 rounded hover:text-slate-700 hover:bg-slate-100 focus:outline-none">
                      Category <SortIcon column="category" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <button type="button" onClick={() => handleSort('sku')} className="inline-flex items-center gap-1 py-2.5 px-2 -my-1 -mx-1 rounded hover:text-slate-700 hover:bg-slate-100 focus:outline-none">
                      SKU <SortIcon column="sku" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    <button type="button" onClick={() => handleSort('price')} className="inline-flex items-center gap-1 py-2.5 px-2 -my-1 -mx-1 rounded ml-auto hover:text-slate-700 hover:bg-slate-100 focus:outline-none">
                      Price <SortIcon column="price" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    <button type="button" onClick={() => handleSort('stock')} className="inline-flex items-center gap-1 py-2.5 px-2 -my-1 -mx-1 rounded ml-auto hover:text-slate-700 hover:bg-slate-100 focus:outline-none">
                      Stock <SortIcon column="stock" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell>Unit</TableHeaderCell>
                  <TableHeaderCell className="text-center">Action</TableHeaderCell>
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {productsQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell><div className="h-4 w-4 bg-slate-100 rounded" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-slate-100 rounded" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-slate-100 rounded" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-slate-100 rounded" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-slate-100 rounded ml-auto" /></TableCell>
                      <TableCell><div className="h-4 w-12 bg-slate-100 rounded ml-auto" /></TableCell>
                      <TableCell><div className="h-4 w-12 bg-slate-100 rounded" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-slate-100 rounded mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredProducts.length > 0 ? (
                  paginatedProducts.map((product) => (
                    <ProductTableRow
                      key={product.id}
                      product={product}
                      isSelected={selectedIds.includes(product.id)}
                      canWrite={canWriteProducts}
                      onToggleSelect={toggleSelectOne}
                      onEdit={handleEditProduct}
                      onDelete={openDeleteSingle}
                      isEditPending={updateProductMutation.isPending}
                      isDeletePending={deleteProductsMutation.isPending}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-slate-400">
                      No products found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </div>

        {filteredProducts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Show per page:</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setProductsPageSize(50)}
                  className={`px-3 py-1.5 text-sm font-medium ${productsPageSize === 50 ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  50
                </button>
                <button
                  type="button"
                  onClick={() => setProductsPageSize(100)}
                  className={`px-3 py-1.5 text-sm font-medium ${productsPageSize === 100 ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  100
                </button>
              </div>
              <span className="text-sm text-slate-500">
                Showing {(productsPage - 1) * productsPageSize + 1}–{Math.min(productsPage * productsPageSize, filteredProducts.length)} of {filteredProducts.length}
              </span>
            </div>
            {totalProductsPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProductsPage((p) => Math.max(1, p - 1))}
                  disabled={productsPage <= 1}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {productsPage} of {totalProductsPages}
                </span>
                <button
                  type="button"
                  onClick={() => setProductsPage((p) => Math.min(totalProductsPages, p + 1))}
                  disabled={productsPage >= totalProductsPages}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {deleteDialog.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-5">
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Confirm delete</h3>
              <p className="text-sm text-slate-600">{deleteDialog.label}</p>
              <p className="text-xs text-red-500 mt-2">This action cannot be undone.</p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={closeDeleteDialog}
                  className="px-4 py-2.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  disabled={deleteProductsMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteProductsMutation.mutate(deleteDialog.ids)}
                  className="px-4 py-2.5 text-sm rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-60"
                  disabled={deleteProductsMutation.isPending || !canWriteProducts}
                >
                  {deleteProductsMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {importOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800">Import products</h3>
                <button
                  type="button"
                  onClick={closeImportModal}
                  className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              {importStep === 'dropzone' ? (
                <>
                  <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
                    <div
                      role="button"
                      tabIndex={0}
                      onDragOver={(e) => { e.preventDefault(); setImportDragging(true) }}
                      onDragLeave={() => setImportDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setImportDragging(false)
                        addImportFiles(e.dataTransfer.files)
                      }}
                      onClick={() => importFileInputRef.current?.click()}
                      onKeyDown={(e) => e.key === 'Enter' && importFileInputRef.current?.click()}
                      className={`
                        border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                        ${importDragging ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'}
                      `}
                    >
                      <input
                        ref={importFileInputRef}
                        type="file"
                        accept={ACCEPT_IMPORT}
                        multiple
                        onChange={handleImportFile}
                        className="hidden"
                      />
                      {importParsing ? (
                        <div className="flex flex-col items-center gap-2 text-slate-600">
                          <Loader2 size={32} className="animate-spin text-indigo-600" />
                          <span className="text-sm font-medium">Validating files...</span>
                        </div>
                      ) : (
                        <>
                          <FileSpreadsheet size={40} className="mx-auto text-slate-400 mb-3" />
                          <p className="text-sm font-medium text-slate-700">
                            Drop CSV or Excel files here, or click to browse
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            .csv, .xlsx, .xls — first row must be headers (Name, SKU, Price, Stock, Category)
                          </p>
                        </>
                      )}
                    </div>

                    {importFileResults.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                          Files ({importFileResults.length})
                        </p>
                        <ul className="space-y-2 max-h-48 overflow-auto">
                          {importFileResults.map(({ id, file, result }) => {
                            const valid = result.rows.length > 0
                            const hasErrors = result.errors.length > 0
                            return (
                              <li
                                key={id}
                                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                                  valid ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-800 truncate">{file.name}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {(file.size / 1024).toFixed(1)} KB
                                  </p>
                                  {valid ? (
                                    <p className="text-xs text-green-700 mt-1">
                                      Valid: {result.rows.length} product(s)
                                      {hasErrors && ` · ${result.errors.length} row warning(s)`}
                                    </p>
                                  ) : (
                                    <div className="text-xs text-red-700 mt-1">
                                      {result.errors.slice(0, 2).map((err, i) => (
                                        <p key={i}>{err}</p>
                                      ))}
                                      {result.errors.length > 2 && (
                                        <p>+ {result.errors.length - 2} more</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeImportFile(id)}
                                  className="p-1.5 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 shrink-0"
                                  aria-label="Remove file"
                                >
                                  <X size={16} />
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={closeImportModal}
                      className="px-4 py-2.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={continueToPreview}
                      disabled={!hasImportValidFiles || importParsing}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Continue with {importValidRowCount} product(s)
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {importErrors.length > 0 && (
                    <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-sm text-amber-800">
                      {importErrors.slice(0, 3).map((err, i) => (
                        <p key={i}>{err}</p>
                      ))}
                      {importErrors.length > 3 && (
                        <p className="mt-1 text-amber-600">+ {importErrors.length - 3} more</p>
                      )}
                    </div>
                  )}
                  <div className="flex-1 overflow-auto px-5 py-3">
                    <p className="text-sm text-slate-600 mb-3">
                      Preview: {importRows.length} row(s). First row is used as headers (Name, SKU, Price, Stock, Category).
                    </p>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <Table>
                        <TableHead>
                          <TableHeaderRow className="bg-slate-50 border-slate-200">
                            <TableHeaderCell className="px-3 py-2 normal-case tracking-normal">Name</TableHeaderCell>
                            <TableHeaderCell className="px-3 py-2 normal-case tracking-normal">SKU</TableHeaderCell>
                            <TableHeaderCell className="px-3 py-2 text-right normal-case tracking-normal">Price</TableHeaderCell>
                            <TableHeaderCell className="px-3 py-2 text-right normal-case tracking-normal">Stock</TableHeaderCell>
                            <TableHeaderCell className="px-3 py-2 normal-case tracking-normal">Category</TableHeaderCell>
                          </TableHeaderRow>
                        </TableHead>
                        <TableBody>
                        {importRows
                          .slice((importPage - 1) * IMPORT_PAGE_SIZE, importPage * IMPORT_PAGE_SIZE)
                          .map((row, i) => {
                            const rowIndex = (importPage - 1) * IMPORT_PAGE_SIZE + i
                            return (
                              <TableRow key={rowIndex} className="border-slate-100">
                                <TableCell className="px-3 py-2 text-slate-800">{row.name}</TableCell>
                                <TableCell className="px-3 py-2 text-slate-500 font-mono text-xs">{row.sku ?? '-'}</TableCell>
                                <TableCell className="px-3 py-2 text-right">{formatCurrency(row.price)}</TableCell>
                                <TableCell className="px-3 py-2 text-right">{row.stock}</TableCell>
                                <TableCell className="px-3 py-2 text-slate-500">{row.category}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {importRows.length > IMPORT_PAGE_SIZE && (
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-slate-500">
                          Showing {(importPage - 1) * IMPORT_PAGE_SIZE + 1}–{Math.min(importPage * IMPORT_PAGE_SIZE, importRows.length)} of {importRows.length} rows
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setImportPage((p) => Math.max(1, p - 1))}
                            disabled={importPage <= 1}
                            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <span className="text-sm text-slate-600">
                            Page {importPage} of {Math.ceil(importRows.length / IMPORT_PAGE_SIZE)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setImportPage((p) => Math.min(Math.ceil(importRows.length / IMPORT_PAGE_SIZE), p + 1))}
                            disabled={importPage >= Math.ceil(importRows.length / IMPORT_PAGE_SIZE)}
                            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={closeImportModal}
                      className="px-4 py-2.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => bulkImportMutation.mutate(importRows)}
                      disabled={bulkImportMutation.isPending || importRows.length === 0 || !canWriteProducts}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {bulkImportMutation.isPending ? 'Importing...' : `Import ${importRows.length} product(s)`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </PageContent>
    </div>
  )
}
