import type { VercelRequest, VercelResponse } from '@vercel/node'

const PROXY_ANON_PLACEHOLDER = 'proxy-anon-key'

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
function buildUpstreamHeaders(req: VercelRequest, anon: string): Headers {
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
    'x-upsert',
    'x-metadata',
    'cache-control',
    'content-range',
  ] as const
  for (const name of copy) {
    const v = req.headers[name]
    if (v) out.set(name, Array.isArray(v) ? v.join(', ') : v)
  }
  const authorization = out.get('authorization')
  out.set('apikey', anon)
  if (!authorization || authorization === `Bearer ${PROXY_ANON_PLACEHOLDER}`) {
    out.set('authorization', `Bearer ${anon}`)
  }
  if (!out.has('accept')) out.set('accept', 'application/json')
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const cred = supabaseCredentials()
    if (!cred) {
      res.status(500).json({
        error:
          'Missing Supabase env on server. Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel (same values as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).',
      })
      return
    }
    const { base, anon } = cred

    const url = new URL(req.url!, `http://${req.headers.host}`)
    const pEnc = url.searchParams.get('p')
    if (!pEnc) {
      res.status(400).json({ error: 'Missing query p' })
      return
    }

    const decoded = pEnc

    if (decoded.includes('..') || !decoded.startsWith('/')) {
      res.status(403).json({ error: 'Forbidden path' })
      return
    }

    const q = decoded.indexOf('?')
    const pathname = q >= 0 ? decoded.slice(0, q) : decoded
    if (!isAllowedSupabasePath(pathname)) {
      res.status(403).json({ error: 'Forbidden path' })
      return
    }

    const target = `${base}${decoded}`
    const out = buildUpstreamHeaders(req, anon)
    // 图片等二进制：浏览器 <img> 常不带 Accept；默认 application/json 会导致 Storage 返回异常
    if (pathname.startsWith('/storage/v1/') && !req.headers.accept) {
      out.set('accept', '*/*')
    }

    const method = req.method?.toUpperCase() || 'GET'
    const hasBody = method !== 'GET' && method !== 'HEAD'

    const init: RequestInit & { duplex?: string } = {
      method: req.method,
      headers: out,
    }
    if (hasBody) {
      // Vercel 的 body parser 已经消费了 req stream，不能再次透传。
      // 用解析好的 req.body 重新构造：对象转 JSON 字符串，字符串/Buffer 直接复用。
      const parsed = req.body
      if (typeof parsed === 'string') {
        init.body = parsed
      } else if (Buffer.isBuffer(parsed)) {
        init.body = parsed
      } else if (parsed && typeof parsed === 'object') {
        init.body = JSON.stringify(parsed)
        if (!out.has('content-type')) {
          out.set('content-type', 'application/json')
        }
      }
    }

    const upstream = await fetch(target, init)
    // Node fetch (undici) 默认自动解压 gzip/deflate body，但可能保留 Content-Encoding header。
    // 若直接返回给浏览器，会导致 body 已解压而 header 仍声明 gzip → ERR_CONTENT_DECODING_FAILED。
    const headers = new Headers(upstream.headers)
    headers.delete('content-encoding')
    headers.delete('transfer-encoding')

    res.status(upstream.status)
    for (const [key, value] of headers) {
      res.setHeader(key, value)
    }
    // 上游 body 可能是 JSON 文本也可能是二进制图片，统一用 arrayBuffer() 读取再转 Buffer，
    // 避免 text() 对二进制数据做 UTF-8 解码导致图片损坏。
    const body = Buffer.from(await upstream.arrayBuffer())
    res.send(body)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: 'supabase-proxy', detail: msg })
  }
}
