import { motion } from 'framer-motion'
import {
  ArrowRight,
  BotMessageSquare,
  ChevronRight,
  CreditCard,
  Monitor,
  Sparkles,
  Trophy,
  User,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import '@/styles/home.css'

const FEATURES = [
  {
    Icon: Monitor,
    title: '전산화면 연동',
    desc: '실명번호 입력 하나로 CRM · AI 분석이 동시에 자동 연동됩니다.',
    href: '/banking/0156',
    badge: '[0156]',
    color: 'var(--im-mint)',
  },
  {
    Icon: User,
    title: 'CRM 패널',
    desc: '고객 보유 상품을 파악하고 맞춤 영업기회와 KPI 점수를 즉시 확인합니다.',
    href: null,
    badge: 'SIDEBAR',
    color: '#6366f1',
  },
  {
    Icon: BotMessageSquare,
    title: 'AI 고객 분석',
    desc: 'Upstage Solar Pro 3가 재무 건강·리스크·상담 멘트를 실시간 스트리밍합니다.',
    href: '/ai',
    badge: 'Solar Pro 3',
    color: '#0ea5e9',
  },
  {
    Icon: Trophy,
    title: 'KPI 시스템',
    desc: '거래 완료마다 경험치가 쌓이고 레벨이 올라가는 게임형 목표 관리.',
    href: null,
    badge: 'GAMIFIED',
    color: '#f59e0b',
  },
]

const QUICK_LINKS = [
  { label: '[0156] 고객실명조회', sub: '실명번호 → CRM/AI 자동연동', href: '/banking/0156', primary: true },
  { label: '[0125] 수수 다수계좌', sub: '다수계좌 입금 처리 화면',     href: '/banking/0125', primary: false },
  { label: 'AI 고객 분석',         sub: 'Solar Pro 3 실시간 분석',     href: '/ai',           primary: false },
]

const card = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

export function HomePage() {
  useDocumentTitle('iM Agent')

  return (
    <div className="home">
      {/* ── 히어로 ── */}
      <motion.div
        className="home-hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="home-hero-inner">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            <div className="home-badge">
              <Sparkles size={12} />
              iM뱅크 공모전 2025
            </div>
            <h1 className="home-title">
              영업 현장을<br />
              <span className="home-title-accent">AI로 혁신</span>합니다
            </h1>
            <p className="home-sub">
              실명번호 한 번으로 고객 CRM·AI 분석이 자동 연동되는<br />
              차세대 은행원 영업지원 플랫폼
            </p>
            <div className="home-hero-ctas">
              <Link to="/banking/0156" className="home-cta-primary">
                전산화면 시작
                <ArrowRight size={16} />
              </Link>
              <Link to="/ai" className="home-cta-secondary">
                AI 분석 보기
              </Link>
            </div>
          </motion.div>

          {/* 장식 아이콘 클러스터 */}
          <motion.div
            className="home-hero-visual"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            <div className="hero-icon-ring hero-ring-1">
              <Monitor  size={22} />
            </div>
            <div className="hero-icon-ring hero-ring-2">
              <User size={22} />
            </div>
            <div className="hero-icon-ring hero-ring-3">
              <BotMessageSquare size={22} />
            </div>
            <div className="hero-icon-center">
              <CreditCard size={32} />
            </div>
          </motion.div>
        </div>

        {/* 물결 구분선 */}
        <svg className="home-hero-wave" viewBox="0 0 1440 56" preserveAspectRatio="none">
          <path d="M0,56 C360,0 1080,56 1440,28 L1440,56 Z" fill="var(--bg-page)" />
        </svg>
      </motion.div>

      {/* ── 주요 기능 ── */}
      <div className="home-section">
        <div className="home-section-header">
          <h2 className="home-section-title">주요 기능</h2>
          <p className="home-section-sub">은행원의 영업 사이클 전 과정을 지원합니다</p>
        </div>

        <motion.div
          className="home-feature-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {FEATURES.map(({ Icon, title, desc, href, badge, color }) => (
            <motion.div key={title} variants={card} className="home-feature-card">
              <div className="home-feature-top">
                <div className="home-feature-icon" style={{ background: `${color}18`, color }}>
                  <Icon size={22} />
                </div>
                <span className="home-feature-badge" style={{ color, background: `${color}14` }}>
                  {badge}
                </span>
              </div>
              <h3 className="home-feature-title">{title}</h3>
              <p className="home-feature-desc">{desc}</p>
              {href && (
                <Link to={href} className="home-feature-link" style={{ color }}>
                  바로가기 <ChevronRight size={13} />
                </Link>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── 화면 바로가기 ── */}
      <div className="home-section">
        <div className="home-section-header">
          <h2 className="home-section-title">바로가기</h2>
        </div>
        <motion.div
          className="home-quick-list"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {QUICK_LINKS.map(({ label, sub, href, primary }) => (
            <motion.div key={href} variants={card}>
              <Link to={href} className={`home-quick-item${primary ? ' home-quick-item--primary' : ''}`}>
                <div>
                  <div className="home-quick-label">{label}</div>
                  <div className="home-quick-sub">{sub}</div>
                </div>
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
