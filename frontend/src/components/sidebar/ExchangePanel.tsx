const RATES = [
  { code: 'USD', name: '미국 달러',      buy: 1_305.5,  sell: 1_331.5  },
  { code: 'EUR', name: '유로',           buy: 1_406.2,  sell: 1_435.8  },
  { code: 'JPY', name: '일본 엔 (100)', buy: 858.4,    sell: 876.6    },
  { code: 'CNY', name: '중국 위안',      buy: 177.2,    sell: 181.8    },
  { code: 'GBP', name: '영국 파운드',    buy: 1_625.4,  sell: 1_660.6  },
]

const stamp = new Date().toLocaleString('ko-KR', {
  month: 'numeric', day: 'numeric',
  hour: '2-digit', minute: '2-digit',
})

export function ExchangePanel() {
  return (
    <div>
      <table className="rs-fx-table">
        <thead>
          <tr>
            <th>통화</th>
            <th>매입(원)</th>
            <th>매도(원)</th>
          </tr>
        </thead>
        <tbody>
          {RATES.map(r => (
            <tr key={r.code}>
              <td>
                <strong>{r.code}</strong>
                <div style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>{r.name}</div>
              </td>
              <td>{r.buy.toLocaleString()}</td>
              <td>{r.sell.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rs-fx-stamp">기준: {stamp}</p>
      <div className="rs-info-note">* 예시 환율입니다</div>
    </div>
  )
}
