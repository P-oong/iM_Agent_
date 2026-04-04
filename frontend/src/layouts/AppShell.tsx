import { Outlet } from 'react-router-dom'
import { RightSidebar } from '@/components/sidebar/RightSidebar'
import { KpiBar } from '@/components/kpi/KpiBar'

/** 전 페이지 공통 래퍼 — 오른쪽 사이드바 + 하단 KPI 바 */
export function AppShell() {
  return (
    <>
      <Outlet />
      <RightSidebar />
      <KpiBar />
    </>
  )
}
