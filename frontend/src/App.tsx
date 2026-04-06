import { createBrowserRouter, isRouteErrorResponse, RouterProvider, useRouteError } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { MainLayout } from '@/layouts/MainLayout'
import { BankingLayout } from '@/layouts/BankingLayout'
import { AboutPage } from '@/pages/AboutPage'
import { AiPage } from '@/pages/AiPage'
import { HomePage } from '@/pages/HomePage'
import { Screen0125 } from '@/pages/banking/Screen0125'
import { Screen0156 } from '@/pages/banking/Screen0156'
import { ScreenTemplate } from '@/pages/banking/ScreenTemplate'
import { BankingCategoryPage } from '@/pages/banking/BankingCategoryPage'
import { Screen0310 } from '@/pages/banking/Screen0310'
import { BankingNotFound } from '@/pages/banking/BankingNotFound'

// ── 에러 페이지 (useNavigate 미사용 — a 태그 사용) ──
function GlobalError() {
  const error = useRouteError()
  const is404 = isRouteErrorResponse(error) && error.status === 404
  return (
    <div style={{
      minHeight: '100svh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Pretendard, sans-serif', background: '#f7f9fc',
      color: '#1a2332', gap: 12,
    }}>
      <div style={{ fontSize: 48 }}>{is404 ? '🗂' : '⚠️'}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>
        {is404 ? '페이지를 찾을 수 없습니다' : '오류가 발생했습니다'}
      </div>
      <div style={{ fontSize: 13, color: '#6b7a8d' }}>
        {is404
          ? '요청하신 주소가 존재하지 않습니다.'
          : '예기치 못한 오류가 발생했습니다.'}
      </div>
      <a
        href="/"
        style={{
          marginTop: 8, padding: '8px 24px', borderRadius: 8,
          background: '#00c7a9', color: '#fff', fontWeight: 700,
          textDecoration: 'none', fontSize: 13,
        }}
      >
        홈으로
      </a>
    </div>
  )
}

// ─────────────────────────────────────────────────────
const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <GlobalError />,
    children: [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'ai', element: <AiPage /> },
          { path: 'about', element: <AboutPage /> },
        ],
      },
      {
        path: '/banking',
        element: <BankingLayout />,
        errorElement: <GlobalError />,
        children: [
          { index: true,        element: <BankingCategoryPage /> },
          { path: '0156',       element: <Screen0156 /> },
          { path: '0125',       element: <Screen0125 /> },
          { path: '0310',       element: <Screen0310 /> },
          { path: 'template',   element: <ScreenTemplate /> },
          { path: 'cat/:catId', element: <BankingCategoryPage /> },
          { path: '*',          element: <BankingNotFound /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
