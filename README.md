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
고객 RAW (SQLite)
    ↓
RFM-PC Feature Mart 배치 (llm_input_json: 수치 + behavior_signals + explainable_signals)
    ↓
Router Agent (복수 카테고리 분류) → Specialist Agent (카테고리별 상품·수락확률)
    ↓
Policy/RAG Agent (상품별 문서) → KPI Mapper (뱃지·사후관리)
    ↓
Sales Card Assembler → Consulting Package Agent (Draft → Critic → Rewrite)
    ↓
FastAPI JSON → 프론트 대시보드
```

**창구 맥락(live_context)** 은 이 저장소의 iM BRIDGE 경로에서는 사용하지 않으며, 판단 입력은 Feature Mart(JSON)와 우수 직원 사례 JSON만 사용합니다.

### 핵심 설계 원칙

- **Human-in-the-loop**: AI는 분석·제안, 최종 판단은 반드시 직원이 수행
- **KPI 분리 원칙**: Router·Specialist는 KPI·지점실적을 **판단 근거로 사용하지 않음**. KPI는 `kpi_mapper` 단계에서 뱃지·사후관리(`post_management`)로만 부착
- **우수 직원 노하우 분리**: 분류 감각은 `data/prompt_examples/router_expert_cases.json` → Router, 성공·실패 패턴은 `specialist_outcome_patterns.json` → Specialist (`success_pattern_matches` / `failure_pattern_matches`)
- **안전성 우선**: 과장 표현·무리한 권유 문구 완화, Consulting 단계에서 Reflection·룰 검증

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
│  └─────────────┘  │  → KPI → Assembler → Consulting      │  │
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
| **P (Product Gap)** | 보유 여부·상품 공백 플래그(`has_*`) 등 |
| **C (Contact Signal)** | 최근 상담 주제, 문의 플래그, **recommendation_tone**, 영업 피로도 등 |

Feature Mart JSON 최상위(또는 `rfm_pc` 내부)에는 AI 설명용 **`behavior_signals`**(카테고리별 자연어 신호)·**`explainable_signals`**(요약 리스트)가 포함될 수 있으며, 에이전트 입력 시 `customer_payload.feature_mart`로 합쳐집니다.

> KPI·지점 실적·캠페인 목표는 피처 마트와 Router/Specialist 프롬프트에 **넣지 않습니다**. KPI는 RAG 이후 매퍼에서만 반영합니다.

---

### Stage 2 — Router Agent → Specialist Agent

```
customer_rfmpc_feature_mart.llm_input_json
         ↓
    [Router Agent]  — GPT-4o (+ 우수 직원 분류 사례 Few-shot)
    영업 카테고리 **복수** 선별 → applicable_categories[] (label, confidence, reasons, negative_signals)
    confidence < 0.40 은 excluded_categories로 이동
         ↓
    [Specialist Agent]  — GPT-4o (+ 카테고리별 성공/실패 패턴)
    카테고리마다 후보 상품 중 top 1~2 + 수락 확률 + score_breakdown
    + success_pattern_matches / failure_pattern_matches (우수 직원 패턴 정렬)
```

**Router 라벨 집합 (7개, 한글 고정):** 여신 · 수신 · 카드 · 방카 · 신탁 · 펀드 · 외환

- **Self-check / Self-refine** 룰은 각 에이전트 프롬프트에 내장
- 수락 확률·카테고리 판단은 **고객 행동·Product Gap·상담 신호** 기반; KPI는 사용 금지
- 우수 직원 사례 파일: `agentserver/data/prompt_examples/router_expert_cases.json`, `specialist_outcome_patterns.json` (로더: `services/expert_cases.py`)

---

### Stage 3 — RAG/Policy Agent + KPI Mapper

```
Specialist → top_products_flat (카테고리·확률 순)
    ↓
[Policy/RAG Agent]  — 파일·인덱스 기반 검색 (데모 MVP, 벡터 검색 아님)
공문·이벤트·필요서류·유의사항 요약
    ↓
[KPI Mapper]  — 결정론적 Python (LLM 없음)
상품별 KPI 뱃지 + post_management(사후관리 가이드)
```

- Policy 문서: `agentserver/data/policy_docs/` (`P001`~ 시연용 `P022` 등, `policy_index.json`)
- KPI 매핑: `agentserver/data/kpi/kpi_mapping.json`

---

### Stage 4 — Sales Card Assembler → Consulting Package Agent

```
[Sales Card Assembler]  — GPT-4o
Router + Specialist + Policy + KPI → 상품별 영업 카드 (rank, category, staff_sales_talk 등)

    ↓

[Consulting Package Agent]  — Reflection 루프
Draft 생성 → Critic 평가 → 필요 시 Rewrite → 최종 상담패키지 JSON
```

**Consulting 응답(최상위):** `feature_mart_summary`, `router_result`, `specialist_result`, `policy_support`, `kpi_badges`, `consulting_package`, `reflection`  
프론트는 **피처 요약·분류·카테고리별 확률·문서·KPI·통합 패키지**를 한 번에 받을 수 있습니다.

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
│   ├── pyproject.toml           # Poetry 의존성
│   ├── start_server.ps1         # Windows 서버 시작
│   │
│   ├── data/
│   │   ├── policy_docs/         # 상품별 공문·이벤트·가이드 txt + policy_index.json
│   │   ├── kpi/
│   │   │   └── kpi_mapping.json # KPI 뱃지·사후관리 매핑
│   │   └── prompt_examples/     # 우수 직원 노하우 (Router / Specialist Few-shot)
│   │       ├── router_expert_cases.json
│   │       └── specialist_outcome_patterns.json
│   │
│   └── src/bank_sales_agent/
│       ├── api.py               # FastAPI 앱 (레거시 + iM BRIDGE)
│       ├── main_bridge.py       # BRIDGE CLI 테스트
│       │
│       ├── agents/              # LLM 에이전트
│       │   ├── prompts.py
│       │   ├── router_agent.py
│       │   ├── specialist_agent.py
│       │   ├── policy_agent.py
│       │   ├── assembler_agent.py
│       │   └── consulting_agent.py
│       │
│       ├── services/
│       │   ├── feature_mart.py
│       │   ├── product_catalog.py  # get_candidates_by_category
│       │   ├── expert_cases.py       # 우수 직원 JSON 로더
│       │   ├── policy_rag.py
│       │   └── kpi_mapper.py
│       │
│       ├── config/settings.py
│       └── graph/               # 레거시 LangGraph (/api/analyze)
│
└── frontend/                    # React + Vite (자세한 실행은 frontend/README.md)
    ├── vite.config.ts           # API 프록시 등
    └── src/                     # agentApi.ts, 화면 컴포넌트
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

프로젝트 루트(`iM_Agent_-2/`)에 `.env` 파일 생성 ( `config/settings.py` 가 루트 기준으로 로드):

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

# Router + Specialist (기본)
poetry run python src/bank_sales_agent/main_bridge.py --cust-id DEMO-2

# + RAG/Policy + KPI + Sales Card
poetry run python src/bank_sales_agent/main_bridge.py --cust-id DEMO-2 --full

# + 상담패키지 Reflection
poetry run python src/bank_sales_agent/main_bridge.py --cust-id DEMO-2 --package
```

시연 추천 고객: **`DEMO-2`** (박성호, 개인사업자). 일반 더미: `C001`~`C010`, `DEMO-1`, `DEMO-3`.  
`--cust-id` 생략 시 기본값은 `DEMO-2` 입니다.

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
| `POST` | `/api/bridge/analyze` | Feature Mart → Router → Specialist → `customer_payload` 포함 |
| `POST` | `/api/bridge/sales-card` | + Policy/RAG, KPI, Assembler → `sales_cards` |
| `POST` | `/api/bridge/consulting-package` | + Consulting Reflection → `feature_mart_summary`, `consulting_package` 등 |

요청 본문은 공통으로 **`cust_id`만** 받습니다 (iM BRIDGE 경로).

#### 요청 예시 (`/api/bridge/consulting-package`)

```json
{
  "cust_id": "DEMO-2"
}
```

#### 응답 구조(요약)

- **`feature_mart_summary`**: `headline_metrics`(R/F/M/P/C), `behavior_signals`, `explainable_signals` 등
- **`router_result`**: `applicable_categories[]`, `excluded_categories[]`
- **`specialist_result`**: `category_results[]` (카테고리별 `top_products`), `top_products_flat`
- **`policy_support`**, **`kpi_badges`**: 상품별 RAG 요약·KPI·사후관리
- **`consulting_package`**: 직원용 통합 상담 패키지 (Draft/Critic 결과는 `reflection` 참고)

`specialist_result` 의 각 상품에는 **`success_pattern_matches`**, **`failure_pattern_matches`** 가 포함될 수 있습니다 (우수 직원 패턴 정렬).

---

> **Human-in-the-loop**: 본 시스템의 모든 AI 출력은 창구 직원의 참고 자료입니다.  
> 최종 상품 추천·설명·가입 권유의 판단과 책임은 반드시 직원이 수행합니다.
