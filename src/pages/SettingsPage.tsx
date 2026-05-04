import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getUserProfile, updateNickname } from '../lib/userApi'

export function SettingsPage() {
  const { user, loading: authLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState(false)

  useEffect(() => {
    if (!user) return
    let mounted = true
    setPageLoading(true)
    setError(null)
    void getUserProfile(user.id)
      .then((row) => {
        if (!mounted) return
        setDraft(row?.nickname ?? '')
      })
      .catch(() => {
        if (mounted) setError('加载失败')
      })
      .finally(() => {
        if (mounted) setPageLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [user])

  const onSave = useCallback(async () => {
    if (!user) return
    setError(null)
    setSavedOk(false)
    setSaving(true)
    try {
      await updateNickname(user.id, draft)
      await refreshProfile()
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }, [user, draft, refreshProfile])

  if (!authLoading && !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent('/settings')}`} replace />
  }

  return (
    <div className="stitch-shell stitch-shell--settings bg-surface font-body-md text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 flex w-full items-center justify-between border-b-2 border-dashed border-stone-300 bg-orange-50 px-6 py-4 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] dark:border-stone-700 dark:bg-stone-900">
        <Link
          to="/"
          className="font-serif text-xl font-bold italic tracking-tight text-lime-900 dark:text-lime-100"
        >
          灵感随手记
        </Link>
        <Link to="/" className="text-label-sm text-primary underline decoration-wavy">
          返回首页
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-margin-page py-xl">
        <h1 className="font-headline-xl text-headline-xl text-on-surface mb-2">个人设置</h1>
        <p className="mb-8 text-body-md text-on-surface-variant">修改你在灵感列表与详情中展示的昵称。</p>

        {pageLoading ? <p className="text-outline">加载中…</p> : null}
        {error ? <p className="mb-4 text-error text-body-md">{error}</p> : null}
        {savedOk ? <p className="mb-4 text-primary text-body-md">已保存</p> : null}

        {!pageLoading ? (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault()
              void onSave()
            }}
          >
            <div>
              <label htmlFor="settings-nickname" className="mb-2 block font-headline-md text-headline-md text-on-surface">
                昵称
              </label>
              <input
                id="settings-nickname"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={32}
                autoComplete="nickname"
                className="w-full border-b-2 border-dashed border-outline-variant bg-transparent py-2 font-body-lg text-body-lg focus:border-primary-container focus:outline-none focus:ring-0"
                placeholder="输入昵称"
              />
              <p className="mt-2 text-label-sm text-outline">最多 32 字；未自定义前默认为注册时的 user_xxxxxx。</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button
                type="submit"
                disabled={saving}
                className="hand-drawn-oval bg-primary px-6 py-3 text-label-sm font-bold text-on-primary disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="border-2 border-dashed border-outline-variant px-6 py-3 text-label-sm text-on-surface-variant"
              >
                取消
              </button>
            </div>
          </form>
        ) : null}
      </main>
    </div>
  )
}
