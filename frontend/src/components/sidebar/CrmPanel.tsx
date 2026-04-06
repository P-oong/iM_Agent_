import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  CheckCircle2,
  CreditCard,
  Home,
  Landmark,
  Monitor,
  Shield,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCustomer } from '@/contexts/CustomerContext'
import { useKpi } from '@/contexts/KpiContext'
import '@/styles/kpi.css'

// ── 영업기회 마스터 ──────────────────────────────────
const OPPORTUNITIES = [
  { key: '신용카드', emoji: '💳', kpi: 20, category: '카드',   desc: '신용카드 미보유 → 신용카드 발급 추천',   Icon: CreditCard       },
  { key: '체크카드', emoji: '💳', kpi: 12, category: '카드',   desc: '체크카드 미보유 → 체크카드 발급 추천',   Icon: Wallet           },
  { key: '청약',     emoji: '🏠', kpi: 25, category: '청약',   desc: '주택청약 미가입 → 청약 신규 가입 추천',  Icon: Home             },
  { key: 'ISA',      emoji: '📈', kpi: 30, category: 'ISA',    desc: 'ISA 비과세 계좌 미개설 → ISA 개설 추천', Icon: BarChart3        },
  { key: '펀드',     emoji: '📊', kpi: 20, category: '투자',   desc: '투자상품 미보유 → 펀드 가입 추천',       Icon: BadgeDollarSign  },
  { key: '정기예금', emoji: '🏦', kpi: 10, category: '예금',   desc: '정기예금 미가입 → 정기예금 신규 추천',   Icon: Building2        },
  { key: '변액보험', emoji: '🛡️', kpi: 35, category: '보험',   desc: '보장성 보험 없음 → 변액보험 가입 추천',  Icon: Shield           },
  { key: '신용대출', emoji: '💼', kpi: 25, category: '대출',   desc: '기존 대출 없음 → 신용대출 상담 추천',    Icon: Landmark         },
] as const

// ── 모의 고객 DB (주민번호 앞 6자리로 조회) ──────────
type Product = string
interface MockCustomer {
  고객번호: string
  고객명: string
  생년월일: string
  성별: '남' | '여'
  연락처: string
  주소: string
  등급: string
  보유상품: Product[]
  계좌: { 번호: string; 상품: string; 잔액: number; 상태: string }[]
  최근거래: { 일자: string; 내용: string; 금액: number }[]
}

const MOCK_DB: Record<string, MockCustomer> = {
  '010101': {
    고객번호: '100000001',
    고객명: '홍길동',
    생년월일: '1990-XX-XX',
    성별: '남',
    연락처: '010-0000-0001',
    주소: '가상시 홍길동로 1',
    등급: 'VIP',
    보유상품: ['수시입출금', '자유적금'],
    계좌: [
      { 번호: '013-00001-00001', 상품: '자유적금',   잔액: 5_420_000, 상태: '정상' },
      { 번호: '013-00001-00002', 상품: '수시입출금', 잔액: 1_230_000, 상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.12', 내용: '타행입금',  금액:  3_000 },
      { 일자: '01.10', 내용: '이체출금',  금액: -500_000 },
      { 일자: '01.08', 내용: '급여입금',  금액:  5_600_000 },
    ],
  },
  '020202': {
    고객번호: '100000002',
    고객명: '이몽룡',
    생년월일: '1985-XX-XX',
    성별: '남',
    연락처: '010-0000-0002',
    주소: '가상시 이몽룡로 2',
    등급: '우량',
    보유상품: ['수시입출금', '신용카드', '자유적금', '청약'],
    계좌: [
      { 번호: '013-00002-00001', 상품: '신용카드',   잔액: 0,         상태: '정상' },
      { 번호: '013-00002-00002', 상품: '자유적금',   잔액: 8_100_000, 상태: '정상' },
      { 번호: '013-00002-00003', 상품: '청약',       잔액: 2_400_000, 상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.11', 내용: '카드이용',  금액: -85_000 },
      { 일자: '01.09', 내용: '급여입금',  금액:  4_330_000 },
      { 일자: '01.05', 내용: 'ATM출금',   금액: -200_000 },
    ],
  },
  '030303': {
    고객번호: '100000003',
    고객명: '성춘향',
    생년월일: '1975-XX-XX',
    성별: '여',
    연락처: '010-0000-0003',
    주소: '가상시 성춘향로 3',
    등급: '일반',
    보유상품: ['수시입출금'],
    계좌: [
      { 번호: '013-00003-00001', 상품: '수시입출금', 잔액: 450_000, 상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.10', 내용: '이체입금',  금액:  100_000 },
      { 일자: '01.01', 내용: 'ATM출금',   금액: -50_000 },
    ],
  },
  '040404': {
    고객번호: '100000004',
    고객명: '심청',
    생년월일: '1997-XX-XX',
    성별: '여',
    연락처: '010-0000-0004',
    주소: '가상시 심청로 4',
    등급: '일반',
    보유상품: ['수시입출금', '체크카드'],
    계좌: [
      { 번호: '013-00004-00001', 상품: '수시입출금', 잔액: 1_850_000, 상태: '정상' },
      { 번호: '013-00004-00002', 상품: '체크카드',   잔액: 0,         상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.12', 내용: '급여입금',  금액:  2_800_000 },
      { 일자: '01.10', 내용: '월세이체',  금액: -650_000 },
      { 일자: '01.08', 내용: '카드이용',  금액: -120_000 },
    ],
  },
  '050505': {
    고객번호: '100000005',
    고객명: '전우치',
    생년월일: '1966-XX-XX',
    성별: '남',
    연락처: '010-0000-0005',
    주소: '가상시 전우치로 5',
    등급: 'VIP',
    보유상품: ['수시입출금', '정기예금', '신용카드', '펀드', '변액보험'],
    계좌: [
      { 번호: '013-00005-00001', 상품: '정기예금',   잔액: 50_000_000, 상태: '정상' },
      { 번호: '013-00005-00002', 상품: '수시입출금', 잔액: 8_500_000,  상태: '정상' },
      { 번호: '013-00005-00003', 상품: '펀드',       잔액: 24_000_000, 상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.12', 내용: '연금입금',  금액:  4_000_000 },
      { 일자: '01.10', 내용: '증권이체',  금액: -3_000_000 },
      { 일자: '01.08', 내용: '카드이용',  금액: -250_000 },
    ],
  },
}

export function CrmPanel() {
  const { completed, addKpi } = useKpi()
  const { activeResidentId } = useCustomer()

  const [customer, setCustomer] = useState<MockCustomer | null>(null)
  const [notFound, setNotFound] = useState(false)

  // 전산화면 [0156]에서 실명번호 입력 시 자동 조회
  useEffect(() => {
    if (activeResidentId) {
      const found = MOCK_DB[activeResidentId.slice(0, 6)] ?? null
      setCustomer(found)
      setNotFound(!found)
    } else {
      setCustomer(null)
      setNotFound(false)
    }
  }, [activeResidentId])

  const opportunities = customer
    ? OPPORTUNITIES.filter(o => !customer.보유상품.includes(o.key))
    : []

  const isDone = (key: string) => customer ? completed.has(`${customer.고객번호}-${key}`) : false

  const sortedOpps = [...opportunities].sort((a, b) => b.kpi - a.kpi)

  return (
    <div>
      {/* ── 안내: 전산화면 연동 ── */}
      {!customer && !notFound && (
        <div className="crm-empty">
          <Monitor size={28} className="crm-empty-icon" />
          <p className="crm-empty-title">고객 정보 없음</p>
          <p className="crm-empty-desc">
            전산화면 <strong>[0156]</strong>에서<br />
            고객 실명번호를 조회하면<br />
            자동으로 여기에 표시됩니다.
          </p>
        </div>
      )}
      {notFound && (
        <div className="crm-empty">
          <User size={28} className="crm-empty-icon" style={{ color: '#ef4444' }} />
          <p className="crm-empty-title" style={{ color: '#ef4444' }}>고객 없음</p>
          <p className="crm-empty-desc">등록된 고객 정보를 찾을 수 없습니다.</p>
        </div>
      )}

      <AnimatePresence>
        {customer && (
          <motion.div
            key={customer.고객번호}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* ── 기본 정보 ── */}
            <div className="crm-section">
              <div className="crm-section-title">
                <User size={13} style={{ marginRight: 5 }} />
                기본정보
              </div>
              <div className="crm-badge-row">
                <span className="crm-grade">{customer.등급}</span>
              </div>
              <table className="crm-table">
                <tbody>
                  <tr>
                    <td className="crm-td-label">고객번호</td>
                    <td style={{ fontSize: 11, color: '#555' }}>{customer.고객번호}</td>
                  </tr>
                  <tr>
                    <td className="crm-td-label">고객명</td>
                    <td className="crm-name">{customer.고객명}</td>
                  </tr>
                  <tr>
                    <td className="crm-td-label">생년월일</td>
                    <td>{customer.생년월일} ({customer.성별})</td>
                  </tr>
                  <tr>
                    <td className="crm-td-label">연락처</td>
                    <td style={{ fontWeight: 600 }}>{customer.연락처}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── 보유 상품 ── */}
            <div className="crm-section">
              <div className="crm-section-title">
                <CreditCard size={13} style={{ marginRight: 5 }} />
                보유상품
              </div>
              <div className="prod-tags">
                {customer.보유상품.map(p => (
                  <span key={p} className="prod-tag">{p}</span>
                ))}
              </div>
            </div>

            {/* ── 보유 계좌 ── */}
            <div className="crm-section">
              <div className="crm-section-title">
                <Building2 size={13} style={{ marginRight: 5 }} />
                보유계좌
              </div>
              {customer.계좌.map((acc, i) => (
                <div key={i} className="crm-account">
                  <div className="crm-account-num">{acc.번호}</div>
                  <div className="crm-account-info">
                    <span className="crm-product">{acc.상품}</span>
                    <span className={`crm-status${acc.상태 === '정상' ? ' crm-status--ok' : ''}`}>
                      {acc.상태}
                    </span>
                  </div>
                  {acc.잔액 > 0 && (
                    <div className="crm-account-balance">
                      {acc.잔액.toLocaleString()}원
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── 영업기회 ── */}
            <div className="crm-section">
              <div className="opp-header">
                <span className="opp-header-title">
                  <Sparkles size={13} style={{ marginRight: 4 }} />
                  영업기회
                </span>
                <span className="opp-count">
                  {opportunities.length}건 · 최대 +{opportunities.reduce((s, o) => s + o.kpi, 0)} KPI
                </span>
              </div>
              {opportunities.length === 0 ? (
                <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '8px 0' }}>
                  추가 영업기회 없음
                </p>
              ) : (
                <motion.div
                  className="opp-list"
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
                >
                  {sortedOpps.map(opp => {
                    const done = isDone(opp.key)
                    const oppKey = `${customer.고객번호}-${opp.key}`
                    const OppIcon = opp.Icon
                    return (
                      <motion.div
                        key={opp.key}
                        variants={{
                          hidden:   { opacity: 0, x: 20 },
                          visible:  { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
                        }}
                        className={`opp-card${done ? ' opp-card--done' : ''}`}
                      >
                        <div className="opp-card-top">
                          <span className="opp-icon-wrap">
                            <OppIcon size={14} />
                          </span>
                          <span className="opp-product">{opp.key}</span>
                          {done ? (
                            <span className="opp-done-badge">
                              <CheckCircle2 size={11} style={{ marginRight: 3 }} />
                              완료
                            </span>
                          ) : (
                            <span className="opp-kpi-badge">+{opp.kpi} KPI</span>
                          )}
                        </div>
                        <div className="opp-desc">{opp.desc}</div>
                        <div className="opp-footer">
                          <span className="opp-category">{opp.category}</span>
                          <button
                            className="opp-btn"
                            disabled={done}
                            onClick={() => { addKpi(opp.kpi, `${opp.key} 신규`, oppKey) }}
                          >
                            {done ? '완료됨' : '거래 완료'}
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </div>

            {/* ── 최근 거래 ── */}
            <div className="crm-section">
              <div className="crm-section-title">최근 거래</div>
              <table className="crm-tx-table">
                <thead>
                  <tr>
                    <th>일자</th>
                    <th>내용</th>
                    <th style={{ textAlign: 'right' }}>금액</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.최근거래.map((tx, i) => (
                    <tr key={i}>
                      <td>{tx.일자}</td>
                      <td>{tx.내용}</td>
                      <td className={tx.금액 > 0 ? 'crm-tx-plus' : 'crm-tx-minus'}>
                        {tx.금액 > 0 ? '+' : ''}{tx.금액.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
