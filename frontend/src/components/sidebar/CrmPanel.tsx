import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarClock, ChevronDown, ChevronUp, CreditCard, ExternalLink,
  Mail, MapPin, Monitor, Phone, ShieldAlert, TrendingDown, User,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomer } from '@/contexts/CustomerContext'
import { DEMO_CUSTOMERS, type DemoCustomer } from '@/data/demoCustomers'
import { getRateImprovements } from '@/data/mockCustomers'
import { DemoModal } from '@/components/sidebar/DemoModal'
import { type AiAnalysisResult, type CustomerForAnalysis } from '@/services/openaiApi'
import { AI_RESULT_CACHE } from '@/services/aiAnalysisCache'
import '@/styles/kpi.css'

// ── DB에서 조회한 고객 정보 타입 ───────────────────────────
export interface CustomerInfo {
  customerId: string
  residentIdFront: string
  name: string
  customerType: '개인' | '개인사업자' | '법인'
  gender: '남' | '여' | ''
  grade: string
  age: number
  job: string | null
  annualIncome: number
  creditScore: number
  totalAssets: number
  totalDebt: number
  notes: string | null
  products: string[]
  accounts: { number: string; product: string; balance: number; status: string }[]
  transactions: { date: string; description: string; amount: number }[]
}

// ── 데모 고객 매핑 (DB customer_id → DemoCustomer) ────────
const DEMO_MAP: Record<string, DemoCustomer> = {
  'DEMO-1': DEMO_CUSTOMERS[0], // 김민지
  'DEMO-2': DEMO_CUSTOMERS[1], // 박성호
  'DEMO-3': DEMO_CUSTOMERS[2], // 대구정밀부품
}

// CustomerInfo → 기본 DemoCustomer 변환 (DEMO_MAP에 없는 고객용)
function toDemoCustomer(c: CustomerInfo): DemoCustomer {
  return {
    id: c.customerId,
    type: c.customerType as DemoCustomer['type'],
    name: c.name,
    job: c.job ?? '방문 고객',
    visitPurpose: '창구 방문',
    aiEvent: '내점 고객 영업기회 감지',
    summary: '',
    keyMetrics: [],
    opportunities: [],
    coreMessage: '',
  }
}

// ── CustomerInfo → CustomerForAnalysis 변환 ────────────
function toCustomerForAnalysis(c: CustomerInfo, demo: DemoCustomer): CustomerForAnalysis {
  const isBusinessType = c.customerType !== '개인'
  return {
    name: c.name,
    type: c.customerType,
    grade: c.grade,
    products: c.products,
    accounts: c.accounts.map(a => ({ product: a.product, balance: a.balance })),
    transactions: c.transactions.map(t => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
    })),
    businessInfo: isBusinessType
      ? {
          companyName: c.name,
          industry: c.job ?? '',
          annualRevenue: c.annualIncome >= 10000
            ? `약 ${(c.annualIncome / 10000).toFixed(1)}억원`
            : `약 ${c.annualIncome.toLocaleString()}만원`,
        }
      : undefined,
    visitPurpose: demo.visitPurpose,
    aiEvent: demo.aiEvent,
  }
}

// ── AI 결과 기반 페이지 라우팅 ────────────────────────────
function getShortcutRoute(title: string): string {
  if (/카드|가맹|결제|비즈|소호/.test(title)) return '/banking/0310'
  if (/수신|예금|적금|청약/.test(title)) return '/banking/0151'
  return '/banking/0310'
}

// ── 데모 분석 버튼 + 팝업 트리거 ────────────────────────
function DemoAnalysisButton({
  demo,
  customer,
}: {
  demo: DemoCustomer
  customer: CustomerInfo
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const cacheKey = customer.customerId
  const [, forceUpdate] = useState(0)
  const customerForAi = toCustomerForAnalysis(customer, demo)

  // 캐시는 영업기회가 1개 이상 있을 때만 유효한 것으로 간주.
  // (백엔드/프론트 상호 호환 작업 중 잠시 비어 있던 응답이 남아 있던 경우 자동 무효화)
  const rawCached = AI_RESULT_CACHE.get(cacheKey) ?? null
  const cachedResult =
    rawCached && rawCached.opportunities && rawCached.opportunities.length > 0
      ? rawCached
      : null
  if (rawCached && !cachedResult) {
    AI_RESULT_CACHE.delete(cacheKey)
  }

  const hasCache = cachedResult !== null
  const topOpp = cachedResult?.opportunities?.[0] ?? null
  const shortcutRoute = topOpp ? getShortcutRoute(topOpp.title) : '/banking/0310'
  const shortcutLabel = shortcutRoute === '/banking/0151' ? '수신 기장 화면으로' : '카드 발급 화면으로'

  function handleResult(result: AiAnalysisResult) {
    AI_RESULT_CACHE.set(cacheKey, result)
    forceUpdate(n => n + 1)
  }

  return (
    <>
      <div style={{ padding: '0 10px 16px' }}>
        {/* 분석 버튼 */}
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '10px 0',
            background: hasCache
              ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
              : 'linear-gradient(135deg, var(--im-mint), #007c6a)',
            color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: hasCache
              ? '0 3px 12px rgba(59,130,246,0.35)'
              : '0 3px 12px rgba(0,199,169,0.35)',
            letterSpacing: '0.01em',
            transition: 'transform 0.12s, box-shadow 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = '' }}
        >
          <Zap size={14} />
          {hasCache ? 'AI 분석 결과 보기' : 'AI 영업기회 분석'}
        </button>

        {/* 분석 완료 후 — 추천 영업기회 미니카드 */}
        {hasCache && topOpp && (
          <div style={{
            marginTop: 8,
            background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(29,78,216,0.04) 100%)',
            border: '1px solid rgba(59,130,246,0.22)',
            borderRadius: 10,
            padding: '10px 12px',
          }}>
            {/* 헤더: AI 추천 + 제목 + 점수 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, color: '#3b82f6',
                background: 'rgba(59,130,246,0.12)', padding: '2px 6px',
                borderRadius: 4, letterSpacing: '0.06em', flexShrink: 0,
              }}>AI 추천</span>
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#1e293b',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{topOpp.title}</span>
              <span style={{
                fontSize: 11, fontWeight: 800, color: '#3b82f6', flexShrink: 0,
              }}>{topOpp.score}점</span>
            </div>

            {/* 분석 포인트 첫 줄 */}
            {topOpp.analysisPoints?.[0] && (
              <p style={{
                fontSize: 10.5, color: '#64748b', margin: '0 0 8px',
                lineHeight: 1.5,
                display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{topOpp.analysisPoints[0]}</p>
            )}

            {/* 바로가기 버튼 */}
            <button
              onClick={() => navigate(shortcutRoute)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                width: '100%', padding: '7px 0',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#fff', border: 'none', borderRadius: 7,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                letterSpacing: '0.01em',
                transition: 'transform 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = '' }}
            >
              <ExternalLink size={12} />
              바로가기 — {shortcutLabel}
            </button>
          </div>
        )}
      </div>
      {open && (
        <DemoModal
          demo={demo}
          customerName={customer.name}
          customer={customerForAi}
          onClose={() => setOpen(false)}
          custId={customer.customerId}
          cachedResult={cachedResult}
          onResult={handleResult}
        />
      )}
    </>
  )
}


// ── 고객 ID 기반 결정론적 데이터 생성 ────────────────
function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

function getContactInfo(c: CustomerInfo) {
  const h = hashId(c.customerId)
  const mid1 = 1000 + (h % 9000)
  const mid2 = 1000 + ((h >> 4) % 9000)
  const phone = `010-${mid1}-${mid2}`
  const domains = ['naver.com', 'kakao.com', 'gmail.com', 'daum.net']
  const domain = domains[h % domains.length]
  const emailPrefix = c.name.replace(/\s/g, '').toLowerCase() + (h % 100)
  const email = `${emailPrefix}@${domain}`
  const cities = ['대구', '서울', '부산', '인천', '광주']
  const gus = ['중구', '달서구', '수성구', '동구', '북구']
  const city = cities[h % cities.length]
  const gu = gus[(h >> 2) % gus.length]
  const address = `${city} ${gu}`
  return { phone, email, address }
}

function getKycInfo(c: CustomerInfo) {
  const h = hashId(c.customerId)
  // KYC 도래일자: 오늘 기준 -180일 ~ +365일 사이로 분산
  const offsetDays = (h % 545) - 180
  const due = new Date()
  due.setDate(due.getDate() + offsetDays)
  const dueStr = due.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '')
  const today = new Date()
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)

  let urgency: 'overdue' | 'soon' | 'normal'
  let urgencyLabel: string
  if (diffDays < 0) {
    urgency = 'overdue'
    urgencyLabel = `${Math.abs(diffDays)}일 경과`
  } else if (diffDays <= 30) {
    urgency = 'soon'
    urgencyLabel = `D-${diffDays}`
  } else {
    urgency = 'normal'
    urgencyLabel = `D-${diffDays}`
  }
  return { dueStr, urgency, urgencyLabel, diffDays }
}

// ── 접이식 섹션 컴포넌트 ─────────────────────────────
function CollapseSection({ title, icon: Icon, badge, children, defaultOpen = true }: {
  title: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  badge?: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="crm-section">
      <button className="crm-section-title crm-collapse-btn" onClick={() => setOpen(v => !v)}>
        <Icon size={13} style={{ marginRight: 5, flexShrink: 0 }} />
        {title}
        {badge && <span className="crm-section-badge">{badge}</span>}
        <span style={{ marginLeft: 'auto' }}>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {open && <div className="crm-collapse-body">{children}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────
export function CrmPanel() {
  const { activeResidentId, setActiveCustId } = useCustomer()

  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading]   = useState(false)

  // 고객 변경 → DB API 조회
  useEffect(() => {
    if (!activeResidentId) {
      setCustomer(null)
      setNotFound(false)
      setActiveCustId(null)
      return
    }
    const resId = activeResidentId.slice(0, 6)
    setLoading(true)
    setCustomer(null)
    setNotFound(false)
    fetch(`/api/agent/api/customers/${resId}`)
      .then(res => {
        if (res.status === 404) { setNotFound(true); setActiveCustId(null); return null }
        if (!res.ok) throw new Error('서버 오류')
        return res.json()
      })
      .then((data: CustomerInfo | null) => {
        if (data) {
          setCustomer(data)
          setActiveCustId(data.customerId)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [activeResidentId, setActiveCustId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 로딩 */}
      {loading && (
        <div className="crm-empty">
          <Monitor size={28} className="crm-empty-icon" />
          <p className="crm-empty-title">조회 중…</p>
        </div>
      )}

      {/* 빈 상태 */}
      {!customer && !notFound && !loading && (
        <div className="crm-empty">
          <Monitor size={28} className="crm-empty-icon" />
          <p className="crm-empty-title">고객 정보 없음</p>
          <p className="crm-empty-desc">
            전산화면 <strong>[0151]</strong>에서<br />
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
            key={customer.customerId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* ── AI 영업기회 분석 버튼 ── */}
            <DemoAnalysisButton
              demo={DEMO_MAP[customer.customerId] ?? toDemoCustomer(customer)}
              customer={customer}
            />

            {/* ── 기본정보 ── */}
            <CollapseSection title="기본정보" icon={User}>
              <table className="crm-table">
                <tbody>
                  <tr><td className="crm-td-label">고객명</td><td className="crm-name">{customer.name}</td></tr>
                  <tr><td className="crm-td-label">등급</td><td style={{ fontWeight: 600 }}>{customer.grade}</td></tr>
                  <tr><td className="crm-td-label">나이</td><td>{customer.age}세</td></tr>
                  {customer.customerType !== '개인' && customer.job && (
                    <tr><td className="crm-td-label">업종</td><td>{customer.job}</td></tr>
                  )}
                  {customer.customerType !== '개인' && (
                    <tr>
                      <td className="crm-td-label">연매출</td>
                      <td style={{ color: '#007a64', fontWeight: 700 }}>
                        {customer.annualIncome >= 10000
                          ? `약 ${(customer.annualIncome / 10000).toFixed(1)}억원`
                          : `약 ${customer.annualIncome.toLocaleString()}만원`}
                      </td>
                    </tr>
                  )}
                  {customer.customerType === '개인' && customer.job && (
                    <tr><td className="crm-td-label">직업</td><td>{customer.job}</td></tr>
                  )}
                </tbody>
              </table>
            </CollapseSection>

            {/* ── KYC 도래일자 + 접촉정보 ── */}
            {(() => {
              const kyc = getKycInfo(customer)
              const contact = getContactInfo(customer)
              const kycColor = kyc.urgency === 'overdue' ? '#ef4444' : kyc.urgency === 'soon' ? '#f0a500' : '#00a86b'
              const kycBg   = kyc.urgency === 'overdue' ? 'rgba(239,68,68,0.08)' : kyc.urgency === 'soon' ? 'rgba(240,165,0,0.08)' : 'rgba(0,168,107,0.08)'
              return (
                <CollapseSection title="KYC · 접촉정보" icon={ShieldAlert} defaultOpen={true}>
                  {/* KYC 도래일자 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: kycBg, border: `1px solid ${kycColor}33`,
                    borderRadius: 8, padding: '8px 10px', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarClock size={13} style={{ color: kycColor }} />
                      <span style={{ fontSize: 11.5, color: '#475569', fontWeight: 600 }}>KYC 도래일자</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: kycColor }}>{kyc.dueStr}</div>
                      <div style={{ fontSize: 10.5, color: kycColor, fontWeight: 700 }}>{kyc.urgencyLabel}</div>
                    </div>
                  </div>
                  {/* 연락처 */}
                  <table className="crm-table">
                    <tbody>
                      <tr>
                        <td className="crm-td-label" style={{ whiteSpace: 'nowrap' }}>
                          <Phone size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />휴대폰
                        </td>
                        <td style={{ fontSize: 12, letterSpacing: '0.04em' }}>{contact.phone}</td>
                      </tr>
                      <tr>
                        <td className="crm-td-label">
                          <Mail size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />이메일
                        </td>
                        <td style={{ fontSize: 11.5, color: '#475569' }}>{contact.email}</td>
                      </tr>
                      <tr>
                        <td className="crm-td-label">
                          <MapPin size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />주소
                        </td>
                        <td style={{ fontSize: 12 }}>{contact.address}</td>
                      </tr>
                    </tbody>
                  </table>
                </CollapseSection>
              )
            })()}

            {/* ── 보유 상품 ── */}
            <CollapseSection title="보유상품" icon={CreditCard}>
              <div className="prod-tags">
                {customer.products.map(p => (
                  <span key={p} className="prod-tag">{p}</span>
                ))}
              </div>
            </CollapseSection>

            {/* ── 금리 우대 방법 ── */}
            <CollapseSection title="금리 우대 방법" icon={TrendingDown} defaultOpen={false}>
              <p className="crm-doc-note" style={{ marginBottom: 6 }}>아래 상품 보유 시 대출 금리 추가 우대</p>
              {getRateImprovements(customer.customerType, customer.products).map(r => (
                <div key={r.product} className={`crm-rate-item${r.have ? ' crm-rate--have' : ''}`}>
                  <div className="crm-rate-left">
                    <span className={`crm-rate-dot${r.have ? ' crm-rate-dot--have' : ''}`} />
                    <div>
                      <div className="crm-rate-product">{r.product}</div>
                      <div className="crm-rate-desc">{r.desc}</div>
                    </div>
                  </div>
                  <span className={`crm-rate-value${r.have ? ' crm-rate-value--have' : ''}`}>{r.rate}</span>
                </div>
              ))}
            </CollapseSection>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
