import { useState } from 'react'

type Row = {
  id: number
  checked: boolean
  처리결과: string
  은행코드: string
  자금구분: string
  계좌번호: string
  입금금액: string
  통장입력내용: string
  처리결과내용: string
  성명: string
  오류건수: number | null
}

const INITIAL_ROWS: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  checked: false,
  처리결과: '', 은행코드: '', 자금구분: '',
  계좌번호: '', 입금금액: '',
  통장입력내용: '', 처리결과내용: '', 성명: '', 오류건수: null,
}))

function toNumber(v: string) {
  return Number(v.replace(/,/g, '') || 0)
}

type StatusState = 'idle' | 'error' | 'success'

export function Screen0125() {
  const [rows, setRows] = useState<Row[]>(INITIAL_ROWS)

  const [senderIdNo, setSenderIdNo]   = useState('')
  const [senderAccNo, setSenderAccNo] = useState('')

  const [statusState, setStatusState] = useState<StatusState>('idle')
  const [statusMsg, setStatusMsg]     = useState('입금 정보를 입력하고 [전송] 버튼을 클릭하세요.')

  const toggleCheck = (id: number, checked: boolean) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, checked } : r)))

  const activeRows   = rows.filter(r => r.checked && r.입금금액)
  const total        = activeRows.reduce((s, r) => s + toNumber(r.입금금액), 0)
  const normalCount  = activeRows.filter(r => r.처리결과.startsWith('정상')).length

  const handleAddRow = () => {
    setRows(prev => [
      ...prev,
      {
        id: prev.length + 1, checked: false,
        처리결과: '', 은행코드: '', 자금구분: '',
        계좌번호: '', 입금금액: '',
        통장입력내용: '', 처리결과내용: '', 성명: '', 오류건수: null,
      },
    ])
  }

  const handleDeleteChecked = () => {
    setRows(prev => {
      const filtered = prev.filter(r => !r.checked)
      return filtered.length > 0 ? filtered : INITIAL_ROWS.slice(0, 1)
    })
  }

  const handleReset = () => {
    setRows(INITIAL_ROWS)
    setSenderIdNo('')
    setSenderAccNo('')
    setStatusState('idle')
    setStatusMsg('입금 정보를 입력하고 [전송] 버튼을 클릭하세요.')
  }

  const handleSubmit = () => {
    if (!senderIdNo.trim()) {
      setStatusState('error')
      setStatusMsg('오류: 송금인 실명번호는 필수 입력 항목입니다.')
      return
    }
    if (!senderAccNo.trim()) {
      setStatusState('error')
      setStatusMsg('오류: 송금인 계좌번호는 필수 입력 항목입니다.')
      return
    }
    const filledRows = rows.filter(r => r.계좌번호.trim() && r.입금금액.trim())
    if (filledRows.length === 0) {
      setStatusState('error')
      setStatusMsg('오류: 입금 대상 계좌번호와 입금금액을 1건 이상 입력해주세요.')
      return
    }
    const updated = rows.map(r =>
      r.계좌번호.trim() && r.입금금액.trim()
        ? { ...r, checked: true, 처리결과: '정상', 오류건수: 0 }
        : r
    )
    setRows(updated)
    setStatusState('success')
    setStatusMsg(`거래 전송 완료. 처리 ${filledRows.length}건 · 합계 ${filledRows.reduce((s, r) => s + toNumber(r.입금금액), 0).toLocaleString()}원`)
  }

  return (
    <div className="bk-screen">
      {/* ── 타이틀바 ── */}
      <div className="bk-titlebar">
        <span className="bk-titlebar-code">● [0125]&nbsp;&nbsp;수수 (다수계좌입금)</span>
        <div className="bk-titlebar-right">
          <button className="bk-btn">도움말</button>
          <button className="bk-btn" onClick={handleReset}>초기화</button>
          <button className="bk-btn bk-btn--primary" onClick={handleSubmit}>전송</button>
        </div>
      </div>

      <div className="bk-content">
        {/* ── 입금인정보 ── */}
        <div className="bk-section-hd">
          ■ 입금인정보
          <button className="bk-btn bk-btn--sm">고객조회</button>
        </div>

        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">입금처리구분</span>
            <select className="bk-select" style={{ width: 130 }}>
              <option>2-다수계좌입금</option>
              <option>1-단수계좌입금</option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">전표출력구분</span>
            <select className="bk-select" style={{ width: 100 }}>
              <option>2-일반전표</option>
              <option>1-특수전표</option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">입금종류</span>
            <select className="bk-select" style={{ width: 120 }}>
              <option>201-일반입금</option>
              <option>202-타행입금</option>
            </select>
          </div>
        </div>

        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">송금인실명번호 *</span>
            <input
              className={`bk-input${!senderIdNo ? ' bk-input--required' : ''}`}
              style={{ width: 110 }}
              placeholder="실명번호 *"
              value={senderIdNo}
              onChange={e => setSenderIdNo(e.target.value)}
            />
          </div>
          <div className="bk-field">
            <span className="bk-label">송금인계좌번호 *</span>
            <input
              className={`bk-input${!senderAccNo ? ' bk-input--required' : ''}`}
              style={{ width: 140 }}
              placeholder="계좌번호 *"
              value={senderAccNo}
              onChange={e => setSenderAccNo(e.target.value)}
            />
          </div>
          <div className="bk-field">
            <span className="bk-label">송금인명</span>
            <input className="bk-input" style={{ width: 80 }} placeholder="성명" />
          </div>
        </div>

        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">수수료자금구분</span>
            <select className="bk-select" style={{ width: 80 }}>
              <option>01-현금</option>
              <option>00-대체</option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">감면사유</span>
            <select className="bk-select" style={{ width: 80 }}>
              <option value=""></option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">감면내용</span>
            <input className="bk-input" style={{ width: 140 }} placeholder="10자까지 가능" />
          </div>
        </div>

        {/* ── 안내 ── */}
        <div className="bk-notice">
          * 필수 입력 항목(송금인 실명번호, 계좌번호)을 입력하고 입금 대상 행에 계좌번호와 금액을 입력한 후 [전송] 하세요.
        </div>

        {/* ── 버튼 행 ── */}
        <div className="bk-btn-row">
          <button className="bk-btn">고객조회</button>
          <span className="bk-btn-divider">|</span>
          <button className="bk-btn">영수증출력</button>
          <button className="bk-btn">입력자료검증</button>
          <button className="bk-btn">행저장</button>
          <button className="bk-btn" onClick={handleAddRow}>행추가</button>
          <button className="bk-btn bk-btn--danger" onClick={handleDeleteChecked}>삭제</button>
        </div>

        {/* ── 데이터 테이블 ── */}
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr>
                <th style={{ width: 24 }}>□</th>
                <th>처리결과</th>
                <th>은행코드</th>
                <th>자금구분</th>
                <th>계좌번호 *</th>
                <th style={{ textAlign: 'right', minWidth: 70 }}>입금금액 *</th>
                <th>통장입력내용</th>
                <th>처리결과내용</th>
                <th>성명</th>
                <th style={{ minWidth: 44 }}>처리일</th>
                <th style={{ minWidth: 36 }}>상태</th>
                <th style={{ textAlign: 'right', minWidth: 44 }}>오류건수</th>
                <th style={{ minWidth: 40 }}>비고</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  className={row.checked && row.처리결과 ? 'bk-row-checked' : row.계좌번호 === '' ? 'bk-row-empty' : ''}
                >
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={e => toggleCheck(row.id, e.target.checked)}
                    />
                  </td>
                  <td style={{ color: row.처리결과.startsWith('정상') ? '#009e86' : undefined, fontWeight: row.처리결과 ? 600 : undefined }}>
                    {row.처리결과}
                  </td>
                  <td>
                    <input
                      className="bk-input"
                      style={{ width: 90, height: 18, fontSize: 11 }}
                      value={row.은행코드}
                      placeholder="031-iM뱅크"
                      onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, 은행코드: e.target.value } : r))}
                    />
                  </td>
                  <td>
                    <select
                      className="bk-select"
                      style={{ width: 70, height: 18, fontSize: 11 }}
                      value={row.자금구분}
                      onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, 자금구분: e.target.value } : r))}
                    >
                      <option value=""></option>
                      <option value="00-대체">00-대체</option>
                      <option value="01-현금">01-현금</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className={`bk-input${!row.계좌번호 ? ' bk-input--required' : ''}`}
                      style={{ width: 120, height: 18, fontSize: 11 }}
                      value={row.계좌번호}
                      placeholder="000-00-000000 *"
                      onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, 계좌번호: e.target.value } : r))}
                    />
                  </td>
                  <td>
                    <input
                      className={`bk-input${!row.입금금액 ? ' bk-input--required' : ''}`}
                      style={{ width: 70, height: 18, fontSize: 11, textAlign: 'right' }}
                      value={row.입금금액}
                      placeholder="금액 *"
                      onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, 입금금액: e.target.value } : r))}
                    />
                  </td>
                  <td>
                    <input
                      className="bk-input"
                      style={{ width: 80, height: 18, fontSize: 11 }}
                      value={row.통장입력내용}
                      placeholder="7자까지"
                      maxLength={7}
                      onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, 통장입력내용: e.target.value } : r))}
                    />
                  </td>
                  <td>{row.처리결과내용}</td>
                  <td>
                    <input
                      className="bk-input"
                      style={{ width: 50, height: 18, fontSize: 11 }}
                      value={row.성명}
                      onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, 성명: e.target.value } : r))}
                    />
                  </td>
                  <td></td>
                  <td></td>
                  <td style={{ textAlign: 'right' }}>
                    {row.오류건수 !== null ? row.오류건수 : ''}
                  </td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 자금세탁방지정보 ── */}
        <div className="bk-section-hd">
          ■ 자금세탁방지정보
          <div className="bk-section-hd-btns">
            <button className="bk-btn bk-btn--sm">본인 확인</button>
            <button className="bk-btn bk-btn--sm">대리인 확인</button>
          </div>
        </div>

        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">대리인거래여부</span>
            <select className="bk-select" style={{ width: 60 }}>
              <option>N-부</option>
              <option>Y-여</option>
            </select>
          </div>
        </div>

        <div className="bk-form-row" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="bk-field">
              <span className="bk-label">대리인실명번호</span>
              <input className="bk-input" style={{ width: 120 }} />
            </div>
            <div className="bk-field">
              <span className="bk-label">대리인고객번호</span>
              <input className="bk-input" style={{ width: 120 }} />
            </div>
            <div className="bk-field">
              <span className="bk-label">본인과의 관계</span>
              <select className="bk-select" style={{ width: 80 }}>
                <option value=""></option>
              </select>
            </div>
          </div>
          <button className="bk-btn bk-btn--sm">엑셀자료편집</button>
        </div>

        {/* ── 입력집계정보 ── */}
        <div className="bk-section-hd">■ 입력집계정보</div>
        <table className="bk-sum-table">
          <tbody>
            <tr>
              <td className="bk-sum-th">처리대상정보</td>
              <td className="bk-sum-num">{activeRows.length}건</td>
              <td className="bk-sum-num">{total.toLocaleString()}</td>
              <td className="bk-sum-cat">현금</td>
              <td className="bk-sum-num">0건</td>
              <td className="bk-sum-cat">대체</td>
              <td className="bk-sum-num">{activeRows.length}건</td>
              <td className="bk-sum-num">{total.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="bk-sum-th">수수료정보</td>
              <td className="bk-sum-num">0건</td>
              <td className="bk-sum-num">0</td>
              <td className="bk-sum-cat">현금</td>
              <td className="bk-sum-num">0</td>
              <td className="bk-sum-cat">대체</td>
              <td className="bk-sum-num">{total.toLocaleString()}</td>
              <td className="bk-sum-num">—</td>
            </tr>
            <tr>
              <td className="bk-sum-th">처리합계금액</td>
              <td className="bk-sum-num" colSpan={2}>{total.toLocaleString()}</td>
              <td className="bk-sum-cat">현금</td>
              <td className="bk-sum-num">0</td>
              <td className="bk-sum-cat">대체</td>
              <td className="bk-sum-num" colSpan={2}>{total.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        {/* ── 처리결과정보 ── */}
        <div className="bk-section-hd">■ 처리결과정보</div>
        <div className="bk-form-row">
          <span className="bk-label">정상건수/금액/수수료</span>
          <span style={{ minWidth: 28, textAlign: 'right', marginRight: 6 }}>{normalCount}</span>
          <span style={{ minWidth: 60, textAlign: 'right', marginRight: 6 }}>{total.toLocaleString()}</span>
          <span style={{ marginRight: 20 }}>0</span>
          <span className="bk-label">오류건수/금액</span>
          <span style={{ marginLeft: 6 }}>0</span>
        </div>

        <div className="bk-notice">
          * 엑셀로 등록하는 경우 엑셀양식받기를 이용하여 정확한 양식 파일을 내려받은 후 처리하세요.
        </div>
      </div>

      {/* ── 상태바 ── */}
      <div className={`bk-statusbar${statusState === 'success' ? ' bk-statusbar--success' : statusState === 'error' ? ' bk-statusbar--error' : ''}`}>
        {statusMsg}
      </div>
    </div>
  )
}
