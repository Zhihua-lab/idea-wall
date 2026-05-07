import { normalizeInspirationImages, removeInspirationImagesFromStorage } from './inspirationStorage'
import { supabase } from './supabaseClient'
import type { InspirationRow, InspirationWithAuthor, UserProfileRow } from '../types/database'

export async function fetchProfilesByUserIds(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(userIds)].filter(Boolean)
  if (unique.length === 0) return map

  const { data, error } = await supabase.from('user_profiles').select('user_id, nickname').in('user_id', unique)

  if (error) throw error
  for (const row of data ?? []) {
    map.set((row as UserProfileRow).user_id, (row as UserProfileRow).nickname)
  }
  return map
}

export async function fetchInspirationsList(tag?: string | null): Promise<InspirationWithAuthor[]> {
  let q = supabase.from('inspirations').select('*').order('created_at', { ascending: false }).limit(50)

  if (tag) {
    q = q.contains('tags', [tag])
  }

  const { data: rows, error } = await q
  if (error) throw error
  const list = (rows ?? []) as InspirationRow[]
  const nick = await fetchProfilesByUserIds(list.map((r) => r.user_id))

  return list.map((r) => ({
    ...r,
    nickname: nick.get(r.user_id) ?? '用户',
  }))
}

const PROFILE_INSPIRATION_LIMIT = 100

/** 某用户发布的灵感（倒序），可选标签筛选；用于个人主页。 */
export async function fetchInspirationsByUserId(
  userId: string,
  tag?: string | null,
): Promise<InspirationWithAuthor[]> {
  let q = supabase
    .from('inspirations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(PROFILE_INSPIRATION_LIMIT)

  if (tag) {
    q = q.contains('tags', [tag])
  }

  const { data: rows, error } = await q
  if (error) throw error
  const list = (rows ?? []) as InspirationRow[]
  if (list.length === 0) return []

  const nickMap = await fetchProfilesByUserIds([userId])
  const nickname = nickMap.get(userId) ?? '用户'

  return list.map((r) => ({
    ...r,
    nickname,
  }))
}

export async function fetchUserInspirationStats(userId: string): Promise<{ count: number; earliestAt: string | null }> {
  const { count, error: cErr } = await supabase
    .from('inspirations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (cErr) throw cErr

  const { data: first, error: fErr } = await supabase
    .from('inspirations')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (fErr) throw fErr

  return {
    count: count ?? 0,
    earliestAt: (first as { created_at?: string } | null)?.created_at ?? null,
  }
}

export async function fetchInspirationById(id: string): Promise<InspirationWithAuthor | null> {
  const { data, error } = await supabase.from('inspirations').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as InspirationRow
  const nick = await fetchProfilesByUserIds([row.user_id])
  return { ...row, nickname: nick.get(row.user_id) ?? '用户' }
}

export async function fetchMyLikeIds(userId: string, inspirationIds: string[]): Promise<Set<string>> {
  if (inspirationIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('likes')
    .select('inspiration_id')
    .eq('user_id', userId)
    .in('inspiration_id', inspirationIds)

  if (error) throw error
  return new Set((data ?? []).map((r: { inspiration_id: string }) => r.inspiration_id))
}

export async function fetchLikedForUser(userId: string, inspirationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('inspiration_id', inspirationId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export async function insertLike(userId: string, inspirationId: string): Promise<void> {
  const { error } = await supabase.from('likes').insert({ user_id: userId, inspiration_id: inspirationId })
  if (error) throw error
}

export async function deleteLike(userId: string, inspirationId: string): Promise<void> {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('inspiration_id', inspirationId)

  if (error) throw error
}

export async function deleteInspiration(id: string): Promise<void> {
  const { data, error: selErr } = await supabase.from('inspirations').select('images').eq('id', id).maybeSingle()
  if (selErr) throw selErr
  const images = normalizeInspirationImages(data?.images)
  const { error } = await supabase.from('inspirations').delete().eq('id', id)
  if (error) throw error
  if (images.length > 0) {
    try {
      await removeInspirationImagesFromStorage(images)
    } catch {
      /* 行已删；存储清理失败不阻塞用户 */
    }
  }
}

/** 作者从详情中删除单张图：先更新 DB，再删 Storage */
export async function removeOneInspirationImage(
  inspirationId: string,
  userId: string,
  imageUrl: string,
): Promise<string[]> {
  const { data, error: selErr } = await supabase
    .from('inspirations')
    .select('images')
    .eq('id', inspirationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (selErr) throw selErr
  const cur = normalizeInspirationImages(data?.images)
  const next = cur.filter((u) => u !== imageUrl)
  const { error: upErr } = await supabase
    .from('inspirations')
    .update({ images: next.length > 0 ? next : null })
    .eq('id', inspirationId)
    .eq('user_id', userId)
  if (upErr) throw upErr
  try {
    await removeInspirationImagesFromStorage([imageUrl])
  } catch {
    /* 已更新 DB */
  }
  return next
}
