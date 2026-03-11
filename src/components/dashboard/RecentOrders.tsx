import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRecentOrders } from '../../hooks/useDashboard'
import type { Order } from '../../types'
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
} from '../ui/Table'

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

export default function RecentOrders() {
  const { data: orders, isLoading } = useRecentOrders()
  const [page, setPage] = useState(1)

  const paginatedOrders = useMemo(() => {
    if (!orders?.length) return []
    const start = (page - 1) * PAGE_SIZE
    return orders.slice(start, start + PAGE_SIZE)
  }, [orders, page])

  const totalPages = Math.ceil((orders?.length ?? 0) / PAGE_SIZE) || 1
  const totalCount = orders?.length ?? 0

  return (
    <div className="rounded-2xl bg-white/85 backdrop-blur-sm shadow-md shadow-slate-200/60 border border-white">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/80">
        <div>
          <h3 className="font-semibold text-slate-800">Recent Orders</h3>
          <p className="text-xs text-slate-400 mt-0.5">20 per page</p>
        </div>
        <Link
          to="/recent-orders"
          className="text-xs text-indigo-600 font-medium hover:underline"
        >
          View all
        </Link>
      </div>

      <TableContainer>
        <Table>
          <TableHead>
            <TableHeaderRow className="border-slate-100/80 bg-slate-50/50">
              <TableHeaderCell>Order ID</TableHeaderCell>
              <TableHeaderCell>Customer / Served by</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell className="text-right">Total</TableHeaderCell>
              <TableHeaderCell className="text-center">Status</TableHeaderCell>
            </TableHeaderRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell><div className="h-4 w-20 bg-slate-100 rounded" /></TableCell>
                  <TableCell><div className="h-4 w-28 bg-slate-100 rounded" /></TableCell>
                  <TableCell><div className="h-4 w-24 bg-slate-100 rounded" /></TableCell>
                  <TableCell><div className="h-4 w-16 bg-slate-100 rounded ml-auto" /></TableCell>
                  <TableCell><div className="h-5 w-20 bg-slate-100 rounded mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : orders && orders.length > 0 ? (
              paginatedOrders.map((order) => {
                const badge = statusStyles[order.status] ?? statusStyles.pending
                return (
                  <TableRow key={order.id} className="hover:bg-indigo-50/40 transition-colors">
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
              <TableEmptyState colSpan={5} className="text-sm">
                No orders found
              </TableEmptyState>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {totalCount > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-100/80">
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
  )
}
