import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import '@/styles/banking.css'
import '@/styles/banking-nav.css'

// ── 화면 코드 → 라우트 ───────────────────────────────
const SCREEN_ROUTES: Record<string, string> = {
  '0156': '/banking/0156',
  '0310': '/banking/0310',
}
function resolveRoute(code: string): string {
  return SCREEN_ROUTES[code] ?? `/banking/${code}`
}

// ── 화면 경로 → 메타 ─────────────────────────────────
const SCREEN_META: Record<string, { code: string; name: string }> = {
  '/banking/0156': { code: '0156', name: '고객실명조회' },
  '/banking/0310': { code: '0310', name: '카드 발급 조회' },
}

// ── 카테고리 탭 ──────────────────────────────────────
const CATEGORIES = [
  { label: '전체',    catId: 'all'      },
  { label: '고객/신용', catId: 'customer' },
  { label: '수신',    catId: 'deposit'  },
  { label: '대출',    catId: 'loan'     },
  { label: '카드',    catId: 'card'     },
  { label: '전자금융', catId: 'digital'  },
  { label: '공과금',  catId: 'tax'      },
] as const

type BkTab = { path: string; code: string; name: string }

// ─────────────────────────────────────────────────────
export function BankingLayout() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const navRef     = useRef<HTMLInputElement>(null)

  const [navCode,   setNavCode]   = useState('')
  const [navActive, setNavActive] = useState(false)
  const [flash,     setFlash]     = useState(false)
  const [activeCat, setActiveCat] = useState('all')
  const [tabs,      setTabs]      = useState<BkTab[]>([])

  // 카테고리 경로 → 활성 탭 동기화
  useEffect(() => {
    const m = location.pathname.match(/^\/banking\/cat\/(.+)$/)
    if (m) setActiveCat(m[1])
    else if (location.pathname === '/banking' || location.pathname === '/banking/') setActiveCat('all')
  }, [location.pathname])

  // 현재 경로 → 탭 자동 추가
  useEffect(() => {
    const meta = SCREEN_META[location.pathname]
    if (!meta) return
    setTabs(prev =>
      prev.find(t => t.path === location.pathname)
        ? prev
        : [...prev, { path: location.pathname, ...meta }]
    )
  }, [location.pathname])

  // * 키 → 네비 입력창 활성화
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select'
      if (e.key === '*') {
        e.preventDefault()
        setNavCode(''); setNavActive(true)
        navRef.current === document.activeElement
          ? navRef.current?.select()
          : navRef.current?.focus()
      }
      if (e.key === 'Escape' && !inInput) { setNavCode(''); setNavActive(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const doNavigate = () => {
    if (navCode.length < 4) return
    const route = resolveRoute(navCode)
    setFlash(true)
    setTimeout(() => {
      setFlash(false); navigate(route)
      setNavCode(''); setNavActive(false); navRef.current?.blur()
    }, 120)
  }
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'Enter') { e.preventDefault(); doNavigate() }
    if (e.key === 'Escape') { setNavCode(''); setNavActive(false); navRef.current?.blur() }
  }

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTabs(prev => {
      const idx  = prev.findIndex(t => t.path === path)
      const next = prev.filter(t => t.path !== path)
      if (location.pathname === path) {
        if (next.length > 0) navigate(next[Math.max(0, idx - 1)].path)
        else navigate('/')
      }
      return next
    })
  }

  return (
    <div className={`bk-app${flash ? ' bk-app--flash' : ''}`}>

      {/* ── 통합 상단 바 (브랜드 + 카테고리 + 화면번호 입력) ── */}
      <div className="bk-topbar">
        {/* 왼쪽: 홈 + 브랜드 */}
        <Link to="/" className="bk-topbar-home" title="메인으로">
          <span className="bk-topbar-home-icon">←</span>
        </Link>
        <span className="bk-topbar-brand">iM Agent</span>
        <span className="bk-topbar-divider" />

        {/* 카테고리 탭 */}
        <nav className="bk-catbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat.catId}
              className={`bk-catbar-btn${activeCat === cat.catId ? ' bk-catbar-btn--active' : ''}`}
              onClick={() => {
                setActiveCat(cat.catId)
                navigate(`/banking/cat/${cat.catId}`)
              }}
            >
              {cat.label}
            </button>
          ))}
        </nav>

        {/* 오른쪽: 화면번호 입력 */}
        <div
          className={`bk-nav-cmd${navActive ? ' bk-nav-cmd--active' : ''}`}
          title="* 키로 활성화 → 화면번호 4자리 → [-] 이동"
        >
          <span className="bk-nav-star">✱</span>
          <input
            ref={navRef} className="bk-nav-input" maxLength={4} placeholder="0000"
            value={navCode}
            onChange={e => setNavCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={handleKeyDown}
            onFocus={() => setNavActive(true)}
            onBlur={() => { if (!navCode) setNavActive(false) }}
            aria-label="화면번호 입력"
          />
          <button
            className="bk-nav-go"
            onClick={doNavigate}
            tabIndex={-1}
            disabled={navCode.length < 4}
          >
            이동
          </button>
        </div>
      </div>

      {/* ── 멀티탭 바 (열린 화면들) ── */}
      {tabs.length > 0 && (
        <div className="bk-tabbar">
          {tabs.map(tab => (
            <button
              key={tab.path}
              className={`bk-tab${location.pathname === tab.path ? ' bk-tab--active' : ''}`}
              onClick={() => navigate(tab.path)}
            >
              <span className="bk-tab-code">{tab.code}</span>
              <span className="bk-tab-name">{tab.name}</span>
              <span
                className="bk-tab-close"
                role="button"
                onClick={e => closeTab(tab.path, e)}
                title="탭 닫기"
              >×</span>
            </button>
          ))}
        </div>
      )}

      {/* ── 메인 콘텐츠 ── */}
      <div className="bk-body">
        <div className="bk-main">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
