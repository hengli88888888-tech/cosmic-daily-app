import { dirname, fromFileUrl, join } from 'https://deno.land/std@0.224.0/path/mod.ts'

import { detectQuestionType, shouldRunQimenGrayTeachers } from './qimen-reasoning-engine.ts'

const ROOT = join(dirname(fromFileUrl(import.meta.url)), '..', '..', '..', '..')
const QIMEN_TEACHER_ROUTING_REPORT_PATH = join(
  ROOT,
  'data',
  'import-runs',
  'qimen-yangpan',
  'qimen-teacher-routing-report.json',
)

const MIN_REWARD_COINS = 3
const MAX_REWARD_COINS = 5

type RoutingQuestionTypeRow = {
  question_type?: string
  total_cases?: number
  recommendation?: {
    mode?: string
    reason?: string
  }
}

type RoutingReport = {
  by_question_type?: RoutingQuestionTypeRow[]
}

export type QimenFeedbackInvitePolicy = {
  invited: boolean
  reward_coins: number
  question_type: string
  score: number
  user_usage_bucket: 'light' | 'engaged' | 'power'
  uncertainty_bucket: 'stable' | 'gray' | 'environmental_gray'
  sample_bucket: 'strong' | 'medium' | 'scarce' | 'unknown'
  sample_total_cases: number | null
  reasons: string[]
  invitation_reason: string
}

export type QimenFeedbackInviteSnapshot = {
  invited: boolean
  reward_coins: number
  invitation_reason: string
  policy: QimenFeedbackInvitePolicy
}

let cachedRoutingReport: RoutingReport | null = null

async function loadRoutingReport() {
  if (cachedRoutingReport) return cachedRoutingReport
  try {
    const raw = await Deno.readTextFile(QIMEN_TEACHER_ROUTING_REPORT_PATH)
    cachedRoutingReport = JSON.parse(raw) as RoutingReport
  } catch {
    cachedRoutingReport = {}
  }
  return cachedRoutingReport
}

function clampReward(value: number) {
  return Math.max(MIN_REWARD_COINS, Math.min(MAX_REWARD_COINS, value))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asString(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function asNumber(value: unknown): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  return null
}

export function extractPersistedQimenFeedbackInviteSnapshot(payload: unknown): QimenFeedbackInviteSnapshot | null {
  const root = asRecord(payload)
  const invite = asRecord(root?.feedback_invite)
  const policyRecord = asRecord(invite?.policy)
  if (!invite || !policyRecord) return null

  const invited = asBoolean(invite.invited)
  const rewardCoins = asNumber(invite.reward_coins)
  const invitationReason = asString(invite.invitation_reason)
  const questionType = asString(policyRecord.question_type)
  const score = asNumber(policyRecord.score)
  const userUsageBucket = asString(policyRecord.user_usage_bucket)
  const uncertaintyBucket = asString(policyRecord.uncertainty_bucket)
  const sampleBucket = asString(policyRecord.sample_bucket)
  const sampleTotalCases = policyRecord.sample_total_cases == null
    ? null
    : asNumber(policyRecord.sample_total_cases)
  const reasons = Array.isArray(policyRecord.reasons)
    ? policyRecord.reasons.map((value) => asString(value)).filter((value): value is string => Boolean(value))
    : []

  if (
    invited == null ||
    rewardCoins == null ||
    !invitationReason ||
    !questionType ||
    score == null ||
    (userUsageBucket !== 'light' && userUsageBucket !== 'engaged' && userUsageBucket !== 'power') ||
    (uncertaintyBucket !== 'stable' && uncertaintyBucket !== 'gray' && uncertaintyBucket !== 'environmental_gray') ||
    (sampleBucket !== 'strong' && sampleBucket !== 'medium' && sampleBucket !== 'scarce' && sampleBucket !== 'unknown')
  ) {
    return null
  }

  const policy: QimenFeedbackInvitePolicy = {
    invited,
    reward_coins: rewardCoins,
    question_type: questionType,
    score,
    user_usage_bucket: userUsageBucket,
    uncertainty_bucket: uncertaintyBucket,
    sample_bucket: sampleBucket,
    sample_total_cases: sampleTotalCases,
    reasons,
    invitation_reason: invitationReason,
  }

  return {
    invited,
    reward_coins: rewardCoins,
    invitation_reason: invitationReason,
    policy,
  }
}

export async function buildQimenFeedbackInvitePolicy(input: {
  question_text: string
  question_type?: string | null
  delivered_qimen_count?: number
  total_question_count?: number
  has_existing_feedback?: boolean
}) {
  const questionText = String(input.question_text ?? '').trim()
  const rawQuestionType = String(input.question_type ?? '').trim()
  const detectedQuestionType = detectQuestionType(questionText)
  let questionType = rawQuestionType || detectedQuestionType
  const deliveredQimenCount = Number(input.delivered_qimen_count ?? 0)
  const totalQuestionCount = Number(input.total_question_count ?? 0)
  const hasExistingFeedback = input.has_existing_feedback === true

  const routingReport = await loadRoutingReport()
  const knownTypes = new Set((routingReport.by_question_type ?? []).map((item) => String(item.question_type ?? '').trim()).filter(Boolean))
  if (!knownTypes.has(questionType) && knownTypes.has(detectedQuestionType)) {
    questionType = detectedQuestionType
  }
  const routingRow =
    ((routingReport.by_question_type ?? []).find((item) => String(item.question_type ?? '') === questionType) ??
      null) as RoutingQuestionTypeRow | null
  const sampleTotalCases =
    typeof routingRow?.total_cases === 'number' && Number.isFinite(routingRow.total_cases)
      ? routingRow.total_cases
      : null

  const grayPolicy = shouldRunQimenGrayTeachers(questionType, questionText)
  const uncertaintyBucket: QimenFeedbackInvitePolicy['uncertainty_bucket'] = grayPolicy.enabled
    ? questionType === 'love_relationship'
      ? 'gray'
      : 'environmental_gray'
    : 'stable'

  const userUsageBucket: QimenFeedbackInvitePolicy['user_usage_bucket'] =
    deliveredQimenCount >= 8 || totalQuestionCount >= 12
      ? 'power'
      : deliveredQimenCount >= 3 || totalQuestionCount >= 6
        ? 'engaged'
        : 'light'

  const sampleBucket: QimenFeedbackInvitePolicy['sample_bucket'] =
    sampleTotalCases == null
      ? 'unknown'
      : sampleTotalCases < 45
        ? 'scarce'
        : sampleTotalCases < 55
          ? 'medium'
          : 'strong'

  let score = 0
  const reasons: string[] = []

  if (userUsageBucket === 'engaged' || userUsageBucket === 'power') {
    score += 1
    reasons.push('engaged_user')
  }

  if (uncertaintyBucket === 'gray') {
    score += 2
    reasons.push('high_uncertainty')
  } else if (uncertaintyBucket === 'environmental_gray') {
    score += 1
    reasons.push('edge_case_uncertainty')
  }

  if (sampleBucket === 'scarce' || sampleBucket === 'unknown') {
    score += 2
    reasons.push('scarce_samples')
  } else if (sampleBucket === 'medium') {
    score += 1
    reasons.push('medium_samples')
  }

  if (userUsageBucket === 'power') {
    score += 1
    reasons.push('power_user')
  }

  const invited = hasExistingFeedback || score >= 2

  let rewardCoins = MIN_REWARD_COINS
  if (invited) {
    if (uncertaintyBucket !== 'stable') rewardCoins += 1
    if (sampleBucket === 'scarce' || sampleBucket === 'unknown') rewardCoins += 1
    else if (sampleBucket === 'medium' && userUsageBucket === 'power') rewardCoins += 1
    rewardCoins = clampReward(rewardCoins)
  } else {
    rewardCoins = 0
  }

  const invitationReason = hasExistingFeedback
    ? '这条问题已经进入反馈学习链，仍然允许继续更新后验结果。'
    : !invited
      ? '这条问题当前不在优先返币邀请池里。'
      : uncertaintyBucket !== 'stable' && (sampleBucket === 'scarce' || sampleBucket === 'unknown')
        ? '这条问题既带不确定性，又属于样本稀缺题型，优先返币邀请。'
        : uncertaintyBucket !== 'stable'
          ? '这条问题存在较高判断不确定性，优先返币邀请。'
          : sampleBucket === 'scarce' || sampleBucket === 'unknown'
            ? '这条问题所属题型样本偏少，优先返币邀请。'
            : '这条问题命中了当前的高价值反馈邀请条件。'

  return {
    invited,
    reward_coins: rewardCoins,
    question_type: questionType,
    score,
    user_usage_bucket: userUsageBucket,
    uncertainty_bucket: uncertaintyBucket,
    sample_bucket: sampleBucket,
    sample_total_cases: sampleTotalCases,
    reasons,
    invitation_reason: invitationReason,
  } satisfies QimenFeedbackInvitePolicy
}
