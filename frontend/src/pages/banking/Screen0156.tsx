import { useRef, useState } from 'react'
import { useCustomer } from '@/contexts/CustomerContext'
import { DUMMY_CUSTOMERS } from '@/data/dummyCustomers'
import '@/styles/banking.css'

function findNameByResidentId(front: string): string | null {
  return DUMMY_CUSTOMERS.find(c => c.residentIdFront === front)?.name ?? null
}

type StatusState = 'idle' | 'error' | 'success'

export function Screen0156() {
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
  const [statusMsg, setStatusMsg]     = useState('실명번호를 입력하고 [조회] 버튼을 클릭하세요.')

  const handleSearch = () => {
    const key = front.trim().slice(0, 6)
    if (key.length < 6) {
      setStatusState('error')
      setStatusMsg('오류: 실명번호 앞 6자리를 입력해주세요.')
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
      setStatusMsg('오류: 등록된 고객 정보를 찾을 수 없습니다.')
    }
  }

  const handleSubmit = () => {
    if (front.trim().length < 6) {
      setStatusState('error')
      setStatusMsg('오류: 실명번호 앞 6자리는 필수 입력 항목입니다.')
      return
    }
    if (!linkedName) {
      setStatusState('error')
      setStatusMsg('오류: 조회 버튼을 눌러 고객을 먼저 확인해주세요.')
      return
    }
    if (!tradeType) {
      setStatusState('error')
      setStatusMsg('오류: 거래구분을 선택해주세요.')
      return
    }
    if (!accountNo.trim()) {
      setStatusState('error')
      setStatusMsg('오류: 계좌번호를 입력해주세요.')
      return
    }
    if (!tradeDate.trim()) {
      setStatusState('error')
      setStatusMsg('오류: 거래일자를 입력해주세요.')
      return
    }
    setStatusState('success')
    setStatusMsg(`${linkedName} 고객 — 거래 전송 완료.`)
  }

  const handleReset = () => {
    setFront(''); setBack(''); setTradeType(''); setAccountNo('')
    setPassword(''); setTradeDate(''); setTradeSeq(''); setPrintYn('')
    setLinkedName(null); setActiveResidentId(null)
    setStatusState('idle')
    setStatusMsg('실명번호를 입력하고 [조회] 버튼을 클릭하세요.')
  }

  return (
    <div className="bk-screen">

      {/* ── 타이틀바 ── */}
      <div className="bk-titlebar">
        <span className="bk-titlebar-code">● [0156]&nbsp;&nbsp;고객실명조회</span>
        <div className="bk-titlebar-right">
          <button className="bk-btn">도움말</button>
          <button className="bk-btn">조회이력</button>
          <button className="bk-btn">재조회</button>
          <button className="bk-btn" style={{ marginLeft: 8 }} onClick={handleReset}>초기화</button>
          <button className="bk-btn bk-btn--primary" onClick={handleSubmit}>전송</button>
        </div>
      </div>

      <div className="bk-content">

        {/* ── 실명번호 입력 ── */}
        <div className="bk-section-hd">■ 실명번호 입력</div>
        <div className="bk-form-row">
          <span className="bk-label">실명번호</span>
          <input
            className={`bk-input${!front ? ' bk-input--required' : ''}`}
            style={{ width: 90 }}
            placeholder="앞 6자리 *"
            maxLength={6}
            value={front}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '')
              setFront(v)
              if (v.length === 6) backRef.current?.focus()
            }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <span style={{ color: '#aaa', padding: '0 2px' }}>—</span>
          <input
            ref={backRef}
            className="bk-input"
            style={{ width: 100 }}
            placeholder="뒤 7자리"
            maxLength={7}
            type="password"
            value={back}
            onChange={e => setBack(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="bk-btn bk-btn--primary" style={{ marginLeft: 8 }} onClick={handleSearch}>
            조회
          </button>

          {statusState === 'error' && !linkedName && (
            <span className="bk-error-badge">{statusMsg.replace('오류: ', '')}</span>
          )}
        </div>

        {/* ── 거래 정보 ── */}
        <div className="bk-section-hd" style={{ marginTop: 8 }}>■ 거래 정보</div>

        <div className="bk-form-row">
          <span className="bk-label">거래구분</span>
          <select className={`bk-select${!tradeType ? ' bk-select--required' : ''}`} value={tradeType} onChange={e => setTradeType(e.target.value)} style={{ width: 180 }}>
            <option value="">— 선택 * —</option>
            <option value="A">A-전체조회</option>
            <option value="B">B-기간별조회</option>
            <option value="C">C-거래내역조회</option>
          </select>
        </div>

        <div className="bk-form-row">
          <span className="bk-label">계좌번호</span>
          <input className={`bk-input${!accountNo ? ' bk-input--required' : ''}`} style={{ width: 160 }} placeholder="000-00-000000-0 *"
            value={accountNo} onChange={e => setAccountNo(e.target.value)} />
          <input className="bk-input" style={{ width: 90 }}
            placeholder="예금주" readOnly value={linkedName ?? ''} />
          <span className="bk-label" style={{ marginLeft: 16 }}>비밀번호</span>
          <input className="bk-input" style={{ width: 60 }} type="password" maxLength={4}
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>

        <div className="bk-form-row">
          <span className="bk-label">거래일자</span>
          <input className={`bk-input${!tradeDate ? ' bk-input--required' : ''}`} style={{ width: 110 }} placeholder="YYYYMMDD *"
            value={tradeDate} onChange={e => setTradeDate(e.target.value)} />
          <span className="bk-label" style={{ marginLeft: 16 }}>거래순번</span>
          <input className="bk-input" style={{ width: 70 }}
            value={tradeSeq} onChange={e => setTradeSeq(e.target.value)} />
        </div>

        <div className="bk-form-row">
          <span className="bk-label">장표출력여부</span>
          <select className="bk-select" value={printYn} onChange={e => setPrintYn(e.target.value)} style={{ width: 80 }}>
            <option value="">— 선택 —</option>
            <option value="N">N-부</option>
            <option value="Y">Y-여</option>
          </select>
        </div>

        {/* ── 조회 결과 ── */}
        <div className="bk-section-hd" style={{ marginTop: 12 }}>■ 조회 결과</div>
        <div className="bk-result-area">
          <span className="bk-result-watermark">iM뱅크</span>
        </div>

      </div>

      {/* ── 상태바 ── */}
      <div className={`bk-statusbar${statusState === 'success' ? ' bk-statusbar--success' : statusState === 'error' ? ' bk-statusbar--error' : ''}`}>
        {statusMsg}
      </div>
    </div>
  )
}
