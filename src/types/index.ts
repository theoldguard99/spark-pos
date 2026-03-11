export interface Product {
  id: string
  name: string
  sku?: string | null
  price: number
  stock: number
  category: string
  unit?: string | null
  created_at: string
}

export interface Order {
  id: string
  total: number
  status: 'pending' | 'completed' | 'cancelled' | 'refunded'
  created_at: string
  customer_name?: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  price: number
  product?: Product
}

export interface DashboardStats {
  todayRevenue: number
  totalOrders: number
  itemsSold: number
  lowStockCount: number
}

export interface SalesDataPoint {
  day: string
  revenue: number
  orders: number
}

export interface TopProduct {
  product_id: string
  name: string
  total_quantity: number
  total_revenue: number
}
