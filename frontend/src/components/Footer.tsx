import { BotMessageSquare } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="app-footer">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
        <BotMessageSquare size={14} style={{ color: 'var(--im-mint)' }} />
        <span style={{ fontWeight: 700, color: '#555', fontSize: 13 }}>iM Agent</span>
      </div>
      <p style={{ margin: 0 }}>
        © {year} iM뱅크 공모전 프로젝트 &nbsp;·&nbsp;
        <Link to="/about" style={{ color: 'var(--im-mint)', textDecoration: 'none' }}>소개</Link>
        &nbsp;·&nbsp; Powered by Upstage Solar Pro 3
      </p>
    </footer>
  )
}
