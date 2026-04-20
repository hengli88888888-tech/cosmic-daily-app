import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { requireAdminContext } from '../_shared/assert-admin.ts'

serve(async (req) => {
  try {
    const adminContext = await requireAdminContext(req)
    if ('error' in adminContext) return adminContext.error
    const adminClient = adminContext.adminClient
    const user = adminContext.user

    const body = await req.json()
    const id = String(body?.id ?? '')
    const masterId = String(body?.assigned_master_id ?? '').trim()

    if (!id || !masterId) {
      return new Response(JSON.stringify({ error: 'id and assigned_master_id are required' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const now = new Date().toISOString()

    const { data, error } = await adminClient
      .from('master_questions')
      .update({
        assigned_master_id: masterId,
        status: 'in_review',
        updated_at: now,
      })
      .eq('id', id)
      .select('id,status,assigned_master_id,updated_at')
      .single()

    if (error) throw error

    await adminClient.from('master_events').insert({
      question_id: id,
      event_type: 'assigned',
      payload_json: { assigned_master_id: masterId, by_admin_user_id: user.id },
    })

    return new Response(JSON.stringify(data), {
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
