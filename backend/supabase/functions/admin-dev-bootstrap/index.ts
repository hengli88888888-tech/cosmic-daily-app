import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

import { ensurePublicUserRow } from '../_shared/ensure-public-user.ts'
import { corsHeaders, json } from '../_shared/admin/http.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('ORAYA_SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('ORAYA_SUPABASE_ANON_KEY')!
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('ORAYA_SUPABASE_SERVICE_ROLE_KEY')!

    const isLocal =
      supabaseUrl.includes('127.0.0.1') ||
      supabaseUrl.includes('localhost')

    if (!isLocal) {
      return json({ error: 'admin-dev-bootstrap is only available in local development' }, 403)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser()

    if (authErr || !user) {
      return json({ error: 'Invalid or expired token' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    await ensurePublicUserRow(adminClient, {
      id: user.id,
      email: user.email ?? null,
    })

    const { error: adminErr } = await adminClient.from('admin_users').upsert(
      {
        user_id: user.id,
        role: 'super_admin',
      },
      { onConflict: 'user_id' },
    )
    if (adminErr) throw adminErr

    return json({
      ok: true,
      mode: 'local_dev_admin',
      user_id: user.id,
      role: 'super_admin',
    })
  } catch (error) {
    return json({ error: String(error) }, 400)
  }
})
