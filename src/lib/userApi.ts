import { supabase } from './supabaseClient'
import type { UserProfileRow } from '../types/database'

export async function getUserProfile(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, nickname, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as UserProfileRow | null
}

export async function updateNickname(userId: string, nickname: string): Promise<void> {
  const trimmed = nickname.trim()
  if (!trimmed) throw new Error('昵称不能为空')
  if (trimmed.length > 32) throw new Error('昵称最多 32 个字符')
  const { error } = await supabase.from('user_profiles').update({ nickname: trimmed }).eq('user_id', userId)
  if (error) throw error
}
