import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

import { ensurePublicUserRow } from '../_shared/ensure-public-user.ts'

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function cleanText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (user) {
      await ensurePublicUserRow(adminClient, user)
    }

    const body = await req.json() as Record<string, unknown>
    const functionName = cleanText(body.function_name) ?? 'unknown_function'
    const screen = cleanText(body.screen)
    const message = cleanText(body.message) ?? 'Unknown client-side function failure'
    const incidentType = cleanText(body.incident_type) ?? 'client_function_failure'
    const statusCode = Number(body.status ?? 0)
    const severity =
      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warning' : 'info'

    const payload = {
      function_name: functionName,
      screen,
      status: statusCode || null,
      request_body: body.request_body ?? null,
      response_data: body.response_data ?? null,
      client_context: body.client_context ?? null,
      reported_at: new Date().toISOString(),
      source: 'mobile_app',
    }

    const { error } = await adminClient.from('internal_incidents').insert({
      event_key: crypto.randomUUID(),
      incident_type: incidentType,
      user_id: user?.id ?? null,
      severity,
      status: 'open',
      message: `${functionName} failed${statusCode ? ` (${statusCode})` : ''}: ${message}`.slice(0, 500),
      payload_json: payload,
    })

    if (error) throw error
    return json({ ok: true })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400)
  }
})
