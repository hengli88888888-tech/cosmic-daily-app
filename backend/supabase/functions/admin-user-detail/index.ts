import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { requireAdminContext } from '../_shared/assert-admin.ts'
import { corsHeaders, json, readJsonBody, stringParam } from '../_shared/admin/http.ts'

function serializeError(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const adminContext = await requireAdminContext(req)
    if ('error' in adminContext) return adminContext.error

    const supabase = adminContext.adminClient
    const url = new URL(req.url)
    const body = await readJsonBody(req)
    const userId = stringParam(url, body, 'user_id')
    if (!userId) return json({ error: 'user_id is required' }, 400)

    const [publicUserResult, authUsersResult, profileResult, chartResult, walletResult, subscriptionsResult, messagesResult, incidentsResult, questionsResult, shareResult, ledgerResult] = await Promise.all([
      supabase.from('users').select('id,email,created_at').eq('id', userId).maybeSingle(),
      supabase.auth.admin.listUsers({ page: 1, perPage: 200 }),
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('bazi_charts').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('coin_wallets').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('member_daily_messages').select('*').eq('user_id', userId).order('message_date', { ascending: false }).limit(20),
      supabase.from('internal_incidents').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('master_questions').select('id,parent_question_id,question_text,divination_system,divination_profile,question_kind,coin_cost,status,created_at,updated_at,delivered_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      supabase.from('share_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('coin_ledger').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    ])

    if (publicUserResult.error) throw publicUserResult.error
    if (authUsersResult.error) throw authUsersResult.error
    if (profileResult.error) throw profileResult.error
    if (chartResult.error) throw chartResult.error
    if (walletResult.error) throw walletResult.error
    if (subscriptionsResult.error) throw subscriptionsResult.error
    if (messagesResult.error) throw messagesResult.error
    if (incidentsResult.error) throw incidentsResult.error
    if (questionsResult.error) throw questionsResult.error
    if (shareResult.error) throw shareResult.error
    if (ledgerResult.error) throw ledgerResult.error

    const authUserRow = authUsersResult.data.users.find((row) => row.id === userId)
    const userRow = publicUserResult.data ?? (authUserRow
      ? {
          id: authUserRow.id,
          email: authUserRow.email ?? null,
          created_at: authUserRow.created_at ?? null,
        }
      : null)

    return json({
      user: userRow,
      profile: profileResult.data,
      chart: chartResult.data,
      wallet: walletResult.data,
      subscriptions: subscriptionsResult.data ?? [],
      memberMessages: messagesResult.data ?? [],
      incidents: incidentsResult.data ?? [],
      recentQuestions: questionsResult.data ?? [],
      shareEvents: shareResult.data ?? [],
      coinLedger: ledgerResult.data ?? [],
    })
  } catch (error) {
    console.error('admin-user-detail failed', error)
    return json({ error: serializeError(error) }, 400)
  }
})
