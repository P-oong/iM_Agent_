import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { MainLayout } from '@/layouts/MainLayout'
import { BankingLayout } from '@/layouts/BankingLayout'
import { AboutPage } from '@/pages/AboutPage'
import { AiPage } from '@/pages/AiPage'
import { HomePage } from '@/pages/HomePage'
import { Screen0125 } from '@/pages/banking/Screen0125'
import { Screen0156 } from '@/pages/banking/Screen0156'
import { ScreenTemplate } from '@/pages/banking/ScreenTemplate'

const router = createBrowserRouter([
  {
    element: <AppShell />,
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
        children: [
          { index: true, element: <Screen0156 /> },
          { path: '0156', element: <Screen0156 /> },
          { path: '0125', element: <Screen0125 /> },
          { path: 'template', element: <ScreenTemplate /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
