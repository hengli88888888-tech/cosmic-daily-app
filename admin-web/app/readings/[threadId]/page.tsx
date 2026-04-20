'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
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

function teacherRunDecisionLabel(run: Record<string, any>) {
  const normalized = (run.normalized_decision ?? null) as Record<string, any> | null
  const label = String(normalized?.label ?? '').trim()
  const timing = String(normalized?.timing_bucket ?? '').trim()
  if (label && timing && timing !== 'mixed') return `${label} / ${timing}`
  if (label) return label
  return displayValue(run.main_judgment)
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

function documentSupportLabel(item: Record<string, any>) {
  if (String(item.source_type ?? '') !== 'document') return null
  const traceKind = String(item.trace_kind ?? '')
  if (traceKind === 'term') return '文档术语校正'
  if (traceKind === 'conflict') return '文档冲突说明'
  return '文档补边命中'
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

export default function ReadingDetailPage() {
  const params = useParams<{ threadId: string }>()
  const threadId = params.threadId
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [routingReport, setRoutingReport] = useState<Record<string, any> | null>(null)

  useEffect(() => {
    adminApi.readingDetail(threadId).then((result) => setData(result))
    adminApi.qimenTeacherRoutingReport().then((result) => setRoutingReport((result.report ?? null) as Record<string, any> | null)).catch(() => setRoutingReport(null))
  }, [threadId])

  const events = ((data?.events as Record<string, any>[] | undefined) ?? [])
  const deliveredPayloads = events
    .filter((event) => String(event.event_type ?? '') === 'delivered')
    .map((event) => (event.payload ?? event.payload_json ?? {}) as Record<string, any>)
  const latestDelivered = deliveredPayloads[0] ?? {}
  const qimenChart = (latestDelivered.knowledge_evidence?.qimen_chart ?? null) as Record<string, any> | null
  const qimenLayout = preferredQimenLayout(qimenChart)
  const qimenReasoning = (latestDelivered.knowledge_evidence?.qimen_reasoning ?? null) as Record<string, any> | null
  const qimenVectorMatches = ((latestDelivered.knowledge_evidence?.qimen_vector_matches as Record<string, any>[] | undefined) ?? [])
  const chainCoverage = (qimenReasoning?.chain_coverage ?? null) as Record<string, any> | null
  const foundationTheorySupport = (qimenReasoning?.foundation_theory_support ?? null) as Record<string, any> | null
  const teacherPolicy = (qimenReasoning?.teacher_policy ?? null) as Record<string, any> | null
  const teacherRuns = ((qimenReasoning?.teacher_runs as Record<string, any>[] | undefined) ?? [])
  const consensusLevel = String(qimenReasoning?.consensus_level ?? '')
  const consensusSummary = String(qimenReasoning?.consensus_summary ?? '')
  const disagreementPoints = ((qimenReasoning?.disagreement_points as string[] | undefined) ?? [])
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
  const tieredSupports = groupByKnowledgeTier([
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

  return (
    <AuthGuard>
      <AdminShell
        title="Reading Detail"
        description="Inspect the full thread, answers, events, and chart context."
      >
        {data ? (
          <div className="stack">
          <div className="split">
            <div className="card">
              <h3>Thread</h3>
                <div className="kv-list">
                  <div className="kv-row">
                    <span className="muted">Thread ID</span>
                    <span>{String(data.thread?.id ?? threadId)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">System</span>
                    <span>{String(data.thread?.divination_system ?? '—')}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Profile</span>
                    <span>{String(data.thread?.divination_profile ?? '—')}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Status</span>
                    <span>{String(data.thread?.status ?? '—')}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Created</span>
                    <span>{String(data.thread?.created_at ?? '—')}</span>
                  </div>
              </div>
            </div>
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
                {qimenReasoning ? (
                  <div style={{ marginTop: 12 }}>
                    {((routingReport.by_question_type as Record<string, any>[] | undefined) ?? [])
                      .filter((item) => String(item.question_type ?? '') === String(qimenReasoning.question_type ?? ''))
                      .map((item, index) => (
                        <div key={`thread-routing-${index}`} className="card inset-card">
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
                ) : null}
              </div>
            ) : null}
            <div className="card">
              <h3>User</h3>
                <div className="kv-list">
                  <div className="kv-row">
                    <span className="muted">User ID</span>
                    <span>{String(data.user?.id ?? '—')}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Email</span>
                    <span>{String(data.user?.email ?? 'Anonymous')}</span>
                  </div>
                </div>
                {data.user?.id ? (
                  <div style={{ marginTop: 12 }}>
                    <Link className="button secondary" href={`/users/${String(data.user.id)}`}>
                      Open user detail
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
            {(String(data.thread?.status ?? '') === 'awaiting_user_info' || clarification) ? (
              <div className="card">
                <h3>System clarification requested</h3>
                <div className="muted" style={{ marginBottom: 8 }}>
                  This thread is waiting for more user detail. The current answer is a follow-up question, not a final reading.
                </div>
                <div style={{ fontWeight: 700 }}>{displayValue(clarification?.prompt)}</div>
                <div className="muted" style={{ marginTop: 8 }}>
                  Reason: {displayValue(clarification?.reason)}
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  Requested fields: {Array.isArray(clarification?.requested_fields) ? clarification.requested_fields.join(', ') : '—'}
                </div>
              </div>
            ) : null}
            {enteredFormalAfterClarification ? (
              <div className="card">
                <h3>正式结论（已补充信息）</h3>
                <div className="muted">
                  这条线程先经过系统追问，用户补充关键信息后才进入正式断事。
                </div>
              </div>
            ) : null}
            <div className="card">
              <h3>Conversation</h3>
              <div className="stack">
                {((data.questions as Record<string, any>[] | undefined) ?? []).map((question) => (
                  <div key={String(question.id)} className="card inset-card">
                    <div className="muted">
                      {String(question.created_at ?? '—')} · {String(question.question_kind ?? 'question')} · {String(question.coin_cost ?? 0)} coins
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>
                      {String(question.question_text ?? '—')}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {String(question.answer_text ?? 'No stored answer text.')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="split">
              <div className="card">
                <h3>Events</h3>
                <div className="stack">
                  {((data.events as Record<string, any>[] | undefined) ?? []).length ? (
                    ((data.events as Record<string, any>[] | undefined) ?? []).map((event) => (
                      <div key={String(event.id)} className="card inset-card">
                        <div className="muted">{String(event.created_at ?? '—')}</div>
                        <div style={{ marginTop: 8, fontWeight: 700 }}>
                          {String(event.event_type ?? 'event')}
                        </div>
                        <div style={{ marginTop: 8 }} className="pre">
                          {JSON.stringify(event.payload ?? event, null, 2)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="muted">No events recorded.</div>
                  )}
                </div>
              </div>
              <div className="card">
                <h3>Chart</h3>
                <div className="kv-list">
                  <div className="kv-row">
                    <span className="muted">Chart text</span>
                    <span>{String(data.chart?.chart_text ?? '—')}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Source</span>
                    <span>{String(data.chart?.analysis?.source ?? '—')}</span>
                  </div>
                </div>
                {data.user?.id ? (
                  <div style={{ marginTop: 12 }}>
                    <Link className="button secondary" href={`/charts?user=${String(data.user.id)}`}>
                      Open chart audit
                    </Link>
                  </div>
                ) : null}
                {String(data.thread?.divination_system ?? '') === 'qimen_yang' ? (
                  <div style={{ marginTop: 12 }}>
                    <Link className="button secondary" href={`/qimen?thread=${String(data.thread?.id ?? threadId)}`}>
                      Open QiMen audit
                    </Link>
                  </div>
                ) : null}
                {qimenLayout ? (
                  <div style={{ marginTop: 16 }}>
                    <div className="muted" style={{ marginBottom: 8 }}>网页式盘面</div>
                    <div className="pre">{qimenLayout}</div>
                  </div>
                ) : null}
              </div>
            </div>
            {String(data?.thread?.divination_system ?? '') === 'qimen_yang' && qimenReasoning ? (
              <div className="card">
                <h3>奇门推理链</h3>
                <div className="split" style={{ marginBottom: 16 }}>
                  <div className="card inset-card">
                    <h4>题型与主结论</h4>
                    <div className="kv-list">
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
                    </div>
                    <div style={{ marginTop: 12, fontWeight: 700 }}>
                      {displayValue(qimenReasoning.decision?.main_judgment)}
                    </div>
                    {teacherPolicy?.routing_reason ? (
                      <div className="muted" style={{ marginTop: 8 }}>
                        老师路由：{displayValue(teacherPolicy.routing_reason)}
                      </div>
                    ) : null}
                    <div className="muted" style={{ marginTop: 8 }}>
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
                    {chainCoverage ? (
                      <div className="muted" style={{ marginTop: 12 }}>
                        链路完整度：{chainCoverageLabel(String(chainCoverage.completeness_level ?? ''))} ·
                        当前缺口：{Array.isArray(chainCoverage.current_gap_layers) && chainCoverage.current_gap_layers.length
                          ? chainCoverage.current_gap_layers.map((item: unknown) => chainLayerLabel(String(item))).join('、')
                          : '无'}
                      </div>
                    ) : null}
                    {chainCoverage ? (
                      <div className="muted" style={{ marginTop: 8 }}>
                        缺失层：{Array.isArray(chainCoverage.missing_layers) && chainCoverage.missing_layers.length
                          ? chainCoverage.missing_layers.map((item: unknown) => chainLayerLabel(String(item))).join('、')
                          : '无'}
                      </div>
                    ) : null}
                    {chainCoverage ? (
                      <div className="muted" style={{ marginTop: 8 }}>
                        独立断事：{['full', 'strong'].includes(String(chainCoverage.completeness_level ?? '')) ? '可以' : '暂不建议'}
                      </div>
                    ) : null}
                    {Array.isArray(foundationTheorySupport?.lessons) && foundationTheorySupport.lessons.length ? (
                      <div className="muted" style={{ marginTop: 8 }}>
                        理论基础支撑：{foundationTheorySupport.lessons.map((item: Record<string, any>) => displayValue(item.lesson_title)).join('、')}
                      </div>
                    ) : null}
                  </div>
                  <div className="card inset-card">
                    <h4>盘面主证据</h4>
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
                        <span>{displayValue(qimenChart?.solar_term ?? qimenReasoning.chart_summary?.solar_term)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">局数</span>
                        <span>{displayValue(qimenChart?.bureau_number ?? qimenReasoning.chart_summary?.bureau_number)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">值符</span>
                        <span>{displayValue(qimenChart?.zhi_fu ?? qimenReasoning.chart_summary?.zhi_fu)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">值使</span>
                        <span>{displayValue(qimenChart?.zhi_shi ?? qimenReasoning.chart_summary?.zhi_shi)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">旬首</span>
                        <span>{displayValue(qimenChart?.xun_shou ?? qimenReasoning.chart_summary?.xun_shou)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">起盘时间</span>
                        <span>{displayValue(qimenChart?.local_datetime)}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">空亡宫位</span>
                        <span>{displayValue((qimenReasoning.extracted_evidence?.empty_palaces ?? []).join('、'))}</span>
                      </div>
                      <div className="kv-row">
                        <span className="muted">马星</span>
                        <span>{displayValue(qimenReasoning.extracted_evidence?.horse_palace)}</span>
                      </div>
                    </div>
                    {qimenLayout ? (
                      <div className="pre" style={{ marginTop: 16 }}>
                        {qimenLayout}
                      </div>
                    ) : null}
                  </div>
                </div>

                {chainCoverage ? (
                  <div className="card inset-card" style={{ marginBottom: 16 }}>
                    <h4>链路完整度</h4>
                    <div className="muted" style={{ marginBottom: 12 }}>
                      {displayValue(chainCoverage.advisory)}
                    </div>
                    <div className="kv-list">
                      {['rules', 'cases', 'patterns', 'terms', 'conflicts'].map((key) => (
                        <div key={`reading-coverage-${key}`} className="kv-row">
                          <span className="muted">{chainLayerLabel(key)}</span>
                          <span>{chainLayerSummary((chainCoverage.counts ?? {})[key] as Record<string, any> | undefined)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {qimenVectorMatches.length ? (
                  <div className="card inset-card" style={{ marginBottom: 16 }}>
                    <h4>向量命中</h4>
                    <div className="stack">
                      {qimenVectorMatches.map((item, index) => (
                        <div key={`${item.title ?? 'vector-match'}-${index}`} className="card inset-card">
                          <div style={{ fontWeight: 700 }}>{displayValue(item.title)}</div>
                          <div className="muted" style={{ marginTop: 6 }}>
                            similarity {displayValue(item.similarity)} · {displayValue(item.question_type)} · {displayValue(item.collection)}
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

                {Array.isArray(foundationTheorySupport?.lessons) && foundationTheorySupport.lessons.length ? (
                  <div className="card inset-card" style={{ marginBottom: 16 }}>
                    <h4>理论基础支撑</h4>
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
                  <div className="card inset-card" style={{ marginBottom: 16 }}>
                    <h4>多老师实验结果</h4>
                    <div className="muted" style={{ marginBottom: 12 }}>
                      {displayValue(consensusSummary)} · {consensusLevelLabel(consensusLevel)}
                    </div>
                    <div className="muted" style={{ marginBottom: 12 }}>
                      分歧点：{disagreementPoints.length ? disagreementPoints.join('、') : '无'}
                    </div>
                    <div className="stack">
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
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="card inset-card" style={{ marginBottom: 16 }}>
                  <h4>推理顺序</h4>
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

                <div className="split" style={{ marginBottom: 16 }}>
                  {[
                    { title: '主判断卡', items: tieredSupports.core },
                    { title: '辅助校准卡', items: tieredSupports.support },
                    { title: '背景参考卡', items: tieredSupports.reference },
                  ].map(({ title, items }) => (
                    <div key={title} className="card inset-card">
                      <h4>{title}</h4>
                      <div className="stack">
                        {Array.isArray(items) && items.length ? items.slice(0, 5).map((item: Record<string, any>, index: number) => (
                          <div key={`${item.id ?? title}-${index}`} className="card inset-card">
                            <div style={{ fontWeight: 700 }}>{displayValue(item.title)}</div>
                            <div className="muted" style={{ marginTop: 6 }}>
                              {displayValue(item.source_teacher)} · {displayValue(item.source_type)} · score {displayValue(item.score)}
                            </div>
                            {tierOriginLabel(item) ? (
                              <div className="muted" style={{ marginTop: 6 }}>
                                {tierOriginLabel(item)}
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

                {Array.isArray(qimenReasoning.feedback_learning?.tier_adjustment_suggestions) && qimenReasoning.feedback_learning.tier_adjustment_suggestions.length ? (
                  <div className="card inset-card" style={{ marginBottom: 16 }}>
                    <h4>建议降级卡片</h4>
                    <div className="stack">
                      {qimenReasoning.feedback_learning.tier_adjustment_suggestions.slice(0, 4).map((item: Record<string, any>) => (
                        <div key={String(item.id ?? item.title ?? 'tier-adjust')} className="card inset-card">
                          <div style={{ fontWeight: 700 }}>{displayValue(item.title)}</div>
                          <div className="muted" style={{ marginTop: 6 }}>
                            当前层级：{chineseKnowledgeTier(String(item.current_tier ?? ''))} → 建议层级：{chineseKnowledgeTier(String(item.suggested_tier ?? ''))}
                          </div>
                          <div className="muted" style={{ marginTop: 6 }}>
                            总降权：-{displayValue(item.feedback_penalty)} · 卡片问题 -{displayValue(item.id_penalty)} · 错步类型 -{displayValue(item.step_penalty)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {documentSupports.length ? (
                  <div className="card inset-card" style={{ marginBottom: 16 }}>
                    <h4>文档补边命中</h4>
                    <div className="muted" style={{ marginBottom: 12 }}>
                      这些卡只用于术语校正、冲突说明和补边，不参与主判断主线竞争。
                    </div>
                    <div className="stack">
                      {documentSupports.slice(0, 6).map((item, index) => (
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

                <div className="split">
                  {[
                    ['命中规则卡', qimenReasoning.matched_rules],
                    ['命中案例卡', qimenReasoning.matched_cases],
                    ['命中路径卡', qimenReasoning.matched_patterns],
                    ['命中术语卡', qimenReasoning.matched_terms],
                    ['命中冲突卡', qimenReasoning.matched_conflicts],
                  ].map(([title, items]) => (
                    <div key={String(title)} className="card inset-card">
                      <h4>{title}</h4>
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
                            {documentSupportLabel(item) ? (
                              <div className="muted" style={{ marginTop: 6 }}>
                                {documentSupportLabel(item)}
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
                            {Number(item.feedback_penalty ?? 0) > 0 ? (
                              <div className="muted" style={{ marginTop: 6 }}>
                                历史降权：-{displayValue(item.feedback_penalty)}
                                {Number(item.id_penalty ?? 0) > 0 ? ` · 卡片问题 -${displayValue(item.id_penalty)}` : ''}
                                {Number(item.step_penalty ?? 0) > 0 ? ` · 错步类型 -${displayValue(item.step_penalty)}` : ''}
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
            ) : null}
            <div className="card">
              <h3>Raw thread payload</h3>
              <div className="pre">{JSON.stringify(data, null, 2)}</div>
            </div>
          </div>
        ) : (
          <div className="card">Loading thread…</div>
        )}
      </AdminShell>
    </AuthGuard>
  )
}
