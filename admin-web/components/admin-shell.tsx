'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode } from 'react'

import { getSupabaseBrowser } from '@/lib/supabase-browser'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/users', label: 'Users' },
  { href: '/readings', label: 'Readings' },
  { href: '/charts', label: 'Charts & Insights' },
  { href: '/qimen', label: 'QiMen Audit' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/import-runs', label: 'Import Runs' },
]

export function AdminShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <h1>Oraya</h1>
        <p>Private guidance admin console.</p>
        <nav className="nav-list">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${pathname.startsWith(item.href) ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 24 }}>
          <button
            className="button secondary"
            style={{ width: '100%' }}
            onClick={async () => {
              await getSupabaseBrowser().auth.signOut()
              router.push('/auth')
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="page-header">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}
