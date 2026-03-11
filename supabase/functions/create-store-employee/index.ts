/// <reference path="../esm-sh.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deno globals (Supabase Edge Functions run in Deno; this silences TS in Node/editor)
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

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** 5-char alphanumeric from hashed seed (include storeId so different stores get different codes) */
function shortCodeFromSeed(seed: string): Promise<string> {
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(seed))
    .then((buf) => {
      const arr = new Uint8Array(buf)
      let out = ''
      for (let i = 0; i < 5; i++) {
        out += ALPHABET[arr[i]! % ALPHABET.length]
      }
      return out
    })
}

function positionCode(role: string): string {
  const r = role.toLowerCase()
  if (r === 'admin') return 'AD'
  if (r === 'manager') return 'MA'
  return 'EM' // employee
}

/** Short name part: first 2 of last + first 2 of first, lowercased (max 4 chars). e.g. Dela Cruz + Juan -> deju */
function shortNamesPart(firstName: string, lastName: string): string {
  const first = firstName.replace(/\s+/g, '').slice(0, 2).toLowerCase()
  const last = lastName.replace(/\s+/g, '').slice(0, 2).toLowerCase()
  return (last + first).slice(0, 4) || 'xx'
}

/** MMDDYY (e.g. March 3, 2026 -> 030326) */
function shortDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return mm + dd + yy
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
    if (authError) {
      const msg = authError.message || 'Auth failed'
      throw new Error(msg)
    }
    if (!userData.user) throw new Error('Unauthorized')
    const userId = userData.user.id

    const body = await req.json()
    const { storeId, password, firstName, lastName, role } = body ?? {}

    if (!storeId || !password || typeof password !== 'string') {
      throw new Error('storeId and password are required')
    }

    const first = typeof firstName === 'string' ? firstName.trim() : ''
    const last = typeof lastName === 'string' ? lastName.trim() : ''
    if (!first || !last) throw new Error('First name and last name are required')

    if (password.length < 6) throw new Error('Password must be at least 6 characters')

    const roleNorm = typeof role === 'string' && ['admin', 'manager', 'employee'].includes(role.toLowerCase())
      ? role.toLowerCase()
      : 'employee'

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('store_id')
      .eq('id', userId)
      .single<{ store_id: string | null }>()
    if (profileError) throw profileError
    if (!profile?.store_id || profile.store_id !== storeId) {
      throw new Error('Forbidden: you can only add employees to your own store')
    }

    const datePart = shortDate(new Date())
    const pos = positionCode(roleNorm)
    const shortNames = shortNamesPart(first, last)

    let username = ''
    let emailForAuth = ''
    const maxAttempts = 3
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const seed = `${storeId}-${crypto.randomUUID()}-${Date.now()}`
      const part5 = await shortCodeFromSeed(seed)
      username = part5 + pos + shortNames + datePart
      emailForAuth = `${username}@pos.local`

      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()
      if (!existing) break
      if (attempt === maxAttempts - 1) throw new Error('Could not generate a unique username. Please try again.')
    }

    const fullName = [first, last].filter(Boolean).join(' ').trim() || null

    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email: emailForAuth,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: first || null,
        last_name: last || null,
        full_name: fullName,
        username,
      },
    })

    if (createError) {
      if (createError.message.toLowerCase().includes('already registered')) {
        throw new Error('A user with this username pattern already exists. Try again.')
      }
      throw createError
    }

    const newUserId = createData.user?.id
    if (!newUserId) throw new Error('Failed to create user')

    const { error: upsertError } = await admin.from('profiles').upsert(
      {
        id: newUserId,
        store_id: storeId,
        first_name: first || null,
        last_name: last || null,
        full_name: fullName,
        role: roleNorm,
        username,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    if (upsertError) {
      const msg = upsertError.message || 'Database error saving profile'
      throw new Error(`Profile save failed: ${msg}`)
    }

    return new Response(
      JSON.stringify({ ok: true, userId: newUserId, username }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
