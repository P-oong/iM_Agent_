-- ============================================================
-- iM Bank Demo DB Schema
-- 에이전트서버 + 프론트엔드 공통 사용 SQLite 데이터베이스
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- 고객 기본 정보
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    customer_id         TEXT PRIMARY KEY,
    resident_id_front   TEXT,                          -- 주민번호 앞 6자리 (프론트 조회 키)
    name                TEXT NOT NULL,
    age                 INTEGER,
    gender              TEXT CHECK(gender IN ('남','여','')),
    job                 TEXT,
    customer_type       TEXT NOT NULL CHECK(customer_type IN ('개인','개인사업자','법인')),
    annual_income       REAL NOT NULL DEFAULT 0,       -- 만원 (법인은 연매출)
    credit_score        INTEGER NOT NULL DEFAULT 700,  -- 300~1000
    total_assets        REAL NOT NULL DEFAULT 0,       -- 만원
    total_debt          REAL NOT NULL DEFAULT 0,       -- 만원
    grade               TEXT NOT NULL CHECK(grade IN ('VIP','우량','일반','관리')),
    notes               TEXT,
    -- 에이전트 분류 필드
    segment             TEXT,    -- young_professional / family_builder / retiree / affluent / corporate
    life_stage          TEXT,    -- starter / growth / retirement / expansion
    primary_goal        TEXT,    -- build_savings / reduce_loan_cost / protect_assets / grow_investments
    preferred_channel   TEXT,    -- mobile / branch / hybrid
    digital_engagement  TEXT,    -- high / medium / low
    monthly_income      REAL,    -- 만원 (annual_income / 12 파생)
    created_at          TEXT DEFAULT (datetime('now','localtime'))
);

-- ------------------------------------------------------------
-- 고객 보유 계좌
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    account_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     TEXT NOT NULL REFERENCES customers(customer_id),
    account_number  TEXT UNIQUE NOT NULL,
    product         TEXT NOT NULL,
    balance         REAL NOT NULL DEFAULT 0,   -- 원
    status          TEXT NOT NULL CHECK(status IN ('정상','연체','해지')) DEFAULT '정상'
);

-- ------------------------------------------------------------
-- 최근 거래 내역
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    tx_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id),
    tx_date     TEXT NOT NULL,   -- YYYY-MM-DD
    description TEXT NOT NULL,
    amount      REAL NOT NULL    -- 양수=입금, 음수=출금 (원)
);

-- ------------------------------------------------------------
-- 은행 상품 마스터
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    product_id          TEXT PRIMARY KEY,
    product_name        TEXT NOT NULL,          -- 한국어 상품명
    product_name_en     TEXT,
    category            TEXT NOT NULL,          -- 수신/여신/카드/투자/보험/퇴직연금/외환/기업
    sub_category        TEXT,
    target_types        TEXT,                   -- JSON 배열: ["개인","개인사업자"]
    min_age             INTEGER DEFAULT 18,
    max_age             INTEGER DEFAULT 99,
    target_segments     TEXT,                   -- JSON 배열
    priority_tags       TEXT,                   -- JSON 배열
    base_fit_score      REAL DEFAULT 50,
    customer_value      TEXT,                   -- 고객 혜택 한 줄 설명
    description         TEXT,
    requires_review     INTEGER DEFAULT 0       -- 1=인간검토 필요
);

-- ------------------------------------------------------------
-- 상품별 KPI 지표
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kpi_metrics (
    product_id          TEXT PRIMARY KEY REFERENCES products(product_id),
    kpi_score           REAL NOT NULL DEFAULT 50,   -- 종합 KPI 점수 (0~100)
    revenue_score       REAL DEFAULT 50,             -- 수익성
    strategic_score     REAL DEFAULT 50,             -- 전략적 중요도
    retention_score     REAL DEFAULT 50              -- 고객 유지
);

-- ------------------------------------------------------------
-- 상품 지식 문서 (캠페인·이벤트·공지)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_documents (
    doc_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title               TEXT NOT NULL,
    summary             TEXT,
    channel_hint        TEXT,   -- mobile / branch / all
    tags                TEXT,   -- JSON 배열
    related_product_ids TEXT,   -- JSON 배열: ["P001","P003"]
    valid_from          TEXT,
    valid_until         TEXT
);

-- ------------------------------------------------------------
-- 영업 기회 기록 (에이전트 분석 결과 저장)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_opportunities (
    opp_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     TEXT NOT NULL REFERENCES customers(customer_id),
    thread_id       TEXT,
    product_id      TEXT REFERENCES products(product_id),
    product_name    TEXT,
    total_score     REAL,
    kpi_score       REAL,
    customer_fit    REAL,
    priority        TEXT,    -- 높음 / 중간 / 낮음
    reason          TEXT,
    script          TEXT,    -- 추천 멘트
    status          TEXT DEFAULT 'pending',  -- pending / approved / hold
    created_at      TEXT DEFAULT (datetime('now','localtime'))
);
