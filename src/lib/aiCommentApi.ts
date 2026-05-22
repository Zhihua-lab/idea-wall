import { supabase } from './supabaseClient'
import { MAX_COMMENT_LENGTH } from './commentsApi'

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

export async function generateAiComment(input: GenerateAiCommentInput): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('请先登录后再使用 AI 评论')
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), AI_COMMENT_TIMEOUT_MS)

  try {
    const response = await fetch('/api/ai-comment', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
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
