import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { DateTime } from 'npm:luxon@3.5.0'

import {
  type CurrentFlow,
  type ResolvedLocation,
  calculateCurrentFlowAtInstant,
} from '../_shared/chart-engine.ts'
import { ensurePublicUserRow } from '../_shared/ensure-public-user.ts'
import {
  type QimenInput,
  calculateQimen,
} from '../_shared/qimen-engine.ts'
import {
  type QimenFeedbackLearning,
  type QimenReasoningTrace,
  type QimenTeacherConsensus,
  type QimenTeacherRun,
  getQimenGrayTeacherOrder,
  getSecondaryTeacherCoverageOrder,
  QIMEN_PRIMARY_TEACHER,
  QIMEN_SECONDARY_TEACHER_PRIORITY,
  buildQimenTeacherConsensus,
  buildQimenTeacherRun,
  buildQimenReasoningTrace,
  detectQuestionType,
  detectQuestionTypeWithScore,
  shouldRunQimenGrayTeachers,
} from '../_shared/qimen-reasoning-engine.ts'
import { buildQimenFeedbackInvitePolicy } from '../_shared/qimen-feedback-policy.ts'

const COIN_COSTS: Record<string, number> = {
  deep: 5,
  quick: 2,
  followup: 1,
}

const DIVINATION_SYSTEMS = ['bazi', 'qimen_yang'] as const
type DivinationSystem = typeof DIVINATION_SYSTEMS[number]
type QimenChartResult = Awaited<ReturnType<typeof calculateQimen>>

type StoredProfile = {
  timezone?: string | null
  intent?: string | null
  language?: string | null
}

type StoredChart = {
  chart_text?: string
  pillars?: {
    year?: string
    month?: string
    day?: string
    hour?: string
  }
  analysis?: {
    dayMaster?: {
      element?: string
      stem?: string
    }
    fiveElements?: Record<string, number>
    weakElement?: string
    strongElement?: string
    favorableElement?: string
    unfavorableElement?: string
    dayun?: {
      cycles?: Array<{
        ganZhi?: string
        displayAge?: string
      }>
    }
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

type ReadingContext = {
  questionText: string
  category: string
  questionKind: string
  divinationSystem: DivinationSystem
  profile?: StoredProfile | null
  chart?: StoredChart | null
  parentQuestionText?: string | null
  parentAnswerText?: string | null
  currentFlow?: CurrentFlow | null
  qimenChart?: QimenChartResult | null
  qimenReasoning?: QimenReasoningTrace | null
  qimenVectorHint?: string | null
}

type QimenVectorMatch = {
  chunk_id: string
  document_id: string
  title: string
  language_code: string
  content: string
  canonical_url: string
  metadata?: Record<string, unknown> | null
  similarity: number
}

type ClarificationResult = {
  reason: string
  prompt: string
  requested_fields: string[]
}

type TeacherScoreRow = {
  teacher_id: string
  question_type: string
  score?: number | null
  status?: string | null
}

async function loadQimenFeedbackLearning(supabase: any, questionType?: string | null): Promise<QimenFeedbackLearning> {
  const result = await supabase
    .from('qimen_outcome_feedback')
    .select('verdict,failed_step,failed_support_id,question_type')
    .in('verdict', ['partially_matched', 'missed'])
    .limit(1000)

  if (result.error || !Array.isArray(result.data)) {
    return {
      question_type: questionType ?? undefined,
      common_failed_steps: [],
      risky_support_ids: [],
    }
  }

  const allRows = result.data as Array<Record<string, unknown>>
  const scopedRows = questionType
    ? allRows.filter((row) => cleanString(row.question_type) === questionType)
    : allRows
  const rows = scopedRows.length > 0 ? scopedRows : allRows

  const stepCounts = new Map<string, number>()
  const supportCounts = new Map<string, number>()

  for (const row of rows) {
    const failedStep = cleanString(row.failed_step)
    const failedSupportId = cleanString(row.failed_support_id)
    if (failedStep) {
      stepCounts.set(failedStep, (stepCounts.get(failedStep) ?? 0) + 1)
    }
    if (failedSupportId) {
      supportCounts.set(failedSupportId, (supportCounts.get(failedSupportId) ?? 0) + 1)
    }
  }

  return {
    question_type: scopedRows.length > 0 ? questionType ?? undefined : undefined,
    common_failed_steps: Array.from(stepCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([step, count]) => ({ step, count })),
    risky_support_ids: Array.from(supportCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id, count]) => ({ id, count })),
  }
}

async function loadQimenTeacherOrder(supabase: any, questionType: string) {
  const fallback = getSecondaryTeacherCoverageOrder(questionType)
  const staticFallback = QIMEN_SECONDARY_TEACHER_PRIORITY[questionType] ?? []
  const result = await supabase
    .from('qimen_teacher_question_type_scores')
    .select('teacher_id,question_type,score,status')
    .eq('question_type', questionType)

  if (result.error || !Array.isArray(result.data)) return [...fallback, ...staticFallback].filter((value, index, arr) => value && arr.indexOf(value) === index)

  const statusRank = (status: string | null | undefined) =>
    status === 'active' ? 0 : status === 'downranked' ? 1 : 2

  const ranked = (result.data as TeacherScoreRow[])
    .filter((row) => cleanString(row.teacher_id) && cleanString(row.teacher_id) !== QIMEN_PRIMARY_TEACHER)
    .sort((a, b) => {
      const statusDiff = statusRank(cleanString(a.status) ?? 'active') - statusRank(cleanString(b.status) ?? 'active')
      if (statusDiff !== 0) return statusDiff
      return Number(b.score ?? 0) - Number(a.score ?? 0)
    })
    .map((row) => cleanString(row.teacher_id) as string)

  const merged = [...ranked, ...fallback, ...staticFallback].filter((value, index, arr) => value && arr.indexOf(value) === index)
  return merged
}

function mergeTeacherExperimentIntoTrace(
  trace: QimenReasoningTrace | null,
  teacherRuns: QimenTeacherRun[],
  consensus: QimenTeacherConsensus | null,
): QimenReasoningTrace | null {
  if (!trace) return null
  const majorityKey = cleanString(consensus?.majority_key)
  const majorityLabel = cleanString(consensus?.majority_label)
  return {
    ...trace,
    teacher_runs: teacherRuns.map((run) => ({
      ...run,
      agrees_with_majority: majorityKey
        ? run.normalized_decision.key === majorityKey
        : majorityLabel
          ? run.normalized_decision.label === majorityLabel
          : false,
    })),
    consensus_level: consensus?.consensus_level,
    consensus_majority_key: majorityKey ?? undefined,
    consensus_summary: consensus?.summary,
    disagreement_points: consensus?.disagreement_points ?? [],
  }
}

type DayMasterProfile = {
  labelZh: string
  coreTraits: string[]
  strengths: string[]
  watchouts: string[]
}

type ElementKnowledge = {
  whenMainline: string[]
  whenBackground: string[]
  deficiencySignals: string[]
  restoringActions: string[]
}

type KnowledgeRule = {
  id: string
  claim: string
  interpretation: string
  reasoningPath?: string[]
  branchConditions?: string[]
  productSafeAdvice?: string[]
}

type CategoryKnowledge = {
  sharedNodes: string[]
  rules: KnowledgeRule[]
}

const SHARED_REASONING_NODES: Record<string, string> = {
  mainline_vs_interference:
    'separate the long-term mainline from side noise before landing on a conclusion',
  structure_formed_vs_unformed:
    'check whether the pattern is truly formed before applying the stronger method',
  ownership_and_access:
    'distinguish what is truly yours to use from what is visible but not fully controllable',
  completion_and_efficiency:
    'judge whether the action actually reaches the target and completes the loop',
  timing_scheduler:
    'separate stage background from short-term triggering instead of compressing everything into one moment',
  root_and_source:
    'check whether the signal has real backing, source, and staying power',
  internal_vs_external_domain:
    'separate what sits in your controllable inner domain from what remains outside you',
  body_damage_vs_use_damage:
    'separate damage to the core self from damage to the external function line before naming the consequence',
}

const DAY_MASTER_PROFILES: Record<string, DayMasterProfile> = {
  甲: {
    labelZh: '甲木',
    coreTraits: ['direct', 'growth-oriented', 'protective'],
    strengths: ['initiative', 'vision'],
    watchouts: ['rigidity', 'overextension'],
  },
  乙: {
    labelZh: '乙木',
    coreTraits: ['adaptable', 'refined', 'sensitive'],
    strengths: ['relationship awareness', 'creativity'],
    watchouts: ['hesitation', 'emotional drift'],
  },
  丙: {
    labelZh: '丙火',
    coreTraits: ['expressive', 'visible', 'energetic'],
    strengths: ['motivation', 'leadership'],
    watchouts: ['impulsiveness', 'ego heat'],
  },
  丁: {
    labelZh: '丁火',
    coreTraits: ['refined', 'perceptive', 'warm in a focused way'],
    strengths: ['taste', 'precision'],
    watchouts: ['fragility under pressure', 'mood swings'],
  },
  戊: {
    labelZh: '戊土',
    coreTraits: ['steady', 'protective', 'load-bearing'],
    strengths: ['reliability', 'containment'],
    watchouts: ['stubbornness', 'heaviness'],
  },
  己: {
    labelZh: '己土',
    coreTraits: ['careful', 'nurturing', 'detail-attentive'],
    strengths: ['maintenance', 'practical care'],
    watchouts: ['overworry', 'self-burdening'],
  },
  庚: {
    labelZh: '庚金',
    coreTraits: ['decisive', 'straightforward', 'hard-edged'],
    strengths: ['execution', 'boundary-setting'],
    watchouts: ['bluntness', 'conflict tendency'],
  },
  辛: {
    labelZh: '辛金',
    coreTraits: ['precise', 'selective', 'high-standard'],
    strengths: ['discernment', 'quality control'],
    watchouts: ['over-criticism', 'distance'],
  },
  壬: {
    labelZh: '壬水',
    coreTraits: ['broad-minded', 'adaptive', 'strategic'],
    strengths: ['vision', 'range'],
    watchouts: ['drift', 'inconsistency'],
  },
  癸: {
    labelZh: '癸水',
    coreTraits: ['subtle', 'intuitive', 'internally observant'],
    strengths: ['insight', 'empathy'],
    watchouts: ['withdrawal', 'overthinking'],
  },
}

const ELEMENT_KNOWLEDGE: Record<'wood' | 'fire' | 'earth' | 'metal' | 'water', ElementKnowledge> = {
  wood: {
    whenMainline: ['growth pressure defines the whole situation'],
    whenBackground: ['supports planning but does not decide the outcome'],
    deficiencySignals: ['stagnation', 'low initiative', 'indecision'],
    restoringActions: ['break large goals into clear steps', 'pair initiative with feedback'],
  },
  fire: {
    whenMainline: ['visibility, speed, and conviction define the whole situation'],
    whenBackground: ['adds momentum without fully deciding the outcome'],
    deficiencySignals: ['low drive', 'hesitant action', 'muted confidence'],
    restoringActions: ['move one visible priority forward', 'reduce mixed signals before acting'],
  },
  earth: {
    whenMainline: ['stability, carrying capacity, and structure define the whole situation'],
    whenBackground: ['acts as support and containment for a stronger mainline'],
    deficiencySignals: ['instability', 'poor recovery', 'difficulty holding pressure'],
    restoringActions: ['simplify schedule', 'reduce overload before expanding again'],
  },
  metal: {
    whenMainline: ['clarity, standards, and decision quality define the whole situation'],
    whenBackground: ['supports judgment without becoming the main story'],
    deficiencySignals: ['fuzzy boundaries', 'second-guessing', 'weak follow-through on standards'],
    restoringActions: ['cut one low-value obligation', 'name the actual decision before acting'],
  },
  water: {
    whenMainline: ['timing, signal-reading, and adaptive movement define the whole situation'],
    whenBackground: ['supports intuition and flexibility for another stronger line'],
    deficiencySignals: ['drift', 'energy scatter', 'difficulty containing uncertainty'],
    restoringActions: ['slow the pace', 'gather one more layer of signal before committing'],
  },
}

const CATEGORY_KNOWLEDGE: Record<string, CategoryKnowledge> = {
  career_work: {
    sharedNodes: ['mainline_vs_interference', 'structure_formed_vs_unformed', 'completion_and_efficiency'],
    rules: [
      {
        id: 'wenzeng-rule-career-talent-mapping-001',
        claim:
          'Career reading should start with talent, five-element quality, and behavioural style before forcing an industry label.',
        interpretation:
          'The system should first ask what kind of ability actually makes this person effective, then decide which work environment lets that ability compound.',
        productSafeAdvice: [
          'Translate this into your natural advantage and the kind of path that feels easier to sustain.',
        ],
      },
      {
        id: 'wenzeng-rule-career-structure-break-loss-001',
        claim:
          'Career loss happens when the underlying work structure or earning model is being broken, not only when money feels tight for a short period.',
        interpretation:
          'This rule is less about one bad week and more about whether the path itself is still structurally viable.',
        reasoningPath: [
          'Locate the work structure and the ability structure.',
          'Check whether the earning path is being damaged, reversed, or cut off.',
          'Only then decide whether this is a temporary dip or a structural break.',
        ],
        branchConditions: [
          'If the structure is still intact, do not escalate a short wobble into a collapse story.',
        ],
        productSafeAdvice: ['Reduce leakage and protect the part of the path that still compounds.'],
      },
    ],
  },
  money_wealth: {
    sharedNodes: ['ownership_and_access', 'completion_and_efficiency', 'mainline_vs_interference'],
    rules: [
      {
        id: 'wenzeng-rule-bijie-controls-wealth-ownership-001',
        claim:
          'Money is not just about seeing value. It is about ownership, control, and whether the resource is truly yours to call.',
        interpretation:
          'The question is not only “can money be made,” but “is this a clean, controllable, properly owned path to value.”',
        reasoningPath: [
          'First separate what belongs to you from what only looks reachable.',
          'Then compare who actually controls the resource.',
          'Only then decide whether this is clean gain, conflict, or leakage.',
        ],
        branchConditions: [
          'If ownership is unclear, the reading should move toward risk control before expansion.',
        ],
        productSafeAdvice: ['Treat unclear ownership and blurred resource boundaries as a caution signal.'],
      },
      {
        id: 'wenzeng-rule-wealth-health-position-001',
        claim:
          'A wealth rise can come with health cost if the same structure that produces gain is also carrying body-level pressure.',
        interpretation:
          'The product should not treat money growth and physical cost as unrelated lines when the same load-bearing structure is being used for both.',
        productSafeAdvice: ['If gain and strain rise together, slow the expansion tempo and protect recovery.'],
      },
    ],
  },
  love_relationship: {
    sharedNodes: ['mainline_vs_interference', 'internal_vs_external_domain', 'timing_scheduler'],
    rules: [
      {
        id: 'wenzeng-rule-marriage-stars-and-lines-001',
        claim:
          'Relationship reading begins by identifying the partner line and how that line actually enters your inner structure.',
        interpretation:
          'The key is not just “is there a bond,” but whether the connection has truly entered the core line of life and interaction.',
        productSafeAdvice: ['Read consistency and emotional entry into your life, not chemistry alone.'],
      },
      {
        id: 'wenzeng-rule-marriage-competition-and-divorce-001',
        claim:
          'Third-party pressure and relationship instability are read through a triangular competition model, not through one symbol alone.',
        interpretation:
          'A relationship becomes unstable when attention, access, or commitment is being meaningfully pulled away from the core line.',
        branchConditions: [
          'Do not escalate one contact or one attraction signal into a third-party conclusion without a real competing line.',
        ],
        productSafeAdvice: ['Where boundaries feel loose, move slowly and confirm patterns before naming outcomes.'],
      },
    ],
  },
  marriage_family: {
    sharedNodes: ['timing_scheduler', 'mainline_vs_interference', 'internal_vs_external_domain'],
    rules: [
      {
        id: 'wenzeng-rule-marriage-timing-and-matching-001',
        claim:
          'Relationship existence, relationship fit, and relationship landing are three different layers and should not be collapsed into one answer.',
        interpretation:
          'A bond can exist without being mature enough to land. Timing and fit have to be read separately.',
        reasoningPath: [
          'Check whether the bond itself is truly established.',
          'Then check whether fit and execution conditions are aligned.',
          'Only then land on timing or commitment advice.',
        ],
        productSafeAdvice: ['If fit and timing conflict, prefer observation and communication over forcing a conclusion.'],
      },
      {
        id: 'wenzeng-rule-parent-star-location-001',
        claim:
          'Family reading must locate where the parent-support line and elder-pressure line are sitting before naming the burden.',
        interpretation:
          'Support, pressure, and family obligation often come from different lines and should not be collapsed into one emotional story.',
        productSafeAdvice: ['Translate family themes into support, pressure, or obligation rather than absolute fate language.'],
      },
    ],
  },
  health_energy: {
    sharedNodes: ['body_damage_vs_use_damage', 'root_and_source', 'timing_scheduler'],
    rules: [
      {
        id: 'wenzeng-rule-health-body-vs-yong-001',
        claim:
          'Health reading starts by separating damage to the core self from damage to the external function line.',
        interpretation:
          'Some pressure mainly hits work or resources. Other pressure lands on the body itself. The reading has to separate those first.',
        reasoningPath: [
          'Check whether the damaged line is body-level or function-level.',
          'Then check whether external pressure is being pulled directly onto the self.',
          'Only then land on body risk, work cost, or mixed burden.',
        ],
        productSafeAdvice: ['Describe this as body strain and recovery pressure, not as a diagnosis.'],
      },
      {
        id: 'wenzeng-rule-health-severity-thresholds-001',
        claim:
          'Health risk should be graded by pressure level and trigger type rather than by dramatic prediction.',
        interpretation:
          'The important question is whether this is a mild drain, a recovery warning, or a genuinely elevated risk window.',
        branchConditions: [
          'If the core root is still intact, keep the reading at a lower-risk interpretation.',
        ],
        productSafeAdvice: ['When recovery looks weak, lower risk-taking and restore routine first.'],
      },
    ],
  },
  timing_decisions: {
    sharedNodes: ['timing_scheduler', 'mainline_vs_interference', 'structure_formed_vs_unformed'],
    rules: [
      {
        id: 'wenzeng-rule-fortune-cycle-reading-001',
        claim:
          'Stage background and short-term trigger are different layers; do not compress an entire decision into one short timing signal.',
        interpretation:
          'The better read is: what long-cycle theme is active, and what short-cycle event is triggering it right now.',
        productSafeAdvice: ['If the background is still forming, use timing for pacing, not for forcing certainty.'],
      },
      {
        id: 'wenzeng-rule-yongshen-mainline-vs-interference-001',
        claim:
          'When signals conflict, hold the mainline first and downgrade the rest to interference or stage-specific noise.',
        interpretation:
          'Complexity does not mean there is no answer. It means the answer has to be ranked by priority.',
        productSafeAdvice: ['Protect the long-term line first, then decide whether short-term signals deserve action.'],
      },
    ],
  },
  study_exams: {
    sharedNodes: ['structure_formed_vs_unformed', 'completion_and_efficiency', 'root_and_source'],
    rules: [
      {
        id: 'wenzeng-rule-study-signals-001',
        claim:
          'Study questions should separate learning state from long-term academic carrying power.',
        interpretation:
          'One line explains whether the material is going in cleanly; another explains whether the structure can hold long-term achievement.',
        reasoningPath: [
          'Separate learning-state signals from carrying-power signals.',
          'Check which line is being interrupted.',
          'Only then decide whether the issue is performance fluctuation or a longer academic constraint.',
        ],
        productSafeAdvice: ['Turn this into focus strategy and pacing advice rather than a fixed ceiling.'],
      },
      {
        id: 'wenzeng-rule-yongshen-decoding-order-001',
        claim:
          'Do not let one bright local signal override the actual order of reading.',
        interpretation:
          'The correct answer often comes from sequence and priority, not from whichever symbol looks best first.',
        productSafeAdvice: ['Use the strongest educational signal only after the main structure has been verified.'],
      },
    ],
  },
  children_parenting: {
    sharedNodes: ['internal_vs_external_domain', 'root_and_source', 'mainline_vs_interference'],
    rules: [
      {
        id: 'wenzeng-rule-child-line-001',
        claim:
          'Children and parenting questions should separate the existence of the child line from timing, number, bond quality, and developmental outcome.',
        interpretation:
          'This topic should not be reduced to one symbol. Different layers describe different family realities.',
        productSafeAdvice: ['Translate this into family extension, parenting focus, and patience with timing rather than certainty claims.'],
      },
      {
        id: 'wenzeng-rule-parent-star-location-001',
        claim:
          'Family support and family burden need to be located before interpreting the pressure.',
        interpretation:
          'Some family questions are about support quality, others are about inherited pressure or responsibility.',
        productSafeAdvice: ['Where the signal is uncertain, lead with patience and observation rather than hard judgment.'],
      },
    ],
  },
  travel_relocation: {
    sharedNodes: ['timing_scheduler', 'internal_vs_external_domain', 'completion_and_efficiency'],
    rules: [
      {
        id: 'wenzeng-rule-travel-logic-001',
        claim:
          'Movement is read through actual activation and distance layers, not through memorized direction slogans.',
        interpretation:
          'The key question is whether something is truly being moved and whether that movement is near-field or far-field.',
        reasoningPath: [
          'Check whether movement is genuinely activated.',
          'Separate near movement from far movement.',
          'Only then decide whether this is a short adjustment or a larger relocation trend.',
        ],
        productSafeAdvice: ['Use this as a mobility and transition signal, not as an absolute location prophecy.'],
      },
      {
        id: 'wenzeng-rule-fortune-cycle-reading-001',
        claim:
          'Timing still needs a stage background before a move can be interpreted correctly.',
        interpretation:
          'A move can be impulsive noise or a real stage shift depending on the longer cycle underneath it.',
        productSafeAdvice: ['If the stage background is unclear, avoid making the move purely as an escape reaction.'],
      },
    ],
  },
  home_property: {
    sharedNodes: ['ownership_and_access', 'root_and_source', 'timing_scheduler'],
    rules: [
      {
        id: 'wenzeng-rule-property-logic-001',
        claim:
          'Home and property should be read through carrying structure, timing, and asset change; buying, selling, and moving are not the same signal.',
        interpretation:
          'Property questions should separate living structure from asset structure and then decide which one is actually active.',
        reasoningPath: [
          'Check whether the chart is carrying a real property theme.',
          'Then separate home upgrade, property transaction, and relocation.',
          'Only then decide whether the move is supportive or over-stretched.',
        ],
        productSafeAdvice: ['Translate this into space stability, housing change, or property timing rather than one fixed verdict.'],
      },
      {
        id: 'wenzeng-rule-wealth-health-position-001',
        claim:
          'Asset growth should be checked against the load it puts on the rest of life.',
        interpretation:
          'A property win that weakens the whole life structure is not a clean gain.',
        productSafeAdvice: ['If the asset move raises pressure everywhere else, lower aggression and protect flexibility.'],
      },
    ],
  },
}

function cleanString(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
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

function buildCurrentFlowFromStoredChart(chart: StoredChart | null | undefined) {
  const timing = chart?.analysis?.timing
  const dayStem = cleanString(chart?.analysis?.dayMaster?.stem)
  const timezone = cleanString(timing?.timezone)
  const location = timing?.location
  const latitude = typeof location?.latitude === 'number' ? location.latitude : null
  const longitude = typeof location?.longitude === 'number' ? location.longitude : null

  if (!dayStem || !timezone || latitude == null || longitude == null) {
    return null
  }

  const resolvedLocation: ResolvedLocation = {
    queryKey: '',
    normalizedName: cleanString(location?.normalizedName) ?? 'Saved birth place',
    country: cleanString(location?.country),
    region: cleanString(location?.region),
    latitude,
    longitude,
    timezone,
    source: location?.source ?? 'input',
  }

  try {
    return calculateCurrentFlowAtInstant(DateTime.utc(), resolvedLocation, dayStem)
  } catch {
    return null
  }
}

function resolveQimenInput(
  body: Record<string, unknown>,
  profile: StoredProfile | null | undefined,
  chart: StoredChart | null | undefined,
): QimenInput | null {
  const timing = chart?.analysis?.timing
  const timezone =
    cleanString(body.timezone) ??
    cleanString(profile?.timezone) ??
    cleanString(timing?.timezone)

  if (!timezone) {
    return null
  }

  const submittedAt = cleanString(body.submitted_at) ??
    DateTime.now().setZone(timezone).toFormat("yyyy-LL-dd'T'HH:mm:ss")
  const systemProfileRaw = cleanString(body.qimen_system_profile)?.toLowerCase()
  const systemProfile = systemProfileRaw === 'zhi_run' ? 'zhi_run' : 'chai_bu'

  return {
    submitted_at: submittedAt,
    timezone,
    system_profile: systemProfile,
  }
}

function yearPillarFromGregorianYear(year: number) {
  if (!Number.isFinite(year) || year < 1864 || year > 2100) return null
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
  const offset = year - 1984
  const stem = stems[((offset % 10) + 10) % 10]
  const branch = branches[((offset % 12) + 12) % 12]
  return `${stem}${branch}`
}

function extractRelevantBirthYear(questionText: string, parentQuestionText?: string | null) {
  const source = `${questionText} ${parentQuestionText ?? ''}`
  const matches = Array.from(source.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((item) => Number(item[1]))
  if (matches.length === 0) return null
  const distinct = Array.from(new Set(matches))
  return distinct[distinct.length - 1] ?? null
}

function buildQimenYearMingSupport(
  category: string,
  questionText: string,
  parentQuestionText: string | null | undefined,
  chart: StoredChart | null | undefined,
) {
  const selfYearPillar = cleanString(chart?.pillars?.year)
  const selfYearMing = selfYearPillar ? selfYearPillar[0] : null
  if (category !== 'love_relationship' && category !== 'marriage_family') {
    return selfYearPillar || selfYearMing ? {
      self_year_pillar: selfYearPillar,
      self_year_ming: selfYearMing,
      note: selfYearMing ? `当前保留求测人年命 ${selfYearMing} 作为人物锚点。` : '当前未提取到明确年命锚点。',
    } : null
  }

  const counterpartBirthYear = extractRelevantBirthYear(questionText, parentQuestionText)
  const counterpartYearPillar = counterpartBirthYear ? yearPillarFromGregorianYear(counterpartBirthYear) : null
  const counterpartYearMing = counterpartYearPillar ? counterpartYearPillar[0] : null

  if (!selfYearMing && !counterpartYearMing) return null
  return {
    self_year_pillar: selfYearPillar,
    self_year_ming: selfYearMing,
    counterpart_birth_year: counterpartBirthYear,
    counterpart_year_pillar: counterpartYearPillar,
    counterpart_year_ming: counterpartYearMing,
    note: counterpartYearMing
      ? `关系题补看双方年命：自己年命 ${selfYearMing ?? '未取到'}，对方按出生年 ${counterpartBirthYear} 近似取年命 ${counterpartYearMing}。`
      : `当前只有求测人年命 ${selfYearMing ?? '未取到'}，对方年命未补齐，关系判断仍以奇门主线为主。`,
  }
}

function buildQimenLongCycleSupport(
  category: string,
  currentFlow: CurrentFlow | null | undefined,
  chart: StoredChart | null | undefined,
) {
  if (category !== 'career_work' && category !== 'money_wealth') return null
  const currentLiuNian = cleanString(currentFlow?.liuNian?.pillar)
  const currentDayun = cleanString(chart?.analysis?.dayun?.cycles?.[0]?.ganZhi)
  if (!currentLiuNian && !currentDayun) return null
  return {
    current_liu_nian: currentLiuNian,
    current_dayun: currentDayun,
    note: currentDayun
      ? `这类长期题额外补看流年 ${currentLiuNian ?? '未取到'} 和当前大运 ${currentDayun} 的大背景，不只看眼前一盘。`
      : `这类长期题至少补看当前流年 ${currentLiuNian ?? '未取到'} 的长期背景。`,
  }
}

function qimenSignalPack(chart: QimenChartResult | null | undefined) {
  if (!chart || chart.engine_metadata?.out_of_scope || !chart.chart) return null

  const zhiShi = cleanString(chart.chart.zhi_shi)
  const zhiFu = cleanString(chart.chart.zhi_fu)
  const zhiFuHint = cleanString(chart.value_summary?.zhi_fu)
  const zhiShiHint = cleanString(chart.value_summary?.zhi_shi)
  const kongWang = Array.isArray(chart.markers?.kong_wang)
    ? chart.markers.kong_wang.filter(Boolean).join('、')
    : ''
  const horsePalace = cleanString(chart.markers?.horse_star?.label)

  const gateTone: Record<string, { opening: string; caution: string; action: string }> = {
    开门: {
      opening: 'The timing is open enough to act, but it still rewards precision over impulse.',
      caution: 'The risk is overcommitting too fast because the opening feels cleaner than usual.',
      action: 'Move on the clearest path first and keep the plan simple.',
    },
    生门: {
      opening: 'This timing supports growth, repair, and building something that can keep feeding you.',
      caution: 'The risk is trying to grow too many branches before the root is stable.',
      action: 'Feed the part that is already alive and let momentum build from there.',
    },
    休门: {
      opening: 'This timing favors recovery, consolidation, and moving with less friction.',
      caution: 'The risk is mistaking a consolidation window for a sign to stop completely.',
      action: 'Use the calmer opening to strengthen your position before pushing harder.',
    },
    景门: {
      opening: 'Visibility and presentation matter more than usual right now.',
      caution: 'The risk is letting appearance outrun substance.',
      action: 'Show the strongest part clearly and keep the underlying structure honest.',
    },
    杜门: {
      opening: 'This is a tighter, more closed timing. It is better for protection and filtering than for brute-force expansion.',
      caution: 'The risk is getting stuck in hesitation or silence when a small move is still possible.',
      action: 'Reduce noise, cut weak branches, and only move on what is genuinely necessary.',
    },
    伤门: {
      opening: 'The timing carries friction. Progress is possible, but it asks for toughness and controlled force.',
      caution: 'The risk is conflict, impatience, or damage caused by pushing too directly.',
      action: 'Choose the move that protects leverage instead of the move that only vents frustration.',
    },
    惊门: {
      opening: 'This timing is reactive and jumpy. It can bring sudden news or pressure to decide quickly.',
      caution: 'The risk is acting from shock, fear, or unfinished information.',
      action: 'Slow the nervous system down first, then decide what still matters once the dust settles.',
    },
    死门: {
      opening: 'This is not the cleanest window for expansion. It is better for ending, withdrawing, or refusing what is already exhausted.',
      caution: 'The risk is pouring more life into something that is no longer structurally alive.',
      action: 'Close the drain, clear the dead weight, and wait for a cleaner opening before forcing growth.',
    },
  }

  const starTone: Record<string, string> = {
    天心: 'Clear judgment is available if you stay objective.',
    天任: 'Steadiness and carrying capacity are stronger than they first appear.',
    天辅: 'Strategy, preparation, and guidance help more than speed.',
    天冲: 'The energy wants movement, but direction matters more than force.',
    天蓬: 'The undercurrent is strong; read motives and risk carefully.',
    天芮: 'Repair, burden, or weak spots need attention before expansion.',
    天柱: 'The pattern carries tension and resistance; timing and attitude matter.',
    天英: 'Exposure and expression are amplified; signal quality matters.',
    天禽: 'The center of the matter is integration, not one isolated move.',
  }

  const defaultTone = gateTone[zhiShi ?? ''] ?? {
    opening: 'The timing is mixed. There is movement available, but only if you rank the signals correctly.',
    caution: 'The risk is letting noise pretend to be the main story.',
    action: 'Separate the strongest line from the rest before deciding.',
  }

  return {
    zhiShi,
    zhiFu,
    zhiFuHint,
    zhiShiHint,
    kongWang,
    horsePalace,
    opening: defaultTone.opening,
    caution: defaultTone.caution,
    action: defaultTone.action,
    starText: zhiFu ? (starTone[zhiFu] ?? '') : '',
  }
}

async function embedQueryWithQwen(text: string): Promise<number[] | null> {
  const apiKey = cleanString(Deno.env.get('DASHSCOPE_API_KEY'))
  if (!apiKey) return null

  const response = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-v4',
      input: [text],
      dimensions: 1536,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  const data = Array.isArray(payload?.data) ? payload?.data as Array<Record<string, unknown>> : []
  const first = data[0]
  const embedding = Array.isArray(first?.embedding) ? first.embedding as number[] : null
  return embedding && embedding.length > 0 ? embedding : null
}

async function fetchQimenVectorMatches(
  supabase: any,
  questionText: string,
  questionType: string | null,
): Promise<QimenVectorMatch[]> {
  try {
    const queryEmbedding = await embedQueryWithQwen(questionText)
    if (!queryEmbedding) return []

    const basePayload = {
      query_embedding: queryEmbedding,
      match_count: 12,
      filter_scope: 'qimen',
      filter_language_code: 'zh',
      filter_question_type: questionType,
      filter_collection: 'cards',
    }

    const firstAttempt = await supabase.rpc('match_document_chunks', {
      ...basePayload,
      dedupe_by_title: true,
    })
    if (!firstAttempt.error && Array.isArray(firstAttempt.data)) {
      return firstAttempt.data as QimenVectorMatch[]
    }

    const secondAttempt = await supabase.rpc('match_document_chunks', basePayload)
    if (!secondAttempt.error && Array.isArray(secondAttempt.data)) {
      const deduped: QimenVectorMatch[] = []
      const seenTitles = new Set<string>()
      for (const raw of secondAttempt.data as QimenVectorMatch[]) {
        const title = cleanString(raw.title)
        if (!title || seenTitles.has(title)) continue
        seenTitles.add(title)
        deduped.push(raw)
        if (deduped.length >= 5) break
      }
      return deduped
    }
  } catch (_error) {
    return []
  }
  return []
}

function buildQimenVectorHint(category: string, questionText: string, matches: QimenVectorMatch[]) {
  const top = matches[0]
  if (!top) return null

  const lower = questionText.toLowerCase()
  const title = `${top.title} ${top.content}`.toLowerCase()

  if (category === 'money_wealth' && /(stock|stocks|trading|portfolio|account|fund|etf|shares|equity|crypto|bitcoin|加仓|股票|账户|基金|仓位)/.test(lower)) {
    if (title.includes('冲突')) {
      return 'Closest matching references treat this as a mixed-signal position: protect downside first and only add if the existing position is already proving itself.'
    }
    if (title.includes('兑现')) {
      return 'Closest matching references say to back only what can convert into real results, not what merely looks active.'
    }
    return 'Closest matching references treat this as a selective risk-control decision, not an aggressive expansion window.'
  }

  if (category === 'money_wealth') {
    return 'Closest matching references point to ownership, downside, and real conversion as the key filters before putting in more money.'
  }
  if (category === 'career_work') {
    return 'Closest matching references say to keep investing in the lane that is already showing real traction, and cut what only drains effort.'
  }
  if (category === 'love_relationship' || category === 'marriage_family') {
    return 'Closest matching references say to judge the situation by consistency and follow-through, not by one intense moment.'
  }
  if (category === 'health_energy') {
    return 'Closest matching references say recovery and pressure reduction matter more than pushing through right now.'
  }

  return 'Closest matching references say to rank the strongest signal first and avoid moving just because the surface looks active.'
}

function buildQimenWhyLine(
  ctx: ReadingContext,
  signal: NonNullable<ReturnType<typeof qimenSignalPack>>,
) {
  const parts: string[] = []
  const lower = ctx.questionText.toLowerCase()
  const isInfidelityQuery = asksInfidelityQuestion(ctx.questionText)

  if (isInfidelityQuery) {
    parts.push(buildInfidelityWhyLine(ctx))
    if (ctx.qimenVectorHint) {
      parts.push(ctx.qimenVectorHint)
    } else if (signal.caution) {
      parts.push(signal.caution)
    }
    return parts.filter(Boolean).slice(0, 3).join(' ')
  }

  if (ctx.category === 'money_wealth' && /(stock|stocks|trading|portfolio|account|fund|etf|shares|equity|crypto|bitcoin|加仓|股票|账户|基金|仓位)/.test(lower)) {
    parts.push('This looks like a mixed-signal money decision, not a clean add-more window.')
  } else if (ctx.category === 'career_work') {
    parts.push('The main issue here is not effort. It is whether this path is still producing real forward movement.')
  } else if (ctx.category === 'love_relationship' || ctx.category === 'marriage_family') {
    parts.push('This does not read as stable enough for a final emotional decision yet.')
  } else if (ctx.category === 'health_energy') {
    parts.push('This looks more like a pressure-and-recovery issue than a random short dip.')
  } else {
    parts.push(signal.opening)
  }

  if (ctx.qimenVectorHint) {
    parts.push(ctx.qimenVectorHint)
  } else if (signal.caution) {
    parts.push(signal.caution)
  } else if (signal.starText) {
    parts.push(signal.starText)
  }

  if (signal.kongWang) {
    parts.push('Some of what looks available may still fail to convert into something solid.')
  } else if (signal.horsePalace) {
    parts.push('Conditions are still moving, so timing matters more than usual.')
  }

  return parts.filter(Boolean).slice(0, 3).join(' ')
}

function elementVoice(element: ReturnType<typeof normalizeElement>, kind: 'strong' | 'weak' | 'day') {
  const lookup: Record<string, { strong: string; weak: string; day: string }> = {
    wood: {
      strong: 'growth, expansion, and momentum come naturally when the path feels alive',
      weak: 'you can overthink growth and hesitate when a move requires sustained confidence',
      day: 'you read direction quickly and prefer to feel that something is actually growing',
    },
    fire: {
      strong: 'visibility, conviction, and fast execution are easy to access',
      weak: 'confidence can dip when timing is unclear or feedback is cold',
      day: 'you do best when motivation and action are tied together',
    },
    earth: {
      strong: 'stability, consolidation, and carrying long-term responsibility are major strengths',
      weak: 'it is easier to feel ungrounded when too many loose ends pile up',
      day: 'you value steadiness, trust, and decisions that can actually hold',
    },
    metal: {
      strong: 'judgment, precision, and clean decision-making are unusually strong',
      weak: 'you can second-guess timing when standards are high but facts are incomplete',
      day: 'you naturally want clarity, order, and a reason behind each move',
    },
    water: {
      strong: 'timing, intuition, and reading the undercurrent are strong advantages',
      weak: 'energy can scatter if you absorb too much uncertainty from the environment',
      day: 'you tend to sense pattern shifts before other people name them',
    },
  }

  if (!element) {
    if (kind === 'day') return 'you tend to do best when your energy is pointed in one clear direction'
    if (kind === 'strong') return 'there is one part of your pattern that naturally carries the rest'
    return 'there is also one weaker area that becomes more obvious under pressure'
  }

  return lookup[element][kind]
}

function flowElementMeaning(element: ReturnType<typeof normalizeElement>, layer: 'year' | 'month' | 'day') {
  const meaning: Record<'wood' | 'fire' | 'earth' | 'metal' | 'water', Record<'year' | 'month' | 'day', string>> = {
    wood: {
      year: 'growth, expansion, and changing direction',
      month: 'momentum, visibility, and pushing a plan forward',
      day: 'taking one concrete step instead of staying in planning mode',
    },
    fire: {
      year: 'exposure, urgency, and stronger personal drive',
      month: 'speed, confidence, and being seen more clearly',
      day: 'acting decisively while avoiding emotional over-acceleration',
    },
    earth: {
      year: 'stability, structure, and carrying more responsibility',
      month: 'consolidation, practical choices, and financial or emotional grounding',
      day: 'slowing things down enough to make the move sustainable',
    },
    metal: {
      year: 'clear judgment, standards, and sharper decisions',
      month: 'cutting noise, setting boundaries, and correcting weak structure',
      day: 'naming the real decision instead of circling around it',
    },
    water: {
      year: 'timing, adaptation, and reading the undercurrent correctly',
      month: 'adjustment, flexibility, and waiting for the cleaner opening',
      day: 'watching signal quality before committing harder',
    },
  }

  if (!element) {
    if (layer === 'year') return 'a broader shift in direction and pace'
    if (layer === 'month') return 'a more immediate pressure point that is now active'
    return 'the short-term trigger sitting on top of the bigger story'
  }

  return meaning[element][layer]
}

function categoryFrame(category: string) {
  const frames: Record<string, {
    lens: string
    positive: string
    caution: string
    nextStep: string
  }> = {
    career_work: {
      lens: 'direction, leverage, and whether your effort is compounding',
      positive: 'keep backing the lane that already shows traction instead of scattering into too many parallel efforts',
      caution: 'do not confuse motion with progress or loyalty with long-term fit',
      nextStep: 'review what is actually producing pull, results, or recognition over the last 6-12 weeks',
    },
    money_wealth: {
      lens: 'capital, risk appetite, and whether growth is being built on a stable base',
      positive: 'money decisions look better when they are paced, layered, and tied to real evidence',
      caution: 'avoid all-in decisions driven by urgency, sunk cost, or emotional fatigue',
      nextStep: 'stress-test the downside first, then decide how much exposure still feels rational',
    },
    love_relationship: {
      lens: 'attraction, reciprocity, and whether emotion and timing are moving together',
      positive: 'the connection strengthens when the emotional signal and practical follow-through match',
      caution: 'do not make a final decision from one intense conversation or one quiet period',
      nextStep: 'watch consistency, not chemistry alone',
    },
    marriage_family: {
      lens: 'stability, responsibility, and how the bond behaves under real-life pressure',
      positive: 'family questions improve when the structure around the relationship is made clearer',
      caution: 'avoid carrying the entire emotional load by yourself and then calling that peace',
      nextStep: 'look at whether expectations, duties, and future direction are truly aligned',
    },
    health_energy: {
      lens: 'energy rhythm, depletion, and whether pressure is landing on body or mind first',
      positive: 'recovery comes faster when your routine is simplified and made more regular',
      caution: 'do not treat chronic depletion like a temporary mood dip',
      nextStep: 'stabilize sleep, hydration, and stress load before asking the body for more output',
    },
    timing_decisions: {
      lens: 'whether this is a move-now window or a gather-more-signal window',
      positive: 'timing works best when you choose one decisive move instead of many half-moves',
      caution: 'if the facts are still shifting, forcing speed usually costs more than waiting',
      nextStep: 'decide what would count as a real confirmation signal before you move',
    },
    study_exams: {
      lens: 'absorption, pressure handling, and whether the effort is translating into clean output',
      positive: 'study results improve when attention is concentrated rather than spread too wide',
      caution: 'avoid using anxiety as your main study strategy',
      nextStep: 'focus on the highest-yield topics and repeat under timed conditions',
    },
    children_parenting: {
      lens: 'care, responsibility, and how much emotional bandwidth the situation is asking from you',
      positive: 'progress comes when patience and structure are kept together',
      caution: 'avoid reading one difficult phase as the whole story',
      nextStep: 'look for the recurring trigger, not just the latest incident',
    },
    travel_relocation: {
      lens: 'movement, relocation timing, and whether the change genuinely improves your path',
      positive: 'movement is favorable when it creates cleaner momentum and less drag',
      caution: 'do not move just to escape pressure if the same pattern will travel with you',
      nextStep: 'compare what this move solves structurally versus what it only postpones',
    },
    home_property: {
      lens: 'stability, cost, and whether the property decision supports your next phase',
      positive: 'property choices are stronger when practicality leads and emotion follows',
      caution: 'avoid stretching finances for a symbolic win that weakens the rest of your life',
      nextStep: 'check whether the place increases stability, flexibility, or only appearance',
    },
  }

  return frames[category] ?? {
    lens: 'your main direction, pressure point, and what timing is really doing underneath the surface',
    positive: 'keep the part that is actually working and stop feeding what only looks busy',
    caution: 'do not let confusion force a premature conclusion',
    nextStep: 'separate the real signal from emotional noise before deciding',
  }
}

function detectQuestionCue(text: string, category: string) {
  const lower = text.toLowerCase()

  if (/(invest|investment|business|startup|company|project|job|career|quit|promotion|work)/.test(lower)) {
    return {
      direct: 'This does not read like a simple yes-or-no question. It reads like a question about whether your current path still deserves more energy, money, or trust.',
      bias: 'The better move is usually to keep investing only in the part that is already proving itself, while cutting leakage from the parts that are not.',
    }
  }
  if (/(love|relationship|dating|partner|boyfriend|girlfriend|marriage|husband|wife|divorce)/.test(lower)) {
    return {
      direct: 'The real issue here is less about labels and more about consistency, reciprocity, and emotional timing.',
      bias: 'If the connection is real, it should become clearer under calm observation, not only under emotional spikes.',
    }
  }
  if (/(health|body|energy|tired|sleep|stress|sick|ill|anxiety)/.test(lower)) {
    return {
      direct: 'This question points to strain management rather than one single event.',
      bias: 'The body usually improves when pressure is reduced at the source instead of only treated after it lands.',
    }
  }
  if (/(study|exam|school|college|degree|class|learn)/.test(lower)) {
    return {
      direct: 'This reads like a performance and focus question, not a raw ability question.',
      bias: 'Results improve most when effort is narrowed into a smaller number of high-yield targets.',
    }
  }
  if (/(move|relocate|travel|city|country|house|home|property|buy|sell|rent)/.test(lower)) {
    return {
      direct: 'This looks like a structural decision: whether movement will genuinely reduce friction or simply change the scenery.',
      bias: 'The better move is the one that gives you cleaner long-term momentum, not just short-term relief.',
    }
  }

  const frame = categoryFrame(category)
  return {
    direct: `The core of this question is ${frame.lens}.`,
    bias: frame.positive,
  }
}

function joinList(items: string[], joiner = ', ') {
  return items.filter(Boolean).join(joiner)
}

function describeThrownError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const direct =
      (typeof record.message === 'string' && record.message.trim()) ||
      (typeof record.error === 'string' && record.error.trim()) ||
      (typeof record.reason === 'string' && record.reason.trim())
    if (direct) return direct
    try {
      return JSON.stringify(error)
    } catch (_) {
      return '[unserializable error]'
    }
  }
  return String(error)
}

function knowledgeBundle(category: string) {
  return CATEGORY_KNOWLEDGE[category] ?? CATEGORY_KNOWLEDGE.timing_decisions
}

function questionThemeText(text: string, category: string) {
  const lower = text.toLowerCase()

  if (/(invest|investment|fund|capital|business|startup|project)/.test(lower)) {
    return {
      theme:
        'whether this path still deserves more energy, money, or trust',
      advice:
        'keep feeding the part that already shows traction, and stop feeding the part that only looks busy',
    }
  }
  if (/(job|career|promotion|quit|role|company|work)/.test(lower)) {
    return {
      theme:
        'whether your current work direction is structurally aligned with your strongest advantage',
      advice:
        'back the lane that still compounds, not the one held together only by effort or loyalty',
    }
  }
  if (/(love|relationship|dating|partner|marriage|divorce|boyfriend|girlfriend|husband|wife)/.test(lower)) {
    return {
      theme:
        'whether the bond is truly entering your core life structure or only creating emotional heat',
      advice:
        'read consistency and follow-through more heavily than chemistry spikes',
    }
  }
  if (/(health|body|energy|sleep|stress|anxiety|tired|ill|sick)/.test(lower)) {
    return {
      theme:
        'whether current pressure is hitting the body itself or only the outer function line',
      advice:
        'reduce body-level strain first before asking for more performance',
    }
  }
  if (/(study|exam|school|college|class|degree|learn)/.test(lower)) {
    return {
      theme:
        'whether the current issue is a focus-state problem or a longer carrying-capacity problem',
      advice:
        'tighten the structure of effort before judging your ceiling',
    }
  }
  if (/(travel|move|relocate|city|country|house|home|property|buy|sell|rent)/.test(lower)) {
    return {
      theme:
        'whether this move solves a real structural issue or only changes the scenery',
      advice:
        'treat movement as a structural decision, not as a reflex against discomfort',
    }
  }

  const frame = categoryFrame(category)
  return {
    theme: frame.lens,
    advice: frame.positive,
  }
}

function openingLine(ctx: ReadingContext) {
  const lower = ctx.questionText.toLowerCase()

  if (ctx.category === 'career_work' && /(invest|investment|business|startup|project|company)/.test(lower)) {
    return 'Short answer: yes, but only in a limited and selective way. Keep backing what is already working, and stop funding the parts that still have not proved themselves.'
  }
  if (ctx.category === 'career_work') {
    return 'Short answer: stay steady for now. Do not make a sudden move until you are clear about which part of this path is actually moving forward.'
  }
  if (ctx.category === 'money_wealth') {
    if (/(stock|stocks|trading|portfolio|account|fund|etf|shares|equity|crypto|bitcoin|加仓|股票|账户|基金|仓位)/.test(lower)) {
      return 'Short answer: not now. Do not add more money yet unless the position is already proving itself and the numbers still make sense after a calm review.'
    }
    if (/(invest|investment|capital|project|business|startup|投入|投资|项目)/.test(lower)) {
      return 'Short answer: move carefully, not aggressively. Only put more money into the part that is already showing real results.'
    }
    return 'Short answer: be cautious with money right now. Do not commit more unless the numbers, timing, and your own judgment all line up.'
  }
  if (ctx.category === 'love_relationship') {
    if (asksInfidelityQuestion(ctx.questionText)) {
      return buildInfidelityOpeningLine(ctx)
    }
    return 'Short answer: do not force a final relationship decision yet. This needs more consistency before you give it more trust or commitment.'
  }
  if (ctx.category === 'marriage_family') {
    return 'Short answer: slow down and get clarity first. This needs structure, boundaries, and facts more than one emotional decision.'
  }
  if (ctx.category === 'health_energy') {
    return 'Short answer: slow down and recover first. Do not treat this like a small issue you can simply push through.'
  }
  if (ctx.category === 'timing_decisions') {
    return 'Short answer: not yet. Wait for a cleaner opening instead of forcing a decision too early.'
  }
  if (ctx.category === 'study_exams') {
    return 'Short answer: yes, but only if you tighten the structure. The issue here looks more like method and consistency than ability.'
  }
  if (ctx.category === 'children_parenting') {
    return 'Short answer: stay steady, not reactive. Do not let one difficult phase turn into panic or overcorrection.'
  }
  if (ctx.category === 'travel_relocation') {
    return 'Short answer: move only if it solves a real problem. Do not relocate just to escape temporary pressure.'
  }
  if (ctx.category === 'home_property') {
    return 'Short answer: only proceed if it clearly improves stability. Do not stretch your money or energy just for appearance.'
  }

  return 'Short answer: do not rush. Keep what is clearly working, and pause before feeding what is still ambiguous.'
}

function recentShiftLine(
  ctx: ReadingContext,
  dayMaster: DayMasterProfile | null,
  weakInfo: ElementKnowledge | null,
) {
  const lower = ctx.questionText.toLowerCase()
  const baseLead = dayMaster
    ? `You tend to move through life in a way that is ${joinList(dayMaster.coreTraits, ', ')}.`
    : 'You do not move randomly; you are trying to make a meaningful adjustment rather than repeating the same cycle.'

  if (ctx.category === 'career_work' || /(invest|business|startup|job|career|work)/.test(lower)) {
    return `${baseLead} I can also tell you have been trying hard lately to change something about your direction, whether that means learning more, testing a new approach, becoming more visible, or pushing yourself to grow faster. The problem is not lack of effort. The problem is that too much of your energy may be spread across things that are not equally worth carrying.`
  }
  if (ctx.category === 'love_relationship' || ctx.category === 'marriage_family') {
    return `${baseLead} It also looks like you have been trying to change the way you handle this emotionally, either by communicating more, holding back less, or becoming more realistic about what you can and cannot carry in this relationship.`
  }
  if (ctx.category === 'health_energy') {
    return `${baseLead} What stands out is that you may already have been trying to pull yourself back into better order, whether through sleep, routine, food, exercise, or mental discipline, but the recovery line still needs more consistency than pressure.`
  }
  if (ctx.category === 'study_exams') {
    return `${baseLead} It also looks like you have been trying to absorb more, learn faster, or prove more to yourself recently, but the solution is not just pushing harder. It is tightening the structure around what you are doing.`
  }
  if (weakInfo) {
    return `${baseLead} At the same time, the weaker side of the situation still shows up through ${joinList(weakInfo.deficiencySignals, ' / ')}, which is why things may feel more effortful than they look from the outside.`
  }

  return `${baseLead} The bigger story is that you are already in the middle of a change, but part of your life is still catching up to the direction your mind wants to move.`
}

function currentFlowLine(ctx: ReadingContext) {
  const flow = ctx.currentFlow
  if (!flow) return null

  const yearElement = flow.liuNian.element
  const monthElement = flow.liuYue.element
  const dayElement = flow.liuRi.element

  const yearMeaning = flowElementMeaning(yearElement, 'year')
  const monthMeaning = flowElementMeaning(monthElement, 'month')
  const dayMeaning = flowElementMeaning(dayElement, 'day')

  return `What stands out about the timing right now is this: the bigger phase around you is about ${yearMeaning}, the current month is pushing ${monthMeaning}, and the immediate trigger is about ${dayMeaning}. That usually means the question in front of you should be answered by pacing and prioritizing well, not by reacting to the loudest moment.`
}

function actionSteps(
  ctx: ReadingContext,
  frame: ReturnType<typeof categoryFrame>,
  weakInfo: ElementKnowledge | null,
) {
  const lower = ctx.questionText.toLowerCase()

  if (ctx.category === 'money_wealth' && /(stock|stocks|trading|portfolio|account|fund|etf|shares|equity|crypto|bitcoin|加仓|股票|账户|基金|仓位)/.test(lower)) {
    return [
      'Do not add more money immediately.',
      'Review the last 6-12 weeks and identify which positions are actually producing steady gains versus only emotional hope.',
      'Only add capital after you set a clear maximum amount, a stop-loss level, and a reason to enter that still makes sense when you are calm.',
    ]
  }

  if (ctx.category === 'money_wealth') {
    return [
      'Write down the downside first before you commit more money.',
      'Set the maximum amount you can risk without damaging your wider stability.',
      'Move in stages instead of putting everything in at once.',
    ]
  }

  if (ctx.category === 'career_work') {
    return [
      'List the parts of your work that are still producing results, recognition, or useful momentum.',
      'Cut or pause the parts that only consume time and energy without moving you forward.',
      'Make the next move from what has been true over the last 6-12 weeks, not from one stressful day.',
    ]
  }

  if (ctx.category === 'love_relationship' || ctx.category === 'marriage_family') {
    if (asksInfidelityQuestion(ctx.questionText)) {
      return buildInfidelityActionSteps(ctx)
    }
    return [
      'Do not make the whole decision in one conversation or one emotional night.',
      'Watch whether actions match words over the next few weeks.',
      'Only give more trust or commitment if the other person is also carrying their share.',
    ]
  }

  if (ctx.category === 'health_energy') {
    return [
      'Reduce the main source of pressure before asking your body to do more.',
      'Simplify sleep, food, and stress load for the next 1-2 weeks.',
      weakInfo?.restoringActions?.[0] != null
          ? `Use this as a stabilizer: ${weakInfo.restoringActions[0]}.`
          : 'Track whether the issue is improving, stable, or worsening before changing the plan again.',
    ]
  }

  if (ctx.category === 'study_exams') {
    return [
      'Cut the study plan down to the highest-yield topics first.',
      'Practice under timed conditions instead of only rereading.',
      'Judge progress by output quality, not just by hours spent.',
    ]
  }

  if (ctx.category === 'timing_decisions') {
    return [
      'Do not force the decision today just to end uncertainty.',
      'Choose one clear condition that would make this move safer or easier.',
      'Wait until that condition is visible before committing.',
    ]
  }

  if (ctx.category === 'travel_relocation') {
    return [
      'Write down the exact problem you expect the move to solve.',
      'Check whether the move improves cost, support, work, or health in a measurable way.',
      'If the move only offers emotional relief, wait before committing.',
    ]
  }

  if (ctx.category === 'home_property') {
    return [
      'Check whether this choice improves stability, cash flow, or daily life in a concrete way.',
      'Set a hard affordability limit before you negotiate or commit.',
      'If the numbers only work under pressure, do not proceed yet.',
    ]
  }

  return [
    `Start with this: ${frame.nextStep}.`,
    'Do not move from pressure alone.',
    'Take the next step only after you define what evidence would confirm the move is actually working.',
  ]
}

function asksInfidelityQuestion(questionText: string) {
  return /(other girl|other woman|other man|someone else|third party|affair|cheat|cheating|another girl|another woman|another man|seeing someone|with someone else|小三|第三者|别人|外遇|出轨|暧昧对象)/i
    .test(questionText)
}

function infidelitySignalLabel(ctx: ReadingContext): 'yes' | 'no' | 'unclear' {
  const evidence = [
    ctx.qimenReasoning?.decision.main_judgment,
    ctx.qimenReasoning?.decision.reason_chain?.join(' '),
    ctx.qimenReasoning?.decision.risk_line,
    ctx.qimenReasoning?.decision.timing_line,
    ctx.qimenVectorHint,
  ].filter(Boolean).join(' ')

  const yesTerms = [
    '第三者',
    '小三',
    '情人',
    '私人关系',
    '三角恋',
    '出轨',
    '有别人',
    '外部关系',
    'someone else',
    'third party',
    'affair',
    'cheat',
    'cheating',
  ]
  const noTerms = [
    '没有第三者',
    '无第三者',
    '没有别人',
    '不是出轨',
    '并非第三者',
    'not a third person',
    'no clear third party',
    'no affair',
  ]
  const unclearTerms = [
    '拉扯',
    '不稳',
    '反复',
    '不敢公开',
    '看不清',
    '未定',
    '时有时无',
    '整体难长久',
    '逐渐疏远',
    'mixed-signal',
    'not stable',
    'not clean',
    'inconsistency',
    'unstable',
  ]

  const positiveHits = yesTerms.filter((term) => evidence.includes(term)).length
  const negativeHits = noTerms.filter((term) => evidence.includes(term)).length
  const unclearHits = unclearTerms.filter((term) => evidence.includes(term)).length

  if (positiveHits > negativeHits && positiveHits > 0) return 'yes'
  if (negativeHits > positiveHits && negativeHits > 0) return 'no'
  if (unclearHits > 0) return 'unclear'
  return 'unclear'
}

function buildInfidelityOpeningLine(ctx: ReadingContext) {
  switch (infidelitySignalLabel(ctx)) {
    case 'yes':
      return 'Short answer: yes, there are meaningful signs of another attachment or overlapping connection here.'
    case 'no':
      return 'Short answer: no, there is not enough here to call this a confirmed third-person situation.'
    default:
      return 'Short answer: not confirmed. There are outside-interference signs, but not enough to call this a real affair.'
  }
}

function buildInfidelityWhyLine(ctx: ReadingContext) {
  switch (infidelitySignalLabel(ctx)) {
    case 'yes':
      return 'The strongest signal here is not simple distance. It points more toward secrecy, divided attention, or a second emotional line in the background.'
    case 'no':
      return 'The strongest signal here is instability and inconsistency, not a clean indication of another person.'
    default:
      return 'The strongest signal here is instability, secrecy, or inconsistency, but not enough to prove another relationship as a clean fact yet.'
  }
}

function buildInfidelityActionSteps(_ctx: ReadingContext) {
  return [
    'Do not accuse without hard evidence.',
    'Watch consistency, privacy changes, and unexplained absences over the next 2-3 weeks.',
    'If the pattern repeats, ask one direct question and decide from the answer plus the behavior that follows.',
  ]
}

function actionLine(
  ctx: ReadingContext,
  frame: ReturnType<typeof categoryFrame>,
  primaryRule: KnowledgeRule,
  supportRule: KnowledgeRule,
  weakInfo: ElementKnowledge | null,
) {
  const lines: string[] = []
  const steps = actionSteps(ctx, frame, weakInfo)
  if (steps.length > 0) {
    lines.push(`1. ${steps[0]}`)
  }
  if (steps.length > 1) {
    lines.push(`2. ${steps[1]}`)
  }
  if (steps.length > 2) {
    lines.push(`3. ${steps[2]}`)
  }

  const safeAdvice = supportRule.productSafeAdvice?.[0] ?? primaryRule.productSafeAdvice?.[0]
  if (safeAdvice && ctx.category !== 'money_wealth' && ctx.category !== 'career_work' && ctx.category !== 'love_relationship' && ctx.category !== 'marriage_family') {
    lines.push(`Keep in mind: ${safeAdvice}`)
  } else if (!safeAdvice && ctx.category !== 'health_energy' && weakInfo?.restoringActions?.[0]) {
    lines.push(`Steady yourself by doing one thing well: ${weakInfo.restoringActions[0]}.`)
  }

  if (ctx.parentQuestionText && lines.length < 4) {
    lines.push('Stay with the same core issue instead of restarting the whole story.')
  }

  return lines.join(' ')
}

function buildQimenAnswer(ctx: ReadingContext) {
  const frame = categoryFrame(ctx.category)
  const signal = qimenSignalPack(ctx.qimenChart)
  const theme = questionThemeText(ctx.questionText, ctx.category)

  if (!signal) {
    return [
      `Short answer: not yet. The timing around this question is not clean enough for a stronger read.`,
      `Why: what matters most here is still ${frame.lens}.`,
      `Action plan: 1. ${frame.nextStep.charAt(0).toUpperCase()}${frame.nextStep.slice(1)}. 2. ${frame.caution.charAt(0).toUpperCase()}${frame.caution.slice(1)}.`,
    ].join('\n\n')
  }

  const paragraphOne = openingLine(ctx)
  const paragraphTwo = `Why: ${buildQimenWhyLine(ctx, signal)}`
  const paragraphThree =
    `Action plan: ${actionLine(ctx, frame, knowledgeBundle(ctx.category).rules[0], knowledgeBundle(ctx.category).rules[1] ?? knowledgeBundle(ctx.category).rules[0], null)}`

  return [paragraphOne, paragraphTwo, paragraphThree].join('\n\n')
}

function buildAnswer(ctx: ReadingContext) {
  if (ctx.divinationSystem === 'qimen_yang') {
    return buildQimenAnswer(ctx)
  }

  const chartAnalysis = ctx.chart?.analysis
  const dayStem = cleanString(chartAnalysis?.dayMaster?.stem)
  const dayMaster = dayStem ? DAY_MASTER_PROFILES[dayStem] : null
  const weakElement = normalizeElement(chartAnalysis?.weakElement)
  const weakInfo = weakElement ? ELEMENT_KNOWLEDGE[weakElement] : null
  const bundle = knowledgeBundle(ctx.category)
  const primaryRule = bundle.rules[0]
  const supportRule = bundle.rules[1] ?? bundle.rules[0]
  const frame = categoryFrame(ctx.category)
  const theme = questionThemeText(ctx.questionText, ctx.category)

  const paragraphOne = openingLine(ctx)
  const paragraphTwo = `Why: ${[
    recentShiftLine(ctx, dayMaster, weakInfo),
    currentFlowLine(ctx) ??
        `${theme.advice.charAt(0).toUpperCase()}${theme.advice.slice(1)}.`,
    `${frame.caution.charAt(0).toUpperCase()}${frame.caution.slice(1)}.`,
  ].filter(Boolean).join(' ')}`
  const paragraphThree = `Action plan: ${actionLine(ctx, frame, primaryRule, supportRule, weakInfo)}`

  return [paragraphOne, paragraphTwo, paragraphThree].join('\n\n')
}

function hasPartnerBirthYear(contextText: string) {
  return /(对方|对象|伴侣|另一半|男友|女友|partner|their)\D*(19|20)\d{2}/i.test(contextText)
}

function categoryMatchesQuestion(category: string, questionText: string) {
  const text = questionText.toLowerCase()
  switch (category) {
    case 'career_work':
      return /(在职|离职|待业|面试|创业|老板|上级|行业|岗位|offer|job|work|career|promotion|interview)/i.test(text)
    case 'money_wealth':
      return /(工资|收入|回款|投资|借款|客户|合作|股票|账户|salary|income|investment|invest|client|debt|loan|stock|trading|portfolio|account)/i.test(text)
    case 'health_energy':
      return /(多久|几天|几周|症状|诊断|医院|检查|手术|sleep|pain|diagnosis|symptom|doctor|health|body)/i.test(text)
    case 'love_relationship':
    case 'marriage_family':
      return /(感情|婚姻|恋爱|对象|复合|离婚|结婚|relationship|love|marriage|dating|partner|boyfriend|girlfriend|husband|wife)/i.test(text)
    case 'study_exams':
      return /(学习|考试|学校|录取|study|exam|school|college|class|degree)/i.test(text)
    default:
      return true
  }
}

function resolveEffectiveCategory(requestedCategory: string, questionText: string) {
  const cleanRequested = cleanString(requestedCategory)
  const detected = detectQuestionTypeWithScore(questionText)

  if (!cleanRequested || cleanRequested === 'other' || cleanRequested === 'general') {
    return detected.type
  }

  if (detected.score <= 0) {
    return cleanRequested
  }

  if (!categoryMatchesQuestion(cleanRequested, questionText) && detected.type !== cleanRequested) {
    return detected.type
  }

  return cleanRequested
}

function hasCareerContext(contextText: string) {
  return /(在职|离职|待业|面试|创业|老板|上级|行业|岗位|offer|job|work|career|promotion|interview)/i.test(contextText)
}

function hasMoneyContext(contextText: string) {
  return /(工资|收入|回款|投资|借款|客户|合作|salary|income|investment|client|debt|loan)/i.test(contextText)
}

function hasSpecificInvestmentContext(contextText: string) {
  return /(stock|stocks|trading|portfolio|account|fund|etf|shares|equity|crypto|bitcoin|加仓|股票|账户|基金|仓位)/i.test(contextText)
}

function hasHealthContext(contextText: string) {
  return /(多久|几天|几周|症状|诊断|医院|检查|手术|sleep|pain|diagnosis|symptom|doctor)/i.test(contextText)
}

function buildClarificationRequest(input: {
  category: string
  questionText: string
  parentQuestionText?: string | null
  parentAnswerText?: string | null
}): ClarificationResult | null {
  const contextText = [
    input.questionText,
    input.parentQuestionText ?? '',
    input.parentAnswerText ?? '',
  ].join(' ')

  if (input.category === 'career_work') {
    if (!hasCareerContext(contextText)) {
      return {
        reason: 'Career readings work better once the system knows whether you are asking about your current role, a new opening, or a transition away.',
        prompt: 'Add one quick detail first: are you currently employed, preparing to leave, or looking at a new opportunity? If helpful, you can also mention the industry or role.',
        requested_fields: ['current_career_state'],
      }
    }
  }

  if (input.category === 'money_wealth') {
    if (!hasMoneyContext(contextText) && !hasSpecificInvestmentContext(contextText)) {
      return {
        reason: 'Money readings are more accurate once the system knows whether this is about salary, partnership, investing, repayment, or debt.',
        prompt: 'Add one line first: is your main concern salary income, partnership repayment, investment risk, or debt and borrowing?',
        requested_fields: ['money_context'],
      }
    }
  }

  if (input.category === 'health_energy') {
    if (!hasHealthContext(contextText)) {
      return {
        reason: 'Health readings work better once the system knows whether this is about symptoms, test results, diagnosis, or recovery timing.',
        prompt: 'Add one quick health detail first: what symptom or condition are you asking about, how long has it lasted, and has a doctor given a diagnosis yet?',
        requested_fields: ['health_context'],
      }
    }
  }

  return null
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
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

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
    await ensurePublicUserRow(supabase, user)

    const body = await req.json() as Record<string, unknown>
    const questionText = String(body?.question_text ?? '').trim()
    const requestedCategory = String(body?.category ?? 'general')
    const category = resolveEffectiveCategory(requestedCategory, questionText)
    const priority = String(body?.priority ?? 'normal')
    const questionKind = String(body?.question_kind ?? 'deep').trim().toLowerCase()
    const parentQuestionId = body?.parent_question_id ? String(body.parent_question_id) : null
    const requestId = body?.request_id ? String(body.request_id) : null
    const divinationSystem = String(body?.divination_system ?? 'qimen_yang').trim().toLowerCase() as DivinationSystem

    if (!questionText) {
      return new Response(JSON.stringify({ error: 'question_text is required' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!(questionKind in COIN_COSTS)) {
      return new Response(JSON.stringify({ error: 'question_kind must be deep, quick, or followup' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!DIVINATION_SYSTEMS.includes(divinationSystem)) {
      return new Response(JSON.stringify({ error: 'divination_system must be bazi or qimen_yang' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (questionKind === 'followup' && !parentQuestionId) {
      return new Response(JSON.stringify({ error: 'parent_question_id is required for followup' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const userId = user.id
    let coinCost = COIN_COSTS[questionKind]
    const [totalQuestionCountResult, deliveredQimenCountResult] = await Promise.all([
      supabase
        .from('master_questions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('master_questions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('divination_system', 'qimen_yang')
        .eq('status', 'delivered'),
    ])
    if (totalQuestionCountResult.error) throw totalQuestionCountResult.error
    if (deliveredQimenCountResult.error) throw deliveredQimenCountResult.error

    let freeFirstQuestionApplied = false
    if (!parentQuestionId && questionKind === 'deep') {
      const { count: existingRootQuestions, error: countError } = await supabase
        .from('master_questions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('parent_question_id', null)

      if (countError) throw countError

      if ((existingRootQuestions ?? 0) === 0) {
        coinCost = 0
        freeFirstQuestionApplied = true
      }
    }

    let parentQuestionText: string | null = null
    let parentAnswerText: string | null = null
    let parentStatus: string | null = null
    if (parentQuestionId) {
      const { data: parentRow } = await supabase
        .from('master_questions')
      .select('question_text,answer_text,status')
        .eq('id', parentQuestionId)
        .eq('user_id', userId)
        .maybeSingle()

      parentQuestionText = cleanString(parentRow?.question_text)
      parentAnswerText = cleanString(parentRow?.answer_text)
      parentStatus = cleanString(parentRow?.status)
      if (questionKind === 'followup' && parentStatus === 'awaiting_user_info') {
        coinCost = 0
      }
    }

    const now = new Date()
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    let balanceAfter: number | null = null
    if (coinCost > 0) {
      const { data: spendResult, error: spendError } = await supabase.rpc('spend_user_coins', {
        p_user_id: userId,
        p_amount: coinCost,
        p_reason: `master_reply_${questionKind}`,
        p_source_type: 'master_question',
        p_source_ref: parentQuestionId,
        p_note: category,
        p_metadata: {
          category,
          priority,
          question_kind: questionKind,
        },
        p_idempotency_key: requestId,
      })

      if (spendError) throw spendError

      const spend = spendResult as { ok?: boolean; error?: string; balance_after?: number }
      if (!spend?.ok) {
        const status = spend?.error === 'INSUFFICIENT_COINS' ? 402 : 400
        return new Response(JSON.stringify({
          error: spend?.error ?? 'COIN_SPEND_FAILED',
          coin_cost: coinCost,
          balance_after: spend?.balance_after ?? 0,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status,
        })
      }
      balanceAfter = spend.balance_after ?? null
    } else {
      const { data: wallet } = await supabase
        .from('coin_wallets')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle()
      balanceAfter = wallet?.balance ?? 0
    }

    const [{ data: profile }, { data: chart }] = await Promise.all([
      supabase
        .from('profiles')
      .select('timezone,intent,language')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('bazi_charts')
        .select('chart_text,pillars,analysis')
        .eq('user_id', userId)
        .maybeSingle(),
    ])

    const storedChart = (chart as StoredChart | null) ?? null
    const currentFlow = buildCurrentFlowFromStoredChart(storedChart)
    const qimenYearMingSupport = buildQimenYearMingSupport(category, questionText, parentQuestionText, storedChart)
    const qimenLongCycleSupport = buildQimenLongCycleSupport(category, currentFlow, storedChart)
    const qimenInput = divinationSystem === 'qimen_yang'
      ? resolveQimenInput(body, (profile as StoredProfile | null) ?? null, storedChart)
      : null

    if (divinationSystem === 'qimen_yang' && !qimenInput) {
      return new Response(JSON.stringify({
        error: 'A valid device timezone is required to prepare this reading. Reopen the app and try again.',
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const qimenQuestionType = divinationSystem === 'qimen_yang'
      ? detectQuestionType(questionText)
      : null
    const qimenChart = qimenInput ? await calculateQimen(qimenInput) : null
    const qimenVectorMatches = divinationSystem === 'qimen_yang' && qimenQuestionType
      ? await fetchQimenVectorMatches(supabase, questionText, qimenQuestionType)
      : []
    const qimenVectorHint = divinationSystem === 'qimen_yang'
      ? buildQimenVectorHint(category, questionText, qimenVectorMatches)
      : null
    const qimenFeedbackLearning = divinationSystem === 'qimen_yang'
      ? await loadQimenFeedbackLearning(supabase, qimenQuestionType)
      : null
    let qimenReasoning = divinationSystem === 'qimen_yang'
      ? buildQimenReasoningTrace({
        questionText,
        qimenChart,
        feedbackLearning: qimenFeedbackLearning,
        yearMingSupport: qimenYearMingSupport,
        longCycleSupport: qimenLongCycleSupport,
      })
      : null
    if (divinationSystem === 'qimen_yang' && qimenChart && qimenQuestionType) {
      const teacherRuns: QimenTeacherRun[] = []
      const primaryRun = buildQimenTeacherRun({
        teacherId: QIMEN_PRIMARY_TEACHER,
        questionText,
        qimenChart,
        feedbackLearning: qimenFeedbackLearning,
        yearMingSupport: qimenYearMingSupport,
        longCycleSupport: qimenLongCycleSupport,
      })
      if (primaryRun) teacherRuns.push(primaryRun)
      const grayPolicy = shouldRunQimenGrayTeachers(qimenQuestionType, questionText)
      if (grayPolicy.enabled) {
        const teacherOrder = getQimenGrayTeacherOrder(qimenQuestionType)
        for (const teacherId of teacherOrder) {
          const run = buildQimenTeacherRun({
            teacherId,
            questionText,
            qimenChart,
            feedbackLearning: qimenFeedbackLearning,
            yearMingSupport: qimenYearMingSupport,
            longCycleSupport: qimenLongCycleSupport,
          })
          if (run) teacherRuns.push(run)
        }
      }
      const consensus = teacherRuns.length >= 2 ? buildQimenTeacherConsensus(teacherRuns) : null
      qimenReasoning = mergeTeacherExperimentIntoTrace(qimenReasoning, teacherRuns, consensus)
      if (qimenReasoning) {
        qimenReasoning = {
          ...qimenReasoning,
          teacher_policy: {
            primary_teacher: QIMEN_PRIMARY_TEACHER,
            gray_enabled: grayPolicy.enabled,
            gray_teachers: grayPolicy.enabled ? getQimenGrayTeacherOrder(qimenQuestionType) : [],
            routing_reason: grayPolicy.reason,
          },
        }
      }
    }
    const clarification = buildClarificationRequest({
      category,
      questionText,
      parentQuestionText,
      parentAnswerText,
    })
    const qimenFeedbackInvitePolicy =
      divinationSystem === 'qimen_yang' && !clarification
        ? await buildQimenFeedbackInvitePolicy({
          question_text: questionText,
          question_type: category,
          delivered_qimen_count: (deliveredQimenCountResult.count ?? 0) + 1,
          total_question_count: (totalQuestionCountResult.count ?? 0) + 1,
          has_existing_feedback: false,
        })
        : null
    const categoryKnowledge = divinationSystem === 'qimen_yang'
      ? { sharedNodes: [] as string[], rules: [] as KnowledgeRule[] }
      : knowledgeBundle(category)

    const generatedAnswer = clarification
      ? clarification.prompt
      : buildAnswer({
          questionText,
          category,
          questionKind,
          divinationSystem,
          profile: (profile as StoredProfile | null) ?? null,
          chart: storedChart,
          parentQuestionText,
          parentAnswerText,
          currentFlow,
          qimenChart,
          qimenReasoning,
          qimenVectorHint,
        })

    const { data, error } = await supabase
      .from('master_questions')
      .insert({
        user_id: userId,
        parent_question_id: parentQuestionId,
        question_text: questionText,
        category,
        divination_system: divinationSystem,
        divination_profile: qimenInput?.system_profile ?? null,
        question_kind: questionKind,
        coin_cost: coinCost,
        priority,
        status: clarification ? 'awaiting_user_info' : 'paid',
        price_paid: null,
        currency: 'COIN',
        paid_at: now.toISOString(),
        sla_deadline_at: deadline.toISOString(),
      })
      .select('id,status,sla_deadline_at,coin_cost,question_kind,divination_system,divination_profile,parent_question_id')
      .single()

    if (error) throw error
    const deliveredAt = new Date().toISOString()

    const { error: deliverError } = await supabase
      .from('master_questions')
      .update({
        status: clarification ? 'awaiting_user_info' : 'delivered',
        answer_text: generatedAnswer,
        delivered_at: deliveredAt,
        updated_at: deliveredAt,
      })
      .eq('id', data.id)
    if (deliverError) throw deliverError

    await supabase.from('master_events').insert({
      question_id: data.id,
      event_type: 'submitted',
      payload_json: {
        category,
        priority,
        question_kind: questionKind,
        divination_system: divinationSystem,
        divination_profile: qimenInput?.system_profile ?? null,
        coin_cost: coinCost,
        parent_question_id: parentQuestionId,
        balance_after: balanceAfter,
        free_first_question_applied: freeFirstQuestionApplied,
        clarification_requested: Boolean(clarification),
      },
    })

    await supabase.from('master_events').insert({
      question_id: data.id,
      event_type: 'delivered',
      payload_json: {
        delivered_at: deliveredAt,
        delivery_mode: 'auto_generated',
        feedback_invite: qimenFeedbackInvitePolicy == null
          ? null
          : {
            invited: qimenFeedbackInvitePolicy.invited,
            reward_coins: qimenFeedbackInvitePolicy.reward_coins,
            invitation_reason: qimenFeedbackInvitePolicy.invitation_reason,
            policy: qimenFeedbackInvitePolicy,
          },
        knowledge_evidence: {
          divination_system: divinationSystem,
          category,
          shared_nodes: categoryKnowledge.sharedNodes,
          rule_ids: categoryKnowledge.rules.map((rule) => rule.id),
          day_master_stem: cleanString(storedChart?.analysis?.dayMaster?.stem),
          strong_element: cleanString(storedChart?.analysis?.strongElement),
          weak_element: cleanString(storedChart?.analysis?.weakElement),
          current_flow: currentFlow == null ? null : {
            liu_nian: currentFlow.liuNian.pillar,
            liu_yue: currentFlow.liuYue.pillar,
            liu_ri: currentFlow.liuRi.pillar,
            reference_time: currentFlow.referenceTime.trueSolarTime,
          },
          qimen_chart: qimenChart == null ? null : {
            system_profile: qimenChart.chart?.system_profile,
            mode: qimenChart.chart?.mode,
            yin_yang: qimenChart.chart?.yin_yang,
            solar_term: qimenChart.calendar_context?.solar_term,
            bureau_number: qimenChart.chart?.bureau_number,
            zhi_fu: qimenChart.chart?.zhi_fu,
            zhi_shi: qimenChart.chart?.zhi_shi,
            xun_shou: qimenChart.chart?.xun_shou,
            kong_wang: qimenChart.markers?.kong_wang,
            horse_star: qimenChart.markers?.horse_star,
            local_datetime: qimenChart.timing?.local_datetime,
            casting_time_basis: qimenChart.timing?.casting_time_basis,
            web_style_layout: qimenChart.web_style_layout,
            china95_style_layout: qimenChart.china95_style_layout,
            layout_profile: qimenChart.engine_metadata?.layout_profile,
            oracle_backed: qimenChart.engine_metadata?.oracle_backed,
            zhirun_applied: qimenChart.engine_metadata?.zhirun_applied,
          },
          qimen_reasoning: qimenReasoning,
          qimen_vector_matches: qimenVectorMatches.slice(0, 5),
          qimen_support_signals: qimenReasoning?.support_signals ?? null,
          clarification: clarification == null ? null : {
            reason: clarification.reason,
            prompt: clarification.prompt,
            requested_fields: clarification.requested_fields,
          },
        },
      },
    })

    return new Response(JSON.stringify({
      ...data,
      status: clarification ? 'awaiting_user_info' : 'delivered',
      divination_system: divinationSystem,
      divination_profile: qimenInput?.system_profile ?? null,
      answer_text: generatedAnswer,
      delivered_at: deliveredAt,
      knowledge_evidence: {
        divination_system: divinationSystem,
        category,
        shared_nodes: categoryKnowledge.sharedNodes,
        rule_ids: categoryKnowledge.rules.map((rule) => rule.id),
        current_flow: currentFlow == null ? null : {
          liu_nian: currentFlow.liuNian.pillar,
          liu_yue: currentFlow.liuYue.pillar,
          liu_ri: currentFlow.liuRi.pillar,
        },
        qimen_chart: qimenChart == null ? null : {
          system_profile: qimenChart.chart?.system_profile,
          mode: qimenChart.chart?.mode,
          yin_yang: qimenChart.chart?.yin_yang,
          solar_term: qimenChart.calendar_context?.solar_term,
          bureau_number: qimenChart.chart?.bureau_number,
          zhi_fu: qimenChart.chart?.zhi_fu,
          zhi_shi: qimenChart.chart?.zhi_shi,
          xun_shou: qimenChart.chart?.xun_shou,
          local_datetime: qimenChart.timing?.local_datetime,
          casting_time_basis: qimenChart.timing?.casting_time_basis,
          web_style_layout: qimenChart.web_style_layout,
          china95_style_layout: qimenChart.china95_style_layout,
          layout_profile: qimenChart.engine_metadata?.layout_profile,
        },
        qimen_reasoning: qimenReasoning,
        qimen_vector_matches: qimenVectorMatches.slice(0, 5),
        qimen_support_signals: qimenReasoning?.support_signals ?? null,
        clarification: clarification == null ? null : {
          reason: clarification.reason,
          prompt: clarification.prompt,
          requested_fields: clarification.requested_fields,
        },
      },
      balance_after: balanceAfter,
      free_first_question_applied: freeFirstQuestionApplied,
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: describeThrownError(e) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
