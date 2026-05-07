// iM BRIDGE 멀티에이전트 API — /api/bridge/sales-card 호출 및 응답 변환
import { type AiAnalysisResult, type AiOpportunity } from '@/services/openaiApi'

// ── 카테고리 레이블 한글 변환 ──────────────────────────────────────────────
const LABEL_KO: Record<string, string> = {
  DEPOSIT_SAVINGS:  '예적금/수신',
  PERSONAL_LOAN:    '개인대출',
  BUSINESS_LOAN:    '사업자대출',
  CARD:             '카드',
  CASH_MANAGEMENT:  '자금관리',
  FX_REMITTANCE:    '외환/송금',
  INVESTMENT_TAX:   '투자/절세',
}

// ── 스트리밍 진행 이벤트 타입 ─────────────────────────────────────────────
export type BridgeStepEvent =
  | { step: 'router';     status: 'running'; label: string }
  | { step: 'router';     status: 'done';    detail: string; confidence: number }
  | { step: 'specialist'; status: 'running'; label: string }
  | { step: 'specialist'; status: 'done';    detail: string }
  | { step: 'assembler';  status: 'running'; label: string }
  | { step: 'assembler';  status: 'done';    final: true;   data: BridgeSalesCardResponse }
  | { step: 'error';      message: string }

// ── bridge 응답 타입 ──────────────────────────────────────────────────────
interface KpiBadge {
  badge_text: string
  kpi_score: number
  priority_level: string
  display_color: string
  branch_campaign: string | null
}

interface SalesCard {
  rank: number
  product_id: string
  product_name: string
  acceptance_probability: number   // 0~1
  probability_band: string         // HIGH / MEDIUM / LOW
  main_reason: string
  customer_evidence: string[]
  required_documents: string[]
  event_summary: string[]
  policy_cautions: string[]
  staff_sales_talk: string
  next_action: string
  kpi_badge: KpiBadge
}

export interface BridgeSalesCardResponse {
  cust_id: string
  router_result: Record<string, unknown>
  specialist_result: Record<string, unknown>
  sales_cards: SalesCard[]
}

// ── bridge 응답 → AiAnalysisResult 변환 ──────────────────────────────────
export function bridgeToAiResult(data: BridgeSalesCardResponse): AiAnalysisResult {
  const router = data.router_result as {
    primary_label?: string
    routing_reason?: string[]
    confidence?: number
  }

  // summary: router 분류 이유 → 한 문장 요약
  const labelKo = LABEL_KO[router.primary_label ?? ''] ?? router.primary_label ?? '영업기회'
  const routingReasons = router.routing_reason ?? []
  const summary =
    routingReasons.length > 0
      ? routingReasons.join(' ') 
      : `${data.cust_id} 고객의 멀티에이전트 분석이 완료되었습니다.`

  // keyMetrics: 각 상품의 수락확률 + KPI 뱃지
  const keyMetrics = data.sales_cards.flatMap(card => [
    {
      label: card.product_name,
      value: `${Math.round(card.acceptance_probability * 100)}%`,
      highlight: card.probability_band === 'HIGH',
    },
    ...(card.kpi_badge.badge_text && card.kpi_badge.badge_text !== 'KPI 해당 없음'
      ? [{ label: 'KPI', value: card.kpi_badge.badge_text, highlight: card.kpi_badge.priority_level === 'HIGH' }]
      : []),
  ])

  // opportunities: sales_cards → AiOpportunity
  const opportunities: AiOpportunity[] = data.sales_cards.map(card => ({
    rank: card.rank,
    title: card.product_name,
    score: Math.round(card.acceptance_probability * 100),
    analysisPoints: [
      card.main_reason,
      ...card.customer_evidence,
      ...card.event_summary,
    ].filter(Boolean),
    script: card.staff_sales_talk,
    customerBenefit: card.next_action || '고객 맞춤 혜택 제공',
    bankBenefit: card.kpi_badge.badge_text !== 'KPI 해당 없음'
      ? `KPI: ${card.kpi_badge.badge_text} (점수 ${card.kpi_badge.kpi_score}점)`
      : '신규 상품 연계 및 고객 자산 확대',
  }))

  const coreMessage = `${labelKo} 카테고리 중심으로 영업기회를 포착합니다.`

  return { summary, keyMetrics, opportunities, coreMessage }
}

// ── SSE 스트리밍 함수 ─────────────────────────────────────────────────────
export async function* streamBridgeAnalysis(custId: string): AsyncGenerator<BridgeStepEvent> {
  const res = await fetch('/api/agent/api/bridge/sales-card/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cust_id: custId,
      live_context: { visit_reason_code: '', counter_task: '', staff_note: '' },
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`서버 오류 (${res.status}): ${detail}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6)) as BridgeStepEvent
          yield event
        } catch { /* ignore parse errors */ }
      }
    }
  }
}

// ── 외부 호출 함수 ────────────────────────────────────────────────────────
export async function analyzeBridge(custId: string): Promise<AiAnalysisResult> {
  const res = await fetch('/api/agent/api/bridge/sales-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cust_id: custId,
      live_context: { visit_reason_code: '', counter_task: '', staff_note: '' },
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`서버 오류 (${res.status}): ${detail}`)
  }

  const data: BridgeSalesCardResponse = await res.json()
  return bridgeToAiResult(data)
}
