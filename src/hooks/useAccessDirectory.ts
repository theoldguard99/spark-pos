import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export type AccessResource =
  | 'dashboard'
  | 'orders'
  | 'recent-orders'
  | 'products'
  | 'reports'
  | 'coupons'
  | 'store-access-directory'
  | 'settings'
  | 'products.write'
  | 'coupons.write'
  | 'employees.write'

export type StoreRole = 'owner' | 'admin' | 'manager' | 'employee'

export const MENU_ACCESS_RESOURCES: AccessResource[] = [
  'dashboard',
  'orders',
  'recent-orders',
  'products',
  'reports',
  'coupons',
  'store-access-directory',
  'settings',
]

export const WRITE_ACCESS_RESOURCES: AccessResource[] = [
  'products.write',
  'coupons.write',
  'employees.write',
]

export const ACCESS_RESOURCES: AccessResource[] = [
  ...MENU_ACCESS_RESOURCES,
  ...WRITE_ACCESS_RESOURCES,
]

function defaultRoleAccess(role: StoreRole): Record<AccessResource, boolean> {
  const allTrue = Object.fromEntries(ACCESS_RESOURCES.map((k) => [k, true])) as Record<AccessResource, boolean>
  if (role === 'owner' || role === 'admin') return allTrue
  if (role === 'manager') {
    return {
      ...allTrue,
      'store-access-directory': false,
      settings: false,
      'employees.write': false,
    }
  }
  return {
    dashboard: true,
    orders: true,
    'recent-orders': true,
    products: true,
    reports: false,
    coupons: false,
    'store-access-directory': false,
    settings: false,
    'products.write': false,
    'coupons.write': false,
    'employees.write': false,
  }
}

interface ProfileAccessRow {
  store_id: string | null
  role: string | null
}

interface RolePermissionRow {
  role: string
  resource: AccessResource
  can_access: boolean
}

interface UserPermissionRow {
  user_id: string
  resource: AccessResource
  can_access: boolean
}

export function useAccessDirectory() {
  const { user } = useAuth()

  const profileQuery = useQuery({
    queryKey: ['access-profile', user?.id],
    enabled: Boolean(isSupabaseConfigured && user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('store_id, role')
        .eq('id', user!.id)
        .single<ProfileAccessRow>()
      if (error) throw error
      return data
    },
  })

  const storeId = profileQuery.data?.store_id ?? null
  const role = ((profileQuery.data?.role ?? 'employee') as StoreRole)

  const rolePermissionsQuery = useQuery({
    queryKey: ['access-role-permissions', storeId],
    enabled: Boolean(isSupabaseConfigured && storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_access_role_permissions')
        .select('role, resource, can_access')
        .eq('store_id', storeId)
      if (error) throw error
      return (data ?? []) as RolePermissionRow[]
    },
  })

  const userPermissionsQuery = useQuery({
    queryKey: ['access-user-permissions', storeId, user?.id],
    enabled: Boolean(isSupabaseConfigured && storeId && user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_access_user_permissions')
        .select('user_id, resource, can_access')
        .eq('store_id', storeId)
        .eq('user_id', user!.id)
      if (error) throw error
      return (data ?? []) as UserPermissionRow[]
    },
  })

  const mergedAccess = useMemo(() => {
    const base = defaultRoleAccess(role)
    for (const row of rolePermissionsQuery.data ?? []) {
      if (row.role === role && ACCESS_RESOURCES.includes(row.resource)) {
        base[row.resource] = Boolean(row.can_access)
      }
    }
    for (const row of userPermissionsQuery.data ?? []) {
      if (ACCESS_RESOURCES.includes(row.resource)) {
        base[row.resource] = Boolean(row.can_access)
      }
    }
    return base
  }, [role, rolePermissionsQuery.data, userPermissionsQuery.data])

  const loading = profileQuery.isLoading || rolePermissionsQuery.isLoading || userPermissionsQuery.isLoading

  const canAccess = (resource: AccessResource) => {
    if (!isSupabaseConfigured) return true
    return Boolean(mergedAccess[resource])
  }

  return {
    loading,
    role,
    storeId,
    canAccess,
    mergedAccess,
  }
}
