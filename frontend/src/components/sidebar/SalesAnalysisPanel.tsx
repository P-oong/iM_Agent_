import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Network,
  ShieldCheck,
  Tag,
  TrendingUp,
  User,
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

// ── 카테고리 전체 목록 ────────────────────────────────────────────────────
const ALL_CATEGORIES = ['여신', '수신', '카드', '방카', '신탁', '펀드', '외환'] as const

// ── 성공확률 색상 ─────────────────────────────────────────────────────────
const probColor = (p: number) =>
  p >= 0.75 ? '#00a86b' : p >= 0.5 ? '#f0a500' : '#e87c00'

const probBand = (band: string) =>
  band === 'HIGH' ? '높음' : band === 'MEDIUM' ? '보통' : '낮음'

// ── 접이식 섹션 ───────────────────────────────────────────────────────────
function CollapseSection({
  title, icon: Icon, badge, accent, children, defaultOpen = true,
}: {
  title: string
  icon: React.ElementType
  badge?: string
  accent?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="sa-collapse">
      <button className="sa-collapse-hd" onClick={() => setOpen(v => !v)}>
        <Icon size={12} style={{ color: accent ?? '#64748b', flexShrink: 0 }} />
        <span className="sa-collapse-title" style={{ color: accent ? '#1e293b' : undefined }}>{title}</span>
        {badge && <span className="sa-collapse-badge">{badge}</span>}
        <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {open && <div className="sa-collapse-body">{children}</div>}
    </div>
  )
}

// ── 영역 1: 고객 행동신호 ────────────────────────────────────────────────
function Area1Signals({ payload }: { payload: Record<string, unknown> }) {
  const seg = (payload.customer_segment ?? {}) as Record<string, string>
  const rfm = (payload.rfm_pc ?? {}) as Record<string, unknown>
  const signals = (rfm.explainable_signals ?? []) as string[]
  const tone    = (payload.recommendation_tone as string) ?? ''

  const segParts = [seg.age_band, seg.customer_type, seg.risk_grade, seg.branch].filter(Boolean)

  return (
    <CollapseSection title="고객 행동신호" icon={User} accent="#0284c7" badge={`${signals.length}건`}>
      {segParts.length > 0 && (
        <div className="sa-area1-seg">
          {segParts.map(s => (
            <span key={s} className="sa-area1-seg-chip">{s}</span>
          ))}
        </div>
      )}
      {tone && (
        <div className="sa-area1-tone">
          <span className="sa-area1-tone-label">추천 톤</span>
          <span className="sa-area1-tone-val">{tone.replace('_', ' ')}</span>
        </div>
      )}
      <ul className="sa-area1-signals">
        {signals.map((s, i) => (
          <li key={i} className="sa-area1-signal-item">
            <span className="sa-area1-dot" />
            {s}
          </li>
        ))}
      </ul>
    </CollapseSection>
  )
}

// ── 영역 2: Router 카테고리 분류 ─────────────────────────────────────────
function Area2Router({ router }: { router: Record<string, unknown> }) {
  const applicable = (router.applicable_categories ?? []) as Array<{
    label?: string; confidence?: number; reasons?: string[]
  }>
  const excluded = (router.excluded_categories ?? []) as Array<{
    label?: string; reason?: string
  }>

  const primaryLabel    = applicable[0]?.label ?? ''
  const secondaryLabels = applicable.slice(1).map(c => c.label ?? '').filter(Boolean)
  const secSet = new Set(secondaryLabels)

  const sorted = [...ALL_CATEGORIES].sort((a, b) => {
    const rank = (k: string) => k === primaryLabel ? 0 : secSet.has(k) ? 1 : 2
    return rank(a) - rank(b)
  })

  return (
    <CollapseSection title="카테고리 분류" icon={Network} accent="#7c3aed" badge={`${applicable.length}개`}>
      {/* 칩 바 */}
      <div className="sa-cat-bar" style={{ marginBottom: 8 }}>
        {sorted.map(key => {
          const isPrimary   = key === primaryLabel
          const isSecondary = secSet.has(key)
          return (
            <span key={key} className={
              isPrimary ? 'sa-cat-chip sa-cat-chip--primary'
              : isSecondary ? 'sa-cat-chip sa-cat-chip--secondary'
              : 'sa-cat-chip sa-cat-chip--inactive'
            }>{key}</span>
          )
        })}
      </div>

      {/* confidence 바 */}
      {applicable.map(cat => {
        const conf = cat.confidence ?? 0
        const color = conf >= 0.75 ? '#00a86b' : conf >= 0.5 ? '#3b82f6' : '#f0a500'
        return (
          <div key={cat.label} className="sa-area2-row">
            <span className="sa-area2-label">{cat.label}</span>
            <div className="sa-area2-bar-wrap">
              <div className="sa-area2-bar" style={{ width: `${conf * 100}%`, background: color }} />
            </div>
            <span className="sa-area2-conf" style={{ color }}>{Math.round(conf * 100)}%</span>
          </div>
        )
      })}

      {excluded.length > 0 && (
        <div className="sa-area2-excluded">
          <span className="sa-area2-excluded-label">제외</span>
          {excluded.map(e => (
            <span key={e.label} className="sa-area2-excluded-chip">{e.label}</span>
          ))}
        </div>
      )}
    </CollapseSection>
  )
}

// ── 영역 3: 추천 영업기회 카드 ───────────────────────────────────────────
function Area3Cards({
  bridgeData, custNo,
}: {
  bridgeData: BridgeSalesCardResponse
  custNo: string
}) {
  const { isOppCompleted, addKpi, mode, cardIssuedFor } = useKpi()
  const { activeResidentId } = useCustomer()

  const cards = bridgeData.sales_cards ?? []
  const router = bridgeData.router_result
  const applicable = (router.applicable_categories ?? []) as Array<{ label?: string }>
  const primaryLabel = applicable[0]?.label ?? ''

  const currentResidentFront = activeResidentId?.slice(0, 6) ?? ''
  const needsIssuance = (badge: { badge_text?: string } | undefined) =>
    mode === 'mastercard' || badge?.badge_text === '카드 중점 KPI'

  if (cards.length === 0) return null

  return (
    <CollapseSection title="추천 영업기회" icon={Zap} accent="#00a86b" badge={`${cards.length}건`}>
      <div className="sa-ai-opp-list">
        {cards.map((card, idx) => {
          const done        = isOppCompleted(custNo, card.product_id)
          const kpiPt       = card.kpi_badge?.kpi_score ?? 0
          const hasKpi      = kpiPt > 0 && card.kpi_badge?.badge_text !== 'KPI 해당 없음'
          const pColor      = probColor(card.acceptance_probability)
          const pct         = Math.round(card.acceptance_probability * 100)
          const hasRag      = (card.policy_cautions?.length ?? 0) > 0 || (card.required_documents?.length ?? 0) > 0
          const canComplete = !needsIssuance(card.kpi_badge) || cardIssuedFor === currentResidentFront
          const btnDisabled = done || !canComplete
          const catLabel    = (card as Record<string, unknown>).category as string || primaryLabel

          return (
            <motion.div
              key={card.product_id}
              className={`sa-ai-opp-card${done ? ' sa-ai-opp-card--done' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
            >
              <div className="sa-ai-row sa-ai-row--top">
                <span className="sa-ai-rank">#{idx + 1}</span>
                <span className="sa-ai-name">{card.product_name}</span>
                {done
                  ? <span className="opp-done-badge"><CheckCircle2 size={10} style={{ marginRight: 2 }} />완료</span>
                  : <span className="sa-ai-prob" style={{ color: pColor }}>{pct}%</span>
                }
              </div>

              <p className="sa-ai-reason">{card.main_reason}</p>

              <div className="sa-ai-tags">
                {catLabel && (
                  <span className="sa-ai-tag sa-ai-tag--router">
                    <Tag size={9} />{catLabel}
                  </span>
                )}
                <span className="sa-ai-tag sa-ai-tag--prob" style={{ color: pColor, borderColor: pColor + '44', background: pColor + '11' }}>
                  <TrendingUp size={9} />{pct}% · {probBand(card.probability_band)}
                </span>
                {hasRag && (
                  <span className="sa-ai-tag sa-ai-tag--rag">
                    <FileText size={9} />정책 확인됨
                  </span>
                )}
              </div>

              {card.policy_cautions?.[0] && (
                <p className="sa-ai-policy">{card.policy_cautions[0]}</p>
              )}
              {card.event_summary?.[0] && (
                <p className="sa-ai-event">{card.event_summary[0]}</p>
              )}

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
    </CollapseSection>
  )
}

// ── 영역 4: 정책·KPI 사후관리 ────────────────────────────────────────────
function Area4Policy({ bridgeData }: { bridgeData: BridgeSalesCardResponse }) {
  const kpiMap    = bridgeData.kpi_badges ?? {}
  const policies  = bridgeData.policy_support ?? []

  if (policies.length === 0 && Object.keys(kpiMap).length === 0) return null

  return (
    <CollapseSection title="정책·KPI 사후관리" icon={ShieldCheck} accent="#dc2626" badge={`${policies.length}건`} defaultOpen={false}>
      {policies.map(p => {
        const kpi = kpiMap[p.product_id]
        const kpiColor = kpi?.priority_level === 'HIGH' ? '#dc2626'
          : kpi?.priority_level === 'MEDIUM' ? '#f0a500' : '#64748b'

        return (
          <div key={p.product_id} className="sa-area4-card">
            {/* 상품명 + 카테고리 */}
            <div className="sa-area4-hd">
              <span className="sa-area4-product">{p.product_name}</span>
              {p.category && (
                <span className="sa-area4-cat">{p.category}</span>
              )}
            </div>

            {/* KPI 뱃지 */}
            {kpi && kpi.badge_text !== 'KPI 해당 없음' && (
              <div className="sa-area4-kpi" style={{ borderColor: kpiColor + '44', background: kpiColor + '0d' }}>
                <span className="sa-area4-kpi-badge" style={{ color: kpiColor }}>
                  KPI {kpi.kpi_score}pt · {kpi.badge_text}
                </span>
                {kpi.branch_campaign && (
                  <span className="sa-area4-kpi-campaign">{kpi.branch_campaign}</span>
                )}
                {kpi.post_management?.length > 0 && (
                  <ul className="sa-area4-post">
                    {kpi.post_management.slice(0, 2).map((pm, i) => (
                      <li key={i}>{pm}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 필요서류 */}
            {p.required_documents?.length > 0 && (
              <div className="sa-area4-docs">
                <span className="sa-area4-docs-label">필요서류 {p.required_documents.length}건</span>
                <ul className="sa-area4-docs-list">
                  {p.required_documents.slice(0, 3).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                  {p.required_documents.length > 3 && (
                    <li className="sa-area4-docs-more">+{p.required_documents.length - 3}건 더</li>
                  )}
                </ul>
              </div>
            )}

            {/* 주의사항 첫 줄 */}
            {p.caution_points?.[0] && (
              <p className="sa-area4-caution">{p.caution_points[0]}</p>
            )}
          </div>
        )
      })}
    </CollapseSection>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export function SalesAnalysisPanel() {
  const { activeResidentId, activeCustId } = useCustomer()
  const [result, setResult]         = useState<AiAnalysisResult | null>(null)
  const [bridgeData, setBridgeData] = useState<BridgeSalesCardResponse | null>(null)

  const cacheKey = activeCustId ?? null

  useEffect(() => {
    if (!cacheKey) { setResult(null); setBridgeData(null); return }
    setResult(AI_RESULT_CACHE.get(cacheKey) ?? null)
    setBridgeData(BRIDGE_CACHE.get(cacheKey) ?? null)
  }, [cacheKey])

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
          {!result && !bridgeData && (
            <div className="sa-empty sa-empty--inline">
              <Zap size={24} className="sa-empty-icon sa-empty-icon--zap" />
              <p className="sa-empty-title">분석 결과 없음</p>
              <p className="sa-empty-desc">
                CRM 패널 → <strong>AI 영업기회 분석</strong>을<br />
                먼저 실행해주세요.
              </p>
            </div>
          )}

          {bridgeData && (
            <>
              {/* 영역 1: 고객 행동신호 */}
              {Object.keys(bridgeData.customer_payload ?? {}).length > 0 && (
                <Area1Signals payload={bridgeData.customer_payload} />
              )}

              {/* 영역 2: Router 카테고리 분류 */}
              <Area2Router router={bridgeData.router_result} />

              {/* 영역 3: 추천 영업기회 */}
              <Area3Cards bridgeData={bridgeData} custNo={activeCustId} />

              {/* 영역 4: 정책·KPI 사후관리 */}
              <Area4Policy bridgeData={bridgeData} />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="sa-kpibar-footer">
        <KpiBar inline />
      </div>
    </div>
  )
}
