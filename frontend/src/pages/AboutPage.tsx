import { motion } from 'framer-motion'
import {
  BotMessageSquare,
  Brain,
  Code2,
  CreditCard,
  Sparkles,
  Trophy,
  User,
  Zap,
} from 'lucide-react'
import { APP_NAME } from '@/constants/app'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import '@/styles/about.css'

const TECH_STACK = [
  { label: 'React 19',       icon: Code2,          color: '#61dafb' },
  { label: 'TypeScript',     icon: Code2,          color: '#3178c6' },
  { label: 'Vite',           icon: Zap,            color: '#646cff' },
  { label: 'Framer Motion',  icon: Sparkles,       color: '#ff0055' },
  { label: 'Upstage Solar',  icon: BotMessageSquare, color: '#f59e0b' },
  { label: 'Lucide React',   icon: Sparkles,       color: '#00c7a9' },
]

const FEATURES = [
  // { Icon: Monitor,          title: '[0156] 전산화면',     desc: '실명번호 입력 한 번으로 CRM과 AI 분석이 자동 연동' },
  { Icon: User,             title: 'CRM 패널',            desc: '보유 상품 분석 → 맞춤 영업기회 + KPI 점수 산출' },
  { Icon: BotMessageSquare, title: 'Solar Pro 3 AI',      desc: '재무 건강 점수 · 리스크 · 추천 멘트 실시간 스트리밍' },
  { Icon: Trophy,           title: 'KPI 게이미피케이션',  desc: '거래 완료 시 경험치 적립 · 레벨업으로 목표 관리' },
  { Icon: Brain,            title: '화면번호 네비게이션', desc: '* + 코드 + - 단축키로 전산화면 즉시 이동' },
  { Icon: CreditCard,       title: '더미 데이터 연동',    desc: '5명의 실전형 고객 프로필로 전 기능 데모 가능' },
]

const card = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function AboutPage() {
  useDocumentTitle(`소개 · ${APP_NAME}`)

  return (
    <div className="about-page">
      {/* 헤더 */}
      <motion.div
        className="about-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="about-hero-icon">
          <BotMessageSquare size={36} />
        </div>
        <h1 className="about-title">iM Agent</h1>
        <p className="about-sub">
          iM뱅크 공모전 2026 · AI 기반 은행원 영업지원 플랫폼
        </p>
        <div className="about-tags">
          <span className="about-tag">공모전 프로젝트</span>
          <span className="about-tag">Upstage AI</span>
          <span className="about-tag">React 19</span>
        </div>
      </motion.div>

      {/* 프로젝트 개요 */}
      <motion.div
        className="about-card about-overview"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="about-card-title">프로젝트 개요</h2>
        <p className="about-body">
          <strong>iM Agent</strong>는 은행 창구 직원(텔러)의 영업 효율을 AI로 극대화하는 플랫폼입니다.
          고객 실명번호 조회 → CRM 자동 연동 → AI 영업 기회 분석까지 하나의 흐름으로 연결하여,
          복잡한 금융 상담을 보다 스마트하게 지원합니다.
        </p>
        <p className="about-body">
          고객의 재무 현황을 실시간으로 분석하고,
          맞춤형 상품 추천 스크립트를 즉시 제공합니다.
          KPI 게이미피케이션 시스템으로 목표 관리까지 한 번에 해결합니다.
        </p>
      </motion.div>

      {/* 핵심 기능 */}
      <div className="about-section">
        <h2 className="about-section-title">핵심 기능</h2>
        <motion.div
          className="about-feature-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {FEATURES.map(({ Icon, title, desc }) => (
            <motion.div key={title} variants={card} className="about-feature-item">
              <div className="about-feature-icon">
                <Icon size={18} />
              </div>
              <div>
                <div className="about-feature-title">{title}</div>
                <div className="about-feature-desc">{desc}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* 기술 스택 */}
      <div className="about-section">
        <h2 className="about-section-title">기술 스택</h2>
        <motion.div
          className="about-tech-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {TECH_STACK.map(({ label, icon: Icon, color }) => (
            <motion.div key={label} variants={card} className="about-tech-chip">
              <Icon size={15} style={{ color }} />
              <span>{label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* 사용법 */}
      {/* <div className="about-section">
        <h2 className="about-section-title">빠른 사용법</h2>
        <div className="about-steps">
          {[
            { n: '1', t: '전산화면 접속', d: '상단 내비의 [전산화면] 또는 * + 0156 + -' },
            { n: '2', t: '실명번호 입력', d: '예시: 900101 / 851215 / 750304 / 970715 / 660203' },
            { n: '3', t: 'CRM 패널 확인', d: '오른쪽 사이드바 CRM 버튼 → 고객 정보 자동 표시' },
            { n: '4', t: 'AI 분석 실행', d: 'AI 분석 페이지 → 자동 선택된 고객 → 분석 시작' },
          ].map(step => (
            <div key={step.n} className="about-step">
              <div className="about-step-num">{step.n}</div>
              <div>
                <div className="about-step-title">{step.t}</div>
                <div className="about-step-desc">{step.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div> */}
    </div>
  )
}
