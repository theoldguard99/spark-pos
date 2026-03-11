import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  DollarSign,
  ShoppingBag,
  Package,
  AlertTriangle,
  PlusCircle,
  PackagePlus,
  BarChart3,
  RefreshCw,
  Info,
} from 'lucide-react'
import StatCard from '../components/dashboard/StatCard'
import SalesChart from '../components/dashboard/SalesChart'
import RecentOrders from '../components/dashboard/RecentOrders'
import TopProducts from '../components/dashboard/TopProducts'
import LowStockAlert from '../components/dashboard/LowStockAlert'
import PageContent from '../components/layout/PageContent'
import { useDashboardStats } from '../hooks/useDashboard'
import { useQueryClient } from '@tanstack/react-query'
import { isSupabaseConfigured } from '../lib/supabase'

function formatCurrency(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const quickActions = [
  {
    label: 'New Order',
    description: 'Start a new sale',
    icon: PlusCircle,
    color: 'bg-indigo-600 hover:bg-indigo-700',
    to: '/orders/new',
  },
  {
    label: 'Add Product',
    description: 'Add to inventory',
    icon: PackagePlus,
    color: 'bg-emerald-600 hover:bg-emerald-700',
    to: '/products/new',
  },
  {
    label: 'View Reports',
    description: 'Sales & analytics',
    icon: BarChart3,
    color: 'bg-violet-600 hover:bg-violet-700',
    to: '/reports',
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function handleRefresh() {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['dashboard-stats'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['weekly-sales'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['recent-orders'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['top-products'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['low-stock'], type: 'active' }),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <PageContent className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-6 py-5 text-white shadow-lg shadow-indigo-950/30">
          <p className="text-xs uppercase tracking-[0.18em] text-white/70">Dashboard</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">Welcome to your business command center</h1>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing...' : 'Refresh data'}
            </button>
          </div>
          <p className="mt-2 text-sm text-white/80">
            Track sales, orders, and inventory in real time.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="flex items-start gap-3 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <Info size={17} className="mt-0.5 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold">Supabase not connected</p>
              <p className="text-amber-700 text-xs mt-0.5">
                Add your <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to the{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">.env</code> file, then restart the dev server.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Quick Actions</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map(({ label, description, icon: Icon, color, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-white shadow-md shadow-slate-200/70 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95 ${color}`}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20">
                <Icon size={22} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-base">{label}</p>
                <p className="text-xs text-white/75">{description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Today's Revenue"
            value={stats ? formatCurrency(stats.todayRevenue) : '₱0.00'}
            subtitle="Completed orders only"
            icon={DollarSign}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-100"
            loading={statsLoading}
          />
          <StatCard
            title="Total Orders"
            value={stats?.totalOrders ?? 0}
            subtitle="Orders placed today"
            icon={ShoppingBag}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-100"
            loading={statsLoading}
          />
          <StatCard
            title="Items Sold"
            value={stats?.itemsSold ?? 0}
            subtitle="Units sold today"
            icon={Package}
            iconColor="text-violet-600"
            iconBg="bg-violet-100"
            loading={statsLoading}
          />
          <StatCard
            title="Low Stock"
            value={stats?.lowStockCount ?? 0}
            subtitle="Products need restocking"
            icon={AlertTriangle}
            iconColor="text-amber-600"
            iconBg="bg-amber-100"
            loading={statsLoading}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <SalesChart />
          </div>
          <TopProducts />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <RecentOrders />
          </div>
          <LowStockAlert />
        </div>

      </PageContent>
    </div>
  )
}
