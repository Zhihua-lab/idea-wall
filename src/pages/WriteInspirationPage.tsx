import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { fetchInspirationById } from '../lib/inspirationsApi'
import {
  cloneFileForUpload,
  compressImageFile,
  displayUrlForInspirationImage,
  normalizeInspirationImages,
  removeInspirationImagesFromStorage,
  uploadInspirationImage,
  validateImageFile,
} from '../lib/inspirationStorage'
import { supabase } from '../lib/supabaseClient'
import { PRESET_TAGS } from '../lib/presetTags'

const PRESET_MOODS = ['happy', 'calm', 'excited', 'tired', 'sad', 'anxious', 'other'] as const
type MoodKey = (typeof PRESET_MOODS)[number]

type PendingImage = { file: File; preview: string }

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
  const [remoteImageUrls, setRemoteImageUrls] = useState<string[]>([])
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [removedRemoteUrls, setRemovedRemoteUrls] = useState<string[]>([])
  const [imageBusy, setImageBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingRef = useRef(pendingImages)
  pendingRef.current = pendingImages
  const remoteUrlsRef = useRef(remoteImageUrls)
  remoteUrlsRef.current = remoteImageUrls
  const pendingImagesRef = useRef(pendingImages)
  pendingImagesRef.current = pendingImages

  const tagHistory = useMemo(() => (user ? readTagHistory(user.id) : []), [user])
  const imageSlotCount = remoteImageUrls.length + pendingImages.length

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
      setRemoteImageUrls(normalizeInspirationImages(row.images))
      setPendingImages([])
      setRemovedRemoteUrls([])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoadingEdit(false)
    }
  }, [editId, user])

  useEffect(() => {
    if (isEdit) void loadEdit()
  }, [isEdit, loadEdit])

  useEffect(() => {
    return () => {
      pendingRef.current.forEach(revokePendingPreview)
    }
  }, [])

  const redirectLogin = `/login?redirect=${encodeURIComponent(isEdit && editId ? `/inspiration/${editId}/edit` : '/new')}`

  const resolvedMood = mood === 'other' ? moodOther.trim() : mood
  const canSubmit =
    title.trim().length > 0 &&
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

  const revokePendingPreview = (p: PendingImage) => {
    try {
      URL.revokeObjectURL(p.preview)
    } catch {
      /* ignore */
    }
  }

  const removeRemoteSlot = (url: string) => {
    setRemoteImageUrls((prev) => prev.filter((u) => u !== url))
    setRemovedRemoteUrls((prev) => [...prev, url])
  }

  const removePendingSlot = (idx: number) => {
    setPendingImages((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      const removed = prev[idx]
      if (removed) revokePendingPreview(removed)
      return next
    })
  }

  const onImageFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    void (async () => {
      const raw = e.target.files
      const list = raw ? Array.from(raw) : []
      if (list.length === 0) return

      const prepared: PendingImage[] = []
      try {
        for (const file of list) {
          const msg = validateImageFile(file)
          if (msg) {
            setError(msg)
            continue
          }
          try {
            // 大于 1MB 的图片先 canvas 压缩（最长边 1600px / JPEG），小图直接读入内存
            const stable =
              file.size > 1 * 1024 * 1024 ? await compressImageFile(file) : await cloneFileForUpload(file)
            prepared.push({ file: stable, preview: URL.createObjectURL(stable) })
          } catch {
            setError('无法读取某张图片，请换一张或压缩后重试')
          }
        }
      } catch {
        setError('读取相册文件失败，请重试')
      }

      e.target.value = ''

      if (prepared.length === 0) return

      setPendingImages((prevPending) => {
        let cur = remoteUrlsRef.current.length + prevPending.length
        const toAdd: PendingImage[] = []
        for (const p of prepared) {
          if (cur >= 3) {
            setError('最多只能添加 3 张图片')
            revokePendingPreview(p)
            break
          }
          toAdd.push(p)
          cur += 1
        }
        if (toAdd.length > 0) setError(null)
        return [...prevPending, ...toAdd]
      })
    })()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !canSubmit) return
    setSubmitting(true)
    setImageBusy(true)
    setError(null)
    try {
      const moodValue = resolvedMood
      if (isEdit && editId) {
        if (removedRemoteUrls.length > 0) {
          try {
            await removeInspirationImagesFromStorage(removedRemoteUrls)
          } catch {
            setError('移除旧图片失败，请稍后重试')
            return
          }
        }
        const uploadQueue = [...pendingImagesRef.current]
        const uploaded: string[] = []
        for (const p of uploadQueue) {
          uploaded.push(await uploadInspirationImage(user.id, editId, p.file))
        }
        const finalImages = [...remoteImageUrls, ...uploaded].slice(0, 3)
        const { error: err } = await supabase
          .from('inspirations')
          .update({
            title: title.trim(),
            body: body.trim(),
            mood: moodValue,
            tags: selectedTags,
            images: finalImages.length > 0 ? finalImages : null,
          })
          .eq('id', editId)
          .eq('user_id', user.id)
        if (err) throw err
        uploadQueue.forEach(revokePendingPreview)
        setPendingImages([])
        setRemovedRemoteUrls([])
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
      const uploadQueue = [...pendingImagesRef.current]
      if (uploadQueue.length > 0) {
        const uploaded: string[] = []
        for (const p of uploadQueue) {
          uploaded.push(await uploadInspirationImage(user.id, newId, p.file))
        }
        const { error: upErr } = await supabase
          .from('inspirations')
          .update({ images: uploaded.slice(0, 3) })
          .eq('id', newId)
        if (upErr) throw upErr
      }
      uploadQueue.forEach(revokePendingPreview)
      setPendingImages([])
      void refreshProfile()
      navigate(`/inspiration/${newId}`, { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSubmitting(false)
      setImageBusy(false)
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

      <main className="relative container mx-auto max-w-4xl flex-grow px-margin-page py-xl pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
        <div className="absolute -left-12 top-24 opacity-20 hidden lg:block select-none pointer-events-none">
          <span className="material-symbols-outlined text-[120px] text-primary">potted_plant</span>
        </div>

        <div className="relative flex min-h-0 flex-col rounded-lg border border-outline-variant bg-surface-container-lowest p-md shadow-xl md:min-h-[720px] md:p-xl rotate-1 folded-corner">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-48 h-10 washi-tape shadow-sm z-10" />

          <div className="mb-lg border-b-2 border-dashed border-outline-variant pb-md pr-1 sm:pr-0">
            <h1 className="flex max-sm:flex-col max-sm:items-start max-sm:gap-1.5 sm:items-center sm:gap-3 md:gap-4 text-primary">
              <span className="font-headline-xl text-headline-xl max-sm:whitespace-nowrap max-sm:text-[clamp(1.05rem,5.2vw,1.45rem)] max-sm:leading-tight max-sm:tracking-tight">
                {isEdit ? '编辑此刻灵感' : '记录此刻灵感'}
              </span>
              <span className="material-symbols-outlined shrink-0 text-3xl sm:text-4xl max-sm:opacity-90">auto_awesome</span>
            </h1>
            <p className="font-headline-md mt-2 max-sm:mt-1.5 max-sm:whitespace-nowrap max-sm:text-[clamp(0.8125rem,3.6vw,0.9375rem)] max-sm:leading-snug max-sm:tracking-tight sm:mt-2 text-headline-md text-secondary opacity-70 italic">
              像在便签本上画小花一样自由…
            </p>
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
                  placeholder="在这里自由书写、记录、涂鸦吧！"
                  rows={12}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-sm rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low/40 p-md">
              <label className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined">photo_library</span>
                配图（最多 3 张，可选）
              </label>
              <p className="text-label-sm text-outline">支持 JPG / PNG / WebP，单张不超过 3MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                aria-label="选择配图文件"
                onChange={onImageFilesSelected}
              />
              <div className="flex flex-wrap gap-3">
                {remoteImageUrls.map((url) => (
                  <div key={url} className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-outline-variant bg-white shadow-sm">
                    <img src={displayUrlForInspirationImage(url)} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-outline-variant bg-surface-container-high/95 text-on-surface shadow-sm hover:bg-error-container/40"
                      aria-label="移除图片"
                      onClick={() => removeRemoteSlot(url)}
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ))}
                {pendingImages.map((p, idx) => (
                  <div key={p.preview} className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-outline-variant bg-white shadow-sm">
                    <img src={p.preview} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-outline-variant bg-surface-container-high/95 text-on-surface shadow-sm hover:bg-error-container/40"
                      aria-label="移除待上传图片"
                      onClick={() => removePendingSlot(idx)}
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ))}
              </div>
              {imageSlotCount < 3 ? (
                <button
                  type="button"
                  disabled={submitting || imageBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-primary/50 px-md py-sm font-label-sm text-primary transition-colors hover:bg-primary-fixed-dim/30 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">add_photo_alternate</span>
                  选择图片
                </button>
              ) : null}
              {imageBusy ? <p className="text-label-sm text-secondary">正在上传图片，请稍候…</p> : null}
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

            <div className="flex flex-col gap-6 pt-lg sm:flex-row sm:items-end sm:justify-between">
              <div className="flex shrink-0 justify-center gap-4 sm:justify-start">
                <div className="h-24 w-24 rotate-[-6deg] overflow-hidden bg-white p-1 shadow-md sketchy-border">
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkQRfg5OIx5ZFWCGnLIhMS1tjjm-8i3PHCA9Ew8Ej1eVYOseIpoJALNLXwhqFV5w0HfppsiVGPvoW3C8t3v2onHwilCHRoiJZZtp9Haua4wgKCtK5tiEKbUC5ZEPN_XRY-fvbKom8viVZ2xAn-Rh5Xlpn2wum-3nHESWL9StNTEMrovoH0nAbFxa9tATYNA8m2HuWvmDiO_bfTVG0XEYT0qe_4Qodvmyhm26E1z9cqYoZTgKht0qceAtOtMIP1XxfnL82iGJ2o2r8"
                  />
                </div>
                <div className="h-24 w-24 rotate-[8deg] overflow-hidden bg-white p-1 shadow-md sketchy-border">
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuChLZstqi6S4X8dGnKXiRkmNTah42c8Jz66HHOFRkoks46Q2dcmaPp3yHQ8ssqszKFpPGD2mZeLJ6Gih3Umc3oFN0an5-oXccoMff8zWYX66VxUTwrGqelKPQYKtOGQ3beKRLOjTI__8m_SRsCkj94ZTfk8htaMmOBE3Ya-nYfcdc85PPvt4K0JlbSdHZZsyL3nTE5E9k0ZFivX5aOapfT755950EIxs1CcFAVWcNw83q8ako1-XBCU66oEqaLZVMHXgQ05hM0e41A"
                  />
                </div>
              </div>
              <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:flex-none sm:gap-md">
                <Link
                  to={isEdit && editId ? `/inspiration/${editId}` : '/'}
                  className="inline-flex w-full items-center justify-center rounded-lg border-2 border-dashed border-outline-variant px-xl py-base text-center font-headline-md text-headline-md text-secondary transition-all hover:bg-surface-dim active:scale-95 sm:w-auto"
                >
                  取消
                </Link>
                <button
                  className="hand-oval inline-flex w-full items-center justify-center gap-2 bg-primary px-xl py-base text-center font-headline-md text-headline-md text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl active:translate-y-0 disabled:opacity-50 sm:w-auto"
                  type="submit"
                  disabled={submitting || imageBusy || !canSubmit}
                >
                  <span className="material-symbols-outlined">draw</span>
                  {imageBusy
                    ? '上传图片中…'
                    : submitting
                      ? '保存中…'
                      : isEdit
                        ? '保存修改'
                        : '记录这份灵感'}
                </button>
              </div>
            </div>
          </form>

          <div className="absolute bottom-4 right-4 hidden text-outline-variant select-none sm:block">
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
