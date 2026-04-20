import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { requireAdminContext } from '../_shared/assert-admin.ts'
import { corsHeaders, intParam, json, readJsonBody, stringParam } from '../_shared/admin/http.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const adminContext = await requireAdminContext(req)
    if ('error' in adminContext) return adminContext.error

    const supabase = adminContext.adminClient
    const url = new URL(req.url)
    const body = await readJsonBody(req)
    const limit = Math.min(Math.max(intParam(url, body, 'limit', 50), 1), 100)
    const q = stringParam(url, body, 'q')?.toLowerCase() ?? ''
    const system = stringParam(url, body, 'divination_system')

    let query = supabase
      .from('master_questions')
      .select('id,user_id,question_text,divination_system,divination_profile,question_kind,coin_cost,status,category,answer_text,created_at,updated_at,delivered_at')
      .is('parent_question_id', null)
      .order('created_at', { ascending: false })
      .limit(system || q ? 300 : limit)

    if (system) query = query.eq('divination_system', system)

    const rowsResult = await query
    if (rowsResult.error) throw rowsResult.error

    const filteredRows = (rowsResult.data ?? []).filter((row) => {
      if (!q) return true
      return [row.question_text, row.user_id, row.category ?? '', row.divination_system]
        .join(' ')
        .toLowerCase()
        .includes(q)
    }).slice(0, limit)

    const userIds = Array.from(new Set(filteredRows.map((row) => row.user_id)))
    const usersResult = userIds.length === 0
      ? { data: [] as Array<{ id: string; email: string | null }> }
      : await supabase.from('users').select('id,email').in('id', userIds)

    if ('error' in usersResult && usersResult.error) throw usersResult.error

    const userById = new Map((usersResult.data ?? []).map((row) => [row.id, row]))

    return json({
      threads: filteredRows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        email: userById.get(row.user_id)?.email ?? null,
        question_text: row.question_text,
        divination_system: row.divination_system,
        divination_profile: row.divination_profile,
        question_kind: row.question_kind,
        coin_cost: row.coin_cost,
        category: row.category,
        status: row.status,
        has_answer: Boolean(row.answer_text),
        created_at: row.created_at,
        updated_at: row.updated_at,
        delivered_at: row.delivered_at,
      })),
    })
  } catch (error) {
    return json({ error: String(error) }, 400)
  }
})
