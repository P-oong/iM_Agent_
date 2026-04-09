/** @see KpiContext — 동일 의미의 선택 가능 트랙 */
export type KpiTrackSelectable = 'default' | 'mastercard' | 'cheongyak'

export interface KpiTrackOption {
  id: KpiTrackSelectable | 'coming_soon'
  /** 목록·접근성용 전체 이름 */
  label: string
  /** 바 안 버튼용 짧은 이름 (잘림 방지) */
  compactLabel?: string
  disabled?: boolean
}

/** 실적 트랙 선택 (추가 이벤트는 disabled로 노출만) */
export const KPI_TRACK_LIST: KpiTrackOption[] = [
  { id: 'default', label: '기본 KPI', compactLabel: '기본 KPI' },
  { id: 'mastercard', label: '마스터카드 이벤트', compactLabel: '마스터카드' },
  { id: 'cheongyak', label: '청약 예·부금 전환', compactLabel: '청약 전환' },
  { id: 'coming_soon', label: '기타 이벤트', disabled: true },
]

export function isSelectableTrack(id: KpiTrackOption['id']): id is KpiTrackSelectable {
  return id === 'default' || id === 'mastercard' || id === 'cheongyak'
}
