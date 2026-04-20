import {
  buildQimenTeacherConsensus,
  buildQimenTeacherRun,
  type QimenTeacherConsensus,
  type QimenTeacherRun,
} from '../backend/supabase/functions/_shared/qimen-reasoning-engine.ts'
import { calculateQimen, type QimenInput } from '../backend/supabase/functions/_shared/qimen-engine.ts'

type FeedbackStatus = 'pending' | 'matched' | 'partial' | 'missed'
type RootCause = 'plate_engine' | 'question_routing' | 'timing_expression' | 'result_normalization'

type ProspectiveSeed = {
  case_id: string
  source_label: string
  source_type: string
  submitted_at: string
  timezone: string
  system_profile?: QimenInput['system_profile']
  question_type: string
  question_type_label?: string
  normalized_question: string
  expected_followup_window: string
  verification_axes?: string[]
  feedback_status?: FeedbackStatus
  feedback_notes?: string
  feedback_summary?: string
  root_cause?: RootCause | null
  target_teachers?: string[]
}

type ProspectiveBundle = {
  generated_at?: string
  inputs: ProspectiveSeed[]
}

type ProspectiveTeacherRun = {
  teacher_id: string
  main_judgment: string
  timing_line: string
  risk_line: string
  reason_chain: string[]
  normalized_key: string
  normalized_label: string
  normalized_timing_bucket: string
}

type ProspectiveCaseResult = {
  case_id: string
  source_label: string
  source_type: string
  submitted_at: string
  timezone: string
  question_type: string
  question_type_label: string
  normalized_question: string
  chart_summary: {
    solar_term?: string | null
    bureau_number?: number | null
    zhi_fu?: string | null
    zhi_shi?: string | null
    xun_shou?: string | null
    local_datetime?: string | null
    yin_yang?: string | null
    layout_profile?: string | null
    web_style_layout?: string | null
    out_of_scope_reason?: string | null
  }
  teachers: ProspectiveTeacherRun[]
  consensus: QimenTeacherConsensus | null
  main_judgment: string
  timing_line: string
  risk_line: string
  expected_followup_window: string
  verification_axes?: string[]
  feedback_status: FeedbackStatus
  feedback_notes?: string
  feedback_summary?: string
  root_cause?: RootCause | null
}

type ProspectiveReport = {
  generated_at: string
  total_cases: number
  teachers: string[]
  summary: {
    pending: number
    matched: number
    partial: number
    missed: number
  }
  cases: ProspectiveCaseResult[]
}

const INPUT_PATH =
  '/Users/liheng/Desktop/cosmic-daily-app/data/import-runs/qimen-yangpan/qimen-teacher-prospective-inputs.json'
const OUTPUT_JSON =
  '/Users/liheng/Desktop/cosmic-daily-app/data/import-runs/qimen-yangpan/qimen-teacher-prospective-report.json'
const OUTPUT_MD =
  '/Users/liheng/Desktop/cosmic-daily-app/data/import-runs/qimen-yangpan/qimen-teacher-prospective-report.md'

const DEFAULT_TEACHERS = ['钟波', '文艺复兴', '王兴兵', '王永源', '苗道长']

function mdEscape(value: string) {
  return value.replace(/\|/g, '\\|')
}

function chooseRepresentativeRun(runs: QimenTeacherRun[], consensus: QimenTeacherConsensus | null) {
  if (consensus?.majority_key) {
    const matched = runs.find((run) => run.normalized_decision.key === consensus.majority_key)
    if (matched) return matched
  }
  return runs[0] ?? null
}

function renderMarkdown(report: ProspectiveReport) {
  const lines: string[] = []
  lines.push('# 奇门五老师前瞻盲测报告')
  lines.push('')
  lines.push(`- generated_at: ${report.generated_at}`)
  lines.push(`- total_cases: ${report.total_cases}`)
  lines.push(`- teachers: ${report.teachers.join(' / ')}`)
  lines.push('')
  lines.push('## 状态汇总')
  lines.push('')
  lines.push(`- pending: ${report.summary.pending}`)
  lines.push(`- matched: ${report.summary.matched}`)
  lines.push(`- partial: ${report.summary.partial}`)
  lines.push(`- missed: ${report.summary.missed}`)
  lines.push('')
  lines.push('> 这份报告只统计真实新问题的先断后验，不与历史复盘样本混写。')

  for (const caseResult of report.cases) {
    lines.push('')
    lines.push(`## ${caseResult.source_label}`)
    lines.push('')
    lines.push(`- case_id: ${caseResult.case_id}`)
    lines.push(`- source_type: ${caseResult.source_type}`)
    lines.push(`- submitted_at: ${caseResult.submitted_at} (${caseResult.timezone})`)
    lines.push(`- question_type: ${caseResult.question_type_label}`)
    lines.push(`- question: ${caseResult.normalized_question}`)
    lines.push(`- feedback_status: ${caseResult.feedback_status}`)
    lines.push(`- expected_followup_window: ${caseResult.expected_followup_window}`)
    if (caseResult.verification_axes?.length) {
      lines.push(`- verification_axes: ${caseResult.verification_axes.join('、')}`)
    }
    if (caseResult.feedback_summary) {
      lines.push(`- feedback_summary: ${caseResult.feedback_summary}`)
    }
    if (caseResult.feedback_notes) {
      lines.push(`- feedback_notes: ${caseResult.feedback_notes}`)
    }
    if (caseResult.root_cause) {
      lines.push(`- root_cause: ${caseResult.root_cause}`)
    }
    lines.push(
      `- chart: ${caseResult.chart_summary.yin_yang ?? ''} / 节气=${caseResult.chart_summary.solar_term ?? ''} / 局数=${caseResult.chart_summary.bureau_number ?? ''} / 值符=${caseResult.chart_summary.zhi_fu ?? ''} / 值使=${caseResult.chart_summary.zhi_shi ?? ''} / 旬首=${caseResult.chart_summary.xun_shou ?? ''}`,
    )
    lines.push(`- main_judgment: ${caseResult.main_judgment}`)
    lines.push(`- timing_line: ${caseResult.timing_line}`)
    lines.push(`- risk_line: ${caseResult.risk_line}`)
    lines.push(`- consensus: ${caseResult.consensus?.summary ?? '无'}`)
    if (caseResult.chart_summary.web_style_layout) {
      lines.push('')
      lines.push('```text')
      lines.push(caseResult.chart_summary.web_style_layout)
      lines.push('```')
    }
    lines.push('')
    lines.push('| 老师 | 主判断 | 应期 | 风险线 |')
    lines.push('| --- | --- | --- | --- |')
    for (const teacher of caseResult.teachers) {
      lines.push(
        `| ${teacher.teacher_id} | ${mdEscape(teacher.main_judgment)} | ${mdEscape(teacher.timing_line)} | ${mdEscape(teacher.risk_line)} |`,
      )
    }
  }

  lines.push('')
  return `${lines.join('\n')}\n`
}

async function main() {
  const raw = await Deno.readTextFile(INPUT_PATH)
  const bundle = JSON.parse(raw) as ProspectiveBundle
  const seeds = bundle.inputs ?? []
  const cases: ProspectiveCaseResult[] = []

  for (const seed of seeds) {
    const teachers = seed.target_teachers?.length ? seed.target_teachers : DEFAULT_TEACHERS
    const chart = await calculateQimen({
      submitted_at: seed.submitted_at,
      timezone: seed.timezone,
      system_profile: seed.system_profile ?? 'chai_bu',
    })

    const engineMetadata = chart.engine_metadata as Record<string, unknown> | undefined
    const outOfScopeReason =
      typeof engineMetadata?.out_of_scope_reason === 'string'
        ? String(engineMetadata.out_of_scope_reason)
        : null

    const runs = chart.chart
      ? teachers
          .map((teacherId) =>
            buildQimenTeacherRun({
              teacherId,
              questionText: seed.normalized_question,
              questionType: seed.question_type,
              qimenChart: chart,
            }),
          )
          .filter(Boolean) as QimenTeacherRun[]
      : []

    const consensus = runs.length > 0 ? buildQimenTeacherConsensus(runs) : null
    const representative = chooseRepresentativeRun(runs, consensus)

    cases.push({
      case_id: seed.case_id,
      source_label: seed.source_label,
      source_type: seed.source_type,
      submitted_at: seed.submitted_at,
      timezone: seed.timezone,
      question_type: seed.question_type,
      question_type_label: seed.question_type_label ?? seed.question_type,
      normalized_question: seed.normalized_question,
      chart_summary: {
        solar_term: chart.calendar_context?.solar_term ?? null,
        bureau_number: chart.chart?.bureau_number ?? null,
        zhi_fu: chart.chart?.zhi_fu ?? null,
        zhi_shi: chart.chart?.zhi_shi ?? null,
        xun_shou: chart.chart?.xun_shou ?? null,
        local_datetime: chart.timing?.local_datetime ?? null,
        yin_yang: chart.chart?.yin_yang ?? null,
        layout_profile: chart.engine_metadata?.layout_profile ?? null,
        web_style_layout: chart.web_style_layout ?? null,
        out_of_scope_reason: outOfScopeReason,
      },
      teachers: runs.map((run) => ({
        teacher_id: run.teacher_id,
        main_judgment: run.main_judgment,
        timing_line: run.timing_line,
        risk_line: run.risk_line,
        reason_chain: run.reason_chain,
        normalized_key: run.normalized_decision.key,
        normalized_label: run.normalized_decision.label,
        normalized_timing_bucket: run.normalized_decision.timing_bucket,
      })),
      consensus,
      main_judgment: representative?.main_judgment ?? '未能生成有效断语',
      timing_line: representative?.timing_line ?? '未能生成有效应期判断',
      risk_line: representative?.risk_line ?? '未能生成有效风险判断',
      expected_followup_window: seed.expected_followup_window,
      verification_axes: seed.verification_axes ?? [],
      feedback_status: seed.feedback_status ?? 'pending',
      feedback_notes: seed.feedback_notes ?? '',
      feedback_summary: seed.feedback_summary ?? '',
      root_cause: seed.root_cause ?? null,
    })
  }

  const report: ProspectiveReport = {
    generated_at: new Date().toISOString(),
    total_cases: cases.length,
    teachers: DEFAULT_TEACHERS,
    summary: {
      pending: cases.filter((item) => item.feedback_status === 'pending').length,
      matched: cases.filter((item) => item.feedback_status === 'matched').length,
      partial: cases.filter((item) => item.feedback_status === 'partial').length,
      missed: cases.filter((item) => item.feedback_status === 'missed').length,
    },
    cases,
  }

  await Deno.writeTextFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`)
  await Deno.writeTextFile(OUTPUT_MD, renderMarkdown(report))
}

if (import.meta.main) {
  await main()
}
