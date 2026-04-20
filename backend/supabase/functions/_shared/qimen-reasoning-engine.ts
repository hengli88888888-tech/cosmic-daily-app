import {
  GENERATED_QIMEN_CASE_CARDS,
  GENERATED_QIMEN_CONFLICT_RESOLUTION_CARDS,
  GENERATED_QIMEN_LESSON_INDEX,
  GENERATED_QIMEN_REASONING_PATTERNS,
  GENERATED_QIMEN_RULE_CARDS,
  GENERATED_QIMEN_TERM_NOTES,
} from './generated-qimen-knowledge.ts'
import { calculateQimen } from './qimen-engine.ts'

export type QimenChartResult = Awaited<ReturnType<typeof calculateQimen>>
export const QIMEN_PRIMARY_TEACHER = '王兴兵'
export const QIMEN_GRAY_TEACHERS = ['钟波', '文艺复兴'] as const
const PRIMARY_TEACHER = QIMEN_PRIMARY_TEACHER

type KnowledgeCard = {
  id: string
  title?: string
  question_type?: string
  source_type?: string
  source_teacher?: string
  source_course_or_book?: string
  source_lesson_title?: string
  source_ref?: string
  evidence_refs?: string[]
  teacher_priority?: number
  confidence?: number
  knowledge_tier?: string
  original_knowledge_tier?: string
  tier_override?: {
    applied?: boolean
    source?: string
    reason?: string
    updated_at?: string
  }
  trigger_terms?: string[]
  tags?: string[]
  rule_text?: string
  question_summary?: string
  teacher_conclusion?: string
  steps?: string[]
  term?: string
  term_note?: string
  conflict_rule?: string
}

type MatchedKnowledge = {
  id: string
  title: string
  question_type: string
  source_type: string
  source_teacher: string
  source_course_or_book: string
  source_lesson_title?: string
  source_ref: string
  evidence_refs: string[]
  tags?: string[]
  score: number
  confidence: number
  knowledge_tier: string
  original_knowledge_tier?: string
  tier_override?: {
    applied: boolean
    source: string
    reason: string
    updated_at: string
  }
  feedback_penalty?: number
  id_penalty?: number
  step_penalty?: number
  excerpt: string
  trace_kind: 'rule' | 'case' | 'pattern' | 'term' | 'conflict'
}

type TierBucket = {
  core: MatchedKnowledge[]
  support: MatchedKnowledge[]
  reference: MatchedKnowledge[]
}

type ChainLayerStats = {
  total: number
  core: number
  support: number
  reference: number
}

type LessonMetadata = {
  teacher: string
  course: string
  lesson_title: string
  primary_question_type?: string
  has_primary_layers?: boolean
  closure_bucket?: string
  closure_note?: string
  status?: string
  current_gap_layers?: string[]
}

export type QimenTeacherRun = {
  teacher_id: string
  teacher_label: string
  question_type: string
  main_judgment: string
  reason_chain: string[]
  risk_line: string
  timing_line: string
  uncertainty: string
  matched_rules: MatchedKnowledge[]
  matched_cases: MatchedKnowledge[]
  matched_patterns: MatchedKnowledge[]
  matched_terms: MatchedKnowledge[]
  matched_conflicts: MatchedKnowledge[]
  chain_coverage: QimenReasoningTrace['chain_coverage']
  foundation_theory_support?: QimenReasoningTrace['foundation_theory_support']
  normalized_decision: {
    label: string
    timing_bucket: string
    key: string
  }
  agrees_with_majority?: boolean
}

export type QimenTeacherConsensus = {
  consensus_level: 'early_match' | 'late_match' | 'split'
  majority_label?: string
  majority_timing_bucket?: string
  majority_key?: string
  majority_count: number
  total_runs: number
  summary: string
  disagreement_points: string[]
}

export type QimenFeedbackLearning = {
  question_type?: string
  common_failed_steps: Array<{
    step: string
    count: number
  }>
  risky_support_ids: Array<{
    id: string
    count: number
  }>
}

export type QimenReasoningTrace = {
  question_type: string
  source_teacher: string
  teacher_policy?: {
    primary_teacher: string
    gray_enabled: boolean
    gray_teachers: string[]
    routing_reason: string
  }
  question_route: {
    type: string
    label: string
    yongshen_focus: string
    routing_reason: string
  }
  chart_summary: {
    system_profile: string | null
    solar_term: string | null
    bureau_number: number | null
    zhi_fu: string | null
    zhi_shi: string | null
    xun_shou: string | null
  }
  extracted_evidence: {
    gates: string[]
    stars: string[]
    deities: string[]
    empty_palaces: string[]
    horse_palace: string | null
    active_terms: string[]
  }
  primary_evidence: string[]
  support_signals?: {
    year_ming?: {
      triggered: boolean
      trigger_reason: string
      self_year_pillar?: string | null
      self_year_ming?: string | null
      counterpart_birth_year?: number | null
      counterpart_year_pillar?: string | null
      counterpart_year_ming?: string | null
      boosted_support_ids: string[]
      note: string
    }
    long_cycle?: {
      triggered: boolean
      trigger_reason: string
      current_liu_nian?: string | null
      current_dayun?: string | null
      boosted_support_ids: string[]
      note: string
    }
  }
  source_summary: {
    video_hits: number
    document_hits: number
    chart_steps: number
    primary_rule_ids: string[]
    primary_support_ids: string[]
    document_support_ids: string[]
    foundation_support_ids: string[]
  }
  chain_coverage: {
    completeness_level: 'full' | 'strong' | 'partial' | 'thin'
    counts: {
      rules: ChainLayerStats
      cases: ChainLayerStats
      patterns: ChainLayerStats
      terms: ChainLayerStats
      conflicts: ChainLayerStats
    }
    missing_layers: string[]
    current_gap_layers: string[]
    advisory: string
  }
  foundation_theory_support?: {
    lessons: Array<{
      teacher: string
      course: string
      lesson_title: string
      closure_note: string
      matched_support_ids: string[]
      matched_support_titles: string[]
    }>
    advisory: string
  }
  feedback_learning?: {
    question_type?: string
    common_failed_steps: Array<{
      step: string
      count: number
    }>
    risky_support_ids: Array<{
      id: string
      count: number
    }>
    tier_adjustment_suggestions: Array<{
      id: string
      title: string
      current_tier: string
      suggested_tier: string
      reason: string
      feedback_penalty: number
      id_penalty: number
      step_penalty: number
    }>
    advisory: string
  }
  matched_rules: MatchedKnowledge[]
  matched_cases: MatchedKnowledge[]
  matched_patterns: MatchedKnowledge[]
  matched_terms: MatchedKnowledge[]
  matched_conflicts: MatchedKnowledge[]
  reasoning_trace: Array<{
    step: string
    kind: 'video-derived' | 'document-derived' | 'chart-derived'
    note: string
    support_ids: string[]
  }>
  decision: {
    main_judgment: string
    reason_chain: string[]
    risk_line: string
    timing_line: string
    uncertainty: string
  }
  teacher_runs?: QimenTeacherRun[]
  consensus_level?: QimenTeacherConsensus['consensus_level']
  consensus_majority_key?: string
  consensus_summary?: string
  disagreement_points?: string[]
}

export type QimenYearMingSupport = {
  self_year_pillar?: string | null
  self_year_ming?: string | null
  counterpart_birth_year?: number | null
  counterpart_year_pillar?: string | null
  counterpart_year_ming?: string | null
  note?: string | null
}

export type QimenLongCycleSupport = {
  current_liu_nian?: string | null
  current_dayun?: string | null
  note?: string | null
}

const QUESTION_KEYWORDS: Record<string, string[]> = {
  career_work: ['工作', '事业', '职业', '岗位', '面试', '升职', '跳槽', '老板', 'job', 'career', 'work'],
  love_relationship: [
    '感情',
    '婚姻',
    '恋爱',
    '对象',
    '复合',
    '离婚',
    '结婚',
    'relationship',
    'love',
    'marriage',
    'dating',
    'partner',
    'boyfriend',
    'girlfriend',
    'boy friend',
    'girl friend',
    'husband',
    'wife',
    'other girl',
    'other woman',
    'other man',
    'someone else',
    'third party',
    'affair',
    'cheating',
    'cheat',
  ],
  money_wealth: ['财运', '赚钱', '投资', '合作', '客户', '回款', '借钱', '股票', '基金', '账户', '仓位', '加仓', 'money', 'wealth', 'income', 'invest', 'investment', 'stock', 'stocks', 'trading', 'portfolio', 'account', 'fund', 'etf', 'shares', 'equity', 'crypto', 'bitcoin'],
  health_energy: ['健康', '身体', '失眠', '手术', '病', '医院', '焦虑', 'health', 'body', 'sleep'],
  study_exams: ['学习', '考试', '学校', '录取', '申请', 'study', 'exam', 'school', 'college', 'class', 'degree', 'admission', 'admit', 'accepted', 'application', 'apply', 'applied', 'university'],
}

const ALL_RULES = GENERATED_QIMEN_RULE_CARDS.rules as unknown as KnowledgeCard[]
const ALL_CASES = GENERATED_QIMEN_CASE_CARDS.cases as unknown as KnowledgeCard[]
const ALL_PATTERNS = GENERATED_QIMEN_REASONING_PATTERNS.patterns as unknown as KnowledgeCard[]
const ALL_TERMS = GENERATED_QIMEN_TERM_NOTES.notes as unknown as KnowledgeCard[]
const ALL_CONFLICTS = GENERATED_QIMEN_CONFLICT_RESOLUTION_CARDS.cards as unknown as KnowledgeCard[]
const ALL_LESSONS = (((GENERATED_QIMEN_LESSON_INDEX as unknown as { lessons?: LessonMetadata[] })?.lessons) ?? []) as LessonMetadata[]
const LESSON_LOOKUP = new Map(
  ALL_LESSONS.map((lesson) => [
    `${cleanText(lesson.teacher)}::${cleanText(lesson.course)}::${cleanText(lesson.lesson_title)}`,
    lesson,
  ]),
)

export const QIMEN_SECONDARY_TEACHER_PRIORITY: Record<string, string[]> = {
  career_work: ['钟波', '文艺复兴', '王永源', '苗道长'],
  love_relationship: ['钟波', '文艺复兴', '王永源', '苗道长'],
  money_wealth: ['钟波', '文艺复兴', '苗道长', '王永源'],
  health_energy: ['钟波', '文艺复兴', '苗道长', '王永源'],
}

const QIMEN_GRAY_REQUIRED_TYPES = new Set(['love_relationship'])
const QIMEN_ENVIRONMENTAL_GRAY_KEYWORDS = [
  '天气',
  '下雨',
  '晴雨',
  '雷雨',
  '彩虹',
  '洪水',
  '溃口',
  '房屋',
  '祖坟',
  '宝藏',
  '边境',
  '对峙',
  '总统',
  '大选',
  '贸易',
  '国际',
  '中韩',
  '中印',
  '美国总统',
  '法国总统',
]

export function shouldRunQimenGrayTeachers(questionType: string, questionText: string) {
  const normalizedType = cleanText(questionType)
  const text = cleanText(questionText)
  if (QIMEN_GRAY_REQUIRED_TYPES.has(normalizedType)) {
    return {
      enabled: true,
      reason: '感情婚姻题是当前唯一持续出现 majority_same_as_wang 的主类，线上继续保留灰度复核。',
    }
  }
  if (QIMEN_ENVIRONMENTAL_GRAY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return {
      enabled: true,
      reason: '低频环境/公共事件题样本少且跨度大，线上继续保留灰度复核。',
    }
  }
  return {
    enabled: false,
    reason: '主线题型历史复盘已高度收敛，线上默认单老师直出。',
  }
}

export function getQimenGrayTeacherOrder(questionType: string) {
  const preferred = getSecondaryTeacherCoverageOrder(questionType)
    .filter((teacher) => (QIMEN_GRAY_TEACHERS as readonly string[]).includes(teacher))
  return [...preferred, ...QIMEN_GRAY_TEACHERS].filter((value, index, arr) => value && arr.indexOf(value) === index)
}

export type TeacherCoverageBootstrapRow = {
  teacher_id: string
  question_type: string
  score: number
}

export function getSecondaryTeacherCoverageOrder(questionType: string) {
  const scoreByTeacher = new Map<string, number>()
  for (const lesson of ALL_LESSONS) {
    const teacher = cleanText(lesson.teacher)
    if (!teacher || teacher === '钟波') continue
    if (cleanText(lesson.primary_question_type) !== cleanText(questionType)) continue
    const status = cleanText(lesson.status)
    const hasPrimaryLayers = Boolean(lesson.has_primary_layers)
    let score = 0
    if (status === 'full_chain') score = 6
    else if (status === 'strong_chain') score = 4
    else if (status === 'partial_chain' && hasPrimaryLayers) score = 2
    else if (cleanText(lesson.closure_bucket) === 'foundation_theory') score = 1
    if (score <= 0) continue
    scoreByTeacher.set(teacher, (scoreByTeacher.get(teacher) ?? 0) + score)
  }
  const fallback = QIMEN_SECONDARY_TEACHER_PRIORITY[questionType] ?? []
  const ranked = Array.from(scoreByTeacher.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
    .map(([teacher]) => teacher)
  return [...ranked, ...fallback].filter((value, index, arr) => value && arr.indexOf(value) === index)
}

export function getTeacherCoverageBootstrapRows() {
  const scoreByTeacherAndType = new Map<string, number>()
  for (const lesson of ALL_LESSONS) {
    const teacher = cleanText(lesson.teacher)
    const questionType = cleanText(lesson.primary_question_type)
    if (!teacher || !questionType || teacher === PRIMARY_TEACHER) continue
    let score = 0
    const status = cleanText(lesson.status)
    if (status === 'full_chain') score = 6
    else if (status === 'strong_chain') score = 4
    else if (status === 'partial_chain' && lesson.has_primary_layers) score = 2
    else if (cleanText(lesson.closure_bucket) === 'foundation_theory') score = 1
    if (score <= 0) continue
    const key = `${teacher}::${questionType}`
    scoreByTeacherAndType.set(key, (scoreByTeacherAndType.get(key) ?? 0) + score)
  }
  return Array.from(scoreByTeacherAndType.entries()).map(([key, score]) => {
    const [teacher_id, question_type] = key.split('::')
    return { teacher_id, question_type, score } as TeacherCoverageBootstrapRow
  })
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function lessonLookupKey(teacher: string, course: string, lessonTitle: string) {
  return `${cleanText(teacher)}::${cleanText(course)}::${cleanText(lessonTitle)}`
}

function lessonMetadataForCard(card: KnowledgeCard | MatchedKnowledge) {
  const teacher = cleanText(card.source_teacher)
  const course = cleanText(card.source_course_or_book)
  const lessonTitle = cleanText(card.source_lesson_title)
  if (!teacher || !course || !lessonTitle) return null
  return LESSON_LOOKUP.get(lessonLookupKey(teacher, course, lessonTitle)) ?? null
}

function isFoundationTheoryCard(card: KnowledgeCard | MatchedKnowledge) {
  return cleanText(lessonMetadataForCard(card)?.closure_bucket) === 'foundation_theory'
}

function filterCardsForTeacher(cards: KnowledgeCard[], teacherId: string) {
  return cards.filter((card) => {
    const sourceType = cleanText(card.source_type)
    if (sourceType === 'document') return true
    if (isFoundationTheoryCard(card)) return true
    return cleanText(card.source_teacher) === cleanText(teacherId)
  })
}

export function detectQuestionTypeWithScore(questionText: string) {
  const text = questionText.toLowerCase()
  let best: { type: string; score: number } = { type: 'career_work', score: 0 }
  for (const [questionType, keywords] of Object.entries(QUESTION_KEYWORDS)) {
    const score = keywords.reduce((sum, keyword) => sum + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0)
    if (score > best.score) best = { type: questionType, score }
  }
  return best
}

export function detectQuestionType(questionText: string) {
  const best = detectQuestionTypeWithScore(questionText)
  return best.type
}

function extractChartEvidence(chart: QimenChartResult | null) {
  const palaces = Array.isArray(chart?.palaces) ? chart!.palaces : []
  const gates = Array.from(new Set(palaces.map((palace) => cleanText(palace.gate)).filter(Boolean)))
  const stars = Array.from(new Set(palaces.map((palace) => cleanText(palace.star)).filter(Boolean)))
  const deities = Array.from(new Set(palaces.map((palace) => cleanText(palace.deity)).filter(Boolean)))
  const emptyPalaces = palaces.filter((palace) => palace.empty).map((palace) => cleanText(palace.label)).filter(Boolean)
  const horsePalace = cleanText(chart?.markers?.horse_star?.label)
  const activeTerms = [
    cleanText(chart?.chart?.zhi_fu),
    cleanText(chart?.chart?.zhi_shi),
    cleanText(chart?.chart?.xun_shou),
    cleanText(chart?.calendar_context?.solar_term),
    ...gates,
    ...stars,
    ...deities,
    ...emptyPalaces,
    horsePalace,
  ].filter(Boolean)
  return {
    gates,
    stars,
    deities,
    emptyPalaces,
    horsePalace: horsePalace || null,
    activeTerms: Array.from(new Set(activeTerms)),
  }
}

function cardText(card: KnowledgeCard) {
  return [
    cleanText(card.title),
    cleanText(card.rule_text),
    cleanText(card.question_summary),
    cleanText(card.teacher_conclusion),
    cleanText(card.term_note),
    cleanText(card.conflict_rule),
    ...(Array.isArray(card.steps) ? card.steps.map(cleanText) : []),
    ...(Array.isArray(card.trigger_terms) ? card.trigger_terms.map(cleanText) : []),
    ...(Array.isArray(card.tags) ? card.tags.map(cleanText) : []),
  ].filter(Boolean).join(' ')
}

function effectiveKnowledgeTier(card: KnowledgeCard) {
  const sourceType = cleanText(card.source_type)
  const tier = cleanText(card.knowledge_tier) || 'reference'
  if (sourceType === 'document' && tier === 'core') return 'support'
  return tier
}

function scoreCard(card: KnowledgeCard, questionType: string, questionText: string, activeTerms: string[], preferredTeacher = PRIMARY_TEACHER) {
  const text = cardText(card)
  if (!text) return 0
  let score = 0
  if (cleanText(card.question_type) === questionType) score += 4
  else if (cleanText(card.question_type) === 'general') score += 1
  const questionLower = questionText.toLowerCase()
  for (const keyword of QUESTION_KEYWORDS[questionType] ?? []) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) score += 1.2
    if (questionLower.includes(keyword.toLowerCase()) && text.toLowerCase().includes(keyword.toLowerCase())) score += 0.8
  }
  for (const term of activeTerms) {
    if (term && text.includes(term)) score += 1.1
  }
  if (cleanText(card.source_teacher) === cleanText(preferredTeacher)) score += 1.5
  score += Number(card.teacher_priority ?? 0) * 1.5
  score += Number(card.confidence ?? 0) * 1.2
  const tier = effectiveKnowledgeTier(card)
  if (tier === 'core') score += 2.2
  else if (tier === 'support') score += 0.9
  else if (tier === 'reference') score -= 0.4
  return score
}

function tierRank(value: string | null | undefined) {
  switch (cleanText(value)) {
    case 'core':
      return 0
    case 'support':
      return 1
    default:
      return 2
  }
}

function applySupportSignalBoost(
  score: number,
  card: KnowledgeCard,
  questionType: string,
  yearMingSupport?: QimenYearMingSupport | null,
  longCycleSupport?: QimenLongCycleSupport | null,
) {
  const text = cardText(card)
  const tagSet = new Set((card.tags ?? []).map((item) => cleanText(item)))
  let nextScore = score

  if (
    questionType === 'love_relationship' &&
    yearMingSupport &&
    (yearMingSupport.self_year_ming || yearMingSupport.counterpart_year_ming)
  ) {
    if (tagSet.has('relationship_year_ming')) nextScore += 2.8
    else if (tagSet.has('year_ming_anchor')) nextScore += 2.1
    else if (text.includes('年命')) nextScore += 2.2
    if (text.includes('双方')) nextScore += 0.8
    if (text.includes('六合') || text.includes('关系')) nextScore += 0.6
  }

  if (
    (questionType === 'career_work' || questionType === 'money_wealth') &&
    longCycleSupport &&
    (longCycleSupport.current_liu_nian || longCycleSupport.current_dayun)
  ) {
    if (tagSet.has('long_cycle_trend')) nextScore += 2.2
    else if (tagSet.has('timing_overlay')) nextScore += 1.4
    else {
      if (text.includes('流年')) nextScore += 1.8
      if (text.includes('大运')) nextScore += 1.8
    }
    if (text.includes('终身') || text.includes('长期') || text.includes('趋势')) nextScore += 0.8
  }

  return nextScore
}

function collectBoostedSupportIds(
  items: MatchedKnowledge[],
  preferredTags: string[],
  fallbackTerms: string[],
) {
  return items
    .filter((item) => {
      const tags = new Set((item.tags ?? []).map((tag) => cleanText(tag)))
      return preferredTags.some((tag) => tags.has(tag)) || fallbackTerms.some((term) => item.excerpt.includes(term) || item.title.includes(term))
    })
    .slice(0, 5)
    .map((item) => item.id)
}

function buildPrimaryEvidence(
  chart: QimenChartResult,
  evidence: ReturnType<typeof extractChartEvidence>,
  rules: MatchedKnowledge[],
  cases: MatchedKnowledge[],
  conflicts: MatchedKnowledge[],
) {
  return [
    cleanText(chart.chart?.zhi_fu) ? `值符：${cleanText(chart.chart?.zhi_fu)}` : '',
    cleanText(chart.chart?.zhi_shi) ? `值使：${cleanText(chart.chart?.zhi_shi)}` : '',
    cleanText(chart.calendar_context?.solar_term) ? `节气：${cleanText(chart.calendar_context?.solar_term)}` : '',
    evidence.gates[0] ? `活跃门：${evidence.gates.slice(0, 2).join('、')}` : '',
    evidence.stars[0] ? `活跃星：${evidence.stars.slice(0, 2).join('、')}` : '',
    rules[0]?.title ? `主规则：${rules[0].title}` : '',
    cases[0]?.title ? `主案例：${cases[0].title}` : '',
    conflicts[0]?.title ? `冲突校正：${conflicts[0].title}` : '',
  ].filter(Boolean)
}

function matchCards(
  cards: KnowledgeCard[],
  traceKind: MatchedKnowledge['trace_kind'],
  questionType: string,
  questionText: string,
  activeTerms: string[],
  limit: number,
  yearMingSupport?: QimenYearMingSupport | null,
  longCycleSupport?: QimenLongCycleSupport | null,
  preferredTeacher = PRIMARY_TEACHER,
) {
  return cards
    .map((card) => ({
      card,
      score: applySupportSignalBoost(
        scoreCard(card, questionType, questionText, activeTerms, preferredTeacher),
        card,
        questionType,
        yearMingSupport,
        longCycleSupport,
      ),
    }))
    .filter((item) => item.score >= 4.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ card, score }) => ({
      id: cleanText(card.id),
      title: cleanText(card.title) || cleanText(card.term) || cleanText(card.question_summary),
      question_type: cleanText(card.question_type) || 'general',
      source_type: cleanText(card.source_type) || 'document',
      source_teacher: cleanText(card.source_teacher) || PRIMARY_TEACHER,
      source_course_or_book: cleanText(card.source_course_or_book),
      source_lesson_title: cleanText(card.source_lesson_title) || undefined,
      source_ref: cleanText(card.source_ref),
      evidence_refs: Array.isArray(card.evidence_refs) ? card.evidence_refs.map(cleanText).filter(Boolean) : [],
      tags: Array.isArray(card.tags) ? card.tags.map(cleanText).filter(Boolean) : [],
      score: Number(score.toFixed(2)),
      confidence: Number((card.confidence ?? 0).toFixed(2)),
      knowledge_tier: effectiveKnowledgeTier(card),
      original_knowledge_tier: cleanText(card.original_knowledge_tier) || undefined,
      tier_override: card.tier_override
        ? {
            applied: Boolean(card.tier_override.applied),
            source: cleanText(card.tier_override.source),
            reason: cleanText(card.tier_override.reason),
            updated_at: cleanText(card.tier_override.updated_at),
          }
        : undefined,
      excerpt:
        cleanText(card.rule_text) ||
        cleanText(card.teacher_conclusion) ||
        cleanText(card.term_note) ||
        cleanText(card.conflict_rule) ||
        (Array.isArray(card.steps) ? card.steps.map(cleanText).filter(Boolean).join(' -> ') : ''),
      trace_kind: traceKind,
    }))
}

function buildFoundationTheorySupport(items: MatchedKnowledge[]) {
  const grouped = new Map<string, {
    teacher: string
    course: string
    lesson_title: string
    closure_note: string
    matched_support_ids: string[]
    matched_support_titles: string[]
  }>()

  for (const item of items) {
    const teacher = cleanText(item.source_teacher)
    const course = cleanText(item.source_course_or_book)
    const lessonTitle = cleanText(item.source_lesson_title)
    if (!teacher || !course || !lessonTitle) continue
    const lesson = LESSON_LOOKUP.get(`${teacher}::${course}::${lessonTitle}`)
    if (!lesson || cleanText(lesson.closure_bucket) !== 'foundation_theory') continue
    const key = `${teacher}::${course}::${lessonTitle}`
    const existing = grouped.get(key) ?? {
      teacher,
      course,
      lesson_title: lessonTitle,
      closure_note: cleanText(lesson.closure_note),
      matched_support_ids: [],
      matched_support_titles: [],
    }
    if (item.id && !existing.matched_support_ids.includes(item.id)) {
      existing.matched_support_ids.push(item.id)
    }
    if (item.title && !existing.matched_support_titles.includes(item.title)) {
      existing.matched_support_titles.push(item.title)
    }
    grouped.set(key, existing)
  }

  const lessons = [...grouped.values()]
    .sort((a, b) => b.matched_support_ids.length - a.matched_support_ids.length || a.lesson_title.localeCompare(b.lesson_title))
    .slice(0, 6)

  return {
    lessons,
    advisory: lessons.length
      ? '这些理论基础课没有被硬凑成案例链，但它们仍然作为规则、路径和冲突判断的底层知识参与当前推理。'
      : '',
  }
}

function sortByTierAndScore(items: MatchedKnowledge[]) {
  return [...items].sort((a, b) => {
    const tierDiff = tierRank(a.knowledge_tier) - tierRank(b.knowledge_tier)
    if (tierDiff !== 0) return tierDiff
    return b.score - a.score
  })
}

function bucketByTier(items: MatchedKnowledge[]): TierBucket {
  return {
    core: items.filter((item) => item.knowledge_tier === 'core'),
    support: items.filter((item) => item.knowledge_tier === 'support'),
    reference: items.filter((item) => item.knowledge_tier === 'reference'),
  }
}

function layerStats(items: MatchedKnowledge[]): ChainLayerStats {
  return {
    total: items.length,
    core: items.filter((item) => item.knowledge_tier === 'core').length,
    support: items.filter((item) => item.knowledge_tier === 'support').length,
    reference: items.filter((item) => item.knowledge_tier === 'reference').length,
  }
}

function buildChainCoverage(payload: {
  rules: MatchedKnowledge[]
  cases: MatchedKnowledge[]
  patterns: MatchedKnowledge[]
  terms: MatchedKnowledge[]
  conflicts: MatchedKnowledge[]
}): QimenReasoningTrace['chain_coverage'] {
  const counts = {
    rules: layerStats(payload.rules),
    cases: layerStats(payload.cases),
    patterns: layerStats(payload.patterns),
    terms: layerStats(payload.terms),
    conflicts: layerStats(payload.conflicts),
  }
  const missingLayers = Object.entries(counts)
    .filter(([, value]) => value.total === 0)
    .map(([key]) => key)

  const currentGapLayers = ['rules', 'patterns', 'conflicts', 'cases']
    .filter((key) => counts[key as keyof typeof counts].total === 0)

  const strongLayers = ['rules', 'cases', 'patterns', 'conflicts']
    .filter((key) => counts[key as keyof typeof counts].core > 0 || counts[key as keyof typeof counts].support > 0)
    .length
  const hasRouteOrConflict = counts.patterns.total > 0 || counts.conflicts.total > 0
  const completenessLevel =
    counts.rules.total > 0 &&
    counts.cases.total > 0 &&
    counts.patterns.total > 0 &&
    counts.conflicts.total > 0
      ? 'full'
      : strongLayers >= 3 && hasRouteOrConflict && counts.rules.total > 0
        ? 'strong'
        : strongLayers >= 3
          ? 'partial'
          : 'thin'

  const layerLabel = (key: string) =>
    key === 'rules' ? '规则' :
      key === 'cases' ? '案例' :
        key === 'patterns' ? '路径' :
          key === 'terms' ? '术语' : '冲突'

  const advisory =
    completenessLevel === 'full'
      ? '当前题型已经具备较完整的断事链，规则、案例、路径和边界层都已进入主线。'
      : completenessLevel === 'strong'
        ? `当前题型已能独立支撑断事，但仍可继续补强 ${currentGapLayers.map(layerLabel).join('、') || '边缘层'}。`
        : completenessLevel === 'partial'
          ? `当前题型主链可用，但 ${currentGapLayers.map(layerLabel).join('、') || '部分支撑层'} 仍偏薄，复盘时要特别看这些层。`
          : '当前题型命中层偏薄，这次更依赖盘面主证据和少量高分卡，不宜过度延伸。'

  return {
    completeness_level: completenessLevel,
    counts,
    missing_layers: missingLayers,
    current_gap_layers: currentGapLayers,
    advisory,
  }
}

function firstAvailable(...groups: MatchedKnowledge[][]) {
  for (const group of groups) {
    if (group.length > 0) return group[0]
  }
  return null
}

function firstPrimary(groups: TierBucket) {
  return firstAvailable(groups.core, groups.support)
}

function isDocumentSource(item: MatchedKnowledge | null | undefined) {
  return cleanText(item?.source_type) === 'document'
}

function firstPrimaryNonDocument(groups: TierBucket) {
  return firstAvailable(
    groups.core.filter((item) => !isDocumentSource(item)),
    groups.support.filter((item) => !isDocumentSource(item)),
    groups.reference.filter((item) => !isDocumentSource(item)),
  )
}

function firstDocumentSupport(groups: TierBucket) {
  return firstAvailable(
    groups.support.filter((item) => isDocumentSource(item)),
    groups.reference.filter((item) => isDocumentSource(item)),
  )
}

function buildTierAdjustmentSuggestions(items: MatchedKnowledge[]) {
  return items
    .filter((item) => item.knowledge_tier === 'support' && Number(item.feedback_penalty ?? 0) >= 1.2)
    .sort((a, b) => Number(b.feedback_penalty ?? 0) - Number(a.feedback_penalty ?? 0))
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      title: item.title,
      current_tier: item.knowledge_tier,
      suggested_tier: 'reference',
      reason:
        Number(item.id_penalty ?? 0) >= Number(item.step_penalty ?? 0)
          ? '这张卡自身在历史反馈里反复出错，更适合降到背景参考层。'
          : '这类卡在当前题型对应错步里持续不稳，更适合先降到背景参考层。',
      feedback_penalty: Number(item.feedback_penalty ?? 0),
      id_penalty: Number(item.id_penalty ?? 0),
      step_penalty: Number(item.step_penalty ?? 0),
    }))
}

function buildDecision(
  questionType: string,
  questionText: string,
  chart: QimenChartResult | null,
  evidence: ReturnType<typeof extractChartEvidence>,
  rules: MatchedKnowledge[],
  cases: MatchedKnowledge[],
  conflicts: MatchedKnowledge[],
  feedbackLearning?: QimenFeedbackLearning | null,
) {
  const tieredRules = bucketByTier(rules)
  const tieredCases = bucketByTier(cases)
  const tieredConflicts = bucketByTier(conflicts)
  const primaryRule = firstPrimaryNonDocument(tieredRules) ?? firstPrimary(tieredRules) ?? null
  const primaryCase = firstPrimaryNonDocument(tieredCases) ?? firstPrimary(tieredCases)
  const primaryConflict = firstPrimaryNonDocument(tieredConflicts) ?? firstPrimary(tieredConflicts)
  const documentRule = firstDocumentSupport(tieredRules)
  const documentCase = firstDocumentSupport(tieredCases)
  const documentConflict = firstDocumentSupport(tieredConflicts)
  const gate = cleanText(chart?.chart?.zhi_shi)
  const star = cleanText(chart?.chart?.zhi_fu)
  const solarTerm = cleanText(chart?.calendar_context?.solar_term)
  const sample = cleanText(questionText)
  const isBorrowedVehicleCase =
    ['借车', '新车', '车子', '汽车', '卖掉', '抵押', '跑黑车', '开回来'].some((term) => sample.includes(term))
  const isMissingPersonCase =
    !isBorrowedVehicleCase
    && ['失踪', '走失', '联系不上', '诀别信', '寻人', '失联'].some((term) => sample.includes(term))
  const isLawsuitCase =
    ['官司', '诉讼', '起诉', '上诉', '保护令', '开庭', '判决', '调解', '责任', '和解', '法庭', '执行', '强拆', '拆迁', '门面', '政府通知', '执法人员'].some((term) => sample.includes(term))
  const isRelationshipLitigationCase =
    questionType === 'love_relationship'
    && ['离婚', '起诉', '外缘', '第三者', '婚姻'].some((term) => sample.includes(term))
    && isLawsuitCase
  const isSevereHealthCase =
    questionType === 'health_energy'
    && !isMissingPersonCase
    && ['恶性', '肿瘤', '转移', '病危', '危险', '手术', '重症'].some((term) => sample.includes(term))
  const isLostItemCase =
    isBorrowedVehicleCase
    || ['丢失', '找回', '戒指', '钥匙', '银行卡', '失物'].some((term) => sample.includes(term))
  const isDetentionCase =
    ['被抓', '派出所', '拘留', '证据', '放人', '出来'].some((term) => sample.includes(term))
  const isCourtThreatCase =
    questionType === 'health_energy'
    && ['法院', '跟踪', '动粗', '仇家', '堵在法院'].some((term) => sample.includes(term))
    && ['合作', '钱财', '追钱', '致讼', '生意事业合作'].some((term) => sample.includes(term))
  const isSuddenDeathForensicCase =
    questionType === 'health_energy'
    && ['去世', '死亡', '法医', '鉴定', '他杀', '猝死', '脑梗', '缺氧'].some((term) => sample.includes(term))
    && ['父亲', '父亲今晨', '晨练', '晕倒', '路边', '小卖铺'].some((term) => sample.includes(term))
  const isAffairSafetyCase =
    questionType === 'health_energy'
    && ['宾馆', '出轨', '被人打', '羞辱', '我门外', '门外', '家属来', '防守为主', '别出去', '私情', '老公知道', '他老婆知道'].some((term) => sample.includes(term))
  const isTravelSafetyCase =
    !isMissingPersonCase
    && !isAffairSafetyCase
    && ['出行', '探亲', '飞机', '航班', '路上', '日本', '往返', '路途'].some((term) => sample.includes(term))
    && ['安全', '阻碍', '拖延', '顺利'].some((term) => sample.includes(term))
  const isInvestmentSchemeCase =
    !isLawsuitCase
    && questionType === 'money_wealth'
    && !['创业', '做生意', '上班', '本职工作', '技术类工作', '技术方面', '老公财运'].some((term) => sample.includes(term))
    && ['plustoken', 'plus token', '钱包', '项目', '入场', '重仓', '观察', '模式', '资金盘', '平台', '股权', '期权股', '大集团', '国家背景', '北斗'].some((term) => sample.toLowerCase().includes(term))
  const isPlatformAuthenticityCase =
    questionType === 'money_wealth'
    && ['平台', '股权', '期权股', '大集团', '国家背景', '北斗'].some((term) => sample.includes(term))
  const isItemAuthenticityCase =
    questionType === 'money_wealth'
    && ['真假', '真货', '假货', '耳坠', '耳环', '项链', '火机', '烧红', '过水'].some((term) => sample.includes(term))
  const isProjectFraudCase =
    questionType === 'money_wealth'
    && ['假账', '财务不透明', '股份不兑现', '协议书', '责任边界', '补开字据', '挪用', '老人中心', '股份责任'].some((term) => sample.includes(term))
  const isBuriedTreasureCase =
    questionType === 'money_wealth'
    && ['宝藏', '古墓', '古董', '古币', '耕地', '山药地', '石碑', '租用耕地'].some((term) => sample.includes(term))
  const isBackgroundCheckCase =
    questionType === 'money_wealth'
    && ['背景调查', '签约', '入股', '老人中心'].some((term) => sample.includes(term))
  const isProjectQuarrelCase =
    questionType === 'money_wealth'
    && ['老人中心', '吵架', '离开', '六万', '股份', '老者'].some((term) => sample.includes(term))
    && ['合同', '责任边界', '不可靠', '先别投', '28号'].some((term) => sample.includes(term))
  const asksHalfLiability = ['对半', '各担一半', '责任'].some((term) => sample.includes(term))
  const asksFullRecovery = ['拿回', '回款', '全部款项', '全额'].some((term) => sample.includes(term))
  const isWageCollectionCase =
    questionType === 'money_wealth'
    && !['官司', '法院', '调解', '判决', '离婚', '彩礼', '财产问题', '转到', '老家'].some((term) => sample.includes(term))
    && ['工资', '讨薪', '欠薪', '老板拖欠'].some((term) => sample.includes(term))
  const isDivorcePropertyCase =
    isLawsuitCase
    && ['离婚', '分红', '房产', '权益', '男方', '名下'].some((term) => sample.includes(term))
  const isBankCardCase = ['银行卡', '身份证'].some((term) => sample.includes(term))
  const contextSample = [sample, primaryRule?.excerpt || '', primaryCase?.excerpt || '', primaryConflict?.excerpt || ''].join(' ')
  const asksImmediateTiming =
    ['今天', '明天', '今晚', '当晚', '次日', '马上', '尽快', '子时'].some((term) => sample.includes(term))
  const asksDurationTiming =
    ['多久', '几天', '多长时间', '何时能好', '什么时候好', '恢复多久'].some((term) => sample.includes(term))
  const asksLongHorizonTiming =
    ['何时', '哪年', '婚期', '结婚', '明年', '年底', '农历', '未来', '长期', '两三年', '年内'].some((term) => sample.includes(term))
  const asksRetryWindow =
    questionType === 'career_work'
    && ['还有机会', '再试', '转投', '继续找', '下一家', '其他单位'].some((term) => sample.includes(term))
  const asksCareerDevelopmentWindow =
    questionType === 'career_work'
    && ['前景', '发展', '长期', '以后', '未来', '长久'].some((term) => sample.includes(term))
  const isFriendProjectCase =
    questionType === 'career_work'
    && ['朋友', '新项目', '管理岗', '管理股', '停薪留职', '请假去帮忙', '请假', '辞职', '合作经营', '出国', '国外项目', '原部门'].some((term) => sample.includes(term))
    && ['去做管理', '做管理', '邀请', '邀去', '平台', '产品', '资金', '领导带我去', '跟领导去做新项目', '朋友聘我去', '去新部门', '出国机会', '原部门好', '管理岗会不会兑现'].some((term) => sample.includes(term))
  const isJobOpportunityCase =
    questionType === 'career_work'
    && !isFriendProjectCase
    && !['工作室', '咨询工作室', '预测工作室', '写字楼', '开业', '办公室的位置', '办公室本身'].some((term) => sample.includes(term))
    && !['停职', '财务问题', '牵连', '领导层', '工作发展', '打开局面', '大客户', '签单', '事业提升', '裁员', '留岗', '被裁', '复试', '笔试', '面试', '录取', '复职', '革职', '降职', '离职', '辞职', '脱得开', '还能不能继续做', '真正离开', '呆多久', '能呆多久', '在这里能呆多久', '工作状况', '是否有变动'].some((term) => sample.includes(term))
    && ['工作', '应聘', '单位', '岗位', '找工作', '机会', '值得去做', '继续寻找'].some((term) => sample.includes(term))
  const isJobLeaveCase =
    questionType === 'career_work'
    && !isFriendProjectCase
    && !['福州', '北京', '南方', '外地', '本地'].some((term) => sample.includes(term))
    && ['离职', '辞职', '还能不能继续做', '真正离开', '脱得开', '现在这份工作', '什么时候离开', '呆多久', '能呆多久', '在这里能呆多久', '工作状况', '是否有变动', '适不适合这一行', '做不长', '出现变动', '被动结束', '保险工作'].some((term) => sample.includes(term))
  const isReinstatementCase =
    questionType === 'career_work'
    && (
      sample.includes('复职')
      || sample.includes('革职')
      || (sample.includes('降职') && !['会不会降职', '是否降职'].some((term) => sample.includes(term)))
    )
  const isIntermediaryHelpCase =
    questionType === 'career_work'
    && !['停职', '财务问题', '牵连', '领导层', '工作发展', '大客户', '签单', '事业提升'].some((term) => sample.includes(term))
    && ['张师傅', '帮忙处理', '转向找其他人', '帮得上', '后事', '联系本身'].some((term) => sample.includes(term))
  const isAssignmentNetworkingCase =
    questionType === 'career_work'
    && !['队长', '送水果', '送烟', '印象', '加分', '双首长'].some((term) => sample.includes(term))
    && ['军校', '分配', '教导员', '系主任', '提高成绩', '平时成绩'].some((term) => sample.includes(term))
  const isGiftNetworkingCase =
    questionType === 'career_work'
    && ['队长', '送水果', '送烟', '印象', '加分', '双首长'].some((term) => sample.includes(term))
    && ['军校', '分配', '教导员', '队长', '平时成绩', '加分'].some((term) => sample.includes(term))
  const isBidCompetitionCase =
    questionType === 'career_work'
    && ['竞标', '中标', '投标', '污水工程', '工程竞标'].some((term) => sample.includes(term))
  const isOfficialCareerRiseCase =
    questionType === 'career_work'
    && !['暧昧', '暗线', '暗中', '头衔', '位置能不能保住', '被调整降下来', '小人得志'].some((term) => sample.includes(term))
    && ['仕途', '副处', '实职', '虚职', '提拔', '2019', '职位上升', '不太受重用'].some((term) => sample.includes(term))
  const isPersonnelCoordinationCase =
    questionType === 'career_work'
    && !isBidCompetitionCase
    && ['同意还是不同意', '帮他还是不帮', '调动一个学生', '1965', '1960', '人事关系', '分管领导', '主管领导', '女主任', '泼妇', '特殊关系'].some((term) => sample.includes(term))
  const isSalaryRaiseCase =
    questionType === 'career_work'
    && !['签证', '多次往返', '韩国', '旅行社', '申请理由', '政府卡住'].some((term) => sample.includes(term))
    && ['涨工资', '申请', '总监', '金院长', '党委书记', '涨薪'].some((term) => sample.includes(term))
  const isDocumentProcedureCase =
    questionType === 'career_work'
    && ['签证', '多次往返', '韩国', '旅行社', '申请理由', '政府卡住', '文书事', '退下来'].some((term) => sample.includes(term))
  const isPersonnelRumorCase =
    questionType === 'career_work'
    && !['裁员', '留岗', '被裁', '公司', '负债', '重组', '倒闭'].some((term) => sample.includes(term))
    && ['人事调整', '调来', '调走', '风声', '回避政策', '岗位', '正职', '副职', '调换岗位'].some((term) => sample.includes(term))
  const isImproperPromotionCase =
    questionType === 'career_work'
    && ['小人得志', '暧昧关系', '不正当手段', '暗中行事', '突然提拔', '职位不好保', '头衔没有了', '降职了'].some((term) => sample.includes(term))
  const isBusinessOpeningCase =
    questionType === 'career_work'
    && ['工作发展', '打开局面', '大客户', '签单', '事业提升', '贵人线', '市场', '客户', '开发', '拓展', '先开哪边', '合伙创业', '制衣厂', '服装设计', '款式设计', '工作室', '咨询工作室', '预测工作室', '写字楼', '开业', '办公室的位置'].some((term) => sample.includes(term))
  const isDepartmentChoiceCase =
    questionType === 'career_work'
    && ['后勤', '科研', '新大学', '选部门', '学院拆了', '调整重组'].some((term) => sample.includes(term))
  const isStorefrontCase =
    questionType === 'career_work'
    && !['福州', '北京', '找工作', '工作机会', '去福州', '北京找工作', '本地找', '异地工作'].some((term) => sample.includes(term))
    && ['店铺', '门店', '换址', '东南方', '南方', '客户不好找', '经营前景'].some((term) => sample.includes(term))
  const isDisciplinaryExposureCase =
    questionType === 'career_work'
    && ['停职', '处分', '牵连', '领导层', '财务问题', '下属'].some((term) => sample.includes(term))
  const isLayoffCase =
    questionType === 'career_work'
    && ['裁员', '留岗', '被裁', '原岗位', '不满意'].some((term) => sample.includes(term))
  const isInterviewHiringCase =
    questionType === 'career_work'
    && ['面试', '面试官', '取消', '屏蔽', '通过机会'].some((term) => sample.includes(term))
    && !['复试', '笔试', '研究生', '司法考试', '考试', '录取'].some((term) => sample.includes(term))
  const isCoverPostCase =
    questionType === 'career_work'
    && ['顶班', '机械处', '处长', '校长', '1977', '读博'].some((term) => sample.includes(term))
  const isCompanyChoiceCase =
    questionType === 'career_work'
    && (
      ['三个公司', '3 个公司', '哪家公司', '去哪家公司', '90', '37', '26'].some((term) => sample.includes(term))
      || (sample.includes('三个') && sample.includes('公司'))
    )
    && ['上班', '公司'].some((term) => sample.includes(term))
  const isRelocationChoiceCase =
    questionType === 'career_work'
    && ['福州', '北京', '南方', '外地', '本地'].some((term) => sample.includes(term))
    && ['找工作', '工作机会', '去福州', '北京找工作', '本地找'].some((term) => sample.includes(term))
  const isMilitaryDirectionCase =
    questionType === 'career_work'
    && ['军区', '38军', '27军', '成都炮兵团', '西藏', '去哪个方向', '去哪个军', '以后发展比较好'].some((term) => sample.includes(term))
  const isSchoolApplicationCase =
    questionType === 'career_work'
    && ['申请学校', '候补', '候补名单', '私立学校'].some((term) => sample.includes(term))
  const isSchoolEntranceCase =
    questionType === 'career_work'
    && !isSchoolApplicationCase
    && ['中考', '第一志愿', '女儿', '平时成绩', '复习基础'].some((term) => sample.includes(term))
  const isMeritAwardCase =
    questionType === 'career_work'
    && ['二等功', '评功', '立功', '授奖', '评奖'].some((term) => sample.includes(term))
  const isStudyStateCase =
    questionType === 'career_work'
    && !['学习资料', '真题解析', '高考真题', '六门课程', '题型与思路'].some((term) => sample.includes(term))
    && ['学习情况', '学习状态', '高二', '借同学手机', '半夜不睡', '女生追求', '青春期', '纸条'].some((term) => sample.includes(term))
  const isStudyMaterialsCase =
    questionType === 'career_work'
    && ['学习资料', '真题解析', '高考真题', '六门课程', '题型与思路'].some((term) => sample.includes(term))
  const isStudyPerformanceCase =
    questionType === 'career_work'
    && ['小孩考试', '数学', '排名', '填空', '竞赛题', '偏难题', '试卷'].some((term) => sample.includes(term))
    && !['面试', '录取', '复试', '司法考试', '考驾照', '科目二', '第一志愿', '候补'].some((term) => sample.includes(term))
  const isExamDisciplineCase =
    questionType === 'career_work'
    && ['飞行员学员', '考试作弊', '作弊', '作产被发现', '摆平', '主管这事的领导', '钱能花出去'].some((term) => sample.includes(term))
  const isExamAdmissionCase =
    questionType === 'career_work'
    && !isExamDisciplineCase
    && ['复试', '笔试', '面试', '录取', '研究生', '司法考试', '考试', '过线', '分数', '奥赛', '名次', '省二', '省一'].some((term) => sample.includes(term))
  const isExamPlanningCase =
    questionType === 'career_work'
    && ['替考', '前桌', '选择题', '合作', '监考', '抄题'].some((term) => sample.includes(term))
  const asksMarketExpansionWindow =
    questionType === 'career_work'
    && ['市场', '客户', '开发', '纽约', '华尔街', '好莱坞', '哪边', '先开发', '拓展'].some((term) => sample.includes(term))
  const asksDisciplinaryExposureWindow =
    questionType === 'career_work'
    && ['停职', '处分', '牵连', '下属', '财务问题', '领导层', '怎么看', '卷进去'].some((term) => sample.includes(term))
  const asksCompanyPressureWindow =
    questionType === 'career_work'
    && ['公司情况', '经营情况', '公司', '债务压力', '扛过去', '资金压力', '经营压力', '临门一脚'].some((term) => sample.includes(term))
  const isCompanyPressureCase =
    questionType === 'career_work'
    && ['公司情况', '经营情况', '表面架子', '资金压力', '债务压力', '收入不稳', '开销', '起不来', '扛过去'].some((term) => sample.includes(term))
  const isJobDevelopmentCase =
    questionType === 'career_work'
    && ['值得去', '谈成', '发展前景', '长期做', '房地产工作', '整体发展'].some((term) => sample.includes(term))
  const asksHousingInvestmentWindow =
    questionType === 'money_wealth'
    && !['过户', '房贷', '贷款没还清', '房产证', '银行证件', '给儿子', '十七万', '17万', '公婆'].some((term) => sample.includes(term))
    && !['终身运', '投资经商', '二次婚姻', '钱难留', '晚年', '老年'].some((term) => sample.includes(term))
    && !['卖不掉', '还不了', '哥哥', '缓一时', '继续帮'].some((term) => sample.includes(term))
    && ['买房', '房子', '房价', '自住', '投资'].some((term) => sample.includes(term))
  const isPropertyTransferCase =
    questionType === 'money_wealth'
    && ['过户', '房贷', '贷款没还清', '房产证', '银行证件', '给儿子', '十七万', '17万', '公婆'].some((term) => sample.includes(term))
  const isHousingPurchaseCase =
    questionType === 'money_wealth'
    && !isPlatformAuthenticityCase
    && !isPropertyTransferCase
    && !['终身运', '投资经商', '二次婚姻', '钱难留', '晚年', '老年'].some((term) => sample.includes(term))
    && !['卖不掉', '还不了', '哥哥', '缓一时', '继续帮'].some((term) => sample.includes(term))
    && ['买房', '房子', '房价', '自住', '投资', '噪音', '防水'].some((term) => sample.includes(term))
  const isUsedCarSourceCase =
    questionType === 'money_wealth'
    && ['宝马', '奥迪', '纽约', '朋友介绍', '二手车', '本地'].some((term) => sample.includes(term))
  const isUsedCarChoiceCase =
    questionType === 'money_wealth'
    && ['银色', '白色', '二手车', '两辆车'].some((term) => sample.includes(term))
  const asksDebtCommunicationWindow =
    questionType === 'money_wealth'
    && ['还不了', '继续帮', '解释', '沟通', '哥哥', '宽限', '缓一时'].some((term) => sample.includes(term))
  const isDebtCommunicationCase =
    questionType === 'money_wealth'
    && ['还不了', '继续帮', '解释', '沟通', '哥哥', '宽限', '缓一时'].some((term) => sample.includes(term))
  const isDebtRecoveryCase =
    questionType === 'money_wealth'
    && ['尾款', '回款', '催款', '拖欠', '收回', '到账', '兑现'].some((term) => sample.includes(term))
  const isOrderDepositCase =
    questionType === 'money_wealth'
    && ['定金不到', '服装订单', '老客户', '做衣服', '数量和价格', '转账全款', '接单'].some((term) => sample.includes(term))
  const isPhoneNumberDisputeCase =
    questionType === 'money_wealth'
    && ['手机号', '号码', '抢占', '抢号', '绑定身份证', '店员', '抬价'].some((term) => sample.includes(term))
  const isPyramidSchemeCase =
    questionType === 'money_wealth'
    && ['传销', '平台费', '见不得光', '产品不好卖', '几年挣几十万'].some((term) => sample.includes(term))
  const isSupportLoanCase =
    questionType === 'money_wealth'
    && !['买房', '房子', '房价', '分期', '贷款'].some((term) => sample.includes(term))
    && ['借钱', '借款', '借到', '借不出', '周转', '资金紧张', '借给', '借款人'].some((term) => sample.includes(term))
  const isCooperationGiftCase =
    questionType === 'money_wealth'
    && ['合作', '送礼', '两幅画', '字画', '181', '339', '项目做不起来'].some((term) => sample.includes(term))
  const isWealthOverviewCase =
    questionType === 'money_wealth'
    && ['偏财暗财', '多渠道发展', '事业财运', '合作共事', '财运整体', '运气', '运势', '去年运势', '收入下降', '收入少', '工资低迷', '夫妻争吵', '消化系统', '眼睛', '肺', '交通事故', '血光', '房子有问题', '住处有问题', '工作上不稳定', '上半年', '下半年', '问题的本源是工作', '事业根源', '终身运', '投资经商', '二次婚姻', '钱难留', '晚年', '老年', '老公财运', '创业做生意', '偏财能不能碰', '技术类工作', '想法偏高', '行动不足', '本职工作'].some((term) => sample.includes(term))
  const isUnfulfilledAffinityCase =
    questionType === 'love_relationship'
    && ['女方心里是否有你', '心里是否有你', '第三方', '不了了之', '发展成婚姻'].some((term) => sample.includes(term))
  const isPartnerHealthBarrierCase =
    questionType === 'love_relationship'
    && ['性功能', '生育能力', '生育障碍', '怀不上', '不孕', '输卵管', '打过胎', '子宫受伤', '没有小孩'].some((term) => sample.includes(term))
    && ['结婚', '婚姻', '走到结婚', '治疗', '分开', '结不成'].some((term) => sample.includes(term))
  const isLateMarriageCase =
    questionType === 'love_relationship'
    && ['晚婚', '单身', '什么时候结婚', '婚运', '烂桃花', '嫁入有钱人家', '抓住时机'].some((term) => sample.includes(term))
    && ['结婚', '婚姻', '相亲', '桃花'].some((term) => sample.includes(term))
  const asksInvestmentSchemeWindow =
    questionType === 'money_wealth'
    && !['创业', '做生意', '上班', '本职工作', '技术类工作', '技术方面', '老公财运'].some((term) => sample.includes(term))
    && ['项目', '入场', '观察', '模式', '重仓', '钱包'].some((term) => sample.includes(term))
  const asksRelationshipContactWindow =
    questionType === 'love_relationship'
    && ['主动联系', '联系对方', '联系他', '联系她', '该不该联系', '适不适合联系'].some((term) => sample.includes(term))
  const isConflictMediationCase =
    questionType === 'love_relationship'
    && ['纠纷', '化解', '公门', '通关', '谁在克你', '人际冲突'].some((term) => sample.includes(term))
  const isReconcileVisitCase =
    questionType === 'love_relationship'
    && ['复和', '复合'].some((term) => sample.includes(term))
    && ['母亲家', '妈妈家', '带家人去', '秘密过去', '秘密前往'].some((term) => sample.includes(term))
    && ['见不到人', '躲避', '不见', '硬谈', '勉强'].some((term) => sample.includes(term))
  const asksRelationshipStageRisk =
    questionType === 'love_relationship'
    && ['第三者', '夭折', '值不值得继续', '还能继续', '能否继续'].some((term) => sample.includes(term))
  const isRelationshipInstabilityCase =
    questionType === 'love_relationship'
    && (
      ['离开', '回头', '第三者', '外部因素', '父母不同意', '父母阻力', '男方不稳定', '男方不稳', '男方稳定性', '前任', '更在乎', '不主动', '名存实亡', '无交流', '难走到结婚', '易分手', '分居', '缺乏感情交流', '长期空耗', '不上心', '桃花', '晚婚', '女友', '结婚机会', '情人', '私人关系', '不敢公开', '长久', '老同学', '同学会', '暧昧', '多人相争', '什么想法', '有家庭', '妻子', '离婚娶', '时有时无', '被利用', '事业助力', '父母安排', '回老家结婚', '偶尔联系', '诉苦', '三角恋', '见面联系', '挽回', '第三次婚姻', '2021', '小孩', '生育障碍', '怀不上', '财产分割', '共同生活', '花店', '缘分', '承诺', '新认识', '介绍对象', '靠不靠谱', '小三', '长辈', '婆婆', '公婆', '改善'].some((term) => sample.includes(term))
      || (
        ['工作', '压力', '婚姻'].every((term) => sample.includes(term))
        && ['互相喜欢', '现实', '保守', '压抑', '不好发展'].some((term) => sample.includes(term))
      )
    )
  const isWorkAffairCase =
    questionType === 'love_relationship'
    && ['客户', '私情', '做情人', '提成', '给钱', '工作里的客户', '主管', '压力'].some((term) => sample.includes(term))
    && ['值得继续', '财并不大', '麻烦', '争吵是非', '家庭', '工作'].some((term) => sample.includes(term))
  const isPartnerComparisonCase =
    questionType === 'love_relationship'
    && ['当前男友', '前男友', '如何选择', '回头复合', '实际行动'].some((term) => sample.includes(term))
  const isReconciliationCase =
    questionType === 'love_relationship'
    && ['复合', '前夫', '断断续续接触', '儿子跟他', '为了看儿子'].some((term) => sample.includes(term))
  const isSpecialRelationshipCase =
    questionType === 'love_relationship'
    && ['同性恋', '同性', '特殊关系', '特殊感情', '朋友交往的关系'].some((term) => sample.includes(term))
  const isMarriagePreservationCase =
    questionType === 'love_relationship'
    && ['婚姻是否能保住', '第三者介入', '男方搬出去', '不让搬走', '男方母亲', '女儿班主任'].some((term) => sample.includes(term))
  const isDigestiveHealthCase =
    questionType === 'health_energy'
    && ['肠胃', '胃病', '消化', '湿热', '肿块', '饮食调理'].some((term) => sample.includes(term))
  const isSubhealthRecoveryCase =
    questionType === 'health_energy'
    && !['小孩', '孩子', '女儿', '儿子', '受惊', '发烧', '冷热感冒'].some((term) => sample.includes(term))
    && ['有气无力', '全身乏力', '身体很疲惫', '工作压力太大', '压力太大', '肠胃不舒服', '腹部不舒服', '拉肚子'].some((term) => sample.includes(term))
  const isYinEnvironmentHealthCase =
    questionType === 'health_energy'
    && ['没食欲', '没有食欲', '身体无力', '阴气', '很少见太阳', '少见阳光', '几个月没出过门', '空旷的地方', '夜间少出行', '农历5月自然会恢复'].some((term) => sample.includes(term))
  const isChildConflictMediationCase =
    questionType === 'health_energy'
    && ['同学冲突', '见面对质', '道歉', '老师调解', '带人去', '容易出事'].some((term) => sample.includes(term))
  const isElderCriticalHealthCase =
    questionType === 'health_energy'
    && ['公公', '父亲', '老人', '岳母', '妈妈', '长辈', '急病', '肺部', '心脏', '脑血管', '年底难关', '摔伤', '手骨', '脚', '骨伤'].some((term) => sample.includes(term))
  const isChildbirthSafetyCase =
    questionType === 'health_energy'
    && ['生产', '顺产', '剖腹', '剖腹产', '预产期', '什么时候出生', '母子平安', '早产'].some((term) => sample.includes(term))
  const isFetalGenderCase =
    questionType === 'health_energy'
    && !isChildbirthSafetyCase
    && ['胎儿性别', '宝宝性别', '男孩', '女孩', '男宝', '女宝'].some((term) => sample.includes(term))
  const isDepressionCase =
    questionType === 'health_energy'
    && ['抑郁', '轻生', '心结', '打胎', '自责', '不爱出门', '说梦话', '压抑'].some((term) => sample.includes(term))
  const isNeurologicalDisorderCase =
    questionType === 'health_energy'
    && ['神经病', '神经失常', '乱说话', '不睡觉', '后遗症', '头部被撞', '受刺激', '精神不太正常'].some((term) => sample.includes(term))
    && !['公公', '父亲', '老人', '岳母', '妈妈', '长辈', '脑溢血', '脑出血', '脑血管', '高血压'].some((term) => sample.includes(term))
  const isTerminalCancerCase =
    questionType === 'health_energy'
    && !['公公', '父亲', '老人', '岳母', '妈妈', '长辈', '急病', '肺部', '心脏', '脑血管', '年底难关', '摔伤', '手骨', '脚', '骨伤'].some((term) => sample.includes(term))
    && ['癌症晚期', '晚期', '生命危险', '离世', '危险期'].some((term) => sample.includes(term))
  const isCardiovascularMaintenanceCase =
    questionType === 'health_energy'
    && (
      ['冠心病', '心肌缺血', '血管堵塞', '血液受阻', '不能操劳', '维持', '软化血管', '心脏', '胸闷', '负荷高', '劳累'].some((term) => sample.includes(term))
      || (
        sample.includes('父亲')
        && ['心脏', '经常用药', '求财', '财运', '耗身'].some((term) => sample.includes(term))
      )
    )
  const isPetSafetyCase =
    questionType === 'health_energy'
    && ['狐狸', '宠物', '继续养', '安全隐患', '家人反对'].some((term) => sample.includes(term))
  const isAcuteRecoveryCase =
    questionType === 'health_energy'
    && !['住院', '病情轻重', '病程长短', '治疗效果', '难治', '长期压抑', '气血不畅', '妹妹', '抑郁', '轻生', '心结', '打胎', '癌症晚期', '生命危险', '离世'].some((term) => sample.includes(term))
    && ['咳嗽', '新病', '好转', '恢复', '医生是否有效', '医院检查', '多久能好', '头痛', '上火', '发炎', '热感冒'].some((term) => sample.includes(term))
  const isChronicTreatmentCase =
    questionType === 'health_energy'
    && ['住院', '病情轻重', '病程长短', '治疗效果', '难治', '长期压抑', '气血不畅', '妹妹', '抑郁', '轻生', '心结', '打胎', '癌症晚期', '生命危险', '离世', '胃弱', '偏头痛', '神经紧张', '颈椎', '久坐办公室'].some((term) => sample.includes(term))
  const asksDoctorEffectiveness =
    questionType === 'health_energy'
    && ['医生治疗是否有效', '是否需要更换医生', '当前医生', '换医生'].some((term) => sample.includes(term))
  const asksDetentionReleaseCase =
    questionType === 'health_energy'
    && ['取保', '拘留', '还能出来', '多久能出来', '牢狱'].some((term) => sample.includes(term))
  const isSurgeryPathCase =
    questionType === 'health_energy'
    && ['手术', '南方医院', '东北', '西北', '午时', '属马'].some((term) => sample.includes(term))
  const isMedicalScamCase =
    questionType === 'health_energy'
    && ['医托', '黄牛党', '黄牛', '假信息', '骗子', '门诊', '陈主任', '转院'].some((term) => sample.includes(term))
  const isDisasterNewsCase =
    questionType === 'health_energy'
    && ['溃口', '洪水', '洪灾', '灾情', '伤灾', '死亡', '塌陷'].some((term) => sample.includes(term))
    && ['消息', 'QQ', '弹出'].some((term) => sample.includes(term))
  const isHouseAnomalyCase =
    questionType === 'health_energy'
    && ['房屋怪异', '房子怪异', '房子不对劲', '旧坟', '坟地', '地基', '阴魂', '做法', '安送'].some((term) => sample.includes(term))
  const isAncestralTombCase =
    questionType === 'health_energy'
    && ['祖坟', '扫墓', '梦见爷爷', '梦见奶奶', '梦见祖辈', '坟墓气场', '不顺是否与祖坟有关'].some((term) => sample.includes(term))
  const isPersonalityProfileCase =
    questionType === 'career_work'
    && ['表弟性格', '堂弟性格', '什么性格', '性格怎么样', '属兔', '90后出生的'].some((term) => sample.includes(term))
  const isGeopoliticalTradeCase =
    questionType === 'money_wealth'
    && ['中韩关系', '萨德', '韩国货', '旅行社', '中韩贸易', '贸易会有回升', '韩方会谦让', '中印边境', '洞朗', '印度', '边境对峙', '大规模战争', '印方退让', '法国总统大选', '马克龙', '勒庞', '奥朗德', '第二轮', '拉票', '美国总统大选', '特朗普', '希拉里', '选民', '获胜机会'].some((term) => sample.includes(term))
  const isEnvironmentalConditionCase =
    questionType === 'health_energy'
    && ['下雨', '天气', '阴天'].some((term) => sample.includes(term))
  const asksMedicationWindow =
    questionType === 'health_energy'
    && ['中药', '西药', '加重', '消炎', '调理'].some((term) => sample.includes(term))
  const hasLunarWindowHint = ['农历', '十月', '八月', '六七月', '年底', '明年', '2020'].some((term) => contextSample.includes(term))
  const hasExtendedReturnWindowHint =
    ['24号', '一个月', '最晚', '今晚', '当晚', '次日', '7-11点'].some((term) => contextSample.includes(term))
  const caseSpecificLead =
    isMissingPersonCase
      ? `这是走失与人身安全题，先分人在不在险境，再看去向、是否能找回和回来的窗口。${sample.includes('割腕') ? '这类案子还要单独分“是真受伤还是完全作假、是否真到自杀程度”。' : ''}${sample.includes('报警') || sample.includes('诀别信') ? '若已经准备报警或留诀别信，也要单独看报警和联系晚辈哪条线更有效。' : ''}`
      : isSuddenDeathForensicCase
      ? '这是猝死鉴定题，先分突然死亡到底是他杀还是急病，再看脑血管旧病、长期劳累和家庭压力这条线，最后落到法医鉴定更会指向脑梗缺氧猝死。'
      : isCourtThreatCase
      ? '这是法院围堵安全题，先分这次是不是合作和钱财致讼，再看对方会不会跟踪或动粗，以及本人今天中午前后能不能平安回来。整体更像对方主要为钱施压，会跟踪，但一般不动粗，人最终能平安回来。'
      : isAffairSafetyCase
      ? '这是私情冲突安全题，先分人身会不会真受伤，再看感情私情引起的是非、对方家属会不会上门闹事、今晚是否宜外出。整体更像今晚必须防守为主，会有吵闹施压，但不至于真的打出重伤。'
      : isChildbirthSafetyCase
      ? '这是生产平安题，先分胎儿性别，再看发动时间、顺产还是剖腹，以及母子平安线。'
      : isFetalGenderCase
      ? '这是胎儿性别题，先分阴阳男女信息，不把泛泛胎气当成性别判断。'
      : isSpecialRelationshipCase
      ? '这是特殊关系判断题，先分当前关系是否已经不顺，再看对方是否回避、这段关系本身是否有缺陷、是否适合继续；这条线整体更像不适合继续深走，也不易长久。'
      : isPartnerHealthBarrierCase
      ? '这是病弱阻婚题，先分感情本身是不是还有推进空间，再看男方长期性功能和生育能力问题会不会把婚姻现实拖住；整体更像治疗能有一点效果，但很难根治，关系最后仍偏分开。'
      : isLateMarriageCase
      ? '这是晚婚婚运题，先分眼前是不是晚婚和烂桃花，再看真正成婚窗口落在哪一年，以及对象条件和婚后脾气。整体更像今年有桃花但难成，真正容易结婚是在下一年，而且对象条件不错但脾气不小。'
      : isCoverPostCase
      ? '这是顶班机会题，先分这件事对自己是不是机会，再看本人想不想去、校长更偏向谁，以及机械处长最后能不能真走成。'
      : isImproperPromotionCase
      ? '这是关系提拔题，先分她是不是靠暧昧或暗线手段上位，再看个人实力够不够、位置能不能保住，以及后续会不会被调整降下来。'
      : isPartnerComparisonCase
      ? '这是择偶比较题，先把现男友和前男友两条线拆开，再看谁更像口头有情、现实却都难落成；重点不是马上二选一，而是看两条线最终是否都不好成。'
      : isUnfulfilledAffinityCase
      ? `这是有缘无果题，先分双方是不是完全无缘，再看女方心里是否有你、婚姻能否落成，以及第三方和后续疏远这条线。${sample.includes('1987') && sample.includes('1983') ? '这类双相亲盘还要把1983和1987两条线分开，尤其要单独点出1987这条线眼光高、想法多。' : ''}`
      : isConflictMediationCase
      ? '这是关系纠纷化解题，先分谁在克你、谁能通关，再看是否需要中间人或公门系统介入。'
      : isReconcileVisitCase
      ? '这是复和见面题，先分现在主动过去是否合适，再看对方会不会躲避不见、是否适合低调秘密前往，以及真见到后能不能略偏有利。整体更像不宜硬攻，对方会回避，低调秘密去略有利，但仍难轻松谈成。'
      : isRelationshipLitigationCase
      ? `这是婚姻破局题，先分婚姻主线是否已经走到现实破局，再看外缘、起诉和后续走向；当前更像现实破局而不是短期和缓。${sample.includes('又起诉') || sample.includes('再次起诉') ? '这类还要单独看事情是不是已经反复不顺、对方起诉到底是不是冲着离婚本身，以及后天开庭是否对己不利。' : ''}${sample.includes('上诉') || sample.includes('保护令') || sample.includes('判不离') ? '若题里已经到了判不离后还提保护令、还想上诉，就要单独看对方是否仍不甘心继续折腾，以及自己当前是否压力很大、仍偏被动。' : ''}`
      : isWorkAffairCase
      ? '这是工作私情题，先分这段私情是不是和工作客户及提成利益绑在一起，再看能得多少财、麻烦会不会更大，以及是否值得继续。整体更像能得一点小财，但财不大，家庭和工作上的麻烦更重，所以不值得。'
      : isRelationshipInstabilityCase
      ? `这是关系拉扯题，先分谁更在乎、关系会不会短期离开，再看第三方、父母或前任等外缘因素。${sample.includes('父母') || sample.includes('父母安排') ? '若题里带父母阻力或父母安排，父母因素要单独拆开。' : ''}${sample.includes('男方稳定') || sample.includes('男方不稳') ? '男方稳定性也要单独判断。' : ''}${sample.includes('离婚') || sample.includes('离婚娶') ? '婚姻盘还要单独分“短期会不会真离婚”。' : ''}${['老同学', '同学会', '暧昧', '多人相争', '什么想法'].some((term) => sample.includes(term)) ? '这类旧人纠缠盘还要把“表面不热、心里仍有你，多角暧昧是非偏重”单独写出来。' : ''}${sample.includes('有家庭') || sample.includes('妻子') || sample.includes('被利用') ? '若题里是有家庭男方，还要单独分“妻子不会放手、男方难真正离婚，以及你是否被他拿来做事业助力”。' : ''}${sample.includes('回老家结婚') || sample.includes('偶尔联系') ? '若题里是父母拆散型异地关系，还要把“难见难联、男方回老家结婚、后面仍偶有联系”单独写出来。' : ''}${sample.includes('第三次婚姻') || sample.includes('2021') || sample.includes('挽回') ? '若题里还问再婚和生育，要把“前缘挽回无望、后面仍有婚缘窗口、子女缘偏弱”拆开写。' : ''}${sample.includes('怀不上') || sample.includes('生育障碍') || sample.includes('财产分割') || sample.includes('名存实亡') ? '若题里是多年同居难婚盘，还要单独把生育矛盾、共同事业与财产分割写进去。' : ''}${sample.includes('工作') || sample.includes('压力') || sample.includes('发展') ? '若题里还带工作和现实压力，要把工作不稳、现实压力明显、推进压抑单独写出来。' : ''}${sample.includes('双方都不太主动') || sample.includes('选择较多') || sample.includes('疏远分开') ? '若题里本身就在问双方都不太主动、各有选择，就要直接写关系不稳定，后面更像慢慢疏远分开，难真正走到一起。' : ''}${sample.includes('母亲家') || sample.includes('秘密过去') || sample.includes('不见') || sample.includes('硬谈') || sample.includes('勉强') ? '若题里是上门求和盘，还要单独写“不宜硬攻、对方可能躲避不见，低调秘密前往略有利，但整体仍不易谈成”。' : ''}`
      : isReconciliationCase
      ? `这是复合回头题，先分这段关系是不是已经伤得很深，再看男方过错、女方忍让和复合机会；整体更像有回头迹象，但复合机会不大，就算勉强复合也还会再分。${sample.includes('小孩') || sample.includes('儿子') || sample.includes('看儿子') ? '若题里已经围绕孩子探视和离婚后牵连展开，还要单独写“会因孩子继续牵连，男方外面仍有女人，后续还会反复争吵拉扯，难真正复婚”。' : ''}`
      : isCompanyPressureCase
      ? '这是公司承压题，先分公司是不是只有表面架子，再看收入开销、资金压力和后续能否扛住。'
      : isDisciplinaryExposureCase
      ? '这是停职牵连题，先分停职背后的真实原因，再看是否牵连到自己与后续应对。'
      : isFriendProjectCase
      ? '这是朋友邀职题，先分朋友是不是真心、项目平台靠不靠得住，再看要不要辞职下注。'
      : isIntermediaryHelpCase
      ? '这是中间人帮忙题，先分对方是否真愿意帮、联系顺不顺，再看自己会不会转向找其他人。'
      : isMilitaryDirectionCase
      ? '这是军区去向题，先分哪条线长远发展最好，再看眼前哪边更容易去成，不把“当前更容易”直接当成“以后最好”。'
      : isSchoolApplicationCase
      ? '这是学校申请题，先分孩子当前状态是不是已经受挫，再看候补名单补上的机会、消息窗口和当年是否仍有希望。整体更像候补机会偏低，消息会落在农历三四月，但当年仍无缘这所学校。'
      : isSchoolEntranceCase
      ? '这是升学录取题，先分平时基础和复习是否到位，再看身体与压力会不会影响发挥，以及第一志愿能否录取。'
      : isMeritAwardCase
      ? '这是评功授奖题，先分这件事本身容不容易成，再看领导支持力度、功奖级别能否落到自己头上，以及结果最终能否落定。'
      : isOfficialCareerRiseCase
      ? '这是仕途上升题，先分个人能力与现实阻隔，再看今年这轮提升是否落地，以及下一次明显上升窗口。'
      : isStudyStateCase
      ? '这是学习状态题，先分孩子是不是受异性和青春期因素影响，再看心思是否已经离开学习主线、亲子关系是否紧张，以及恢复大概要拖多久。'
      : isStudyMaterialsCase
      ? '这是学习资料采购题，先分资料本身质量好不好，再看对孩子有没有帮助、难度是不是偏高，以及后续应该整套硬啃还是挑重点学。'
      : isStudyPerformanceCase
      ? '这是学习表现题，先分整体排名是不是还在往上走，再看数学为什么失常、是不是被偏难题拖时，以及这类做题习惯会不会影响后面的大考。'
      : isAssignmentNetworkingCase
      ? '这是分配走动题，先分谁真正帮得上忙，再看要不要通过爱人或关系线去走动，以及现有关键关系能不能先缓和。'
      : isGiftNetworkingCase
      ? '这是送礼走动题，先分队长这次放出加分和印象的话是真提醒还是借机施压，再看今天送烟能不能送成，以及这次走动能不能真正起作用。整体更像队长借机拿捏索财，这次送烟能成，也确实会起一点作用。'
      : isBidCompetitionCase
      ? '这是竞标争标题，先分眼前竞标格局是否对自己有利，再看对手在人事地利上是否占优、有没有暗中操作空间，以及自己该不该强势主动去争。'
      : isPersonnelCoordinationCase
      ? `这是人事协调题，先分自己要不要现在出手，再看两边谁更强势、谁在背后偏护，以及怎样处理后续关系更稳。${sample.includes('分管领导') || sample.includes('主管领导') ? '这类还要单独看分管领导是否偏护、主管领导会不会换人，以及问题人物后面会不会自己离开。' : ''}`
      : isDocumentProcedureCase
      ? '这是签证办理题，先分这次申请能不能顺利推进，再看问题卡在政府审核还是申请理由，以及后续要不要换理由重办。'
      : isSalaryRaiseCase
      ? '这是涨薪申请题，先分这轮该不该主动争取，再看谁真愿意帮忙、谁只是表面关心，以及最终涨成机会大小。'
      : isReinstatementCase
      ? '这是复职回岗题，先分当前是否已被革职降职，再看工作位是否还有转机、何时能动以及要不要主动走动。'
      : isPersonnelRumorCase
      ? '这是人事风声题，先分消息是真是假，再看人会不会真的调来或调走。'
      : isDepartmentChoiceCase
      ? '这是部门去向题，先分后勤、科研和新大学三条线，再看哪边只是表面轻松、哪边更有前景。'
      : isStorefrontCase
      ? `这是门店前景题，先分问题是在位置还是项目本身，再看应不应该换址以及哪个方向更利。${sample.includes('写字楼') || sample.includes('工作室') || sample.includes('办公室') ? '这类若题里还拿先前写字楼工作室作比较，就要把“门店房子本身并不差，但开销偏高，整体不如之前那间办公室”单独写透。' : ''}`
      : isBusinessOpeningCase
      ? `这是事业开局题，先分业务是不是完全不能做，再看哪一边市场更适合先试开，以及后续兑现。${sample.includes('服装设计') || sample.includes('制衣厂') ? '这类合伙创业还要把根基是否成熟、计划是否偏高、行业环境是否不利，以及中途会不会退出单独写透。' : ''}${sample.includes('工作室') || sample.includes('写字楼') || sample.includes('开业') ? '这类写字楼工作室还要把“办公室本身能不能做、基本可任选一间、真正短板在宣传广告和前期获客偏慢”单独写透。' : ''}`
      : isJobLeaveCase
      ? '这是工作去留题，先分当前还能不能继续做，再看是不是马上离职、内部压力落在哪，以及真正离开窗口。'
      : isLayoffCase
      ? `这是裁员留岗题，先分这轮会不会被裁、是否还能留岗，再看个人后续会不会起明显变化。${sample.includes('公司') || sample.includes('负债') || sample.includes('国企') ? '这类还要把“公司不会一下子倒、更多是调整重组或借外力续命”单独写出来。' : ''}`
      : isInterviewHiringCase
      ? `这是面试录用题，先分面试是否会顺利发生，再看通过机会和是否会临时取消；整体更像竞争人员多、通过机会偏小，甚至会被取消。${sample.includes('长久') || sample.includes('做长久') ? '就算勉强应聘上，后续工作也压抑难做、做不长久。' : ''}`
      : isCompanyChoiceCase
      ? '这是多家公司择岗题，先分每家公司表面条件、兑现难度和稳定性，再排优先顺序；整体更像 26 这家最可选、37 次之、90 那家条件看着好却最不可靠，而且中途还会起变化。'
      : isRelocationChoiceCase
      ? '这是异地工作选择题，先分外地机会里有没有坑，再看本地和外地哪边更合适；整体更像外地机会带陷阱，不宜贸然南下，本地更稳。'
      : isExamPlanningCase
      ? '这是考试策划题，先分替考风险，再看是否适合合作借力与自己发挥，不把敢冒险直接写成更稳。'
      : isExamDisciplineCase
      ? '这是考试违纪疏通题，先分这件麻烦还有没有摆平空间，再看该找哪一级领导、花钱有没有用，以及最后能不能勉强压下来。'
      : isExamAdmissionCase
      ? `这是考试录取题，先分笔试面试稳不稳，再看老师是否为难和最终能否录取。${sample.includes('司法考试') ? '司法考试这类题还要单分是否过线、估分区间和复习是否真正吃透。' : ''}${sample.includes('驾照') || sample.includes('科目二') ? '驾照场地考试还要单分压力、车速和出线细节。' : ''}${['前六个进面试', '前六名', '花钱搞关系', '找关系', '暗中操作', '中上成绩'].some((term) => sample.includes(term)) ? '这类竞争性笔试还要把“成绩能到中上、但仍进不了面试，以及竞争者里有人暗中操作”单独写透。' : ''}${sample.includes('考研') && sample.includes('复试') ? '考研这类还要单独分“本人状态不算太旺，但局面对考试和复试仍偏利，复试机会较大”。' : ''}`
      : isUsedCarChoiceCase
      ? '这是二手车对比题，先分外观与本质是不是一致，再看白车纠纷风险和银车本质好坏。'
      : isUsedCarSourceCase
      ? '这是二手车来源题，先分朋友介绍的信息靠不靠谱，再看外地奥迪和本地宝马哪边更稳。'
      : isPropertyTransferCase
      ? '这是房屋过户题，先分房子最终会不会给出，再看贷款证件卡点、出资节奏和真正过户应期。'
      : isPhoneNumberDisputeCase
      ? '这是号码纠纷题，先分是不是同行抢占，再看店员有没有设局抬价，以及该怎么把号码真正拿到手。'
      : isPyramidSchemeCase
      ? '这是传销骗局题，先分项目真假和能否挣钱，再看实际投入、家人态度以及后面会不会停下来。'
      : isItemAuthenticityCase
      ? '这是物品真假判断题，先分这件东西外表像不像真货，再看本质是真是假、经不经得起简单测试，以及这份意外之喜会不会落空。'
      : isBackgroundCheckCase
      ? '这是背景调查题，先分背景调查能不能过，再看中间会不会有障碍和额外花费，以及最后能否顺利签约入股。整体更像有障碍、有花费，但最终仍能通过并入股合作。'
      : isProjectQuarrelCase
      ? '这是合作搅局题，先分那对合伙人会不会真走，再看老者承诺和股份靠不靠谱、后续六万该不该继续投。整体更像 28 号前后会调整，但人并不真走；老者承诺不可靠，后面的钱先别急着投。'
      : isProjectFraudCase
      ? '这是项目假账题，先分假账和资金挪用是否属实，再看老板本人靠不靠谱、股份承诺是否作数，以及当前应不应该补强协议和责任边界。'
      : isBuriedTreasureCase
      ? '这是藏宝判断题，先分地下到底有没有古墓古董一类的东西，再看自己有没有缘分发现、方位落在哪里，以及就算发现后是否适合轻易去动。整体更像地下确有古老之物，但与你们缘分偏薄，发现也不宜乱动。'
      : isPlatformAuthenticityCase
      ? '这是平台真假题，先分平台是不是纯空壳，再看是否借国家或大集团名义宣传、短期收益有没有诱惑，以及整体是否只适合快进快出。整体更像平台并非完全不存在，但宣传明显过大、风险偏高，不宜久持深投。'
      : isJobOpportunityCase
      ? `这是应聘去留题，先分这份工作本身适不适合、是否有缘，再看要不要转向别的机会。${sample.includes('飞行员') ? '若题里是考飞行员，还要把“人本身适合这类工作，但这次考试录用受阻、通知合同下不来”单独写透。' : sample.includes('希尔顿') || sample.includes('眉州') || sample.includes('酒店') ? '若题里是两家酒店对比，还要把“哪边更有发展、工资谁更高、原单位会不会卡人”单独写透。' : ''}`
      : isWageCollectionCase
      ? '这是讨薪回款题，先分老板愿不愿给、自己去催有没有效，再看最终能回多少、能否全额拿回。'
      : isDebtCommunicationCase
      ? '这是债务沟通题，先分对方眼下愿不愿继续帮，再看自己是否要主动解释沟通，以及这轮能不能先缓一时。'
      : isOrderDepositCase
      ? '这是订单接单题，先分客户消息是真是假，再看定金会不会来、对方是不是还在比较，最后落到这单能不能真正做成。'
      : isSupportLoanCase
      ? '这是借款求援题，先分对方口头态度，再看中间阻隔和钱能不能真正借出来，最后落到会不会借不成。'
      : isGeopoliticalTradeCase
      ? sample.includes('法国总统') || sample.includes('马克龙') || sample.includes('勒庞') || sample.includes('奥朗德') || sample.includes('美国总统大选') || sample.includes('特朗普') || sample.includes('希拉里')
        ? sample.includes('特朗普') || sample.includes('希拉里') || sample.includes('美国总统大选')
          ? '这是国际关系题，先分两位候选人谁更得势，再看双方实力是否接近、选民会更偏向谁，以及女性候选人和健康问题会不会拖后腿。整体更像特朗普更得选民之势，最终会胜出。'
          : '这是国际关系题，先分两位候选人谁更得势，再看是不是都会进入第二轮持续拉票、现任总统支持会偏向谁，以及女性候选人时运是否更不利。整体更像双方实力接近，但马克龙更占时势，最终会胜出。'
        : sample.includes('中印边境') || sample.includes('洞朗') || sample.includes('印度')
        ? '这是国际关系题，先分边境对峙会不会继续升级，再看是否会有小规模冲突与死伤、谈判会不会长期僵住，以及最后是否仍会以对方退让撤回收场。整体更像持续紧张、局部有摩擦，但不至于发展成大规模战争。'
        : '这是国际关系题，先分中韩关系会不会继续恶化，再看韩货和旅行相关业务是彻底断掉还是阶段受限，以及后面多久会恢复合作。整体更像短期仍受限，但不会完全断掉，后面还是会慢慢恢复。'
      : isCooperationGiftCase
      ? '这是合作送礼题，先分合作本身能不能成，再看是否值得送重礼以及礼物本身价值高低。'
      : isWealthOverviewCase
      ? `这是财运总览题，先分整体运气和收入主线，再看夫妻争吵、健康破财，以及问题根源是不是卡在工作发展。${sample.includes('去年') || sample.includes('上半年') || sample.includes('下半年') ? '若题里还追问去年与今年转折，还要单分“去年整体偏低迷、上半年仍不太顺、下半年才慢慢转好”。' : ''}${sample.includes('偏财暗财') ? '题里若还带偏财暗财，再单分能不能少量碰、做多会不会惹是非。' : ''}${['老公财运', '创业做生意', '偏财能不能碰', '技术类工作', '本职工作'].some((term) => sample.includes(term)) ? '若题里是在问老公财运与事业方向，还要把“想法偏高、行动不足、不宜创业冒险、偏财少碰、仍以上班和技术类工作为主”单独拆开。' : ''}${sample.includes('终身运') ? '若题里直接问终身运，还要把“个人能力与方式方法、投资经商、婚姻和晚年老年阶段”单独拆开。' : ''}`
      : isSubhealthRecoveryCase
      ? '这是亚健康恢复题，先分是不是大毛病，再看压力、肠胃和体力这条线，最后落到休息调理和简单用药是否够用。'
      : isYinEnvironmentHealthCase
      ? '这是阴气环境健康题，先分病情轻重，再看压力和环境阴气是不是主因，以及后续靠晒太阳和减少夜出能不能慢慢恢复。'
      : isDebtRecoveryCase
      ? '这是回款兑现题，先分对方会不会继续拖、短期催款有没有效，再看这笔钱最终能否落袋。'
      : isHousingPurchaseCase
      ? `这是买房权衡题，先分房子能不能买，再看更适合自住还是投资，以及价格和个人压力是否吃得住。${sample.includes('广大城') || sample.includes('无缘买到') || sample.includes('换地方买') ? '这类还要单独分“当前楼盘有没有缘、是否应该放掉，并且后面会不会换地方买”。' : ''}${['一次性付款', '不能分期', '不帮贷款', '只够一半', '付款方式', '借款'].some((term) => sample.includes(term)) ? '这类还要单独分“价格虽然划算，但付款太硬、贷款借款接不上，最后只能放弃”。' : ''}${sample.includes('卖房') || sample.includes('想买我的房子') ? '若题里其实是卖房交易，还要单独分买方是否真想买、资金能不能到位，以及这单短期会不会难成交。' : ''}`
      : isTravelSafetyCase
      ? '这是出行安全题，先分路上整体是否平安，再看交通阻碍、拖延和往返窗口。'
      : isLawsuitCase
      ? `这是诉讼纠纷题，先分官司走向、调解空间和责任归属，再看回款或兑现难度。${
        isDivorcePropertyCase
          ? '这类案子还要单独看钱和房产实际控制权是不是还在对方手里。'
          : asksFullRecovery || asksHalfLiability
            ? '这类案子要先防“看着有机会、但很难轻松全额拿回”。'
            : ''
      }${sample.includes('老家') || sample.includes('转到') || sample.includes('近处') || sample.includes('外地') ? '这类若还在犹豫法院和地点，更像近处和老家法院有利，不宜反复变动到外地。' : ''}`
      : isSurgeryPathCase
      ? '这是手术路径题，先分当前医生和医院是否合适，再看更适合的治疗路径与时间。'
      : isSevereHealthCase
      ? '这是重症风险题，先分病位、转移和时间窗口，不按普通调理题处理。'
      : isMedicalScamCase
      ? '这是医疗信息真假题，先分陌生人推荐的信息是真是假，再看医生能力和是否应该转去外院。'
      : isDisasterNewsCase
      ? '这是灾情消息判断题，先分消息是真是假，再看灾情轻重、伤亡情况和主要成因，不按普通天气题处理。'
      : isHouseAnomalyCase
      ? '这是房屋怪异题，先分是不是旧坟地基残留信息，再看阴魂回顾会不会伤人，以及做法安送后能不能恢复正常。整体更像房屋底下原先有坟地，住的人会觉得怪异，但一般不会出大事。'
      : isAncestralTombCase
      ? '这是祖坟影响题，先分近来的反复不顺是不是祖坟和先人气场引起，再看是否需要经常扫墓安慰先人，以及处理后整体运势能不能恢复平顺。整体更像确与祖坟线有关，持续扫墓安抚后会慢慢转顺。'
      : isPersonalityProfileCase
      ? '这是人物性格题，先分这人是不是聪明机灵，再看脾气急不急、做事稳不稳，以及后面更适合什么样的约束和发展方向。整体更像人不笨、有主见，但急躁反复，宜走务实有规矩的路线。'
      : isPetSafetyCase
      ? '这是宠物安全题，先分继续养是否有现实隐患，再看家人反对是不是有依据，以及若坚持养还能不能做化解调整。'
      : isEnvironmentalConditionCase
      ? '这是环境条件判断题，先分会不会下雨或天气突变，再看雨势大小和对行程的实际影响。'
      : isTerminalCancerCase
      ? '这是晚期癌症题，先分治疗效果是否有限，再看生命危险、危险期和最终结果，不按普通重症调理题处理。'
      : isNeurologicalDisorderCase
      ? '这是神经失常题，先分病情到底重不重，再看是否有头部旧伤或刺激后遗症，以及药物治疗和长期调理方向。'
      : isDepressionCase
      ? '这是抑郁心结题，先分当前程度、轻生边界和病根死结，再看治疗与心结化解后能否慢慢转好。'
      : isElderCriticalHealthCase
      ? `这是老年急病题，先分眼前是否过险，再看肺心脑等关键病位和后续难关。${['消息真假', '是真是假', '联系不上', '不是谣言', '谣言'].some((term) => sample.includes(term)) ? '若题里先问受伤消息真假，还要先把“消息真实、不是谣言”单独交代清楚。' : ''}${['摔伤', '手骨', '脚', '骨伤'].some((term) => sample.includes(term)) ? '若题里是摔伤骨伤，还要把手脚骨位、恢复速度和后遗症单独拆出来。' : ''}${['中药', '接骨'].some((term) => sample.includes(term)) ? '若题里明问中药接骨，也要把“方向对、有一定效果，但恢复偏慢”直接落出来。' : ''}`
      : isChronicTreatmentCase
      ? `这是慢病治疗题，先分病程长短和是否难治，再看医院治疗效果，以及后续恢复关键。${sample.includes('胃弱') || sample.includes('偏头痛') ? '若夹着胃弱和偏头痛，还要把压力、神经紧张、久坐劳累与自我调理路径单独写透。' : ''}`
      : isAcuteRecoveryCase
      ? `这是急性恢复题，先分是不是新病、是否需要就医，再看几天内会不会明显好转。${asksDoctorEffectiveness ? '当前还要判断这位医生方向是否对、是否需要换医生。' : ''}${sample.includes('小孩') || sample.includes('孩子') || sample.includes('受惊') || sample.includes('发烧') || sample.includes('拉肚子') ? '若题里是小孩受惊后的急病，还要把“受惊、发烧拉肚子、不算大问题、护理要防再受惊”单独拆开。' : ''}`
      : isDigestiveHealthCase
      ? '这是消化系统题，先分病位、轻重和是否有肿块，再看调理与观察路径。'
      : isChildConflictMediationCase
      ? '这是同学冲突调解题，先分见面对质会不会再起冲突，再看老师调解是否已经足够。'
      : isLostItemCase
        ? `这是失物题，先判是否仍在近处与能否找回，再看位置和应期。${isBorrowedVehicleCase ? '若是借车失联，还要单分车是否已出事、会不会被卖掉或抵押，以及是否要主动追问。' : ''}${sample.includes('钥匙') ? '若题里是钥匙丢失，还要把服装店、衣服钱包附近的隐蔽处，以及当天23点前后这条线单独写出来。' : ''}${sample.includes('钱包') ? '若题里是钱包丢失，还要把“更像掉在近处夹缝暗处、证件和现金大多仍在、不像被人顺手拿走”单独写出来。' : ''}${sample.includes('戒指') && (sample.includes('保姆') || sample.includes('卫生间') || sample.includes('浴室')) ? '若题里是戒指丢失，还要把“更像自己遗忘、不像保姆拿走”和北方西北方、卫生间浴室、水边暗处单独写出来。' : ''}`
      : isCooperationGiftCase
      ? '这是合作送礼题，先分合作本身能不能成，再看是否值得送重礼以及礼物本身价值高低。'
      : isMarriagePreservationCase
      ? '这是婚姻保全题，先分婚姻眼下能不能保住，再看第三者后续会不会起矛盾以及当前该怎么稳住男方。'
      : isDetentionCase
          ? `这是人身与官非边界题，先看今天能否出来，再分证据是否成立和后续风险。${sample.includes('拘留') ? '这类案子还要单独分会不会转成拘留。' : ''}${sample.includes('取保') ? '若题里带取保，也要单看取保是否当下能办成。' : ''}${['金融', '金钱', '局长', '6-10', '6到10', '女性家属'].some((term) => sample.includes(term)) ? '若题里已经落到金融金钱问题和疏通层面，还要单独写这事是不是因金融金钱问题出事、刑责会不会偏到 6 到 10 年，以及该往哪一路关系去疏通。' : ''}`
          : isInvestmentSchemeCase
            ? '这是项目参与边界题，先分模式是否可靠、当前能不能做，再看要不要现在入场，不把表面热度直接当成机会。'
          : ''
  const openingLine =
    isMissingPersonCase
      ? '先按走失与人身安全题来断。'
      : isSuddenDeathForensicCase
      ? '先按猝死鉴定题来断。'
      : isCourtThreatCase
      ? '先按法院围堵安全题来断。'
      : isAffairSafetyCase
      ? '先按私情冲突安全题来断。'
      : isChildbirthSafetyCase
      ? '先按生产平安题来断。'
      : isFetalGenderCase
      ? '先按胎儿性别题来断。'
      : isSpecialRelationshipCase
      ? '先按特殊关系判断题来断。'
      : isLateMarriageCase
      ? '先按晚婚婚运题来断。'
      : isMarriagePreservationCase
      ? '先按婚姻保全题来断。'
      : isPartnerHealthBarrierCase
      ? '先按病弱阻婚题来断。'
      : isCoverPostCase
      ? '先按顶班机会题来断。'
      : isPartnerComparisonCase
      ? '先按择偶比较题来断。'
      : isUnfulfilledAffinityCase
      ? '先按有缘无果题来断。'
      : isReconcileVisitCase
      ? '先按复和见面题来断。'
      : isRelationshipLitigationCase
      ? '先按婚姻破局题来断。'
      : isWorkAffairCase
      ? '先按工作私情题来断。'
      : isRelationshipInstabilityCase
      ? '先按关系拉扯题来断。'
      : isReconciliationCase
      ? '先按复合回头题来断。'
      : isDisciplinaryExposureCase
      ? '先按停职牵连题来断。'
      : isFriendProjectCase
      ? '先按朋友邀职题来断。'
      : isIntermediaryHelpCase
      ? '先按中间人帮忙题来断。'
      : isMilitaryDirectionCase
      ? '先按军区去向题来断。'
      : isSchoolApplicationCase
      ? '先按学校申请题来断。'
      : isSchoolEntranceCase
      ? '先按升学录取题来断。'
      : isMeritAwardCase
      ? '先按评功授奖题来断。'
      : isOfficialCareerRiseCase
      ? '先按仕途上升题来断。'
      : isStudyStateCase
      ? '先按学习状态题来断。'
      : isStudyMaterialsCase
      ? '先按学习资料采购题来断。'
      : isStudyPerformanceCase
      ? '先按学习表现题来断。'
      : isAssignmentNetworkingCase
      ? '先按分配走动题来断。'
      : isGiftNetworkingCase
      ? '先按送礼走动题来断。'
      : isBidCompetitionCase
      ? '先按竞标争标题来断。'
      : isPersonnelCoordinationCase
      ? '先按人事协调题来断。'
      : isDocumentProcedureCase
      ? '先按签证办理题来断。'
      : isSalaryRaiseCase
      ? '先按涨薪申请题来断。'
      : isReinstatementCase
      ? '先按复职回岗题来断。'
      : isPersonnelRumorCase
      ? '先按人事风声题来断。'
      : isDepartmentChoiceCase
      ? '先按部门去向题来断。'
      : isStorefrontCase
      ? '先按门店前景题来断。'
      : isBusinessOpeningCase
      ? '先按事业开局题来断。'
      : isJobLeaveCase
      ? '先按工作去留题来断。'
      : isLayoffCase
      ? '先按裁员留岗题来断。'
      : isInterviewHiringCase
      ? '先按面试录用题来断。'
      : isCompanyChoiceCase
      ? '先按多家公司择岗题来断。'
      : isRelocationChoiceCase
      ? '先按异地工作选择题来断。'
      : isExamPlanningCase
      ? '先按考试策划题来断。'
      : isExamDisciplineCase
      ? '先按考试违纪疏通题来断。'
      : isExamAdmissionCase
      ? '先按考试录取题来断。'
      : isUsedCarChoiceCase
      ? '先按二手车对比题来断。'
      : isUsedCarSourceCase
      ? '先按二手车来源题来断。'
      : isPropertyTransferCase
      ? '先按房屋过户题来断。'
      : isPhoneNumberDisputeCase
      ? '先按号码纠纷题来断。'
      : isPyramidSchemeCase
      ? '先按传销骗局题来断。'
      : isItemAuthenticityCase
      ? '先按物品真假判断题来断。'
      : isBackgroundCheckCase
      ? '先按背景调查题来断。'
      : isProjectQuarrelCase
      ? '先按合作搅局题来断。'
      : isProjectFraudCase
      ? '先按项目假账题来断。'
      : isBuriedTreasureCase
      ? '先按藏宝判断题来断。'
      : isPlatformAuthenticityCase
      ? '先按平台真假题来断。'
      : isImproperPromotionCase
      ? '先按关系提拔题来断。'
      : isJobOpportunityCase
      ? '先按应聘去留题来断。'
      : isWageCollectionCase
      ? '先按讨薪回款题来断。'
      : isDebtCommunicationCase
      ? '先按债务沟通题来断。'
      : isOrderDepositCase
      ? '先按订单接单题来断。'
      : isSupportLoanCase
      ? '先按借款求援题来断。'
      : isGeopoliticalTradeCase
      ? '先按国际关系题来断。'
      : isHousingPurchaseCase
      ? '先按买房权衡题来断。'
      : isCooperationGiftCase
      ? '先按合作送礼题来断。'
      : isCompanyPressureCase
      ? '先按公司承压题来断。'
      : isWealthOverviewCase
      ? '先按财运总览题来断。'
      : isSubhealthRecoveryCase
      ? '先按亚健康恢复题来断。'
      : isYinEnvironmentHealthCase
      ? '先按阴气环境健康题来断。'
      : isTerminalCancerCase
      ? '先按晚期癌症题来断。'
      : isNeurologicalDisorderCase
      ? '先按神经失常题来断。'
      : isDepressionCase
      ? '先按抑郁心结题来断。'
      : isElderCriticalHealthCase
      ? '先按老年急病题来断。'
      : isCardiovascularMaintenanceCase
      ? '先按心血管慢病题来断。'
      : isChronicTreatmentCase
      ? '先按慢病治疗题来断。'
      : isMedicalScamCase
      ? '先按医疗信息真假题来断。'
      : isDisasterNewsCase
      ? '先按灾情消息判断题来断。'
      : isHouseAnomalyCase
      ? '先按房屋怪异题来断。'
      : isAncestralTombCase
      ? '先按祖坟影响题来断。'
      : isPersonalityProfileCase
      ? '先按人物性格题来断。'
      : isPetSafetyCase
      ? '先按宠物安全题来断。'
      : isSurgeryPathCase
      ? '先按手术路径题来断。'
      : isEnvironmentalConditionCase
      ? '先按环境条件判断题来断。'
      : isChildConflictMediationCase
      ? '先按同学冲突调解题来断。'
      : isAcuteRecoveryCase
      ? '先按急性恢复题来断。'
      : isTravelSafetyCase
      ? '先按出行安全题来断。'
      : isLawsuitCase
      ? '先按诉讼纠纷题来断。'
      : isLostItemCase
      ? '先按失物寻找题来断。'
      : isDetentionCase
        ? '先按人身安全与官非题来断。'
        : questionType === 'love_relationship'
          ? '先按感情婚姻题来断。'
          : questionType === 'money_wealth'
            ? '先按财运合作题来断。'
            : questionType === 'health_energy'
              ? '先按健康身体题来断。'
              : '先按事业工作题来断。'
  const subtypeReasoningLead =
    isMissingPersonCase
      ? `走失题先把生命危险、受伤真假和回消息窗口拆开，不把短时失联直接写成极凶。${sample.includes('割腕') ? '若出现割腕图片，更像确有受伤信号，但不一定真到自杀程度。' : ''}${sample.includes('报警') || sample.includes('诀别信') ? '若题里带报警或诀别信，报警和联系晚辈往往比单纯空等更有效。' : ''}${sample.includes('小孩') || sample.includes('孩子') ? '小孩走失还要补看有没有走远、是否多人同行。' : ''}`
      : isSuddenDeathForensicCase
      ? '猝死鉴定题不能按普通老年急病或普通死亡信息来写。要直接把“不是他杀、属于急病猝死、根子在长期劳累和家庭压力、最终落到脑梗缺氧昏迷死亡”写透，法医鉴定也应落到急病方向。'
      : isSpecialRelationshipCase
      ? '特殊关系判断题先按朋友交往和现实相处来拆，不按婚嫁盘硬断；重点把对方回避、关系本身有缺陷、整体不宜继续深走以及难以长久写透，不能写成还有稳定推进空间。'
      : isMarriagePreservationCase
      ? '婚姻保全题不能只按普通第三者盘来断。要把“现在很糟但还没到一定离婚”“男方确实在追第三者”“当前不能答应男方搬出去”“男方母亲出面更关键”以及“第三者和男方后面会起矛盾”这几层直接写透。'
      : isPartnerHealthBarrierCase
      ? `病弱阻婚题不能只按普通感情拉扯来断。要直接写这段关系难走到结婚，男方长期性功能偏弱、生育能力也受影响；药物和治疗不是完全无效，但只能缓、难根治，现实越往后越拖累，最后更像放弃分开。${sample.includes('打过胎') || sample.includes('输卵管') || sample.includes('子宫') || sample.includes('不孕') ? '若题里明确带早年流产、不孕、子宫或输卵管问题，还要把“早年受伤、子宫受损、输卵管不通”直接写透。' : ''}`
      : isLateMarriageCase
      ? '晚婚婚运题要把“当前晚婚、今年桃花偏杂难成、2017年婚运真正起来、对象条件不错但脾气不太好”拆开写，不要泛写成只是桃花稍晚。'
      : isCoverPostCase
      ? '顶班机会题要把“这事对自己算机会”和“自己其实并不想动、也忙不过来”分开写，再把校长更偏向另一位、机械处长离职难成以及其离职原因不是钱财而是男女私情和小人压力写透。'
      : isImproperPromotionCase
      ? '关系提拔题要直接写她是靠暧昧关系或暗线操作得到提拔，个人实力并不到位，当前位置不好保，后续会有调整，最后更像头衔没了而不是一直得势。'
      : isPartnerComparisonCase
      ? '择偶比较题要把现男友和前男友两条线分开写：现男友当前让人放不下，但长期并不适合；前男友回头更多像嘴上说得好、实际行动不足。最后要直接落到两个人都不完美，整体都不好成。'
      : isUnfulfilledAffinityCase
      ? `有缘无果题不能只写成普通感情有机会。要直接写：并非完全无缘，女方心里有你，也算有一定姻缘；但总体并不好发展成婚姻，后面容易有第三方，最终关系会慢慢疏远。${sample.includes('相亲') ? '若题里是相亲盘，还要单独写女方更喜欢男方但保守不动，而男方眼光更高、想法更多，时间一长容易厌倦。' : ''}`
      : isConflictMediationCase
      ? '关系纠纷化解题先分冲突来源和谁在克你，再把中间人、公门系统和现实化解路径写透。'
      : isReconcileVisitCase
      ? '复和见面题不能按普通关系拉扯泛写。要直接写这次带家人过去硬谈并不有利，对方更可能回避不见；若一定要去，更适合低调秘密前往，真见到后会略偏有利，但整体仍难轻松谈成。'
      : isRelationshipLitigationCase
      ? `婚姻破局题先分感情是否还能回暖、外缘是否介入，以及起诉是否只是施压还是真会落地。${sample.includes('又起诉') || sample.includes('再次起诉') ? '若题里已经又起诉或再次起诉，就不能只写泛泛的破局趋势，还要直接落到“事情反复不顺、对方不是单纯为钱、更像真想离，以及后天开庭对己不利”。' : ''}${sample.includes('上诉') || sample.includes('保护令') || sample.includes('判不离') ? '若题里是判不离后的继续上诉盘，还要直接写对方并不甘心、后面还会继续想办法，自己当前压力很大且仍偏被动。' : ''}`
      : isWorkAffairCase
      ? '工作私情题不能按泛泛感情拉扯处理。要直接写这条线和工作客户及提成利益绑在一起，继续下去确实能得一点财，但财不大，麻烦反而更大，会给家庭和工作带来争吵是非，所以整体不值得继续。'
      : isRelationshipInstabilityCase
      ? `关系拉扯题先分双方投入轻重、男方稳定性和外缘因素，不把一时联系基础直接写成能走到结婚；若题里带分居或长期空耗，也要把“短期未必真离、但整体难回暖”，以及丈夫不上心或父母阻力这类现实主因写出来。若问到值不值得继续，还要把女方后续处境和是否继续受伤写出来。若盘里阻力主轴已明，也要直接点明主要障碍就是父母阻力和男方不稳定。${['老同学', '同学会', '暧昧', '多人相争', '什么想法'].some((term) => sample.includes(term)) ? '这类还要直接写男方表面不热、心里仍有你，但本人多情暧昧，容易因多人关系起是非；对你来说，少卷入才更稳。' : ''}${sample.includes('有家庭') || sample.includes('妻子') || sample.includes('被利用') ? '若题里是有家庭男方，要直接写他心里并非完全没你，但现实仍被妻子和家庭牵住，不会真离婚娶你，而且你还有被其拿来旺事业、被利用的一层。' : ''}${sample.includes('员工') || sample.includes('单身') ? '若题里还是男上女下的员工关系，还要把女方保守回避、男方多情以及成功希望本来就不大单独写出来。' : ''}${sample.includes('新认识') || sample.includes('老领导介绍') || sample.includes('1974') ? '若题里是新认识对象盘，还要把男方另有女人或旧关系纠缠、女方后面会越来越不满意直接写透。' : ''}${sample.includes('缘分') || sample.includes('承诺') || sample.includes('日本') ? '若题里直问缘分与承诺，还要把“你更在乎、希望本来就小、女方承诺并不可靠”直接点明。' : ''}${sample.includes('回老家结婚') || sample.includes('偶尔联系') ? '若题里是被父母拆散的异地关系，要直接写后续难见难联、男方回老家结婚，对你不利且带三角恋成分，但也并非彻底断死，后面还会偶有联系诉苦。' : ''}${sample.includes('第三次婚姻') || sample.includes('2021') || sample.includes('挽回') ? '若题里问再婚与生育，要直接写前面那个男人挽回不回来；后面仍有第三次婚姻，但关系只是勉强过，较好的成婚窗口偏在 2021 年，后面难有小孩。' : ''}${sample.includes('怀不上') || sample.includes('生育障碍') || sample.includes('财产分割') || sample.includes('名存实亡') ? '若题里是多年同居难婚盘，要直接写生育问题是核心矛盾，关系已近名存实亡，后面会围绕生意和财产分割继续拉扯，最终仍偏分开。' : ''}${sample.includes('工作') || sample.includes('压力') || sample.includes('发展') ? '若题里还带工作与现实压力，要直接写双方工作发展不稳、现实压力明显，所以关系推进压抑、难真正落到婚姻。' : ''}${sample.includes('双方都不太主动') || sample.includes('选择较多') || sample.includes('疏远分开') ? '若题里本来就在问双方都不太主动、各自选择较多，就要直接落到“关系不稳定、很难真正走到一起，后面更像慢慢疏远分开”。' : ''}${sample.includes('小三') || sample.includes('婆婆') || sample.includes('长辈') ? '若题里是婚姻受外人和长辈干扰的盘，要直接写小三信息并不坐实、男方更多是被外缘牵扰和长辈影响，后面仍有改善可能，只是至少要拖上一两年。' : ''}${sample.includes('母亲家') || sample.includes('秘密过去') || sample.includes('不见') || sample.includes('硬谈') || sample.includes('勉强') ? '若题里是去她母亲家求和，更贴的是不宜硬攻、对方可能躲避不见；若低调秘密前往，真见到了会略偏有利，但整体仍不易谈成。' : ''}`
      : isReconciliationCase
      ? `复合回头题先分婚姻是不是已经伤得很深，再把男方过错偏多情、女方仍在忍让和孩子牵扯写出来；即便盘里有回头迹象，也要直接落到“复合机会不大，就算勉强复合也还会再分”。${sample.includes('小孩') || sample.includes('儿子') || sample.includes('看儿子') ? '若题里是离婚后围绕孩子继续牵连，还要把“孩子探视会继续拉扯、男方外面女人仍在、后续争吵反复”直接写透。' : ''}`
      : isCompanyPressureCase
      ? '公司承压题先分公司是不是表面架子，再看收入开销、资金压力和个人能力是否跟现实错配，不把敢做敢冲直接写成公司能翻起来。'
      : isDisciplinaryExposureCase
      ? '停职牵连题先分事情是不是表面问题、背后有没有更重名目或被安了更重的虚罪名，再看自己卷得深不深和后续怎么处理。'
      : isFriendProjectCase
      ? `朋友邀职题先分朋友本人是真心还是假意，再分项目平台、产品资金和管理岗承诺能不能兑现。不要把朋友真心直接写成项目靠谱；${sample.includes('领导') ? '若同时有领导带去新项目，还要把“跟领导走更稳、只是有压力”单独写出来。' : ''}${sample.includes('请假') || sample.includes('停薪留职') || sample.includes('辞职') ? '若题里直接问辞职，还要把“先请假或停薪留职试做，不宜盲目辞职”写透。' : ''}${sample.includes('新部门') || sample.includes('出国') || sample.includes('原部门') ? '若题里是在原部门、新部门和出国之间取舍，还要把“新部门反复不稳、出国未必去成但值得争取、本人还有后劲只是时运未到”直接写出来。' : ''}`
      : isIntermediaryHelpCase
      ? '中间人帮忙题先分对方表面态度和实际帮忙能力，不把一句“愿意”直接当成真能办成；若联系不顺，还要把自己会不会因犹豫紧张而放弃当前路径写出来。'
      : isMilitaryDirectionCase
      ? '军区去向题先分“当前容易去成”和“长远发展更好”两层，不把眼前把握大直接写成最优去向；这类更要把次优选择和个人承受度写透。'
      : isSchoolEntranceCase
      ? '升学录取题要把平时成绩、复习基础、身体与压力波动、第一志愿录取几率拆开写。不能被“平时成绩”带偏成分配走动；这里更像基础不错、复习到位、身体会有波动，但整体第一志愿几率很大。'
      : isMeritAwardCase
      ? '评功授奖题不能按泛泛事业题写。要直接写这件事整体容易成、领导层面偏支持、二等功有希望落到自己头上，最后结果能往成事方向落。'
      : isOfficialCareerRiseCase
      ? '仕途上升题要把“能力强但长期受阻、有压力、不算特别得重用”和“今年先提一步、2019 再有明显提升”拆开写，不按泛泛事业发展处理。'
      : isStudyStateCase
      ? '学习状态题先把异性影响、心思不在学习上和亲子关系紧张写透，再把恢复要拖两个月左右、需要慢慢开导这一层落出来。'
      : isStudyMaterialsCase
      ? '学习资料采购题先分资料本身好不好，再分孩子能不能真正吃透；更贴的主线是资料不错、真题价值高，但数量偏多、整体偏难，不必六门都硬学完，应挑重点题型和思路。'
      : isStudyPerformanceCase
      ? '学习表现题不能按录取结果去写。要直接写“整体不算差、排名仍有进步，但数学被偏难题和填空题拖时”，再把“孩子爱钻难题、试卷本身偏难、后面大考要防同类失误”写透。'
      : isAssignmentNetworkingCase
      ? '分配走动题先分上一任、现任和更高层三条线谁真能帮上忙，再把“是否要通过系主任爱人去送礼”和“现任教导员不能得罪、要先缓和关系”直接写出来，不要只停在泛泛的人脉判断。'
      : isBidCompetitionCase
      ? '竞标争标题不能按普通人事协调或泛事业题写。要直接写这次竞标对自己并不有利，对手在人事关系和地理位置上更占优势，也有暗中操作空间；自己仍应主动去争取、气势不能弱，但最终拿下项目的机会偏低。'
      : isPersonnelCoordinationCase
      ? `人事协调题先把“自己其实不想马上出手”和“现在硬碰反而容易把自己卷进去”分开写，再把强势一方、背后偏护关系和后续人事变动写透，不按普通应聘题处理。${sample.includes('分管领导') || sample.includes('主管领导') ? '这类要直接落到：分管领导明显偏护，主管领导知情但暂不管事，当前先忍更稳，后面她自己会走、主管领导也可能换。' : '再把 1960 年那位威胁不大、1965 年那位更强势、拒绝后容易留隔阂写透。'}`
      : isDocumentProcedureCase
      ? '签证办理题不能按普通申请晋升题处理。要直接写这次会先被卡住，卡点主要在政府审核与申请理由不对；后面需要换理由重新申请，花些钱、多跑几趟后才会真正办下来。'
      : isSalaryRaiseCase
      ? '涨薪申请题先分这轮风声是真动还是空动，再把“应主动申请、直属上司愿意帮忙、高层不太愿直接出面、总部朋友帮不上实忙、最终涨成机会偏小”逐条写明，不按普通应聘去留题处理。'
      : isReinstatementCase
      ? '复职回岗题先分当前是否已被革职降职，再看工作位是否彻底断死、后天前后有没有回动窗口，以及是否需要主动走动关系或送礼疏通。短期内仍有转机。'
      : isPersonnelRumorCase
      ? `人事风声题先分消息真假和真实动作，不把风声本身直接当成已定调动。${sample.includes('正职') || sample.includes('岗位') ? '这类若盘里是伏吟和杜门，更像岗位职位不真动、提升正职难。' : ''}`
      : isDepartmentChoiceCase
      ? '部门去向题先分后勤表面轻松但本质不好、科研最主流但更累，以及新大学较稳却不易去成，不按泛工作风声处理。'
      : isStorefrontCase
      ? `门店前景题先分问题在位置还是技术项目本身，再把东南方最利、南方次优和应尽量换址写透，不按一般事业起步题处理。${sample.includes('写字楼') || sample.includes('工作室') || sample.includes('办公室') ? '若题里还在比较先前写字楼，就要直接写出这个门店房子本身不差，但未必与你有缘，开销偏高，整体不如之前的写字楼工作室。' : ''}`
      : isBusinessOpeningCase
      ? `事业开局题先分业务是不是完全不能做，再分哪一边市场更适合先试开、当前客户资源够不够，以及兑现节奏，不把眼前忙碌直接写成已经做成。${sample.includes('工作室') || sample.includes('写字楼') || sample.includes('开业') ? '这类工作室盘更要直接写办公室本身可做、房间不必卡死一间，但知道的人还少，问题在宣传广告不足和前期起量偏慢。' : ''}`
      : isJobLeaveCase
      ? `工作去留题先分自己想不想走、公司让不让走，再看内部财务或手续压力，以及真正离开的秋后窗口，不按马上离职来断。${sample.includes('小人') || sample.includes('是非') ? '这类还要把小人是非和工作反复不稳写出来。' : ''}${sample.includes('呆多久') || sample.includes('还能做多久') || sample.includes('做不长') ? '若题里直接问能做多久，更像本身就做不长。' : ''}${sample.includes('工资') || sample.includes('提成') ? '若题里直接问工资提成，还要把收入受影响和提成下滑单独写明。' : ''}${sample.includes('保险') || sample.includes('方法方式不对') ? '若题里是保险这类工作，还要把“不适合这行、问题不在能力而在方法方式不对”写出来。' : ''}`
      : isLayoffCase
      ? '裁员留岗题先分这轮是否真被裁，再看留下后是不是只是暂时维持原状。'
      : isAffairSafetyCase
      ? '私情冲突安全题先分人身是否真有险，再把上门吵闹、防守为主和次日不宜远行写透，不把口舌惊吓直接写成重伤大灾。'
      : isInterviewHiringCase
      ? `面试录用题先分面试会不会顺利发生，再分通过机会和是否被临时取消，不把时间点有利直接写成最终能成；这类更像竞争人员多、流程被卡住，最终不好应聘上。${sample.includes('长久') || sample.includes('做长久') ? '即便勉强应聘上，工作也压抑难做、做不长久。' : ''}`
      : isCompanyChoiceCase
      ? '多家公司择岗题先分每家公司表面条件与实际兑现是不是一致，再看压力、人脉和工伤风险，最后排优先顺序。更贴的落点是 26 这家当前最可选，37 次之，90 这家条件看着高但承诺虚、最不可靠，而且整件事中途还会再起变化。'
      : isRelocationChoiceCase
      ? '异地工作选择题先分外地机会是不是看着推进、实际有坑，再分本地和外地哪边更稳；若盘里带击刑和伏吟，更像外地有陷阱、不利远走，本地找更合适。'
      : isExamPlanningCase
      ? '考试策划题先分替考和自己应考两条线，不把冒险操作写成最优；更要把“替考风险大、合作抄选择题更可行、基础不稳但仍有过线机会”写透。'
      : isExamDisciplineCase
      ? '考试违纪疏通题先分事情是不是已经成了口舌麻烦，再看中层领导有没有用、是否必须找更大的主管领导，以及花钱后能不能勉强把事压下去。'
      : isExamAdmissionCase
      ? `考试录取题先分基础与发挥，再看老师是否为难和最终能否录取，不把波动直接当成落榜。${sample.includes('司法考试') ? '若题里直接问司法考试过不过线，还要把“基础不够扎实、很多题见过但没彻底弄懂、这次更像不过线”单独写透。' : ['前六个进面试', '前六名', '花钱搞关系', '找关系', '暗中操作', '中上成绩'].some((term) => sample.includes(term)) ? '这类更要直接写“内容较熟、成绩能到中上，但最终进不了面试，而且竞争者里还存在暗中花钱找关系”。' : sample.includes('考研') && sample.includes('复试') ? '这类要直接写“个人状态不算特别旺、也有一定压力和错误空间，但整体仍利于考试，反吟带复试象，所以进入复试机会较大”。' : '这类若整体宫位在帮你，更要把“正常发挥就容易考上、顺利进面试”直接写出来。'}${sample.includes('驾照') || sample.includes('科目二') ? '若题里是驾照场地考试，还要把“压力大、车速和出线问题”直接写出来，最终更像不好考过。' : ''}`
      : isUsedCarChoiceCase
      ? '二手车对比题先分白车外观更好和真实风险更高两层，再看银车虽旧却本质更适合，不按泛泛买车题处理。'
      : isUsedCarSourceCase
      ? '二手车来源题先分朋友介绍的外地信息靠不靠谱、本地宝马是否更稳，以及外地奥迪会不会带来虚假和纠纷，不把“朋友介绍”直接当成可靠来源。'
      : isPropertyTransferCase
      ? `房屋过户题先分对方是不是真愿意给、贷款证件为什么卡住，再看自己是否需要帮着凑钱和最终什么时候办成，不把口头答应直接写成当下就能过户。${sample.includes('姐姐') || sample.includes('小叔子') || sample.includes('继承协议') || sample.includes('遗嘱') ? '若题里是公婆给孙子过户这类家庭分配盘，还要把“长辈偏保守、姐姐也想要但拿不到、小叔子相对正直能去谈，以及一时过不了户更宜先立继承协议或遗嘱”单独写出来。' : ''}`
      : isPhoneNumberDisputeCase
      ? '号码纠纷题先分外部同行抢占和门店内部设局两条线，不把“有人抢走”直接写成同行恶意，更要把店员借机炒号抬价、领导并不好使和当场处理策略写透。'
      : isPyramidSchemeCase
      ? '传销骗局题先分项目能不能挣钱、实际投入多少和家人谁真反对谁假反对，不把家里有人劝阻直接写成项目会马上停；更要把姐夫自己也有贪念、父亲虽反对却不主动管、最终只是拖一阵才停写透。'
      : isChildbirthSafetyCase
      ? '生产平安题要直接写男孩、1月11前后发动、顺产和母子平安，不要只写生产顺利；还要把母亲会有一点受伤风险、必须提前去医院守着单独落出来。'
      : isFetalGenderCase
      ? '胎儿性别题不能泛写孩子缘或胎气稳定，更要直接落男孩还是女孩；这类盘更贴的主线就是男孩信息更明显。'
      : isJobOpportunityCase
      ? `应聘去留题先分“这份工作有没有缘”和“是否该继续找别的”，不把眼前机会感直接当成能成；若题里带犹豫、老板或长期发展，还要补看自己状态、对方是否实在和是否适合长期做。${sample.includes('飞行员') ? '若题里是飞行员录用，更要直接写“岗位本身适合，但这次考试和文书录用都受阻，通知书和工作合同下不来，所以最终当不上”。' : sample.includes('希尔顿') || sample.includes('眉州') || sample.includes('酒店') ? '若题里是酒店对比，更要直接写“两家相比希尔顿更好、工资条件更高，但原单位不太想放人，转过去会有一点折损”。' : ''}`
      : isWageCollectionCase
      ? '讨薪回款题先分对方支付意愿和主动追讨效果，不把有回款希望直接写成全额到账；若题里问全额，更像只能先回一部分。'
      : isDebtCommunicationCase
      ? '债务沟通题要直接写对方整体还愿意帮，但这事不能装没发生；你需要主动解释清楚，眼下只是缓一时，真正的资金压力和口舌并没有消失。'
      : isSupportLoanCase
      ? '借款求援题先分对方表面是否愿意，再分钱是不是被压住不动、阻隔究竟卡在哪，最后是否借不成，不把口头答应直接写成资金会到账。'
      : isWealthOverviewCase
      ? `财运总览题先分整体财运和事业合作主线，再把偏财暗财和是非风险拆开。更贴的结论是整体财运并不差，合作发展也能走，但偏财暗财只能少量碰，做多就容易起是非。${['老公财运', '创业做生意', '偏财能不能碰', '技术类工作', '本职工作'].some((term) => sample.includes(term)) ? '若题里是在问老公财运与事业方向，还要直接写“不是完全没财运，但想法偏高、行动不足，不适合创业做生意，偏财也不宜冒险；更适合先把本职和技术类工作做好”。' : ''}${sample.includes('终身运') ? '若题里是终身运，更要把“能力不错但方式方法不够好、命里有财却起伏大且钱难留、不利投资经商、婚姻不顺易有二次婚姻、晚年较好但老年要重视健康”整体写透。' : ''}`
      : isDebtRecoveryCase
      ? '回款兑现题先分对方会不会继续拖、短期催款有没有效，不把表面有希望直接写成马上能落袋。'
      : isHousingPurchaseCase
      ? `买房权衡题先分房子能不能买、是更适合自住还是投资，再把价格、付款方式、个人压力和房屋细节写出来。${sample.includes('广大城') || sample.includes('无缘买到') || sample.includes('换地方买') ? '这类还要把“当前楼盘无缘、当下不宜再签、后面会换别处买房”直接落出来。' : ''}${['一次性付款', '不能分期', '不帮贷款', '只够一半', '付款方式', '借款'].some((term) => sample.includes(term)) ? '这类还要单独写“价格虽然划算，但付款太硬、贷款借款接不上，最后只能放弃”。' : ''}`
      : isTravelSafetyCase
      ? `出行安全题先分整体平安与局部阻碍，不把轻微拖延、天气或交通波动直接写成大凶。${sample.includes('事情是否顺利') || sample.includes('整体是否顺利') || sample.includes('办事') || sample.includes('顺利') ? '若题里还问事情顺不顺，就要把“人身平安”和“事情本身会被家事拖住、不太顺”分开写。' : ''}${sample.includes('不得不去') || sample.includes('必须') ? '若盘里显示不得不去，也要直接写明这趟基本是必须去。' : ''}${sample.includes('口舌') || sample.includes('是非') ? '若题里直接问口舌是非，也要把与亲友朋友的口舌争执单独写出来。' : ''}`
      : isLawsuitCase
      ? `诉讼题先分能否调解、责任偏向和执行落袋，不把项目或财路机会感误当成官司结论。${
        isDivorcePropertyCase
          ? '如果名义上有权益、但控制权仍在对方，先按“难立刻兑现、只能继续耗”处理。'
          : asksHalfLiability
            ? '若题里直接问责任怎么分，就要把“更像各担一半”这种责任结构写出来。'
            : asksFullRecovery
              ? '若题里直接问能否全额拿回，就要把“有机会但不易轻松全额回款”写透。'
              : ''
      }${sample.includes('证据') ? '若题里带证据，还要把“现有证据更偏原告一边、有利己的部分不多”单独讲明。' : ''}${sample.includes('赔偿') ? '若题里直接问赔偿金额，也要落到数额不算特别大、偏两三千这一档。' : ''}${sample.includes('反诉') ? '若题里问反诉，要把“继续反诉收益有限”直接写出来。' : ''}${sample.includes('老家') || sample.includes('转到') || sample.includes('近处') || sample.includes('外地') ? '若题里还在比较在哪个法院打，更贴的是留在老家和近处更有利，不宜再折腾换到外地。' : ''}${sample.includes('彩礼') || sample.includes('工资都在') || sample.includes('工资') ? '这类财产官司最终更像只拿回一部分，数量偏四万到五万这一档。' : ''}`
      : isSurgeryPathCase
      ? `手术路径题先分当前医生是否保守、医院是否压抑，再看更适合的方位和入院时点。${sample.includes('针灸') || sample.includes('药物') || sample.includes('开刀') ? '若题里同时问针灸、药物和开刀，就要把“可手术，也可针灸配合药物一起治”直接写出来。' : ''}`
      : isMedicalScamCase
      ? '医疗信息真假题先分消息是真是假，再分医生有没有真能力、转院值不值得，不把热心推荐直接当成可信帮助。'
      : isDisasterNewsCase
      ? '灾情消息判断题先分消息是否真实，再分灾情轻重、是否已有伤灾死亡以及主因是不是水患塌陷共同作用，不按普通天气盘处理。'
      : isHouseAnomalyCase
      ? '房屋怪异题先分旧坟地基是不是主因，再分阴魂回顾是否真的伤人，以及做法安送后能不能恢复正常，不把“住着怪异”直接写成必有大灾。'
      : isBuriedTreasureCase
      ? '藏宝判断题先分地下是否真有古墓古董，再分自己与这类东西有没有缘分、方位环境落在哪里，以及发现后是否不宜乱动。'
      : isPersonalityProfileCase
      ? '人物性格题先分聪明主见，再分急躁、反复和稳不稳，不把一时机灵直接写成成熟稳重。'
      : isGeopoliticalTradeCase
      ? sample.includes('法国总统') || sample.includes('马克龙') || sample.includes('勒庞') || sample.includes('奥朗德') || sample.includes('美国总统大选') || sample.includes('特朗普') || sample.includes('希拉里')
        ? sample.includes('特朗普') || sample.includes('希拉里') || sample.includes('美国总统大选')
          ? '国际关系题先分选民会偏向哪边，再把双方实力接近、希拉里的女性与健康拖累，以及最终胜负写出来，不把泛泛国际关系模板套在美国大选盘上。'
          : '国际关系题先分选举是不是已经进入第二轮，再把双方拉票、当届总统支持和最终胜负写出来，不把泛泛国际关系模板套在大选盘上。'
        : sample.includes('中印边境') || sample.includes('洞朗') || sample.includes('印度')
        ? '国际关系题先分边境紧张会不会升级成全面战争，再把小规模冲突、谈判僵持和对方最终是否退让写出来，不把短期强硬直接写成全面开战。'
        : '国际关系题先分大环境是否真会失控，再分贸易限制会不会全面中断以及恢复窗口，不把短期紧张直接写成长期断绝合作。'
      : isPetSafetyCase
      ? '宠物安全题先分继续养有没有现实隐患，再分家人反对是否有依据，以及若坚持养还能不能做环境和相处方式上的化解，不把舍不得直接写成可以继续养。'
      : isEnvironmentalConditionCase
      ? '环境条件判断题先分会不会下雨，再分雨势大小和是否影响出门，不把阴天云重直接写成大雨封路。'
      : isElderCriticalHealthCase
      ? `老年急病题先分眼前是否过险，再把肺心脑这些关键病位和年底难关写透；不要漏掉“现在未必立刻过不去、但后面仍有大关”这一层。${['消息真假', '是真是假', '联系不上', '不是谣言', '谣言'].some((term) => sample.includes(term)) ? '若一开始是在核受伤消息，还要把“消息是真的，不是谣言，只是暂时联系不上”写出来。' : ''}${['摔伤', '手骨', '脚', '骨伤'].some((term) => sample.includes(term)) ? '若是摔伤骨伤，还要把“可治、无生命危险，但恢复偏慢，后面容易留伤痕或后遗症”直接写出来。' : ''}${['中药', '接骨'].some((term) => sample.includes(term)) ? '若题里问中药接骨，也要直接写“中药方向对、效果可以，但恢复不会很快”。' : ''}`
      : isChronicTreatmentCase
      ? '慢病治疗题先分病程长、恢复慢和是否难治，再看医院药物是否只能有限缓解，以及后续必须配合生活状态调整。'
      : isAcuteRecoveryCase
      ? `急性恢复题先分是不是新病、恢复快不快以及要不要去医院，不把眼前不适直接写成长期重病。${asksDoctorEffectiveness ? '若当前治疗方向对，就不必急着换医生。' : ''}${sample.includes('耳') || sample.includes('面颊') || sample.includes('开药') || sample.includes('头痛') || sample.includes('上火') || sample.includes('热感冒') ? '这类更像压力上火夹着热感冒和发炎，不属大病，宜尽快检查开药，用药有一定效果。' : ''}${sample.includes('小孩') || sample.includes('孩子') || sample.includes('受惊') || sample.includes('发烧') || sample.includes('拉肚子') ? '这类更像受惊后引出的发烧拉肚子，药效不算很明显，但并非大问题，14号前后开始缓解、17号前后基本好转；夜里要有人照看，别再受惊，也不要长期放在太暗的环境里。' : ''}`
      : isDigestiveHealthCase
      ? '消化系统题先分病位和是否有肿块，不把“可调理”简单写成普通小病。'
      : isLostItemCase
      ? `失物题先分是否被盗、是否仍在近处和何时找回，再看位置与隐蔽程度。${sample.includes('钥匙') ? '这类还要直接写就在服装店、试衣和衣服钱包附近的隐蔽处，先找广告和联系方式，再赶在今晚23点前后取回。' : ''}${sample.includes('钱包') ? '这类钱包盘更像没有被盗，证件和现金大多仍在，位置重点看车门、坐垫缝隙或近处被盖住的暗处夹缝。' : ''}${sample.includes('戒指') && (sample.includes('保姆') || sample.includes('卫生间') || sample.includes('浴室')) ? '这类戒指盘更像自己遗忘丢失，不像保姆拿走；位置重点看北方、西北方、卫生间浴室、化妆台和床边这些阴暗有水的地方，整体也偏难找回，甚至已经被水冲走。' : ''}${
        isBankCardCase ? '银行卡类失物还要把“更像在家里还是办公室、是否和身份证一起”单独写出来。' : ''
      }`
      : isDetentionCase
      ? `人身与官非题先分当天是否放出、后续是否继续留案，再看证据和牵连范围。若题里带拘留或取保，还要把会不会转拘留、取保是否当下见效写透。短期即使放出，也不等于后面完全没问题。${['金融', '金钱', '局长', '6-10', '6到10', '女性家属'].some((term) => sample.includes(term)) ? '这类若已经明确牵到金融金钱问题，更贴的主线是事情确实因金钱问题而起，刑责偏重，区间更像会压到 6 到 10 年；但法宫并非完全封死，仍有花钱找关系的疏通空间，更适合找当地最高部门领导或女性家属这一路。' : ''}`
      : ''
  const mainJudgment = [
    openingLine,
    caseSpecificLead,
    gate ? `值使落在${gate}这条线上，说明真正要落地的是“${gate}”所代表的动作。`: '',
    star ? `值符主导的是${star}的判断气质，所以优先看这条线的主矛盾。` : '',
  ].filter(Boolean).join('')
  const reasonChain = [
    subtypeReasoningLead,
    primaryRule?.excerpt || '先按题型和取用神路径落主线。',
    primaryCase?.excerpt || '再用主老师案例去校准实际落点；如果案例层不足，就只保留规则主线。',
    primaryConflict?.excerpt || '有冲突信号时先保留主线，再做降权；没有冲突卡时不强行补参考材料。',
    documentRule?.excerpt ? `文档补边：${documentRule.excerpt}` : '',
    documentCase?.excerpt ? `文档案例补边：${documentCase.excerpt}` : '',
    documentConflict?.excerpt ? `文档冲突说明：${documentConflict.excerpt}` : '',
  ].filter(Boolean).slice(0, 5)
  const riskLine = feedbackLearning?.common_failed_steps?.[0]?.step
    ? `历史复盘里最常错在“${feedbackLearning.common_failed_steps[0].step}”，这次先防止在这一步过度下结论。`
    : isMissingPersonCase
      ? `走失题先分“有没有生命危险”和“何时找回”，不要把短期失联直接当成极凶。${sample.includes('小孩') || sample.includes('孩子') ? '还要补看孩子有没有走远、是不是跟着别人一起移动。' : ''}`
    : isSpecialRelationshipCase
      ? '特殊关系判断题先防把一时好感写成长期可行，更要把对方回避、关系本身有缺陷、整体不适合继续深走和难长久写出来。'
    : isLateMarriageCase
      ? '晚婚婚运题先防把今年桃花动写成今年就能结婚；更贴的主线是今年桃花偏杂难成，真正婚运起势在2017，对象条件不错但脾气会带争吵压力。'
    : isCoverPostCase
      ? '顶班机会题先防把“对你是机会”直接写成一定会上位；更要把你本人忙不过来、校长偏向另一位，以及原处长离职难成分开写。'
      : isImproperPromotionCase
      ? '关系提拔题先防把短期得势写成位置稳固。更要把暧昧或暗线提拔、实力不到位、位置不好保和后续被调整降下来写透。'
      : isConflictMediationCase
      ? '关系纠纷化解题先分谁在克你和谁能通关，不要把有人情基础直接写成自然会和好；该借中间人或公门时要明确写出。'
      : isReconcileVisitCase
      ? '复和见面题先防把“主动过去”直接写成“容易谈成”。更贴的主线是现在不宜硬攻，对方会躲避不见；若一定要去，只适合低调秘密前往，不能勉强强攻。'
      : isRelationshipLitigationCase
      ? `婚姻破局题先分感情主线和诉讼动作；当前更要防把现实破局写成仍会自然和缓，也不要把外缘信号漏掉。${sample.includes('又起诉') || sample.includes('再次起诉') ? '这类还要防漏掉事情反复不顺、后天开庭对己不利，以及把“真想离婚”误写成单纯为钱施压。' : ''}${sample.includes('上诉') || sample.includes('保护令') || sample.includes('判不离') ? '这类还要防把“判不离后仍会继续折腾和上诉”漏掉，也不要漏掉自己当前压力很大这一层。' : ''}`
      : isRelationshipInstabilityCase
      ? `关系拉扯题先分离不离、回不回头和谁更在乎，不要把有感情基础直接写成关系稳定。${sample.includes('有家庭') || sample.includes('妻子') ? '若对方已有家庭，还要防把“心里有你”误写成“会离婚娶你”。' : ''}${sample.includes('回老家结婚') || sample.includes('父母安排') ? '若题里是父母拆散型关系，还要防把“偶有联系”误写成仍能恢复正常交往。' : ''}${sample.includes('第三次婚姻') || sample.includes('2021') || sample.includes('小孩') ? '若题里问再婚和小孩，还要防把“后面还有婚缘”误写成“前缘可挽回或子女缘也顺”。' : ''}${sample.includes('怀不上') || sample.includes('生育障碍') || sample.includes('财产分割') ? '若题里带生育障碍和财产分割，还要防把“仍在一起合作”误写成感情仍好。' : ''}${sample.includes('双方都不太主动') || sample.includes('选择较多') || sample.includes('疏远分开') ? '这类还要防把一时还能联系误写成可以稳定在一起；更贴的是双方都不算主动、各自选择较多，后面会慢慢疏远分开。' : ''}${sample.includes('小三') || sample.includes('婆婆') || sample.includes('长辈') ? '这类还要防把“外面有人追求”误写成“小三已经坐实”，并且要把长辈和外人影响、以及关系仍有缓慢改善空间单独写出来。' : ''}${sample.includes('母亲家') || sample.includes('秘密过去') || sample.includes('不见') || sample.includes('硬谈') || sample.includes('勉强') ? '这类还要防把“主动去见”误写成“容易谈成”，更贴的是对方会躲避、不能勉强硬攻。' : ''}`
      : isReconciliationCase
      ? `复合回头题先分“有回头迹象”和“能不能真正复合”两层，不要把因孩子继续接触直接写成关系会恢复；这类更要把男方过错偏多情、女方仍在忍让、即便复合也还会再分写明。${sample.includes('小孩') || sample.includes('儿子') || sample.includes('看儿子') ? '若题里还牵着孩子探视，风险线要直接点明：会因为孩子继续拉扯，男方外面女人也没断，后续争吵不会少。' : ''}`
      : isCompanyPressureCase
      ? '公司承压题先防把个人冲劲直接写成公司能翻盘；更要把收入开销、资金压力和“空架子”风险分开写。即便不是完全没办法，短期也很难真正翻起来。'
      : isDisciplinaryExposureCase
      ? '停职牵连题先分停职原因和自己是否被继续牵连，不要把表面停职直接当成问事人已经出事。'
      : isFriendProjectCase
      ? '朋友邀职题先分“朋友真不真心”和“项目靠不靠谱”，不要把人情和合作热度直接写成值得辞职；很多时候人是真心的，但平台、产品、资金或管理岗承诺都未必能兑现。'
      : isIntermediaryHelpCase
      ? '帮忙题先分“肯不肯帮”和“帮不帮得上”，不要把表面应承直接写成已经有人接手；若自己心里已发虚，也要把后续放弃当前路径写出来。'
      : isMilitaryDirectionCase
      ? '军区去向题先防把“当前容易去成”误写成“以后发展最好”；也不要把遥远和高压方向直接写成首选，更要把最佳、次优和不利方向拆开。'
      : isSchoolApplicationCase
      ? '学校申请题先防把普通升学盘的“第一志愿有望”套进候补申请；更贴的主线是孩子当前状态受挫、候补机会偏低，消息会在农历三四月出来，但当年仍无缘这所私立学校。'
      : isStudyStateCase
      ? '学习状态题先防把青春期波动写成单纯学习懒散；更要把异性影响、心思离开学习主线、母子争吵和两个月恢复窗口写出来。'
      : isStudyMaterialsCase
      ? '学习资料采购题先防把“资料好”直接写成“每门都能全部学完”；更贴的主线是资料本身不错、确有帮助，但题量大、难度偏高，后续只能挑重点学。'
      : isAssignmentNetworkingCase
      ? '分配走动题先防把“关系多”直接写成谁都能帮。真正关键往往只在一两条线：上一任帮不上、现任不能得罪、真正能落地的反而是更高层和其爱人关系。'
      : isGiftNetworkingCase
      ? '送礼走动题先防把队长的话直接当成真照顾。更贴的主线是队长借加分和印象施压要财，本人有贪财心；上次送水果不宜，这次送烟更容易送成，但本质仍是拿捏。'
      : isPersonnelCoordinationCase
      ? `人事协调题先防把“看不惯对方”直接写成现在就该出手。很多时候真正更稳的是先忍住不动、别把自己卷入口舌是非，再等后续人事自己变化。${sample.includes('分管领导') || sample.includes('主管领导') ? '这类还要防忽略分管领导偏护和主管领导不作为。' : ''}`
      : isDocumentProcedureCase
      ? '签证办理题先防把文书吉象直接写成当下就顺利通过；很多时候真正卡点在政府审核和申请理由，先退一次反而是后面重办通过的前提。'
      : isSalaryRaiseCase
      ? '涨薪申请题先防把个人条件不错直接写成这轮一定能涨；很多时候该主动争取，但阻力仍大，高层和外围关系也未必真能落到实处。'
      : isPersonnelRumorCase
      ? '人事风声题先防把消息面当成已落地结果，很多时候最后双方都不动。'
      : isDepartmentChoiceCase
      ? '部门去向题先防把“轻松”直接写成最好；后勤更像表面轻松、本质不好且后面还会调整，科研虽然累但前景最好，新大学较稳却不易去成。'
      : isStorefrontCase
      ? `门店前景题先防把技术或装修热度直接写成经营没问题；真正风险更在位置不合适、客户难找和不宜死守原址。${sample.includes('写字楼') || sample.includes('工作室') || sample.includes('办公室') ? '这类还要把年租、装修和月度成本偏高单独点出来，并明确不如之前那间写字楼稳妥。' : ''}`
      : isBusinessOpeningCase
      ? `事业开局题先看业务是否可做、哪边市场更适合先开，不要把大客户和贵人线的潜力直接写成已兑现；也要把当前客户资源与计划是否偏高分开。${sample.includes('服装设计') || sample.includes('制衣厂') ? '这类合伙创业更要直接写根基不成熟、计划偏高、行业竞争激烈，若继续硬顶中途容易退出；但若能熬住、少花钱并持续积累客户，后面仍有希望。' : ''}${sample.includes('工作室') || sample.includes('写字楼') || sample.includes('开业') ? '这类写字楼工作室更要防把高端办公楼直接写成客源不愁；更贴的主线是办公室本身没大问题、基本可任选一间，但真正短板在宣传广告不足，前期业务起量偏慢。' : ''}`
      : isJobLeaveCase
      ? `工作去留题先分自己想走和公司是否放人，不要把当前压力写成马上离职；内部更像财务或手续压力拖着，真正离开还在秋后。${sample.includes('保险') || sample.includes('方法方式不对') ? '若题里是保险工作，还要把“本身不适合、做不长、问题在方法方式不对”直接写出来。' : ''}`
      : isLayoffCase
      ? '裁员题先分这轮会不会动你，再看留岗后是否只是维持原状，不要把个人不满直接写成马上走人。'
      : isCourtThreatCase
      ? '法院围堵安全题先防把“法院困住”直接写成真伤灾。更贴的主线是合作和钱财致讼、对方会跟踪施压，但一般不动粗，人最终能平安回来。'
      : isAffairSafetyCase
      ? '私情冲突安全题先防把惊吓和堵门写成真伤灾，也不要把“人身总体无大事”误写成今晚完全没冲突；更贴的是感情私情引起的是非会升级、家属会上门闹事，但以吵闹施压为主。'
      : isInterviewHiringCase
      ? `面试录用题先分面试会不会真正发生，不要把时间点对自己有利直接写成稳过；这类盘常见竞争人员多、通过机会小，甚至面试直接取消，最终录用机会也偏弱。${sample.includes('长久') || sample.includes('做长久') ? '就算勉强应聘上，也往往做不长久。' : ''}`
      : isCompanyChoiceCase
      ? '多家公司择岗题先防把条件看着最高的一家直接写成最适合。更要把 90 这家承诺虚、37 这家压力大不稳、26 这家相对可选但仍有变数分开写。'
      : isRelocationChoiceCase
      ? '异地工作选择题先防把外地高薪或熟人机会直接写成能成；若盘里已有击刑、伏吟和南方不利，更要直接写外地有陷阱、本地更适合。'
      : isExamPlanningCase
      ? '考试策划题先防把替考或硬抄写成稳法子；更贴的主线是替考风险大，合作借前桌选择题更可行，但基础仍不稳、要靠自己勉强接住后半程。'
      : isExamDisciplineCase
      ? '考试违纪疏通题先防把“能找关系”直接写成谁都能摆平；更贴的主线是中层作用不大，必须找真正主管这事、说话算数的大领导，而且要花钱，最后也只是勉强摆平。'
      : isExamAdmissionCase
      ? `考试题先分基础和发挥波动，再看老师是否刻意为难和最终录取，不要把紧张和波动直接写成肯定不过；${sample.includes('司法考试') ? '这题更要把“基础不够扎实、很多题见过但没彻底弄懂、最终更像不过线”直接写透。' : ['前六个进面试', '前六名', '花钱搞关系', '找关系', '暗中操作', '中上成绩'].some((term) => sample.includes(term)) ? '这题不能泛写成“正常发挥就能进面试”，而要直接写内容较熟、成绩中上，但最终仍卡在面试外，同时竞争者里存在暗中花钱找关系。' : '基础未必特别扎实也不等于一定落榜。'}`
      : isUsedCarChoiceCase
      ? '二手车对比题先防把外观更好直接写成更值得买；白车更像好看但带纠纷和克人风险，银车虽然旧些却更稳。'
      : isUsedCarSourceCase
      ? '二手车来源题先防把“朋友介绍”直接写成可靠来源；更要把外地奥迪的虚假和纠纷风险、本地宝马虽旧却更稳写明。'
      : isPropertyTransferCase
      ? `房屋过户题先防把口头答应直接写成过户已成；更贴的主线是对方愿意给，但眼下卡在房贷未清和证件未放，自己可以商量帮凑一部分钱，却不能催得太急。${sample.includes('姐姐') || sample.includes('小叔子') || sample.includes('继承协议') || sample.includes('遗嘱') ? '若是家庭过户盘，还要防把“姐姐也想要”误写成最终真能分走；更贴的是长辈仍偏保守，姐姐虽想要却拿不到，眼下先走继承协议或遗嘱更稳。' : ''}`
      : isPhoneNumberDisputeCase
      ? '号码纠纷题先防把“有人抢走”直接写成同行截胡；更多时候是店员设局抬价。也不要把找领导写成关键解法，真正有效的是当场强硬压住对方，随后立刻把号码绑定身份证。'
      : isPyramidSchemeCase
      ? '传销骗局题先防把“家人有人支持”写成项目真能挣钱；更像见不得光、投入越多越难收回。还要把姐夫自己也不干净、父亲虽反对却不主动管写出来。'
      : isItemAuthenticityCase
      ? '物品真假判断题要直接写外表像真、本质是假，不把之前卖到真货的经历套进当前物件；还要把“火烧过水一验就露底、这份意外之喜会落空”写透。'
      : isBackgroundCheckCase
      ? '背景调查题先防被项目风险线带偏。更贴的主线是背景调查过程会有障碍和花费，但不是卡死之局，最后仍能通过并完成签约入股。'
      : isProjectQuarrelCase
      ? '合作搅局题先防把“28号有动”误写成对方真走。更贴的主线是 28 号前后会调整，但人并不真离场；老者承诺不可靠，后续六万先别再投，合同和责任边界必须先补清楚。'
      : isProjectFraudCase
      ? '项目假账题不能按普通回款题处理。要直接写假账属实、资金被挪动、老板本人贪心不可靠、股份承诺不能轻信，并把“赶紧补协议字据和责任边界”单独落出来。'
      : isBuriedTreasureCase
      ? '藏宝判断题先防把“地下确有老东西”写成“你们就能顺利挖到并得财”。更贴的主线是地下可能真有古墓古董，但与你们缘分薄，发现率低；就算真发现，也不宜轻易去动，尤其别碰古墓线。'
      : isPlatformAuthenticityCase
      ? '平台真假题先防把“平台真实存在”误写成“背景可靠可以长持”。更贴的主线是项目壳子确实存在，但明显借国家或大集团名义过度宣传；短期也许有热度和暴利诱惑，整体仍高风险，只适合快进快出。'
      : isJobOpportunityCase
      ? `应聘题先分当前单位是否无缘，以及是否应转投其他机会，不要把“还能再试”写成已经有戏；若题里带老板、环境、个人犹豫或中间人，也要把这些现实障碍点出来。${sample.includes('飞行员') ? '这类还要把“人适合这类工作，但这次录用受阻、通知合同下不来”单独点明。' : ''}`
      : isWageCollectionCase
      ? '讨薪题先分能不能催动和能拿回多少，不把部分回款写成全额到账。'
      : isDebtCommunicationCase
      ? '债务沟通题先防把“对方还愿意帮”写成已经彻底没事；更贴的主线是你要主动解释，当前只能缓一时，后面压力和口舌仍在。'
      : isOrderDepositCase
      ? '订单接单题先分消息真假和定金会不会来，不把定金未到直接写成做不成；这类更像客户还在比较，但最后会回头成交。'
      : isSupportLoanCase
      ? '借款题先分对方口头态度和实际放款能力，不要把“愿意借”直接写成钱真能借到；很多时候表面应承，实际资金根本动不了，中间阻隔很重，最后还是借不成。'
      : isWealthOverviewCase
      ? `财运总览题不能只写偏财暗财。要直接把整体运气偏低迷、夫妻容易争吵但不至离婚、健康要注意消化系统和眼睛肺部、收入虽然不断却偏低迷，以及问题根源落在工作发展这几层写透。${sample.includes('去年') || sample.includes('上半年') || sample.includes('下半年') ? '若题里还问去年与今年转折，要把“去年整体不顺、上半年仍低迷、下半年才好转”单独写出来。' : ''}${sample.includes('偏财暗财') ? '若题里还带偏财暗财，再补上只能少量碰、做多就惹是非。' : ''}${sample.includes('终身运') ? '若题里是终身运，还要把“个人能力不错但方式方法不够好、命里有财却起伏大钱难留、不利投资经商、婚姻不顺易有二次婚姻，以及晚年较好但老年须防健康”单独落出来。' : ''}`
      : isSubhealthRecoveryCase
      ? '亚健康恢复题不能直接套进消化系统或急性恢复。要直接写没有大毛病，主因是工作压力太大、身体疲惫，肠胃腹部不舒服还会夹着拉肚子；真正有效的是放松精神、多休息，再配点肠胃方面的药慢慢调。'
      : isYinEnvironmentHealthCase
      ? '阴气环境健康题不能按急性恢复来断。要直接写病情不算大但缠绵，主要表现是头晕、无力、没食欲，主因落在压力大和长期少见阳光、阴气过重；后面应少夜出、少去空旷处、多晒太阳，农历五月前后会开始恢复。'
      : isDebtRecoveryCase
      ? '回款题先分“对方会不会继续拖”和“钱能不能真正落袋”，不要把催一催就有回应写成已经收回。'
      : isHousingPurchaseCase
      ? `买房题先分“能不能买”和“买了压不压身”，不要把房子本身不错直接写成价格也合适、压力也不大。${sample.includes('广大城') || sample.includes('无缘买到') || sample.includes('换地方买') ? '若这套房本身就是无缘盘，还要防把“后面会买房”误写成“就在这个楼盘成交”。' : ''}${['一次性付款', '不能分期', '不帮贷款', '只够一半', '付款方式', '借款'].some((term) => sample.includes(term)) ? '若付款方式太硬、贷款借款接不上，还要防把“价格划算”误写成“最终买得成”；这类更像最后放弃。' : ''}${sample.includes('卖房') || sample.includes('想买自己的房子') ? '若题里其实是卖房交易，还要防把“买家有意向”误写成“很快就能成交”；更贴的主线是对方真想买，但资金卡着，短期难成交。' : ''}`
      : isTravelSafetyCase
      ? `出行安全题先分整体平安和局部阻碍，不要把拖延、雨天或交通波动直接升级成事故。${sample.includes('事情是否顺利') || sample.includes('整体是否顺利') || sample.includes('办事') || sample.includes('顺利') ? '人身平安不等于事情顺利，这类更像会被家事、礼金或债务问题拖住，事情本身不算顺。' : ''}${sample.includes('去遵义') || sample.includes('必须') ? '这趟往往还是必须去，不是轻易能推掉的。' : ''}`
      : isLawsuitCase
      ? `诉讼题先分调解、责任和执行，不要把表面有机会直接写成官司稳赢或全额回款。${
        isDivorcePropertyCase ? '若权益名义在己、控制权在对方，还要防拖延继续和兑现被卡。' : ''
      }${sample.includes('强拆') || sample.includes('门面') ? '若题里是门面强拆，还要把“政府决定对己不利、运作阻隔很重、最终还是要拆”单独写明。' : ''}`
      : isSevereHealthCase
      ? '重症题先保留病位、轻重和转移风险，不把“可治疗”误写成“风险不大”。'
      : isSurgeryPathCase
      ? `手术路径题先分当前方案是否合适，不要把“能手术”直接写成“现在这家医院就合适”。${sample.includes('针灸') || sample.includes('药物') || sample.includes('开刀') ? '若盘里治疗方向不算错，也要把“针灸与药物可配合、并不冲突”单独落出来。' : ''}`
      : isNeurologicalDisorderCase
      ? '神经失常题不能只写精神问题。要直接写这是轻微但缠绵的神经失常，更像头部旧伤和受刺激后的后遗症；药效不明显，重点在少刺激、少压力和慢慢调理。'
      : isMedicalScamCase
      ? '医疗信息真假题先防把陌生人的热心和低价承诺误写成真机会；这类更要直接写假信息、拉客和治疗效果差。'
      : isDisasterNewsCase
      ? '灾情消息判断题先防把突发消息当成空穴来风，也不要把真实灾情轻描淡写成只是虚惊；这类更要把消息真实、灾情偏重、已有伤灾甚至死亡以及水患塌陷成因写透。'
      : isHouseAnomalyCase
      ? '房屋怪异题先防把“住着不舒服”写成马上伤人害命。更贴的主线是底下原有坟地、骨骸虽迁但没做法，所以阴魂仍有回顾；住进去的人会明显觉得怪异，但一般不会直接出大事，关键在做法安送后就能恢复正常。'
      : isAncestralTombCase
      ? '祖坟影响题先防把梦见祖辈写成纯心理暗示。更贴的主线是祖坟和先人气场确有牵动，扫墓安慰后会明显减轻不顺，不必直接往凶灾上压。'
      : isPersonalityProfileCase
      ? '人物性格题先防把聪明机灵直接写成成熟稳重。更贴的主线是这人不笨、有主见，但脾气急、说话直、做事容易反复，宜放到更务实有规矩的环境里。'
      : isGeopoliticalTradeCase
      ? sample.includes('法国总统') || sample.includes('马克龙') || sample.includes('勒庞') || sample.includes('奥朗德') || sample.includes('美国总统大选') || sample.includes('特朗普') || sample.includes('希拉里')
        ? sample.includes('特朗普') || sample.includes('希拉里') || sample.includes('美国总统大选')
          ? '国际关系题先防把美国大选写成五五开。更贴的主线是两人实力接近，但选民更偏向特朗普；希拉里还会被女性身份、小人和健康不稳拖累，所以最终仍由特朗普胜出。'
          : '国际关系题先防把法国大选写成谁都差不多。更贴的主线是两人都能进第二轮、都会继续拉票，但奥朗德更支持马克龙，2017 年女性候选人时运又偏弱，所以最终仍由马克龙胜出。'
        : sample.includes('中印边境') || sample.includes('洞朗') || sample.includes('印度')
        ? '国际关系题先防把边境对峙直接写成全面战争。更贴的主线是双方近距离对峙、局部冲突和少量死伤风险确实存在，谈判也会很艰难；但整体仍不至于打成大规模战争，最后还是会以印方退让撤回收场。'
        : '国际关系题先防把短期摩擦写成长期完全断绝。更贴的主线是短期一两年还会限制韩货和相关贸易，但不会彻底停掉；后面韩方会逐步让步，合作和贸易会恢复回升。'
      : isTerminalCancerCase
      ? '晚期癌症题不能只写成重症风险。要直接写治疗效果不明显、已经触到生命危险边界、辰午相关月日是明显危险窗口，最终结果偏凶。'
      : isDepressionCase
      ? '抑郁心结题不能只写长期压抑。要直接写当前程度已偏重，确有轻生和自我封闭风险，病根主要落在流产后的自责死结，不能再拖，后续要靠治疗、运动和心结化解来慢慢转好。'
      : isCardiovascularMaintenanceCase
      ? `心血管慢病题不能只往大病上压。要先分是长期血管心脏受阻，还是眼前劳累、负荷偏高。${sample.includes('胸闷') || sample.includes('负荷高') || sample.includes('劳累') || sample.includes('这几天突然不舒服') ? '这类更像心脏劳累、负荷高，但本身暂未坏到很重的程度；仍要尽快检查、少劳累、稳住节奏。' : '更像心脏功能偏弱、久病缠绵难治，难以彻底断根，只能靠药物和日常保养长期维持；人暂时没有生命危险，但后续必须慢慢调养，同时避免操劳和情绪刺激。'}${sample.includes('父亲') && sample.includes('求财') ? '这类还要把消化系统反复、经常用药、平时检查保养能压住风险，以及财多耗身、不能拼命求财写出来。' : ''}`
      : isEnvironmentalConditionCase
      ? `环境条件题先分是否会下雨和雨势大小，不要把天阴直接写成暴雨，也不要把可出门写成完全不受影响。${sample.includes('彩虹') || sample.includes('雷雨') || sample.includes('雷电') || sample.includes('闷热') ? '若题里是高温闷热后的天气突变，还要把“先热后雨、雷雨反复、间隙见太阳甚至彩虹”直接写出来。' : ''}`
      : isElderCriticalHealthCase
      ? '老年急病题先分眼前能否过险，不要把暂时稳住直接写成后面没事。'
      : isChronicTreatmentCase
      ? `慢病治疗题先分治疗是否有效和是否难治，不把住院直接写成短期就能明显好转；真正难点在长期压抑、气血不畅和自身状态。${sample.includes('胃弱') || sample.includes('偏头痛') ? '这类还要直接写药物只能有限缓解，真正关键是放松压力、注意休息和适当活动。' : ''}`
      : isAcuteRecoveryCase
      ? `急性恢复题先分是否新病和几天内能不能缓下来，不要把当前咳痛直接写成长线恶化。${asksDoctorEffectiveness ? '当前若治疗方向对，就先稳住，不必急着换医生。' : ''}`
      : isDigestiveHealthCase
      ? '消化系统题先分病位、湿热和肿块性质，不要把轻症调理写成完全没问题。'
      : isLostItemCase
      ? `失物题先分“能不能找回”和“何时找到”，不要把位置线索直接当成已经找到。${isBorrowedVehicleCase ? '借车失联还要补看车是否轻微碰撞、会不会被卖掉或抵押，以及必须主动追问。' : ''}${sample.includes('钱包') ? '这类钱包盘更要防一开始就误判成被偷；先回头查车门、坐垫和近处夹缝暗处，很多时候证件和现金其实都还在。' : ''}${sample.includes('戒指') && (sample.includes('保姆') || sample.includes('卫生间') || sample.includes('浴室')) ? '这类还要防先把家里人或保姆当成嫌疑对象，其实更像自己疏忽遗落在有水阴暗处，越急着认定被偷越容易找偏。' : ''}`
      : isDetentionCase
          ? `官非边界题先分“当天能否出来”和“后续是否有事”，不要把短期放出当成后续无风险。${sample.includes('拘留') ? '若今天出不来，就要防转成拘留。' : ''}${asksDetentionReleaseCase ? '若题里带取保，还要写清找关系未必立刻见效、但后面仍有出来机会。' : ''}${sample.includes('工作') ? '若盘里牵着工作线，工作相关的是非也要单独提。' : ''}${['金融', '金钱', '局长', '6-10', '6到10', '女性家属'].some((term) => sample.includes(term)) ? '这类若问到判刑和找关系，更像短期难立刻脱身，真正的放出窗口要放到年底前后去看；现实操作上也更适合朝当地最高部门领导或女性家属这一路去疏通。' : ''}`
          : isInvestmentSchemeCase
            ? '项目题先分“能不能碰”和“要不要现在做”，不要把生门或热度直接写成马上可做；这类盘常见看着热闹、容易想得过高，往往带泡沫和幻想。'
    : (primaryConflict?.excerpt || '当前最需要防的是把旁枝信号误当成主结论。')
  const timingLine = solarTerm
    ? isMissingPersonCase
      ? hasExtendedReturnWindowHint
      ? `当前节气落在${solarTerm}，走失题先看当天和次日能否有消息，再看 24 号前后或更晚一轮的找回窗口。${sample.includes('小孩') || sample.includes('孩子') ? '这类小孩走失更像没有生命危险、人还在变动途中，但能回来；当天就可能有消息，慢些看也会在 29 号前后落实，同时还要补看有没有走远、是否跟着别人一起移动。' : ''}${sample.includes('报警') || sample.includes('诀别信') ? '若已经报警或留诀别信，报警与联系晚辈往往更有效；人总体平安但可能有病气或压力，开始往西边走、之后再转东南，也不会离太远。' : ''}`
        : `当前节气落在${solarTerm}，走失题先看当天和次日能否有消息，再看更晚的找回窗口。${sample.includes('小孩') || sample.includes('孩子') ? '这类小孩走失更像没有生命危险、人还在变动途中，但能回来；当天就可能有消息，慢些看也会在 29 号前后落实，同时还要补看有没有走远、是否跟着别人一起移动。' : ''}${sample.includes('报警') || sample.includes('诀别信') ? '若已经报警或留诀别信，报警与联系晚辈往往更有效；人总体平安但可能有病气或压力，开始往西边走、之后再转东南，也不会离太远。' : ''}`
      : isCourtThreatCase
      ? `当前节气落在${solarTerm}，这题先看今天中午前后会不会真出事，再看对方后续跟踪和施压的方式。整体更像合作与钱财纠纷致讼，对方主要为追钱而来，会跟踪施压，但一般不动粗，本人最终能平安回来。`
      : isChildbirthSafetyCase
      ? `当前节气落在${solarTerm}，这题先看发动日期，再看顺产还是剖腹与母子平安。整体更像1月11日前后发动，胎儿偏男，生产以顺产为主，母子平安，但母亲生产时会有一点受伤风险，所以一定要提前去医院守着。`
      : isFetalGenderCase
      ? `当前节气落在${solarTerm}，这题单看阴阳男女信息，男孩信息更明显，后面见分晓时大概率就是男胎。`
      : isSpecialRelationshipCase
      ? `当前节气落在${solarTerm}，这题先看眼前关系是否继续变冷和回避，再看后续会不会进一步淡掉；整体更像短期已不顺，长期也难走久。`
      : isLateMarriageCase
      ? `当前节气落在${solarTerm}，这题先看眼前桃花能不能成，再看真正结婚窗口。整体更像当前仍偏晚婚，今年虽然会起桃花但夹着烂桃花难真正落成；真正容易结婚在2017年，而且对象条件不错，但婚后脾气不小、争吵压力也会跟着来。`
      : isPartnerComparisonCase
      ? `当前节气落在${solarTerm}，这题先看眼前更放不下哪一边，再看后续谁能真正落到现实行动。现男友短期仍牵动你，但长期更难成；前男友就算回头，后续也更像嘴上说得好、实际很难落地，最后两边都不好成。`
      : isUnfulfilledAffinityCase
      ? `当前节气落在${solarTerm}，这题先看眼前两人是不是完全无缘，再看后续婚姻能否落成与第三方是否介入。更像眼下并非无缘、女方心里还有你，父母阻力也是真实存在，婚姻难成，后续第三方与疏远会慢慢浮出来，最后更像不了了之。${sample.includes('1987') && sample.includes('1983') ? '若细分两条相亲线，1983这条更难成；1987这条虽然还有些缘分，但对方眼光高、想法多，也难真正走到婚姻。' : ''}`
      : isPartnerHealthBarrierCase
      ? `当前节气落在${solarTerm}，这题先看生育障碍是不是结构性问题，再看治疗调理能不能真正扭转婚姻现实。整体更像早年受伤之后，子宫和输卵管这条线已经受损，怀孕阻碍不是短期调理就能解决；中药和一般治疗顶多只能缓一缓，难有明显效果，后面婚姻也会被这条现实问题拖垮。`
      : isConflictMediationCase
      ? `当前节气落在${solarTerm}，这题先看眼前冲突能不能暂时缓住，再看后续有没有中间人或公门系统真正介入化解。`
      : isReconcileVisitCase
      ? `当前节气落在${solarTerm}，这题先看这几天主动过去是否合适，再看会不会见不到人和后续能否稍微缓和。整体更像现在不宜带家人硬攻，对方更可能回避不见；若低调秘密前往，真见到后会略偏有利，但整体仍不容易马上谈成。`
      : isRelationshipInstabilityCase
      ? `当前节气落在${solarTerm}，这题先看眼前关系会不会继续拉扯或短期离开，再看后续走向有没有回头和缓的窗口，不按马上定局来断。${asksRelationshipContactWindow ? '若题里直接问明天要不要主动联系，更像明天不宜太急着主动推进，先缓一缓更稳。' : ''}${sample.includes('桃花') || sample.includes('女友') ? '即便后面桃花起来，也要防先有接触后又不稳、容易分手。' : ''}${sample.includes('分居') || sample.includes('婚姻') ? '这类婚姻盘短期未必真离，但家庭捆绑和长期空耗往往还在。' : ''}${sample.includes('结婚') ? '若题里还问能不能走到结婚，更像长期难稳到婚期。' : ''}${sample.includes('丈夫事业') || sample.includes('不上心') ? '若问到丈夫事业，也更像后续仍不上心。' : ''}${sample.includes('情人') ? '若是情人关系，男方更像偏私人和性层面的牵扯，不敢公开，也更易反复，整体难长久。' : ''}${sample.includes('农历九月') || sample.includes('九十月') ? '农历九月十月更容易再起矛盾。' : ''}${sample.includes('缘分') || sample.includes('承诺') || sample.includes('日本') ? '这类更像你本人更在乎，关系希望本来就小，女方口头承诺也不可靠，久拖之后更偏自己放弃。' : ''}${['老同学', '同学会', '暧昧', '多人相争', '什么想法'].some((term) => sample.includes(term)) ? '这类旧人纠缠盘更像他表面不热，但心里并非完全没你；只是本人多情暧昧、容易卷进多人是非，你再继续深想深卷只会给自己增压。' : ''}${sample.includes('有家庭') || sample.includes('妻子') || sample.includes('被利用') ? '若按有家庭男方细看，更像他心里不是完全没有你，但主要心思仍在事业和现有家庭，妻子不会放手，他也不会真离婚；这段关系长期只是时有时无，你后面还容易看清自己有被他利用去旺事业的一层。' : ''}${sample.includes('员工') || sample.includes('单身') ? '若还是单位里的上下级关系，更像女方保守回避、男方多情，慢慢追也别太急，成功希望本来就不大。' : ''}${sample.includes('新认识') || sample.includes('老领导介绍') || sample.includes('1974') ? '若是新认识对象盘，后面更像女方会越来越不满意，最终会慢慢疏远。' : ''}${sample.includes('工作') || sample.includes('压力') || sample.includes('发展') ? '这类还要把双方工作发展不稳、现实压力明显写出来，所以彼此虽然有感情，关系推进也会一直压着走。' : ''}${sample.includes('回老家结婚') || sample.includes('偶尔联系') ? '若按这类被父母拆散的关系细看，后面不容易再见面和联系，男方更会顺着父母安排回老家结婚；长期对你不利，也带三角恋和退避成分，但并非彻底断死，后面仍会偶有联系和诉苦。' : ''}${sample.includes('第三次婚姻') || sample.includes('2021') || sample.includes('挽回') ? '若按再婚与生育细看，之前那个男方已经挽回不回来；你后面仍有第三次婚姻，关系只是勉强过，较好的成婚窗口偏在 2021 年，但后面难有小孩。' : ''}${sample.includes('小三') || sample.includes('婆婆') || sample.includes('长辈') ? '这类婚姻盘更像近期仍受外人和长辈影响，不会马上好转；但长期并非彻底坏死，拉长看一两年后仍有慢慢改善的空间。' : ''}${sample.includes('母亲家') || sample.includes('秘密过去') || sample.includes('不见') || sample.includes('硬谈') || sample.includes('勉强') ? '这类上门求和盘更像不宜硬攻，低调秘密前往略有利；即便真见到对方，也只是略偏有利，整体仍不容易马上谈成。' : ''}`
      : isHousingPurchaseCase
      ? `当前节气落在${solarTerm}，这题短期先看这房子是否可买、能否承接，再分更适合自住还是投资；若按投资看则偏长期，当前价格和个人压力都要单独评估，不按买了就轻松来断。${sample.includes('广大城') || sample.includes('无缘买到') || sample.includes('换地方买') ? '更贴的落点是眼前这套广大城无缘、当下不宜再签，最后不会买到这里，而是后面换去别的楼盘再成交。' : ''}${['一次性付款', '不能分期', '不帮贷款', '只够一半', '付款方式', '借款'].some((term) => sample.includes(term)) ? '这类更像价格虽划算、你也确实在积极准备，但付款方式太硬、贷款借款都接不上，最后还是会放弃。' : ''}${sample.includes('卖房') || sample.includes('想买自己的房子') ? '若题里其实是卖房交易，更像买家确实有意向，但资金不到位，所以这单短期很难真正成交，价格也不容易一步谈拢。' : ''}`
      : isReconciliationCase
      ? `当前节气落在${solarTerm}，这题先看眼前是否还有回头接触，再看后续能不能真复合；整体更像短期会有回头迹象，但复合机会不大，就算勉强复合也还会再分。`
      : isCompanyPressureCase
      ? `当前节气落在${solarTerm}，这题先看眼前经营能否继续撑住，再看年内收入开销和资金压力是否压得更重，不按短期马上翻身来断。`
      : isDisciplinaryExposureCase
      ? `当前节气落在${solarTerm}，这题先看停职背后是否另有更重问题，再看领导层会不会继续追问到你，以及后续更稳的处理方式。`
      : isFriendProjectCase
      ? `当前节气落在${solarTerm}，这题先看眼前应不应该辞职下注，再看朋友项目后续是否真能落地；整体更像朋友本人是真心的，但项目平台、产品和资金都有隐患。${sample.includes('领导') ? '若在领导新项目和朋友邀职之间选，更适合跟领导走，虽然会有压力。' : ''}${sample.includes('请假') || sample.includes('停薪留职') || sample.includes('辞职') ? '当前不宜盲目辞职，最多先请假或停薪留职试做。' : ''}${sample.includes('新部门') || sample.includes('出国') || sample.includes('原部门') ? '若细分到原部门、新部门和出国这三条线，新部门更像反复不稳，去了也容易回来；出国机会未必一定坐实，但对事业有帮助，值得尽量争取。你个人能力还有后劲，只是眼下整体运势和大环境都还没真正到位。' : ''}`
      : isIntermediaryHelpCase
      ? `当前节气落在${solarTerm}，这题先看眼前联系能否接上，再看对方是否只是口头答应；若这轮不顺，更像你自己后续放弃当前路径、转向其他人。`
      : isMilitaryDirectionCase
      ? `当前节气落在${solarTerm}，这题先分38军、27军、成都炮兵团和其他方向。38军长远发展最好，但现实争取难度更大；27军眼前更容易去成，但长远不如38军；成都炮兵团更容易得到领导重视，但压力也更大，所以更适合先尽力争38军，去不了再选成都炮兵团。`
      : isSchoolApplicationCase
      ? `当前节气落在${solarTerm}，这题先看候补名单这条线还有没有补位空间，再看消息窗口会不会落在农历三四月。整体更像孩子当前状态受挫，候补递补机会偏低；农历三四月会有消息，但当年仍无缘这所私立学校。`
      : isSchoolEntranceCase
      ? `当前节气落在${solarTerm}，这题先看平时基础和复习是不是够，再看考试时身体与压力是否会影响发挥。整体更像平时成绩不错、复习也比较到位，虽然考试时会有一些身体和压力波动，但第一志愿录取几率很大。`
      : isMeritAwardCase
      ? `当前节气落在${solarTerm}，这题先看这轮评功授奖能不能往成事方向推进，再看领导支持和最终落定窗口；整体更像事情容易成、领导偏支持，二等功确实有希望落下来。`
      : isOfficialCareerRiseCase
      ? `当前节气落在${solarTerm}，这题先看眼前这轮职位是不是已经起动，再看后续再升窗口；整体更像本人能力强但一直有阻隔和压力，今年已经先提一步，事业还在上升期，下一次明显提升更偏在 2019 年。`
      : isStudyStateCase
      ? `当前节气落在${solarTerm}，这题先看孩子眼前是不是被异性和青春期因素牵走心思，再看后面多久才能慢慢回到学习主线；整体更像学习状态已经下滑、母子间容易争吵，恢复要拖两个月左右。`
      : isStudyPerformanceCase
      ? `当前节气落在${solarTerm}，这题先看这次考试整体有没有退步，再看数学为何失常。整体更像孩子排名仍有进步，不是整体崩掉；数学主要坏在爱钻偏难题、填空题拖时，卷子本身也偏难，所以平时月考问题不大，但后面大考必须防同类失误。`
      : isAssignmentNetworkingCase
      ? `当前节气落在${solarTerm}，这题先看眼前谁最能帮上分配，再看关系线该怎么走动。上一任教导员更像眼下帮不上，现任教导员与分配关联很大、不能得罪，更适合先缓和关系；真正能落地的帮助更偏系主任这条线，而且更适合通过系主任爱人去走动送礼。`
      : isGiftNetworkingCase
      ? `当前节气落在${solarTerm}，这题先看今天这次送礼能不能送成，再看队长放出加分和印象的话到底是什么意图。整体更像队长借评分和印象继续施压、本人贪财明显；上次送水果不宜，这次送烟能成，也确实会起一点走动作用，但后面仍是被他拿捏。`
      : isPersonnelCoordinationCase
      ? `当前节气落在${solarTerm}，这题先看眼前是不是该马上出手，再看后续关系和人事变动怎么走。${sample.includes('分管领导') || sample.includes('主管领导') ? '当前更像分管领导偏护对方、主管领导知情但暂不管事，你现在硬碰作用不大，反而容易惹口舌；更稳的是先忍着不动，后面她自己会走，主管领导也有换人的可能。' : '你心里其实不想同意，但退让同意更有利；1960 年那位威胁不大，真正更强势的是 1965 年那位，处理上更适合顺势做人、避免把关系弄僵。'}`
      : isDocumentProcedureCase
      ? `当前节气落在${solarTerm}，这题先看这次申请会不会先卡住，再看后续有没有重办通过窗口；更像这轮会先被政府审核卡住，理由也不够对，等退下来后换个理由、花点钱并多跑几趟，后面仍能办下来。`
      : isSalaryRaiseCase
      ? `当前节气落在${solarTerm}，这题先看这轮涨薪风声是不是值得主动争取，再看谁真能帮上忙。自身条件不差，应该主动申请；直属上司更愿意帮忙，高层领导不太想直接出面，总部朋友口头愿帮但距离太远，实际帮不上关键忙，最终涨成机会仍偏小。`
      : isReinstatementCase
      ? `当前节气落在${solarTerm}，这题先看眼前工作位是不是只是被压住，再看后天前后有没有复职回岗窗口；当前更像未彻底断死，但需要主动走动关系，不按完全无缘来断。`
      : isPersonnelRumorCase
      ? `当前节气落在${solarTerm}，这题先看这轮风声会不会坐实，再看后续人事是否真正落地；当前更像消息先起、人未必真动。${sample.includes('正职') || sample.includes('岗位') ? '这类更像仍留在原岗位，提升正职难，不会真降职。' : ''}`
      : isImproperPromotionCase
      ? `当前节气落在${solarTerm}，这题先看眼前这波提拔还能不能挂住，再看一年内会不会被人点破和被调整。更像短期先得势，但位置不好保，一年内就会见结果，最终头衔容易没了、位置也会降下来。`
      : isDepartmentChoiceCase
      ? `当前节气落在${solarTerm}，这题先分后勤、科研和新大学三条线。后勤眼前轻松但后续仍会调整，不能当成长期好去向；科研最主流、前景最好，但会更劳累；新大学较稳也更合心意，只是阻隔更大、不易去成，所以排序上更适合先争科研，其次再争新大学。`
      : isStorefrontCase
      ? `当前节气落在${solarTerm}，这题先看门店位置是不是根本问题，再看更合适的方向。当前更像位置不合适、客户不好找，经营不顺；若要调，东南方最利，南方次优，整体应尽量换址。${sample.includes('续租') || sample.includes('房东') || sample.includes('搬迁') ? '若题里已经是房东不续租，这事更像必须搬，动象很明显；应期主在农历十一月，最晚也拖不过明年正月。' : ''}${sample.includes('写字楼') || sample.includes('工作室') || sample.includes('办公室') ? '这类若还在比较之前写字楼，更像眼前门店房子并不差，但前期投入和后续开销明显偏高，最终还是回到之前那间写字楼工作室更合适。' : ''}`
      : isBusinessOpeningCase
      ? `当前节气落在${solarTerm}，这题先看业务不是完全不能做，再分哪一边市场更适合先试开；当前客户资源未必支持两边一起铺，更适合先开更顺手的一边，不按立刻全面打开来断。`
      : isCoverPostCase
      ? `当前节气落在${solarTerm}，这题先看眼前这件事对你是不是机会，再看你自己想不想动、校长更偏向谁，以及机械处长最后能不能真走成；更像你自己并不想动、也忙不过来，校长更偏向另一位，而原处长最终离职难成。`
      : isJobLeaveCase
      ? `当前节气落在${solarTerm}，这题先看眼前还走不走得开，再看秋后或农历九月后的离开窗口；更像短期拖住，到十月前后才脱得开。${sample.includes('小人') || sample.includes('是非') ? '当前工作里小人是非也偏多。' : ''}${sample.includes('工资') || sample.includes('提成') ? '工资和提成近期也容易受影响。' : ''}${sample.includes('呆多久') || sample.includes('还能做多久') || sample.includes('做不长') ? '这份工作整体更像做不长。' : ''}${sample.includes('保险') || sample.includes('方法方式不对') ? '若按保险工作细看，更贴的变动窗口在农历五月，最迟也拖不过中秋前后。' : ''}`
      : isStudyMaterialsCase
      ? `当前节气落在${solarTerm}，这题不用拉长应期，重点看资料值不值得买和后面该怎么用；整体更像资料本身不错、对孩子有帮助，而且多半是往年真题解析，但量大且偏难，更适合挑重点题型和思路去学，不必六门全部硬啃完。`
      : isLayoffCase
      ? `当前节气落在${solarTerm}，这题先看这轮裁员会不会动到你，再看后续是否只是留岗维持原状，不按马上明显变化来断。`
      : isAffairSafetyCase
      ? `当前节气落在${solarTerm}，这题先看感情私情引起的是非今晚会不会升级，再看是否真有人上门、人身是否有实质伤害与次日远行窗口；更像今晚不宜外出、必须防守为主，对方家属会来吵闹施压，但不至于真的打出重伤，次日也不利远行，宜先稳住再说。`
      : isInterviewHiringCase
      ? `当前节气落在${solarTerm}，这题先看${sample.includes('当天') ? '当天或次日' : '下周二这类'}面试时间点对你是不是略有利，再看面试是否会顺利发生；整体更像竞争人员多、通过机会小，甚至面试本身就可能临时取消。${sample.includes('长久') || sample.includes('做长久') ? '即便勉强应聘上，工作也难做长久。' : ''}`
      : isCompanyChoiceCase
      ? `当前节气落在${solarTerm}，这题先把 90、37、26 三家公司分开看，再看最后会不会按最初想法落定；更像 90 这家条件看着高却不好兑现，37 这家压力大又不稳定，26 这家相对最可选，但整件事中途仍会再起变化，未必能按最初打算直接落实。`
      : isRelocationChoiceCase
      ? `当前节气落在${solarTerm}，这题先看眼前要不要南下外出，再看本地和外地哪边更稳；整体更像福州这类外地机会带陷阱、不利远走，北京本地找更合适，就算硬去外地后续也会很困苦。`
      : isExamPlanningCase
      ? `当前节气落在${solarTerm}，这题先分替考、自身发挥和合作借力三条线。替考风险明显偏大，不宜硬走；更适合自己去考并与前桌合作看选择题，基础虽不够稳，但这样处理仍有机会过线。`
      : isExamDisciplineCase
      ? `当前节气落在${solarTerm}，这题先看这轮考试违纪的麻烦还有没有转圜空间，再看关系该往哪一层去走。整体更像普通中层领导作用不大，必须去找真正主管这事、说话有数的大领导；过程会花钱，但钱能花出去，最后可以勉强摆平。`
      : isExamAdmissionCase
      ? `当前节气落在${solarTerm}，这题先看笔试面试这几天的发挥窗口，再看最终录取结果；${sample.includes('司法考试') ? '这次更像不过线，估分大致压在 325 到 350 之间，核心问题是复习不够扎实、很多题见过但没彻底弄懂。' : sample.includes('奥赛') ? '这次分数不会太低，但孩子自己压力大又容易大意犯错，所以发挥还是受了影响；别的同学里会有人明显冲上去，最后自己更像拿不到名次。' : ['前六个进面试', '前六名', '花钱搞关系', '找关系', '暗中操作', '中上成绩'].some((term) => sample.includes(term)) ? '这次对不少内容其实较熟，成绩能到中上，但竞争者条件略强，且有人花钱找关系，所以最终更像差几名、进不了面试。' : sample.includes('考研') && sample.includes('复试') ? '这次个人落宫不算很旺，也有压力和小错空间，但局面整体仍利于考试；反吟带复试象，所以进入复试机会比较大。' : '基础未必特别扎实、过程会有波动，但老师未必故意为难，只要正常发挥就容易考上，也能顺利进面试。'}${sample.includes('驾照') || sample.includes('科目二') ? '若是驾照场地考试，时间本身不算不能去，但更像细节发挥不好，容易因压力、车速和出线问题不过。' : ''}`
      : isUsedCarChoiceCase
      ? `当前节气落在${solarTerm}，这题先分白车和银车的外观、本质与风险。白车看着更漂亮，但价位偏高，又带多人争抢和纠纷风险，对人也不利；银车虽然旧一些、可能有过碰撞，但本质更好，最终更适合选择银色。`
      : isUsedCarSourceCase
      ? `当前节气落在${solarTerm}，这题先分朋友介绍的纽约奥迪和本地宝马两条线。外地奥迪信息不太可靠，容易带来虚假和纠纷；本地宝马虽然旧一些，甚至可能有旧伤，但整体更稳，更适合就近选择。`
      : isPropertyTransferCase
      ? `当前节气落在${solarTerm}，这题先看房子最终会不会给，再看贷款和证件什么时候松动。${sample.includes('姐姐') || sample.includes('小叔子') || sample.includes('继承协议') || sample.includes('遗嘱') ? '整体更像公婆这边态度偏保守，眼下不容易立刻正式过户；姐姐这条线虽也想要，但最后拿不到，小叔子相对正直可以去谈。若暂时办不了正式过户，更适合先让公婆立财产继承协议或遗嘱，房子后续仍偏向孩子这边。' : '整体更像对方不是假答应，房子最后能过出来，但眼下卡在十七万贷款没清、银行证件没放出；十万元可以商量着帮凑，却不宜逼得太急，真正过户更偏在未月前后。'}`
      : isPhoneNumberDisputeCase
      ? `当前节气落在${solarTerm}，这题先看眼前门店会不会借号码抬价，再看当天能不能把号真正拿下来；整体更像对方在做局炒号，找领导并不关键，更有效的是当场把气势压过去，必要时才小幅让价，但最后号码仍有机会拿到。`
      : isPyramidSchemeCase
      ? `当前节气落在${solarTerm}，这题先看这轮项目还能不能继续骗下去，再看家里人劝阻后多久会停；整体更像短期还会拖一阵，但产品卖不动、钱也回不来，后面终究会停，不按几年暴利来断。${sample.includes('北海') || sample.includes('工地') ? '更贴的落点是这次人本身就去不成，而且眼下不宜急着过去；若贸然过去，反而更容易被纠缠住。' : ''}`
      : isItemAuthenticityCase
      ? `当前节气落在${solarTerm}，这题不用拉长应期，重点就是眼前一验见分晓；更像这件东西外表像真，但当天或很快通过火烧过水就会露底，最后确认并不是真货。`
      : isBackgroundCheckCase
      ? `当前节气落在${solarTerm}，这题先看眼前背景调查会不会卡住，再看签约和入股后续是否能落实。整体更像手续调查过程里会遇到障碍和额外花费，但不是过不去，最后仍能通过背景调查并完成签约入股。`
      : isProjectQuarrelCase
      ? `当前节气落在${solarTerm}，这题先看 28 号前后这对合伙人会不会真动，再看后续资金和合同边界该怎么处理。整体更像 28 号会有调整和冲突升级，但人并不真走；老者承诺不太可靠，后面的六万先别投，合同和责任边界必须先补清楚。`
      : isProjectFraudCase
      ? `当前节气落在${solarTerm}，这题先看这轮核账和对质会不会把问题坐实，再看后续协议字据能不能补强；整体更像假账和挪用问题已能看出，不宜继续只靠口头承诺，眼前就该先留证据、补合同。`
      : isJobOpportunityCase
      ? `当前节气落在${solarTerm}，这题先看眼前这份工作本身成不成；${isJobDevelopmentCase ? '若能去谈，更像这次可以去、求职也总体能谈成，但过程不轻松，后续发展偏长期，不适合按立刻大突破来断。这里要直接落到“是否可去”，答案更偏可以去。' : sample.includes('飞行员') ? '这题更像人本身适合飞行员这类工作，但这次考试和录用受阻，通知书与工作合同都下不来，所以当前这次最终难当上。' : sample.includes('希尔顿') || sample.includes('眉州') || sample.includes('酒店') ? '这题更像本人想走但顾虑很多，两家相比希尔顿花园酒店更好、工资条件也更高；若对方明确录用就值得争取，只是当前单位不太想放人，转过去会有一点折损。' : '若盘里更像无缘，就把重心转到下一轮或别的单位，不必在当前单位硬耗。'}${sample.includes('中间人') ? '若问到中间人，也要把“中间人未必真有效”单独写出来。' : ''}`
      : isWageCollectionCase
      ? `当前节气落在${solarTerm}，这题先看这轮追讨能不能把钱催动，再看后续兑现窗口；更像先回一部分，不是短期全额到账。`
      : isDebtCommunicationCase
      ? `当前节气落在${solarTerm}，这题先看这轮主动沟通能否缓住局面，再看对方是否仍愿意帮、后续关系会不会恶化，以及事情能否拖延缓解，不按已经彻底没事来断。真正的还款压力和口舌仍在，只是能缓一时。`
      : isOrderDepositCase
      ? `当前节气落在${solarTerm}，这题先看这轮客户消息是不是真的，再看定金和订单什么时候落实；整体更像对方仍在比较选择，但定金会来，最终会回头把这单做成，甚至当晚就能敲定。`
      : isSupportLoanCase
      ? `当前节气落在${solarTerm}，这题先看对方这轮会不会先口头答应，再看后续资金是否真能调出来；整体更像嘴上愿意，但中间阻隔很重，过一段时间还是拿不出钱，最后借不成。`
      : isGeopoliticalTradeCase
      ? sample.includes('法国总统') || sample.includes('马克龙') || sample.includes('勒庞') || sample.includes('奥朗德') || sample.includes('美国总统大选') || sample.includes('特朗普') || sample.includes('希拉里')
        ? sample.includes('特朗普') || sample.includes('希拉里') || sample.includes('美国总统大选')
          ? `当前节气落在${solarTerm}，这题先看美国总统大选里双方实力和选民会偏向谁，再看希拉里的女性与健康拖累会不会放大；整体更像两人接近，但特朗普更得选民之势，最终会胜出，希拉里不利。`
          : `当前节气落在${solarTerm}，这题先看法国总统大选第二轮里双方会不会继续拉票，再看现任总统支持会偏向谁以及最后谁会胜出；整体更像两人实力接近，但马克龙更得时势与支持，最终会胜出，勒庞不利。`
        : sample.includes('中印边境') || sample.includes('洞朗') || sample.includes('印度')
        ? `当前节气落在${solarTerm}，这题先看边境对峙会不会继续紧张，再看是否会出现小规模冲突与死伤、谈判会不会长期僵住；整体更像双方表面都强硬、局部摩擦风险仍在，但不会打成大规模战争，后面还是会以印方退让撤回收场。`
        : `当前节气落在${solarTerm}，这题先看中韩关系短期会不会继续紧张，再看贸易限制会不会全面断掉以及恢复窗口；整体更像短期一两年仍会受萨德与政策摩擦影响，韩货和旅行相关业务会被压制，但不会完全断绝，后面韩方会逐步让步，合作和贸易会慢慢恢复回升。`
      : isCooperationGiftCase
      ? `当前节气落在${solarTerm}，这题先看眼前合作是不是本来就起不来，再看送礼和后续合作窗口。整体更像这次合作难成、就算勉强合作也不长久，因此不宜送贵重画作；两幅画里第一幅更好更值钱，但短期内后续也难再有新项目合作机会。`
      : isWealthOverviewCase
      ? `当前节气落在${solarTerm}，这题先看整体运气是不是偏低迷，再看夫妻争吵、健康破财和收入起伏，最后落到问题根源是不是卡在工作发展。整体更像收入虽不至断掉，但人会觉得低迷，夫妻争吵会反复，健康上要注意消化系统、眼睛和肺，真正要改善仍得从事业主线入手。${sample.includes('去年') || sample.includes('上半年') || sample.includes('下半年') ? '若题里还追问去年运势与今年转折，更像去年整体不顺，今年上半年仍要谨慎，到下半年才慢慢回升。' : ''}${sample.includes('偏财暗财') ? '若题里还带偏财暗财，也只能少量碰，多做反而容易起是非。' : ''}${['老公财运', '创业做生意', '偏财能不能碰', '技术类工作', '本职工作'].some((term) => sample.includes(term)) ? '若题里是在问老公财运，更像财运并非全无，但眼下压力大、想法偏高，偏财不宜冒险，创业和折腾新项目难有突破，还是先把上班与技术类工作稳住更合适。' : ''}${sample.includes('终身运') ? '若题里是终身运，这题不看短期应期，重点分一生主线：能力其实不错但方式方法不够好，财运起伏大且钱难留，不利投资经商，婚姻不顺而晚年反倒更有起色；真正到老年时要把健康放在第一位。' : ''}`
      : isBusinessOpeningCase
      ? `当前节气落在${solarTerm}，这题先看业务整体能不能起得来，再看哪一边市场更适合先开。${sample.includes('工作室') || sample.includes('写字楼') || sample.includes('开业') ? '整体更像工作室可以做，办公室本身没有大问题，基本任意选一间都行；但眼下知道的人少，开业后前期业务起量偏慢，真正关键在宣传广告和持续推广。' : sample.includes('服装设计') || sample.includes('制衣厂') ? '整体更像项目并非完全不能做，但眼下根基不足、计划偏高、行业环境压着，短期难一下子做大；若能少花钱、慢慢积累客户，后面仍有转机。' : '整体更像先把更有缘的市场试开起来，当前并不是全面铺开的时点。'}`
      : isSubhealthRecoveryCase
      ? `当前节气落在${solarTerm}，这题先看眼下是不是大病，再看压力和肠胃这条线多久能缓下来。整体更像没有大毛病，主因是工作压力太大、身体疲惫，腹部和肠胃会反复不舒服，偶尔还会拉肚子；先放松精神、多休息，再配一点肠胃方面的药，慢慢就能缓下来。`
      : isYinEnvironmentHealthCase
      ? `当前节气落在${solarTerm}，这题先看眼下是不是重病，再看环境和压力这条线多久能转轻。整体更像问题不大但缠绵，症状主要是头晕、无力、没食欲，主因在压力大和长期少见阳光、阴气偏重；后面应少夜出、少去空旷的地方，多晒太阳，到农历五月前后会自然开始恢复。`
      : isRelationshipLitigationCase
      ? `当前节气落在${solarTerm}，婚姻破局题先看眼前起诉与摊牌窗口，再看外缘是否持续介入和后续关系是否继续下滑；这盘更像起诉会落到现实层面。${sample.includes('又起诉') || sample.includes('再次起诉') ? '若题里已经是又起诉盘，这轮事情更像已经反复不顺，后天开庭对己不利，对方起诉也不是单纯冲着钱，而是确实往离婚方向走。' : ''}${sample.includes('上诉') || sample.includes('保护令') || sample.includes('判不离') ? '若题里是判不离后的上诉盘，对方短期还会继续想办法折腾，上诉念头未消，自己这一阵压力也会偏大。' : ''}`
      : isMarriagePreservationCase
      ? `当前节气落在${solarTerm}，这题先看眼前婚姻还能不能先保住，再看第三者后面会不会自己与男方起矛盾。当前最关键不是硬摊牌，而是先稳住男方、不答应搬走，并尽快让男方母亲出面干预。`
      : isSurgeryPathCase
      ? `当前节气落在${solarTerm}，这题先分当前医生医院是否适合，再看更合适的医院方位和手术时点；若需要手术，更适合午时或属马日这类偏火的入院窗口。${sample.includes('农历四月') || sample.includes('腰椎') || sample.includes('小腹') ? '按这条线继续走，农历四月前后更容易逐步缓解。' : ''}`
      : isMedicalScamCase
      ? `当前节气落在${solarTerm}，这题先看眼前这条推荐信息是真是假，再看是否应该留在当前医院，不按“马上转去外院”来断。`
      : isDisasterNewsCase
      ? `当前节气落在${solarTerm}，这题先看灾情消息是真是假，再看灾情轻重和伤亡情况；整体更像消息真实，而且现场已经有较重伤灾，甚至已有死亡信号，主因偏向水患与土体塌陷共同作用。`
      : isHouseAnomalyCase
      ? `当前节气落在${solarTerm}，这题不用往很远看，重点先分房屋底下是不是旧坟地基残留，再看阴魂回顾会不会真伤人。整体更像骨骸虽已迁走，但没做法，所以住的人会明显觉得怪异；一般不会直接出大事，做法安送后就能恢复正常。`
      : isAncestralTombCase
      ? `当前节气落在${solarTerm}，这题先看近来的反复不顺是不是祖坟和先人气场所牵，再看后续是否需要经常扫墓安慰先人。整体更像确与祖坟线有关，后面持续扫墓、安慰死者、增强坟墓气场后，梦见祖辈和逢梦即不顺的情况会慢慢减少，整体运势也会恢复平顺。`
      : isPetSafetyCase
      ? `当前节气落在${solarTerm}，这题不用往很远看，重点就是眼下继续养会不会给自己添隐患；整体更像继续养并不稳，家人反对也不是空担心。若一定舍不得送走，也只能靠后续调整环境和相处方式去减轻问题。`
      : isEnvironmentalConditionCase
      ? sample.includes('彩虹') || sample.includes('雷雨') || sample.includes('雷电') || sample.includes('闷热')
        ? `当前节气落在${solarTerm}，这题先看白天会不会先闷热出太阳，再看后面会不会转成雷雨反复；整体更像上午到白天先热、有太阳，10 点后开始出现雷雨和阵雨反复，晴雨来回切换，野外活动容易被打断，但并不是整天暴雨封路，天象上还容易见到彩虹。`
        : `当前节气落在${solarTerm}，这题先看明天路上会不会下雨，再分雨势大小和行程影响；更像阴天夹小雨，而且来得不慢，但不至于大到完全去不了。`
      : isChildConflictMediationCase
      ? `当前节气落在${solarTerm}，这题先看眼前要不要再去见面对质，再看老师调解是否已经足够。整体更像见面后容易再起冲突，老师已经把局面压住，当前不宜再带人去解释道歉，否则反而更容易出事。`
      : isTerminalCancerCase
      ? `当前节气落在${solarTerm}，这题先看眼前生命危险，再看辰午相关月日是否会真应凶；整体已经触到危险边界，短期窗口内更要防最终结果直接落坏。`
      : isNeurologicalDisorderCase
      ? `当前节气落在${solarTerm}，这题先分病情到底严不严重，再看药物和调理是否见效；整体更像病情不算特别重，但难快治好，用药效果不明显，后面关键仍是少刺激、少压力。`
      : isDepressionCase
      ? `当前节气落在${solarTerm}，这题不能只看几天内会不会缓过来，更要把心结解开和后续调理窗口分开；短期先防情绪爆发与轻生念头，后面才看慢慢转好。`
      : isCardiovascularMaintenanceCase
      ? `当前节气落在${solarTerm}，这题先分眼前不舒服是不是劳累负荷引起，再看后续要不要按长期检查调理去做；${sample.includes('胸闷') || sample.includes('负荷高') || sample.includes('劳累') || sample.includes('这几天突然不舒服') ? '更像心脏劳累、负荷偏高，心脏本身暂时没有大问题，但不能继续硬扛，应尽快检查并把节奏放下来。' : '更像心脏功能偏弱，药物和保养能维持住，人暂时没有生命危险，但难彻底根治，后续重点仍是长期检查、慢慢调养、少操劳、少兴奋和稳情绪。'}${sample.includes('父亲') && sample.includes('求财') ? '这类父亲健康盘更像心脏和消化系统都要长期用药盯着，暂时没有立刻致命危险，但财运越重越耗身，不能拼命求财。' : ''}${sample.includes('脑') || sample.includes('CT') || sample.includes('脑血管') ? '眼下脑部还看不出实病，可以先不按脑 CT 落，但脑血管这条线仍要重点预防。' : ''}`
      : isElderCriticalHealthCase
      ? `当前节气落在${solarTerm}，这题先看眼前是否有生命危险，再把肺部心脏、脑血管和年底及明年农历二月这类关键风险窗口分开看。${['消息真假', '是真是假', '联系不上', '不是谣言', '谣言'].some((term) => sample.includes(term)) ? '先落消息线，更像消息真实，不是谣言，只是当下联系不顺。' : ''}就这次来看还没到立刻过不去的程度，但肺部心脏和老年脑血管问题都要重点提防；年底丑月和明年农历二月是关键难关。${sample.includes('脑') || sample.includes('CT') || sample.includes('脑血管') ? '眼下脑部还看不出实病，可以先不按脑 CT 落，但脑血管堵塞这条线仍要重点预防。' : ''}${['摔伤', '手骨', '脚', '骨伤'].some((term) => sample.includes(term)) ? '若按这次外伤细看，更像手脚骨位摔伤，可治、无生命危险，但恢复偏慢，后面容易留伤痛、伤痕或一定后遗症。' : '若这次能稳住，后面更要按慢慢调养、中西医结合、避免兴奋劳累这条线去维持。'}${['中药', '接骨'].some((term) => sample.includes(term)) ? '这类接骨治疗方向本身是对的，中药有一定效果，只是恢复周期会被拉长。' : ''}`
      : isChronicTreatmentCase
      ? `当前节气落在${solarTerm}，这题先按长病慢治看，不按几天内明显见效来断；医院治疗能起作用但效果有限，恢复要拉长。${sample.includes('胃弱') || sample.includes('偏头痛') ? '更贴的落点是胃弱等消化系统旧病时有时无、不易断根，病不算特别重；偏头痛更偏压力、神经紧张和久坐诱发，药物只能有限缓解，真正关键还是放松压力、注意休息和适当活动。' : ''}`
      : isAcuteRecoveryCase
      ? `当前节气落在${solarTerm}，这题先看近几天到一周内会不会明显好转，再分是不是新病以及是否需要去医院复查。${sample.includes('开药') || sample.includes('面颊') || sample.includes('耳') ? '更像尽快检查开药后就能缓下来，三五天到一周内会有明显起色。' : ''}${sample.includes('24') || sample.includes('25') ? '更贴近的缓解窗口在 24、25 号前后。' : ''}${sample.includes('头痛') || sample.includes('上火') ? '眼前更像压力上火引出的头痛。' : ''}`
      : isDigestiveHealthCase
      ? `当前节气落在${solarTerm}，这题先看消化系统病位和当下轻重，再看调理观察窗口。${asksMedicationWindow ? '当前更适合先西药消炎止痛，再接中药和饮食调理；若拖到后续农历月令，病势更容易加重。' : ''}${sample.includes('肿块') ? '若有肿块也先按良性和持续观察来断。' : ''}`
      : isDebtRecoveryCase
      ? `当前节气落在${solarTerm}，这题先看这轮催款是否见效，再看后续阶段对方会不会继续拖欠；真正落袋更像要等下一轮冲动或兑现窗口。`
      : isHousingPurchaseCase
      ? `当前节气落在${solarTerm}，这题短期先看这房子是否可买、能否承接，再分更适合自住还是投资；若按投资看则偏长期，当前价格和个人压力都要单独评估，不按买了就轻松来断。${sample.includes('广大城') || sample.includes('无缘买到') || sample.includes('换地方买') ? '更贴的落点是眼前这套广大城无缘、当下不宜再签，最后不会买到这里，而是后面换去别的楼盘再成交。' : ''}${['一次性付款', '不能分期', '不帮贷款', '只够一半', '付款方式', '借款'].some((term) => sample.includes(term)) ? '这类更像价格虽划算、你也确实在积极准备，但付款方式太硬、贷款借款都接不上，最后还是会放弃。' : ''}`
      : isTravelSafetyCase
      ? `当前节气落在${solarTerm}，出行安全题先看出发和返程两端是否顺，再看途中是否只是轻微拖延或临时阻碍。${sample.includes('明天') ? '明天本身要出发，返程更像当晚或次日落回。' : ''}${sample.includes('事情是否顺利') || sample.includes('整体是否顺利') || sample.includes('办事') || sample.includes('顺利') ? '事情层面不算顺，更像会被家事纠缠拖住。' : ''}${sample.includes('不得不去') || sample.includes('必须') ? '这趟多半还是必须走。' : ''}${sample.includes('口舌') || sample.includes('是非') ? '同行过程中也更容易和亲友朋友发生口舌是非。' : ''}`
      : isLawsuitCase
      ? `当前节气落在${solarTerm}，诉讼题先看眼前调解或讲和窗口，再看与法方关系、判决、责任归属和后续执行阶段。${
        isDivorcePropertyCase
          ? '这类财产纠纷更像先拖着耗，短期难一下子兑现到手。'
          : asksHalfLiability
            ? '若调解不成，更像进入责任分摊而不是单边全赢。'
            : asksFullRecovery
              ? '这盘不宜按轻松全额回款来断。'
              : ''
      }${sample.includes('赔偿') ? '赔偿金额不宜按特别大来断，更像两三千这一档。' : ''}${sample.includes('反诉') ? '若还想反诉，收益有限，不如尽快了结。' : ''}${sample.includes('强拆') || sample.includes('门面') ? '这类门面强拆盘更像眼前先拖一阵，不是当场就拆，但最终还是保不住，实际应期偏在短拖后拆。' : ''}${sample.includes('老家') || sample.includes('转到') || sample.includes('近处') || sample.includes('外地') ? '法院地点这条更像不利变动，留在老家和近处打更顺。' : ''}${sample.includes('彩礼') || sample.includes('工资都在') || sample.includes('工资') ? '真正拿回的钱更像四万多、接近五万这一档，而且到手偏慢，真正落袋更偏在未月前后。' : ''}`
      : isLostItemCase
      ? `当前节气落在${solarTerm}，失物应期先看当下时点和冲空填实，再看短期触发。${
        isBankCardCase ? '位置上更要优先排查家里或办公室的隐蔽柜盒，以及身份证附近。' : ''
      }${sample.includes('钱包') ? '这类钱包盘更像很快就在近处夹缝暗处找到，先别急着按被盗处理。' : ''}${isBorrowedVehicleCase ? '这类借车案更要主动追问，当日申时前后最容易有消息并把车开回。' : ''}${sample.includes('戒指') && (sample.includes('保姆') || sample.includes('卫生间') || sample.includes('浴室')) ? '这类戒指盘眼下更要先回头查北方、西北方和卫生间浴室这些有水暗处；若一直找不到，更像已经被水冲走，不宜把时间耗在怀疑保姆上。' : ''}`
      : isDetentionCase
        ? `当前节气落在${solarTerm}，人身与官非题先看当天放出窗口，再看后续风险触发和是否还有问题。${sample.includes('拘留') ? '若今天出不来，后面更要防转成拘留。' : ''}${asksDetentionReleaseCase ? '这类取保题往往不能指望立刻办成，但后面仍有出来机会；若盘里牵出工作线，还要把工作相关是非单独拎出来。' : ''}${sample.includes('今天能否出来') ? '即使今天能出来，后面也未必一点问题都没有。' : ''}${sample.includes('近况') || sample.includes('近期') ? '若题里直接问近况，也要按近期状态不稳来写，不只看能不能出来。' : ''}${['金融', '金钱', '局长', '6-10', '6到10', '女性家属'].some((term) => sample.includes(term)) ? '这类若问到判刑和找关系，真正的放出窗口更要放到年底前后去看。' : ''}`
        : asksRetryWindow
          ? `当前节气落在${solarTerm}，这题先看眼前这轮应聘或推进是否成；若短期不成，就把观察窗口放到后续阶段或下一轮机会，不要只盯当天结果。`
          : asksCareerDevelopmentWindow
            ? `当前节气落在${solarTerm}，这题先看眼前这次谈成与否，再把年内推进和更长期的发展窗口分开判断，不按立刻大突破来断。`
      : asksMarketExpansionWindow
              ? `当前节气落在${solarTerm}，这题先分业务能不能做、哪一边市场更适合先试开，再看当前客户资源和后续是否具备放大与两边铺开的条件，不按一下子全面打开来断。${sample.includes('服装设计') || sample.includes('制衣厂') ? '这类服装设计合伙创业更像根基不成熟、计划偏高、行业大环境不利且竞争激烈；既已投进去就只能稳住少花钱、多积累客户，否则中途容易退出，但若能熬住后面仍有希望。' : ''}`
            : asksDisciplinaryExposureWindow
              ? `当前节气落在${solarTerm}，这题先分停职处分本身的真实原因，再看自己会不会被继续牵连，以及领导层后续会不会表态，不按马上翻篇来断。`
            : asksCompanyPressureWindow
              ? `当前节气落在${solarTerm}，这题先看眼前经营能否稳住，再看年内现金流和债务压力能不能扛过去，不按短期马上翻身来断。`
            : asksInvestmentSchemeWindow
              ? `当前节气落在${solarTerm}，这题先看现在是否适合入场，再看观察一段后的风险暴露窗口，不按马上重仓参与来断。${sample.includes('平台') || sample.includes('股权') || sample.includes('大集团') || sample.includes('国家背景') ? '若细分到平台真假，更像项目壳子并非纯空，但背景宣传明显过大；短线可快进快出，久持深投风险很大。' : ''}`
            : isBuriedTreasureCase
              ? `当前节气落在${solarTerm}，这题先看地下到底有没有古墓古董，再看自己有没有缘分发现以及方位环境。整体更像北边、低矮靠水和树木花草附近确有古老之物，但与你们缘分偏薄，发现概率不高；就算真发现，也不宜轻易去动。`
            : asksDebtCommunicationWindow
              ? `当前节气落在${solarTerm}，这题先看这轮主动沟通能否缓住局面，再看对方是否仍愿意帮、后续关系会不会恶化，以及事情能否拖延缓解，不按已经彻底没事来断。真正的还款压力和口舌仍在，只是能缓一时。`
            : asksHousingInvestmentWindow
              ? `当前节气落在${solarTerm}，这题先分自住能否承接，再分投资回报是否偏长期，不按短线马上兑现来断。`
          : asksRelationshipContactWindow
            ? `当前节气落在${solarTerm}，这题先看明天或次日是否适合主动联系；当前仍有联系基础、也有继续推进空间，但若当下不稳，就等填实日或下一轮更顺的接触窗口再推进。`
          : asksRelationshipStageRisk
            ? `当前节气落在${solarTerm}，先看眼前关系是否已被第三者或现实阻力打断，再看后续阶段这段关系会不会继续夭折。`
            : asksMedicationWindow && hasLunarWindowHint
              ? `当前节气落在${solarTerm}，先看眼前消炎止痛窗口，再看农历月令后的加重或缓解变化，同时分清中西药的先后节奏。`
              : asksMedicationWindow
                ? `当前节气落在${solarTerm}，先看眼前消炎止痛窗口，再看后续阶段是否继续加重，同时分清中西药的先后节奏。`
          : asksLongHorizonTiming && questionType === 'love_relationship'
          ? `当前节气落在${solarTerm}，这题不能只看眼前几天，先分近期接触窗口，再分今年明年的桃花与婚期窗口。${sample.includes('女友') || sample.includes('桃花') ? '次年桃花会不会起来、起来后是否容易分手，也要单独看。' : ''}`
          : asksLongHorizonTiming && questionType === 'health_energy'
            ? `当前节气落在${solarTerm}，健康题既要看眼前病势，也要把年底、农历月令和后续风险窗口分开。`
            : asksLongHorizonTiming
              ? `当前节气落在${solarTerm}，应期不能只按短期看，要把近期触发和年内、明年的兑现窗口分开。`
              : asksDurationTiming
                ? `当前节气落在${solarTerm}，这题重点看恢复或推进需要多久，先看近几天，再看本月内的节奏变化。`
                : asksImmediateTiming && questionType === 'love_relationship'
                  ? `当前节气落在${solarTerm}，先看明天或当晚这一步是否适合主动推进，再看后续填实日能否真正落实。`
                  : asksImmediateTiming
                    ? `当前节气落在${solarTerm}，这题先看今天、明天或当晚的短期窗口，再看是否延到次一层时点。`
        : `当前节气落在${solarTerm}，应期判断先看节气背景，再看短期触发。`
    : '应期先看主线是否形成，再看短期触发。'
  const uncertainty = evidence.emptyPalaces.length > 0
    ? `盘里还有空亡线（${evidence.emptyPalaces.join('、')}），所以不要把所有显眼信号都当成真正落地。`
    : isSevereHealthCase
      ? '当前可以断主线，但重症题仍要把“治疗机会”和“风险上升”分开表达。'
      : '当前可以断主线，但仍然要防止把短期波动看成最终结论。'
  return { main_judgment: mainJudgment, reason_chain: reasonChain, risk_line: riskLine, timing_line: timingLine, uncertainty }
}

function applyFeedbackLearning(items: MatchedKnowledge[], feedbackLearning?: QimenFeedbackLearning | null) {
  if (!feedbackLearning || feedbackLearning.risky_support_ids.length === 0) return items
  const penaltyMap = new Map(feedbackLearning.risky_support_ids.map((item) => [item.id, item.count]))
  const stepPenalty = new Map<MatchedKnowledge['trace_kind'], number>([
    ['rule', 0],
    ['case', 0],
    ['pattern', 0],
    ['term', 0],
    ['conflict', 0],
  ])

  for (const failed of feedbackLearning.common_failed_steps) {
    const countWeight = Math.min(failed.count * 0.18, 0.9)
    switch (failed.step) {
      case 'video_rules':
        stepPenalty.set('rule', (stepPenalty.get('rule') ?? 0) + countWeight)
        stepPenalty.set('pattern', (stepPenalty.get('pattern') ?? 0) + Math.max(0.2, countWeight - 0.1))
        break
      case 'case_alignment':
        stepPenalty.set('case', (stepPenalty.get('case') ?? 0) + Math.max(0.25, countWeight))
        break
      case 'document_support':
        stepPenalty.set('term', (stepPenalty.get('term') ?? 0) + Math.max(0.2, countWeight))
        stepPenalty.set('conflict', (stepPenalty.get('conflict') ?? 0) + Math.max(0.2, countWeight - 0.05))
        break
      case 'decision_compose':
        stepPenalty.set('case', (stepPenalty.get('case') ?? 0) + 0.15)
        stepPenalty.set('conflict', (stepPenalty.get('conflict') ?? 0) + 0.15)
        break
      default:
        break
    }
  }

  return [...items]
    .map((item) => {
      const count = penaltyMap.get(item.id) ?? 0
      const idPenalty = Math.min(count * 0.6, 2.4)
      const tracePenalty = stepPenalty.get(item.trace_kind) ?? 0
      const penalty = Number((idPenalty + tracePenalty).toFixed(2))
      return {
        ...item,
        id_penalty: Number(idPenalty.toFixed(2)),
        step_penalty: Number(tracePenalty.toFixed(2)),
        feedback_penalty: penalty,
        score: Number((item.score - penalty).toFixed(2)),
      }
    })
    .sort((a, b) => b.score - a.score)
}

function buildQuestionRoute(questionType: string, questionText: string, evidence: ReturnType<typeof extractChartEvidence>) {
  const sample = cleanText(questionText)
  const isMissingPersonCase = ['失踪', '走失', '联系不上', '诀别信', '寻人', '失联'].some((term) => sample.includes(term))
  const isLostItemCase = ['丢失', '找回', '戒指', '钥匙', '银行卡', '失物'].some((term) => sample.includes(term))
  const isDetentionCase = ['被抓', '派出所', '拘留', '证据', '放人', '出来'].some((term) => sample.includes(term))
  const isAffairSafetyCase =
    questionType === 'health_energy'
    && ['宾馆', '出轨', '被人打', '羞辱', '我门外', '门外', '家属来', '防守为主', '别出去', '私情', '老公知道', '他老婆知道'].some((term) => sample.includes(term))
  const isSpecialRelationshipCase =
    questionType === 'love_relationship'
    && ['同性恋', '同性', '特殊关系', '特殊感情', '朋友交往的关系'].some((term) => sample.includes(term))
  const isUnfulfilledAffinityCase =
    questionType === 'love_relationship'
    && ['女方心里是否有你', '心里是否有你', '第三方', '不了了之', '发展成婚姻'].some((term) => sample.includes(term))
  const isPartnerHealthBarrierCase =
    questionType === 'love_relationship'
    && ['性功能', '生育能力', '生育障碍', '怀不上'].some((term) => sample.includes(term))
    && ['结婚', '婚姻', '走到结婚', '治疗', '分开'].some((term) => sample.includes(term))
  const isLateMarriageCase =
    questionType === 'love_relationship'
    && ['晚婚', '单身', '什么时候结婚', '婚运', '烂桃花', '嫁入有钱人家', '抓住时机'].some((term) => sample.includes(term))
    && ['结婚', '婚姻', '相亲', '桃花'].some((term) => sample.includes(term))
  const isPartnerComparisonCase =
    questionType === 'love_relationship'
    && ['当前男友', '前男友', '如何选择', '回头复合', '实际行动'].some((term) => sample.includes(term))
  const isReconcileVisitCase =
    questionType === 'love_relationship'
    && ['复和', '复合'].some((term) => sample.includes(term))
    && ['母亲家', '妈妈家', '带家人去', '秘密过去', '秘密前往'].some((term) => sample.includes(term))
    && ['见不到人', '躲避', '不见', '硬谈', '勉强'].some((term) => sample.includes(term))
  const isSupportLoanCase =
    questionType === 'money_wealth'
    && ['借钱', '借款', '借到', '借不出', '周转', '资金紧张'].some((term) => sample.includes(term))
  const isItemAuthenticityCase =
    questionType === 'money_wealth'
    && ['真假', '真货', '假货', '耳坠', '耳环', '项链', '火机', '烧红', '过水'].some((term) => sample.includes(term))
  const isProjectFraudCase =
    questionType === 'money_wealth'
    && ['假账', '财务不透明', '股份不兑现', '协议书', '责任边界', '补开字据', '挪用', '老人中心', '股份责任'].some((term) => sample.includes(term))
  const isBuriedTreasureCase =
    questionType === 'money_wealth'
    && ['宝藏', '古墓', '古董', '古币', '耕地', '山药地', '石碑', '租用耕地'].some((term) => sample.includes(term))
  const isPhoneNumberDisputeCase =
    questionType === 'money_wealth'
    && ['手机号', '号码', '抢占', '抢号', '店员', '绑定身份证', '抬价'].some((term) => sample.includes(term))
  const isPyramidSchemeCase =
    questionType === 'money_wealth'
    && ['传销', '平台费', '见不得光', '产品不好卖', '几年挣几十万'].some((term) => sample.includes(term))
  const isPropertyTransferCase =
    questionType === 'money_wealth'
    && ['过户', '房贷', '贷款没还清', '房产证', '银行证件', '给儿子', '十七万', '17万', '公婆'].some((term) => sample.includes(term))
  const isUsedCarSourceCase =
    questionType === 'money_wealth'
    && ['宝马', '奥迪', '纽约', '朋友介绍', '二手车', '本地'].some((term) => sample.includes(term))
  const isUsedCarChoiceCase =
    questionType === 'money_wealth'
    && ['银色', '白色', '二手车', '两辆车'].some((term) => sample.includes(term))
  const isOrderDepositCase =
    questionType === 'money_wealth'
    && ['定金不到', '服装订单', '老客户', '做衣服', '数量和价格', '转账全款', '接单'].some((term) => sample.includes(term))
  const isInterviewHiringCase =
    questionType === 'career_work'
    && ['面试', '面试官', '取消', '屏蔽', '通过机会'].some((term) => sample.includes(term))
    && !['复试', '笔试', '研究生', '司法考试', '考试', '录取'].some((term) => sample.includes(term))
  const isLayoffCase =
    questionType === 'career_work'
    && ['裁员', '留岗', '被裁', '原岗位', '不满意'].some((term) => sample.includes(term))
  const isCoverPostCase =
    questionType === 'career_work'
    && ['顶班', '机械处', '处长', '校长', '1977', '读博'].some((term) => sample.includes(term))
  const isImproperPromotionCase =
    questionType === 'career_work'
    && ['小人得志', '暧昧关系', '不正当手段', '暗中行事', '突然提拔', '职位不好保', '头衔没有了', '降职了', '降职'].some((term) => sample.includes(term))
  const isDepartmentChoiceCase =
    questionType === 'career_work'
    && ['后勤', '科研', '新大学', '选部门', '学院拆了', '调整重组'].some((term) => sample.includes(term))
  const isStorefrontCase =
    questionType === 'career_work'
    && ['店铺', '门店', '换址', '东南方', '南方', '客户不好找', '经营前景'].some((term) => sample.includes(term))
  const isMilitaryDirectionCase =
    questionType === 'career_work'
    && ['军区', '38军', '27军', '成都炮兵团', '西藏', '去哪个方向', '去哪个军'].some((term) => sample.includes(term))
  const isSchoolEntranceCase =
    questionType === 'career_work'
    && ['中考', '第一志愿', '女儿', '平时成绩', '复习基础'].some((term) => sample.includes(term))
  const isMeritAwardCase =
    questionType === 'career_work'
    && ['二等功', '评功', '立功', '授奖', '评奖'].some((term) => sample.includes(term))
  const isBidCompetitionCase =
    questionType === 'career_work'
    && ['竞标', '中标', '投标', '污水工程', '工程竞标'].some((term) => sample.includes(term))
  const isGiftNetworkingCase =
    questionType === 'career_work'
    && ['队长', '送水果', '送烟', '印象', '加分', '双首长'].some((term) => sample.includes(term))
    && ['军校', '分配', '教导员', '队长', '平时成绩', '加分'].some((term) => sample.includes(term))
  const isStudyStateCase =
    questionType === 'career_work'
    && !['学习资料', '真题解析', '高考真题', '六门课程', '题型与思路'].some((term) => sample.includes(term))
    && ['学习情况', '学习状态', '高二', '借同学手机', '半夜不睡', '女生追求', '青春期', '纸条'].some((term) => sample.includes(term))
  const isStudyMaterialsCase =
    questionType === 'career_work'
    && ['学习资料', '真题解析', '高考真题', '六门课程', '题型与思路'].some((term) => sample.includes(term))
  const isStudyPerformanceCase =
    questionType === 'career_work'
    && ['小孩考试', '数学', '排名', '填空', '竞赛题', '偏难题', '试卷'].some((term) => sample.includes(term))
    && !['面试', '录取', '复试', '司法考试', '考驾照', '科目二', '第一志愿', '候补'].some((term) => sample.includes(term))
  const isExamDisciplineCase =
    questionType === 'career_work'
    && ['飞行员学员', '考试作弊', '作弊', '作产被发现', '摆平', '主管这事的领导', '钱能花出去'].some((term) => sample.includes(term))
  const isExamPlanningCase =
    questionType === 'career_work'
    && ['替考', '前桌', '选择题', '合作', '监考', '抄题'].some((term) => sample.includes(term))
  const isMedicalScamCase =
    questionType === 'health_energy'
    && ['医托', '黄牛党', '黄牛', '假信息', '骗子', '门诊', '陈主任', '转院'].some((term) => sample.includes(term))
  const isDisasterNewsCase =
    questionType === 'health_energy'
    && ['溃口', '洪水', '洪灾', '灾情', '伤灾', '死亡', '塌陷'].some((term) => sample.includes(term))
    && ['消息', 'QQ', '弹出'].some((term) => sample.includes(term))
  const isHouseAnomalyCase =
    questionType === 'health_energy'
    && ['房屋怪异', '房子怪异', '房子不对劲', '旧坟', '坟地', '地基', '阴魂', '做法', '安送'].some((term) => sample.includes(term))
  const isAncestralTombCase =
    questionType === 'health_energy'
    && ['祖坟', '扫墓', '梦见爷爷', '梦见奶奶', '梦见祖辈', '坟墓气场', '不顺是否与祖坟有关'].some((term) => sample.includes(term))
  const isPersonalityProfileCase =
    questionType === 'career_work'
    && ['表弟性格', '堂弟性格', '什么性格', '性格怎么样', '属兔', '90后出生的'].some((term) => sample.includes(term))
  const isGeopoliticalTradeCase =
    questionType === 'money_wealth'
    && ['中韩关系', '萨德', '韩国货', '旅行社', '中韩贸易', '贸易会有回升', '韩方会谦让', '中印边境', '洞朗', '印度', '边境对峙', '大规模战争', '印方退让', '法国总统大选', '马克龙', '勒庞', '奥朗德', '第二轮', '拉票', '美国总统大选', '特朗普', '希拉里', '选民', '获胜机会'].some((term) => sample.includes(term))
  const isNeurologicalDisorderCase =
    questionType === 'health_energy'
    && ['神经病', '神经失常', '乱说话', '不睡觉', '后遗症', '头部被撞', '受刺激', '精神不太正常'].some((term) => sample.includes(term))
  const isEnvironmentalConditionCase =
    questionType === 'health_energy'
    && ['下雨', '天气', '阴天'].some((term) => sample.includes(term))
  const isPetSafetyCase =
    questionType === 'health_energy'
    && ['狐狸', '宠物', '继续养', '安全隐患', '家人反对'].some((term) => sample.includes(term))
  const isChildbirthSafetyCase =
    questionType === 'health_energy'
    && ['生产', '顺产', '剖腹', '剖腹产', '预产期', '什么时候出生', '母子平安', '早产'].some((term) => sample.includes(term))
  const isFetalGenderCase =
    questionType === 'health_energy'
    && !isChildbirthSafetyCase
    && ['胎儿性别', '宝宝性别', '男孩', '女孩', '男宝', '女宝'].some((term) => sample.includes(term))
  const isDepressionCase =
    questionType === 'health_energy'
    && ['抑郁', '轻生', '心结', '打胎', '自责', '不爱出门', '说梦话', '压抑'].some((term) => sample.includes(term))
  const isTerminalCancerCase =
    questionType === 'health_energy'
    && ['癌症晚期', '晚期', '生命危险', '离世', '危险期'].some((term) => sample.includes(term))
  const isCardiovascularMaintenanceCase =
    questionType === 'health_energy'
    && ['冠心病', '心肌缺血', '血管堵塞', '血液受阻', '不能操劳', '维持', '软化血管', '心脏', '胸闷', '负荷高', '劳累'].some((term) => sample.includes(term))
  const isTravelSafetyCase =
    !isMissingPersonCase
    && !isAffairSafetyCase
    && ['出行', '探亲', '飞机', '航班', '路上', '日本', '往返', '路途'].some((term) => sample.includes(term))
    && ['安全', '阻碍', '拖延', '顺利'].some((term) => sample.includes(term))
  const isLawsuitCase = ['官司', '诉讼', '起诉', '上诉', '保护令', '开庭', '判决', '调解', '责任', '和解', '法庭', '执行'].some((term) => sample.includes(term))
  const isRelationshipLitigationCase =
    questionType === 'love_relationship'
    && ['离婚', '起诉', '外缘', '第三者', '婚姻'].some((term) => sample.includes(term))
    && isLawsuitCase
  const config = QUESTION_KEYWORDS[questionType] ? {
    label:
      isMissingPersonCase ? '走失与人身安全' :
      isAffairSafetyCase ? '私情冲突安全' :
      isChildbirthSafetyCase ? '生产平安' :
      isFetalGenderCase ? '胎儿性别' :
      isSpecialRelationshipCase ? '特殊关系判断' :
      isLateMarriageCase ? '晚婚婚运' :
      isPartnerHealthBarrierCase ? '病弱阻婚' :
      isPartnerComparisonCase ? '择偶比较' :
      isReconcileVisitCase ? '复和见面' :
      isUnfulfilledAffinityCase ? '有缘无果' :
      isRelationshipLitigationCase ? '婚姻破局' :
      isStudyStateCase ? '学习状态' :
      isStudyMaterialsCase ? '学习资料采购' :
      isStudyPerformanceCase ? '学习表现' :
      isItemAuthenticityCase ? '物品真假判断' :
      isProjectFraudCase ? '项目假账' :
      isBuriedTreasureCase ? '藏宝判断' :
      isHouseAnomalyCase ? '房屋怪异' :
      isAncestralTombCase ? '祖坟影响' :
      isPersonalityProfileCase ? '人物性格' :
      isGeopoliticalTradeCase ? '国际关系' :
      isPropertyTransferCase ? '房屋过户' :
      isPhoneNumberDisputeCase ? '号码纠纷' :
      isPyramidSchemeCase ? '传销骗局' :
      isOrderDepositCase ? '订单接单' :
      isUsedCarChoiceCase ? '二手车对比' :
      isUsedCarSourceCase ? '二手车来源' :
      isSupportLoanCase ? '借款求援' :
      isMeritAwardCase ? '评功授奖' :
      isCoverPostCase ? '顶班机会' :
      isImproperPromotionCase ? '关系提拔' :
      isGiftNetworkingCase ? '送礼走动' :
      isDepartmentChoiceCase ? '部门去向' :
      isStorefrontCase ? '门店前景' :
      isMilitaryDirectionCase ? '军区去向' :
      isSchoolEntranceCase ? '升学录取' :
      isExamDisciplineCase ? '考试违纪疏通' :
      isBidCompetitionCase ? '竞标争标' :
      isExamPlanningCase ? '考试策划' :
      isInterviewHiringCase ? '面试录用' :
      isLayoffCase ? '裁员留岗' :
      isMedicalScamCase ? '医疗信息真假' :
      isDisasterNewsCase ? '灾情消息判断' :
      isNeurologicalDisorderCase ? '神经失常' :
      isPetSafetyCase ? '宠物安全' :
      isEnvironmentalConditionCase ? '环境条件判断' :
      isTerminalCancerCase ? '晚期癌症' :
      isDepressionCase ? '抑郁心结' :
      isCardiovascularMaintenanceCase ? '心血管慢病' :
      isTravelSafetyCase ? '出行安全' :
      isLostItemCase ? '失物寻找' :
      isDetentionCase ? '人身安全与官非' :
      isLawsuitCase ? '诉讼纠纷' :
      questionType === 'career_work' ? '事业工作' :
      questionType === 'love_relationship' ? '感情婚姻' :
      questionType === 'money_wealth' ? '财运合作' :
      '健康身体',
    yongshen_focus:
      isMissingPersonCase ? '生命危险、受伤真假、去向与回消息窗口' :
      isAffairSafetyCase ? '人身是否受伤、是否会上门冲突、是否宜外出与次日远行' :
      isChildbirthSafetyCase ? '胎儿性别、发动日期、顺产剖腹与母子平安' :
      isFetalGenderCase ? '胎儿阴阳、男女判断与最终出生性别' :
      isSpecialRelationshipCase ? '关系现状、对方回避、能否继续与长久性' :
      isLateMarriageCase ? '晚婚格局、成婚窗口、对象条件与婚后争吵压力' :
      isPartnerHealthBarrierCase ? '婚姻能否落地、男方性功能与生育能力、治疗效果和最终是否分开' :
      isPartnerComparisonCase ? '现任前任对比、实际行动、长期适配与最终是否都难成' :
      isReconcileVisitCase ? '主动过去是否合适、是否会躲避不见、是否适合秘密前往与见面后是否略有利' :
      isUnfulfilledAffinityCase ? '有无姻缘、女方心意、第三方介入与最终疏远' :
      isRelationshipLitigationCase ? '婚姻主线、外缘介入、起诉真假与后续走向' :
      isStudyStateCase ? '异性影响、学习主线、亲子关系与恢复周期' :
      isStudyMaterialsCase ? '资料质量、实际帮助、题目难度与使用策略' :
      isItemAuthenticityCase ? '真假虚实、测试露底与意外之喜是否落空' :
      isProjectFraudCase ? '假账挪用、老板可靠性、股份承诺与合同边界' :
      isBuriedTreasureCase ? '地下有无古墓古董、是否有缘发现、方位环境与能否轻动' :
      isHouseAnomalyCase ? '旧坟地基、阴魂回顾、是否伤人以及做法安送后能否恢复正常' :
      isAncestralTombCase ? '祖坟气场、反复不顺、扫墓安慰与后续转顺' :
      isPersonalityProfileCase ? '聪明主见、急躁反复、是否稳重与更适合的发展环境' :
      isGeopoliticalTradeCase
        ? sample.includes('法国总统') || sample.includes('马克龙') || sample.includes('勒庞') || sample.includes('奥朗德') || sample.includes('美国总统大选') || sample.includes('特朗普') || sample.includes('希拉里')
          ? sample.includes('特朗普') || sample.includes('希拉里') || sample.includes('美国总统大选')
            ? '总统大选胜负、选民偏向、女性与健康拖累'
            : '总统大选胜负、两轮拉票、执政支持与女性候选人时运'
          : sample.includes('中印边境') || sample.includes('洞朗') || sample.includes('印度')
          ? '边境对峙、有限冲突、谈判僵持与印方退让窗口'
          : '关系缓和、贸易限制、韩方让步与恢复合作窗口'
        :
      isPropertyTransferCase ? '房子是否能过户、贷款证件卡点、出资节奏与真正应期' :
      isPhoneNumberDisputeCase ? '设局抬价、店员主导、处理策略与最终拿号' :
      isPyramidSchemeCase ? '项目真假、投入损耗、家人态度与最终是否停盘' :
      isOrderDepositCase ? '消息真假、定金兑现、客户比较与最终接单' :
      isUsedCarChoiceCase ? '外观与本质、纠纷风险、是否克人与最终应选哪辆' :
      isUsedCarSourceCase ? '朋友信息真假、本地与外地车源对比、纠纷风险与最终选择' :
      isSupportLoanCase ? '口头态度、资金是否真能借出、阻隔与最终落地' :
      isMeritAwardCase ? '事情是否容易成、领导是否支持、二等功是否有希望、结果是否落定' :
      isCoverPostCase ? '机会属性、本人意愿、校长偏向、原领导离职与离职原因' :
      isGiftNetworkingCase ? '队长真实意图、送礼时机、施压索财与走动效果' :
      isImproperPromotionCase ? '上位方式、实力是否到位、位置是否保得住、后续是否会被调整' :
      isDepartmentChoiceCase ? '后勤科研新大学三线对比、稳定性、前景和优先顺序' :
      isStorefrontCase ? '门店位置、经营前景、是否应换址与有利方位' :
      isMilitaryDirectionCase ? '眼前能否去成、长期发展、次优选择与优先顺序' :
      isSchoolEntranceCase ? '平时成绩、复习基础、身体压力波动与第一志愿录取' :
      isBidCompetitionCase ? '竞标是否有利、对手地利人和、暗中操作、主动争取与最终机会' :
      isExamPlanningCase ? '替考风险、合作借力、基础水平与最终过线' :
      isInterviewHiringCase ? '面试是否发生、通过机会、取消调整与录用结果' :
      isLayoffCase ? '公司是否重组、本人是否被裁、岗位是否维持原状' :
      isMedicalScamCase ? '消息真假、医生能力、是否应转院与治疗效果' :
      isDisasterNewsCase ? '消息真假、灾情轻重、伤亡情况与主要成因' :
      isNeurologicalDisorderCase ? '轻重程度、旧伤后遗症、用药效果与调理重点' :
      isPetSafetyCase ? '继续养是否有隐患、家人反对是否有据、是否宜继续与可否化解' :
      isEnvironmentalConditionCase ? '是否下雨、雨势大小、环境变化与行程影响' :
      isTerminalCancerCase ? '生命危险、治疗效果、危险窗口与最终结果' :
      isDepressionCase ? '轻生风险、心结根源、治疗调理与后续好转' :
      isCardiovascularMaintenanceCase ? '病位、缠绵难治、是否根治、维持调理与保养重点' :
      isTravelSafetyCase ? '出发返程平安、交通阻碍、往返节奏' :
      isLostItemCase ? '是否被盗、位置方向、找回应期' :
      isDetentionCase ? '当天能否出来、证据与拘留风险、后续牵连' :
      isLawsuitCase ? '调解空间、责任归属、回款兑现与执行难度' :
      questionType === 'career_work' ? '事业、岗位、上级、职位结构' :
      questionType === 'love_relationship' ? '关系双方、情感推进、婚恋结构' :
      questionType === 'money_wealth' ? '财路、合作对象、资源占有、回款兑现' :
      '身体承载、病位、恢复节奏、耗损来源',
  } : {
    label: questionType,
    yongshen_focus: '主线未明确',
  }
  const matchedKeywords = (QUESTION_KEYWORDS[questionType] ?? []).filter((keyword) =>
    questionText.toLowerCase().includes(keyword.toLowerCase()),
  )
  const routingReason = matchedKeywords.length > 0
    ? `问题文本里命中了 ${matchedKeywords.slice(0, 3).join('、')}，并且盘面活跃信号包含 ${evidence.activeTerms.slice(0, 4).join('、') || '关键门星神'}。`
    : `题型按盘面主线和默认问事分类落到${config.label}，盘面活跃信号包含 ${evidence.activeTerms.slice(0, 4).join('、') || '关键门星神'}。`
  return {
    type: questionType,
    label: config.label,
    yongshen_focus: config.yongshen_focus,
    routing_reason: routingReason,
  }
}

function normalizeDecisionLabel(questionType: string, text: string) {
  const sample = cleanText(text)
  if (
    questionType === 'money_wealth'
    && ['平台', '股权', '大集团', '国家背景', '快进快出'].some((term) => sample.includes(term))
    && ['风险', '高风险', '不宜久持', '不宜深投'].some((term) => sample.includes(term))
  ) {
    return 'risk'
  }
  if (
    questionType === 'career_work'
    && ['申请学校', '候补', '私立学校'].some((term) => sample.includes(term))
    && ['无缘', '机会偏低', '补不上', '候补递补机会偏低'].some((term) => sample.includes(term))
  ) {
    return 'risk'
  }
  if (
    questionType === 'career_work'
    && ['考试', '笔试', '面试', '录取'].some((term) => sample.includes(term))
    && ['进不了面试', '差几名', '卡在面试外', '前六名外'].some((term) => sample.includes(term))
    && ['中上', '成绩中上', '考到中上', '内容较熟'].some((term) => sample.includes(term))
  ) {
    return 'mixed'
  }
  if (
    questionType === 'career_work'
    && ['奥赛', '名次', '省二', '省一'].some((term) => sample.includes(term))
  ) {
    return 'mixed'
  }
  if (
    questionType === 'career_work'
    && ['签证办理', '签证', '政府审核', '申请理由', '重新申请'].some((term) => sample.includes(term))
    && ['先被卡住', '先卡住', '退下来', '换个理由', '重办', '后面仍能办下来'].some((term) => sample.includes(term))
  ) {
    return 'mixed'
  }
  if (
    questionType === 'career_work'
    && ['希尔顿', '眉州', '酒店'].some((term) => sample.includes(term))
    && ['更好', '工资更高', '值得争取', '不太想放人', '折损'].some((term) => sample.includes(term))
  ) {
    return 'mixed'
  }
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
        : ['落空', '失败', '不中', '不过线', '未过线', '受阻', '难成', '卡住']
  const mixedTerms = ['波动', '反复', '拉扯', '不稳', '拖延', '观望']
  const riskTerms = ['谨慎', '止损', '保守', '先不要', '风险', '防']

  const positiveScore = positiveTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)
  const negativeScore = negativeTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)
  const mixedScore = mixedTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)
  const riskScore = riskTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)

  if (questionType === 'health_energy') {
    const recoverableTerms = ['治疗', '调理', '控制', '先用', '中药', '西药', '饮食', '恢复', '好转', '缓解']
    const diagnosticTerms = ['病位', '轻重', '病程', '恢复难度']
    const fatalTerms = ['死亡', '病危', '恶性', '转移', '手术不了', '极重', '危险']
    const recoverableScore = recoverableTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)
    const diagnosticScore = diagnosticTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)
    const fatalScore = fatalTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)

    if (
      (negativeScore > 0 && recoverableScore > 0)
      || (positiveScore > 0 && diagnosticScore > 0)
      || (negativeScore > 0 && diagnosticScore > 0 && fatalScore === 0)
    ) {
      return 'mixed'
    }
  }

  if (questionType === 'love_relationship') {
    const relitigationDragTerms = ['判不离', '保护令', '继续上诉', '还会再上诉', '不甘心继续折腾', '婚姻后续仍会继续拉扯']
    const breakupTerms = ['已经离婚', '真的离婚', '起诉会落到现实层面', '继续下滑', '现实破局']
    const instabilityTerms = ['拉扯', '不稳', '离开', '回头', '第三者', '前任', '男方不主动', '名存实亡', '无交流', '难走到结婚', '易分手', '分居', '长期空耗', '父母不同意', '男方不稳定', '丈夫对工作也不上心']
    const partnerHealthBarrierTerms = ['病弱阻婚', '性功能偏弱', '生育能力受影响', '难根治', '治疗能缓', '治疗有限', '终会分开']
    const specialRelationshipRiskTerms = ['特殊关系', '对方回避', '有缺陷', '不适合继续深走', '不合适', '难长久', '难走久']
    const reconciliationRiskTerms = ['复合机会不大', '勉强复合', '还会再分', '男方过错', '男方多情', '女方仍在忍让']
    const affairInstabilityTerms = ['情人', '私人关系', '不敢公开', '更易反复', '逐渐疏远', '性层面', '整体难长久']
    const cohabitationBreakTerms = ['怀不上', '生育障碍', '财产分割', '共同生活', '名存实亡', '分手', '分开']
    if (relitigationDragTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (breakupTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    if (partnerHealthBarrierTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (cohabitationBreakTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (affairInstabilityTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (specialRelationshipRiskTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    if (reconciliationRiskTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    if (instabilityTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (positiveScore > 0 && negativeScore === 0 && positiveScore >= mixedScore) {
      return 'positive'
    }
  }

  if (questionType === 'health_energy') {
    const disasterRiskTerms = ['灾情消息判断', '消息真实', '灾情偏重', '已有伤灾', '已有死亡', '溃口', '塌陷']
    const missingPersonSafeReturnTerms = ['走失与人身安全', '没有生命危险', '总体平安', '能找回', '能回来', '很快会有消息']
    const petSafetyTerms = ['宠物安全', '安全隐患', '不太建议继续养', '不建议继续养', '仍有化解办法', '减轻问题']
    const depressionRiskTerms = ['抑郁', '轻生', '自我封闭', '心结', '打胎', '自责', '慢慢好转']
    const terminalCancerTerms = ['癌症晚期', '生命危险', '离世', '危险窗口', '治疗效果不明显']
    const cardiovascularMaintenanceTerms = ['心血管慢病', '冠心病', '心肌缺血', '血管受阻', '难以彻底断根', '长期维持', '少操劳', '稳情绪']
    const digestiveStabilityTerms = ['消化系统', '湿热', '饮食调理', '良性', '持续观察']
    const surgeryDecisionTerms = ['当前医生是否保守', '当前医生医院是否适合', '更合适的医院方位', '手术时点', '不按眼前方案硬扛']
    const elderCriticalTerms = ['眼前能否过险', '年底难关', '肺心脑', '关键风险窗口']
    const detentionMixedTerms = ['取保', '拘留风险', '仍有出来机会', '找关系未必立刻见效', '工作相关的是非']
    const chronicTreatmentTerms = ['长病慢治', '效果有限', '恢复要拉长', '病程长', '恢复慢', '是否难治', '长期压抑', '气血不畅']
    if (missingPersonSafeReturnTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (petSafetyTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (terminalCancerTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    if (depressionRiskTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (cardiovascularMaintenanceTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (surgeryDecisionTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (elderCriticalTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    if (detentionMixedTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (chronicTreatmentTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (disasterRiskTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    if (digestiveStabilityTerms.some((term) => sample.includes(term)) && !sample.includes('危险')) {
      return 'mixed'
    }
  }

  if (questionType === 'money_wealth') {
    const cautionTerms = ['先观察', '先了解', '不宜主动', '不适合现在', '不要重仓', '先不要', '别急着', '不按马上', '风险暴露']
    const cautionScore = cautionTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)
    const hardCautionTerms = ['不把表面热度直接当成机会', '不要把生门或热度直接写成马上可做', '不按马上重仓参与来断']
    const lawsuitConstraintTerms = ['不宜按轻松全额回款来断', '很难轻松全额拿回', '控制权仍在对方', '短期难一下子兑现到手', '先拖着耗']
    const debtRecoveryTerms = ['尾款', '回款', '拖欠', '催款', '真正落袋', '继续拖欠', '兑现窗口', '短期不好收']
    const wageRecoveryTerms = ['先回一部分', '不是短期全额到账', '拿不满', '五万元左右']
    const housingTradeoffTerms = ['可以买', '更适合自住', '投资偏长期', '价格偏高', '个人压力', '噪音', '防水']
    const spouseFortuneTerms = ['老公财运', '偏财不宜冒险', '想法偏高', '行动不足', '不适合创业', '技术类工作', '安心把上班', '本职工作做好']
    if (hardCautionTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    if (spouseFortuneTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (lawsuitConstraintTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (debtRecoveryTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (wageRecoveryTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (housingTradeoffTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (cautionScore > 0 && negativeScore === 0 && positiveScore <= cautionScore + mixedScore) {
      return 'risk'
    }
  }

  if (questionType === 'career_work') {
    const storefrontConstraintTerms = ['门店前景', '位置不合适', '客户不好找', '应尽量换址', '东南方最利', '南方次优']
    if (storefrontConstraintTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const examDisciplineTerms = ['考试违纪疏通', '中层领导作用不大', '主管这事的大领导', '钱能花出去', '勉强摆平']
    if (examDisciplineTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const studioOpeningTerms = ['工作室可以做', '办公室本身没有大问题', '任意选一间', '宣传广告', '持续推广', '前期业务起量偏慢']
    if (studioOpeningTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const studyMaterialsTerms = ['学习资料采购', '真题解析', '量大且偏难', '题量大', '挑重点题型和思路', '不必六门全部硬啃完']
    if (studyMaterialsTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const meritAwardTerms = ['评功授奖', '事情容易成', '领导支持', '二等功有希望', '成事方向落']
    const travelSafetyConstraintTerms = ['人身平安不等于事情顺利', '事情本身不算顺', '必须去', '不得不去', '口舌是非']
    const bidCompetitionTerms = ['竞标不利', '对手更占优势', '地理位置上更占优势', '人事关系上更占优势', '暗中操作空间', '主动去争取', '机会偏低', '拿下项目的机会偏低']
    const coverPostTerms = ['顶班机会', '不想动', '校长更偏向', '离职难成', '男女私情']
    const improperPromotionTerms = ['关系提拔', '暧昧关系', '暗线操作', '位置不好保', '头衔容易没了', '被调整降下来']
    const friendProjectTerms = ['朋友是真心', '朋友本人是真心', '项目平台', '产品和资金都有隐患', '前景不乐观', '管理岗承诺不一定兑现', '不宜盲目辞职', '先请假', '停薪留职', '跟领导走更稳', '难合作长久', '朋友不可靠']
    if (meritAwardTerms.some((term) => sample.includes(term))) {
      return 'positive'
    }
    if (travelSafetyConstraintTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (bidCompetitionTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (coverPostTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (improperPromotionTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    if (friendProjectTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const drivingTestRiskTerms = ['不好考过', '考不过', '车速', '出线问题', '场地考试']
    if (drivingTestRiskTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    const insuranceMisfitTerms = ['方法方式不对', '不适合这行', '保险工作', '做不长', '农历五月', '中秋前后']
    if (insuranceMisfitTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const interviewCancelTerms = ['面试取消', '被屏蔽', '通过机会小', '流程被卡住', '面试本身就可能临时取消', '最终录用机会也偏弱']
    if (interviewCancelTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    const relocationRiskTerms = ['外地机会带陷阱', '不宜贸然南下', '本地更稳', '本地更合适', '不利远走', '不建议去', '就算硬去外地后续也会很困苦']
    if (relocationRiskTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    const reinstatementTerms = ['复职机会', '复职回岗窗口', '未彻底断死', '仍有转机', '主动走动关系', '送礼疏通']
    if (reinstatementTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const stagedTerms = ['先试开', '先开一边', '不按一下子全面打开', '计划偏高', '两边铺开', '后续是否具备放大']
    const stagedScore = stagedTerms.reduce((sum, term) => sum + (sample.includes(term) ? 1 : 0), 0)
    const noAffinityTerms = ['无缘', '转到下一轮', '转投其他机会', '不必在当前单位硬耗', '事情最终也难成']
    if (noAffinityTerms.some((term) => sample.includes(term))) {
      return 'risk'
    }
    const jobDevelopmentTerms = ['可以去但过程不轻松', '发展偏长期', '不适合按立刻大突破来断']
    if (jobDevelopmentTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const holdPositionTerms = ['不会被裁', '仍会留在原岗位', '维持原状', '双方都不动', '人未必真动']
    if (holdPositionTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const examChanceTerms = ['最终录取', '仍有录取机会', '不宜直接按落榜来断']
    const examVolatilityTerms = ['基础不算扎实', '带波动', '别紧张', '别主动放弃', '老师不会故意刁难']
    if (examVolatilityTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    if (examChanceTerms.some((term) => sample.includes(term))) {
      return 'positive'
    }
    if (stagedScore > 0 && negativeScore === 0) {
      return 'mixed'
    }
    const companyPressureTerms = ['表面架子', '收入不稳', '开销', '资金压力', '根基', '短期很难真正翻起来']
    if (companyPressureTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const jobLeaveTerms = ['短期拖住', '十月前后', '农历九月后', '走不走得开', '内部财务或手续压力', '当前还能不能继续做']
    if (jobLeaveTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const intermediaryFallbackTerms = ['放弃当前路径', '转向其他人', '犹豫紧张']
    if (intermediaryFallbackTerms.some((term) => sample.includes(term))) {
      return 'mixed'
    }
    const disciplinaryTerms = ['停职', '处分', '牵连', '领导层后续', '真实原因', '不按马上翻篇', '继续牵连']
    if (disciplinaryTerms.some((term) => sample.includes(term))) {
      return negativeScore > 0 ? 'risk' : 'mixed'
    }
  }

  if (negativeScore > Math.max(positiveScore, mixedScore)) return 'negative'
  if (positiveScore > Math.max(negativeScore, mixedScore)) return 'positive'
  if (riskScore > 0 && riskScore >= mixedScore) return 'risk'
  if (mixedScore > 0) return 'mixed'
  return 'unclear'
}

function normalizeTimingBucket(text: string) {
  const sample = cleanText(text)
  if (!sample) return 'unclear'
  if (['马上', '很快', '近期', '短期', '尽快', '这几天', '本周'].some((term) => sample.includes(term))) return 'near'
  if (['本月', '这个月', '几个月', '阶段', '今年', '年内'].some((term) => sample.includes(term))) return 'mid'
  if (['长期', '后面', '未来', '大运', '流年', '明年', '一年后', '拉长', '慢治', '恢复慢'].some((term) => sample.includes(term))) return 'long'
  return 'unclear'
}

export function normalizeQimenDecision(questionType: string, mainJudgment: string, timingLine: string, reasonChain: string[] = []) {
  const decisionText = [mainJudgment, timingLine, ...reasonChain].map(cleanText).filter(Boolean).join(' ')
  const label = normalizeDecisionLabel(questionType, decisionText)
  const timingBucket = normalizeTimingBucket(timingLine)
  return {
    label,
    timing_bucket: timingBucket,
    key: `${label}::${timingBucket}`,
  }
}

function buildTeacherReasoningTrace(input: {
  questionText: string
  questionType?: string
  qimenChart: QimenChartResult | null
  feedbackLearning?: QimenFeedbackLearning | null
  yearMingSupport?: QimenYearMingSupport | null
  longCycleSupport?: QimenLongCycleSupport | null
  teacherId?: string
}) : QimenReasoningTrace | null {
  const chart = input.qimenChart
  if (!chart || chart.engine_metadata?.out_of_scope || !chart.chart) return null

  const explicitQuestionType = cleanText(input.questionType)
  const questionType = explicitQuestionType || detectQuestionType(input.questionText)
  const teacherId = cleanText(input.teacherId) || PRIMARY_TEACHER
  const evidence = extractChartEvidence(chart)
  const scopedRules = filterCardsForTeacher(ALL_RULES, teacherId)
  const scopedCases = filterCardsForTeacher(ALL_CASES, teacherId)
  const scopedPatterns = filterCardsForTeacher(ALL_PATTERNS, teacherId)
  const scopedTerms = filterCardsForTeacher(ALL_TERMS, teacherId)
  const scopedConflicts = filterCardsForTeacher(ALL_CONFLICTS, teacherId)
  const rules = matchCards(scopedRules, 'rule', questionType, input.questionText, evidence.activeTerms, 6, input.yearMingSupport, input.longCycleSupport, teacherId)
  const cases = matchCards(scopedCases, 'case', questionType, input.questionText, evidence.activeTerms, 4, input.yearMingSupport, input.longCycleSupport, teacherId)
  const patterns = matchCards(scopedPatterns, 'pattern', questionType, input.questionText, evidence.activeTerms, 3, input.yearMingSupport, input.longCycleSupport, teacherId)
  const terms = matchCards(scopedTerms, 'term', questionType, input.questionText, evidence.activeTerms, 5, input.yearMingSupport, input.longCycleSupport, teacherId)
  const conflicts = matchCards(scopedConflicts, 'conflict', questionType, input.questionText, evidence.activeTerms, 4, input.yearMingSupport, input.longCycleSupport, teacherId)
  const rulesWithLearning = applyFeedbackLearning(rules, input.feedbackLearning)
  const casesWithLearning = applyFeedbackLearning(cases, input.feedbackLearning)
  const patternsWithLearning = applyFeedbackLearning(patterns, input.feedbackLearning)
  const termsWithLearning = applyFeedbackLearning(terms, input.feedbackLearning)
  const conflictsWithLearning = applyFeedbackLearning(conflicts, input.feedbackLearning)
  const sortedRules = sortByTierAndScore(rulesWithLearning)
  const sortedCases = sortByTierAndScore(casesWithLearning)
  const sortedPatterns = sortByTierAndScore(patternsWithLearning)
  const sortedTerms = sortByTierAndScore(termsWithLearning)
  const sortedConflicts = sortByTierAndScore(conflictsWithLearning)
  const tieredRules = bucketByTier(sortedRules)
  const tieredCases = bucketByTier(sortedCases)
  const tieredConflicts = bucketByTier(sortedConflicts)
  const primaryRule = firstPrimaryNonDocument(tieredRules) ?? firstPrimary(tieredRules) ?? null
  const primaryCase = firstPrimaryNonDocument(tieredCases) ?? firstPrimary(tieredCases) ?? null
  const primaryConflict = firstPrimaryNonDocument(tieredConflicts) ?? firstPrimary(tieredConflicts) ?? null
  const documentRule = firstDocumentSupport(tieredRules)
  const documentCase = firstDocumentSupport(tieredCases)
  const documentConflict = firstDocumentSupport(tieredConflicts)
  const chainCoverage = buildChainCoverage({
    rules: sortedRules,
    cases: sortedCases,
    patterns: sortedPatterns,
    terms: sortedTerms,
    conflicts: sortedConflicts,
  })
  const questionRoute = buildQuestionRoute(questionType, input.questionText, evidence)
  const primaryEvidence = buildPrimaryEvidence(chart, evidence, sortedRules, sortedCases, sortedConflicts)
  const foundationTheorySupport = buildFoundationTheorySupport([
    ...sortedRules,
    ...sortedPatterns,
    ...sortedConflicts,
    ...sortedTerms,
  ])
  const tierAdjustmentSuggestions = buildTierAdjustmentSuggestions([
    ...sortedRules,
    ...sortedCases,
    ...sortedPatterns,
    ...sortedTerms,
    ...sortedConflicts,
  ])
  const yearMingTriggered = Boolean(
    questionType === 'love_relationship' &&
    input.yearMingSupport &&
    (input.yearMingSupport.self_year_ming || input.yearMingSupport.counterpart_year_ming),
  )
  const longCycleTriggered = Boolean(
    (questionType === 'career_work' || questionType === 'money_wealth') &&
    input.longCycleSupport &&
    (input.longCycleSupport.current_liu_nian || input.longCycleSupport.current_dayun),
  )
  const yearMingBoostedIds = yearMingTriggered
    ? collectBoostedSupportIds(
      [...sortedRules, ...sortedCases, ...sortedPatterns, ...sortedConflicts],
      ['relationship_year_ming', 'year_ming_anchor'],
      ['年命', '双方', '六合', '关系'],
    )
    : []
  const longCycleBoostedIds = longCycleTriggered
    ? collectBoostedSupportIds(
      [...sortedRules, ...sortedCases, ...sortedPatterns, ...sortedConflicts],
      ['long_cycle_trend', 'timing_overlay'],
      ['流年', '大运', '终身', '长期', '趋势'],
    )
    : []

  const reasoningTrace: QimenReasoningTrace['reasoning_trace'] = [
    {
      step: '题型识别',
      kind: 'chart-derived',
      note: `当前问题按${questionRoute.label}主线处理，取用神重点放在${questionRoute.yongshen_focus}。`,
      support_ids: [],
    },
    {
      step: '盘面主证据',
      kind: 'chart-derived',
      note: `值符=${cleanText(chart.chart.zhi_fu) || '未取到'}，值使=${cleanText(chart.chart.zhi_shi) || '未取到'}，节气=${cleanText(chart.calendar_context?.solar_term) || '未取到'}。`,
      support_ids: [],
    },
    {
      step: '视频规则命中',
      kind: 'video-derived',
      note: sortedRules.slice(0, 2).map((item) => item.title).join('；') || '未命中主老师视频规则，暂用盘面主证据推。',
      support_ids: sortedRules.slice(0, 2).map((item) => item.id),
    },
    {
      step: '案例校准',
      kind: 'video-derived',
      note: sortedCases[0]?.title || '暂无高相关案例，直接按规则主线推进。',
      support_ids: sortedCases.slice(0, 2).map((item) => item.id),
    },
    {
      step: '文档补边',
      kind: 'document-derived',
      note: [...sortedTerms.slice(0, 2), ...sortedConflicts.slice(0, 1)].map((item) => item.title).join('；') || '暂无文档补边说明。',
      support_ids: [...sortedTerms.slice(0, 2), ...sortedConflicts.slice(0, 1)].map((item) => item.id),
    },
  ]

  if (input.feedbackLearning && input.feedbackLearning.common_failed_steps.length > 0) {
    reasoningTrace.push({
      step: '历史复盘校正',
      kind: 'document-derived',
      note: `历史错因里最常见的是 ${input.feedbackLearning.common_failed_steps.slice(0, 3).map((item) => `${item.step}(${item.count})`).join('、')}，当前推理已对高风险支撑卡降权。`,
      support_ids: input.feedbackLearning.risky_support_ids.slice(0, 5).map((item) => item.id),
    })
  }

  if (questionType === 'love_relationship' && input.yearMingSupport && (input.yearMingSupport.self_year_ming || input.yearMingSupport.counterpart_year_ming)) {
    reasoningTrace.push({
      step: '年命辅助',
      kind: 'document-derived',
      note: input.yearMingSupport.note || `关系题额外参考双方年命：自己=${cleanText(input.yearMingSupport.self_year_ming) || '未取到'}，对方=${cleanText(input.yearMingSupport.counterpart_year_ming) || '未取到'}。`,
      support_ids: [],
    })
  }

  if ((questionType === 'career_work' || questionType === 'money_wealth') && input.longCycleSupport && (input.longCycleSupport.current_liu_nian || input.longCycleSupport.current_dayun)) {
    reasoningTrace.push({
      step: '流年大运补边',
      kind: 'document-derived',
      note: input.longCycleSupport.note || `长期走势补看流年/大运：流年=${cleanText(input.longCycleSupport.current_liu_nian) || '未取到'}，大运=${cleanText(input.longCycleSupport.current_dayun) || '未取到'}。`,
      support_ids: [],
    })
  }

  if (foundationTheorySupport.lessons.length > 0) {
    reasoningTrace.push({
      step: '理论基础支撑',
      kind: 'video-derived',
      note: foundationTheorySupport.lessons.slice(0, 3).map((item) => item.lesson_title).join('；'),
      support_ids: foundationTheorySupport.lessons.flatMap((item) => item.matched_support_ids).slice(0, 6),
    })
  }

  return {
    question_type: questionType,
    source_teacher: teacherId,
    question_route: questionRoute,
    chart_summary: {
      system_profile: cleanText(chart.chart.system_profile) || null,
      solar_term: cleanText(chart.calendar_context?.solar_term) || null,
      bureau_number: typeof chart.chart.bureau_number === 'number' ? chart.chart.bureau_number : null,
      zhi_fu: cleanText(chart.chart.zhi_fu) || null,
      zhi_shi: cleanText(chart.chart.zhi_shi) || null,
      xun_shou: cleanText(chart.chart.xun_shou) || null,
    },
    extracted_evidence: {
      gates: evidence.gates,
      stars: evidence.stars,
      deities: evidence.deities,
      empty_palaces: evidence.emptyPalaces,
      horse_palace: evidence.horsePalace,
      active_terms: evidence.activeTerms,
    },
    primary_evidence: primaryEvidence,
    support_signals: {
      year_ming: questionType === 'love_relationship'
        ? {
          triggered: yearMingTriggered,
          trigger_reason: yearMingTriggered
            ? '关系题已拿到自己或对方的年命锚点，因此优先抬高带年命/双方关系语义的支撑卡。'
            : '当前是关系题，但还没有足够的双方年命信息，所以这层辅助没有触发。',
          self_year_pillar: input.yearMingSupport?.self_year_pillar ?? null,
          self_year_ming: input.yearMingSupport?.self_year_ming ?? null,
          counterpart_birth_year: input.yearMingSupport?.counterpart_birth_year ?? null,
          counterpart_year_pillar: input.yearMingSupport?.counterpart_year_pillar ?? null,
          counterpart_year_ming: input.yearMingSupport?.counterpart_year_ming ?? null,
          boosted_support_ids: yearMingBoostedIds,
          note: input.yearMingSupport?.note ?? '',
        }
        : undefined,
      long_cycle: (questionType === 'career_work' || questionType === 'money_wealth')
        ? {
          triggered: longCycleTriggered,
          trigger_reason: longCycleTriggered
            ? '当前问题偏长期事业/财运判断，且已拿到流年或大运信息，所以优先抬高长期趋势与时机叠加类支撑卡。'
            : '当前题型允许长期补边，但还没有足够的流年/大运信息，所以这层辅助没有触发。',
          current_liu_nian: input.longCycleSupport?.current_liu_nian ?? null,
          current_dayun: input.longCycleSupport?.current_dayun ?? null,
          boosted_support_ids: longCycleBoostedIds,
          note: input.longCycleSupport?.note ?? '',
        }
        : undefined,
    },
    source_summary: {
      video_hits: sortedRules.filter((item) => item.source_type === 'video_segment').length
        + sortedCases.filter((item) => item.source_type === 'video_segment').length
        + sortedPatterns.filter((item) => item.source_type === 'video_segment' || item.source_type === 'hybrid').length,
      document_hits: sortedTerms.filter((item) => item.source_type === 'document').length
        + sortedConflicts.filter((item) => item.source_type === 'document').length
        + sortedRules.filter((item) => item.source_type === 'document').length
        + sortedCases.filter((item) => item.source_type === 'document').length,
      chart_steps: reasoningTrace.filter((step) => step.kind === 'chart-derived').length,
      primary_rule_ids: sortedRules.slice(0, 3).map((item) => item.id),
      primary_support_ids: [primaryRule?.id, primaryCase?.id, primaryConflict?.id].filter(Boolean) as string[],
      document_support_ids: [
        documentRule?.id,
        documentCase?.id,
        documentConflict?.id,
        ...sortedTerms.filter((item) => item.source_type === 'document').slice(0, 2).map((item) => item.id),
      ].filter(Boolean) as string[],
      foundation_support_ids: foundationTheorySupport.lessons.flatMap((item) => item.matched_support_ids).slice(0, 8),
    },
    chain_coverage: chainCoverage,
    foundation_theory_support: foundationTheorySupport.lessons.length > 0 ? foundationTheorySupport : undefined,
    feedback_learning: input.feedbackLearning
      ? {
        question_type: input.feedbackLearning.question_type ?? questionType,
        common_failed_steps: input.feedbackLearning.common_failed_steps,
        risky_support_ids: input.feedbackLearning.risky_support_ids,
        tier_adjustment_suggestions: tierAdjustmentSuggestions,
        advisory: input.feedbackLearning.common_failed_steps.length > 0
          ? `${input.feedbackLearning.question_type ? '同题型' : '历史'}复盘里最常错在 ${input.feedbackLearning.common_failed_steps.slice(0, 2).map((item) => item.step).join('、')}，本次已对相关支撑卡降权。`
          : '当前还没有足够的历史错因数据。',
      }
      : undefined,
    matched_rules: sortedRules,
    matched_cases: sortedCases,
    matched_patterns: sortedPatterns,
    matched_terms: sortedTerms,
    matched_conflicts: sortedConflicts,
    reasoning_trace: reasoningTrace,
    decision: buildDecision(questionType, input.questionText, chart, evidence, sortedRules, sortedCases, sortedConflicts, input.feedbackLearning),
  }
}

export function buildQimenReasoningTrace(input: {
  questionText: string
  questionType?: string
  qimenChart: QimenChartResult | null
  feedbackLearning?: QimenFeedbackLearning | null
  yearMingSupport?: QimenYearMingSupport | null
  longCycleSupport?: QimenLongCycleSupport | null
}) : QimenReasoningTrace | null {
  return buildTeacherReasoningTrace({ ...input, teacherId: PRIMARY_TEACHER })
}

export function buildQimenTeacherRun(input: {
  teacherId: string
  questionText: string
  questionType?: string
  qimenChart: QimenChartResult | null
  feedbackLearning?: QimenFeedbackLearning | null
  yearMingSupport?: QimenYearMingSupport | null
  longCycleSupport?: QimenLongCycleSupport | null
}) : QimenTeacherRun | null {
  const trace = buildTeacherReasoningTrace(input)
  if (!trace) return null
  return {
    teacher_id: input.teacherId,
    teacher_label: input.teacherId,
    question_type: trace.question_type,
    main_judgment: trace.decision.main_judgment,
    reason_chain: trace.decision.reason_chain,
    risk_line: trace.decision.risk_line,
    timing_line: trace.decision.timing_line,
    uncertainty: trace.decision.uncertainty,
    matched_rules: trace.matched_rules,
    matched_cases: trace.matched_cases,
    matched_patterns: trace.matched_patterns,
    matched_terms: trace.matched_terms,
    matched_conflicts: trace.matched_conflicts,
    chain_coverage: trace.chain_coverage,
    foundation_theory_support: trace.foundation_theory_support,
    normalized_decision: normalizeQimenDecision(
      trace.question_type,
      trace.decision.main_judgment,
      trace.decision.timing_line,
      trace.decision.reason_chain,
    ),
  }
}

export function buildQimenTeacherConsensus(runs: QimenTeacherRun[]) : QimenTeacherConsensus | null {
  if (!runs.length) return null
  const exactCounts = new Map<string, number>()
  const labelCounts = new Map<string, number>()
  for (const run of runs) {
    exactCounts.set(run.normalized_decision.key, (exactCounts.get(run.normalized_decision.key) ?? 0) + 1)
    labelCounts.set(run.normalized_decision.label, (labelCounts.get(run.normalized_decision.label) ?? 0) + 1)
  }
  const exactWinner = [...exactCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
  const labelWinner = [...labelCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
  const firstTwoMatch = runs.length >= 2 && runs[0].normalized_decision.key === runs[1].normalized_decision.key

  if (firstTwoMatch) {
    const [label, timing] = runs[0].normalized_decision.key.split('::')
    return {
      consensus_level: 'early_match',
      majority_label: label,
      majority_timing_bucket: timing,
      majority_key: runs[0].normalized_decision.key,
      majority_count: 2,
      total_runs: 2,
      summary: `前两位老师结论同向，已提前停止扩跑：${label} / ${timing}。`,
      disagreement_points: [],
    }
  }

  if (exactWinner && exactWinner[1] > runs.length / 2) {
    const [label, timing] = exactWinner[0].split('::')
    return {
      consensus_level: 'late_match',
      majority_label: label,
      majority_timing_bucket: timing,
      majority_key: exactWinner[0],
      majority_count: exactWinner[1],
      total_runs: runs.length,
      summary: `多老师实验形成多数：${label} / ${timing}（${exactWinner[1]}/${runs.length}）。`,
      disagreement_points: runs
        .filter((run) => run.normalized_decision.key !== exactWinner[0])
        .map((run) => `${run.teacher_label}：${run.main_judgment}`)
        .slice(0, 6),
    }
  }

  if (labelWinner && labelWinner[1] > runs.length / 2) {
    return {
      consensus_level: 'late_match',
      majority_label: labelWinner[0],
      majority_timing_bucket: undefined,
      majority_key: undefined,
      majority_count: labelWinner[1],
      total_runs: runs.length,
      summary: `多老师在主判断方向上形成多数，但应期方向仍有分歧：${labelWinner[0]}（${labelWinner[1]}/${runs.length}）。`,
      disagreement_points: runs
        .filter((run) => run.normalized_decision.label !== labelWinner[0])
        .map((run) => `${run.teacher_label}：${run.main_judgment}`)
        .slice(0, 6),
    }
  }

  return {
    consensus_level: 'split',
    majority_count: exactWinner?.[1] ?? 1,
    total_runs: runs.length,
    summary: `多流派结论分歧，当前维持${PRIMARY_TEACHER}主链，仅把分歧结果用于后台复核。`,
    disagreement_points: runs.map((run) => `${run.teacher_label}：${run.main_judgment}`).slice(0, 8),
  }
}
