#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = '/Users/liheng/Desktop/cosmic-daily-app'
const CASES_PATH = path.join(ROOT, 'specs/chart-engine/validation-cases.json')

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const LIMIT = Number(process.env.CASE_LIMIT || '0')

function normalizeTagList(list) {
  return [...new Set((list || []).map(String))].sort()
}

async function signUpDisposableUser() {
  const email = `chart-validate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@local.test`
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
  return LIMIT > 0 ? cases.slice(0, LIMIT) : cases
}

function compareValue(label, actual, expected, mismatches) {
  if ((actual ?? '') !== (expected ?? '')) {
    mismatches.push({ field: label, expected, actual })
  }
}

function compareTagMap(actual, expected, mismatches) {
  if (!expected) return
  for (const key of Object.keys(expected)) {
    const actualList = normalizeTagList(actual?.[key] || [])
    const expectedList = normalizeTagList(expected[key] || [])
    if (JSON.stringify(actualList) !== JSON.stringify(expectedList)) {
      mismatches.push({
        field: `shenShaByPillar.${key}`,
        expected: expectedList,
        actual: actualList,
      })
    }
  }
}

async function run() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || (await signUpDisposableUser())
  const cases = await loadCases()
  const results = []

  for (const testCase of cases) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/chart-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(testCase.input),
    })

    const body = await response.json()
    const mismatches = []

    if (!response.ok) {
      results.push({
        id: testCase.id,
        label: testCase.label,
        ok: false,
        status: response.status,
        mismatches: [{ field: 'http', expected: '200', actual: `${response.status}: ${JSON.stringify(body)}` }],
      })
      continue
    }

    compareValue('pillars.year', body?.pillars?.year, testCase.expected?.pillars?.year, mismatches)
    compareValue('pillars.month', body?.pillars?.month, testCase.expected?.pillars?.month, mismatches)
    compareValue('pillars.day', body?.pillars?.day, testCase.expected?.pillars?.day, mismatches)
    compareValue('pillars.hour', body?.pillars?.hour, testCase.expected?.pillars?.hour, mismatches)
    compareValue('dayun.displayAge', body?.analysis?.dayun?.displayAge, testCase.expected?.dayunDisplayAge, mismatches)
    compareValue('twelveLifeStages.day', body?.analysis?.twelveLifeStages?.day, testCase.expected?.twelveLifeDay, mismatches)
    compareValue('kongWang.display', body?.analysis?.kongWang?.display, testCase.expected?.kongWang, mismatches)

    const expectedNayin = testCase.expected?.nayin || {}
    compareValue('nayin.year', body?.analysis?.nayin?.year, expectedNayin.year, mismatches)
    compareValue('nayin.month', body?.analysis?.nayin?.month, expectedNayin.month, mismatches)
    compareValue('nayin.day', body?.analysis?.nayin?.day, expectedNayin.day, mismatches)
    compareValue('nayin.hour', body?.analysis?.nayin?.hour, expectedNayin.hour, mismatches)

    compareTagMap(body?.analysis?.shenSha?.byPillar, testCase.expected?.shenShaByPillar, mismatches)

    const actualChartLevel = normalizeTagList(body?.analysis?.shenSha?.chartLevel || [])
    const expectedChartLevel = normalizeTagList(testCase.expected?.chartLevelShenSha || [])
    if (expectedChartLevel.length > 0) {
      for (const tag of expectedChartLevel) {
        if (!actualChartLevel.includes(tag)) {
          mismatches.push({
            field: 'shenSha.chartLevel',
            expected: expectedChartLevel,
            actual: actualChartLevel,
          })
          break
        }
      }
    }

    results.push({
      id: testCase.id,
      label: testCase.label,
      ok: mismatches.length === 0,
      mismatches,
      actual: {
        pillars: body?.pillars,
        dayunDisplayAge: body?.analysis?.dayun?.displayAge,
        twelveLifeDay: body?.analysis?.twelveLifeStages?.day,
        kongWang: body?.analysis?.kongWang?.display,
        nayin: body?.analysis?.nayin,
        shenShaByPillar: body?.analysis?.shenSha?.byPillar,
        chartLevel: body?.analysis?.shenSha?.chartLevel,
      },
    })
  }

  const passed = results.filter((item) => item.ok).length
  const failed = results.length - passed
  console.log(JSON.stringify({
    summary: {
      total: results.length,
      passed,
      failed,
      supabaseUrl: SUPABASE_URL,
    },
    results,
  }, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
