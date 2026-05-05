/**
 * iM Bank Sales Agent — agentserver REST API 클라이언트
 * Vite 프록시: /api/agent/* → http://localhost:8000/*
 */

import type { DummyCustomer } from '@/data/dummyCustomers'

const AGENT_BASE = '/api/agent'

export interface AgentOpportunity {
  product: string
  reason: string
  priority: string
  kpiScore: number
}

export interface AgentAnalysisResult {
  customerSummary: string
  financialScore: number
  financialHealthLabel: string
  opportunities: AgentOpportunity[]
  risks: string[]
  recommendedScript: string
  nextActions: string[]
}

/** agentserver 헬스 체크 */
export async function checkAgentHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_BASE}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

/** LangGraph 에이전트 서버로 고객 분석 요청 */
export async function analyzeWithAgent(customer: DummyCustomer): Promise<AgentAnalysisResult> {
  const res = await fetch(`${AGENT_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer }),
  })

  if (!res.ok) {
    let msg = `에이전트 서버 오류 (HTTP ${res.status})`
    try {
      const err = await res.json()
      if (err?.detail) msg = String(err.detail)
    } catch { /* ignore */ }
    throw new Error(msg)
  }

  return res.json() as Promise<AgentAnalysisResult>
}
