import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { requireAdminContext } from '../_shared/assert-admin.ts'
import { cleanString, corsHeaders, intParam, json, readJsonBody, stringParam } from '../_shared/admin/http.ts'

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
    const query = stringParam(url, body, 'q')?.toLowerCase() ?? ''
    const limit = Math.min(Math.max(intParam(url, body, 'limit', 30), 1), 100)

    const publicUsersResult = await supabase
      .from('users')
      .select('id,email,created_at')
      .order('created_at', { ascending: false })
      .limit(query ? 300 : limit)

    if (publicUsersResult.error) throw publicUsersResult.error

    const authUsersResult = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: query ? 300 : limit,
    })
    if (authUsersResult.error) throw authUsersResult.error

    const mergedUsers = new Map<string, { id: string; email: string | null; created_at: string }>()
    for (const row of authUsersResult.data.users ?? []) {
      mergedUsers.set(row.id, {
        id: row.id,
        email: row.email ?? null,
        created_at: row.created_at ?? '',
      })
    }
    for (const row of publicUsersResult.data ?? []) {
      mergedUsers.set(row.id, {
        id: row.id,
        email: row.email ?? mergedUsers.get(row.id)?.email ?? null,
        created_at: row.created_at ?? mergedUsers.get(row.id)?.created_at ?? '',
      })
    }

    const filteredUsers = Array.from(mergedUsers.values()).filter((row) => {
      if (!query) return true
      const haystack = [
        row.id,
        row.email ?? '',
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    }).slice(0, query ? 300 : limit)

    const userIds = filteredUsers.map((row) => row.id)
    if (userIds.length === 0) {
      return json({ users: [] })
    }

    const [profiles, charts, wallets, subscriptions, incidents] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id,gender,birthplace,timezone,updated_at')
        .in('user_id', userIds),
      supabase
        .from('bazi_charts')
        .select('user_id,chart_text,analysis,updated_at')
        .in('user_id', userIds),
      supabase
        .from('coin_wallets')
        .select('user_id,balance')
        .in('user_id', userIds),
      supabase
        .from('subscriptions')
        .select('user_id,plan_code,status,expires_at')
        .in('user_id', userIds)
        .eq('status', 'active'),
      supabase
        .from('internal_incidents')
        .select('user_id,status')
        .in('user_id', userIds)
        .eq('status', 'open'),
    ])

    if (profiles.error) throw profiles.error
    if (charts.error) throw charts.error
    if (wallets.error) throw wallets.error
    if (subscriptions.error) throw subscriptions.error
    if (incidents.error) throw incidents.error

    const profileByUser = new Map((profiles.data ?? []).map((row) => [row.user_id, row]))
    const chartByUser = new Map((charts.data ?? []).map((row) => [row.user_id, row]))
    const walletByUser = new Map((wallets.data ?? []).map((row) => [row.user_id, row]))
    const subByUser = new Map((subscriptions.data ?? []).map((row) => [row.user_id, row]))
    const incidentCounts = new Map<string, number>()
    for (const row of incidents.data ?? []) {
      incidentCounts.set(row.user_id, (incidentCounts.get(row.user_id) ?? 0) + 1)
    }

    const results = filteredUsers.map((user) => {
      const profile = profileByUser.get(user.id)
      const chart = chartByUser.get(user.id)
      const wallet = walletByUser.get(user.id)
      const subscription = subByUser.get(user.id)
      const source = cleanString(chart?.analysis?.source)
      const notes = ((chart?.analysis?.notes as string[] | undefined) ?? [])
      const isFallback = source === 'fallback' || notes.some((item) => String(item).includes('fallback_chart_generated'))

      const profileUpdatedAt = cleanString(profile?.updated_at)
      const chartUpdatedAt = cleanString(chart?.updated_at)
      const latestActivityAt = [chartUpdatedAt, profileUpdatedAt, cleanString(user.created_at)]
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => b.localeCompare(a))[0] ?? null

      return {
        user_id: user.id,
        email: user.email,
        created_at: user.created_at,
        profile_updated_at: profileUpdatedAt,
        chart_updated_at: chartUpdatedAt,
        latest_activity_at: latestActivityAt,
        birthplace: profile?.birthplace ?? null,
        timezone: profile?.timezone ?? null,
        balance: wallet?.balance ?? 0,
        is_admin_account: false,
        is_dev_session:
          !profile &&
          !chart &&
          !wallet &&
          !subscription &&
          !user.email,
        subscription: subscription
          ? {
              plan_code: subscription.plan_code,
              status: subscription.status,
              expires_at: subscription.expires_at,
            }
          : null,
        chart_state: chart
          ? (isFallback ? 'needs_profile_rebuild' : 'verified_ready')
          : 'preparing_profile',
        chart_source: source ?? null,
        chart_text: chart?.chart_text ?? null,
        open_incident_count: incidentCounts.get(user.id) ?? 0,
      }
    })

    results.sort((a, b) =>
      String(b.latest_activity_at ?? b.created_at).localeCompare(
        String(a.latest_activity_at ?? a.created_at),
      )
    )

    return json({ users: results.slice(0, limit) })
  } catch (error) {
    console.error('admin-users-search failed', error)
    return json({ error: serializeError(error) }, 400)
  }
})
