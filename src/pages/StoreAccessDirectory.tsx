import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Users } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import PageContent from '../components/layout/PageContent'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import {
  ACCESS_RESOURCES,
  MENU_ACCESS_RESOURCES,
  WRITE_ACCESS_RESOURCES,
  type AccessResource,
  type StoreRole,
  useAccessDirectory,
} from '../hooks/useAccessDirectory'

interface EmployeeRow {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  role: string | null
}

interface RolePermissionRow {
  role: StoreRole
  resource: AccessResource
  can_access: boolean
}

interface UserPermissionRow {
  user_id: string
  resource: AccessResource
  can_access: boolean
}

const ROLE_OPTIONS: StoreRole[] = ['owner', 'admin', 'manager', 'employee']

const RESOURCE_LABELS: Record<AccessResource, string> = {
  dashboard: 'Dashboard',
  orders: 'Orders',
  'recent-orders': 'Recent Orders',
  products: 'Products',
  reports: 'Reports',
  coupons: 'Coupons',
  'store-access-directory': 'Store Access Directory',
  settings: 'Settings',
  'products.write': 'Products: Write',
  'coupons.write': 'Coupons: Write',
  'employees.write': 'Employees: Write',
}

export default function StoreAccessDirectory() {
  const { showSuccess, showError } = useToast()
  const queryClient = useQueryClient()
  const { storeId } = useAccessDirectory()

  const employeesQuery = useQuery({
    queryKey: ['store-access-employees', storeId],
    enabled: Boolean(isSupabaseConfigured && storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, full_name, role')
        .eq('store_id', storeId)
        .order('full_name', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as EmployeeRow[]
    },
  })

  const rolePermissionsQuery = useQuery({
    queryKey: ['settings-access-role-permissions', storeId],
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
    queryKey: ['settings-access-user-permissions', storeId],
    enabled: Boolean(isSupabaseConfigured && storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_access_user_permissions')
        .select('user_id, resource, can_access')
        .eq('store_id', storeId)
      if (error) throw error
      return (data ?? []) as UserPermissionRow[]
    },
  })

  const [rolePermissionDraft, setRolePermissionDraft] = useState<Record<StoreRole, Record<AccessResource, boolean>>>(
    () => ({
      owner: Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, true])) as Record<AccessResource, boolean>,
      admin: Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, true])) as Record<AccessResource, boolean>,
      manager: Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, true])) as Record<AccessResource, boolean>,
      employee: Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, true])) as Record<AccessResource, boolean>,
    }),
  )

  const [userPermissionDraft, setUserPermissionDraft] = useState<
    Record<string, Record<AccessResource, 'inherit' | 'allow' | 'deny'>>
  >({})
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)

  useEffect(() => {
    if (!storeId) return

    const defaults: Record<StoreRole, Record<AccessResource, boolean>> = {
      owner: Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, true])) as Record<AccessResource, boolean>,
      admin: Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, true])) as Record<AccessResource, boolean>,
      manager: Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, true])) as Record<AccessResource, boolean>,
      employee: Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, true])) as Record<AccessResource, boolean>,
    }

    for (const row of rolePermissionsQuery.data ?? []) {
      if (ROLE_OPTIONS.includes(row.role) && ACCESS_RESOURCES.includes(row.resource)) {
        defaults[row.role][row.resource] = Boolean(row.can_access)
      }
    }
    setRolePermissionDraft(defaults)

    const nextUserDraft: Record<string, Record<AccessResource, 'inherit' | 'allow' | 'deny'>> = {}
    for (const emp of employeesQuery.data ?? []) {
      nextUserDraft[emp.id] = Object.fromEntries(
        ACCESS_RESOURCES.map((resource) => [resource, 'inherit']),
      ) as Record<AccessResource, 'inherit' | 'allow' | 'deny'>
    }
    for (const row of userPermissionsQuery.data ?? []) {
      if (nextUserDraft[row.user_id] && ACCESS_RESOURCES.includes(row.resource)) {
        nextUserDraft[row.user_id][row.resource] = row.can_access ? 'allow' : 'deny'
      }
    }
    setUserPermissionDraft(nextUserDraft)
  }, [storeId, rolePermissionsQuery.data, userPermissionsQuery.data, employeesQuery.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
      if (!storeId) throw new Error('Store is required before saving menu access.')

      const roleRows = ROLE_OPTIONS.flatMap((role) =>
        ACCESS_RESOURCES.map((resource) => ({
          store_id: storeId,
          role,
          resource,
          can_access: rolePermissionDraft[role]?.[resource] ?? false,
          updated_at: new Date().toISOString(),
        })),
      )

      const { error: roleError } = await supabase
        .from('store_access_role_permissions')
        .upsert(roleRows, { onConflict: 'store_id,role,resource' })
      if (roleError) throw roleError

      const { error: clearOverridesError } = await supabase
        .from('store_access_user_permissions')
        .delete()
        .eq('store_id', storeId)
      if (clearOverridesError) throw clearOverridesError

      const overrideRows = Object.entries(userPermissionDraft).flatMap(([userId, resources]) =>
        ACCESS_RESOURCES
          .filter((resource) => resources[resource] === 'allow' || resources[resource] === 'deny')
          .map((resource) => ({
            store_id: storeId,
            user_id: userId,
            resource,
            can_access: resources[resource] === 'allow',
            updated_at: new Date().toISOString(),
          })),
      )

      if (overrideRows.length > 0) {
        const { error: overrideError } = await supabase
          .from('store_access_user_permissions')
          .insert(overrideRows)
        if (overrideError) throw overrideError
      }
    },
    onSuccess: async () => {
      showSuccess('Menu access saved.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings-access-role-permissions'] }),
        queryClient.invalidateQueries({ queryKey: ['settings-access-user-permissions'] }),
        queryClient.invalidateQueries({ queryKey: ['access-role-permissions'] }),
        queryClient.invalidateQueries({ queryKey: ['access-user-permissions'] }),
      ])
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to save menu access.')
    },
  })

  const loading = employeesQuery.isLoading || rolePermissionsQuery.isLoading || userPermissionsQuery.isLoading
  const editingEmployee = (employeesQuery.data ?? []).find((emp) => emp.id === editingEmployeeId) ?? null

  function setEmployeeOverride(
    employeeId: string,
    resource: AccessResource,
    value: 'inherit' | 'allow' | 'deny',
  ) {
    setUserPermissionDraft((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] ??
          (Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, 'inherit'])) as Record<
            AccessResource,
            'inherit' | 'allow' | 'deny'
          >)),
        [resource]: value,
      },
    }))
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageContent className="space-y-5">
        <div className="flex items-center gap-2">
          <Users size={24} className="text-slate-600" />
          <h1 className="text-xl font-bold text-slate-800">Store Access Directory</h1>
        </div>

        {loading && (
          <div className="inline-flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Loader2 size={15} className="animate-spin" />
            Loading access directory...
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 pb-6 pt-6 border-t border-slate-100 space-y-6">
            <p className="text-sm text-slate-600">
              Control menu access and write permissions. Read-only means menu can be visible while write permission stays off.
            </p>

            <div className="overflow-auto border border-slate-200 rounded-xl">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                    {MENU_ACCESS_RESOURCES.map((resource) => (
                      <th key={resource} className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {RESOURCE_LABELS[resource]}
                      </th>
                    ))}
                    {WRITE_ACCESS_RESOURCES.map((resource) => (
                      <th key={resource} className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {RESOURCE_LABELS[resource]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROLE_OPTIONS.map((role) => (
                    <tr key={role} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-2.5 font-medium text-slate-700 capitalize">{role}</td>
                      {MENU_ACCESS_RESOURCES.map((resource) => (
                        <td key={`${role}-${resource}`} className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(rolePermissionDraft[role]?.[resource])}
                            onChange={(e) =>
                              setRolePermissionDraft((prev) => ({
                                ...prev,
                                [role]: {
                                  ...prev[role],
                                  [resource]: e.target.checked,
                                },
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                      ))}
                      {WRITE_ACCESS_RESOURCES.map((resource) => (
                        <td key={`${role}-${resource}`} className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(rolePermissionDraft[role]?.[resource])}
                            onChange={(e) =>
                              setRolePermissionDraft((prev) => ({
                                ...prev,
                                [role]: {
                                  ...prev[role],
                                  [resource]: e.target.checked,
                                },
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Employee overrides</p>
              <div className="overflow-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Edit Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(employeesQuery.data ?? []).map((emp) => {
                      const display = emp.full_name || [emp.first_name, emp.last_name].filter(Boolean).join(' ') || 'Unnamed'
                      return (
                        <tr key={emp.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-4 py-2.5 font-medium text-slate-700">
                            <p className="font-medium text-slate-700">{display}</p>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 capitalize">
                            {emp.role ?? 'employee'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button type="button" variant="outline" size="sm" onClick={() => setEditingEmployeeId(emp.id)}>
                              Edit Access
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={!isSupabaseConfigured}
                loading={saveMutation.isPending}
              >
                Save menu access
              </Button>
            </div>
          </div>
        </section>

        <Modal
          open={Boolean(editingEmployee)}
          onClose={() => setEditingEmployeeId(null)}
          title="Edit Access"
          description={
            editingEmployee
              ? `${editingEmployee.full_name || [editingEmployee.first_name, editingEmployee.last_name].filter(Boolean).join(' ') || 'Unnamed'} (${editingEmployee.role ?? 'employee'})`
              : undefined
          }
          maxWidthClassName="max-w-5xl"
          footer={(
            <Button type="button" variant="outline" onClick={() => setEditingEmployeeId(null)}>
              Done
            </Button>
          )}
        >
          {editingEmployee && (
            <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">Menu Access</p>
                  <div className="space-y-3">
                    {MENU_ACCESS_RESOURCES.map((resource) => (
                      <div key={resource} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center border border-slate-200 rounded-xl px-4 py-3">
                        <p className="text-sm font-medium text-slate-700 md:col-span-1">{RESOURCE_LABELS[resource]}</p>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="radio"
                            name={`${editingEmployee.id}-${resource}`}
                            checked={(userPermissionDraft[editingEmployee.id]?.[resource] ?? 'inherit') === 'inherit'}
                            onChange={() => setEmployeeOverride(editingEmployee.id, resource, 'inherit')}
                          />
                          Inherit
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-emerald-700">
                          <input
                            type="radio"
                            name={`${editingEmployee.id}-${resource}`}
                            checked={(userPermissionDraft[editingEmployee.id]?.[resource] ?? 'inherit') === 'allow'}
                            onChange={() => setEmployeeOverride(editingEmployee.id, resource, 'allow')}
                          />
                          Allow
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-red-700">
                          <input
                            type="radio"
                            name={`${editingEmployee.id}-${resource}`}
                            checked={(userPermissionDraft[editingEmployee.id]?.[resource] ?? 'inherit') === 'deny'}
                            onChange={() => setEmployeeOverride(editingEmployee.id, resource, 'deny')}
                          />
                          Deny
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">Write Access</p>
                  <div className="space-y-3">
                    {WRITE_ACCESS_RESOURCES.map((resource) => (
                      <div key={resource} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center border border-slate-200 rounded-xl px-4 py-3">
                        <p className="text-sm font-medium text-slate-700 md:col-span-1">{RESOURCE_LABELS[resource]}</p>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="radio"
                            name={`${editingEmployee.id}-${resource}`}
                            checked={(userPermissionDraft[editingEmployee.id]?.[resource] ?? 'inherit') === 'inherit'}
                            onChange={() => setEmployeeOverride(editingEmployee.id, resource, 'inherit')}
                          />
                          Inherit
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-emerald-700">
                          <input
                            type="radio"
                            name={`${editingEmployee.id}-${resource}`}
                            checked={(userPermissionDraft[editingEmployee.id]?.[resource] ?? 'inherit') === 'allow'}
                            onChange={() => setEmployeeOverride(editingEmployee.id, resource, 'allow')}
                          />
                          Allow
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-red-700">
                          <input
                            type="radio"
                            name={`${editingEmployee.id}-${resource}`}
                            checked={(userPermissionDraft[editingEmployee.id]?.[resource] ?? 'inherit') === 'deny'}
                            onChange={() => setEmployeeOverride(editingEmployee.id, resource, 'deny')}
                          />
                          Deny
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
          )}
        </Modal>
      </PageContent>
    </div>
  )
}
