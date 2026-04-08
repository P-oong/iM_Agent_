import { BotMessageSquare } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="app-footer">
      <BotMessageSquare size={12} style={{ color: 'var(--im-mint)', flexShrink: 0 }} />
      <span style={{ fontWeight: 700, color: '#666' }}>iM Agent</span>
      <span style={{ color: '#ccc' }}>·</span>
      <span>© {year} iM뱅크 공모전</span>
      <span style={{ color: '#ccc' }}>·</span>
      <Link to="/about" style={{ color: 'var(--im-mint)', textDecoration: 'none' }}>소개</Link>
      <span style={{ color: '#ccc' }}>·</span>
      <span>Powered by Upstage Solar Pro 3</span>
    </footer>
  )
}
