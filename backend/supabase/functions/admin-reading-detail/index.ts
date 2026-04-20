import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { requireAdminContext } from '../_shared/assert-admin.ts'
import { corsHeaders, json, readJsonBody, stringParam } from '../_shared/admin/http.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const adminContext = await requireAdminContext(req)
    if ('error' in adminContext) return adminContext.error

    const supabase = adminContext.adminClient
    const url = new URL(req.url)
    const body = await readJsonBody(req)
    const threadId = stringParam(url, body, 'thread_id')
    if (!threadId) return json({ error: 'thread_id is required' }, 400)

    const rootResult = await supabase
      .from('master_questions')
      .select('*')
      .eq('id', threadId)
      .maybeSingle()
    if (rootResult.error) throw rootResult.error
    if (!rootResult.data) return json({ error: 'Thread not found' }, 404)

    const userId = rootResult.data.user_id as string

    const [questionsResult, userResult, chartResult] = await Promise.all([
      supabase
        .from('master_questions')
        .select('*')
        .or(`id.eq.${threadId},parent_question_id.eq.${threadId}`)
        .order('created_at', { ascending: true }),
      supabase.from('users').select('id,email,created_at').eq('id', userId).maybeSingle(),
      supabase.from('bazi_charts').select('chart_text,analysis').eq('user_id', userId).maybeSingle(),
    ])

    if (questionsResult.error) throw questionsResult.error

    const questionIds = (questionsResult.data ?? []).map((item) => item.id)
    const refreshedEventsResult = questionIds.length === 0
      ? { data: [] as unknown[] }
      : await supabase
          .from('master_events')
          .select('*')
          .in('question_id', questionIds)
          .order('created_at', { ascending: true })

    if ('error' in refreshedEventsResult && refreshedEventsResult.error) throw refreshedEventsResult.error
    if (userResult.error) throw userResult.error
    if (chartResult.error) throw chartResult.error

    return json({
      thread: rootResult.data,
      user: userResult.data,
      chart: chartResult.data,
      questions: questionsResult.data ?? [],
      events: refreshedEventsResult.data ?? [],
    })
  } catch (error) {
    return json({ error: String(error) }, 400)
  }
})
