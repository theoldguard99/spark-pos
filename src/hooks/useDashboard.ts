import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { DashboardStats, SalesDataPoint, TopProduct, Order, Product } from '../types'

const LOW_STOCK_THRESHOLD = 10

async function fetchDashboardStats(): Promise<DashboardStats> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [ordersRes, itemsRes, stockRes] = await Promise.all([
    supabase
      .from('orders')
      .select('total, status')
      .gte('created_at', todayStart.toISOString())
      .eq('status', 'completed'),
    supabase
      .from('order_items')
      .select('quantity, orders!inner(created_at, status)')
      .gte('orders.created_at', todayStart.toISOString())
      .eq('orders.status', 'completed'),
    supabase
      .from('products')
      .select('id')
      .lt('stock', LOW_STOCK_THRESHOLD),
  ])

  const todayRevenue = (ordersRes.data ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0)
  const totalOrders = (ordersRes.data ?? []).length
  const itemsSold = (itemsRes.data ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0)
  const lowStockCount = (stockRes.data ?? []).length

  return { todayRevenue, totalOrders, itemsSold, lowStockCount }
}

async function fetchWeeklySales(): Promise<SalesDataPoint[]> {
  const days: SalesDataPoint[] = []
  const now = new Date()

  for (let i = 6; i >= 0; i--) {
    const start = new Date(now)
    start.setDate(now.getDate() - i)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)

    const { data } = await supabase
      .from('orders')
      .select('total')
      .eq('status', 'completed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    const revenue = (data ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0)
    days.push({
      day: start.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue,
      orders: (data ?? []).length,
    })
  }

  return days
}

async function fetchRecentOrders(): Promise<(Order & { created_by?: string | null; profiles?: { full_name: string | null } | null })[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, total, status, customer_name, created_at, created_by, profiles:created_by(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return (data ?? []) as (Order & { created_by?: string | null; profiles?: { full_name: string | null } | null })[]
}

async function fetchTopProducts(): Promise<TopProduct[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('product_id, quantity, price, products(name)')
    .limit(200)

  if (error) throw error

  const map: Record<string, TopProduct> = {}
  for (const item of data ?? []) {
    const pid = item.product_id
    if (!map[pid]) {
      map[pid] = {
        product_id: pid,
        name: (item.products as unknown as { name: string })?.name ?? 'Unknown',
        total_quantity: 0,
        total_revenue: 0,
      }
    }
    map[pid].total_quantity += item.quantity ?? 0
    map[pid].total_revenue += (item.quantity ?? 0) * (item.price ?? 0)
  }

  return Object.values(map)
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, 5)
}

async function fetchLowStockProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .lt('stock', LOW_STOCK_THRESHOLD)
    .order('stock', { ascending: true })
    .limit(10)

  if (error) throw error
  return data ?? []
}

const emptyStats: DashboardStats = { todayRevenue: 0, totalOrders: 0, itemsSold: 0, lowStockCount: 0 }
const emptyWeeklySales: SalesDataPoint[] = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => ({ day, revenue: 0, orders: 0 }))

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: isSupabaseConfigured ? fetchDashboardStats : async () => emptyStats,
    refetchInterval: isSupabaseConfigured ? 30000 : false,
  })
}

export function useWeeklySales() {
  return useQuery({
    queryKey: ['weekly-sales'],
    queryFn: isSupabaseConfigured ? fetchWeeklySales : async () => emptyWeeklySales,
    refetchInterval: isSupabaseConfigured ? 60000 : false,
  })
}

export function useRecentOrders() {
  return useQuery({
    queryKey: ['recent-orders'],
    queryFn: isSupabaseConfigured ? fetchRecentOrders : async () => [] as Order[],
    refetchInterval: isSupabaseConfigured ? 30000 : false,
  })
}

export function useTopProducts() {
  return useQuery({
    queryKey: ['top-products'],
    queryFn: isSupabaseConfigured ? fetchTopProducts : async () => [] as TopProduct[],
    refetchInterval: isSupabaseConfigured ? 60000 : false,
  })
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ['low-stock'],
    queryFn: isSupabaseConfigured ? fetchLowStockProducts : async () => [] as Product[],
    refetchInterval: isSupabaseConfigured ? 60000 : false,
  })
}
