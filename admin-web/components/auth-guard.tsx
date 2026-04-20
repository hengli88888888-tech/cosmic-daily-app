'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { getSupabaseBrowser, isUsingLocalSupabase } from '@/lib/supabase-browser'
import { adminApi } from '@/lib/admin-api'

export function AuthGuard({
  children,
}: {
  children: ReactNode
}) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const run = async () => {
      const supabase = getSupabaseBrowser()
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === '127.0.0.1' ||
          window.location.hostname === 'localhost')
      const canUseLocalDevAdmin = isLocal && isUsingLocalSupabase()

      try {
        let { data } = await supabase.auth.getSession()
        if (!data.session && canUseLocalDevAdmin) {
          const { error: anonError } = await supabase.auth.signInAnonymously()
          if (anonError) throw anonError
          data = (await supabase.auth.getSession()).data
        }

        if (!data.session) {
          router.replace('/auth')
          return
        }

        await adminApi.dashboard()
        if (!active) return
        setReady(true)
      } catch (err) {
        if (!active) return
        setError(String(err))
      }
    }

    run()
    return () => {
      active = false
    }
  }, [router])

  if (error) {
    return (
      <div className="content">
        <div className="card">
          <h3>Admin access required</h3>
          <p className="muted">{error}</p>
          <button
            className="button secondary"
            style={{ marginTop: 12 }}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="content">
        <div className="card">
          <h3>Checking admin session...</h3>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
