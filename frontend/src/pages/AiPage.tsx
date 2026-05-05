import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  BadgeCheck,
  BotMessageSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCustomer } from '@/contexts/CustomerContext'
import { DUMMY_CUSTOMERS, type DummyCustomer, buildAnalysisPrompt } from '@/data/dummyCustomers'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  getUpstageApiKey,
  DEFAULT_MODEL,
  streamChatCompletion,
} from '@/services/upstageApi'
import '@/styles/ai-page.css'

type Stage = 'idle' | 'streaming' | 'done' | 'error'

interface AnalysisResult {
  customerSummary?: string
  financialScore?: number
  financialHealthLabel?: string
  opportunities?: { product: string; reason: string; priority: string; kpiScore: number }[]
  risks?: string[]
  recommendedScript?: string
  nextActions?: string[]
}

function tryParseJson(raw: string): AnalysisResult | null {
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try { return JSON.parse(clean) } catch { return null }
}

const PRIORITY_COLOR: Record<string, string> = {
  높음: '#e33', 중간: '#e87c00', 낮음: '#009e86',
}
const HEALTH_COLOR: Record<string, string> = {
  우수: '#00a86b', 양호: '#00c7a9', 보통: '#f0a500', 주의: '#e87c00', 위험: '#cc3300',
}
const GRADE_BG: Record<string, string> = {
  VIP:  'linear-gradient(135deg,#b8930a,#f5c842)',
  우량: 'linear-gradient(135deg,var(--im-mint),#009e86)',
  일반: 'linear-gradient(135deg,#6b7a8d,#8fa0b5)',
  관리: 'linear-gradient(135deg,#c44,#a22)',
}
const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  '개인':       { bg: 'rgba(0,199,169,0.12)',  color: '#007a64' },
  '개인사업자': { bg: 'rgba(59,130,246,0.12)', color: '#1d4ed8' },
  '법인':       { bg: 'rgba(139,92,246,0.12)', color: '#6d28d9' },
}

export function AiPage() {
  useDocumentTitle('AI 고객 분석 — iM Agent')

  const { activeResidentId, setActiveResidentId } = useCustomer()

  const [selected, setSelected]     = useState<DummyCustomer | null>(null)
  const [apiKey, setApiKey]         = useState(getUpstageApiKey)
  const [modelId, setModelId]       = useState(DEFAULT_MODEL)
  const [showConfig, setShowConfig] = useState(false)

  // Screen0156 연동 — 실명번호가 바뀌면 자동 선택
  useEffect(() => {
    if (!activeResidentId) return
    const match = DUMMY_CUSTOMERS.find(c => c.residentIdFront === activeResidentId)
    if (match) {
      setSelected(match)
      setStage('idle')
      setResult(null)
      setStreamText('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResidentId])

  const [stage, setStage]         = useState<Stage>('idle')
  const [streamText, setStreamText] = useState('')
  const [result, setResult]         = useState<AnalysisResult | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')

  const isRunning = stage === 'streaming'

  const handleAnalyze = async () => {
    if (!selected || isRunning) return
    setActiveResidentId(selected.residentIdFront)
    setStage('streaming')
    setErrorMsg('')
    setResult(null)
    setStreamText('')

    let accumulated = ''

    try {
      await streamChatCompletion(
        [{ role: 'user', content: buildAnalysisPrompt(selected) }],
        modelId,
        apiKey,
        chunk => {
          accumulated += chunk
          setStreamText(accumulated)
        },
      )
      setResult(tryParseJson(accumulated))
      setStage('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStage('error')
    }
  }

  return (
    <section className="ai-page">
      {/* ── 히어로 ── */}
      <div className="ai-hero">
        <div className="ai-hero-icon">
          <BotMessageSquare size={32} />
        </div>
        <div>
          <h1 className="ai-hero-title">AI 고객 분석</h1>
          <p className="ai-hero-sub">
            Solar Pro 3 모델이 고객 데이터를 실시간으로 분석합니다
          </p>
        </div>
      </div>

      <div className="ai-body">
        {/* ── 왼쪽: 고객 선택 + 설정 ── */}
        <div className="ai-left">

          {/* 고객 목록 */}
          <div className="ai-card">
            <div className="ai-card-title">
              <User size={15} />
              고객 선택
            </div>
            <div className="ai-customer-list">
              {DUMMY_CUSTOMERS.map(c => (
                <button
                  key={c.id}
                  className={`ai-customer-card${selected?.id === c.id ? ' ai-customer-card--selected' : ''}`}
                  onClick={() => {
                    setActiveResidentId(c.residentIdFront)
                    setSelected(c)
                    setStage('idle')
                    setResult(null)
                    setStreamText('')
                  }}
                  disabled={isRunning}
                >
                  <div
                    className="ai-customer-grade"
                    style={{ background: GRADE_BG[c.grade] ?? GRADE_BG['일반'] }}
                  >
                    {c.grade}
                  </div>
                  <div className="ai-customer-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="ai-customer-name">{c.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px',
                        borderRadius: 99, letterSpacing: 0.2,
                        background: TYPE_STYLE[c.customerType]?.bg,
                        color: TYPE_STYLE[c.customerType]?.color,
                      }}>{c.customerType}</span>
                    </div>
                    <span className="ai-customer-meta">{c.age}세 · {c.gender} · {c.job}</span>
                    <span className="ai-customer-products">
                      {c.products.slice(0, 3).join(' · ')}
                      {c.products.length > 3 && ` +${c.products.length - 3}`}
                    </span>
                  </div>
                  <div className="ai-customer-score">
                    <span className="ai-score-num">{c.creditScore}</span>
                    <span className="ai-score-label">신용</span>
                  </div>
                  {selected?.id === c.id && <ChevronRight size={16} className="ai-customer-arrow" />}
                </button>
              ))}
            </div>
          </div>

          {/* API 설정 */}
          <div className="ai-card">
            <button className="ai-config-toggle" onClick={() => setShowConfig(v => !v)}>
              <Settings2 size={15} />
              <span>API 설정</span>
              {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="ai-config-body">
                    <label className="ai-field">
                      <span className="ai-field-label">API Key</span>
                      <input className="ai-input" type="password" value={apiKey}
                        onChange={e => setApiKey(e.target.value)} placeholder="up_..." />
                    </label>
                    <label className="ai-field">
                      <span className="ai-field-label">Model</span>
                      <input className="ai-input" type="text" value={modelId}
                        onChange={e => setModelId(e.target.value)} placeholder="solar-pro3" />
                    </label>
                    <p className="ai-config-note">
                      Upstage AI Console에서 발급된 API 키와 모델명을 입력하세요
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 분석 버튼 */}
          <motion.button
            className={`ai-run-btn${isRunning ? ' ai-run-btn--running' : ''}`}
            disabled={!selected || isRunning}
            onClick={handleAnalyze}
            whileTap={{ scale: 0.97 }}
          >
            {isRunning ? (
              <><Loader2 size={18} className="ai-spin" />분석 중...</>
            ) : (
              <><Sparkles size={18} />{selected ? `${selected.name} 고객 분석 시작` : '고객을 선택하세요'}</>
            )}
          </motion.button>

          <AnimatePresence>
            {errorMsg && (
              <motion.div className="ai-error"
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <AlertCircle size={15} />{errorMsg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── 오른쪽 ── */}
        <div className="ai-right">

          {/* 선택 고객 프로필 */}
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div key={selected.id} className="ai-card ai-profile-card"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="ai-profile-header">
                  <div className="ai-profile-grade-badge"
                    style={{ background: GRADE_BG[selected.grade] }}>
                    {selected.grade}
                  </div>
                  <div className="ai-profile-name-block">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span className="ai-profile-name">{selected.name}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 99, letterSpacing: 0.2,
                        background: TYPE_STYLE[selected.customerType]?.bg,
                        color: TYPE_STYLE[selected.customerType]?.color,
                        border: `1px solid ${TYPE_STYLE[selected.customerType]?.color}44`,
                      }}>{selected.customerType}</span>
                    </div>
                    <span className="ai-profile-sub">{selected.age}세 · {selected.gender} · {selected.job}</span>
                  </div>
                </div>
                <div className="ai-profile-grid">
                  {[
                    {
                      label: selected.customerType === '개인' ? '연소득' : '연매출',
                      value: `${selected.annualIncome.toLocaleString()}만원`,
                    },
                    { label: '신용점수', value: `${selected.creditScore}점` },
                    { label: '총자산',   value: `${selected.totalAssets.toLocaleString()}만원` },
                    { label: '총부채',   value: `${selected.totalDebt.toLocaleString()}만원` },
                  ].map(item => (
                    <div key={item.label} className="ai-profile-stat">
                      <span className="ai-stat-label">{item.label}</span>
                      <span className="ai-stat-value">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="ai-profile-tags">
                  {selected.products.map(p => (
                    <span key={p} className="ai-product-tag">{p}</span>
                  ))}
                </div>
                <p className="ai-profile-notes">💬 {selected.notes}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 안내 (아무것도 선택 안 했을 때) */}
          {stage === 'idle' && !selected && (
            <div className="ai-card ai-guide-card">
              <div className="ai-guide-steps">
                {[
                  { Icon: User,       t: '고객 선택',  d: '왼쪽 목록에서 분석할 고객을 선택합니다' },
                  { Icon: Sparkles,   t: 'AI 분석',    d: 'Solar Pro 3가 재무·영업 기회를 실시간 분석합니다' },
                  { Icon: TrendingUp, t: '결과 확인',  d: '영업 기회, 리스크, 추천 멘트를 확인합니다' },
                ].map(({ Icon, t, d }) => (
                  <div key={t} className="ai-guide-step">
                    <div className="ai-guide-icon"><Icon size={16} /></div>
                    <div>
                      <div className="ai-guide-title">{t}</div>
                      <div className="ai-guide-desc">{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 스트리밍 출력 (실시간) ── */}
          <AnimatePresence>
            {(stage === 'streaming' || (stage === 'done' && !result && streamText)) && (
              <motion.div
                className="ai-card ai-stream-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="ai-card-title">
                  {stage === 'streaming'
                    ? <><Loader2 size={14} className="ai-spin" />AI 응답 수신 중...</>
                    : <><BotMessageSquare size={14} />AI 응답 원문</>
                  }
                </div>
                <div className="ai-stream-output">
                  <pre className="ai-stream-pre">{streamText}</pre>
                  {stage === 'streaming' && <span className="ai-cursor">▋</span>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── 구조화된 결과 (스트리밍 완료 후 JSON 파싱 성공 시) ── */}
          <AnimatePresence>
            {stage === 'done' && result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="ai-result-structured">
                  {/* 재무 건강 점수 */}
                  <div className="ai-card ai-health-card">
                    <div className="ai-health-top">
                      <div className="ai-health-score-wrap">
                        <svg width={80} height={80} viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="34" fill="none"
                            stroke="rgba(0,199,169,0.12)" strokeWidth={8} />
                          <motion.circle
                            cx="40" cy="40" r="34" fill="none"
                            stroke="url(#healthGrad)" strokeWidth={8}
                            strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 34}
                            initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                            animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - (result.financialScore ?? 50) / 100) }}
                            transform="rotate(-90 40 40)"
                            transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
                          />
                          <defs>
                            <linearGradient id="healthGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%"   stopColor="#00c7a9" />
                              <stop offset="100%" stopColor="#00f0d0" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="ai-health-score-center">
                          <span className="ai-health-num">{result.financialScore ?? '—'}</span>
                          <span className="ai-health-unit">점</span>
                        </div>
                      </div>
                      <div className="ai-health-info">
                        <span className="ai-health-label"
                          style={{ color: HEALTH_COLOR[result.financialHealthLabel ?? '보통'] }}>
                          {result.financialHealthLabel ?? '—'}
                        </span>
                        <p className="ai-health-summary">{result.customerSummary}</p>
                      </div>
                    </div>
                  </div>

                  {/* 영업 기회 */}
                  {(result.opportunities?.length ?? 0) > 0 && (
                    <div className="ai-card">
                      <div className="ai-card-title ai-card-title--done">
                        <Target size={15} />영업 기회 ({result.opportunities!.length}건)
                      </div>
                      <div className="ai-opp-list">
                        {result.opportunities!.map((opp, i) => (
                          <motion.div key={i} className="ai-opp-item"
                            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.07 }}>
                            <div className="ai-opp-top">
                              <span className="ai-opp-product">{opp.product}</span>
                              <span className="ai-opp-priority" style={{ color: PRIORITY_COLOR[opp.priority] }}>
                                {opp.priority}
                              </span>
                              <span className="ai-opp-kpi">+{opp.kpiScore} KPI</span>
                            </div>
                            <p className="ai-opp-reason">{opp.reason}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 리스크 */}
                  {(result.risks?.length ?? 0) > 0 && (
                    <div className="ai-card">
                      <div className="ai-card-title" style={{ color: '#c44' }}>
                        <AlertCircle size={15} />리스크 요인
                      </div>
                      <ul className="ai-risk-list">
                        {result.risks!.map((r, i) => (
                          <li key={i} className="ai-risk-item">⚠ {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 추천 멘트 */}
                  {result.recommendedScript && (
                    <div className="ai-card ai-script-card">
                      <div className="ai-card-title ai-card-title--done">
                        <BadgeCheck size={15} />추천 상담 멘트
                      </div>
                      <blockquote className="ai-script">{result.recommendedScript}</blockquote>
                    </div>
                  )}

                  {/* 다음 행동 */}
                  {(result.nextActions?.length ?? 0) > 0 && (
                    <div className="ai-card">
                      <div className="ai-card-title ai-card-title--done">
                        <Zap size={15} />다음 행동
                      </div>
                      <ol className="ai-action-list">
                        {result.nextActions!.map((a, i) => (
                          <li key={i} className="ai-action-item">
                            <span className="ai-action-num">{i + 1}</span>{a}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </section>
  )
}
