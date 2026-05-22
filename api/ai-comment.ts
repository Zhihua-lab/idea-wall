import type { VercelRequest, VercelResponse } from '@vercel/node'

const KIMI_CHAT_COMPLETIONS_URL = 'https://api.moonshot.cn/v1/chat/completions'
const KIMI_MODEL = 'kimi-k2.6'
const MAX_COMMENT_LENGTH = 500
const MAX_BODY_LENGTH = 4000

type AiCommentRequest = {
  title?: unknown
  body?: unknown
  mood?: unknown
  tags?: unknown
}

type KimiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  error?: {
    message?: string
  }
}

type PromptInput = {
  title: string
  body: string
  mood: string
  tags: string[]
}

function asTrimmedString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)
}

function normalizeComment(raw: string): string {
  return raw
    .replace(/^["“”'「」]+|["“”'「」]+$/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_COMMENT_LENGTH)
}

function supabaseCredentials(): { base: string; anon: string } | null {
  const base = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!base || !anon) return null
  return { base, anon }
}

async function isValidSupabaseSession(accessToken: string): Promise<boolean> {
  const cred = supabaseCredentials()
  if (!cred) {
    throw new Error('Missing Supabase env on server')
  }

  const response = await fetch(`${cred.base}/auth/v1/user`, {
    headers: {
      apikey: cred.anon,
      authorization: `Bearer ${accessToken}`,
    },
  })
  return response.ok
}

function buildUserPrompt(input: PromptInput): string {
  const tags = input.tags.length > 0 ? input.tags.map((tag) => `#${tag}`).join(' ') : '无'
  return [
    `标题：${input.title}`,
    `正文：${input.body}`,
    `心情：${input.mood || '未填写'}`,
    `标签：${tags}`,
  ].join('\n')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const authorization = req.headers.authorization
    const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : ''
    if (!accessToken) {
      res.status(401).json({ error: '请先登录后再使用 AI 评论' })
      return
    }

    if (!(await isValidSupabaseSession(accessToken))) {
      res.status(401).json({ error: '登录状态已失效，请重新登录后再试' })
      return
    }

    const apiKey = process.env.MOONSHOT_API_KEY
    if (!apiKey) {
      res.status(500).json({ error: 'AI 评论暂未配置，请稍后再试' })
      return
    }

    const payload = (req.body ?? {}) as AiCommentRequest
    const title = asTrimmedString(payload.title, 120)
    const body = asTrimmedString(payload.body, MAX_BODY_LENGTH)
    const mood = asTrimmedString(payload.mood, 80)
    const tags = asTags(payload.tags)

    if (!title || !body) {
      res.status(400).json({ error: '缺少生成评论所需的标题或正文' })
      return
    }

    const upstream = await fetch(KIMI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        temperature: 0.82,
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content:
              '你是一个灵感墙里的真实朋友。请只根据用户给出的标题、正文、心情和标签写一条中文评论。评论要短、具体、有温度，像认真读完后的自然回应；开心轻松的内容可以俏皮一点，低落脆弱的内容要贴心克制。不要说教，不要像客服，不要提到 AI，不要编造原文没有的信息。输出 1 到 3 句话，不超过 500 字，只输出评论正文。',
          },
          {
            role: 'user',
            content: buildUserPrompt({ title, body, mood, tags }),
          },
        ],
      }),
    })

    const data = (await upstream.json().catch(() => ({}))) as KimiChatResponse
    if (!upstream.ok) {
      res.status(upstream.status >= 500 ? 502 : upstream.status).json({
        error: data.error?.message || 'AI 评论生成失败，请稍后再试',
      })
      return
    }

    const comment = normalizeComment(data.choices?.[0]?.message?.content ?? '')
    if (!comment) {
      res.status(502).json({ error: 'AI 没有生成有效评论，请再试一次' })
      return
    }

    res.status(200).json({ comment })
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: 'AI 评论生成失败，请稍后再试', detail })
  }
}
