/**
 * Edge proxy: browser → same-origin /api/supabase-proxy → Supabase REST/Auth/Storage.
 * Avoids direct *.supabase.co from the client (helps split-tunnel VPN / unstable paths).
 *
 * Uses SUPABASE_* env vars first: Vercel Edge may not expose VITE_* at runtime the same
 * way as the static build; duplicate the same URL/key in dashboard as SUPABASE_URL + SUPABASE_ANON_KEY.
 */
export const config = { runtime: 'edge' }

function isAllowedSupabasePath(pathname: string): boolean {
  return (
    pathname.startsWith('/rest/v1/') ||
    pathname.startsWith('/auth/v1/') ||
    pathname.startsWith('/storage/v1/')
  )
}

function supabaseCredentials(): { base: string; anon: string } | null {
  const base = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!base || !anon) return null
  return { base, anon }
}

/** Headers Supabase PostgREST / GoTrue expect; avoid forwarding browser-only hop headers. */
function buildUpstreamHeaders(req: Request, anon: string): Headers {
  const out = new Headers()
  const copy = [
    'authorization',
    'apikey',
    'accept',
    'content-type',
    'prefer',
    'x-client-info',
    'accept-profile',
    'content-profile',
    'range',
  ] as const
  for (const name of copy) {
    const v = req.headers.get(name)
    if (v) out.set(name, v)
  }
  if (!out.has('apikey')) out.set('apikey', anon)
  if (!out.has('accept')) out.set('accept', 'application/json')
  return out
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const cred = supabaseCredentials()
    if (!cred) {
      return new Response(
        JSON.stringify({
          error:
            'Missing Supabase env on server. Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel (same values as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).',
        }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      )
    }
    const { base, anon } = cred

    const url = new URL(req.url)
    const pEnc = url.searchParams.get('p')
    if (!pEnc) {
      return new Response(JSON.stringify({ error: 'Missing query p' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    let decoded: string
    try {
      decoded = decodeURIComponent(pEnc)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid p' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (decoded.includes('..') || !decoded.startsWith('/')) {
      return new Response(JSON.stringify({ error: 'Forbidden path' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }

    const q = decoded.indexOf('?')
    const pathname = q >= 0 ? decoded.slice(0, q) : decoded
    if (!isAllowedSupabasePath(pathname)) {
      return new Response(JSON.stringify({ error: 'Forbidden path' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }

    const target = `${base}${decoded}`
    const out = buildUpstreamHeaders(req, anon)
    // 图片等二进制：浏览器 <img> 常不带 Accept；默认 application/json 会导致 Storage 返回异常
    if (pathname.startsWith('/storage/v1/') && !req.headers.get('accept')) {
      out.set('accept', '*/*')
    }

    const method = req.method.toUpperCase()
    const hasBody = method !== 'GET' && method !== 'HEAD' && req.body !== null

    const init: RequestInit & { duplex?: 'half' } = {
      method: req.method,
      headers: out,
    }
    if (hasBody) {
      init.body = req.body
      init.duplex = 'half'
    }

    return await fetch(target, init)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: 'supabase-proxy', detail: msg }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
}
