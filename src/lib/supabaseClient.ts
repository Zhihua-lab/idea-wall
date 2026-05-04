import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anon) {
  // eslint-disable-next-line no-console -- dev hint only
  console.warn('[idea-wall] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const supabaseOrigin = url ? new URL(url).origin : ''

/** Production: same-origin Edge proxy so traffic does not hit *.supabase.co from the browser. */
function createSupabaseProxyFetch(realOrigin: string): typeof fetch {
  return (input, init) => {
    const href =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url

    const proxyDisabled = import.meta.env.VITE_USE_SUPABASE_EDGE_PROXY === '0'
    const useProxy = import.meta.env.PROD && !proxyDisabled && Boolean(realOrigin) && href.startsWith(realOrigin)

    if (!useProxy) {
      return fetch(input as RequestInfo, init)
    }

    const u = new URL(href)
    const p = encodeURIComponent(u.pathname + u.search)
    return fetch(`/api/supabase-proxy?p=${p}`, init)
  }
}

export const supabase = createClient(url ?? '', anon ?? '', {
  global: supabaseOrigin ? { fetch: createSupabaseProxyFetch(supabaseOrigin) } : undefined,
})
