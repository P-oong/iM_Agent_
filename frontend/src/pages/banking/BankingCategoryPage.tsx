import { useNavigate, useParams } from 'react-router-dom'
import '../../styles/banking.css'

// ── 카테고리 메타 ─────────────────────────────────────
type ScreenEntry = {
  code: string
  name: string
  desc: string
  path?: string   // 없으면 준비중
}
type CatMeta = {
  label: string
  desc: string
  screens: ScreenEntry[]
}

const CAT_MAP: Record<string, CatMeta> = {
  all: {
    label: '전체',
    desc: '모든 업무 화면 목록입니다.',
    screens: [
      { code: '0156', name: '고객실명조회',    desc: '실명번호로 고객 정보를 조회합니다.',       path: '/banking/0156' },
      { code: '0125', name: '다수계좌입금',    desc: '여러 계좌에 일괄 입금 처리합니다.',         path: '/banking/0125' },
      { code: '0110', name: '계좌기본조회',    desc: '계좌의 기본 정보를 조회합니다.' },
      { code: '0210', name: '대출기본조회',    desc: '대출 계좌의 기본 정보를 조회합니다.' },
      { code: '0310', name: '카드 발급 가능 조회', desc: '실명번호 입력 → 자동 심사 → 즉시 신청.', path: '/banking/0310' },
      { code: '0410', name: '인터넷뱅킹조회', desc: '인터넷뱅킹 등록 현황을 조회합니다.' },
      { code: '0510', name: '공과금수납조회', desc: '공과금 수납 내역을 조회합니다.' },
      { code: '0000', name: '화면 템플릿',    desc: '새 화면을 설계할 때 사용하는 기본 틀입니다.', path: '/banking/template' },
    ],
  },
  customer: {
    label: '고객/신용',
    desc: '고객 정보 및 신용 관련 업무 화면입니다.',
    screens: [
      { code: '0156', name: '고객실명조회',  desc: '실명번호로 고객 기본 정보를 조회합니다.',     path: '/banking/0156' },
      { code: '0157', name: '고객기본정보',  desc: '고객의 등록 정보와 거래 현황을 확인합니다.' },
      { code: '0158', name: '신용등급조회',  desc: '고객의 신용등급 및 평가 내역을 조회합니다.' },
      { code: '0159', name: '고객우대현황',  desc: '우대금리 적용 및 등급 현황을 조회합니다.' },
    ],
  },
  deposit: {
    label: '수신',
    desc: '수신 계좌 관련 업무 화면입니다.',
    screens: [
      { code: '0110', name: '계좌기본조회',   desc: '계좌번호로 수신 계좌 기본 정보를 조회합니다.' },
      { code: '0111', name: '잔액조회',       desc: '계좌 잔액 및 가용 금액을 조회합니다.' },
      { code: '0112', name: '거래내역조회',   desc: '기간별 거래 내역을 조회합니다.' },
      { code: '0113', name: '이자조회',       desc: '적립 이자 및 예상 이자를 조회합니다.' },
      { code: '0125', name: '다수계좌입금',   desc: '여러 계좌에 일괄 입금 처리합니다.',           path: '/banking/0125' },
      { code: '0126', name: '자동이체등록',   desc: '정기 자동이체 계좌 등록 및 조회합니다.' },
    ],
  },
  loan: {
    label: '대출',
    desc: '여신 및 대출 관련 업무 화면입니다.',
    screens: [
      { code: '0210', name: '대출기본조회',   desc: '대출 계좌의 원금·이자·잔액을 조회합니다.' },
      { code: '0211', name: '대출상환현황',   desc: '상환 스케줄 및 납입 현황을 확인합니다.' },
      { code: '0212', name: '연체현황조회',   desc: '연체 발생 내역 및 연체이자를 조회합니다.' },
      { code: '0213', name: '담보물조회',     desc: '등록된 담보물 내역을 조회합니다.' },
    ],
  },
  card: {
    label: '카드',
    desc: '카드 발급 및 이용 관련 업무 화면입니다.',
    screens: [
      { code: '0310', name: '카드 발급 가능 조회', desc: '실명번호 입력만으로 데이터 자동 수집 → 즉시 심사 → 바로 신청까지 원스톱으로 처리합니다.', path: '/banking/0310' },
      { code: '0311', name: '카드이용내역',        desc: '카드 승인 내역 및 청구 금액을 확인합니다.' },
      { code: '0312', name: '분할납부조회',        desc: '할부 이용 현황 및 잔여 횟수를 조회합니다.' },
    ],
  },
  digital: {
    label: '전자금융',
    desc: '인터넷·모바일뱅킹 등 전자금융 업무 화면입니다.',
    screens: [
      { code: '0410', name: '인터넷뱅킹조회', desc: '인터넷뱅킹 등록·해지 현황을 조회합니다.' },
      { code: '0411', name: '자동이체조회',   desc: '전자금융 자동이체 목록을 조회합니다.' },
      { code: '0412', name: 'OTP관리',       desc: 'OTP 발급 및 인증 현황을 관리합니다.' },
    ],
  },
  tax: {
    label: '공과금',
    desc: '공과금 수납 및 조회 관련 업무 화면입니다.',
    screens: [
      { code: '0510', name: '공과금수납조회', desc: '수납된 공과금 내역을 조회합니다.' },
      { code: '0511', name: '미납현황조회',   desc: '미납 공과금 현황을 조회합니다.' },
      { code: '0512', name: '수납증명발급',   desc: '수납 완료 증명서를 발급합니다.' },
    ],
  },
}

export function BankingCategoryPage() {
  const { catId } = useParams<{ catId: string }>()
  const navigate   = useNavigate()
  const meta       = CAT_MAP[catId ?? 'all'] ?? CAT_MAP['all']

  return (
    <div className="bk-screen">
      {/* 타이틀바 */}
      <div className="bk-titlebar">
        <span className="bk-titlebar-code">■ {meta.label} 업무</span>
        <div className="bk-titlebar-right" />
      </div>

      {/* 콘텐츠 */}
      <div className="bk-content" style={{ padding: '20px 24px' }}>
        <p style={{ fontSize: '12px', color: '#6b7a8d', marginBottom: '20px' }}>
          {meta.desc}
        </p>

        <div className="bk-cat-grid">
          {meta.screens.map(s => (
            <button
              key={s.code}
              className={`bk-cat-card${s.path ? '' : ' bk-cat-card--dim'}`}
              onClick={() => s.path && navigate(s.path)}
              disabled={!s.path}
              title={s.path ? `[${s.code}] ${s.name}` : '준비중'}
            >
              <div className="bk-cat-card-header">
                <span className="bk-cat-card-code">{s.code}</span>
                {!s.path && <span className="bk-cat-card-badge">준비중</span>}
              </div>
              <div className="bk-cat-card-name">{s.name}</div>
              <div className="bk-cat-card-desc">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 상태바 */}
      <div className="bk-statusbar">{meta.label} 업무 화면 목록</div>
    </div>
  )
}
