import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { dirname, fromFileUrl, join } from 'https://deno.land/std@0.224.0/path/mod.ts'

import { requireAdminContext } from '../_shared/assert-admin.ts'
import { requireRole } from '../_shared/admin/roles.ts'
import { cleanString, corsHeaders, json, readJsonBody, stringParam } from '../_shared/admin/http.ts'
import {
  buildQimenFeedbackInvitePolicy,
  extractPersistedQimenFeedbackInviteSnapshot,
} from '../_shared/qimen-feedback-policy.ts'
import { getTeacherCoverageBootstrapRows } from '../_shared/qimen-reasoning-engine.ts'

const ROOT = join(dirname(fromFileUrl(import.meta.url)), '..', '..', '..', '..')
const QIMEN_TEACHER_ROUTING_REPORT_PATH = join(
  ROOT,
  'data',
  'import-runs',
  'qimen-yangpan',
  'qimen-teacher-routing-report.json',
)

function formatError(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const maybe = error as Record<string, unknown>
    const message = cleanString(maybe.message) ?? cleanString(maybe.error_description) ?? cleanString(maybe.details)
    if (message) return message
    return JSON.stringify(maybe)
  }
  return String(error)
}

function isMissingRelation(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const maybe = error as Record<string, unknown>
  const code = cleanString(maybe.code)
  const message = cleanString(maybe.message) ?? ''
  return code === '42P01' || message.includes('relation') || message.includes('does not exist')
}

function parseFailureTags(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanString(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 12)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12)
  }
  return []
}

function normalizeDecisionLabel(questionType: string, text: string) {
  const sample = cleanString(text) ?? ''
  const positiveTerms =
    questionType === 'love_relationship'
      ? ['复合', '推进', '继续', '靠近', '结婚', '能成']
      : questionType === 'health_energy'
        ? ['恢复', '好转', '缓解', '稳定']
        : ['推进', '落地', '中标', '回款', '兑现', '可成', '顺利']
  const negativeTerms =
    questionType === 'love_relationship'
      ? ['离婚', '分开', '结束', '难成', '走散']
      : questionType === 'health_energy'
        ? ['偏重', '风险', '恶化', '反复', '拖长']
        : ['落空', '失败', '不中', '受阻', '难成', '卡住']
  const mixedTerms = ['波动', '反复', '拉扯', '不稳', '拖延', '观望']
  const riskTerms = ['谨慎', '止损', '保守', '先不要', '风险', '防']

  const positiveScore = positiveTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)
  const negativeScore = negativeTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)
  const mixedScore = mixedTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)
  const riskScore = riskTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)

  if (negativeScore > Math.max(positiveScore, mixedScore)) return 'negative'
  if (positiveScore > Math.max(negativeScore, mixedScore)) return 'positive'
  if (riskScore > 0 && riskScore >= mixedScore) return 'risk'
  if (mixedScore > 0) return 'mixed'
  return 'unclear'
}

function normalizeTimingBucket(text: string) {
  const sample = cleanString(text) ?? ''
  if (!sample) return 'unclear'
  if (['马上', '很快', '近期', '短期', '尽快', '这几天', '本周'].some((term) => sample.includes(term))) return 'near'
  if (['本月', '这个月', '几个月', '阶段', '今年', '年内'].some((term) => sample.includes(term))) return 'mid'
  if (['长期', '后面', '未来', '大运', '流年', '明年', '一年后'].some((term) => sample.includes(term))) return 'long'
  return 'unclear'
}

function normalizedDecision(questionType: string, mainJudgment: string, timingLine: string, reasonChain: string[] = []) {
  const label = normalizeDecisionLabel(questionType, [mainJudgment, timingLine, ...reasonChain].join(' '))
  const timingBucket = normalizeTimingBucket(timingLine)
  return {
    label,
    timing_bucket: timingBucket,
    key: `${label}::${timingBucket}`,
  }
}

function teacherStatusFromAggregate(runs: number, score: number) {
  const avg = runs > 0 ? score / runs : 0
  if (runs >= 12 && avg < 0.15) return 'muted'
  if (runs >= 6 && avg < 0.45) return 'downranked'
  return 'active'
}

type TeacherQuestionTypeScoreRow = {
  teacher_id: string
  question_type: string
  runs: number
  majority_match_count: number
  teacher_conclusion_match_count: number
  feedback_match_count: number
  partially_matched_count: number
  missed_count: number
  score: number
  status: string
  updated_at: string
}

async function loadQimenTeacherRoutingReport() {
  try {
    const raw = await Deno.readTextFile(QIMEN_TEACHER_ROUTING_REPORT_PATH)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function rebuildTeacherQuestionTypeScores(supabase: any) {
  const bootstrapRows = getTeacherCoverageBootstrapRows()
  const feedbackResult = await supabase
    .from('qimen_outcome_feedback')
    .select('thread_id,question_type,teacher_conclusion,verdict,failed_step,failure_tags,updated_at')
    .limit(1000)
  if (feedbackResult.error) {
    if (isMissingRelation(feedbackResult.error)) return { rows: [], missing_relation: true }
    throw feedbackResult.error
  }

  const feedbackRows = Array.isArray(feedbackResult.data) ? feedbackResult.data : []
  const threadIds = feedbackRows
    .map((row: Record<string, unknown>) => cleanString(row.thread_id))
    .filter((value: string | null | undefined): value is string => Boolean(value))
  if (threadIds.length === 0) {
    const rows: TeacherQuestionTypeScoreRow[] = bootstrapRows.map((row) => ({
      teacher_id: row.teacher_id,
      question_type: row.question_type,
      runs: 0,
      majority_match_count: 0,
      teacher_conclusion_match_count: 0,
      feedback_match_count: 0,
      partially_matched_count: 0,
      missed_count: 0,
      score: Number(Number(row.score).toFixed(2)),
      status: 'active',
      updated_at: new Date().toISOString(),
    }))
    const deleteResult = await supabase.from('qimen_teacher_question_type_scores').delete().neq('teacher_id', '')
    if (deleteResult.error && !isMissingRelation(deleteResult.error)) throw deleteResult.error
    if (rows.length > 0) {
      const insertResult = await supabase.from('qimen_teacher_question_type_scores').insert(rows)
      if (insertResult.error && !isMissingRelation(insertResult.error)) throw insertResult.error
    }
    return { rows }
  }

  const eventResult = await supabase
    .from('master_events')
    .select('question_id,payload_json,created_at')
    .eq('event_type', 'delivered')
    .in('question_id', threadIds)
    .order('created_at', { ascending: false })
  if (eventResult.error) throw eventResult.error

  const latestPayloadByThread = new Map<string, Record<string, unknown>>()
  for (const row of ((eventResult.data ?? []) as Array<Record<string, unknown>>)) {
    const threadId = cleanString(row.question_id)
    if (!threadId || latestPayloadByThread.has(threadId)) continue
    latestPayloadByThread.set(threadId, (row.payload_json ?? {}) as Record<string, unknown>)
  }

  const aggregates = new Map<string, TeacherQuestionTypeScoreRow>()
  for (const row of feedbackRows as Array<Record<string, unknown>>) {
    const threadId = cleanString(row.thread_id)
    const questionType = cleanString(row.question_type) ?? 'general'
    if (!threadId) continue
    const payload = latestPayloadByThread.get(threadId) ?? {}
    const knowledgeEvidence = (payload.knowledge_evidence ?? {}) as Record<string, unknown>
    const qimenReasoning = (knowledgeEvidence.qimen_reasoning ?? {}) as Record<string, unknown>
    const teacherRuns = Array.isArray(qimenReasoning.teacher_runs) ? qimenReasoning.teacher_runs as Array<Record<string, unknown>> : []
    const consensusLevel = cleanString(qimenReasoning.consensus_level)
    const majorityKey = cleanString((qimenReasoning as Record<string, unknown>).consensus_majority_key)
    const consensusSummary = cleanString(qimenReasoning.consensus_summary)
    const teacherConclusionDecision = normalizedDecision(
      questionType,
      cleanString(row.teacher_conclusion) ?? '',
      '',
      [],
    )

    for (const run of teacherRuns) {
      const teacherId = cleanString(run.teacher_id)
      if (!teacherId) continue
      const key = `${teacherId}::${questionType}`
      const existing: TeacherQuestionTypeScoreRow = aggregates.get(key) ?? {
        teacher_id: teacherId,
        question_type: questionType,
        runs: 0,
        majority_match_count: 0,
        teacher_conclusion_match_count: 0,
        feedback_match_count: 0,
        partially_matched_count: 0,
        missed_count: 0,
        score: 0,
        status: 'active',
        updated_at: new Date().toISOString(),
      }
      existing.runs = Number(existing.runs) + 1

      const decision = normalizedDecision(
        questionType,
        cleanString(run.main_judgment) ?? '',
        cleanString(run.timing_line) ?? '',
        Array.isArray(run.reason_chain) ? run.reason_chain.map((item) => String(item)) : [],
      )
      const agreesWithMajority = majorityKey
        ? decision.key === majorityKey
        : Boolean(consensusLevel === 'early_match' || consensusLevel === 'late_match') && decision.label === normalizeDecisionLabel(questionType, consensusSummary ?? '')
      if (agreesWithMajority) existing.majority_match_count = Number(existing.majority_match_count) + 1

      const teacherAligns = teacherConclusionDecision.label !== 'unclear' && decision.label === teacherConclusionDecision.label
      if (teacherAligns) existing.teacher_conclusion_match_count = Number(existing.teacher_conclusion_match_count) + 1

      const verdict = cleanString(row.verdict) ?? 'pending'
      let delta = agreesWithMajority ? 0.9 : -0.15
      if (teacherAligns) delta += 0.6
      if (verdict === 'matched') {
        delta += agreesWithMajority ? 2 : -0.8
        if (agreesWithMajority) existing.feedback_match_count = Number(existing.feedback_match_count) + 1
      } else if (verdict === 'partially_matched') {
        delta += agreesWithMajority ? 0.8 : -0.35
        if (agreesWithMajority) existing.feedback_match_count = Number(existing.feedback_match_count) + 1
        if (agreesWithMajority) existing.partially_matched_count = Number(existing.partially_matched_count) + 1
      } else if (verdict === 'missed') {
        delta += agreesWithMajority ? -1.6 : 0.2
        if (agreesWithMajority) existing.missed_count = Number(existing.missed_count) + 1
      }

      const failedStep = cleanString(row.failed_step)
      const failureTags = Array.isArray(row.failure_tags) ? row.failure_tags.map((item) => cleanString(item)).filter(Boolean) : []
      if (failedStep === 'question_route' || failureTags.includes('wrong_question_type')) delta -= 0.35
      if (failedStep === 'decision_compose' || failureTags.includes('wrong_priority')) delta -= 0.25
      if (failureTags.includes('overread')) delta -= 0.25

      existing.score = Number(existing.score) + delta
      aggregates.set(key, existing)
    }
  }

  const rows: TeacherQuestionTypeScoreRow[] = [...aggregates.values()].map((row) => ({
    ...row,
    score: Number(Number(row.score).toFixed(2)),
    status: teacherStatusFromAggregate(Number(row.runs), Number(row.score)),
    updated_at: new Date().toISOString(),
  }))

  const existingKeys = new Set(rows.map((row) => `${cleanString(row.teacher_id)}::${cleanString(row.question_type)}`))
  for (const bootstrap of bootstrapRows) {
    const key = `${cleanString(bootstrap.teacher_id)}::${cleanString(bootstrap.question_type)}`
    if (existingKeys.has(key)) continue
    rows.push({
      teacher_id: bootstrap.teacher_id,
      question_type: bootstrap.question_type,
      runs: 0,
      majority_match_count: 0,
      teacher_conclusion_match_count: 0,
      feedback_match_count: 0,
      partially_matched_count: 0,
      missed_count: 0,
      score: Number(Number(bootstrap.score).toFixed(2)),
      status: 'active',
      updated_at: new Date().toISOString(),
    })
  }

  const deleteResult = await supabase.from('qimen_teacher_question_type_scores').delete().neq('teacher_id', '')
  if (deleteResult.error && !isMissingRelation(deleteResult.error)) throw deleteResult.error

  if (rows.length > 0) {
    const insertResult = await supabase.from('qimen_teacher_question_type_scores').insert(rows)
    if (insertResult.error && !isMissingRelation(insertResult.error)) throw insertResult.error
  }

  return { rows }
}

serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const adminContext = await requireAdminContext(req)
    if ('error' in adminContext) return adminContext.error as Response

    const supabase = adminContext.adminClient
    const url = new URL(req.url)
    const body = await readJsonBody(req)
    const threadId = stringParam(url, body, 'thread_id')
    const action = stringParam(url, body, 'action') ?? 'get'
    if (action === 'export') {
      const roleError = requireRole(adminContext.role, ['super_admin', 'operator', 'reviewer'])
      if (roleError) return roleError

      const exportResult = await supabase
        .from('qimen_outcome_feedback')
        .select('thread_id,question_type,verdict,failed_step,failed_support_id,failure_summary,failure_tags,updated_at')
        .in('verdict', ['partially_matched', 'missed'])
        .order('updated_at', { ascending: false })
        .limit(1000)
      if (exportResult.error) {
        if (isMissingRelation(exportResult.error)) {
          return json({ rows: [], total_rows: 0, missing_relation: true })
        }
        throw exportResult.error
      }

      return json({
        rows: exportResult.data ?? [],
        total_rows: (exportResult.data ?? []).length,
      })
    }

    if (action === 'teacher_experiment_export') {
      const roleError = requireRole(adminContext.role, ['super_admin', 'operator', 'reviewer'])
      if (roleError) return roleError

      const feedbackResult = await supabase
        .from('qimen_outcome_feedback')
        .select('thread_id,question_type,teacher_conclusion,verdict,failed_step,failure_tags,updated_at')
        .order('updated_at', { ascending: false })
        .limit(1000)

      if (feedbackResult.error) {
        if (isMissingRelation(feedbackResult.error)) {
          return json({ rows: [], total_rows: 0, missing_relation: true })
        }
        throw feedbackResult.error
      }

      const feedbackRows = Array.isArray(feedbackResult.data) ? feedbackResult.data : []
      const threadIds = feedbackRows
        .map((row: Record<string, unknown>) => cleanString(row.thread_id))
        .filter((value): value is string => Boolean(value))

      let eventRows: Array<Record<string, unknown>> = []
      if (threadIds.length > 0) {
        const eventResult = await supabase
          .from('master_events')
          .select('question_id,payload_json,created_at')
          .eq('event_type', 'delivered')
          .in('question_id', threadIds)
          .order('created_at', { ascending: false })
        if (eventResult.error && !isMissingRelation(eventResult.error)) throw eventResult.error
        eventRows = Array.isArray(eventResult.data) ? eventResult.data : []
      }

      const latestPayloadByThread = new Map<string, Record<string, unknown>>()
      for (const row of eventRows) {
        const threadId = cleanString(row.question_id)
        if (!threadId || latestPayloadByThread.has(threadId)) continue
        latestPayloadByThread.set(threadId, (row.payload_json ?? {}) as Record<string, unknown>)
      }

      const rows = feedbackRows.map((row: Record<string, unknown>) => {
        const threadId = cleanString(row.thread_id) ?? ''
        const payload = latestPayloadByThread.get(threadId) ?? {}
        const knowledgeEvidence = (payload.knowledge_evidence ?? {}) as Record<string, unknown>
        const qimenReasoning = (knowledgeEvidence.qimen_reasoning ?? {}) as Record<string, unknown>
        return {
          thread_id: threadId,
          question_type: cleanString(row.question_type),
          teacher_conclusion: cleanString(row.teacher_conclusion),
          verdict: cleanString(row.verdict),
          failed_step: cleanString(row.failed_step),
          failure_tags: Array.isArray(row.failure_tags) ? row.failure_tags : [],
          updated_at: row.updated_at,
          consensus_level: cleanString(qimenReasoning.consensus_level),
          consensus_summary: cleanString(qimenReasoning.consensus_summary),
          consensus_majority_key: cleanString(qimenReasoning.consensus_majority_key),
          teacher_runs: Array.isArray(qimenReasoning.teacher_runs) ? qimenReasoning.teacher_runs : [],
        }
      })

      return json({
        rows,
        total_rows: rows.length,
      })
    }

    if (action === 'stats') {
      const [statsResult, deliveredCountResult, rewardLedgerResult, deliveredRowsResult] = await Promise.all([
        supabase
          .from('qimen_outcome_feedback')
          .select('thread_id,verdict,failed_step,failed_support_id,failure_tags,question_type')
          .limit(1000),
        supabase
          .from('master_questions')
          .select('id', { count: 'exact', head: true })
          .eq('divination_system', 'qimen_yang')
          .eq('status', 'delivered'),
        supabase
          .from('coin_ledger')
          .select('delta,source_ref,created_at')
          .eq('source_type', 'qimen_feedback_reward')
          .limit(1000),
        supabase
          .from('master_questions')
          .select('id,user_id,question_text,category,divination_profile,created_at,delivered_at')
          .eq('divination_system', 'qimen_yang')
          .eq('status', 'delivered')
          .order('delivered_at', { ascending: false })
          .limit(1000),
      ])
      if (statsResult.error) {
        if (isMissingRelation(statsResult.error)) {
          return json({
            stats: {
              total_feedback: 0,
              verdicts: [],
              by_question_type: [],
              failed_steps: [],
              failed_supports: [],
              failure_tags: [],
              member_feedback: {
                eligible_delivered: 0,
                invited_delivered: 0,
                invitation_rate: 0,
                submitted_feedback: 0,
                submission_rate: 0,
                matched_feedback: 0,
                partially_matched_feedback: 0,
                missed_feedback: 0,
                rewarded_feedback: 0,
                reward_coins_granted: 0,
                invite_reward_band_counts: { '3': 0, '4': 0, '5': 0 },
                reward_band_quality: {
                  '3': { rewarded_feedback: 0, matched: 0, partially_matched: 0, missed: 0, match_rate: 0, miss_rate: 0 },
                  '4': { rewarded_feedback: 0, matched: 0, partially_matched: 0, missed: 0, match_rate: 0, miss_rate: 0 },
                  '5': { rewarded_feedback: 0, matched: 0, partially_matched: 0, missed: 0, match_rate: 0, miss_rate: 0 },
                },
                reward_band_insight: {
                  five_vs_three_match_rate_delta: 0,
                  five_vs_four_match_rate_delta: 0,
                  five_vs_three_miss_rate_delta: 0,
                  five_vs_four_miss_rate_delta: 0,
                  recommendation: '暂无足够返币样本可比较。',
                },
                pending_threads: [],
                recent_feedback: [],
              },
              missing_relation: true,
            },
          })
        }
        throw statsResult.error
      }
      if (deliveredCountResult.error) throw deliveredCountResult.error
      if (rewardLedgerResult.error && !isMissingRelation(rewardLedgerResult.error)) throw rewardLedgerResult.error
      if (deliveredRowsResult.error) throw deliveredRowsResult.error

      const verdictCounts = new Map<string, number>()
      const failedStepCounts = new Map<string, number>()
      const failedSupportCounts = new Map<string, number>()
      const failureTagCounts = new Map<string, number>()
      const questionTypeCounts = new Map<string, number>()
      const questionTypeStepCounts = new Map<string, Map<string, number>>()
      const questionTypeTagCounts = new Map<string, Map<string, number>>()

      for (const row of (statsResult.data ?? []) as Array<Record<string, unknown>>) {
        const verdict = cleanString(row.verdict) ?? 'pending'
        verdictCounts.set(verdict, (verdictCounts.get(verdict) ?? 0) + 1)
        const questionType = cleanString(row.question_type) ?? 'unknown'
        questionTypeCounts.set(questionType, (questionTypeCounts.get(questionType) ?? 0) + 1)

        const failedStep = cleanString(row.failed_step)
        if (failedStep) {
          failedStepCounts.set(failedStep, (failedStepCounts.get(failedStep) ?? 0) + 1)
          const perType = questionTypeStepCounts.get(questionType) ?? new Map<string, number>()
          perType.set(failedStep, (perType.get(failedStep) ?? 0) + 1)
          questionTypeStepCounts.set(questionType, perType)
        }

        const failedSupportId = cleanString(row.failed_support_id)
        if (failedSupportId) failedSupportCounts.set(failedSupportId, (failedSupportCounts.get(failedSupportId) ?? 0) + 1)

        const tags = Array.isArray(row.failure_tags) ? row.failure_tags : []
        for (const tag of tags) {
          const normalized = cleanString(tag)
          if (normalized) {
            failureTagCounts.set(normalized, (failureTagCounts.get(normalized) ?? 0) + 1)
            const perTypeTags = questionTypeTagCounts.get(questionType) ?? new Map<string, number>()
            perTypeTags.set(normalized, (perTypeTags.get(normalized) ?? 0) + 1)
            questionTypeTagCounts.set(questionType, perTypeTags)
          }
        }
      }

      const teacherScoreResult = await supabase
        .from('qimen_teacher_question_type_scores')
        .select('teacher_id,question_type,runs,majority_match_count,teacher_conclusion_match_count,feedback_match_count,partially_matched_count,missed_count,score,status,updated_at')
        .order('question_type', { ascending: true })
        .order('score', { ascending: false })
      let teacherQuestionTypeScores: Array<Record<string, unknown>> = []
      if (teacherScoreResult.error) {
        if (!isMissingRelation(teacherScoreResult.error)) throw teacherScoreResult.error
      } else {
        teacherQuestionTypeScores = (teacherScoreResult.data ?? []) as Array<Record<string, unknown>>
      }

      const eligibleDelivered = deliveredCountResult.count ?? 0
      const submittedFeedback = (statsResult.data ?? []).length
      const matchedFeedback = verdictCounts.get('matched') ?? 0
      const partiallyMatchedFeedback = verdictCounts.get('partially_matched') ?? 0
      const missedFeedback = verdictCounts.get('missed') ?? 0
      const feedbackThreadIds = new Set(
        ((statsResult.data ?? []) as Array<Record<string, unknown>>)
          .map((row) => cleanString(row.thread_id))
          .filter((value): value is string => Boolean(value)),
      )
      const rewardRows = Array.isArray(rewardLedgerResult.data) ? rewardLedgerResult.data : []
      const rewardByThreadId = new Map<string, { claimed: boolean; delta: number; created_at: unknown }>()
      for (const row of rewardRows as Array<Record<string, unknown>>) {
        const threadId = cleanString(row.source_ref)
        if (!threadId) continue
        rewardByThreadId.set(threadId, {
          claimed: true,
          delta: Math.max(0, Math.abs(Number(row.delta ?? 0))),
          created_at: row.created_at ?? null,
        })
      }
      const rewardedFeedback = rewardRows.length
      const rewardCoinsGranted = rewardRows.reduce((sum: number, row: Record<string, unknown>) => {
        return sum + Math.max(0, Math.abs(Number(row.delta ?? 0)))
      }, 0)
      const rewardedVerdictCounts = new Map<string, number>()
      const unrewardedVerdictCounts = new Map<string, number>()
      for (const row of ((statsResult.data ?? []) as Array<Record<string, unknown>>)) {
        const threadId = cleanString(row.thread_id)
        const verdict = cleanString(row.verdict) ?? 'pending'
        if (threadId && rewardByThreadId.has(threadId)) {
          rewardedVerdictCounts.set(verdict, (rewardedVerdictCounts.get(verdict) ?? 0) + 1)
        } else {
          unrewardedVerdictCounts.set(verdict, (unrewardedVerdictCounts.get(verdict) ?? 0) + 1)
        }
      }
      const unrewardedFeedback = Math.max(0, submittedFeedback - rewardedFeedback)
      const deliveredRows = Array.isArray(deliveredRowsResult.data)
        ? (deliveredRowsResult.data as Array<Record<string, unknown>>)
        : []
      const deliveredThreadIds = deliveredRows
        .map((row) => cleanString(row.id))
        .filter((value): value is string => Boolean(value))
      const deliveredEventResult = deliveredThreadIds.length
        ? await supabase
          .from('master_events')
          .select('question_id,payload_json,created_at')
          .eq('event_type', 'delivered')
          .in('question_id', deliveredThreadIds)
          .order('created_at', { ascending: false })
        : { data: [] as Array<Record<string, unknown>>, error: null }
      if ('error' in deliveredEventResult && deliveredEventResult.error) throw deliveredEventResult.error
      const deliveredPayloadByThreadId = new Map<string, Record<string, unknown>>()
      for (const row of ((deliveredEventResult.data ?? []) as Array<Record<string, unknown>>)) {
        const threadId = cleanString(row.question_id)
        if (!threadId || deliveredPayloadByThreadId.has(threadId)) continue
        deliveredPayloadByThreadId.set(threadId, (row.payload_json ?? {}) as Record<string, unknown>)
      }
      const feedbackByThreadId = new Map(
        ((statsResult.data ?? []) as Array<Record<string, unknown>>)
          .map((row) => [String(row.thread_id ?? ''), row] as const)
          .filter(([threadId]) => Boolean(threadId)),
      )
      const deliveredUserIds = Array.from(
        new Set(
          deliveredRows
            .map((row) => cleanString(row.user_id))
            .filter((value): value is string => Boolean(value)),
        ),
      )
      const userQuestionRowsResult = deliveredUserIds.length
        ? await supabase
          .from('master_questions')
          .select('user_id,divination_system,status')
          .in('user_id', deliveredUserIds)
        : { data: [] as Array<Record<string, unknown>>, error: null }
      if ('error' in userQuestionRowsResult && userQuestionRowsResult.error) throw userQuestionRowsResult.error
      const userUsageById = new Map<string, { total: number; delivered_qimen: number }>()
      for (const row of ((userQuestionRowsResult.data ?? []) as Array<Record<string, unknown>>)) {
        const userId = cleanString(row.user_id)
        if (!userId) continue
        const current = userUsageById.get(userId) ?? { total: 0, delivered_qimen: 0 }
        current.total += 1
        if (cleanString(row.divination_system) === 'qimen_yang' && cleanString(row.status) === 'delivered') {
          current.delivered_qimen += 1
        }
        userUsageById.set(userId, current)
      }
      const invitePolicies = await Promise.all(
        deliveredRows.map(async (row) => {
          const userId = cleanString(row.user_id)
          const usage = userId ? userUsageById.get(userId) ?? { total: 0, delivered_qimen: 0 } : { total: 0, delivered_qimen: 0 }
          const threadId = String(row.id ?? '')
          const persistedInvite = extractPersistedQimenFeedbackInviteSnapshot(
            deliveredPayloadByThreadId.get(threadId) ?? null,
          )
          const policy = persistedInvite?.policy ?? await buildQimenFeedbackInvitePolicy({
            question_text: cleanString(row.question_text) ?? '',
            question_type: cleanString(row.category),
            delivered_qimen_count: usage.delivered_qimen,
            total_question_count: usage.total,
            has_existing_feedback: feedbackByThreadId.has(threadId),
          })
          return { id: threadId, policy }
        }),
      )
      const invitePolicyByThreadId = new Map(invitePolicies.map((item) => [item.id, item.policy]))
      let invitedDelivered = 0
      const inviteRewardBandCounts = { '3': 0, '4': 0, '5': 0 } as Record<string, number>
      for (const item of invitePolicies) {
        if (!item.policy.invited) continue
        invitedDelivered += 1
        const bandKey = String(item.policy.reward_coins)
        if (bandKey in inviteRewardBandCounts) inviteRewardBandCounts[bandKey] += 1
      }
      const rewardBandQuality = {
        '3': { rewarded_feedback: 0, matched: 0, partially_matched: 0, missed: 0, match_rate: 0, miss_rate: 0 },
        '4': { rewarded_feedback: 0, matched: 0, partially_matched: 0, missed: 0, match_rate: 0, miss_rate: 0 },
        '5': { rewarded_feedback: 0, matched: 0, partially_matched: 0, missed: 0, match_rate: 0, miss_rate: 0 },
      } as Record<string, { rewarded_feedback: number; matched: number; partially_matched: number; missed: number; match_rate: number; miss_rate: number }>
      for (const row of rewardRows as Array<Record<string, unknown>>) {
        const bandKey = String(Math.max(0, Math.abs(Number(row.delta ?? 0))))
        if (!(bandKey in rewardBandQuality)) continue
        const threadId = cleanString(row.source_ref)
        const feedbackRow = threadId ? feedbackByThreadId.get(threadId) ?? null : null
        rewardBandQuality[bandKey].rewarded_feedback += 1
        const verdict = cleanString(feedbackRow?.verdict) ?? 'pending'
        if (verdict === 'matched') rewardBandQuality[bandKey].matched += 1
        if (verdict === 'partially_matched') rewardBandQuality[bandKey].partially_matched += 1
        if (verdict === 'missed') rewardBandQuality[bandKey].missed += 1
      }
      for (const bandKey of Object.keys(rewardBandQuality)) {
        const count = rewardBandQuality[bandKey].rewarded_feedback
        rewardBandQuality[bandKey].match_rate = count > 0 ? Number((rewardBandQuality[bandKey].matched / count).toFixed(4)) : 0
        rewardBandQuality[bandKey].miss_rate = count > 0 ? Number((rewardBandQuality[bandKey].missed / count).toFixed(4)) : 0
      }
      const fiveVsThreeMatchRateDelta = Number(
        ((rewardBandQuality['5'].match_rate ?? 0) - (rewardBandQuality['3'].match_rate ?? 0)).toFixed(4),
      )
      const fiveVsFourMatchRateDelta = Number(
        ((rewardBandQuality['5'].match_rate ?? 0) - (rewardBandQuality['4'].match_rate ?? 0)).toFixed(4),
      )
      const fiveVsThreeMissRateDelta = Number(
        ((rewardBandQuality['5'].miss_rate ?? 0) - (rewardBandQuality['3'].miss_rate ?? 0)).toFixed(4),
      )
      const fiveVsFourMissRateDelta = Number(
        ((rewardBandQuality['5'].miss_rate ?? 0) - (rewardBandQuality['4'].miss_rate ?? 0)).toFixed(4),
      )
      const rewardBandInsightRecommendation =
        rewardBandQuality['5'].rewarded_feedback < 3
          ? '5 coins 返币样本仍偏少，先继续只投最稀缺和最高不确定性问题。'
          : fiveVsThreeMatchRateDelta > 0.08 &&
              fiveVsFourMatchRateDelta > 0.05 &&
              fiveVsThreeMissRateDelta <= 0.03 &&
              fiveVsFourMissRateDelta <= 0.03
            ? '5 coins 档位目前明显优于 3/4 coins，可继续保留给样本稀缺且不确定性高的问题。'
            : '5 coins 档位暂未明显优于 3/4 coins，建议继续只给最稀缺样本，不要扩大。'
      const pendingRows = deliveredRows.filter((row) => !feedbackThreadIds.has(String(row.id ?? '')))
      const pendingUserIds = Array.from(
        new Set(
          pendingRows
            .map((row) => cleanString(row.user_id))
            .filter((value): value is string => Boolean(value)),
        ),
      )
      const usersResult = pendingUserIds.length
        ? await supabase.from('users').select('id,email').in('id', pendingUserIds)
        : { data: [] as Array<Record<string, unknown>>, error: null }
      if ('error' in usersResult && usersResult.error) throw usersResult.error
      const userById = new Map(
        ((usersResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [
          String(row.id ?? ''),
          cleanString(row.email),
        ]),
      )
      const recentFeedbackRows = [...((statsResult.data ?? []) as Array<Record<string, unknown>>)]
        .sort((a, b) => {
          const aTime = Date.parse(String(a.updated_at ?? '')) || 0
          const bTime = Date.parse(String(b.updated_at ?? '')) || 0
          return bTime - aTime
        })
        .slice(0, 20)
      const recentFeedbackThreadIds = Array.from(
        new Set(
          recentFeedbackRows
            .map((row) => cleanString(row.thread_id))
            .filter((value): value is string => Boolean(value)),
        ),
      )
      const recentThreadResult = recentFeedbackThreadIds.length
        ? await supabase
          .from('master_questions')
          .select('id,user_id,question_text,category,divination_profile,created_at,delivered_at')
          .in('id', recentFeedbackThreadIds)
        : { data: [] as Array<Record<string, unknown>>, error: null }
      if ('error' in recentThreadResult && recentThreadResult.error) throw recentThreadResult.error
      const recentThreadById = new Map(
        ((recentThreadResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id ?? ''), row]),
      )
      const recentFeedbackUserIds = Array.from(
        new Set(
          recentFeedbackRows
            .map((row) => {
              const threadId = cleanString(row.thread_id)
              if (!threadId) return null
              const thread = recentThreadById.get(threadId) ?? null
              return cleanString(thread?.user_id)
            })
            .filter((value): value is string => Boolean(value)),
        ),
      )
      const missingRecentUserIds = recentFeedbackUserIds.filter((userId) => !userById.has(userId))
      if (missingRecentUserIds.length > 0) {
        const recentUsersResult = await supabase.from('users').select('id,email').in('id', missingRecentUserIds)
        if (recentUsersResult.error) throw recentUsersResult.error
        for (const row of ((recentUsersResult.data ?? []) as Array<Record<string, unknown>>)) {
          userById.set(String(row.id ?? ''), cleanString(row.email) ?? null)
        }
      }

      return json({
        stats: {
          total_feedback: (statsResult.data ?? []).length,
          member_feedback: {
            eligible_delivered: eligibleDelivered,
            invited_delivered: invitedDelivered,
            invitation_rate: eligibleDelivered > 0 ? Number((invitedDelivered / eligibleDelivered).toFixed(4)) : 0,
            submitted_feedback: submittedFeedback,
            submission_rate: eligibleDelivered > 0 ? Number((submittedFeedback / eligibleDelivered).toFixed(4)) : 0,
            matched_feedback: matchedFeedback,
            partially_matched_feedback: partiallyMatchedFeedback,
            missed_feedback: missedFeedback,
            rewarded_feedback: rewardedFeedback,
            reward_coins_granted: rewardCoinsGranted,
            invite_reward_band_counts: inviteRewardBandCounts,
            reward_band_quality: rewardBandQuality,
            reward_band_insight: {
              five_vs_three_match_rate_delta: fiveVsThreeMatchRateDelta,
              five_vs_four_match_rate_delta: fiveVsFourMatchRateDelta,
              five_vs_three_miss_rate_delta: fiveVsThreeMissRateDelta,
              five_vs_four_miss_rate_delta: fiveVsFourMissRateDelta,
              recommendation: rewardBandInsightRecommendation,
            },
            rewarded_verdicts: {
              matched: rewardedVerdictCounts.get('matched') ?? 0,
              partially_matched: rewardedVerdictCounts.get('partially_matched') ?? 0,
              missed: rewardedVerdictCounts.get('missed') ?? 0,
            },
            rewarded_match_rate:
              rewardedFeedback > 0
                ? Number(((rewardedVerdictCounts.get('matched') ?? 0) / rewardedFeedback).toFixed(4))
                : 0,
            rewarded_miss_rate:
              rewardedFeedback > 0
                ? Number(((rewardedVerdictCounts.get('missed') ?? 0) / rewardedFeedback).toFixed(4))
                : 0,
            unrewarded_match_rate:
              unrewardedFeedback > 0
                ? Number(((unrewardedVerdictCounts.get('matched') ?? 0) / unrewardedFeedback).toFixed(4))
                : 0,
            unrewarded_miss_rate:
              unrewardedFeedback > 0
                ? Number(((unrewardedVerdictCounts.get('missed') ?? 0) / unrewardedFeedback).toFixed(4))
                : 0,
            rewarded_match_rate_delta: Number(
              (
                (rewardedFeedback > 0
                  ? (rewardedVerdictCounts.get('matched') ?? 0) / rewardedFeedback
                  : 0) -
                (unrewardedFeedback > 0
                  ? (unrewardedVerdictCounts.get('matched') ?? 0) / unrewardedFeedback
                  : 0)
              ).toFixed(4),
            ),
            rewarded_miss_rate_delta: Number(
              (
                (rewardedFeedback > 0
                  ? (rewardedVerdictCounts.get('missed') ?? 0) / rewardedFeedback
                  : 0) -
                (unrewardedFeedback > 0
                  ? (unrewardedVerdictCounts.get('missed') ?? 0) / unrewardedFeedback
                  : 0)
              ).toFixed(4),
            ),
            coins_per_rewarded_match:
              (rewardedVerdictCounts.get('matched') ?? 0) > 0
                ? Number((rewardCoinsGranted / (rewardedVerdictCounts.get('matched') ?? 1)).toFixed(2))
                : null,
            pending_threads: pendingRows.slice(0, 20).map((row) => ({
              id: row.id,
              user_id: row.user_id,
              email: userById.get(String(row.user_id ?? '')) ?? null,
              question_text: row.question_text,
              category: row.category,
              divination_profile: row.divination_profile,
              created_at: row.created_at,
              delivered_at: row.delivered_at,
              invited: invitePolicyByThreadId.get(String(row.id ?? ''))?.invited ?? false,
              reward_coins: invitePolicyByThreadId.get(String(row.id ?? ''))?.reward_coins ?? 0,
            })),
            recent_feedback: recentFeedbackRows.map((row) => {
              const threadId = String(row.thread_id ?? '')
              const thread = recentThreadById.get(threadId) ?? {}
              const reward = rewardByThreadId.get(threadId) ?? null
              return {
                thread_id: threadId,
                user_id: thread.user_id ?? null,
                email: userById.get(String(thread.user_id ?? '')) ?? null,
                question_text: thread.question_text ?? null,
                category: thread.category ?? null,
                divination_profile: thread.divination_profile ?? null,
                delivered_at: thread.delivered_at ?? null,
                verdict: row.verdict ?? 'pending',
                user_feedback: row.user_feedback ?? null,
                failed_step: row.failed_step ?? null,
                reward_claimed: reward?.claimed ?? false,
                reward_coins: reward?.delta ?? 0,
                reward_claimed_at: reward?.created_at ?? null,
                updated_at: row.updated_at ?? null,
              }
            }),
          },
          verdicts: Array.from(verdictCounts.entries()).map(([key, count]) => ({ key, count })),
          by_question_type: Array.from(questionTypeCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => ({
              key,
              count,
              failed_steps: Array.from((questionTypeStepCounts.get(key) ?? new Map<string, number>()).entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([step, stepCount]) => ({ key: step, count: stepCount })),
              failure_tags: Array.from((questionTypeTagCounts.get(key) ?? new Map<string, number>()).entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([tag, tagCount]) => ({ key: tag, count: tagCount })),
            })),
          failed_steps: Array.from(failedStepCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([key, count]) => ({ key, count })),
          failed_supports: Array.from(failedSupportCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([key, count]) => ({ key, count })),
          failure_tags: Array.from(failureTagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([key, count]) => ({ key, count })),
          teacher_question_type_scores: teacherQuestionTypeScores,
        },
      })
    }

    if (action === 'routing_report') {
      const roleError = requireRole(adminContext.role, ['super_admin', 'operator', 'reviewer'])
      if (roleError) return roleError
      const report = await loadQimenTeacherRoutingReport()
      return json({ report })
    }

    if (!threadId) return json({ error: 'thread_id is required' }, 400)

    if (req.method === 'POST' && action === 'save') {
      const roleError = requireRole(adminContext.role, ['super_admin', 'operator', 'reviewer'])
      if (roleError) return roleError

      const threadResult = await supabase
        .from('master_questions')
        .select('id,user_id,divination_system,divination_profile')
        .eq('id', threadId)
        .maybeSingle()
      if (threadResult.error) throw threadResult.error
      if (!threadResult.data) return json({ error: 'Thread not found' }, 404)

      const verdict = cleanString(body.verdict) ?? 'pending'
      if (!['pending', 'matched', 'partially_matched', 'missed'].includes(verdict)) {
        return json({ error: 'Unsupported verdict' }, 400)
      }

      const payload = {
        thread_id: threadId,
        user_id: threadResult.data.user_id,
        divination_system: threadResult.data.divination_system ?? 'qimen_yang',
        question_type: cleanString(body.question_type),
        system_profile: cleanString(body.system_profile) ?? threadResult.data.divination_profile ?? null,
        teacher_conclusion: cleanString(body.teacher_conclusion),
        user_feedback: cleanString(body.user_feedback),
        verdict,
        failed_step: cleanString(body.failed_step),
        failed_support_id: cleanString(body.failed_support_id),
        failure_summary: cleanString(body.failure_summary),
        failure_tags: parseFailureTags(body.failure_tags),
        operator_notes: cleanString(body.operator_notes),
        reviewed_by: adminContext.user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const upsertResult = await supabase
        .from('qimen_outcome_feedback')
        .upsert(payload, { onConflict: 'thread_id' })
        .select('*')
        .maybeSingle()
      if (upsertResult.error) throw upsertResult.error
      await rebuildTeacherQuestionTypeScores(supabase)
      return json({ feedback: upsertResult.data })
    }

    const feedbackResult = await supabase
      .from('qimen_outcome_feedback')
      .select('*')
      .eq('thread_id', threadId)
      .maybeSingle()
    if (feedbackResult.error) {
      if (isMissingRelation(feedbackResult.error)) {
        return json({ feedback: null, missing_relation: true })
      }
      throw feedbackResult.error
    }

    return json({ feedback: feedbackResult.data })
  } catch (error) {
    return json({ error: formatError(error) }, 400)
  }
})
