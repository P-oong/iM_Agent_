import { Outlet } from 'react-router-dom'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

export function MainLayout() {
  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
