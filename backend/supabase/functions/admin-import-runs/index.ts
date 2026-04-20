import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

import { requireAdminContext } from '../_shared/assert-admin.ts'
import { corsHeaders, json } from '../_shared/admin/http.ts'

const LOCAL_IMPORT_STATE =
  '/Users/liheng/Desktop/cosmic-daily-app/data/import-runs/qimen-yangpan/state.json'
const LOCAL_IMPORT_SUMMARY =
  '/Users/liheng/Desktop/cosmic-daily-app/data/import-runs/qimen-yangpan/progress-summary.md'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const adminContext = await requireAdminContext(req)
    if ('error' in adminContext) return adminContext.error

    let state: unknown = null
    let summary = ''
    let available = false

    try {
      const [stateText, summaryText] = await Promise.all([
        Deno.readTextFile(LOCAL_IMPORT_STATE),
        Deno.readTextFile(LOCAL_IMPORT_SUMMARY),
      ])
      state = JSON.parse(stateText)
      summary = summaryText
      available = true
    } catch {
      available = false
    }

    return json({
      available,
      source: available ? 'local_filesystem' : 'unavailable',
      paths: {
        state: LOCAL_IMPORT_STATE,
        summary: LOCAL_IMPORT_SUMMARY,
      },
      state,
      summary,
    })
  } catch (error) {
    return json({ error: String(error) }, 400)
  }
})
