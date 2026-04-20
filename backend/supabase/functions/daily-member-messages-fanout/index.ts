import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

import {
  cleanupExpiredDailyMessages,
  ensureTodayDailyMessage,
} from '../_shared/member-daily-message.ts'

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    await cleanupExpiredDailyMessages(supabase as never)

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('user_id,plan_code,status')
      .eq('status', 'active')
      .limit(500)

    if (error) throw error

    const userIds = Array.from(new Set(((subscriptions as Array<Record<string, unknown>> | null) ?? []).map((item) => String(item.user_id))))
    const results = []

    for (const userId of userIds) {
      const message = await ensureTodayDailyMessage(supabase as never, userId)
      if (message != null) {
        results.push({
          user_id: userId,
          message_date: message.message_date,
          variant: message.variant,
        })
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, items: results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
