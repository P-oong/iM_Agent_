# AgentServer — iM BRIDGE 멀티에이전트 백엔드

iM뱅크 창구 영업지원용 **FastAPI + OpenAI GPT-4o** 서버입니다.  
**iM BRIDGE** 파이프라인(Feature Mart → Router → Specialist → Policy/RAG → KPI → Assembler → Consulting)과, 프론트 호환을 위한 **레거시 LangGraph**(`/api/analyze`)를 같은 앱에서 제공합니다.

전체 배경·아키텍처·DB 초기화는 저장소 루트 [README.md](../README.md)를 참고하세요.

## 사전 준비

1. 저장소 루트에 `.env` 를 두고 `OPENAI_API_KEY` 를 설정합니다 (`config/settings.py` 가 루트 `.env` 를 로드).
2. 루트에서 `db/seed.py` → `db/seed_raw.py` → `db/build_feature_mart.py` 를 실행해 `db/im_bank.db` 와 당일 Feature Mart 를 만듭니다.

## 빠른 시작

```powershell
cd agentserver
poetry install
.\start_server.ps1
# 또는
poetry run uvicorn bank_sales_agent.api:app --host 0.0.0.0 --port 8000 --reload
```

- API 문서: http://localhost:8000/docs

## 데이터 디렉터리 (`agentserver/data/`)

| 경로 | 용도 |
|------|------|
| `policy_docs/` | 상품별 공문·이벤트·가이드 텍스트, `policy_index.json` |
| `kpi/kpi_mapping.json` | 상품별 KPI 뱃지·`post_management` 매핑 |
| `prompt_examples/router_expert_cases.json` | Router용 우수 직원 **분류** 사례 |
| `prompt_examples/specialist_outcome_patterns.json` | Specialist용 **성공/실패** 패턴 |

로더 구현: `src/bank_sales_agent/services/expert_cases.py`

## CLI 테스트 (`main_bridge.py`)

```powershell
cd agentserver

# Router + Specialist (기본 고객 DEMO-2)
poetry run python src/bank_sales_agent/main_bridge.py
poetry run python src/bank_sales_agent/main_bridge.py --cust-id C001

# + RAG/Policy + KPI + Sales Card
poetry run python src/bank_sales_agent/main_bridge.py --cust-id DEMO-2 --full

# + 상담패키지(Reflection)
poetry run python src/bank_sales_agent/main_bridge.py --cust-id DEMO-2 --package
```

## HTTP 엔드포인트 요약

| 경로 | 설명 |
|------|------|
| `POST /api/bridge/analyze` | `cust_id` → Feature Mart → Router → Specialist → `customer_payload` 포함 |
| `POST /api/bridge/sales-card` | + Policy, KPI, Assembler → `sales_cards` |
| `POST /api/bridge/sales-card/stream` | Sales Card 생성 과정 SSE 스트림(실험/시연용) |
| `POST /api/bridge/consulting-package` | + Consulting Reflection → `feature_mart_summary`, `consulting_package`, `reflection` |
| `POST /api/analyze` | 레거시 LangGraph |
| `POST /analyze-opportunities` | GPT 직접 영업기회 분석 |
| `GET /health` | 헬스체크 |

### BRIDGE 공통 요청 본문

```json
{ "cust_id": "DEMO-2" }
```

iM BRIDGE 경로는 **실시간 창구 맥락(live_context)을 받지 않습니다.** 판단 입력은 DB Feature Mart 와 위 프롬프트 예시 JSON 입니다.

### Specialist 출력 참고 필드

- `category_results[]` / `top_products_flat`
- 각 상품: `success_pattern_matches`, `failure_pattern_matches` (우수 직원 패턴 정렬)

## 패키지 레이아웃 (요약)

```
src/bank_sales_agent/
├── api.py              # FastAPI 앱
├── main_bridge.py      # CLI
├── agents/             # Router, Specialist, Policy, Assembler, Consulting
├── services/           # feature_mart, product_catalog, expert_cases, policy_rag, kpi_mapper
├── config/settings.py
└── graph/              # 레거시 LangGraph
```

## 개발 도구

```powershell
poetry run ruff check src
poetry run pytest
```

`pyproject.toml` 에 Ruff / Black / mypy 설정이 있습니다.
