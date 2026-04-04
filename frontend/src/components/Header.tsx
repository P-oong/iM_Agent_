import { NavLink } from 'react-router-dom'
import { APP_NAME } from '@/constants/app'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link nav-link--active' : 'nav-link'

export function Header() {
  return (
    <header className="app-header">
      <NavLink to="/" className="app-brand" end>
        {APP_NAME}
      </NavLink>
      <nav className="app-nav" aria-label="주 메뉴">
        <NavLink to="/" className={linkClass} end>
          홈
        </NavLink>
        <NavLink to="/banking/0125" className={linkClass}>
          전산화면
        </NavLink>
        <NavLink to="/about" className={linkClass}>
          소개
        </NavLink>
      </nav>
    </header>
  )
}
