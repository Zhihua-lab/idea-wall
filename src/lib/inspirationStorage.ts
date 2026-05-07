import { supabase } from './supabaseClient'

export const INSPIRATION_IMAGES_BUCKET = 'inspiration-images'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function normalizeInspirationImages(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 3)
  return []
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return '仅支持 JPG / PNG / WebP 格式'
  if (file.size > MAX_BYTES) return '单张图片不能超过 5MB，请先压缩后再上传'
  return null
}

function pickExtension(file: File): string {
  if (file.type === 'image/png') return '.png'
  if (file.type === 'image/webp') return '.webp'
  return '.jpg'
}

function safeFileStem(original: string): string {
  const base = original.replace(/\.[^/.]+$/, '').slice(0, 40)
  const cleaned = base.replace(/[^\w\u4e00-\u9fff-]+/g, '_').replace(/_+/g, '_')
  return cleaned || 'image'
}

/** 上传路径：{user_id}/{inspiration_id}/{timestamp}_{stem}_{rand}.ext */
export async function uploadInspirationImage(userId: string, inspirationId: string, file: File): Promise<string> {
  const err = validateImageFile(file)
  if (err) throw new Error(err)
  const stem = safeFileStem(file.name)
  const name = `${Date.now()}_${stem}_${Math.random().toString(36).slice(2, 8)}${pickExtension(file)}`
  const path = `${userId}/${inspirationId}/${name}`

  const { error } = await supabase.storage.from(INSPIRATION_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from(INSPIRATION_IMAGES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** 从公开 URL 解析出 Storage 对象 path（不含 bucket） */
export function storagePathFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const marker = `/object/public/${INSPIRATION_IMAGES_BUCKET}/`
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(u.pathname.slice(idx + marker.length))
  } catch {
    return null
  }
}

export async function removeInspirationImagesFromStorage(urls: string[]): Promise<void> {
  const paths = [...new Set(urls.map(storagePathFromPublicUrl).filter((p): p is string => Boolean(p)))]
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(INSPIRATION_IMAGES_BUCKET).remove(paths)
  if (error) throw error
}
