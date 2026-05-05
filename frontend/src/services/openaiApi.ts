// GPT 분석은 agentserver(FastAPI)에서 처리 — API 키가 브라우저에 노출되지 않음

export interface CustomerForAnalysis {
  name: string
  type: '개인' | '개인사업자' | '법인'
  grade: string
  products: string[]
  accounts: { product: string; balance: number }[]
  transactions: { date: string; description: string; amount: number }[]
  businessInfo?: {
    companyName: string
    industry: string
    annualRevenue?: string
    employeeCount?: number
  }
  visitPurpose: string
  aiEvent: string
}

export interface AiOpportunity {
  rank: number
  title: string
  score: number
  analysisPoints: string[]
  script: string
  customerBenefit: string
  bankBenefit: string
}

export interface AiAnalysisResult {
  summary: string
  keyMetrics: { label: string; value: string; highlight: boolean }[]
  opportunities: AiOpportunity[]
  coreMessage: string
}

export async function analyzeCustomerWithGpt(
  customer: CustomerForAnalysis,
): Promise<AiAnalysisResult> {
  const res = await fetch('/api/agent/analyze-opportunities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`서버 오류 (${res.status}): ${detail}`)
  }

  return res.json() as Promise<AiAnalysisResult>
}
