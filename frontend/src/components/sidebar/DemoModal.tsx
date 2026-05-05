import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  BadgeCheck,
  BotMessageSquare,
  Building2,
  Lightbulb,
  Loader2,
  Sparkles,
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
import '@/styles/demo-modal.css'

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
}

export function DemoModal({ demo, customerName, customer, onClose }: DemoModalProps) {
  const [phase, setPhase] = useState<'loading' | 'done' | 'error'>('loading')
  const [result, setResult] = useState<AiAnalysisResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const cfg = TYPE_CONFIG[demo.type]
  const TypeIcon = cfg.Icon

  // GPT 분석 호출
  useEffect(() => {
    let cancelled = false
    analyzeCustomerWithGpt(customer)
      .then(data => {
        if (!cancelled) {
          setResult(data)
          setPhase('done')
        }
      })
      .catch(err => {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : String(err))
          setPhase('error')
        }
      })
    return () => { cancelled = true }
  }, [customer])

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
            <div className="dmo-header-visit">
              <span className="dmo-visit-label">내점 목적</span>
              <span className="dmo-visit-value">{demo.visitPurpose}</span>
            </div>
            <button className="dmo-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* 이벤트 배너 */}
          <div className="dmo-event-banner">
            <Sparkles size={14} />
            <span className="dmo-event-label">AI 감지 이벤트</span>
            <span className="dmo-event-value">{demo.aiEvent}</span>
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
                  <div className="dmo-loading-icon">
                    <BotMessageSquare size={36} />
                    <motion.div
                      className="dmo-loading-ring"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 size={56} />
                    </motion.div>
                  </div>
                  <p className="dmo-loading-title">GPT-4.1로 고객 분석 중...</p>
                  <p className="dmo-loading-sub">거래 흐름 · 소비 패턴 · 자금 이동 이벤트를 분석합니다</p>
                  <div className="dmo-loading-steps">
                    {[
                      '고객 거래 데이터 수집',
                      '소비 패턴 및 이벤트 감지',
                      '영업 기회 우선순위 산정',
                    ].map((step, i) => (
                      <motion.div
                        key={step}
                        className="dmo-loading-step"
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.4 }}
                      >
                        <motion.span
                          className="dmo-step-dot"
                          animate={{ scale: [1, 1.4, 1] }}
                          transition={{ delay: i * 0.4 + 0.2, duration: 0.5 }}
                        />
                        {step}
                      </motion.div>
                    ))}
                  </div>
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
                  {/* 요약 */}
                  <motion.div
                    className="dmo-card"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="dmo-card-title">
                      <BotMessageSquare size={15} />AI 고객 분석 요약
                    </div>
                    <p className="dmo-summary">{result.summary}</p>
                  </motion.div>

                  {/* 핵심 데이터 */}
                  <motion.div
                    className="dmo-card"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.07 }}
                  >
                    <div className="dmo-card-title">
                      <TrendingUp size={15} />핵심 데이터
                    </div>
                    <div className="dmo-metrics-grid">
                      {result.keyMetrics.map(m => (
                        <div
                          key={m.label}
                          className={`dmo-metric${m.highlight ? ' dmo-metric--hl' : ''}`}
                        >
                          <span className="dmo-metric-label">{m.label}</span>
                          <span className="dmo-metric-value">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* TOP 3 영업기회 */}
                  <div className="dmo-card">
                    <div className="dmo-card-title">
                      <Zap size={15} />추천 영업기회 TOP 3
                    </div>
                    <div className="dmo-opp-list">
                      {result.opportunities.map((opp, i) => (
                        <OppCard key={opp.rank} opp={opp} index={i} />
                      ))}
                    </div>
                  </div>

                  {/* 핵심 메시지 */}
                  <motion.div
                    className="dmo-core-msg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Lightbulb size={16} />
                    <span>{result.coreMessage}</span>
                  </motion.div>
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
