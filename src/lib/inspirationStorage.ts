import { supabase } from './supabaseClient'

export const INSPIRATION_IMAGES_BUCKET = 'inspiration-images'

const supabaseBase = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/** 本地 / 局域网访问时无 Vercel `/api`，同源 /api/supabase-proxy 不存在，改写后图片会裂图 */
function isLocalOrLanHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h === '0.0.0.0') return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  return false
}

/**
 * 生产环境经同源代理访问 Storage 时，将「已保存的公开 object URL」改写为 `/api/supabase-proxy?p=/storage/v1/...`。
 * localhost / 局域网 IP 上不要改写——本地无该 API；设置 VITE_USE_SUPABASE_EDGE_PROXY=0 时保持直连。
 */
export function displayUrlForInspirationImage(stored: string): string {
  if (!stored) return stored
  if (stored.startsWith('/api/supabase-proxy')) return stored

  let pathname: string
  try {
    const u = new URL(stored)
    if (supabaseBase) {
      const origin = new URL(supabaseBase).origin
      const isSupabaseStorageUrl = u.hostname.endsWith('.supabase.co')
      if (u.origin !== origin && !(import.meta.env.PROD && isSupabaseStorageUrl)) return stored
    }
    pathname = u.pathname
  } catch {
    return stored
  }

  if (!pathname.startsWith('/storage/v1/object/public/')) return stored

  const proxyDisabled = import.meta.env.VITE_USE_SUPABASE_EDGE_PROXY === '0'
  const useProxy = import.meta.env.PROD && !proxyDisabled && !isLocalOrLanHost()
  if (useProxy) {
    return `/api/supabase-proxy?p=${encodeURIComponent(pathname)}`
  }
  return stored
}

/** 单张上限：留足 multipart overhead 余量，避免接近 Vercel 4.5MB body limit */
const MAX_BYTES = 3 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function normalizeInspirationImages(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 3)
  }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (t.startsWith('[')) {
      try {
        const p = JSON.parse(t) as unknown
        if (Array.isArray(p)) return normalizeInspirationImages(p)
      } catch {
        /* ignore */
      }
    }
    if (t.startsWith('http')) return [t].slice(0, 3)
  }
  return []
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return '仅支持 JPG / PNG / WebP 格式'
  if (file.size > MAX_BYTES) return '单张图片不能超过 3MB，请先压缩后再上传'
  return null
}

/** 用 canvas 压缩图片：最长边 1600px，JPEG quality 0.85；若仍超上限则逐步降级 */
export async function compressImageFile(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const maxDimension = 1600
      let width = img.width
      let height = img.height
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 canvas 上下文'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      const tryExport = (quality: number, dims: { w: number; h: number }): Promise<Blob | null> => {
        return new Promise((res) => {
          if (dims.w !== canvas.width || dims.h !== canvas.height) {
            const c = document.createElement('canvas')
            c.width = dims.w
            c.height = dims.h
            const x = c.getContext('2d')
            if (!x) { res(null); return }
            x.drawImage(img, 0, 0, dims.w, dims.h)
            c.toBlob((b) => res(b), 'image/jpeg', quality)
          } else {
            canvas.toBlob((b) => res(b), 'image/jpeg', quality)
          }
        })
      }

      const run = async () => {
        const qualities = [0.85, 0.7, 0.5, 0.3]
        const dimensions = [
          { w: width, h: height },
          { w: Math.round(width * 0.75), h: Math.round(height * 0.75) },
          { w: Math.round(width * 0.5), h: Math.round(height * 0.5) },
        ]

        for (const dims of dimensions) {
          for (const q of qualities) {
            const blob = await tryExport(q, dims)
            if (blob && blob.size <= MAX_BYTES) {
              const name = safeFileStem(file.name) + '.jpg'
              resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }))
              return
            }
          }
        }

        // 最后尝试最小尺寸
        const minW = Math.max(1, Math.round(width * 0.3))
        const minH = Math.max(1, Math.round(height * 0.3))
        const finalBlob = await tryExport(0.3, { w: minW, h: minH })
        if (finalBlob && finalBlob.size <= MAX_BYTES) {
          const name = safeFileStem(file.name) + '.jpg'
          resolve(new File([finalBlob], name, { type: 'image/jpeg', lastModified: Date.now() }))
          return
        }

        reject(new Error('图片压缩后仍超过 3MB，请手动压缩后再上传'))
      }

      void run()
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法读取图片'))
    }

    img.src = url
  })
}

/**
 * 移动端（尤其 iOS）在清空 file input 后，原 FileList 里的引用可能失效或异常；
 * 上传前读入内存并 new File，避免「多选只成功传一张」。
 */
export async function cloneFileForUpload(file: File): Promise<File> {
  const buf = await file.arrayBuffer()
  return new File([buf], file.name, {
    type: file.type || 'application/octet-stream',
    lastModified: file.lastModified,
  })
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
