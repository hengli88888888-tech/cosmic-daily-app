import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { requireAdminContext } from '../_shared/assert-admin.ts'
import { buildBaziAuditView } from '../_shared/bazi-audit-view.ts'
import type { CurrentFlow } from '../_shared/chart-engine.ts'
import {
  computeFirstImpression,
  type StoredChart,
  type StoredProfile,
} from '../_shared/first-impression-engine.ts'

serve(async (req) => {
  try {
    const adminContext = await requireAdminContext(req)
    if (adminContext.error) return adminContext.error

    const url = new URL(req.url)
    let requestBody: Record<string, unknown> = {}
    if (req.method !== 'GET') {
      try {
        requestBody = (await req.json()) as Record<string, unknown>
      } catch (_) {
        requestBody = {}
      }
    }

    const requestedUserId = typeof requestBody['user_id'] === 'string'
      ? requestBody['user_id']
      : null
    const userId = requestedUserId ?? url.searchParams.get('user_id') ?? adminContext.user.id

    const [profileResult, chartResult, incidentResult] = await Promise.all([
      adminContext.adminClient
        .from('profiles')
        .select('user_id,dob,tob,gender,age_band,birthplace,timezone,intent,language,created_at,updated_at')
        .eq('user_id', userId)
        .maybeSingle(),
      adminContext.adminClient
        .from('bazi_charts')
        .select('user_id,dob,tob,gender,age_band,birthplace,timezone,chart_text,pillars,analysis,created_at,updated_at')
        .eq('user_id', userId)
        .maybeSingle(),
      adminContext.adminClient
        .from('internal_incidents')
        .select('event_key,incident_type,severity,status,message,payload_json,created_at,updated_at,resolved_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ])

    if (profileResult.error) throw profileResult.error
    if (chartResult.error) throw chartResult.error
    if (incidentResult.error) throw incidentResult.error

    const profile = (profileResult.data as StoredProfile | null) ?? null
    const chart = (chartResult.data as StoredChart | null) ?? null
    const result = computeFirstImpression(profile, chart)
    const flow = (result.ready && typeof result.debug === 'object' && result.debug != null)
      ? (result.debug as Record<string, unknown>)['flow']
      : null
    const auditView = buildBaziAuditView(chart, {
      currentFlow: (flow as CurrentFlow | null) ?? null,
    })

    return new Response(JSON.stringify({
      userId,
      profile,
      chart: chartResult.data,
      auditView,
      incidents: incidentResult.data ?? [],
      firstImpression: result,
      frontendFallbackWouldTrigger: !result.ready,
    }), {
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
