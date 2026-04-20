import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { requireAdminContext } from '../_shared/assert-admin.ts'
import { corsHeaders, json } from '../_shared/admin/http.ts'

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
    const todayIso = new Date().toISOString()

    const [
      usersToday,
      totalUsers,
      activeSubscriptions,
      openIncidents,
      chartsResult,
      coinWallets,
      questionsToday,
      messagesToday,
    ] = await Promise.all([
      supabase.from('users').select('id', { head: true, count: 'exact' }).gte('created_at', todayIso.slice(0, 10)),
      supabase.from('users').select('id', { head: true, count: 'exact' }),
      supabase.from('subscriptions').select('id', { head: true, count: 'exact' }).eq('status', 'active'),
      supabase.from('internal_incidents').select('id', { head: true, count: 'exact' }).eq('status', 'open'),
      supabase.from('bazi_charts').select('user_id,analysis'),
      supabase.from('coin_wallets').select('balance,spent_total,purchased_total,granted_total,bonus_total'),
      supabase
        .from('master_questions')
        .select('id', { head: true, count: 'exact' })
        .gte('created_at', todayIso.slice(0, 10)),
      supabase
        .from('member_daily_messages')
        .select('id', { head: true, count: 'exact' })
        .eq('message_date', todayIso.slice(0, 10)),
    ])

    if (usersToday.error) throw usersToday.error
    if (totalUsers.error) throw totalUsers.error
    if (activeSubscriptions.error) throw activeSubscriptions.error
    if (openIncidents.error) throw openIncidents.error
    if (chartsResult.error) throw chartsResult.error
    if (coinWallets.error) throw coinWallets.error
    if (questionsToday.error) throw questionsToday.error
    if (messagesToday.error) throw messagesToday.error

    const walletRows = coinWallets.data ?? []
    const chartRows = chartsResult.data ?? []
    const totals = walletRows.reduce(
      (acc, row) => ({
        balance: acc.balance + Number(row.balance ?? 0),
        spent: acc.spent + Number(row.spent_total ?? 0),
        purchased: acc.purchased + Number(row.purchased_total ?? 0),
        granted: acc.granted + Number(row.granted_total ?? 0),
        bonus: acc.bonus + Number(row.bonus_total ?? 0),
      }),
      { balance: 0, spent: 0, purchased: 0, granted: 0, bonus: 0 },
    )

    const chartCount = chartRows.length
    const verifiedCount = chartRows.filter((row) => {
      const source = String(row.analysis?.source ?? '').trim()
      return source === 'verified_engine'
    }).length
    const fallbackCount = chartRows.filter((row) => {
      const source = String(row.analysis?.source ?? '').trim()
      const notes = ((row.analysis?.notes as string[] | undefined) ?? []).map((item) => String(item))
      return source === 'fallback' || notes.some((item) => item.includes('fallback_chart_generated'))
    }).length
    const firstImpressionSuccessRate = chartCount === 0
      ? 0
      : Number(((verifiedCount / chartCount) * 100).toFixed(1))

    return json({
      currentAdmin: {
        user_id: adminContext.user.id,
        role: adminContext.role,
      },
      metrics: {
        usersToday: usersToday.count ?? 0,
        totalUsers: totalUsers.count ?? 0,
        activeSubscriptions: activeSubscriptions.count ?? 0,
        openIncidents: openIncidents.count ?? 0,
        fallbackProfiles: fallbackCount,
        totalCharts: chartCount,
        verifiedCharts: verifiedCount,
        firstImpressionSuccessRate,
        questionsToday: questionsToday.count ?? 0,
        memberMessagesToday: messagesToday.count ?? 0,
      },
      coins: totals,
    })
  } catch (error) {
    console.error('admin-dashboard failed', error)
    return json({ error: serializeError(error) }, 400)
  }
})
