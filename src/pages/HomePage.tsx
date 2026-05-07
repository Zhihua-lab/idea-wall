import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { InspirationCard } from '../components/InspirationCard'
import { UserAccountDropdown } from '../components/UserAccountDropdown'
import { useAuth } from '../auth/AuthContext'
import {
  deleteLike,
  fetchInspirationsList,
  fetchMyLikeIds,
  insertLike,
} from '../lib/inspirationsApi'
import { LIST_CARD_VARIANTS } from '../lib/listCardVariants'
import { PRESET_TAGS } from '../lib/presetTags'
import type { InspirationWithAuthor } from '../types/database'

export function HomePage() {
  const { user, nickname, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTag = searchParams.get('tag') ?? ''

  const [rows, setRows] = useState<InspirationWithAuthor[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tag = activeTag || undefined
      const list = await fetchInspirationsList(tag)
      setRows(list)
      if (user && list.length > 0) {
        const ids = list.map((r) => r.id)
        const mine = await fetchMyLikeIds(user.id, ids)
        setLikedIds(mine)
      } else {
        setLikedIds(new Set())
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [activeTag, user, nickname])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mobileNavOpen])

  const closeMobileNav = () => setMobileNavOpen(false)

  const loginHref = `/login?redirect=${encodeURIComponent(`/?${searchParams.toString()}`)}`

  const setTagFilter = (tag: string) => {
    if (!tag) {
      setSearchParams({})
    } else {
      setSearchParams({ tag })
    }
  }

  const onToggleLike = async (e: React.MouseEvent, inspirationId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/?${searchParams.toString()}`)}`)
      return
    }
    const liked = likedIds.has(inspirationId)
    try {
      if (liked) {
        await deleteLike(user.id, inspirationId)
        setLikedIds((prev) => {
          const n = new Set(prev)
          n.delete(inspirationId)
          return n
        })
        setRows((prev) =>
          prev.map((r) =>
            r.id === inspirationId
              ? { ...r, likes_count: Math.max(0, r.likes_count - 1) }
              : r,
          ),
        )
      } else {
        await insertLike(user.id, inspirationId)
        setLikedIds((prev) => new Set(prev).add(inspirationId))
        setRows((prev) =>
          prev.map((r) =>
            r.id === inspirationId ? { ...r, likes_count: r.likes_count + 1 } : r,
          ),
        )
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '点赞失败')
    }
  }

  const filterChips = useMemo(
    () => [{ key: '', label: '全部' }, ...PRESET_TAGS.map((t) => ({ key: t, label: t }))],
    [],
  )

  return (
    <div className="stitch-shell stitch-shell--home bg-surface font-body-md text-on-surface min-h-screen flex flex-col selection:bg-primary-container selection:text-on-primary-container">
      <div className="grain-texture" />
      <header
        className={`bg-orange-50 dark:bg-stone-900 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] sticky top-0 border-b-2 border-dashed border-stone-300 dark:border-stone-700 flex justify-between items-center w-full px-6 py-4 ${
          mobileNavOpen ? 'z-[60]' : 'z-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="text-2xl font-bold text-lime-900 dark:text-lime-100 italic font-serif tracking-tight"
          >
            灵感随手记
          </Link>
        </div>
        <div className="hidden flex-1 items-center justify-end gap-6 md:flex">
          <nav className="flex gap-4">
            <Link
              to="/"
              className="font-serif italic tracking-tight text-lime-700 underline decoration-wavy transition-all hover:rotate-1 hover:scale-105 dark:text-lime-300"
            >
              Latest
            </Link>
            <span className="font-serif italic tracking-tight text-stone-600 dark:text-stone-400">My Journal</span>
            <span className="font-serif italic tracking-tight text-stone-600 dark:text-stone-400">Collections</span>
          </nav>
          <div className="flex items-center gap-4 border-l border-stone-300 pl-6 dark:border-stone-600">
            {!authLoading && user ? (
              <>
                <Link
                  to="/new"
                  className="inline-block bg-primary px-4 py-2 text-center text-label-sm font-bold text-on-primary hand-drawn-oval transition-all hover:rotate-1 hover:scale-105 active:rotate-[-1deg] active:scale-95"
                >
                  Write Inspiration
                </Link>
                <UserAccountDropdown user={user} nickname={nickname} signOut={signOut} />
              </>
            ) : !authLoading ? (
              <Link
                to={`/login?redirect=${encodeURIComponent(`/?${searchParams.toString()}`)}`}
                className="text-label-sm font-bold text-primary underline decoration-wavy"
              >
                登录
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          {!authLoading && user ? (
            <UserAccountDropdown
              user={user}
              nickname={nickname}
              signOut={signOut}
              menuAlign="right"
              onItemClick={closeMobileNav}
            />
          ) : !authLoading ? (
            <Link
              to={loginHref}
              className="rounded-full border-2 border-dashed border-primary/50 px-3 py-1.5 text-label-sm font-bold text-primary"
            >
              登录
            </Link>
          ) : null}
          <button
            type="button"
            className="-mr-2 rounded-md p-2 text-primary hover:bg-black/5 dark:hover:bg-white/10 material-symbols-outlined"
            aria-expanded={mobileNavOpen}
            aria-controls="home-mobile-nav"
            aria-label={mobileNavOpen ? '关闭菜单' : '打开菜单'}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            {mobileNavOpen ? 'close' : 'menu'}
          </button>
        </div>
      </header>

      {mobileNavOpen ? (
        <>
          <button
            type="button"
            aria-label="关闭菜单"
            className="fixed inset-0 z-40 bg-black/45 md:hidden"
            onClick={closeMobileNav}
          />
          <aside
            id="home-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="站点菜单"
            className="fixed right-0 top-0 z-50 flex h-full min-h-0 w-[min(88vw,300px)] flex-col border-l-2 border-dashed border-stone-300 bg-orange-50 shadow-[ -4px_0_12px_rgba(0,0,0,0.08)] dark:border-stone-700 dark:bg-stone-900 md:hidden"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-dashed border-stone-300 px-4 py-4 dark:border-stone-600">
              <span className="font-serif text-lg font-bold italic tracking-tight text-lime-900 dark:text-lime-100">
                菜单
              </span>
              <button
                type="button"
                aria-label="关闭"
                className="material-symbols-outlined rounded-md p-2 text-primary hover:bg-black/5 dark:hover:bg-white/10"
                onClick={closeMobileNav}
              >
                close
              </button>
            </div>
            <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6 font-serif">
              <Link
                to="/"
                onClick={closeMobileNav}
                className="text-lime-800 underline decoration-wavy dark:text-lime-200"
              >
                Latest
              </Link>
              <span className="text-stone-500 dark:text-stone-400">My Journal（敬请期待）</span>
              <span className="text-stone-500 dark:text-stone-400">Collections（敬请期待）</span>
              <div className="mt-auto border-t border-dashed border-stone-300 pt-6 dark:border-stone-600">
                {!authLoading && user ? (
                  <Link
                    to="/new"
                    onClick={closeMobileNav}
                    className="bg-primary px-4 py-3 text-center text-on-primary hand-drawn-oval text-label-sm font-bold"
                  >
                    Write Inspiration
                  </Link>
                ) : !authLoading ? (
                  <Link
                    to={loginHref}
                    onClick={closeMobileNav}
                    className="inline-block text-label-sm font-bold text-primary underline decoration-wavy"
                  >
                    登录 / 注册
                  </Link>
                ) : (
                  <span className="text-outline text-label-sm">加载中…</span>
                )}
              </div>
            </nav>
          </aside>
        </>
      ) : null}

      <main className="flex-grow notebook-lines pt-12 pb-24 px-margin-page">
        <div className="max-w-[1200px] mx-auto">
          <div className="mb-12 text-center">
            <h1 className="font-headline-xl text-headline-xl text-on-surface mb-2">Latest Inspiration</h1>
            <p className="font-body-lg text-body-lg text-outline italic">Capturing the fleeting whispers of creativity...</p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-16">
            {filterChips.map((chip) => {
              const selected = activeTag === chip.key
              return (
                <button
                  key={chip.key || 'all'}
                  type="button"
                  onClick={() => setTagFilter(chip.key)}
                  className={`px-6 py-2 sketchy-border text-label-sm hover:scale-105 transition-transform ${
                    selected
                      ? 'bg-primary-container text-on-primary-container font-bold'
                      : 'bg-surface-container-high text-on-surface-variant font-medium'
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>

          {error ? <p className="text-center text-error text-body-md mb-8">{error}</p> : null}

          {loading ? (
            <p className="text-center text-outline font-body-md">加载中…</p>
          ) : rows.length === 0 ? (
            <p className="text-center text-outline font-headline-md">还没有灵感，登录后写一条吧 ✨</p>
          ) : (
            <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
              {rows.map((item, index) => {
                const v = LIST_CARD_VARIANTS[index % LIST_CARD_VARIANTS.length]!
                return (
                  <InspirationCard
                    key={item.id}
                    item={item}
                    variant={v}
                    liked={likedIds.has(item.id)}
                    user={user}
                    onToggleLike={onToggleLike}
                  />
                )
              })}
            </div>
          )}

          <div className="mt-24 flex flex-col items-center opacity-40">
            <div className="relative w-48 h-48 mb-6">
              <img
                alt="Corgi with a quill"
                className="w-full h-full object-contain"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJNr0pHxDW5ecptIDe27clS_HaPTlWje9nTazp0QY-hYuiCuJnd-htSprsv2ZZ2Si4kVjD6oXna4V_HJN2N8-7LOCoQ1DoEGmEBjtMpFoVxpwbH14RKsQXO9kFUwxbLfkGQCOIqGU2z9AHdDeYqPjOWA8u5hmXGq1H7axblOWM9tSYjvHqb12zTisrcrcLqwg43J8r68l4P5xM_l4ie1zRWcFcXI-nRaP76ALAlK_9LofFaTc1S915Bye5tmcfoKLP93Vr4sig8dA"
              />
            </div>
            <p className="font-headline-md text-headline-md text-outline">Keep exploring for more sparks...</p>
            <div className="mt-4 flex gap-4">
              <span className="material-symbols-outlined">auto_awesome</span>
              <span className="material-symbols-outlined">brush</span>
              <span className="material-symbols-outlined">edit_note</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-orange-100/50 dark:bg-stone-950/50 border-t-2 border-stone-300 dark:border-stone-700 border-dashed w-full flex flex-col items-center justify-center pt-12 pb-8 px-4 gap-4 rounded-t-[100px_20px] relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-24 bg-primary/5 wavy-border pointer-events-none" />
        <div className="flex gap-8 mb-4">
          <span className="text-stone-500 opacity-80 hover:translate-y-[-4px] transition-transform duration-300 material-symbols-outlined text-2xl">
            edit
          </span>
          <span className="text-stone-500 opacity-80 hover:translate-y-[-4px] transition-transform duration-300 material-symbols-outlined text-2xl">
            coffee
          </span>
          <span className="text-lime-700 font-bold hover:translate-y-[-4px] transition-transform duration-300 material-symbols-outlined text-2xl">
            light_mode
          </span>
          <span className="text-stone-500 opacity-80 hover:translate-y-[-4px] transition-transform duration-300 material-symbols-outlined text-2xl">
            cloud
          </span>
        </div>
        <div className="text-lg font-medium text-stone-700 dark:text-stone-300 font-serif italic">灵感随手记</div>
        <p className="font-serif text-sm italic text-lime-800 dark:text-lime-400">✧ 随手记下灵感，像在便签本上画小花 ✧</p>
        <div className="flex gap-4 mt-2">
          <span className="material-symbols-outlined text-primary/30">eco</span>
          <span className="material-symbols-outlined text-primary/30">potted_plant</span>
          <span className="material-symbols-outlined text-primary/30">local_florist</span>
        </div>
      </footer>

      {user ? (
        <Link
          to="/new"
          className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 hand-drawn-oval"
          aria-label="Write inspiration"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </Link>
      ) : null}
    </div>
  )
}
