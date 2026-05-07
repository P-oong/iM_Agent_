/**
 * CustomerContext — 전역 "현재 선택된 고객" 상태
 * Screen0156에서 실명번호 입력 → CRM/AI 자동 연동에 사용
 */
import { createContext, useContext, useState, type ReactNode } from 'react'

interface CustomerContextValue {
  /** 주민번호 앞 6자리 — null이면 선택 없음 */
  activeResidentId: string | null
  setActiveResidentId: (id: string | null) => void
  /** DB customer_id (e.g. "C001", "DEMO-1") — 고객 API 조회 후 설정 */
  activeCustId: string | null
  setActiveCustId: (id: string | null) => void
}

const CustomerContext = createContext<CustomerContextValue | null>(null)

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [activeResidentId, setActiveResidentId] = useState<string | null>(null)
  const [activeCustId, setActiveCustId]         = useState<string | null>(null)

  return (
    <CustomerContext.Provider value={{ activeResidentId, setActiveResidentId, activeCustId, setActiveCustId }}>
      {children}
    </CustomerContext.Provider>
  )
}

export function useCustomer() {
  const ctx = useContext(CustomerContext)
  if (!ctx) throw new Error('useCustomer must be used inside CustomerProvider')
  return ctx
}
