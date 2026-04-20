import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

import {
  buildQimenFeedbackInvitePolicy,
  extractPersistedQimenFeedbackInviteSnapshot,
} from '../_shared/qimen-feedback-policy.ts'

const MIN_FEEDBACK_LENGTH = 20
const ALLOWED_VERDICTS = new Set(['matched', 'partially_matched', 'missed'])

function cleanString(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

async function resolveAuthedUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { error: jsonResponse({ error: 'Missing Authorization header' }, 401), user: null }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser()
  if (error || !user) {
    return { error: jsonResponse({ error: 'Invalid or expired token' }, 401), user: null }
  }
  return { error: null, user }
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const auth = await resolveAuthedUser(req, supabaseUrl, anonKey)
    if (auth.error || !auth.user) return auth.error!

    const body = await req.json().catch(() => ({}))
    const action = cleanString(body?.action) ?? 'get'
    const threadId = cleanString(body?.thread_id)
    if (!threadId) return jsonResponse({ error: 'thread_id is required' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const [threadResult, totalQuestionCountResult, deliveredQimenCountResult] = await Promise.all([
      supabase
        .from('master_questions')
        .select('id,user_id,question_text,answer_text,divination_system,divination_profile,category,status,delivered_at,created_at')
        .eq('id', threadId)
        .eq('user_id', auth.user.id)
        .maybeSingle(),
      supabase
        .from('master_questions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.user.id),
      supabase
        .from('master_questions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.user.id)
        .eq('divination_system', 'qimen_yang')
        .eq('status', 'delivered'),
    ])
    if (threadResult.error) throw threadResult.error
    if (totalQuestionCountResult.error) throw totalQuestionCountResult.error
    if (deliveredQimenCountResult.error) throw deliveredQimenCountResult.error
    if (!threadResult.data) return jsonResponse({ error: 'Thread not found' }, 404)

    const thread = threadResult.data
    if ((thread.divination_system ?? 'qimen_yang') !== 'qimen_yang') {
      return jsonResponse({ error: 'Feedback is only supported for qimen_yang readings' }, 400)
    }
    if ((thread.status ?? '') !== 'delivered' || !cleanString(thread.answer_text)) {
      return jsonResponse({ error: 'Feedback is only available after a delivered answer' }, 400)
    }

    const [feedbackResult, rewardResult, eventResult] = await Promise.all([
      supabase
        .from('qimen_outcome_feedback')
        .select('*')
        .eq('thread_id', threadId)
        .maybeSingle(),
      supabase
        .from('coin_ledger')
        .select('id,created_at,balance_after')
        .eq('user_id', auth.user.id)
        .eq('source_type', 'qimen_feedback_reward')
        .eq('source_ref', threadId)
        .maybeSingle(),
      supabase
        .from('master_events')
        .select('payload_json,created_at')
        .eq('question_id', threadId)
        .eq('event_type', 'delivered')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (feedbackResult.error) throw feedbackResult.error
    if (rewardResult.error) throw rewardResult.error
    if (eventResult.error) throw eventResult.error

    const rewardClaimed = rewardResult.data != null
    const persistedInvite = extractPersistedQimenFeedbackInviteSnapshot(eventResult.data?.payload_json ?? null)
    const invitePolicy = persistedInvite?.policy ?? await buildQimenFeedbackInvitePolicy({
      question_text: thread.question_text ?? '',
      question_type: thread.category ?? null,
      delivered_qimen_count: deliveredQimenCountResult.count ?? 0,
      total_question_count: totalQuestionCountResult.count ?? 0,
      has_existing_feedback: Boolean(feedbackResult.data),
    })

    if (action === 'get') {
      return jsonResponse({
        feedback: feedbackResult.data,
        reward_coins: invitePolicy.reward_coins,
        reward_claimed: rewardClaimed,
        reward_claimed_at: rewardResult.data?.created_at ?? null,
        feedback_ready: invitePolicy.invited,
        feedback_invited: invitePolicy.invited,
        invitation_reason: invitePolicy.invitation_reason,
        invitation_policy: invitePolicy,
        min_feedback_length: MIN_FEEDBACK_LENGTH,
      })
    }

    if (action !== 'submit') {
      return jsonResponse({ error: 'Unsupported action' }, 400)
    }
    if (!invitePolicy.invited && !feedbackResult.data) {
      return jsonResponse({
        error: 'This answer is not currently in the feedback reward invite pool.',
        feedback_ready: false,
        feedback_invited: false,
        invitation_reason: invitePolicy.invitation_reason,
      }, 400)
    }

    const verdict = cleanString(body?.verdict)
    const userFeedback = cleanString(body?.user_feedback)
    if (!verdict || !ALLOWED_VERDICTS.has(verdict)) {
      return jsonResponse({ error: 'verdict must be matched, partially_matched, or missed' }, 400)
    }
    if (!userFeedback || userFeedback.length < MIN_FEEDBACK_LENGTH) {
      return jsonResponse({
        error: `Please leave a more complete outcome note (${MIN_FEEDBACK_LENGTH}+ characters) to receive the reward.`,
      }, 400)
    }

    const questionType = invitePolicy.question_type
    const payload = {
      thread_id: threadId,
      user_id: auth.user.id,
      divination_system: thread.divination_system ?? 'qimen_yang',
      question_type: questionType,
      system_profile: cleanString(thread.divination_profile),
      teacher_conclusion: cleanString(thread.answer_text),
      user_feedback: userFeedback,
      verdict,
      updated_at: new Date().toISOString(),
    }

    const upsertResult = await supabase
      .from('qimen_outcome_feedback')
      .upsert(payload, { onConflict: 'thread_id' })
      .select('*')
      .maybeSingle()
    if (upsertResult.error) throw upsertResult.error

    let balanceAfter: number | null = rewardResult.data?.balance_after ?? null
    let rewarded = false
    if (!rewardClaimed) {
      const rewardRpc = await supabase.rpc('grant_user_coins', {
        p_user_id: auth.user.id,
        p_amount: invitePolicy.reward_coins,
        p_reason: 'qimen_feedback_reward',
        p_source_type: 'qimen_feedback_reward',
        p_source_ref: threadId,
        p_note: verdict,
        p_metadata: {
          thread_id: threadId,
          verdict,
          question_type: questionType,
        },
        p_idempotency_key: `qimen-feedback-reward:${threadId}`,
        p_bucket: 'bonus',
      })
      if (rewardRpc.error) throw rewardRpc.error
      const rewardData = rewardRpc.data as { ok?: boolean; balance_after?: number } | null
      rewarded = rewardData?.ok === true
      balanceAfter = rewardData?.balance_after ?? balanceAfter
    }

    return jsonResponse({
      feedback: upsertResult.data,
      rewarded,
      reward_coins: rewarded ? invitePolicy.reward_coins : 0,
      reward_claimed: rewardClaimed || rewarded,
      balance_after: balanceAfter,
      feedback_ready: true,
      feedback_invited: true,
      invitation_reason: invitePolicy.invitation_reason,
      invitation_policy: invitePolicy,
      min_feedback_length: MIN_FEEDBACK_LENGTH,
    })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 400)
  }
})
