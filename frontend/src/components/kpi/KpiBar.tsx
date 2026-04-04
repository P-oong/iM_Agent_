import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { useKpi } from '@/contexts/KpiContext'
import '@/styles/kpi.css'

interface KpiBarProps {
  inline?: boolean
}

// 애니메이션 숫자 카운터
function AnimatedNumber({ value }: { value: number }) {
  const motionVal = useMotionValue(value)
  const rounded = useTransform(motionVal, v => Math.round(v).toLocaleString())

  useEffect(() => {
    const ctrl = animate(motionVal, value, { duration: 0.6, ease: 'easeOut' })
    return ctrl.stop
  }, [value, motionVal])

  return <motion.span>{rounded}</motion.span>
}

// SVG 원형 프로그레스 링
function RingProgress({ pct, size = 52, stroke = 5 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (pct / 100) * circumference

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {/* 트랙 */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      {/* 채움 */}
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#kpiGrad)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
      />
      <defs>
        <linearGradient id="kpiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#00c7a9" />
          <stop offset="100%" stopColor="#00f0d0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function KpiBar({ inline = false }: KpiBarProps) {
  const { levelInfo, toasts } = useKpi()
  const pct = Math.round(levelInfo.progress * 100)
  const remaining = levelInfo.needed - levelInfo.current

  if (inline) {
    return (
      <div className="kpi-inline">
        {/* 원형 링 */}
        <div className="kpi-ring-wrap">
          <RingProgress pct={pct} />
          <div className="kpi-ring-center">
            <span className="kpi-badge-emoji" style={{ fontSize: 16 }}>{levelInfo.emoji}</span>
            <span className="kpi-badge-lv" style={{ fontSize: 8 }}>Lv.{levelInfo.level}</span>
          </div>
        </div>

        {/* 텍스트 정보 */}
        <div className="kpi-inline-info">
          <div className="kpi-inline-top">
            <span className="kpi-name">{levelInfo.name}</span>
            <span className="kpi-pts">
              <AnimatedNumber value={levelInfo.totalPoints} />
              <span className="kpi-pts-unit">점</span>
            </span>
          </div>

          {/* 프로그레스 바 */}
          <div className="kpi-track" style={{ margin: '5px 0' }}>
            <motion.div
              className="kpi-fill"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
            />
          </div>

          <div className="kpi-inline-bottom">
            <span className="kpi-inline-sub">레벨업까지</span>
            <span className="kpi-inline-remain">
              <AnimatedNumber value={remaining} />
              <span className="kpi-pts-unit"> 점</span>
            </span>
          </div>
        </div>
      </div>
    )
  }

  // 토스트 전용 (글로벌)
  return (
    <div className="kpi-root" aria-live="polite">
      {toasts.map(t => (
        <motion.div
          key={t.id}
          className="kpi-toast"
          initial={{ x: 60, opacity: 0, scale: 0.85 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <span className="kpi-toast-pts">+{t.points}</span>
          <span className="kpi-toast-lbl">{t.label}</span>
        </motion.div>
      ))}
    </div>
  )
}
