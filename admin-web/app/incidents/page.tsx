'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { AdminShell } from '@/components/admin-shell'
import { AuthGuard } from '@/components/auth-guard'
import { adminApi } from '@/lib/admin-api'

type Incident = {
  id: string
  incident_type: string
  user_id: string | null
  severity: string
  status: string
  message: string
  created_at: string
}

export default function IncidentsPage() {
  const [rows, setRows] = useState<Incident[]>([])
  const [status, setStatus] = useState('')

  const load = async (nextStatus = status) => {
    const result = await adminApi.incidents({ status: nextStatus || undefined, limit: 50 })
    setRows((result.incidents as Incident[]) ?? [])
  }

  useEffect(() => {
    void load('')
  }, [])

  return (
    <AuthGuard>
      <AdminShell
        title="Incidents"
        description="Review chart failures, fallback users, webhook issues, and other operational incidents."
      >
        <div className="toolbar">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>
          <button className="button" onClick={() => void load()}>
            Filter
          </button>
        </div>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Message</th>
                <th>User</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.incident_type}</td>
                  <td>{row.message}</td>
                  <td>
                    {row.user_id ? <Link href={`/users/${row.user_id}`}>{row.user_id}</Link> : '—'}
                  </td>
                  <td>{row.status}</td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="button ghost"
                      onClick={async () => {
                        await adminApi.updateIncident(row.id, 'resolve')
                        await load()
                      }}
                    >
                      Resolve
                    </button>
                    <button
                      className="button ghost"
                      onClick={async () => {
                        await adminApi.updateIncident(row.id, 'ignore')
                        await load()
                      }}
                    >
                      Ignore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminShell>
    </AuthGuard>
  )
}
