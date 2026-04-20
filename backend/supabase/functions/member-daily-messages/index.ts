import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

import {
  cleanupExpiredDailyMessages,
  ensureTodayDailyMessage,
  listVisibleDailyMessages,
} from '../_shared/member-daily-message.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser()

    if (authErr || !user) return json({ error: 'Invalid or expired token' }, 401)

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const action = String((body as Record<string, unknown>)?.action ?? 'list')

    await cleanupExpiredDailyMessages(supabase as never)

    if (action === 'toggle_favorite' || action === 'mark_read') {
      const messageId = String((body as Record<string, unknown>)?.message_id ?? '').trim()
      if (!messageId) return json({ error: 'message_id is required' }, 400)

      const payload =
        action === 'toggle_favorite'
          ? {
              is_favorited: Boolean((body as Record<string, unknown>)?.favorite ?? false),
              updated_at: new Date().toISOString(),
            }
          : {
              is_read: Boolean((body as Record<string, unknown>)?.read ?? true),
              updated_at: new Date().toISOString(),
            }

      const { error } = await supabase
        .from('member_daily_messages')
        .update(payload)
        .eq('id', messageId)
        .eq('user_id', user.id)

      if (error) throw error
    }

    await ensureTodayDailyMessage(supabase as never, user.id)
    const messages = await listVisibleDailyMessages(supabase as never, user.id)

    return json({
      ok: true,
      messages,
    })
  } catch (error) {
    return json({ error: String(error) }, 400)
  }
})
