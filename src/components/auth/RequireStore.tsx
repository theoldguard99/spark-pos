import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

interface ProfileStoreRow {
  store_id: string | null
}

export default function RequireStore({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  const profileQuery = useQuery({
    queryKey: ['profile-store-check', user?.id],
    enabled: Boolean(isSupabaseConfigured && user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user!.id)
        .single<ProfileStoreRow>()

      if (error) {
        if (error.code === 'PGRST116') return { store_id: null } as ProfileStoreRow
        throw error
      }

      return data
    },
  })

  if (!isSupabaseConfigured) return <>{children}</>

  if (profileQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Checking store setup...</p>
        </div>
      </div>
    )
  }

  if (!profileQuery.data?.store_id) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
