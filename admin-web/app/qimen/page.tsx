'use client'

import { useEffect, useState } from 'react'

import { AdminShell } from '@/components/admin-shell'
import { AuthGuard } from '@/components/auth-guard'
import { adminApi } from '@/lib/admin-api'

function displayValue(value: unknown) {
  const text = String(value ?? '').trim()
  return text.length === 0 ? '—' : text
}

function preferredQimenLayout(chart: Record<string, any> | null | undefined) {
  const webStyle = String(chart?.web_style_layout ?? '').trim()
  if (webStyle) return webStyle
  const china95Style = String(chart?.china95_style_layout ?? '').trim()
  return china95Style
}

function chineseQuestionType(value: string | null | undefined) {
  switch (value) {
    case 'career_work':
      return '事业工作'
    case 'love_relationship':
      return '感情婚姻'
    case 'money_wealth':
      return '财运合作'
    case 'health_energy':
      return '健康身体'
    default:
      return displayValue(value)
  }
}

function chineseTraceKind(value: string | null | undefined) {
  switch (value) {
    case 'video-derived':
      return '视频证据'
    case 'document-derived':
      return '文字资料'
    case 'chart-derived':
      return '盘面证据'
    default:
      return displayValue(value)
  }
}

function chineseKnowledgeTier(value: string | null | undefined) {
  switch (value) {
    case 'core':
      return '主判断'
    case 'support':
      return '辅助校准'
    case 'reference':
      return '背景参考'
    default:
      return displayValue(value)
  }
}

function chainCoverageLabel(value: string | null | undefined) {
  switch (value) {
    case 'full':
      return '完整'
    case 'strong':
      return '较完整'
    case 'partial':
      return '部分完整'
    case 'thin':
      return '偏薄'
    default:
      return displayValue(value)
  }
}

function consensusLevelLabel(value: string | null | undefined) {
  switch (value) {
    case 'early_match':
      return '前两位同向'
    case 'late_match':
      return '扩跑后形成多数'
    case 'split':
      return '多流派分歧'
    default:
      return displayValue(value)
  }
}

function teacherScoreStatusLabel(value: string | null | undefined) {
  switch (value) {
    case 'active':
      return '活跃'
    case 'downranked':
      return '下调中'
    case 'muted':
      return '已静音'
    default:
      return displayValue(value)
  }
}

function chainLayerLabel(value: string) {
  switch (value) {
    case 'rules':
      return '规则'
    case 'cases':
      return '案例'
    case 'patterns':
      return '路径'
    case 'terms':
      return '术语'
    case 'conflicts':
      return '冲突'
    default:
      return displayValue(value)
  }
}

function chainLayerSummary(layer: Record<string, any> | null | undefined) {
  if (!layer) return '—'
  return `共${displayValue(layer.total)} · 主${displayValue(layer.core)} / 辅${displayValue(layer.support)} / 参${displayValue(layer.reference)}`
}

function tierOriginLabel(item: Record<string, any>) {
  const override = (item.tier_override ?? null) as Record<string, any> | null
  if (!override?.applied) return null
  const originalTier = String(item.original_knowledge_tier ?? '').trim()
  const currentTier = String(item.knowledge_tier ?? '').trim()
  if (originalTier && currentTier && originalTier !== currentTier) {
    return `已正式降级：${chineseKnowledgeTier(originalTier)} -> ${chineseKnowledgeTier(currentTier)}`
  }
  return '已应用层级覆写'
}

function groupByKnowledgeTier(items: Record<string, any>[] | undefined) {
  const rows = Array.isArray(items) ? items : []
  return {
    core: rows.filter((item) => String(item.knowledge_tier ?? '') === 'core'),
    support: rows.filter((item) => String(item.knowledge_tier ?? '') === 'support'),
    reference: rows.filter((item) => String(item.knowledge_tier ?? '') === 'reference'),
  }
}

function documentSupportItems(items: Record<string, any>[] | undefined) {
  const rows = Array.isArray(items) ? items : []
  return rows.filter((item) => String(item.source_type ?? '') === 'document')
}

function foundationSupportLabel(
  item: Record<string, any>,
  foundationTheorySupport: Record<string, any> | null,
) {
  if (!foundationTheorySupport) return null
  const itemId = String(item.id ?? '')
  const lessons = Array.isArray(foundationTheorySupport.lessons) ? foundationTheorySupport.lessons : []
  for (const lesson of lessons) {
    const ids = Array.isArray(lesson?.matched_support_ids) ? lesson.matched_support_ids.map((value: unknown) => String(value)) : []
    if (ids.includes(itemId)) return '理论基础支撑'
  }
  return null
}

function supportBoostLabel(
  questionType: string | null | undefined,
  item: Record<string, any>,
  supportSignals: Record<string, any> | null,
) {
  if (!supportSignals) return null
  const itemId = String(item.id ?? '')
  const yearBoosted = Array.isArray(supportSignals.year_ming?.boosted_support_ids)
    ? supportSignals.year_ming.boosted_support_ids.map((value: unknown) => String(value))
    : []
  const cycleBoosted = Array.isArray(supportSignals.long_cycle?.boosted_support_ids)
    ? supportSignals.long_cycle.boosted_support_ids.map((value: unknown) => String(value))
    : []
  if (
    questionType === 'love_relationship' &&
    (supportSignals.year_ming?.self_year_ming || supportSignals.year_ming?.counterpart_year_ming) &&
    yearBoosted.includes(itemId)
  ) {
    return '关系年命抬权'
  }
  if (
    (questionType === 'career_work' || questionType === 'money_wealth') &&
    (supportSignals.long_cycle?.current_liu_nian || supportSignals.long_cycle?.current_dayun) &&
    cycleBoosted.includes(itemId)
  ) {
    return '长期趋势抬权'
  }
  return null
}

function documentSupportLabel(item: Record<string, any>) {
  if (String(item.source_type ?? '') !== 'document') return null
  const traceKind = String(item.trace_kind ?? '')
  if (traceKind === 'term') return '文档术语校正'
  if (traceKind === 'conflict') return '文档冲突说明'
  return '文档补边命中'
}

function teacherRunDecisionLabel(run: Record<string, any>) {
  const normalized = (run.normalized_decision ?? null) as Record<string, any> | null
  const label = String(normalized?.label ?? '').trim()
  const timing = String(normalized?.timing_bucket ?? '').trim()
  if (label && timing && timing !== 'mixed') return `${label} / ${timing}`
  if (label) return label
  return displayValue(run.main_judgment)
}

function shortIso(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return '—'
  return text.replace('T', ' ').slice(0, 16)
}

function memberFeedbackVerdictLabel(value: string | null | undefined) {
  switch (value) {
    case 'matched':
      return '命中'
    case 'partially_matched':
      return '部分命中'
    case 'missed':
      return '未命中'
    default:
      return displayValue(value)
  }
}

function failedStepLabel(value: string | null | undefined) {
  switch (value) {
    case 'question_route':
      return 'question_route'
    case 'decision_compose':
      return 'decision_compose'
    case 'timing':
      return 'timing'
    case 'support_select':
      return 'support_select'
    default:
      return displayValue(value)
  }
}

function signedPercent(value: unknown) {
  const number = Number(value ?? 0) * 100
  const sign = number > 0 ? '+' : ''
  return `${sign}${number.toFixed(1)}%`
}

function pendingThreadPriority(item: Record<string, any>) {
  const category = String(item.category ?? '')
  if (category === 'love_relationship') return 3
  if (category === 'health_energy') return 2
  if (category === 'money_wealth') return 1
  return 0
}

function pendingThreadIsHighValue(item: Record<string, any>) {
  const deliveredAt = Date.parse(String(item.delivered_at ?? '')) || 0
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000
  const staleEnough = deliveredAt > 0 ? Date.now() - deliveredAt >= threeDaysMs : false
  return pendingThreadPriority(item) >= 2 || staleEnough
}

export default function QimenAuditPage() {
  const [threadId, setThreadId] = useState('')
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [feedback, setFeedback] = useState<Record<string, any> | null>(null)
  const [stats, setStats] = useState<Record<string, any> | null>(null)
  const [pendingCategoryFilter, setPendingCategoryFilter] = useState('all')
  const [pendingHighValueOnly, setPendingHighValueOnly] = useState(true)
  const [recentCategoryFilter, setRecentCategoryFilter] = useState('all')
  const [recentWindowFilter, setRecentWindowFilter] = useState('30d')
  const [recentRewardFilter, setRecentRewardFilter] = useState('all')
  const [recentVerdictFilter, setRecentVerdictFilter] = useState('all')
  const [recentFailedStepFilter, setRecentFailedStepFilter] = useState('all')
  const [verdict, setVerdict] = useState('pending')
  const [teacherConclusion, setTeacherConclusion] = useState('')
  const [userFeedback, setUserFeedback] = useState('')
  const [failedStep, setFailedStep] = useState('')
  const [failedSupportId, setFailedSupportId] = useState('')
  const [failureSummary, setFailureSummary] = useState('')
  const [failureTags, setFailureTags] = useState('')
  const [operatorNotes, setOperatorNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const [routingReport, setRoutingReport] = useState<Record<string, any> | null>(null)

  async function loadThread(nextThreadId: string) {
    setLoading(true)
    setError(null)
    try {
      const [reading, feedbackResult] = await Promise.all([
        adminApi.readingDetail(nextThreadId),
        adminApi.qimenFeedback(nextThreadId),
      ])
      setData(reading)
      const nextFeedback = (feedbackResult.feedback ?? null) as Record<string, any> | null
      setFeedback(nextFeedback)
      setVerdict(String(nextFeedback?.verdict ?? 'pending'))
      setTeacherConclusion(String(nextFeedback?.teacher_conclusion ?? ''))
      setUserFeedback(String(nextFeedback?.user_feedback ?? ''))
      setFailedStep(String(nextFeedback?.failed_step ?? ''))
      setFailedSupportId(String(nextFeedback?.failed_support_id ?? ''))
      setFailureSummary(String(nextFeedback?.failure_summary ?? ''))
      setFailureTags(Array.isArray(nextFeedback?.failure_tags) ? nextFeedback.failure_tags.join(', ') : '')
      setOperatorNotes(String(nextFeedback?.operator_notes ?? ''))
    } catch (err) {
      setError(String(err))
      setData(null)
      setFeedback(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const initialThreadId = params.get('thread') ?? ''
    const initialPendingCategory = params.get('pending_category') ?? 'all'
    const initialPendingHighValue = params.get('pending_high_value')
    const initialRecentCategory = params.get('recent_category') ?? 'all'
    const initialRecentWindow = params.get('recent_window') ?? '30d'
    const initialRecentReward = params.get('recent_reward') ?? 'all'
    const initialRecentVerdict = params.get('recent_verdict') ?? 'all'
    const initialRecentFailedStep = params.get('recent_failed_step') ?? 'all'
    setPendingCategoryFilter(initialPendingCategory)
    setPendingHighValueOnly(initialPendingHighValue === null ? true : initialPendingHighValue === '1')
    setRecentCategoryFilter(initialRecentCategory)
    setRecentWindowFilter(initialRecentWindow)
    setRecentRewardFilter(initialRecentReward)
    setRecentVerdictFilter(initialRecentVerdict)
    setRecentFailedStepFilter(initialRecentFailedStep)
    void adminApi.qimenFeedbackStats()
      .then((result) => setStats((result.stats ?? null) as Record<string, any> | null))
      .catch(() => setStats(null))
    void adminApi.qimenTeacherRoutingReport()
      .then((result) => setRoutingReport((result.report ?? null) as Record<string, any> | null))
      .catch(() => setRoutingReport(null))
    if (!initialThreadId) return
    setThreadId(initialThreadId)
    void loadThread(initialThreadId)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (threadId) params.set('thread', threadId)
    else params.delete('thread')
    if (pendingCategoryFilter !== 'all') params.set('pending_category', pendingCategoryFilter)
    else params.delete('pending_category')
    if (!pendingHighValueOnly) params.set('pending_high_value', '0')
    else params.delete('pending_high_value')
    if (recentCategoryFilter !== 'all') params.set('recent_category', recentCategoryFilter)
    else params.delete('recent_category')
    if (recentWindowFilter !== '30d') params.set('recent_window', recentWindowFilter)
    else params.delete('recent_window')
    if (recentRewardFilter !== 'all') params.set('recent_reward', recentRewardFilter)
    else params.delete('recent_reward')
    if (recentVerdictFilter !== 'all') params.set('recent_verdict', recentVerdictFilter)
    else params.delete('recent_verdict')
    if (recentFailedStepFilter !== 'all') params.set('recent_failed_step', recentFailedStepFilter)
    else params.delete('recent_failed_step')
    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
    window.history.replaceState({}, '', nextUrl)
  }, [
    threadId,
    pendingCategoryFilter,
    pendingHighValueOnly,
    recentCategoryFilter,
    recentWindowFilter,
    recentRewardFilter,
    recentVerdictFilter,
    recentFailedStepFilter,
  ])

  const events = ((data?.events as Record<string, any>[] | undefined) ?? [])
  const deliveredPayloads = events
    .filter((event) => String(event.event_type ?? '') === 'delivered')
    .map((event) => (event.payload ?? event.payload_json ?? {}) as Record<string, any>)
  const latestDelivered = deliveredPayloads[0] ?? {}
  const qimenReasoning = (latestDelivered.knowledge_evidence?.qimen_reasoning ?? null) as Record<string, any> | null
  const qimenChart = (latestDelivered.knowledge_evidence?.qimen_chart ?? null) as Record<string, any> | null
  const qimenVectorMatches = ((latestDelivered.knowledge_evidence?.qimen_vector_matches as Record<string, any>[] | undefined) ?? [])
  const qimenLayout = preferredQimenLayout(qimenChart)
  const feedbackLearning = (qimenReasoning?.feedback_learning ?? null) as Record<string, any> | null
  const chainCoverage = (qimenReasoning?.chain_coverage ?? null) as Record<string, any> | null
  const foundationTheorySupport = (qimenReasoning?.foundation_theory_support ?? null) as Record<string, any> | null
  const supportSignals = (qimenReasoning?.support_signals ?? latestDelivered.knowledge_evidence?.qimen_support_signals ?? null) as Record<string, any> | null
  const teacherPolicy = (qimenReasoning?.teacher_policy ?? null) as Record<string, any> | null
  const teacherRuns = ((qimenReasoning?.teacher_runs as Record<string, any>[] | undefined) ?? [])
  const consensusLevel = String(qimenReasoning?.consensus_level ?? '')
  const consensusSummary = String(qimenReasoning?.consensus_summary ?? '')
  const disagreementPoints = ((qimenReasoning?.disagreement_points as string[] | undefined) ?? [])
  const currentTypeStats = (((stats?.by_question_type as Record<string, any>[] | undefined) ?? []).find(
    (item) => String(item.key ?? '') === String(qimenReasoning?.question_type ?? ''),
  ) ?? null) as Record<string, any> | null
  const memberFeedbackStats = (stats?.member_feedback ?? null) as Record<string, any> | null
  const pendingFeedbackThreads = ((memberFeedbackStats?.pending_threads as Record<string, any>[] | undefined) ?? [])
  const recentMemberFeedback = ((memberFeedbackStats?.recent_feedback as Record<string, any>[] | undefined) ?? [])
  const recentFailedStepCounts = recentMemberFeedback.reduce((acc, item) => {
    const key = String(item.failed_step ?? '').trim() || 'none'
    acc.set(key, (acc.get(key) ?? 0) + 1)
    return acc
  }, new Map<string, number>())
  const recentTypeStepPairMap = recentMemberFeedback.reduce((acc, item) => {
    const type = String(item.category ?? 'unknown').trim() || 'unknown'
    const step = String(item.failed_step ?? '').trim() || 'none'
    const key = `${type}::${step}`
    const current = acc.get(key) ?? { type, step, count: 0 }
    current.count += 1
    acc.set(key, current)
    return acc
  }, new Map<string, { type: string; step: string; count: number }>())
  const recentTypeStepPairs = [...recentTypeStepPairMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
  const nowTs = Date.now()
  const filteredRecentMemberFeedback = recentMemberFeedback.filter((item) => {
    const updatedAt = Date.parse(String(item.updated_at ?? '')) || 0
    if (recentWindowFilter === '7d' && updatedAt > 0 && nowTs - updatedAt > 7 * 24 * 60 * 60 * 1000) return false
    if (recentWindowFilter === '30d' && updatedAt > 0 && nowTs - updatedAt > 30 * 24 * 60 * 60 * 1000) return false
    if (recentWindowFilter === 'all') return true
    return true
  }).filter((item) => {
    if (recentCategoryFilter !== 'all' && String(item.category ?? '') !== recentCategoryFilter) return false
    if (recentRewardFilter === 'rewarded' && !Boolean(item.reward_claimed)) return false
    if (recentRewardFilter === 'unrewarded' && Boolean(item.reward_claimed)) return false
    if (recentVerdictFilter === 'all') return true
    if (String(item.verdict ?? '') !== recentVerdictFilter) return false
    return true
  }).filter((item) => {
    if (recentFailedStepFilter === 'all') return true
    return String(item.failed_step ?? '') === recentFailedStepFilter
  })
  const filteredPendingFeedbackThreads = pendingFeedbackThreads
    .filter((item) => {
      if (pendingCategoryFilter !== 'all' && String(item.category ?? '') !== pendingCategoryFilter) return false
      if (pendingHighValueOnly && !pendingThreadIsHighValue(item)) return false
      return true
    })
    .sort((a, b) => {
      const priorityDiff = pendingThreadPriority(b) - pendingThreadPriority(a)
      if (priorityDiff !== 0) return priorityDiff
      const aDelivered = Date.parse(String(a.delivered_at ?? '')) || 0
      const bDelivered = Date.parse(String(b.delivered_at ?? '')) || 0
      return aDelivered - bDelivered
    })
  const teacherScoreRows = (((stats?.teacher_question_type_scores as Record<string, any>[] | undefined) ?? []).filter(
    (item) => String(item.question_type ?? '') === String(qimenReasoning?.question_type ?? ''),
  )).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
  const activeTeacherRows = teacherScoreRows.filter((item) => String(item.status ?? '') === 'active')
  const downrankedTeacherRows = teacherScoreRows.filter((item) => String(item.status ?? '') === 'downranked')
  const mutedTeacherRows = teacherScoreRows.filter((item) => String(item.status ?? '') === 'muted')
  const clarification = (latestDelivered.knowledge_evidence?.clarification ?? null) as Record<string, any> | null
  const clarificationTouched = events.some((event) => {
    const eventType = String(event.event_type ?? '')
    const payload = (event.payload ?? event.payload_json ?? {}) as Record<string, any>
    return eventType.includes('clarification') || Array.isArray(payload.requested_fields)
  })
  const enteredFormalAfterClarification =
    clarificationTouched &&
    String(data?.thread?.status ?? '') !== 'awaiting_user_info' &&
    !clarification
  const boostedSupportCount =
    (Array.isArray(supportSignals?.year_ming?.boosted_support_ids) ? supportSignals.year_ming.boosted_support_ids.length : 0) +
    (Array.isArray(supportSignals?.long_cycle?.boosted_support_ids) ? supportSignals.long_cycle.boosted_support_ids.length : 0)
  const supportOptions = [
    ...(((qimenReasoning?.matched_rules as Record<string, any>[] | undefined) ?? []).map((item) => ({ id: String(item.id ?? ''), label: String(item.title ?? item.id ?? '') }))),
    ...(((qimenReasoning?.matched_cases as Record<string, any>[] | undefined) ?? []).map((item) => ({ id: String(item.id ?? ''), label: String(item.title ?? item.id ?? '') }))),
    ...(((qimenReasoning?.matched_patterns as Record<string, any>[] | undefined) ?? []).map((item) => ({ id: String(item.id ?? ''), label: String(item.title ?? item.id ?? '') }))),
    ...(((qimenReasoning?.matched_terms as Record<string, any>[] | undefined) ?? []).map((item) => ({ id: String(item.id ?? ''), label: String(item.title ?? item.id ?? '') }))),
    ...(((qimenReasoning?.matched_conflicts as Record<string, any>[] | undefined) ?? []).map((item) => ({ id: String(item.id ?? ''), label: String(item.title ?? item.id ?? '') }))),
  ].filter((item, index, arr) => item.id && arr.findIndex((row) => row.id === item.id) === index)
  const tieredAllSupports = groupByKnowledgeTier([
    ...(((qimenReasoning?.matched_rules as Record<string, any>[] | undefined) ?? [])),
    ...(((qimenReasoning?.matched_cases as Record<string, any>[] | undefined) ?? [])),
    ...(((qimenReasoning?.matched_patterns as Record<string, any>[] | undefined) ?? [])),
    ...(((qimenReasoning?.matched_terms as Record<string, any>[] | undefined) ?? [])),
    ...(((qimenReasoning?.matched_conflicts as Record<string, any>[] | undefined) ?? [])),
  ])
  const documentSupports = documentSupportItems([
    ...(((qimenReasoning?.matched_rules as Record<string, any>[] | undefined) ?? [])),
    ...(((qimenReasoning?.matched_cases as Record<string, any>[] | undefined) ?? [])),
    ...(((qimenReasoning?.matched_terms as Record<string, any>[] | undefined) ?? [])),
    ...(((qimenReasoning?.matched_conflicts as Record<string, any>[] | undefined) ?? [])),
  ])

  async function saveFeedback() {
    if (!threadId) return
    setSavingFeedback(true)
    setError(null)
    try {
      const result = await adminApi.saveQimenFeedback({
        thread_id: threadId,
        verdict,
        question_type: String(qimenReasoning?.question_type ?? ''),
        teacher_conclusion: teacherConclusion,
        user_feedback: userFeedback,
        failed_step: failedStep,
        failed_support_id: failedSupportId,
        failure_summary: failureSummary,
        failure_tags: failureTags,
        operator_notes: operatorNotes,
        system_profile: String(data?.thread?.divination_profile ?? ''),
      })
      const nextFeedback = (result.feedback ?? null) as Record<string, any> | null
      setFeedback(nextFeedback)
      const statsResult = await adminApi.qimenFeedbackStats()
      setStats((statsResult.stats ?? null) as Record<string, any> | null)
    } catch (err) {
      setError(String(err))
    } finally {
      setSavingFeedback(false)
    }
  }

  async function copyText(text: string, label: string) {
    const value = text.trim()
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopyNotice(`${label} 已复制`)
      window.setTimeout(() => setCopyNotice(null), 1800)
    } catch (err) {
      setError(String(err))
    }
  }

  function exportPendingFeedbackCsv() {
    const rows = filteredPendingFeedbackThreads
    if (!rows.length || typeof window === 'undefined') return
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const header = ['thread_id', 'email', 'category', 'divination_profile', 'delivered_at', 'question_text']
    const body = rows.map((item) =>
      [
        item.id,
        item.email,
        chineseQuestionType(String(item.category ?? '')),
        item.divination_profile,
        item.delivered_at,
        item.question_text,
      ].map(escapeCsv).join(','),
    )
    const csv = `\uFEFF${header.join(',')}\n${body.join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    const suffix = pendingHighValueOnly ? 'high-value' : 'all'
    link.href = url
    link.download = `qimen-pending-feedback-${pendingCategoryFilter}-${suffix}.csv`
    window.document.body.appendChild(link)
    link.click()
    window.document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  function exportRecentFeedbackCsv() {
    const rows = filteredRecentMemberFeedback
    if (!rows.length || typeof window === 'undefined') return
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const header = ['thread_id', 'email', 'category', 'divination_profile', 'verdict', 'failed_step', 'feedback_at', 'delivered_at', 'user_feedback']
    const body = rows.map((item) =>
      [
        item.thread_id,
        item.email,
        chineseQuestionType(String(item.category ?? '')),
        item.divination_profile,
        memberFeedbackVerdictLabel(String(item.verdict ?? '')),
        item.failed_step,
        item.updated_at,
        item.delivered_at,
        item.user_feedback,
      ].map(escapeCsv).join(','),
    )
    const csv = `\uFEFF${header.join(',')}\n${body.join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = `qimen-recent-feedback-${recentVerdictFilter}.csv`
    window.document.body.appendChild(link)
    link.click()
    window.document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  function resetRecentFilters() {
    setRecentCategoryFilter('all')
    setRecentWindowFilter('30d')
    setRecentRewardFilter('all')
    setRecentVerdictFilter('all')
    setRecentFailedStepFilter('all')
  }

  return (
    <AuthGuard>
      <AdminShell
        title="奇门审核页"
        description="按 thread_id 查看奇门起盘、命中规则、视频/文档证据和推理顺序。"
      >
        <div className="toolbar">
          <input
            value={threadId}
            onChange={(e) => setThreadId(e.target.value)}
            placeholder="输入 thread id"
          />
          <button
            className="button"
            disabled={loading || !threadId}
            onClick={() => void loadThread(threadId)}
          >
            {loading ? '读取中…' : '加载奇门审阅'}
          </button>
        </div>

        {error ? (
          <div className="card" style={{ color: 'var(--bad)' }}>
            {error}
          </div>
        ) : null}

        {copyNotice ? (
          <div className="card" style={{ color: 'var(--good)' }}>
            {copyNotice}
          </div>
        ) : null}

        {routingReport ? (
          <div className="card">
            <h3>老师路由策略</h3>
            <div className="kv-list">
              <div className="kv-row">
                <span className="muted">主老师</span>
                <span>{displayValue(routingReport.overall?.primary_teacher)}</span>
              </div>
              <div className="kv-row">
                <span className="muted">灰度老师</span>
                <span>{displayValue((routingReport.overall?.gray_teachers ?? []).join('、'))}</span>
              </div>
              <div className="kv-row">
                <span className="muted">离线回归</span>
                <span>{displayValue((routingReport.overall?.offline_only_teachers ?? []).join('、'))}</span>
              </div>
              <div className="kv-row">
                <span className="muted">历史样本</span>
                <span>{displayValue(routingReport.overall?.total_cases)}</span>
              </div>
            </div>
            <div className="stack" style={{ marginTop: 16 }}>
              {((routingReport.by_question_type as Record<string, any>[] | undefined) ?? []).map((item, index) => (
                <div key={`routing-${index}`} className="card inset-card">
                  <div style={{ fontWeight: 700 }}>{displayValue(item.question_type_label)}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    建议：{displayValue(item.recommendation?.mode)}
                    {Array.isArray(item.recommendation?.gray_teachers) && item.recommendation.gray_teachers.length
                      ? ` · 灰度老师 ${item.recommendation.gray_teachers.join('、')}`
                      : ''}
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    历史：all_same_result={displayValue(item.outcome_counts?.all_same_result ?? 0)} · majority_same_as_wang={displayValue(item.outcome_counts?.majority_same_as_wang ?? 0)} · exact_match={displayValue(item.fidelity_counts?.exact_match ?? 0)}
                  </div>
                  <div style={{ marginTop: 8 }}>{displayValue(item.recommendation?.reason)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {data ? (
          String(data?.thread?.divination_system ?? '') === 'qimen_yang' && qimenReasoning ? (
            <div className="stack">
              {(String(data.thread?.status ?? '') === 'awaiting_user_info' || clarification) ? (
                <div className="card">
                  <h3>系统追问中</h3>
                  <div className="muted" style={{ marginBottom: 8 }}>
                    这条线程当前不是正式结论，系统还在等用户补充关键背景。
                  </div>
                  <div style={{ fontWeight: 700 }}>{displayValue(clarification?.prompt)}</div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    追问原因：{displayValue(clarification?.reason)}
                  </div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    需要字段：{Array.isArray(clarification?.requested_fields) ? clarification.requested_fields.join('、') : '—'}
                  </div>
                </div>
              ) : null}
              {enteredFormalAfterClarification ? (
                <div className="card">
                  <h3>补充信息后进入正式断事</h3>
                  <div className="muted">
                    这条线程前面触发过系统追问，用户补齐信息后才进入正式奇门判断。审核时请把补充信息当作主证据的一部分。
                  </div>
                </div>
              ) : null}

              {stats ? (
                <div className="stack">
                  <div className="split">
                    {[
                      { label: '反馈总数', value: displayValue(stats.total_feedback) },
                      { label: '当前题型', value: currentTypeStats ? chineseQuestionType(String(currentTypeStats.key ?? '')) : '—' },
                      {
                        label: '当前高风险步骤',
                        value: (((feedbackLearning?.common_failed_steps as Record<string, any>[] | undefined) ?? []).slice(0, 1).map((item) => displayValue(item.step)).join('、')) || '—',
                      },
                      { label: '本次抬权支撑卡', value: String(boostedSupportCount || 0) },
                    ].map((item) => (
                      <div key={item.label} className="card">
                        <div className="muted">{item.label}</div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 8 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {memberFeedbackStats ? (
                    <div className="card">
                      <h3>用户回填运营数据</h3>
                      <div className="split">
                        {[
                          { label: '可回填已交付', value: displayValue(memberFeedbackStats.eligible_delivered) },
                          { label: '受邀已交付', value: displayValue(memberFeedbackStats.invited_delivered) },
                          {
                            label: '邀请命中率',
                            value: `${(Number(memberFeedbackStats.invitation_rate ?? 0) * 100).toFixed(1)}%`,
                          },
                          { label: '已提交反馈', value: displayValue(memberFeedbackStats.submitted_feedback) },
                          {
                            label: '提交率',
                            value: `${(Number(memberFeedbackStats.submission_rate ?? 0) * 100).toFixed(1)}%`,
                          },
                          { label: '命中', value: displayValue(memberFeedbackStats.matched_feedback) },
                          { label: '部分命中', value: displayValue(memberFeedbackStats.partially_matched_feedback) },
                          { label: '未命中', value: displayValue(memberFeedbackStats.missed_feedback) },
                          { label: '已返币次数', value: displayValue(memberFeedbackStats.rewarded_feedback) },
                          { label: '累计返币', value: `${displayValue(memberFeedbackStats.reward_coins_granted)} coins` },
                          { label: '3 coins 邀请', value: displayValue(memberFeedbackStats.invite_reward_band_counts?.['3']) },
                          { label: '4 coins 邀请', value: displayValue(memberFeedbackStats.invite_reward_band_counts?.['4']) },
                          { label: '5 coins 邀请', value: displayValue(memberFeedbackStats.invite_reward_band_counts?.['5']) },
                        ].map((item) => (
                          <div key={`member-feedback-${item.label}`} className="card inset-card">
                            <div className="muted">{item.label}</div>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 8 }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="split" style={{ marginTop: 12 }}>
                        {['3', '4', '5'].map((bandKey) => (
                          <div key={`reward-band-quality-${bandKey}`} className="card inset-card">
                            <div className="muted">{bandKey} coins 质量</div>
                            <div style={{ marginTop: 8 }}>
                              命中 {displayValue(memberFeedbackStats.reward_band_quality?.[bandKey]?.matched)} / 部分 {displayValue(memberFeedbackStats.reward_band_quality?.[bandKey]?.partially_matched)} / 未命中 {displayValue(memberFeedbackStats.reward_band_quality?.[bandKey]?.missed)}
                            </div>
                            <div className="muted" style={{ marginTop: 6 }}>
                              命中率 {(Number(memberFeedbackStats.reward_band_quality?.[bandKey]?.match_rate ?? 0) * 100).toFixed(1)}% · 未命中率 {(Number(memberFeedbackStats.reward_band_quality?.[bandKey]?.miss_rate ?? 0) * 100).toFixed(1)}%
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="card inset-card" style={{ marginTop: 12 }}>
                        <div className="muted">5 coins 档位判断</div>
                        <div className="split" style={{ marginTop: 12 }}>
                          {[
                            {
                              label: '5 vs 3 命中率差值',
                              value: signedPercent(memberFeedbackStats.reward_band_insight?.five_vs_three_match_rate_delta),
                            },
                            {
                              label: '5 vs 4 命中率差值',
                              value: signedPercent(memberFeedbackStats.reward_band_insight?.five_vs_four_match_rate_delta),
                            },
                            {
                              label: '5 vs 3 未命中率差值',
                              value: signedPercent(memberFeedbackStats.reward_band_insight?.five_vs_three_miss_rate_delta),
                            },
                            {
                              label: '5 vs 4 未命中率差值',
                              value: signedPercent(memberFeedbackStats.reward_band_insight?.five_vs_four_miss_rate_delta),
                            },
                          ].map((item) => (
                            <div key={`reward-band-insight-${item.label}`} className="card inset-card">
                              <div className="muted">{item.label}</div>
                              <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: 8 }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="muted" style={{ marginTop: 12 }}>
                          {displayValue(memberFeedbackStats.reward_band_insight?.recommendation)}
                        </div>
                      </div>
                      <div className="split" style={{ marginTop: 12 }}>
                        {[
                          { label: '已返币命中', value: displayValue(memberFeedbackStats.rewarded_verdicts?.matched) },
                          { label: '已返币部分命中', value: displayValue(memberFeedbackStats.rewarded_verdicts?.partially_matched) },
                          { label: '已返币未命中', value: displayValue(memberFeedbackStats.rewarded_verdicts?.missed) },
                          {
                            label: '已返币命中率',
                            value: `${(Number(memberFeedbackStats.rewarded_match_rate ?? 0) * 100).toFixed(1)}%`,
                          },
                          {
                            label: '已返币未命中率',
                            value: `${(Number(memberFeedbackStats.rewarded_miss_rate ?? 0) * 100).toFixed(1)}%`,
                          },
                          {
                            label: '未返币命中率',
                            value: `${(Number(memberFeedbackStats.unrewarded_match_rate ?? 0) * 100).toFixed(1)}%`,
                          },
                          {
                            label: '未返币未命中率',
                            value: `${(Number(memberFeedbackStats.unrewarded_miss_rate ?? 0) * 100).toFixed(1)}%`,
                          },
                          {
                            label: '返币命中率差值',
                            value: signedPercent(memberFeedbackStats.rewarded_match_rate_delta),
                          },
                          {
                            label: '返币未命中率差值',
                            value: signedPercent(memberFeedbackStats.rewarded_miss_rate_delta),
                          },
                          {
                            label: '每个返币命中成本',
                            value:
                              memberFeedbackStats.coins_per_rewarded_match == null
                                ? '—'
                                : `${displayValue(memberFeedbackStats.coins_per_rewarded_match)} coins`,
                          },
                        ].map((item) => (
                          <div key={`rewarded-verdict-${item.label}`} className="card inset-card">
                            <div className="muted">{item.label}</div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: 8 }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="muted" style={{ marginTop: 12 }}>
                        这组数据看的是线上真实已交付奇门答案里，有多少用户愿意回填结果，以及为此返出了多少 coins。
                      </div>
                    </div>
                  ) : null}

                  {pendingFeedbackThreads.length ? (
                    <div className="card">
                      <h3>待回填线程</h3>
                      <div className="muted" style={{ marginBottom: 12 }}>
                        最近已交付但还没有用户 feedback 的奇门线程，优先适合做回访和样本补全。
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div className="muted">
                          默认优先感情婚姻、高风险健康题，以及已交付超过 3 天仍未回填的线程。
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            className="button"
                            style={{ opacity: pendingHighValueOnly ? 1 : 0.7 }}
                            onClick={() => setPendingHighValueOnly((value) => !value)}
                          >
                            {pendingHighValueOnly ? '只看高价值未回填' : '显示全部未回填'}
                          </button>
                          <button className="button" onClick={exportPendingFeedbackCsv}>
                            导出当前清单
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {[
                          { key: 'all', label: '全部' },
                          { key: 'love_relationship', label: '感情婚姻' },
                          { key: 'career_work', label: '事业工作' },
                          { key: 'money_wealth', label: '财运合作' },
                          { key: 'health_energy', label: '健康身体' },
                        ].map((item) => (
                          <button
                            key={`pending-filter-${item.key}`}
                            className="button"
                            style={{ opacity: pendingCategoryFilter === item.key ? 1 : 0.7 }}
                            onClick={() => setPendingCategoryFilter(item.key)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div className="stack">
                        {filteredPendingFeedbackThreads.map((item) => (
                          <div key={String(item.id ?? 'pending-thread')} className="card inset-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                              <div style={{ fontWeight: 700 }}>{displayValue(item.question_text)}</div>
                              {pendingThreadIsHighValue(item) ? (
                                <div className="muted">高价值</div>
                              ) : null}
                            </div>
                            <div className="muted" style={{ marginTop: 6 }}>
                              {displayValue(item.email)} · {chineseQuestionType(String(item.category ?? ''))} · {displayValue(item.divination_profile)}
                            </div>
                            <div className="muted" style={{ marginTop: 6 }}>
                              delivered_at: {shortIso(item.delivered_at)} · reward: {displayValue(item.reward_coins)} coins
                            </div>
                            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                className="button"
                                onClick={() => {
                                  const id = String(item.id ?? '')
                                  setThreadId(id)
                                  void loadThread(id)
                                }}
                              >
                                打开 thread
                              </button>
                              <button
                                className="button"
                                onClick={() => void copyText(String(item.email ?? ''), '邮箱')}
                              >
                                复制邮箱
                              </button>
                              <button
                                className="button"
                                onClick={() => void copyText(String(item.id ?? ''), 'thread id')}
                              >
                                复制 thread id
                              </button>
                            </div>
                          </div>
                        ))}
                        {filteredPendingFeedbackThreads.length === 0 ? (
                          <div className="muted">当前筛选下没有待回填线程。</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {recentMemberFeedback.length ? (
                    <div className="card">
                      <h3>最近回填记录</h3>
                      <div className="muted" style={{ marginBottom: 12 }}>
                        最近提交的真实用户结果回填，可直接打开 thread 复核断语与后验结果。
                      </div>
                      <div className="split" style={{ marginBottom: 12 }}>
                        {[
                          'question_route',
                          'decision_compose',
                          'timing',
                          'support_select',
                          'none',
                        ].map((key) => (
                          <div key={`recent-step-count-${key}`} className="card inset-card">
                            <div className="muted">{key === 'none' ? '未标 failed_step' : failedStepLabel(key)}</div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: 8 }}>
                              {displayValue(recentFailedStepCounts.get(key) ?? 0)}
                            </div>
                          </div>
                        ))}
                      </div>
                      {recentTypeStepPairs.length ? (
                        <div className="card inset-card" style={{ marginBottom: 12 }}>
                          <div className="muted" style={{ marginBottom: 8 }}>最近回填题型 × 失准层</div>
                          <div className="stack">
                            {recentTypeStepPairs.map((item) => (
                              <button
                                key={`recent-type-step-${item.type}-${item.step}`}
                                className="button"
                                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left' }}
                                onClick={() => {
                                  setRecentCategoryFilter(item.type)
                                  setRecentFailedStepFilter(item.step)
                                }}
                              >
                                <span>
                                  {chineseQuestionType(item.type)} · {item.step === 'none' ? '未标 failed_step' : failedStepLabel(item.step)}
                                </span>
                                <span>{displayValue(item.count)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div className="muted">
                          这里最适合直接导出 `未命中 / 部分命中` 清单，回到案例和后验结果里做复盘。
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="button" onClick={exportRecentFeedbackCsv}>
                            导出当前回填
                          </button>
                          <button className="button" onClick={resetRecentFilters}>
                            清空筛选
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {[
                          { key: '7d', label: '最近 7 天' },
                          { key: '30d', label: '最近 30 天' },
                          { key: 'all', label: '全部时间' },
                        ].map((item) => (
                          <button
                            key={`recent-window-filter-${item.key}`}
                            className="button"
                            style={{ opacity: recentWindowFilter === item.key ? 1 : 0.7 }}
                            onClick={() => setRecentWindowFilter(item.key)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {[
                          { key: 'all', label: '全部返币状态' },
                          { key: 'rewarded', label: '已返币' },
                          { key: 'unrewarded', label: '未返币' },
                        ].map((item) => (
                          <button
                            key={`recent-reward-filter-${item.key}`}
                            className="button"
                            style={{ opacity: recentRewardFilter === item.key ? 1 : 0.7 }}
                            onClick={() => setRecentRewardFilter(item.key)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {[
                          { key: 'all', label: '全部题型' },
                          { key: 'love_relationship', label: '感情婚姻' },
                          { key: 'career_work', label: '事业工作' },
                          { key: 'money_wealth', label: '财运合作' },
                          { key: 'health_energy', label: '健康身体' },
                        ].map((item) => (
                          <button
                            key={`recent-category-filter-${item.key}`}
                            className="button"
                            style={{ opacity: recentCategoryFilter === item.key ? 1 : 0.7 }}
                            onClick={() => setRecentCategoryFilter(item.key)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {[
                          { key: 'all', label: '全部' },
                          { key: 'missed', label: '未命中' },
                          { key: 'partially_matched', label: '部分命中' },
                          { key: 'matched', label: '命中' },
                        ].map((item) => (
                          <button
                            key={`recent-feedback-filter-${item.key}`}
                            className="button"
                            style={{ opacity: recentVerdictFilter === item.key ? 1 : 0.7 }}
                            onClick={() => setRecentVerdictFilter(item.key)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {[
                          { key: 'all', label: '全部步骤' },
                          { key: 'question_route', label: 'question_route' },
                          { key: 'decision_compose', label: 'decision_compose' },
                          { key: 'timing', label: 'timing' },
                          { key: 'support_select', label: 'support_select' },
                        ].map((item) => (
                          <button
                            key={`recent-step-filter-${item.key}`}
                            className="button"
                            style={{ opacity: recentFailedStepFilter === item.key ? 1 : 0.7 }}
                            onClick={() => setRecentFailedStepFilter(item.key)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div className="stack">
                        {filteredRecentMemberFeedback.map((item) => (
                          <div key={String(item.thread_id ?? 'recent-feedback')} className="card inset-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                              <div style={{ fontWeight: 700 }}>{displayValue(item.question_text)}</div>
                              <div className="muted">{memberFeedbackVerdictLabel(String(item.verdict ?? ''))}</div>
                            </div>
                            <div className="muted" style={{ marginTop: 6 }}>
                              {displayValue(item.email)} · {chineseQuestionType(String(item.category ?? ''))} · {displayValue(item.divination_profile)}
                            </div>
                            <div className="muted" style={{ marginTop: 6 }}>
                              feedback_at: {shortIso(item.updated_at)} · delivered_at: {shortIso(item.delivered_at)}
                              {Boolean(item.reward_claimed) ? ` · 已返币 ${displayValue(item.reward_coins)} coins` : ' · 未返币'}
                            </div>
                            <div style={{ marginTop: 8 }}>
                              {displayValue(item.user_feedback)}
                            </div>
                            {String(item.failed_step ?? '').trim() ? (
                              <div className="muted" style={{ marginTop: 6 }}>
                                failed_step: {displayValue(item.failed_step)}
                              </div>
                            ) : null}
                            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                className="button"
                                onClick={() => {
                                  const id = String(item.thread_id ?? '')
                                  setThreadId(id)
                                  void loadThread(id)
                                }}
                              >
                                打开 thread
                              </button>
                              <button
                                className="button"
                                onClick={() => void copyText(String(item.email ?? ''), '邮箱')}
                              >
                                复制邮箱
                              </button>
                              <button
                                className="button"
                                onClick={() => void copyText(String(item.thread_id ?? ''), 'thread id')}
                              >
                                复制 thread id
                              </button>
                            </div>
                          </div>
                        ))}
                        {filteredRecentMemberFeedback.length === 0 ? (
                          <div className="muted">当前筛选下没有回填记录。</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="split">
                  <div className="card">
                    <h3>错因统计</h3>
                    <div className="kv-list">
                      <div className="kv-row">
                        <span className="muted">反馈总数</span>
                        <span>{displayValue(stats.total_feedback)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">最常见错步</span>
                        <span>{(((stats.failed_steps as Record<string, any>[] | undefined) ?? []).slice(0, 3).map((item) => `${displayValue(item.key)}(${displayValue(item.count)})`).join('、')) || '—'}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">最常见错因标签</span>
                        <span>{(((stats.failure_tags as Record<string, any>[] | undefined) ?? []).slice(0, 3).map((item) => `${displayValue(item.key)}(${displayValue(item.count)})`).join('、')) || '—'}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">当前题型反馈</span>
                        <span>{currentTypeStats ? `${chineseQuestionType(String(currentTypeStats.key ?? ''))}(${displayValue(currentTypeStats.count)})` : '—'}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">当前题型最常错步</span>
                        <span>{(((currentTypeStats?.failed_steps as Record<string, any>[] | undefined) ?? []).slice(0, 3).map((item) => `${displayValue(item.key)}(${displayValue(item.count)})`).join('、')) || '—'}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">当前题型高频错因</span>
                        <span>{(((currentTypeStats?.failure_tags as Record<string, any>[] | undefined) ?? []).slice(0, 3).map((item) => `${displayValue(item.key)}(${displayValue(item.count)})`).join('、')) || '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <h3>当前复盘校正</h3>
                    <div className="muted" style={{ marginBottom: 12 }}>
                      {displayValue(feedbackLearning?.advisory)}
                    </div>
                    <div className="kv-list">
                      <div className="kv-row">
                        <span className="muted">当前高风险步骤</span>
                        <span>{(((feedbackLearning?.common_failed_steps as Record<string, any>[] | undefined) ?? []).slice(0, 3).map((item) => `${displayValue(item.step)}(${displayValue(item.count)})`).join('、')) || '—'}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">已降权支撑卡</span>
                        <span>{(((feedbackLearning?.risky_support_ids as Record<string, any>[] | undefined) ?? []).slice(0, 3).map((item) => `${displayValue(item.id)}(${displayValue(item.count)})`).join('、')) || '—'}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">建议降级卡片</span>
                        <span>{(((feedbackLearning?.tier_adjustment_suggestions as Record<string, any>[] | undefined) ?? []).slice(0, 3).map((item) => `${displayValue(item.title)}(-${displayValue(item.feedback_penalty)})`).join('、')) || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              ) : null}

              {currentTypeStats ? (
                <div className="card">
                  <h3>按题型失败画像</h3>
                  <div className="kv-list">
                    <div className="kv-row">
                      <span className="muted">题型</span>
                      <span>{chineseQuestionType(String(currentTypeStats.key ?? ''))}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">反馈样本</span>
                      <span>{displayValue(currentTypeStats.count)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">高频错步</span>
                      <span>{(((currentTypeStats.failed_steps as Record<string, any>[] | undefined) ?? []).slice(0, 5).map((item) => `${displayValue(item.key)}(${displayValue(item.count)})`).join('、')) || '—'}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">高频错因</span>
                      <span>{(((currentTypeStats.failure_tags as Record<string, any>[] | undefined) ?? []).slice(0, 5).map((item) => `${displayValue(item.key)}(${displayValue(item.count)})`).join('、')) || '—'}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {chainCoverage ? (
                <div className="card">
                  <h3>链路完整度</h3>
                  <div className="split">
                    <div className="card inset-card">
                      <div className="muted">完整度等级</div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 8 }}>
                        {chainCoverageLabel(String(chainCoverage.completeness_level ?? ''))}
                      </div>
                      <div className="muted" style={{ marginTop: 12 }}>
                        独立断事：{['full', 'strong'].includes(String(chainCoverage.completeness_level ?? '')) ? '可以' : '暂不建议'}
                      </div>
                      <div className="muted" style={{ marginTop: 12 }}>
                        {displayValue(chainCoverage.advisory)}
                      </div>
                      <div className="muted" style={{ marginTop: 8 }}>
                        当前缺口：{Array.isArray(chainCoverage.current_gap_layers) && chainCoverage.current_gap_layers.length
                          ? chainCoverage.current_gap_layers.map((item: unknown) => chainLayerLabel(String(item))).join('、')
                          : '无'}
                      </div>
                      <div className="muted" style={{ marginTop: 8 }}>
                        缺失层：{Array.isArray(chainCoverage.missing_layers) && chainCoverage.missing_layers.length
                          ? chainCoverage.missing_layers.map((item: unknown) => chainLayerLabel(String(item))).join('、')
                          : '无'}
                      </div>
                    </div>
                    <div className="card inset-card">
                      <div className="stack">
                        {['rules', 'cases', 'patterns', 'terms', 'conflicts'].map((key) => (
                          <div key={`coverage-${key}`} className="kv-row">
                            <span className="muted">{chainLayerLabel(key)}</span>
                            <span>{chainLayerSummary((chainCoverage.counts ?? {})[key] as Record<string, any> | undefined)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {Array.isArray(foundationTheorySupport?.lessons) && foundationTheorySupport.lessons.length ? (
                <div className="card">
                  <h3>理论基础支撑</h3>
                  <div className="muted" style={{ marginBottom: 12 }}>
                    {displayValue(foundationTheorySupport.advisory)}
                  </div>
                  <div className="stack">
                    {foundationTheorySupport.lessons.map((item: Record<string, any>) => (
                      <div key={String(item.lesson_title ?? item.course ?? 'foundation')} className="card inset-card">
                        <div style={{ fontWeight: 700 }}>{displayValue(item.lesson_title)}</div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          {displayValue(item.teacher)} · {displayValue(item.course)}
                        </div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          命中支撑卡：{Array.isArray(item.matched_support_titles) && item.matched_support_titles.length
                            ? item.matched_support_titles.join('、')
                            : '—'}
                        </div>
                        <div style={{ marginTop: 8 }}>{displayValue(item.closure_note)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {teacherRuns.length ? (
                <div className="card">
                  <h3>多老师实验结果</h3>
                  <div className="split">
                    <div className="card inset-card">
                      <div className="kv-list">
                        <div className="kv-row">
                          <span className="muted">正式主链结论（钟波）</span>
                          <span>{displayValue(qimenReasoning.decision?.main_judgment)}</span>
                        </div>
                        <div className="kv-row">
                          <span className="muted">当前已启用老师</span>
                          <span>{teacherRuns.map((run) => displayValue(run.teacher_label ?? run.teacher_id)).join('、')}</span>
                        </div>
                        <div className="kv-row">
                          <span className="muted">是否早停</span>
                          <span>{consensusLevel === 'early_match' ? '是' : '否'}</span>
                        </div>
                        <div className="kv-row">
                          <span className="muted">是否形成多数</span>
                          <span>{consensusLevel === 'split' ? '否' : '是'}</span>
                        </div>
                        <div className="kv-row">
                          <span className="muted">共识状态</span>
                          <span>{consensusLevelLabel(consensusLevel)}</span>
                        </div>
                      </div>
                      <div className="muted" style={{ marginTop: 12 }}>
                        {displayValue(consensusSummary)}
                      </div>
                      <div className="muted" style={{ marginTop: 8 }}>
                        分歧点：{disagreementPoints.length ? disagreementPoints.join('、') : '无'}
                      </div>
                    </div>
                    <div className="card inset-card">
                      <div className="kv-list">
                        <div className="kv-row">
                          <span className="muted">当前题型活跃老师</span>
                          <span>{activeTeacherRows.length ? activeTeacherRows.map((item) => String(item.teacher_id ?? '')).join('、') : '—'}</span>
                        </div>
                        <div className="kv-row">
                          <span className="muted">下调中的老师</span>
                          <span>{downrankedTeacherRows.length ? downrankedTeacherRows.map((item) => String(item.teacher_id ?? '')).join('、') : '—'}</span>
                        </div>
                        <div className="kv-row">
                          <span className="muted">已静音老师</span>
                          <span>{mutedTeacherRows.length ? mutedTeacherRows.map((item) => String(item.teacher_id ?? '')).join('、') : '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="stack" style={{ marginTop: 16 }}>
                    {teacherRuns.map((run) => (
                      <div key={String(run.teacher_id ?? run.teacher_label ?? 'teacher-run')} className="card inset-card">
                        <div style={{ fontWeight: 700 }}>{displayValue(run.teacher_label ?? run.teacher_id)}</div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          结论：{teacherRunDecisionLabel(run)} · 链路：{chainCoverageLabel(String(run.chain_coverage?.completeness_level ?? ''))}
                          {run.agrees_with_majority ? ' · 多数同向' : ''}
                        </div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          规则 {displayValue(run.matched_rules?.length)} / 案例 {displayValue(run.matched_cases?.length)} / 路径 {displayValue(run.matched_patterns?.length)} / 冲突 {displayValue(run.matched_conflicts?.length)}
                        </div>
                        <div style={{ marginTop: 8 }}>{displayValue(run.main_judgment)}</div>
                        <div className="muted" style={{ marginTop: 8 }}>
                          风险：{displayValue(run.risk_line)} · 应期：{displayValue(run.timing_line)}
                        </div>
                        <div className="muted" style={{ marginTop: 8 }}>
                          命中支撑：{[
                            ...(((run.matched_rules as Record<string, any>[] | undefined) ?? []).slice(0, 1).map((item) => displayValue(item.title))),
                            ...(((run.matched_patterns as Record<string, any>[] | undefined) ?? []).slice(0, 1).map((item) => displayValue(item.title))),
                            ...(((run.matched_conflicts as Record<string, any>[] | undefined) ?? []).slice(0, 1).map((item) => displayValue(item.title))),
                          ].filter(Boolean).join('、') || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {teacherScoreRows.length ? (
                <div className="card">
                  <h3>老师-题型评分</h3>
                  <div className="stack">
                    {teacherScoreRows.map((row) => (
                      <div key={`${String(row.teacher_id ?? 'teacher')}::${String(row.question_type ?? 'type')}`} className="card inset-card">
                        <div style={{ fontWeight: 700 }}>{displayValue(row.teacher_id)}</div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          状态：{teacherScoreStatusLabel(String(row.status ?? ''))} · 分数 {displayValue(row.score)} · 样本 {displayValue(row.runs)}
                        </div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          多数同向 {displayValue(row.majority_match_count)} · 结论贴合 {displayValue(row.teacher_conclusion_match_count)} · 反馈命中 {displayValue(row.feedback_match_count)}
                        </div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          部分命中 {displayValue(row.partially_matched_count)} · 未命中 {displayValue(row.missed_count)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="split">
                {[
                  { title: '主判断卡', items: tieredAllSupports.core },
                  { title: '辅助校准卡', items: tieredAllSupports.support },
                  { title: '背景参考卡', items: tieredAllSupports.reference },
                ].map(({ title, items }) => (
                  <div key={title} className="card">
                    <h3>{title}</h3>
                    <div className="stack">
                      {Array.isArray(items) && items.length ? items.slice(0, 6).map((item: Record<string, any>, index: number) => (
                        <div key={`${item.id ?? title}-${index}`} className="card inset-card">
                          <div style={{ fontWeight: 700 }}>{displayValue(item.title)}</div>
                          <div className="muted" style={{ marginTop: 6 }}>
                            {displayValue(item.source_teacher)} · {chineseTraceKind(String(item.trace_kind ?? ''))} · score {displayValue(item.score)}
                          </div>
                          {tierOriginLabel(item) ? (
                            <div className="muted" style={{ marginTop: 6 }}>
                              {tierOriginLabel(item)}
                            </div>
                          ) : null}
                          {supportBoostLabel(String(qimenReasoning.question_type ?? ''), item, supportSignals) ? (
                            <div className="muted" style={{ marginTop: 6 }}>
                              辅助抬权：{supportBoostLabel(String(qimenReasoning.question_type ?? ''), item, supportSignals)}
                            </div>
                          ) : null}
                          {documentSupportLabel(item) ? (
                            <div className="muted" style={{ marginTop: 6 }}>
                              {documentSupportLabel(item)}
                            </div>
                          ) : null}
                          {foundationSupportLabel(item, foundationTheorySupport) ? (
                            <div className="muted" style={{ marginTop: 6 }}>
                              {foundationSupportLabel(item, foundationTheorySupport)}
                            </div>
                          ) : null}
                          {Number(item.feedback_penalty ?? 0) > 0 ? (
                            <div className="muted" style={{ marginTop: 6 }}>
                              历史降权：-{displayValue(item.feedback_penalty)}
                              {Number(item.id_penalty ?? 0) > 0 ? ` · 卡片问题 -${displayValue(item.id_penalty)}` : ''}
                              {Number(item.step_penalty ?? 0) > 0 ? ` · 错步类型 -${displayValue(item.step_penalty)}` : ''}
                            </div>
                          ) : null}
                          {(item.tier_override?.applied && String(item.tier_override?.reason ?? '').trim()) ? (
                            <div className="muted" style={{ marginTop: 6 }}>
                              覆写原因：{displayValue(item.tier_override.reason)}
                            </div>
                          ) : null}
                          <div style={{ marginTop: 8 }}>{displayValue(item.excerpt)}</div>
                        </div>
                      )) : (
                        <div className="muted">暂无命中。</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {Array.isArray(feedbackLearning?.tier_adjustment_suggestions) && feedbackLearning.tier_adjustment_suggestions.length ? (
                <div className="card">
                  <h3>建议降级卡片</h3>
                  <div className="stack">
                    {feedbackLearning.tier_adjustment_suggestions.map((item: Record<string, any>) => (
                      <div key={String(item.id ?? item.title ?? 'tier-adjust')} className="card inset-card">
                        <div style={{ fontWeight: 700 }}>{displayValue(item.title)}</div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          当前层级：{chineseKnowledgeTier(String(item.current_tier ?? ''))} → 建议层级：{chineseKnowledgeTier(String(item.suggested_tier ?? ''))}
                        </div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          总降权：-{displayValue(item.feedback_penalty)} · 卡片问题 -{displayValue(item.id_penalty)} · 错步类型 -{displayValue(item.step_penalty)}
                        </div>
                        <div style={{ marginTop: 8 }}>{displayValue(item.reason)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="split">
                <div className="card">
                  <h3>问题摘要</h3>
                  <div className="kv-list">
                    <div className="kv-row">
                      <span className="muted">Thread ID</span>
                      <span>{displayValue(data.thread?.id)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">用户</span>
                      <span>{displayValue(data.user?.id)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">题型</span>
                      <span>{chineseQuestionType(qimenReasoning.question_type)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">主老师</span>
                      <span>{displayValue(teacherPolicy?.primary_teacher ?? qimenReasoning.source_teacher)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">灰度复核</span>
                      <span>{teacherPolicy?.gray_enabled ? `已开 (${displayValue((teacherPolicy?.gray_teachers ?? []).join('、'))})` : '关闭'}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">系统</span>
                      <span>{displayValue(data.thread?.divination_system)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">局法</span>
                      <span>{displayValue(data.thread?.divination_profile)}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontWeight: 700 }}>
                    {displayValue(((data.questions as Record<string, any>[] | undefined) ?? [])[0]?.question_text)}
                  </div>
                  {teacherPolicy?.routing_reason ? (
                    <div className="muted" style={{ marginTop: 12 }}>
                      老师路由：{displayValue(teacherPolicy.routing_reason)}
                    </div>
                  ) : null}
                </div>
                <div className="card">
                  <h3>起盘摘要</h3>
                  <div className="kv-list">
                    <div className="kv-row">
                      <span className="muted">盘式版本</span>
                      <span>{displayValue(qimenChart?.layout_profile)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">遁法</span>
                      <span>{displayValue(qimenChart?.yin_yang)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">节气</span>
                      <span>{displayValue(qimenChart?.solar_term)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">局数</span>
                      <span>{displayValue(qimenChart?.bureau_number)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">值符</span>
                      <span>{displayValue(qimenChart?.zhi_fu)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">值使</span>
                      <span>{displayValue(qimenChart?.zhi_shi)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">旬首</span>
                      <span>{displayValue(qimenChart?.xun_shou)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">起盘时间</span>
                      <span>{displayValue(qimenChart?.local_datetime)}</span>
                    </div>
                  </div>
                  {qimenLayout ? (
                    <div className="pre" style={{ marginTop: 16 }}>
                      {qimenLayout}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="card">
                <h3>主证据</h3>
                <div className="stack">
                  {((qimenReasoning.primary_evidence as string[] | undefined) ?? []).length ? (
                    ((qimenReasoning.primary_evidence as string[] | undefined) ?? []).map((line, index) => (
                      <div key={`primary-${index}`} className="card inset-card">{displayValue(line)}</div>
                    ))
                  ) : (
                    <div className="muted">暂无主证据摘要。</div>
                  )}
                </div>
              </div>

              {qimenVectorMatches.length ? (
                <div className="card">
                  <h3>向量命中</h3>
                  <div className="stack">
                    {qimenVectorMatches.map((item, index) => (
                      <div key={`vector-match-${String(item.chunk_id ?? index)}`} className="card inset-card">
                        <div style={{ fontWeight: 700 }}>{displayValue(item.title)}</div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          similarity {displayValue(item.similarity)} ·
                          题型 {chineseQuestionType(String(item.metadata?.question_type ?? ''))} ·
                          集合 {displayValue(item.metadata?.collection)}
                        </div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          {displayValue(item.canonical_url)}
                        </div>
                        <div style={{ marginTop: 8 }}>{displayValue(item.content)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {supportSignals ? (
                <div className="split">
                  <div className="card">
                    <h3>借八字辅助</h3>
                    <div className="kv-list">
                      <div className="kv-row">
                        <span className="muted">自己年命</span>
                        <span>{displayValue(supportSignals.year_ming?.self_year_ming)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">自己年柱</span>
                        <span>{displayValue(supportSignals.year_ming?.self_year_pillar)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">对方出生年</span>
                        <span>{displayValue(supportSignals.year_ming?.counterpart_birth_year)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">对方年命</span>
                        <span>{displayValue(supportSignals.year_ming?.counterpart_year_ming)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">是否触发</span>
                        <span>{supportSignals.year_ming?.triggered ? '已触发' : '未触发'}</span>
                      </div>
                    </div>
                    <div className="muted" style={{ marginTop: 12 }}>
                      触发条件：{displayValue(supportSignals.year_ming?.trigger_reason)}
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {displayValue(supportSignals.year_ming?.note)}
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      抬权卡：{Array.isArray(supportSignals.year_ming?.boosted_support_ids) && supportSignals.year_ming.boosted_support_ids.length ? supportSignals.year_ming.boosted_support_ids.join('、') : '—'}
                    </div>
                  </div>
                  <div className="card">
                    <h3>长期题补边</h3>
                    <div className="kv-list">
                      <div className="kv-row">
                        <span className="muted">当前流年</span>
                        <span>{displayValue(supportSignals.long_cycle?.current_liu_nian)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">当前大运</span>
                        <span>{displayValue(supportSignals.long_cycle?.current_dayun)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">是否触发</span>
                        <span>{supportSignals.long_cycle?.triggered ? '已触发' : '未触发'}</span>
                      </div>
                    </div>
                    <div className="muted" style={{ marginTop: 12 }}>
                      触发条件：{displayValue(supportSignals.long_cycle?.trigger_reason)}
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {displayValue(supportSignals.long_cycle?.note)}
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      抬权卡：{Array.isArray(supportSignals.long_cycle?.boosted_support_ids) && supportSignals.long_cycle.boosted_support_ids.length ? supportSignals.long_cycle.boosted_support_ids.join('、') : '—'}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="card">
                <h3>主判断</h3>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>
                  {displayValue(qimenReasoning.decision?.main_judgment)}
                </div>
                <div className="muted" style={{ marginBottom: 10 }}>
                  题型路由：{displayValue(qimenReasoning.question_route?.label)} · 取用神主线：{displayValue(qimenReasoning.question_route?.yongshen_focus)}
                </div>
                <div className="muted" style={{ marginBottom: 12 }}>
                  {displayValue(qimenReasoning.question_route?.routing_reason)}
                </div>
                <div className="stack">
                  {((qimenReasoning.decision?.reason_chain as string[] | undefined) ?? []).map((line, index) => (
                    <div key={`reason-${index}`} className="card inset-card">{displayValue(line)}</div>
                  ))}
                </div>
                <div className="muted" style={{ marginTop: 12 }}>
                  风险：{displayValue(qimenReasoning.decision?.risk_line)}
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  应期：{displayValue(qimenReasoning.decision?.timing_line)}
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  不确定项：{displayValue(qimenReasoning.decision?.uncertainty)}
                </div>
                <div className="muted" style={{ marginTop: 12 }}>
                  视频主判断卡：{Array.isArray(qimenReasoning.source_summary?.primary_support_ids) && qimenReasoning.source_summary.primary_support_ids.length ? qimenReasoning.source_summary.primary_support_ids.join('、') : '—'}
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  文档补边卡：{Array.isArray(qimenReasoning.source_summary?.document_support_ids) && qimenReasoning.source_summary.document_support_ids.length ? qimenReasoning.source_summary.document_support_ids.join('、') : '—'}
                </div>
              </div>

              {documentSupports.length ? (
                <div className="card">
                  <h3>文档补边命中</h3>
                  <div className="muted" style={{ marginBottom: 12 }}>
                    这些卡只用于术语校正、冲突说明和补边，不参与主判断主线竞争。
                  </div>
                  <div className="stack">
                    {documentSupports.slice(0, 8).map((item, index) => (
                      <div key={`${item.id ?? 'document'}-${index}`} className="card inset-card">
                        <div style={{ fontWeight: 700 }}>{displayValue(item.title)}</div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          {documentSupportLabel(item)} · {chineseKnowledgeTier(String(item.knowledge_tier ?? 'reference'))}
                        </div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          来源：{displayValue(item.source_course_or_book)}
                        </div>
                        <div style={{ marginTop: 8 }}>{displayValue(item.excerpt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="card">
                <h3>推理顺序</h3>
                <div className="stack">
                  {((qimenReasoning.reasoning_trace as Record<string, any>[] | undefined) ?? []).map((step, index) => (
                    <div key={`${step.step ?? 'trace'}-${index}`} className="card inset-card">
                      <div style={{ fontWeight: 700 }}>{index + 1}. {displayValue(step.step)}</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        来源：{chineseTraceKind(String(step.kind ?? ''))}
                      </div>
                      <div style={{ marginTop: 8 }}>{displayValue(step.note)}</div>
                      {Array.isArray(step.support_ids) && step.support_ids.length ? (
                        <div className="muted" style={{ marginTop: 8 }}>
                          支撑卡片：{step.support_ids.join('、')}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="split">
                <div className="card">
                  <h3>来源分布</h3>
                  <div className="kv-list">
                    <div className="kv-row">
                      <span className="muted">视频命中</span>
                      <span>{displayValue(qimenReasoning.source_summary?.video_hits)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">文档命中</span>
                      <span>{displayValue(qimenReasoning.source_summary?.document_hits)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">盘面步骤</span>
                      <span>{displayValue(qimenReasoning.source_summary?.chart_steps)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">主规则</span>
                      <span>{displayValue((qimenReasoning.source_summary?.primary_rule_ids ?? []).join('、'))}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3>结果反馈闭环</h3>
                  <div className="toolbar" style={{ gap: 12, alignItems: 'stretch' }}>
                    <select value={verdict} onChange={(e) => setVerdict(e.target.value)}>
                      <option value="pending">待验证</option>
                      <option value="matched">命中</option>
                      <option value="partially_matched">部分命中</option>
                      <option value="missed">未命中</option>
                    </select>
                    <select value={failedStep} onChange={(e) => setFailedStep(e.target.value)}>
                      <option value="">未标记具体错步</option>
                      <option value="question_route">题型路由</option>
                      <option value="chart_summary">盘面主证据</option>
                      <option value="video_rules">视频规则命中</option>
                      <option value="case_alignment">案例校准</option>
                      <option value="document_support">文档补边</option>
                      <option value="decision_compose">结论组合</option>
                    </select>
                    <button className="button" disabled={savingFeedback || !threadId} onClick={() => void saveFeedback()}>
                      {savingFeedback ? '保存中…' : '保存反馈'}
                    </button>
                  </div>
                  <textarea
                    value={teacherConclusion}
                    onChange={(e) => setTeacherConclusion(e.target.value)}
                    placeholder="老师结论"
                    rows={3}
                    style={{ width: '100%', marginTop: 12 }}
                  />
                  <textarea
                    value={userFeedback}
                    onChange={(e) => setUserFeedback(e.target.value)}
                    placeholder="用户后续反馈"
                    rows={3}
                    style={{ width: '100%', marginTop: 12 }}
                  />
                  <input
                    value={failedSupportId}
                    onChange={(e) => setFailedSupportId(e.target.value)}
                    placeholder="错误支撑卡 ID"
                    style={{ width: '100%', marginTop: 12 }}
                    list="qimen-support-options"
                  />
                  <datalist id="qimen-support-options">
                    {supportOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </datalist>
                  <textarea
                    value={failureSummary}
                    onChange={(e) => setFailureSummary(e.target.value)}
                    placeholder="这一步为什么错了"
                    rows={3}
                    style={{ width: '100%', marginTop: 12 }}
                  />
                  <input
                    value={failureTags}
                    onChange={(e) => setFailureTags(e.target.value)}
                    placeholder="错因标签，逗号分隔：wrong_question_type,wrong_priority"
                    style={{ width: '100%', marginTop: 12 }}
                  />
                  <textarea
                    value={operatorNotes}
                    onChange={(e) => setOperatorNotes(e.target.value)}
                    placeholder="审核备注"
                    rows={3}
                    style={{ width: '100%', marginTop: 12 }}
                  />
                  {feedback ? (
                    <div className="stack" style={{ marginTop: 10 }}>
                      <div className="muted">
                        最近保存：{displayValue(feedback.updated_at)} · 复核人：{displayValue(feedback.reviewed_by)}
                      </div>
                      <div className="muted">
                        错步：{displayValue(feedback.failed_step)} · 支撑卡：{displayValue(feedback.failed_support_id)}
                      </div>
                      <div className="muted">
                        错误摘要：{displayValue(feedback.failure_summary)}
                      </div>
                    </div>
                  ) : (
                    <div className="muted" style={{ marginTop: 10 }}>
                      这条线程还没有结果反馈记录。
                    </div>
                  )}
                </div>
              </div>

              <div className="split">
                {[
                  ['命中规则卡', qimenReasoning.matched_rules],
                  ['命中案例卡', qimenReasoning.matched_cases],
                  ['命中路径卡', qimenReasoning.matched_patterns],
                  ['命中术语卡', qimenReasoning.matched_terms],
                  ['命中冲突卡', qimenReasoning.matched_conflicts],
                ].map(([title, items]) => (
                  <div key={String(title)} className="card">
                    <h3>{title}</h3>
                    <div className="stack">
                      {Array.isArray(items) && items.length ? items.map((item: Record<string, any>, index: number) => (
                        <div key={`${item.id ?? title}-${index}`} className="card inset-card">
                          <div style={{ fontWeight: 700 }}>{displayValue(item.title)}</div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          {displayValue(item.source_teacher)} · {displayValue(item.source_type)} · score {displayValue(item.score)}
                        </div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          层级：{chineseKnowledgeTier(String(item.knowledge_tier ?? 'reference'))}
                        </div>
                        {tierOriginLabel(item) ? (
                          <div className="muted" style={{ marginTop: 6 }}>
                            {tierOriginLabel(item)}
                          </div>
                        ) : null}
                        {supportBoostLabel(String(qimenReasoning.question_type ?? ''), item, supportSignals) ? (
                          <div className="muted" style={{ marginTop: 6 }}>
                            辅助抬权：{supportBoostLabel(String(qimenReasoning.question_type ?? ''), item, supportSignals)}
                          </div>
                        ) : null}
                        {documentSupportLabel(item) ? (
                          <div className="muted" style={{ marginTop: 6 }}>
                            {documentSupportLabel(item)}
                          </div>
                        ) : null}
                        {Number(item.feedback_penalty ?? 0) > 0 ? (
                          <div className="muted" style={{ marginTop: 6 }}>
                            历史降权：-{displayValue(item.feedback_penalty)}
                            {Number(item.id_penalty ?? 0) > 0 ? ` · 卡片问题 -${displayValue(item.id_penalty)}` : ''}
                            {Number(item.step_penalty ?? 0) > 0 ? ` · 错步类型 -${displayValue(item.step_penalty)}` : ''}
                          </div>
                        ) : null}
                        <div className="muted" style={{ marginTop: 6 }}>
                          来源：{displayValue(item.source_course_or_book)}
                        </div>
                        {(item.tier_override?.applied && String(item.tier_override?.reason ?? '').trim()) ? (
                          <div className="muted" style={{ marginTop: 6 }}>
                            覆写原因：{displayValue(item.tier_override.reason)}
                          </div>
                        ) : null}
                          <div style={{ marginTop: 8 }}>{displayValue(item.excerpt)}</div>
                          {Array.isArray(item.evidence_refs) && item.evidence_refs.length ? (
                            <div className="muted" style={{ marginTop: 8 }}>
                              证据：{item.evidence_refs.slice(0, 3).join(' | ')}
                            </div>
                          ) : null}
                        </div>
                      )) : (
                        <div className="muted">暂无命中。</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">这条线程不是奇门问题，或当前还没有可用的奇门推理链。</div>
          )
        ) : (
          <div className="card">输入 thread id 后可查看奇门起盘、命中规则、案例和推理顺序。</div>
        )}
      </AdminShell>
    </AuthGuard>
  )
}
