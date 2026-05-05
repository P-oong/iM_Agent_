import { useNavigate, useLocation } from 'react-router-dom'
import '../../styles/banking.css'

export function BankingNotFound() {
  const navigate = useNavigate()
  const location = useLocation()

  // URL에서 화면 코드 추출 시도
  const code = location.pathname.replace('/banking/', '').replace('/', '').toUpperCase()

  return (
    <div className="bk-screen">
      <div className="bk-titlebar">
        <span className="bk-titlebar-code">■ 화면 없음</span>
      </div>
      <div className="bk-content" style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.25 }}>🖥</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2332', marginBottom: 8 }}>
          화면을 찾을 수 없습니다
        </div>
        <div style={{ fontSize: 12, color: '#6b7a8d', marginBottom: 24, lineHeight: 1.7 }}>
          <strong>[{code}]</strong> 화면은 아직 구현되지 않았거나 존재하지 않는 화면번호입니다.<br />
          상단의 카테고리 탭에서 이용 가능한 화면을 확인하세요.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="bk-btn bk-btn--primary" onClick={() => navigate('/banking')}>
            화면 목록으로
          </button>
          <button className="bk-btn" onClick={() => navigate(-1)}>
            이전 화면
          </button>
        </div>
      </div>
      <div className="bk-statusbar bk-statusbar--error">
        오류: [{code}] 화면이 존재하지 않습니다.
      </div>
    </div>
  )
}
