'use client'

import { useEffect, useState } from 'react'

import { AdminShell } from '@/components/admin-shell'
import { AuthGuard } from '@/components/auth-guard'
import { adminApi } from '@/lib/admin-api'

type DashboardData = {
  currentAdmin: { user_id: string; role: string }
  metrics: Record<string, number>
  coins: Record<string, number>
}

const METRIC_LABELS: Record<string, string> = {
  usersToday: 'New users today',
  totalUsers: 'Total users',
  activeSubscriptions: 'Active subscriptions',
  openIncidents: 'Open incidents',
  fallbackProfiles: 'Fallback profiles',
  totalCharts: 'Total charts',
  verifiedCharts: 'Verified charts',
  firstImpressionSuccessRate: 'First impression success %',
  questionsToday: 'Questions today',
  memberMessagesToday: 'Member messages today',
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [importRuns, setImportRuns] = useState<Record<string, any> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([adminApi.dashboard(), adminApi.importRuns()])
      .then(([dashboard, imports]) => {
        setData(dashboard as unknown as DashboardData)
        setImportRuns(imports)
      })
      .catch((err) => setError(String(err)))
  }, [])

  return (
    <AuthGuard>
      <AdminShell
        title="Dashboard"
        description="Monitor users, chart health, subscriptions, coins, and ingestion status."
      >
        {error ? <div className="card">{error}</div> : null}
        {data ? (
          <div className="stack">
            <div className="grid metrics">
              {Object.entries(data.metrics).map(([key, value]) => (
                <div key={key} className="card">
                  <div className="muted">{METRIC_LABELS[key] ?? key}</div>
                  <div className="metric-value">{value}</div>
                </div>
              ))}
            </div>
            <div className="split">
              <div className="card">
                <h3>Admin session</h3>
                <p className="muted">Current operator</p>
                <div className="pre">
                  {JSON.stringify(data.currentAdmin, null, 2)}
                </div>
              </div>
              <div className="card">
                <h3>Coins overview</h3>
                <div className="pre">{JSON.stringify(data.coins, null, 2)}</div>
              </div>
            </div>
            <div className="card">
              <h3>Import run summary</h3>
              <div className="pre">
                {importRuns?.available
                  ? (importRuns.summary as string)
                  : 'Import run summary is not available in this environment.'}
              </div>
            </div>
          </div>
        ) : (
          <div className="card">Loading dashboard…</div>
        )}
      </AdminShell>
    </AuthGuard>
  )
}
