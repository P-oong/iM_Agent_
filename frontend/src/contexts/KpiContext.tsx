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
  { level: 1, name: '신입행원', emoji: '🌱', min: 0,    max: 100  },
  { level: 2, name: '일반행원', emoji: '📋', min: 100,  max: 250  },
  { level: 3, name: '숙련행원', emoji: '⭐', min: 250,  max: 500  },
  { level: 4, name: '전문행원', emoji: '🏅', min: 500,  max: 800  },
  { level: 5, name: '달인',     emoji: '💎', min: 800,  max: 1200 },
  { level: 6, name: 'MVP',      emoji: '👑', min: 1200, max: 9999 },
] as const

// ── 타입 ────────────────────────────────────────────
export interface Toast {
  id: number
  points: number
  label: string
}

export interface LevelInfo {
  level: number
  name: string
  emoji: string
  progress: number   // 0-1 (현재 레벨 내 진척도)
  current: number    // 현재 레벨 내 점수
  needed: number     // 현재 레벨 총 필요 점수
  totalPoints: number
}

export interface KpiContextValue {
  totalPoints: number
  levelInfo: LevelInfo
  toasts: Toast[]
  completed: Set<string>
  addKpi: (points: number, label: string, key?: string) => void
}

// ── 레벨 계산 ────────────────────────────────────────
export function getLevelInfo(total: number): LevelInfo {
  const lv =
    KPI_LEVELS.find(l => total >= l.min && total < l.max) ??
    KPI_LEVELS[KPI_LEVELS.length - 1]

  const range = lv.max === 9999 ? 800 : lv.max - lv.min
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

// ── Context ──────────────────────────────────────────
const KpiContext = createContext<KpiContextValue | null>(null)

let _tid = 0

export function KpiProvider({ children }: { children: ReactNode }) {
  const [totalPoints, setTotalPoints] = useState(120) // 데모: level 2 시작
  const [toasts, setToasts] = useState<Toast[]>([])
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const addKpi = useCallback((points: number, label: string, key?: string) => {
    setTotalPoints(p => p + points)
    if (key) setCompleted(prev => new Set([...prev, key]))
    const id = ++_tid
    setToasts(prev => [...prev, { id, points, label }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2600)
  }, [])

  const levelInfo = useMemo(() => getLevelInfo(totalPoints), [totalPoints])

  return (
    <KpiContext.Provider value={{ totalPoints, levelInfo, toasts, completed, addKpi }}>
      {children}
    </KpiContext.Provider>
  )
}

export function useKpi() {
  const ctx = useContext(KpiContext)
  if (!ctx) throw new Error('useKpi must be inside <KpiProvider>')
  return ctx
}
