import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getCheongyakTrackDisplay } from '@/data/cheongyakEventData'
import { KPI_TRACK_LIST, isSelectableTrack } from '@/data/kpiEvents'
import { getMcTrackDisplay } from '@/data/mastercardEventData'
import { useKpi } from '@/contexts/KpiContext'
import '@/styles/kpi.css'

interface KpiBarProps {
  inline?: boolean
}

function AnimatedNumber({ value }: { value: number }) {
  const motionVal = useMotionValue(value)
  const rounded = useTransform(motionVal, v => Math.round(v).toLocaleString())

  useEffect(() => {
    const ctrl = animate(motionVal, value, { duration: 0.6, ease: 'easeOut' })
    return ctrl.stop
  }, [value, motionVal])

  return <motion.span>{rounded}</motion.span>
}

function AnimatedDecimal({ value }: { value: number }) {
  const motionVal = useMotionValue(value)
  const text = useTransform(motionVal, v => v.toFixed(1))

  useEffect(() => {
    const ctrl = animate(motionVal, value, { duration: 0.55, ease: 'easeOut' })
    return ctrl.stop
  }, [value, motionVal])

  return <motion.span>{text}</motion.span>
}

function RingProgress({
  pct,
  size = 52,
  stroke = 5,
  variant = 'mint',
}: {
  pct: number
  size?: number
  stroke?: number
  variant?: 'mint' | 'orange' | 'blue'
}) {
  const r = (size - stroke * 2) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (pct / 100) * circumference
  const gradId =
    variant === 'orange' ? 'kpiGradMc' : variant === 'blue' ? 'kpiGradBlue' : 'kpiGradMint'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
      />
      <defs>
        <linearGradient id="kpiGradMint" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#00c7a9" />
          <stop offset="100%" stopColor="#00f0d0" />
        </linearGradient>
        <linearGradient id="kpiGradMc" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#ea580c" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
        <linearGradient id="kpiGradBlue" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#2563eb" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function KpiEventPicker() {
  const { mode, setMode } = useKpi()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const current = KPI_TRACK_LIST.find(o => o.id === mode) ?? KPI_TRACK_LIST[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', close), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', close)
    }
  }, [open])

  return (
    <div className="kpi-event-pick" ref={rootRef}>
      <button
        type="button"
        className="kpi-event-pick-btn"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`실적 구분: ${current.label}`}
        title={current.label}
        onClick={() => setOpen(v => !v)}
      >
        <span className="kpi-event-pick-lbl">{current.compactLabel ?? current.label}</span>
        <ChevronDown size={11} strokeWidth={2.5} className={open ? 'kpi-event-pick-chev--open' : ''} />
      </button>
      {open && (
        <ul className="kpi-event-dropdown" role="listbox">
          {KPI_TRACK_LIST.map(opt => (
            <li key={opt.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={opt.id === mode}
                disabled={opt.disabled}
                className={`kpi-event-opt${opt.id === mode ? ' kpi-event-opt--on' : ''}${opt.disabled ? ' kpi-event-opt--disabled' : ''}`}
                onClick={() => {
                  if (opt.disabled || !isSelectableTrack(opt.id)) return
                  setMode(opt.id)
                  setOpen(false)
                }}
              >
                {opt.label}
                {opt.disabled && <span className="kpi-event-opt-sub">준비중</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function KpiBar({ inline = false }: KpiBarProps) {
  const {
    mode,
    levelInfo,
    mastercardPoints,
    cheongyakPoints,
    toasts,
  } = useKpi()

  const isMc = mode === 'mastercard'
  const isCq = mode === 'cheongyak'
  const mcDisp = useMemo(() => getMcTrackDisplay(mastercardPoints), [mastercardPoints])
  const cqDisp = useMemo(() => getCheongyakTrackDisplay(cheongyakPoints), [cheongyakPoints])

  const pctDefault = Math.round(levelInfo.progress * 100)
  const remainDefault = levelInfo.needed - levelInfo.current

  const ringVariant: 'mint' | 'orange' | 'blue' = isMc ? 'orange' : isCq ? 'blue' : 'mint'
  const ringPct = isMc ? mcDisp.progressPct : isCq ? cqDisp.progressPct : pctDefault
  const ringCenterNum = isMc || isCq ? (isMc ? mcDisp.phase : cqDisp.phase) : levelInfo.level
  const ringCenterSub = isMc || isCq ? '단계' : 'LV'
  const titleEmoji = isMc ? mcDisp.emoji : isCq ? cqDisp.emoji : levelInfo.emoji
  const titleName = isMc ? mcDisp.title : isCq ? cqDisp.title : levelInfo.name
  const bottomLeft = isMc || isCq ? '다음 목표까지' : '레벨업까지'
  const remainVal = isMc ? mcDisp.remainPts : isCq ? cqDisp.remainPts : remainDefault
  const useDecimalRemain = isMc || isCq

  const inlineMod = isMc ? ' kpi-inline--mc' : isCq ? ' kpi-inline--cq' : ''

  if (inline) {
    return (
      <motion.div
        className={`kpi-inline${inlineMod}`}
        layout
        transition={{ duration: 0.2 }}
      >
        <div className="kpi-ring-wrap">
          <RingProgress pct={ringPct} size={42} stroke={4} variant={ringVariant} />
          <div className="kpi-ring-center">
            <span className={`kpi-badge-lv-num${isMc ? ' kpi-badge-lv-num--mc' : ''}${isCq ? ' kpi-badge-lv-num--cq' : ''}`}>{ringCenterNum}</span>
            <span className={`kpi-badge-lv-label${isMc ? ' kpi-badge-lv-label--mc' : ''}${isCq ? ' kpi-badge-lv-label--cq' : ''}`}>{ringCenterSub}</span>
          </div>
        </div>

        <div className="kpi-inline-info">
          <div className="kpi-inline-top">
            <span className={`kpi-name${isMc ? ' kpi-name--mc' : ''}${isCq ? ' kpi-name--cq' : ''}`}>
              <span className="kpi-name-emoji">{titleEmoji}</span>
              {titleName}
            </span>
            <div className="kpi-inline-top-right">
              <KpiEventPicker />
            </div>
          </div>

          <div className={`kpi-track${isMc ? ' kpi-track--mc' : ''}${isCq ? ' kpi-track--cq' : ''}`} style={{ margin: '3px 0' }}>
            <motion.div
              className={`kpi-fill${isMc ? ' kpi-fill--mc' : ''}${isCq ? ' kpi-fill--cq' : ''}`}
              initial={false}
              animate={{ width: `${ringPct}%` }}
              transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
            />
          </div>

          <div className="kpi-inline-bottom">
            <span className={`kpi-inline-sub${isMc ? ' kpi-inline-sub--mc' : ''}${isCq ? ' kpi-inline-sub--cq' : ''}`}>{bottomLeft}</span>
            <span className={`kpi-inline-remain${isMc ? ' kpi-inline-remain--mc' : ''}${isCq ? ' kpi-inline-remain--cq' : ''}`}>
              {useDecimalRemain
                ? <AnimatedDecimal value={remainVal} />
                : <AnimatedNumber value={remainVal} />}
              <span className="kpi-pts-unit"> pt</span>
            </span>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="kpi-root" aria-live="polite">
      {toasts.map(t => (
        <motion.div
          key={t.id}
          className={
            t.mode === 'mastercard' ? 'kpi-toast kpi-toast--mc'
            : t.mode === 'cheongyak' ? 'kpi-toast kpi-toast--cq'
            : 'kpi-toast'
          }
          initial={{ x: 60, opacity: 0, scale: 0.85 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <span className="kpi-toast-pts">
            +{Number.isInteger(t.points) ? t.points : t.points.toFixed(1)}
          </span>
          <span className="kpi-toast-lbl">{t.label}</span>
        </motion.div>
      ))}
    </div>
  )
}
