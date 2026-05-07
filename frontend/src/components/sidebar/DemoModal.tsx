import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  BadgeCheck,
  BotMessageSquare,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  Loader2,
  Network,
  ShieldCheck,
  Target,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { type DemoCustomer } from '@/data/demoCustomers'
import {
  analyzeCustomerWithGpt,
  type AiAnalysisResult,
  type AiOpportunity,
  type CustomerForAnalysis,
} from '@/services/openaiApi'
import {
  streamBridgeAnalysis,
  bridgeToAiResult,
  type BridgeSalesCardResponse,
} from '@/services/bridgeApi'
import { BRIDGE_CACHE } from '@/services/aiAnalysisCache'
import '@/styles/demo-modal.css'

// ── 브릿지 에이전트 단계 정의 ─────────────────────────────────────────────
const BRIDGE_STEPS = [
  { id: 'router'     as const, label: '라우터',       sub: '카테고리 분류' },
  { id: 'specialist' as const, label: '스페셜리스트',  sub: '상품 추천'    },
  { id: 'assembler'  as const, label: 'RAG · 조합',   sub: '정책 검토'    },
]

const TYPE_CONFIG = {
  개인: {
    Icon: User,
    gradient: 'linear-gradient(135deg,#00c7a9,#007c6a)',
    color: '#007a64',
    bg: 'rgba(0,199,169,0.1)',
  },
  개인사업자: {
    Icon: Users,
    gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    color: '#1d4ed8',
    bg: 'rgba(59,130,246,0.1)',
  },
  법인: {
    Icon: Building2,
    gradient: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
    color: '#6d28d9',
    bg: 'rgba(139,92,246,0.1)',
  },
}

const SCORE_COLOR = (s: number) =>
  s >= 90 ? '#00a86b' : s >= 80 ? '#009e86' : s >= 70 ? '#f0a500' : '#e87c00'

function OppCard({ opp, index }: { opp: AiOpportunity; index: number }) {
  const color = SCORE_COLOR(opp.score)
  return (
    <motion.div
      className="dmo-opp-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.1 }}
    >
      <div className="dmo-opp-header" style={{ cursor: 'default' }}>
        <div className="dmo-opp-rank-badge">TOP {opp.rank}</div>
        <span className="dmo-opp-title">{opp.title}</span>
      </div>

      <div className="dmo-opp-body">
        <div className="dmo-opp-section">
          <div className="dmo-opp-section-label">
            <Target size={13} />AI 분석 근거
          </div>
          <ul className="dmo-analysis-list">
            {opp.analysisPoints.map((pt, i) => (
              <li key={i} className="dmo-analysis-item">
                <span className="dmo-dot" style={{ background: color }} />
                {pt}
              </li>
            ))}
          </ul>
        </div>

        <div className="dmo-opp-section">
          <div className="dmo-opp-section-label">
            <BadgeCheck size={13} />추천 상담 멘트
          </div>
          <blockquote className="dmo-script" style={{ borderLeftColor: color }}>
            {opp.script}
          </blockquote>
        </div>

        <div className="dmo-effects">
          <div className="dmo-effect dmo-effect--customer">
            <span className="dmo-effect-label">고객 혜택</span>
            <span className="dmo-effect-value">{opp.customerBenefit}</span>
          </div>
          <div className="dmo-effect dmo-effect--bank">
            <span className="dmo-effect-label">은행 효과</span>
            <span className="dmo-effect-value">{opp.bankBenefit}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface DemoModalProps {
  demo: DemoCustomer
  customerName: string
  customer: CustomerForAnalysis
  onClose: () => void
  /** DB cust_id가 있으면 멀티에이전트 pipeline 사용, 없으면 GPT 직접 호출 */
  custId?: string
  /** 이전 분석 캐시 — 있으면 API 재호출 없이 바로 표시 */
  cachedResult?: AiAnalysisResult | null
  /** 분석 완료 시 부모에 결과 전달 (캐싱용) */
  onResult?: (result: AiAnalysisResult) => void
}

// ── 모달 내 접이식 섹션 ─────────────────────────────────────────────────
function DmoCollapse({ title, icon: Icon, accent, badge, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; accent?: string; badge?: string
  children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="dmo-collapse">
      <button className="dmo-collapse-hd" onClick={() => setOpen(v => !v)}>
        <Icon size={13} style={{ color: accent ?? '#64748b', flexShrink: 0 }} />
        <span className="dmo-collapse-title" style={{ color: accent ? '#1e293b' : undefined }}>{title}</span>
        {badge && <span className="dmo-collapse-badge">{badge}</span>}
        <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {open && <div className="dmo-collapse-body">{children}</div>}
    </div>
  )
}

// ── 공통: 소제목 행 ────────────────────────────────────────────────────────
function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="dmo-sub-label">{children}</p>
}

// ── 영역 1: 고객 상황 & 핵심 행동신호 ────────────────────────────────────
function DmoArea1({ payload }: { payload: Record<string, unknown> }) {
  const seg     = (payload.customer_segment ?? {}) as Record<string, string>
  const rfm     = (payload.rfm_pc ?? {}) as Record<string, unknown>
  const signals = (rfm.explainable_signals ?? []) as string[]
  const tone    = (payload.recommendation_tone as string) ?? ''
  const lifestyle = (payload.lifestyle_segment as string) ?? ''
  const financialNeed = (payload.financial_need as string) ?? ''

  const SEG_LABELS: Record<string, string> = {
    age_band: '연령대', customer_type: '고객유형', risk_grade: '위험등급', branch: '거래지점'
  }
  const segEntries = Object.entries(SEG_LABELS)
    .map(([k, label]) => ({ label, value: seg[k] }))
    .filter(e => e.value)

  const TONE_DESC: Record<string, string> = {
    urgent: '긴박한 상황 — 즉각 대응 필요',
    consultative: '상담형 — 정보 제공 후 제안',
    proactive: '선제적 — 고객보다 먼저 제안',
    relationship: '관계 유지형 — 신뢰 기반 접근',
  }
  const toneKey = tone.toLowerCase().replace(/\s/g, '_')
  const toneDesc = TONE_DESC[toneKey] ?? tone.replace('_', ' ')

  if (segEntries.length === 0 && signals.length === 0) return null

  return (
    <DmoCollapse title="영역 1 — 고객 상황 & 핵심 행동" icon={User} accent="#0284c7" badge={`신호 ${signals.length}건`}>

      {/* 고객 세그먼트 */}
      {segEntries.length > 0 && (
        <div className="dmo-a1-seg-grid">
          {segEntries.map(e => (
            <div key={e.label} className="dmo-a1-seg-cell">
              <span className="dmo-a1-seg-label">{e.label}</span>
              <span className="dmo-a1-seg-val">{e.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* 라이프스타일 / 금융 니즈 */}
      {(lifestyle || financialNeed) && (
        <div className="dmo-a1-extra">
          {lifestyle && <span className="dmo-a1-extra-chip">💼 {lifestyle}</span>}
          {financialNeed && <span className="dmo-a1-extra-chip">💡 {financialNeed}</span>}
        </div>
      )}

      {/* 추천 접근 톤 */}
      {tone && (
        <div className="dmo-a1-tone-box">
          <span className="dmo-a1-tone-key">{tone.replace('_', ' ').toUpperCase()}</span>
          <span className="dmo-a1-tone-desc">{toneDesc}</span>
        </div>
      )}

      {/* 핵심 행동신호 */}
      {signals.length > 0 && (
        <>
          <SubLabel>핵심 행동신호</SubLabel>
          <ul className="dmo-a1-signals">
            {signals.map((s, i) => (
              <li key={i}><span className="dmo-a1-dot" style={{ background: i === 0 ? '#0284c7' : '#94a3b8' }} />{s}</li>
            ))}
          </ul>
        </>
      )}
    </DmoCollapse>
  )
}

// ── 영역 2: 분류결과 & 근거 ──────────────────────────────────────────────
const ALL_CATEGORIES = ['여신', '수신', '카드', '방카', '신탁', '펀드', '외환'] as const

function DmoArea2({ router }: { router: Record<string, unknown> }) {
  const applicable = (router.applicable_categories ?? []) as Array<{
    label?: string; confidence?: number; reasons?: string[]
  }>
  const excluded = (router.excluded_categories ?? []) as Array<{
    label?: string; reason?: string
  }>
  const primaryLabel = applicable[0]?.label ?? ''
  const secSet = new Set(applicable.slice(1).map(c => c.label ?? ''))
  const sorted = [...ALL_CATEGORIES].sort((a, b) => {
    const rank = (k: string) => k === primaryLabel ? 0 : secSet.has(k) ? 1 : 2
    return rank(a) - rank(b)
  })

  return (
    <DmoCollapse title="영역 2 — 분류결과 & 근거" icon={Network} accent="#7c3aed" badge={`${applicable.length}개 해당`}>
      {/* 카테고리 칩 바 */}
      <div className="dmo-cat-bar">
        {sorted.map(k => (
          <span key={k} className={
            k === primaryLabel ? 'dmo-cat-chip dmo-cat-chip--primary'
            : secSet.has(k) ? 'dmo-cat-chip dmo-cat-chip--secondary'
            : 'dmo-cat-chip dmo-cat-chip--inactive'
          }>{k}</span>
        ))}
      </div>

      {/* 카테고리별 신뢰도 + 분류 근거 */}
      {applicable.map((cat, idx) => {
        const conf  = cat.confidence ?? 0
        const color = conf >= 0.75 ? '#00a86b' : conf >= 0.5 ? '#3b82f6' : '#f0a500'
        const reasons = cat.reasons ?? []
        return (
          <div key={cat.label} className="dmo-a2-cat-block">
            <div className="dmo-a2-cat-hd">
              <span className={`dmo-a2-rank ${idx === 0 ? 'dmo-a2-rank--primary' : ''}`}>
                {idx === 0 ? '1순위' : `${idx + 1}순위`}
              </span>
              <span className="dmo-a2-cat-name">{cat.label}</span>
              <div className="dmo-a2-bar-wrap">
                <div className="dmo-a2-bar" style={{ width: `${conf * 100}%`, background: color }} />
              </div>
              <span className="dmo-a2-conf" style={{ color }}>{Math.round(conf * 100)}%</span>
            </div>
            {reasons.length > 0 && (
              <ul className="dmo-a2-reasons">
                {reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </div>
        )
      })}

      {/* 제외 카테고리 + 이유 */}
      {excluded.length > 0 && (
        <div className="dmo-a2-excluded-block">
          <SubLabel>제외된 카테고리</SubLabel>
          {excluded.map(e => (
            <div key={e.label} className="dmo-a2-excluded-row">
              <span className="dmo-a2-excluded-chip">{e.label}</span>
              {e.reason && <span className="dmo-a2-excluded-reason">{e.reason}</span>}
            </div>
          ))}
        </div>
      )}
    </DmoCollapse>
  )
}

// ── 영역 3: 영업기회 카드 (상세) ─────────────────────────────────────────
function DmoArea3({ bridgeData }: { bridgeData: BridgeSalesCardResponse }) {
  const cards = bridgeData.sales_cards ?? []
  const applicable = (bridgeData.router_result.applicable_categories ?? []) as Array<{ label?: string }>
  const primaryLabel = applicable[0]?.label ?? ''
  if (cards.length === 0) return null

  const probColor = (p: number) => p >= 0.75 ? '#00a86b' : p >= 0.5 ? '#f0a500' : '#e87c00'
  const probBand  = (b: string) => b === 'HIGH' ? '높음' : b === 'MEDIUM' ? '보통' : '낮음'

  return (
    <DmoCollapse title="영역 3 — 영업기회 & 확률 근거" icon={Zap} accent="#00a86b" badge={`${cards.length}건`}>
      {cards.map((card, idx) => {
        const pct    = Math.round(card.acceptance_probability * 100)
        const pColor = probColor(card.acceptance_probability)
        const hasKpi = (card.kpi_badge?.kpi_score ?? 0) > 0 && card.kpi_badge?.badge_text !== 'KPI 해당 없음'
        const catLabel = (card as Record<string, unknown>).category as string || primaryLabel

        return (
          <div key={card.product_id} className="dmo-a3-card">
            {/* 헤더 행 */}
            <div className="dmo-a3-hd">
              <span className="dmo-a3-rank">#{idx + 1}</span>
              <span className="dmo-a3-name">{card.product_name}</span>
              <span className="dmo-a3-prob" style={{ color: pColor }}>
                {pct}% <span className="dmo-a3-band" style={{ color: pColor }}>({probBand(card.probability_band)})</span>
              </span>
            </div>

            {/* 카테고리 + KPI 뱃지 */}
            <div className="dmo-a3-tags">
              {catLabel && <span className="dmo-a3-tag dmo-a3-tag--cat">{catLabel}</span>}
              {hasKpi && (
                <span className="dmo-a3-tag dmo-a3-tag--kpi">
                  KPI +{card.kpi_badge.kpi_score}pt · {card.kpi_badge.badge_text}
                </span>
              )}
              {card.kpi_badge?.branch_campaign && (
                <span className="dmo-a3-tag dmo-a3-tag--campaign">{card.kpi_badge.branch_campaign}</span>
              )}
            </div>

            {/* 주요 근거 */}
            <div className="dmo-a3-section">
              <SubLabel>주요 근거</SubLabel>
              <p className="dmo-a3-main-reason">{card.main_reason}</p>
            </div>

            {/* 고객 데이터 근거 */}
            {(card.customer_evidence?.length ?? 0) > 0 && (
              <div className="dmo-a3-section">
                <SubLabel>고객 데이터 근거</SubLabel>
                <ul className="dmo-a3-list dmo-a3-list--evidence">
                  {card.customer_evidence.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {/* 이벤트 요약 */}
            {(card.event_summary?.length ?? 0) > 0 && (
              <div className="dmo-a3-section">
                <SubLabel>감지된 이벤트</SubLabel>
                <ul className="dmo-a3-list dmo-a3-list--event">
                  {card.event_summary.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {/* 영업 멘트 */}
            {card.staff_sales_talk && (
              <div className="dmo-a3-section">
                <SubLabel>추천 영업 멘트</SubLabel>
                <blockquote className="dmo-a3-talk">"{card.staff_sales_talk}"</blockquote>
              </div>
            )}

            {/* 다음 액션 */}
            {card.next_action && (
              <div className="dmo-a3-next-action">
                <TrendingUp size={10} style={{ flexShrink: 0 }} />
                <span>{card.next_action}</span>
              </div>
            )}

            {/* 정책 주의사항 */}
            {(card.policy_cautions?.length ?? 0) > 0 && (
              <div className="dmo-a3-section">
                <SubLabel>정책 주의사항</SubLabel>
                <ul className="dmo-a3-list dmo-a3-list--caution">
                  {card.policy_cautions.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}

            {/* 필요서류 */}
            {(card.required_documents?.length ?? 0) > 0 && (
              <div className="dmo-a3-section">
                <SubLabel>필요서류 {card.required_documents.length}건</SubLabel>
                <ul className="dmo-a3-list dmo-a3-list--docs">
                  {card.required_documents.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </DmoCollapse>
  )
}

// ── 영역 4: 정책·KPI 사후관리 (상세) ────────────────────────────────────
function DmoArea4({ bridgeData }: { bridgeData: BridgeSalesCardResponse }) {
  const kpiMap   = bridgeData.kpi_badges ?? {}
  const policies = bridgeData.policy_support ?? []
  if (policies.length === 0) return null

  return (
    <DmoCollapse title="영역 4 — 필요서류 & 사후관리 지침" icon={ShieldCheck} accent="#dc2626"
      badge={`${policies.length}건`} defaultOpen={false}>
      {policies.map(p => {
        const kpi = kpiMap[p.product_id]
        const kpiColor = kpi?.priority_level === 'HIGH' ? '#dc2626'
          : kpi?.priority_level === 'MEDIUM' ? '#f0a500' : '#64748b'

        return (
          <div key={p.product_id} className="dmo-a4-card">
            {/* 상품명 + 카테고리 */}
            <div className="dmo-a4-hd">
              <span className="dmo-a4-product">{p.product_name}</span>
              {p.category && <span className="dmo-a4-cat">{p.category}</span>}
            </div>

            {/* KPI 등급 + 캠페인 + 사후관리 지침 */}
            {kpi && kpi.badge_text !== 'KPI 해당 없음' && (
              <div className="dmo-a4-kpi-block" style={{ borderColor: kpiColor + '44', background: kpiColor + '0d' }}>
                <div className="dmo-a4-kpi-hd">
                  <span style={{ fontWeight: 700, color: kpiColor }}>KPI {kpi.kpi_score}pt</span>
                  <span style={{ color: '#475569' }}>{kpi.badge_text}</span>
                  {kpi.priority_level && (
                    <span className="dmo-a4-priority" style={{ background: kpiColor + '22', color: kpiColor }}>
                      {kpi.priority_level}
                    </span>
                  )}
                </div>
                {kpi.branch_campaign && (
                  <p className="dmo-a4-campaign">{kpi.branch_campaign}</p>
                )}
                {(kpi.post_management ?? []).length > 0 && (
                  <>
                    <SubLabel>사후관리 지침</SubLabel>
                    <ul className="dmo-a4-list dmo-a4-list--post">
                      {(kpi.post_management ?? []).map((pm: string, i: number) => <li key={i}>{pm}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* 가입자격 */}
            {(p.eligibility_summary?.length ?? 0) > 0 && (
              <div className="dmo-a4-section">
                <SubLabel>가입자격 요약</SubLabel>
                <ul className="dmo-a4-list dmo-a4-list--eligibility">
                  {p.eligibility_summary.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {/* 이벤트 혜택 */}
            {(p.event_summary?.length ?? 0) > 0 && (
              <div className="dmo-a4-section">
                <SubLabel>이벤트 혜택</SubLabel>
                <ul className="dmo-a4-list dmo-a4-list--event">
                  {p.event_summary.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {/* 필요서류 */}
            {(p.required_documents?.length ?? 0) > 0 && (
              <div className="dmo-a4-section">
                <SubLabel>필요서류 {p.required_documents.length}건</SubLabel>
                <ul className="dmo-a4-list dmo-a4-list--docs">
                  {p.required_documents.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}

            {/* 주의사항 (전체) */}
            {(p.caution_points?.length ?? 0) > 0 && (
              <div className="dmo-a4-section">
                <SubLabel>주의사항</SubLabel>
                <ul className="dmo-a4-list dmo-a4-list--caution">
                  {p.caution_points.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </DmoCollapse>
  )
}

export function DemoModal({ demo, customerName, customer, onClose, custId, cachedResult, onResult }: DemoModalProps) {
  const [phase, setPhase] = useState<'loading' | 'done' | 'error'>(
    cachedResult ? 'done' : 'loading'
  )
  const [result, setResult] = useState<AiAnalysisResult | null>(cachedResult ?? null)
  const [bridgeData, setBridgeData] = useState<BridgeSalesCardResponse | null>(
    custId ? (BRIDGE_CACHE.get(custId) ?? null) : null
  )
  const [errorMsg, setErrorMsg] = useState('')

  // 브릿지 스트리밍 진행 상태
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set())
  const [stepDetails, setStepDetails] = useState<Record<string, string>>({})

  const cfg = TYPE_CONFIG[demo.type]
  const TypeIcon = cfg.Icon

  // 캐시가 있으면 API 호출 생략
  useEffect(() => {
    if (cachedResult) return
    let cancelled = false

    if (custId) {
      // iM BRIDGE 스트리밍 파이프라인
      const runStream = async () => {
        try {
          for await (const event of streamBridgeAnalysis(custId)) {
            if (cancelled) break

            if (event.step === 'error') {
              setErrorMsg(event.message)
              setPhase('error')
              return
            }

            if (event.status === 'running') {
              setCurrentStep(event.step)
            } else if (event.status === 'done') {
              setDoneSteps(prev => new Set([...prev, event.step]))
              if ('detail' in event && event.detail) {
                setStepDetails(prev => ({ ...prev, [event.step]: event.detail as string }))
              }
              if (event.step === 'assembler' && 'final' in event && event.final && 'data' in event && event.data) {
                const aiResult = bridgeToAiResult(event.data)
                if (!cancelled) {
                  if (custId) BRIDGE_CACHE.set(custId, event.data)
                  setBridgeData(event.data)
                  setResult(aiResult)
                  setPhase('done')
                  onResult?.(aiResult)
                }
              }
            }
          }
        } catch (err) {
          if (!cancelled) {
            setErrorMsg(err instanceof Error ? err.message : String(err))
            setPhase('error')
          }
        }
      }
      runStream()
    } else {
      // GPT 직접 호출
      analyzeCustomerWithGpt(customer)
        .then(data => {
          if (!cancelled) {
            setResult(data)
            setPhase('done')
            onResult?.(data)
          }
        })
        .catch(err => {
          if (!cancelled) {
            setErrorMsg(err instanceof Error ? err.message : String(err))
            setPhase('error')
          }
        })
    }

    return () => { cancelled = true }
  }, [custId, customer, cachedResult, onResult])

  // ESC 키로 닫기
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const content = (
    <AnimatePresence>
      <motion.div
        className="dmo-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <div className="dmo-center">
        <motion.div
          className="dmo-modal"
          data-ai-modal
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          {/* 헤더 */}
          <div className="dmo-header" style={{ background: cfg.gradient }}>
            <div className="dmo-header-icon">
              <TypeIcon size={24} />
            </div>
            <div className="dmo-header-info">
              <div className="dmo-header-name">
                {customerName}
                <span className="dmo-type-badge">{demo.type}</span>
              </div>
              <div className="dmo-header-sub">{demo.job}</div>
            </div>
            <button className="dmo-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>


          {/* 바디 */}
          <div className="dmo-body">
            <AnimatePresence mode="wait">
              {phase === 'loading' && (
                <motion.div
                  key="loading"
                  className="dmo-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* 중앙 애니메이션 */}
                  <div className="dmo-loading-visual">
                    <div className="dmo-ring dmo-ring--outer" />
                    <div className="dmo-ring dmo-ring--middle" />
                    <div className="dmo-ring dmo-ring--inner" />
                    <div className="dmo-loading-center-icon">
                      <BotMessageSquare size={28} />
                    </div>
                  </div>

                  <p className="dmo-loading-title">
                    {custId ? 'iM BRIDGE 멀티에이전트 분석 중' : 'AI 고객 분석 중'}
                  </p>

                  {custId ? (
                    /* ── 브릿지 스트리밍 단계 인디케이터 ── */
                    <div className="dmo-bridge-progress">
                      {BRIDGE_STEPS.map((step, i) => {
                        const isDone    = doneSteps.has(step.id)
                        const isRunning = currentStep === step.id && !isDone
                        return (
                          <div key={step.id} className="dmo-bridge-step-wrap">
                            <div className={`dmo-bridge-step ${isDone ? 'is-done' : isRunning ? 'is-running' : 'is-pending'}`}>
                              <div className="dmo-bridge-step-circle">
                                {isDone
                                  ? <Check size={13} strokeWidth={3} />
                                  : isRunning
                                    ? <Loader2 size={13} className="dmo-spin" />
                                    : <span>{i + 1}</span>
                                }
                              </div>
                              <div className="dmo-bridge-step-text">
                                <span className="dmo-bridge-step-name">{step.label}</span>
                                <span className="dmo-bridge-step-sub">
                                  {isDone && stepDetails[step.id]
                                    ? stepDetails[step.id]
                                    : step.sub}
                                </span>
                              </div>
                            </div>
                            {i < BRIDGE_STEPS.length - 1 && (
                              <div className={`dmo-bridge-step-line ${isDone ? 'is-done' : ''}`} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    /* ── GPT 직접 호출 — 기존 애니메이션 ── */
                    <>
                      <p className="dmo-loading-sub">
                        거래 흐름 · 소비 패턴 · 자금 이동 이벤트 분석
                      </p>
                      <div className="dmo-loading-steps">
                        {[
                          { label: '고객 거래 데이터 수집',       delay: 0   },
                          { label: '소비 패턴 및 이벤트 감지',    delay: 0.5 },
                          { label: '영업기회 우선순위 산정',       delay: 1.0 },
                        ].map(({ label, delay }) => (
                          <motion.div
                            key={label}
                            className="dmo-loading-step"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay }}
                          >
                            <motion.span
                              className="dmo-step-dot"
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ delay, duration: 1.2, repeat: Infinity }}
                            />
                            {label}
                            <motion.span
                              className="dmo-step-dots-anim"
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ delay: delay + 0.3, duration: 1.2, repeat: Infinity }}
                            >...</motion.span>
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {phase === 'error' && (
                <motion.div
                  key="error"
                  className="dmo-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <AlertCircle size={40} color="#ef4444" />
                  <p className="dmo-loading-title" style={{ color: '#ef4444' }}>분석 실패</p>
                  <p className="dmo-loading-sub">{errorMsg}</p>
                </motion.div>
              )}

              {phase === 'done' && result && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* 핵심 메시지 */}
                  <motion.div
                    className="dmo-core-msg"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: 10 }}
                  >
                    <Lightbulb size={16} />
                    <span>{result.coreMessage}</span>
                  </motion.div>

                  {/* 영역 1: 고객 행동신호 */}
                  {bridgeData && Object.keys(bridgeData.customer_payload ?? {}).length > 0 && (
                    <div className="dmo-card dmo-card--area">
                      <DmoArea1 payload={bridgeData.customer_payload} />
                    </div>
                  )}

                  {/* 영역 2: Router 카테고리 분류 */}
                  {bridgeData && (
                    <div className="dmo-card dmo-card--area">
                      <DmoArea2 router={bridgeData.router_result} />
                    </div>
                  )}

                  {/* 영역 3: 영업기회 상세 */}
                  {bridgeData ? (
                    <div className="dmo-card dmo-card--area">
                      <DmoArea3 bridgeData={bridgeData} />
                    </div>
                  ) : (
                    <div className="dmo-card dmo-card--area">
                      <div className="dmo-collapse">
                        <div className="dmo-collapse-hd" style={{ cursor: 'default' }}>
                          <Zap size={13} style={{ color: '#00a86b' }} />
                          <span className="dmo-collapse-title">영역 3 — 영업기회 & 확률 근거</span>
                          <span className="dmo-collapse-badge">{result.opportunities.length}건</span>
                        </div>
                        <div className="dmo-collapse-body">
                          <div className="dmo-opp-list">
                            {result.opportunities.map((opp, i) => (
                              <OppCard key={opp.rank} opp={opp} index={i} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 영역 4: 정책·KPI 사후관리 */}
                  {bridgeData && (
                    <div className="dmo-card dmo-card--area">
                      <DmoArea4 bridgeData={bridgeData} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )

  return createPortal(content, document.body)
}
