'use client'

import { useEffect, useState } from 'react'

import { AdminShell } from '@/components/admin-shell'
import { AuthGuard } from '@/components/auth-guard'
import { adminApi } from '@/lib/admin-api'

type AuditSummary = {
  chartText?: string
  source?: string
  dayMaster?: string
  location?: string
  timezone?: string
  localCivilTime?: string
  trueSolarTime?: string
  kongWang?: string
  chartLevelShenSha?: string[]
  fiveElements?: string
}

type AuditTable = {
  columns?: Array<{ key: string; label: string }>
  rows?: Array<{ label: string; values: string[] }>
}

type ChartAnalysis = {
  source?: string
  dayMaster?: { stem?: string; branch?: string; element?: string }
  timing?: {
    timezone?: string
    localCivilTime?: string
    trueSolarTime?: string
    location?: { normalizedName?: string }
  }
  kongWang?: { display?: string }
  nayin?: Record<string, string>
  twelveLifeStages?: Record<string, string>
  shenSha?: {
    byPillar?: Record<string, string[]>
    chartLevel?: string[]
  }
  dayun?: {
    displayAge?: string
    direction?: string
    cycles?: Array<{ ganZhi?: string; range?: string }>
  }
}

const STEM_ELEMENT: Record<string, string> = {
  甲: 'wood',
  乙: 'wood',
  丙: 'fire',
  丁: 'fire',
  戊: 'earth',
  己: 'earth',
  庚: 'metal',
  辛: 'metal',
  壬: 'water',
  癸: 'water',
}

const STEM_POLARITY: Record<string, 'yang' | 'yin'> = {
  甲: 'yang',
  丙: 'yang',
  戊: 'yang',
  庚: 'yang',
  壬: 'yang',
  乙: 'yin',
  丁: 'yin',
  己: 'yin',
  辛: 'yin',
  癸: 'yin',
}

const BRANCH_HIDDEN_STEMS: Record<string, string[]> = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '庚', '戊'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲'],
}

const PILLAR_ORDER = [
  { key: 'year', label: '年柱' },
  { key: 'month', label: '月柱' },
  { key: 'day', label: '日柱' },
  { key: 'hour', label: '时柱' },
] as const

function displayValue(value: unknown) {
  const text = String(value ?? '').trim()
  return text.length === 0 ? '—' : text
}

function chineseSource(value: string | null | undefined) {
  if (!value) return '—'
  if (value === 'verified_engine') return '正式命盘'
  if (value === 'fallback') return '回退命盘'
  if (value === 'first_impression') return '首屏洞察'
  return value
}

function chineseProfileState(value: string | null | undefined) {
  switch (value) {
    case 'verified_ready':
      return '已完成正式首屏'
    case 'needs_profile_rebuild':
      return '需要补录重建'
    case 'preparing_profile':
      return '命盘准备中'
    default:
      return displayValue(value)
  }
}

function chineseDirection(value: string | null | undefined) {
  if (value === 'forward') return '顺行'
  if (value === 'backward') return '逆行'
  return displayValue(value)
}

function chineseDeepCategory(value: string | null | undefined) {
  switch (value) {
    case 'personality_contrast':
      return '人格反差'
    case 'relationship_pattern':
      return '关系惯性'
    case 'current_pain':
      return '当前痛点'
    case 'career_pressure':
      return '职业压力'
    case 'family_role':
      return '家庭角色'
    case 'environment_pattern':
      return '环境负荷'
    case 'verification_pattern':
      return '近期应验'
    case 'life_path_pattern':
      return '人生路径'
    default:
      return displayValue(value)
  }
}

function splitPillar(value: string | undefined) {
  const text = (value ?? '').trim()
  return {
    whole: text,
    stem: text.length >= 1 ? text[0] : '',
    branch: text.length >= 2 ? text[1] : '',
  }
}

function relationOfFiveElement(dayElement: string, otherElement: string) {
  const generateMap: Record<string, string> = {
    wood: 'fire',
    fire: 'earth',
    earth: 'metal',
    metal: 'water',
    water: 'wood',
  }
  const controlMap: Record<string, string> = {
    wood: 'earth',
    fire: 'metal',
    earth: 'water',
    metal: 'wood',
    water: 'fire',
  }

  if (!dayElement || !otherElement) return ''
  if (dayElement === otherElement) return 'same'
  if (generateMap[dayElement] === otherElement) return 'output'
  if (generateMap[otherElement] === dayElement) return 'resource'
  if (controlMap[dayElement] === otherElement) return 'control'
  if (controlMap[otherElement] === dayElement) return 'wealth'
  return ''
}

function tenGod(dayStem: string, otherStem: string) {
  const dayElement = STEM_ELEMENT[dayStem]
  const otherElement = STEM_ELEMENT[otherStem]
  const relation = relationOfFiveElement(dayElement, otherElement)
  const samePolarity = STEM_POLARITY[dayStem] === STEM_POLARITY[otherStem]

  switch (relation) {
    case 'same':
      return samePolarity ? '比肩' : '劫财'
    case 'output':
      return samePolarity ? '食神' : '伤官'
    case 'wealth':
      return samePolarity ? '偏财' : '正财'
    case 'control':
      return samePolarity ? '七杀' : '正官'
    case 'resource':
      return samePolarity ? '偏印' : '正印'
    default:
      return ''
  }
}

function factorEntries(derivedFactors: Record<string, unknown>) {
  const labels: Record<string, string> = {
    strongElement: '强势五行',
    weakElement: '薄弱五行',
    dayElement: '日主五行',
    favorableElement: '喜用倾向',
    unfavorableElement: '忌讳倾向',
    dayStem: '日主天干',
    dayStemStyle: '日主风格',
    dayStage: '日柱长生',
    dayStageMeaning: '长生释义',
    kongWang: '空亡',
    monthRelation: '流月关系',
    dayRelation: '流日关系',
  }

  return Object.entries(derivedFactors)
    .filter(([key, value]) => {
      if (!(key in labels)) return false
      if (Array.isArray(value)) return value.length > 0
      return String(value ?? '').trim().length > 0
    })
    .map(([key, value]) => ({
      label: labels[key],
      value: Array.isArray(value) ? value.join('、') : String(value),
    }))
}

export default function ChartsPage() {
  const [userId, setUserId] = useState('')
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [rerunResult, setRerunResult] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chart = (data?.chart as Record<string, any> | undefined) ?? {}
  const analysis = (chart.analysis as ChartAnalysis | undefined) ?? {}
  const auditView = (data?.auditView as Record<string, any> | undefined) ?? {}
  const summary = (auditView.summary as AuditSummary | undefined) ?? {}
  const flowTable = (auditView.flowTable as AuditTable | undefined) ?? {}
  const insight = (data?.firstImpression as Record<string, any> | undefined) ?? {}
  const insightResponse = (insight.response as Record<string, any> | undefined) ?? {}
  const reviewDraft = (insight.debug?.reviewDraft as Record<string, any> | undefined) ?? {}
  const reasoning = (reviewDraft.reasoning as Record<string, any> | undefined) ?? {}
  const rawTop3 = (insightResponse.top3Insights as Record<string, any>[] | undefined) ?? []
  const reviewTop3 = (reviewDraft.top3Insights as Record<string, any>[] | undefined) ?? []
  const debug = (insight.debug as Record<string, any> | undefined) ?? {}
  const derivedFactors = (debug.derivedFactors as Record<string, unknown> | undefined) ?? {}
  const incidents = (data?.incidents as Record<string, any>[] | undefined) ?? []
  const dayStem = String(analysis.dayMaster?.stem ?? '')

  const summaryLocation =
    summary.location ??
    analysis.timing?.location?.normalizedName ??
    chart.birthplace ??
    ''
  const summaryTimezone =
    summary.timezone ?? analysis.timing?.timezone ?? chart.timezone ?? ''
  const summaryCivilTime =
    summary.localCivilTime ?? analysis.timing?.localCivilTime ?? ''
  const summaryTrueSolar =
    summary.trueSolarTime ?? analysis.timing?.trueSolarTime ?? ''
  const summaryKongWang =
    summary.kongWang ?? analysis.kongWang?.display ?? ''
  const summaryFiveElements = summary.fiveElements ?? ''
  const summaryChartLevelShenSha =
    summary.chartLevelShenSha ?? analysis.shenSha?.chartLevel ?? []
  const dayunCycles = analysis.dayun?.cycles ?? []

  async function loadAudit(nextUserId: string) {
    setLoading(true)
    setError(null)
    try {
      setRerunResult(null)
      setData(await adminApi.firstImpressionDebug(nextUserId))
    } catch (err) {
      setError(String(err))
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const initialUserId = new URLSearchParams(window.location.search).get('user') ?? ''
    if (!initialUserId) return
    setUserId(initialUserId)
    void loadAudit(initialUserId)
  }, [])

  return (
    <AuthGuard>
      <AdminShell
        title="命盘与首屏洞察"
        description="按 user_id 查看中文审盘表、流转、大运、首屏三条原稿与内部因子。"
      >
        <div className="toolbar">
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="输入 user id"
          />
          <button
            className="button"
            disabled={loading || !userId}
            onClick={() => void loadAudit(userId)}
          >
            {loading ? '读取中…' : '加载审盘'}
          </button>
          <button
            className="button secondary"
            disabled={loading || !userId}
            onClick={async () => {
              setLoading(true)
              setError(null)
              try {
                const result = await adminApi.rerunFirstImpression(userId)
                setRerunResult(result)
                setData(await adminApi.firstImpressionDebug(userId))
              } catch (err) {
                setError(String(err))
              } finally {
                setLoading(false)
              }
            }}
          >
            重跑首屏洞察
          </button>
        </div>

        {error ? (
          <div className="card" style={{ color: 'var(--bad)' }}>
            {error}
          </div>
        ) : null}

        {rerunResult ? (
          <div className="card">
            <h3>重跑结果</h3>
            <div className="pre">{JSON.stringify(rerunResult, null, 2)}</div>
          </div>
        ) : null}

        {data ? (
          <div className="stack">
            <div className="split">
              <div className="card">
                <h3>命盘摘要</h3>
                <div className="kv-list">
                  <div className="kv-row">
                    <span className="muted">渲染来源</span>
                    <span>{displayValue(insight.renderSource)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">命盘来源</span>
                    <span>{chineseSource(summary.source ?? chart.source ?? analysis?.source)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">命盘文本</span>
                    <span>{displayValue(summary.chartText ?? chart.chart_text)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">日主</span>
                    <span>{displayValue(summary.dayMaster)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">五行分布</span>
                    <span>{displayValue(summaryFiveElements)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">命盘级神煞</span>
                    <span>{displayValue(summaryChartLevelShenSha.join('、'))}</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>时间与状态</h3>
                <div className="kv-list">
                  <div className="kv-row">
                    <span className="muted">地点</span>
                    <span>{displayValue(summaryLocation)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">时区</span>
                    <span>{displayValue(summaryTimezone)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">民用时间</span>
                    <span>{displayValue(summaryCivilTime)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">真太阳时</span>
                    <span>{displayValue(summaryTrueSolar)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">空亡</span>
                    <span>{displayValue(summaryKongWang)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">当前状态</span>
                    <span>{chineseProfileState(insight.state)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>四柱审盘表</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>项目</th>
                      {PILLAR_ORDER.map((pillar) => (
                        <th key={pillar.key}>{pillar.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>主星</td>
                      {PILLAR_ORDER.map((pillar) => {
                        const stem = splitPillar(chart.pillars?.[pillar.key]).stem
                        return <td key={`star-${pillar.key}`}>{displayValue(tenGod(dayStem, stem))}</td>
                      })}
                    </tr>
                    <tr>
                      <td>天干</td>
                      {PILLAR_ORDER.map((pillar) => (
                        <td key={`stem-${pillar.key}`}>{displayValue(splitPillar(chart.pillars?.[pillar.key]).stem)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td>地支</td>
                      {PILLAR_ORDER.map((pillar) => (
                        <td key={`branch-${pillar.key}`}>{displayValue(splitPillar(chart.pillars?.[pillar.key]).branch)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td>藏干</td>
                      {PILLAR_ORDER.map((pillar) => {
                        const branch = splitPillar(chart.pillars?.[pillar.key]).branch
                        return <td key={`hidden-${pillar.key}`}>{displayValue((BRANCH_HIDDEN_STEMS[branch] ?? []).join(' '))}</td>
                      })}
                    </tr>
                    <tr>
                      <td>干支</td>
                      {PILLAR_ORDER.map((pillar) => (
                        <td key={`whole-${pillar.key}`}>{displayValue(splitPillar(chart.pillars?.[pillar.key]).whole)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td>纳音</td>
                      {PILLAR_ORDER.map((pillar) => (
                        <td key={`nayin-${pillar.key}`}>{displayValue(analysis.nayin?.[pillar.key])}</td>
                      ))}
                    </tr>
                    <tr>
                      <td>星运</td>
                      {PILLAR_ORDER.map((pillar) => (
                        <td key={`life-${pillar.key}`}>{displayValue(analysis.twelveLifeStages?.[pillar.key])}</td>
                      ))}
                    </tr>
                    <tr>
                      <td>神煞</td>
                      {PILLAR_ORDER.map((pillar) => (
                        <td key={`shensha-${pillar.key}`}>{displayValue((analysis.shenSha?.byPillar?.[pillar.key] ?? []).join('、'))}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3>大运</h3>
              <div className="kv-list" style={{ marginBottom: 16 }}>
                <div className="kv-row">
                  <span className="muted">起运</span>
                  <span>{displayValue(analysis.dayun?.displayAge)}</span>
                </div>
                <div className="kv-row">
                  <span className="muted">方向</span>
                  <span>{chineseDirection(analysis.dayun?.direction)}</span>
                </div>
              </div>
              {dayunCycles.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>序号</th>
                        <th>大运</th>
                        <th>年龄区间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayunCycles.map((cycle, index) => (
                        <tr key={`${cycle.ganZhi ?? 'dayun'}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{displayValue(cycle.ganZhi)}</td>
                          <td>{displayValue(cycle.range)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="muted">当前没有可用的大运数据。</div>
              )}
            </div>

            <div className="card">
              <h3>流年流月流日</h3>
              {flowTable.columns?.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>项目</th>
                        {flowTable.columns.map((column) => (
                          <th key={column.key}>{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(flowTable.rows ?? []).map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          {(row.values ?? []).map((value, index) => (
                            <td key={`${row.label}-${index}`}>{displayValue(value)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="muted">当前流转尚未生成。</div>
              )}
            </div>

            <div className="card">
              <h3>八字推理稿（人工审核版）</h3>
              {reviewDraft?.reasoning?.ranking ? (
                <div className="split" style={{ marginBottom: 16 }}>
                  <div className="card inset-card">
                    <h4>最像本人</h4>
                    <div>{displayValue(reviewDraft.reasoning.ranking.mostLikePerson)}</div>
                  </div>
                  <div className="card inset-card">
                    <h4>当前最痛</h4>
                    <div>{displayValue(reviewDraft.reasoning.ranking.currentPain)}</div>
                  </div>
                  <div className="card inset-card">
                    <h4>最容易验证</h4>
                    <div>{displayValue(reviewDraft.reasoning.ranking.mostVerifiable)}</div>
                  </div>
                </div>
              ) : null}
              {reasoning.preferredDeepCategory || reasoning.selectedRulePool?.length ? (
                <div className="card inset-card" style={{ marginBottom: 16 }}>
                  <h4>今日深层命中路径</h4>
                  <div className="kv-list" style={{ marginBottom: 12 }}>
                    <div className="kv-row">
                      <span className="muted">今日优先类别</span>
                      <span>{chineseDeepCategory(reasoning.preferredDeepCategory)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">今日切口</span>
                      <span>{displayValue(reasoning.dailyDeepTitle)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">命中类型</span>
                      <span>{displayValue(reasoning.selectedDeepKind)}</span>
                    </div>
                    <div className="kv-row">
                      <span className="muted">候选池规模</span>
                      <span>{displayValue(reasoning.deepCandidateCount)}</span>
                    </div>
                  </div>
                  {Array.isArray(reasoning.selectedRulePool) && reasoning.selectedRulePool.length ? (
                    <div className="stack">
                      {reasoning.selectedRulePool.map((rule: Record<string, any>, index: number) => (
                        <div key={`${rule.id ?? 'rule'}-${index}`} className="card inset-card">
                          <div style={{ fontWeight: 700 }}>{displayValue(rule.id)}</div>
                          <div className="muted" style={{ marginTop: 6 }}>{displayValue(rule.reason)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="muted">今天这条深层命中暂时没有可展示的规则池。</div>
                  )}
                  {reasoning.audienceSignals ? (
                    <div className="card inset-card" style={{ marginTop: 12 }}>
                      <h4>用户关注权重（非玄学软筛选）</h4>
                      <div className="kv-list" style={{ marginBottom: 12 }}>
                        <div className="kv-row">
                          <span className="muted">性别</span>
                          <span>{displayValue(reasoning.audienceSignals.gender)}</span>
                        </div>
                        <div className="kv-row">
                          <span className="muted">年龄带</span>
                          <span>{displayValue(reasoning.audienceSignals.ageBand)}</span>
                        </div>
                        <div className="kv-row">
                          <span className="muted">英语/西方受众</span>
                          <span>{reasoning.audienceSignals.isWesternAudience ? '是' : '否'}</span>
                        </div>
                        <div className="kv-row">
                          <span className="muted">类别权重</span>
                          <span>{displayValue(Object.entries(reasoning.audienceSignals.categoryWeights ?? {}).map(([k, v]) => `${chineseDeepCategory(k)}:${v}`).join('；'))}</span>
                        </div>
                      </div>
                      {Array.isArray(reasoning.audienceSignals.notes) && reasoning.audienceSignals.notes.length ? (
                        <div className="stack">
                          {reasoning.audienceSignals.notes.map((note: string, index: number) => (
                            <div key={`audience-note-${index}`} className="muted">{note}</div>
                          ))}
                        </div>
                      ) : (
                        <div className="muted">当前这位用户还没有触发额外的用户关注权重。</div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="stack">
                <div className="card inset-card">
                  <h4>主题句</h4>
                  <div>{displayValue(reviewDraft.headline ?? insightResponse.headline)}</div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    主线：{displayValue(reviewDraft.theme ?? insightResponse.theme)}
                  </div>
                </div>
                {(reviewTop3.length ? reviewTop3 : rawTop3).length ? (reviewTop3.length ? reviewTop3 : rawTop3).map((item, index) => (
                  <div key={`${item.eyebrow ?? 'insight'}-${index}`} className="card inset-card">
                    <h4>{displayValue(item.eyebrow ?? `洞察 ${index + 1}`)}</h4>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      {displayValue(item.title)}
                    </div>
                    <div>{displayValue(item.body)}</div>
                  </div>
                )) : (
                  <div className="muted">这位用户当前没有可用的八字推理稿。</div>
                )}
              </div>
            </div>

            <div className="split">
              <div className="card">
                <h3>内部命中因子</h3>
                <div className="stack">
                  {factorEntries(derivedFactors).length ? factorEntries(derivedFactors).map((entry) => (
                    <div key={entry.label} className="kv-row">
                      <span className="muted">{entry.label}</span>
                      <span>{displayValue(entry.value)}</span>
                    </div>
                  )) : (
                    <div className="muted">暂无内部命中因子。</div>
                  )}
                </div>
              </div>
              <div className="card">
                <h3>内部事件</h3>
                {incidents.length ? (
                  <div className="stack">
                    {incidents.map((incident, index) => (
                      <div key={`${incident.event_key ?? 'incident'}-${index}`} className="card inset-card">
                        <div style={{ fontWeight: 700 }}>{displayValue(incident.incident_type)}</div>
                        <div className="muted">{displayValue(incident.message)}</div>
                        <div className="muted" style={{ marginTop: 6 }}>
                          状态：{displayValue(incident.status)} · 严重级别：{displayValue(incident.severity)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted">暂无内部事件。</div>
                )}
              </div>
            </div>

            <div className="card">
              <details className="debug-disclosure">
                <summary>展开原始调试 JSON（仅开发排查时使用）</summary>
                <div className="pre" style={{ marginTop: 16 }}>
                  {JSON.stringify(data, null, 2)}
                </div>
              </details>
            </div>
          </div>
        ) : (
          <div className="card">输入 user id 后可查看中文审盘页、流转、大运、首屏原稿和内部因子。</div>
        )}
      </AdminShell>
    </AuthGuard>
  )
}
