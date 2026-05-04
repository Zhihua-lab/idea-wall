/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to `0` to disable same-origin Supabase proxy (e.g. local `vite preview` without Vercel API). */
  readonly VITE_USE_SUPABASE_EDGE_PROXY?: string
}
