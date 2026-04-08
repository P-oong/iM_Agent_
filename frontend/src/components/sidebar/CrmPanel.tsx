import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeDollarSign, BarChart3, Bot, Building2, CheckCircle2,
  ChevronDown, ChevronUp, CreditCard, Home,
  Landmark, Loader2, Monitor, Send, Shield, Sparkles, TrendingDown, User, Wallet,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCustomer } from '@/contexts/CustomerContext'
import { useKpi } from '@/contexts/KpiContext'
import { streamChatCompletion, DEFAULT_MODEL, DEFAULT_API_KEY } from '@/services/upstageApi'
import { getKpiRules } from '@/data/kpiData'
import '@/styles/kpi.css'

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

// ── 고객 유형별 필요 서류 ────────────────────────────
type DocGroup = { category: string; docs: string[] }

function getRequiredDocs(type: CustomerType): DocGroup[] {
  if (type === '개인') {
    return [
      { category: '신분증',    docs: ['주민등록증 또는 운전면허증'] },
      { category: '소득증빙',  docs: ['근로소득원천징수영수증', '재직증명서 (근로자)'] },
      { category: '기타',      docs: ['인감도장 또는 서명 (해당 시)'] },
    ]
  }
  if (type === '개인사업자') {
    return [
      { category: '사업자 기본', docs: ['사업자등록증', '대표자 신분증', '인감증명서'] },
      { category: '세금/소득',   docs: ['부가가치세 과세표준증명원', '종합소득세 신고서 (최근 2년)', '소득금액증명원'] },
      { category: '거래 내역',   docs: ['사업용 계좌 거래내역 (최근 6개월)', '매출 증빙자료'] },
      { category: '기타',        docs: ['임대차계약서 (임차 사업장)', '인감도장'] },
    ]
  }
  // 법인
  return [
    { category: '법인 기본',   docs: ['법인등기부등본', '법인인감증명서', '사업자등록증'] },
    { category: '재무 서류',   docs: ['재무제표 (최근 2개년)', '법인 계좌 거래내역 (최근 6개월)', '부가가치세 신고서'] },
    { category: '지배구조',    docs: ['주주명부', '이사회 의사록 (해당 시)', '대표이사 신분증'] },
    { category: '기타',        docs: ['법인인감도장 지참', '사업계획서 (신규 대출 시)'] },
  ]
}

// ── 고객 유형별 추천 상품 ─────────────────────────────
type RecommendedProduct = { name: string; desc: string; priority: 'high' | 'mid' | 'low' }

function getRecommendedProducts(type: CustomerType, products: string[]): RecommendedProduct[] {
  if (type === '개인') {
    return [
      { name: 'iM 신용카드',    desc: '소비 패턴 맞춤 캐시백·할인',       priority: products.includes('신용카드') ? 'low' : 'high' },
      { name: 'iM LIVING 카드', desc: '생활요금 10% 할인',                  priority: 'mid' },
      { name: '청약저축',        desc: '내집 마련 필수 상품',                priority: products.includes('청약') ? 'low' : 'high' },
      { name: 'ISA 계좌',       desc: '비과세 절세 통합 자산관리',           priority: products.includes('ISA') ? 'low' : 'high' },
    ]
  }
  if (type === '개인사업자') {
    return [
      { name: '사업자대출',      desc: '운전자금·시설자금 저금리 지원',      priority: 'high' },
      { name: '사업자 신용카드', desc: '세금계산서 발행, 업무 비용 관리',     priority: 'high' },
      { name: '당좌예금',        desc: '수표·어음 결제 및 자금 관리',         priority: 'mid'  },
      { name: '기업자유적금',    desc: '여유 자금 불입, 우대금리 제공',        priority: 'mid'  },
      { name: 'PG서비스',        desc: '카드 결제 단말기 우대 수수료',         priority: 'mid'  },
    ]
  }
  // 법인
  return [
    { name: '기업운전자금대출', desc: '법인 운영 자금, 한도 우대',            priority: 'high' },
    { name: '법인당좌예금',     desc: '수표·전자어음 결제 전용 계좌',          priority: 'high' },
    { name: '법인 신용카드',    desc: '임직원 법인카드, 비용 통합 관리',       priority: 'high' },
    { name: '기업외환서비스',   desc: '수출입 환전·송금 우대수수료',            priority: 'mid'  },
    { name: '퇴직연금(DB/DC)',  desc: '임직원 퇴직연금 운용',                  priority: 'mid'  },
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
    보유상품: ['수시입출금', '자유적금'],
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
    보유상품: ['수시입출금', '사업자통장'],
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
    보유상품: ['수시입출금', '체크카드'],
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
    보유상품: ['수시입출금', '정기예금', '신용카드', '펀드', '변액보험', '법인당좌예금'],
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
    보유상품: ['사업자통장', '수시입출금', '사업자카드'],
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
    보유상품: ['사업자통장', '정기예금', '사업자카드', '수시입출금'],
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

// ── 고객 데이터 → AI 프롬프트 요약 ─────────────────────
function buildCustomerContext(c: MockCustomer): string {
  const totalBal = c.계좌.reduce((s, a) => s + a.잔액, 0)
  const lines = [
    `고객명: ${c.고객명} / 유형: ${c.유형} / 등급: ${c.등급}`,
    `보유상품: ${c.보유상품.join(', ')}`,
    `총 잔액: ${totalBal.toLocaleString()}원`,
    `최근거래: ${c.최근거래.map(t => `${t.일자} ${t.내용} ${t.금액 > 0 ? '+' : ''}${t.금액.toLocaleString()}`).join(' | ')}`,
  ]
  if (c.사업정보) {
    lines.push(`사업정보: ${c.사업정보.상호} (${c.사업정보.업종}) 연매출 ${c.사업정보.연매출 ?? '미확인'}`)
  }
  return lines.join('\n')
}

/** 자동 인사이트 요약용 — 이모지 + 핵심 내용, 5줄 이내 */
const AI_INSIGHT_SYSTEM = `당신은 iM뱅크 창구 행원을 돕는 AI 어시스턴트입니다.
고객 데이터를 분석하여 핵심 인사이트를 아래 형식으로 4~5줄로 답하세요.
각 줄은 이모지 하나로 시작하고 40자 이내의 자연스러운 한국어로 작성합니다.
예시)
💰 ISA·펀드 미보유 — 장기 투자 상품 추천 우선 검토
⚠️ 부채비율 높음 — 신규 대출 권유 전 상환 여력 확인 필요
✅ VIP 고객 — 프리미엄 우대금리·전용 혜택 적극 안내 권장
📋 청약 만기 도래 — 갱신 또는 목돈 운용 상품으로 전환 제안
🎯 카드 미보유 — iM i 카드 발급으로 즉시 KPI 적립 가능

추가 서론·인사 없이 인사이트 줄만 출력하세요.`

/** 채팅 Q&A용 — 구체적이고 실용적인 중간 수준 답변 */
const AI_CHAT_SYSTEM = `당신은 iM뱅크 창구 행원을 돕는 AI 어시스턴트입니다.
행원의 질문에 대해 다음 원칙으로 답변하세요.
- 3~5문장으로 핵심 내용을 담아 구체적으로 답합니다.
- 불필요한 서론·인사·반복 요약은 생략하고 바로 답변을 시작합니다.
- 상품 추천 시 이유·혜택·예상 KPI를 포함합니다.
- 법인·개인사업자 고객에게는 사업 특화 상품과 세무 혜택을 우선 언급합니다.
- 한국 은행 실무에 맞는 전문 표현을 사용하되 과도하게 격식체로 쓰지 마세요.`

type ChatMsg = { role: 'user' | 'ai'; text: string }

// ─────────────────────────────────────────────────────
export function CrmPanel() {
  const { completed, addKpi } = useKpi()
  const { activeResidentId } = useCustomer()

  const [customer,    setCustomer]    = useState<MockCustomer | null>(null)
  const [notFound,    setNotFound]    = useState(false)

  // AI 자동 분석
  const [aiSummary,   setAiSummary]   = useState('')
  const [aiLoading,   setAiLoading]   = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // AI 채팅
  const [chatMsgs,    setChatMsgs]    = useState<ChatMsg[]>([])
  const [chatInput,   setChatInput]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // 고객 변경 → MOCK_DB 조회 + AI 분석 트리거
  useEffect(() => {
    if (activeResidentId) {
      const found = MOCK_DB[activeResidentId.slice(0, 6)] ?? null
      setCustomer(found)
      setNotFound(!found)
      setAiSummary('')
      setChatMsgs([])
    } else {
      setCustomer(null)
      setNotFound(false)
      setAiSummary('')
      setChatMsgs([])
    }
  }, [activeResidentId])

  // 고객 확정 → AI 자동 분석 스트리밍
  useEffect(() => {
    if (!customer) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setAiSummary('')
    setAiLoading(true)

    const ctx = buildCustomerContext(customer)
    const messages = [
      { role: 'system' as const, content: AI_INSIGHT_SYSTEM },
      { role: 'user'   as const, content: `다음 고객을 분석해주세요:\n${ctx}` },
    ]

    streamChatCompletion(messages, DEFAULT_MODEL, DEFAULT_API_KEY, chunk => {
      setAiSummary(prev => prev + chunk)
    })
      .catch(() => {/* 취소/에러 무시 */})
      .finally(() => setAiLoading(false))

    return () => abortRef.current?.abort()
  }, [customer])

  // 채팅 메시지 추가 → 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMsgs, chatLoading])

  // 채팅 전송
  async function sendChat() {
    if (!chatInput.trim() || !customer || chatLoading) return
    const userText = chatInput.trim()
    setChatInput('')
    setChatMsgs(prev => [...prev, { role: 'user', text: userText }])
    setChatLoading(true)

    const ctx = buildCustomerContext(customer)
    const history = chatMsgs.map(m => ({
      role: (m.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.text,
    }))

    const messages = [
      { role: 'system' as const,    content: `${AI_CHAT_SYSTEM}\n\n현재 상담 고객 정보:\n${ctx}` },
      ...history,
      { role: 'user' as const,      content: userText },
    ]

    let aiText = ''
    setChatMsgs(prev => [...prev, { role: 'ai', text: '' }])

    try {
      await streamChatCompletion(messages, DEFAULT_MODEL, DEFAULT_API_KEY, chunk => {
        aiText += chunk
        setChatMsgs(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'ai', text: aiText }
          return next
        })
      })
    } catch {
      setChatMsgs(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'ai', text: '⚠ 응답 오류가 발생했습니다.' }
        return next
      })
    } finally {
      setChatLoading(false)
    }
  }

  // 고객 유형에 맞는 실제 KPI 기준표에서 영업기회 생성
  const opportunities = customer
    ? getKpiRules(customer.유형)
        .filter(r => !customer.보유상품.some(p => p.includes(r.key)))
        .map(r => ({
          key:      r.key,
          kpi:      r.points,
          category: r.productGroup,
          criteria: r.criteria,
          limit:    r.halfYearLimit,
          desc:     OPP_META[r.key]?.desc(r.points) ?? `${r.product} → +${r.points}pt`,
          Icon:     OPP_META[r.key]?.Icon ?? Monitor,
        }))
    : []
  const isDone = (key: string) =>
    customer ? completed.has(`${customer.고객번호}-${key}`) : false
  const sortedOpps = [...opportunities].sort((a, b) => b.kpi - a.kpi)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 빈 상태 */}
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
            {/* ── AI 인사이트 (자동 분석) ── */}
            <div className="crm-ai-card">
              <div className="crm-ai-header">
                <Bot size={13} />
                <span>AI 인사이트</span>
                {aiLoading && <Loader2 size={11} className="crm-ai-spin" />}
              </div>
              <div className="crm-ai-body">
                {aiSummary
                  ? <p className="crm-ai-text">{aiSummary}</p>
                  : aiLoading
                    ? <p className="crm-ai-placeholder">분석 중...</p>
                    : <p className="crm-ai-placeholder">분석 결과가 없습니다.</p>
                }
              </div>
            </div>

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

            {/* ── 영업기회 ── */}
            <CollapseSection
              title="영업기회"
              icon={Sparkles}
              badge={`+${opportunities.reduce((s, o) => s + o.kpi, 0).toFixed(1)}pt`}
            >
              {opportunities.length === 0 ? (
                <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: '6px 0' }}>추가 영업기회 없음</p>
              ) : (
                <motion.div
                  className="opp-list"
                  initial="hidden" animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
                >
                  {sortedOpps.map(opp => {
                    const done = isDone(opp.key)
                    const OppIcon = opp.Icon
                    return (
                      <motion.div
                        key={opp.key}
                        variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } } }}
                        className={`opp-card${done ? ' opp-card--done' : ''}`}
                      >
                        <div className="opp-card-top">
                          <span className="opp-icon-wrap"><OppIcon size={14} /></span>
                          <span className="opp-product">{opp.key}</span>
                          {done
                            ? <span className="opp-done-badge"><CheckCircle2 size={11} style={{ marginRight: 3 }} />완료</span>
                            : <span className="opp-kpi-badge">+{opp.kpi}pt</span>}
                        </div>
                        <div className="opp-desc">{opp.desc}</div>
                        <div className="opp-footer">
                          <span className="opp-category">{opp.category} · 한도 {opp.limit}pt</span>
                          <button className="opp-btn" disabled={done}
                            onClick={() => addKpi(opp.kpi, `${opp.key} 신규`, `${customer.고객번호}-${opp.key}`)}>
                            {done ? '완료됨' : '거래 완료'}
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </CollapseSection>

            {/* ── AI 채팅 Q&A ── */}
            <div className="crm-chat">
              <div className="crm-chat-header">
                <Bot size={12} />
                <span>AI에게 질문</span>
              </div>
              <div className="crm-chat-body">
                {chatMsgs.length === 0 && (
                  <p className="crm-chat-hint">
                    이 고객에 대해 무엇이든 물어보세요.<br />
                    예) "대출 가능할까요?" "어떤 카드 추천?"
                  </p>
                )}
                {chatMsgs.map((m, i) => (
                  <div key={i} className={`crm-chat-msg crm-chat-msg--${m.role}`}>
                    {m.text || <Loader2 size={10} className="crm-ai-spin" />}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="crm-chat-input-row">
                <input
                  className="crm-chat-input"
                  placeholder="질문 입력..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                  disabled={chatLoading}
                />
                <button
                  className="crm-chat-send"
                  onClick={sendChat}
                  disabled={!chatInput.trim() || chatLoading}
                  title="전송 (Enter)"
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
