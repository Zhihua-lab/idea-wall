import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { InspirationCard } from '../components/InspirationCard'
import {
  deleteLike,
  fetchInspirationsByUserId,
  fetchMyLikeIds,
  fetchUserInspirationStats,
  insertLike,
} from '../lib/inspirationsApi'
import { LIST_CARD_VARIANTS } from '../lib/listCardVariants'
import { PRESET_TAGS } from '../lib/presetTags'
import { formatJoinedMonthZh } from '../lib/profileDisplay'
import { getUserProfile } from '../lib/userApi'
import type { InspirationWithAuthor, UserProfileRow } from '../types/database'

export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTag = searchParams.get('tag') ?? ''
  const { user, nickname: authNickname, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<UserProfileRow | null>(null)
  const [stats, setStats] = useState<{ count: number; earliestAt: string | null } | null>(null)
  const [rows, setRows] = useState<InspirationWithAuthor[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isSelf = Boolean(user && userId && user.id === userId)

  const profileRedirect = useMemo(() => {
    const q = searchParams.toString()
    return `/profile/${userId ?? ''}${q ? `?${q}` : ''}`
  }, [userId, searchParams])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const [p, s, list] = await Promise.all([
        getUserProfile(userId),
        fetchUserInspirationStats(userId),
        fetchInspirationsByUserId(userId, activeTag || undefined),
      ])
      setProfile(p)
      setStats(s)
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
      setRows([])
      setProfile(null)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [userId, activeTag, user, authNickname])

  useEffect(() => {
    void load()
  }, [load, authNickname])

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
      navigate(`/login?redirect=${encodeURIComponent(profileRedirect)}`)
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

  const joinedLabel = useMemo(() => {
    if (isSelf && user?.created_at) {
      return `注册于 ${formatJoinedMonthZh(user.created_at)}`
    }
    if (stats?.earliestAt) {
      return `首条灵感：${formatJoinedMonthZh(stats.earliestAt)}`
    }
    return '暂无灵感记录'
  }, [isSelf, user, stats])

  if (!userId) {
    return (
      <div className="p-md font-body-md">
        <p>无效的用户链接</p>
        <Link to="/">返回首页</Link>
      </div>
    )
  }

  return (
    <div className="stitch-shell stitch-shell--profile bg-surface font-body-md text-on-surface min-h-screen flex flex-col selection:bg-primary-container selection:text-on-primary-container">
      <div className="grain-texture" />
      <header className="sticky top-0 z-50 flex w-full items-center justify-between border-b-2 border-dashed border-stone-300 bg-orange-50 px-6 py-4 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] dark:border-stone-700 dark:bg-stone-900">
        <Link to="/" className="font-serif text-2xl font-bold italic tracking-tight text-lime-900 dark:text-lime-100">
          灵感随手记
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="hidden text-stone-600 underline decoration-wavy sm:inline dark:text-stone-400">
            Latest
          </Link>
          {!authLoading && user ? (
            <Link to="/settings" className="text-label-sm text-primary underline decoration-dotted">
              设置
            </Link>
          ) : null}
        </div>
      </header>

      <main className="notebook-lines flex-grow px-margin-page pb-24 pt-12">
        <div className="mx-auto max-w-[1200px]">
          {loading ? <p className="text-center text-outline">加载中…</p> : null}
          {error ? <p className="mb-6 text-center text-error">{error}</p> : null}

          {!loading && !profile ? (
            <p className="text-center text-outline">找不到该用户资料</p>
          ) : null}

          {!loading && profile ? (
            <>
              <div className="mb-10 text-center">
                <h1 className="font-headline-xl text-headline-xl text-on-surface mb-2">{profile.nickname}</h1>
                <p className="font-body-lg text-on-surface-variant">{joinedLabel}</p>
                <p className="mt-2 font-body-md text-outline">共 {stats?.count ?? 0} 条灵感</p>
              </div>

              <div className="mb-16 flex flex-wrap justify-center gap-4">
                {filterChips.map((chip) => {
                  const selected = activeTag === chip.key
                  return (
                    <button
                      key={chip.key || 'all'}
                      type="button"
                      onClick={() => setTagFilter(chip.key)}
                      className={`sketchy-border px-6 py-2 text-label-sm transition-transform hover:scale-105 ${
                        selected
                          ? 'bg-primary-container font-bold text-on-primary-container'
                          : 'bg-surface-container-high font-medium text-on-surface-variant'
                      }`}
                    >
                      {chip.label}
                    </button>
                  )
                })}
              </div>

              {rows.length === 0 ? (
                <p className="text-center font-headline-md text-outline">这里还没有灵感</p>
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
            </>
          ) : null}
        </div>
      </main>
    </div>
  )
}
