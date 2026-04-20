import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { requireAdminContext } from '../_shared/assert-admin.ts'
import { requireRole } from '../_shared/admin/roles.ts'
import { corsHeaders, intParam, json, readJsonBody, stringParam } from '../_shared/admin/http.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const adminContext = await requireAdminContext(req)
    if ('error' in adminContext) return adminContext.error

    const supabase = adminContext.adminClient
    const url = new URL(req.url)
    const body = await readJsonBody(req)

    if (req.method === 'POST') {
      const roleError = requireRole(adminContext.role, ['super_admin', 'operator'])
      if (roleError) return roleError
      const incidentId = stringParam(url, body, 'incident_id')
      const action = stringParam(url, body, 'action')
      if (!incidentId || !action) return json({ error: 'incident_id and action are required' }, 400)

      const nextStatus = action === 'ignore'
        ? 'ignored'
        : action === 'resolve'
            ? 'resolved'
            : action === 'reopen'
                ? 'open'
                : null

      if (!nextStatus) return json({ error: 'Unsupported action' }, 400)

      const payload: Record<string, unknown> = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      }
      payload['resolved_at'] = nextStatus === 'resolved' ? new Date().toISOString() : null

      const updateResult = await supabase
        .from('internal_incidents')
        .update(payload)
        .eq('id', incidentId)
        .select('*')
        .maybeSingle()

      if (updateResult.error) throw updateResult.error
      return json({ incident: updateResult.data })
    }

    const status = stringParam(url, body, 'status')
    const severity = stringParam(url, body, 'severity')
    const userId = stringParam(url, body, 'user_id')
    const q = stringParam(url, body, 'q')?.toLowerCase() ?? ''
    const limit = Math.min(Math.max(intParam(url, body, 'limit', 50), 1), 200)

    let query = supabase
      .from('internal_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(status || severity || userId || q ? 400 : limit)

    if (status) query = query.eq('status', status)
    if (severity) query = query.eq('severity', severity)
    if (userId) query = query.eq('user_id', userId)

    const incidentsResult = await query
    if (incidentsResult.error) throw incidentsResult.error

    const rows = (incidentsResult.data ?? []).filter((row) => {
      if (!q) return true
      return [
        row.incident_type ?? '',
        row.message ?? '',
        row.user_id ?? '',
        row.event_key ?? '',
      ].join(' ').toLowerCase().includes(q)
    }).slice(0, limit)

    return json({ incidents: rows })
  } catch (error) {
    return json({ error: String(error) }, 400)
  }
})
