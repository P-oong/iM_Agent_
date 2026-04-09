import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

// ── 레벨 테이블 ──────────────────────────────────────
export const KPI_LEVELS = [
  { level: 1, name: '신입행원', emoji: '🌱', min: 0,   max: 5   },
  { level: 2, name: '일반행원', emoji: '📋', min: 5,   max: 15  },
  { level: 3, name: '숙련행원', emoji: '⭐', min: 15,  max: 30  },
  { level: 4, name: '전문행원', emoji: '🏅', min: 30,  max: 60  },
  { level: 5, name: '달인',     emoji: '💎', min: 60,  max: 100 },
  { level: 6, name: 'MVP',      emoji: '👑', min: 100, max: 9999 },
] as const

export type KpiMode = 'default' | 'mastercard' | 'cheongyak'

export interface Toast {
  id: number
  points: number
  label: string
  mode: KpiMode
}

export interface LevelInfo {
  level: number
  name: string
  emoji: string
  progress: number
  current: number
  needed: number
  totalPoints: number
}

export interface KpiContextValue {
  mode: KpiMode
  setMode: (m: KpiMode) => void
  /** 현재 모드 기준 표시용 총점 */
  activeTotalPoints: number
  /** 기본 KPI */
  defaultPoints: number
  mastercardPoints: number
  cheongyakPoints: number
  levelInfo: LevelInfo
  toasts: Toast[]
  /** 현재 모드에서의 완료 키 조회 */
  isOppCompleted: (customerNo: string, oppKey: string) => boolean
  addKpi: (points: number, label: string, key?: string, customerNo?: string) => void
}

export function getLevelInfo(total: number): LevelInfo {
  const lv =
    KPI_LEVELS.find(l => total >= l.min && total < l.max) ??
    KPI_LEVELS[KPI_LEVELS.length - 1]

  const range = lv.max === 9999 ? 100 : lv.max - lv.min
  const progress = Math.min((total - lv.min) / range, 1)

  return {
    level: lv.level,
    name: lv.name,
    emoji: lv.emoji,
    progress,
    current: total - lv.min,
    needed: range,
    totalPoints: total,
  }
}

const KpiContext = createContext<KpiContextValue | null>(null)

let _tid = 0

function makeKey(mode: KpiMode, customerNo: string | undefined, oppKey: string) {
  const prefix = mode === 'mastercard' ? 'mc' : mode === 'cheongyak' ? 'cq' : 'def'
  return customerNo ? `${prefix}:${customerNo}:${oppKey}` : `${prefix}::${oppKey}`
}

export function KpiProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<KpiMode>('default')
  const [defaultPoints, setDefaultPoints] = useState(2)
  const [mastercardPoints, setMastercardPoints] = useState(6.5)
  const [cheongyakPoints, setCheongyakPoints] = useState(4)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [completedDefault, setCompletedDefault] = useState<Set<string>>(new Set())
  const [completedMc, setCompletedMc] = useState<Set<string>>(new Set())
  const [completedCheongyak, setCompletedCheongyak] = useState<Set<string>>(new Set())

  const levelInfo = useMemo(() => getLevelInfo(defaultPoints), [defaultPoints])

  const activeTotalPoints =
    mode === 'default' ? defaultPoints : mode === 'mastercard' ? mastercardPoints : cheongyakPoints

  const isOppCompleted = useCallback(
    (customerNo: string, oppKey: string) => {
      const k = makeKey(mode, customerNo, oppKey)
      const set =
        mode === 'default' ? completedDefault : mode === 'mastercard' ? completedMc : completedCheongyak
      return set.has(k)
    },
    [mode, completedDefault, completedMc, completedCheongyak],
  )

  const addKpi = useCallback(
    (points: number, label: string, key?: string, customerNo?: string) => {
      const m = mode
      if (m === 'default') {
        setDefaultPoints(p => p + points)
        if (key && customerNo) {
          const k = makeKey('default', customerNo, key)
          setCompletedDefault(prev => new Set([...prev, k]))
        }
      } else if (m === 'mastercard') {
        setMastercardPoints(p => Math.round((p + points) * 10) / 10)
        if (key && customerNo) {
          const k = makeKey('mastercard', customerNo, key)
          setCompletedMc(prev => new Set([...prev, k]))
        }
      } else {
        setCheongyakPoints(p => Math.round((p + points) * 10) / 10)
        if (key && customerNo) {
          const k = makeKey('cheongyak', customerNo, key)
          setCompletedCheongyak(prev => new Set([...prev, k]))
        }
      }
      const id = ++_tid
      setToasts(prev => [...prev, { id, points, label, mode: m }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2600)
    },
    [mode],
  )

  const value = useMemo<KpiContextValue>(
    () => ({
      mode,
      setMode,
      activeTotalPoints,
      defaultPoints,
      mastercardPoints,
      cheongyakPoints,
      levelInfo,
      toasts,
      isOppCompleted,
      addKpi,
    }),
    [
      mode,
      activeTotalPoints,
      defaultPoints,
      mastercardPoints,
      cheongyakPoints,
      levelInfo,
      toasts,
      isOppCompleted,
      addKpi,
    ],
  )

  return <KpiContext.Provider value={value}>{children}</KpiContext.Provider>
}

export function useKpi() {
  const ctx = useContext(KpiContext)
  if (!ctx) throw new Error('useKpi must be inside <KpiProvider>')
  return ctx
}
