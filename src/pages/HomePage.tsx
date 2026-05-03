import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import {
  deleteLike,
  fetchInspirationsList,
  fetchMyLikeIds,
  insertLike,
} from '../lib/inspirationsApi'
import { LIST_CARD_VARIANTS } from '../lib/listCardVariants'
import { moodIconForStored } from '../lib/moodUi'
import { PRESET_TAGS } from '../lib/presetTags'
import type { InspirationWithAuthor } from '../types/database'

function previewBody(body: string, max = 100): string {
  const t = body.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function nicknameInitial(nickname: string): string {
  const c = nickname.trim().charAt(0)
  return c || '?'
}

export function HomePage() {
  const { user, nickname, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTag = searchParams.get('tag') ?? ''

  const [rows, setRows] = useState<InspirationWithAuthor[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [activeTag, user])

  useEffect(() => {
    void load()
  }, [load])

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
      } else {
        await insertLike(user.id, inspirationId)
        setLikedIds((prev) => new Set(prev).add(inspirationId))
      }
      await load()
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
      <header className="bg-orange-50 dark:bg-stone-900 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] sticky top-0 z-50 border-b-2 border-dashed border-stone-300 dark:border-stone-700 flex justify-between items-center w-full px-6 py-4">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="text-2xl font-bold text-lime-900 dark:text-lime-100 italic font-serif tracking-tight"
          >
            灵感随手记
          </Link>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <nav className="flex gap-4">
            <Link
              to="/"
              className="text-lime-700 dark:text-lime-300 underline decoration-wavy font-serif italic tracking-tight hover:rotate-1 hover:scale-105 transition-all"
            >
              Latest
            </Link>
            <span className="text-stone-600 dark:text-stone-400 font-serif italic tracking-tight">My Journal</span>
            <span className="text-stone-600 dark:text-stone-400 font-serif italic tracking-tight">Collections</span>
          </nav>
          <div className="flex items-center gap-3 border-l border-stone-300 pl-6">
            {!authLoading && user ? (
              <>
                <Link
                  to="/new"
                  className="bg-primary px-4 py-2 text-on-primary hand-drawn-oval text-label-sm font-bold hover:rotate-1 hover:scale-105 transition-all active:rotate-[-1deg] active:scale-95 inline-block text-center"
                >
                  Write Inspiration
                </Link>
                <span className="text-label-sm text-stone-600 max-w-[120px] truncate" title={nickname ?? undefined}>
                  {nickname ?? user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="text-label-sm text-stone-600 underline decoration-dotted"
                >
                  退出
                </button>
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
        <button type="button" className="md:hidden material-symbols-outlined text-primary">
          menu
        </button>
      </header>

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {rows.map((item, index) => {
                const v = LIST_CARD_VARIANTS[index % LIST_CARD_VARIANTS.length]!
                const firstTag = item.tags[0]
                const rel = formatRelativeTime(item.created_at)
                const icon = moodIconForStored(item.mood)
                const liked = likedIds.has(item.id)
                const likeDisabled = !user
                return (
                  <article key={item.id} className={`inspiration-card ${v.cardArticleClass}`}>
                    <div className={v.washiTapeClass} />
                    <div className={v.innerCardClass}>
                      <Link to={`/inspiration/${item.id}`} className="block text-inherit no-underline">
                        <div className="flex justify-between items-start mb-4">
                          <span className={`tag-pill ${v.primaryTagClass}`}>
                            {firstTag ? `#${firstTag}` : '#未分类'}
                          </span>
                          <span className="text-label-sm text-outline italic">{rel}</span>
                        </div>
                        <h3 className="font-headline-md text-headline-md mb-3 text-on-surface">{item.title}</h3>
                        <p className="text-body-md text-on-surface-variant mb-6 line-clamp-3">{previewBody(item.body)}</p>
                      </Link>
                      <div className="flex items-center justify-between border-t border-dashed border-outline-variant pt-4">
                        <Link to={`/inspiration/${item.id}`} className="flex items-center gap-2 text-inherit no-underline min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center font-bold text-xs ${v.authorAvatarClass}`}
                          >
                            {nicknameInitial(item.nickname)}
                          </div>
                          <span className="text-label-sm font-semibold truncate">{item.nickname}</span>
                        </Link>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
                          <button
                            type="button"
                            onClick={(e) => void onToggleLike(e, item.id)}
                            className={`material-symbols-outlined hover:scale-125 transition-transform bg-transparent border-0 p-0 cursor-pointer ${
                              likeDisabled ? 'text-stone-400 cursor-pointer' : 'text-error'
                            }`}
                            style={liked && user ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            aria-label={user ? (liked ? '取消点赞' : '点赞') : '登录后点赞'}
                          >
                            favorite
                          </button>
                          <span className="text-label-sm font-semibold text-on-surface-variant">{item.likes_count}</span>
                        </div>
                      </div>
                    </div>
                  </article>
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
