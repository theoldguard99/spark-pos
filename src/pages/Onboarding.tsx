import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Store, Phone, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface ProfileRow {
  store_id: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  phone?: string | null
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()

  const [storeName, setStoreName] = useState('')
  const [phone, setPhone] = useState('')

  const profileQuery = useQuery({
    queryKey: ['onboarding-profile', user?.id],
    enabled: Boolean(isSupabaseConfigured && user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('store_id, first_name, last_name, full_name, phone')
        .eq('id', user!.id)
        .single<ProfileRow>()

      if (error) {
        if (error.code === 'PGRST116') return { store_id: null } as ProfileRow
        throw error
      }
      return data
    },
  })

  const normalizedPhone = useMemo(() => phone.replace(/\D/g, '').slice(0, 10), [phone])

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
      if (!user?.id) throw new Error('No authenticated user.')
      if (!storeName.trim()) throw new Error('Store name is required.')

      const { data: createdStore, error: storeError } = await supabase
        .from('stores')
        .insert([
          {
            name: storeName.trim(),
            phone: normalizedPhone ? `+63${normalizedPhone}` : null,
          },
        ])
        .select('id')
        .single<{ id: string }>()

      if (storeError) {
        throw new Error(
          storeError.message.includes('row-level security')
            ? 'Store insert blocked by RLS policy. Add an INSERT policy on stores for authenticated users.'
            : storeError.message,
        )
      }

      const metadataFirstName = (user.user_metadata?.first_name as string | undefined)?.trim() ?? null
      const metadataLastName = (user.user_metadata?.last_name as string | undefined)?.trim() ?? null
      const metadataFullName = (user.user_metadata?.full_name as string | undefined)?.trim() ?? null

      const existing = profileQuery.data
      const firstName = existing?.first_name ?? metadataFirstName
      const lastName = existing?.last_name ?? metadataLastName
      const fullName =
        existing?.full_name ??
        metadataFullName ??
        ([metadataFirstName, metadataLastName].filter(Boolean).join(' ').trim() || null)

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          phone: existing?.phone ?? (normalizedPhone ? `+63${normalizedPhone}` : null),
          store_id: createdStore.id,
          role: 'owner',
        },
        { onConflict: 'id' },
      )

      if (profileError) throw profileError
    },
    onSuccess: () => {
      showSuccess('Store setup complete! Redirecting to dashboard...')
      setTimeout(() => navigate('/dashboard'), 700)
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to complete onboarding.')
    },
  })

  if (!isSupabaseConfigured) {
    return <Navigate to="/dashboard" replace />
  }

  if (profileQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Preparing onboarding...</p>
        </div>
      </div>
    )
  }

  if (profileQuery.data?.store_id) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 md:p-7 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Store size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Set up your store</h1>
            <p className="text-sm text-slate-500">One-time setup before accessing SPARK.</p>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            completeOnboarding.mutate()
          }}
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Store Name *</label>
            <div className="relative">
              <Store size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Aling Nena's Store"
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Store Phone (PH)</label>
            <div className="flex">
              <div className="flex items-center gap-1.5 px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm text-slate-600 font-medium whitespace-nowrap">
                <Phone size={13} />
                +63
              </div>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9XXXXXXXXX"
                className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">Optional. 10 digits starting with 9.</p>
          </div>

          <button
            type="submit"
            disabled={completeOnboarding.isPending}
            className="w-full mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            {completeOnboarding.isPending && <Loader2 size={16} className="animate-spin" />}
            Complete Setup
          </button>
        </form>
      </div>
    </div>
  )
}
