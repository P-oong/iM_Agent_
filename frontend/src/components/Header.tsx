import { BotMessageSquare } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link nav-link--active' : 'nav-link'

export function Header() {
  return (
    <header className="app-header">
      {/* 로고 + 브랜드 */}
      <NavLink to="/" className="app-brand" end>
        <span className="app-brand-icon">
          <BotMessageSquare size={18} strokeWidth={2.2} />
        </span>
        <span className="app-brand-text">iM Agent</span>
      </NavLink>

      {/* 네비게이션 */}
      <nav className="app-nav" aria-label="주 메뉴">
        <NavLink to="/" className={linkClass} end>홈</NavLink>
        <NavLink to="/ai" className={linkClass}>AI 분석</NavLink>
        <NavLink to="/banking/0156" className={linkClass}>전산화면</NavLink>
        <NavLink to="/about" className={linkClass}>소개</NavLink>
      </nav>
    </header>
  )
}
