import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

import {
  type SaveProfileInput,
  assertChartInput,
  calculateChart,
} from '../_shared/chart-engine.ts'
import { buildBaziAuditView } from '../_shared/bazi-audit-view.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function errorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }
  if (typeof error === 'object' && error !== null) {
    return error
  }
  return { message: String(error) }
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser()

    if (authErr || !user) return json({ error: 'Invalid or expired token' }, 401)

    const input = assertChartInput((await req.json()) as SaveProfileInput)
    const chart = await calculateChart(input, { includeComparison: true })

    return json({
      ok: true,
      source: chart.source,
      chart_text: chart.chartText,
      pillars: chart.pillars,
      analysis: chart.analysis,
      resolved_location: chart.resolvedLocation,
      current_flow: chart.currentFlow,
      audit_view: buildBaziAuditView(chart, {
        currentFlow: chart.currentFlow ?? null,
        resolvedLocation: chart.resolvedLocation,
      }),
      comparison: chart.comparison,
      raw_payload: chart.rawPayload,
    })
  } catch (error) {
    return json({ error: errorPayload(error) }, 400)
  }
})
