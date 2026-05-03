import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { fetchInspirationById } from '../lib/inspirationsApi'
import { supabase } from '../lib/supabaseClient'
import { PRESET_TAGS } from '../lib/presetTags'

const PRESET_MOODS = ['happy', 'calm', 'excited', 'tired', 'sad', 'anxious', 'other'] as const
type MoodKey = (typeof PRESET_MOODS)[number]

function tagsStorageKey(userId: string) {
  return `user_${userId}_tags`
}

function readTagHistory(userId: string): string[] {
  try {
    const raw = localStorage.getItem(tagsStorageKey(userId))
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function appendTagHistory(userId: string, tag: string) {
  const cur = readTagHistory(userId)
  const next = [tag, ...cur.filter((t) => t !== tag)].slice(0, 40)
  localStorage.setItem(tagsStorageKey(userId), JSON.stringify(next))
}

export function WriteInspirationPage() {
  const { id: editId } = useParams()
  const isEdit = Boolean(editId)
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut, refreshProfile } = useAuth()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mood, setMood] = useState<MoodKey>('happy')
  const [moodOther, setMoodOther] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customDraft, setCustomDraft] = useState('')
  const [loadingEdit, setLoadingEdit] = useState(isEdit)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const tagHistory = useMemo(() => (user ? readTagHistory(user.id) : []), [user])

  const loadEdit = useCallback(async () => {
    if (!editId || !user) return
    setLoadingEdit(true)
    setError(null)
    try {
      const row = await fetchInspirationById(editId)
      if (!row) {
        setError('找不到该灵感')
        return
      }
      if (row.user_id !== user.id) {
        setError('无权编辑')
        return
      }
      setTitle(row.title)
      setBody(row.body)
      const m = row.mood as string
      const presetNoOther = ['happy', 'calm', 'excited', 'tired', 'sad', 'anxious'] as const
      if ((presetNoOther as readonly string[]).includes(m)) {
        setMood(m as MoodKey)
        setMoodOther('')
      } else {
        setMood('other')
        setMoodOther(m)
      }
      setSelectedTags((row.tags ?? []).slice(0, 3))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoadingEdit(false)
    }
  }, [editId, user])

  useEffect(() => {
    if (isEdit) void loadEdit()
  }, [isEdit, loadEdit])

  const redirectLogin = `/login?redirect=${encodeURIComponent(isEdit && editId ? `/inspiration/${editId}/edit` : '/new')}`

  const resolvedMood = mood === 'other' ? moodOther.trim() : mood
  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (mood !== 'other' || moodOther.trim().length > 0) &&
    selectedTags.length <= 3

  const togglePresetTag = (t: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t)
      if (prev.length >= 3) return prev
      return [...prev, t]
    })
  }

  const addCustomTag = () => {
    const t = customDraft.trim()
    if (t.length < 1 || t.length > 20) {
      setError('标签长度为 1–20 个字符')
      return
    }
    if (selectedTags.includes(t)) {
      setCustomDraft('')
      return
    }
    if (selectedTags.length >= 3) {
      setError('最多 3 个标签')
      return
    }
    setSelectedTags((prev) => [...prev, t])
    if (user) appendTagHistory(user.id, t)
    setCustomDraft('')
    setError(null)
  }

  const removeTag = (t: string) => {
    setSelectedTags((prev) => prev.filter((x) => x !== t))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const moodValue = resolvedMood
      if (isEdit && editId) {
        const { error: err } = await supabase
          .from('inspirations')
          .update({
            title: title.trim(),
            body: body.trim(),
            mood: moodValue,
            tags: selectedTags,
          })
          .eq('id', editId)
          .eq('user_id', user.id)
        if (err) throw err
        void refreshProfile()
        navigate(`/inspiration/${editId}`, { replace: true })
        return
      }

      const { data, error: err } = await supabase
        .from('inspirations')
        .insert({
          user_id: user.id,
          title: title.trim(),
          body: body.trim(),
          mood: moodValue,
          tags: selectedTags,
        })
        .select('id')
        .single()

      if (err) throw err
      const newId = data?.id as string
      void refreshProfile()
      navigate(`/inspiration/${newId}`, { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!authLoading && !user) {
    return <Navigate to={redirectLogin} replace />
  }

  if (isEdit && loadingEdit) {
    return (
      <div className="stitch-shell stitch-shell--write min-h-screen flex items-center justify-center font-body-md text-on-surface">
        加载中…
      </div>
    )
  }

  if (isEdit && error && !title) {
    return (
      <div className="stitch-shell stitch-shell--write min-h-screen flex flex-col items-center justify-center gap-4 p-md">
        <p className="text-error">{error}</p>
        <Link to="/" className="text-primary underline">
          回首页
        </Link>
      </div>
    )
  }

  return (
    <div className="stitch-shell stitch-shell--write bg-background text-on-background min-h-screen flex flex-col font-body-md">
      <div className="noise-overlay" />
      <header className="bg-orange-50 dark:bg-stone-900 text-lime-800 dark:text-lime-400 font-serif italic tracking-tight border-b-2 border-dashed border-stone-300 dark:border-stone-700 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] flex justify-between items-center w-full px-6 py-4 sticky top-0 z-50">
        <Link to="/" className="text-2xl font-bold text-lime-900 dark:text-lime-100 italic">
          灵感随手记
        </Link>
        <div className="flex items-center gap-6">
          <span className="text-lime-700 dark:text-lime-300 underline decoration-wavy flex items-center gap-2">
            <span className="material-symbols-outlined">edit</span>
            <span>{isEdit ? '编辑灵感' : 'Write Inspiration'}</span>
          </span>
          <div className="flex gap-4 items-center">
            {user ? (
              <>
                <span className="text-label-sm max-w-[100px] truncate hidden sm:inline">{user.email}</span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="material-symbols-outlined hover:rotate-1 hover:scale-105 transition-all cursor-pointer bg-transparent border-0"
                  aria-label="退出"
                >
                  logout
                </button>
              </>
            ) : (
              <Link to={redirectLogin} className="material-symbols-outlined hover:rotate-1 hover:scale-105 transition-all cursor-pointer">
                person
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-margin-page py-xl max-w-4xl relative">
        <div className="absolute -left-12 top-24 opacity-20 hidden lg:block select-none pointer-events-none">
          <span className="material-symbols-outlined text-[120px] text-primary">potted_plant</span>
        </div>

        <div className="relative bg-surface-container-lowest shadow-xl rounded-lg p-md md:p-xl rotate-1 folded-corner border border-outline-variant min-h-[800px] flex flex-col">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-48 h-10 washi-tape shadow-sm z-10" />

          <div className="mb-lg border-b-2 border-dashed border-outline-variant pb-md">
            <h1 className="font-headline-xl text-headline-xl text-primary flex items-center gap-4">
              {isEdit ? '编辑此刻灵感' : '记录此刻灵感'}
              <span className="material-symbols-outlined text-4xl">auto_awesome</span>
            </h1>
            <p className="font-headline-md text-headline-md text-secondary opacity-70 italic">像在便签本上画小花一样自由...</p>
          </div>

          {error && title ? <p className="text-error text-body-md mb-md">{error}</p> : null}

          <form className="space-y-lg flex-grow" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-sm">
              <label className="font-headline-md text-headline-md text-on-surface flex items-center gap-2" htmlFor="title">
                <span className="material-symbols-outlined">title</span>
                给这段灵感起个名字
              </label>
              <input
                id="title"
                className="w-full bg-transparent border-b-2 border-outline focus:border-primary-container focus:ring-0 font-headline-md text-headline-md py-xs px-0 transition-colors placeholder:opacity-30"
                maxLength={200}
                placeholder="捕捉闪现的想法..."
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <div className="text-right text-label-sm font-label-sm text-outline">
                {title.length} / 200
              </div>
            </div>

            <div className="space-y-sm relative">
              <label className="font-headline-md text-headline-md text-on-surface flex items-center gap-2" htmlFor="body">
                <span className="material-symbols-outlined">contract_edit</span>
                娓娓道来...
              </label>
              <div className="relative notebook-line rounded-lg overflow-hidden border border-outline-variant/30">
                <textarea
                  id="body"
                  className="w-full bg-transparent border-none focus:ring-0 font-body-lg text-body-lg p-md leading-[32px] resize-none"
                  placeholder="在这里自由地涂鸦、书写、记录任何让你心跳加速的事情..."
                  rows={12}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg items-start">
              <div className="space-y-sm">
                <label className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined">mood</span>
                  此刻的心情
                </label>
                <div className="relative">
                  <select
                    className="w-full sketchy-border bg-surface-container-low font-body-md text-body-md py-sm px-md appearance-none cursor-pointer focus:ring-primary focus:border-primary"
                    value={mood}
                    onChange={(e) => setMood(e.target.value as MoodKey)}
                  >
                    <option value="happy">Happy (充满阳光)</option>
                    <option value="calm">Calm (如水宁静)</option>
                    <option value="excited">Excited (心潮澎湃)</option>
                    <option value="tired">Tired (需要小憩)</option>
                    <option value="sad">Sad (淡淡忧伤)</option>
                    <option value="anxious">Anxious (有点急躁)</option>
                    <option value="other">Other (难以言喻)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none flex gap-2 items-center">
                    <span className="material-symbols-outlined text-tertiary">sentiment_very_satisfied</span>
                    <span className="material-symbols-outlined text-outline">expand_more</span>
                  </div>
                </div>
                {mood === 'other' ? (
                  <input
                    className="mt-sm w-full sketchy-border bg-surface-container-low font-body-md py-sm px-md"
                    placeholder="描述你的心情…"
                    value={moodOther}
                    onChange={(e) => setMoodOther(e.target.value)}
                    maxLength={80}
                  />
                ) : null}
              </div>

              <div className="space-y-sm">
                <label className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined">label</span>
                  灵感标签 (最多3个)
                </label>
                <div className="flex flex-wrap gap-base">
                  {PRESET_TAGS.map((t) => {
                    const on = selectedTags.includes(t)
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => togglePresetTag(t)}
                        className={`px-md py-xs sketchy-border font-label-sm text-label-sm hover:rotate-1 transition-transform ${
                          on
                            ? 'bg-primary-container text-on-primary-container'
                            : 'bg-surface-container-high text-on-surface'
                        }`}
                      >
                        # {t}
                      </button>
                    )
                  })}
                </div>
                {tagHistory.length > 0 ? (
                  <p className="text-label-sm text-outline">常用：{tagHistory.slice(0, 8).join('、')}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 items-center">
                  {selectedTags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-md py-xs bg-primary-fixed text-on-surface rounded-full text-label-sm">
                      #{t}
                      <button type="button" className="border-0 bg-transparent cursor-pointer p-0 leading-none" onClick={() => removeTag(t)} aria-label={`移除 ${t}`}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    className="flex-1 min-w-[120px] border-b-2 border-dashed border-outline-variant bg-transparent py-xs px-xs font-body-md"
                    placeholder="新标签（1–20 字）"
                    value={customDraft}
                    onChange={(e) => setCustomDraft(e.target.value)}
                    maxLength={20}
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    className="flex items-center gap-1 px-md py-xs border-2 border-dashed border-outline-variant rounded-full text-outline font-label-sm text-label-sm hover:bg-surface-dim transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    添加
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-lg flex items-center justify-between">
              <div className="flex gap-4">
                <div className="w-24 h-24 rotate-[-6deg] sketchy-border overflow-hidden bg-white shadow-md p-1">
                  <img
                    alt=""
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkQRfg5OIx5ZFWCGnLIhMS1tjjm-8i3PHCA9Ew8Ej1eVYOseIpoJALNLXwhqFV5w0HfppsiVGPvoW3C8t3v2onHwilCHRoiJZZtp9Haua4wgKCtK5tiEKbUC5ZEPN_XRY-fvbKom8viVZ2xAn-Rh5Xlpn2wum-3nHESWL9StNTEMrovoH0nAbFxa9tATYNA8m2HuWvmDiO_bfTVG0XEYT0qe_4Qodvmyhm26E1z9cqYoZTgKht0qceAtOtMIP1XxfnL82iGJ2o2r8"
                  />
                </div>
                <div className="w-24 h-24 rotate-[8deg] sketchy-border overflow-hidden bg-white shadow-md p-1">
                  <img
                    alt=""
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuChLZstqi6S4X8dGnKXiRkmNTah42c8Jz66HHOFRkoks46Q2dcmaPp3yHQ8ssqszKFpPGD2mZeLJ6Gih3Umc3oFN0an5-oXccoMff8zWYX66VxUTwrGqelKPQYKtOGQ3beKRLOjTI__8m_SRsCkj94ZTfk8htaMmOBE3Ya-nYfcdc85PPvt4K0JlbSdHZZsyL3nTE5E9k0ZFivX5aOapfT755950EIxs1CcFAVWcNw83q8ako1-XBCU66oEqaLZVMHXgQ05hM0e41A"
                  />
                </div>
              </div>
              <div className="flex gap-md">
                <Link
                  to={isEdit && editId ? `/inspiration/${editId}` : '/'}
                  className="font-headline-md text-headline-md text-secondary border-2 border-dashed border-outline-variant px-xl py-base rounded-lg hover:bg-surface-dim transition-all active:scale-95 inline-flex items-center justify-center"
                >
                  取消
                </Link>
                <button
                  className="font-headline-md text-headline-md text-white bg-primary px-xl py-base hand-oval shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all active:translate-y-0 flex items-center gap-2 disabled:opacity-50"
                  type="submit"
                  disabled={submitting || !canSubmit}
                >
                  <span className="material-symbols-outlined">draw</span>
                  {submitting ? '保存中…' : isEdit ? '保存修改' : '记录这份灵感'}
                </button>
              </div>
            </div>
          </form>

          <div className="absolute bottom-4 right-4 text-outline-variant select-none">
            <span className="material-symbols-outlined text-4xl">eco</span>
          </div>
        </div>
      </main>

      <footer className="w-full flex flex-col items-center justify-center pt-12 pb-8 px-4 gap-4 bg-orange-100/50 dark:bg-stone-950/50 text-lime-800 dark:text-lime-400 font-serif text-sm italic border-t-2 border-stone-300 dark:border-stone-700 border-dashed rounded-t-[100px_20px]">
        <div className="text-lg font-medium text-stone-700 dark:text-stone-300">灵感随手记</div>
        <div className="flex gap-8">
          <span className="material-symbols-outlined hover:translate-y-[-4px] transition-transform duration-300 cursor-pointer">edit</span>
          <span className="material-symbols-outlined hover:translate-y-[-4px] transition-transform duration-300 cursor-pointer">coffee</span>
          <span className="material-symbols-outlined hover:translate-y-[-4px] transition-transform duration-300 cursor-pointer">light_mode</span>
          <span className="material-symbols-outlined hover:translate-y-[-4px] transition-transform duration-300 cursor-pointer">cloud</span>
        </div>
        <div className="mt-4 text-stone-500 opacity-80">✧ 随手记下灵感，像在便签本上画小花 ✧</div>
      </footer>

      <div className="fixed bottom-12 right-12 text-primary opacity-30 pointer-events-none -z-10 animate-bounce">
        <span className="material-symbols-outlined text-[80px]">brush</span>
      </div>
    </div>
  )
}
