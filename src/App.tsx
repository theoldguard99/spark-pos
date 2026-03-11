import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import RequireStore from './components/auth/RequireStore'
import AccessDenied from './components/auth/AccessDenied'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Products from './pages/Products'
import Onboarding from './pages/Onboarding'
import Settings from './pages/Settings'
import Orders from './pages/Orders'
import Reports from './pages/Reports'
import RecentOrdersPage from './pages/RecentOrdersPage'
import Coupons from './pages/Coupons'
import StoreAccessDirectory from './pages/StoreAccessDirectory'
import { useAccessDirectory, type AccessResource } from './hooks/useAccessDirectory'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10 * 1000,
    },
  },
})

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/orders': 'Orders',
  '/orders/new': 'New Order',
  '/recent-orders': 'Recent Orders',
  '/products': 'Products',
  '/products/new': 'Add Product',
  '/reports': 'Reports',
  '/coupons': 'Coupons',
  '/store-access-directory': 'Store Access Directory',
  '/settings': 'Settings',
  '/onboarding': 'Store Setup',
}
function AppLayout() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] ?? 'SPARK'
  const { loading, canAccess } = useAccessDirectory()

  function withAccess(resource: AccessResource, element: ReactNode) {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )
    }
    return canAccess(resource) ? element : <AccessDenied />
  }

  return (
    <ProtectedRoute>
      <RequireStore>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <TopBar title={title} />
            <Routes>
              <Route path="/dashboard" element={withAccess('dashboard', <Dashboard />)} />
              <Route path="/orders" element={withAccess('orders', <Orders />)} />
              <Route path="/orders/new" element={withAccess('orders', <Orders />)} />
              <Route path="/products" element={withAccess('products', <Products />)} />
              <Route path="/products/new" element={withAccess('products', <Products />)} />
              <Route path="/reports" element={withAccess('reports', <Reports />)} />
              <Route path="/coupons" element={withAccess('coupons', <Coupons />)} />
              <Route path="/store-access-directory" element={withAccess('store-access-directory', <StoreAccessDirectory />)} />
              <Route path="/recent-orders" element={withAccess('recent-orders', <RecentOrdersPage />)} />
              <Route path="/settings" element={withAccess('settings', <Settings />)} />
              <Route path="*" element={<Navigate to={canAccess('dashboard') ? '/dashboard' : '/orders'} replace />} />
            </Routes>
          </div>
        </div>
      </RequireStore>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />
              <Route path="/*" element={<AppLayout />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
