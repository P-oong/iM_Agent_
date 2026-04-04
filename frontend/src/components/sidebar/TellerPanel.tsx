const now = new Date()
const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function TellerPanel() {
  return (
    <div>
      <div className="rs-info-time">기준시각: {timeStr}</div>
      <table className="rs-info-table">
        <tbody>
          <tr>
            <td className="rs-info-label">현금 시재</td>
            <td className="rs-info-val">2,430,000원</td>
          </tr>
          <tr>
            <td className="rs-info-label">당일 입금</td>
            <td className="rs-info-val" style={{ color: '#0066cc' }}>6,000원</td>
          </tr>
          <tr>
            <td className="rs-info-label">당일 출금</td>
            <td className="rs-info-val" style={{ color: '#cc3300' }}>500,000원</td>
          </tr>
          <tr>
            <td className="rs-info-label">영업점 시재</td>
            <td className="rs-info-val">48,200,000원</td>
          </tr>
          <tr>
            <td className="rs-info-label">마감 여부</td>
            <td className="rs-info-val">
              <span
                style={{
                  fontSize: 11,
                  background: '#e6fff9',
                  color: '#009e86',
                  padding: '2px 8px',
                  borderRadius: 99,
                  fontWeight: 700,
                }}
              >
                미마감
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="rs-info-note">* 예시 데이터입니다</div>
    </div>
  )
}
