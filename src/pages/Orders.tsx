import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Wallet,
  UtensilsCrossed,
  Store,
  ExternalLink,
  Receipt,
  Tag,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { Product, Order } from '../types'
import CategoryDropdown from '../components/ui/CategoryDropdown'
import { ReceiptModal, type ReceiptData } from '../components/receipt/ReceiptView'
import PageContent from '../components/layout/PageContent'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import SegmentedControl from '../components/ui/SegmentedControl'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableEmptyState,
  TableHead,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from '../components/ui/Table'

const ORDERS_LAYOUT_STORAGE_KEY = 'spark_orders_layout'

function getOrdersLayout(): 'default' | 'grid' {
  if (typeof window === 'undefined') return 'default'
  return localStorage.getItem(ORDERS_LAYOUT_STORAGE_KEY) === 'grid' ? 'grid' : 'default'
}

interface ProfileRow {
  store_id: string | null
  stores: { pos_type: string | null; name: string | null } | null
}

interface CartItem {
  product: Product
  quantity: number
}

interface StoreCouponRow {
  id: string
  store_id: string
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  expires_at: string | null
  max_total_uses: number | null
  used_count: number
  is_active: boolean
}

type PosType = 'restaurant' | 'retail'

const demoProducts: Product[] = [
  { id: '1', name: 'Chicken Meal', sku: 'MEAL-001', price: 129, stock: 15, category: 'Meals', created_at: new Date().toISOString() },
  { id: '2', name: 'Burger Meal', sku: 'MEAL-002', price: 109, stock: 12, category: 'Meals', created_at: new Date().toISOString() },
  { id: '3', name: 'Iced Tea', sku: 'DRINK-001', price: 45, stock: 24, category: 'Drinks', created_at: new Date().toISOString() },
]

const categoryColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-cyan-500']

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Orders() {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | 'card'>('cash')
  const [amountReceived, setAmountReceived] = useState('')
  const [orderType, setOrderType] = useState<'dine-in' | 'takeout'>('dine-in')
  const [cart, setCart] = useState<CartItem[]>([])
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<StoreCouponRow | null>(null)
  const [gcashCheckoutUrl, setGcashCheckoutUrl] = useState<string | null>(null)
  const [recentOrdersPage, setRecentOrdersPage] = useState(1)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [loadingReceiptOrderId, setLoadingReceiptOrderId] = useState<string | null>(null)

  const RECENT_ORDERS_PAGE_SIZE = 20
  const PRODUCTS_LIST_PAGE_SIZE = 10
  const [productsListPage, setProductsListPage] = useState(1)

  const logos = useMemo(() => {
    if (!isSupabaseConfigured) {
      return {
        gcash: null,
        visa: null,
      }
    }

    const gcashPublic = supabase.storage.from('assets').getPublicUrl('gcash-logo.png').data.publicUrl
    const visaPublic = supabase.storage.from('assets').getPublicUrl('visa_logo.png').data.publicUrl

    return {
      gcash: gcashPublic || null,
      visa: visaPublic || null,
    }
  }, [])

  const profileQuery = useQuery({
    queryKey: ['profile-store-orders', user?.id],
    enabled: Boolean(isSupabaseConfigured && user?.id),
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('store_id, stores(pos_type, name)')
        .eq('id', user!.id)
        .single<ProfileRow>()

      if (error) throw error
      return data
    },
  })

  const storeId = profileQuery.data?.store_id ?? null
  const posType: PosType =
    !isSupabaseConfigured
      ? 'restaurant'
      : (profileQuery.data?.stores?.pos_type as PosType | null) ?? 'restaurant'
  const ordersLayout = getOrdersLayout()

  const productsQuery = useQuery({
    queryKey: ['products-pos', storeId],
    enabled: Boolean(isSupabaseConfigured ? storeId : true),
    queryFn: async () => {
      if (!isSupabaseConfigured) return demoProducts
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as Product[]
    },
  })

  const couponsQuery = useQuery({
    queryKey: ['store-coupons-active', storeId],
    enabled: Boolean(isSupabaseConfigured && storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_coupons')
        .select('id, store_id, code, description, discount_type, discount_value, expires_at, max_total_uses, used_count, is_active')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as StoreCouponRow[]
    },
  })

  const recentOrdersQuery = useQuery({
    queryKey: ['orders-recent-pos', storeId],
    enabled: Boolean(isSupabaseConfigured ? storeId : true),
    queryFn: async () => {
      if (!isSupabaseConfigured) return [] as (Order & { profiles?: { full_name: string | null } | null })[]
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, status, customer_name, created_at, created_by, profiles:created_by(full_name)')
        .eq('store_id', storeId)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString())
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      return (data ?? []) as (Order & { profiles?: { full_name: string | null } | null })[]
    },
  })

  const recentOrders = recentOrdersQuery.data ?? []
  const paginatedRecentOrders = useMemo(
    () =>
      recentOrders.slice(
        (recentOrdersPage - 1) * RECENT_ORDERS_PAGE_SIZE,
        recentOrdersPage * RECENT_ORDERS_PAGE_SIZE,
      ),
    [recentOrders, recentOrdersPage],
  )
  const totalRecentOrdersPages = Math.ceil(recentOrders.length / RECENT_ORDERS_PAGE_SIZE) || 1

  async function openReceiptForOrder(orderId: string) {
    const storeName = profileQuery.data?.stores?.name ?? 'Store'
    if (!isSupabaseConfigured || !storeId) {
      showError('Cannot load receipt in demo mode.')
      return
    }
    setLoadingReceiptOrderId(orderId)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, customer_name, created_at, payment_method, order_items(quantity, price, products(name))')
        .eq('id', orderId)
        .eq('store_id', storeId)
        .single<{
          id: string
          total: number
          customer_name: string | null
          created_at: string
          payment_method: string
          order_items: Array<{ quantity: number; price: number; products: { name: string } | null }>
        }>()
      if (error) throw error
      if (!data) throw new Error('Order not found.')
      const items = (data.order_items ?? []).map((oi) => ({
        name: oi.products?.name ?? 'Item',
        quantity: oi.quantity,
        price: oi.price,
      }))
      setReceiptData({
        orderId: data.id,
        storeName,
        date: data.created_at,
        customerName: data.customer_name ?? 'Walk-in',
        items,
        subtotal: data.total,
        total: data.total,
        paymentMethod: data.payment_method ?? 'cash',
      })
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to load receipt.')
    } finally {
      setLoadingReceiptOrderId(null)
    }
  }

  const categories = useMemo(() => {
    const products = productsQuery.data ?? []
    return ['all', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))]
  }, [productsQuery.data])

  const filteredProducts = useMemo(() => {
    const products = productsQuery.data ?? []
    const keyword = search.toLowerCase()
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(keyword) || (p.sku ?? '').toLowerCase().includes(keyword)
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [productsQuery.data, search, categoryFilter])

  const paginatedProducts = useMemo(
    () =>
      filteredProducts.slice(
        (productsListPage - 1) * PRODUCTS_LIST_PAGE_SIZE,
        productsListPage * PRODUCTS_LIST_PAGE_SIZE,
      ),
    [filteredProducts, productsListPage],
  )
  const totalProductsPages = Math.ceil(filteredProducts.length / PRODUCTS_LIST_PAGE_SIZE) || 1

  useEffect(() => {
    setProductsListPage(1)
  }, [search, categoryFilter])

  function getCartQty(productId: string) {
    return cart.find((item) => item.product.id === productId)?.quantity ?? 0
  }

  function addToCart(product: Product) {
    const inCartQty = getCartQty(product.id)
    if (inCartQty >= product.stock) return

    setCart((prev) => {
      const index = prev.findIndex((item) => item.product.id === product.id)
      if (index === -1) return [...prev, { product, quantity: 1 }]
      return prev.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
    })
  }

  function increaseQty(productId: string) {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item
        if (item.quantity >= item.product.stock) return item
        return { ...item, quantity: item.quantity + 1 }
      }),
    )
  }

  function decreaseQty(productId: string) {
    setCart((prev) =>
      prev
        .map((item) => (item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    )
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [cart])
  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0
    if (appliedCoupon.discount_type === 'percent') {
      const percent = Math.max(0, Math.min(100, appliedCoupon.discount_value))
      return Number(((subtotal * percent) / 100).toFixed(2))
    }
    return Number(Math.min(subtotal, Math.max(0, appliedCoupon.discount_value)).toFixed(2))
  }, [appliedCoupon, subtotal])
  const total = Math.max(subtotal - discountAmount, 0)
  const received = Number(amountReceived || 0)
  const change = paymentMethod === 'cash' ? Math.max(received - total, 0) : 0

  function clearAppliedCoupon() {
    setAppliedCoupon(null)
    setCouponInput('')
  }

  function applyCoupon() {
    if (!isSupabaseConfigured || !storeId) {
      showError('Coupons are unavailable in demo mode.')
      return
    }
    const code = couponInput.trim().toUpperCase()
    if (!code) {
      showError('Enter a coupon code.')
      return
    }
    const match = (couponsQuery.data ?? []).find((c) => c.code.toUpperCase() === code)
    if (!match) {
      showError('Coupon not found.')
      return
    }
    if (!match.is_active) {
      showError('Coupon is inactive.')
      return
    }
    if (match.expires_at && new Date(match.expires_at).getTime() < Date.now()) {
      showError('Coupon has expired.')
      return
    }
    if (match.max_total_uses != null && match.used_count >= match.max_total_uses) {
      showError('Coupon usage limit reached.')
      return
    }
    setAppliedCoupon(match)
    setCouponInput(match.code)
    showSuccess(`Coupon ${match.code} applied.`)
  }

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!cart.length) throw new Error('Cart is empty.')
      if (paymentMethod === 'cash' && received < total) throw new Error('Amount received is less than total.')

      if (!isSupabaseConfigured) return `DEMO-${Date.now()}`
      if (!storeId) throw new Error('No store linked to this account.')

      const customer =
        posType === 'restaurant'
          ? `${customerName.trim() || 'Guest'} (${orderType})`
          : (customerName.trim() || null)

      const initialOrderStatus = paymentMethod === 'gcash' ? 'pending' : 'completed'
      const initialPaymentStatus = paymentMethod === 'gcash' ? 'processing' : 'completed'

      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert([{
          store_id: storeId,
          total,
          status: initialOrderStatus,
          payment_method: paymentMethod,
          payment_status: initialPaymentStatus,
          customer_name: customer,
          created_by: user?.id ?? null,
        }])
        .select('id')
        .single<{ id: string }>()
      if (orderError) throw orderError

      const orderItemsPayload = cart.map((item) => ({
        order_id: orderRow.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
        store_id: storeId,
      }))
      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsPayload)
      if (itemsError) throw itemsError

      if (appliedCoupon) {
        const { data: couponNow, error: couponFetchError } = await supabase
          .from('store_coupons')
          .select('id, code, used_count, max_total_uses, expires_at, is_active')
          .eq('id', appliedCoupon.id)
          .eq('store_id', storeId)
          .single<Pick<StoreCouponRow, 'id' | 'code' | 'used_count' | 'max_total_uses' | 'expires_at' | 'is_active'>>()
        if (couponFetchError) throw couponFetchError
        if (!couponNow.is_active) throw new Error('Applied coupon is no longer active.')
        if (couponNow.expires_at && new Date(couponNow.expires_at).getTime() < Date.now()) {
          throw new Error('Applied coupon has expired.')
        }
        if (couponNow.max_total_uses != null && couponNow.used_count >= couponNow.max_total_uses) {
          throw new Error('Applied coupon usage limit reached.')
        }

        const { data: couponUpdateRows, error: couponUpdateError } = await supabase
          .from('store_coupons')
          .update({
            used_count: couponNow.used_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', couponNow.id)
          .eq('store_id', storeId)
          .eq('used_count', couponNow.used_count)
          .select('id')
        if (couponUpdateError) throw couponUpdateError
        if (!couponUpdateRows || couponUpdateRows.length === 0) {
          throw new Error('Coupon was used by another checkout. Please try again.')
        }

        const { error: redemptionError } = await supabase
          .from('order_coupon_redemptions')
          .insert([{
            store_id: storeId,
            order_id: orderRow.id,
            coupon_id: couponNow.id,
            coupon_code: couponNow.code,
            discount_amount: discountAmount,
          }])
        if (redemptionError) throw redemptionError
      }

      if (paymentMethod !== 'gcash') {
        for (const item of cart) {
          const nextStock = Math.max(item.product.stock - item.quantity, 0)
          const { error: stockError } = await supabase
            .from('products')
            .update({ stock: nextStock })
            .eq('id', item.product.id)
            .eq('store_id', storeId)
          if (stockError) throw stockError
        }
      } else {
        const { data, error } = await supabase.functions.invoke('create-paymongo-gcash-payment', {
          body: { orderId: orderRow.id },
        })
        if (error) throw error
        if (data?.error) throw new Error(data.error)
        if (data?.checkoutUrl) {
          setGcashCheckoutUrl(data.checkoutUrl as string)
        }
      }

      return orderRow.id
    },
    onSuccess: async (orderId) => {
      if (paymentMethod === 'gcash') {
        showSuccess('Order created. Complete payment via GCash checkout link.')
      } else {
        showSuccess('Order placed successfully.')
        const storeName = profileQuery.data?.stores?.name ?? 'Store'
        setReceiptData({
          orderId,
          storeName,
          date: new Date().toISOString(),
          customerName: customerName.trim() || (posType === 'restaurant' ? `Guest (${orderType})` : '') || 'Walk-in',
          items: cart.map((item) => ({
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
          })),
          subtotal,
          total,
          paymentMethod,
          amountReceived: paymentMethod === 'cash' ? received : undefined,
          change: paymentMethod === 'cash' ? change : undefined,
        })
      }
      setCart([])
      setCustomerName('')
      if (paymentMethod !== 'gcash') setPaymentMethod('cash')
      setAmountReceived('')
      setOrderType('dine-in')
      setRecentOrdersPage(1)
      clearAppliedCoupon()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products-pos'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-recent-pos'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['weekly-sales'] }),
        queryClient.invalidateQueries({ queryKey: ['top-products'] }),
        queryClient.invalidateQueries({ queryKey: ['low-stock'] }),
        queryClient.invalidateQueries({ queryKey: ['store-coupons-active'] }),
      ])
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to place order.')
    },
  })

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageContent className="space-y-4">
        {!isSupabaseConfigured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Demo mode: checkout does not write to database.
          </div>
        )}
        <div className="flex items-center gap-2">
          <ShoppingCart size={24} className="text-slate-600" />
          <h1 className="text-xl font-bold text-slate-800">Orders</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {posType === 'restaurant' ? <UtensilsCrossed size={13} /> : <Store size={13} />}
          <span>Mode: {posType === 'restaurant' ? 'Cafe / Restaurant POS' : 'Retail Store POS'}</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 flex flex-col gap-3">
            {ordersLayout === 'grid' ? (
              <TraditionalGridProductsPanel
                search={search}
                onSearchChange={setSearch}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                categories={categories}
                filteredProducts={productsQuery.data ?? []}
                productsLoading={productsQuery.isLoading}
                getCartQty={getCartQty}
                addToCart={addToCart}
              />
            ) : posType === 'restaurant' ? (
              <RestaurantProductsPanel
                search={search}
                onSearchChange={setSearch}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                categories={categories}
                filteredProducts={paginatedProducts}
                productsLoading={productsQuery.isLoading}
                getCartQty={getCartQty}
                addToCart={addToCart}
              />
            ) : (
              <RetailProductsPanel
                search={search}
                onSearchChange={setSearch}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                categories={categories}
                filteredProducts={paginatedProducts}
                productsLoading={productsQuery.isLoading}
                getCartQty={getCartQty}
                addToCart={addToCart}
              />
            )}
            {filteredProducts.length > PRODUCTS_LIST_PAGE_SIZE && ordersLayout !== 'grid' && (
              <div className="flex flex-wrap items-center justify-between gap-2 py-2">
                <p className="text-xs text-slate-500">
                  Showing {(productsListPage - 1) * PRODUCTS_LIST_PAGE_SIZE + 1}–{Math.min(productsListPage * PRODUCTS_LIST_PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length} products
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setProductsListPage((p) => Math.max(1, p - 1))}
                    disabled={productsListPage <= 1}
                    variant="outline"
                    size="sm"
                    className="text-slate-600"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-slate-600">
                    Page {productsListPage} of {totalProductsPages}
                  </span>
                  <Button
                    type="button"
                    onClick={() => setProductsListPage((p) => Math.min(totalProductsPages, p + 1))}
                    disabled={productsListPage >= totalProductsPages}
                    variant="outline"
                    size="sm"
                    className="text-slate-600"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          <CheckoutPanel
            posType={posType}
            orderType={orderType}
            onOrderTypeChange={setOrderType}
            cart={cart}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            couponInput={couponInput}
            onCouponInputChange={setCouponInput}
            onApplyCoupon={applyCoupon}
            appliedCoupon={appliedCoupon}
            onRemoveCoupon={clearAppliedCoupon}
            amountReceived={amountReceived}
            onAmountReceivedChange={setAmountReceived}
            totalItems={totalItems}
            subtotal={subtotal}
            discountAmount={discountAmount}
            total={total}
            change={change}
            onIncreaseQty={increaseQty}
            onDecreaseQty={decreaseQty}
            onRemoveItem={removeFromCart}
            onPlaceOrder={() => {
              if (paymentMethod !== 'gcash') setGcashCheckoutUrl(null)
              checkoutMutation.mutate()
            }}
            isProcessing={checkoutMutation.isPending}
            gcashCheckoutUrl={gcashCheckoutUrl}
            onClearGcashUrl={() => setGcashCheckoutUrl(null)}
            gcashLogoUrl={logos.gcash}
            visaLogoUrl={logos.visa}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Today&apos;s Orders</h3>
          <TableContainer>
            <Table>
              <TableHead>
                <TableHeaderRow className="bg-transparent">
                  <TableHeaderCell className="px-0 py-2">Order ID</TableHeaderCell>
                  <TableHeaderCell className="px-0 py-2">Customer / Served by</TableHeaderCell>
                  <TableHeaderCell className="px-0 py-2">Date</TableHeaderCell>
                  <TableHeaderCell className="px-0 py-2 text-right">Total</TableHeaderCell>
                  <TableHeaderCell className="px-0 py-2 text-center">Receipt</TableHeaderCell>
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {paginatedRecentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="px-0 py-2 font-mono text-xs text-slate-500">#{order.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell className="px-0 py-2">{order.customer_name?.trim() || (order as { profiles?: { full_name: string | null } | null }).profiles?.full_name || '—'}</TableCell>
                    <TableCell className="px-0 py-2 text-slate-500 whitespace-nowrap">
                      {new Date(order.created_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell className="px-0 py-2 text-right font-medium text-slate-800">{formatCurrency(order.total)}</TableCell>
                    <TableCell className="px-0 py-2 text-center">
                      <Button
                        type="button"
                        onClick={() => openReceiptForOrder(order.id)}
                        disabled={loadingReceiptOrderId === order.id}
                        variant="ghost"
                        size="sm"
                        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md px-2 py-1"
                      >
                        <Receipt size={14} />
                        {loadingReceiptOrderId === order.id ? 'Loading…' : 'Receipt'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!recentOrdersQuery.isLoading && recentOrders.length === 0 && (
                  <TableEmptyState colSpan={5} className="px-0 py-6">
                    No orders today
                  </TableEmptyState>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {recentOrders.length > RECENT_ORDERS_PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Showing {(recentOrdersPage - 1) * RECENT_ORDERS_PAGE_SIZE + 1}–{Math.min(recentOrdersPage * RECENT_ORDERS_PAGE_SIZE, recentOrders.length)} of {recentOrders.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => setRecentOrdersPage((p) => Math.max(1, p - 1))}
                  disabled={recentOrdersPage <= 1}
                  variant="outline"
                  size="sm"
                  className="text-slate-600"
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-600">
                  Page {recentOrdersPage} of {totalRecentOrdersPages}
                </span>
                <Button
                  type="button"
                  onClick={() => setRecentOrdersPage((p) => Math.min(totalRecentOrdersPages, p + 1))}
                  disabled={recentOrdersPage >= totalRecentOrdersPages}
                  variant="outline"
                  size="sm"
                  className="text-slate-600"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageContent>

      {receiptData && (
        <ReceiptModal
          data={receiptData}
          onClose={() => setReceiptData(null)}
        />
      )}
    </div>
  )
}

function RestaurantProductsPanel({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  categories,
  filteredProducts,
  productsLoading,
  getCartQty,
  addToCart,
}: {
  search: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
  categories: string[]
  filteredProducts: Product[]
  productsLoading: boolean
  getCartQty: (productId: string) => number
  addToCart: (product: Product) => void
}) {
  return (
    <section className="xl:col-span-2 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search menu item or SKU..."
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <CategoryDropdown value={categoryFilter} options={categories} onChange={onCategoryChange} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {categories.filter((c) => c !== 'all').map((cat, idx) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`px-3 py-2 rounded-lg text-sm font-medium text-white ${categoryColors[idx % categoryColors.length]}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(productsLoading ? Array.from({ length: 6 }) : filteredProducts).map((item, idx) => {
          if (productsLoading) {
            return (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                <div className="h-4 w-32 bg-slate-100 rounded mb-2" />
                <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
                <div className="h-8 w-full bg-slate-100 rounded" />
              </div>
            )
          }

          const product = item as Product
          const cartQty = getCartQty(product.id)
          const remaining = product.stock - cartQty
          const outOfStock = remaining <= 0

          return (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              disabled={outOfStock}
              className={`text-left rounded-xl p-4 border transition ${
                outOfStock ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{product.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{product.category || 'Uncategorized'}</p>
                  <p className="text-xs text-slate-400 font-mono">{product.sku || '-'}</p>
                </div>
                <span className={`text-xs font-medium ${remaining <= 5 ? 'text-amber-600' : 'text-slate-500'}`}>
                  {remaining}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="font-semibold text-indigo-700">{formatCurrency(product.price)}</p>
                <span className="inline-flex items-center gap-1 text-xs rounded-lg bg-indigo-600 text-white px-2 py-1">
                  <Plus size={12} />
                  Add
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TraditionalGridProductsPanel({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  categories,
  filteredProducts,
  productsLoading,
  getCartQty,
  addToCart,
}: {
  search: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
  categories: string[]
  filteredProducts: Product[]
  productsLoading: boolean
  getCartQty: (productId: string) => number
  addToCart: (product: Product) => void
}) {
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [modalSearch, setModalSearch] = useState('')

  const categoryList = useMemo(() => categories.filter((c) => c !== 'all'), [categories])
  const productsInCategory = useMemo(() => {
    if (!selectedCategory) return []
    const keyword = modalSearch.trim().toLowerCase()
    return filteredProducts.filter((p) => {
      const matchCategory = (p.category || 'Uncategorized') === selectedCategory
      if (!matchCategory) return false
      if (!keyword) return true
      return (
        p.name.toLowerCase().includes(keyword) || (p.sku ?? '').toLowerCase().includes(keyword)
      )
    })
  }, [filteredProducts, selectedCategory, modalSearch])

  function openCategoryModal(cat: string) {
    setSelectedCategory(cat)
    setModalSearch('')
    setCategoryModalOpen(true)
  }

  function closeCategoryModal() {
    setCategoryModalOpen(false)
    setSelectedCategory(null)
    setModalSearch('')
  }

  return (
    <section className="xl:col-span-2 space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {productsLoading ? (
          Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
              <div className="h-5 w-20 bg-slate-100 rounded mb-2" />
              <div className="h-4 w-14 bg-slate-100 rounded" />
            </div>
          ))
        ) : (
          categoryList.map((cat, idx) => {
            const count = filteredProducts.filter(
              (p) => (p.category || 'Uncategorized') === cat,
            ).length
            return (
              <button
                key={cat}
                type="button"
                onClick={() => openCategoryModal(cat)}
                className="rounded-xl p-4 border border-slate-200 bg-white hover:border-indigo-300 hover:shadow text-left transition"
              >
                <span
                  className={`inline-block px-2 py-1 rounded-md text-xs font-medium text-white ${categoryColors[idx % categoryColors.length]}`}
                >
                  {cat}
                </span>
                <p className="mt-2 text-sm font-semibold text-slate-800">{cat}</p>
                <p className="text-xs text-slate-500">{count} product{count !== 1 ? 's' : ''}</p>
              </button>
            )
          })
        )}
      </div>

      <Modal
        open={Boolean(categoryModalOpen && selectedCategory)}
        onClose={closeCategoryModal}
        title={selectedCategory ?? undefined}
        maxWidthClassName="max-w-2xl"
      >
        {selectedCategory && (
          <div className="-mx-6 -my-6 flex flex-col max-h-[85vh]">
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Filter by product name or SKU..."
                  className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto px-5 py-3">
              <ul className="space-y-2">
                {productsInCategory.length === 0 ? (
                  <li className="py-8 text-center text-slate-500 text-sm">No products match</li>
                ) : (
                  productsInCategory.map((product) => {
                    const cartQty = getCartQty(product.id)
                    const remaining = product.stock - cartQty
                    const outOfStock = remaining <= 0
                    return (
                      <li
                        key={product.id}
                        className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border border-slate-100 hover:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 truncate">{product.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{product.sku ?? '-'}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-indigo-600">
                            {formatCurrency(product.price)}
                          </span>
                          <span className="text-xs text-slate-500">Stock: {remaining}</span>
                          <Button
                            type="button"
                            onClick={() => addToCart(product)}
                            disabled={outOfStock}
                            size="sm"
                            className="px-3 py-1.5 text-xs"
                          >
                            <Plus size={14} />
                            {outOfStock ? 'Out' : 'Add'}
                          </Button>
                        </div>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

function RetailProductsPanel({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  categories,
  filteredProducts,
  productsLoading,
  getCartQty,
  addToCart,
}: {
  search: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
  categories: string[]
  filteredProducts: Product[]
  productsLoading: boolean
  getCartQty: (productId: string) => number
  addToCart: (product: Product) => void
}) {
  return (
    <section className="xl:col-span-2 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search product name or SKU..."
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <CategoryDropdown value={categoryFilter} options={categories} onChange={onCategoryChange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(productsLoading ? Array.from({ length: 6 }) : filteredProducts).map((item, idx) => {
          if (productsLoading) {
            return (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                <div className="h-4 w-32 bg-slate-100 rounded mb-2" />
                <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
                <div className="h-8 w-full bg-slate-100 rounded" />
              </div>
            )
          }

          const product = item as Product
          const cartQty = getCartQty(product.id)
          const remaining = product.stock - cartQty
          const outOfStock = remaining <= 0

          return (
            <div key={product.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{product.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{product.category || 'Uncategorized'}</p>
                  <p className="text-xs text-slate-400 font-mono">{product.sku || '-'}</p>
                </div>
                <span className={`text-xs font-medium ${remaining <= 5 ? 'text-amber-600' : 'text-slate-500'}`}>
                  Stock: {remaining}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="font-semibold text-indigo-700">{formatCurrency(product.price)}</p>
                <button
                  onClick={() => addToCart(product)}
                  disabled={outOfStock}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Plus size={13} />
                  {outOfStock ? 'Out of stock' : 'Add'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CheckoutPanel({
  posType,
  orderType,
  onOrderTypeChange,
  cart,
  customerName,
  onCustomerNameChange,
  paymentMethod,
  onPaymentMethodChange,
  couponInput,
  onCouponInputChange,
  onApplyCoupon,
  appliedCoupon,
  onRemoveCoupon,
  amountReceived,
  onAmountReceivedChange,
  totalItems,
  subtotal,
  discountAmount,
  total,
  change,
  onIncreaseQty,
  onDecreaseQty,
  onRemoveItem,
  onPlaceOrder,
  isProcessing,
  gcashCheckoutUrl,
  onClearGcashUrl,
  gcashLogoUrl,
  visaLogoUrl,
}: {
  posType: PosType
  orderType: 'dine-in' | 'takeout'
  onOrderTypeChange: (type: 'dine-in' | 'takeout') => void
  cart: CartItem[]
  customerName: string
  onCustomerNameChange: (value: string) => void
  paymentMethod: 'cash' | 'gcash' | 'card'
  onPaymentMethodChange: (value: 'cash' | 'gcash' | 'card') => void
  couponInput: string
  onCouponInputChange: (value: string) => void
  onApplyCoupon: () => void
  appliedCoupon: StoreCouponRow | null
  onRemoveCoupon: () => void
  amountReceived: string
  onAmountReceivedChange: (value: string) => void
  totalItems: number
  subtotal: number
  discountAmount: number
  total: number
  change: number
  onIncreaseQty: (id: string) => void
  onDecreaseQty: (id: string) => void
  onRemoveItem: (id: string) => void
  onPlaceOrder: () => void
  isProcessing: boolean
  gcashCheckoutUrl: string | null
  onClearGcashUrl: () => void
  gcashLogoUrl: string | null
  visaLogoUrl: string | null
}) {
  return (
    <aside className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart size={16} className="text-indigo-600" />
          <h3 className="font-semibold text-slate-800">Current Cart</h3>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {cart.map((item) => (
            <div key={item.product.id} className="border border-slate-100 rounded-lg p-2.5">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-700">{item.product.name}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(item.product.price)}</p>
                </div>
                <button onClick={() => onRemoveItem(item.product.id)} className="text-red-500 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="inline-flex items-center border border-slate-200 rounded-md">
                  <button onClick={() => onDecreaseQty(item.product.id)} className="px-2 py-1 hover:bg-slate-50">
                    <Minus size={12} />
                  </button>
                  <span className="px-3 text-sm font-medium">{item.quantity}</span>
                  <button onClick={() => onIncreaseQty(item.product.id)} className="px-2 py-1 hover:bg-slate-50">
                    <Plus size={12} />
                  </button>
                </div>
                <p className="text-sm font-semibold text-slate-700">{formatCurrency(item.product.price * item.quantity)}</p>
              </div>
            </div>
          ))}
          {cart.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Cart is empty</p>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-slate-800">Checkout</h3>

        {gcashCheckoutUrl && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            <p className="font-medium">GCash checkout ready.</p>
            <div className="mt-2 flex items-center gap-2">
              <a
                href={gcashCheckoutUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700"
              >
                <ExternalLink size={12} />
                Open checkout
              </a>
              <Button
                type="button"
                onClick={onClearGcashUrl}
                variant="ghost"
                size="sm"
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {posType === 'restaurant' && (
          <SegmentedControl
            value={orderType}
            onChange={onOrderTypeChange}
            options={[
              { value: 'dine-in', label: 'Dine-in' },
              { value: 'takeout', label: 'Takeout' },
            ]}
            optionClassName="text-xs px-2 py-2"
          />
        )}

        <input
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          placeholder={posType === 'restaurant' ? 'Table name / customer (optional)' : 'Customer name (optional)'}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <SegmentedControl
          value={paymentMethod}
          onChange={onPaymentMethodChange}
          options={[
            {
              value: 'cash',
              label: (
                <span className="inline-flex items-center justify-center gap-1">
                  <Wallet size={12} />
                  Cash
                </span>
              ),
            },
            {
              value: 'gcash',
              label: (
                <span className="inline-flex items-center justify-center gap-1.5">
                  {gcashLogoUrl ? (
                    <span className="inline-flex items-center rounded bg-white px-1 py-0.5">
                      <img src={gcashLogoUrl} alt="GCash" className="h-3 w-auto object-contain" />
                    </span>
                  ) : null}
                  GCash
                </span>
              ),
            },
            {
              value: 'card',
              label: (
                <span className="inline-flex items-center justify-center gap-1">
                  {visaLogoUrl ? (
                    <span className="inline-flex items-center rounded bg-white px-1 py-0.5">
                      <img src={visaLogoUrl} alt="Visa" className="h-3 w-auto object-contain" />
                    </span>
                  ) : null}
                  Card
                </span>
              ),
            },
          ]}
          optionClassName="text-xs px-2 py-2"
        />

        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Coupon code
          </label>
          <div className="flex items-center gap-2">
            <input
              value={couponInput}
              onChange={(e) => onCouponInputChange(e.target.value.toUpperCase())}
              placeholder="e.g. WELCOME10"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button
              type="button"
              onClick={onApplyCoupon}
              disabled={!couponInput.trim()}
              variant="outline"
              size="sm"
              className="px-3 py-2.5 text-xs font-semibold border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              Apply
            </Button>
          </div>
          {appliedCoupon && (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Tag size={12} />
                {appliedCoupon.code}
                {appliedCoupon.discount_type === 'percent'
                  ? ` (${appliedCoupon.discount_value}% off)`
                  : ` (${formatCurrency(appliedCoupon.discount_value)} off)`}
              </span>
              <Button
                type="button"
                onClick={onRemoveCoupon}
                variant="ghost"
                size="sm"
                className="text-emerald-700 hover:text-emerald-900 underline"
              >
                Remove
              </Button>
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            Better anti-abuse rule: only one coupon can be applied per order (no stacking).
          </p>
        </div>

        {paymentMethod === 'cash' && (
          <input
            value={amountReceived}
            onChange={(e) => onAmountReceivedChange(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount received"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Items</span>
            <span>{totalItems}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-slate-800 pt-1 border-t border-slate-100">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          {paymentMethod === 'cash' && (
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Change</span>
              <span>{formatCurrency(change)}</span>
            </div>
          )}
        </div>

        <Button
          onClick={onPlaceOrder}
          disabled={cart.length === 0}
          loading={isProcessing}
          fullWidth
          className={`mt-2 px-4 py-2.5 text-white font-semibold text-sm ${
            posType === 'restaurant' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          Place Order
        </Button>
      </div>
    </aside>
  )
}
