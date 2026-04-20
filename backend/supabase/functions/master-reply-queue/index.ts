import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { requireAdminContext } from '../_shared/assert-admin.ts'

serve(async (req) => {
  try {
    const adminContext = await requireAdminContext(req)
    if ('error' in adminContext) return adminContext.error
    const supabase = adminContext.adminClient

    const { data, error } = await supabase
      .from('master_questions')
      .select('id,user_id,category,priority,status,created_at,sla_deadline_at')
      .in('status', ['paid', 'queued', 'in_review', 'sla_risk'])
      .order('sla_deadline_at', { ascending: true })
      .limit(100)

    if (error) throw error

    return new Response(JSON.stringify({ items: data ?? [] }), {
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
