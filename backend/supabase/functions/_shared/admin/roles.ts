import { corsHeaders } from './http.ts'

export function requireRole(
  role: string,
  allowed: string[],
) {
  if (allowed.includes(role)) return null
  return new Response(JSON.stringify({ error: 'Insufficient admin role' }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
    status: 403,
  })
}
