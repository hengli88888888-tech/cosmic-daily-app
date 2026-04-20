import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const nowIso = new Date().toISOString()

    const { data: breached, error: qErr } = await supabase
      .from('master_questions')
      .select('id,user_id,sla_deadline_at,status')
      .in('status', ['paid', 'queued', 'in_review', 'sla_risk'])
      .lt('sla_deadline_at', nowIso)

    if (qErr) throw qErr

    if (!breached || breached.length === 0) {
      return new Response(JSON.stringify({ updated: 0 }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    for (const row of breached) {
      await supabase
        .from('master_questions')
        .update({ status: 'sla_breached', compensation_type: 'partial_refund', updated_at: nowIso })
        .eq('id', row.id)

      await supabase.from('master_events').insert({
        question_id: row.id,
        event_type: 'sla_breached',
        payload_json: { compensation_type: 'partial_refund' },
      })
    }

    return new Response(JSON.stringify({ updated: breached.length }), {
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
