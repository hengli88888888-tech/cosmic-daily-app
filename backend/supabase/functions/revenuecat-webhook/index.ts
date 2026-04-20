import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const PLAN_ALLOWANCES: Record<string, number> = {
  basic_monthly: 20,
  pro_monthly: 70,
  pro_yearly: 70,
  basic: 20,
  pro: 70,
  yearly: 70,
}

const PLAN_ALIASES: Record<string, string[]> = {
  basic_monthly: ['basic_monthly', 'basic-monthly', 'basic'],
  pro_monthly: ['pro_monthly', 'pro-monthly', 'pro', 'advanced_monthly', 'advanced'],
  pro_yearly: ['pro_yearly', 'pro-yearly', 'yearly', 'annual', 'advanced_yearly'],
}

const COIN_PACKS: Array<{
  code: string
  coins: number
  aliases: string[]
}> = [
  { code: 'coins_5_pack', coins: 5, aliases: ['coins_5_pack', 'coins-5', '5_coins', '5coins'] },
  { code: 'coins_15_pack', coins: 15, aliases: ['coins_15_pack', 'coins-15', '15_coins', '15coins'] },
  { code: 'coins_50_pack', coins: 50, aliases: ['coins_50_pack', 'coins-50', '50_coins', '50coins'] },
]

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
}

function matchesAlias(value: string, aliases: string[]) {
  return aliases.some((alias) => value === alias || value.includes(alias))
}

function resolvePlanCode(values: string[]) {
  for (const value of values) {
    for (const [planCode, aliases] of Object.entries(PLAN_ALIASES)) {
      if (matchesAlias(value, aliases)) return planCode
    }
  }
  return null
}

function resolveCoinPack(values: string[]) {
  for (const value of values) {
    for (const pack of COIN_PACKS) {
      if (matchesAlias(value, pack.aliases)) return pack
    }
  }
  return null
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const event = await req.json()

    // RevenueCat webhook payload varies by event type.
    // Expected common fields:
    // event.type, event.app_user_id, event.entitlement_ids, event.expiration_at_ms
    const appUserId = event?.app_user_id
    if (!appUserId) {
      return new Response(JSON.stringify({ error: 'missing app_user_id' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const eventType = String(event?.type ?? '').toLowerCase()
    const identifiers = [
      ...(Array.isArray(event?.entitlement_ids) ? event.entitlement_ids : []),
      event?.product_id,
      event?.product_identifier,
    ]
      .map(normalize)
      .filter(Boolean)

    const planCode = resolvePlanCode(identifiers)
    const pack = resolveCoinPack(identifiers)
    const status = eventType.includes('expiration') ? 'expired' : 'active'
    const expiresAt = event?.expiration_at_ms
      ? new Date(Number(event.expiration_at_ms)).toISOString()
      : null
    const weeklyAllowance = planCode ? (PLAN_ALLOWANCES[planCode] ?? 0) : 0
    const nextGrantAt = status === 'active' && weeklyAllowance > 0 ? new Date().toISOString() : null

    if (pack && !eventType.includes('expiration') && !eventType.includes('cancel')) {
      const transactionId = String(
        event?.transaction_id ??
            event?.original_transaction_id ??
            event?.id ??
            `${appUserId}_${pack.code}_${event?.purchased_at_ms ?? Date.now()}`,
      )
      const { error: grantError } = await supabase.rpc('grant_user_coins', {
        p_user_id: appUserId,
        p_amount: pack.coins,
        p_reason: `pack_purchase_${pack.code}`,
        p_source_type: 'purchase',
        p_source_ref: pack.code,
        p_request_id: `revenuecat_${transactionId}`,
        p_note: 'RevenueCat coin pack purchase',
      })
      if (grantError) throw grantError
    }

    if (planCode) {
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id,status,next_coin_grant_at')
        .eq('user_id', appUserId)
        .eq('provider', 'revenuecat')
        .eq('plan_code', planCode)
        .maybeSingle()

      const { error } = await supabase
        .from('subscriptions')
        .upsert(
          {
            user_id: appUserId,
            provider: 'revenuecat',
            plan_code: planCode,
            status,
            weekly_coin_allowance: weeklyAllowance,
            next_coin_grant_at: existing?.next_coin_grant_at ?? nextGrantAt,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,provider,plan_code' }
        )

      if (error) throw error
    }

    return new Response(JSON.stringify({ ok: true, planCode, coinPack: pack?.code ?? null }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
