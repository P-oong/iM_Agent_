import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import '@/styles/banking.css'
import '@/styles/banking-nav.css'

/** 등록된 화면 코드 → 라우트 매핑 */
const SCREEN_ROUTES: Record<string, string> = {
  '0156': '/banking/0156',
  '0125': '/banking/0125',
  '0000': '/banking/template',
}

/** 4자리 숫자를 라우트로 변환 — 없으면 기본 /banking/{code} */
function resolveRoute(code: string): string {
  return SCREEN_ROUTES[code] ?? `/banking/${code}`
}

export function BankingLayout() {
  const navigate = useNavigate()
  const navRef   = useRef<HTMLInputElement>(null)

  const [navCode,   setNavCode]   = useState('')
  const [navActive, setNavActive] = useState(false)
  const [flash,     setFlash]     = useState(false)   // 이동 성공 깜빡임

  // 전역 * 키 → 네비 입력창 활성화
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select'

      if (e.key === '*') {
        e.preventDefault()
        setNavCode('')
        setNavActive(true)
        // 이미 입력창이면 select, 아니면 focus
        if (navRef.current === document.activeElement) {
          navRef.current?.select()
        } else {
          navRef.current?.focus()
        }
      }

      // 입력창 밖에서 Escape → 비활성화
      if (e.key === 'Escape' && !inInput) {
        setNavCode('')
        setNavActive(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const doNavigate = () => {
    if (navCode.length < 4) return
    const route = resolveRoute(navCode)
    setFlash(true)
    setTimeout(() => {
      setFlash(false)
      navigate(route)
      setNavCode('')
      setNavActive(false)
      navRef.current?.blur()
    }, 120)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'Enter') {
      e.preventDefault()
      doNavigate()
    }
    if (e.key === 'Escape') {
      setNavCode('')
      setNavActive(false)
      navRef.current?.blur()
    }
  }

  return (
    <div className="bk-app">
      <div className={`bk-topnav${flash ? ' bk-topnav--flash' : ''}`}>
        <Link to="/" className="bk-topnav-home">← 메인</Link>
        <span className="bk-topnav-brand">iM Agent</span>

        {/* ── 화면 번호 네비게이션 ── */}
        <div className={`bk-nav-cmd${navActive ? ' bk-nav-cmd--active' : ''}`}
          title="* 키로 활성화, 화면번호 입력 후 - 또는 Enter">
          <span className="bk-nav-star">✱</span>
          <input
            ref={navRef}
            className="bk-nav-input"
            maxLength={4}
            placeholder="0000"
            value={navCode}
            onChange={e => setNavCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={handleKeyDown}
            onFocus={() => setNavActive(true)}
            onBlur={() => { if (!navCode) setNavActive(false) }}
            aria-label="화면번호 입력"
          />
          <span className="bk-nav-sep">/</span>
          <button
            className="bk-nav-go"
            onClick={doNavigate}
            tabIndex={-1}
            disabled={navCode.length < 4}
          >
            이동
          </button>
        </div>

        {/* 도움말 */}
        <span className="bk-nav-help">
          ✱ 눌러 화면번호 입력 &nbsp;·&nbsp; [-] 이동
        </span>
      </div>
      <Outlet />
    </div>
  )
}
