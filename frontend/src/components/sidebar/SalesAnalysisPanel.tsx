import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  CheckCircle2,
  FileText,
  Tag,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCustomer } from '@/contexts/CustomerContext'
import { useKpi } from '@/contexts/KpiContext'
import { KpiBar } from '@/components/kpi/KpiBar'
import { AI_RESULT_CACHE, BRIDGE_CACHE } from '@/services/aiAnalysisCache'
import type { BridgeSalesCardResponse } from '@/services/bridgeApi'
import type { AiAnalysisResult } from '@/services/openaiApi'
import '@/styles/sales-analysis.css'
import '@/styles/kpi.css'

// ── 라우터 카테고리 한글 변환 ─────────────────────────────────────────────
const LABEL_KO: Record<string, string> = {
  DEPOSIT_SAVINGS: '예적금',
  PERSONAL_LOAN:   '개인대출',
  BUSINESS_LOAN:   '사업자대출',
  CARD:            '카드',
  CASH_MANAGEMENT: '자금관리',
  FX_REMITTANCE:   '외환/송금',
  INVESTMENT_TAX:  '투자/절세',
}

// ── 성공확률 색상 ─────────────────────────────────────────────────────────
const probColor = (p: number) =>
  p >= 0.75 ? '#00a86b' : p >= 0.5 ? '#f0a500' : '#e87c00'

const probBand = (band: string) =>
  band === 'HIGH' ? '높음' : band === 'MEDIUM' ? '보통' : '낮음'

// ── 카테고리 활성화 바 ────────────────────────────────────────────────────
const ALL_CATEGORIES = Object.keys(LABEL_KO) as (keyof typeof LABEL_KO)[]

function CategoryBar({ primary, secondary }: { primary: string; secondary: string[] }) {
  const secSet = new Set(secondary)

  // 정렬: 주 카테고리 → 보조 카테고리 → 비활성
  const sorted = [...ALL_CATEGORIES].sort((a, b) => {
    const rank = (k: string) => k === primary ? 0 : secSet.has(k) ? 1 : 2
    return rank(a) - rank(b)
  })

  return (
    <div className="sa-cat-bar">
      {sorted.map(key => {
        const isPrimary   = key === primary
        const isSecondary = secSet.has(key)
        const cls = isPrimary
          ? 'sa-cat-chip sa-cat-chip--primary'
          : isSecondary
            ? 'sa-cat-chip sa-cat-chip--secondary'
            : 'sa-cat-chip sa-cat-chip--inactive'
        return (
          <span key={key} className={cls}>
            {LABEL_KO[key]}
          </span>
        )
      })}
    </div>
  )
}

// ── AI 분석 기반 영업기회 카드 ───────────────────────────────────────────
function BridgeCardSection({
  bridgeData,
  custNo,
}: {
  bridgeData: BridgeSalesCardResponse
  custNo: string
}) {
  const { isOppCompleted, addKpi, mode, cardIssuedFor } = useKpi()
  const { activeResidentId } = useCustomer()

  const router = bridgeData.router_result as {
    primary_label?: string
    secondary_labels?: string[]
    confidence?: number
  }
  const cards           = bridgeData.sales_cards ?? []
  const primaryLabel    = router.primary_label ?? ''
  const secondaryLabels = router.secondary_labels ?? []
  const categoryLabel   = LABEL_KO[primaryLabel] ?? primaryLabel ?? '영업기회'

  const currentResidentFront = activeResidentId?.slice(0, 6) ?? ''
  // 카드 KPI 상품은 모드 무관 항상 발급 필요 / mastercard 모드면 모든 상품 발급 필요
  const needsIssuance = (badge: { badge_text?: string } | undefined) =>
    mode === 'mastercard' || badge?.badge_text === '카드 중점 KPI'

  if (cards.length === 0) return null

  return (
    <div className="sa-section">
      {/* 카테고리 활성화 바 */}
      <CategoryBar primary={primaryLabel} secondary={secondaryLabels} />

      <div className="sa-section-hd">
        <Zap size={13} />
        <span>영업기회</span>
        <span className="sa-opp-count">{cards.length}건</span>
        <span className="sa-ai-category-tag">{categoryLabel}</span>
      </div>

      <div className="sa-ai-opp-list">
        {cards.map((card, idx) => {
          const done   = isOppCompleted(custNo, card.product_id)
          const kpiPt  = card.kpi_badge?.kpi_score ?? 0
          const hasKpi = kpiPt > 0 && card.kpi_badge?.badge_text !== 'KPI 해당 없음'
          const pColor = probColor(card.acceptance_probability)
          const pct    = Math.round(card.acceptance_probability * 100)
          const hasRag = (card.policy_cautions?.length ?? 0) > 0 || (card.required_documents?.length ?? 0) > 0
          const canComplete = !needsIssuance(card.kpi_badge) || cardIssuedFor === currentResidentFront
          const btnDisabled = done || !canComplete

          return (
            <motion.div
              key={card.product_id}
              className={`sa-ai-opp-card${done ? ' sa-ai-opp-card--done' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
            >
              {/* 줄 1: 순위 + 상품명 + 성공확률 */}
              <div className="sa-ai-row sa-ai-row--top">
                <span className="sa-ai-rank">#{idx + 1}</span>
                <span className="sa-ai-name">{card.product_name}</span>
                {done
                  ? <span className="opp-done-badge"><CheckCircle2 size={10} style={{ marginRight: 2 }} />완료</span>
                  : <span className="sa-ai-prob" style={{ color: pColor }}>{pct}%</span>
                }
              </div>

              {/* 줄 2: 근거 텍스트 */}
              <p className="sa-ai-reason">{card.main_reason}</p>

              {/* 줄 3: 태그 (라우터·확률·RAG) */}
              <div className="sa-ai-tags">
                <span className="sa-ai-tag sa-ai-tag--router">
                  <Tag size={9} />{categoryLabel}
                </span>
                <span className="sa-ai-tag sa-ai-tag--prob" style={{ color: pColor, borderColor: pColor + '44', background: pColor + '11' }}>
                  <TrendingUp size={9} />{pct}% · {probBand(card.probability_band)}
                </span>
                {hasRag && (
                  <span className="sa-ai-tag sa-ai-tag--rag">
                    <FileText size={9} />정책 확인됨
                  </span>
                )}
              </div>

              {/* 줄 4: RAG 정책 한 줄 */}
              {card.policy_cautions?.[0] && (
                <p className="sa-ai-policy">{card.policy_cautions[0]}</p>
              )}

              {/* 줄 5: 이벤트 혜택 한 줄 */}
              {card.event_summary?.[0] && (
                <p className="sa-ai-event">{card.event_summary[0]}</p>
              )}

              {/* 줄 6: KPI 라벨 + 버튼 */}
              <div className="sa-ai-footer">
                <span className="sa-ai-kpi-label">
                  {hasKpi ? `KPI +${kpiPt}pt` : ''}
                </span>
                <button
                  className={`opp-btn${!canComplete && !done ? ' opp-btn--locked' : ''}`}
                  disabled={btnDisabled}
                  title={!canComplete && !done ? '카드 발급 후 거래 완료 가능합니다' : undefined}
                  onClick={() => addKpi(kpiPt, card.product_name, card.product_id, custNo)}
                >
                  {done ? '완료됨' : !canComplete ? '🔒 발급 필요' : '거래 완료'}
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export function SalesAnalysisPanel() {
  const { activeResidentId, activeCustId } = useCustomer()
  const [result, setResult]         = useState<AiAnalysisResult | null>(null)
  const [bridgeData, setBridgeData] = useState<BridgeSalesCardResponse | null>(null)

  // DB customer_id를 cacheKey로 사용
  const cacheKey = activeCustId ?? null

  // 캐시 읽기
  useEffect(() => {
    if (!cacheKey) { setResult(null); setBridgeData(null); return }
    setResult(AI_RESULT_CACHE.get(cacheKey) ?? null)
    setBridgeData(BRIDGE_CACHE.get(cacheKey) ?? null)
  }, [cacheKey])

  // 캐시 폴링 (CRM 분석 완료 감지)
  useEffect(() => {
    if (!cacheKey) return
    if (AI_RESULT_CACHE.has(cacheKey)) return
    const id = setInterval(() => {
      if (AI_RESULT_CACHE.has(cacheKey)) {
        setResult(AI_RESULT_CACHE.get(cacheKey) ?? null)
        setBridgeData(BRIDGE_CACHE.get(cacheKey) ?? null)
        clearInterval(id)
      }
    }, 800)
    return () => clearInterval(id)
  }, [cacheKey])

  // ── 고객 미선택 ──
  if (!activeResidentId || !activeCustId) {
    return (
      <div className="sa-empty">
        <BarChart3 size={28} className="sa-empty-icon" />
        <p className="sa-empty-title">고객 정보 없음</p>
        <p className="sa-empty-desc">
          CRM 패널에서 고객을 조회한 후<br />
          AI 영업기회 분석을 실행하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="sa-root-wrap">
      <AnimatePresence mode="wait">
        <motion.div
          key={cacheKey}
          className="sa-root"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >

          {result ? (
            <>

            </>
          ) : (
            <div className="sa-empty sa-empty--inline">
              <Zap size={24} className="sa-empty-icon sa-empty-icon--zap" />
              <p className="sa-empty-title">분석 결과 없음</p>
              <p className="sa-empty-desc">
                CRM 패널 → <strong>AI 영업기회 분석</strong>을<br />
                먼저 실행해주세요.
              </p>
            </div>
          )}

          {/* ── AI 분석 기반 영업기회·추천 상품 (bridge 데이터 있을 때) ── */}
          {bridgeData && activeCustId && (
            <BridgeCardSection bridgeData={bridgeData} custNo={activeCustId} />
          )}

        </motion.div>
      </AnimatePresence>

      {/* ── 경험치 바 (KpiBar) ── */}
      <div className="sa-kpibar-footer">
        <KpiBar inline />
      </div>
    </div>
  )
}
