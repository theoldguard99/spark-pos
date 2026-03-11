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

    const body = await req.json()
    const { storeId, employeeId } = body ?? {}

    if (!storeId || !employeeId) {
      throw new Error('storeId and employeeId are required')
    }

    if (employeeId === userId) {
      throw new Error('You cannot delete your own account from here. Use profile or account settings.')
    }

    const { data: callerProfile, error: callerError } = await admin
      .from('profiles')
      .select('store_id')
      .eq('id', userId)
      .single<{ store_id: string | null }>()
    if (callerError) throw callerError
    if (!callerProfile?.store_id || callerProfile.store_id !== storeId) {
      throw new Error('Forbidden: you can only delete employees from your own store')
    }

    const { data: targetProfile, error: targetError } = await admin
      .from('profiles')
      .select('id, store_id, role')
      .eq('id', employeeId)
      .single<{ id: string; store_id: string | null; role: string | null }>()
    if (targetError || !targetProfile) throw new Error('Employee not found')
    if (targetProfile.store_id !== storeId) throw new Error('Employee is not in your store')
    if (targetProfile.role === 'owner') throw new Error('Cannot delete the store owner')

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(employeeId)
    if (deleteAuthError) throw new Error(`Auth delete failed: ${deleteAuthError.message}`)

    const { error: deleteProfileError } = await admin.from('profiles').delete().eq('id', employeeId)
    if (deleteProfileError) throw new Error(`Profile delete failed: ${deleteProfileError.message}`)

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
