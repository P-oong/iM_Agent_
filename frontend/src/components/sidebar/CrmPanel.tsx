import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeDollarSign, BarChart3, Building2, CheckCircle2,
  ChevronDown, ChevronUp, CreditCard, ExternalLink, Home,
  Landmark, Monitor, Shield, Sparkles, TrendingDown, User, Wallet,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomer } from '@/contexts/CustomerContext'
import { useKpi } from '@/contexts/KpiContext'
import { buildCheongyakOpportunities } from '@/data/cheongyakEventData'
import { getKpiRules } from '@/data/kpiData'
import { buildMastercardOpportunities } from '@/data/mastercardEventData'
import { DEMO_CUSTOMERS, type DemoCustomer } from '@/data/demoCustomers'
import { DemoModal } from '@/components/sidebar/DemoModal'
import { type AiAnalysisResult, type CustomerForAnalysis } from '@/services/openaiApi'
import '@/styles/kpi.css'

// 페이지 새로고침 전까지 분석 결과를 유지하는 모듈 레벨 캐시 (custId → result)
const AI_RESULT_CACHE = new Map<string, AiAnalysisResult>()

// ── 데모 고객 매핑 (고객번호 → DemoCustomer) ──────────────
const DEMO_MAP: Record<string, DemoCustomer> = {
  '100000011': DEMO_CUSTOMERS[0], // 김민지
  '100000012': DEMO_CUSTOMERS[1], // 박성호
  '100000013': DEMO_CUSTOMERS[2], // 대구정밀부품
}

// ── 고객번호 → DB cust_id 매핑 ────────────────────────────
const CUST_ID_MAP: Record<string, string> = {
  '100000001': 'C001',
  '100000002': 'C002',
  '100000003': 'C003',
  '100000004': 'C004',
  '100000005': 'C005',
  '100000006': 'C006',
  '100000007': 'C007',
  '100000008': 'C008',
  '100000009': 'C009',
  '100000010': 'C010',
  '100000011': 'DEMO-1',
  '100000012': 'DEMO-2',
  '100000013': 'DEMO-3',
}

// MockCustomer → 기본 DemoCustomer 변환 (DEMO_MAP에 없는 고객용)
function toDemoCustomer(c: MockCustomer): DemoCustomer {
  return {
    id: c.고객번호,
    type: c.유형 as DemoCustomer['type'],
    name: c.고객명,
    job: c.사업정보?.업종 ?? '방문 고객',
    visitPurpose: '창구 방문',
    aiEvent: '내점 고객 영업기회 감지',
    summary: '',
    keyMetrics: [],
    opportunities: [],
    coreMessage: '',
  }
}

// ── MockCustomer → CustomerForAnalysis 변환 ────────────
function toCustomerForAnalysis(c: MockCustomer, demo: DemoCustomer): CustomerForAnalysis {
  return {
    name: c.고객명,
    type: c.유형,
    grade: c.등급,
    products: c.보유상품,
    accounts: c.계좌.map(a => ({ product: a.상품, balance: a.잔액 })),
    transactions: c.최근거래.map(t => ({
      date: t.일자,
      description: t.내용,
      amount: t.금액,
    })),
    businessInfo: c.사업정보
      ? {
          companyName: c.사업정보.상호,
          industry: c.사업정보.업종,
          annualRevenue: c.사업정보.연매출,
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
  customerName,
  mockCustomer,
  custId,
}: {
  demo: DemoCustomer
  customerName: string
  mockCustomer: MockCustomer
  custId?: string
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  // 모듈 캐시에서 현재 고객 결과 읽기 (key: custId 또는 고객번호)
  const cacheKey = custId ?? mockCustomer.고객번호
  const [, forceUpdate] = useState(0)
  const customerForAi = toCustomerForAnalysis(mockCustomer, demo)
  const cachedResult = AI_RESULT_CACHE.get(cacheKey) ?? null

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
          customerName={customerName}
          customer={customerForAi}
          onClose={() => setOpen(false)}
          custId={custId}
          cachedResult={cachedResult}
          onResult={handleResult}
        />
      )}
    </>
  )
}

// ── 고객 유형 ────────────────────────────────────────
type CustomerType = '개인' | '개인사업자' | '법인'

// ── 영업기회 key → 아이콘·설명 매핑 ─────────────────────
const OPP_META: Record<string, {
  Icon: React.ComponentType<{ size?: number }>
  desc: (pt: number) => string
  category: string
}> = {
  '요구불계좌': { Icon: Building2,       category: '수신',   desc: pt => `요구불계좌 신규 → +${pt}pt` },
  '거치식예금': { Icon: Building2,       category: '수신',   desc: pt => `거치식 예금 신규 → +${pt}pt` },
  '적립식예금': { Icon: Building2,       category: '수신',   desc: pt => `적립식 예금 신규 → +${pt}pt` },
  '청약':       { Icon: Home,            category: '청약',   desc: pt => `주택청약 미가입 → 신규 가입 +${pt}pt` },
  'ISA':        { Icon: BarChart3,       category: '투자',   desc: pt => `ISA 비과세 계좌 미개설 → 개설 +${pt}pt` },
  '펀드':       { Icon: BadgeDollarSign, category: '투자',   desc: pt => `투자 상품 미보유 → 수익증권 가입 +${pt}pt` },
  'IRP':        { Icon: Shield,          category: '퇴직연금', desc: pt => `개인형 IRP 미가입 → 신규 가입 +${pt}pt` },
  '신용대출':   { Icon: Landmark,        category: '대출',   desc: pt => `서민지원대출 상담 → +${pt}pt` },
  '기업대출':   { Icon: Landmark,        category: '대출',   desc: pt => `기업대출 신규 → +${pt}pt` },
  '신용카드':   { Icon: CreditCard,      category: '카드',   desc: pt => `신용카드 미보유 → 발급 후 사용 +${pt}pt` },
  '방카':       { Icon: Shield,          category: '방카',   desc: pt => `방카 미보유 → 가입 +${pt}pt` },
  '외화통장':   { Icon: Wallet,          category: '외환',   desc: pt => `외화통장 미보유 → 신규 +${pt}pt` },
  '소득이체':   { Icon: BadgeDollarSign, category: '서비스', desc: pt => `급여/소득 이체 미등록 → 등록 +${pt}pt` },
  '자동납부':   { Icon: Monitor,         category: '서비스', desc: pt => `자동납부 신규 등록 → 건당 +${pt}pt` },
  '계좌이동제': { Icon: Building2,       category: '서비스', desc: pt => `계좌이동 서비스 → 건당 +${pt}pt` },
  '가맹점':     { Icon: BarChart3,       category: '서비스', desc: pt => `가맹점 결계계좌 신규 → +${pt}pt` },
  '급여모계좌': { Icon: BadgeDollarSign, category: '서비스', desc: pt => `급여모계좌 최초 등록 → +${pt}pt` },
  'CMS':        { Icon: Monitor,         category: 'CMS',   desc: pt => `금융결제원 CMS 체결 → +${pt}pt` },
}

// ── 고객 유형별 추천 상품 ─────────────────────────────
type RecommendedProduct = { name: string; desc: string; priority: 'high' | 'mid' | 'low' }

function getRecommendedProducts(type: CustomerType, products: string[]): RecommendedProduct[] {
  const has = (sub: string) => products.some(p => p.includes(sub))

  if (type === '개인') {
    return [
      { name: 'iM 신용카드', desc: '소비 패턴 맞춤 캐시백·할인', priority: products.includes('신용카드') ? 'low' : 'high' },
      { name: 'ISA 계좌',    desc: '비과세 절세 통합 자산관리',  priority: products.includes('ISA') ? 'low' : 'high' },
    ]
  }
  if (type === '개인사업자') {
    const 타행정산 =
      (has('결제계좌') && has('타행'))
      || has('결제계좌(타행)')
      || has('가맹정산(타행)')
    return [
      {
        name: '노란우산',
        desc: '소상공인 공제 — 퇴직·노후 준비, 부담 적은 적립형',
        priority: has('노란우산') ? 'low' : 'high',
      },
      {
        name: '가맹점결제계좌',
        desc: 타행정산
          ? '타행 입금 중인 카드·배달 매출 → 당행 사업자통장으로 전환 안내'
          : '카드·VAN 매출 입금은 당행 계좌로 — 실적·여신 반영에 유리',
        priority: 'high',
      },
    ]
  }
  // 법인
  return [
    { name: '기업운전자금대출', desc: '법인 운영 자금, 한도 우대',      priority: 'high' },
    { name: '법인 신용카드',    desc: '임직원 법인카드, 비용 통합 관리', priority: 'high' },
  ]
}

// ── 금리 우대 방법 ────────────────────────────────────
type RateItem = { product: string; rate: string; desc: string; have: boolean }

function getRateImprovements(type: CustomerType, products: string[]): RateItem[] {
  const has = (p: string) => products.some(x => x.includes(p))

  const items: RateItem[] = [
    {
      product: '급여 이체',
      rate: '최대 +0.3%',
      desc: '주거래 급여 이체 등록 시',
      have: has('급여'),
    },
    {
      product: '신용카드 실적',
      rate: '+0.2%',
      desc: '당행 신용카드 월 30만원↑ 이용',
      have: has('신용카드'),
    },
    {
      product: '적금·예금 보유',
      rate: '+0.1%',
      desc: '당행 예·적금 상품 가입 시',
      have: has('적금') || has('예금'),
    },
    {
      product: '자동이체 등록',
      rate: '+0.1%',
      desc: '공과금 자동이체 3건 이상',
      have: false,
    },
  ]

  if (type === '개인사업자') {
    const 타행가맹정산 =
      (has('결제계좌') && has('타행'))
      || has('결제계좌(타행)')
      || has('가맹정산(타행)')
    if (타행가맹정산) {
      items.unshift({
        product: '가맹 정산계좌 당행 이전',
        rate: '우대 협의',
        desc: '타행 카드·오픈마켓 정산 → 당행 전환 시 수수료·여신 금리 협의',
        have: false,
      })
    }
    items.push(
      { product: '사업자 계좌 이전',   rate: '+0.2%', desc: '주거래 사업자 계좌 당행 이전',        have: false },
      { product: '사업자 카드 실적',   rate: '+0.2%', desc: '당행 사업자카드 월 50만원↑ 이용',    have: has('사업자카드') },
    )
  }
  if (type === '법인') {
    items.push(
      { product: '법인 주거래 협약',   rate: '+0.5%', desc: '주거래 법인 협약 체결 시',             have: false },
      { product: '퇴직연금 운용',      rate: '+0.2%', desc: '당행 퇴직연금 가입 법인',              have: has('퇴직연금') },
      { product: '수출입 외환 실적',   rate: '+0.1%', desc: '당행 환전·송금 거래 실적 보유',        have: false },
    )
  }
  return items
}

// ── MOCK DB ──────────────────────────────────────────
interface MockCustomer {
  고객번호: string
  고객명: string
  유형: CustomerType
  생년월일: string
  성별: '남' | '여'
  연락처: string
  주소: string
  등급: string
  사업정보?: { 사업자번호: string; 상호: string; 업종: string; 대표자?: string; 설립일: string; 연매출?: string }
  보유상품: string[]
  계좌: { 번호: string; 상품: string; 잔액: number; 상태: string }[]
  최근거래: { 일자: string; 내용: string; 금액: number }[]
}

const MOCK_DB: Record<string, MockCustomer> = {
  '010101': {
    고객번호: '100000001', 고객명: '홍길동', 유형: '개인',
    생년월일: '1990-XX-XX', 성별: '남', 연락처: '010-0000-0001',
    주소: '가상시 홍길동로 1', 등급: 'VIP',
    보유상품: ['수시입출금', '자유적금', '당행청약예부금'],
    계좌: [
      { 번호: '013-00001-00001', 상품: '자유적금',   잔액: 5_420_000, 상태: '정상' },
      { 번호: '013-00001-00002', 상품: '수시입출금', 잔액: 1_230_000, 상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.12', 내용: '타행입금', 금액:  3_000 },
      { 일자: '01.10', 내용: '이체출금', 금액: -500_000 },
      { 일자: '01.08', 내용: '급여입금', 금액:  5_600_000 },
    ],
  },
  '020202': {
    고객번호: '100000002', 고객명: '이몽룡', 유형: '개인',
    생년월일: '1985-XX-XX', 성별: '남', 연락처: '010-0000-0002',
    주소: '가상시 이몽룡로 2', 등급: '우량',
    보유상품: ['수시입출금', '신용카드', '자유적금', '청약'],
    계좌: [
      { 번호: '013-00002-00001', 상품: '신용카드',   잔액: 0,         상태: '정상' },
      { 번호: '013-00002-00002', 상품: '자유적금',   잔액: 8_100_000, 상태: '정상' },
      { 번호: '013-00002-00003', 상품: '청약',       잔액: 2_400_000, 상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.11', 내용: '카드이용', 금액: -85_000 },
      { 일자: '01.09', 내용: '급여입금', 금액:  4_330_000 },
      { 일자: '01.05', 내용: 'ATM출금',  금액: -200_000 },
    ],
  },
  '030303': {
    고객번호: '100000003', 고객명: '성춘향', 유형: '개인사업자',
    생년월일: '1975-XX-XX', 성별: '여', 연락처: '010-0000-0003',
    주소: '가상시 성춘향로 3', 등급: '일반',
    사업정보: {
      사업자번호: '000-00-00003', 상호: '춘향 공예 공방',
      업종: '공예품 제조·판매 (소매)', 설립일: '2015-03-01', 연매출: '약 3,800만원',
    },
    보유상품: ['수시입출금', '사업자통장', '당행청약예부금', '타행청약예부금'],
    계좌: [
      { 번호: '013-00003-00001', 상품: '수시입출금', 잔액: 450_000,  상태: '정상' },
      { 번호: '013-00003-00002', 상품: '사업자통장', 잔액: 1_200_000, 상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.10', 내용: '카드단말수수료', 금액: -45_000 },
      { 일자: '01.08', 내용: '재료비이체',     금액: -1_200_000 },
      { 일자: '01.05', 내용: '매출입금',       금액:  2_300_000 },
    ],
  },
  '040404': {
    고객번호: '100000004', 고객명: '심청', 유형: '개인',
    생년월일: '1997-XX-XX', 성별: '여', 연락처: '010-0000-0004',
    주소: '가상시 심청로 4', 등급: '일반',
    보유상품: ['수시입출금', '체크카드', '타행청약예부금'],
    계좌: [
      { 번호: '013-00004-00001', 상품: '수시입출금', 잔액: 1_850_000, 상태: '정상' },
      { 번호: '013-00004-00002', 상품: '체크카드',   잔액: 0,         상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.12', 내용: '급여입금', 금액:  2_800_000 },
      { 일자: '01.10', 내용: '월세이체', 금액: -650_000 },
      { 일자: '01.08', 내용: '카드이용', 금액: -120_000 },
    ],
  },
  '050505': {
    고객번호: '100000005', 고객명: '전우치', 유형: '법인',
    생년월일: '1966-XX-XX', 성별: '남', 연락처: '010-0000-0005',
    주소: '가상시 전우치로 5', 등급: 'VIP',
    사업정보: {
      사업자번호: '000-81-00005', 상호: '(주)전우치컨설팅',
      업종: '경영·기술 컨설팅업', 대표자: '전우치', 설립일: '2010-06-01', 연매출: '약 48억원',
    },
    보유상품: ['수시입출금', '정기예금', '신용카드', '펀드', '변액보험', '법인당좌예금', '청약예부금'],
    계좌: [
      { 번호: '013-00005-00001', 상품: '정기예금',     잔액: 50_000_000, 상태: '정상' },
      { 번호: '013-00005-00002', 상품: '수시입출금',   잔액: 8_500_000,  상태: '정상' },
      { 번호: '013-00005-00003', 상품: '법인당좌예금', 잔액: 24_000_000, 상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.12', 내용: '연금입금', 금액:  4_000_000 },
      { 일자: '01.10', 내용: '증권이체', 금액: -3_000_000 },
      { 일자: '01.08', 내용: '카드이용', 금액: -250_000 },
    ],
  },
  '060606': {
    고객번호: '100000006', 고객명: '김만덕', 유형: '법인',
    생년월일: '1972-XX-XX', 성별: '여', 연락처: '010-0000-0006',
    주소: '가상시 김만덕로 6', 등급: 'VIP',
    사업정보: {
      사업자번호: '000-81-00006', 상호: '(주)만덕정공',
      업종: '금속 부품 제조업', 대표자: '김만덕', 설립일: '2005-09-01', 연매출: '약 128억원',
    },
    보유상품: ['법인당좌예금', '기업자유적금', '법인카드', '무역금융', '퇴직연금'],
    계좌: [
      { 번호: '013-00006-00001', 상품: '법인당좌예금', 잔액: 42_000_000, 상태: '정상' },
      { 번호: '013-00006-00002', 상품: '기업자유적금', 잔액: 18_000_000, 상태: '정상' },
      { 번호: '013-00006-00003', 상품: '무역금융',     잔액: 0,           상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.13', 내용: '원자재대금이체', 금액: -85_000_000 },
      { 일자: '01.11', 내용: '수출대금입금',   금액:  210_000_000 },
      { 일자: '01.08', 내용: '급여일괄이체',   금액: -48_000_000 },
    ],
  },
  '070707': {
    고객번호: '100000007', 고객명: '장보고', 유형: '법인',
    생년월일: '1979-XX-XX', 성별: '남', 연락처: '010-0000-0007',
    주소: '가상시 장보고로 7', 등급: 'VIP',
    사업정보: {
      사업자번호: '000-81-00007', 상호: '(주)보고무역',
      업종: '글로벌 수출입 무역업', 대표자: '장보고', 설립일: '2008-03-15', 연매출: '약 320억원',
    },
    보유상품: ['법인당좌예금', '외화예금', '법인카드', '무역금융', 'B2B전자결제', '퇴직연금'],
    계좌: [
      { 번호: '013-00007-00001', 상품: '법인당좌예금',   잔액: 150_000_000, 상태: '정상' },
      { 번호: '013-00007-00002', 상품: '외화예금 (USD)', 잔액: 95_000_000,  상태: '정상' },
      { 번호: '013-00007-00003', 상품: '외화예금 (EUR)', 잔액: 38_000_000,  상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.14', 내용: '해외송금(中)',   금액: -320_000_000 },
      { 일자: '01.12', 내용: '수입대금입금',   금액:  680_000_000 },
      { 일자: '01.09', 내용: '급여일괄이체',   금액: -95_000_000 },
    ],
  },
  '080808': {
    고객번호: '100000008', 고객명: '박문수', 유형: '개인사업자',
    생년월일: '1977-XX-XX', 성별: '남', 연락처: '010-0000-0008',
    주소: '가상시 박문수로 8', 등급: '일반',
    사업정보: {
      사업자번호: '000-04-00008', 상호: '문수한식당',
      업종: '한식 음식점업', 설립일: '2021-04-01', 연매출: '약 9,600만원',
    },
    보유상품: ['사업자통장', '수시입출금', '사업자카드', '가맹점(카드)', '결제계좌(당행)'],
    계좌: [
      { 번호: '013-00008-00001', 상품: '사업자통장',  잔액: 4_200_000, 상태: '정상' },
      { 번호: '013-00008-00002', 상품: '수시입출금',  잔액: 880_000,   상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.13', 내용: '식재료매입',    금액: -2_800_000 },
      { 일자: '01.11', 내용: '카드매출입금',  금액:  6_400_000 },
      { 일자: '01.08', 내용: '임대료이체',    금액: -1_500_000 },
    ],
  },
  '090909': {
    고객번호: '100000009', 고객명: '허준', 유형: '개인사업자',
    생년월일: '1983-XX-XX', 성별: '남', 연락처: '010-0000-0009',
    주소: '가상시 허준로 9', 등급: '우량',
    사업정보: {
      사업자번호: '000-04-00009', 상호: '허준한의원',
      업종: '한방 의료업', 설립일: '2018-07-01', 연매출: '약 1.8억원',
    },
    보유상품: ['사업자통장', '정기예금', '사업자카드', '수시입출금', '타행청약예부금'],
    계좌: [
      { 번호: '013-00009-00001', 상품: '사업자통장', 잔액: 11_500_000, 상태: '정상' },
      { 번호: '013-00009-00002', 상품: '정기예금',   잔액: 30_000_000, 상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.13', 내용: '보험청구입금',  금액:  8_200_000 },
      { 일자: '01.11', 내용: '의료기기리스료', 금액: -1_200_000 },
      { 일자: '01.09', 내용: '직원급여',      금액: -4_800_000 },
    ],
  },
  '101010': {
    고객번호: '100000010', 고객명: '한비즈', 유형: '개인사업자',
    생년월일: '1989-XX-XX', 성별: '여', 연락처: '010-0000-0010',
    주소: '가상시 한비즈로 10', 등급: '우량',
    사업정보: {
      사업자번호: '000-04-00010', 상호: '한비즈 브런치',
      업종: '커피·음료 전문점', 설립일: '2025-09-01', 연매출: '약 4,200만원',
    },
    보유상품: [
      '사업자통장',
      '사업자카드',
      '가맹점(VAN·카드)',
      '결제계좌(타행)',
      '개업초기',
      '온라인(배민·쿠팡)',
    ],
    계좌: [
      { 번호: '013-00010-00001', 상품: '사업자통장', 잔액: 2_100_000, 상태: '정상' },
      { 번호: '013-00010-00002', 상품: '사업자카드', 잔액: 0,         상태: '정상' },
    ],
    최근거래: [
      { 일자: '01.14', 내용: '카드매출입금(타행)', 금액:  1_850_000 },
      { 일자: '01.12', 내용: '원두매입',           금액:   -620_000 },
      { 일자: '01.10', 내용: '배민정산입금',       금액:    980_000 },
    ],
  },

  // ── 시연 전용 고객 ─────────────────────────────────────
  '940301': {
    고객번호: '100000011', 고객명: '김민지', 유형: '개인',
    생년월일: '1994-03-01', 성별: '여', 연락처: '010-1234-5678',
    주소: '대구시 수성구 전세로 32', 등급: '일반',
    보유상품: ['수시입출금', '체크카드'],
    계좌: [
      { 번호: '013-11001-00001', 상품: '수시입출금', 잔액: 5_800_000, 상태: '정상' },
      { 번호: '013-11001-00002', 상품: '체크카드',   잔액: 0,         상태: '정상' },
    ],
    최근거래: [
      { 일자: '04.28', 내용: '전세보증금 이체',   금액: -50_000_000 },
      { 일자: '04.25', 내용: '타행 급여입금',     금액:   3_200_000 },
      { 일자: '04.20', 내용: '생활비 카드(타행)', 금액:    -950_000 },
      { 일자: '04.15', 내용: '보험료 자동이체',   금액:    -180_000 },
    ],
  },
  '810502': {
    고객번호: '100000012', 고객명: '박성호', 유형: '개인사업자',
    생년월일: '1981-05-02', 성별: '남', 연락처: '010-9876-5432',
    주소: '대구시 중구 음식점로 45', 등급: '일반',
    사업정보: {
      사업자번호: '502-04-00812', 상호: '성호한식당',
      업종: '음식점업 (한식)', 설립일: '2018-03-01', 연매출: '약 4억 5,600만원',
    },
    보유상품: ['사업자통장', '수시입출금'],
    계좌: [
      { 번호: '013-12001-00001', 상품: '사업자통장', 잔액: 8_200_000, 상태: '정상' },
    ],
    최근거래: [
      { 일자: '04.28', 내용: '식자재 대금',        금액: -14_500_000 },
      { 일자: '04.25', 내용: '카드매출입금(타행)', 금액:  27_000_000 },
      { 일자: '04.20', 내용: '임대료 이체',        금액:  -3_500_000 },
      { 일자: '04.15', 내용: '인건비',             금액:  -9_000_000 },
    ],
  },
  '660101': {
    고객번호: '100000013', 고객명: '대구정밀부품(주)', 유형: '법인',
    생년월일: '1966-01-01', 성별: '남', 연락처: '053-000-1234',
    주소: '대구시 달성군 테크노대로 100', 등급: 'VIP',
    사업정보: {
      사업자번호: '000-81-00660', 상호: '대구정밀부품 주식회사',
      업종: '자동차 부품 제조업', 대표자: '김대표', 설립일: '2008-06-01', 연매출: '약 57억 6,000만원',
    },
    보유상품: ['법인 입출금통장', '인터넷뱅킹'],
    계좌: [
      { 번호: '013-13001-00001', 상품: '법인 입출금통장', 잔액: 73_000_000, 상태: '정상' },
    ],
    최근거래: [
      { 일자: '04.28', 내용: '원자재 대금',   금액: -260_000_000 },
      { 일자: '04.25', 내용: '매출 입금',     금액:  480_000_000 },
      { 일자: '04.20', 내용: '급여 일괄이체', 금액:  -95_000_000 },
      { 일자: '04.15', 내용: '기존 대출 이자',금액:   -1_200_000 },
    ],
  },
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
  const { mode, isOppCompleted, addKpi, cardIssuedFor } = useKpi()
  const { activeResidentId } = useCustomer()

  const [customer, setCustomer] = useState<MockCustomer | null>(null)
  const [notFound, setNotFound] = useState(false)

  // 고객 변경 → MOCK_DB 조회
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

  type OppRow = {
    key: string
    title: string
    kpi: number
    category: string
    criteria: string
    limit: string | number
    desc: string
    Icon: ComponentType<{ size?: number }>
  }

  const opportunities: OppRow[] = useMemo(() => {
    if (!customer) return []
    if (mode === 'mastercard') {
      return buildMastercardOpportunities(customer).map(o => ({
        key: o.key,
        title: o.title,
        kpi: o.kpi,
        category: o.category,
        criteria: o.criteria,
        limit: o.limit,
        desc: o.desc,
        Icon: o.Icon,
      }))
    }
    if (mode === 'cheongyak') {
      return buildCheongyakOpportunities(customer).map(o => ({
        key: o.key,
        title: o.title,
        kpi: o.kpi,
        category: o.category,
        criteria: o.criteria,
        limit: o.limit,
        desc: o.desc,
        Icon: o.Icon,
      }))
    }
    return getKpiRules(customer.유형)
      .filter(r => !customer.보유상품.some(p => p.includes(r.key)))
      .map(r => ({
        key: r.key,
        title: r.product,
        kpi: r.points,
        category: r.productGroup,
        criteria: r.criteria,
        limit: r.halfYearLimit,
        desc: OPP_META[r.key]?.desc(r.points) ?? `${r.product} → +${r.points}pt`,
        Icon: OPP_META[r.key]?.Icon ?? Monitor,
      }))
  }, [customer, mode])

  const isDone = (key: string) =>
    customer ? isOppCompleted(customer.고객번호, key) : false

  // 마스터카드/청약 모드 — 실제 거래(카드 발급)가 완료된 경우에만 거래 완료 허용
  // cardIssuedFor 는 Screen0310에서 신청 완료 시 set되는 residentIdFront (6자리)
  const currentResidentFront = activeResidentId?.slice(0, 6) ?? ''
  const canCompleteOpp = (oppMode: typeof mode): boolean => {
    if (oppMode === 'default') return true
    if (oppMode === 'mastercard') return cardIssuedFor === currentResidentFront
    if (oppMode === 'cheongyak') return true
    return true
  }

  const sortedOpps = [...opportunities].sort((a, b) => b.kpi - a.kpi).slice(0, 4)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 빈 상태 */}
      {!customer && !notFound && (
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
            key={customer.고객번호}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* ── AI 영업기회 분석 버튼 (모든 고객) ── */}
            <DemoAnalysisButton
              demo={DEMO_MAP[customer.고객번호] ?? toDemoCustomer(customer)}
              customerName={customer.고객명}
              mockCustomer={customer}
              custId={CUST_ID_MAP[customer.고객번호]}
            />

            {/* ── 기본정보 ── */}
            <CollapseSection title="기본정보" icon={User}>
              <table className="crm-table">
                <tbody>
                  <tr><td className="crm-td-label">고객명</td><td className="crm-name">{customer.고객명}</td></tr>
                  <tr><td className="crm-td-label">연락처</td><td style={{ fontWeight: 600 }}>{customer.연락처}</td></tr>
                  {customer.사업정보 && <>
                    <tr><td className="crm-td-label">상호</td><td style={{ fontWeight: 700 }}>{customer.사업정보.상호}</td></tr>
                    <tr><td className="crm-td-label">업종</td><td>{customer.사업정보.업종}</td></tr>
                    {customer.사업정보.연매출 && <tr><td className="crm-td-label">연매출</td><td style={{ color: '#007a64', fontWeight: 700 }}>{customer.사업정보.연매출}</td></tr>}
                  </>}
                </tbody>
              </table>
            </CollapseSection>

            {/* ── 보유 상품 ── */}
            <CollapseSection title="보유상품" icon={CreditCard}>
              <div className="prod-tags">
                {customer.보유상품.map(p => (
                  <span key={p} className="prod-tag">{p}</span>
                ))}
              </div>
            </CollapseSection>

            {/* ── 추천 상품 ── */}
            <CollapseSection title="추천 상품" icon={Sparkles} badge={customer.유형 !== '개인' ? customer.유형 : undefined}>
              <div className="crm-rec-list">
                {getRecommendedProducts(customer.유형, customer.보유상품).map(p => (
                  <div key={p.name} className={`crm-rec-item crm-rec--${p.priority}`}>
                    <div className="crm-rec-name">{p.name}</div>
                    <div className="crm-rec-desc">{p.desc}</div>
                    {p.priority === 'high' && <span className="crm-rec-badge">추천</span>}
                  </div>
                ))}
              </div>
            </CollapseSection>

            {/* ── 금리 우대 방법 ── */}
            <CollapseSection title="금리 우대 방법" icon={TrendingDown} defaultOpen={false}>
              <p className="crm-doc-note" style={{ marginBottom: 6 }}>아래 상품 보유 시 대출 금리 추가 우대</p>
              {getRateImprovements(customer.유형, customer.보유상품).map(r => (
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

            {/* ── 영업기회: 현재 이벤트·고객 기준 적용 건이 있을 때만 섹션 표시 ── */}
            {opportunities.length > 0 && (
            <CollapseSection
              title="영업기회"
              icon={Sparkles}
              badge={
                mode === 'mastercard'
                  ? `MC +${opportunities.reduce((s, o) => s + o.kpi, 0).toFixed(1)}pt`
                  : mode === 'cheongyak'
                    ? `청약 +${opportunities.reduce((s, o) => s + o.kpi, 0).toFixed(1)}pt`
                    : `+${opportunities.reduce((s, o) => s + o.kpi, 0).toFixed(1)}pt`
              }
            >
                <motion.div
                  key={mode}
                  className="opp-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
                  >
                    {sortedOpps.map(opp => {
                      const done = isDone(opp.key)
                      const OppIcon = opp.Icon
                      const mc = mode === 'mastercard'
                      const cq = mode === 'cheongyak'
                      const kpiLabel = Number.isInteger(opp.kpi) ? `${opp.kpi}` : opp.kpi.toFixed(1)
                      const footerSub = mc || cq
                        ? opp.criteria
                        : `${opp.category} · 한도 ${opp.limit}pt`
                      return (
                        <motion.div
                          key={`${mode}-${opp.key}`}
                          variants={{ hidden: { opacity: 0, x: 16 }, visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } } }}
                          className={`opp-card${done ? ' opp-card--done' : ''}${mc ? ' opp-card--mc' : ''}${cq ? ' opp-card--cq' : ''}`}
                          layout
                        >
                          <div className="opp-card-top">
                            <span className={`opp-icon-wrap${mc ? ' opp-icon-wrap--mc' : ''}${cq ? ' opp-icon-wrap--cq' : ''}`}><OppIcon size={14} /></span>
                            <div className="opp-product-cell">
                              <span className="opp-product">{opp.title}</span>
                            </div>
                            {done
                              ? <span className="opp-done-badge"><CheckCircle2 size={11} style={{ marginRight: 3 }} />완료</span>
                              : <span className={`opp-kpi-badge${mc ? ' opp-kpi-badge--mc' : ''}${cq ? ' opp-kpi-badge--cq' : ''}`}>+{kpiLabel}pt</span>}
                          </div>
                          <div className="opp-desc">{opp.desc}</div>
                          <div className="opp-footer">
                            <span className="opp-category">{footerSub}</span>
                            {(() => {
                              const canComplete = canCompleteOpp(mode)
                              const btnDisabled = done || !canComplete
                              return (
                                <button
                                  className={`opp-btn${mc ? ' opp-btn--mc' : ''}${cq ? ' opp-btn--cq' : ''}${!canComplete && !done ? ' opp-btn--locked' : ''}`}
                                  disabled={btnDisabled}
                                  title={!canComplete && !done ? '카드 발급 후 거래 완료 가능합니다' : undefined}
                                  onClick={() => {
                                    addKpi(
                                      opp.kpi,
                                      mc ? `MC ${opp.title}` : cq ? `청약 ${opp.title}` : `${opp.key} 신규`,
                                      opp.key,
                                      customer.고객번호,
                                    )
                                  }}
                                >
                                  {done ? '완료됨' : !canComplete ? '🔒 거래 완료' : '거래 완료'}
                                </button>
                              )
                            })()}
                          </div>
                        </motion.div>
                      )
                    })}
                  </motion.div>
                </motion.div>
            </CollapseSection>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
