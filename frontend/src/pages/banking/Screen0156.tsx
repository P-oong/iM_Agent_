import { useRef, useState } from 'react'
import { useCustomer } from '@/contexts/CustomerContext'
import { DUMMY_CUSTOMERS } from '@/data/dummyCustomers'
import '@/styles/banking.css'

function findNameByResidentId(front: string): string | null {
  return DUMMY_CUSTOMERS.find(c => c.residentIdFront === front)?.name ?? null
}

export function Screen0156() {
  const { setActiveResidentId } = useCustomer()

  const [front, setFront]   = useState('')
  const [back, setBack]     = useState('')
  const backRef             = useRef<HTMLInputElement>(null)

  const [tradeType, setTradeType] = useState('C-통정사브출력')
  const [accountNo, setAccountNo] = useState('')
  const [password, setPassword]   = useState('')
  const [tradeDate, setTradeDate] = useState('')
  const [tradeSeq, setTradeSeq]   = useState('')
  const [printYn, setPrintYn]     = useState('N-부')

  const [linkedName, setLinkedName] = useState<string | null>(null)
  const [notFound, setNotFound]     = useState(false)

  const handleSearch = () => {
    const key = front.trim().slice(0, 6)
    if (key.length < 6) return
    const name = findNameByResidentId(key)
    if (name) {
      setActiveResidentId(key)
      setLinkedName(name)
      setNotFound(false)
    } else {
      setActiveResidentId(null)
      setLinkedName(null)
      setNotFound(true)
    }
  }

  return (
    <div className="bk-screen">

      {/* ── 타이틀바 ── */}
      <div className="bk-titlebar">
        <span className="bk-titlebar-code">● [0156]&nbsp;&nbsp;고객실명조회</span>
        <div className="bk-titlebar-right">
          <button className="bk-btn">판장</button>
          <button className="bk-btn">새유형</button>
          <button className="bk-btn">S</button>
          <button className="bk-btn" style={{ marginLeft: 8 }}>초기화</button>
          <button className="bk-btn bk-btn--primary">전송</button>
        </div>
      </div>

      <div className="bk-content">

        {/* ── 실명번호 입력 ── */}
        <div className="bk-section-hd">■ 실명번호 입력</div>
        <div className="bk-form-row">
          <span className="bk-label">실명번호</span>
          <input
            className="bk-input"
            style={{ width: 90 }}
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

          {linkedName && (
            <span className="bk-linked-badge">{linkedName} — CRM · AI 분석 연동됨</span>
          )}
          {notFound && (
            <span className="bk-error-badge">등록된 고객 정보 없음</span>
          )}
        </div>

        <div className="bk-notice">
          ※ 예시 주민번호 앞자리: 900101 / 851215 / 750304 / 970715 / 660203
        </div>

        {/* ── 거래 정보 ── */}
        <div className="bk-section-hd" style={{ marginTop: 8 }}>■ 거래 정보</div>

        <div className="bk-form-row">
          <span className="bk-label">거래구분</span>
          <select className="bk-select" value={tradeType} onChange={e => setTradeType(e.target.value)} style={{ width: 180 }}>
            <option>C-통정사브출력</option>
            <option>A-전체조회</option>
            <option>B-기간별조회</option>
          </select>
        </div>

        <div className="bk-form-row">
          <span className="bk-label">계좌번호</span>
          <input className="bk-input" style={{ width: 160 }} placeholder="000-00-000000-0"
            value={accountNo} onChange={e => setAccountNo(e.target.value)} />
          <input className="bk-input" style={{ width: 90 }}
            placeholder="예금주" readOnly value={linkedName ?? ''} />
          <span className="bk-label" style={{ marginLeft: 16 }}>비밀번호</span>
          <input className="bk-input" style={{ width: 60 }} type="password" maxLength={4}
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>

        <div className="bk-form-row">
          <span className="bk-label">거래일자</span>
          <input className="bk-input" style={{ width: 110 }} placeholder="YYYYMMDD"
            value={tradeDate} onChange={e => setTradeDate(e.target.value)} />
          <span className="bk-label" style={{ marginLeft: 16 }}>거래순번</span>
          <input className="bk-input" style={{ width: 70 }}
            value={tradeSeq} onChange={e => setTradeSeq(e.target.value)} />
        </div>

        <div className="bk-form-row">
          <span className="bk-label">장표출력여부</span>
          <select className="bk-select" value={printYn} onChange={e => setPrintYn(e.target.value)} style={{ width: 80 }}>
            <option>N-부</option>
            <option>Y-여</option>
          </select>
        </div>

        {/* ── 조회 결과 ── */}
        <div className="bk-section-hd" style={{ marginTop: 12 }}>■ 조회 결과</div>
        <div className="bk-result-area">
          <span className="bk-result-watermark">iM뱅크</span>

          {linkedName && (
            <div className="bk-result-popup">
              <div className="bk-result-popup-icon">✓</div>
              <div className="bk-result-popup-name">{linkedName} 고객 연동 완료</div>
              <div className="bk-result-popup-desc">
                오른쪽 사이드바 CRM 패널 및 AI 분석 페이지에<br />
                이 고객이 자동으로 입력되었습니다.
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── 상태바 ── */}
      <div className="bk-statusbar">
        {linkedName
          ? `${linkedName} 고객 조회 완료. CRM/AI 분석 연동됨.`
          : '실명번호를 입력하고 [조회] 버튼을 클릭하세요.'}
      </div>
    </div>
  )
}
