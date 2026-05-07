import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  BadgeCheck,
  BotMessageSquare,
  ChevronRight,
  Lightbulb,
  Loader2,
  Monitor,
  RefreshCw,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { type AiAnalysisResult, type AiOpportunity } from '@/services/openaiApi'

export type AiPhase = 'idle' | 'loading' | 'done' | 'error'

export interface AiAnalysisPanelProps {
  customerName: string
  customerType: string
  phase: AiPhase
  result: AiAnalysisResult | null
  errorMsg: string
  onRun: () => void
}

const RANK_COLOR = (r: number) =>
  r === 1 ? '#00a86b' : r === 2 ? '#0ea5e9' : '#f59e0b'

// ── 상세 팝업 (portal) ──────────────────────────────────
function OppDetailModal({
  opp,
  customerName,
  onClose,
}: {
  opp: AiOpportunity
  customerName: string
  onClose: () => void
}) {
  const color = RANK_COLOR(opp.rank)

  return createPortal(
    <div
      data-ai-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
    >
      {/* 배경 */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />

      {/* 모달 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 20 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        style={{
          position: 'relative', zIndex: 1,
          width: 480, maxWidth: '92vw', maxHeight: '85vh',
          background: '#fff', borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          padding: '16px 20px',
          background: `linear-gradient(135deg,${color}15,${color}08)`,
          borderBottom: `2px solid ${color}30`,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{
            flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
            background: color, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13,
          }}>
            {opp.rank}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color, fontWeight: 700, marginBottom: 3, letterSpacing: '0.06em' }}>
              TOP {opp.rank} 추천 영업기회 · {customerName}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2332', lineHeight: 1.4 }}>
              {opp.title}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0, background: 'none', border: 'none',
              cursor: 'pointer', color: '#888', padding: 4, borderRadius: 6, lineHeight: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* 분석 근거 */}
          <section style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, color: '#007a64', marginBottom: 10,
            }}>
              <Target size={13} />AI 분석 근거
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {opp.analysisPoints.map((pt, i) => (
                <li key={i} style={{
                  display: 'flex', gap: 10, padding: '8px 12px',
                  borderRadius: 8, background: '#f8fffe', border: '1px solid #d0ede6',
                  fontSize: 13, color: '#334155', lineHeight: 1.55,
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, marginTop: 1,
                  }}>{i + 1}</span>
                  {pt}
                </li>
              ))}
            </ul>
          </section>

          {/* 추천 상담 멘트 */}
          <section style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, color: '#007a64', marginBottom: 10,
            }}>
              <BadgeCheck size={13} />추천 상담 멘트
            </div>
            <blockquote style={{
              margin: 0, padding: '14px 16px',
              borderLeft: `4px solid ${color}`,
              background: '#f8fffe', borderRadius: '0 10px 10px 0',
              fontSize: 13, color: '#334155', lineHeight: 1.7, fontStyle: 'normal',
            }}>
              {opp.script}
            </blockquote>
          </section>

          {/* 혜택 */}
          <section>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                flex: 1, padding: '12px 14px', borderRadius: 10,
                background: '#f0fdf9', border: '1px solid #a7f3d0',
              }}>
                <div style={{ fontSize: 11, color: '#007a64', fontWeight: 700, marginBottom: 6 }}>고객 혜택</div>
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{opp.customerBenefit}</div>
              </div>
              <div style={{
                flex: 1, padding: '12px 14px', borderRadius: 10,
                background: '#f5f3ff', border: '1px solid #c4b5fd',
              }}>
                <div style={{ fontSize: 11, color: '#6d28d9', fontWeight: 700, marginBottom: 6 }}>은행 효과</div>
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{opp.bankBenefit}</div>
              </div>
            </div>
          </section>
        </div>

        {/* 푸터 */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #f0f4f8',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 24px', borderRadius: 8,
              background: color, color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}

// ── 요약 카드 ───────────────────────────────────────────
function OppSummaryCard({ opp, customerName }: { opp: AiOpportunity; customerName: string }) {
  const [showDetail, setShowDetail] = useState(false)
  const color = RANK_COLOR(opp.rank)

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: opp.rank * 0.06 }}
        style={{
          border: `1px solid ${color}30`,
          borderLeft: `3px solid ${color}`,
          borderRadius: 10, marginBottom: 8,
          background: '#fff', overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setShowDetail(true)}
          style={{
            width: '100%', padding: '10px 12px',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left',
          }}
        >
          <span style={{
            flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
            background: color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 900,
          }}>
            {opp.rank}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#1a2332',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {opp.title}
            </div>
            <div style={{
              fontSize: 10, color: '#64748b', marginTop: 3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {opp.analysisPoints[0]}
            </div>
          </div>
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2,
            fontSize: 10, color, fontWeight: 700,
          }}>
            상세<ChevronRight size={12} />
          </div>
        </button>
      </motion.div>

      <AnimatePresence>
        {showDetail && (
          <OppDetailModal opp={opp} customerName={customerName} onClose={() => setShowDetail(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

// ── 메인 패널 (상태는 props로 받음) ──────────────────────
export function AiAnalysisPanel({
  customerName,
  customerType,
  phase,
  result,
  errorMsg,
  onRun,
}: AiAnalysisPanelProps) {

  // 고객 없음
  if (!customerName) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '48px 20px', gap: 10, color: '#aaa',
      }}>
        <Monitor size={28} />
        <p style={{ fontSize: 12, textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
          전산화면 <strong>[0151]</strong>에서<br />
          고객 조회 후 분석할 수 있습니다.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 고객 헤더 */}
      <div style={{
        padding: '10px 12px',
        background: 'linear-gradient(135deg,#f0fdf9,#e8f7f3)',
        borderBottom: '1px solid #d0ede6',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <BotMessageSquare size={14} color="#007a64" />
        <span style={{ fontSize: 13, fontWeight: 800, color: '#007a64' }}>{customerName}</span>
        <span style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 99,
          background: '#007a6420', color: '#007a64', fontWeight: 700,
        }}>{customerType}</span>
        {phase === 'done' && (
          <button
            onClick={onRun}
            title="재분석"
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', color: '#007a64', padding: 2,
            }}
          >
            <RefreshCw size={13} />
          </button>
        )}
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>

        {phase === 'idle' && (
          <div style={{ textAlign: 'center', paddingTop: 24 }}>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
              {customerName} 고객의 거래 데이터를<br />AI가 분석하여 영업기회를 찾아드립니다.
            </p>
            <button
              onClick={onRun}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 20px',
                background: 'linear-gradient(135deg, var(--im-mint), #007c6a)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(0,199,169,0.3)',
              }}
            >
              <Zap size={14} />AI 영업기회 분석
            </button>
          </div>
        )}

        {phase === 'loading' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, paddingTop: 32, color: '#007a64',
          }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
              <Loader2 size={32} />
            </motion.div>
            <p style={{ fontSize: 12, color: '#555', textAlign: 'center', margin: 0 }}>
              AI 분석 중...<br />
              <span style={{ color: '#999', fontSize: 11 }}>거래 패턴 · 영업기회를 분석합니다</span>
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 10, paddingTop: 24, textAlign: 'center',
          }}>
            <AlertCircle size={28} color="#ef4444" />
            <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>분석 실패</p>
            <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{errorMsg}</p>
            <button
              onClick={onRun}
              style={{
                padding: '7px 16px', borderRadius: 8,
                border: '1px solid #e5e7eb', background: '#fff',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              다시 시도
            </button>
          </div>
        )}

        {phase === 'done' && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* 요약 */}
            <div style={{
              padding: '10px 12px', marginBottom: 10,
              background: '#f8fffe', borderRadius: 10, border: '1px solid #d0ede6',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700, color: '#007a64', marginBottom: 6,
              }}>
                <BotMessageSquare size={12} />AI 분석 요약
              </div>
              <p style={{ fontSize: 11, color: '#334155', margin: 0, lineHeight: 1.65 }}>
                {result.summary}
              </p>
            </div>

            {/* 핵심 지표 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              {result.keyMetrics.map(m => (
                <div key={m.label} style={{
                  padding: '7px 8px', borderRadius: 8,
                  background: m.highlight ? '#f0fdf9' : '#f8fafc',
                  border: m.highlight ? '1px solid #a7f3d0' : '1px solid #e8eef4',
                }}>
                  <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>{m.label}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, wordBreak: 'keep-all',
                    color: m.highlight ? '#007a64' : '#1a2332',
                  }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* TOP 3 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700, color: '#1a2332', marginBottom: 8,
              }}>
                <Zap size={12} color="var(--im-mint)" />추천 영업기회
                <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>· 항목을 눌러 상세 보기</span>
              </div>
              {result.opportunities.map(opp => (
                <OppSummaryCard key={opp.rank} opp={opp} customerName={customerName} />
              ))}
            </div>

            {/* 핵심 메시지 */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 12px', borderRadius: 10,
              background: 'linear-gradient(135deg,#f0fdf9,#e8f7f3)',
              border: '1px solid #a7f3d0',
              fontSize: 11, color: '#065f46', lineHeight: 1.6,
            }}>
              <Lightbulb size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{result.coreMessage}</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* 하단 통계 바 */}
      {phase === 'done' && result && (
        <div style={{
          flexShrink: 0, borderTop: '1px solid #e8eef4',
          padding: '8px 12px', display: 'flex', gap: 6, justifyContent: 'center',
        }}>
          {[
            { Icon: Zap,        label: '영업기회', value: `${result.opportunities.length}건`, color: 'var(--im-mint)' },
            { Icon: TrendingUp, label: '핵심지표', value: `${result.keyMetrics.length}개`,   color: '#0ea5e9' },
          ].map(({ Icon, label, value, color }) => (
            <div key={label} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 8px', borderRadius: 8,
              background: '#f8fafc', border: '1px solid #e8eef4',
            }}>
              <Icon size={12} color={color} />
              <div>
                <div style={{ fontSize: 9, color: '#888' }}>{label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2332' }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
