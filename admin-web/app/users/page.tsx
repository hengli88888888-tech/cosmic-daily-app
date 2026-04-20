'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { AdminShell } from '@/components/admin-shell'
import { AuthGuard } from '@/components/auth-guard'
import { adminApi } from '@/lib/admin-api'

type UserRow = {
  user_id: string
  email: string | null
  created_at: string
  profile_updated_at?: string | null
  chart_updated_at?: string | null
  latest_activity_at?: string | null
  birthplace: string | null
  timezone: string | null
  balance: number
  subscription: { plan_code: string } | null
  chart_state: string
  chart_source: string | null
  open_incident_count: number
  is_admin_account?: boolean
  is_dev_session?: boolean
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'just_signed_in', label: 'Just signed in' },
  { id: 'needs_profile', label: 'Needs profile' },
  { id: 'verified', label: 'Verified' },
  { id: 'needs_rebuild', label: 'Needs rebuild' },
]

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function deriveStatus(row: UserRow) {
  if (row.chart_state === 'verified_ready') {
    return { label: 'Verified reading ready', tone: 'good' }
  }
  if (row.chart_state === 'needs_profile_rebuild') {
    return { label: 'Needs rebuild', tone: 'bad' }
  }
  if (row.birthplace || row.timezone) {
    return { label: 'Profile created', tone: '' }
  }
  return { label: 'Logged in only', tone: '' }
}

export default function UsersPage() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [showDevSessions, setShowDevSessions] = useState(false)

  const load = async (query = '') => {
    setLoading(true)
    setError(null)
    try {
      const result = await adminApi.usersSearch({ q: query, limit: 50 })
      setRows((result.users as UserRow[]) ?? [])
    } catch (err) {
      setError(String(err))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const visibleRows = rows.filter((row) => {
    if (!showDevSessions && row.is_dev_session) return false
    if (filter === 'all') return true
    if (filter === 'just_signed_in') return !row.birthplace && !row.timezone && row.chart_state === 'preparing_profile'
    if (filter === 'needs_profile') return row.chart_state === 'preparing_profile'
    if (filter === 'verified') return row.chart_state === 'verified_ready'
    if (filter === 'needs_rebuild') return row.chart_state === 'needs_profile_rebuild'
    return true
  })

  return (
    <AuthGuard>
      <AdminShell
        title="Users"
        description="Search by user id, email, subscription, chart state, and incident load."
      >
        <div className="toolbar">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search user id or email"
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button className="button" onClick={() => void load(q)}>
            Search
          </button>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={showDevSessions}
              onChange={(e) => setShowDevSessions(e.target.checked)}
            />
            <span>Show dev/admin sessions</span>
          </label>
        </div>
        <div className="card table-wrap">
          {error ? <div style={{ marginBottom: 12, color: 'var(--bad)' }}>{error}</div> : null}
          {loading ? (
            <div>Loading users…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Recent activity</th>
                  <th>Status</th>
                  <th>Chart</th>
                  <th>Plan</th>
                  <th>Coins</th>
                  <th>Incidents</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const status = deriveStatus(row)
                  const activityLabel = row.chart_updated_at
                    ? 'Chart updated'
                    : row.profile_updated_at
                      ? 'Profile updated'
                      : 'Account created'
                  return (
                  <tr key={row.user_id}>
                    <td>
                      <div>{row.email ?? 'Anonymous'}</div>
                      <div className="muted">{row.user_id}</div>
                      {row.is_dev_session ? (
                        <div style={{ marginTop: 8 }}>
                          <span className="pill">Dev session</span>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div>{formatDate(row.latest_activity_at ?? row.created_at)}</div>
                      <div className="muted">{activityLabel}</div>
                    </td>
                    <td>
                      <span className={`pill ${status.tone}`}>{status.label}</span>
                    </td>
                    <td>
                      <div>{row.chart_state}</div>
                      <div className="muted">{row.chart_source ?? '—'}</div>
                    </td>
                    <td>{row.subscription?.plan_code ?? '—'}</td>
                    <td>{row.balance}</td>
                    <td>{row.open_incident_count}</td>
                    <td>
                      <Link className="button ghost" href={`/users/${row.user_id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </AdminShell>
    </AuthGuard>
  )
}
