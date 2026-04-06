/**
 * AI 분석용 가상 고객 데이터
 * 실제 인물과 무관한 한국 고전 소설 등장인물 기반 가상 캐릭터
 */

export interface CustomerAccount {
  number: string
  product: string
  balance: number
  status: '정상' | '연체' | '해지'
}

export interface CustomerTransaction {
  date: string
  desc: string
  amount: number
}

export interface DummyCustomer {
  id: string
  /** 주민번호 앞 6자리 — CrmPanel MOCK_DB, Screen0156 연동 키 */
  residentIdFront: string
  name: string
  age: number
  gender: '남' | '여'
  job: string
  annualIncome: number   // 만원
  creditScore: number    // 300~1000
  totalAssets: number    // 만원
  totalDebt: number      // 만원
  grade: 'VIP' | '우량' | '일반' | '관리'
  products: string[]
  accounts: CustomerAccount[]
  recentTransactions: CustomerTransaction[]
  notes: string
}

export const DUMMY_CUSTOMERS: DummyCustomer[] = [
  {
    id: 'C001',
    residentIdFront: '010101',
    name: '홍길동',
    age: 34,
    gender: '남',
    job: '직장인 (IT 개발자)',
    annualIncome: 6800,
    creditScore: 872,
    totalAssets: 23000,
    totalDebt: 5000,
    grade: 'VIP',
    products: ['수시입출금', '자유적금'],
    accounts: [
      { number: '013-00001-00001', product: '자유적금',   balance: 5_420_000, status: '정상' },
      { number: '013-00001-00002', product: '수시입출금', balance: 1_230_000, status: '정상' },
    ],
    recentTransactions: [
      { date: '2026-01-12', desc: '타행입금',    amount:  3_000 },
      { date: '2026-01-10', desc: '이체출금',    amount: -500_000 },
      { date: '2026-01-08', desc: '급여입금',    amount:  5_600_000 },
      { date: '2026-01-05', desc: 'ATM 출금',    amount: -300_000 },
      { date: '2026-01-01', desc: '공과금 이체', amount: -120_000 },
    ],
    notes: 'IT 대기업 재직 중. 결혼 2년차, 자녀 계획 있음. 주택 구입 관심 표명. 투자 경험 없음.',
  },
  {
    id: 'C002',
    residentIdFront: '020202',
    name: '이몽룡',
    age: 39,
    gender: '남',
    job: '공무원 (행정직)',
    annualIncome: 5200,
    creditScore: 911,
    totalAssets: 45000,
    totalDebt: 8500,
    grade: '우량',
    products: ['수시입출금', '신용카드', '자유적금', '청약'],
    accounts: [
      { number: '013-00002-00001', product: '신용카드',   balance: 0,         status: '정상' },
      { number: '013-00002-00002', product: '자유적금',   balance: 8_100_000, status: '정상' },
      { number: '013-00002-00003', product: '청약',       balance: 2_400_000, status: '정상' },
    ],
    recentTransactions: [
      { date: '2026-01-11', desc: '카드 이용',  amount: -85_000 },
      { date: '2026-01-09', desc: '급여입금',   amount:  4_330_000 },
      { date: '2026-01-05', desc: 'ATM 출금',   amount: -200_000 },
      { date: '2025-12-28', desc: '적금 납입',  amount: -500_000 },
      { date: '2025-12-25', desc: '카드 이용',  amount: -230_000 },
    ],
    notes: '안정적인 공무원 수입. 자녀 2명(초등). 내년 아파트 청약 예정. 재테크 관심 높음. ISA 관련 문의 이력 있음.',
  },
  {
    id: 'C003',
    residentIdFront: '030303',
    name: '성춘향',
    age: 49,
    gender: '여',
    job: '자영업 (공예 공방)',
    annualIncome: 3800,
    creditScore: 648,
    totalAssets: 12000,
    totalDebt: 15000,
    grade: '일반',
    products: ['수시입출금'],
    accounts: [
      { number: '013-00003-00001', product: '수시입출금', balance: 450_000, status: '정상' },
    ],
    recentTransactions: [
      { date: '2026-01-10', desc: '카드 단말기 수수료', amount: -45_000 },
      { date: '2026-01-08', desc: '재료비 이체',        amount: -1_200_000 },
      { date: '2026-01-05', desc: '매출 입금',          amount:  2_300_000 },
      { date: '2026-01-01', desc: '임대료 이체',        amount: -800_000 },
      { date: '2025-12-28', desc: '매출 입금',          amount:  1_900_000 },
    ],
    notes: '부채가 자산 초과 상태. 신용대출 이력 있음. 사업 매출 변동성 큼. 노후 준비 거의 없음. 자녀 대학 입학 예정.',
  },
  {
    id: 'C004',
    residentIdFront: '040404',
    name: '심청',
    age: 27,
    gender: '여',
    job: '사회초년생 (디자이너)',
    annualIncome: 3600,
    creditScore: 740,
    totalAssets: 3500,
    totalDebt: 1200,
    grade: '일반',
    products: ['수시입출금', '체크카드'],
    accounts: [
      { number: '013-00004-00001', product: '수시입출금', balance: 1_850_000, status: '정상' },
      { number: '013-00004-00002', product: '체크카드',   balance: 0,         status: '정상' },
    ],
    recentTransactions: [
      { date: '2026-01-12', desc: '급여입금',  amount:  2_800_000 },
      { date: '2026-01-10', desc: '월세 이체', amount: -650_000 },
      { date: '2026-01-08', desc: '카드 이용', amount: -120_000 },
      { date: '2026-01-05', desc: '카드 이용', amount: -55_000 },
      { date: '2026-01-01', desc: '보험료',    amount: -89_000 },
    ],
    notes: '취업 2년차. 결혼 계획 없음. 재테크 시작 희망. 학자금 대출 상환 중. ISA·펀드 관심 표명.',
  },
  {
    id: 'C005',
    residentIdFront: '050505',
    name: '전우치',
    age: 58,
    gender: '남',
    job: '은퇴 (전직 교수)',
    annualIncome: 4800,
    creditScore: 955,
    totalAssets: 120000,
    totalDebt: 0,
    grade: 'VIP',
    products: ['수시입출금', '정기예금', '신용카드', '펀드', '변액보험'],
    accounts: [
      { number: '013-00005-00001', product: '정기예금',   balance: 50_000_000, status: '정상' },
      { number: '013-00005-00002', product: '수시입출금', balance: 8_500_000,  status: '정상' },
      { number: '013-00005-00003', product: '펀드',       balance: 24_000_000, status: '정상' },
    ],
    recentTransactions: [
      { date: '2026-01-12', desc: '연금 입금', amount:  4_000_000 },
      { date: '2026-01-10', desc: '증권 이체', amount: -3_000_000 },
      { date: '2026-01-08', desc: '카드 이용', amount: -250_000 },
      { date: '2026-01-05', desc: '의료비',    amount: -180_000 },
      { date: '2026-01-01', desc: '펀드 수익', amount:  650_000 },
    ],
    notes: '자녀 2명 모두 독립. 건강 이상 없음. 유산 계획 있음. 해외여행 잦음. ISA·신탁 상품 추가 관심. 세금 절감 방법 문의.',
  },
]

/** 고객 데이터를 AI 분석용 프롬프트 텍스트로 변환 */
export function buildAnalysisPrompt(customer: DummyCustomer): string {
  const productList = customer.products.join(', ') || '없음'
  const txList = customer.recentTransactions
    .map(t => `  - ${t.date}: ${t.desc} (${t.amount > 0 ? '+' : ''}${t.amount.toLocaleString()}원)`)
    .join('\n')

  return `당신은 iM뱅크의 AI 금융 상담 어시스턴트입니다. 아래 고객 정보를 분석하여 반드시 JSON 형식으로만 응답해주세요.

[고객 정보]
- 고객 ID: ${customer.id}
- 이름: ${customer.name} (${customer.age}세, ${customer.gender})
- 직업: ${customer.job}
- 연소득: 약 ${customer.annualIncome.toLocaleString()}만원
- 신용점수: ${customer.creditScore}점
- 총자산: ${customer.totalAssets.toLocaleString()}만원
- 총부채: ${customer.totalDebt.toLocaleString()}만원
- 고객 등급: ${customer.grade}
- 보유 상품: ${productList}
- 추가 메모: ${customer.notes}

[최근 거래 내역]
${txList}

[분석 요청]
위 고객 정보를 바탕으로 다음 내용을 JSON으로 분석해주세요:
1. 재무 건강 요약 및 점수 (0~100)
2. 핵심 영업 기회 목록 (상품명, 이유, 우선순위, 예상 KPI 점수)
3. 리스크 요인
4. 맞춤 추천 메시지 (은행원이 고객에게 할 수 있는 말)

반드시 아래 JSON 형식으로만 응답하세요 (마크다운, 코드블록 없이 순수 JSON):
{
  "customerSummary": "한 줄 고객 요약",
  "financialScore": 0~100,
  "financialHealthLabel": "우수|양호|보통|주의|위험",
  "opportunities": [
    {
      "product": "상품명",
      "reason": "추천 이유",
      "priority": "높음|중간|낮음",
      "kpiScore": 숫자
    }
  ],
  "risks": ["리스크 항목"],
  "recommendedScript": "은행원 추천 멘트 (자연스러운 한국어)",
  "nextActions": ["다음 행동 1", "다음 행동 2"]
}`
}
