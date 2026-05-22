import { supabase } from './supabaseClient'
import { MAX_COMMENT_LENGTH } from './commentsApi'
import type { CommentRow } from '../types/database'

const AI_COMMENT_TIMEOUT_MS = 30000

export type GenerateAiCommentInput = {
  title: string
  body: string
  mood: string
  tags: string[]
}

type AiCommentResponse = {
  comment?: string
  error?: string
}

type PublishAiCommentResponse = {
  comment?: CommentRow
  error?: string
}

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('请先登录后再使用 AI 评论')
  }
  return session.access_token
}

export async function generateAiComment(input: GenerateAiCommentInput): Promise<string> {
  const accessToken = await getAccessToken()

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), AI_COMMENT_TIMEOUT_MS)

  try {
    const response = await fetch('/api/ai-comment', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'generate', ...input }),
      signal: controller.signal,
    })
    const data = (await response.json().catch(() => ({}))) as AiCommentResponse

    if (!response.ok) {
      throw new Error(data.error || 'AI 评论生成失败，请稍后再试')
    }

    const comment = data.comment?.trim()
    if (!comment) {
      throw new Error('AI 没有生成有效评论，请再试一次')
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      return comment.slice(0, MAX_COMMENT_LENGTH)
    }
    return comment
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('AI 评论生成超时，请稍后再试')
    }
    throw e
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function publishAiComment(inspirationId: string, content: string): Promise<CommentRow> {
  const accessToken = await getAccessToken()
  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('小满还没有生成有效评论')
  }

  const response = await fetch('/api/ai-comment', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'publish',
      inspirationId,
      content: trimmed.slice(0, MAX_COMMENT_LENGTH),
    }),
  })
  const data = (await response.json().catch(() => ({}))) as PublishAiCommentResponse

  if (!response.ok) {
    throw new Error(data.error || '小满评论发布失败，请稍后再试')
  }
  if (!data.comment) {
    throw new Error('小满评论发布失败，请稍后再试')
  }
  return data.comment
}
