import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  BadgeCheck,
  BotMessageSquare,
  Building2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Users,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { DEMO_CUSTOMERS, type DemoCustomer } from '@/data/demoCustomers'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import '@/styles/demo-page.css'

const TYPE_CONFIG = {
  개인: {
    icon: User,
    color: '#007a64',
    bg: 'rgba(0,199,169,0.12)',
    border: 'rgba(0,199,169,0.3)',
    gradient: 'linear-gradient(135deg,#00c7a9,#007c6a)',
  },
  개인사업자: {
    icon: Users,
    color: '#1d4ed8',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.3)',
    gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  },
  법인: {
    icon: Building2,
    color: '#6d28d9',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.3)',
    gradient: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
  },
}

const SCORE_COLOR = (score: number) => {
  if (score >= 90) return '#00a86b'
  if (score >= 80) return '#00c7a9'
  if (score >= 70) return '#f0a500'
  return '#e87c00'
}

function ScoreBadge({ score }: { score: number }) {
  const color = SCORE_COLOR(score)
  return (
    <div className="dm-score-badge" style={{ '--score-color': color } as React.CSSProperties}>
      <svg width={44} height={44} viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={5} />
        <motion.circle
          cx="22" cy="22" r="18" fill="none"
          stroke={color} strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 18}
          initial={{ strokeDashoffset: 2 * Math.PI * 18 }}
          animate={{ strokeDashoffset: 2 * Math.PI * 18 * (1 - score / 100) }}
          transform="rotate(-90 22 22)"
          transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        />
      </svg>
      <span className="dm-score-num" style={{ color }}>{score}</span>
    </div>
  )
}

function OpportunityCard({ opp, index }: { opp: DemoCustomer['opportunities'][number]; index: number }) {
  const [open, setOpen] = useState(index === 0)
  return (
    <motion.div
      className="dm-opp-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <button className="dm-opp-header" onClick={() => setOpen(v => !v)}>
        <div className="dm-opp-rank">TOP {opp.rank}</div>
        <div className="dm-opp-title-wrap">
          <span className="dm-opp-title">{opp.title}</span>
        </div>
        <ScoreBadge score={opp.score} />
        <div className="dm-opp-chevron">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="dm-opp-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            {/* 분석 근거 */}
            <div className="dm-section">
              <div className="dm-section-label">
                <Target size={13} />AI 분석 근거
              </div>
              <ul className="dm-analysis-list">
                {opp.analysisPoints.map((pt, i) => (
                  <li key={i} className="dm-analysis-item">
                    <span className="dm-analysis-dot" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>

            {/* 추천 멘트 */}
            <div className="dm-section">
              <div className="dm-section-label">
                <BadgeCheck size={13} />추천 상담 멘트
              </div>
              <blockquote className="dm-script">{opp.script}</blockquote>
            </div>

            {/* 기대 효과 */}
            <div className="dm-effects">
              <div className="dm-effect-item dm-effect-customer">
                <span className="dm-effect-label">고객 혜택</span>
                <span className="dm-effect-value">{opp.customerBenefit}</span>
              </div>
              <div className="dm-effect-item dm-effect-bank">
                <span className="dm-effect-label">은행 효과</span>
                <span className="dm-effect-value">{opp.bankBenefit}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function AnalysisPanel({ customer }: { customer: DemoCustomer }) {
  const cfg = TYPE_CONFIG[customer.type]
  const Icon = cfg.icon

  return (
    <motion.div
      key={customer.id}
      className="dm-panel"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* 고객 헤더 */}
      <div className="dm-panel-header" style={{ background: cfg.gradient }}>
        <div className="dm-panel-type-icon">
          <Icon size={22} />
        </div>
        <div className="dm-panel-header-info">
          <div className="dm-panel-name">
            {customer.name}
            <span className="dm-panel-type-badge">{customer.type}</span>
          </div>
          <div className="dm-panel-sub">
            {customer.age ? `${customer.age}세 · ` : ''}{customer.job}
          </div>
        </div>
        <div className="dm-panel-visit">
          <span className="dm-visit-label">내점 업무</span>
          <span className="dm-visit-value">{customer.visitPurpose}</span>
        </div>
      </div>

      {/* AI 이벤트 감지 */}
      <div className="dm-event-banner">
        <Sparkles size={14} />
        <span className="dm-event-label">AI 감지 이벤트</span>
        <span className="dm-event-value">{customer.aiEvent}</span>
      </div>

      <div className="dm-panel-body">
        {/* AI 요약 */}
        <div className="dm-card">
          <div className="dm-card-title">
            <BotMessageSquare size={14} />AI 고객 분석 요약
          </div>
          <p className="dm-summary">{customer.summary}</p>
        </div>

        {/* 핵심 데이터 */}
        <div className="dm-card">
          <div className="dm-card-title">
            <TrendingUp size={14} />핵심 데이터
          </div>
          <div className="dm-metrics-grid">
            {customer.keyMetrics.map(m => (
              <div key={m.label} className={`dm-metric${m.highlight ? ' dm-metric--highlight' : ''}`}>
                <span className="dm-metric-label">{m.label}</span>
                <span className="dm-metric-value">{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 추천 영업기회 */}
        <div className="dm-card">
          <div className="dm-card-title">
            <Zap size={14} />추천 영업기회 TOP 3
          </div>
          <div className="dm-opp-list">
            {customer.opportunities.map((opp, i) => (
              <OpportunityCard key={opp.rank} opp={opp} index={i} />
            ))}
          </div>
        </div>

        {/* 핵심 메시지 */}
        <div className="dm-core-message">
          <Lightbulb size={15} />
          <span>{customer.coreMessage}</span>
        </div>
      </div>
    </motion.div>
  )
}

export function DemoPage() {
  useDocumentTitle('AI 영업 시연 — iM Agent')
  const [selected, setSelected] = useState<DemoCustomer>(DEMO_CUSTOMERS[0])

  return (
    <section className="dm-page">
      {/* 히어로 */}
      <div className="dm-hero">
        <div className="dm-hero-icon">
          <BotMessageSquare size={28} />
        </div>
        <div>
          <h1 className="dm-hero-title">AI 영업 시연</h1>
          <p className="dm-hero-sub">
            고객의 거래 흐름·소비 패턴·자금 이동 이벤트를 분석해 <strong>지금 이 제안이 필요한 이유</strong>를 설명합니다
          </p>
        </div>
      </div>

      {/* 차별화 포인트 배너 */}
      <div className="dm-diff-banner">
        <AlertCircle size={14} />
        <span>
          기존 창구 영업은 <em>보유하지 않은 상품</em> 기준으로 제안했다면,
          iM Agent는 <em>거래 흐름과 이벤트</em>를 분석해 <em>왜 지금</em> 이 제안인지 설명합니다.
        </span>
      </div>

      <div className="dm-layout">
        {/* 왼쪽: 고객 선택 */}
        <div className="dm-left">
          <div className="dm-section-heading">고객 선택</div>
          <div className="dm-customer-list">
            {DEMO_CUSTOMERS.map(c => {
              const cfg = TYPE_CONFIG[c.type]
              const Icon = cfg.icon
              const isActive = selected.id === c.id
              return (
                <button
                  key={c.id}
                  className={`dm-customer-card${isActive ? ' dm-customer-card--active' : ''}`}
                  onClick={() => setSelected(c)}
                  style={isActive ? {
                    borderColor: cfg.color,
                    boxShadow: `0 0 0 2px ${cfg.border}`,
                  } : {}}
                >
                  <div
                    className="dm-customer-type-icon"
                    style={{ background: isActive ? cfg.gradient : cfg.bg, color: isActive ? '#fff' : cfg.color }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="dm-customer-info">
                    <div className="dm-customer-name">
                      {c.name}
                      <span
                        className="dm-customer-type-badge"
                        style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                      >
                        {c.type}
                      </span>
                    </div>
                    <div className="dm-customer-purpose">{c.visitPurpose}</div>
                    <div className="dm-customer-event">
                      <Sparkles size={11} />{c.aiEvent}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* 구분선 + 핵심 제안 요약 */}
          <div className="dm-summary-box">
            <div className="dm-summary-title">
              <Target size={13} />이번 시연의 핵심
            </div>
            <ul className="dm-summary-list">
              <li><strong>개인</strong> — 생활 이벤트 감지 → 주거래 전환</li>
              <li><strong>개인사업자</strong> — 매출 흐름 분석 → 사업자 금융 연계</li>
              <li><strong>법인</strong> — 반복 업무 분석 → 자금관리 효율화</li>
            </ul>
          </div>
        </div>

        {/* 오른쪽: AI 분석 결과 */}
        <div className="dm-right">
          <AnimatePresence mode="wait">
            <AnalysisPanel key={selected.id} customer={selected} />
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
