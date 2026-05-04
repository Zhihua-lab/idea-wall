import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

function displayInitial(nickname: string | null, email: string | undefined): string {
  const s = (nickname || email || '?').trim()
  return s.charAt(0) || '?'
}

export type UserAccountDropdownProps = {
  user: User
  nickname: string | null
  signOut: () => Promise<void>
  /** 点击菜单项后（如关闭移动端抽屉） */
  onItemClick?: () => void
  menuAlign?: 'left' | 'right'
}

/** 手账感：衬线斜体、暖纸色 hover，避免白底黑体 */
const itemClass =
  'block w-full px-4 py-2.5 text-left font-serif text-sm font-medium italic tracking-tight text-lime-900 transition-colors hover:bg-lime-900/[0.06] hover:text-secondary dark:text-lime-100 dark:hover:bg-white/[0.06] dark:hover:text-lime-50'

const dangerItemClass =
  'block w-full px-4 py-2.5 text-left font-serif text-sm font-medium italic tracking-tight text-secondary transition-colors hover:bg-error/[0.08] hover:text-error dark:text-amber-100/90 dark:hover:bg-error/[0.12] dark:hover:text-amber-50'

export function UserAccountDropdown({
  user,
  nickname,
  signOut,
  onItemClick,
  menuAlign = 'right',
}: UserAccountDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  const afterNavigate = useCallback(() => {
    onItemClick?.()
    close()
  }, [onItemClick, close])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const label = nickname ?? user.email ?? 'User'

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open account menu"
        className="user-account-trigger-paper flex max-w-[220px] items-center gap-2 rounded-full py-1.5 pl-2 pr-2 transition"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-fixed/90 text-sm font-bold text-secondary shadow-[1px_1px_0_rgba(0,0,0,0.06)] ring-1 ring-secondary/20 dark:ring-secondary/30">
          {displayInitial(nickname, user.email)}
        </span>
        <span className="min-w-0 truncate font-serif text-sm font-medium italic tracking-tight text-lime-900 dark:text-lime-100">
          {label}
        </span>
        <span className="material-symbols-outlined shrink-0 text-[20px] text-stone-500/85 dark:text-stone-400">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className={`user-account-menu-paper absolute z-[100] mt-2 min-w-[13.5rem] origin-top-right overflow-hidden rounded-2xl py-1 ${
            menuAlign === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <Link role="menuitem" to={`/profile/${user.id}`} onClick={afterNavigate} className={itemClass}>
            My profile
          </Link>
          <Link role="menuitem" to="/settings" onClick={afterNavigate} className={itemClass}>
            Settings
          </Link>
          <div className="my-1 h-px bg-gradient-to-r from-transparent via-stone-500/25 to-transparent dark:via-stone-400/25" />
          <button
            type="button"
            role="menuitem"
            className={dangerItemClass}
            onClick={() => {
              void (async () => {
                await signOut()
                afterNavigate()
              })()
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}
