import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (email: string, password: string, metadata?: Record<string, string>) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let cancelled = false
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      if (!cancelled) {
        setSession(data.session)
        setLoading(false)
      }
    }
    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signInWithEmail(email: string, password: string) {
    if (!isSupabaseConfigured) return { error: 'Supabase is not configured yet.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUpWithEmail(email: string, password: string, metadata?: Record<string, string>) {
    if (!isSupabaseConfigured) return { error: 'Supabase is not configured yet.' }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata ?? {},
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    return { error: error?.message ?? null }
  }

  async function signInWithGoogle() {
    if (!isSupabaseConfigured) return { error: 'Supabase is not configured yet.' }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
