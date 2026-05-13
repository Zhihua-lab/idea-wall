import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const PROXY_ANON_PLACEHOLDER = 'proxy-anon-key'

if (!url || !anon) {
  // eslint-disable-next-line no-console -- dev hint only
  console.warn('[idea-wall] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const browserOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const supabaseUrl = url ?? browserOrigin
const supabaseAnon = anon ?? PROXY_ANON_PLACEHOLDER
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : ''

function isSupabaseApiPath(pathname: string): boolean {
  return pathname.startsWith('/rest/v1/') || pathname.startsWith('/auth/v1/') || pathname.startsWith('/storage/v1/')
}

function isRequestToSupabaseProject(href: string, projectOrigin: string): boolean {
  if (!projectOrigin) return false
  try {
    const u = new URL(href)
    const isConfiguredOrigin = u.origin === projectOrigin
    const isSupabaseOrigin = u.hostname.endsWith('.supabase.co')
    return (isConfiguredOrigin || (import.meta.env.PROD && isSupabaseOrigin)) && (!url || isSupabaseApiPath(u.pathname))
  } catch {
    return false
  }
}

/**
 * 生产构建：发往本项目 Supabase origin 的请求走同源 `/api/supabase-proxy`（Vercel Node，非 Edge）。
 * `npm run dev` 直连 Supabase（本地无 /api 路由）。`VITE_USE_SUPABASE_EDGE_PROXY=0` 关闭改写。
 * Storage 经代理时单张大小见 inspirationStorage MAX_BYTES（需低于平台对请求体的限制）。
 */
function createSupabaseProxyFetch(projectOrigin: string): typeof fetch {
  return (input, init) => {
    const href =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url

    const proxyDisabled = import.meta.env.VITE_USE_SUPABASE_EDGE_PROXY === '0'
    const useProxy =
      import.meta.env.PROD &&
      !proxyDisabled &&
      Boolean(projectOrigin) &&
      isRequestToSupabaseProject(href, projectOrigin)

    if (!useProxy) {
      return fetch(input as RequestInfo, init)
    }

    const u = new URL(href)
    const p = encodeURIComponent(u.pathname + u.search)
    return fetch(`/api/supabase-proxy?p=${p}`, init)
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  global: supabaseOrigin ? { fetch: createSupabaseProxyFetch(supabaseOrigin) } : undefined,
})
