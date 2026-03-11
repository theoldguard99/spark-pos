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

function extractPaymentId(payload: Record<string, unknown>) {
  const eventData = payload?.data as Record<string, unknown> | undefined
  const attributes = eventData?.attributes as Record<string, unknown> | undefined
  const innerData = attributes?.data as Record<string, unknown> | undefined

  return (
    (innerData?.id as string | undefined) ||
    (eventData?.id as string | undefined) ||
    null
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const payload = await req.json() as Record<string, unknown>
    const eventType = payload?.type as string | undefined
    const paymentId = extractPaymentId(payload)
    if (!paymentId) throw new Error('Payment ID not found in webhook payload')

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, store_id, status, payment_status')
      .eq('external_payment_id', paymentId)
      .single<{ id: string; store_id: string; status: string; payment_status: string }>()
    if (orderError) throw orderError

    // If already completed, treat webhook as idempotent success.
    if (order.payment_status === 'completed') {
      return new Response(JSON.stringify({ ok: true, idempotent: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isSuccess =
      eventType === 'payment.paid' ||
      eventType === 'source.chargeable' ||
      eventType === 'checkout_session.payment.paid'

    if (!isSuccess) {
      await admin
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', order.id)
        .eq('store_id', order.store_id)

      return new Response(JSON.stringify({ ok: true, marked: 'failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: markPaidError } = await admin
      .from('orders')
      .update({
        payment_status: 'completed',
        status: 'completed',
        paid_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('store_id', order.store_id)
    if (markPaidError) throw markPaidError

    // Deduct stocks after confirmed payment.
    const { data: orderItems, error: itemsError } = await admin
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', order.id)
      .eq('store_id', order.store_id)
    if (itemsError) throw itemsError

    for (const item of orderItems ?? []) {
      const { data: product, error: productError } = await admin
        .from('products')
        .select('id, stock')
        .eq('id', item.product_id)
        .eq('store_id', order.store_id)
        .single<{ id: string; stock: number }>()
      if (productError) throw productError

      const nextStock = Math.max((product.stock ?? 0) - (item.quantity ?? 0), 0)
      const { error: stockError } = await admin
        .from('products')
        .update({ stock: nextStock })
        .eq('id', product.id)
        .eq('store_id', order.store_id)
      if (stockError) throw stockError
    }

    return new Response(JSON.stringify({ ok: true, marked: 'completed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
