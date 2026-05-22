import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { InspirationImageGrid } from '../components/InspirationImageGrid'
import { InspirationImageLightbox } from '../components/InspirationImageLightbox'
import { LikeHeartIcon } from '../components/LikeHeartIcon'
import {
  deleteLike,
  fetchInspirationById,
  fetchLikedForUser,
  insertLike,
} from '../lib/inspirationsApi'
import { normalizeInspirationImages } from '../lib/inspirationStorage'
import { moodIconForStored, moodLineForDetail } from '../lib/moodUi'
import { generateAiComment, publishAiComment } from '../lib/aiCommentApi'
import {
  canEditComment,
  deleteComment,
  fetchCommentsByInspirationId,
  insertComment,
  MAX_COMMENT_LENGTH,
  updateComment,
} from '../lib/commentsApi'
import type { CommentWithNickname, InspirationWithAuthor } from '../types/database'

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
  return row.is_edited === true
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
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const [comments, setComments] = useState<CommentWithNickname[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [aiCommentOpen, setAiCommentOpen] = useState(false)
  const [aiCommentText, setAiCommentText] = useState('')
  const [aiCommentLoading, setAiCommentLoading] = useState(false)
  const [aiCommentPublishing, setAiCommentPublishing] = useState(false)
  const [aiCommentError, setAiCommentError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [data, commentList] = await Promise.all([
        fetchInspirationById(id),
        fetchCommentsByInspirationId(id),
      ])
      setRow(data)
      setComments(commentList)
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
        setRow((r) =>
          r ? { ...r, likes_count: Math.max(0, r.likes_count - 1) } : r,
        )
      } else {
        await insertLike(user.id, row.id)
        setLiked(true)
        setRow((r) => (r ? { ...r, likes_count: r.likes_count + 1 } : r))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '点赞失败')
    } finally {
      setLikeBusy(false)
    }
  }

  const isAuthor = Boolean(user && row && user.id === row.user_id)

  const heartFilled = Boolean(user && liked)

  const handleSubmitComment = async () => {
    if (!user || !row || !commentText.trim()) return
    setCommentSubmitting(true)
    try {
      const inserted = await insertComment(user.id, row.id, commentText.trim())
      setComments((prev) => [...prev, { ...inserted, nickname: authNickname ?? '用户' }])
      setRow((r) => (r ? { ...r, comments_count: r.comments_count + 1 } : r))
      setCommentText('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '评论失败')
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handleGenerateAiComment = async () => {
    if (!user || !row || aiCommentLoading) return
    setAiCommentOpen(true)
    setAiCommentLoading(true)
    setAiCommentError(null)
    try {
      const next = await generateAiComment({
        title: row.title,
        body: row.body,
        mood: row.mood,
        tags: row.tags ?? [],
      })
      setAiCommentText(next)
    } catch (e: unknown) {
      setAiCommentError(e instanceof Error ? e.message : 'AI 评论生成失败，请稍后再试')
    } finally {
      setAiCommentLoading(false)
    }
  }

  const handlePublishAiComment = async () => {
    if (!row || !aiCommentText.trim() || aiCommentPublishing) return
    setAiCommentPublishing(true)
    setAiCommentError(null)
    try {
      const inserted = await publishAiComment(row.id, aiCommentText.trim())
      setComments((prev) => [
        ...prev,
        {
          ...inserted,
          nickname: inserted.ai_display_name ?? '小满',
          requested_by_nickname: authNickname ?? '用户',
        },
      ])
      setRow((r) => (r ? { ...r, comments_count: r.comments_count + 1 } : r))
      setAiCommentOpen(false)
      setAiCommentText('')
    } catch (e: unknown) {
      setAiCommentError(e instanceof Error ? e.message : '小满评论发布失败，请稍后再试')
    } finally {
      setAiCommentPublishing(false)
    }
  }

  const handleStartEdit = (c: CommentWithNickname) => {
    if (!canEditComment(c, user?.id)) return
    setEditingId(c.id)
    setEditText(c.content)
  }

  const handleSaveEdit = async () => {
    if (!user || !editingId || !editText.trim()) return
    setEditSubmitting(true)
    try {
      const updated = await updateComment(editingId, user.id, editText.trim())
      setComments((prev) =>
        prev.map((c) =>
          c.id === editingId ? { ...c, content: updated.content, updated_at: updated.updated_at } : c,
        ),
      )
      setEditingId(null)
      setEditText('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '更新失败')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return
    if (!confirm('确定要删除这条评论吗？')) return
    try {
      await deleteComment(commentId, user.id)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setRow((r) => (r ? { ...r, comments_count: Math.max(0, r.comments_count - 1) } : r))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  const imageUrls = useMemo(() => normalizeInspirationImages(row?.images ?? null), [row?.images])

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

              {imageUrls.length > 0 ? (
                <InspirationImageGrid
                  urls={imageUrls}
                  className="pt-4"
                  onOpen={(i) => {
                    setLightboxIndex(i)
                    setLightboxOpen(true)
                  }}
                />
              ) : null}

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
                    <div
                      className={`rounded-full p-4 wobbly-border transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95 ${
                        !user
                          ? 'bg-surface-container-high text-on-surface-variant'
                          : heartFilled
                            ? 'bg-[#fde8ea]/95 text-[#ba5f68]'
                            : 'bg-[#fdf3f4]/95 text-[#c9959a]'
                      }`}
                    >
                      <LikeHeartIcon
                        filled={heartFilled}
                        className={`h-9 w-9 shrink-0 transition-transform duration-300 ease-out will-change-transform ${
                          !user ? 'opacity-45' : ''
                        } ${user && heartFilled ? 'scale-[1.07]' : 'scale-100'}`}
                      />
                    </div>
                    <span
                      className={`font-label-sm transition-colors duration-200 ${
                        user && heartFilled ? 'text-[#b05862]' : 'text-on-surface-variant'
                      }`}
                    >
                      {row.likes_count} 个赞
                    </span>
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

            <section className="bg-surface-container-low/40 p-lg rounded-xl border border-dashed border-outline-variant space-y-md">
              <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary">comment</span>
                评论 <span className="text-body-sm text-on-surface-variant font-normal">({row.comments_count})</span>
              </h3>

              {user ? (
                <div className="flex flex-col gap-sm">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="写下你的评论..."
                    rows={3}
                    maxLength={MAX_COMMENT_LENGTH}
                    className="w-full rounded-lg border border-outline-variant bg-surface p-sm text-body-lg text-on-surface focus:border-primary focus:outline-none resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm text-outline">
                      {commentText.length}/{MAX_COMMENT_LENGTH}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGenerateAiComment()}
                        disabled={aiCommentLoading}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-container/20 px-md py-sm text-body-sm font-bold text-primary transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                        {aiCommentLoading ? '生成中...' : 'AI评论'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSubmitComment()}
                        disabled={commentSubmitting || !commentText.trim()}
                        className="inline-flex items-center gap-1 rounded-full bg-primary px-md py-sm text-body-sm font-bold text-on-primary transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-0 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">send</span>
                        {commentSubmitting ? '发送中...' : '发表评论'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-body-md text-on-surface-variant">
                  <Link
                    to={`/login?redirect=${encodeURIComponent(`/inspiration/${row.id}`)}`}
                    className="text-primary underline decoration-wavy"
                  >
                    登录
                  </Link>
                  后参与评论
                </p>
              )}

              <div className="space-y-sm">
                {comments.length === 0 ? (
                  <p className="text-body-md text-outline py-4 text-center">暂无评论，来写第一条吧 ✍️</p>
                ) : (
                  comments.map((c) => {
                    const isEditing = editingId === c.id
                    const editable = canEditComment(c, user?.id)
                    const edited = new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() > 2000
                    return (
                      <div key={c.id} className="rounded-lg bg-surface p-sm border border-outline-variant/50">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-body-sm font-bold ${
                                c.is_ai_generated
                                  ? 'bg-primary-container text-primary'
                                  : 'bg-tertiary-container text-tertiary'
                              }`}
                            >
                              {c.is_ai_generated ? 'i' : (c.nickname || '用户').charAt(0)}
                            </div>
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="text-body-sm font-semibold text-on-surface">{c.nickname}</span>
                              {c.is_ai_generated && c.requested_by_nickname ? (
                                <span className="text-body-sm text-outline">由 {c.requested_by_nickname} 召唤</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-body-sm text-outline">{formatRelativeShort(c.created_at)}</span>
                            {edited ? <span className="text-body-sm text-outline">(已编辑)</span> : null}
                            {editable && !isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(c)}
                                  className="text-body-sm text-primary underline decoration-wavy bg-transparent border-0 cursor-pointer"
                                >
                                  编辑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteComment(c.id)}
                                  className="text-body-sm text-error underline decoration-wavy bg-transparent border-0 cursor-pointer"
                                >
                                  删除
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="flex flex-col gap-2 mt-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={2}
                              maxLength={MAX_COMMENT_LENGTH}
                              className="w-full rounded-lg border border-outline-variant bg-surface p-sm text-body-lg text-on-surface focus:border-primary focus:outline-none resize-none"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="rounded-full border border-outline-variant px-3 py-1 text-body-sm text-on-surface-variant bg-transparent cursor-pointer"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSaveEdit()}
                                disabled={editSubmitting || !editText.trim()}
                                className="rounded-full bg-primary px-3 py-1 text-body-sm font-bold text-on-primary border-0 cursor-pointer disabled:opacity-50"
                              >
                                {editSubmitting ? '保存中...' : '保存'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-body-lg text-on-surface whitespace-pre-wrap">{c.content}</p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {aiCommentOpen ? (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/40 px-4 py-6">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="ai-comment-title"
                  className="w-full max-w-lg rounded-xl border-2 border-dashed border-outline-variant bg-surface p-lg shadow-xl"
                >
                  <div className="mb-md flex items-start justify-between gap-4">
                    <div>
                      <h4 id="ai-comment-title" className="font-headline-md text-headline-md text-on-surface">
                        AI 评论预览
                      </h4>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        先看看这句合不合心意，确认后由小满发表。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiCommentOpen(false)}
                      className="material-symbols-outlined rounded-full border-0 bg-transparent p-1 text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
                      aria-label="关闭 AI 评论预览"
                    >
                      close
                    </button>
                  </div>

                  <div className="min-h-[120px] rounded-lg border border-outline-variant bg-white/60 p-md text-body-lg text-on-surface whitespace-pre-wrap">
                    {aiCommentLoading ? (
                      <span className="text-on-surface-variant">正在认真读这条灵感...</span>
                    ) : aiCommentText ? (
                      aiCommentText
                    ) : (
                      <span className="text-on-surface-variant">还没有生成内容。</span>
                    )}
                  </div>

                  {aiCommentError ? <p className="mt-sm text-body-sm text-error">{aiCommentError}</p> : null}

                  <div className="mt-md flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAiCommentOpen(false)}
                      className="rounded-full border border-outline-variant bg-transparent px-md py-sm text-body-sm font-bold text-on-surface-variant cursor-pointer hover:bg-surface-container-high"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleGenerateAiComment()}
                      disabled={aiCommentLoading}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-transparent px-md py-sm text-body-sm font-bold text-primary cursor-pointer hover:bg-primary-container/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[20px]">refresh</span>
                      重新生成
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePublishAiComment()}
                      disabled={aiCommentLoading || aiCommentPublishing || !aiCommentText.trim()}
                      className="inline-flex items-center gap-1 rounded-full border-0 bg-primary px-md py-sm text-body-sm font-bold text-on-primary cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                      {aiCommentPublishing ? '发表中...' : '让小满发表'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {row && imageUrls.length > 0 ? (
              <InspirationImageLightbox
                open={lightboxOpen}
                urls={imageUrls}
                startIndex={lightboxIndex}
                onClose={() => setLightboxOpen(false)}
                isAuthor={isAuthor}
                inspirationId={row.id}
                userId={user?.id ?? ''}
                onImagesUpdated={(next) => setRow((r) => (r ? { ...r, images: next } : null))}
              />
            ) : null}
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
