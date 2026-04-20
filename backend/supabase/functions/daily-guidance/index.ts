import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const DISCLAIMER = 'For entertainment and self-reflection only. Not medical, legal, financial, or emergency advice.'

type ScorePack = {
  action: number
  social: number
  focus: number
  stability: number
  risk: number
}

type GuidanceInput = {
  date?: string
  timezone?: string
  intent?: string
  user_id?: string
  user_profile?: {
    dob?: string
    tob_optional?: string
    birthplace?: string
    timezone?: string
    intent?: string
  }
  bazi_api_output?: {
    scores?: Partial<ScorePack>
    day_element?: 'wood' | 'fire' | 'earth' | 'metal' | 'water'
    weak_element?: 'wood' | 'fire' | 'earth' | 'metal' | 'water'
    strong_element?: 'wood' | 'fire' | 'earth' | 'metal' | 'water'
    notes?: string[]
  }
}

type StoredProfile = {
  dob: string | null
  tob: string | null
  birthplace: string | null
  timezone: string
  intent: string | null
}

type StoredChart = {
  analysis?: {
    dayMaster?: {
      element?: string
    }
    fiveElements?: Record<string, number>
    weakElement?: string
    strongElement?: string
    favorableElement?: string
    unfavorableElement?: string
  }
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(v)))

function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}

function weekdayFromDate(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`)
  return Number.isNaN(d.getTime()) ? 0 : d.getDay()
}

function inferBaseScores(input: GuidanceInput, date: string): ScorePack {
  const api = input.bazi_api_output?.scores ?? {}
  const hasApi = ['action', 'social', 'focus', 'stability', 'risk'].some((k) => typeof (api as Record<string, unknown>)[k] === 'number')

  if (hasApi) {
    return {
      action: clamp(Number(api.action ?? 60)),
      social: clamp(Number(api.social ?? 60)),
      focus: clamp(Number(api.focus ?? 60)),
      stability: clamp(Number(api.stability ?? 60)),
      risk: clamp(Number(api.risk ?? 40)),
    }
  }

  const seed = hashSeed(`${input.user_profile?.dob ?? 'unknown'}|${date}|${input.user_profile?.birthplace ?? ''}`)
  return {
    action: 48 + (seed % 38),
    social: 45 + ((seed >> 3) % 42),
    focus: 50 + ((seed >> 7) % 36),
    stability: 46 + ((seed >> 11) % 40),
    risk: 25 + ((seed >> 15) % 45),
  }
}

function deriveScoresFromChart(chart?: StoredChart): Partial<ScorePack> {
  const five = chart?.analysis?.fiveElements ?? {}
  const wood = Number(five.wood ?? 0)
  const fire = Number(five.fire ?? 0)
  const earth = Number(five.earth ?? 0)
  const metal = Number(five.metal ?? 0)
  const water = Number(five.water ?? 0)
  const total = wood + fire + earth + metal + water

  if (total <= 0) return {}

  const weak = String(chart?.analysis?.weakElement ?? '').toLowerCase()
  const strong = String(chart?.analysis?.strongElement ?? '').toLowerCase()

  const norm = (value: number) => value / total
  let focus = 45 + Math.round(norm(metal) * 30 + norm(water) * 18)
  let action = 45 + Math.round(norm(fire) * 24 + norm(wood) * 20)
  let stability = 45 + Math.round(norm(earth) * 30 + norm(water) * 10)
  let social = 42 + Math.round(norm(fire) * 24 + norm(wood) * 14)
  let risk = 40 + Math.round(norm(fire) * 10 + norm(metal) * 8 - norm(earth) * 10)

  if (weak === 'earth') risk += 6
  if (weak === 'water') risk += 3
  if (weak === 'metal') focus -= 4
  if (weak === 'wood') action -= 3
  if (strong === 'earth') risk -= 5
  if (strong === 'water') stability += 4
  if (strong === 'fire') social += 4

  return {
    action: clamp(action),
    social: clamp(social),
    focus: clamp(focus),
    stability: clamp(stability),
    risk: clamp(risk),
  }
}

function applyRules(base: ScorePack, input: GuidanceInput, date: string): ScorePack {
  const s = { ...base }
  const intent = String(input.intent ?? input.user_profile?.intent ?? '').toLowerCase()
  const wd = weekdayFromDate(date)

  // Weekday rhythm rules
  // Mon(1)-Tue(2): focus/action +, social -
  if (wd === 1 || wd === 2) {
    s.focus += 6
    s.action += 4
    s.social -= 3
  }
  // Fri(5)-Sat(6): social +, stability/risk slightly weaker
  if (wd === 5 || wd === 6) {
    s.social += 7
    s.stability -= 3
    s.risk += 5
  }

  // Intent rules
  if (intent.includes('career') || intent.includes('work') || intent.includes('business')) {
    s.focus += 8
    s.action += 6
    s.social -= 2
  }
  if (intent.includes('relationship') || intent.includes('social')) {
    s.social += 9
    s.stability += 3
  }
  if (intent.includes('health') || intent.includes('wellness')) {
    s.stability += 8
    s.risk -= 6
  }

  // Element balance heuristic from bazi API
  const weak = input.bazi_api_output?.weak_element
  if (weak === 'water') {
    s.stability -= 4
    s.focus += 2
  }
  if (weak === 'fire') {
    s.action -= 3
    s.social += 3
  }
  if (weak === 'earth') {
    s.stability -= 6
    s.risk += 4
  }
  if (weak === 'metal') {
    s.focus -= 4
    s.risk += 3
  }
  if (weak === 'wood') {
    s.action -= 2
    s.social += 2
  }

  return {
    action: clamp(s.action),
    social: clamp(s.social),
    focus: clamp(s.focus),
    stability: clamp(s.stability),
    risk: clamp(s.risk),
  }
}

function energyScore(scores: ScorePack): number {
  const val = 0.26 * scores.action + 0.24 * scores.focus + 0.2 * scores.social + 0.2 * scores.stability - 0.18 * scores.risk
  return clamp(val)
}

function pickTheme(scores: ScorePack): string {
  if (scores.focus >= 75 && scores.risk <= 40) return 'Clarity day: simplify priorities and execute decisively.'
  if (scores.social >= 75 && scores.stability >= 60) return 'Connection day: meaningful conversations create momentum.'
  if (scores.action >= 70 && scores.stability < 55) return 'Execution day: move fast, but avoid emotional decisions.'
  if (scores.risk >= 65) return 'Caution day: stay steady, reduce unnecessary exposure.'
  return 'Balanced day: keep pace, make one good decision at a time.'
}

function riskWatch(scores: ScorePack): { category: string; message: string } {
  if (scores.risk < 35) {
    return { category: 'none', message: 'No major risk signal. Keep your routine steady and avoid overthinking.' }
  }

  const candidates: Array<{ category: string; weight: number; msg: string }> = [
    { category: 'communication', weight: 100 - scores.stability + scores.social / 3, msg: 'Higher chance of tone mismatch in conversations; confirm key details before responding.' },
    { category: 'money', weight: scores.action + scores.risk / 2, msg: 'Impulse spending risk is elevated; delay non-essential purchases for 24 hours.' },
    { category: 'travel', weight: scores.risk + (100 - scores.focus) / 2, msg: 'Travel timing may feel rushed; leave buffer time and double-check routes.' },
    { category: 'relationship', weight: scores.social + scores.risk / 2 - scores.stability / 3, msg: 'Emotional sensitivity is higher today; avoid conclusions from one message.' },
    { category: 'health-routine', weight: scores.risk + (100 - scores.stability) / 2, msg: 'Energy rhythm can dip later; keep hydration, meals, and sleep schedule consistent.' },
  ]

  candidates.sort((a, b) => b.weight - a.weight)
  return { category: candidates[0].category, message: candidates[0].msg }
}

function wearRecommendation(scores: ScorePack, weak?: string) {
  const colorByWeak: Record<string, string[]> = {
    water: ['navy', 'charcoal'],
    fire: ['emerald', 'teal'],
    earth: ['beige', 'olive'],
    metal: ['white', 'silver'],
    wood: ['forest green', 'brown'],
  }

  const colors = colorByWeak[weak ?? ''] ?? (scores.risk > 60 ? ['navy', 'earth tone'] : ['deep blue', 'soft white'])
  const style = scores.focus >= 70 ? 'Clean and minimal with structured layers' : 'Comfortable and neat with one focal accessory'
  const avoid = scores.social > 75 ? 'Overly loud patterns that distract communication' : 'Overly flashy accessories'
  return { colors: colors.slice(0, 2), style, avoid }
}

function goRecommendation(scores: ScorePack) {
  const recommended: string[] = []
  const avoid: string[] = []

  if (scores.focus >= 70) recommended.push('quiet workspace', 'library or calm cafe')
  if (scores.social >= 70) recommended.push('small meetup venue')
  if (scores.stability >= 65) recommended.push('park or walking route')
  if (recommended.length === 0) recommended.push('home office')

  if (scores.risk >= 60) avoid.push('crowded late-night venues', 'rushed multi-stop trips')
  else avoid.push('noisy environments')

  return {
    recommended: recommended.slice(0, 3),
    avoid: avoid.slice(0, 3),
  }
}

function doList(scores: ScorePack): string[] {
  const items: string[] = []
  if (scores.focus >= 65) items.push('Block 90 minutes for one deep-work task')
  if (scores.social >= 65) items.push('Have one meaningful check-in with a key person')
  if (scores.action >= 65) items.push('Finish one pending execution task before noon')
  if (scores.stability < 55) items.push('Keep schedule simple and add 15-minute buffers')
  if (items.length < 3) items.push('Review priorities and keep only top 3 tasks')
  if (items.length < 3) items.push('Track spending before making purchases')
  return items.slice(0, 3)
}

function avoidList(scores: ScorePack): string[] {
  const items: string[] = []
  if (scores.risk >= 55) items.push('Impulse commitments or high-stakes decisions late in the day')
  if (scores.stability < 60) items.push('Overloading your calendar with back-to-back tasks')
  if (scores.social > 75) items.push('Reactive texting when emotions are high')
  if (items.length < 2) items.push('Skipping meals and hydration during busy hours')
  return items.slice(0, 3)
}

function timeWindows(scores: ScorePack) {
  const first = scores.focus >= scores.social
    ? { start: '09:30', end: '11:30', purpose: 'planning & decisions' }
    : { start: '10:30', end: '12:00', purpose: 'communication & alignment' }

  const second = scores.action >= 70
    ? { start: '14:30', end: '16:30', purpose: 'execution sprint' }
    : { start: '15:00', end: '17:00', purpose: 'follow-ups & closure' }

  return [first, second]
}

async function resolveInputFromAuth(req: Request, body: GuidanceInput) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return body

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return body

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser()
  if (authErr || !user) return body

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const [{ data: profile }, { data: chart }] = await Promise.all([
    adminClient.from('profiles').select('dob,tob,birthplace,timezone,intent').eq('user_id', user.id).maybeSingle(),
    adminClient.from('bazi_charts').select('analysis').eq('user_id', user.id).maybeSingle(),
  ])

  const storedProfile = profile as StoredProfile | null
  const storedChart = chart as StoredChart | null
  const chartScores = deriveScoresFromChart(storedChart ?? undefined)

  return {
    ...body,
    user_id: user.id,
    timezone: body.timezone ?? storedProfile?.timezone,
    intent: body.intent ?? storedProfile?.intent ?? undefined,
    user_profile: {
      ...body.user_profile,
      dob: body.user_profile?.dob ?? storedProfile?.dob,
      tob_optional: body.user_profile?.tob_optional ?? storedProfile?.tob ?? undefined,
      birthplace: body.user_profile?.birthplace ?? storedProfile?.birthplace,
      timezone: body.user_profile?.timezone ?? storedProfile?.timezone,
      intent: body.user_profile?.intent ?? storedProfile?.intent ?? undefined,
    },
    bazi_api_output: {
      ...body.bazi_api_output,
      scores: {
        ...chartScores,
        ...(body.bazi_api_output?.scores ?? {}),
      },
      day_element:
        body.bazi_api_output?.day_element ??
        (storedChart?.analysis?.dayMaster?.element?.toLowerCase() as
          | 'wood'
          | 'fire'
          | 'earth'
          | 'metal'
          | 'water'
          | undefined),
      weak_element:
        body.bazi_api_output?.weak_element ??
        (storedChart?.analysis?.weakElement?.toLowerCase() as
          | 'wood'
          | 'fire'
          | 'earth'
          | 'metal'
          | 'water'
          | undefined),
      strong_element:
        body.bazi_api_output?.strong_element ??
        (storedChart?.analysis?.strongElement?.toLowerCase() as
          | 'wood'
          | 'fire'
          | 'earth'
          | 'metal'
          | 'water'
          | undefined),
      notes: body.bazi_api_output?.notes,
    },
  } satisfies GuidanceInput
}

serve(async (req) => {
  try {
    const rawBody = (await req.json()) as GuidanceInput
    const body = await resolveInputFromAuth(req, rawBody)
    const date = body?.date ?? new Date().toISOString().slice(0, 10)
    const timezone = body?.timezone ?? body?.user_profile?.timezone ?? 'UTC'

    const base = inferBaseScores(body, date)
    const scores = applyRules(base, body, date)
    const risk = riskWatch(scores)

    const payload = {
      date,
      timezone,
      energyScore: energyScore(scores),
      theme: pickTheme(scores),
      scores,
      wear: wearRecommendation(scores, body?.bazi_api_output?.weak_element),
      go: goRecommendation(scores),
      do: doList(scores),
      avoid: avoidList(scores),
      riskWatch: risk,
      bestTimeWindows: timeWindows(scores),
      masterUpsell: {
        enabled: true,
        cta: 'Ask for Guidance',
        pricing: { deepCoins: 5, quickCoins: 2, followupCoins: 1 },
      },
      disclaimer: DISCLAIMER,
    }

    return new Response(JSON.stringify(payload), {
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
