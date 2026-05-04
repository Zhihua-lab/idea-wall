import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  deleteLike,
  fetchInspirationById,
  fetchLikedForUser,
  insertLike,
} from '../lib/inspirationsApi'
import { moodIconForStored, moodLineForDetail } from '../lib/moodUi'
import type { InspirationWithAuthor } from '../types/database'

function formatAbsolute(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatRelativeShort(iso: string): string {
  const then = new Date(iso).getTime()
  const sec = Math.floor((Date.now() - then) / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  return `${day} 天前`
}

function isEdited(row: InspirationWithAuthor): boolean {
  const a = new Date(row.created_at).getTime()
  const b = new Date(row.updated_at).getTime()
  return Math.abs(b - a) > 2000
}

export function InspirationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut, nickname: authNickname } = useAuth()

  const [row, setRow] = useState<InspirationWithAuthor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liked, setLiked] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchInspirationById(id)
      setRow(data)
      if (user && data) {
        setLiked(await fetchLikedForUser(user.id, data.id))
      } else {
        setLiked(false)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [id, user, authNickname])

  useEffect(() => {
    void load()
  }, [load])

  const onToggleLike = async () => {
    if (!row) return
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/inspiration/${row.id}`)}`)
      return
    }
    setLikeBusy(true)
    try {
      if (liked) {
        await deleteLike(user.id, row.id)
        setLiked(false)
      } else {
        await insertLike(user.id, row.id)
        setLiked(true)
      }
      const next = await fetchInspirationById(row.id)
      setRow(next)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '点赞失败')
    } finally {
      setLikeBusy(false)
    }
  }

  const isAuthor = Boolean(user && row && user.id === row.user_id)

  return (
    <div className="stitch-shell stitch-shell--detail paper-texture min-h-screen font-body-md text-on-surface selection:bg-primary-container selection:text-white">
      <header className="flex justify-between items-center w-full px-6 py-4 sticky top-0 z-50 bg-orange-50 dark:bg-stone-900 border-b-2 border-dashed border-stone-300 dark:border-stone-700 shadow-[2px_2px_0px_rgba(0,0,0,0.05)]">
        <Link to="/" className="text-2xl font-bold text-lime-900 dark:text-lime-100 italic font-serif italic tracking-tight">
          灵感随手记
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {user ? (
            <Link
              to="/new"
              className="text-lime-700 dark:text-lime-300 underline decoration-wavy font-headline-md hover:rotate-1 hover:scale-105 transition-all"
            >
              Write Inspiration
            </Link>
          ) : null}
          <Link to="/" className="text-stone-600 dark:text-stone-400 font-headline-md hover:rotate-1 hover:scale-105 transition-all">
            Explore
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          {!authLoading && user ? (
            <>
              <span className="text-label-sm text-stone-600 max-w-[100px] truncate hidden sm:inline">{user.email}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="material-symbols-outlined text-lime-800 dark:text-lime-400 p-2 hover:rotate-1 hover:scale-105 transition-all cursor-pointer bg-transparent border-0"
                aria-label="退出"
              >
                logout
              </button>
            </>
          ) : !authLoading ? (
            <Link to={`/login?redirect=${encodeURIComponent(id ? `/inspiration/${id}` : '/')}`} className="material-symbols-outlined text-lime-800 dark:text-lime-400 p-2 hover:rotate-1 hover:scale-105 transition-all">
              person
            </Link>
          ) : null}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-margin-page py-xl relative">
        <div className="absolute -left-12 top-20 rotate-12 opacity-20 pointer-events-none">
          <span className="material-symbols-outlined text-[120px] text-primary">auto_awesome</span>
        </div>

        {loading ? <p className="text-center text-outline">加载中…</p> : null}
        {error ? <p className="text-center text-error mb-4">{error}</p> : null}

        {!loading && !row ? <p className="text-center text-outline">找不到这条灵感</p> : null}

        {row ? (
          <article className="relative z-20 space-y-md">
            <div className="relative bg-surface-container p-md wobbly-border shadow-sm folded-corner transform -rotate-1">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 washi-tape flex items-center justify-center font-label-sm text-primary-container opacity-80">
                Pinned Note
              </div>
              <div className="pt-sm">
                <h1 className="font-headline-xl text-headline-xl text-on-surface mb-xs doodle-underline inline-block">{row.title}</h1>
                <div className="flex flex-wrap items-center gap-md mt-md text-on-surface-variant font-label-sm">
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-sm">edit_note</span>
                    <span>
                      作者：
                      <Link
                        to={`/profile/${row.user_id}`}
                        className="font-medium text-primary underline decoration-wavy hover:opacity-90"
                      >
                        {row.nickname}
                      </Link>
                    </span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    <span>{formatAbsolute(row.created_at)}</span>
                  </div>
                  <span className="text-outline">（{formatRelativeShort(row.created_at)}）</span>
                  {isEdited(row) ? (
                    <span className="bg-secondary-container text-on-secondary-container px-sm py-xs rounded-full text-[11px] font-bold transform rotate-3 wobbly-border">
                      已编辑 Edited
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <section className="flex flex-col md:flex-row items-start md:items-center gap-md py-md bg-surface-container-low/50 px-md rounded-xl border border-dashed border-outline-variant transform rotate-1">
              <div className="bg-primary-container/10 p-md rounded-full wobbly-border flex items-center justify-center ink-blot">
                <span className="material-symbols-outlined text-primary text-5xl">{moodIconForStored(row.mood)}</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-primary">{moodLineForDetail(row.mood)}</h3>
                <p className="font-body-md text-on-surface-variant italic">记录于灵感随手记</p>
              </div>
            </section>

            <section className="bg-white/40 p-lg wobbly-border space-y-md relative overflow-hidden">
              <div className="font-body-lg text-body-lg leading-relaxed text-on-surface whitespace-pre-wrap">{row.body}</div>

              <div className="flex flex-wrap gap-2 pt-2">
                {(row.tags ?? []).map((t) => (
                  <Link
                    key={t}
                    to={`/?tag=${encodeURIComponent(t)}`}
                    className="tag-pill text-label-sm font-bold text-primary px-3 py-1 bg-primary-fixed rounded-full no-underline hover:opacity-90"
                  >
                    #{t}
                  </Link>
                ))}
              </div>

              <div className="pt-xl flex flex-col md:flex-row justify-between items-center gap-md border-t border-dashed border-outline-variant">
                <div className="flex items-center gap-sm">
                  <button
                    type="button"
                    onClick={() => void onToggleLike()}
                    disabled={likeBusy}
                    className="group flex flex-col items-center gap-1 transition-all bg-transparent border-0 cursor-pointer disabled:opacity-50"
                  >
                    <div className="p-4 bg-tertiary-container/10 rounded-full wobbly-border group-hover:scale-110 group-active:scale-90 transition-transform">
                      <span
                        className={`material-symbols-outlined text-tertiary text-4xl ${!user ? 'opacity-40' : ''}`}
                        style={liked && user ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        favorite
                      </span>
                    </div>
                    <span className="font-label-sm text-tertiary">{row.likes_count} 个赞</span>
                  </button>
                  <div className="h-12 w-[1px] bg-outline-variant hidden md:block" />
                  <button type="button" className="group flex flex-col items-center gap-1 transition-all bg-transparent border-0 cursor-default">
                    <div className="p-4 bg-primary-container/10 rounded-full wobbly-border group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-primary text-4xl">share</span>
                    </div>
                    <span className="font-label-sm text-primary">分享</span>
                  </button>
                </div>
                {isAuthor ? (
                  <div className="flex items-center gap-md">
                    <Link
                      to={`/inspiration/${row.id}/edit`}
                      className="px-md py-sm bg-primary-container text-white font-headline-md rounded-full wobbly-border hover:rotate-1 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 no-underline"
                    >
                      <span className="material-symbols-outlined">edit</span>
                      Edit Detail
                    </Link>
                    <Link
                      to={`/delete-confirm?id=${encodeURIComponent(row.id)}`}
                      className="px-md py-sm border-2 border-dashed border-error text-error font-headline-md rounded-full hover:bg-error/5 hover:-rotate-1 active:scale-95 transition-all flex items-center gap-2 no-underline"
                    >
                      <span className="material-symbols-outlined">delete</span>
                      Trash
                    </Link>
                  </div>
                ) : null}
              </div>
            </section>
          </article>
        ) : null}

        <div className="py-xl flex justify-center opacity-30">
          <span className="material-symbols-outlined text-4xl text-primary mx-xs">eco</span>
          <span className="material-symbols-outlined text-4xl text-primary mx-xs">star</span>
          <span className="material-symbols-outlined text-4xl text-primary mx-xs">eco</span>
        </div>
      </main>

      <footer className="w-full flex flex-col items-center justify-center pt-12 pb-8 px-4 gap-4 bg-orange-100/50 dark:bg-stone-950/50 border-t-2 border-stone-300 dark:border-stone-700 border-dashed rounded-t-[100px_20px] relative z-40">
        <div className="flex gap-8 mb-4">
          <button type="button" className="material-symbols-outlined text-stone-500 opacity-80 hover:translate-y-[-4px] transition-transform duration-300 text-3xl">
            edit
          </button>
          <button type="button" className="material-symbols-outlined text-lime-700 font-bold hover:translate-y-[-4px] transition-transform duration-300 text-3xl">
            coffee
          </button>
          <button type="button" className="material-symbols-outlined text-stone-500 opacity-80 hover:translate-y-[-4px] transition-transform duration-300 text-3xl">
            light_mode
          </button>
          <button type="button" className="material-symbols-outlined text-stone-500 opacity-80 hover:translate-y-[-4px] transition-transform duration-300 text-3xl">
            cloud
          </button>
        </div>
        <div className="text-lg font-medium text-stone-700 dark:text-stone-300 font-serif text-sm italic">
          ✧ 随手记下灵感，像在便签本上画小花 ✧
        </div>
        <div className="absolute bottom-0 left-0 w-full h-24 overflow-hidden pointer-events-none opacity-20">
          <svg className="w-full h-full fill-primary" preserveAspectRatio="none" viewBox="0 0 1200 120">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C59.71,118.41,158.34,123.07,243.09,105.37,273.72,99,300.31,87.6,321.39,56.44Z" />
          </svg>
        </div>
      </footer>
    </div>
  )
}
