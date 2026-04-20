import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('id,user_id,plan_code,weekly_coin_allowance,next_coin_grant_at')
      .eq('status', 'active')
      .gt('weekly_coin_allowance', 0)
      .or(`next_coin_grant_at.is.null,next_coin_grant_at.lte.${now.toISOString()}`)
      .limit(200)

    if (error) throw error

    const results = []
    for (const item of subscriptions ?? []) {
      const grantAt = item.next_coin_grant_at ? new Date(item.next_coin_grant_at) : now
      const periodKey = grantAt.toISOString().slice(0, 10)
      const { data: grantResult, error: grantError } = await supabase.rpc('grant_user_coins', {
        p_user_id: item.user_id,
        p_amount: item.weekly_coin_allowance,
        p_reason: `subscription_weekly_${item.plan_code}`,
        p_source_type: 'subscription',
        p_source_ref: item.id,
        p_note: item.plan_code,
        p_metadata: { plan_code: item.plan_code, grant_period: periodKey },
        p_idempotency_key: `${item.id}:${periodKey}`,
        p_bucket: 'granted',
      })

      if (grantError) throw grantError

      await supabase
        .from('subscriptions')
        .update({
          next_coin_grant_at: new Date(grantAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      results.push({
        subscription_id: item.id,
        user_id: item.user_id,
        plan_code: item.plan_code,
        grant_result: grantResult,
      })
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, items: results }), {
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
