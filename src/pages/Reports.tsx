import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import {
  BarChart3,
  DollarSign,
  ShoppingBag,
  Package,
  Calendar,
  Loader2,
  TrendingUp,
  ListOrdered,
  Eye,
  Download,
} from 'lucide-react'
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageContent from '../components/layout/PageContent'
import type { SalesDataPoint, TopProduct } from '../types'
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
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'

type ReportPeriod = '7' | '30'

interface ProfileRow {
  store_id: string | null
}

function formatCurrency(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getDateRange(period: ReportPeriod): { start: Date; end: Date } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  const days = period === '7' ? 6 : 29
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

function getRoleLabel(role: string | null): string {
  if (!role) return '—'
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  if (role === 'manager') return 'Manager'
  return 'Employee'
}

export default function Reports() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<ReportPeriod>('7')
  const [selectedTransaction, setSelectedTransaction] = useState<{
    id: string
    total: number
    status: string
    customer_name: string | null
    created_at: string
    payment_method: string | null
    created_by: string | null
    profiles: { full_name: string | null; role: string | null } | null
    order_items: Array<{ quantity: number; price: number; products: { name: string } | null }>
  } | null>(null)

  const profileQuery = useQuery({
    queryKey: ['reports-profile', user?.id],
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
  const { start, end } = useMemo(() => getDateRange(period), [period])

  const summaryQuery = useQuery({
    queryKey: ['reports-summary', storeId, start.toISOString(), end.toISOString()],
    enabled: Boolean(isSupabaseConfigured && storeId),
    queryFn: async () => {
      const [ordersRes, itemsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, total')
          .eq('store_id', storeId)
          .eq('status', 'completed')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString()),
        supabase
          .from('order_items')
          .select('quantity, orders!inner(store_id, created_at, status)')
          .eq('orders.store_id', storeId)
          .eq('orders.status', 'completed')
          .gte('orders.created_at', start.toISOString())
          .lte('orders.created_at', end.toISOString()),
      ])

      const orders = ordersRes.data ?? []
      const revenue = orders.reduce((sum, o) => sum + (o.total ?? 0), 0)
      const itemsSold = (itemsRes.data ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0)

      return { revenue, ordersCount: orders.length, itemsSold }
    },
  })

  const chartQuery = useQuery({
    queryKey: ['reports-chart', storeId, period],
    enabled: Boolean(isSupabaseConfigured && storeId),
    queryFn: async () => {
      const days: SalesDataPoint[] = []
      const count = period === '7' ? 7 : 30

      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(end)
        d.setDate(d.getDate() - i)
        d.setHours(0, 0, 0, 0)
        const dayEnd = new Date(d)
        dayEnd.setHours(23, 59, 59, 999)

        const { data } = await supabase
          .from('orders')
          .select('total')
          .eq('store_id', storeId)
          .eq('status', 'completed')
          .gte('created_at', d.toISOString())
          .lte('created_at', dayEnd.toISOString())

        const revenue = (data ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0)
        days.push({
          day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue,
          orders: (data ?? []).length,
        })
      }

      return days
    },
  })

  const topProductsQuery = useQuery({
    queryKey: ['reports-top-products', storeId, start.toISOString(), end.toISOString()],
    enabled: Boolean(isSupabaseConfigured && storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('product_id, quantity, price, products(name), orders!inner(store_id, created_at, status)')
        .eq('orders.store_id', storeId)
        .eq('orders.status', 'completed')
        .gte('orders.created_at', start.toISOString())
        .lte('orders.created_at', end.toISOString())

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
        .slice(0, 10)
    },
  })

  const transactionsQuery = useQuery({
    queryKey: ['reports-transactions', storeId, start.toISOString(), end.toISOString()],
    enabled: Boolean(isSupabaseConfigured && storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          status,
          customer_name,
          created_at,
          payment_method,
          created_by,
          profiles:created_by(full_name, role),
          order_items(quantity, price, products(name))
        `)
        .eq('store_id', storeId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        total: number
        status: string
        customer_name: string | null
        created_at: string
        payment_method: string | null
        created_by: string | null
        profiles: { full_name: string | null; role: string | null } | null
        order_items: Array<{
          quantity: number
          price: number
          products: { name: string } | null
        }>
      }>
    },
  })

  const chartData = chartQuery.data ?? []
  const summary = summaryQuery.data
  const topProducts = topProductsQuery.data ?? []
  const transactions = transactionsQuery.data ?? []
  const isLoading =
    profileQuery.isLoading ||
    summaryQuery.isLoading ||
    chartQuery.isLoading ||
    topProductsQuery.isLoading ||
    transactionsQuery.isLoading

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        <p className="text-indigo-600">Revenue: {formatCurrency(payload[0]?.value ?? 0)}</p>
        <p className="text-slate-500">Orders: {payload[1]?.value ?? 0}</p>
      </div>
    )
  }

  const exportTransactionLogToExcel = () => {
    const headers = [
      'Date & Time',
      'Order ID',
      'Customer',
      'Transaction by',
      'Role',
      'Products bought',
      'Products paid for',
      'Payment',
      'Status',
      'Total',
    ]
    const rows = transactions.map((tx) => {
      const employeeName = tx.profiles?.full_name ?? (tx.created_by ? 'Unknown' : '—')
      const roleLabel = getRoleLabel(tx.profiles?.role ?? null)
      const productsBought = (tx.order_items ?? [])
        .map((oi) => `${(oi.products as { name: string } | null)?.name ?? 'Unknown'} × ${oi.quantity}`)
        .join(', ') || '—'
      const productsPaidFor = (tx.order_items ?? [])
        .map((oi) => {
          const name = (oi.products as { name: string } | null)?.name ?? 'Unknown'
          const lineTotal = (oi.quantity ?? 0) * (oi.price ?? 0)
          return `${name} × ${oi.quantity} @ ${formatCurrency(lineTotal)}`
        })
        .join('; ') || '—'
      return [
        new Date(tx.created_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' }),
        `#${tx.id.slice(0, 8).toUpperCase()}`,
        tx.customer_name || '—',
        employeeName,
        roleLabel,
        productsBought,
        productsPaidFor,
        (tx.payment_method || '—').toString(),
        tx.status,
        tx.total,
      ]
    })
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transaction Log')
    const filename = `Transaction_Log_${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  const exportReportsToExcel = () => {
    const wb = XLSX.utils.book_new()

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Reports Summary', ''],
      ['Period', `Last ${period} days`],
      ['From', start.toLocaleDateString('en-PH')],
      ['To', end.toLocaleDateString('en-PH')],
      [],
      ['Total Revenue', summary?.revenue ?? 0],
      ['Orders', summary?.ordersCount ?? 0],
      ['Items Sold', summary?.itemsSold ?? 0],
    ])
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    const salesHeaders = ['Day', 'Revenue', 'Orders']
    const salesRows = chartData.map((d) => [d.day, d.revenue, d.orders])
    const salesSheet = XLSX.utils.aoa_to_sheet([salesHeaders, ...salesRows])
    XLSX.utils.book_append_sheet(wb, salesSheet, 'Sales Over Time')

    const topHeaders = ['#', 'Product', 'Qty Sold', 'Revenue']
    const topRows = topProducts.map((p, idx) => [idx + 1, p.name, p.total_quantity, p.total_revenue])
    const topSheet = XLSX.utils.aoa_to_sheet([topHeaders, ...topRows])
    XLSX.utils.book_append_sheet(wb, topSheet, 'Top Products')

    const filename = `Reports_Last_${period}_days_${end.toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 flex items-center justify-center">
        <div className="text-center px-6">
          <BarChart3 size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Reports</h2>
          <p className="text-slate-500 max-w-sm">
            Connect Supabase in <code className="bg-slate-100 px-1 rounded">.env</code> to see sales reports and analytics.
          </p>
        </div>
      </div>
    )
  }

  if (!storeId && !profileQuery.isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 flex items-center justify-center">
        <div className="text-center px-6">
          <BarChart3 size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">No store linked</h2>
          <p className="text-slate-500 max-w-sm">Complete onboarding or link a store in Settings to view reports.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageContent className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={24} className="text-slate-600" />
            <h1 className="text-xl font-bold text-slate-800">Reports</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={exportReportsToExcel}
              variant="outline"
              className="px-4 py-2 text-sm"
            >
              <Download size={16} />
              Export reports
            </Button>
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
            <Calendar size={16} className="text-slate-500" />
            {(['7', '30'] as ReportPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Last {p} days
              </button>
            ))}
          </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <DollarSign size={24} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Revenue</p>
                  <p className="text-2xl font-bold text-slate-800">{summary ? formatCurrency(summary.revenue) : '₱0.00'}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <ShoppingBag size={24} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Orders</p>
                  <p className="text-2xl font-bold text-slate-800">{summary?.ordersCount ?? 0}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Package size={24} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Items Sold</p>
                  <p className="text-2xl font-bold text-slate-800">{summary?.itemsSold ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp size={18} className="text-indigo-600" />
                <h2 className="font-semibold text-slate-800">Sales Over Time</h2>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="revenue"
                      tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <YAxis
                      yAxisId="orders"
                      orientation="right"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="revenue" dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Line
                      yAxisId="orders"
                      type="monotone"
                      dataKey="orders"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Top Products</h2>
                <p className="text-xs text-slate-500 mt-0.5">By quantity sold in selected period</p>
              </div>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableHeaderRow>
                      <TableHeaderCell>#</TableHeaderCell>
                      <TableHeaderCell>Product</TableHeaderCell>
                      <TableHeaderCell className="text-right">Qty Sold</TableHeaderCell>
                      <TableHeaderCell className="text-right">Revenue</TableHeaderCell>
                    </TableHeaderRow>
                  </TableHead>
                  <TableBody>
                    {topProducts.length === 0 ? (
                      <TableEmptyState colSpan={4}>
                        No orders in this period
                      </TableEmptyState>
                    ) : (
                      topProducts.map((p, idx) => (
                        <TableRow key={p.product_id} className="hover:bg-slate-50/50">
                          <TableCell className="text-slate-500 font-medium">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-slate-800">{p.name}</TableCell>
                          <TableCell className="text-right">{p.total_quantity}</TableCell>
                          <TableCell className="text-right font-medium text-slate-800">{formatCurrency(p.total_revenue)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <ListOrdered size={18} className="text-slate-600" />
                      <h2 className="font-semibold text-slate-800">Transaction Log</h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">All orders in the selected period (newest first)</p>
                  </div>
                  <Button type="button" onClick={exportTransactionLogToExcel} variant="outline" className="px-3 py-2 text-sm">
                    <Download size={16} />
                    Export to Excel
                  </Button>
                </div>
              </div>
              <TableContainer className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHead className="sticky top-0 bg-slate-50/95 border-b border-slate-100 z-10">
                    <tr>
                      <TableHeaderCell>Date & Time</TableHeaderCell>
                      <TableHeaderCell>Order ID</TableHeaderCell>
                      <TableHeaderCell>Customer</TableHeaderCell>
                      <TableHeaderCell>Payment</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell className="text-right">Total</TableHeaderCell>
                      <TableHeaderCell className="text-right">Action</TableHeaderCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableEmptyState colSpan={7}>
                        No transactions in this period
                      </TableEmptyState>
                    ) : (
                      transactions.map((tx) => (
                        <TableRow key={tx.id} className="hover:bg-slate-50/50">
                          <TableCell className="whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleString('en-PH', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-600">
                            #{tx.id.slice(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell>{tx.customer_name || '—'}</TableCell>
                          <TableCell className="text-slate-600 capitalize">
                            {tx.payment_method || '—'}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                tx.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : tx.status === 'pending'
                                    ? 'bg-amber-100 text-amber-700'
                                    : tx.status === 'cancelled'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {tx.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-800">
                            {formatCurrency(tx.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              onClick={() => setSelectedTransaction(tx)}
                              variant="ghost"
                              size="sm"
                              className="text-indigo-600 hover:bg-indigo-50"
                            >
                              <Eye size={14} />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>

            <Modal
              open={Boolean(selectedTransaction)}
              onClose={() => setSelectedTransaction(null)}
              title={selectedTransaction ? `Transaction #${selectedTransaction.id.slice(0, 8).toUpperCase()}` : undefined}
              maxWidthClassName="max-w-lg"
              footer={(
                <Button type="button" variant="secondary" onClick={() => setSelectedTransaction(null)}>
                  Close
                </Button>
              )}
            >
              {selectedTransaction && (
                <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <span className="text-slate-500">Date & time</span>
                      <span className="text-slate-800">
                        {new Date(selectedTransaction.created_at).toLocaleString('en-PH', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      <span className="text-slate-500">Customer</span>
                      <span className="text-slate-800">{selectedTransaction.customer_name || '—'}</span>
                      <span className="text-slate-500">Transaction by</span>
                      <span className="text-slate-800">
                        {selectedTransaction.profiles?.full_name ?? (selectedTransaction.created_by ? 'Unknown' : '—')}
                      </span>
                      <span className="text-slate-500">Role</span>
                      <span className="text-slate-800">
                        {selectedTransaction.profiles?.role
                          ? selectedTransaction.profiles.role === 'owner'
                            ? 'Owner'
                            : selectedTransaction.profiles.role === 'admin'
                              ? 'Admin'
                              : selectedTransaction.profiles.role === 'manager'
                                ? 'Manager'
                                : 'Employee'
                          : '—'}
                      </span>
                      <span className="text-slate-500">Payment</span>
                      <span className="text-slate-800 capitalize">{selectedTransaction.payment_method || '—'}</span>
                      <span className="text-slate-500">Status</span>
                      <span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            selectedTransaction.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : selectedTransaction.status === 'pending'
                                ? 'bg-amber-100 text-amber-700'
                                : selectedTransaction.status === 'cancelled'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {selectedTransaction.status}
                        </span>
                      </span>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium mb-1">Products bought</p>
                      <p className="text-slate-800">
                        {(selectedTransaction.order_items ?? []).length === 0
                          ? '—'
                          : (selectedTransaction.order_items ?? [])
                              .map(
                                (oi) =>
                                  `${(oi.products as { name: string } | null)?.name ?? 'Unknown'} × ${oi.quantity}`
                              )
                              .join(', ')}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium mb-1">Products paid for</p>
                      <p className="text-slate-800">
                        {(selectedTransaction.order_items ?? []).length === 0
                          ? '—'
                          : (selectedTransaction.order_items ?? [])
                              .map((oi) => {
                                const name = (oi.products as { name: string } | null)?.name ?? 'Unknown'
                                const lineTotal = (oi.quantity ?? 0) * (oi.price ?? 0)
                                return `${name} × ${oi.quantity} @ ${formatCurrency(lineTotal)}`
                              })
                              .join('; ')}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-slate-500 font-medium">Total</span>
                      <span className="ml-2 text-lg font-semibold text-slate-800">
                        {formatCurrency(selectedTransaction.total)}
                      </span>
                    </div>
                </div>
              )}
            </Modal>
          </>
        )}
      </PageContent>
    </div>
  )
}
