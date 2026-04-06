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
        <span className="bk-titlebar-code">● [0000]&nbsp;&nbsp;빈 화면 템플릿</span>
        <div className="bk-titlebar-right">
          <button className="bk-btn">초기화</button>
          <button className="bk-btn bk-btn--primary">전송</button>
        </div>
      </div>

      <div className="bk-content">

        {/* ── 섹션 1: 기본 입력 폼 ── */}
        <div className="bk-section-hd">■ 기본 조회 조건</div>

        {/* 첫 번째 폼 행 */}
        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">조회구분</span>
            <select className="bk-select" style={{ width: 120 }}>
              <option>전체</option>
              <option>조건별</option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">업무구분</span>
            <select className="bk-select" style={{ width: 120 }}>
              <option>일반</option>
              <option>특수</option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">처리상태</span>
            <select className="bk-select" style={{ width: 120 }}>
              <option>전체</option>
            </select>
          </div>
        </div>

        {/* 두 번째 폼 행 */}
        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">조회번호</span>
            <input className="bk-input" style={{ width: 120 }} />
          </div>
          <div className="bk-field">
            <span className="bk-label">거래금액</span>
            <input className="bk-input" style={{ width: 80 }} type="number" />
          </div>
          <div className="bk-field">
            <span className="bk-label">메모</span>
            <input className="bk-input" style={{ width: 200 }} placeholder="내용 입력" />
          </div>
        </div>

        {/* 세 번째 폼 행 */}
        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">고객번호</span>
            <input className="bk-input" style={{ width: 100 }} />
          </div>
          <div className="bk-field">
            <span className="bk-label">승인상태</span>
            <select className="bk-select" style={{ width: 80 }}>
              <option></option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">비고</span>
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
                <th>항목1</th>
                <th>항목2</th>
                <th>항목3</th>
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
          ■ 추가 정보
          <div className="bk-section-hd-btns">
            <button className="bk-btn bk-btn--sm">추가조회</button>
            <button className="bk-btn bk-btn--sm">자료출력</button>
          </div>
        </div>

        <div className="bk-form-row">
          <div className="bk-field">
            <span className="bk-label">구분</span>
            <select className="bk-select" style={{ width: 80 }}>
              <option></option>
            </select>
          </div>
          <div className="bk-field">
            <span className="bk-label">참조번호</span>
            <input className="bk-input" style={{ width: 120 }} />
          </div>
          <div className="bk-field">
            <span className="bk-label">담당자</span>
            <input className="bk-input" style={{ width: 120 }} />
          </div>
        </div>

        {/* ── 섹션 3: 집계/결과 ── */}
        <div className="bk-section-hd">■ 집계 정보</div>
        <table className="bk-sum-table">
          <tbody>
            <tr>
              <td className="bk-sum-th">처리 건수</td>
              <td className="bk-sum-num">0건</td>
              <td className="bk-sum-num">0</td>
              <td className="bk-sum-cat">정상</td>
              <td className="bk-sum-num">0</td>
              <td className="bk-sum-cat">오류</td>
              <td className="bk-sum-num">0</td>
            </tr>
            <tr>
              <td className="bk-sum-th">합계 금액</td>
              <td className="bk-sum-num">0건</td>
              <td className="bk-sum-num">0</td>
              <td className="bk-sum-cat">입금</td>
              <td className="bk-sum-num">0</td>
              <td className="bk-sum-cat">출금</td>
              <td className="bk-sum-num">0</td>
            </tr>
          </tbody>
        </table>

        {/* ── 안내 문구 ── */}
        <div className="bk-notice">
          * 이 화면은 새 전산 페이지를 설계할 때 사용하는 기본 템플릿입니다.
        </div>

      </div>

      {/* ── 상태바 ── */}
      <div className="bk-statusbar">
        기본 상태 메시지
      </div>

    </div>
  )
}
