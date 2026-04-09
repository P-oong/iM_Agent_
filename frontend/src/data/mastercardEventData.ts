/**
 * '2026년 상반기 마스터카드 이벤트' — 데모용 요약 (공문 기준)
 * 평가·포상 구조는 실제와 다를 수 있으며 UI 시연 목적입니다.
 */

import type { ComponentType } from 'react'
import { Building2, CreditCard, RefreshCw, Wallet } from 'lucide-react'

export const MC_EVENT_META = {
  id: 'mastercard-2026-h1',
  name: "'26 상반기 마스터카드 이벤트",
  period: '2026.01.19 ~ 2026.05.22',
  dept: '결제사업부',
  sector: '신용·체크카드(개인·기업)',
  minPointsForRank: 100,
} as const

/** 포상 구간 (공문 기준 요약) */
export const MC_REWARD_TIERS = [
  { rank: '1~10위', reward: '해외연수(지역 미정)' },
  { rank: '11~12위', reward: '백화점 상품권 100만원' },
  { rank: '13~15위', reward: '백화점 상품권 70만원' },
  { rank: '16~20위', reward: '백화점 상품권 50만원' },
  { rank: '21~30위', reward: '백화점 상품권 30만원' },
  { rank: '31~40위', reward: '백화점 상품권 20만원' },
  { rank: '41~50위', reward: '백화점 상품권 10만원' },
] as const

/**
 * 직원 동기부여용 마일스톤 (점수 구간 → 다음 목표까지 남은 점수·멘트)
 * 실제 순위와 1:1 대응은 아니며 UX용입니다.
 */
export const MC_GAMIFY_STEPS = [
  { at: 3,  label: '첫 실적 구간',    nudge: '신규 1건이면 커피 한 잔 값 포인트예요.' },
  { at: 8,  label: '실적 가속 구간',  nudge: '조금만 더 하면 간식·음료 쿠폰급이에요.' },
  { at: 15, label: '중간 목표',       nudge: '이 정도면 팀에서 눈에 띄는 실적이에요.' },
  { at: 25, label: '상위권 진입 전',  nudge: '몇 건만 더하면 상위권 후보 구간이에요.' },
  { at: 40, label: '강한 실적',       nudge: '포상 후보권까지 한 걸음이에요.' },
  { at: 60, label: '우수 실적',       nudge: '순위권을 노려볼 만한 점수예요.' },
  { at: 100, label: '평가 대상(100pt)', nudge: '공문 기준 포상 평가 최소 점수(100pt) 달성!' },
] as const

export interface MastercardBarInfo {
  totalPoints: number
  progress: number
  prevStep: number
  nextStep: number
  remaining: number
  nextLabel: string
  nudge: string
  rankHint: string
}

export function getMastercardBarInfo(total: number): MastercardBarInfo {
  const steps = [...MC_GAMIFY_STEPS]
  const prev = [...steps].reverse().find(s => total >= s.at) ?? { at: 0, label: '시작', nudge: '첫 마스터카드 실적을 쌓아보세요.' }
  const next = steps.find(s => s.at > total)

  if (!next) {
    const last = steps[steps.length - 1]
    let rankHint = ''
    if (total < MC_EVENT_META.minPointsForRank) {
      rankHint = `포상 평가 최소 ${MC_EVENT_META.minPointsForRank}pt까지 ${(MC_EVENT_META.minPointsForRank - total).toFixed(1)}pt`
    } else {
      rankHint = '평가 대상 점수 충족 — 순위는 동점 시 신용카드 건수 우선'
    }
    return {
      totalPoints: total,
      progress: 1,
      prevStep: last.at,
      nextStep: total,
      remaining: 0,
      nextLabel: last.label,
      nudge: '목표 구간을 모두 통과했어요. 순위 경쟁을 이어가세요.',
      rankHint,
    }
  }

  const range = next.at - prev.at
  const progress = range > 0 ? Math.min(1, Math.max(0, (total - prev.at) / range)) : 1
  const remaining = Math.max(0, next.at - total)

  let rankHint = ''
  if (total < MC_EVENT_META.minPointsForRank) {
    rankHint = `포상 평가 최소 ${MC_EVENT_META.minPointsForRank}pt까지 ${(MC_EVENT_META.minPointsForRank - total).toFixed(1)}pt`
  } else {
    rankHint = '평가 대상 점수 충족 — 순위는 동점 시 신용카드 건수 우선'
  }

  return {
    totalPoints: total,
    progress,
    prevStep: prev.at,
    nextStep: next.at,
    remaining,
    nextLabel: next.label,
    nudge: remaining > 0 ? next.nudge : '다음 목표를 향해 실적을 이어가세요.',
    rankHint,
  }
}

/** 인라인 KPI 바용 — 기본 KPI와 동일한 줄 수(링·이름·바·다음까지) */
export function getMcTrackDisplay(total: number) {
  const info = getMastercardBarInfo(total)
  const steps = [...MC_GAMIFY_STEPS]
  const cleared = steps.filter(s => total >= s.at).length
  const phase = Math.min(Math.max(cleared + 1, 1), steps.length)
  return {
    phase,
    progressPct: Math.round(info.progress * 100),
    remainPts: info.remaining,
    /** 링 아래 작은 타이틀과 동일하게 */
    title: 'MC 이벤트',
    emoji: '🟠',
  }
}

// ── CRM 영업기회 (이벤트 배점 요약 — 발급 기준 클릭 포인트) ─────────────────

type MockLike = {
  유형: '개인' | '개인사업자' | '법인'
  보유상품: string[]
}

const has = (products: string[], needle: string) =>
  products.some(p => p.includes(needle))

export interface McOpportunity {
  key: string
  /** 카드 제목 (CRM 목록) */
  title: string
  kpi: number
  category: string
  criteria: string
  limit: string
  desc: string
  Icon: ComponentType<{ size?: number }>
}

/** 공문 평가배점 요약: 신규 개인 신용 1.0 / 체크 0.2, 무실적·추가 신용 0.5 등 */
export function buildMastercardOpportunities(c: MockLike): McOpportunity[] {
  const p = c.보유상품
  const out: McOpportunity[] = []

  if (c.유형 === '개인') {
    if (!has(p, '신용')) {
      out.push({
        key: 'mc-pers-credit-new',
        title: '개인 신규 신용',
        kpi: 1,
        category: '마스터카드',
        criteria: '개인 신규 신용 발급',
        limit: '반기 한도 내',
        desc: '1.0pt · 이용액 10만/30만 구간 추가(별도)',
        Icon: CreditCard,
      })
    }
    if (!has(p, '체크')) {
      out.push({
        key: 'mc-pers-check-new',
        title: '개인 신규 체크',
        kpi: 0.2,
        category: '마스터카드',
        criteria: '개인 체크 신규 발급',
        limit: '반기 한도 내',
        desc: '0.2pt · 결제 연동 시 인정',
        Icon: Wallet,
      })
    }
    if (has(p, '신용')) {
      out.push({
        key: 'mc-pers-credit-re',
        title: '무실적·재발급 신용',
        kpi: 0.5,
        category: '마스터카드',
        criteria: '무실적·재발급·교체(신용)',
        limit: '반기 한도 내',
        desc: '0.5pt · 이용 실적 구간 가산',
        Icon: RefreshCw,
      })
      out.push({
        key: 'mc-pers-credit-add',
        title: '연회비 추가 카드',
        kpi: 0.5,
        category: '마스터카드',
        criteria: '연회비 추가 카드(개인)',
        limit: '반기 한도 내',
        desc: '0.5pt · 기존 회원 추가 발급',
        Icon: CreditCard,
      })
    }
  } else {
    // 개인사업자·법인 — 기업 신용 중심
    const corpCard = has(p, '법인카드') || has(p, '사업자카드') || has(p, '신용카드')
    if (!corpCard) {
      out.push({
        key: 'mc-corp-credit-new',
        title: '기업 신규 신용',
        kpi: 1,
        category: '마스터카드(기업)',
        criteria: '기업 신규 신용 발급',
        limit: '반기 한도 내',
        desc: '1.0pt · 매출 30만/50만 구간 가산',
        Icon: Building2,
      })
    } else {
      out.push({
        key: 'mc-corp-credit-re',
        title: '기업 무실적·추가',
        kpi: 0.5,
        category: '마스터카드(기업)',
        criteria: '무실적·추가·교체(기업)',
        limit: '반기 한도 내',
        desc: '0.5pt · 매출 구간 추가 배점',
        Icon: RefreshCw,
      })
    }
    if (c.유형 === '개인사업자' && !has(p, '체크')) {
      out.push({
        key: 'mc-sole-check-new',
        title: '사업자 체크 신규',
        kpi: 0.2,
        category: '마스터카드',
        criteria: '사업자 체크 신규',
        limit: '반기 한도 내',
        desc: '0.2pt · 결제·매입 연계',
        Icon: Wallet,
      })
    }
  }

  return out
}
