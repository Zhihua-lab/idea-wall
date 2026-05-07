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
