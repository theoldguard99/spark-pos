import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, Upload, KeyRound, Store, PlugZap, ChevronDown, User, LayoutGrid, Users, Eye, EyeOff, Pencil, Trash2, Settings as SettingsIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PageContent from '../components/layout/PageContent'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import { useAccessDirectory } from '../hooks/useAccessDirectory'

interface SettingsProfileRow {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  avatar_url: string | null
  store_id: string | null
  stores: { name: string | null; pos_type: string | null } | null
}

type PosType = 'restaurant' | 'retail'

interface PaymentConfigRow {
  provider: 'paymongo'
  is_enabled: boolean
  updated_at: string
}

interface EmployeeRow {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  role: string | null
  username: string | null
}

export default function Settings() {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const { canAccess } = useAccessDirectory()
  const canWriteEmployees = !isSupabaseConfigured || canAccess('employees.write')
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editStoreName, setEditStoreName] = useState('')
  const [editPosType, setEditPosType] = useState<PosType>('restaurant')
  const [paymongoPublicKey, setPaymongoPublicKey] = useState('')
  const [paymongoSecretKey, setPaymongoSecretKey] = useState('')
  const [paymongoWebhookSecret, setPaymongoWebhookSecret] = useState('')
  const [paymongoEnabled, setPaymongoEnabled] = useState(false)

  type OrdersLayoutValue = 'default' | 'grid'
  const ORDERS_LAYOUT_STORAGE_KEY = 'spark_orders_layout'
  const [editOrdersLayout, setEditOrdersLayout] = useState<OrdersLayoutValue>(() =>
    typeof window !== 'undefined' && localStorage.getItem(ORDERS_LAYOUT_STORAGE_KEY) === 'grid' ? 'grid' : 'default'
  )

  const [empPassword, setEmpPassword] = useState('')
  const [empFirstName, setEmpFirstName] = useState('')
  const [empLastName, setEmpLastName] = useState('')
  const [empRole, setEmpRole] = useState<'employee' | 'manager' | 'admin'>('employee')
  const [showEmpPassword, setShowEmpPassword] = useState(false)

  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null)
  const [editEmpFirstName, setEditEmpFirstName] = useState('')
  const [editEmpLastName, setEditEmpLastName] = useState('')
  const [editEmpRole, setEditEmpRole] = useState<'employee' | 'manager' | 'admin'>('employee')
  const [editEmpNewPassword, setEditEmpNewPassword] = useState('')
  const [showEditEmpPassword, setShowEditEmpPassword] = useState(false)

  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeRow | null>(null)

  type SectionKey = 'profile' | 'store' | 'payment' | 'ordersLayout' | 'employees'
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    profile: false,
    store: false,
    payment: false,
    ordersLayout: false,
    employees: false,
  })
  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const profileQuery = useQuery({
    queryKey: ['settings-profile', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return {
          id: user!.id,
          first_name: (user?.user_metadata?.first_name as string | undefined) ?? null,
          last_name: (user?.user_metadata?.last_name as string | undefined) ?? null,
          phone: (user?.user_metadata?.phone as string | undefined) ?? null,
          avatar_url: null,
          store_id: null,
          stores: {
            name: (user?.user_metadata?.store_name as string | undefined) ?? null,
            pos_type: 'restaurant',
          },
        } as SettingsProfileRow
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, avatar_url, store_id, stores(name, pos_type)')
        .eq('id', user!.id)
        .single<SettingsProfileRow>()

      if (error) throw error
      return data
    },
  })

  const paymentConfigQuery = useQuery({
    queryKey: ['settings-payment-config', profileQuery.data?.store_id],
    enabled: Boolean(isSupabaseConfigured && profileQuery.data?.store_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_payment_configs')
        .select('provider, is_enabled, updated_at')
        .eq('store_id', profileQuery.data!.store_id)
        .eq('provider', 'paymongo')
        .maybeSingle<PaymentConfigRow>()

      if (error) throw error
      return data
    },
  })


  const employeesQuery = useQuery({
    queryKey: ['settings-employees', profileQuery.data?.store_id],
    enabled: Boolean(isSupabaseConfigured && profileQuery.data?.store_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, full_name, role, username')
        .eq('store_id', profileQuery.data!.store_id)
        .order('full_name', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as EmployeeRow[]
    },
  })


  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error('No authenticated user.')

      if (!isSupabaseConfigured) {
        const localUrl = URL.createObjectURL(file)
        setLocalPreview(localUrl)
        return { local: true as const }
      }

      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        if (uploadError.message.toLowerCase().includes('bucket')) {
          throw new Error('Avatar upload failed. Please create a public storage bucket named "avatars".')
        }
        throw uploadError
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const avatarUrl = data.publicUrl

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)

      if (profileError) throw profileError

      return { local: false as const }
    },
    onSuccess: async (result) => {
      showSuccess(result.local ? 'Preview updated (demo mode).' : 'Profile image updated successfully.')
      await queryClient.invalidateQueries({ queryKey: ['settings-profile', user?.id] })
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to upload avatar.')
    },
  })

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No authenticated user.')
      if (!isSupabaseConfigured) return

      const nextFirst = editFirstName.trim()
      const nextLast = editLastName.trim()
      const nextPhone = editPhone.trim()

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          first_name: nextFirst || null,
          last_name: nextLast || null,
          full_name: [nextFirst, nextLast].filter(Boolean).join(' ').trim() || null,
          phone: nextPhone || null,
        })
        .eq('id', user.id)

      if (profileUpdateError) throw profileUpdateError
    },
    onSuccess: async () => {
      showSuccess('Profile saved successfully.')
      await queryClient.invalidateQueries({ queryKey: ['settings-profile', user?.id] })
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to save profile.')
    },
  })

  const saveStoreMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No authenticated user.')

      const nextStore = editStoreName.trim()
      if (!nextStore) throw new Error('Store name is required.')

      if (!isSupabaseConfigured) return

      const currentStoreId = profileQuery.data?.store_id ?? null
      let storeIdToUse = currentStoreId

      if (currentStoreId) {
        const { error: storeUpdateError } = await supabase
          .from('stores')
          .update({ name: nextStore, pos_type: editPosType })
          .eq('id', currentStoreId)

        if (storeUpdateError) {
          if (storeUpdateError.message.toLowerCase().includes('pos_type')) {
            throw new Error('Missing stores.pos_type column. Run: ALTER TABLE public.stores ADD COLUMN pos_type text;')
          }
          throw storeUpdateError
        }
      } else {
        const { data: createdStore, error: createStoreError } = await supabase
          .from('stores')
          .insert([{ name: nextStore, pos_type: editPosType }])
          .select('id')
          .single<{ id: string }>()

        if (createStoreError) {
          if (createStoreError.message.toLowerCase().includes('pos_type')) {
            throw new Error('Missing stores.pos_type column. Run: ALTER TABLE public.stores ADD COLUMN pos_type text;')
          }
          throw createStoreError
        }
        storeIdToUse = createdStore.id
      }

      const { error: profileStoreLinkError } = await supabase
        .from('profiles')
        .update({ store_id: storeIdToUse })
        .eq('id', user.id)

      if (profileStoreLinkError) throw profileStoreLinkError
    },
    onSuccess: async () => {
      showSuccess('Store settings saved successfully.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings-profile', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['profile-store-orders', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['settings-payment-config'] }),
      ])
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to save store settings.')
    },
  })

  const savePaymentConfigMutation = useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
      if (!profileQuery.data?.store_id) throw new Error('Store is required before connecting PayMongo.')
      if (!paymongoPublicKey.trim() || !paymongoSecretKey.trim()) {
        throw new Error('PayMongo public and secret keys are required.')
      }

      const { data, error } = await supabase.functions.invoke('save-store-payment-config', {
        body: {
          storeId: profileQuery.data.store_id,
          provider: 'paymongo',
          publicKey: paymongoPublicKey.trim(),
          secretKey: paymongoSecretKey.trim(),
          webhookSecret: paymongoWebhookSecret.trim() || null,
          isEnabled: paymongoEnabled,
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: async () => {
      showSuccess('PayMongo settings saved successfully.')
      setPaymongoSecretKey('')
      setPaymongoWebhookSecret('')
      await queryClient.invalidateQueries({ queryKey: ['settings-payment-config'] })
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to save PayMongo settings.')
    },
  })


  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error('No email found for this account.')
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/login`,
      })

      if (error) throw error
    },
    onSuccess: () => {
      showSuccess(`Password reset email sent to ${user?.email}.`)
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to send password reset email.')
    },
  })

  const saveOrdersLayoutMutation = useMutation({
    mutationFn: async () => {
      if (typeof window === 'undefined') return
      localStorage.setItem(ORDERS_LAYOUT_STORAGE_KEY, editOrdersLayout)
    },
    onSuccess: () => {
      showSuccess('Orders layout saved.')
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to save orders layout.')
    },
  })


  const createEmployeeMutation = useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw new Error('Session expired or invalid. Please sign out and sign in again.')
      const storeId = profileQuery.data?.store_id
      if (!storeId) throw new Error('Save your store first before adding employees.')
      const firstName = empFirstName.trim()
      const lastName = empLastName.trim()
      if (!firstName || !lastName) throw new Error('First name and last name are required.')
      if (empPassword.length < 6) throw new Error('Password must be at least 6 characters.')
      const { data, error } = await supabase.functions.invoke('create-store-employee', {
        body: {
          storeId,
          password: empPassword,
          firstName,
          lastName,
          role: empRole,
        },
      })
      if (error) {
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.text === 'function') {
          try {
            const text = await ctx.text()
            const status = typeof (ctx as Response).status === 'number' ? (ctx as Response).status : ''
            if (text) {
              try {
                const body = JSON.parse(text) as { error?: string }
                if (body?.error) throw new Error(status ? `(${status}) ${body.error}` : body.error)
              } catch (_) {
                throw new Error(status ? `(${status}) ${text}` : text)
              }
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Edge Function returned a non-2xx status code') throw e
          }
        }
        const status = ctx && typeof (ctx as Response).status === 'number' ? ` (${(ctx as Response).status})` : ''
        throw new Error(`Edge Function failed${status}. Check Dashboard → Edge Functions → create-store-employee → Logs.`)
      }
      if (data?.error) throw new Error(data.error)
      return data as { username?: string }
    },
    onSuccess: async (data) => {
      const username = data?.username
      showSuccess(
        username
          ? `Employee created. Their username is: ${username}. They can sign in with this username and the password you set.`
          : 'Employee created. They can sign in with the generated username and the password you set.'
      )
      setEmpPassword('')
      setEmpFirstName('')
      setEmpLastName('')
      setEmpRole('employee')
      await queryClient.invalidateQueries({ queryKey: ['settings-employees'] })
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to create employee.')
    },
  })

  async function invokeEmployeeEdgeFunction(
    name: string,
    body: Record<string, unknown>
  ): Promise<{ error?: string }> {
    const { data, error } = await supabase.functions.invoke(name, { body })
    if (error) {
      const ctx = (error as { context?: Response }).context
      let message: string | null = null
      if (ctx && typeof ctx === 'object' && 'text' in ctx && typeof (ctx as Response).text === 'function') {
        try {
          const text = await (ctx as Response).text()
          if (text) {
            try {
              const parsed = JSON.parse(text) as { error?: string }
              if (parsed?.error) message = parsed.error
              else message = text
            } catch {
              message = text
            }
          }
        } catch {}
      }
      const status = ctx && typeof (ctx as Response).status === 'number' ? (ctx as Response).status : ''
      if (message) throw new Error(status ? `(${status}) ${message}` : message)
      throw new Error(`Edge Function failed${status ? ` (${status})` : ''}. Check Dashboard → Edge Functions → ${name} → Logs.`)
    }
    if (data?.error) throw new Error(data.error)
    return data as { error?: string }
  }

  const updateEmployeeMutation = useMutation({
    mutationFn: async (payload: {
      employeeId: string
      firstName: string
      lastName: string
      role: 'employee' | 'manager' | 'admin'
      newPassword?: string
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw new Error('Session expired or invalid. Please sign out and sign in again.')
      const storeId = profileQuery.data?.store_id
      if (!storeId) throw new Error('Store not found.')
      return invokeEmployeeEdgeFunction('update-store-employee', {
        storeId,
        employeeId: payload.employeeId,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        role: payload.role,
        ...(payload.newPassword && payload.newPassword.length >= 6 ? { newPassword: payload.newPassword } : {}),
      })
    },
    onSuccess: () => {
      showSuccess('Employee updated.')
      setEditingEmployee(null)
      setEditEmpFirstName('')
      setEditEmpLastName('')
      setEditEmpRole('employee')
      setEditEmpNewPassword('')
      queryClient.invalidateQueries({ queryKey: ['settings-employees'] })
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to update employee.')
    },
  })

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (payload: { employeeId: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw new Error('Session expired or invalid. Please sign out and sign in again.')
      const storeId = profileQuery.data?.store_id
      if (!storeId) throw new Error('Store not found.')
      return invokeEmployeeEdgeFunction('delete-store-employee', {
        storeId,
        employeeId: payload.employeeId,
      })
    },
    onSuccess: () => {
      showSuccess('Employee removed from the store.')
      setEmployeeToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['settings-employees'] })
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to delete employee.')
    },
  })

  function triggerFileInput() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showError('Please upload a valid image file.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      showError('Image file must be 4MB or below.')
      return
    }

    uploadAvatarMutation.mutate(file)
  }

  const profile = profileQuery.data
  const firstName = profile?.first_name ?? (user?.user_metadata?.first_name as string | undefined) ?? ''
  const lastName = profile?.last_name ?? (user?.user_metadata?.last_name as string | undefined) ?? ''
  const fullName = `${firstName} ${lastName}`.trim()
  const storeName = profile?.stores?.name ?? (user?.user_metadata?.store_name as string | undefined) ?? ''
  const posTypeFromDb = (profile?.stores?.pos_type ?? 'restaurant') as PosType
  const phone = profile?.phone ?? (user?.user_metadata?.phone as string | undefined) ?? ''
  const email = user?.email ?? ''

  const avatarUrl = localPreview || profile?.avatar_url || null
  const initials = useMemo(() => {
    if (fullName) {
      return fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('')
    }
    return (email?.[0] || 'U').toUpperCase()
  }, [fullName, email])

  useEffect(() => {
    setEditFirstName(firstName || '')
    setEditLastName(lastName || '')
    setEditPhone(phone || '')
    setEditStoreName(storeName || '')
    setEditPosType(posTypeFromDb)
  }, [firstName, lastName, phone, storeName, posTypeFromDb])

  useEffect(() => {
    if (paymentConfigQuery.data) {
      setPaymongoEnabled(Boolean(paymentConfigQuery.data.is_enabled))
    }
  }, [paymentConfigQuery.data])


  const ordersLayoutSaved: OrdersLayoutValue =
    typeof window !== 'undefined' && localStorage.getItem(ORDERS_LAYOUT_STORAGE_KEY) === 'grid' ? 'grid' : 'default'
  const hasOrdersLayoutChanges = editOrdersLayout !== ordersLayoutSaved

  const hasProfileChanges =
    editFirstName.trim() !== (firstName || '').trim() ||
    editLastName.trim() !== (lastName || '').trim() ||
    editPhone.trim() !== (phone || '').trim()

  const hasStoreChanges =
    editStoreName.trim() !== (storeName || '').trim() ||
    editPosType !== posTypeFromDb

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <PageContent className="space-y-5">
        <div className="flex items-center gap-2">
          <SettingsIcon size={24} className="text-slate-600" />
          <h1 className="text-xl font-bold text-slate-800">Settings</h1>
        </div>

        {(profileQuery.isLoading || uploadAvatarMutation.isPending) && (
          <div className="inline-flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Loader2 size={15} className="animate-spin" />
            Loading settings...
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('profile')}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <User size={16} className="text-indigo-600 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-800">Profile</h2>
            </div>
            <ChevronDown
              size={20}
              className={`text-slate-500 shrink-0 transition-transform duration-200 ${openSections.profile ? 'rotate-180' : ''}`}
            />
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${openSections.profile ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="px-6 pb-6 pt-6 border-t border-slate-100">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center overflow-hidden border-4 border-white shadow">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold">{initials}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow hover:bg-indigo-700 transition-colors"
                  >
                    <Camera size={14} />
                  </button>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-800">{fullName || 'User Profile'}</h3>
                <p className="text-sm text-slate-500">{email}</p>
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  <Upload size={14} />
                  Upload Image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditableField label="First Name" value={editFirstName} onChange={setEditFirstName} placeholder="First name" />
                <EditableField label="Last Name" value={editLastName} onChange={setEditLastName} placeholder="Last name" />
                <EditableField label="Phone Number" value={editPhone} onChange={setEditPhone} placeholder="+63..." />
                <ReadOnlyField label="Email" value={email || '-'} />
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    saveProfileMutation.mutate()
                  }}
                  disabled={!hasProfileChanges}
                  loading={saveProfileMutation.isPending}
                >
                  Save changes
                </Button>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Do you want to change password?</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      We will send a secure password reset link to <span className="font-medium">{email || 'your email'}</span>.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      resetPasswordMutation.mutate()
                    }}
                    disabled={!isSupabaseConfigured}
                    loading={resetPasswordMutation.isPending}
                    className="px-3.5 py-2 text-sm"
                  >
                    {!resetPasswordMutation.isPending && <KeyRound size={14} />}
                    Send reset email
                  </Button>
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('store')}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Store size={16} className="text-indigo-600 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-800">Store Settings</h2>
            </div>
            <ChevronDown
              size={20}
              className={`text-slate-500 shrink-0 transition-transform duration-200 ${openSections.store ? 'rotate-180' : ''}`}
            />
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${openSections.store ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="px-6 pb-6 pt-6 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditableField label="Store Name" value={editStoreName} onChange={setEditStoreName} placeholder="Store name" />

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">POS Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditPosType('restaurant')}
                      className={`px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                        editPosType === 'restaurant'
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Cafe / Restaurant POS
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPosType('retail')}
                      className={`px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                        editPosType === 'retail'
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Retail Store POS
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    saveStoreMutation.mutate()
                  }}
                  disabled={!hasStoreChanges}
                  loading={saveStoreMutation.isPending}
                >
                  Save store settings
                </Button>
              </div>
            </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('payment')}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <PlugZap size={16} className="text-indigo-600 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-800">Payment Integration (PayMongo)</h2>
            </div>
            <ChevronDown
              size={20}
              className={`text-slate-500 shrink-0 transition-transform duration-200 ${openSections.payment ? 'rotate-180' : ''}`}
            />
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${openSections.payment ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="px-6 pb-6 pt-6 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditableField
                  label="PayMongo Public Key"
                  value={paymongoPublicKey}
                  onChange={setPaymongoPublicKey}
                  placeholder="pk_live_..."
                />
                <EditableField
                  label="PayMongo Secret Key"
                  value={paymongoSecretKey}
                  onChange={setPaymongoSecretKey}
                  placeholder="sk_live_..."
                />
                <EditableField
                  label="PayMongo Webhook Secret (optional)"
                  value={paymongoWebhookSecret}
                  onChange={setPaymongoWebhookSecret}
                  placeholder="whsec_..."
                />
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Enable PayMongo</label>
                  <button
                    type="button"
                    onClick={() => setPaymongoEnabled((v) => !v)}
                    className={`w-full px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                      paymongoEnabled
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {paymongoEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                {paymentConfigQuery.data
                  ? `Last updated: ${new Date(paymentConfigQuery.data.updated_at).toLocaleString()}`
                  : 'No PayMongo config saved yet.'}
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    savePaymentConfigMutation.mutate()
                  }}
                  disabled={!isSupabaseConfigured}
                  loading={savePaymentConfigMutation.isPending}
                >
                  Save payment settings
                </Button>
              </div>
            </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('ordersLayout')}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <LayoutGrid size={16} className="text-indigo-600 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-800">Orders Layout settings</h2>
            </div>
            <ChevronDown
              size={20}
              className={`text-slate-500 shrink-0 transition-transform duration-200 ${openSections.ordersLayout ? 'rotate-180' : ''}`}
            />
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${openSections.ordersLayout ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="px-6 pb-6 pt-6 border-t border-slate-100">
                <p className="text-sm text-slate-600 mb-4">
                  Choose how the Orders (POS) page is laid out. The default layout shows products on the left, cart and checkout on the right, and recent orders below.
                </p>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Layout</label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setEditOrdersLayout('default')}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                        editOrdersLayout === 'default'
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium">Default</span>
                      <p className="text-xs mt-0.5 opacity-90">
                        Products left (2 columns), cart & checkout right, recent orders below
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditOrdersLayout('grid')}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                        editOrdersLayout === 'grid'
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium">Traditional grid</span>
                      <p className="text-xs mt-0.5 opacity-90">
                        Dense grid of product tiles (POS-style), cart & checkout on the right
                      </p>
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    onClick={() => saveOrdersLayoutMutation.mutate()}
                    disabled={!hasOrdersLayoutChanges}
                    loading={saveOrdersLayoutMutation.isPending}
                  >
                    Save layout
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('employees')}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users size={16} className="text-indigo-600 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-800">Employees</h2>
            </div>
            <ChevronDown
              size={20}
              className={`text-slate-500 shrink-0 transition-transform duration-200 ${openSections.employees ? 'rotate-180' : ''}`}
            />
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${openSections.employees ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="px-6 pb-6 pt-6 border-t border-slate-100">
                <p className="text-sm text-slate-600 mb-4">
                  Add employees to your store. Each person gets a unique username (e.g. Xk9mAbEMDelaCruzJuan030326) and can sign in with that username and the password you set.
                </p>

                {!profileQuery.data?.store_id ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    Save your store in the Store Settings section first, then you can add employees.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <EditableField
                        label="First name"
                        value={empFirstName}
                        onChange={setEmpFirstName}
                        placeholder="Juan"
                      />
                      <EditableField
                        label="Last name"
                        value={empLastName}
                        onChange={setEmpLastName}
                        placeholder="Dela Cruz"
                      />
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Role</label>
                        <Select
                          value={empRole}
                          onChange={(e) => setEmpRole(e.target.value as 'employee' | 'manager' | 'admin')}
                        >
                          <option value="employee">Employee (EM)</option>
                          <option value="manager">Manager (MA)</option>
                          <option value="admin">Admin (AD)</option>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Temporary password</label>
                        <div className="relative">
                          <input
                            type={showEmpPassword ? 'text' : 'password'}
                            value={empPassword}
                            onChange={(e) => setEmpPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            className="w-full px-3 py-2.5 pr-11 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEmpPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            aria-label={showEmpPassword ? 'Hide password' : 'Show password'}
                          >
                            {showEmpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end mb-8">
                      <Button
                        type="button"
                        onClick={() => createEmployeeMutation.mutate()}
                        disabled={createEmployeeMutation.isPending || !canWriteEmployees || !empFirstName.trim() || !empLastName.trim() || empPassword.length < 6}
                        loading={createEmployeeMutation.isPending}
                      >
                        Add employee
                      </Button>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Store team</h3>
                    {employeesQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                        <Loader2 size={16} className="animate-spin" />
                        Loading…
                      </div>
                    ) : (employeesQuery.data?.length ?? 0) === 0 ? (
                      <p className="text-sm text-slate-500 py-4">No employees yet. Add one above.</p>
                    ) : (
                      <>
                        <ul className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                        {(employeesQuery.data ?? []).map((emp) => {
                          const name = emp.full_name || [emp.first_name, emp.last_name].filter(Boolean).join(' ') || 'No name'
                          const isCurrentUser = emp.id === user?.id
                          const isOwner = emp.role === 'owner'
                          const role = emp.role ?? 'employee'
                          const roleLabel = role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : role === 'manager' ? 'Manager' : 'Employee'
                          const canEdit = !isOwner
                          const canDelete = !isOwner && !isCurrentUser
                          return (
                            <li key={emp.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-white hover:bg-slate-50/50">
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium text-slate-800 block truncate">
                                  {name}
                                  {isCurrentUser && (
                                    <span className="ml-2 text-xs font-normal text-slate-500">(you)</span>
                                  )}
                                </span>
                                <span className="text-xs text-slate-500 font-mono block truncate" title={emp.username ?? undefined}>
                                  {emp.username ? `Username: ${emp.username}` : '—'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                                    role === 'owner'
                                      ? 'bg-indigo-100 text-indigo-700'
                                      : role === 'admin'
                                      ? 'bg-violet-100 text-violet-700'
                                      : role === 'manager'
                                      ? 'bg-sky-100 text-sky-700'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {roleLabel}
                                </span>
                                {canEdit && (
                                  <button
                                    type="button"
                                    disabled={!canWriteEmployees}
                                    onClick={() => {
                                      setEditingEmployee(emp)
                                      setEditEmpFirstName(emp.first_name ?? '')
                                      setEditEmpLastName(emp.last_name ?? '')
                                      setEditEmpRole((emp.role === 'admin' || emp.role === 'manager' ? emp.role : 'employee') as 'employee' | 'manager' | 'admin')
                                      setEditEmpNewPassword('')
                                    }}
                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    aria-label="Edit employee"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    disabled={!canWriteEmployees}
                                    onClick={() => setEmployeeToDelete(emp)}
                                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    aria-label="Delete employee"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>

                      <Modal
                        open={Boolean(editingEmployee)}
                        onClose={() => {
                          setEditingEmployee(null)
                          setEditEmpNewPassword('')
                        }}
                        title="Edit employee"
                        description={
                          editingEmployee
                            ? editingEmployee.full_name || [editingEmployee.first_name, editingEmployee.last_name].filter(Boolean).join(' ') || 'Employee'
                            : undefined
                        }
                        maxWidthClassName="max-w-md"
                      >
                        {editingEmployee && (
                            <form
                              className="space-y-4"
                              onSubmit={(e) => {
                                e.preventDefault()
                                if (!editingEmployee) return
                                updateEmployeeMutation.mutate({
                                  employeeId: editingEmployee.id,
                                  firstName: editEmpFirstName.trim(),
                                  lastName: editEmpLastName.trim(),
                                  role: editEmpRole,
                                  ...(editEmpNewPassword.length >= 6 ? { newPassword: editEmpNewPassword } : {}),
                                })
                              }}
                            >
                              <EditableField
                                label="First name"
                                value={editEmpFirstName}
                                onChange={setEditEmpFirstName}
                                placeholder="Juan"
                              />
                              <EditableField
                                label="Last name"
                                value={editEmpLastName}
                                onChange={setEditEmpLastName}
                                placeholder="Dela Cruz"
                              />
                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Role</label>
                                <Select
                                  value={editEmpRole}
                                  onChange={(e) => setEditEmpRole(e.target.value as 'employee' | 'manager' | 'admin')}
                                >
                                  <option value="employee">Employee (EM)</option>
                                  <option value="manager">Manager (MA)</option>
                                  <option value="admin">Admin (AD)</option>
                                </Select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">New password (optional)</label>
                                <div className="relative">
                                  <input
                                    type={showEditEmpPassword ? 'text' : 'password'}
                                    value={editEmpNewPassword}
                                    onChange={(e) => setEditEmpNewPassword(e.target.value)}
                                    placeholder="Leave blank to keep current"
                                    className="w-full px-3 py-2.5 pr-11 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowEditEmpPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    aria-label={showEditEmpPassword ? 'Hide password' : 'Show password'}
                                  >
                                    {showEditEmpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                  </button>
                                </div>
                              </div>
                              <div className="flex gap-3 pt-2">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setEditingEmployee(null)
                                    setEditEmpNewPassword('')
                                  }}
                                  variant="outline"
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  disabled={updateEmployeeMutation.isPending || !canWriteEmployees || !editEmpFirstName.trim() || !editEmpLastName.trim()}
                                  loading={updateEmployeeMutation.isPending}
                                  className="flex-1"
                                >
                                  Save changes
                                </Button>
                              </div>
                            </form>
                        )}
                      </Modal>

                      <Modal
                        open={Boolean(employeeToDelete)}
                        onClose={() => setEmployeeToDelete(null)}
                        title="Remove employee?"
                        maxWidthClassName="max-w-sm"
                        footer={(
                          <div className="flex gap-3 w-full">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setEmployeeToDelete(null)}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() => {
                                if (!employeeToDelete) return
                                deleteEmployeeMutation.mutate({ employeeId: employeeToDelete.id })
                              }}
                              disabled={!canWriteEmployees}
                              loading={deleteEmployeeMutation.isPending}
                              className="flex-1"
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      >
                        {employeeToDelete && (
                          <div>
                            <p className="text-sm text-slate-600 mt-2">
                              {employeeToDelete.full_name || [employeeToDelete.first_name, employeeToDelete.last_name].filter(Boolean).join(' ') || 'This person'} will be removed from the store and will no longer be able to sign in. This cannot be undone.
                            </p>
                          </div>
                        )}
                      </Modal>
                      </>
                    )}
                    </>
                  )}
              </div>
            </div>
          </div>
        </section>
      </PageContent>
    </div>
  )
}

function EditableField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{label}</label>
      <input
        value={value}
        readOnly
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
      />
    </div>
  )
}
