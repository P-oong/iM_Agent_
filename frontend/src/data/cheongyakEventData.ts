/**
 * 청약 예·부금 → 주택청약종합저축 전환 이벤트 (데모)
 * 당행/타행 청약예부금 보유 시 전환 유도 — 타행 전입·전환 시 배점 더 높음
 */

import type { ComponentType } from 'react'
import { ArrowRightLeft, Landmark } from 'lucide-react'

export const CQ_EVENT_META = {
  id: 'cheongyak-convert-2026',
  name: '청약 예·부금 전환 이벤트',
  period: '2026 상반기(데모)',
} as const

export const CQ_GAMIFY_STEPS = [
  { at: 2,  label: '첫 전환 구간',   nudge: '당·타행 전환 1건이면 이벤트 포인트가 쌓여요.' },
  { at: 6,  label: '전환 가속',     nudge: '타행 전입 전환이 배점이 더 높아요.' },
  { at: 12, label: '중간 목표',     nudge: '주택청약 통합 고객이 늘수록 실적이 좋아져요.' },
  { at: 20, label: '우수 전환 실적', nudge: '팀 내 전환 안내 우수 사례급이에요.' },
  { at: 35, label: '상위권',        nudge: '이벤트 기간 내 전환 실적 상위권 후보예요.' },
] as const

export interface CheongyakBarInfo {
  totalPoints: number
  progress: number
  prevStep: number
  nextStep: number
  remaining: number
  nextLabel: string
  nudge: string
}

export function getCheongyakBarInfo(total: number): CheongyakBarInfo {
  const steps = [...CQ_GAMIFY_STEPS]
  const prev = [...steps].reverse().find(s => total >= s.at) ?? { at: 0, label: '시작', nudge: '청약·예부금 전환 실적을 쌓아보세요.' }
  const next = steps.find(s => s.at > total)

  if (!next) {
    const last = steps[steps.length - 1]
    return {
      totalPoints: total,
      progress: 1,
      prevStep: last.at,
      nextStep: total,
      remaining: 0,
      nextLabel: last.label,
      nudge: '목표 구간을 통과했어요. 전환 실적을 이어가세요.',
    }
  }

  const range = next.at - prev.at
  const progress = range > 0 ? Math.min(1, Math.max(0, (total - prev.at) / range)) : 1
  const remaining = Math.max(0, next.at - total)

  return {
    totalPoints: total,
    progress,
    prevStep: prev.at,
    nextStep: next.at,
    remaining,
    nextLabel: next.label,
    nudge: remaining > 0 ? next.nudge : '다음 목표를 향해 전환 실적을 이어가세요.',
  }
}

/** 인라인 KPI 바 — MC와 동일한 줄 구성 */
export function getCheongyakTrackDisplay(total: number) {
  const info = getCheongyakBarInfo(total)
  const steps = [...CQ_GAMIFY_STEPS]
  const cleared = steps.filter(s => total >= s.at).length
  const phase = Math.min(Math.max(cleared + 1, 1), steps.length)
  return {
    phase,
    progressPct: Math.round(info.progress * 100),
    remainPts: info.remaining,
    title: '청약 전환',
    emoji: '🔵',
  }
}

export interface CheongyakOpportunity {
  key: string
  title: string
  kpi: number
  category: string
  criteria: string
  limit: string
  desc: string
  Icon: ComponentType<{ size?: number }>
}

function has주택청약종합(보유상품: string[]) {
  return 보유상품.some(p => p.includes('주택청약종합'))
}

/** 보유상품 문자열에 '청약예부금'이 포함된 것만 전환 이벤트 대상 (주택청약종합 제외) */
function is청약예부금상품(p: string) {
  if (!p.includes('청약예부금')) return false
  if (p.includes('주택청약종합')) return false
  return true
}

/** 당행 청약예부금: 문구에 타행이 없으면 당행으로 간주(예: 청약예부금, 당행청약예부금) */
function has당행청약예부금(보유상품: string[]) {
  return 보유상품.some(p => is청약예부금상품(p) && !p.includes('타행'))
}

/** 타행 청약예부금 */
function has타행청약예부금(보유상품: string[]) {
  return 보유상품.some(p => is청약예부금상품(p) && p.includes('타행'))
}

/**
 * 전환 영업기회: 이미 주택청약종합이면 제외.
 * 당행 전환 배점 < 타행 전입·전환 배점
 */
export function buildCheongyakOpportunities(c: { 보유상품: string[] }): CheongyakOpportunity[] {
  if (has주택청약종합(c.보유상품)) return []

  const out: CheongyakOpportunity[] = []
  const p = c.보유상품

  if (has당행청약예부금(p)) {
    out.push({
      key: 'cq-same-bank',
      title: '당행 청약예부금 보유! 전환 기회',
      kpi: 0.5,
      category: CQ_EVENT_META.name,
      criteria: '종합저축 전환 안내',
      limit: '이벤트 기간 내',
      desc: '구형 예부금 → 주택청약',
      Icon: Landmark,
    })
  }

  if (has타행청약예부금(p)) {
    out.push({
      key: 'cq-other-bank',
      title: '타행 청약예부금 보유! 전환 기회',
      kpi: 1.2,
      category: CQ_EVENT_META.name,
      criteria: '전입 후 전환 시 고배점',
      limit: '이벤트 기간 내',
      desc: '전입·전환 시 가산',
      Icon: ArrowRightLeft,
    })
  }

  return out
}
