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
type Factor = { label: string; value: string; positive: boolean }
type CardOption = { id: string; name: string; desc: string; limit: number; benefits: string[]; tier: 'premium' | 'standard' | 'basic' }
type EvalResult = {
  score: number           // 0~100
  eligible: boolean
  reason: string
  factors: Factor[]
  cards: CardOption[]
  dti: number
}

function evaluateCard(c: DummyCustomer): EvalResult {
  let score = 0
  const factors: Factor[] = []
  const dti = c.totalAssets > 0 ? Math.round((c.totalDebt / c.totalAssets) * 100) : 100

  // 신용점수 (40점)
  if (c.creditScore >= 850) {
    score += 40
    factors.push({ label: '신용점수', value: `${c.creditScore}점 — 최우수`, positive: true })
  } else if (c.creditScore >= 700) {
    score += 26
    factors.push({ label: '신용점수', value: `${c.creditScore}점 — 양호`, positive: true })
  } else if (c.creditScore >= 600) {
    score += 12
    factors.push({ label: '신용점수', value: `${c.creditScore}점 — 보통`, positive: false })
  } else {
    score += 4
    factors.push({ label: '신용점수', value: `${c.creditScore}점 — 주의`, positive: false })
  }

  // 연소득 (30점)
  if (c.annualIncome >= 5000) {
    score += 30
    factors.push({ label: '연소득', value: `${c.annualIncome.toLocaleString()}만원 — 고소득`, positive: true })
  } else if (c.annualIncome >= 3000) {
    score += 20
    factors.push({ label: '연소득', value: `${c.annualIncome.toLocaleString()}만원 — 적정`, positive: true })
  } else {
    score += 8
    factors.push({ label: '연소득', value: `${c.annualIncome.toLocaleString()}만원 — 낮음`, positive: false })
  }

  // 부채비율 (20점)
  if (dti < 30) {
    score += 20
    factors.push({ label: '부채비율(DTI)', value: `${dti}% — 양호`, positive: true })
  } else if (dti < 60) {
    score += 12
    factors.push({ label: '부채비율(DTI)', value: `${dti}% — 보통`, positive: true })
  } else {
    score += 3
    factors.push({ label: '부채비율(DTI)', value: `${dti}% — 높음`, positive: false })
  }

  // 연체 없음 (10점)
  const hasOverdue = c.accounts.some(a => a.status === '연체')
  if (!hasOverdue) {
    score += 10
    factors.push({ label: '연체 이력', value: '없음', positive: true })
  } else {
    factors.push({ label: '연체 이력', value: '있음 — 감점', positive: false })
  }

  const eligible = score >= 40 && !hasOverdue

  // 추천 카드 구성
  const cards: CardOption[] = []
  if (score >= 80) {
    cards.push({
      id: 'p1',
      name: 'iM 프리미엄 플래티넘',
      desc: '공항 라운지·해외 할인·프리미엄 혜택',
      limit: Math.min(5000, Math.round(c.annualIncome * 0.6 / 100) * 100),
      tier: 'premium',
      benefits: ['공항 라운지 무제한', '해외결제 1.5% 캐시백', '호텔 할인 20%'],
    })
  }
  if (score >= 55) {
    cards.push({
      id: 's1',
      name: 'iM 일반 신용카드',
      desc: '국내 쇼핑·주유·통신 할인',
      limit: Math.min(2000, Math.round(c.annualIncome * 0.3 / 100) * 100),
      tier: 'standard',
      benefits: ['국내 쇼핑 5% 할인', '주유 리터당 60원 할인', '통신비 월 3,000원 절감'],
    })
  }
  if (score >= 40) {
    cards.push({
      id: 'b1',
      name: 'iM 실속 신용카드',
      desc: '생활밀착형 혜택, 연회비 0원',
      limit: Math.min(500, Math.round(c.annualIncome * 0.1 / 100) * 100),
      tier: 'basic',
      benefits: ['편의점·마트 3% 할인', '대중교통 10% 할인', '연회비 면제'],
    })
  }

  const reason = !eligible
    ? '신용점수 또는 연체 이력으로 인해 현재 신용카드 발급이 어렵습니다.'
    : score >= 80 ? '우수한 신용 프로필로 프리미엄 카드 발급이 가능합니다.'
    : score >= 55 ? '양호한 신용 프로필로 일반 신용카드 발급이 가능합니다.'
    : '기본 심사를 통과하였습니다. 실속형 카드 발급이 가능합니다.'

  return { score, eligible, reason, factors, cards, dti }
}

// ── 데이터 수집 소스 목록 ────────────────────────────
const DATA_SOURCES = [
  { key: 'deposit',  label: '수신 계좌',   sub: '예금·적금·수시입출금', icon: '🏦' },
  { key: 'loan',     label: '여신 정보',   sub: '대출·할부·연체 이력',  icon: '📋' },
  { key: 'tx',       label: '거래 내역',   sub: '최근 6개월 입출금',     icon: '📊' },
  { key: 'card',     label: '기존 카드',   sub: '발급·이용 현황',        icon: '💳' },
  { key: 'credit',   label: '신용정보원',  sub: 'NICE·KCB 신용등급',    icon: '🔍' },
]

// ─────────────────────────────────────────────────────
type Step = 'input' | 'collecting' | 'result' | 'select' | 'done'

export function Screen0310() {
  const { activeResidentId, setActiveResidentId } = useCustomer()

  const [step,          setStep]          = useState<Step>('input')
  const [front,         setFront]         = useState(activeResidentId ?? '')
  const [back,          setBack]          = useState('')
  const [customer,      setCustomer]      = useState<DummyCustomer | null>(null)
  const [evalResult,    setEvalResult]    = useState<EvalResult | null>(null)
  const [collected,     setCollected]     = useState<Set<string>>(new Set())
  const [selectedCard,  setSelectedCard]  = useState<string>('')
  const [statusState,   setStatusState]   = useState<'idle' | 'error' | 'success'>('idle')
  const [statusMsg,     setStatusMsg]     = useState('실명번호를 입력하고 [심사 시작] 버튼을 클릭하세요.')
  const [appNo,         setAppNo]         = useState('')

  const frontRef = useRef<HTMLInputElement>(null)

  // Screen0156에서 넘어온 고객 자동 세팅
  useEffect(() => {
    if (activeResidentId) {
      setFront(activeResidentId)
    }
  }, [activeResidentId])

  // 데이터 수집 애니메이션
  useEffect(() => {
    if (step !== 'collecting') return
    let idx = 0
    const timer = setInterval(() => {
      const key = DATA_SOURCES[idx]?.key
      if (key) setCollected(prev => new Set([...prev, key]))
      idx++
      if (idx >= DATA_SOURCES.length) {
        clearInterval(timer)
        setTimeout(() => {
          if (customer) {
            const result = evaluateCard(customer)
            setEvalResult(result)
            setSelectedCard(result.cards[0]?.id ?? '')
            setStep('result')
          }
        }, 600)
      }
    }, 500)
    return () => clearInterval(timer)
  }, [step, customer])

  const handleSearch = () => {
    const key = front.trim().slice(0, 6)
    if (key.length < 6) {
      setStatusState('error')
      setStatusMsg('오류: 실명번호 앞 6자리를 입력해주세요.')
      return
    }
    const found = findCustomer(key)
    if (!found) {
      setStatusState('error')
      setStatusMsg('오류: 해당 실명번호로 등록된 고객 정보가 없습니다.')
      return
    }
    setCustomer(found)
    setActiveResidentId(key)
    setCollected(new Set())
    setStep('collecting')
    setStatusState('idle')
    setStatusMsg(`${found.name} 고객 데이터 수집 중...`)
  }

  const handleApply = () => {
    if (!selectedCard) {
      setStatusState('error')
      setStatusMsg('오류: 카드를 선택해주세요.')
      return
    }
    setStep('done')
    const no = `APP-${Date.now().toString().slice(-8)}`
    setAppNo(no)
    setStatusState('success')
    setStatusMsg(`카드 신청 완료. 접수번호: ${no}`)
  }

  const reset = () => {
    setStep('input'); setFront(''); setBack(''); setCustomer(null)
    setEvalResult(null); setCollected(new Set()); setSelectedCard('')
    setStatusState('idle'); setStatusMsg('실명번호를 입력하고 [심사 시작] 버튼을 클릭하세요.')
    setTimeout(() => frontRef.current?.focus(), 100)
  }

  const statusClass = statusState === 'success' ? ' bk-statusbar--success'
    : statusState === 'error' ? ' bk-statusbar--error' : ''

  return (
    <div className="bk-screen">
      {/* ── 타이틀바 ── */}
      <div className="bk-titlebar">
        <span className="bk-titlebar-code">■ [0310] 신용카드 발급 가능 조회</span>
        <div className="bk-titlebar-right">
          <span className="bk-titlebar-info">실명번호 조회 → 자동 심사 → 즉시 신청</span>
          {step !== 'input' && (
            <button className="bk-btn" onClick={reset}>새 조회</button>
          )}
        </div>
      </div>

      {/* ── 진행 단계 표시 ── */}
      <div className="cd-stepper">
        {(['input', 'collecting', 'result', 'select', 'done'] as Step[]).map((s, i) => {
          const labels = ['고객 조회', '데이터 수집', '심사 결과', '카드 선택', '신청 완료']
          const idx = ['input','collecting','result','select','done'].indexOf(step)
          const isCurrent = s === step
          const isDone    = i < idx
          return (
            <div key={s} className={`cd-step${isCurrent ? ' cd-step--active' : isDone ? ' cd-step--done' : ''}`}>
              <div className="cd-step-dot">{isDone ? '✓' : i + 1}</div>
              <div className="cd-step-label">{labels[i]}</div>
              {i < 4 && <div className={`cd-step-line${isDone ? ' cd-step-line--done' : ''}`} />}
            </div>
          )
        })}
      </div>

      {/* ── 콘텐츠 영역 ── */}
      <div className="bk-content cd-content">

        {/* ─── STEP: 고객 조회 ─── */}
        {step === 'input' && (
          <div className="cd-panel">
            <div className="bk-section-header">■ 실명번호 입력</div>
            <div className="bk-form-row">
              <span className="bk-label">실명번호</span>
              <input
                ref={frontRef}
                className={`bk-input${!front ? ' bk-input--required' : ''}`}
                placeholder="앞 6자리 *"
                maxLength={6}
                value={front}
                onChange={e => setFront(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ width: 100 }}
              />
              <span style={{ color: '#9ca3af', padding: '0 6px' }}>—</span>
              <input
                className="bk-input"
                placeholder="뒤 7자리"
                maxLength={7}
                value={back}
                onChange={e => setBack(e.target.value.replace(/\D/g, ''))}
                style={{ width: 110 }}
              />
              <button className="bk-btn bk-btn--primary" onClick={handleSearch}>
                심사 시작
              </button>
            </div>
            <div className="cd-hint">
              <span className="cd-hint-icon">💡</span>
              실명번호를 입력하면 수신·여신·거래 이력을 자동으로 수집하여 신용카드 발급 가능 여부를 즉시 심사합니다.
              별도 서류 제출 없이 화면에서 바로 신청까지 완료할 수 있습니다.
            </div>
            <div className="cd-sample-ids">
              <span style={{ fontSize: 11, color: '#9ca3af' }}>테스트 ID:</span>
              {[['010101','홍길동'],['020202','이몽룡'],['030303','성춘향'],['040404','심청'],['050505','전우치']].map(([id, name]) => (
                <button key={id} className="cd-sample-btn" onClick={() => setFront(id)}>
                  {id} ({name})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP: 데이터 수집 ─── */}
        {step === 'collecting' && (
          <div className="cd-panel">
            <div className="bk-section-header">■ 고객 데이터 수집 중</div>
            {customer && (
              <div className="cd-customer-badge">
                <span className="cd-customer-name">{customer.name}</span>
                <span className="cd-customer-meta">{customer.age}세 · {customer.job}</span>
                <span className={`cd-grade cd-grade--${customer.grade}`}>{customer.grade}</span>
              </div>
            )}
            <div className="cd-sources">
              {DATA_SOURCES.map(src => {
                const done = collected.has(src.key)
                return (
                  <div key={src.key} className={`cd-source${done ? ' cd-source--done' : ' cd-source--loading'}`}>
                    <span className="cd-source-icon">{src.icon}</span>
                    <div className="cd-source-info">
                      <div className="cd-source-label">{src.label}</div>
                      <div className="cd-source-sub">{src.sub}</div>
                    </div>
                    <div className="cd-source-status">
                      {done
                        ? <span className="cd-source-check">✓ 수집 완료</span>
                        : <span className="cd-source-spinner" />}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="cd-collecting-msg">
              {collected.size < DATA_SOURCES.length
                ? `${collected.size} / ${DATA_SOURCES.length} 시스템 수집 중...`
                : '모든 데이터 수집 완료 — 심사 결과 분석 중...'}
            </div>
          </div>
        )}

        {/* ─── STEP: 심사 결과 ─── */}
        {step === 'result' && evalResult && customer && (
          <div className="cd-result-layout">
            {/* 왼쪽: 고객 프로필 */}
            <div className="cd-result-left">
              <div className="bk-section-header">■ 고객 프로필</div>
              <div className="cd-profile-card">
                <div className="cd-profile-row">
                  <span className="cd-profile-label">성명</span>
                  <span className="cd-profile-value">{customer.name}</span>
                  <span className={`cd-grade cd-grade--${customer.grade}`}>{customer.grade}</span>
                </div>
                <div className="cd-profile-row">
                  <span className="cd-profile-label">연령/직업</span>
                  <span className="cd-profile-value">{customer.age}세 · {customer.job}</span>
                </div>
                <div className="cd-profile-row">
                  <span className="cd-profile-label">연소득</span>
                  <span className="cd-profile-value">{customer.annualIncome.toLocaleString()}만원</span>
                </div>
                <div className="cd-profile-row">
                  <span className="cd-profile-label">총자산</span>
                  <span className="cd-profile-value">{customer.totalAssets.toLocaleString()}만원</span>
                </div>
                <div className="cd-profile-row">
                  <span className="cd-profile-label">총부채</span>
                  <span className="cd-profile-value">{customer.totalDebt.toLocaleString()}만원</span>
                </div>
                <div className="cd-profile-row">
                  <span className="cd-profile-label">DTI</span>
                  <span className={`cd-profile-value${evalResult.dti < 50 ? ' cd-val--good' : ' cd-val--warn'}`}>
                    {evalResult.dti}%
                  </span>
                </div>
                <div className="cd-profile-row">
                  <span className="cd-profile-label">신용점수</span>
                  <span className="cd-profile-value cd-val--good">{customer.creditScore}점</span>
                </div>
                <div className="cd-profile-row">
                  <span className="cd-profile-label">보유 계좌</span>
                  <span className="cd-profile-value">{customer.accounts.length}개</span>
                </div>
              </div>

              {/* 판단 요소 */}
              <div className="bk-section-header" style={{ marginTop: 12 }}>■ 심사 주요 항목</div>
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

            {/* 오른쪽: 심사 점수 + 결과 */}
            <div className="cd-result-right">
              <div className="bk-section-header">■ 심사 결과</div>

              {/* 점수 게이지 */}
              <div className="cd-gauge-wrap">
                <div className="cd-gauge-label">종합 심사 점수</div>
                <div className="cd-gauge-bar">
                  <div
                    className={`cd-gauge-fill${evalResult.score >= 80 ? ' cd-gauge-fill--premium' : evalResult.score >= 55 ? ' cd-gauge-fill--standard' : evalResult.score >= 40 ? ' cd-gauge-fill--basic' : ' cd-gauge-fill--reject'}`}
                    style={{ width: `${evalResult.score}%` }}
                  />
                </div>
                <div className="cd-gauge-nums">
                  <span>0</span>
                  <span className="cd-gauge-score">{evalResult.score}점</span>
                  <span>100</span>
                </div>
              </div>

              {/* 결과 배너 */}
              <div className={`cd-verdict${evalResult.eligible ? ' cd-verdict--pass' : ' cd-verdict--fail'}`}>
                <span className="cd-verdict-icon">{evalResult.eligible ? '✔' : '✘'}</span>
                <div>
                  <div className="cd-verdict-title">{evalResult.eligible ? '발급 가능' : '발급 불가'}</div>
                  <div className="cd-verdict-reason">{evalResult.reason}</div>
                </div>
              </div>

              {evalResult.eligible && (
                <button
                  className="bk-btn bk-btn--primary cd-proceed-btn"
                  onClick={() => setStep('select')}
                >
                  카드 선택하기 →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── STEP: 카드 선택 ─── */}
        {step === 'select' && evalResult && customer && (
          <div className="cd-panel">
            <div className="bk-section-header">■ 발급 가능 카드 선택</div>
            <div className="cd-cards-grid">
              {evalResult.cards.map(card => (
                <div
                  key={card.id}
                  className={`cd-card-option${selectedCard === card.id ? ' cd-card-option--selected' : ''} cd-card-option--${card.tier}`}
                  onClick={() => setSelectedCard(card.id)}
                >
                  <div className="cd-card-option-header">
                    <div className="cd-card-option-name">{card.name}</div>
                    <div className={`cd-card-tier cd-card-tier--${card.tier}`}>
                      {card.tier === 'premium' ? '프리미엄' : card.tier === 'standard' ? '일반' : '기본'}
                    </div>
                  </div>
                  <div className="cd-card-option-desc">{card.desc}</div>
                  <div className="cd-card-option-limit">
                    추천 한도: <strong>{card.limit.toLocaleString()}만원</strong>
                  </div>
                  <div className="cd-card-benefits">
                    {card.benefits.map(b => (
                      <span key={b} className="cd-benefit-tag">{b}</span>
                    ))}
                  </div>
                  <div className="cd-card-radio">
                    <span className={`cd-radio${selectedCard === card.id ? ' cd-radio--on' : ''}`} />
                    {selectedCard === card.id ? '선택됨' : '선택'}
                  </div>
                </div>
              ))}
            </div>

            <div className="bk-section-header" style={{ marginTop: 16 }}>■ 수령 정보</div>
            <div className="bk-form-row">
              <span className="bk-label">수령 방법</span>
              <select className="bk-select" defaultValue="branch">
                <option value="branch">영업점 수령 (즉시)</option>
                <option value="mail">등기 우편 (3~5일)</option>
              </select>
            </div>
            <div className="bk-form-row">
              <span className="bk-label">카드 비밀번호</span>
              <input className="bk-input" type="password" placeholder="4자리 입력" maxLength={4} style={{ width: 90 }} />
              <input className="bk-input" type="password" placeholder="확인" maxLength={4} style={{ width: 90 }} />
            </div>

            <div className="cd-apply-row">
              <button className="bk-btn" onClick={() => setStep('result')}>← 이전</button>
              <button
                className="bk-btn bk-btn--primary cd-apply-btn"
                onClick={handleApply}
                disabled={!selectedCard}
              >
                신청하기
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP: 완료 ─── */}
        {step === 'done' && evalResult && customer && (
          <div className="cd-panel cd-done-panel">
            <div className="cd-done-icon">✔</div>
            <div className="cd-done-title">카드 신청이 완료되었습니다</div>
            <div className="cd-done-sub">
              {customer.name} 고객님의 신용카드 발급 신청이 정상적으로 접수되었습니다.
            </div>
            <div className="cd-done-info">
              <div className="cd-done-row">
                <span className="cd-done-label">접수 번호</span>
                <span className="cd-done-val cd-done-val--accent">{appNo}</span>
              </div>
              <div className="cd-done-row">
                <span className="cd-done-label">신청 카드</span>
                <span className="cd-done-val">
                  {evalResult.cards.find(c => c.id === selectedCard)?.name}
                </span>
              </div>
              <div className="cd-done-row">
                <span className="cd-done-label">처리 시간</span>
                <span className="cd-done-val">영업점 즉시 수령 / 우편 3~5일</span>
              </div>
            </div>
            <div className="cd-done-kpi">
              🏆 이 거래로 KPI <strong>+15점</strong>이 적립됩니다.
            </div>
            <button className="bk-btn bk-btn--primary" onClick={reset} style={{ marginTop: 20 }}>
              새 고객 조회
            </button>
          </div>
        )}
      </div>

      {/* ── 상태바 ── */}
      <div className={`bk-statusbar${statusClass}`}>{statusMsg}</div>
    </div>
  )
}
