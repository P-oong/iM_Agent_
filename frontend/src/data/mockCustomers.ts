// ── 고객 유형 ─────────────────────────────────────────────────────────────
// CrmPanel.CustomerInfo.customerType 과 동일한 유니온 타입입니다.

export type CustomerType = '개인' | '개인사업자' | '법인'

// ── 금리 우대 방법 ───────────────────────────────────────────────────────
export type RateItem = { product: string; rate: string; desc: string; have: boolean }

export function getRateImprovements(type: CustomerType, products: string[]): RateItem[] {
  const has = (p: string) => products.some(x => x.includes(p))

  const items: RateItem[] = [
    { product: '급여 이체',      rate: '최대 +0.3%', desc: '주거래 급여 이체 등록 시',           have: has('급여') },
    { product: '신용카드 실적',  rate: '+0.2%',      desc: '당행 신용카드 월 30만원↑ 이용',      have: has('신용카드') },
    { product: '적금·예금 보유', rate: '+0.1%',      desc: '당행 예·적금 상품 가입 시',           have: has('적금') || has('예금') },
    { product: '자동이체 등록',  rate: '+0.1%',      desc: '공과금 자동이체 3건 이상',            have: false },
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
      { product: '사업자 계좌 이전',  rate: '+0.2%', desc: '주거래 사업자 계좌 당행 이전',      have: false },
      { product: '사업자 카드 실적',  rate: '+0.2%', desc: '당행 사업자카드 월 50만원↑ 이용',   have: has('사업자카드') },
    )
  }
  if (type === '법인') {
    items.push(
      { product: '법인 주거래 협약', rate: '+0.5%', desc: '주거래 법인 협약 체결 시',           have: false },
      { product: '퇴직연금 운용',    rate: '+0.2%', desc: '당행 퇴직연금 가입 법인',            have: has('퇴직연금') },
      { product: '수출입 외환 실적', rate: '+0.1%', desc: '당행 환전·송금 거래 실적 보유',      have: false },
    )
  }
  return items
}

// ── 고객 유형별 추천 상품 ────────────────────────────────────────────────
export type RecommendedProduct = { name: string; desc: string; priority: 'high' | 'mid' | 'low' }

export function getRecommendedProducts(type: CustomerType, products: string[]): RecommendedProduct[] {
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
  return [
    { name: '기업운전자금대출', desc: '법인 운영 자금, 한도 우대',      priority: 'high' },
    { name: '법인 신용카드',    desc: '임직원 법인카드, 비용 통합 관리', priority: 'high' },
  ]
}
