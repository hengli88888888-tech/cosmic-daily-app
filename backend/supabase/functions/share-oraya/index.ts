import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const FIRST_SHARE_REWARD_COINS = 5
const FIRST_SHARE_IDEMPOTENCY_PREFIX = 'share-first-bonus'

function cleanString(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 ? text : null
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    const channel = cleanString(body.channel)
    const targetHint = cleanString(body.target_hint)
    const shareResult = cleanString(body.share_result)
    const requestId = cleanString(body.request_id) ?? crypto.randomUUID()

    const { data: existingReward } = await supabase
      .from('share_events')
      .select('id,created_at')
      .eq('user_id', user.id)
      .eq('rewarded', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    let rewarded = false
    let balanceAfter: number | null = null

    if (!existingReward) {
      const { data: grantResult, error: grantError } = await supabase.rpc('grant_user_coins', {
        p_user_id: user.id,
        p_amount: FIRST_SHARE_REWARD_COINS,
        p_reason: 'first_share_bonus',
        p_source_type: 'share_reward',
        p_source_ref: channel,
        p_note: 'oraya_share',
        p_metadata: {
          channel,
          target_hint: targetHint,
          share_result: shareResult,
        },
        p_idempotency_key: `${FIRST_SHARE_IDEMPOTENCY_PREFIX}:${user.id}`,
        p_bucket: 'bonus',
      })

      if (grantError) throw grantError

      const grant = grantResult as { ok?: boolean; balance_after?: number }
      rewarded = grant?.ok === true
      balanceAfter = grant?.balance_after ?? null
    }

    const { error: insertError } = await supabase
      .from('share_events')
      .insert({
        user_id: user.id,
        channel,
        target_hint: targetHint,
        share_result: shareResult,
        rewarded,
        reward_delta: rewarded ? FIRST_SHARE_REWARD_COINS : 0,
        metadata: {
          request_id: requestId,
          channel,
          target_hint: targetHint,
          share_result: shareResult,
        },
      })

    if (insertError) throw insertError

    if (balanceAfter == null) {
      const { data: wallet } = await supabase
        .from('coin_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle()
      balanceAfter = wallet?.balance ?? 0
    }

    const { count: shareCount } = await supabase
      .from('share_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return new Response(JSON.stringify({
      rewarded,
      reward_coins: rewarded ? FIRST_SHARE_REWARD_COINS : 0,
      balance_after: balanceAfter,
      total_shares: shareCount ?? 0,
      first_share_reward_claimed: true,
    }), {
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
