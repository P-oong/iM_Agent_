/**
 * 페이지 세션 동안 AI 분석 결과를 유지하는 모듈 레벨 캐시
 * CrmPanel과 SalesAnalysisPanel이 공유합니다.
 */
import type { AiAnalysisResult } from '@/services/openaiApi'
import type { BridgeSalesCardResponse } from '@/services/bridgeApi'

/** 변환된 AI 분석 결과 캐시 (요약·기회·지표) */
export const AI_RESULT_CACHE = new Map<string, AiAnalysisResult>()

/** iM BRIDGE 원본 응답 캐시 (router/specialist/RAG 전체 데이터) */
export const BRIDGE_CACHE = new Map<string, BridgeSalesCardResponse>()

export function getCachedResult(key: string): AiAnalysisResult | null {
  return AI_RESULT_CACHE.get(key) ?? null
}

export function setCachedResult(key: string, result: AiAnalysisResult): void {
  AI_RESULT_CACHE.set(key, result)
}
