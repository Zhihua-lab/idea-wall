import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

type AuthContextValue = {
  session: Session | null
  user: User | null
  nickname: string | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [nickname, setNickname] = useState<string | null>(null)

  const loadNickname = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setNickname(null)
      return
    }
    const { data } = await supabase.from('user_profiles').select('nickname').eq('user_id', userId).maybeSingle()
    setNickname(data?.nickname ?? null)
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return
      setSession(s)
      setLoading(false)
      void loadNickname(s?.user.id)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      void loadNickname(s?.user.id)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadNickname])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setNickname(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      nickname,
      loading,
      signOut,
      refreshProfile: () => loadNickname(session?.user.id),
    }),
    [session, nickname, loading, signOut, loadNickname],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
