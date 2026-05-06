import { AnimatePresence, motion } from 'framer-motion'
import { TrendingUp, User, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { KpiBar } from '@/components/kpi/KpiBar'
import '@/styles/sidebar.css'
import { CrmPanel } from './CrmPanel'
import { ExchangePanel } from './ExchangePanel'
import { TellerPanel } from './TellerPanel'

type Panel = 'teller' | 'exchange' | 'crm' | null

const BUTTONS: { key: Exclude<Panel, null>; label: string; sub: string; Icon: React.ElementType }[] = [
  { key: 'teller',   label: '시재', sub: '간편조회', Icon: Wallet     },
  { key: 'exchange', label: '환율', sub: '',         Icon: TrendingUp },
  { key: 'crm',      label: 'CRM', sub: '고객정보',  Icon: User       },
]

const PANEL_TITLE: Record<Exclude<Panel, null>, string> = {
  teller:   '시재 간편조회',
  exchange: '환율',
  crm:      '고객정보 (CRM)',
}

const drawerVariants = {
  hidden:  { x: '100%', opacity: 0 },
  visible: { x: 0,      opacity: 1, transition: { type: 'spring' as const, stiffness: 320, damping: 30 } },
  exit:    { x: '100%', opacity: 0, transition: { duration: 0.18, ease: 'easeIn' as const } },
}

export function RightSidebar() {
  const [open, setOpen] = useState<Panel>(null)
  const rootRef         = useRef<HTMLDivElement>(null)
  const bodyRef         = useRef<HTMLDivElement>(null)

  // ────────────────────────────────────────────────────────
  const toggle = (p: Exclude<Panel, null>) =>
    setOpen(prev => (prev === p ? null : p))

  // 패널 열릴 때 스크롤 맨 위로
  useEffect(() => {
    if (!open) return
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
        {open && (
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
