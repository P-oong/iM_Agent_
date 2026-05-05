import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Hash,
  KeyRound,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useCustomer } from '@/contexts/CustomerContext'
import { DUMMY_CUSTOMERS } from '@/data/dummyCustomers'
import '@/styles/banking.css'
import '@/styles/screen0156.css'

function findNameByResidentId(front: string): string | null {
  return DUMMY_CUSTOMERS.find(c => c.residentIdFront === front)?.name ?? null
}

type StatusState = 'idle' | 'error' | 'success'

export function Screen0151() {
  const { setActiveResidentId } = useCustomer()

  const [front, setFront]   = useState('')
  const [back, setBack]     = useState('')
  const backRef             = useRef<HTMLInputElement>(null)

  const [tradeType, setTradeType] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [password, setPassword]   = useState('')
  const [tradeDate, setTradeDate] = useState('')
  const [tradeSeq, setTradeSeq]   = useState('')
  const [printYn, setPrintYn]     = useState('')

  const [linkedName, setLinkedName] = useState<string | null>(null)
  const [statusState, setStatusState] = useState<StatusState>('idle')
  const [statusMsg, setStatusMsg]     = useState('실명번호를 입력하고 조회하세요.')

  const handleSearch = () => {
    const key = front.trim().slice(0, 6)
    if (key.length < 6) {
      setStatusState('error')
      setStatusMsg('실명번호 앞 6자리를 입력해주세요.')
      return
    }
    const name = findNameByResidentId(key)
    if (name) {
      setActiveResidentId(key)
      setLinkedName(name)
      setStatusState('success')
      setStatusMsg(`${name} 고객 조회 완료.`)
    } else {
      setActiveResidentId(null)
      setLinkedName(null)
      setStatusState('error')
      setStatusMsg('등록된 고객 정보를 찾을 수 없습니다.')
    }
  }

  const handleSubmit = () => {
    if (front.trim().length < 6) { setStatusState('error'); setStatusMsg('실명번호 앞 6자리는 필수입니다.'); return }
    if (!linkedName)              { setStatusState('error'); setStatusMsg('먼저 조회 버튼을 눌러 고객을 확인해주세요.'); return }
    if (!tradeType)               { setStatusState('error'); setStatusMsg('거래구분을 선택해주세요.'); return }
    if (!accountNo.trim())        { setStatusState('error'); setStatusMsg('계좌번호를 입력해주세요.'); return }
    if (!tradeDate.trim())        { setStatusState('error'); setStatusMsg('거래일자를 입력해주세요.'); return }
    setStatusState('success')
    setStatusMsg(`${linkedName} 고객 — 거래 전송 완료.`)
  }

  const handleReset = () => {
    setFront(''); setBack(''); setTradeType(''); setAccountNo('')
    setPassword(''); setTradeDate(''); setTradeSeq(''); setPrintYn('')
    setLinkedName(null); setActiveResidentId(null)
    setStatusState('idle')
    setStatusMsg('실명번호를 입력하고 조회하세요.')
  }

  return (
    <div className="sc-wrap">

      {/* ── 타이틀바 ── */}
      <div className="sc-titlebar">
        <div className="sc-titlebar-left">
          <span className="sc-screen-code">0151</span>
          <span className="sc-screen-name">수신 기장 및 재발행</span>
        </div>
        <div className="sc-titlebar-right">
          <button className="sc-tbtn" onClick={handleReset}>
            <RefreshCw size={12} />초기화
          </button>
          <div className="sc-tbtn-divider" />
          <button className="sc-tbtn sc-tbtn--primary" onClick={handleSubmit}>
            <Send size={12} />전송
          </button>
        </div>
      </div>

      <div className="sc-body">

        {/* ── 섹션 1: 실명번호 ── */}
        <div className="sc-section">
          <div className="sc-section-header">
            <ShieldCheck size={13} />
            <span>실명번호 입력</span>
          </div>
          <div className="sc-section-body">
            <div className="sc-field-row">
              <label className="sc-label">
                <User size={12} />실명번호
                <span className="sc-required">*</span>
              </label>
              <div className="sc-id-inputs">
                <input
                  className={`sc-input sc-input--id${!front ? ' sc-input--empty' : ''}`}
                  placeholder="앞 6자리"
                  maxLength={6}
                  value={front}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '')
                    setFront(v)
                    if (v.length === 6) backRef.current?.focus()
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <span className="sc-id-dash">—</span>
                <input
                  ref={backRef}
                  className="sc-input sc-input--id"
                  placeholder="뒤 7자리"
                  maxLength={7}
                  type="password"
                  value={back}
                  onChange={e => setBack(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button className="sc-btn sc-btn--search" onClick={handleSearch}>
                  <Search size={13} />조회
                </button>
              </div>

              <AnimatePresence>
                {linkedName && (
                  <motion.div
                    className="sc-customer-badge"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <CheckCircle2 size={13} />
                    <span>{linkedName}</span>
                    <span className="sc-customer-badge-sub">조회 완료</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── 섹션 2: 거래 정보 ── */}
        <div className="sc-section">
          <div className="sc-section-header">
            <FileText size={13} />
            <span>거래 정보</span>
          </div>
          <div className="sc-section-body sc-section-body--grid">

            {/* 거래구분 */}
            <div className="sc-field-row">
              <label className="sc-label">
                <Hash size={12} />거래구분
                <span className="sc-required">*</span>
              </label>
              <select
                className={`sc-select${!tradeType ? ' sc-select--empty' : ''}`}
                value={tradeType}
                onChange={e => setTradeType(e.target.value)}
              >
                <option value="">— 선택 —</option>
                <option value="A">A — 전체조회</option>
                <option value="B">B — 기간별조회</option>
                <option value="C">C — 거래내역조회</option>
              </select>
            </div>

            {/* 계좌번호 */}
            <div className="sc-field-row">
              <label className="sc-label">
                <CreditCard size={12} />계좌번호
                <span className="sc-required">*</span>
              </label>
              <div className="sc-input-group">
                <input
                  className={`sc-input${!accountNo ? ' sc-input--empty' : ''}`}
                  style={{ flex: 1 }}
                  placeholder="000-00-000000-0"
                  value={accountNo}
                  onChange={e => setAccountNo(e.target.value)}
                />
                <input
                  className="sc-input sc-input--readonly"
                  style={{ width: 100 }}
                  placeholder="예금주"
                  readOnly
                  value={linkedName ?? ''}
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div className="sc-field-row">
              <label className="sc-label">
                <KeyRound size={12} />비밀번호
              </label>
              <input
                className="sc-input sc-input--pw"
                placeholder="••••"
                type="password"
                maxLength={4}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {/* 거래일자 */}
            <div className="sc-field-row">
              <label className="sc-label">
                <CalendarDays size={12} />거래일자
                <span className="sc-required">*</span>
              </label>
              <input
                className={`sc-input${!tradeDate ? ' sc-input--empty' : ''}`}
                style={{ width: 130 }}
                placeholder="YYYYMMDD"
                value={tradeDate}
                onChange={e => setTradeDate(e.target.value)}
              />
            </div>

            {/* 거래순번 */}
            <div className="sc-field-row">
              <label className="sc-label">
                <Hash size={12} />거래순번
              </label>
              <input
                className="sc-input"
                style={{ width: 80 }}
                value={tradeSeq}
                onChange={e => setTradeSeq(e.target.value)}
              />
            </div>

            {/* 장표출력 */}
            <div className="sc-field-row">
              <label className="sc-label">
                <Printer size={12} />장표출력
              </label>
              <select
                className="sc-select"
                style={{ width: 120 }}
                value={printYn}
                onChange={e => setPrintYn(e.target.value)}
              >
                <option value="">— 선택 —</option>
                <option value="N">N — 부</option>
                <option value="Y">Y — 여</option>
              </select>
            </div>

          </div>
        </div>

        {/* ── 섹션 3: 조회 결과 ── */}
        <div className="sc-section sc-section--result">
          <div className="sc-section-header">
            <ChevronRight size={13} />
            <span>조회 결과</span>
          </div>
          <div className="sc-result-area">
            <AnimatePresence mode="wait">
              {statusState === 'success' && linkedName ? (
                <motion.div
                  key="result"
                  className="sc-result-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="sc-result-icon">
                    <CheckCircle2 size={28} />
                  </div>
                  <div className="sc-result-info">
                    <div className="sc-result-name">{linkedName}</div>
                    <div className="sc-result-sub">고객 조회 완료 · 오른쪽 CRM 패널에서 상세 정보를 확인하세요</div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  className="sc-result-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="sc-result-watermark">iM뱅크</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>

      {/* ── 상태바 ── */}
      <div className={`sc-statusbar sc-statusbar--${statusState}`}>
        {statusState === 'error'   && <AlertCircle  size={12} />}
        {statusState === 'success' && <CheckCircle2 size={12} />}
        <span>{statusMsg}</span>
      </div>

    </div>
  )
}
