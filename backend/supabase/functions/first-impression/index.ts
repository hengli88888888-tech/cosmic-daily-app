import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import {
  computeFirstImpression,
  type StoredChart,
  type StoredProfile,
} from '../_shared/first-impression-engine.ts'
import { ensurePublicUserRow } from '../_shared/ensure-public-user.ts'
import { openInternalIncident, resolveInternalIncident } from '../_shared/system-incidents.ts'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser()

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    await ensurePublicUserRow(supabase, user)
    const [profileResult, chartResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id,gender,age_band,birthplace,timezone,intent,language,created_at,updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('bazi_charts')
        .select('chart_text,pillars,analysis')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (profileResult.error) throw profileResult.error
    if (chartResult.error) throw chartResult.error

    const profile = (profileResult.data as StoredProfile | null) ?? null
    const chart = (chartResult.data as StoredChart | null) ?? null
    const result = computeFirstImpression(profile, chart)

    if (!result.ready || !result.response) {
      const eventKey = result.state === 'needs_profile_rebuild'
        ? `legacy_fallback_profile:${user.id}`
        : `first_impression_not_ready:${user.id}`
      await openInternalIncident(supabase, {
        eventKey,
        incidentType: result.state === 'needs_profile_rebuild'
          ? 'legacy_fallback_profile'
          : 'first_impression_not_ready',
        userId: user.id,
        severity: result.state === 'needs_profile_rebuild' ? 'warning' : 'info',
        message: result.block?.title ?? 'First impression is not ready.',
        payload: {
          state: result.state,
          issues: result.issues,
          render_source: result.renderSource,
        },
      })

      return new Response(JSON.stringify({
        ready: false,
        state: result.state,
        renderSource: result.renderSource,
        issues: result.issues,
        title: result.block?.title,
        body: result.block?.body,
        ctaLabel: result.block?.ctaLabel,
        ctaRoute: result.block?.ctaRoute,
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    await Promise.all([
      resolveInternalIncident(supabase, `first_impression_not_ready:${user.id}`),
      resolveInternalIncident(supabase, `legacy_fallback_profile:${user.id}`),
    ])

    return new Response(JSON.stringify({
      ready: true,
      state: result.state,
      renderSource: result.renderSource,
      ...result.response,
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
