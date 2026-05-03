import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type Tab = 'login' | 'register'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'

  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (tab === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
      } else {
        const { error: err } = await supabase.auth.signUp({ email: email.trim(), password })
        if (err) throw err
      }
      navigate(redirectTo.startsWith('/') ? redirectTo : '/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="stitch-shell stitch-shell--login bg-background font-body-md text-on-surface paper-grain custom-cursor min-h-screen flex flex-col items-center justify-center p-md">
      <div className="fixed inset-0 stitch-pattern pointer-events-none opacity-30" />

      <header className="mb-xl text-center relative z-10">
        <Link to="/" className="block">
          <h1 className="font-headline-xl text-headline-xl text-primary -rotate-2">灵感随手记</h1>
        </Link>
        <p className="font-headline-md text-headline-md text-secondary opacity-80 mt-xs">Capturing fleeting thoughts...</p>
        <div className="absolute -top-6 -right-12 opacity-20">
          <span className="material-symbols-outlined text-6xl">edit_note</span>
        </div>
      </header>

      <main className="w-full max-w-md relative z-10">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-10 bg-secondary/20 washi-tape rotate-1 z-20" />
        <div className="bg-surface-container-lowest folded-corner shadow-[4px_4px_0px_rgba(0,0,0,0.1)] p-lg border-2 border-outline-variant relative rotate-1">
          <div className="absolute bottom-0 right-0 w-[20px] h-[20px] folded-corner-accent border-l border-t border-outline-variant" />

          <div className="flex gap-md mb-lg">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`font-headline-lg text-headline-lg ${
                tab === 'login'
                  ? 'text-primary underline decoration-wavy decoration-2 underline-offset-4'
                  : 'text-outline-variant hover:text-secondary transition-colors'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`font-headline-lg text-headline-lg ${
                tab === 'register'
                  ? 'text-primary underline decoration-wavy decoration-2 underline-offset-4'
                  : 'text-outline-variant hover:text-secondary transition-colors'
              }`}
            >
              Register
            </button>
          </div>

          {error ? <p className="text-error text-label-sm mb-md">{error}</p> : null}

          <form className="space-y-lg" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-xs">
              <label className="font-label-sm text-label-sm text-secondary px-xs" htmlFor="login-email">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  className="w-full bg-transparent border-0 border-b-2 border-dashed border-outline-variant focus:border-primary focus:ring-0 text-body-lg font-body-lg py-sm px-xs placeholder:opacity-30"
                  placeholder="hello@inspiration.com"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <span className="material-symbols-outlined absolute right-2 top-2 text-outline-variant">alternate_email</span>
              </div>
            </div>
            <div className="space-y-xs">
              <label className="font-label-sm text-label-sm text-secondary px-xs" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  className="w-full bg-transparent border-0 border-b-2 border-dashed border-outline-variant focus:border-primary focus:ring-0 text-body-lg font-body-lg py-sm px-xs placeholder:opacity-30"
                  placeholder="••••••••"
                  type="password"
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <span className="material-symbols-outlined absolute right-2 top-2 text-outline-variant">lock_open</span>
              </div>
            </div>
            <button
              className="w-full bg-primary-container text-on-primary-container font-headline-md text-headline-md py-md sketchy-stroke hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-md mt-md disabled:opacity-60"
              type="submit"
              disabled={submitting}
            >
              {submitting ? '…' : tab === 'login' ? 'Start Journaling' : 'Create account'}
            </button>
          </form>

          <div className="mt-xl text-center space-y-md">
            <button
              type="button"
              onClick={() => setTab((t) => (t === 'login' ? 'register' : 'login'))}
              className="inline-block font-label-sm text-label-sm text-secondary hover:text-primary underline decoration-dotted transition-colors bg-transparent border-0 cursor-pointer"
            >
              {tab === 'login' ? "Don't have an account? Register here!" : 'Already have an account? Login'}
            </button>
            <div className="flex items-center justify-center gap-sm py-xs">
              <span className="material-symbols-outlined text-xs text-outline-variant">star</span>
              <div className="h-px w-16 bg-outline-variant/50" />
              <span className="material-symbols-outlined text-xs text-outline-variant">star</span>
            </div>
            <p className="font-label-sm text-label-sm text-outline italic opacity-70">MVP: No password recovery yet</p>
            <p className="font-label-sm text-label-sm">
              <Link to="/" className="text-primary underline">
                ← Back to inspirations
              </Link>
            </p>
          </div>
        </div>

        <div className="absolute -left-16 bottom-0 -rotate-12 opacity-40 hidden md:block">
          <span className="material-symbols-outlined text-8xl text-secondary">ink_pen</span>
        </div>
        <div className="absolute -right-16 top-1/4 rotate-12 opacity-40 hidden md:block">
          <span className="material-symbols-outlined text-7xl text-primary">cloud</span>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 w-full overflow-hidden pointer-events-none h-32 flex items-end z-0">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 120">
          <path
            d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
            fill="#e0d9d2"
            fillOpacity="0.5"
          />
          <path
            d="M0,32L48,37.3C96,43,192,53,288,58.7C384,64,480,64,576,58.7C672,53,768,43,864,42.7C960,43,1056,53,1152,53.3C1248,53,1344,43,1392,37.3L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
            fill="#eee7e0"
            fillOpacity="0.8"
          />
        </svg>
      </div>

      <footer className="w-full flex flex-col items-center justify-center pt-12 pb-8 px-4 gap-4 z-20 relative">
        <div className="font-serif text-sm italic text-stone-500 opacity-80">✧ 随手记下灵感，像在便签本上画小花 ✧</div>
        <div className="flex gap-lg">
          <span className="material-symbols-outlined text-stone-500 opacity-80 hover:translate-y-[-4px] transition-transform duration-300">
            edit
          </span>
          <span className="material-symbols-outlined text-stone-500 opacity-80 hover:translate-y-[-4px] transition-transform duration-300">
            coffee
          </span>
          <span className="material-symbols-outlined text-stone-500 opacity-80 hover:translate-y-[-4px] transition-transform duration-300">
            light_mode
          </span>
          <span className="material-symbols-outlined text-stone-500 opacity-80 hover:translate-y-[-4px] transition-transform duration-300">
            cloud
          </span>
        </div>
      </footer>
    </div>
  )
}
