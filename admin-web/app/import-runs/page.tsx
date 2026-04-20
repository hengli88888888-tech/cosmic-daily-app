'use client'

import { useEffect, useState } from 'react'

import { AdminShell } from '@/components/admin-shell'
import { AuthGuard } from '@/components/auth-guard'
import { adminApi } from '@/lib/admin-api'

type ImportRunsData = {
  available: boolean
  source?: string
  paths?: Record<string, string>
  state?: Record<string, any>
  summary?: string
}

export default function ImportRunsPage() {
  const [data, setData] = useState<ImportRunsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi.importRuns()
      .then((result) => setData(result as unknown as ImportRunsData))
      .catch((err) => setError(String(err)))
  }, [])

  return (
    <AuthGuard>
      <AdminShell
        title="Import Runs"
        description="Monitor knowledge ingestion progress, review run summaries, and inspect source state for long-running imports."
      >
        {error ? <div className="card">{error}</div> : null}
        {data ? (
          <div className="stack">
            <div className="split">
              <div className="card">
                <h3>Status</h3>
                <div className={`pill ${data.available ? 'good' : 'bad'}`}>
                  {data.available ? 'Available' : 'Unavailable'}
                </div>
                <p className="muted" style={{ marginTop: 12 }}>
                  {data.available
                    ? `Source: ${data.source ?? 'local'}`
                    : 'Import run state is not available in this environment.'}
                </p>
              </div>
              <div className="card">
                <h3>Paths</h3>
                <div className="pre">{JSON.stringify(data.paths ?? {}, null, 2)}</div>
              </div>
            </div>
            <div className="card">
              <h3>Summary</h3>
              <div className="pre">
                {data.summary ?? 'No import summary has been generated yet.'}
              </div>
            </div>
            <div className="card">
              <h3>Raw state</h3>
              <div className="pre">{JSON.stringify(data.state ?? {}, null, 2)}</div>
            </div>
          </div>
        ) : (
          <div className="card">Loading import runs…</div>
        )}
      </AdminShell>
    </AuthGuard>
  )
}
