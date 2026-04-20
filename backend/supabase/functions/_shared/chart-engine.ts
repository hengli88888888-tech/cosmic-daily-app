import { DateTime } from 'npm:luxon@3.5.0'
import tzLookup from 'npm:tz-lookup@6.1.25'
import { GENERATED_SOLAR_TERM_TABLE } from './generated-solar-term-table.ts'

export type SaveProfileInput = {
  dob?: string
  tob?: string | null
  gender?: string | null
  birthplace?: string
  timezone?: string | null
  birthplace_latitude?: number | null
  birthplace_longitude?: number | null
  intent?: string | null
  language?: string | null
}

type ElementLabel = 'wood' | 'fire' | 'earth' | 'metal' | 'water'
type PillarKey = 'year' | 'month' | 'day' | 'hour'
type GenderPolarity = 'male' | 'female' | 'unknown'

export type ChartInput = {
  dob: string
  tob: string | null
  gender: string | null
  birthplace: string
  timezone: string | null
  birthplaceLatitude: number | null
  birthplaceLongitude: number | null
  intent: string | null
  language: string
}

export type ResolvedLocation = {
  normalizedName: string
  queryKey: string
  country: string | null
  region: string | null
  latitude: number
  longitude: number
  timezone: string
  source: 'input' | 'builtin' | 'cache' | 'open_meteo'
}

type TimingInfo = {
  localCivilTime: string
  localStandardTime: string
  utcTime: string
  trueSolarTime: string
  timezone: string
  timezoneOffsetMinutes: number
  standardOffsetMinutes: number
  dstApplied: boolean
  longitudeCorrectionMinutes: number
  equationOfTimeMinutes: number
  location: {
    normalizedName: string
    country: string | null
    region: string | null
    latitude: number
    longitude: number
    source: ResolvedLocation['source']
  }
}

type DayunCycle = {
  index: number
  ganZhi: string
  startAgeYears: number
  startAgeMonths: number
  displayAge: string
  range: string
}

export type FlowPillar = {
  pillar: string
  stem: string
  branch: string
  element: ElementLabel
  nayin: string
  twelveLifeStage: string
}

export type CurrentFlow = {
  referenceTime: {
    utcTime: string
    localCivilTime: string
    trueSolarTime: string
    timezone: string
    dstApplied: boolean
  }
  liuNian: FlowPillar
  liuYue: FlowPillar
  liuRi: FlowPillar & {
    kongWang: {
      xun: string
      emptyBranches: string[]
      display: string
    }
  }
  notes: string[]
}

export type ChartResult = {
  source: 'verified_engine' | 'fallback'
  chartText: string
  pillars: Record<PillarKey, string>
  analysis: {
    source: 'verified_engine' | 'fallback'
    engine: 'custom_hybrid' | 'fallback_cycle'
    sect: number | null
    dayMaster: {
      stem: string
      branch: string
      element: ElementLabel
      polarity: 'yin' | 'yang'
    }
    fiveElements: Record<ElementLabel, number>
    strongElement: ElementLabel | null
    weakElement: ElementLabel | null
    favorableElement: ElementLabel | null
    unfavorableElement: ElementLabel | null
    nayin: Record<PillarKey, string>
    twelveLifeStages: Record<PillarKey, string>
    kongWang: {
      xun: string
      emptyBranches: string[]
      display: string
    }
    shenSha: {
      byPillar: Record<PillarKey, string[]>
      chartLevel: string[]
    }
    dayun: {
      direction: 'forward' | 'backward'
      startAgeYears: number
      startAgeMonths: number
      displayAge: string
      cycles: DayunCycle[]
    }
    timing: TimingInfo
    engineMetadata: {
      engine: 'custom_hybrid' | 'fallback_cycle'
      source: 'verified_engine' | 'fallback'
      dayPillarMethod: 'formula' | 'julian_backup' | 'fallback'
      ziHourBoundary: '23:00_next_day'
      supportedRange: '1900-2100'
      comparisonEnabled: boolean
    }
    notes: string[]
  }
  resolvedLocation: ResolvedLocation
  currentFlow?: CurrentFlow
  comparison?: {
    lunarJavascript: {
      chartText: string
      pillars: Record<PillarKey, string>
      matches: boolean
      differingPillars: PillarKey[]
    } | null
  }
  rawPayload: Record<string, unknown>
}

type CacheClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
      }
    }
    upsert: (value: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ error: unknown }>
  }
}

type CalculateOptions = {
  cacheClient?: CacheClient
  includeComparison?: boolean
  timeBasis?: 'true_solar' | 'civil_time'
}

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
const JIA_ZI = Array.from({ length: 60 }, (_, index) => `${STEMS[index % 10]}${BRANCHES[index % 12]}`)
const JIA_ZI_INDEX = Object.fromEntries(JIA_ZI.map((item, index) => [item, index])) as Record<string, number>
const DAY_PILLAR_BASE_DATE_UTC = Date.UTC(1900, 0, 1)
const DAY_PILLAR_BASE_INDEX = JIA_ZI_INDEX['甲戌']
const SOLAR_TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
] as const
const JIE_TERM_ORDER = ['小寒', '立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪'] as const
const MONTH_BRANCH_SEQUENCE = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'] as const
const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬'])
const FIVE_TIGER_START: Record<string, number> = {
  甲: 2, 己: 2,
  乙: 4, 庚: 4,
  丙: 6, 辛: 6,
  丁: 8, 壬: 8,
  戊: 0, 癸: 0,
}
const FIVE_MOUSE_START: Record<string, number> = {
  甲: 0, 己: 0,
  乙: 2, 庚: 2,
  丙: 4, 辛: 4,
  丁: 6, 壬: 6,
  戊: 8, 癸: 8,
}

const STEM_ELEMENTS: Record<string, ElementLabel> = {
  甲: 'wood', 乙: 'wood',
  丙: 'fire', 丁: 'fire',
  戊: 'earth', 己: 'earth',
  庚: 'metal', 辛: 'metal',
  壬: 'water', 癸: 'water',
}

const BRANCH_ELEMENTS: Record<string, ElementLabel> = {
  子: 'water', 丑: 'earth', 寅: 'wood', 卯: 'wood',
  辰: 'earth', 巳: 'fire', 午: 'fire', 未: 'earth',
  申: 'metal', 酉: 'metal', 戌: 'earth', 亥: 'water',
}

const TWELVE_LIFE_ORDER = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'] as const
const TWELVE_LIFE_TABLE: Record<string, string[]> = {
  甲: ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'],
  乙: ['午', '巳', '辰', '卯', '寅', '丑', '子', '亥', '戌', '酉', '申', '未'],
  丙: ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'],
  丁: ['酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥', '戌'],
  戊: ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'],
  己: ['酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥', '戌'],
  庚: ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰'],
  辛: ['子', '亥', '戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑'],
  壬: ['申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未'],
  癸: ['卯', '寅', '丑', '子', '亥', '戌', '酉', '申', '未', '午', '巳', '辰'],
}

const NAYIN_TABLE: Record<string, string> = {
  甲子: '海中金', 乙丑: '海中金', 丙寅: '炉中火', 丁卯: '炉中火', 戊辰: '大林木', 己巳: '大林木',
  庚午: '路旁土', 辛未: '路旁土', 壬申: '剑锋金', 癸酉: '剑锋金', 甲戌: '山头火', 乙亥: '山头火',
  丙子: '涧下水', 丁丑: '涧下水', 戊寅: '城头土', 己卯: '城头土', 庚辰: '白蜡金', 辛巳: '白蜡金',
  壬午: '杨柳木', 癸未: '杨柳木', 甲申: '泉中水', 乙酉: '泉中水', 丙戌: '屋上土', 丁亥: '屋上土',
  戊子: '霹雳火', 己丑: '霹雳火', 庚寅: '松柏木', 辛卯: '松柏木', 壬辰: '长流水', 癸巳: '长流水',
  甲午: '沙中金', 乙未: '沙中金', 丙申: '山下火', 丁酉: '山下火', 戊戌: '平地木', 己亥: '平地木',
  庚子: '壁上土', 辛丑: '壁上土', 壬寅: '金箔金', 癸卯: '金箔金', 甲辰: '覆灯火', 乙巳: '覆灯火',
  丙午: '天河水', 丁未: '天河水', 戊申: '大驿土', 己酉: '大驿土', 庚戌: '钗钏金', 辛亥: '钗钏金',
  壬子: '桑柘木', 癸丑: '桑柘木', 甲寅: '大溪水', 乙卯: '大溪水', 丙辰: '沙中土', 丁巳: '沙中土',
  戊午: '天上火', 己未: '天上火', 庚申: '石榴木', 辛酉: '石榴木', 壬戌: '大海水', 癸亥: '大海水',
}

const DAY_STEM_BRANCH_RULES = {
  天乙贵人: {
    甲: ['丑', '未'], 乙: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 戊: ['丑', '未'],
    己: ['子', '申'], 庚: ['丑', '未'], 辛: ['午', '寅'], 壬: ['巳', '卯'], 癸: ['巳', '卯'],
  },
  太极贵人: {
    甲: ['子', '午'], 乙: ['子', '午'], 丙: ['卯', '酉'], 丁: ['卯', '酉'], 戊: ['辰', '戌', '丑', '未'],
    己: ['辰', '戌', '丑', '未'], 庚: ['寅', '亥'], 辛: ['寅', '亥'], 壬: ['巳', '申'], 癸: ['巳', '申'],
  },
  文昌贵人: {
    甲: ['巳'], 乙: ['午'], 丙: ['申'], 丁: ['酉'], 戊: ['申'],
    己: ['酉'], 庚: ['亥'], 辛: ['子'], 壬: ['寅'], 癸: ['卯'],
  },
  金舆: {
    甲: ['辰'], 乙: ['巳'], 丙: ['未'], 丁: ['申'], 戊: ['未'],
    己: ['申'], 庚: ['戌'], 辛: ['亥'], 壬: ['丑'], 癸: ['寅'],
  },
  禄神: {
    甲: ['寅'], 乙: ['卯'], 丙: ['巳'], 丁: ['午'], 戊: ['巳'],
    己: ['午'], 庚: ['申'], 辛: ['酉'], 壬: ['亥'], 癸: ['子'],
  },
  羊刃: {
    甲: ['卯'], 乙: ['辰'], 丙: ['午'], 丁: ['未'], 戊: ['午'],
    己: ['未'], 庚: ['酉'], 辛: ['戌'], 壬: ['子'], 癸: ['丑'],
  },
} satisfies Record<string, Record<string, string[]>>

const YEAR_OR_DAY_BRANCH_GROUP_RULES = {
  驿马: { '申子辰': '寅', '寅午戌': '申', '巳酉丑': '亥', '亥卯未': '巳' },
  桃花: { '申子辰': '酉', '寅午戌': '卯', '巳酉丑': '午', '亥卯未': '子' },
  华盖: { '申子辰': '辰', '寅午戌': '戌', '巳酉丑': '丑', '亥卯未': '未' },
} as const

const YEAR_BRANCH_RULES = {
  劫煞: { '申子辰': '巳', '寅午戌': '亥', '巳酉丑': '寅', '亥卯未': '申' },
  灾煞: { '申子辰': '午', '寅午戌': '子', '巳酉丑': '卯', '亥卯未': '酉' },
  将星: { '申子辰': '子', '寅午戌': '午', '巳酉丑': '酉', '亥卯未': '卯' },
  孤辰: { '亥子丑': '寅', '寅卯辰': '巳', '巳午未': '申', '申酉戌': '亥' },
  寡宿: { '亥子丑': '戌', '寅卯辰': '丑', '巳午未': '辰', '申酉戌': '未' },
  亡神: { '申子辰': '亥', '寅午戌': '巳', '巳酉丑': '申', '亥卯未': '寅' },
} as const

const MONTH_BRANCH_TIAN_DE: Record<string, string> = {
  寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲',
  申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚',
}

const MONTH_BRANCH_YUE_DE: Record<string, string> = {
  寅: '丙', 午: '丙', 戌: '丙',
  亥: '甲', 卯: '甲', 未: '甲',
  申: '壬', 子: '壬', 辰: '壬',
  巳: '庚', 酉: '庚', 丑: '庚',
}

const YUAN_CHEN_TABLE = {
  positive: { 子: '未', 丑: '申', 寅: '酉', 卯: '戌', 辰: '亥', 巳: '子', 午: '丑', 未: '寅', 申: '卯', 酉: '辰', 戌: '巳', 亥: '午' },
  negative: { 子: '巳', 丑: '午', 寅: '未', 卯: '申', 辰: '酉', 巳: '戌', 午: '亥', 未: '子', 申: '丑', 酉: '寅', 戌: '卯', 亥: '辰' },
} as const

const SAN_QI_RULES = {
  天上三奇: ['甲', '戊', '庚'],
  地上三奇: ['乙', '丙', '丁'],
  人中三奇: ['壬', '癸', '辛'],
} as const

const KUI_GANG = new Set(['庚辰', '庚戌', '壬辰', '壬戌', '戊辰', '戊戌'])
const SHI_E_DA_BAI = new Set(['甲辰', '乙巳', '丙申', '丁亥', '戊戌', '己丑', '庚辰', '辛巳', '壬申', '癸亥'])
const KONG_WANG_BY_XUN = [
  ['戌', '亥'],
  ['申', '酉'],
  ['午', '未'],
  ['辰', '巳'],
  ['寅', '卯'],
  ['子', '丑'],
]

const COMMON_CITY_LOOKUP: Record<string, Omit<ResolvedLocation, 'queryKey'>> = {
  changchunjilinchina: { normalizedName: 'Changchun, Jilin, China', country: 'China', region: 'Jilin', latitude: 43.8164, longitude: 125.3235, timezone: 'Asia/Shanghai', source: 'builtin' },
  beijingchina: { normalizedName: 'Beijing, China', country: 'China', region: 'Beijing', latitude: 39.9042, longitude: 116.4074, timezone: 'Asia/Shanghai', source: 'builtin' },
  beijingbeijingchina: { normalizedName: 'Beijing, China', country: 'China', region: 'Beijing', latitude: 39.9042, longitude: 116.4074, timezone: 'Asia/Shanghai', source: 'builtin' },
  shanghaichina: { normalizedName: 'Shanghai, China', country: 'China', region: 'Shanghai', latitude: 31.2304, longitude: 121.4737, timezone: 'Asia/Shanghai', source: 'builtin' },
  shanghaishanghaichina: { normalizedName: 'Shanghai, China', country: 'China', region: 'Shanghai', latitude: 31.2304, longitude: 121.4737, timezone: 'Asia/Shanghai', source: 'builtin' },
  guangzhouchina: { normalizedName: 'Guangzhou, Guangdong, China', country: 'China', region: 'Guangdong', latitude: 23.1291, longitude: 113.2644, timezone: 'Asia/Shanghai', source: 'builtin' },
  guangzhouguangdongchina: { normalizedName: 'Guangzhou, Guangdong, China', country: 'China', region: 'Guangdong', latitude: 23.1291, longitude: 113.2644, timezone: 'Asia/Shanghai', source: 'builtin' },
  shenzhenchina: { normalizedName: 'Shenzhen, Guangdong, China', country: 'China', region: 'Guangdong', latitude: 22.5431, longitude: 114.0579, timezone: 'Asia/Shanghai', source: 'builtin' },
  shenzhenguangdongchina: { normalizedName: 'Shenzhen, Guangdong, China', country: 'China', region: 'Guangdong', latitude: 22.5431, longitude: 114.0579, timezone: 'Asia/Shanghai', source: 'builtin' },
  hongkong: { normalizedName: 'Hong Kong', country: 'China', region: 'Hong Kong', latitude: 22.3193, longitude: 114.1694, timezone: 'Asia/Hong_Kong', source: 'builtin' },
  hongkongchina: { normalizedName: 'Hong Kong, China', country: 'China', region: 'Hong Kong', latitude: 22.3193, longitude: 114.1694, timezone: 'Asia/Hong_Kong', source: 'builtin' },
  taipeitaiwan: { normalizedName: 'Taipei, Taiwan', country: 'Taiwan', region: 'Taipei', latitude: 25.0330, longitude: 121.5654, timezone: 'Asia/Taipei', source: 'builtin' },
  taipeitaiwanchina: { normalizedName: 'Taipei, Taiwan', country: 'Taiwan', region: 'Taipei', latitude: 25.0330, longitude: 121.5654, timezone: 'Asia/Taipei', source: 'builtin' },
  torontoontariocanada: { normalizedName: 'Toronto, Ontario, Canada', country: 'Canada', region: 'Ontario', latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto', source: 'builtin' },
  newyorknewyorkusa: { normalizedName: 'New York, New York, USA', country: 'USA', region: 'New York', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York', source: 'builtin' },
  londonenglanduk: { normalizedName: 'London, England, UK', country: 'United Kingdom', region: 'England', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London', source: 'builtin' },
  sydneynswaustralia: { normalizedName: 'Sydney, NSW, Australia', country: 'Australia', region: 'NSW', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney', source: 'builtin' },
  melbournevictoriaaustralia: { normalizedName: 'Melbourne, Victoria, Australia', country: 'Australia', region: 'Victoria', latitude: -37.8136, longitude: 144.9631, timezone: 'Australia/Melbourne', source: 'builtin' },
}

const SOLAR_TERM_CACHE = new Map<number, Record<(typeof SOLAR_TERM_NAMES)[number], DateTime>>()

function mod(value: number, base: number) {
  return ((value % base) + base) % base
}

export function cleanString(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeQueryKey(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
}

function roundCoordinate(value: number) {
  return Math.round(value * 10000) / 10000
}

function isValidTimezone(timezone: string | null) {
  if (!timezone) return false
  return DateTime.now().setZone(timezone).isValid
}

function buildElementCounts() {
  return { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 } satisfies Record<ElementLabel, number>
}

function rankElements(counts: Record<ElementLabel, number>) {
  const ranked = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([element, count]) => ({ element: element as ElementLabel, count }))

  return {
    counts,
    strongElement: ranked[0]?.element ?? null,
    weakElement: ranked[ranked.length - 1]?.element ?? null,
  }
}

function parseDateParts(dob: string, tob: string | null) {
  const [yearRaw, monthRaw, dayRaw] = dob.split('-')
  const [hourRaw, minuteRaw] = (tob ?? '12:00').split(':')
  return {
    year: Number(yearRaw),
    month: Number(monthRaw),
    day: Number(dayRaw),
    hour: Number(hourRaw),
    minute: Number(minuteRaw),
  }
}

function getPolarity(stem: string) {
  return YANG_STEMS.has(stem) ? 'yang' : 'yin'
}

function formatIsoWithoutSeconds(dateTime: DateTime) {
  return dateTime.toFormat("yyyy-LL-dd'T'HH:mm")
}

function formatAge(years: number, months: number) {
  return months > 0 ? `${years}岁${months}个月` : `${years}岁`
}

function formatCycleRange(startYears: number, startMonths: number) {
  const endYears = startYears + 9
  return `${formatAge(startYears, startMonths)}-${endYears}岁`
}

function buildFlowPillar(pillar: string, natalDayStem: string): FlowPillar {
  const stageOrder = TWELVE_LIFE_TABLE[natalDayStem] ?? []
  const stageIndex = stageOrder.indexOf(pillar[1])
  return {
    pillar,
    stem: pillar[0],
    branch: pillar[1],
    element: STEM_ELEMENTS[pillar[0]] ?? 'earth',
    nayin: NAYIN_TABLE[pillar] ?? '',
    twelveLifeStage: stageIndex >= 0 ? TWELVE_LIFE_ORDER[stageIndex] : '',
  }
}

function isMissingGregorianGap(year: number, month: number, day: number) {
  return year === 1582 && month === 10 && day >= 5 && day <= 14
}

function dayOfYear(dateTime: DateTime) {
  return dateTime.ordinal
}

function equationOfTimeMinutes(dateTime: DateTime) {
  const beta = (2 * Math.PI * (dayOfYear(dateTime) - 1)) / (dateTime.isInLeapYear ? 366 : 365)
  return 229.2 * (
    0.000075 +
    0.001868 * Math.cos(beta) -
    0.032077 * Math.sin(beta) -
    0.014615 * Math.cos(2 * beta) -
    0.04089 * Math.sin(2 * beta)
  )
}

function yearPillarFromYear(chartYear: number) {
  const stemIndex = mod(chartYear - 4, 10)
  const branchIndex = mod(chartYear - 4, 12)
  return `${STEMS[stemIndex]}${BRANCHES[branchIndex]}`
}

function calculateDayPillarIndex(year: number, month: number, day: number) {
  if (year >= 1900 && year <= 2100) {
    const current = Date.UTC(year, month - 1, day)
    const diffDays = Math.floor((current - DAY_PILLAR_BASE_DATE_UTC) / 86400000)
    return {
      index: mod(DAY_PILLAR_BASE_INDEX + diffDays, 60),
      method: 'formula' as const,
    }
  }

  let y = year
  let m = month
  if (m <= 2) {
    y -= 1
    m += 12
  }

  const isGregorian = year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)))
  const a = isGregorian ? Math.floor(y / 100) : 0
  const b = isGregorian ? 2 - a + Math.floor(a / 4) : 0
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5
  const rawIndex = Math.floor(mod(jd + 9.5, 60))

  return {
    index: mod(rawIndex - 20, 60),
    method: 'julian_backup' as const,
  }
}

function calculateHourBranchIndex(hour: number) {
  if (hour === 23 || hour < 1) return 0
  return mod(Math.floor((hour + 1) / 2), 12)
}

function getMonthStemStart(yearStem: string) {
  return FIVE_TIGER_START[yearStem] ?? 0
}

function getHourStemStart(dayStem: string) {
  return FIVE_MOUSE_START[dayStem] ?? 0
}

function getSolarTermsForYear(year: number) {
  const cached = SOLAR_TERM_CACHE.get(year)
  if (cached) return cached

  const rawTerms = GENERATED_SOLAR_TERM_TABLE[String(year) as keyof typeof GENERATED_SOLAR_TERM_TABLE]
  if (!rawTerms) {
    throw new Error(`Solar term table does not cover year ${year}`)
  }

  const terms = Object.fromEntries(
    SOLAR_TERM_NAMES.map((name) => {
      const raw = rawTerms[name]
      return [name, DateTime.fromFormat(raw, 'yyyy-MM-dd HH:mm:ss', { zone: 'Asia/Shanghai' }).toUTC()]
    }),
  ) as Record<(typeof SOLAR_TERM_NAMES)[number], DateTime>

  SOLAR_TERM_CACHE.set(year, terms)
  return terms
}

function buildMonthStarts(chartYear: number) {
  const current = getSolarTermsForYear(chartYear)
  const next = getSolarTermsForYear(chartYear + 1)
  return [
    { branch: '寅', at: current['立春'] },
    { branch: '卯', at: current['惊蛰'] },
    { branch: '辰', at: current['清明'] },
    { branch: '巳', at: current['立夏'] },
    { branch: '午', at: current['芒种'] },
    { branch: '未', at: current['小暑'] },
    { branch: '申', at: current['立秋'] },
    { branch: '酉', at: current['白露'] },
    { branch: '戌', at: current['寒露'] },
    { branch: '亥', at: current['立冬'] },
    { branch: '子', at: current['大雪'] },
    { branch: '丑', at: next['小寒'] },
    { branch: '寅', at: next['立春'] },
  ] as const
}

function getBranchGroupBranch(branch: string, rules: Record<string, string>) {
  for (const [group, target] of Object.entries(rules)) {
    if (group.includes(branch)) return target
  }
  return null
}

function getShenShaByBranchRules(
  yearBranch: string,
  dayBranch: string,
  pillars: Record<PillarKey, string>,
) {
  const byPillar: Record<PillarKey, string[]> = { year: [], month: [], day: [], hour: [] }
  const chartLevel = new Set<string>()

  for (const [name, rule] of Object.entries(YEAR_OR_DAY_BRANCH_GROUP_RULES)) {
    const target = getBranchGroupBranch(dayBranch, rule) ?? getBranchGroupBranch(yearBranch, rule)
    if (!target) continue
    for (const key of Object.keys(pillars) as PillarKey[]) {
      if (pillars[key][1] === target) byPillar[key].push(name)
    }
  }

  for (const [name, rule] of Object.entries(YEAR_BRANCH_RULES)) {
    const target = getBranchGroupBranch(yearBranch, rule)
    if (!target) continue
    for (const key of Object.keys(pillars) as PillarKey[]) {
      if (pillars[key][1] === target) byPillar[key].push(name)
    }
  }

  return { byPillar, chartLevel }
}

function getDayStemShenSha(dayStem: string, pillars: Record<PillarKey, string>) {
  const byPillar: Record<PillarKey, string[]> = { year: [], month: [], day: [], hour: [] }
  for (const [name, rules] of Object.entries(DAY_STEM_BRANCH_RULES)) {
    const typedDayStem = dayStem as keyof typeof rules
    const targets = rules[typedDayStem] ?? []
    for (const key of Object.keys(pillars) as PillarKey[]) {
      if (targets.includes(pillars[key][1])) byPillar[key].push(name)
    }
  }
  return byPillar
}

function mergePillarTags(base: Record<PillarKey, string[]>, incoming: Record<PillarKey, string[]>) {
  for (const key of Object.keys(base) as PillarKey[]) {
    base[key] = Array.from(new Set([...base[key], ...incoming[key]])).sort()
  }
}

function determineGenderPolarity(gender: string | null): GenderPolarity {
  const value = cleanString(gender)?.toLowerCase()
  if (!value) return 'unknown'
  if (['male', 'man', 'm', '男'].includes(value)) return 'male'
  if (['female', 'woman', 'f', '女'].includes(value)) return 'female'
  return 'unknown'
}

function calculateDayun(
  birthUtc: DateTime,
  chartYearStem: string,
  monthPillar: string,
  gender: string | null,
) {
  const isYangYear = YANG_STEMS.has(chartYearStem)
  const normalizedGender = determineGenderPolarity(gender)
  const forward = normalizedGender === 'unknown'
    ? true
    : (isYangYear && normalizedGender === 'male') || (!isYangYear && normalizedGender === 'female')

  const yearsToScan = [birthUtc.year - 1, birthUtc.year, birthUtc.year + 1]
  const jieTerms = yearsToScan.flatMap((year) => {
    const terms = getSolarTermsForYear(year)
    return JIE_TERM_ORDER.map((name) => ({ name, at: terms[name] }))
  }).sort((a, b) => a.at.toMillis() - b.at.toMillis())

  const target = forward
    ? jieTerms.find((item) => item.at.toMillis() > birthUtc.toMillis())
    : [...jieTerms].reverse().find((item) => item.at.toMillis() <= birthUtc.toMillis())

  if (!target) {
    return {
      direction: forward ? 'forward' as const : 'backward' as const,
      startAgeYears: 0,
      startAgeMonths: 0,
      displayAge: '0岁',
      cycles: [] as DayunCycle[],
    }
  }

  const totalDays = Math.abs(target.at.toMillis() - birthUtc.toMillis()) / 86400000
  const startAgeYears = Math.floor(totalDays / 3)
  const startAgeMonths = Math.floor((totalDays - startAgeYears * 3) * 4)
  const monthIndex = JIA_ZI_INDEX[monthPillar] ?? 0

  const cycles = Array.from({ length: 10 }, (_, index) => {
    const daYunIndex = mod(monthIndex + (forward ? index + 1 : -(index + 1)), 60)
    const cycleStartYears = startAgeYears + index * 10
    return {
      index: index + 1,
      ganZhi: JIA_ZI[daYunIndex],
      startAgeYears: cycleStartYears,
      startAgeMonths,
      displayAge: formatAge(cycleStartYears, startAgeMonths),
      range: formatCycleRange(cycleStartYears, startAgeMonths),
    }
  })

  return {
    direction: forward ? 'forward' as const : 'backward' as const,
    startAgeYears,
    startAgeMonths,
    displayAge: formatAge(startAgeYears, startAgeMonths),
    cycles,
  }
}

function calculateKongWang(dayIndex: number) {
  const xunIndex = Math.floor(dayIndex / 10)
  const [first, second] = KONG_WANG_BY_XUN[xunIndex] ?? ['戌', '亥']
  return {
    xun: JIA_ZI[xunIndex * 10] ?? '甲子',
    emptyBranches: [first, second],
    display: `${first}${second}`,
  }
}

async function importLunarComparisonLibrary() {
  return await import('npm:lunar-javascript@1.7.7')
}

async function buildLunarComparison(trueSolar: DateTime) {
  try {
    const lib = await importLunarComparisonLibrary()
    const Solar = (lib as Record<string, unknown>).Solar as {
      fromYmdHms: (
        year: number,
        month: number,
        day: number,
        hour: number,
        minute: number,
        second: number,
      ) => {
        getLunar: () => {
          getEightChar: () => Record<string, (...args: unknown[]) => unknown>
        }
      }
    } | undefined

    if (!Solar?.fromYmdHms) return null

    const eightChar = Solar.fromYmdHms(
      trueSolar.year,
      trueSolar.month,
      trueSolar.day,
      trueSolar.hour,
      trueSolar.minute,
      trueSolar.second,
    ).getLunar().getEightChar()

    if (typeof eightChar.setSect === 'function') {
      eightChar.setSect(2)
    }

    const pillars = {
      year: String(eightChar.getYear()),
      month: String(eightChar.getMonth()),
      day: String(eightChar.getDay()),
      hour: String(eightChar.getTime()),
    } satisfies Record<PillarKey, string>

    return {
      chartText: `${pillars.year}年${pillars.month}月${pillars.day}日${pillars.hour}時`,
      pillars,
    }
  } catch {
    return null
  }
}

async function lookupCachedLocation(cacheClient: CacheClient | undefined, queryKey: string) {
  if (!cacheClient) return null
  const { data, error } = await cacheClient
    .from('location_resolution_cache')
    .select('query_key, normalized_name, country, region, latitude, longitude, timezone, source_type')
    .eq('query_key', queryKey)
    .maybeSingle()

  if (error || !data) return null

  return {
    queryKey,
    normalizedName: String(data.normalized_name ?? ''),
    country: cleanString(data.country),
    region: cleanString(data.region),
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    timezone: String(data.timezone ?? ''),
    source: 'cache' as const,
  }
}

async function storeLocationCache(cacheClient: CacheClient | undefined, location: ResolvedLocation) {
  if (!cacheClient) return
  await cacheClient.from('location_resolution_cache').upsert(
    {
      query_key: location.queryKey,
      normalized_name: location.normalizedName,
      country: location.country,
      region: location.region,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
      source_type: location.source,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'query_key' },
  )
}

async function fetchOpenMeteoLocation(query: string) {
  const rawParts = query
    .split(',')
    .map((part) => cleanString(part))
    .filter((part): part is string => Boolean(part))
  const dedupedParts = rawParts.filter((part, index) => rawParts.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === index)
  const candidates = Array.from(new Set([
    query,
    dedupedParts.join(', '),
    dedupedParts.slice(0, 2).join(', '),
    dedupedParts[0] ?? '',
  ].map((item) => item.trim()).filter(Boolean)))

  for (const candidate of candidates) {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.searchParams.set('name', candidate)
    url.searchParams.set('count', '1')
    url.searchParams.set('language', 'en')
    url.searchParams.set('format', 'json')

    const response = await fetch(url)
    if (!response.ok) continue

    const payload = await response.json() as {
      results?: Array<{
        name?: string
        admin1?: string
        country?: string
        latitude?: number
        longitude?: number
        timezone?: string
      }>
    }

    const hit = payload.results?.[0]
    if (!hit || typeof hit.latitude !== 'number' || typeof hit.longitude !== 'number') {
      continue
    }

    const timezone = cleanString(hit.timezone) ?? tzLookup(hit.latitude, hit.longitude)
    if (!timezone) continue

    const parts = [cleanString(hit.name), cleanString(hit.admin1), cleanString(hit.country)].filter(Boolean)
    return {
      normalizedName: parts.join(', '),
      country: cleanString(hit.country),
      region: cleanString(hit.admin1),
      latitude: hit.latitude,
      longitude: hit.longitude,
      timezone,
      source: 'open_meteo' as const,
    }
  }

  return null
}

export function assertChartInput(body: SaveProfileInput): ChartInput {
  const dob = cleanString(body.dob)
  const birthplace = cleanString(body.birthplace)

  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    throw new Error('dob is required in YYYY-MM-DD format')
  }

  const tob = cleanString(body.tob)
  if (tob && !/^\d{2}:\d{2}$/.test(tob)) {
    throw new Error('tob must be HH:MM format when provided')
  }

  if (!birthplace) throw new Error('birthplace is required')

  return {
    dob,
    tob,
    gender: cleanString(body.gender),
    birthplace,
    timezone: cleanString(body.timezone),
    birthplaceLatitude: toNumberOrNull(body.birthplace_latitude),
    birthplaceLongitude: toNumberOrNull(body.birthplace_longitude),
    intent: cleanString(body.intent),
    language: cleanString(body.language) ?? 'en',
  }
}

export async function resolveChartInput(input: ChartInput, options: CalculateOptions = {}): Promise<ResolvedLocation> {
  const queryKey = normalizeQueryKey(input.birthplace)
  const providedLatitude = input.birthplaceLatitude
  const providedLongitude = input.birthplaceLongitude
  const providedTimezone = isValidTimezone(input.timezone) ? input.timezone : null

  if (providedTimezone && options.timeBasis === 'civil_time') {
    return {
      queryKey,
      normalizedName: input.birthplace || 'Timezone-only input',
      country: null,
      region: null,
      latitude: 0,
      longitude: 0,
      timezone: providedTimezone,
      source: 'input',
    }
  }

  if (providedLatitude != null && providedLongitude != null && providedTimezone) {
    return {
      queryKey,
      normalizedName: input.birthplace,
      country: null,
      region: null,
      latitude: providedLatitude,
      longitude: providedLongitude,
      timezone: providedTimezone,
      source: 'input',
    }
  }

  const cached = await lookupCachedLocation(options.cacheClient, queryKey)
  if (cached) {
    return {
      ...cached,
      timezone: providedTimezone ?? cached.timezone,
    }
  }

  const builtin = COMMON_CITY_LOOKUP[queryKey]
  if (builtin) {
    const resolved = {
      ...builtin,
      queryKey,
      timezone: providedTimezone ?? builtin.timezone,
    }
    await storeLocationCache(options.cacheClient, resolved)
    return resolved
  }

  const external = await fetchOpenMeteoLocation(input.birthplace)
  if (external) {
    const resolved = {
      ...external,
      queryKey,
      timezone: providedTimezone ?? external.timezone,
    }
    await storeLocationCache(options.cacheClient, resolved)
    return resolved
  }

  if (providedLatitude != null && providedLongitude != null) {
    const timezone = providedTimezone ?? tzLookup(providedLatitude, providedLongitude)
    return {
      queryKey,
      normalizedName: input.birthplace,
      country: null,
      region: null,
      latitude: providedLatitude,
      longitude: providedLongitude,
      timezone,
      source: 'input',
    }
  }

  throw new Error('Unable to resolve birthplace into a timezone-aware location')
}

function normalizeLocalCivilTime(localCivil: DateTime, location: ResolvedLocation) {
  if (!localCivil.isValid) {
    throw new Error(`Unable to parse local civil time in zone ${location.timezone}`)
  }

  const dstApplied = localCivil.isInDST
  const standardOffsetMinutes = localCivil.offset - (dstApplied ? 60 : 0)
  const centralMeridian = standardOffsetMinutes / 4
  const longitudeCorrectionMinutes = (location.longitude - centralMeridian) * 4
  const equationMinutes = equationOfTimeMinutes(localCivil)
  const localStandard = localCivil.minus({ minutes: dstApplied ? 60 : 0 })
  const trueSolar = localStandard.plus({ minutes: longitudeCorrectionMinutes + equationMinutes })
  const utc = localCivil.toUTC()

  return {
    localCivil,
    localStandard,
    utc,
    trueSolar,
    info: {
      localCivilTime: formatIsoWithoutSeconds(localCivil),
      localStandardTime: formatIsoWithoutSeconds(localStandard),
      utcTime: formatIsoWithoutSeconds(utc),
      trueSolarTime: formatIsoWithoutSeconds(trueSolar),
      timezone: location.timezone,
      timezoneOffsetMinutes: localCivil.offset,
      standardOffsetMinutes,
      dstApplied,
      longitudeCorrectionMinutes,
      equationOfTimeMinutes: equationMinutes,
      location: {
        normalizedName: location.normalizedName,
        country: location.country,
        region: location.region,
        latitude: location.latitude,
        longitude: location.longitude,
        source: location.source,
      },
    } satisfies TimingInfo,
  }
}

function normalizeCivilTime(parts: ReturnType<typeof parseDateParts>, location: ResolvedLocation) {
  const localCivil = DateTime.fromObject(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: 0,
      millisecond: 0,
    },
    { zone: location.timezone },
  )

  return normalizeLocalCivilTime(localCivil, location)
}

function calculateMonthPillar(chartYear: number, yearStem: string, birthUtc: DateTime) {
  const monthStarts = buildMonthStarts(chartYear)
  let sequenceIndex = 11
  for (let index = 0; index < monthStarts.length - 1; index += 1) {
    const current = monthStarts[index]
    const next = monthStarts[index + 1]
    if (birthUtc.toMillis() >= current.at.toMillis() && birthUtc.toMillis() < next.at.toMillis()) {
      sequenceIndex = index
      break
    }
  }
  const branch = MONTH_BRANCH_SEQUENCE[sequenceIndex]
  const stemIndex = mod(getMonthStemStart(yearStem) + sequenceIndex, 10)
  return `${STEMS[stemIndex]}${branch}`
}

export function calculateCurrentFlowAtInstant(
  referenceUtc: DateTime,
  location: ResolvedLocation,
  natalDayStem: string,
): CurrentFlow {
  const localCivil = referenceUtc.toUTC().setZone(location.timezone)
  const timing = normalizeLocalCivilTime(localCivil, location)
  const trueSolarUtc = timing.trueSolar.toUTC()
  const currentYearTerms = getSolarTermsForYear(trueSolarUtc.year)
  const chartYear = trueSolarUtc.toMillis() >= currentYearTerms['立春'].toMillis()
    ? trueSolarUtc.year
    : trueSolarUtc.year - 1
  const liuNian = yearPillarFromYear(chartYear)
  const liuYue = calculateMonthPillar(chartYear, liuNian[0], trueSolarUtc)
  const trueSolarForDay = timing.trueSolar.hour >= 23 ? timing.trueSolar.plus({ days: 1 }) : timing.trueSolar

  if (isMissingGregorianGap(trueSolarForDay.year, trueSolarForDay.month, trueSolarForDay.day)) {
    throw new Error('The reference time falls into the historical Gregorian gap (1582-10-05 to 1582-10-14).')
  }

  const liuRiMeta = calculateDayPillarIndex(trueSolarForDay.year, trueSolarForDay.month, trueSolarForDay.day)
  const liuRi = JIA_ZI[liuRiMeta.index]

  return {
    referenceTime: {
      utcTime: formatIsoWithoutSeconds(referenceUtc.toUTC()),
      localCivilTime: formatIsoWithoutSeconds(timing.localCivil),
      trueSolarTime: formatIsoWithoutSeconds(timing.trueSolar),
      timezone: location.timezone,
      dstApplied: timing.info.dstApplied,
    },
    liuNian: buildFlowPillar(liuNian, natalDayStem),
    liuYue: buildFlowPillar(liuYue, natalDayStem),
    liuRi: {
      ...buildFlowPillar(liuRi, natalDayStem),
      kongWang: calculateKongWang(liuRiMeta.index),
    },
    notes: [
      'reference_time_source:question_or_preview_time',
      'liu_nián_liu_yue_liu_ri_based_on_reference_instant',
      `day_pillar_method:${liuRiMeta.method}`,
    ],
  }
}

function buildShenSha(
  pillars: Record<PillarKey, string>,
  dayIndex: number,
  monthBranch: string,
  yearStem: string,
  yearBranch: string,
  dayStem: string,
  dayBranch: string,
  gender: string | null,
) {
  const byPillar: Record<PillarKey, string[]> = { year: [], month: [], day: [], hour: [] }
  const chartLevel = new Set<string>()

  mergePillarTags(byPillar, getDayStemShenSha(dayStem, pillars))
  mergePillarTags(byPillar, getShenShaByBranchRules(yearBranch, dayBranch, pillars).byPillar)

  const tianDeTarget = MONTH_BRANCH_TIAN_DE[monthBranch]
  const yueDeTarget = MONTH_BRANCH_YUE_DE[monthBranch]
  for (const key of Object.keys(pillars) as PillarKey[]) {
    const [stem, branch] = pillars[key].split('')
    if (stem === tianDeTarget || branch === tianDeTarget) byPillar[key].push('天德贵人')
    if (stem === yueDeTarget) byPillar[key].push('月德贵人')
  }

  const normalizedGender = determineGenderPolarity(gender)
  const yuanChenBucket =
    normalizedGender === 'unknown'
      ? null
      : ((YANG_STEMS.has(yearStem) && normalizedGender === 'male') ||
        (!YANG_STEMS.has(yearStem) && normalizedGender === 'female')
          ? 'positive'
          : 'negative')
  const yuanChenTarget = yuanChenBucket
    ? YUAN_CHEN_TABLE[yuanChenBucket as keyof typeof YUAN_CHEN_TABLE][yearBranch as keyof typeof YUAN_CHEN_TABLE.positive]
    : null
  if (yuanChenTarget) {
    for (const key of Object.keys(pillars) as PillarKey[]) {
      if (pillars[key][1] === yuanChenTarget) byPillar[key].push('元辰')
    }
  }

  const stems = Object.values(pillars).map((pillar) => pillar[0])
  for (const [name, combo] of Object.entries(SAN_QI_RULES)) {
    if (combo.every((stem) => stems.includes(stem))) chartLevel.add(name)
  }

  if (KUI_GANG.has(pillars.day)) chartLevel.add('魁罡')
  if (SHI_E_DA_BAI.has(pillars.day)) chartLevel.add('十恶大败')
  chartLevel.add(`旬空:${calculateKongWang(dayIndex).display}`)

  for (const key of Object.keys(byPillar) as PillarKey[]) {
    byPillar[key] = Array.from(new Set(byPillar[key])).sort()
  }

  return {
    byPillar,
    chartLevel: Array.from(chartLevel).sort(),
  }
}

function buildFallbackChart(input: ChartInput, reason: string): ChartResult {
  const parts = parseDateParts(input.dob, input.tob)
  const yearPillar = yearPillarFromYear(parts.year)
  const dayIndex = mod(DAY_PILLAR_BASE_INDEX + Math.floor((Date.UTC(parts.year, parts.month - 1, parts.day) - DAY_PILLAR_BASE_DATE_UTC) / 86400000), 60)
  const dayPillar = JIA_ZI[dayIndex]
  const hourBranchIndex = calculateHourBranchIndex(parts.hour)
  const hourStemIndex = mod(getHourStemStart(dayPillar[0]) + hourBranchIndex, 10)
  const monthPillar = `${STEMS[mod(getMonthStemStart(yearPillar[0]) + parts.month - 1, 10)]}${BRANCHES[mod(parts.month + 1, 12)]}`
  const hourPillar = `${STEMS[hourStemIndex]}${BRANCHES[hourBranchIndex]}`
  const pillars = { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar }
  const counts = buildElementCounts()
  for (const pillar of Object.values(pillars)) {
    counts[STEM_ELEMENTS[pillar[0]] ?? 'earth'] += 1
    counts[BRANCH_ELEMENTS[pillar[1]] ?? 'earth'] += 1
  }
  const ranked = rankElements(counts)
  const resolvedLocation: ResolvedLocation = {
    queryKey: normalizeQueryKey(input.birthplace),
    normalizedName: input.birthplace,
    country: null,
    region: null,
    latitude: input.birthplaceLatitude ?? 0,
    longitude: input.birthplaceLongitude ?? 0,
    timezone: input.timezone ?? 'UTC',
    source: 'input',
  }

  return {
    source: 'fallback',
    chartText: `${pillars.year}年${pillars.month}月${pillars.day}日${pillars.hour}時`,
    pillars,
    resolvedLocation,
    analysis: {
      source: 'fallback',
      engine: 'fallback_cycle',
      sect: null,
      dayMaster: {
        stem: pillars.day[0],
        branch: pillars.day[1],
        element: STEM_ELEMENTS[pillars.day[0]] ?? 'earth',
        polarity: getPolarity(pillars.day[0]),
      },
      fiveElements: ranked.counts,
      strongElement: ranked.strongElement,
      weakElement: ranked.weakElement,
      favorableElement: ranked.weakElement,
      unfavorableElement: ranked.strongElement,
      nayin: { year: '', month: '', day: '', hour: '' },
      twelveLifeStages: { year: '', month: '', day: '', hour: '' },
      kongWang: { xun: '', emptyBranches: [], display: '' },
      shenSha: { byPillar: { year: [], month: [], day: [], hour: [] }, chartLevel: [] },
      dayun: { direction: 'forward', startAgeYears: 0, startAgeMonths: 0, displayAge: '0岁', cycles: [] },
      timing: {
        localCivilTime: `${input.dob}T${input.tob ?? '12:00'}`,
        localStandardTime: `${input.dob}T${input.tob ?? '12:00'}`,
        utcTime: `${input.dob}T${input.tob ?? '12:00'}`,
        trueSolarTime: `${input.dob}T${input.tob ?? '12:00'}`,
        timezone: input.timezone ?? 'UTC',
        timezoneOffsetMinutes: 0,
        standardOffsetMinutes: 0,
        dstApplied: false,
        longitudeCorrectionMinutes: 0,
        equationOfTimeMinutes: 0,
        location: {
          normalizedName: input.birthplace,
          country: null,
          region: null,
          latitude: input.birthplaceLatitude ?? 0,
          longitude: input.birthplaceLongitude ?? 0,
          source: 'input',
        },
      },
      engineMetadata: {
        engine: 'fallback_cycle',
        source: 'fallback',
        dayPillarMethod: 'fallback',
        ziHourBoundary: '23:00_next_day',
        supportedRange: '1900-2100',
        comparisonEnabled: false,
      },
      notes: ['fallback_chart_generated', `reason:${reason}`],
    },
    comparison: { lunarJavascript: null },
    rawPayload: { reason },
  }
}

export async function calculateChart(input: ChartInput, options: CalculateOptions = {}): Promise<ChartResult> {
  try {
    const location = await resolveChartInput(input, options)
    const parts = parseDateParts(input.dob, input.tob)
    const timing = normalizeCivilTime(parts, location)
    const birthUtc = timing.utc
    const timeBasis = options.timeBasis ?? 'true_solar'
    const pillarLocalTime = timeBasis === 'civil_time' ? timing.localCivil : timing.trueSolar
    const pillarUtcTime = pillarLocalTime.toUTC()

    const currentYearTerms = getSolarTermsForYear(pillarUtcTime.year)
    const chartYear = pillarUtcTime.toMillis() >= currentYearTerms['立春'].toMillis() ? pillarUtcTime.year : pillarUtcTime.year - 1
    const yearPillar = yearPillarFromYear(chartYear)
    const monthPillar = calculateMonthPillar(chartYear, yearPillar[0], pillarUtcTime)

    const pillarDayTime = pillarLocalTime.hour >= 23 ? pillarLocalTime.plus({ days: 1 }) : pillarLocalTime
    if (isMissingGregorianGap(pillarDayTime.year, pillarDayTime.month, pillarDayTime.day)) {
      throw new Error('The provided birth date falls into the historical Gregorian gap (1582-10-05 to 1582-10-14).')
    }

    const dayPillarMeta = calculateDayPillarIndex(pillarDayTime.year, pillarDayTime.month, pillarDayTime.day)
    const dayPillar = JIA_ZI[dayPillarMeta.index]
    const hourBranchIndex = calculateHourBranchIndex(pillarLocalTime.hour)
    const hourStemIndex = mod(getHourStemStart(dayPillar[0]) + hourBranchIndex, 10)
    const hourPillar = `${STEMS[hourStemIndex]}${BRANCHES[hourBranchIndex]}`
    const pillars = {
      year: yearPillar,
      month: monthPillar,
      day: dayPillar,
      hour: hourPillar,
    } satisfies Record<PillarKey, string>

    const counts = buildElementCounts()
    for (const pillar of Object.values(pillars)) {
      counts[STEM_ELEMENTS[pillar[0]] ?? 'earth'] += 1
      counts[BRANCH_ELEMENTS[pillar[1]] ?? 'earth'] += 1
    }
    const ranked = rankElements(counts)
    const twelveLifeStages = Object.fromEntries(
      (Object.keys(pillars) as PillarKey[]).map((key) => {
        const order = TWELVE_LIFE_TABLE[dayPillar[0]] ?? []
        const stageIndex = order.indexOf(pillars[key][1])
        return [key, stageIndex >= 0 ? TWELVE_LIFE_ORDER[stageIndex] : '']
      }),
    ) as Record<PillarKey, string>
    const nayin = Object.fromEntries(
      (Object.keys(pillars) as PillarKey[]).map((key) => [key, NAYIN_TABLE[pillars[key]] ?? '']),
    ) as Record<PillarKey, string>
    const kongWang = calculateKongWang(dayPillarMeta.index)
    const shenSha = buildShenSha(
      pillars,
      dayPillarMeta.index,
      monthPillar[1],
      yearPillar[0],
      yearPillar[1],
      dayPillar[0],
      dayPillar[1],
      input.gender,
    )
    const dayun = calculateDayun(birthUtc, yearPillar[0], monthPillar, input.gender)
    const currentFlow = timeBasis === 'civil_time'
      ? undefined
      : calculateCurrentFlowAtInstant(DateTime.utc(), location, dayPillar[0])

    const comparisonBase = options.includeComparison === false || timeBasis === 'civil_time'
      ? null
      : await buildLunarComparison(timing.trueSolar)
    const comparison = comparisonBase == null
      ? { lunarJavascript: null }
      : {
          lunarJavascript: {
            ...comparisonBase,
            matches: (Object.keys(pillars) as PillarKey[]).every((key) => comparisonBase.pillars[key] === pillars[key]),
            differingPillars: (Object.keys(pillars) as PillarKey[]).filter((key) => comparisonBase.pillars[key] !== pillars[key]),
          },
        }

    return {
      source: 'verified_engine',
      chartText: `${pillars.year}年${pillars.month}月${pillars.day}日${pillars.hour}時`,
      pillars,
      resolvedLocation: location,
      currentFlow,
      analysis: {
        source: 'verified_engine',
        engine: 'custom_hybrid',
        sect: 2,
        dayMaster: {
          stem: dayPillar[0],
          branch: dayPillar[1],
          element: STEM_ELEMENTS[dayPillar[0]] ?? 'earth',
          polarity: getPolarity(dayPillar[0]),
        },
        fiveElements: ranked.counts,
        strongElement: ranked.strongElement,
        weakElement: ranked.weakElement,
        favorableElement: ranked.weakElement,
        unfavorableElement: ranked.strongElement,
        nayin,
        twelveLifeStages,
        kongWang,
        shenSha,
        dayun,
        timing: timing.info,
        engineMetadata: {
          engine: 'custom_hybrid',
          source: 'verified_engine',
          dayPillarMethod: dayPillarMeta.method,
          ziHourBoundary: '23:00_next_day',
          supportedRange: '1900-2100',
          comparisonEnabled: comparison.lunarJavascript != null,
        },
        notes: [
          'engine:custom_hybrid',
          'true_solar_time:auto_enabled',
          `location_source:${location.source}`,
          `day_pillar_method:${dayPillarMeta.method}`,
          'zi_hour_boundary:23:00_next_day',
          `time_basis:${timeBasis}`,
        ],
      },
      comparison,
      rawPayload: {
        location,
        timing: timing.info,
        currentFlow,
        solarTerms: {
          chartYear,
          liChun: formatIsoWithoutSeconds(getSolarTermsForYear(chartYear)['立春']),
          jingZhe: formatIsoWithoutSeconds(getSolarTermsForYear(chartYear)['惊蛰']),
        },
      },
    }
  } catch (error) {
    return buildFallbackChart(input, String(error))
  }
}
