# iM Agent

은행 창구·영업 시연을 위한 **웹 데모 앱**입니다. 고객 조회, 카드 심사 화면, 우측 **CRM 패널**, **KPI·이벤트 트랙**, **AI 고객 분석**을 한 화면 흐름으로 묶었습니다.

---

## 주요 기능

| 영역 | 설명 |
|------|------|
| **메인 사이트** | 홈, 소개(About), **AI 고객 분석** — 가상 고객 선택 후 Solar 모델로 JSON 분석 |
| **뱅킹 / 전산** | `/banking` — **0156** 고객 조회, **0310** 카드 심사 등 카테고리·화면 템플릿 |
| **CRM (우측 슬라이드)** | 보유 상품, **유형별 추천**(개인·개인사업자·법인), 영업기회, 금리 우대, AI 인사이트·채팅 |
| **KPI 바** | 실적 트랙 전환 — **기본 KPI** / **마스터카드 이벤트** / **청약 예·부금 전환** (데모용 점수·토스트) |
| **고객 연동** | `CustomerContext` — 0156·AI 페이지·CRM이 동일 **실명번호 앞 6자리**로 같은 MOCK 고객을 표시 |

> 본 저장소의 고객·거래·이벤트 데이터는 **데모용 가상 데이터**이며, 실제 금융기관 시스템과 연동되지 않습니다.

---

## 기술 스택

- **React 19** · **TypeScript** · **Vite 8**
- **React Router 7** · **Framer Motion** · **Lucide React**
- **Upstage Solar** — Chat Completions 스트리밍 (`frontend/src/services/upstageApi.ts`)

---

## 빠른 시작

**요구 사항:** Node.js 20+ 권장

```bash
# 의존성 설치
npm run install:frontend

# 개발 서버 (기본 브라우저 자동 오픈)
npm run dev
```

로컬 주소는 보통 **http://localhost:5173** 입니다. (포트 충돌 시 Vite가 다른 포트를 사용할 수 있습니다.)

### 루트 npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | `frontend`에서 Vite 개발 서버 실행 |
| `npm run build` | TypeScript 검사 + 프로덕션 빌드 (`frontend/dist`) |
| `npm run lint` | ESLint (`frontend`) |

`frontend` 폴더에서 직접 `npm run dev` / `npm run build` 를 실행해도 됩니다.

---

## AI / API 설정 (Upstage)

- 개발 시 **CORS 우회**를 위해 Vite 프록시를 사용합니다: `/api/upstage/*` → `https://api.upstage.ai/*`  
  (`frontend/vite.config.ts`)
- **API 키는 저장소에 넣지 않습니다.** `frontend/.env.example` 을 복사해 **`frontend/.env.local`** 을 만든 뒤 아래를 채우세요.  
  (`.env` / `.env.local` 은 `.gitignore` 로 커밋되지 않습니다.)

  ```env
  VITE_UPSTAGE_API_KEY=up_여기에_본인_키
  ```

- 개발 서버를 **재시작**해야 환경 변수가 반영됩니다.
- **AI 고객 분석** 화면에서도 키·모델을 바꿀 수 있습니다(입력값은 새로고침 시 `.env.local` 기준으로 다시 로드).
- 이미 공개 저장소에 키가 올라간 적이 있다면 **Upstage 콘솔에서 해당 키를 폐기·재발급** 하세요.

---

## 프로젝트 구조 (요약)

```
iM_Agent_/
├── README.md                 # 이 파일
├── package.json              # 루트 스크립트 (frontend 위임)
└── frontend/
    ├── src/
    │   ├── App.tsx           # 라우팅
    │   ├── components/       # Header, KPI, 사이드바(CRM 등)
    │   ├── contexts/         # Customer, KPI
    │   ├── data/             # MOCK 고객, KPI·이벤트 데이터
    │   ├── layouts/          # AppShell, BankingLayout
    │   ├── pages/            # Home, About, Ai, banking/*
    │   ├── services/         # Upstage API
    │   └── styles/           # 페이지·컴포넌트 CSS
    ├── vite.config.ts
    └── package.json
```

---

## 라이선스

저장소 정책에 따릅니다. 상업적 이용 전 내부 라이선스를 확인하세요.

---

## 기여 & 브랜치

기능 개발은 작업 브랜치에서 진행한 뒤 `main`에 반영하는 흐름을 권장합니다.
