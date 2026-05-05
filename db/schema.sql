-- ============================================================
-- iM Bank Demo DB Schema
-- 에이전트서버 + 프론트엔드 공통 사용 SQLite 데이터베이스
-- ============================================================
-- [테이블 계층]
-- RAW 원천: raw_customer, raw_transactions, raw_product_holdings,
--           raw_card_transactions, raw_crm_contacts, raw_digital_logs
-- 마스터:   customers, accounts, transactions, products, kpi_metrics,
--           product_documents, sales_opportunities
-- Feature Mart: customer_rfmpc_feature_mart
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

-- ============================================================
-- RAW 원천 테이블 (배치로 재생성되는 원천 데이터)
-- ============================================================

-- ------------------------------------------------------------
-- RAW: 고객 기본 정보 (코어뱅킹 원천)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_customer (
    cust_id         TEXT PRIMARY KEY,
    age             INTEGER,
    gender          TEXT,
    customer_type   TEXT,   -- 개인/개인사업자/법인
    job_code        TEXT,
    risk_grade      TEXT,   -- 저위험/중위험/고위험
    main_branch_id  TEXT    -- 관리 영업점 코드
);

-- ------------------------------------------------------------
-- RAW: 계좌/입출금 거래 (코어뱅킹 원천)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_transactions (
    txn_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cust_id             TEXT NOT NULL,
    account_id          TEXT,
    txn_date            TEXT NOT NULL,   -- YYYY-MM-DD
    txn_type            TEXT NOT NULL,   -- DEPOSIT/WITHDRAWAL/TRANSFER_IN/TRANSFER_OUT/AUTO_DEBIT
    amount              REAL NOT NULL,   -- 원 (항상 양수)
    counterparty_bank   TEXT,
    channel             TEXT,            -- BRANCH/MOBILE/ATM/INTERNET
    memo                TEXT
);

-- ------------------------------------------------------------
-- RAW: 상품 보유 현황 (코어뱅킹 원천)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_product_holdings (
    holding_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    cust_id         TEXT NOT NULL,
    product_code    TEXT,
    product_category TEXT NOT NULL,  -- DEMAND_DEPOSIT/SAVINGS/DEPOSIT/CREDIT_CARD/CHECK_CARD/
                                     -- LOAN/BUSINESS_ACCOUNT/MERCHANT_ACCOUNT/ISA/FUND/
                                     -- FX_ACCOUNT/RETIREMENT/INSURANCE/TRADE_FINANCE
    open_date       TEXT,
    maturity_date   TEXT,
    balance         REAL DEFAULT 0,
    status          TEXT DEFAULT 'ACTIVE'  -- ACTIVE/CLOSED/MATURED
);

-- ------------------------------------------------------------
-- RAW: 카드 사용 내역
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_card_transactions (
    card_txn_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    cust_id             TEXT NOT NULL,
    card_id             TEXT,
    approved_date       TEXT NOT NULL,   -- YYYY-MM-DD
    amount              REAL NOT NULL,
    merchant_category   TEXT,            -- 음식점/쇼핑/교통/의료/교육/여행/공과금/기타
    is_own_bank_card    INTEGER DEFAULT 1  -- 1=자사, 0=타행
);

-- ------------------------------------------------------------
-- RAW: CRM 상담 이력
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_crm_contacts (
    contact_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    cust_id         TEXT NOT NULL,
    contact_date    TEXT NOT NULL,   -- YYYY-MM-DD
    channel         TEXT,            -- 영업점/콜센터/모바일
    topic           TEXT,
    memo            TEXT,
    result          TEXT,            -- 관심/거절/가입/보류
    product_category TEXT            -- LOAN/CARD/DEPOSIT/SAVINGS/ISA/FUND/FX/INVESTMENT/COMPLAINT
);

-- ------------------------------------------------------------
-- RAW: 앱/디지털 채널 로그
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_digital_logs (
    log_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cust_id         TEXT NOT NULL,
    event_time      TEXT NOT NULL,   -- YYYY-MM-DD HH:MM:SS
    event_type      TEXT NOT NULL,   -- LOGIN/PRODUCT_PAGE_VIEW/RATE_INQUIRY/CALCULATOR/APPLY_ABANDON
    product_category TEXT,
    page_name       TEXT
);

-- ============================================================
-- RFM-PC Feature Mart (매일 새벽 배치로 재생성)
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_rfmpc_feature_mart (
    base_date   TEXT NOT NULL,   -- YYYY-MM-DD
    cust_id     TEXT NOT NULL,

    -- 고객 기본
    age_band            TEXT,
    customer_type       TEXT,
    risk_grade          TEXT,
    main_branch_id      TEXT,

    -- R: Recency
    days_since_last_branch_visit        INTEGER,
    days_since_last_mobile_login        INTEGER,
    days_since_last_large_deposit       INTEGER,
    days_since_last_large_withdrawal    INTEGER,
    days_until_nearest_deposit_maturity INTEGER,
    days_until_nearest_loan_maturity    INTEGER,
    recent_salary_deposit_flag          INTEGER DEFAULT 0,
    recent_large_outflow_flag           INTEGER DEFAULT 0,

    -- F: Frequency
    transfer_cnt_30d            INTEGER DEFAULT 0,
    deposit_cnt_30d             INTEGER DEFAULT 0,
    withdrawal_cnt_30d          INTEGER DEFAULT 0,
    branch_visit_cnt_90d        INTEGER DEFAULT 0,
    mobile_login_cnt_30d        INTEGER DEFAULT 0,
    product_page_view_cnt_30d   INTEGER DEFAULT 0,
    salary_deposit_months_6m    INTEGER DEFAULT 0,
    merchant_deposit_cnt_30d    INTEGER DEFAULT 0,
    consultation_cnt_90d        INTEGER DEFAULT 0,

    -- M: Monetary
    avg_balance_3m              REAL DEFAULT 0,
    total_deposit_amt_30d       REAL DEFAULT 0,
    total_withdrawal_amt_30d    REAL DEFAULT 0,
    monthly_card_spend_amt      REAL DEFAULT 0,
    loan_balance_amt            REAL DEFAULT 0,
    deposit_maturity_amt_60d    REAL DEFAULT 0,
    idle_cash_amt               REAL DEFAULT 0,
    avg_balance_percentile      REAL DEFAULT 0,

    -- P: Product Gap
    has_salary_account      INTEGER DEFAULT 0,
    has_credit_card         INTEGER DEFAULT 0,
    has_check_card          INTEGER DEFAULT 0,
    has_loan                INTEGER DEFAULT 0,
    has_business_account    INTEGER DEFAULT 0,
    has_merchant_account    INTEGER DEFAULT 0,
    has_isa                 INTEGER DEFAULT 0,
    has_fund                INTEGER DEFAULT 0,
    has_fx_account          INTEGER DEFAULT 0,
    missing_product_labels  TEXT,   -- JSON 배열 문자열

    -- C: Contact Signal
    recent_consult_topic            TEXT,
    recent_consult_topics_90d       TEXT,
    loan_inquiry_flag_90d           INTEGER DEFAULT 0,
    card_inquiry_flag_90d           INTEGER DEFAULT 0,
    deposit_inquiry_flag_90d        INTEGER DEFAULT 0,
    fx_inquiry_flag_90d             INTEGER DEFAULT 0,
    investment_inquiry_flag_90d     INTEGER DEFAULT 0,
    campaign_reject_cnt_180d        INTEGER DEFAULT 0,
    card_reject_flag_90d            INTEGER DEFAULT 0,
    complaint_flag_180d             INTEGER DEFAULT 0,
    sales_fatigue_score             REAL DEFAULT 0,
    preferred_channel               TEXT,

    -- LLM 입력용 JSON 요약
    llm_input_json  TEXT,   -- JSON 문자열

    created_at  TEXT DEFAULT (datetime('now','localtime')),

    PRIMARY KEY (base_date, cust_id)
);
