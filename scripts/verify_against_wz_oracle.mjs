#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = '/Users/liheng/Desktop/cosmic-daily-app'
const DEFAULT_CASES_PATH = path.join(ROOT, 'specs/chart-engine/validation-cases.json')
const CASES_PATH = process.env.CASES_PATH || DEFAULT_CASES_PATH

const WZ_ORACLE_URL = 'https://bzapi4.iwzbz.com/getbasebz8.php'
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const CASE_LIMIT = Number(process.env.CASE_LIMIT || '0')
const YZS = Number(process.env.WZ_YZS || '0')
const INCLUDE_LOCAL = process.env.INCLUDE_LOCAL === '1'
const WZ_INPUT_MODE = process.env.WZ_INPUT_MODE || 'raw'
const BEIJING_TIMEZONE = 'Asia/Shanghai'

function formatCaseDate(input) {
  const date = String(input.date || input.dob || '').trim()
  const time = String(input.time || input.tob || '').trim()
  if (!date || !time) {
    throw new Error(`Case is missing date/time: ${JSON.stringify(input)}`)
  }
  return `${date} ${time}`
}

function genderToWzSex(gender) {
  return gender === 'female' ? 0 : 1
}

function parseWzPillars(payload) {
  const bz = payload?.bz || {}
  return {
    year: `${bz['0'] || ''}${bz['1'] || ''}`,
    month: `${bz['2'] || ''}${bz['3'] || ''}`,
    day: `${bz['4'] || ''}${bz['5'] || ''}`,
    hour: `${bz['6'] || ''}${bz['7'] || ''}`,
  }
}

function parseNaiveDateTime(dateTime) {
  const [datePart, timePart] = String(dateTime).trim().split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second = 0] = timePart.split(':').map(Number)
  return { year, month, day, hour, minute, second }
}

function getOffsetMinutes(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  )
  return (asUtc - date.getTime()) / 60000
}

function zonedDateTimeToUtc(dateTime, timeZone) {
  const parsed = parseNaiveDateTime(dateTime)
  let utcMillis = Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute, parsed.second)

  for (let index = 0; index < 4; index += 1) {
    const offset = getOffsetMinutes(timeZone, new Date(utcMillis))
    const adjusted = Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute, parsed.second) - offset * 60000
    if (adjusted === utcMillis) break
    utcMillis = adjusted
  }

  return new Date(utcMillis)
}

function formatInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`
}

function comparePillars(actual, expected) {
  const mismatches = []
  for (const key of ['year', 'month', 'day', 'hour']) {
    if ((actual?.[key] || '') !== (expected?.[key] || '')) {
      mismatches.push({
        field: `pillars.${key}`,
        expected: expected?.[key] || '',
        actual: actual?.[key] || '',
      })
    }
  }
  return mismatches
}

async function signUpDisposableUser() {
  const email = `wz-compare-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@local.test`
  const password = `Test!${Math.random().toString(36).slice(2)}`
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  const json = await response.json()
  if (!response.ok) {
    throw new Error(`Unable to create disposable auth session: ${JSON.stringify(json)}`)
  }
  const token = json?.session?.access_token || json?.access_token
  if (!token) {
    throw new Error(`Signup succeeded but no access token was returned: ${JSON.stringify(json)}`)
  }
  return token
}

async function loadCases() {
  const raw = await fs.readFile(CASES_PATH, 'utf8')
  const payload = JSON.parse(raw)
  const cases = payload.cases || []
  return CASE_LIMIT > 0 ? cases.slice(0, CASE_LIMIT) : cases
}

async function queryWzOracle(input) {
  const dateTime = formatCaseDate(input)
  const params = new URLSearchParams({
    d: dateTime,
    s: String(genderToWzSex(input.gender)),
    today: dateTime,
    vip: '0',
    userguid: '',
    yzs: String(YZS),
  })
  const response = await fetch(`${WZ_ORACLE_URL}?${params.toString()}`)
  const body = await response.json()
  return {
    status: response.status,
    ok: response.ok,
    body,
    url: `${WZ_ORACLE_URL}?${params.toString()}`,
  }
}

async function queryLocalChart(token, input) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/chart-preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
  const body = await response.json()
  return {
    status: response.status,
    ok: response.ok,
    body,
  }
}

function deriveWzInputFromLocal(localResponse, originalInput) {
  const trueSolar = localResponse?.body?.analysis?.timing?.trueSolarTime
  if (!trueSolar) {
    return formatCaseDate(originalInput)
  }
  return String(trueSolar).replace('T', ' ')
}

function deriveWzInputMode(localResponse, originalInput) {
  if (!localResponse?.ok) return formatCaseDate(originalInput)

  if (WZ_INPUT_MODE === 'local_true_solar') {
    return deriveWzInputFromLocal(localResponse, originalInput)
  }

  if (WZ_INPUT_MODE === 'local_true_solar_beijing') {
    const trueSolar = deriveWzInputFromLocal(localResponse, originalInput)
    const sourceZone = localResponse?.body?.analysis?.timing?.timezone || originalInput.timezone || BEIJING_TIMEZONE
    const instant = zonedDateTimeToUtc(trueSolar, sourceZone)
    return formatInZone(instant, BEIJING_TIMEZONE)
  }

  return formatCaseDate(originalInput)
}

async function main() {
  const cases = await loadCases()
  const needsLocal = INCLUDE_LOCAL || WZ_INPUT_MODE === 'local_true_solar' || WZ_INPUT_MODE === 'local_true_solar_beijing'
  const token = needsLocal ? await signUpDisposableUser() : null
  const results = []

  for (const testCase of cases) {
    let local = null
    if (needsLocal) {
      local = await queryLocalChart(token, testCase.input)
    }

    const derivedDateTime = deriveWzInputMode(local, testCase.input)
    const wzInput =
      WZ_INPUT_MODE === 'raw'
        ? testCase.input
        : { ...testCase.input, dob: null, tob: null, date: null, time: null, __dateTime: derivedDateTime }

    if (wzInput.__dateTime) {
      wzInput.date = wzInput.__dateTime.split(' ')[0]
      wzInput.time = wzInput.__dateTime.split(' ')[1]
    }

    const wz = await queryWzOracle(wzInput)
    const wzPillars = parseWzPillars(wz.body)
    const hasExpected = Boolean(testCase.expected?.pillars)
    const wzVsExpected = hasExpected ? comparePillars(wzPillars, testCase.expected?.pillars) : []

    let localVsWz = []
    if (INCLUDE_LOCAL && local?.ok) {
      localVsWz = comparePillars(local.body?.pillars, wzPillars)
    }

    results.push({
      id: testCase.id,
      label: testCase.label,
      input: {
        dateTime: formatCaseDate(testCase.input),
        gender: testCase.input.gender,
        birthplace: testCase.input.birthplace || null,
        timezone: testCase.input.timezone || null,
      },
      wzOracle: {
        ok: wz.ok,
        url: wz.url,
        inputDateTime: WZ_INPUT_MODE === 'raw' ? formatCaseDate(testCase.input) : derivedDateTime,
        pillars: wzPillars,
        lunarLabel: wz.body?.bz?.['8'] || null,
      },
      expected: {
        pillars: testCase.expected?.pillars || null,
        present: hasExpected,
      },
      mismatches: {
        wzVsExpected,
        localVsWz,
      },
      localChart: local?.ok
        ? {
            source: local.body?.source,
            engine: local.body?.analysis?.engineMetadata?.engine,
            dayPillarMethod: local.body?.analysis?.engineMetadata?.dayPillarMethod,
            pillars: local.body?.pillars,
          }
        : local
          ? {
              status: local.status,
              error: local.body,
            }
          : null,
    })
  }

  const summary = {
    total: results.length,
    casesWithExpected: results.filter((item) => item.expected.present).length,
    wzMatchedExpected: results.filter((item) => item.expected.present && item.mismatches.wzVsExpected.length === 0).length,
    wzMismatchedExpected: results.filter((item) => item.expected.present && item.mismatches.wzVsExpected.length > 0).length,
    localMatchedWz: INCLUDE_LOCAL
      ? results.filter((item) => item.mismatches.localVsWz.length === 0).length
      : null,
    localMismatchedWz: INCLUDE_LOCAL
      ? results.filter((item) => item.mismatches.localVsWz.length > 0).length
      : null,
    wzYzs: YZS,
    wzInputMode: WZ_INPUT_MODE,
    casesPath: CASES_PATH,
  }

  console.log(JSON.stringify({ summary, results }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
