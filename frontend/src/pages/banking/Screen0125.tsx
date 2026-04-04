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

const INITIAL_ROWS: Row[] = [
  {
    id: 1, checked: true,
    처리결과: '정상③', 은행코드: '020-우리', 자금구분: '00-대체',
    계좌번호: '088-12345-704', 입금금액: '3,000',
    통장입력내용: '7자까지 가능', 처리결과내용: '', 성명: '김', 오류건수: 0,
  },
  {
    id: 2, checked: true,
    처리결과: '정상', 은행코드: '031-iM뱅크', 자금구분: '00-대체',
    계좌번호: '251-12345-7', 입금금액: '3,000',
    통장입력내용: '7자까지 가능', 처리결과내용: '', 성명: '', 오류건수: 0,
  },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: i + 3, checked: false,
    처리결과: '', 은행코드: '', 자금구분: '',
    계좌번호: '', 입금금액: '',
    통장입력내용: i < 8 ? '7자까지 가능' : '',
    처리결과내용: '', 성명: '', 오류건수: null,
  })),
]

function toNumber(v: string) {
  return Number(v.replace(/,/g, '') || 0)
}

export function Screen0125() {
  const [rows, setRows] = useState<Row[]>(INITIAL_ROWS)

  const toggleCheck = (id: number, checked: boolean) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, checked } : r)))

  const activeRows = rows.filter(r => r.checked && r.입금금액)
  const total = activeRows.reduce((s, r) => s + toNumber(r.입금금액), 0)
  const normalCount = activeRows.filter(r => r.처리결과.startsWith('정상')).length

  return (
    <div className="bk-screen">
      {/* ── 타이틀바 ── */}
      <div className="bk-titlebar">
        <span className="bk-titlebar-code">● [0125]&nbsp;&nbsp;수수</span>
        <div className="bk-titlebar-right">
          <span className="bk-titlebar-info">대리</span>
          <button className="bk-btn">p-매뉴얼</button>
          <button className="bk-btn">초기화</button>
          <button className="bk-btn bk-btn--primary">전송</button>
        </div>
      </div>

      <div className="bk-content">
        {/* ── 입금인정보 ── */}
        <div className="bk-section-hd">
          ■ 입금인정보
          <button className="bk-btn bk-btn--sm">기업임포조회</button>
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
            <span className="bk-label">송금인실명번호</span>
            <input className="bk-input" style={{ width: 80 }} defaultValue="000" />
            <select className="bk-select" style={{ width: 44 }}>
              <option>52</option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">송금인계좌번호</span>
            <input className="bk-input" style={{ width: 130 }} />
          </div>
          <div className="bk-field">
            <span className="bk-label">송금인명</span>
            <select className="bk-select" style={{ width: 60 }}>
              <option>경남</option>
              <option>대구</option>
            </select>
          </div>
          <button className="bk-btn" style={{ marginLeft: 6 }}>주저대표회</button>
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
              <option></option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">감면내용</span>
            <input className="bk-input" style={{ width: 140 }} placeholder="10자까지 가능" />
          </div>
        </div>

        {/* ── 안내 ── */}
        <div className="bk-notice">
          * &quot;전송&quot; 버튼이 선택불가한 경우 &quot;입력자료검증&quot; 버튼을 클릭하여 자료검증 후, 전송(승신)하시기 바랍니다.
        </div>

        {/* ── 버튼 행 ── */}
        <div className="bk-btn-row">
          <button className="bk-btn">기업임포조회</button>
          <span className="bk-btn-divider">|</span>
          <button className="bk-btn">변별영수증출력</button>
          <button className="bk-btn">입력자료검증</button>
          <button className="bk-btn">행셀등록</button>
          <button className="bk-btn">행추가</button>
          <button className="bk-btn bk-btn--danger">삭제</button>
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
                <th>계좌번호</th>
                <th style={{ textAlign: 'right', minWidth: 60 }}>입금금액</th>
                <th>통장입력내용</th>
                <th>처리결과내용</th>
                <th>성명</th>
                <th style={{ minWidth: 44 }}>발생일</th>
                <th style={{ minWidth: 36 }}>가동</th>
                <th style={{ textAlign: 'right', minWidth: 44 }}>오류건수</th>
                <th style={{ minWidth: 40 }}>계시시오</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  className={row.checked ? 'bk-row-checked' : row.처리결과 === '' ? 'bk-row-empty' : ''}
                >
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={e => toggleCheck(row.id, e.target.checked)}
                    />
                  </td>
                  <td>{row.처리결과}</td>
                  <td>{row.은행코드}</td>
                  <td>{row.자금구분}</td>
                  <td>{row.계좌번호}</td>
                  <td style={{ textAlign: 'right' }}>{row.입금금액}</td>
                  <td>{row.통장입력내용}</td>
                  <td>{row.처리결과내용}</td>
                  <td>{row.성명}</td>
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
            <button className="bk-btn bk-btn--sm">본인CDO</button>
            <button className="bk-btn bk-btn--sm">대리인CDO</button>
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
                <option></option>
              </select>
            </div>
          </div>
          <button className="bk-btn bk-btn--sm">액셀자료편집</button>
        </div>

        {/* ── 압력집계정보 ── */}
        <div className="bk-section-hd">■ 압력집계정보</div>
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
              <td className="bk-sum-num">...─</td>
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

        {/* ── 오류내용 ── */}
        <div className="bk-section-hd" style={{ fontWeight: 'normal', fontSize: 11 }}>
          ■ 오류내용 (• 해당처리결과행의 값을 더블클릭하면 처리결과를 확인할 수 있습니다)
        </div>
        <div style={{ height: 44, padding: '4px 8px', fontSize: 11, color: '#999' }} />

        <div className="bk-notice">
          * 엑셀로 등록하시는 경우는 엑셀양식발기를 이용하여 정확한 양식포맷을 받은 후 처리하시기 바랍니다.
        </div>
      </div>

      {/* ── 상태바 ── */}
      <div className="bk-statusbar">
        거래가 완료되었습니다. (거래메시지 1건, 확인시)
      </div>
    </div>
  )
}
