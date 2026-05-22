import { supabase } from './supabaseClient'
import type { CommentRow, CommentWithNickname, UserProfileRow } from '../types/database'

export const MAX_COMMENT_LENGTH = 500
export const EDIT_WINDOW_MINUTES = 10

export function canEditComment(comment: CommentRow, userId: string | undefined): boolean {
  if (comment.is_ai_generated) return false
  if (!userId || comment.user_id !== userId) return false
  const created = new Date(comment.created_at).getTime()
  const elapsed = Date.now() - created
  return elapsed < EDIT_WINDOW_MINUTES * 60 * 1000
}

export async function fetchCommentsByInspirationId(inspirationId: string): Promise<CommentWithNickname[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('inspiration_id', inspirationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  const rows = (data ?? []) as CommentRow[]
  if (rows.length === 0) return []

  const userIds = [
    ...new Set(
      rows.flatMap((r) => [r.user_id, r.requested_by_user_id]).filter((id): id is string => Boolean(id)),
    ),
  ]
  const { data: profiles, error: pErr } = await supabase
    .from('user_profiles')
    .select('user_id, nickname')
    .in('user_id', userIds)

  if (pErr) throw pErr
  const nickMap = new Map<string, string>()
  for (const p of (profiles ?? []) as UserProfileRow[]) {
    nickMap.set(p.user_id, p.nickname)
  }

  return rows.map((r) => ({
    ...r,
    nickname: r.is_ai_generated ? (r.ai_display_name ?? '小i') : (nickMap.get(r.user_id) ?? '用户'),
    requested_by_nickname: r.requested_by_user_id ? (nickMap.get(r.requested_by_user_id) ?? '用户') : null,
  }))
}

export async function insertComment(
  userId: string,
  inspirationId: string,
  content: string,
): Promise<CommentRow> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('评论内容不能为空')
  if (trimmed.length > MAX_COMMENT_LENGTH) throw new Error(`评论不能超过 ${MAX_COMMENT_LENGTH} 字`)

  const { data, error } = await supabase
    .from('comments')
    .insert({ user_id: userId, inspiration_id: inspirationId, content: trimmed })
    .select()
    .single()

  if (error) throw error
  return data as CommentRow
}

export async function updateComment(
  commentId: string,
  userId: string,
  content: string,
): Promise<CommentRow> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('评论内容不能为空')
  if (trimmed.length > MAX_COMMENT_LENGTH) throw new Error(`评论不能超过 ${MAX_COMMENT_LENGTH} 字`)

  const { data, error } = await supabase
    .from('comments')
    .update({ content: trimmed, updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data as CommentRow
}

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('user_id', userId)
  if (error) throw error
}
