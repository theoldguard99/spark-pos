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
}

function toB64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

function fromB64(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
}

async function encryptText(plain: string) {
  const keyB64 = Deno.env.get('APP_ENCRYPTION_KEY_B64')
  if (!keyB64) throw new Error('Missing APP_ENCRYPTION_KEY_B64')

  const keyBytes = fromB64(keyB64)
  if (keyBytes.length !== 32) throw new Error('APP_ENCRYPTION_KEY_B64 must decode to 32 bytes')

  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  )
  return `${toB64(iv)}:${toB64(new Uint8Array(cipherBuffer))}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: userData, error: authError } = await userClient.auth.getUser()
    if (authError || !userData.user) throw new Error('Unauthorized')
    const userId = userData.user.id

    const body = await req.json()
    const {
      storeId,
      provider,
      publicKey,
      secretKey,
      webhookSecret,
      isEnabled,
    } = body ?? {}

    if (!storeId || provider !== 'paymongo' || !publicKey || !secretKey) {
      throw new Error('Invalid payload')
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('store_id')
      .eq('id', userId)
      .single<{ store_id: string | null }>()
    if (profileError) throw profileError
    if (!profile?.store_id || profile.store_id !== storeId) {
      throw new Error('Forbidden: store ownership mismatch')
    }

    const encryptedPublic = await encryptText(publicKey)
    const encryptedSecret = await encryptText(secretKey)
    const encryptedWebhook = webhookSecret ? await encryptText(webhookSecret) : null

    const { error: upsertError } = await admin.from('store_payment_configs').upsert(
      {
        store_id: storeId,
        provider: 'paymongo',
        public_key_enc: encryptedPublic,
        secret_key_enc: encryptedSecret,
        webhook_secret_enc: encryptedWebhook,
        is_enabled: Boolean(isEnabled),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,provider' },
    )
    if (upsertError) throw upsertError

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
