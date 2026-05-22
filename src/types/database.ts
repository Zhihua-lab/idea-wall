export type InspirationRow = {
  id: string
  user_id: string
  title: string
  body: string
  mood: string
  tags: string[]
  /** 公开图片 URL，最多 3 张；无图时为 null / [] / 缺列(undefined) */
  images?: string[] | null
  likes_count: number
  comments_count: number
  is_edited: boolean
  created_at: string
  updated_at: string
}

export type UserProfileRow = {
  user_id: string
  nickname: string
  updated_at: string
}

export type InspirationWithAuthor = InspirationRow & {
  nickname: string
}

export type CommentRow = {
  id: string
  inspiration_id: string
  user_id: string
  content: string
  is_ai_generated?: boolean
  ai_display_name?: string | null
  requested_by_user_id?: string | null
  created_at: string
  updated_at: string
}

export type CommentWithNickname = CommentRow & {
  nickname: string
  requested_by_nickname?: string | null
}
