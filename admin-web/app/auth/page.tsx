'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { getSupabaseBrowser, isUsingLocalSupabase } from '@/lib/supabase-browser'
import { adminApi } from '@/lib/admin-api'

export default function AuthPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [devLoading, setDevLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLocal, setIsLocal] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLocal(
        (window.location.hostname === '127.0.0.1' ||
        window.location.hostname === 'localhost') &&
        isUsingLocalSupabase(),
      )
    }
    getSupabaseBrowser().auth.getSession().then(async ({ data }) => {
      if (!data.session) return
      try {
        await adminApi.dashboard()
        router.replace('/dashboard')
      } catch (_) {
        await getSupabaseBrowser().auth.signOut()
      }
    })
  }, [router])

  return (
    <main className="content" style={{ maxWidth: 520, margin: '80px auto' }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Sign in to Oraya Admin</h2>
        <p className="muted">
          Use your Google account. Access is only granted if your user exists in
          <code> admin_users </code>.
        </p>
        <div style={{ marginTop: 20 }}>
          <button
            className="button"
            disabled={loading || devLoading}
            onClick={async () => {
              setLoading(true)
              setError(null)
              try {
                await getSupabaseBrowser().auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${window.location.origin}/dashboard`,
                  },
                })
              } catch (err) {
                setError(String(err))
                setLoading(false)
              }
            }}
          >
            {loading ? 'Redirecting...' : 'Continue with Google'}
          </button>
        </div>
        {isLocal ? (
          <div style={{ marginTop: 12 }}>
            <button
              className="button secondary"
              disabled={loading || devLoading}
              onClick={async () => {
                setDevLoading(true)
                setError(null)
                try {
                  const supabase = getSupabaseBrowser()
                  await supabase.auth.signOut()
                  const { error: signInError } = await supabase.auth.signInAnonymously()
                  if (signInError) throw signInError
                  router.replace('/dashboard')
                } catch (err) {
                  setError(String(err))
                  setDevLoading(false)
                }
              }}
            >
              {devLoading ? 'Preparing local admin…' : 'Use local dev admin'}
            </button>
          </div>
        ) : null}
        {error ? <p style={{ color: 'var(--bad)' }}>{error}</p> : null}
      </div>
    </main>
  )
}
