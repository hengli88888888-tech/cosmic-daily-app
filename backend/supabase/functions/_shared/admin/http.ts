export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-oraya-local-dev-admin',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

export function withCors(response: Response) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
    status,
  })
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method === 'GET' || req.method === 'HEAD') return {}
  try {
    const body = await req.json()
    if (body && typeof body === 'object') {
      return body as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

export function stringParam(
  url: URL,
  body: Record<string, unknown>,
  key: string,
): string | null {
  const bodyValue = body[key]
  if (typeof bodyValue === 'string' && bodyValue.trim()) return bodyValue.trim()
  const queryValue = url.searchParams.get(key)
  return queryValue?.trim() || null
}

export function intParam(
  url: URL,
  body: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const raw = body[key] ?? url.searchParams.get(key) ?? fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.trunc(parsed)
}

export function cleanString(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text ? text : null
}
