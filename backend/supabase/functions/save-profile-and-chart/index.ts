import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { DateTime } from 'npm:luxon@3.5.0'
import {
  type SaveProfileInput,
  assertChartInput,
  calculateChart,
  cleanString,
} from '../_shared/chart-engine.ts'
import { ensurePublicUserRow } from '../_shared/ensure-public-user.ts'
import { computeFirstImpression } from '../_shared/first-impression-engine.ts'
import { openInternalIncident, resolveInternalIncident } from '../_shared/system-incidents.ts'

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
  if (typeof error === 'object' && error !== null) return error
  return { message: String(error) }
}

function roundCoordinate(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 10000) / 10000
}

function deriveAgeBand(dob: string) {
  const birth = DateTime.fromISO(dob, { zone: 'utc' })
  if (!birth.isValid) return null
  const age = Math.max(0, Math.floor(DateTime.utc().diff(birth, 'years').years))
  if (age < 25) return '18_24'
  if (age < 35) return '25_34'
  if (age < 45) return '35_44'
  if (age < 55) return '45_54'
  return '55_plus'
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    await ensurePublicUserRow(adminClient, user)
    const input = assertChartInput((await req.json()) as SaveProfileInput)
    let chart
    try {
      chart = await calculateChart(input, {
        cacheClient: adminClient,
        includeComparison: false,
      })
    } catch (error) {
      await openInternalIncident(adminClient, {
        eventKey: `chart_generation_failed:${user.id}`,
        incidentType: 'chart_generation_failed',
        userId: user.id,
        severity: 'error',
        message: 'Verified chart generation failed during profile setup.',
        payload: {
          birthplace: input.birthplace,
          timezone: input.timezone,
          gender: cleanString(input.gender),
          language: input.language,
          intent: input.intent,
          error: errorPayload(error),
        },
      })
      throw error
    }

    if (chart.source !== 'verified_engine') {
      await openInternalIncident(adminClient, {
        eventKey: `chart_generation_failed:${user.id}`,
        incidentType: 'chart_generation_failed',
        userId: user.id,
        severity: 'error',
        message: 'Chart generation produced a fallback chart instead of a verified chart.',
        payload: {
          birthplace: input.birthplace,
          timezone: input.timezone,
          chart_source: chart.source,
          notes: chart.analysis.notes,
        },
      })
      return json({
        error: {
          message: 'Unable to generate a verified chart for this birth profile.',
          reason: chart.analysis.notes,
          chart_status: 'needs_profile_rebuild',
        },
      }, 400)
    }

    const impression = computeFirstImpression(null, {
      source: chart.source,
      chart_text: chart.chartText,
      pillars: chart.pillars,
      analysis: chart.analysis,
    })
    if (!impression.ready || impression.state !== 'verified_ready') {
      await openInternalIncident(adminClient, {
        eventKey: `chart_generation_failed:${user.id}`,
        incidentType: 'chart_generation_failed',
        userId: user.id,
        severity: 'error',
        message: 'Verified chart did not include the data required for first impression generation.',
        payload: {
          birthplace: input.birthplace,
          timezone: input.timezone,
          chart_source: chart.source,
          chart_status: impression.state,
          issues: impression.issues,
          render_source: impression.renderSource,
        },
      })
      return json({
        error: {
          message: 'Your profile could not be completed because the chart is still missing key reading signals.',
          reason: impression.issues,
          chart_status: impression.state,
        },
      }, 400)
    }

    const now = new Date().toISOString()
    const ageBand = deriveAgeBand(input.dob)
    const { error: profileError } = await adminClient.from('profiles').upsert(
      {
        user_id: user.id,
        dob: null,
        tob: null,
        gender: cleanString(input.gender),
        age_band: ageBand,
        birthplace: chart.resolvedLocation.normalizedName,
        birthplace_latitude: roundCoordinate(chart.resolvedLocation.latitude),
        birthplace_longitude: roundCoordinate(chart.resolvedLocation.longitude),
        timezone: chart.resolvedLocation.timezone,
        intent: input.intent,
        language: input.language,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    if (profileError) throw profileError

    const { error: chartError } = await adminClient.from('bazi_charts').upsert(
      {
        user_id: user.id,
        dob: null,
        tob: null,
        gender: cleanString(input.gender),
        age_band: ageBand,
        birthplace: chart.resolvedLocation.normalizedName,
        birthplace_latitude: roundCoordinate(chart.resolvedLocation.latitude),
        birthplace_longitude: roundCoordinate(chart.resolvedLocation.longitude),
        timezone: chart.resolvedLocation.timezone,
        chart_text: chart.chartText,
        pillars: chart.pillars,
        analysis: chart.analysis,
        raw_payload: null,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    if (chartError) throw chartError

    await adminClient.rpc('grant_user_coins', {
      p_user_id: user.id,
      p_amount: 6,
      p_reason: 'signup_bonus',
      p_source_type: 'bonus',
      p_source_ref: user.id,
      p_note: 'Welcome bonus',
      p_metadata: { trigger: 'save_profile_and_chart' },
      p_idempotency_key: `signup_bonus:${user.id}`,
      p_bucket: 'bonus',
    })

    await Promise.all([
      resolveInternalIncident(adminClient, `chart_generation_failed:${user.id}`),
      resolveInternalIncident(adminClient, `first_impression_not_ready:${user.id}`),
      resolveInternalIncident(adminClient, `legacy_fallback_profile:${user.id}`),
    ])

    return json({
      ok: true,
      user_id: user.id,
      chart_ready: true,
      verified_ready: true,
      chart_status: 'verified_ready',
      privacy_mode: 'minimal_retention',
      chart_source: chart.source,
    })
  } catch (error) {
    return json({ error: errorPayload(error) }, 400)
  }
})
