import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { requireAdminContext } from '../_shared/assert-admin.ts'
import { requireRole } from '../_shared/admin/roles.ts'
import { corsHeaders, intParam, json, readJsonBody, stringParam } from '../_shared/admin/http.ts'

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
    const reason = stringParam(url, body, 'reason') ?? 'admin adjustment'
    const note = stringParam(url, body, 'note')
    const amount = intParam(url, body, 'amount', 0)

    if (!userId) return json({ error: 'user_id is required' }, 400)
    if (amount <= 0) return json({ error: 'amount must be a positive integer' }, 400)

    const { data, error } = await supabase.rpc('grant_user_coins', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
      p_source_type: 'admin_manual',
      p_source_ref: adminContext.user.id,
      p_note: note,
      p_metadata: {
        admin_user_id: adminContext.user.id,
        admin_role: adminContext.role,
      },
      p_idempotency_key: `admin-adjust:${adminContext.user.id}:${userId}:${Date.now()}`,
      p_bucket: 'bonus',
    })

    if (error) throw error
    return json({ result: data })
  } catch (error) {
    return json({ error: String(error) }, 400)
  }
})
