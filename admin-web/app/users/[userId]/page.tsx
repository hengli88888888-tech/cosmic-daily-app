'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AdminShell } from '@/components/admin-shell'
import { AuthGuard } from '@/components/auth-guard'
import { adminApi } from '@/lib/admin-api'

export default function UserDetailPage() {
  const params = useParams<{ userId: string }>()
  const userId = params.userId
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [granting, setGranting] = useState(false)

  useEffect(() => {
    adminApi.userDetail(userId)
      .then((result) => setData(result))
      .catch((err) => setError(String(err)))
  }, [userId])

  return (
    <AuthGuard>
      <AdminShell
        title="User Detail"
        description="Inspect profile, chart, subscription, coins, messages, incidents, and recent reading activity."
      >
        {error ? <div className="card">{error}</div> : null}
        {data ? (
          <div className="stack">
            <div className="split">
              <div className="card">
                <h3>User</h3>
                <div className="kv-list">
                  <div className="kv-row">
                    <span className="muted">User ID</span>
                    <span>{String(data.user?.id ?? userId)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Created</span>
                    <span>{String(data.user?.created_at ?? '—')}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Admin role</span>
                    <span>{String(data.user?.role ?? 'user')}</span>
                  </div>
                </div>
              </div>
              <div className="card">
                <h3>Wallet</h3>
                <div className="kv-list">
                  <div className="kv-row">
                    <span className="muted">Balance</span>
                    <span>{String(data.wallet?.balance ?? 0)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Spent total</span>
                    <span>{String(data.wallet?.spent_total ?? 0)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Purchased total</span>
                    <span>{String(data.wallet?.purchased_total ?? 0)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Granted total</span>
                    <span>{String(data.wallet?.granted_total ?? 0)}</span>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button
                    className="button"
                    disabled={granting}
                    onClick={async () => {
                      setGranting(true)
                      try {
                        await adminApi.adjustCoins({
                          user_id: userId,
                          amount: 5,
                          reason: 'admin bonus',
                          note: 'Manual support adjustment',
                        })
                        const refreshed = await adminApi.userDetail(userId)
                        setData(refreshed)
                      } finally {
                        setGranting(false)
                      }
                    }}
                  >
                    {granting ? 'Granting…' : 'Grant 5 coins'}
                  </button>
                </div>
              </div>
            </div>
            <div className="split">
              <div className="card">
                <h3>Profile</h3>
                <div className="kv-list">
                  <div className="kv-row">
                    <span className="muted">Display name</span>
                    <span>{String(data.profile?.display_name ?? '—')}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Timezone</span>
                    <span>{String(data.profile?.timezone ?? '—')}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Birthplace</span>
                    <span>{String(data.profile?.birthplace ?? '—')}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Intent</span>
                    <span>{String(data.profile?.intent ?? '—')}</span>
                  </div>
                </div>
              </div>
              <div className="card">
                <h3>Chart</h3>
                <div className="kv-list">
                  <div className="kv-row">
                    <span className="muted">Source</span>
                    <span>{String(data.chart?.source ?? data.chart?.analysis?.source ?? '—')}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Chart text</span>
                    <span>{String(data.chart?.chart_text ?? '—')}</span>
                  </div>
                  <div className="kv-row">
                    <span className="muted">Chart state</span>
                    <span>
                      {data.chart?.analysis?.notes?.includes?.('fallback_chart_generated')
                        ? 'Fallback'
                        : 'Verified / structured'}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Link className="button secondary" href={`/charts?user=${userId}`}>
                    Open chart audit
                  </Link>
                </div>
              </div>
            </div>
            <div className="card">
              <h3>Subscriptions</h3>
              <div className="pre">{JSON.stringify(data.subscriptions ?? [], null, 2)}</div>
            </div>
            <div className="split">
              <div className="card">
                <h3>Member messages</h3>
                <div className="stack">
                  {((data.memberMessages as Record<string, any>[] | undefined) ?? []).length ? (
                    ((data.memberMessages as Record<string, any>[] | undefined) ?? []).map((message) => (
                      <div key={String(message.id)} className="card inset-card">
                        <div className="muted">{String(message.message_date ?? '—')}</div>
                        <div style={{ marginTop: 8, fontWeight: 700 }}>
                          {String(message.title ?? 'Untitled message')}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          {String(message.preview_text ?? message.body_text ?? '—')}
                        </div>
                        <div style={{ marginTop: 8 }} className="pill">
                          {message.bookmarked ? 'Bookmarked' : 'Expires in 3 days unless saved'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="muted">No member messages.</div>
                  )}
                </div>
              </div>
              <div className="card">
                <h3>Share rewards</h3>
                <div className="stack">
                  {((data.shareEvents as Record<string, any>[] | undefined) ?? []).length ? (
                    ((data.shareEvents as Record<string, any>[] | undefined) ?? []).map((event) => (
                      <div key={String(event.id)} className="card inset-card">
                        <div className="muted">{String(event.created_at ?? '—')}</div>
                        <div style={{ marginTop: 8 }}>
                          Channel: {String(event.channel ?? 'system share')}
                        </div>
                        <div style={{ marginTop: 8 }} className="pill">
                          {event.reward_granted ? `Rewarded ${String(event.reward_amount ?? 0)} coins` : 'No reward'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="muted">No share rewards.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="split">
              <div className="card">
                <h3>Recent Questions</h3>
                <div className="stack">
                  {((data.recentQuestions as Record<string, any>[] | undefined) ?? []).length ? (
                    ((data.recentQuestions as Record<string, any>[] | undefined) ?? []).map((question) => (
                      <div key={String(question.id)} className="card inset-card">
                        <div className="muted">{String(question.created_at ?? '—')}</div>
                        <div style={{ marginTop: 8 }}>{String(question.question_text ?? '—')}</div>
                        <div style={{ marginTop: 12 }}>
                          <Link
                            className="button secondary"
                            href={`/readings/${String(question.parent_question_id ?? question.id)}`}
                          >
                            Open thread
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="muted">No recent questions.</div>
                  )}
                </div>
              </div>
              <div className="card">
                <h3>Incidents</h3>
                <div className="stack">
                  {((data.incidents as Record<string, any>[] | undefined) ?? []).length ? (
                    ((data.incidents as Record<string, any>[] | undefined) ?? []).map((incident) => (
                      <div key={String(incident.id)} className="card inset-card">
                        <div className="muted">{String(incident.incident_type ?? 'incident')}</div>
                        <div style={{ marginTop: 8 }}>{String(incident.message ?? '—')}</div>
                        <div style={{ marginTop: 8 }} className="pill">
                          {String(incident.status ?? 'open')}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="muted">No incidents.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="card">
              <h3>Coin ledger</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Created</th>
                      <th>Amount</th>
                      <th>Reason</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(((data.coinLedger as Record<string, any>[] | undefined) ?? []).length
                      ? ((data.coinLedger as Record<string, any>[] | undefined) ?? [])
                      : []
                    ).map((entry) => (
                      <tr key={String(entry.id)}>
                        <td>{String(entry.created_at ?? '—')}</td>
                        <td>{String(entry.amount ?? 0)}</td>
                        <td>{String(entry.reason ?? entry.note ?? '—')}</td>
                        <td>{String(entry.entry_type ?? '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <h3>Raw user payload</h3>
              <div className="pre">{JSON.stringify(data, null, 2)}</div>
            </div>
          </div>
        ) : (
          <div className="card">Loading user…</div>
        )}
      </AdminShell>
    </AuthGuard>
  )
}
