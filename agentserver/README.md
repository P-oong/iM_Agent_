# AgentServer — iM BRIDGE 멀티에이전트 백엔드

iM뱅크 창구 영업지원 AI 에이전트 서버. FastAPI + LangGraph + OpenAI GPT-4o 기반.

## 빠른 시작

```powershell
# 의존성 설치 (최초 1회)
poetry install

# 서버 실행
.\start_server.ps1
# 또는
poetry run uvicorn bank_sales_agent.api:app --host 0.0.0.0 --port 8000 --reload
```

API 문서: http://localhost:8000/docs

## CLI 테스트

```powershell
# Router + Specialist
poetry run python src/bank_sales_agent/main_bridge.py --cust-id C003

# 전체 파이프라인 + 영업 카드
poetry run python src/bank_sales_agent/main_bridge.py --cust-id C003 --full

# 전체 파이프라인 + 상담패키지 Reflection 보고서
poetry run python src/bank_sales_agent/main_bridge.py --cust-id C003 --package
```

## 엔드포인트 요약

| 경로 | 설명 |
|---|---|
| `POST /api/bridge/analyze` | Router + Specialist |
| `POST /api/bridge/sales-card` | + RAG/Policy + KPI + Assembler |
| `POST /api/bridge/consulting-package` | + 상담패키지 Reflection |
| `POST /api/analyze` | 레거시 LangGraph (프론트 호환) |
| `POST /analyze-opportunities` | GPT-4o 영업기회 분석 |

자세한 내용은 [프로젝트 루트 README](../README.md)를 참조하세요.
