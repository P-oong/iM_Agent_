import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { RightSidebar } from '@/components/sidebar/RightSidebar'
import { KpiBar } from '@/components/kpi/KpiBar'

/** 전 페이지 공통 래퍼 — 오른쪽 사이드바 + 하단 KPI 바 */
export function AppShell() {
  const location = useLocation()

  useEffect(() => {
    // 페이지 이동 시 항상 최상단에서 시작
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

    // 내부 스크롤 컨테이너(전산/사이드패널)도 상단으로 리셋
    document
      .querySelectorAll<HTMLElement>('.bk-content, .rs-drawer-body')
      .forEach(el => { el.scrollTop = 0 })
  }, [location.pathname])

  return (
    <>
      <Outlet />
      <RightSidebar />
      <KpiBar />
    </>
  )
}
