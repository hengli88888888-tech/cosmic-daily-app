import type { CurrentFlow, ChartResult, ResolvedLocation } from './chart-engine.ts'

type PillarKey = 'year' | 'month' | 'day' | 'hour'

type StoredChartLike = {
  source?: 'verified_engine' | 'fallback'
  chart_text?: string
  pillars?: Partial<Record<PillarKey, string>>
  analysis?: {
    source?: 'verified_engine' | 'fallback'
    dayMaster?: {
      stem?: string
      branch?: string
      element?: string
    }
    fiveElements?: Record<string, number>
    strongElement?: string | null
    weakElement?: string | null
    nayin?: Partial<Record<PillarKey, string>>
    twelveLifeStages?: Partial<Record<PillarKey, string>>
    kongWang?: {
      display?: string
    }
    shenSha?: {
      byPillar?: Partial<Record<PillarKey, string[]>>
      chartLevel?: string[]
    }
    timing?: {
      localCivilTime?: string
      trueSolarTime?: string
      timezone?: string
      dstApplied?: boolean
      location?: {
        normalizedName?: string
        country?: string | null
        region?: string | null
        latitude?: number
        longitude?: number
        source?: string
      }
    }
  }
}

type StoredTimingLocation = NonNullable<
  NonNullable<StoredChartLike['analysis']>['timing']
>['location']

type AuditColumn = {
  key: string
  label: string
}

type AuditRow = {
  label: string
  values: string[]
}

export type BaziAuditView = {
  summary: {
    chartText: string
    source: string
    dayMaster: string
    location: string
    timezone: string
    localCivilTime: string
    trueSolarTime: string
    kongWang: string
    chartLevelShenSha: string[]
    fiveElements: string
  }
  natalTable: {
    columns: AuditColumn[]
    rows: AuditRow[]
  }
  flowTable: {
    columns: AuditColumn[]
    rows: AuditRow[]
  } | null
  readableLines: string[]
}

function splitPillar(value: string | undefined) {
  const text = (value ?? '').trim()
  if (text.length >= 2) {
    return {
      stem: text[0],
      branch: text[1],
      whole: text,
    }
  }
  return {
    stem: '',
    branch: '',
    whole: text,
  }
}

function formatLocation(location?: {
  normalizedName?: string
  country?: string | null
  region?: string | null
}) {
  const normalized = (location?.normalizedName ?? '').trim()
  if (normalized.isNotEmpty) return normalized
  return ''
}

function locationTimezone(
  location?: ResolvedLocation | StoredTimingLocation | null,
) {
  if (!location || typeof location !== 'object') return ''
  return 'timezone' in location && typeof location.timezone === 'string'
    ? location.timezone
    : ''
}

function formatFiveElements(fiveElements?: Record<string, number>) {
  const order = [
    ['木', 'wood'],
    ['火', 'fire'],
    ['土', 'earth'],
    ['金', 'metal'],
    ['水', 'water'],
  ] as const
  return order
    .map(([label, key]) => `${label}${fiveElements?.[key] ?? 0}`)
    .join(' / ')
}

function natalRowValues(
  keys: PillarKey[],
  resolver: (key: PillarKey) => string,
) {
  return keys.map((key) => resolver(key))
}

function flowRowValues(
  flow: CurrentFlow | null,
  resolver: (scope: 'liuNian' | 'liuYue' | 'liuRi') => string,
) {
  if (!flow) return []
  return (['liuNian', 'liuYue', 'liuRi'] as const).map((scope) => resolver(scope))
}

export function buildBaziAuditView(
  chart: StoredChartLike | ChartResult | null,
  options: {
    currentFlow?: CurrentFlow | null
    resolvedLocation?: ResolvedLocation | null
  } = {},
): BaziAuditView | null {
  if (!chart) return null

  const pillars = chart.pillars ?? {}
  const analysis = chart.analysis ?? {}
  const timing = analysis.timing ?? {}
  const location = options.resolvedLocation ?? timing.location
  const currentFlow = options.currentFlow ?? ('currentFlow' in chart ? chart.currentFlow ?? null : null)

  const pillarKeys: PillarKey[] = ['year', 'month', 'day', 'hour']
  const columns = [
    { key: 'year', label: '年柱' },
    { key: 'month', label: '月柱' },
    { key: 'day', label: '日柱' },
    { key: 'hour', label: '时柱' },
  ]

  const natalTable = {
    columns,
    rows: [
      {
        label: '天干',
        values: natalRowValues(pillarKeys, (key) => splitPillar(pillars[key]).stem),
      },
      {
        label: '地支',
        values: natalRowValues(pillarKeys, (key) => splitPillar(pillars[key]).branch),
      },
      {
        label: '干支',
        values: natalRowValues(pillarKeys, (key) => splitPillar(pillars[key]).whole),
      },
      {
        label: '纳音',
        values: natalRowValues(pillarKeys, (key) => (analysis.nayin?.[key] ?? '').trim()),
      },
      {
        label: '长生',
        values: natalRowValues(pillarKeys, (key) => (analysis.twelveLifeStages?.[key] ?? '').trim()),
      },
      {
        label: '柱神煞',
        values: natalRowValues(
          pillarKeys,
          (key) => (analysis.shenSha?.byPillar?.[key] ?? []).join('、'),
        ),
      },
    ],
  }

  const flowTable = currentFlow
    ? {
        columns: [
          { key: 'liuNian', label: '流年' },
          { key: 'liuYue', label: '流月' },
          { key: 'liuRi', label: '流日' },
        ],
        rows: [
          {
            label: '干支',
            values: flowRowValues(currentFlow, (scope) => currentFlow[scope].pillar),
          },
          {
            label: '纳音',
            values: flowRowValues(currentFlow, (scope) => currentFlow[scope].nayin),
          },
          {
            label: '长生',
            values: flowRowValues(currentFlow, (scope) => currentFlow[scope].twelveLifeStage),
          },
          {
            label: '空亡',
            values: flowRowValues(currentFlow, (scope) =>
              scope == 'liuRi' ? currentFlow.liuRi.kongWang.display : '',
            ),
          },
        ],
      }
    : null

  const dayMasterStem = analysis.dayMaster?.stem ?? ''
  const dayMasterBranch = analysis.dayMaster?.branch ?? ''
  const dayMasterElement = analysis.dayMaster?.element ?? ''
  const source = chart.source ?? analysis.source ?? ''
  const chartText = chart.chart_text ?? ('chartText' in chart ? chart.chartText : '') ?? ''
  const locationName = formatLocation(location)
  const timezone = timing.timezone ?? locationTimezone(location)
  const localCivilTime = timing.localCivilTime ?? ''
  const trueSolarTime = timing.trueSolarTime ?? ''
  const kongWang = analysis.kongWang?.display ?? ''
  const chartLevelShenSha = analysis.shenSha?.chartLevel ?? []

  const readableLines = [
    `命盘：${chartText}`,
    `日主：${dayMasterStem}${dayMasterBranch}${dayMasterElement ? ` · ${dayMasterElement}` : ''}`,
    timezone ? `时区：${timezone}` : '',
    locationName ? `地点：${locationName}` : '',
    localCivilTime ? `民用时间：${localCivilTime}` : '',
    trueSolarTime ? `真太阳时：${trueSolarTime}` : '',
    kongWang ? `空亡：${kongWang}` : '',
    chartLevelShenSha.length > 0 ? `命盘级神煞：${chartLevelShenSha.join('、')}` : '',
    analysis.fiveElements ? `五行分布：${formatFiveElements(analysis.fiveElements)}` : '',
  ].filter((line) => line.isNotEmpty)

  return {
    summary: {
      chartText,
      source,
      dayMaster: `${dayMasterStem}${dayMasterBranch}${dayMasterElement ? ` · ${dayMasterElement}` : ''}`,
      location: locationName,
      timezone,
      localCivilTime,
      trueSolarTime,
      kongWang,
      chartLevelShenSha,
      fiveElements: formatFiveElements(analysis.fiveElements),
    },
    natalTable,
    flowTable,
    readableLines,
  }
}
