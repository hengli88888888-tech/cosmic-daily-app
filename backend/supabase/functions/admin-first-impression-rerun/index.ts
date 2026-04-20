import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { requireAdminContext } from '../_shared/assert-admin.ts'
import { requireRole } from '../_shared/admin/roles.ts'
import { corsHeaders, json, readJsonBody, stringParam } from '../_shared/admin/http.ts'
import { computeFirstImpression, type StoredChart, type StoredProfile } from '../_shared/first-impression-engine.ts'
import { openInternalIncident, resolveInternalIncident } from '../_shared/system-incidents.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const adminContext = await requireAdminContext(req)
    if ('error' in adminContext) return adminContext.error
    const roleError = requireRole(adminContext.role, ['super_admin', 'operator'])
    if (roleError) return roleError

    const supabase = adminContext.adminClient
    const url = new URL(req.url)
    const body = await readJsonBody(req)
    const userId = stringParam(url, body, 'user_id')
    if (!userId) return json({ error: 'user_id is required' }, 400)

    const [profileResult, chartResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('bazi_charts').select('*').eq('user_id', userId).maybeSingle(),
    ])

    if (profileResult.error) throw profileResult.error
    if (chartResult.error) throw chartResult.error

    const profile = (profileResult.data as StoredProfile | null) ?? null
    const chart = (chartResult.data as StoredChart | null) ?? null
    const result = computeFirstImpression(profile, chart)

    if (result.ready) {
      await Promise.all([
        resolveInternalIncident(supabase, `first_impression_not_ready:${userId}`),
        resolveInternalIncident(supabase, `legacy_fallback_profile:${userId}`),
      ])
    } else {
      await openInternalIncident(supabase, {
        eventKey: `first_impression_not_ready:${userId}`,
        incidentType: 'first_impression_not_ready',
        userId,
        severity: 'warning',
        message: 'First impression rerun is still not ready.',
        payloadJson: {
          issues: result.issues,
          render_source: result.renderSource,
          triggered_by_admin_user_id: adminContext.user.id,
        },
      })
    }

    return json({
      user_id: userId,
      rerun_by: adminContext.user.id,
      firstImpression: result,
    })
  } catch (error) {
    return json({ error: String(error) }, 400)
  }
})
