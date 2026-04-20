import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { requireAdminContext } from '../_shared/assert-admin.ts'

serve(async (req) => {
  try {
    const adminContext = await requireAdminContext(req)
    if ('error' in adminContext) return adminContext.error
    const supabase = adminContext.adminClient
    const adminUserId = adminContext.user.id

    const body = await req.json()
    const id = String(body?.id ?? '')
    const answerText = String(body?.answer_text ?? '').trim()

    if (!id || !answerText) {
      return new Response(JSON.stringify({ error: 'id and answer_text are required' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('master_questions')
      .update({
        answer_text: answerText,
        status: 'delivered',
        delivered_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select('id,user_id,status,delivered_at')
      .single()

    if (error) throw error

    await supabase.from('master_events').insert({
      question_id: id,
      event_type: 'delivered',
      payload_json: { delivered_at: now, by_admin_user_id: adminUserId },
    })

    // TODO: push notification / email send hook

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
