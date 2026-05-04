import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { moodIconForStored } from '../lib/moodUi'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import type { InspirationWithAuthor } from '../types/database'
import type { LIST_CARD_VARIANTS } from '../lib/listCardVariants'

export type InspirationCardVariant = (typeof LIST_CARD_VARIANTS)[number]

function previewBody(body: string, max = 100): string {
  const t = body.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function nicknameInitial(nickname: string): string {
  const c = nickname.trim().charAt(0)
  return c || '?'
}

export type InspirationCardProps = {
  item: InspirationWithAuthor
  variant: InspirationCardVariant
  liked: boolean
  user: User | null
  onToggleLike: (e: React.MouseEvent, inspirationId: string) => void
}

export function InspirationCard({ item, variant: v, liked, user, onToggleLike }: InspirationCardProps) {
  const firstTag = item.tags[0]
  const rel = formatRelativeTime(item.created_at)
  const icon = moodIconForStored(item.mood)
  const likeDisabled = !user

  return (
    <article className={`inspiration-card ${v.cardArticleClass}`}>
      <div className={v.washiTapeClass} />
      <div className={v.innerCardClass}>
        <Link to={`/inspiration/${item.id}`} className="block text-inherit no-underline">
          <div className="flex justify-between items-start mb-4">
            <span className={`tag-pill ${v.primaryTagClass}`}>{firstTag ? `#${firstTag}` : '#未分类'}</span>
            <span className="text-label-sm text-outline italic">{rel}</span>
          </div>
          <h3 className="font-headline-md text-headline-md mb-3 text-on-surface">{item.title}</h3>
          <p className="text-body-md text-on-surface-variant mb-6 line-clamp-3">{previewBody(item.body)}</p>
        </Link>
        <div className="flex items-center justify-between border-t border-dashed border-outline-variant pt-4">
          <Link
            to={`/profile/${item.user_id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex min-w-0 items-center gap-2 text-inherit no-underline hover:opacity-90"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${v.authorAvatarClass}`}
            >
              {nicknameInitial(item.nickname)}
            </div>
            <span className="truncate text-label-sm font-semibold">{item.nickname}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <span className="material-symbols-outlined text-lg text-primary">{icon}</span>
            <button
              type="button"
              onClick={(e) => void onToggleLike(e, item.id)}
              className={`material-symbols-outlined cursor-pointer border-0 bg-transparent p-0 transition-transform hover:scale-125 ${
                likeDisabled ? 'cursor-pointer text-stone-400' : 'text-error'
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
}
