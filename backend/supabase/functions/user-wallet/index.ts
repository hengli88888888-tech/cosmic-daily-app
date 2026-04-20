import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SHOP_PACKS = [
  { coins: 5, priceUsd: 2.99 },
  { coins: 15, priceUsd: 6.99 },
  { coins: 50, priceUsd: 19.99 },
]
const FIRST_SHARE_REWARD_COINS = 5

const PLAN_CATALOG: Record<string, { label: string; weeklyCoins: number; priceUsd: number; cadence: 'monthly' | 'yearly' }> = {
  basic_monthly: { label: 'Basic', weeklyCoins: 20, priceUsd: 7.99, cadence: 'monthly' },
  pro_monthly: { label: 'Advanced', weeklyCoins: 70, priceUsd: 19.99, cadence: 'monthly' },
  pro_yearly: { label: 'Advanced Yearly', weeklyCoins: 70, priceUsd: 199.0, cadence: 'yearly' },
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

    const [
      { data: wallet },
      { data: subscriptions },
      { data: ledger },
      { count: rootQuestionCount },
      { count: shareCount },
      { data: rewardedShare },
    ] = await Promise.all([
      supabase.from('coin_wallets').select('balance,granted_total,purchased_total,bonus_total,spent_total').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('subscriptions')
        .select('plan_code,status,weekly_coin_allowance,next_coin_grant_at,expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      supabase
        .from('coin_ledger')
        .select('delta,balance_after,source_type,reason,note,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('master_questions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('parent_question_id', null),
      supabase
        .from('share_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('share_events')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('rewarded', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    const activePlans = (subscriptions ?? []).map((item) => ({
      plan_code: item.plan_code,
      label: PLAN_CATALOG[item.plan_code]?.label ?? item.plan_code,
      weekly_coins: item.weekly_coin_allowance,
      next_coin_grant_at: item.next_coin_grant_at,
      expires_at: item.expires_at,
    }))

    return new Response(JSON.stringify({
      balance: wallet?.balance ?? 0,
      totals: {
        granted: wallet?.granted_total ?? 0,
        purchased: wallet?.purchased_total ?? 0,
        bonus: wallet?.bonus_total ?? 0,
        spent: wallet?.spent_total ?? 0,
      },
      costs: {
        deep: 5,
        quick: 2,
        followup: 1,
      },
      shareBonus: {
        rewardCoins: FIRST_SHARE_REWARD_COINS,
        firstShareRewardClaimed: rewardedShare != null,
        firstShareRewardClaimedAt: rewardedShare?.created_at ?? null,
        totalShares: shareCount ?? 0,
      },
      freeFirstQuestionAvailable: (rootQuestionCount ?? 0) === 0,
      activePlans,
      planCatalog: PLAN_CATALOG,
      shopPacks: SHOP_PACKS,
      recentActivity: ledger ?? [],
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
