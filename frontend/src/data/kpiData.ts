/**
 * iM뱅크 활동고객 교차판매 KPI 포인트 기준표
 *
 * 출처: 활동고객_교차판매 (2/8)_개인, (3/8)_기업/기업지점
 *
 * customerType:
 *   'personal'  — 개인 고객 기준
 *   'corporate' — 기업/기업지점 기준
 *   'both'      — 공통 적용
 */

export interface KpiRule {
  key: string             // OPPORTUNITIES key와 매핑
  productGroup: string    // 상품군
  product: string         // 세부상품
  criteria: string        // 인정기준 (요약)
  points: number          // 기준 포인트
  halfYearLimit: number   // 반기 한도
  customerType: 'personal' | 'corporate' | 'both'
  txSection: '상품' | '서비스'
}

// ── 개인 고객 KPI 기준 ────────────────────────────────
export const KPI_PERSONAL: KpiRule[] = [
  {
    key: '요구불계좌',
    productGroup: '요구불', product: '요구불계좌',
    criteria: '당일 20만원 이상 입금 신규',
    points: 1, halfYearLimit: 7,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: '거치식예금',
    productGroup: '거치식', product: '거치식 예금',
    criteria: '200만원 이상 신규',
    points: 0.5, halfYearLimit: 1,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: '적립식예금',
    productGroup: '적립식', product: '적립식 예금',
    criteria: '20만원 이상 신규 + 자동이체 20만원 이상',
    points: 0.2, halfYearLimit: 0.4,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: '청약',
    productGroup: '주택청약', product: '주택청약종합저축',
    criteria: '2만원 이상 신규',
    points: 0.5, halfYearLimit: 1,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: 'ISA',
    productGroup: '수익증권', product: '수익증권/ISA',
    criteria: '10만원 이상 적립 + 자동이체 10만원 이상',
    points: 1, halfYearLimit: 6,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: '펀드',
    productGroup: '수익증권', product: '수익증권 (임의)',
    criteria: '100만원 이상 임의 매수',
    points: 1, halfYearLimit: 6,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: 'IRP',
    productGroup: '퇴직연금', product: '개인형 IRP',
    criteria: '당일 10만원 이상 신규 + 자동이체 10만원 이상',
    points: 3, halfYearLimit: 3,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: '신용대출',
    productGroup: '대출', product: '서민지원대출',
    criteria: '500만원 이상',
    points: 1, halfYearLimit: 1,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: '신용카드',
    productGroup: '카드', product: '신용카드',
    criteria: '발급 후 누적 사용 10만원 이상 (체크 제외)',
    points: 1, halfYearLimit: 1,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: '방카',
    productGroup: '방카', product: '방카',
    criteria: '제한 없음',
    points: 2, halfYearLimit: 10,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: '외화통장',
    productGroup: '외환상품', product: '외화통장',
    criteria: '신규: 200$ 이상 당일 입금',
    points: 1, halfYearLimit: 2,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: '해외송금',
    productGroup: '외환거래', product: '해외송금(당타발)',
    criteria: 'USD 1,000 이상',
    points: 0.5, halfYearLimit: 2,
    customerType: 'personal', txSection: '상품',
  },
  {
    key: '소득이체',
    productGroup: '결제성(입금)', product: '소득이체',
    criteria: '신규: 100만원 이상 입금',
    points: 1.5, halfYearLimit: 8,
    customerType: 'personal', txSection: '서비스',
  },
  {
    key: '자동납부',
    productGroup: '결제성(출금)', product: '자동납부',
    criteria: '신규 신청 후 정상 출금 (건당)',
    points: 0.4, halfYearLimit: 10,
    customerType: 'personal', txSection: '서비스',
  },
  {
    key: '계좌이동제',
    productGroup: '결제성(입금)', product: '계좌이동제',
    criteria: '계좌이동 신청 후 변경 완료 통지 시 (최대 10건)',
    points: 4, halfYearLimit: 40,
    customerType: 'personal', txSection: '서비스',
  },
]

// ── 기업/기업지점 KPI 기준 ───────────────────────────
export const KPI_CORPORATE: KpiRule[] = [
  {
    key: '요구불계좌',
    productGroup: '요구불', product: '요구불계좌',
    criteria: '당일 100만원 이상 입금 신규',
    points: 1, halfYearLimit: 7,
    customerType: 'corporate', txSection: '상품',
  },
  {
    key: '거치식예금',
    productGroup: '거치식', product: '거치식 예금',
    criteria: '1,000만원 이상 신규',
    points: 0.5, halfYearLimit: 1,
    customerType: 'corporate', txSection: '상품',
  },
  {
    key: '적립식예금',
    productGroup: '적립식', product: '적립식 예금',
    criteria: '100만원 이상 신규 + 자동이체 100만원 이상',
    points: 0.2, halfYearLimit: 0.4,
    customerType: 'corporate', txSection: '상품',
  },
  {
    key: 'ISA',
    productGroup: '수익증권', product: '수익증권/ISA',
    criteria: '50만원 이상 적립 + 자동이체 50만원 이상',
    points: 2, halfYearLimit: 6,
    customerType: 'corporate', txSection: '상품',
  },
  {
    key: 'IRP',
    productGroup: '퇴직연금', product: 'DB/DC형(기업IRP)',
    criteria: '계좌 신규 후 누적 500만원 이상',
    points: 3, halfYearLimit: 3,
    customerType: 'corporate', txSection: '상품',
  },
  {
    key: '기업대출',
    productGroup: '대출', product: '기업대출',
    criteria: '당일 1,000만원 이상 신규',
    points: 2, halfYearLimit: 2,
    customerType: 'corporate', txSection: '상품',
  },
  {
    key: '신용카드',
    productGroup: '카드', product: '기업 신용카드',
    criteria: '발급 후 누적 사용 50만원 이상 (체크 제외)',
    points: 1, halfYearLimit: 1,
    customerType: 'corporate', txSection: '상품',
  },
  {
    key: '방카',
    productGroup: '방카/공제', product: '방카(기업지점 제외)',
    criteria: '제한 없음 (기업지점은 노란우산공제 2pt 한도)',
    points: 2, halfYearLimit: 10,
    customerType: 'corporate', txSection: '상품',
  },
  {
    key: '외화통장',
    productGroup: '외환상품', product: '외화통장',
    criteria: '신규: 1,000$ 이상 당일 입금',
    points: 1, halfYearLimit: 2,
    customerType: 'corporate', txSection: '상품',
  },
  {
    key: '해외송금',
    productGroup: '외환거래', product: '해외송금/수출입',
    criteria: 'USD 5,000 이상',
    points: 2, halfYearLimit: 4,
    customerType: 'corporate', txSection: '상품',
  },
  {
    key: '가맹점',
    productGroup: '결제성(입금)', product: '가맹점 결계계좌',
    criteria: '가맹점 등록(CRM) 후 카드 매출대금 최초 입금',
    points: 5, halfYearLimit: 20,
    customerType: 'corporate', txSection: '서비스',
  },
  {
    key: '급여모계좌',
    productGroup: '결제성(입금)', product: '급여모계좌',
    criteria: '급여 모계좌 최초 등록 후 당행 신규 이체 (1회당)',
    points: 1, halfYearLimit: 12,
    customerType: 'corporate', txSection: '서비스',
  },
  {
    key: 'CMS',
    productGroup: 'CMS', product: '금융결제원 CMS',
    criteria: '공동CMS이용계약 체결 및 BPR 신규 완료',
    points: 10, halfYearLimit: 10,
    customerType: 'corporate', txSection: '서비스',
  },
  {
    key: '자동납부',
    productGroup: '결제성(출금)', product: '자동납부',
    criteria: '신규 신청 후 정상 출금 (건당)',
    points: 0.4, halfYearLimit: 10,
    customerType: 'corporate', txSection: '서비스',
  },
]

// ── 고객 유형별 조회 헬퍼 ──────────────────────────────
export function getKpiRules(customerType: '개인' | '개인사업자' | '법인'): KpiRule[] {
  return customerType === '개인' ? KPI_PERSONAL : KPI_CORPORATE
}

/** 특정 key의 포인트 조회 (없으면 0) */
export function getKpiPoints(
  key: string,
  customerType: '개인' | '개인사업자' | '법인',
): number {
  const rules = getKpiRules(customerType)
  return rules.find(r => r.key === key)?.points ?? 0
}
