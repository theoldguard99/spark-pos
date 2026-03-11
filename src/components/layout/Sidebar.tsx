import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Settings,
  Store,
  ListOrdered,
  TicketPercent,
  Users,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { useAccessDirectory, type AccessResource } from '../../hooks/useAccessDirectory'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, resource: 'dashboard' as AccessResource },
  { to: '/orders', label: 'Orders', icon: ShoppingCart, resource: 'orders' as AccessResource },
  { to: '/recent-orders', label: 'Recent Orders', icon: ListOrdered, resource: 'recent-orders' as AccessResource },
  { to: '/products', label: 'Products', icon: Package, resource: 'products' as AccessResource },
  { to: '/reports', label: 'Reports', icon: BarChart3, resource: 'reports' as AccessResource },
  { to: '/coupons', label: 'Coupons', icon: TicketPercent, resource: 'coupons' as AccessResource },
  { to: '/store-access-directory', label: 'Store Access Directory', icon: Users, resource: 'store-access-directory' as AccessResource },
  { to: '/settings', label: 'Settings', icon: Settings, resource: 'settings' as AccessResource },
]

export default function Sidebar() {
  const { canAccess, loading } = useAccessDirectory()
  const iconUrl = isSupabaseConfigured
    ? supabase.storage.from('assets').getPublicUrl('spark-icon.png').data.publicUrl
    : null

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-slate-100 shadow-xl border-r border-white/10">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        {iconUrl ? (
          <img src={iconUrl} alt="SPARK icon" className="h-9 w-9 rounded-lg object-cover" />
        ) : (
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500/90">
            <Store size={20} className="text-white" />
          </div>
        )}
        <div>
          <p className="font-bold text-white leading-tight">SPARK</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems
          .filter((item) => !isSupabaseConfigured || loading || canAccess(item.resource))
          .map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/18 text-white shadow-sm'
                  : 'text-slate-300/90 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-xs text-slate-300/70 text-center">v1.0.0</p>
      </div>
    </aside>
  )
}
