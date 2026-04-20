#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = '/Users/liheng/Desktop/cosmic-daily-app'
const DEFAULT_OUTPUT = path.join(ROOT, 'specs/chart-engine/random-calibration-cases.json')
const SAMPLE_SIZE = Number(process.env.SAMPLE_SIZE || '40')
const SEED = Number(process.env.RAND_SEED || '20260316')
const OUTPUT_PATH = process.env.OUT_PATH || DEFAULT_OUTPUT

const LOCATIONS = [
  { birthplace: 'Beijing, China', timezone: 'Asia/Shanghai' },
  { birthplace: 'Shanghai, China', timezone: 'Asia/Shanghai' },
  { birthplace: 'Guangzhou, Guangdong, China', timezone: 'Asia/Shanghai' },
  { birthplace: 'Shenzhen, Guangdong, China', timezone: 'Asia/Shanghai' },
  { birthplace: 'Hong Kong, China', timezone: 'Asia/Hong_Kong' },
  { birthplace: 'Taipei, Taiwan', timezone: 'Asia/Taipei' },
  { birthplace: 'Toronto, Ontario, Canada', timezone: 'America/Toronto' },
  { birthplace: 'New York, New York, USA', timezone: 'America/New_York' },
  { birthplace: 'London, England, UK', timezone: 'Europe/London' },
  { birthplace: 'Sydney, NSW, Australia', timezone: 'Australia/Sydney' },
  { birthplace: 'Melbourne, Victoria, Australia', timezone: 'Australia/Melbourne' },
  { birthplace: 'Rio de Janeiro, Brazil', timezone: 'America/Sao_Paulo' },
  { birthplace: 'Cape Town, South Africa', timezone: 'Africa/Johannesburg' },
]

const GENDERS = ['male', 'female']

function createRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function pick(rng, values) {
  return values[Math.floor(rng() * values.length)]
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year, month) {
  const common = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return common[month - 1]
}

function randomDate(rng) {
  const year = 1900 + Math.floor(rng() * 201)
  const month = 1 + Math.floor(rng() * 12)
  const day = 1 + Math.floor(rng() * daysInMonth(year, month))
  return `${year}-${pad(month)}-${pad(day)}`
}

function randomTime(rng) {
  const edgeHours = [0, 1, 7, 8, 9, 10, 16, 17, 22, 23]
  const useEdge = rng() < 0.35
  const hour = useEdge ? pick(rng, edgeHours) : Math.floor(rng() * 24)
  const minute = Math.floor(rng() * 60)
  return `${pad(hour)}:${pad(minute)}`
}

async function main() {
  const rng = createRng(SEED)
  const cases = Array.from({ length: SAMPLE_SIZE }, (_, index) => {
    const location = pick(rng, LOCATIONS)
    return {
      id: `R${String(index + 1).padStart(3, '0')}`,
      type: 'random_calibration',
      label: `Random calibration sample ${index + 1}`,
      input: {
        dob: randomDate(rng),
        tob: randomTime(rng),
        gender: pick(rng, GENDERS),
        birthplace: location.birthplace,
        timezone: location.timezone,
      },
    }
  })

  const payload = {
    meta: {
      generatedAt: new Date().toISOString(),
      seed: SEED,
      sampleSize: SAMPLE_SIZE,
      purpose: 'Random product-mode calibration against 问真八字 oracle',
    },
    cases,
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ output: OUTPUT_PATH, sampleSize: SAMPLE_SIZE, seed: SEED }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
