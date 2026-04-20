import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

import {
  buildQimenFeedbackInvitePolicy,
  extractPersistedQimenFeedbackInviteSnapshot,
} from '../_shared/qimen-feedback-policy.ts'

type QuestionRow = {
  id: string
  parent_question_id: string | null
  question_text: string
  divination_system: string
  divination_profile: string | null
  question_kind: string
  coin_cost: number
  category: string | null
  status: string
  answer_text: string | null
  created_at: string
  updated_at: string
  delivered_at: string | null
  sla_deadline_at: string | null
}

type QimenFeedbackRow = {
  thread_id: string
  verdict: string | null
  user_feedback: string | null
  updated_at: string | null
}

type RewardLedgerRow = {
  source_ref: string | null
  created_at: string | null
}

function costLabel(kind: string, coinCost: number): string {
  if (kind === 'followup' && coinCost === 0) return 'Free clarification reply'
  if (coinCost === 0) return 'Free opening reading'
  if (kind === 'followup') return '1 coin'
  if (kind === 'quick') return '2 coins'
  return '5 coins'
}

function cleanString(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function categoryFrame(category: string) {
  const frames: Record<string, {
    lens: string
    caution: string
    nextStep: string
  }> = {
    career_work: {
      lens: 'direction, compounding effort, and whether the current path still deserves fuel',
      caution: 'do not keep funding something only because you have already put a lot into it',
      nextStep: 'check which part of your current path is actually producing traction',
    },
    money_wealth: {
      lens: 'risk, capital exposure, and whether this move is built on something stable',
      caution: 'avoid urgency-based money decisions',
      nextStep: 'review downside first, then decide how much exposure still makes sense',
    },
    love_relationship: {
      lens: 'reciprocity, timing, and whether feelings are being matched by follow-through',
      caution: 'do not make a final emotional decision from one intense moment',
      nextStep: 'watch consistency rather than chemistry alone',
    },
    marriage_family: {
      lens: 'stability, emotional load, and how the connection behaves under pressure',
      caution: 'do not carry the entire relationship structure by yourself and call that peace',
      nextStep: 'look at whether expectations and future direction are genuinely aligned',
    },
    health_energy: {
      lens: 'depletion, recovery, and whether pressure is landing on body or mind first',
      caution: 'do not treat a chronic drain like a temporary mood swing',
      nextStep: 'simplify routine before asking the body for more output',
    },
    timing_decisions: {
      lens: 'whether this is a move-now window or a gather-more-signal window',
      caution: 'forcing speed too early usually costs more than waiting',
      nextStep: 'define what would count as a real confirmation signal',
    },
    study_exams: {
      lens: 'focus, pressure handling, and whether effort is converting into clean output',
      caution: 'avoid using anxiety as the main study strategy',
      nextStep: 'narrow to the highest-yield targets and repeat under structure',
    },
    children_parenting: {
      lens: 'care, patience, and what the situation keeps asking from your energy',
      caution: 'do not read one difficult phase as the whole story',
      nextStep: 'look for the recurring trigger, not only the latest event',
    },
    travel_relocation: {
      lens: 'movement, transition timing, and whether change will reduce or relocate pressure',
      caution: 'do not move just to escape a pattern that may follow you',
      nextStep: 'compare what the move truly solves versus what it postpones',
    },
    home_property: {
      lens: 'stability, cost, and whether the decision supports your next phase',
      caution: 'avoid overstretching for a symbolic win',
      nextStep: 'choose the option that improves structure, not just appearance',
    },
  }

  return frames[category] ?? {
    lens: 'your main direction, pressure point, and what timing is doing underneath the surface',
    caution: 'do not let confusion force a premature answer',
    nextStep: 'separate real signal from emotional noise before deciding',
  }
}

function provisionalReply(row: QuestionRow): string {
  const question = cleanString(row.question_text)?.toLowerCase() ?? ''
  const frame = categoryFrame(row.category ?? 'general')

  if (/(invest|investment|business|startup|company|project|job|career|quit|promotion|work)/.test(question)) {
    return [
      'Short answer: yes, but more selectively than before.',
      'This is really about whether your current path still deserves more energy, money, or trust. The stronger move is to keep backing the part that is already showing traction, while cutting leakage from the part that only looks busy.',
      'Do not confuse motion with progress. Review what has produced real pull, results, or recognition over the last few weeks, and let that guide the next decision.',
    ].join('\n\n')
  }

  if (/(love|relationship|dating|partner|boyfriend|girlfriend|marriage|husband|wife|divorce)/.test(question)) {
    return [
      'This is less about labels and more about consistency.',
      'A connection becomes more trustworthy when the emotional signal and the practical follow-through keep matching each other.',
      `${frame.caution.charAt(0).toUpperCase()}${frame.caution.slice(1)}. Best next move: ${frame.nextStep}.`,
    ].join('\n\n')
  }

  if (/(health|body|energy|tired|sleep|stress|sick|ill|anxiety)/.test(question)) {
    return [
      'This looks more like a strain-management issue than a random fluctuation.',
      'When this kind of pattern shows up, the body usually wants simplification before it wants more output.',
      `${frame.caution.charAt(0).toUpperCase()}${frame.caution.slice(1)}. Best next move: ${frame.nextStep}.`,
    ].join('\n\n')
  }

  return [
    `The real issue here is ${frame.lens}.`,
    'This usually becomes clearer when you separate the part that is structurally working from the part that is only being held up by emotion, urgency, or habit.',
    `${frame.caution.charAt(0).toUpperCase()}${frame.caution.slice(1)}. Best next move: ${frame.nextStep}.`,
  ].join('\n\n')
}

function presentAnswerText(answerText: string) {
  const trimmed = answerText.trim()
  if (
    trimmed.includes('How I would read this through the chart:') ||
    trimmed.includes('Your chart reads closer to') ||
    trimmed.includes('What stands out first:')
  ) {
    const parts = trimmed
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean)
      .filter(
        (part) =>
            !part.startsWith('What stands out first:') &&
            !part.startsWith('How I would read this through the chart:'),
      )
      .map((part) =>
          part
              .replace('What this means for your question: ', '')
              .replace('Best next move: ', ''),
      )

    if (parts.length > 0) {
      return parts.join('\n\n')
    }
  }

  return trimmed
}

function placeholderReply(row: QuestionRow): string {
  if (row.status === 'delivered' && row.answer_text) {
    return presentAnswerText(row.answer_text)
  }
  if (row.answer_text) return presentAnswerText(row.answer_text)
  return provisionalReply(row)
}

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
      error: userErr,
    } = await userClient.auth.getUser()

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await supabase
      .from('master_questions')
      .select(
        'id,parent_question_id,question_text,divination_system,divination_profile,question_kind,coin_cost,category,status,answer_text,created_at,updated_at,delivered_at,sla_deadline_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) throw error

    const rows = (data ?? []) as QuestionRow[]
    const qimenQuestionIds = rows
      .filter((row) => row.divination_system === 'qimen_yang')
      .map((row) => row.id)

    const feedbackByQuestionId = new Map<string, QimenFeedbackRow>()
    const rewardByQuestionId = new Map<string, RewardLedgerRow>()
    const deliveredPayloadByQuestionId = new Map<string, Record<string, unknown>>()
    if (qimenQuestionIds.length > 0) {
      const [feedbackResult, rewardResult, eventResult] = await Promise.all([
        supabase
          .from('qimen_outcome_feedback')
          .select('thread_id,verdict,user_feedback,updated_at')
          .in('thread_id', qimenQuestionIds),
        supabase
          .from('coin_ledger')
          .select('source_ref,created_at')
          .eq('user_id', user.id)
          .eq('source_type', 'qimen_feedback_reward')
          .in('source_ref', qimenQuestionIds),
        supabase
          .from('master_events')
          .select('question_id,payload_json,created_at')
          .eq('event_type', 'delivered')
          .in('question_id', qimenQuestionIds)
          .order('created_at', { ascending: false }),
      ])
      if (feedbackResult.error) throw feedbackResult.error
      if (rewardResult.error) throw rewardResult.error
      if (eventResult.error) throw eventResult.error
      for (const row of ((feedbackResult.data ?? []) as QimenFeedbackRow[])) {
        if (row.thread_id) feedbackByQuestionId.set(row.thread_id, row)
      }
      for (const row of ((rewardResult.data ?? []) as RewardLedgerRow[])) {
        const key = cleanString(row.source_ref)
        if (key) rewardByQuestionId.set(key, row)
      }
      for (const row of ((eventResult.data ?? []) as Array<Record<string, unknown>>)) {
        const key = cleanString(row.question_id)
        if (!key || deliveredPayloadByQuestionId.has(key)) continue
        deliveredPayloadByQuestionId.set(key, ((row.payload_json ?? {}) as Record<string, unknown>))
      }
    }

    const threads = new Map<string, {
      id: string
      title: string
      divinationSystem: string
      divinationProfile: string | null
      category: string
      status: string
      createdAt: string
      updatedAt: string
      lastCostLabel: string
      messages: Array<Record<string, string>>
      latestQimenQuestionId: string | null
      latestQimenDeliveredAt: string | null
      feedback?: Record<string, unknown>
    }>()

    for (const row of rows) {
      const rootId = row.parent_question_id ?? row.id
      if (!threads.has(rootId)) {
        threads.set(rootId, {
          id: rootId,
          title: row.parent_question_id ? 'Conversation' : row.question_text,
          divinationSystem: row.divination_system,
          divinationProfile: row.divination_profile,
          category: row.category ?? 'general',
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastCostLabel: costLabel(row.question_kind, row.coin_cost),
          messages: [],
          latestQimenQuestionId: null,
          latestQimenDeliveredAt: null,
        })
      }

      const thread = threads.get(rootId)!
      if (!row.parent_question_id) {
        thread.title = row.question_text
        thread.divinationSystem = row.divination_system
        thread.divinationProfile = row.divination_profile
        thread.category = row.category ?? thread.category
        thread.createdAt = row.created_at
      }
      thread.updatedAt = row.updated_at
      thread.status = row.status
      thread.lastCostLabel = costLabel(row.question_kind, row.coin_cost)

      thread.messages.push({
        id: row.id,
        role: 'user',
        kind: row.question_kind,
        divinationSystem: row.divination_system,
        text: row.question_text,
        createdAt: row.created_at,
      })
      thread.messages.push({
        id: `${row.id}-reply`,
        role: 'system',
        kind: row.answer_text ? 'answer' : 'status',
        divinationSystem: row.divination_system,
        text: placeholderReply(row),
        createdAt: row.delivered_at ?? row.updated_at,
      })

      if (row.divination_system === 'qimen_yang' && row.answer_text && row.delivered_at) {
        if (!thread.latestQimenDeliveredAt || row.delivered_at >= thread.latestQimenDeliveredAt) {
          thread.latestQimenQuestionId = row.id
          thread.latestQimenDeliveredAt = row.delivered_at
        }
      }
    }

    for (const thread of threads.values()) {
      if (!thread.latestQimenQuestionId) continue
      const feedback = feedbackByQuestionId.get(thread.latestQimenQuestionId)
      const reward = rewardByQuestionId.get(thread.latestQimenQuestionId)
      const persistedInvite = extractPersistedQimenFeedbackInviteSnapshot(
        deliveredPayloadByQuestionId.get(thread.latestQimenQuestionId) ?? null,
      )
      const policy = persistedInvite?.policy ?? await buildQimenFeedbackInvitePolicy({
        question_text:
          thread.messages.find((item) => String(item.id ?? '') === thread.latestQimenQuestionId)?.text ??
          thread.title,
        question_type: thread.category,
        delivered_qimen_count: rows.filter((row) => row.divination_system === 'qimen_yang' && row.status === 'delivered' && Boolean(cleanString(row.answer_text))).length,
        total_question_count: rows.length,
        has_existing_feedback: Boolean(feedback),
      })
      if (!policy.invited && !feedback) continue
      thread.feedback = {
        available: policy.invited || Boolean(feedback),
        targetQuestionId: thread.latestQimenQuestionId,
        rewardCoins: policy.reward_coins,
        invitationReason: policy.invitation_reason,
        invitationPolicy: policy,
        submitted: Boolean(feedback),
        verdict: feedback?.verdict ?? null,
        userFeedback: feedback?.user_feedback ?? null,
        updatedAt: feedback?.updated_at ?? null,
        rewardClaimed: Boolean(reward),
        rewardClaimedAt: reward?.created_at ?? null,
      }
    }

    const result = Array.from(threads.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    return new Response(JSON.stringify({ threads: result }), {
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
