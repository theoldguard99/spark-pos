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

function fromB64(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
}

async function decryptText(payload: string) {
  const keyB64 = Deno.env.get('APP_ENCRYPTION_KEY_B64')
  if (!keyB64) throw new Error('Missing APP_ENCRYPTION_KEY_B64')

  const keyBytes = fromB64(keyB64)
  if (keyBytes.length !== 32) throw new Error('APP_ENCRYPTION_KEY_B64 must decode to 32 bytes')

  const [ivB64, cipherB64] = payload.split(':')
  if (!ivB64 || !cipherB64) throw new Error('Invalid encrypted payload format')

  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt'])
  const iv = fromB64(ivB64)
  const cipher = fromB64(cipherB64)
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new TextDecoder().decode(plainBuffer)
}

function basicAuth(secretKey: string) {
  return `Basic ${btoa(`${secretKey}:`)}`
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

    const { orderId } = await req.json()
    if (!orderId) throw new Error('orderId is required')

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('store_id')
      .eq('id', userId)
      .single<{ store_id: string | null }>()
    if (profileError) throw profileError
    if (!profile?.store_id) throw new Error('No store linked to this account')

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, total, store_id')
      .eq('id', orderId)
      .single<{ id: string; total: number; store_id: string }>()
    if (orderError) throw orderError
    if (order.store_id !== profile.store_id) throw new Error('Forbidden: order ownership mismatch')

    const { data: paymentConfig, error: configError } = await admin
      .from('store_payment_configs')
      .select('secret_key_enc, is_enabled')
      .eq('store_id', order.store_id)
      .eq('provider', 'paymongo')
      .single<{ secret_key_enc: string; is_enabled: boolean }>()
    if (configError) throw configError
    if (!paymentConfig.is_enabled) throw new Error('PayMongo integration is disabled for this store')

    const paymongoSecretKey = await decryptText(paymentConfig.secret_key_enc)
    const amountInCentavos = Math.round(Number(order.total) * 100)
    if (!Number.isFinite(amountInCentavos) || amountInCentavos <= 0) {
      throw new Error('Invalid order amount')
    }

    // Using PayMongo Payment Link flow to support GCash checkout URL.
    const paymongoResp = await fetch('https://api.paymongo.com/v1/links', {
      method: 'POST',
      headers: {
        Authorization: basicAuth(paymongoSecretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amountInCentavos,
            currency: 'PHP',
            description: `Order ${order.id}`,
            remarks: 'SPARK POS Checkout',
            reference_number: order.id,
          },
        },
      }),
    })

    const paymongoJson = await paymongoResp.json()
    if (!paymongoResp.ok) {
      const message = paymongoJson?.errors?.[0]?.detail || 'Failed to create PayMongo payment link'
      throw new Error(message)
    }

    const externalPaymentId = paymongoJson?.data?.id as string | undefined
    const checkoutUrl = paymongoJson?.data?.attributes?.checkout_url as string | undefined
    if (!externalPaymentId || !checkoutUrl) throw new Error('Invalid PayMongo response')

    const { error: updateError } = await admin
      .from('orders')
      .update({
        external_payment_id: externalPaymentId,
        payment_reference: order.id,
        payment_status: 'processing',
      })
      .eq('id', order.id)
      .eq('store_id', order.store_id)
    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ checkoutUrl, externalPaymentId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
