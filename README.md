# iM BRIDGE — iM뱅크 창구 영업지원 멀티에이전트 시스템

> **"데이터는 충분히 쌓여 있다. 문제는 그것을 현장 판단과 실행으로 연결하는 체계가 없다는 것이다."**

---

## 목차

1. [문제의식 및 배경](#1-문제의식-및-배경)
2. [솔루션 개요](#2-솔루션-개요)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [멀티에이전트 파이프라인](#4-멀티에이전트-파이프라인)
5. [주요 기능](#5-주요-기능)
6. [프로젝트 구조](#6-프로젝트-구조)
7. [기술 스택](#7-기술-스택)
8. [실행 환경 및 방법](#8-실행-환경-및-방법)
9. [API 엔드포인트](#9-api-엔드포인트)

---

## 1. 문제의식 및 배경

### 은행 현장의 구조적 문제

iM뱅크(대구은행) 창구에는 고객 거래이력, 보유상품, 상담이력, 만기정보, KPI 기준표 등 **방대한 Structured Data가 이미 축적**되어 있다.  
그러나 이 데이터는 여전히 **조회·기록·사후관리 수준**에 머무르며, 실제 영업 판단으로 이어지지 못하는 경우가 많다.

| 문제 | 내용 |
|---|---|
| **업무 영역 분절** | 수신 담당이 여신·카드 기회를, 여신 담당이 수신·외환 기회를 놓치는 구조 |
| **직원 간 역량 편차** | 상품 숙련도·추천 역량이 개인별로 달라 상담 품질이 불균일 |
| **KPI 체계 복잡성** | 상·하반기마다 바뀌는 상품별 KPI 점수를 직원이 모두 기억·활용하기 어려움 |
| **실시간 공문 반영 한계** | 우대 이벤트·신규 상품·한시적 조건을 상담 시점에 즉시 반영하기 어려움 |
| **Rule-based 시스템 한계** | 기존 CRM 영업기회 탐지는 정적 규칙 기반으로 고객 복합 맥락을 반영 못함 |

---

## 2. 솔루션 개요

**iM BRIDGE**는 iM뱅크에 축적된 고객·상품·KPI·규정 데이터를 AI 멀티에이전트로 분석하여,  
창구 직원이 **10초 안에 핵심을 파악하고 30초 안에 고객에게 말할 수 있는 형태**로 압축하는 영업지원 시스템이다.

```
고객 데이터 (DB)
    ↓
RFM-PC 고객 피처 마트 생성
    ↓
실시간 창구 맥락 결합 (내점 사유, 담당자 메모)
    ↓
Router Agent → Specialist Agent → Policy/RAG Agent → KPI Mapper
    ↓
Consulting Package Agent (Reflection 품질 개선)
    ↓
창구직원용 1페이지 상담 카드
```

### 핵심 설계 원칙

- **Human-in-the-loop**: AI는 분석·제안, 최종 판단은 반드시 직원이 수행
- **KPI 분리 원칙**: 상품 수락 확률은 순수 고객 데이터 기반으로 산출, KPI는 별도 뱃지로만 표시
- **안전성 우선**: 과장 표현·무리한 권유 문구 자동 필터링, 금지 표현 룰 기반 검증

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)              │
│  창구직원 대시보드 · 고객 카드 · 영업기회 · 상담패키지 뷰   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP  /api/agent/*  (Vite Proxy)
┌──────────────────────▼──────────────────────────────────────┐
│                  AgentServer (FastAPI + Python)              │
│                                                             │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │  Legacy     │  │       iM BRIDGE 멀티에이전트          │  │
│  │  LangGraph  │  │                                      │  │
│  │  /api/analyze│  │  Router → Specialist → Policy/RAG   │  │
│  └─────────────┘  │  → KPI Mapper → Consulting Package  │  │
│                   └──────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQLite
┌──────────────────────▼──────────────────────────────────────┐
│                    DB (SQLite: im_bank.db)                   │
│  raw_customer · raw_transactions · raw_product_holdings      │
│  raw_crm_contacts · raw_digital_logs · raw_card_transactions │
│  customer_rfmpc_feature_mart · products · branches           │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 멀티에이전트 파이프라인

### Stage 1 — RFM-PC 고객 피처 마트 생성

매일 새벽 배치로 고객 원천 데이터를 집계하여 **고객 1명당 1행**의 LLM 입력용 요약 JSON 생성.

| 피처군 | 설명 |
|---|---|
| **R (Recency)** | 최근 영업점 방문·앱 로그인·거액 입출금 경과일, 만기까지 남은 일수 |
| **F (Frequency)** | 최근 30/90일 거래 횟수, 앱 로그인 횟수, 상담 횟수 |
| **M (Monetary)** | 평균 잔액, 카드 지출액, 대출 잔액, 만기 예적금 금액 |
| **P (Product Gap)** | 미보유 상품 목록 (`missing_product_labels`) — LLM이 가장 잘 읽는 핵심 신호 |
| **C (Contact Signal)** | 최근 상담 주제, 거절 이력, 민원 여부, 영업 피로도 점수 |

```
영업 피로도 점수 = min(1.0,
    캠페인거절횟수×0.15 + 카드거절여부×0.25 + 민원여부×0.35 + 최근접촉횟수×0.05
)
```

> ⚠️ **KPI·지점 실적·캠페인 목표는 피처 마트에 절대 포함하지 않는다.** KPI는 Stage 3에서 뱃지로만 붙인다.

---

### Stage 2 — Router Agent → Specialist Agent

```
customer_rfmpc_feature_mart.llm_input_json
    + 실시간 창구 맥락 (내점사유, 담당자 메모)
         ↓
    [Router Agent]  — GPT-4o
    영업 카테고리 분류 (예금/대출/카드/외환/투자/사업자...)
         ↓
    [Specialist Agent]  — GPT-4o
    상품 Top 1~2 선정 + 수락 확률 (0.0~1.0) + 추천 근거
```

- **Self-check / Self-refine** 내장: 출력 직후 자체 검증 후 기준 미달 시 재생성
- 확률은 **고객 행동 신호 기반**으로만 산출, KPI 반영 금지

---

### Stage 3 — RAG/Policy Agent + KPI Mapper

```
추천 상품 Top 1~2
    ↓
[Policy/RAG Agent]  — 파일 기반 검색 (MVP)
공문·이벤트·필요서류·자격조건·유의사항 요약
    ↓
[KPI Mapper]  — 결정론적 Python 함수 (LLM 없음)
상품별 KPI 뱃지 매핑 (점수·우선순위·표시색)
```

- Policy 문서: `agentserver/data/policy_docs/` (P001~P015 상품별 .txt)
- KPI 매핑: `agentserver/data/kpi/kpi_mapping.json`

---

### Stage 4 — Sales Card Assembler → Consulting Package Agent

```
[Sales Card Assembler]  — GPT-4o
Router + Specialist + Policy + KPI → 상품별 영업 카드 생성

    ↓

[Consulting Package Agent]  — Reflection 루프
Draft 생성
    ↓
룰 기반 검증 (금지표현·글자수·next_action 유무)
    ↓
Critic LLM 평가 (간결성·핵심표현력·정보성·실행성·안전성)
    ↓
기준 미달 시 Rewrite → 최종 상담패키지 JSON 출력
```

**품질 평가 지표:**

| 지표 | 설명 |
|---|---|
| `conciseness` | 직원이 10초 안에 이해할 수 있는가 |
| `clarity` | 왜 이 상품인지 한 문장으로 납득되는가 |
| `informativeness` | 근거·서류·유의사항이 충분한가 |
| `actionability` | 다음 행동이 명확한가 |
| `compliance_safety` | KPI 오용·과장·금지표현이 없는가 |

**금지 표현 자동 차단:**
```
"이번 달 KPI라서 추천드립니다"
"무조건 이 상품이 유리합니다"
"반드시 가입하셔야 합니다"
```

---

## 5. 주요 기능

### 창구직원용 상담패키지 출력 예시

```
┌──────────────────────────────────────┐
│ 고객 한 줄 요약                        │
│ 사업자성 입금이 꾸준한 개인사업자 고객    │
├──────────────────────────────────────┤
│ 추천 1. 가맹점 결제계좌                 │
│ 수락 가능성: 84%  ● HIGH              │
│ KPI: 이번 달 중점 KPI / 8점           │
├──────────────────────────────────────┤
│ 왜 추천하나요?                         │
│ - 사업자성 입금 14회                   │
│ - 가맹점 결제계좌 미보유               │
│ - 최근 정산 문의 이력                  │
├──────────────────────────────────────┤
│ 고객에게 이렇게 말해보세요              │
│ "사업자 입금이 꾸준히 발생하고 있어서   │
│  정산 계좌를 따로 관리하시면 편해질     │
│  수 있습니다."                         │
├──────────────────────────────────────┤
│ 필요서류                               │
│ 사업자등록증 / 대표자 신분증            │
├──────────────────────────────────────┤
│ 다음 행동                              │
│ "현재 정산 계좌는 어느 은행 쓰세요?"    │
└──────────────────────────────────────┘
```

---

## 6. 프로젝트 구조

```
iM_Agent_-2/
│
├── .env                         # OPENAI_API_KEY (Git 미포함)
│
├── db/                          # 공유 SQLite 데이터베이스
│   ├── schema.sql               # 전체 테이블 스키마 정의
│   ├── seed.py                  # 마스터 데이터 초기 적재
│   ├── seed_raw.py              # RAW 더미 데이터 생성 (180일치)
│   ├── build_feature_mart.py    # RFM-PC 피처 마트 배치 빌드
│   ├── im_bank.db               # SQLite DB 파일
│   └── README.md
│
├── agentserver/                 # FastAPI + 멀티에이전트 서버
│   ├── pyproject.toml           # Poetry 의존성 관리
│   ├── start_server.ps1         # 서버 시작 스크립트 (Windows)
│   │
│   ├── data/
│   │   ├── policy_docs/         # 상품별 공문·이벤트 txt (P001~P015)
│   │   │   └── policy_index.json
│   │   └── kpi/
│   │       └── kpi_mapping.json # KPI 뱃지 매핑 테이블
│   │
│   └── src/bank_sales_agent/
│       ├── api.py               # FastAPI 앱 (모든 엔드포인트)
│       ├── main_bridge.py       # CLI 테스트 스크립트
│       │
│       ├── agents/              # LLM 에이전트
│       │   ├── prompts.py       # 모든 에이전트 프롬프트 정의
│       │   ├── router_agent.py  # 영업 카테고리 분류
│       │   ├── specialist_agent.py  # 상품 확률 산출
│       │   ├── policy_agent.py  # 공문·규정 요약
│       │   ├── assembler_agent.py   # 영업 카드 조립
│       │   └── consulting_agent.py  # 상담패키지 + Reflection
│       │
│       ├── services/            # 데이터 서비스
│       │   ├── feature_mart.py  # RFM-PC 조회·페이로드 빌드
│       │   ├── product_catalog.py   # 후보 상품 조회
│       │   ├── policy_rag.py    # 파일 기반 문서 검색
│       │   └── kpi_mapper.py    # 결정론적 KPI 뱃지 매핑
│       │
│       ├── config/
│       │   └── settings.py      # 환경변수·경로 설정
│       │
│       └── graph/               # 레거시 LangGraph (호환 유지)
│           └── build_graph.py
│
└── frontend/                    # React + Vite 창구 대시보드
    ├── vite.config.ts           # Vite 프록시 설정
    └── src/
        ├── services/
        │   ├── agentApi.ts      # /api/analyze 호출
        │   └── openaiApi.ts     # /analyze-opportunities 호출
        └── data/                # 더미 고객·상품 데이터
```

---

## 7. 기술 스택

| 영역 | 기술 |
|---|---|
| **에이전트 프레임워크** | LangGraph ≥ 0.2.0 |
| **LLM** | OpenAI GPT-4o |
| **API 서버** | FastAPI + Uvicorn |
| **데이터 검증** | Pydantic v2 |
| **데이터베이스** | SQLite (im_bank.db) |
| **의존성 관리** | Poetry (Python ≥ 3.10) |
| **프론트엔드** | React + TypeScript + Vite |
| **개발 도구** | Ruff, Black, mypy, pytest |

---

## 8. 실행 환경 및 방법

### 사전 요구사항

- Python 3.10 이상
- Poetry 설치 ([설치 가이드](https://python-poetry.org/docs/#installation))
- Node.js 18 이상 (프론트엔드)

### 1단계 — 환경변수 설정

프로젝트 루트(`iM_Agent_-2/`)에 `.env` 파일 생성:

```env
OPENAI_API_KEY=sk-proj-...
```

### 2단계 — DB 초기화 (최초 1회)

```powershell
# 프로젝트 루트에서 실행
python db/seed.py           # 마스터 데이터 적재
python db/seed_raw.py       # RAW 더미 데이터 생성 (180일치)
python db/build_feature_mart.py  # RFM-PC 피처 마트 빌드
```

### 3단계 — 에이전트 서버 실행

```powershell
cd agentserver

# 의존성 설치 (최초 1회)
poetry install

# 서버 시작 (방법 1: 스크립트)
.\start_server.ps1

# 서버 시작 (방법 2: 직접 실행)
poetry run uvicorn bank_sales_agent.api:app --host 0.0.0.0 --port 8000 --reload
```

서버 기동 후 API 문서 확인: http://localhost:8000/docs

### 4단계 — 에이전트 CLI 테스트

```powershell
cd agentserver

# Router + Specialist만 (빠름, ~15초)
poetry run python src/bank_sales_agent/main_bridge.py --cust-id C003

# + RAG/Policy + KPI + Sales Card
poetry run python src/bank_sales_agent/main_bridge.py --cust-id C003 --full

# 전체 파이프라인 + 상담패키지 Reflection 보고서
poetry run python src/bank_sales_agent/main_bridge.py --cust-id C003 --package
```

사용 가능한 고객 ID: `C001`~`C010`, `DEMO-1`~`DEMO-3` (기본값: `C001`)

### 5단계 — 프론트엔드 실행

```powershell
cd frontend
npm install    # 최초 1회
npm run dev    # http://localhost:5173
```

---

## 9. API 엔드포인트

### 레거시 엔드포인트 (프론트엔드 연결 중)

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/health` | 서버 헬스체크 |
| `POST` | `/api/analyze` | LangGraph 기반 고객 분석 |
| `POST` | `/analyze-opportunities` | GPT-4o 영업기회 분석 |

### iM BRIDGE 신규 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/bridge/analyze` | Router + Specialist (카테고리 분류 + 상품 확률) |
| `POST` | `/api/bridge/sales-card` | 전체 파이프라인 → 영업 카드 |
| `POST` | `/api/bridge/consulting-package` | 전체 파이프라인 → 상담패키지 + Reflection |

#### 요청 예시 (`/api/bridge/consulting-package`)

```json
{
  "cust_id": "C003",
  "live_context": {
    "visit_reason_code": "LOAN_INQUIRY",
    "counter_task": "대출 상담",
    "staff_note": "사업자 통장 관련 추가 문의"
  }
}
```

#### 응답 구조

```json
{
  "cust_id": "C003",
  "router_result": { "primary_label": "대출상담", ... },
  "specialist_result": { "top_products": [...], ... },
  "consulting_package": {
    "customer_brief": "...",
    "recommended_strategy": "...",
    "top_cards": [
      {
        "rank": 1,
        "product_name": "...",
        "acceptance_probability": 0.84,
        "probability_label": "수락 가능성 높음",
        "main_reason": "...",
        "staff_talk": "...",
        "next_action": "...",
        "kpi_badge": { "badge_text": "...", "kpi_score": 8 },
        "required_documents": ["..."],
        "caution_points": ["..."]
      }
    ],
    "do_not_say": ["이번 달 KPI라서 추천드립니다.", "..."],
    "quality_score": {
      "conciseness": 0.91,
      "clarity": 0.88,
      "informativeness": 0.86,
      "actionability": 0.90,
      "compliance_safety": 0.94
    }
  },
  "reflection": { "pass": true, "rewritten": false, ... }
}
```

---

> **Human-in-the-loop**: 본 시스템의 모든 AI 출력은 창구 직원의 참고 자료입니다.  
> 최종 상품 추천·설명·가입 권유의 판단과 책임은 반드시 직원이 수행합니다.
