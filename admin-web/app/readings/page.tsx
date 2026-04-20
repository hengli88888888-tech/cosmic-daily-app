'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { AdminShell } from '@/components/admin-shell'
import { AuthGuard } from '@/components/auth-guard'
import { adminApi } from '@/lib/admin-api'

type ThreadRow = {
  id: string
  user_id: string
  email: string | null
  question_text: string
  divination_system: string
  divination_profile: string | null
  status: string
  created_at: string
}

export default function ReadingsPage() {
  const [rows, setRows] = useState<ThreadRow[]>([])
  const [q, setQ] = useState('')
  const [system, setSystem] = useState('')

  const load = async (nextQ = q, nextSystem = system) => {
    const result = await adminApi.readingsList({
      q: nextQ || undefined,
      divination_system: nextSystem || undefined,
      limit: 50,
    })
    setRows((result.threads as ThreadRow[]) ?? [])
  }

  useEffect(() => {
    void load('', '')
  }, [])

  return (
    <AuthGuard>
      <AdminShell
        title="Readings Review"
        description="Inspect question threads, system answers, and divination source."
      >
        <div className="toolbar">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by question or user id"
          />
          <select value={system} onChange={(e) => setSystem(e.target.value)}>
            <option value="">All systems</option>
            <option value="bazi">BaZi</option>
            <option value="qimen_yang">QiMen</option>
          </select>
          <button className="button" onClick={() => void load()}>
            Search
          </button>
        </div>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>User</th>
                <th>System</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.question_text}</td>
                  <td>
                    <div>{row.email ?? 'Anonymous'}</div>
                    <div className="muted">{row.user_id}</div>
                  </td>
                  <td>{row.divination_system}</td>
                  <td>{row.status}</td>
                  <td>
                    <Link className="button ghost" href={`/readings/${row.id}`}>
                      Open
                    </Link>
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
