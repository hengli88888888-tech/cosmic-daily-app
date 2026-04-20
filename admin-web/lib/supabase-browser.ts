'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function resolveEnv() {
  const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === '127.0.0.1' ||
      window.location.hostname === 'localhost')
  const isDev =
    process.env.NODE_ENV !== 'production'

  return {
    url:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      (isLocal || isDev ? 'http://127.0.0.1:54321' : ''),
    anonKey:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      (isLocal || isDev
        ? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
        : ''),
  }
}

export function isUsingLocalSupabase() {
  const env = resolveEnv()
  return env.url.includes('127.0.0.1') || env.url.includes('localhost')
}

export function getSupabaseBrowser() {
  if (client) return client
  const env = resolveEnv()
  if (!env.url || !env.anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  client = createClient(env.url, env.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}
