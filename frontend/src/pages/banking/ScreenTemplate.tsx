/**
 * ─────────────────────────────────────────────────────
 *  전산화면 템플릿 — 복사해서 새 화면 만들 때 사용
 *  1. 파일명 변경 (예: Screen0162.tsx)
 *  2. 화면코드·화면명 변경 ([XXXX] → 실제 코드)
 *  3. 섹션·필드·테이블 열 수정
 * ─────────────────────────────────────────────────────
 */
import { useState } from 'react'

type Row = {
  id: number
  col1: string
  col2: string
  col3: string
}

const INITIAL_ROWS: Row[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  col1: '',
  col2: '',
  col3: '',
}))

export function ScreenTemplate() {
  const [rows] = useState<Row[]>(INITIAL_ROWS)

  return (
    <div className="bk-screen">

      {/* ── 타이틀바: 화면코드·화면명·버튼 ── */}
      <div className="bk-titlebar">
        <span className="bk-titlebar-code">● [XXXX]&nbsp;&nbsp;화면명</span>
        <div className="bk-titlebar-right">
          <button className="bk-btn">초기화</button>
          <button className="bk-btn bk-btn--primary">전송</button>
        </div>
      </div>

      <div className="bk-content">

        {/* ── 섹션 1: 기본 입력 폼 ── */}
        <div className="bk-section-hd">■ 섹션명</div>

        {/* 첫 번째 폼 행 */}
        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">항목명1</span>
            <select className="bk-select" style={{ width: 120 }}>
              <option>옵션A</option>
              <option>옵션B</option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">항목명2</span>
            <select className="bk-select" style={{ width: 120 }}>
              <option>옵션A</option>
              <option>옵션B</option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">항목명3</span>
            <select className="bk-select" style={{ width: 120 }}>
              <option>옵션A</option>
            </select>
          </div>
        </div>

        {/* 두 번째 폼 행 */}
        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">텍스트항목</span>
            <input className="bk-input" style={{ width: 120 }} />
          </div>
          <div className="bk-field">
            <span className="bk-label">숫자항목</span>
            <input className="bk-input" style={{ width: 80 }} type="number" />
          </div>
          <div className="bk-field">
            <span className="bk-label">긴텍스트항목</span>
            <input className="bk-input" style={{ width: 200 }} placeholder="내용 입력" />
          </div>
        </div>

        {/* 세 번째 폼 행 */}
        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">항목A</span>
            <input className="bk-input" style={{ width: 100 }} />
          </div>
          <div className="bk-field">
            <span className="bk-label">항목B</span>
            <select className="bk-select" style={{ width: 80 }}>
              <option></option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">항목C</span>
            <input className="bk-input" style={{ width: 140 }} />
          </div>
          <button className="bk-btn" style={{ marginLeft: 8 }}>조회</button>
        </div>

        {/* ── 버튼 행 ── */}
        <div className="bk-btn-row">
          <button className="bk-btn">조회</button>
          <span className="bk-btn-divider">|</span>
          <button className="bk-btn">등록</button>
          <button className="bk-btn">수정</button>
          <button className="bk-btn bk-btn--danger">삭제</button>
        </div>

        {/* ── 데이터 테이블: 열 추가/삭제 자유롭게 ── */}
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr>
                <th style={{ width: 24 }}>□</th>
                <th>열1</th>
                <th>열2</th>
                <th>열3</th>
                <th style={{ textAlign: 'right' }}>금액</th>
                <th>상태</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="bk-row-empty">
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" />
                  </td>
                  <td>{row.col1}</td>
                  <td>{row.col2}</td>
                  <td>{row.col3}</td>
                  <td style={{ textAlign: 'right' }}></td>
                  <td></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 섹션 2: 추가 정보 ── */}
        <div className="bk-section-hd">
          ■ 추가섹션명
          <div className="bk-section-hd-btns">
            <button className="bk-btn bk-btn--sm">버튼1</button>
            <button className="bk-btn bk-btn--sm">버튼2</button>
          </div>
        </div>

        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">추가항목1</span>
            <select className="bk-select" style={{ width: 80 }}>
              <option></option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">추가항목2</span>
            <input className="bk-input" style={{ width: 120 }} />
          </div>
          <div className="bk-field">
            <span className="bk-label">추가항목3</span>
            <input className="bk-input" style={{ width: 120 }} />
          </div>
        </div>

        {/* ── 섹션 3: 집계/결과 ── */}
        <div className="bk-section-hd">■ 집계정보</div>
        <table className="bk-sum-table">
          <tbody>
            <tr>
              <td className="bk-sum-th">집계항목1</td>
              <td className="bk-sum-num">0건</td>
              <td className="bk-sum-num">0</td>
              <td className="bk-sum-cat">구분A</td>
              <td className="bk-sum-num">0</td>
              <td className="bk-sum-cat">구분B</td>
              <td className="bk-sum-num">0</td>
            </tr>
            <tr>
              <td className="bk-sum-th">집계항목2</td>
              <td className="bk-sum-num">0건</td>
              <td className="bk-sum-num">0</td>
              <td className="bk-sum-cat">구분A</td>
              <td className="bk-sum-num">0</td>
              <td className="bk-sum-cat">구분B</td>
              <td className="bk-sum-num">0</td>
            </tr>
          </tbody>
        </table>

        {/* ── 안내 문구 ── */}
        <div className="bk-notice">
          * 안내 메시지가 필요하면 여기에 작성하세요.
        </div>

      </div>

      {/* ── 상태바 ── */}
      <div className="bk-statusbar">
        상태 메시지
      </div>

    </div>
  )
}
