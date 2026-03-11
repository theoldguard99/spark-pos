/// <reference path="../esm-sh.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: { get(key: string): string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    const { data: userData, error: authError } = await userClient.auth.getUser()
    if (authError) throw new Error(authError.message || 'Auth failed')
    if (!userData.user) throw new Error('Unauthorized')
    const userId = userData.user.id

    let body: Record<string, unknown> = {}
    try {
      body = await req.json() as Record<string, unknown>
    } catch {
      throw new Error('Invalid request body (expected JSON)')
    }
    const { storeId, employeeId, firstName, lastName, role, newPassword } = body ?? {}

    if (!storeId || !employeeId) {
      throw new Error('storeId and employeeId are required')
    }

    const { data: callerProfile, error: callerError } = await admin
      .from('profiles')
      .select('store_id, role')
      .eq('id', userId)
      .single<{ store_id: string | null; role: string | null }>()
    if (callerError) throw new Error(`Caller profile: ${callerError.message}`)
    if (!callerProfile?.store_id || callerProfile.store_id !== storeId) {
      throw new Error('Forbidden: you can only update employees in your own store')
    }

    const { data: targetProfile, error: targetError } = await admin
      .from('profiles')
      .select('id, store_id, role, first_name, last_name')
      .eq('id', employeeId)
      .single<{ id: string; store_id: string | null; role: string | null; first_name: string | null; last_name: string | null }>()
    if (targetError || !targetProfile) throw new Error('Employee not found')
    if (targetProfile.store_id !== storeId) throw new Error('Employee is not in your store')
    if (targetProfile.role === 'owner') throw new Error('Cannot update the store owner')

    const first = typeof firstName === 'string' ? firstName.trim() : null
    const last = typeof lastName === 'string' ? lastName.trim() : null
    const roleNorm =
      typeof role === 'string' && ['admin', 'manager', 'employee'].includes(role.toLowerCase())
        ? role.toLowerCase()
        : null

    const profileUpdates: Record<string, unknown> = {}
    if (first !== null) profileUpdates.first_name = first
    if (last !== null) profileUpdates.last_name = last
    if (roleNorm !== null) profileUpdates.role = roleNorm
    const finalFirst = first ?? targetProfile.first_name
    const finalLast = last ?? targetProfile.last_name
    const fullName = [finalFirst, finalLast].filter(Boolean).join(' ').trim() || null
    if (first !== null || last !== null) profileUpdates.full_name = fullName

    const authUpdates: { user_metadata?: Record<string, unknown>; password?: string } = {}
    const meta: Record<string, unknown> = {}
    if (first !== null) meta.first_name = first
    if (last !== null) meta.last_name = last
    if (fullName !== null) meta.full_name = fullName
    if (Object.keys(meta).length > 0) authUpdates.user_metadata = meta
    if (typeof newPassword === 'string' && newPassword.length >= 6) authUpdates.password = newPassword

    if (Object.keys(authUpdates).length > 0) {
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(employeeId, authUpdates)
      if (updateAuthError) throw new Error(`Auth update failed: ${updateAuthError.message}`)
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', employeeId)
      if (profileUpdateError) throw new Error(`Profile update failed: ${profileUpdateError.message}`)
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
