import { useMemo } from 'react'
import { displayUrlForInspirationImage } from '../lib/inspirationStorage'

type InspirationImageGridProps = {
  urls: string[]
  className?: string
  onOpen: (index: number) => void
}

/** 详情页：微信朋友圈式缩略网格（最多 3 张） */
export function InspirationImageGrid({ urls, className = '', onOpen }: InspirationImageGridProps) {
  const safe = useMemo(() => urls.slice(0, 3).filter(Boolean), [urls])
  if (safe.length === 0) return null

  const gridClass =
    safe.length === 1 ? 'grid-cols-1' : safe.length === 2 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <div className={`grid gap-1 ${gridClass} ${className}`}>
      {safe.map((src, i) => (
        <button
          key={`${src}-${i}`}
          type="button"
          onClick={() => onOpen(i)}
          className={`relative overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            safe.length === 1 ? 'aspect-[4/3] max-h-[min(70vh,520px)] w-full' : 'aspect-square w-full'
          }`}
        >
          <img src={displayUrlForInspirationImage(src)} alt="" className="h-full w-full object-cover" loading="lazy" />
        </button>
      ))}
    </div>
  )
}
