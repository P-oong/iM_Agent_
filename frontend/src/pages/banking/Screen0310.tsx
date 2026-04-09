import { useEffect, useRef, useState } from 'react'
import { useCustomer } from '@/contexts/CustomerContext'
import { DUMMY_CUSTOMERS } from '@/data/dummyCustomers'
import type { DummyCustomer } from '@/data/dummyCustomers'
import '../../styles/banking.css'
import '../../styles/card-screen.css'

// ── 고객 조회 헬퍼 ──────────────────────────────────
function findCustomer(front: string): DummyCustomer | null {
  return DUMMY_CUSTOMERS.find(c => c.residentIdFront === front.slice(0, 6)) ?? null
}

// ── 카드 심사 로직 ───────────────────────────────────
type Factor    = { label: string; value: string; positive: boolean }
type CardOption = { id: string; name: string; desc: string; limit: number; benefits: string[]; tier: 'premium' | 'standard' | 'basic' }
type EvalResult = { score: number; eligible: boolean; reason: string; factors: Factor[]; cards: CardOption[]; dti: number }

function evaluateCard(c: DummyCustomer): EvalResult {
  let score = 0
  const factors: Factor[] = []
  const isBiz = c.customerType === '개인사업자' || c.customerType === '법인'
  const dti = c.totalAssets > 0 ? Math.round((c.totalDebt / c.totalAssets) * 100) : 100

  if (c.creditScore >= 850)      { score += 40; factors.push({ label: '신용점수', value: `${c.creditScore}점 — 최우수`, positive: true }) }
  else if (c.creditScore >= 700) { score += 26; factors.push({ label: '신용점수', value: `${c.creditScore}점 — 양호`,   positive: true }) }
  else if (c.creditScore >= 600) { score += 12; factors.push({ label: '신용점수', value: `${c.creditScore}점 — 보통`,   positive: false }) }
  else                           { score += 4;  factors.push({ label: '신용점수', value: `${c.creditScore}점 — 주의`,   positive: false }) }

  const incomeLabel = isBiz ? '연매출' : '연소득'
  if (c.annualIncome >= (isBiz ? 10000 : 5000))    { score += 30; factors.push({ label: incomeLabel, value: `${c.annualIncome.toLocaleString()}만원 — 고`, positive: true }) }
  else if (c.annualIncome >= (isBiz ? 3000 : 3000)) { score += 20; factors.push({ label: incomeLabel, value: `${c.annualIncome.toLocaleString()}만원 — 적정`, positive: true }) }
  else                                               { score += 8;  factors.push({ label: incomeLabel, value: `${c.annualIncome.toLocaleString()}만원 — 낮음`, positive: false }) }

  if (dti < 30)      { score += 20; factors.push({ label: '부채비율(DTI)', value: `${dti}% — 양호`, positive: true }) }
  else if (dti < 60) { score += 12; factors.push({ label: '부채비율(DTI)', value: `${dti}% — 보통`, positive: true }) }
  else               { score += 3;  factors.push({ label: '부채비율(DTI)', value: `${dti}% — 높음`, positive: false }) }

  if (isBiz) {
    factors.push({ label: '고객 유형', value: c.customerType === '법인' ? '법인 — 기업 전용 카드 적용' : '개인사업자 — 소호 카드 적용', positive: true })
    score += 5
  }

  const hasOverdue = c.accounts.some(a => a.status === '연체')
  if (!hasOverdue) { score += 10; factors.push({ label: '연체 이력', value: '없음',        positive: true }) }
  else             {              factors.push({ label: '연체 이력', value: '있음 — 감점', positive: false }) }

  const eligible = score >= 40 && !hasOverdue
  const cards: CardOption[] = []

  if (isBiz) {
    // ── 법인 / 개인사업자 전용 카드 ──
    if (score >= 75) cards.push({
      id: 'biz-premium', name: 'iM 비즈 플래티넘 카드',
      desc: '법인·기업 전용 프리미엄 · 출장·접대 특화',
      limit: Math.min(10000, Math.round(c.annualIncome * 0.08 / 100) * 100),
      tier: 'premium',
      benefits: ['출장 항공·호텔 5% 적립', '접대비 10% 청구할인', '법인세 신고 간편 서비스', '해외 이용 수수료 無', '연회비 50,000원'],
    })
    if (score >= 55) cards.push({
      id: 'soho-plus', name: 'iM 소호플러스 카드',
      desc: '소기업·자영업자 비용 절감 특화',
      limit: Math.min(5000, Math.round(c.annualIncome * 0.05 / 100) * 100),
      tier: 'premium',
      benefits: ['사무용품·소모품 10% 할인', '식재료·도소매 5% 할인', '사업자 보험료 캐시백', '국세청 자동 연동', '연회비 30,000원'],
    })
    if (score >= 40) cards.push({
      id: 'biz-standard', name: 'iM 기업사랑 카드',
      desc: '중소기업·소상공인 전월 실적 무관 혜택',
      limit: Math.min(2000, Math.round(c.annualIncome * 0.02 / 100) * 100),
      tier: 'standard',
      benefits: ['주유·톨게이트 리터당 60원 할인', '이동통신 10% 할인', '편의점·식당 5% 할인', '전월 실적 무관 적용', '연회비 20,000원'],
    })
    if (score >= 40) cards.push({
      id: 'biz-taxreturn', name: 'iM 택스리턴 카드',
      desc: '매입세액 공제 · 부가세 환급 특화',
      limit: Math.min(1000, Math.round(c.annualIncome * 0.01 / 100) * 100),
      tier: 'basic',
      benefits: ['부가세 환급 자동 계산', '매입 세금계산서 발급 간편화', '사업비 항목별 리포트 제공', '연말정산 자료 자동 정리', '연회비 15,000원'],
    })
  } else {
    // ── 개인 카드 ──
    if (score >= 80) cards.push({ id:'travel',     name:'iM 트래블 카드',  desc:'해외 이용 수수료 면제 · 일상·여행 혜택',    limit: Math.min(5000, Math.round(c.annualIncome*0.6/100)*100), tier:'premium',  benefits:['해외 이용 수수료 無','일상생활 10% 청구할인','여행 영역 5% 할인','쿠팡·배민·스타벅스·넷플릭스'] })
    if (score >= 65) cards.push({ id:'i-card',     name:'iM i 카드',       desc:'즐겨 쓰는 5개 영역 최대 10% 할인',          limit: Math.min(3000, Math.round(c.annualIncome*0.4/100)*100), tier:'premium',  benefits:['온라인쇼핑 10% 할인','편의점 10% 할인','이동통신 10% 할인','연회비 10,000원'] })
    if (score >= 55) cards.push({ id:'living',     name:'iM LIVING 카드',  desc:'생활요금·생활쇼핑 특화',                    limit: Math.min(2000, Math.round(c.annualIncome*0.3/100)*100), tier:'standard', benefits:['아파트관리비·전기·가스·통신 10% 할인','쿠팡·배달앱·대형마트 5% 할인','생활요금 캐시백 이벤트'] })
    if (score >= 40) {
      cards.push({ id:'basic-life', name:'iM 생활카드',     desc:'전월실적 없는 생활밀착형 혜택',                limit: Math.min(500,  Math.round(c.annualIncome*0.12/100)*100), tier:'basic',    benefits:['대중교통 5% 할인(전월실적 무관)','이동통신 10% 할인','주유 리터당 40원 할인','연회비 15,000원'] })
      cards.push({ id:'shopping',   name:'iM 첫카드',       desc:'전 가맹점 0.5% 할인 · 조건 없이 간편하게',     limit: Math.min(300,  Math.round(c.annualIncome*0.08/100)*100), tier:'basic',    benefits:['전 가맹점 0.5% 청구할인','온라인·모바일 추가 0.5% 할인','연회비 10,000원','사회초년생 추천'] })
    }
  }

  const reason = !eligible
    ? '신용점수 또는 연체 이력으로 현재 카드 발급이 어렵습니다.'
    : isBiz
      ? score >= 75 ? 'iM 비즈 플래티넘 등 기업 전용 프리미엄 카드 발급이 가능합니다.'
        : score >= 55 ? 'iM 소호플러스 · iM 기업사랑 카드 발급이 가능합니다.'
        : 'iM 기업사랑 · iM 택스리턴 카드 발급이 가능합니다.'
      : score >= 80 ? 'iM 트래블 카드 등 프리미엄 상품 발급이 가능합니다.'
      : score >= 65 ? 'iM i 카드 · iM LIVING 카드 발급이 가능합니다.'
      : score >= 55 ? 'iM LIVING 카드 발급이 가능합니다.'
      : '기본 심사 통과. iM 생활카드 · iM 첫카드 발급이 가능합니다.'

  return { score: Math.min(score, 100), eligible, reason, factors, cards, dti }
}

// ── 동의 항목 ─────────────────────────────────────────
const CONSENT_ITEMS = [
  { key: 'collect',  required: true,  title: '개인(신용)정보 수집·이용 동의 (필수)',      detail: '신용카드 발급 심사를 위해 성명, 주민등록번호, 소득, 재산 정보를 수집·이용합니다.' },
  { key: 'provide',  required: true,  title: '개인(신용)정보 제공 동의 (필수)',            detail: 'NICE평가정보, KCB 등 신용평가기관 및 금융결제원에 고객 정보를 제공합니다.' },
  { key: 'unique',   required: true,  title: '고유식별정보 처리 동의 (필수)',              detail: '주민등록번호를 신원확인 및 본인인증 목적으로 처리합니다.' },
  { key: 'inquiry',  required: true,  title: '신용정보 조회 동의 (필수)',                  detail: '신용평가기관에 신용정보 조회를 요청합니다. 조회 기록이 남을 수 있습니다.' },
  { key: 'marketing',required: false, title: '마케팅 목적 정보 활용 동의 (선택)',          detail: '카드 이용 혜택, 프로모션 안내를 위해 개인정보를 활용합니다.' },
]

// ── 대외기관 조회 소스 ────────────────────────────────
const AGENCIES = [
  { key: 'nice',    label: 'NICE평가정보',   sub: '신용점수 · 신용등급 조회',      icon: '🏛', type: '대외기관', delayMs: 1400 },
  { key: 'kcb',     label: 'KCB(올크레딧)', sub: '신용이력 · 연체 정보',          icon: '🏛', type: '대외기관', delayMs: 1800 },
  { key: 'fss',     label: '금융결제원',     sub: '은행 · 카드 금융거래 내역',     icon: '🏦', type: '대외기관', delayMs: 1100 },
  { key: 'nts',     label: '국세청 홈택스',  sub: '소득 · 납세 사실 확인',         icon: '🏛', type: '대외기관', delayMs: 2000 },
  { key: 'deposit', label: '행내 수신 시스템', sub: '예금 · 적금 잔액 현황',       icon: '💰', type: '행내시스템', delayMs: 400 },
  { key: 'loan',    label: '행내 여신 시스템', sub: '대출 · 연체 이력 조회',       icon: '📋', type: '행내시스템', delayMs: 500 },
]

function getAgencyResult(key: string, c: DummyCustomer): string {
  const grade = c.creditScore >= 800 ? '1등급' : c.creditScore >= 700 ? '2등급' : c.creditScore >= 600 ? '3등급' : '4등급'
  switch (key) {
    case 'nice':    return `신용점수 ${c.creditScore}점 조회 완료`
    case 'kcb':     return `신용${grade} · 이력 ${c.accounts.length}건`
    case 'fss':     return `금융거래 ${c.accounts.length}건 확인`
    case 'nts':     return `연소득 ${c.annualIncome.toLocaleString()}만원 확인`
    case 'deposit': return `예·적금 ${c.accounts.filter(a => /예금|적금/.test(a.product)).length}계좌 조회`
    case 'loan':    return `대출 ${c.accounts.filter(a => a.product.includes('대출')).length}건 · 연체 ${c.accounts.some(a => a.status === '연체') ? '있음' : '없음'}`
    default: return '조회 완료'
  }
}

// ── 조회 유형 ─────────────────────────────────────────
const ID_TYPES = [
  { value: 'resident',  label: '실명번호 (주민등록번호)', placeholder: '앞 6자리 입력',    maxLen: 6,  backLen: 7,  backPh: '뒤 7자리' },
  { value: 'customer',  label: '고객번호',               placeholder: '고객번호 입력',     maxLen: 12, backLen: 0,  backPh: '' },
  { value: 'business',  label: '사업자등록번호',          placeholder: '10자리 (하이픈 없이)', maxLen: 10, backLen: 0, backPh: '' },
  { value: 'member',    label: '회원번호',               placeholder: '회원번호 입력',     maxLen: 10, backLen: 0,  backPh: '' },
  { value: 'passport',  label: '여권번호',               placeholder: '여권번호 입력',     maxLen: 9,  backLen: 0,  backPh: '' },
  { value: 'foreigner', label: '외국인등록번호',          placeholder: '앞 6자리 입력',    maxLen: 6,  backLen: 7,  backPh: '뒤 7자리' },
] as const
type IdTypeValue = typeof ID_TYPES[number]['value']

// ── 스텝 정의 ─────────────────────────────────────────
type Step = 'input' | 'consent' | 'collecting' | 'result' | 'select' | 'done'
const STEP_LABELS: Record<Step, string> = {
  input:      '고객 조회',
  consent:    '동의서 징구',
  collecting: '대외기관 조회',
  result:     '심사 결과',
  select:     '카드 선택',
  done:       '신청 완료',
}
const STEP_ORDER: Step[] = ['input','consent','collecting','result','select','done']

// ─────────────────────────────────────────────────────
export function Screen0310() {
  const { activeResidentId, setActiveResidentId } = useCustomer()

  const [step,         setStep]         = useState<Step>('input')
  const [idType,       setIdType]       = useState<IdTypeValue>('resident')
  const [front,        setFront]        = useState(activeResidentId ?? '')
  const [back,         setBack]         = useState('')
  const [customer,     setCustomer]     = useState<DummyCustomer | null>(null)
  const [evalResult,   setEvalResult]   = useState<EvalResult | null>(null)
  const [consents,     setConsents]     = useState<Record<string, boolean>>({})
  const [agencyDone,   setAgencyDone]   = useState<Record<string, boolean>>({})
  const [agencyActive, setAgencyActive] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState('')
  const [statusState,  setStatusState]  = useState<'idle' | 'error' | 'success'>('idle')
  const [statusMsg,    setStatusMsg]    = useState('실명번호를 입력하고 [조회] 버튼을 클릭하세요.')
  const [appNo,        setAppNo]        = useState('')

  const frontRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (activeResidentId) setFront(activeResidentId) }, [activeResidentId])

  // 대외기관 순차 조회 애니메이션
  useEffect(() => {
    if (step !== 'collecting' || !customer) return
    let cancelled = false

    const runAgencies = async () => {
      for (const ag of AGENCIES) {
        if (cancelled) break
        setAgencyActive(ag.key)
        await new Promise(r => setTimeout(r, ag.delayMs))
        if (cancelled) break
        setAgencyDone(prev => ({ ...prev, [ag.key]: true }))
        setAgencyActive(null)
        await new Promise(r => setTimeout(r, 120))
      }
      if (!cancelled) {
        await new Promise(r => setTimeout(r, 500))
        const result = evaluateCard(customer)
        setEvalResult(result)
        setSelectedCard(result.cards[0]?.id ?? '')
        setStep('result')
        setStatusMsg(`${customer.name} 고객 심사 완료 — ${result.eligible ? '발급 가능' : '발급 불가'}`)
        setStatusState(result.eligible ? 'success' : 'error')
      }
    }
    runAgencies()
    return () => { cancelled = true }
  }, [step, customer])

  const currentIdType = ID_TYPES.find(t => t.value === idType)!

  const handleSearch = () => {
    if (idType !== 'resident' && idType !== 'foreigner') {
      setStatusState('error')
      setStatusMsg(`오류: ${currentIdType.label} 조회는 현재 준비 중입니다. 실명번호를 이용해주세요.`)
      return
    }
    const key = front.trim().slice(0, 6)
    if (key.length < 6) { setStatusState('error'); setStatusMsg(`오류: ${currentIdType.label} 앞 6자리를 입력해주세요.`); return }
    const found = findCustomer(key)
    if (!found) { setStatusState('error'); setStatusMsg('오류: 해당 번호로 등록된 고객이 없습니다.'); return }
    setCustomer(found)
    setActiveResidentId(key)
    setConsents({})
    setStep('consent')
    setStatusState('idle')
    setStatusMsg(`${found.name} 고객 — 신용정보 제공 동의를 진행해주세요.`)
  }

  const allRequired = CONSENT_ITEMS.filter(i => i.required).every(i => consents[i.key])

  const handleConsentConfirm = () => {
    if (!allRequired) { setStatusState('error'); setStatusMsg('오류: 필수 동의 항목을 모두 확인해주세요.'); return }
    setAgencyDone({})
    setStep('collecting')
    setStatusState('idle')
    setStatusMsg('대외기관 및 행내 시스템 정보 조회 중...')
  }

  const handleApply = () => {
    if (!selectedCard) { setStatusState('error'); setStatusMsg('오류: 카드를 선택해주세요.'); return }
    const no = `APP-${Date.now().toString().slice(-8)}`
    setAppNo(no)
    setStep('done')
    setStatusState('success')
    setStatusMsg(`카드 신청 완료. 접수번호: ${no}`)
  }

  const reset = () => {
    setStep('input'); setIdType('resident'); setFront(''); setBack(''); setCustomer(null)
    setEvalResult(null); setConsents({}); setAgencyDone({}); setSelectedCard('')
    setStatusState('idle'); setStatusMsg('조회 유형을 선택하고 번호를 입력하세요.')
    setTimeout(() => frontRef.current?.focus(), 100)
  }

  const statusClass = statusState === 'success' ? ' bk-statusbar--success' : statusState === 'error' ? ' bk-statusbar--error' : ''
  const stepIdx = STEP_ORDER.indexOf(step)

  // 완료된 스텝 클릭 → 해당 단계로 이동 (collecting은 재진입 불가)
  const goToStep = (s: Step, i: number) => {
    if (i >= stepIdx) return           // 현재·미래 스텝은 클릭 불가
    if (s === 'collecting') return     // 비동기 스텝은 건너뜀
    setStep(s)
    setStatusState('idle')
    const msgs: Record<Step, string> = {
      input:      '조회 유형을 선택하고 번호를 입력하세요.',
      consent:    `${customer?.name ?? ''} 고객 — 동의서를 확인하세요.`,
      collecting: '',
      result:     `${customer?.name ?? ''} 고객 심사 결과입니다.`,
      select:     '발급할 카드를 선택하세요.',
      done:       '',
    }
    setStatusMsg(msgs[s])
  }

  return (
    <div className="bk-screen">
      {/* ── 타이틀바 ── */}
      <div className="bk-titlebar">
        <span className="bk-titlebar-code">■ [0310] 신용카드 발급 가능 조회</span>
        <div className="bk-titlebar-right">
          <span className="bk-titlebar-info">고객 조회 → 동의서 징구 → 대외기관 조회 → 심사 → 신청</span>
          {step !== 'input' && <button className="bk-btn" onClick={reset}>새 조회</button>}
        </div>
      </div>

      {/* ── 진행 단계 스텝바 ── */}
      <div className="cd-stepper">
        {STEP_ORDER.map((s, i) => {
          const isCurrent  = s === step
          const isDone     = i < stepIdx
          const canClick   = isDone && s !== 'collecting'
          return (
            <div key={s} className={`cd-step${isCurrent ? ' cd-step--active' : isDone ? ' cd-step--done' : ''}`}>
              <div
                className="cd-step-dot"
                onClick={() => canClick && goToStep(s, i)}
                title={canClick ? `${STEP_LABELS[s]}으로 돌아가기` : undefined}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <div className="cd-step-label">{STEP_LABELS[s]}</div>
              {i < STEP_ORDER.length - 1 && <div className={`cd-step-line${isDone ? ' cd-step-line--done' : ''}`} />}
            </div>
          )
        })}
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="bk-content cd-content">

        {/* ─── STEP 1: 고객 조회 ─── */}
        {step === 'input' && (
          <div className="cd-panel">
            <div className="bk-section-hd">■ 고객 조회</div>

            {/* 조회 유형 선택 */}
            <div className="bk-form-row">
              <span className="bk-label">조회 유형</span>
              <div className="cd-id-type-wrap">
                {ID_TYPES.map(t => (
                  <button
                    key={t.value}
                    className={`cd-id-type-btn${idType === t.value ? ' cd-id-type-btn--active' : ''}`}
                    onClick={() => { setIdType(t.value); setFront(''); setBack('') }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 번호 입력 */}
            <div className="bk-form-row" style={{ marginTop: 8 }}>
              <span className="bk-label">{currentIdType.label}</span>
              <input
                ref={frontRef}
                className={`bk-input${!front ? ' bk-input--required bk-input--glow' : ''}`}
                placeholder={`${currentIdType.placeholder} *`}
                maxLength={currentIdType.maxLen}
                value={front}
                onChange={e => setFront(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ width: currentIdType.backLen ? 100 : 180 }}
              />
              {currentIdType.backLen > 0 && (
                <>
                  <span style={{ color: '#9ca3af', padding: '0 6px', fontWeight: 700 }}>—</span>
                  <input
                    className="bk-input"
                    placeholder={currentIdType.backPh}
                    maxLength={currentIdType.backLen}
                    value={back}
                    onChange={e => setBack(e.target.value.replace(/\D/g, ''))}
                    style={{ width: 110 }}
                  />
                </>
              )}
              <button className="bk-btn bk-btn--primary" onClick={handleSearch}>조회</button>
            </div>

            <div className="cd-hint">
              <span className="cd-hint-icon">💡</span>
              번호 입력 후 신용정보 제공 동의를 받고, NICE·KCB·국세청 등 대외기관 정보를 수집하여 카드 심사를 진행합니다.
            </div>

            <div className="cd-sample-ids">
              <span style={{ fontSize: 11, color: '#9ca3af' }}>테스트:</span>
              {DUMMY_CUSTOMERS.map(c => (
                <button
                  key={c.residentIdFront}
                  type="button"
                  className="cd-sample-btn"
                  title={`${c.customerType} · ${c.job}`}
                  onClick={() => setFront(c.residentIdFront)}
                >
                  {c.residentIdFront} ({c.name})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 2: 동의서 징구 ─── */}
        {step === 'consent' && customer && (
          <div className="cd-consent-doc">

            {/* ── 문서 헤더 ── */}
            <div className="cd-doc-header">
              <div className="cd-doc-header-left">
                <div className="cd-doc-title">신용정보 제공·활용 동의서</div>
                <div className="cd-doc-subtitle">iM뱅크 신용카드 발급 심사용</div>
              </div>
              <div className="cd-doc-header-right">
                <div className="cd-doc-meta-row"><span>양식번호</span><span>IM-CC-001</span></div>
                <div className="cd-doc-meta-row"><span>작성일시</span><span>{new Date().toLocaleDateString('ko-KR')}</span></div>
              </div>
            </div>

            {/* ── 고객 정보 테이블 ── */}
            <table className="cd-doc-table">
              <tbody>
                <tr>
                  <th>성명</th><td className="cd-doc-td--accent">{customer.name}</td>
                  <th>생년월일</th><td>{front}</td>
                  <th>연령</th><td>{customer.age}세</td>
                  <th>직업</th><td>{customer.job}</td>
                </tr>
              </tbody>
            </table>

            {/* ── 안내문 ── */}
            <div className="cd-doc-notice">
              <span className="cd-doc-notice-icon">⚠</span>
              <span>각 항목을 고객에게 설명 후 동의 여부를 확인하세요. 필수 항목 미동의 시 심사가 진행되지 않습니다.</span>
            </div>

            {/* ── 동의 항목 테이블 ── */}
            <table className="cd-doc-consent-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>No.</th>
                  <th>동의 항목</th>
                  <th style={{ width: 60 }}>구분</th>
                  <th style={{ width: 56 }}>동의 여부</th>
                </tr>
              </thead>
              <tbody>
                {CONSENT_ITEMS.map((item, idx) => (
                  <tr key={item.key} className={consents[item.key] ? 'cd-doc-row--checked' : ''}>
                    <td className="cd-doc-td--center">{idx + 1}</td>
                    <td>
                      <div className="cd-doc-item-title">{item.title}</div>
                      <div className="cd-doc-item-detail">{item.detail}</div>
                    </td>
                    <td className="cd-doc-td--center">
                      <span className={`cd-doc-tag${item.required ? ' cd-doc-tag--req' : ' cd-doc-tag--opt'}`}>
                        {item.required ? '필수' : '선택'}
                      </span>
                    </td>
                    <td className="cd-doc-td--center">
                      <label className="cd-doc-check-label">
                        <input
                          type="checkbox"
                          checked={!!consents[item.key]}
                          onChange={e => setConsents(prev => ({ ...prev, [item.key]: e.target.checked }))}
                        />
                        <span className={`cd-doc-check-box${consents[item.key] ? ' cd-doc-check-box--on' : ''}`}>
                          {consents[item.key] ? '✓' : ''}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── 서명·확인 영역 ── */}
            <div className="cd-doc-footer">
              <div className="cd-doc-footer-left">
                <label className="cd-doc-all-check">
                  <input type="checkbox"
                    checked={CONSENT_ITEMS.filter(i => i.required).every(i => consents[i.key])}
                    onChange={e => {
                      const next: Record<string, boolean> = {}
                      CONSENT_ITEMS.forEach(i => { if (i.required) next[i.key] = e.target.checked })
                      setConsents(prev => ({ ...prev, ...next }))
                    }}
                  />
                  <span>필수 항목 전체 동의</span>
                </label>
                <div className="cd-doc-sign-area">
                  <span>고객 서명</span>
                  <div className="cd-doc-sign-box" />
                </div>
              </div>
              <button
                className={`cd-doc-confirm-btn${allRequired ? '' : ' cd-btn-disabled'}`}
                onClick={handleConsentConfirm}
                disabled={!allRequired}
              >
                동의 확인<br />
                <span>→ 대외기관 정보 조회</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: 대외기관 조회 ─── */}
        {step === 'collecting' && customer && (
          <div className="cd-loading-layout">

            {/* ── 좌측: 메인 로딩 비주얼 ── */}
            <div className="cd-loading-center">
              <div className="cd-loading-ring-wrap">
                {/* 배경 펄스 링 */}
                <div className="cd-loading-pulse" />
                <div className="cd-loading-pulse cd-loading-pulse--2" />

                {/* SVG 프로그레스 링 */}
                <svg className="cd-loading-svg" viewBox="0 0 120 120">
                  {/* 트랙 */}
                  <circle cx="60" cy="60" r="50" fill="none"
                    stroke="rgba(0,199,169,0.12)" strokeWidth="7" />
                  {/* 진행률 fill */}
                  <circle cx="60" cy="60" r="50" fill="none"
                    stroke="#00c7a9" strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - Object.keys(agencyDone).length / AGENCIES.length)}`}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px', transition: 'stroke-dashoffset 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
                  />
                  {/* 회전 스피너 아크 */}
                  {Object.keys(agencyDone).length < AGENCIES.length && (
                    <circle cx="60" cy="60" r="50" fill="none"
                      stroke="rgba(0,240,208,0.55)" strokeWidth="3" strokeLinecap="round"
                      strokeDasharray="28 286"
                      className="cd-loading-spin-arc"
                    />
                  )}
                </svg>

                {/* 중앙 텍스트 */}
                <div className="cd-loading-ring-inner">
                  <span className="cd-loading-pct">
                    {Math.round(Object.keys(agencyDone).length / AGENCIES.length * 100)}
                    <span className="cd-loading-pct-unit">%</span>
                  </span>
                  <span className="cd-loading-fraction">
                    {Object.keys(agencyDone).length}/{AGENCIES.length}
                  </span>
                </div>
              </div>

              {/* 현재 진행 상태 텍스트 */}
              <div className="cd-loading-status-row">
                {agencyActive ? (
                  <span className="cd-loading-status cd-loading-status--active">
                    <span className="cd-loading-blink" />
                    {AGENCIES.find(a => a.key === agencyActive)?.label} 조회 중
                  </span>
                ) : Object.keys(agencyDone).length >= AGENCIES.length ? (
                  <span className="cd-loading-status cd-loading-status--done">
                    ✓ 모든 기관 조회 완료
                  </span>
                ) : (
                  <span className="cd-loading-status">연결 중...</span>
                )}
              </div>

              <div className="cd-loading-customer">
                {customer.name} · {customer.age}세 · {customer.job}
              </div>
            </div>

            {/* ── 우측: 기관 목록 ── */}
            <div className="cd-loading-agencies">
              <div className="cd-loading-agencies-title">조회 기관</div>
              {AGENCIES.map(ag => {
                const done   = agencyDone[ag.key]
                const active = agencyActive === ag.key
                return (
                  <div key={ag.key} className={`cd-loading-agency${done ? ' cd-la--done' : active ? ' cd-la--active' : ' cd-la--wait'}`}>
                    <div className="cd-la-left">
                      <span className="cd-la-dot" />
                      <div>
                        <div className="cd-la-name">{ag.label}</div>
                        {done && <div className="cd-la-result">{getAgencyResult(ag.key, customer)}</div>}
                        {active && <div className="cd-la-result cd-la-result--active">조회 중...</div>}
                        {!done && !active && <div className="cd-la-result cd-la-result--wait">대기 중</div>}
                      </div>
                    </div>
                    <span className={`cd-la-badge${done ? ' cd-la-badge--done' : active ? ' cd-la-badge--active' : ''}`}>
                      {ag.type}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── STEP 4: 심사 결과 ─── */}
        {step === 'result' && evalResult && customer && (() => {
          const circ = 2 * Math.PI * 34
          const fillLen = (evalResult.score / 100) * circ
          const tierColor = evalResult.score >= 80 ? '#00c7a9' : evalResult.score >= 55 ? '#3b82f6' : evalResult.score >= 40 ? '#f59e0b' : '#ef4444'
          const isBiz = customer.customerType === '개인사업자' || customer.customerType === '법인'
          return (
            <div className="cd-result-v2">

              {/* ── 최상단 배너: 점수 링 + 결과 + 고객명 ── */}
              <div className={`cd-result-banner${evalResult.eligible ? ' cd-result-banner--pass' : ' cd-result-banner--fail'}`}>
                {/* 좌: 원형 점수 링 */}
                <div className="cd-result-ring-wrap">
                  <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="45" cy="45" r="34" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="7" />
                    <circle cx="45" cy="45" r="34" fill="none"
                      stroke={tierColor} strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={`${fillLen} ${circ}`}
                      style={{ transition: 'stroke-dasharray 1s ease', filter: `drop-shadow(0 0 6px ${tierColor}88)` }}
                    />
                  </svg>
                  <div className="cd-result-ring-inner">
                    <span className="cd-rr-score">{evalResult.score}</span>
                    <span className="cd-rr-max">점</span>
                  </div>
                </div>

                {/* 중: 결과 텍스트 */}
                <div className="cd-result-banner-center">
                  <div className="cd-result-verdict-badge">
                    <span className="cd-result-verdict-icon">{evalResult.eligible ? '✔' : '✘'}</span>
                    <span className="cd-result-verdict-text">{evalResult.eligible ? '발급 가능' : '발급 불가'}</span>
                  </div>
                  <div className="cd-result-reason">{evalResult.reason}</div>
                  {isBiz && <div className="cd-result-type-badge">{customer.customerType} 심사 기준 적용</div>}
                </div>

                {/* 우: 고객 정보 요약 */}
                <div className="cd-result-banner-right">
                  <div className="cd-result-customer-name">{customer.name}</div>
                  <div className="cd-result-customer-meta">{customer.age}세 · {customer.job}</div>
                  <div className={`cd-grade cd-grade--${customer.grade}`} style={{ alignSelf: 'flex-end', marginTop: 4 }}>{customer.grade}</div>
                </div>
              </div>

              {/* ── 본문: 프로필 | 요인 ── */}
              <div className="cd-result-body">

                {/* 좌: 고객 프로필 + DTI 바 */}
                <div className="cd-result-profile-col">
                  <div className="bk-section-hd">■ 고객 프로필</div>
                  <div className="cd-profile-card">
                    <div className="cd-profile-row">
                      <span className="cd-profile-label">고객명</span>
                      <span className="cd-profile-value">{customer.name}</span>
                    </div>
                    <div className="cd-profile-row">
                      <span className="cd-profile-label">유형</span>
                      <span className="cd-profile-value">{customer.customerType}</span>
                    </div>
                    <div className="cd-profile-row">
                      <span className="cd-profile-label">{isBiz ? '연매출' : '연소득'}</span>
                      <span className="cd-profile-value">{customer.annualIncome.toLocaleString()}만원</span>
                    </div>
                    <div className="cd-profile-row">
                      <span className="cd-profile-label">신용점수</span>
                      <span className={`cd-profile-value ${customer.creditScore >= 700 ? 'cd-val--good' : 'cd-val--warn'}`}>{customer.creditScore}점</span>
                    </div>
                    <div className="cd-profile-row">
                      <span className="cd-profile-label">총자산</span>
                      <span className="cd-profile-value">{customer.totalAssets.toLocaleString()}만원</span>
                    </div>
                    <div className="cd-profile-row">
                      <span className="cd-profile-label">총부채</span>
                      <span className="cd-profile-value">{customer.totalDebt.toLocaleString()}만원</span>
                    </div>
                  </div>

                  {/* DTI 미터 */}
                  <div className="cd-dti-meter">
                    <div className="cd-dti-header">
                      <span className="cd-dti-label">부채비율 (DTI)</span>
                      <span className={`cd-dti-value ${evalResult.dti < 50 ? 'cd-val--good' : 'cd-val--warn'}`}>{evalResult.dti}%</span>
                    </div>
                    <div className="cd-dti-track">
                      <div className={`cd-dti-fill ${evalResult.dti < 30 ? 'cd-dti--good' : evalResult.dti < 60 ? 'cd-dti--mid' : 'cd-dti--high'}`}
                        style={{ width: `${Math.min(evalResult.dti, 100)}%` }} />
                    </div>
                    <div className="cd-dti-legend">
                      <span>양호 &lt;30%</span><span>보통 &lt;60%</span><span>높음 60%↑</span>
                    </div>
                  </div>
                </div>

                {/* 우: 심사 요인 체크리스트 */}
                <div className="cd-result-factors-col">
                  <div className="bk-section-hd">■ 심사 주요 항목</div>
                  <div className="cd-factors">
                    {evalResult.factors.map(f => (
                      <div key={f.label} className={`cd-factor${f.positive ? ' cd-factor--pos' : ' cd-factor--neg'}`}>
                        <span className="cd-factor-icon">{f.positive ? '✓' : '✗'}</span>
                        <div className="cd-factor-body">
                          <span className="cd-factor-label">{f.label}</span>
                          <span className="cd-factor-val">{f.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── 푸터: 진행 버튼 ── */}
              {evalResult.eligible && (
                <div className="cd-result-footer">
                  <button className="bk-btn bk-btn--primary cd-proceed-btn" onClick={() => setStep('select')}>
                    카드 선택하기 →
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {/* ─── STEP 5: 카드 선택 ─── */}
        {step === 'select' && evalResult && customer && (
          <div className="cd-select-layout">
            {/* 카드 그리드 */}
            <div className="cd-select-left">
              <div className="bk-section-hd">■ 발급 가능 카드 선택</div>
              <div className="cd-cards-grid">
                {evalResult.cards.map(card => {
                  const tierLabel = card.tier === 'premium' ? 'PREMIUM' : card.tier === 'standard' ? 'STANDARD' : 'BASIC'
                  const isSelected = selectedCard === card.id
                  return (
                    <div key={card.id}
                      className={`cd-card-option${isSelected ? ' cd-card-option--selected' : ''} cd-card-option--${card.tier}`}
                      onClick={() => setSelectedCard(card.id)}>

                      {/* ── 카드 실물 디자인 ── */}
                      <div className={`cd-card-face cd-card-face--${card.tier}`}>
                        {/* 장식 원 */}
                        <div className="cd-card-deco-a" />
                        <div className="cd-card-deco-b" />
                        {/* 상단 */}
                        <div className="cd-card-face-top">
                          <span className="cd-card-face-bank">iM Bank</span>
                          <span className="cd-card-face-tier">{tierLabel}</span>
                        </div>
                        {/* 칩 */}
                        <div className="cd-card-face-chip">
                          <div className="cd-chip-inner" />
                        </div>
                        {/* 카드명 + 한도 */}
                        <div className="cd-card-face-bottom">
                          <div className="cd-card-face-name">{card.name}</div>
                          <div className="cd-card-face-limit">한도 {card.limit.toLocaleString()}만원</div>
                        </div>
                        {/* 선택 오버레이 */}
                        {isSelected && <div className="cd-card-selected-overlay">✓</div>}
                      </div>

                      {/* ── 카드 정보 ── */}
                      <div className="cd-card-info-body">
                        <div className="cd-card-info-desc">{card.desc}</div>
                        <div className="cd-card-benefits">
                          {card.benefits.map(b => <span key={b} className="cd-benefit-tag">{b}</span>)}
                        </div>
                        <div className={`cd-card-select-btn${isSelected ? ' cd-card-select-btn--on' : ''}`}>
                          <span className={`cd-radio${isSelected ? ' cd-radio--on' : ''}`} />
                          {isSelected ? '선택됨' : '선택하기'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 수령·비밀번호 사이드 패널 */}
            <div className="cd-select-right">
              <div className="bk-section-hd">■ 신청 정보</div>

              {/* 선택된 카드 미리보기 */}
              {selectedCard && (() => {
                const c = evalResult.cards.find(c => c.id === selectedCard)!
                return (
                  <div className="cd-selected-preview">
                    <div className={`cd-selected-card-mini cd-selected-card-mini--${c.tier}`}>
                      <div className="cd-card-deco-a" /><div className="cd-card-deco-b" />
                      <div className="cd-card-face-top">
                        <span className="cd-card-face-bank" style={{ fontSize: 9 }}>iM Bank</span>
                      </div>
                      <div className="cd-card-face-chip"><div className="cd-chip-inner" /></div>
                      <div className="cd-card-face-bottom">
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>{c.name}</div>
                        <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.7)' }}>한도 {c.limit.toLocaleString()}만원</div>
                      </div>
                    </div>
                    <div className="cd-selected-label">{c.name}</div>
                    <div className="cd-selected-sub">{c.desc}</div>
                  </div>
                )
              })()}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                <div className="bk-form-row">
                  <span className="bk-label">수령 방법</span>
                  <select className="bk-select" defaultValue="branch">
                    <option value="branch">영업점 수령 (즉시)</option>
                    <option value="mail">등기 우편 (3~5일)</option>
                  </select>
                </div>
                <div className="bk-form-row">
                  <span className="bk-label">카드 비밀번호</span>
                  <input className="bk-input bk-input--required" type="password" placeholder="4자리 *" maxLength={4} style={{ width: 80 }} />
                </div>
                <div className="bk-form-row">
                  <span className="bk-label">비밀번호 확인</span>
                  <input className="bk-input bk-input--required" type="password" placeholder="확인 *" maxLength={4} style={{ width: 80 }} />
                </div>
              </div>

              <div className="cd-apply-row" style={{ marginTop: 'auto', paddingTop: 12 }}>
                <button className="bk-btn" onClick={() => setStep('result')}>← 이전</button>
                <button className="bk-btn bk-btn--primary cd-apply-btn" onClick={handleApply} disabled={!selectedCard}>
                  신청하기 →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 6: 완료 ─── */}
        {step === 'done' && evalResult && customer && (() => {
          const appliedCard = evalResult.cards.find(c => c.id === selectedCard)!
          return (
            <div className="cd-done-layout">
              {/* 좌측: 발급 카드 */}
              <div className="cd-done-card-side">
                <div className={`cd-done-card-face cd-card-face--${appliedCard.tier}`}>
                  <div className="cd-card-deco-a" /><div className="cd-card-deco-b" />
                  <div className="cd-card-face-top">
                    <span className="cd-card-face-bank">iM Bank</span>
                    <span className="cd-card-face-tier">{appliedCard.tier === 'premium' ? 'PREMIUM' : appliedCard.tier === 'standard' ? 'STANDARD' : 'BASIC'}</span>
                  </div>
                  <div className="cd-card-face-chip"><div className="cd-chip-inner" /></div>
                  <div className="cd-card-face-bottom">
                    <div className="cd-card-face-name">{appliedCard.name}</div>
                    <div className="cd-card-face-limit">한도 {appliedCard.limit.toLocaleString()}만원</div>
                  </div>
                </div>
                <div className="cd-done-card-label">{appliedCard.name}</div>
                <div className="cd-done-card-desc">{appliedCard.desc}</div>
                <div className="cd-done-benefits">
                  {appliedCard.benefits.map(b => <span key={b} className="cd-benefit-tag">{b}</span>)}
                </div>
              </div>

              {/* 우측: 접수 확인서 */}
              <div className="cd-done-receipt">
                <div className="cd-done-receipt-header">
                  <div className="cd-done-icon-sm">✔</div>
                  <div>
                    <div className="cd-done-title">신청 완료</div>
                    <div className="cd-done-sub">신용카드 발급 신청이 정상 접수되었습니다.</div>
                  </div>
                </div>

                <div className="cd-done-info">
                  <div className="cd-done-row"><span className="cd-done-label">고객명</span><span className="cd-done-val">{customer.name}</span></div>
                  <div className="cd-done-row"><span className="cd-done-label">접수 번호</span><span className="cd-done-val cd-done-val--accent">{appNo}</span></div>
                  <div className="cd-done-row"><span className="cd-done-label">신청 카드</span><span className="cd-done-val">{appliedCard.name}</span></div>
                  <div className="cd-done-row"><span className="cd-done-label">추천 한도</span><span className="cd-done-val cd-done-val--accent">{appliedCard.limit.toLocaleString()}만원</span></div>
                  <div className="cd-done-row"><span className="cd-done-label">수령 방법</span><span className="cd-done-val">영업점 즉시 수령</span></div>
                  <div className="cd-done-row"><span className="cd-done-label">처리 상태</span><span className="cd-done-val" style={{ color: '#00a88f', fontWeight: 700 }}>정상 접수</span></div>
                  <div className="cd-done-row"><span className="cd-done-label">접수 일시</span><span className="cd-done-val">{new Date().toLocaleString('ko-KR')}</span></div>
                </div>

                <div className="cd-done-kpi">🏆 이 거래로 KPI <strong>+1pt</strong>가 적립됩니다.</div>

                <div className="cd-done-actions">
                  <button className="bk-btn" onClick={reset}>새 고객 조회</button>
                  <button className="bk-btn bk-btn--primary" style={{ flex: 1 }}>
                    접수증 출력
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── 상태바 ── */}
      <div className={`bk-statusbar${statusClass}`}>{statusMsg}</div>
    </div>
  )
}
