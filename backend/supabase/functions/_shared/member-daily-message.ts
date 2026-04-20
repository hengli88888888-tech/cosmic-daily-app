import { DateTime } from 'npm:luxon@3.5.0'

import {
  type CurrentFlow,
  type ResolvedLocation,
  calculateCurrentFlowAtInstant,
  cleanString,
} from './chart-engine.ts'

type SupabaseLike = any

type StoredProfile = {
  timezone?: string | null
}

type StoredChart = {
  analysis?: {
    dayMaster?: {
      stem?: string
    }
    strongElement?: string
    weakElement?: string
    timing?: {
      timezone?: string
      location?: {
        normalizedName?: string
        country?: string | null
        region?: string | null
        latitude?: number
        longitude?: number
        source?: ResolvedLocation['source']
      }
    }
  }
}

type StoredSubscription = {
  plan_code: string
  status: string
}

export type DailyMessageRow = {
  id?: string
  user_id?: string
  message_date?: string
  timezone?: string
  membership_tier?: string
  variant?: string
  title?: string
  summary?: string
  body?: Record<string, unknown>
  is_favorited?: boolean
  is_read?: boolean
  expires_at?: string
  created_at?: string
  updated_at?: string
}

function normalizeElement(value: unknown): 'wood' | 'fire' | 'earth' | 'metal' | 'water' | null {
  const text = cleanString(value)?.toLowerCase()
  if (!text) return null
  if (text.includes('wood')) return 'wood'
  if (text.includes('fire')) return 'fire'
  if (text.includes('earth')) return 'earth'
  if (text.includes('metal')) return 'metal'
  if (text.includes('water')) return 'water'
  return null
}

function elementMessage(element: ReturnType<typeof normalizeElement>) {
  switch (element) {
    case 'wood':
      return 'growth, movement, and direction are easier to feel than to ignore'
    case 'fire':
      return 'visibility, emotion, and speed are all turned up'
    case 'earth':
      return 'stability, responsibility, and practical choices matter most'
    case 'metal':
      return 'clear judgment, standards, and sharper choices are the real leverage'
    case 'water':
      return 'timing, intuition, and reading the undercurrent matter more than force'
    default:
      return 'the atmosphere is asking for pacing and clean prioritization'
  }
}

function chooseTier(subscriptions: StoredSubscription[]) {
  const active = subscriptions.filter((item) => item.status === 'active')
  if (active.some((item) => String(item.plan_code).startsWith('pro_'))) {
    return { tier: 'advanced', variant: 'deep' }
  }
  if (active.some((item) => String(item.plan_code).startsWith('basic_'))) {
    return { tier: 'basic', variant: 'brief' }
  }
  return null
}

function buildResolvedLocation(chart: StoredChart | null, profile: StoredProfile | null) {
  const timing = chart?.analysis?.timing
  const dayStem = cleanString(chart?.analysis?.dayMaster?.stem)
  const timezone = cleanString(timing?.timezone) ?? cleanString(profile?.timezone)
  const location = timing?.location
  const latitude = typeof location?.latitude === 'number' ? location.latitude : null
  const longitude = typeof location?.longitude === 'number' ? location.longitude : null

  if (!dayStem || !timezone || latitude == null || longitude == null) {
    return null
  }

  return {
    location: {
      queryKey: '',
      normalizedName: cleanString(location?.normalizedName) ?? 'Saved birth place',
      country: cleanString(location?.country),
      region: cleanString(location?.region),
      latitude,
      longitude,
      timezone,
      source: location?.source ?? 'input',
    } satisfies ResolvedLocation,
    dayStem,
  }
}

function buildDailyMessagePayload(
  flow: CurrentFlow,
  tier: 'basic' | 'advanced',
  chart: StoredChart | null,
) {
  const weak = normalizeElement(chart?.analysis?.weakElement)
  const strong = normalizeElement(chart?.analysis?.strongElement)
  const title = tier === 'advanced'
    ? 'Today’s deeper pattern'
    : 'Today’s quick signal'
  const summary = tier === 'advanced'
    ? `Today is more about ${elementMessage(flow.liuYue.element)}. The short-term trigger sits in ${flow.liuRi.pillar}, so pace matters as much as confidence.`
    : `Today leans toward ${elementMessage(flow.liuYue.element)}. Keep your moves simple and well-timed.`

  const body: Record<string, unknown> = {
    headline: summary,
    focus: `Current monthly tone: ${flow.liuYue.pillar}. Daily trigger: ${flow.liuRi.pillar}.`,
    caution: weak == null
      ? 'Do not force speed just because the day feels loud.'
      : `Watch the weaker side of your pattern: ${elementMessage(weak)} can become unstable if you overpush.`,
    timing: {
      reference_time: flow.referenceTime.trueSolarTime,
      liu_nian: flow.liuNian.pillar,
      liu_yue: flow.liuYue.pillar,
      liu_ri: flow.liuRi.pillar,
    },
    saved_window: 'Messages stay for 3 days unless favorited.',
  }

  if (tier === 'advanced') {
    body['deeper_read'] =
      `The broader yearly background is ${flow.liuNian.pillar}, which means ${elementMessage(flow.liuNian.element)}. The immediate day line is ${flow.liuRi.pillar}, so today should be read as a short trigger sitting on top of a bigger monthly pattern, not as the whole story.`
    body['supporting_pattern'] = strong == null
      ? 'Use steadiness and clear sequencing as your base.'
      : `Your stronger side still helps here: ${elementMessage(strong)}. Lean on that instead of reacting to noise.`
    body['best_move'] =
      'Keep one main priority, simplify the rest, and delay any dramatic conclusion until the signal stays consistent for more than one day.'
  }

  return { title, summary, body }
}

export async function cleanupExpiredDailyMessages(supabase: SupabaseLike) {
  const nowIso = new Date().toISOString()
  const { data } = await supabase
    .from('member_daily_messages')
    .select('id,is_favorited,expires_at')
    .order('message_date', { ascending: false })
    .limit(1000)

  for (const row of (data as Array<Record<string, unknown>> | null) ?? []) {
    if (row.is_favorited === true) continue
    const expiresAt = cleanString(row.expires_at)
    const id = cleanString(row.id)
    if (!id || !expiresAt) continue
    if (DateTime.fromISO(expiresAt).toUTC() < DateTime.fromISO(nowIso).toUTC()) {
      await supabase.from('member_daily_messages').delete().eq('id', id)
    }
  }
}

export async function ensureTodayDailyMessage(
  supabase: SupabaseLike,
  userId: string,
  referenceUtc = DateTime.utc(),
) {
  const [{ data: profile }, { data: chart }, { data: subscriptions }] = await Promise.all([
    supabase.from('profiles').select('timezone').eq('user_id', userId).maybeSingle(),
    supabase.from('bazi_charts').select('analysis').eq('user_id', userId).maybeSingle(),
    supabase.from('subscriptions').select('plan_code,status').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ])

  const tierInfo = chooseTier((subscriptions as StoredSubscription[] | null) ?? [])
  if (!tierInfo) return null

  const resolved = buildResolvedLocation((chart as StoredChart | null) ?? null, (profile as StoredProfile | null) ?? null)
  if (!resolved) return null

  const localNow = referenceUtc.setZone(resolved.location.timezone)
  const messageDate = localNow.toISODate()!
  const existing = await supabase
    .from('member_daily_messages')
    .select('id,user_id,message_date,timezone,membership_tier,variant,title,summary,body,is_favorited,is_read,expires_at,created_at,updated_at')
    .eq('user_id', userId)
    .eq('message_date', messageDate)
    .maybeSingle()

  if (existing.data) {
    return existing.data as DailyMessageRow
  }

  const flow = calculateCurrentFlowAtInstant(referenceUtc, resolved.location, resolved.dayStem)
  const payload = buildDailyMessagePayload(flow, tierInfo.tier as 'basic' | 'advanced', (chart as StoredChart | null) ?? null)
  const expiresAt = localNow.plus({ days: 3 }).endOf('day').toUTC().toISO()

  const row = {
    user_id: userId,
    message_date: messageDate,
    timezone: resolved.location.timezone,
    membership_tier: tierInfo.tier,
    variant: tierInfo.variant,
    title: payload.title,
    summary: payload.summary,
    body: payload.body,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }

  const inserted = await supabase
    .from('member_daily_messages')
    .upsert(row, { onConflict: 'user_id,message_date' })

  if (inserted.error) {
    throw inserted.error
  }

  const latest = await supabase
    .from('member_daily_messages')
    .select('id,user_id,message_date,timezone,membership_tier,variant,title,summary,body,is_favorited,is_read,expires_at,created_at,updated_at')
    .eq('user_id', userId)
    .eq('message_date', messageDate)
    .maybeSingle()

  return (latest.data as DailyMessageRow | null) ?? null
}

export async function listVisibleDailyMessages(
  supabase: SupabaseLike,
  userId: string,
) {
  const { data } = await supabase
    .from('member_daily_messages')
    .select('id,user_id,message_date,timezone,membership_tier,variant,title,summary,body,is_favorited,is_read,expires_at,created_at,updated_at')
    .eq('user_id', userId)
    .order('message_date', { ascending: false })
    .limit(14)

  const now = DateTime.utc()
  return ((data as DailyMessageRow[] | null) ?? []).filter((item) => {
    if (item.is_favorited) return true
    const expiresAt = cleanString(item.expires_at)
    return expiresAt == null || DateTime.fromISO(expiresAt).toUTC() >= now
  })
}
