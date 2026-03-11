import { useMemo, useState, useEffect } from 'react'
import { useRecentOrders } from '../hooks/useDashboard'
import type { Order } from '../types'
import { ListOrdered, Search, ChevronUp, ChevronDown } from 'lucide-react'
import Select from '../components/ui/Select'
import PageContent from '../components/layout/PageContent'
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

const PAGE_SIZE = 20

const statusStyles: Record<Order['status'], { label: string; classes: string }> = {
  completed: { label: 'Completed', classes: 'bg-emerald-100 text-emerald-700' },
  pending:   { label: 'Pending',   classes: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelled', classes: 'bg-red-100 text-red-600' },
  refunded:  { label: 'Refunded',  classes: 'bg-slate-100 text-slate-600' },
}

function formatCurrency(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type DateFilter = 'all' | 'today' | '7' | '30'

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
]

function filterOrdersByDateRange<T extends { created_at: string }>(
  orders: T[],
  filter: DateFilter
): T[] {
  if (filter === 'all' || !orders.length) return orders
  const now = new Date()
  let start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (filter === 'today') {
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return orders.filter((o) => {
      const d = new Date(o.created_at)
      return d >= start && d <= end
    })
  }
  if (filter === '7') {
    start.setDate(start.getDate() - 6)
  } else {
    start.setDate(start.getDate() - 29)
  }
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return orders.filter((o) => {
    const d = new Date(o.created_at)
    return d >= start && d <= end
  })
}

type OrderWithProfile = Order & { profiles?: { full_name: string | null } | null }

type SearchFieldFilter = 'all' | 'orderId' | 'date' | 'status' | 'servedBy'

const SEARCH_FIELD_OPTIONS: { value: SearchFieldFilter; label: string }[] = [
  { value: 'all', label: 'All fields' },
  { value: 'orderId', label: 'Order ID' },
  { value: 'date', label: 'Date' },
  { value: 'status', label: 'Status' },
  { value: 'servedBy', label: 'Served by' },
]

function filterOrdersBySearch(
  orders: OrderWithProfile[],
  query: string,
  fieldFilter: SearchFieldFilter
): OrderWithProfile[] {
  const q = query.trim().toLowerCase()
  if (!q) return orders
  return orders.filter((order) => {
    const orderIdShort = order.id.slice(0, 8).toUpperCase()
    const orderIdFull = order.id.toLowerCase()
    const dateStr = formatTime(order.created_at).toLowerCase()
    const statusStr = (order.status ?? '').toLowerCase()
    const servedBy = order.profiles?.full_name?.toLowerCase() ?? ''
    const customer = (order.customer_name ?? '').toLowerCase()

    if (fieldFilter === 'orderId') {
      return orderIdShort.toLowerCase().includes(q) || orderIdFull.includes(q)
    }
    if (fieldFilter === 'date') return dateStr.includes(q)
    if (fieldFilter === 'status') return statusStr.includes(q)
    if (fieldFilter === 'servedBy') return servedBy.includes(q) || customer.includes(q)

    return (
      orderIdShort.toLowerCase().includes(q) ||
      orderIdFull.includes(q) ||
      dateStr.includes(q) ||
      statusStr.includes(q) ||
      servedBy.includes(q) ||
      customer.includes(q)
    )
  })
}

export default function RecentOrdersPage() {
  const { data: orders, isLoading } = useRecentOrders()
  const [page, setPage] = useState(1)
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [search, setSearch] = useState('')
  const [searchFieldFilter, setSearchFieldFilter] = useState<SearchFieldFilter>('all')
  const [sortKey, setSortKey] = useState<'orderId' | 'customer' | 'date' | 'total' | 'status'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filteredByDate = useMemo(
    () => filterOrdersByDateRange(orders ?? [], dateFilter),
    [orders, dateFilter],
  )

  const filteredOrders = useMemo(
    () => filterOrdersBySearch(filteredByDate as OrderWithProfile[], search, searchFieldFilter),
    [filteredByDate, search, searchFieldFilter],
  )

  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders]
    const mult = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortKey === 'orderId') return mult * (a.id.localeCompare(b.id))
      if (sortKey === 'customer') {
        const ac = a.customer_name?.trim() || (a.profiles?.full_name ?? '') || '—'
        const bc = b.customer_name?.trim() || (b.profiles?.full_name ?? '') || '—'
        return mult * ac.localeCompare(bc)
      }
      if (sortKey === 'date') return mult * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      if (sortKey === 'total') return mult * (a.total - b.total)
      if (sortKey === 'status') return mult * (a.status.localeCompare(b.status))
      return 0
    })
    return list
  }, [filteredOrders, sortKey, sortDir])

  const paginatedOrders = useMemo(() => {
    if (!sortedOrders.length) return []
    const start = (page - 1) * PAGE_SIZE
    return sortedOrders.slice(start, start + PAGE_SIZE)
  }, [sortedOrders, page])

  const totalPages = Math.ceil(sortedOrders.length / PAGE_SIZE) || 1
  const totalCount = sortedOrders.length

  const handleSort = (key: 'orderId' | 'customer' | 'date' | 'total' | 'status') => {
    setSortKey(key)
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    setPage(1)
  }

  const SortIcon = ({ column }: { column: 'orderId' | 'customer' | 'date' | 'total' | 'status' }) =>
    sortKey === column ? (
      sortDir === 'asc' ? <ChevronUp size={18} className="inline ml-1 text-indigo-600" /> : <ChevronDown size={18} className="inline ml-1 text-indigo-600" />
    ) : (
      <ChevronDown size={18} className="inline ml-1 text-slate-300" />
    )

  useEffect(() => {
    setPage(1)
  }, [dateFilter, search, searchFieldFilter])

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageContent>
        <div className="flex items-center gap-2 mb-6">
          <ListOrdered size={24} className="text-slate-600" />
          <h1 className="text-xl font-bold text-slate-800">Recent Orders</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-56 max-w-full"
                  aria-label="Search orders"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="search-field-filter" className="text-sm font-medium text-slate-600">
                  Filter by:
                </label>
                <Select
                  id="search-field-filter"
                  value={searchFieldFilter}
                  onChange={(e) => setSearchFieldFilter(e.target.value as SearchFieldFilter)}
                  className="min-w-[130px]"
                >
                  {SEARCH_FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="recent-orders-filter" className="text-sm font-medium text-slate-600">
                Show:
              </label>
              <Select
                id="recent-orders-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="min-w-[140px]"
              >
                {DATE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <TableContainer>
            <Table>
              <TableHead>
                <TableHeaderRow>
                  <TableHeaderCell>
                    <button type="button" onClick={() => handleSort('orderId')} className="inline-flex items-center gap-1 py-2.5 px-2 -my-1 -mx-1 rounded hover:text-slate-700 hover:bg-slate-100 focus:outline-none">
                      Order ID <SortIcon column="orderId" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <button type="button" onClick={() => handleSort('customer')} className="inline-flex items-center gap-1 py-2.5 px-2 -my-1 -mx-1 rounded hover:text-slate-700 hover:bg-slate-100 focus:outline-none">
                      Customer / Served by <SortIcon column="customer" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <button type="button" onClick={() => handleSort('date')} className="inline-flex items-center gap-1 py-2.5 px-2 -my-1 -mx-1 rounded hover:text-slate-700 hover:bg-slate-100 focus:outline-none">
                      Date <SortIcon column="date" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    <button type="button" onClick={() => handleSort('total')} className="inline-flex items-center gap-1 py-2.5 px-2 -my-1 -mx-1 rounded ml-auto hover:text-slate-700 hover:bg-slate-100 focus:outline-none">
                      Total <SortIcon column="total" />
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell className="text-center">
                    <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-1 py-2.5 px-2 -my-1 -mx-1 rounded hover:text-slate-700 hover:bg-slate-100 focus:outline-none">
                      Status <SortIcon column="status" />
                    </button>
                  </TableHeaderCell>
                </TableHeaderRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell><div className="h-4 w-20 bg-slate-100 rounded" /></TableCell>
                      <TableCell><div className="h-4 w-28 bg-slate-100 rounded" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-slate-100 rounded" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-slate-100 rounded ml-auto" /></TableCell>
                      <TableCell><div className="h-5 w-20 bg-slate-100 rounded mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : sortedOrders.length > 0 ? (
                  paginatedOrders.map((order) => {
                    const badge = statusStyles[order.status] ?? statusStyles.pending
                    return (
                      <TableRow key={order.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="font-mono text-xs text-slate-500">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell>
                          {order.customer_name?.trim() || (order as { profiles?: { full_name: string | null } | null }).profiles?.full_name || '—'}
                        </TableCell>
                        <TableCell className="text-slate-500">{formatTime(order.created_at)}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-800">
                          {formatCurrency(order.total)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableEmptyState colSpan={5} className="py-16">
                    No orders found
                  </TableEmptyState>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {totalCount > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </PageContent>
    </div>
  )
}
