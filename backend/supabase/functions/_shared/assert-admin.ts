import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { ensurePublicUserRow } from './ensure-public-user.ts'
import { corsHeaders } from './admin/http.ts'

export async function requireAdminContext(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('ORAYA_SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('ORAYA_SUPABASE_ANON_KEY')!
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('ORAYA_SUPABASE_SERVICE_ROLE_KEY')!
  const localDevAdmin = Deno.env.get('ORAYA_LOCAL_DEV_ADMIN') === 'true'
  const reqUrl = new URL(req.url)
  const isLocal =
    localDevAdmin ||
    reqUrl.hostname === '127.0.0.1' ||
    reqUrl.hostname === 'localhost' ||
    supabaseUrl.includes('127.0.0.1') ||
    supabaseUrl.includes('localhost')

  const authHeader = req.headers.get('Authorization')
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  if (!authHeader) {
    if (isLocal) {
      return {
        user: { id: 'local-dev-admin' },
        adminClient,
        role: 'super_admin',
      }
    }
    return {
      error: new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
        status: 401,
      }),
    }
  }

  const localDevBypassHeader = req.headers.get('x-oraya-local-dev-admin')
  if (isLocal && localDevBypassHeader === 'true') {
    return {
      user: { id: 'local-dev-admin' },
      adminClient,
      role: 'super_admin',
    }
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser()

  if (authErr || !user) {
    if (isLocal) {
      return {
        user: { id: 'local-dev-admin' },
        adminClient,
        role: 'super_admin',
      }
    }
    return {
      error: new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
        status: 401,
      }),
    }
  }

  let { data: adminRow, error: adminErr } = await adminClient
    .from('admin_users')
    .select('user_id,role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminErr) throw adminErr
  if (!adminRow && isLocal) {
    await ensurePublicUserRow(adminClient, {
      id: user.id,
      email: user.email ?? null,
    })

    const { error: upsertErr } = await adminClient.from('admin_users').upsert(
      {
        user_id: user.id,
        role: 'super_admin',
      },
      { onConflict: 'user_id' },
    )
    if (upsertErr) throw upsertErr

    const retry = await adminClient
      .from('admin_users')
      .select('user_id,role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (retry.error) throw retry.error
    adminRow = retry.data
  }

  if (!adminRow) {
    return {
      error: new Response(JSON.stringify({ error: 'Admin permission required' }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
        status: 403,
      }),
    }
  }

  return {
    user,
    adminClient,
    role: String(adminRow.role ?? 'admin'),
  }
}
