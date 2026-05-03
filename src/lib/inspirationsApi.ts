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
  const { error } = await supabase.from('inspirations').delete().eq('id', id)
  if (error) throw error
}
