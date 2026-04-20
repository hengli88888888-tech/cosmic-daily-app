import { DateTime } from 'npm:luxon@3.5.0'

import { GENERATED_SOLAR_TERM_TABLE } from './generated-solar-term-table.ts'
import { GENERATED_MQIMEN_ZHIRUN_REFERENCE } from './generated-mqimen-zhirun-reference.ts'
import { calculateChart } from './chart-engine.ts'

export type QimenSystemProfile = 'chai_bu' | 'zhi_run'

export type QimenInput = {
  submitted_at: string
  timezone: string
  system_profile?: QimenSystemProfile | null
}

type PalaceResult = {
  palace: number
  label: string
  earth_plate_stem: string
  heaven_plate_stem: string
  gate: string
  star: string
  deity: string
  original_gate_palace: number | null
  original_star_palace: number | null
  empty: boolean
  horse: boolean
  notes: string[]
}

type SolarTermName =
  | '立春' | '雨水' | '惊蛰' | '春分' | '清明' | '谷雨'
  | '立夏' | '小满' | '芒种' | '夏至' | '小暑' | '大暑'
  | '立秋' | '处暑' | '白露' | '秋分' | '寒露' | '霜降'
  | '立冬' | '小雪' | '大雪' | '冬至' | '小寒' | '大寒'

const STEMS = ['', '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
const BRANCHES = ['', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
const STEM_ID: Record<string, number> = Object.fromEntries(STEMS.map((stem, index) => [stem, index]))
const BRANCH_ID: Record<string, number> = Object.fromEntries(BRANCHES.map((branch, index) => [branch, index]))
const SOLAR_TERM_ID: Record<SolarTermName, number> = {
  立春: 1,
  雨水: 2,
  惊蛰: 3,
  春分: 4,
  清明: 5,
  谷雨: 6,
  立夏: 7,
  小满: 8,
  芒种: 9,
  夏至: 10,
  小暑: 11,
  大暑: 12,
  立秋: 13,
  处暑: 14,
  白露: 15,
  秋分: 16,
  寒露: 17,
  霜降: 18,
  立冬: 19,
  小雪: 20,
  大雪: 21,
  冬至: 22,
  小寒: 23,
  大寒: 24,
}
const SOLAR_TERM_NAMES = Object.keys(SOLAR_TERM_ID) as SolarTermName[]
const SOLAR_TERM_NAME_BY_ID = Object.fromEntries(
  Object.entries(SOLAR_TERM_ID).map(([name, id]) => [id, name]),
) as Record<number, SolarTermName>
const QM_CYCLE = [0, 5, 6, 7, 9, 1, 2, 1, 2, 3, 3, 2, 1, 5, 4, 3, 1, 9, 8, 9, 8, 7, 7, 8, 9]
const DAY_PILLAR_BASE_DATE_UTC = Date.UTC(1900, 0, 1)
const DAY_PILLAR_BASE_INDEX = 10 // 甲戌
const PALACE_LABELS = {
  1: '坎一宫',
  2: '坤二宫',
  3: '震三宫',
  4: '巽四宫',
  5: '中五宫',
  6: '乾六宫',
  7: '兑七宫',
  8: '艮八宫',
  9: '离九宫',
} as const
const STAR_NAMES = ['', '天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'] as const
const GATE_NAMES = ['', '休门', '死门', '伤门', '杜门', '中门', '开门', '惊门', '生门', '景门'] as const
const DEITY_NAMES = ['', '值符', '腾蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'] as const
const EARTH_STEM_SEQUENCE = [5, 6, 7, 8, 9, 10, 4, 3, 2]
const FLYING_RING = [0, 7, 2, 3, 8, 1, 6, 5]
const PALACE_ORDER = [1, 8, 3, 4, 9, 2, 7, 6]
const DEITY_RING_YANG = [0, 7, 2, 3, 8, 1, 6, 5]
const DEITY_CODES_YIN = [1, 8, 7, 6, 5, 4, 3, 2]
const YIN_DUN_SEASON_ORDER: SolarTermName[] = [
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
]
const YIN_DUN_BUREAU_TABLE: Partial<Record<SolarTermName, [number, number, number]>> = {
  夏至: [9, 3, 6],
  小暑: [8, 2, 5],
  大暑: [7, 1, 4],
  立秋: [2, 5, 8],
  处暑: [1, 4, 7],
  白露: [9, 3, 6],
  秋分: [7, 1, 4],
  寒露: [6, 9, 3],
  霜降: [5, 8, 2],
  立冬: [6, 9, 3],
  小雪: [5, 8, 2],
  大雪: [4, 7, 1],
}
const YANG_DUN_PREVIOUS_LOWER_BUREAU: Partial<Record<SolarTermName, number>> = {
  芒种: 9,
}
const VOID_PALACE_MAP = [0, 0, 7, 7, 2, 3, 3, 8, 1, 1, 6, 5, 5]
const HORSE_PALACE_MAP = [0, 7, 5, 1, 3, 7, 5, 1, 3, 7, 5, 1, 3]
const HORSE_BRANCH_MAP = [0, 3, 12, 9, 4, 3, 12, 9, 6, 3, 12, 9, 6]
const SOLAR_TERM_CACHE = new Map<number, Record<SolarTermName, DateTime>>()
const MQIMEN_ZHIRUN_REFERENCE = GENERATED_MQIMEN_ZHIRUN_REFERENCE.map(([edate, seasonId, lead]) => ({
  at: DateTime.fromFormat(edate, 'yyyy-MM-dd HH:mm:ss', { zone: 'Asia/Shanghai' }),
  seasonId,
  lead,
}))

function mod(value: number, base: number) {
  return ((value % base) + base) % base
}

function wrapCode(value: number, max: number) {
  return ((value - 1 + max * 1000) % max) + 1
}

function calculateDayStemCode(year: number, month: number, day: number) {
  const current = Date.UTC(year, month - 1, day)
  const diffDays = Math.floor((current - DAY_PILLAR_BASE_DATE_UTC) / 86400000)
  const dayIndex = mod(DAY_PILLAR_BASE_INDEX + diffDays, 60)
  return (dayIndex % 10) + 1
}

function isJiaOrJiDay(date: DateTime) {
  const stemCode = calculateDayStemCode(date.year, date.month, date.day)
  return stemCode === 1 || stemCode === 6
}

function findNextJiaJiAnchorDate(termStartLocal: DateTime) {
  let cursor = termStartLocal.startOf('day')
  for (let offset = 0; offset < 6; offset += 1) {
    if (isJiaOrJiDay(cursor)) return cursor
    cursor = cursor.plus({ days: 1 })
  }
  return termStartLocal.startOf('day')
}

function getPreviousYinDunLowerBureau(seasonName: SolarTermName) {
  const seasonIndex = YIN_DUN_SEASON_ORDER.indexOf(seasonName)
  if (seasonIndex === 0) {
    return {
      bureauNumber: YANG_DUN_PREVIOUS_LOWER_BUREAU['芒种'] ?? 9,
      sourceSeason: '芒种' as SolarTermName,
    }
  }
  const previousSeason = YIN_DUN_SEASON_ORDER[seasonIndex - 1]
  const previousValues = YIN_DUN_BUREAU_TABLE[previousSeason]
  return {
    bureauNumber: previousValues?.[2] ?? 9,
    sourceSeason: previousSeason,
  }
}

function resolveYinChaiBuBureau(
  currentSeasonName: SolarTermName,
  currentSeasonAtUtc: DateTime,
  trueSolarLocal: DateTime,
) {
  const seasonValues = YIN_DUN_BUREAU_TABLE[currentSeasonName]
  if (!seasonValues) {
    throw new Error(`Missing yin-dun bureau table for solar term ${currentSeasonName}`)
  }

  const termStartLocal = currentSeasonAtUtc.setZone(trueSolarLocal.zoneName)
  const anchorDate = findNextJiaJiAnchorDate(termStartLocal)
  const currentDate = trueSolarLocal.startOf('day')

  if (currentDate.toMillis() < anchorDate.toMillis()) {
    const previous = getPreviousYinDunLowerBureau(currentSeasonName)
    return {
      bureauNumber: previous.bureauNumber,
      yuanBucket: 'carry_over_previous_lower',
      anchorDate,
      sourceSeason: previous.sourceSeason,
      carryFromPrevious: true,
    }
  }

  const offsetDays = Math.floor(currentDate.diff(anchorDate, 'days').days)
  const yuanIndex = offsetDays >= 10 ? 2 : offsetDays >= 5 ? 1 : 0
  const yuanBucket = yuanIndex === 0 ? '上元' : yuanIndex === 1 ? '中元' : '下元'

  return {
    bureauNumber: seasonValues[yuanIndex],
    yuanBucket,
    anchorDate,
    sourceSeason: currentSeasonName,
    carryFromPrevious: false,
  }
}

function buildYinDeityPalaceSequence(startPalace: number) {
  const sequence: number[] = []
  let palace = startPalace
  while (sequence.length < 8) {
    if (palace !== 5) sequence.push(palace)
    palace = palace === 1 ? 9 : palace - 1
  }
  return sequence
}

function getSolarTermsForYear(year: number) {
  const cached = SOLAR_TERM_CACHE.get(year)
  if (cached) return cached

  const rawTerms = GENERATED_SOLAR_TERM_TABLE[String(year) as keyof typeof GENERATED_SOLAR_TERM_TABLE]
  if (!rawTerms) {
    throw new Error(`Solar term table does not cover year ${year}`)
  }

  const parsed = Object.fromEntries(
    SOLAR_TERM_NAMES.map((name) => [
      name,
      DateTime.fromFormat(rawTerms[name], 'yyyy-MM-dd HH:mm:ss', { zone: 'Asia/Shanghai' }).toUTC(),
    ]),
  ) as Record<SolarTermName, DateTime>

  SOLAR_TERM_CACHE.set(year, parsed)
  return parsed
}

function getActiveSolarTerm(referenceUtc: DateTime) {
  const terms = [
    ...Object.entries(getSolarTermsForYear(referenceUtc.year - 1)),
    ...Object.entries(getSolarTermsForYear(referenceUtc.year)),
    ...Object.entries(getSolarTermsForYear(referenceUtc.year + 1)),
  ]
    .map(([name, at]) => ({ name: name as SolarTermName, at }))
    .sort((a, b) => a.at.toMillis() - b.at.toMillis())

  let active = terms[0]
  let next = terms[1]
  for (let index = 0; index < terms.length - 1; index += 1) {
    const current = terms[index]
    const upcoming = terms[index + 1]
    if (referenceUtc.toMillis() >= current.at.toMillis() && referenceUtc.toMillis() < upcoming.at.toMillis()) {
      active = current
      next = upcoming
      break
    }
  }

  return {
    current: active,
    next,
    seasonId: SOLAR_TERM_ID[active.name],
  }
}

function findMqimenZhiRunReference(referenceLocal: DateTime) {
  if (referenceLocal.toMillis() < MQIMEN_ZHIRUN_REFERENCE[0].at.toMillis()) {
    return {
      current: MQIMEN_ZHIRUN_REFERENCE[0],
      next: MQIMEN_ZHIRUN_REFERENCE[1] ?? MQIMEN_ZHIRUN_REFERENCE[0],
    }
  }
  const last = MQIMEN_ZHIRUN_REFERENCE[MQIMEN_ZHIRUN_REFERENCE.length - 1]
  if (referenceLocal.toMillis() >= last.at.toMillis()) {
    return { current: last, next: last }
  }
  let current = MQIMEN_ZHIRUN_REFERENCE[0]
  let next = MQIMEN_ZHIRUN_REFERENCE[1] ?? MQIMEN_ZHIRUN_REFERENCE[0]
  for (let index = 0; index < MQIMEN_ZHIRUN_REFERENCE.length - 1; index += 1) {
    const item = MQIMEN_ZHIRUN_REFERENCE[index]
    const upcoming = MQIMEN_ZHIRUN_REFERENCE[index + 1]
    if (referenceLocal.toMillis() >= item.at.toMillis() && referenceLocal.toMillis() < upcoming.at.toMillis()) {
      current = item
      next = upcoming
      break
    }
  }
  return { current, next }
}

function resolveSystemProfile(
  requestedProfile: QimenSystemProfile,
  currentSeasonId: number,
  currentSeasonName: SolarTermName,
  currentSeasonAtUtc: DateTime,
  trueSolarLocal: DateTime,
  periodBranchCode: number,
) {
  const currentPolarity = currentSeasonId >= 22 || currentSeasonId <= 9 ? 1 : -1
  const currentCycleRaw = QM_CYCLE[currentSeasonId] - (periodBranchCode % 3) * 6 * currentPolarity
  const currentCycle = wrapCode(currentCycleRaw === 0 ? 9 : currentCycleRaw, 9)

  if (requestedProfile === 'chai_bu') {
    if (currentPolarity < 0) {
      const yinBureau = resolveYinChaiBuBureau(currentSeasonName, currentSeasonAtUtc, trueSolarLocal)
      return {
        profile: 'chai_bu' as const,
        seasonId: currentSeasonId,
        seasonName: currentSeasonName,
        polarity: currentPolarity,
        bureauNumber: yinBureau.bureauNumber,
        zhirunApplied: false,
        oracleBacked: false,
        debug: {
          current_season_id: currentSeasonId,
          current_cycle: currentCycle,
          bureau_source_season: yinBureau.sourceSeason,
          bureau_anchor_date: yinBureau.anchorDate.toFormat('yyyy-LL-dd'),
          yuan_bucket: yinBureau.yuanBucket,
          carry_from_previous: yinBureau.carryFromPrevious,
        },
      }
    }
    return {
      profile: 'chai_bu' as const,
      seasonId: currentSeasonId,
      seasonName: currentSeasonName,
      polarity: currentPolarity,
      bureauNumber: currentCycle,
      zhirunApplied: false,
      oracleBacked: false,
      debug: {
        current_season_id: currentSeasonId,
        current_cycle: currentCycle,
      },
    }
  }

  const { current } = findMqimenZhiRunReference(trueSolarLocal)
  let zSeasonId = current.seasonId
  let zhirunApplied = false
  const referenceDate = current.lead >= 0
    ? current.at.startOf('day').minus({ days: current.lead })
    : current.at.startOf('day').plus({ days: Math.abs(current.lead) })
  let daysToReference = trueSolarLocal.startOf('day').diff(referenceDate.startOf('day'), 'days').days
  if (trueSolarLocal.hour >= 23) {
    daysToReference += 1
  }

  if (daysToReference >= 0) {
    if (daysToReference >= 15) {
      if (zSeasonId === 21 || zSeasonId === 9) {
        if (current.lead >= 8) zhirunApplied = true
      } else {
        zSeasonId += 1
      }
    }
  } else {
    if ((zSeasonId === 22 || zSeasonId === 10) && current.lead < 0) {
      zhirunApplied = true
    }
    zSeasonId -= 1
  }
  if (zSeasonId > 24) zSeasonId = 1
  if (zSeasonId < 1) zSeasonId = 24

  const zPolarity = zSeasonId >= 22 || zSeasonId <= 9 ? 1 : -1
  const zCycleRaw = QM_CYCLE[zSeasonId] - (periodBranchCode % 3) * 6 * zPolarity
  const zCycle = wrapCode(zCycleRaw === 0 ? 9 : zCycleRaw, 9)

  return {
    profile: 'zhi_run' as const,
    seasonId: zSeasonId,
    seasonName: SOLAR_TERM_NAME_BY_ID[zSeasonId],
    polarity: zPolarity,
    bureauNumber: zCycle,
    zhirunApplied,
    oracleBacked: true,
    debug: {
      current_season_id: current.seasonId,
      current_lead: current.lead,
      reference_date: current.at.toFormat("yyyy-LL-dd'T'HH:mm"),
      zhirun_anchor_date: referenceDate.toFormat("yyyy-LL-dd'T'HH:mm"),
      days_to_reference: daysToReference,
      adjusted_season_id: zSeasonId,
      adjusted_cycle: zCycle,
      zhirun_applied: zhirunApplied,
    },
  }
}

export function assertQimenInput(body: Record<string, unknown>) {
  const submittedAt = String(body.submitted_at ?? '').trim()
  const timezone = String(body.timezone ?? '').trim()
  const systemProfile = String(body.system_profile ?? 'chai_bu').trim() as QimenSystemProfile

  if (!submittedAt) throw new Error('submitted_at is required')
  if (!timezone) throw new Error('timezone is required')
  if (!['chai_bu', 'zhi_run'].includes(systemProfile)) {
    throw new Error('system_profile must be chai_bu or zhi_run')
  }

  return {
    submitted_at: submittedAt,
    timezone,
    system_profile: systemProfile,
  } satisfies QimenInput
}

function buildChartInput(input: QimenInput) {
  const local = DateTime.fromISO(input.submitted_at, { zone: input.timezone })
  if (!local.isValid) {
    throw new Error('submitted_at must be a valid ISO datetime')
  }

  return {
    local,
    chartInput: {
      dob: local.toFormat('yyyy-LL-dd'),
      tob: local.toFormat('HH:mm'),
      gender: null,
      birthplace: `Device local time (${input.timezone})`,
      timezone: input.timezone,
      birthplaceLatitude: null,
      birthplaceLongitude: null,
      intent: 'qimen_preview',
      language: 'en',
    },
  }
}

function buildEmptyResult(
  input: QimenInput,
  local: DateTime,
  seasonName: SolarTermName,
  seasonId: number,
  reason: string,
  requestedProfile: QimenSystemProfile,
) {
  return {
    input: {
      submission_datetime: local.toFormat("yyyy-LL-dd'T'HH:mm"),
      timezone: input.timezone,
      source: 'question_submit_time',
      system_profile: requestedProfile,
    },
    timing: {
      local_datetime: local.toFormat("yyyy-LL-dd'T'HH:mm"),
      utc_datetime: local.toUTC().toFormat("yyyy-LL-dd'T'HH:mm'Z'"),
      timezone_name: input.timezone,
      dst_applied: local.isInDST,
      casting_time_basis: 'local_civil_time',
    },
    calendar_context: {
      solar_term: seasonName,
      season_id: seasonId,
    },
    chart: null,
    palaces: [] as PalaceResult[],
    markers: {
      kong_wang: [],
      horse_star: null,
      active_palace_hints: [],
      middle_palace_policy: {
        tianqin: 'treat_as_mqimen_style',
        middle_gate: 'not_normally_used',
      },
    },
    value_summary: {},
    china95_style_layout: '',
    web_style_layout: '',
    engine_metadata: {
      engine: 'qimen_yang_plugin',
      version: 1,
      rule_profile:
        reason === 'yin_dun_out_of_scope_for_v1'
          ? 'yin_dun_pending_zhi_run'
          : requestedProfile === 'zhi_run'
            ? 'yang_dun_v1_zhi_run_oracle'
            : 'yang_dun_v1_chai_bu',
      source: 'verified_engine',
      fallback: false,
      out_of_scope: true,
      out_of_scope_reason: reason,
      compatibility_target: requestedProfile === 'zhi_run' ? 'mQimen.app/zhi_run' : 'mQimen.app/chai_bu',
      secondary_oracle_target: requestedProfile === 'zhi_run' ? null : 'china95.net/qimen_show.asp',
      oracle_backed: requestedProfile === 'zhi_run',
      zhirun_applied: false,
      profile_selection_status: requestedProfile === 'zhi_run' ? 'oracle_selected_pending_course_confirmation' : 'default_until_course_confirmation',
      layout_profile: 'web_style_text_v2',
    },
  }
}

function createBasePlate() {
  return Array.from({ length: 9 }, (_, index) => ({
    palace: index + 1,
    deity: 0,
    marker: '',
    centerProxyStem: 0,
    star: 0,
    heavenStem: 0,
    gateCarrierStem: 0,
    gate: 0,
    earthStem: 0,
  }))
}

function palaceIndexFromNumber(palace: number) {
  return palace - 1
}

function formatXunShou(hourLeadBranchCode: number, hourLeadStemCode: number) {
  return `甲${BRANCHES[hourLeadBranchCode]} (${STEMS[hourLeadStemCode]})`
}

function padCellLine(value: string, width = 12) {
  const text = value || ''
  const textLength = Array.from(text).length
  if (textLength >= width) return text.slice(0, width)
  return `${text}${' '.repeat(width - textLength)}`
}

function buildChina95StyleLayout(result: {
  input: { submission_datetime: string; timezone: string; system_profile?: string | null }
  calendar_context: { solar_term?: string; year_ganzhi?: string; month_ganzhi?: string; day_ganzhi?: string; hour_ganzhi?: string }
  chart: null | { yin_yang: string; bureau_number: number; xun_shou: string; zhi_fu: string; zhi_shi: string }
  palaces: PalaceResult[]
  markers?: { kong_wang?: string[]; horse_star?: { palace?: number | null } | null }
}) {
  if (!result.chart || !result.palaces.length) return ''

  const palaceMap = new Map(result.palaces.map((palace) => [palace.palace, palace]))
  const layout = [
    [4, 9, 2],
    [3, 5, 7],
    [8, 1, 6],
  ]
  const zhiFuPalace = result.palaces.find((item) => item.star === result.chart?.zhi_fu)
  const zhiShiPalace = result.palaces.find((item) => item.gate === result.chart?.zhi_shi)
  const kongWang = (result.markers?.kong_wang ?? []).filter(Boolean).join(' ')

  const renderPalaceCell = (palaceNumber: number) => {
    const palace = palaceMap.get(palaceNumber)
    if (!palace) return [''.padEnd(12, ' '), ''.padEnd(12, ' '), ''.padEnd(12, ' ')]
    if (palaceNumber === 5) {
      return [
        padCellLine(''),
        padCellLine(palace.earth_plate_stem || ''),
        padCellLine(''),
      ]
    }
    const deityLine = palace.empty ? `${palace.deity} 空` : palace.deity
    const gateLine = `${palace.gate}${palace.earth_plate_stem ? ` ${palace.earth_plate_stem}` : ''}${palace.horse ? ' 马' : ''}`
    const starLine = `${palace.star}${palace.heaven_plate_stem ? ` ${palace.heaven_plate_stem}` : ''}`
    return [
      padCellLine(deityLine),
      padCellLine(gateLine),
      padCellLine(starLine),
    ]
  }

  const lines: string[] = []
  lines.push(`方式：转盘奇门 - ${result.input.system_profile === 'zhi_run' ? '置闰法' : '拆补法'}`)
  lines.push('排盘：本地引擎 - 网页盘式样')
  lines.push(`时间：${result.input.submission_datetime} (${result.input.timezone})`)
  if (result.calendar_context.year_ganzhi) {
    lines.push(
      `干支：${result.calendar_context.year_ganzhi}年 ${result.calendar_context.month_ganzhi}月 ${result.calendar_context.day_ganzhi}日 ${result.calendar_context.hour_ganzhi}时`,
    )
  }
  if (kongWang) {
    lines.push(`旬空：${kongWang}`)
  }
  lines.push(
    `${result.calendar_context.solar_term}：${result.chart.yin_yang}${result.chart.bureau_number}局  值符${result.chart.zhi_fu}落${zhiFuPalace?.label ?? ''}  值使${result.chart.zhi_shi}落${zhiShiPalace?.label ?? ''}`,
  )
  lines.push(`旬首：${result.chart.xun_shou}`)
  lines.push('')
  const border = '+--------------+--------------+--------------+'
  for (const row of layout) {
    const cells = row.map(renderPalaceCell)
    lines.push(border)
    lines.push(`| ${cells[0][0]} | ${cells[1][0]} | ${cells[2][0]} |`)
    lines.push(`| ${cells[0][1]} | ${cells[1][1]} | ${cells[2][1]} |`)
    lines.push(`| ${cells[0][2]} | ${cells[1][2]} | ${cells[2][2]} |`)
  }
  lines.push(border)
  return lines.join('\n')
}

export async function calculateQimen(input: QimenInput) {
  const { local, chartInput } = buildChartInput(input)
  const bazi = await calculateChart(chartInput, { includeComparison: false, timeBasis: 'civil_time' })
  const timingInfo = bazi.analysis.timing
  const civilLocal = DateTime.fromISO(timingInfo.localCivilTime, { zone: input.timezone })
  const civilUtc = civilLocal.toUTC()
  const solarTerm = getActiveSolarTerm(civilUtc)
  const seasonName = solarTerm.current.name
  const seasonId = solarTerm.seasonId

  const dayStemCode = STEM_ID[bazi.pillars.day[0]]
  const dayBranchCode = BRANCH_ID[bazi.pillars.day[1]]
  const hourStemCode = STEM_ID[bazi.pillars.hour[0]]
  const hourBranchCode = BRANCH_ID[bazi.pillars.hour[1]]
  const periodStemCode = dayStemCode > 5 ? 6 : 1
  const periodBranchCode = wrapCode(
    dayBranchCode + (dayStemCode > 5 ? 6 - dayStemCode : 1 - dayStemCode),
    12,
  )
  const profile = resolveSystemProfile(
    input.system_profile ?? 'chai_bu',
    seasonId,
    seasonName,
    solarTerm.current.at,
    civilLocal,
    periodBranchCode,
  )

  if (profile.polarity < 0 && profile.profile === 'zhi_run') {
    return buildEmptyResult(
      input,
      local,
      seasonName,
      seasonId,
      'yin_dun_out_of_scope_for_v1',
      profile.profile,
    )
  }

  const plate = createBasePlate()
  let palaceCursor = profile.bureauNumber
  const bureauNumber = profile.bureauNumber
  let starDuty = bureauNumber
  let gateDuty = bureauNumber
  const diffToHour = hourStemCode - 1
  let hourLeadBranchCode = wrapCode(hourBranchCode - diffToHour, 12)
  const hourLeadStemCode = 5 + mod((13 - hourLeadBranchCode) / 2, 6)
  const polarity = profile.polarity
  starDuty = bureauNumber
  gateDuty = bureauNumber

  for (let index = 0; index < 9; index += 1) {
    plate[palaceIndexFromNumber(palaceCursor)].earthStem = EARTH_STEM_SEQUENCE[index]
    if (EARTH_STEM_SEQUENCE[index] === hourLeadStemCode) {
      starDuty = palaceCursor
      gateDuty = palaceCursor === 5 ? 2 : palaceCursor
    }
    palaceCursor = wrapCode(palaceCursor + polarity, 9)
  }

  const hourReferenceStem = hourStemCode === 1 ? hourLeadStemCode : hourStemCode
  let starStart = plate.findIndex((item) => item.earthStem === hourReferenceStem)
  if (starStart === 4) starStart = 1
  let ringStart = FLYING_RING.findIndex((item) => item === starStart)
  let ringValue = PALACE_ORDER.findIndex((item) => item === (starDuty === 5 ? 2 : starDuty))

  for (let index = 0; index < 8; index += 1) {
    const targetIndex = FLYING_RING[ringStart]
    const targetPalaceNumber = PALACE_ORDER[ringValue]
    plate[targetIndex].star = targetPalaceNumber
    plate[targetIndex].heavenStem = plate[palaceIndexFromNumber(targetPalaceNumber)].earthStem
    if (targetPalaceNumber === 2) {
      plate[targetIndex].centerProxyStem = plate[4].earthStem
    }
    ringStart = (ringStart + 1) % FLYING_RING.length
    ringValue = (ringValue + 1) % PALACE_ORDER.length
  }

  let gateStart = plate.findIndex((item) => item.earthStem === hourLeadStemCode)
  gateStart = mod(gateStart + diffToHour, 9)
  if (gateStart === 4) gateStart = 1
  let gateRingStart = FLYING_RING.findIndex((item) => item === gateStart)
  let gateValue = PALACE_ORDER.findIndex((item) => item === gateDuty)
  for (let index = 0; index < 8; index += 1) {
    const targetIndex = FLYING_RING[gateRingStart]
    const targetPalaceNumber = PALACE_ORDER[gateValue]
    plate[targetIndex].gate = targetPalaceNumber
    plate[targetIndex].gateCarrierStem = plate[palaceIndexFromNumber(targetPalaceNumber)].earthStem
    gateRingStart = (gateRingStart + 1) % FLYING_RING.length
    gateValue = (gateValue + 1) % PALACE_ORDER.length
  }

  const tianYiStarCode = DEITY_RING_YANG[DEITY_RING_YANG.findIndex((item) => item === starStart)] + 1
  if (polarity > 0) {
    const deityRing = DEITY_RING_YANG
    let deityStart = deityRing.findIndex((item) => item === starStart)
    for (let code = 1; code <= 8; code += 1) {
      const targetIndex = deityRing[deityStart]
      plate[targetIndex].deity = code
      deityStart = (deityStart + 1) % deityRing.length
    }
  } else {
    const deityPalaces = buildYinDeityPalaceSequence(starStart + 1)
    for (let index = 0; index < DEITY_CODES_YIN.length; index += 1) {
      const targetPalace = deityPalaces[index]
      plate[palaceIndexFromNumber(targetPalace)].deity = DEITY_CODES_YIN[index]
    }
  }

  const voidBranchOne = wrapCode(hourLeadBranchCode - 1, 12)
  const voidBranchTwo = wrapCode(hourLeadBranchCode - 2, 12)
  const voidPalaceOne = VOID_PALACE_MAP[voidBranchOne]
  const voidPalaceTwo = VOID_PALACE_MAP[voidBranchTwo]
  if (voidPalaceOne > 0) {
    plate[palaceIndexFromNumber(voidPalaceOne)].marker = 'void'
  }
  if (voidPalaceTwo > 0) {
    plate[palaceIndexFromNumber(voidPalaceTwo)].marker = 'void'
  }
  const horsePalace = HORSE_PALACE_MAP[hourBranchCode]
  if (horsePalace > 0) {
    const marker = plate[palaceIndexFromNumber(horsePalace)].marker
    plate[palaceIndexFromNumber(horsePalace)].marker = marker === 'void' ? 'void_horse' : 'horse'
  }
  const horseBranchCode = HORSE_BRANCH_MAP[hourBranchCode]

  const palaces: PalaceResult[] = plate.map((item) => {
    const notes: string[] = []
    if (item.centerProxyStem > 0) {
      notes.push(`center_proxy_stem:${STEMS[item.centerProxyStem]}`)
    }
    if (item.marker === 'void') {
      notes.push('kong_wang')
    }
    if (item.marker === 'horse') {
      notes.push('horse_star')
    }
    if (item.marker === 'void_horse') {
      notes.push('kong_wang')
      notes.push('horse_star')
    }
    return {
      palace: item.palace,
      label: PALACE_LABELS[item.palace as keyof typeof PALACE_LABELS],
      earth_plate_stem: STEMS[item.earthStem],
      heaven_plate_stem: STEMS[item.heavenStem] || '',
      gate: GATE_NAMES[item.gate] || '',
      star: STAR_NAMES[item.star] || '',
      deity: DEITY_NAMES[item.deity] || '',
      original_gate_palace: item.gate > 0 ? item.gate : null,
      original_star_palace: item.star > 0 ? item.star : null,
      empty: item.marker === 'void' || item.marker === 'void_horse',
      horse: item.marker === 'horse' || item.marker === 'void_horse',
      notes,
    }
  })

  const zhiFuPalace = palaces.find((item) => item.palace === starDuty)
  const zhiShiPalace = palaces.find((item) => item.palace === gateDuty)

  return {
    input: {
      submission_datetime: local.toFormat("yyyy-LL-dd'T'HH:mm"),
      timezone: input.timezone,
      source: 'question_submit_time',
      system_profile: profile.profile,
    },
    timing: {
      local_datetime: timingInfo.localCivilTime,
      utc_datetime: timingInfo.utcTime,
      timezone_name: timingInfo.timezone,
      dst_applied: timingInfo.dstApplied,
      casting_time_basis: 'local_civil_time',
    },
    calendar_context: {
      solar_term: profile.seasonName,
      season_id: profile.seasonId,
      current_solar_term: seasonName,
      current_season_id: seasonId,
      year_ganzhi: bazi.pillars.year,
      month_ganzhi: bazi.pillars.month,
      day_ganzhi: bazi.pillars.day,
      hour_ganzhi: bazi.pillars.hour,
    },
    chart: {
      mode: polarity > 0 ? 'yang_dun' : 'yin_dun',
      yin_yang: polarity > 0 ? '阳遁' : '阴遁',
      bureau_number: bureauNumber,
      xun_shou: formatXunShou(hourLeadBranchCode, hourLeadStemCode),
      zhi_fu: STAR_NAMES[starDuty],
      zhi_shi: GATE_NAMES[gateDuty],
      tian_yi: STAR_NAMES[tianYiStarCode],
      dun_profile: polarity > 0 ? 'yang_dun' : 'yin_dun',
      solar_term: profile.seasonName,
      system_profile: profile.profile,
    },
    palaces,
    markers: {
      kong_wang: [BRANCHES[voidBranchTwo], BRANCHES[voidBranchOne]],
      horse_star: {
        branch: BRANCHES[horseBranchCode],
        palace: horsePalace,
        label: horsePalace ? PALACE_LABELS[horsePalace as keyof typeof PALACE_LABELS] : '',
      },
      active_palace_hints: [
        `值符:${zhiFuPalace?.label ?? ''}`,
        `值使:${zhiShiPalace?.label ?? ''}`,
      ],
      middle_palace_policy: {
        tianqin: 'mQimen_style_proxy',
        middle_gate: 'not_normally_used',
      },
    },
    value_summary: {
      zhi_fu: `${STAR_NAMES[starDuty]} (${zhiFuPalace?.label ?? ''})`,
      zhi_shi: `${GATE_NAMES[gateDuty]} (${zhiShiPalace?.label ?? ''})`,
      xun_shou: formatXunShou(hourLeadBranchCode, hourLeadStemCode),
      fu_tou: `${STEMS[periodStemCode]}${BRANCHES[periodBranchCode]}`,
    },
    china95_style_layout: buildChina95StyleLayout({
      input: {
        submission_datetime: local.toFormat("yyyy-LL-dd'T'HH:mm"),
        timezone: input.timezone,
        system_profile: profile.profile,
      },
      calendar_context: {
        solar_term: profile.seasonName,
        year_ganzhi: bazi.pillars.year,
        month_ganzhi: bazi.pillars.month,
        day_ganzhi: bazi.pillars.day,
        hour_ganzhi: bazi.pillars.hour,
      },
      chart: {
        yin_yang: polarity > 0 ? '阳遁' : '阴遁',
        bureau_number: bureauNumber,
        xun_shou: formatXunShou(hourLeadBranchCode, hourLeadStemCode),
        zhi_fu: STAR_NAMES[starDuty],
        zhi_shi: GATE_NAMES[gateDuty],
      },
      palaces,
      markers: {
        kong_wang: [BRANCHES[voidBranchTwo], BRANCHES[voidBranchOne]],
        horse_star: {
          palace: horsePalace,
        },
      },
    }),
    web_style_layout: buildChina95StyleLayout({
      input: {
        submission_datetime: local.toFormat("yyyy-LL-dd'T'HH:mm"),
        timezone: input.timezone,
        system_profile: profile.profile,
      },
      calendar_context: {
        solar_term: profile.seasonName,
        year_ganzhi: bazi.pillars.year,
        month_ganzhi: bazi.pillars.month,
        day_ganzhi: bazi.pillars.day,
        hour_ganzhi: bazi.pillars.hour,
      },
      chart: {
        yin_yang: polarity > 0 ? '阳遁' : '阴遁',
        bureau_number: bureauNumber,
        xun_shou: formatXunShou(hourLeadBranchCode, hourLeadStemCode),
        zhi_fu: STAR_NAMES[starDuty],
        zhi_shi: GATE_NAMES[gateDuty],
      },
      palaces,
      markers: {
        kong_wang: [BRANCHES[voidBranchTwo], BRANCHES[voidBranchOne]],
        horse_star: {
          palace: horsePalace,
        },
      },
    }),
    engine_metadata: {
      engine: 'qimen_yang_plugin',
      version: 1,
      rule_profile:
        profile.profile === 'zhi_run'
          ? 'yang_dun_v1_zhi_run_oracle'
          : polarity > 0
            ? 'yang_dun_v1_chai_bu'
            : 'yin_dun_v1_chai_bu',
      source: 'verified_engine',
      fallback: false,
      out_of_scope: false,
      compatibility_target: profile.profile === 'zhi_run' ? 'mQimen.app/zhi_run' : 'mQimen.app/chai_bu',
      secondary_oracle_target: profile.profile === 'zhi_run' ? null : 'china95.net/qimen_show.asp',
      oracle_alignment: profile.profile === 'zhi_run' ? 'season_adjustment_and_cycle_logic' : 'structure_and_cycle_logic',
      oracle_backed: profile.oracleBacked,
      zhirun_applied: profile.zhirunApplied,
      profile_selection_status: profile.profile === 'zhi_run' ? 'oracle_selected_pending_course_confirmation' : 'default_until_course_confirmation',
      casting_time_basis: 'local_civil_time',
      layout_profile: 'web_style_text_v2',
    },
    debug: {
      season_id: seasonId,
      polarity,
      period_branch_code: periodBranchCode,
      period_stem_code: periodStemCode,
      hour_lead_stem_code: hourLeadStemCode,
      hour_lead_branch_code: hourLeadBranchCode,
      star_duty_palace: starDuty,
      gate_duty_palace: gateDuty,
      ...profile.debug,
    },
  }
}

export const calculateQimenYang = calculateQimen
