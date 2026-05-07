import { useCallback, useEffect, useRef, useState } from 'react'
import { removeOneInspirationImage } from '../lib/inspirationsApi'

export type InspirationImageLightboxProps = {
  open: boolean
  urls: string[]
  startIndex: number
  onClose: () => void
  isAuthor: boolean
  inspirationId: string
  userId: string
  onImagesUpdated: (nextUrls: string[]) => void
}

export function InspirationImageLightbox({
  open,
  urls,
  startIndex,
  onClose,
  isAuthor,
  inspirationId,
  userId,
  onImagesUpdated,
}: InspirationImageLightboxProps) {
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setIndex(Math.min(Math.max(0, startIndex), Math.max(0, urls.length - 1)))
      setErr(null)
    }
  }, [open, startIndex, urls.length])

  const list = urls.slice(0, 3)
  const current = list[index] ?? ''

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? list.length - 1 : i - 1))
  }, [list.length])

  const goNext = useCallback(() => {
    setIndex((i) => (i >= list.length - 1 ? 0 : i + 1))
  }, [list.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, goPrev, goNext])

  const onDelete = async () => {
    if (!current || !isAuthor) return
    setBusy(true)
    setErr(null)
    try {
      const next = await removeOneInspirationImage(inspirationId, userId, current)
      onImagesUpdated(next)
      if (next.length === 0) onClose()
      else setIndex((i) => Math.min(i, next.length - 1))
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  if (!open || list.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-on-surface/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-4xl flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current
          touchStartX.current = null
          if (start == null) return
          const end = e.changedTouches[0]?.clientX
          if (end == null) return
          const dx = end - start
          if (dx > 48) goPrev()
          else if (dx < -48) goNext()
        }}
      >
        <div className="flex w-full items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-full border-2 border-dashed border-outline-variant bg-surface-container-high px-3 py-1 font-label-sm text-on-surface shadow-sm hover:bg-surface-dim"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="flex w-full items-center gap-2 sm:gap-3">
          {list.length > 1 ? (
            <button
              type="button"
              aria-label="上一张"
              className="shrink-0 rounded-full border border-outline-variant bg-surface-container-high/95 p-2 text-primary shadow hover:bg-surface-dim"
              onClick={goPrev}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          ) : (
            <span className="w-10 shrink-0 sm:w-12" aria-hidden />
          )}

          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-lowest p-2 shadow-xl">
            <img src={current} alt="" className="max-h-[min(72vh,640px)] max-w-full object-contain" />
          </div>

          {list.length > 1 ? (
            <button
              type="button"
              aria-label="下一张"
              className="shrink-0 rounded-full border border-outline-variant bg-surface-container-high/95 p-2 text-primary shadow hover:bg-surface-dim"
              onClick={goNext}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          ) : (
            <span className="w-10 shrink-0 sm:w-12" aria-hidden />
          )}
        </div>

        {list.length > 1 ? (
          <p className="font-label-sm text-white/90">
            {index + 1} / {list.length}（左右滑动或键盘切换）
          </p>
        ) : null}

        {err ? <p className="text-center text-error text-label-sm">{err}</p> : null}

        {isAuthor ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDelete()}
            className="rounded-full border-2 border-dashed border-error bg-surface-container-high px-4 py-2 font-label-sm text-error transition-colors hover:bg-error-container/30 disabled:opacity-50"
          >
            {busy ? '删除中…' : '从这条灵感中移除当前图片'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
