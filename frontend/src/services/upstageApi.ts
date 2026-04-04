/**
 * Upstage Solar AI — API helpers
 * Vite 개발 서버 프록시를 통해 CORS 우회:
 *   /api/upstage/* → https://api.upstage.ai/*
 */

const PROXY_BASE = '/api/upstage'

/** v1 — Chat Completions (solar-pro3 스트리밍) */
export const UPSTAGE_V1 = `${PROXY_BASE}/v1`

export const DEFAULT_MODEL   = 'solar-pro3'
export const DEFAULT_API_KEY = 'up_MndWRko5jPYRD8h2Wopvtu2GK1gqV'

/** SSE 스트리밍으로 Chat Completion 호출
 *  - onChunk : 토큰 도착 시마다 호출
 *  - 완료/에러 시 resolve/reject
 */
export async function streamChatCompletion(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  model: string,
  apiKey: string,
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch(`${UPSTAGE_V1}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      reasoning_effort: 'high',
      stream: true,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `API 오류 (HTTP ${res.status})`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''   // 마지막 미완성 줄은 다음 청크로

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return

      try {
        const json = JSON.parse(data)
        const content = json.choices?.[0]?.delta?.content
        if (content) onChunk(content)
      } catch {
        // 파싱 실패 줄은 무시
      }
    }
  }
}
