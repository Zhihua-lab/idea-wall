/**
 * Edge proxy: browser → same-origin /api/supabase-proxy → Supabase REST/Auth.
 * Avoids direct *.supabase.co from the client (helps split-tunnel VPN / unstable paths).
 */
export const config = { runtime: 'edge' }

function isAllowedSupabasePath(pathname: string): boolean {
  return pathname.startsWith('/rest/v1/') || pathname.startsWith('/auth/v1/')
}

export default async function handler(req: Request): Promise<Response> {
  const base = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!base || !anon) {
    return new Response(JSON.stringify({ error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

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

  const hop = new Set(['connection', 'content-length', 'host', 'keep-alive', 'transfer-encoding'])
  const out = new Headers()
  req.headers.forEach((value, key) => {
    if (hop.has(key.toLowerCase())) return
    out.set(key, value)
  })
  if (!out.has('apikey')) {
    out.set('apikey', anon)
  }

  const method = req.method.toUpperCase()
  const hasBody = method !== 'GET' && method !== 'HEAD' && req.body !== null

  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers: out,
    redirect: 'manual',
  }
  if (hasBody) {
    init.body = req.body
    init.duplex = 'half'
  }

  return fetch(target, init)
}
