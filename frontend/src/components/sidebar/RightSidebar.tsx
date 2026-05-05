import { AnimatePresence, motion } from 'framer-motion'
import { BotMessageSquare, TrendingUp, User, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { KpiBar } from '@/components/kpi/KpiBar'
import { useCustomer } from '@/contexts/CustomerContext'
import { MOCK_DB } from '@/data/mockCustomers'
import {
  analyzeCustomerWithGpt,
  type AiAnalysisResult,
  type CustomerForAnalysis,
} from '@/services/openaiApi'
import '@/styles/sidebar.css'
import { AiAnalysisPanel, type AiPhase } from './AiAnalysisPanel'
import { CrmPanel } from './CrmPanel'
import { ExchangePanel } from './ExchangePanel'
import { TellerPanel } from './TellerPanel'

type Panel = 'teller' | 'exchange' | 'crm' | 'ai' | null

const BUTTONS: { key: Exclude<Panel, null>; label: string; sub: string; Icon: React.ElementType }[] = [
  { key: 'teller',   label: '시재', sub: '간편조회', Icon: Wallet           },
  { key: 'exchange', label: '환율', sub: '',         Icon: TrendingUp       },
  { key: 'crm',      label: 'CRM', sub: '고객정보',  Icon: User             },
  { key: 'ai',       label: 'AI',  sub: '영업분석',  Icon: BotMessageSquare },
]

const PANEL_TITLE: Record<Exclude<Panel, null>, string> = {
  teller:   '시재 간편조회',
  exchange: '환율',
  crm:      '고객정보 (CRM)',
  ai:       'AI 영업기회 분석',
}

const drawerVariants = {
  hidden:  { x: '100%', opacity: 0 },
  visible: { x: 0,      opacity: 1, transition: { type: 'spring' as const, stiffness: 320, damping: 30 } },
  exit:    { x: '100%', opacity: 0, transition: { duration: 0.18, ease: 'easeIn' as const } },
}

function toCustomerForAnalysis(c: (typeof MOCK_DB)[string]): CustomerForAnalysis {
  return {
    name: c.고객명,
    type: c.유형,
    grade: c.등급,
    products: c.보유상품,
    accounts: c.계좌.map(a => ({ product: a.상품, balance: a.잔액 })),
    transactions: c.최근거래.map(t => ({ date: t.일자, description: t.내용, amount: t.금액 })),
    businessInfo: c.사업정보
      ? { companyName: c.사업정보.상호, industry: c.사업정보.업종, annualRevenue: c.사업정보.연매출 }
      : undefined,
    visitPurpose: '영업 상담',
    aiEvent: '내점 고객 영업기회 분석',
  }
}

export function RightSidebar() {
  const [open, setOpen]     = useState<Panel>(null)
  const rootRef             = useRef<HTMLDivElement>(null)
  const bodyRef             = useRef<HTMLDivElement>(null)

  // ── AI 분석 상태 (패널이 닫혀도 유지, 새로고침 시 초기화) ──
  const { activeResidentId } = useCustomer()
  const [aiPhase,    setAiPhase]   = useState<AiPhase>('idle')
  const [aiResult,   setAiResult]  = useState<AiAnalysisResult | null>(null)
  const [aiError,    setAiError]   = useState('')
  const [aiCustId,   setAiCustId]  = useState<string | null>(null)

  // 고객 변경 시 이전 분석 결과 초기화
  useEffect(() => {
    if (activeResidentId === aiCustId) return
    setAiCustId(activeResidentId)
    setAiPhase('idle')
    setAiResult(null)
    setAiError('')
  }, [activeResidentId, aiCustId])

  const aiCustomer = activeResidentId
    ? (MOCK_DB[activeResidentId.slice(0, 6)] ?? null)
    : null

  function runAiAnalysis() {
    if (!aiCustomer) return
    setAiPhase('loading')
    setAiResult(null)
    analyzeCustomerWithGpt(toCustomerForAnalysis(aiCustomer))
      .then(data => { setAiResult(data); setAiPhase('done') })
      .catch(err  => { setAiError(err instanceof Error ? err.message : String(err)); setAiPhase('error') })
  }

  // ────────────────────────────────────────────────────────
  const toggle = (p: Exclude<Panel, null>) =>
    setOpen(prev => (prev === p ? null : p))

  // 패널 열릴 때 스크롤 맨 위로
  useEffect(() => {
    if (!open || open === 'ai') return
    const reset = () => { if (bodyRef.current) bodyRef.current.scrollTop = 0 }
    const raf   = requestAnimationFrame(reset)
    const timer = setTimeout(reset, 120)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [open])

  // 사이드바 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      // 모달 portal 내부 클릭은 무시
      const target = e.target as HTMLElement
      if (target.closest('[data-ai-modal]')) return
      if (rootRef.current && !rootRef.current.contains(target))
        setOpen(null)
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [open])

  return (
    <div ref={rootRef} className={`rs-root${open ? ' rs-root--open' : ''}`}>

      <AnimatePresence>
        {/* ── 일반 패널 (teller / exchange / crm) ── */}
        {open && open !== 'ai' && (
          <motion.aside
            key={open}
            className="rs-drawer"
            aria-label={PANEL_TITLE[open]}
            variants={drawerVariants}
            initial="hidden" animate="visible" exit="exit"
            onAnimationComplete={() => { if (bodyRef.current) bodyRef.current.scrollTop = 0 }}
          >
            <div className="rs-drawer-header">
              <span className="rs-drawer-title">{PANEL_TITLE[open]}</span>
              <button className="rs-close" onClick={() => setOpen(null)} aria-label="닫기">✕</button>
            </div>
            <div ref={bodyRef} className="rs-drawer-body">
              {open === 'teller'   && <TellerPanel />}
              {open === 'exchange' && <ExchangePanel />}
              {open === 'crm'      && <CrmPanel />}
            </div>
            {open === 'crm' && (
              <div className="rs-drawer-footer"><KpiBar inline /></div>
            )}
          </motion.aside>
        )}

        {/* ── AI 분석 패널 (key 고정 → 상태 유지하며 슬라이드) ── */}
        {open === 'ai' && (
          <motion.aside
            key="ai-panel"
            className="rs-drawer"
            aria-label={PANEL_TITLE['ai']}
            variants={drawerVariants}
            initial="hidden" animate="visible" exit="exit"
          >
            <div className="rs-drawer-header">
              <span className="rs-drawer-title">{PANEL_TITLE['ai']}</span>
              <button className="rs-close" onClick={() => setOpen(null)} aria-label="닫기">✕</button>
            </div>
            <div className="rs-drawer-body rs-drawer-body--noscroll">
              <AiAnalysisPanel
                customerName={aiCustomer?.고객명 ?? ''}
                customerType={aiCustomer?.유형 ?? ''}
                phase={aiPhase}
                result={aiResult}
                errorMsg={aiError}
                onRun={runAiAnalysis}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 세로 버튼 바 */}
      <div className="rs-bar" role="complementary" aria-label="빠른 메뉴">
        {BUTTONS.map(({ key, label, sub, Icon }) => (
          <button
            key={key}
            className={`rs-btn${open === key ? ' rs-btn--active' : ''}`}
            onClick={() => toggle(key)}
            aria-pressed={open === key}
          >
            <Icon size={18} strokeWidth={2} />
            <span className="rs-btn-label">{label}</span>
            {sub && <span className="rs-btn-sub">{sub}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
