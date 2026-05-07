"""
RFM-PC Feature Mart 빌더
RAW 테이블에서 고객별 피처를 계산해 customer_rfmpc_feature_mart에 적재합니다.
실행: python db/build_feature_mart.py
"""

import json
import sqlite3
from datetime import date
from pathlib import Path

DB_PATH = Path(__file__).parent / "im_bank.db"
BASE_DATE = date.today().isoformat()

LARGE_AMT = 10_000_000  # 거액 기준 (1천만원)


# ── R: Recency 피처 ────────────────────────────────────────────────────────────

R_SQL = f"""
WITH branch_last AS (
    SELECT cust_id,
           CAST(julianday('now') - julianday(MAX(txn_date)) AS INTEGER) AS days_since_last_branch_visit
    FROM raw_transactions
    WHERE channel = 'BRANCH'
    GROUP BY cust_id
),
mobile_last AS (
    SELECT cust_id,
           CAST(julianday('now') - julianday(MAX(event_time)) AS INTEGER) AS days_since_last_mobile_login
    FROM raw_digital_logs
    WHERE event_type = 'LOGIN'
    GROUP BY cust_id
),
deposit_large AS (
    SELECT cust_id,
           CAST(julianday('now') - julianday(MAX(txn_date)) AS INTEGER) AS days_since_last_large_deposit
    FROM raw_transactions
    WHERE txn_type = 'DEPOSIT' AND amount >= {LARGE_AMT}
    GROUP BY cust_id
),
withdrawal_large AS (
    SELECT cust_id,
           CAST(julianday('now') - julianday(MAX(txn_date)) AS INTEGER) AS days_since_last_large_withdrawal
    FROM raw_transactions
    WHERE txn_type IN ('WITHDRAWAL','TRANSFER_OUT') AND amount >= {LARGE_AMT}
    GROUP BY cust_id
),
deposit_maturity AS (
    SELECT cust_id,
           MIN(CAST(julianday(maturity_date) - julianday('now') AS INTEGER)) AS days_until_nearest_deposit_maturity
    FROM raw_product_holdings
    WHERE product_category IN ('DEPOSIT','SAVINGS')
      AND status = 'ACTIVE'
      AND maturity_date >= date('now')
    GROUP BY cust_id
),
loan_maturity AS (
    SELECT cust_id,
           MIN(CAST(julianday(maturity_date) - julianday('now') AS INTEGER)) AS days_until_nearest_loan_maturity
    FROM raw_product_holdings
    WHERE product_category = 'LOAN'
      AND status = 'ACTIVE'
      AND maturity_date >= date('now')
    GROUP BY cust_id
),
salary_flag AS (
    SELECT cust_id,
           MAX(CASE WHEN (memo LIKE '%급여%' OR memo LIKE '%월급%')
                     AND txn_date >= date('now','-30 days') THEN 1 ELSE 0 END) AS recent_salary_deposit_flag
    FROM raw_transactions
    WHERE txn_type = 'DEPOSIT'
    GROUP BY cust_id
),
outflow_flag AS (
    SELECT cust_id,
           MAX(CASE WHEN amount >= {LARGE_AMT}
                     AND txn_date >= date('now','-30 days') THEN 1 ELSE 0 END) AS recent_large_outflow_flag
    FROM raw_transactions
    WHERE txn_type IN ('WITHDRAWAL','TRANSFER_OUT')
    GROUP BY cust_id
)
SELECT
    c.cust_id,
    COALESCE(b.days_since_last_branch_visit, 999)    AS days_since_last_branch_visit,
    COALESCE(m.days_since_last_mobile_login, 999)    AS days_since_last_mobile_login,
    COALESCE(d.days_since_last_large_deposit, 999)   AS days_since_last_large_deposit,
    COALESCE(w.days_since_last_large_withdrawal, 999) AS days_since_last_large_withdrawal,
    dm.days_until_nearest_deposit_maturity,
    lm.days_until_nearest_loan_maturity,
    COALESCE(s.recent_salary_deposit_flag, 0)        AS recent_salary_deposit_flag,
    COALESCE(o.recent_large_outflow_flag, 0)         AS recent_large_outflow_flag
FROM raw_customer c
LEFT JOIN branch_last   b  ON c.cust_id = b.cust_id
LEFT JOIN mobile_last   m  ON c.cust_id = m.cust_id
LEFT JOIN deposit_large d  ON c.cust_id = d.cust_id
LEFT JOIN withdrawal_large w ON c.cust_id = w.cust_id
LEFT JOIN deposit_maturity dm ON c.cust_id = dm.cust_id
LEFT JOIN loan_maturity   lm ON c.cust_id = lm.cust_id
LEFT JOIN salary_flag     s  ON c.cust_id = s.cust_id
LEFT JOIN outflow_flag    o  ON c.cust_id = o.cust_id
"""


# ── F: Frequency 피처 ──────────────────────────────────────────────────────────

F_SQL = """
WITH txn_freq AS (
    SELECT
        cust_id,
        SUM(CASE WHEN txn_type IN ('TRANSFER_IN','TRANSFER_OUT')
                  AND txn_date >= date('now','-30 days') THEN 1 ELSE 0 END) AS transfer_cnt_30d,
        SUM(CASE WHEN txn_type = 'DEPOSIT'
                  AND txn_date >= date('now','-30 days') THEN 1 ELSE 0 END) AS deposit_cnt_30d,
        SUM(CASE WHEN txn_type IN ('WITHDRAWAL','TRANSFER_OUT')
                  AND txn_date >= date('now','-30 days') THEN 1 ELSE 0 END) AS withdrawal_cnt_30d,
        SUM(CASE WHEN channel = 'BRANCH'
                  AND txn_date >= date('now','-90 days') THEN 1 ELSE 0 END) AS branch_visit_cnt_90d,
        SUM(CASE WHEN txn_type = 'DEPOSIT'
                  AND txn_date >= date('now','-30 days')
                  AND (memo LIKE '%카드매출%' OR memo LIKE '%가맹%' OR memo LIKE '%정산%') THEN 1 ELSE 0 END) AS merchant_deposit_cnt_30d,
        SUM(CASE WHEN txn_type IN ('TRANSFER_OUT','AUTO_DEBIT','WITHDRAWAL')
                  AND txn_date >= date('now','-30 days')
                  AND (memo LIKE '%매입%' OR memo LIKE '%원자재%' OR memo LIKE '%임대료%'
                       OR memo LIKE '%인건비%' OR memo LIKE '%급여%직원%' OR memo LIKE '%식자재%'
                       OR memo LIKE '%원두%' OR memo LIKE '%재료비%' OR memo LIKE '%부가세%'
                       OR memo LIKE '%법인세%' OR memo LIKE '%직원 급여%')
                  THEN 1 ELSE 0 END) AS business_expense_cnt_30d,
        COUNT(DISTINCT CASE WHEN (memo LIKE '%급여%' OR memo LIKE '%월급%')
                             AND txn_type = 'DEPOSIT'
                             AND txn_date >= date('now','-180 days')
                             THEN substr(txn_date,1,7) END) AS salary_deposit_months_6m
    FROM raw_transactions
    GROUP BY cust_id
),
digital_freq AS (
    SELECT
        cust_id,
        SUM(CASE WHEN event_type = 'LOGIN'
                  AND event_time >= date('now','-30 days') THEN 1 ELSE 0 END) AS mobile_login_cnt_30d,
        SUM(CASE WHEN event_type = 'PRODUCT_PAGE_VIEW'
                  AND event_time >= date('now','-30 days') THEN 1 ELSE 0 END) AS product_page_view_cnt_30d
    FROM raw_digital_logs
    GROUP BY cust_id
),
crm_freq AS (
    SELECT
        cust_id,
        COUNT(*) AS consultation_cnt_90d
    FROM raw_crm_contacts
    WHERE contact_date >= date('now','-90 days')
    GROUP BY cust_id
)
SELECT
    c.cust_id,
    COALESCE(t.transfer_cnt_30d, 0)           AS transfer_cnt_30d,
    COALESCE(t.deposit_cnt_30d, 0)            AS deposit_cnt_30d,
    COALESCE(t.withdrawal_cnt_30d, 0)         AS withdrawal_cnt_30d,
    COALESCE(t.branch_visit_cnt_90d, 0)       AS branch_visit_cnt_90d,
    COALESCE(t.merchant_deposit_cnt_30d, 0)   AS merchant_deposit_cnt_30d,
    COALESCE(t.business_expense_cnt_30d, 0)   AS business_expense_cnt_30d,
    COALESCE(t.salary_deposit_months_6m, 0)   AS salary_deposit_months_6m,
    COALESCE(d.mobile_login_cnt_30d, 0)       AS mobile_login_cnt_30d,
    COALESCE(d.product_page_view_cnt_30d, 0)  AS product_page_view_cnt_30d,
    COALESCE(crm.consultation_cnt_90d, 0)     AS consultation_cnt_90d
FROM raw_customer c
LEFT JOIN txn_freq   t   ON c.cust_id = t.cust_id
LEFT JOIN digital_freq d ON c.cust_id = d.cust_id
LEFT JOIN crm_freq crm   ON c.cust_id = crm.cust_id
"""


# ── M: Monetary 피처 ───────────────────────────────────────────────────────────

M_SQL = """
WITH txn_amt AS (
    SELECT
        cust_id,
        SUM(CASE WHEN txn_type = 'DEPOSIT'
                  AND txn_date >= date('now','-30 days') THEN amount ELSE 0 END) AS total_deposit_amt_30d,
        SUM(CASE WHEN txn_type IN ('WITHDRAWAL','TRANSFER_OUT')
                  AND txn_date >= date('now','-30 days') THEN amount ELSE 0 END) AS total_withdrawal_amt_30d
    FROM raw_transactions
    GROUP BY cust_id
),
holding_amt AS (
    SELECT
        cust_id,
        SUM(CASE WHEN product_category IN ('DEMAND_DEPOSIT','SAVINGS','DEPOSIT') AND status='ACTIVE' THEN balance ELSE 0 END) AS avg_balance_3m,
        SUM(CASE WHEN product_category = 'LOAN' AND status='ACTIVE' THEN balance ELSE 0 END) AS loan_balance_amt,
        SUM(CASE WHEN product_category IN ('DEPOSIT','SAVINGS') AND status='ACTIVE'
                  AND maturity_date BETWEEN date('now') AND date('now','+60 days')
                  THEN balance ELSE 0 END) AS deposit_maturity_amt_60d
    FROM raw_product_holdings
    GROUP BY cust_id
),
card_amt AS (
    SELECT
        cust_id,
        SUM(CASE WHEN approved_date >= date('now','-30 days') THEN amount ELSE 0 END) AS monthly_card_spend_amt
    FROM raw_card_transactions
    GROUP BY cust_id
),
pct AS (
    SELECT
        cust_id,
        avg_balance_3m,
        ROUND(
            CAST((SELECT COUNT(*) FROM (
                SELECT cust_id, SUM(CASE WHEN product_category IN ('DEMAND_DEPOSIT','SAVINGS','DEPOSIT') AND status='ACTIVE' THEN balance ELSE 0 END) AS b
                FROM raw_product_holdings GROUP BY cust_id
            ) inner_q WHERE inner_q.b <= h.avg_balance_3m) AS REAL)
            / NULLIF((SELECT COUNT(DISTINCT cust_id) FROM raw_product_holdings), 0)
        , 2) AS avg_balance_percentile
    FROM holding_amt h
)
SELECT
    c.cust_id,
    COALESCE(p.avg_balance_3m, 0)              AS avg_balance_3m,
    COALESCE(t.total_deposit_amt_30d, 0)        AS total_deposit_amt_30d,
    COALESCE(t.total_withdrawal_amt_30d, 0)     AS total_withdrawal_amt_30d,
    COALESCE(ca.monthly_card_spend_amt, 0)      AS monthly_card_spend_amt,
    COALESCE(h.loan_balance_amt, 0)             AS loan_balance_amt,
    COALESCE(h.deposit_maturity_amt_60d, 0)     AS deposit_maturity_amt_60d,
    CASE WHEN COALESCE(p.avg_balance_3m,0) - COALESCE(ca.monthly_card_spend_amt,0) > 0
         THEN COALESCE(p.avg_balance_3m,0) - COALESCE(ca.monthly_card_spend_amt,0)
         ELSE 0 END AS idle_cash_amt,
    COALESCE(p.avg_balance_percentile, 0)       AS avg_balance_percentile
FROM raw_customer c
LEFT JOIN txn_amt  t  ON c.cust_id = t.cust_id
LEFT JOIN holding_amt h ON c.cust_id = h.cust_id
LEFT JOIN card_amt ca ON c.cust_id = ca.cust_id
LEFT JOIN pct      p  ON c.cust_id = p.cust_id
"""


# ── P: Product Gap 피처 ────────────────────────────────────────────────────────

P_SQL = """
WITH product_flags AS (
    SELECT
        cust_id,
        MAX(CASE WHEN product_category = 'CREDIT_CARD'       AND status='ACTIVE' THEN 1 ELSE 0 END) AS has_credit_card,
        MAX(CASE WHEN product_category = 'CHECK_CARD'        AND status='ACTIVE' THEN 1 ELSE 0 END) AS has_check_card,
        MAX(CASE WHEN product_category = 'LOAN'              AND status='ACTIVE' THEN 1 ELSE 0 END) AS has_loan,
        MAX(CASE WHEN product_category = 'BUSINESS_ACCOUNT'  AND status='ACTIVE' THEN 1 ELSE 0 END) AS has_business_account,
        MAX(CASE WHEN product_category = 'MERCHANT_ACCOUNT'  AND status='ACTIVE' THEN 1 ELSE 0 END) AS has_merchant_account,
        MAX(CASE WHEN product_category = 'ISA'               AND status='ACTIVE' THEN 1 ELSE 0 END) AS has_isa,
        MAX(CASE WHEN product_category = 'FUND'              AND status='ACTIVE' THEN 1 ELSE 0 END) AS has_fund,
        MAX(CASE WHEN product_category = 'FX_ACCOUNT'        AND status='ACTIVE' THEN 1 ELSE 0 END) AS has_fx_account
    FROM raw_product_holdings
    GROUP BY cust_id
),
salary_flag AS (
    SELECT cust_id,
           MAX(CASE WHEN (memo LIKE '%급여%' OR memo LIKE '%월급%')
                     AND txn_date >= date('now','-30 days') THEN 1 ELSE 0 END) AS has_salary_account
    FROM raw_transactions
    WHERE txn_type = 'DEPOSIT'
    GROUP BY cust_id
)
SELECT
    c.cust_id,
    COALESCE(s.has_salary_account, 0)    AS has_salary_account,
    COALESCE(p.has_credit_card, 0)       AS has_credit_card,
    COALESCE(p.has_check_card, 0)        AS has_check_card,
    COALESCE(p.has_loan, 0)              AS has_loan,
    COALESCE(p.has_business_account, 0)  AS has_business_account,
    COALESCE(p.has_merchant_account, 0)  AS has_merchant_account,
    COALESCE(p.has_isa, 0)               AS has_isa,
    COALESCE(p.has_fund, 0)              AS has_fund,
    COALESCE(p.has_fx_account, 0)        AS has_fx_account
FROM raw_customer c
LEFT JOIN product_flags p ON c.cust_id = p.cust_id
LEFT JOIN salary_flag   s ON c.cust_id = s.cust_id
"""


# ── C: Contact Signal 피처 ────────────────────────────────────────────────────

C_SQL = """
WITH recent_topic AS (
    SELECT cust_id, topic AS recent_consult_topic
    FROM raw_crm_contacts
    WHERE contact_date = (SELECT MAX(contact_date) FROM raw_crm_contacts r2 WHERE r2.cust_id = raw_crm_contacts.cust_id)
    GROUP BY cust_id
),
agg AS (
    SELECT
        cust_id,
        GROUP_CONCAT(DISTINCT topic)  AS recent_consult_topics_90d,
        MAX(CASE WHEN product_category='LOAN'                           AND contact_date >= date('now','-90 days')  THEN 1 ELSE 0 END) AS loan_inquiry_flag_90d,
        MAX(CASE WHEN product_category='CARD'                           AND contact_date >= date('now','-90 days')  THEN 1 ELSE 0 END) AS card_inquiry_flag_90d,
        MAX(CASE WHEN product_category IN ('DEPOSIT','SAVINGS')         AND contact_date >= date('now','-90 days')  THEN 1 ELSE 0 END) AS deposit_inquiry_flag_90d,
        MAX(CASE WHEN product_category='FX'                             AND contact_date >= date('now','-90 days')  THEN 1 ELSE 0 END) AS fx_inquiry_flag_90d,
        MAX(CASE WHEN product_category IN ('ISA','FUND','INVESTMENT','RETIREMENT') AND contact_date >= date('now','-90 days') THEN 1 ELSE 0 END) AS investment_inquiry_flag_90d,
        SUM(CASE WHEN result='거절'                                      AND contact_date >= date('now','-180 days') THEN 1 ELSE 0 END) AS campaign_reject_cnt_180d,
        MAX(CASE WHEN product_category='CARD' AND result='거절'         AND contact_date >= date('now','-90 days')  THEN 1 ELSE 0 END) AS card_reject_flag_90d,
        MAX(CASE WHEN product_category='COMPLAINT'                      AND contact_date >= date('now','-180 days') THEN 1 ELSE 0 END) AS complaint_flag_180d
    FROM raw_crm_contacts
    GROUP BY cust_id
),
channel_pref AS (
    SELECT cust_id, channel AS preferred_channel
    FROM (
        SELECT cust_id, channel, COUNT(*) AS cnt,
               ROW_NUMBER() OVER (PARTITION BY cust_id ORDER BY COUNT(*) DESC) AS rn
        FROM raw_crm_contacts
        WHERE contact_date >= date('now','-180 days')
        GROUP BY cust_id, channel
    ) WHERE rn = 1
)
SELECT
    c.cust_id,
    r.recent_consult_topic,
    a.recent_consult_topics_90d,
    COALESCE(a.loan_inquiry_flag_90d, 0)        AS loan_inquiry_flag_90d,
    COALESCE(a.card_inquiry_flag_90d, 0)         AS card_inquiry_flag_90d,
    COALESCE(a.deposit_inquiry_flag_90d, 0)      AS deposit_inquiry_flag_90d,
    COALESCE(a.fx_inquiry_flag_90d, 0)           AS fx_inquiry_flag_90d,
    COALESCE(a.investment_inquiry_flag_90d, 0)   AS investment_inquiry_flag_90d,
    COALESCE(a.campaign_reject_cnt_180d, 0)      AS campaign_reject_cnt_180d,
    COALESCE(a.card_reject_flag_90d, 0)          AS card_reject_flag_90d,
    COALESCE(a.complaint_flag_180d, 0)           AS complaint_flag_180d,
    COALESCE(p.preferred_channel, '영업점')      AS preferred_channel
FROM raw_customer c
LEFT JOIN recent_topic r ON c.cust_id = r.cust_id
LEFT JOIN agg          a ON c.cust_id = a.cust_id
LEFT JOIN channel_pref p ON c.cust_id = p.cust_id
"""


# ── 고객 기본 정보 조회 ────────────────────────────────────────────────────────

BASE_SQL = """
SELECT
    cust_id,
    CASE
        WHEN age < 20 THEN '10대'
        WHEN age BETWEEN 20 AND 29 THEN '20대'
        WHEN age BETWEEN 30 AND 39 THEN '30대'
        WHEN age BETWEEN 40 AND 49 THEN '40대'
        WHEN age BETWEEN 50 AND 59 THEN '50대'
        ELSE '60대 이상'
    END AS age_band,
    customer_type,
    risk_grade,
    main_branch_id
FROM raw_customer
"""


# ── missing_product_labels 계산 (Python) ────────────────────────────────────

def compute_missing_labels(r: dict, f: dict, m: dict, p: dict) -> list[str]:
    labels = []
    # 급여 입금 있는데 자사 신용카드 없음
    if r.get("recent_salary_deposit_flag") == 1 and p.get("has_credit_card") == 0:
        labels.append("신용카드")
    # 개인사업자 + 가맹점성 입금 있음 + 가맹점 계좌 없음
    if f.get("merchant_deposit_cnt_30d", 0) >= 3 and p.get("has_merchant_account") == 0:
        labels.append("가맹점 결제계좌")
    # 예적금 만기 60일 이내 + ISA 없음
    if r.get("days_until_nearest_deposit_maturity") is not None \
            and 0 <= r["days_until_nearest_deposit_maturity"] <= 60 \
            and p.get("has_isa") == 0:
        labels.append("ISA")
    # 평잔 상위 30% + 투자 상품 없음
    if m.get("avg_balance_percentile", 0) >= 0.7 \
            and p.get("has_fund") == 0 and p.get("has_isa") == 0:
        labels.append("투자/절세 상품")
    # 대출 만기 60일 이내
    if r.get("days_until_nearest_loan_maturity") is not None \
            and 0 <= r["days_until_nearest_loan_maturity"] <= 60:
        labels.append("대출 연장/대환 상담")
    # ISA 조회 이력 있음 + ISA 없음
    if p.get("has_isa") == 0:
        # 별도 digital log 조회 없이 나중에 C 피처와 결합 가능
        pass
    return labels


# ── sales_fatigue_score 계산 (Python) ────────────────────────────────────────

def compute_sales_fatigue(c: dict) -> float:
    score = (
        c.get("campaign_reject_cnt_180d", 0) * 0.15
        + c.get("card_reject_flag_90d", 0) * 0.25
        + c.get("complaint_flag_180d", 0) * 0.35
        + min(c.get("consultation_cnt_90d", 0), 5) * 0.05
    )
    return round(min(score, 1.0), 2)


# ── 구간 피처(band / level) 헬퍼 ──────────────────────────────────────────────

def _loan_maturity_band(days):
    if days is None:           return "해당없음"
    if days < 0:                return "만기지남"
    if days <= 30:              return "만기임박_30일이내"
    if days <= 60:              return "만기임박_60일이내"
    if days <= 90:              return "만기임박_90일이내"
    return "여유"


def _deposit_maturity_band(days):
    if days is None:           return "해당없음"
    if days < 0:                return "만기지남"
    if days <= 30:              return "만기임박_30일이내"
    if days <= 60:              return "만기임박_60일이내"
    return "여유"


def _mobile_recency_band(days):
    if days is None or days >= 999: return "장기미접속"
    if days <= 7:               return "최근접속"
    if days <= 30:              return "정상이용"
    if days <= 90:              return "저활동"
    return "장기미접속"


def _branch_recency_band(days):
    if days is None or days >= 999: return "장기미방문"
    if days <= 30:              return "최근방문"
    if days <= 90:              return "정상"
    return "장기미방문"


def _large_money_movement_band(r: dict) -> str:
    dep = r.get("days_since_last_large_deposit", 999)
    wdr = r.get("days_since_last_large_withdrawal", 999)
    recent = min(dep if dep is not None else 999, wdr if wdr is not None else 999)
    if recent <= 7:             return "최근거액이동"
    if recent <= 30:            return "최근30일거액이동"
    if recent <= 90:            return "3개월내이동"
    return "거액이동없음"


def _merchant_activity_level(cnt):
    if cnt >= 10:               return "높음"
    if cnt >= 4:                return "중간"
    if cnt >= 1:                return "낮음"
    return "없음"


def _business_expense_level(cnt):
    if cnt >= 7:                return "높음"
    if cnt >= 3:                return "중간"
    if cnt >= 1:                return "낮음"
    return "없음"


def _digital_activity_level(cnt):
    if cnt >= 15:               return "높음"
    if cnt >= 5:                return "중간"
    if cnt >= 1:                return "낮음"
    return "없음"


def _consultation_level(cnt):
    if cnt >= 3:                return "높음"
    if cnt >= 1:                return "중간"
    return "없음"


def _salary_stability_level(months):
    if months >= 5:             return "안정"
    if months >= 2:             return "불규칙"
    return "없음"


def _avg_balance_band(amount):
    if amount >= 50_000_000:    return "상"
    if amount >= 10_000_000:    return "중상"
    if amount >= 3_000_000:     return "중"
    if amount >= 500_000:       return "하"
    return "최하"


def _idle_cash_band(amount):
    if amount <= 0:             return "없음"
    if amount >= 10_000_000:    return "있음_많음"
    if amount >= 3_000_000:     return "있음_중간"
    return "있음_소량"


def _loan_balance_band(amount):
    if amount == 0:             return "없음"
    if amount >= 100_000_000:   return "큼"
    if amount >= 30_000_000:    return "중간"
    return "소액"


def _card_spend_band(amount):
    if amount == 0:             return "없음"
    if amount >= 3_000_000:     return "큼"
    if amount >= 1_000_000:     return "중간"
    return "소액"


def _inflow_band(amount):
    if amount >= 100_000_000:   return "큼"
    if amount >= 30_000_000:    return "중상"
    if amount >= 5_000_000:     return "중"
    if amount > 0:              return "소액"
    return "없음"


def _outflow_band(amount):
    return _inflow_band(amount)


def _sales_fatigue_level(score):
    if score >= 0.7:            return "높음"
    if score >= 0.4:            return "중간"
    return "낮음"


def _recommendation_tone(fatigue: float, complaint: int, card_reject: int) -> str:
    if complaint == 1 or fatigue >= 0.6:
        return "보수적_권유자제"
    if card_reject == 1 or fatigue >= 0.4:
        return "신중_상담중심"
    return "일반_안내가능"


# ── 자연어 요약 (P / C) ────────────────────────────────────────────────────────

def _build_product_gap_summary(p: dict, missing_labels: list[str], customer_type: str) -> str:
    if not missing_labels:
        return "주요 상품 공백 없음"
    has_biz = "사업자" if customer_type in ("개인사업자", "법인") else "개인"
    return f"{has_biz} 고객으로 " + ", ".join(missing_labels) + "을(를) 보유하지 않은 상태"


def _build_contact_summary(c: dict, fatigue: float) -> str:
    topics = (c.get("recent_consult_topics_90d") or "").split(",")
    topics = [t.strip() for t in topics if t.strip()]
    parts = []
    if topics:
        parts.append("최근 상담 주제: " + ", ".join(topics[:3]))
    if c.get("complaint_flag_180d") == 1:
        parts.append("민원 이력 있음")
    if c.get("campaign_reject_cnt_180d", 0) >= 1:
        parts.append(f"캠페인 거절 {c['campaign_reject_cnt_180d']}회")
    parts.append(f"영업 피로도 {_sales_fatigue_level(fatigue)}({fatigue:.2f})")
    return " / ".join(parts) if parts else "최근 접촉 이력 없음"


def _split_topics(topics_str: str | None) -> list[str]:
    if not topics_str:
        return []
    return [t.strip() for t in topics_str.split(",") if t.strip()]


# ── 행동신호(behavior_signals) 빌더 ─────────────────────────────────────────────

def build_behavior_signals(r: dict, f: dict, m: dict, p: dict, c: dict, basic: dict) -> dict:
    """7개 영업 카테고리 + risk 그룹별 자연어 신호 목록"""
    sig: dict[str, list[str]] = {
        "loan_signals":          [],   # 여신
        "deposit_signals":       [],   # 수신
        "card_signals":          [],   # 카드
        "bancassurance_signals": [],   # 방카
        "trust_signals":         [],   # 신탁
        "fund_signals":          [],   # 펀드
        "fx_signals":            [],   # 외환
        "risk_signals":          [],
    }
    customer_type = basic.get("customer_type", "")

    # ── 여신 ─────────────────────────────────────────────────────────────────
    days_loan = r.get("days_until_nearest_loan_maturity")
    if days_loan is not None and 0 <= days_loan <= 90:
        sig["loan_signals"].append(f"대출 만기 {days_loan}일 이내")
    if c.get("loan_inquiry_flag_90d") == 1:
        sig["loan_signals"].append("최근 대출 관련 문의 이력")
    if p.get("has_loan") == 1 and m.get("loan_balance_amt", 0) > 0:
        sig["loan_signals"].append(
            f"기존 대출 잔액 {int(m['loan_balance_amt']/10000):,}만원"
        )
    # 사업자 + 사업비 지출 반복 → 운전자금 니즈
    if customer_type in ("개인사업자", "법인") and f.get("business_expense_cnt_30d", 0) >= 5:
        sig["loan_signals"].append("사업 비용 지출이 반복되어 운전자금 니즈 가능")

    # ── 수신 ─────────────────────────────────────────────────────────────────
    if m.get("idle_cash_amt", 0) >= 3_000_000:
        sig["deposit_signals"].append(
            f"유휴자금 {int(m['idle_cash_amt']/10000):,}만원 관측"
        )
    days_dep = r.get("days_until_nearest_deposit_maturity")
    if days_dep is not None and 0 <= days_dep <= 60:
        sig["deposit_signals"].append(f"예금 만기 {days_dep}일 이내")
    if m.get("avg_balance_percentile", 0) >= 0.6:
        sig["deposit_signals"].append("평균잔액 중상 수준")
    if c.get("deposit_inquiry_flag_90d") == 1:
        sig["deposit_signals"].append("최근 예적금 관련 문의 이력")
    if customer_type in ("개인사업자", "법인") and p.get("has_merchant_account") == 0 \
            and f.get("merchant_deposit_cnt_30d", 0) >= 3:
        sig["deposit_signals"].append("가맹점 결제계좌 미보유 + 사업자성 입금 반복")

    # ── 카드 ─────────────────────────────────────────────────────────────────
    if p.get("has_credit_card") == 0:
        if customer_type in ("개인사업자", "법인"):
            sig["card_signals"].append("자사 사업자/신용카드 미보유")
        else:
            sig["card_signals"].append("자사 신용카드 미보유")
    if f.get("business_expense_cnt_30d", 0) >= 5:
        sig["card_signals"].append("사업 관련 비용 지출 반복 (카드화 가능)")
    if c.get("card_reject_flag_90d") == 1:
        sig["card_signals"].append("최근 카드 거절 이력 있음 (재권유 주의)")
    elif c.get("card_inquiry_flag_90d") == 1:
        sig["card_signals"].append("최근 카드 상품 관심 신호")

    # ── 방카 (보험) ──────────────────────────────────────────────────────────
    age_band = basic.get("age_band", "")
    if age_band in ("40대", "50대", "60대 이상") and m.get("avg_balance_percentile", 0) >= 0.6:
        sig["bancassurance_signals"].append("중장년 + 평잔 중상 → 보장성/저축성 보험 검토 가능")

    # ── 신탁 (퇴직연금/IRP) ──────────────────────────────────────────────────
    if c.get("investment_inquiry_flag_90d") == 1:
        sig["trust_signals"].append("퇴직연금/투자 관련 문의 이력")
    if age_band in ("40대", "50대") and customer_type in ("개인", "개인사업자"):
        sig["trust_signals"].append("노후 준비 단계 연령 - IRP 세액공제 안내 가능")

    # ── 펀드 / ISA ───────────────────────────────────────────────────────────
    if p.get("has_isa") == 0 and m.get("idle_cash_amt", 0) >= 5_000_000:
        sig["fund_signals"].append("ISA 미보유 + 유휴자금 존재")
    if p.get("has_fund") == 0 and m.get("avg_balance_percentile", 0) >= 0.7:
        sig["fund_signals"].append("투자 상품 미보유 + 평잔 상위")
    if c.get("investment_inquiry_flag_90d") == 1:
        sig["fund_signals"].append("최근 투자/절세 관련 문의 이력")

    # ── 외환 ─────────────────────────────────────────────────────────────────
    if c.get("fx_inquiry_flag_90d") == 1:
        sig["fx_signals"].append("외환/송금 관련 문의 이력")
    if p.get("has_fx_account") == 0 and c.get("fx_inquiry_flag_90d") == 1:
        sig["fx_signals"].append("외화예금 미보유")

    # ── 리스크 ───────────────────────────────────────────────────────────────
    fat = c.get("sales_fatigue_score", 0)
    if c.get("complaint_flag_180d") == 1:
        sig["risk_signals"].append("최근 민원 이력 있음")
    else:
        sig["risk_signals"].append("최근 민원 없음")
    if fat >= 0.6:
        sig["risk_signals"].append(f"영업 피로도 높음({fat:.2f}) - 적극 권유 자제")
    elif fat <= 0.3:
        sig["risk_signals"].append(f"영업 피로도 낮음({fat:.2f})")
    if c.get("campaign_reject_cnt_180d", 0) >= 2:
        sig["risk_signals"].append(f"캠페인 거절 {c['campaign_reject_cnt_180d']}회")

    return sig


# ── 설명가능 신호(explainable_signals) 빌더 ────────────────────────────────────

def build_explainable_signals(
    r: dict, f: dict, m: dict, p: dict, c: dict,
    missing_labels: list[str],
) -> list[str]:
    out = []
    days_loan = r.get("days_until_nearest_loan_maturity")
    if days_loan is not None and 0 <= days_loan <= 90:
        out.append(f"대출 만기 {days_loan}일 전")

    days_dep = r.get("days_until_nearest_deposit_maturity")
    if days_dep is not None and 0 <= days_dep <= 90:
        out.append(f"예금 만기 {days_dep}일 전")

    if f.get("merchant_deposit_cnt_30d", 0) >= 4:
        out.append(f"최근 30일 사업자성 입금 {f['merchant_deposit_cnt_30d']}회")
    if f.get("business_expense_cnt_30d", 0) >= 4:
        out.append(f"최근 30일 사업 비용 지출 {f['business_expense_cnt_30d']}회")

    pct = m.get("avg_balance_percentile", 0)
    if pct >= 0.7:
        out.append("평균잔액 상위 30% 이내")
    elif pct >= 0.5:
        out.append("평균잔액 중상 수준")

    if m.get("idle_cash_amt", 0) >= 3_000_000:
        out.append(f"유휴자금 {int(m['idle_cash_amt']/10000):,}만원")

    if missing_labels:
        out.append(f"미보유 상품: {', '.join(missing_labels[:3])}")

    topics = _split_topics(c.get("recent_consult_topics_90d"))
    if topics:
        out.append(f"최근 상담 주제: {', '.join(topics[:3])}")

    if c.get("complaint_flag_180d") == 1:
        out.append("최근 민원 이력 있음")
    elif c.get("sales_fatigue_score", 0) <= 0.3:
        out.append("영업 피로도 낮음")

    return out


# ── llm_input_json 생성 (Python) ─────────────────────────────────────────────

def build_llm_json(base: dict, r: dict, f: dict, m: dict, p: dict, c: dict,
                   missing_labels: list, fatigue: float) -> str:
    customer_type = base.get("customer_type", "")

    # 구간 피처 계산
    r_bands = {
        "loan_maturity_band":          _loan_maturity_band(r.get("days_until_nearest_loan_maturity")),
        "deposit_maturity_band":       _deposit_maturity_band(r.get("days_until_nearest_deposit_maturity")),
        "mobile_recency_band":         _mobile_recency_band(r.get("days_since_last_mobile_login")),
        "branch_recency_band":         _branch_recency_band(r.get("days_since_last_branch_visit")),
        "large_money_movement_band":   _large_money_movement_band(r),
    }
    f_levels = {
        "merchant_activity_level":     _merchant_activity_level(f.get("merchant_deposit_cnt_30d", 0)),
        "business_expense_level":      _business_expense_level(f.get("business_expense_cnt_30d", 0)),
        "digital_activity_level":      _digital_activity_level(f.get("mobile_login_cnt_30d", 0)),
        "consultation_level":          _consultation_level(f.get("consultation_cnt_90d", 0)),
        "salary_stability_level":      _salary_stability_level(f.get("salary_deposit_months_6m", 0)),
    }
    m_bands = {
        "avg_balance_band":            _avg_balance_band(m.get("avg_balance_3m", 0)),
        "idle_cash_band":              _idle_cash_band(m.get("idle_cash_amt", 0)),
        "loan_balance_band":           _loan_balance_band(m.get("loan_balance_amt", 0)),
        "card_spend_band":             _card_spend_band(m.get("monthly_card_spend_amt", 0)),
        "inflow_band":                 _inflow_band(m.get("total_deposit_amt_30d", 0)),
        "outflow_band":                _outflow_band(m.get("total_withdrawal_amt_30d", 0)),
    }

    # C 축 부가 정보
    fatigue_level = _sales_fatigue_level(fatigue)
    rec_tone = _recommendation_tone(
        fatigue,
        c.get("complaint_flag_180d", 0),
        c.get("card_reject_flag_90d", 0),
    )
    recent_topics = _split_topics(c.get("recent_consult_topics_90d"))
    contact_summary = _build_contact_summary({**c, "sales_fatigue_score": fatigue}, fatigue)

    # P 축 부가 정보
    product_gap_summary = _build_product_gap_summary(p, missing_labels, customer_type)

    # 행동신호 / 설명가능 신호
    c_aug = {**c, "sales_fatigue_score": fatigue}
    behavior_signals = build_behavior_signals(r, f, m, p, c_aug, base)
    explainable_signals = build_explainable_signals(r, f, m, p, c_aug, missing_labels)

    payload = {
        "cust_id": base["cust_id"],
        "base_date": BASE_DATE,
        "customer_segment": {
            "age_band": base["age_band"],
            "customer_type": base["customer_type"],
            "risk_grade": base["risk_grade"],
            "main_branch_id": base["main_branch_id"],
        },
        "rfm_pc": {
            "R": {
                "days_since_last_branch_visit":         r.get("days_since_last_branch_visit"),
                "days_since_last_mobile_login":         r.get("days_since_last_mobile_login"),
                "days_until_nearest_deposit_maturity":  r.get("days_until_nearest_deposit_maturity"),
                "days_until_nearest_loan_maturity":     r.get("days_until_nearest_loan_maturity"),
                "recent_salary_deposit_flag":           r.get("recent_salary_deposit_flag", 0),
                "recent_large_outflow_flag":            r.get("recent_large_outflow_flag", 0),
                **r_bands,
            },
            "F": {
                "transfer_cnt_30d":          f.get("transfer_cnt_30d", 0),
                "branch_visit_cnt_90d":      f.get("branch_visit_cnt_90d", 0),
                "mobile_login_cnt_30d":      f.get("mobile_login_cnt_30d", 0),
                "salary_deposit_months_6m":  f.get("salary_deposit_months_6m", 0),
                "merchant_deposit_cnt_30d":  f.get("merchant_deposit_cnt_30d", 0),
                "business_expense_cnt_30d":  f.get("business_expense_cnt_30d", 0),
                "consultation_cnt_90d":      f.get("consultation_cnt_90d", 0),
                **f_levels,
            },
            "M": {
                "avg_balance_3m":            m.get("avg_balance_3m", 0),
                "monthly_card_spend_amt":    m.get("monthly_card_spend_amt", 0),
                "loan_balance_amt":          m.get("loan_balance_amt", 0),
                "deposit_maturity_amt_60d":  m.get("deposit_maturity_amt_60d", 0),
                "idle_cash_amt":             m.get("idle_cash_amt", 0),
                "avg_balance_percentile":    m.get("avg_balance_percentile", 0),
                "total_deposit_amt_30d":     m.get("total_deposit_amt_30d", 0),
                "total_withdrawal_amt_30d":  m.get("total_withdrawal_amt_30d", 0),
                **m_bands,
            },
            "P": {
                "has_salary_account":      p.get("has_salary_account", 0),
                "has_credit_card":         p.get("has_credit_card", 0),
                "has_loan":                p.get("has_loan", 0),
                "has_business_account":    p.get("has_business_account", 0),
                "has_merchant_account":    p.get("has_merchant_account", 0),
                "has_isa":                 p.get("has_isa", 0),
                "has_fund":                p.get("has_fund", 0),
                "has_fx_account":          p.get("has_fx_account", 0),
                "missing_product_labels":  missing_labels,
                "product_gap_count":       len(missing_labels),
                "product_gap_summary":     product_gap_summary,
            },
            "C": {
                "recent_consult_topic":          c.get("recent_consult_topic"),
                "recent_consult_topics_90d":     c.get("recent_consult_topics_90d"),
                "recent_interest_topics":        recent_topics,
                "loan_inquiry_flag_90d":         c.get("loan_inquiry_flag_90d", 0),
                "card_inquiry_flag_90d":         c.get("card_inquiry_flag_90d", 0),
                "deposit_inquiry_flag_90d":      c.get("deposit_inquiry_flag_90d", 0),
                "fx_inquiry_flag_90d":           c.get("fx_inquiry_flag_90d", 0),
                "investment_inquiry_flag_90d":   c.get("investment_inquiry_flag_90d", 0),
                "campaign_reject_cnt_180d":      c.get("campaign_reject_cnt_180d", 0),
                "card_reject_flag_90d":          c.get("card_reject_flag_90d", 0),
                "complaint_flag_180d":           c.get("complaint_flag_180d", 0),
                "sales_fatigue_score":           fatigue,
                "sales_fatigue_level":           fatigue_level,
                "preferred_channel":             c.get("preferred_channel", "영업점"),
                "contact_summary":               contact_summary,
                "recommendation_tone":           rec_tone,
            },
        },
        "behavior_signals":     behavior_signals,
        "explainable_signals":  explainable_signals,
    }
    return json.dumps(payload, ensure_ascii=False)


# ── 피처 Mart 적재 ─────────────────────────────────────────────────────────────

INSERT_SQL = """
INSERT OR REPLACE INTO customer_rfmpc_feature_mart (
    base_date, cust_id,
    age_band, customer_type, risk_grade, main_branch_id,
    days_since_last_branch_visit, days_since_last_mobile_login,
    days_since_last_large_deposit, days_since_last_large_withdrawal,
    days_until_nearest_deposit_maturity, days_until_nearest_loan_maturity,
    recent_salary_deposit_flag, recent_large_outflow_flag,
    transfer_cnt_30d, deposit_cnt_30d, withdrawal_cnt_30d,
    branch_visit_cnt_90d, mobile_login_cnt_30d, product_page_view_cnt_30d,
    salary_deposit_months_6m, merchant_deposit_cnt_30d, consultation_cnt_90d,
    avg_balance_3m, total_deposit_amt_30d, total_withdrawal_amt_30d,
    monthly_card_spend_amt, loan_balance_amt, deposit_maturity_amt_60d,
    idle_cash_amt, avg_balance_percentile,
    has_salary_account, has_credit_card, has_check_card, has_loan,
    has_business_account, has_merchant_account, has_isa, has_fund, has_fx_account,
    missing_product_labels,
    recent_consult_topic, recent_consult_topics_90d,
    loan_inquiry_flag_90d, card_inquiry_flag_90d, deposit_inquiry_flag_90d,
    fx_inquiry_flag_90d, investment_inquiry_flag_90d,
    campaign_reject_cnt_180d, card_reject_flag_90d, complaint_flag_180d,
    sales_fatigue_score, preferred_channel,
    llm_input_json
) VALUES (
    ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
)
"""


def _rows_to_dict(rows, cursor) -> dict[str, dict]:
    cols = [d[0] for d in cursor.description]
    return {r[0]: dict(zip(cols, r)) for r in rows}


# ── 품질 검증 ──────────────────────────────────────────────────────────────────

def run_quality_checks(conn: sqlite3.Connection) -> None:
    print("\n=== 품질 검증 ===")

    # 1) 고객 1명당 1행
    dupes = conn.execute(
        f"SELECT cust_id, COUNT(*) FROM customer_rfmpc_feature_mart WHERE base_date=? GROUP BY cust_id HAVING COUNT(*)>1",
        (BASE_DATE,),
    ).fetchall()
    print(f"  [중복 행 검사] {'OK' if not dupes else f'FAIL - {dupes}'}")

    # 2) 신용카드 보유 + missing_product_labels에 신용카드 포함 모순
    conflicts = conn.execute(
        "SELECT cust_id FROM customer_rfmpc_feature_mart WHERE has_credit_card=1 AND missing_product_labels LIKE '%신용카드%'"
    ).fetchall()
    print(f"  [P 룰 충돌 검사] {'OK' if not conflicts else f'FAIL - {[r[0] for r in conflicts]}'}")

    # 3) 민원 고객 피로도 낮음 체크
    fatigue_issues = conn.execute(
        "SELECT cust_id, sales_fatigue_score FROM customer_rfmpc_feature_mart WHERE complaint_flag_180d=1 AND sales_fatigue_score < 0.3"
    ).fetchall()
    print(f"  [피로도 산식 검사] {'OK' if not fatigue_issues else f'WARN - {fatigue_issues}'}")

    # 4) 만기일 음수 체크
    neg_maturity = conn.execute(
        "SELECT cust_id FROM customer_rfmpc_feature_mart WHERE days_until_nearest_deposit_maturity < 0 OR days_until_nearest_loan_maturity < 0"
    ).fetchall()
    print(f"  [만기일 음수 검사] {'OK' if not neg_maturity else f'FAIL - {[r[0] for r in neg_maturity]}'}")

    # 5) 전체 적재 건수
    cnt = conn.execute(f"SELECT COUNT(*) FROM customer_rfmpc_feature_mart WHERE base_date=?", (BASE_DATE,)).fetchone()[0]
    print(f"  [총 적재 고객 수] {cnt}명")


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    print(f"=== Feature Mart 빌드 시작 (base_date={BASE_DATE}) ===\n")

    # 피처 그룹별 조회
    cur = conn.execute(BASE_SQL)
    base_map = _rows_to_dict(cur.fetchall(), cur)

    cur = conn.execute(R_SQL)
    r_map = _rows_to_dict(cur.fetchall(), cur)

    cur = conn.execute(F_SQL)
    f_map = _rows_to_dict(cur.fetchall(), cur)

    cur = conn.execute(M_SQL)
    m_map = _rows_to_dict(cur.fetchall(), cur)

    cur = conn.execute(P_SQL)
    p_map = _rows_to_dict(cur.fetchall(), cur)

    cur = conn.execute(C_SQL)
    c_map = _rows_to_dict(cur.fetchall(), cur)

    # 행 조립 및 삽입
    rows = []
    for cust_id in base_map:
        base = base_map[cust_id]
        r = r_map.get(cust_id, {})
        f = f_map.get(cust_id, {})
        m = m_map.get(cust_id, {})
        p = p_map.get(cust_id, {})
        c = c_map.get(cust_id, {})

        missing = compute_missing_labels(r, f, m, p)
        fatigue = compute_sales_fatigue({**c, "consultation_cnt_90d": f.get("consultation_cnt_90d", 0)})
        llm_json = build_llm_json(base, r, f, m, p, c, missing, fatigue)

        rows.append((
            BASE_DATE, cust_id,
            base.get("age_band"), base.get("customer_type"),
            base.get("risk_grade"), base.get("main_branch_id"),
            r.get("days_since_last_branch_visit"), r.get("days_since_last_mobile_login"),
            r.get("days_since_last_large_deposit"), r.get("days_since_last_large_withdrawal"),
            r.get("days_until_nearest_deposit_maturity"), r.get("days_until_nearest_loan_maturity"),
            r.get("recent_salary_deposit_flag", 0), r.get("recent_large_outflow_flag", 0),
            f.get("transfer_cnt_30d", 0), f.get("deposit_cnt_30d", 0), f.get("withdrawal_cnt_30d", 0),
            f.get("branch_visit_cnt_90d", 0), f.get("mobile_login_cnt_30d", 0), f.get("product_page_view_cnt_30d", 0),
            f.get("salary_deposit_months_6m", 0), f.get("merchant_deposit_cnt_30d", 0), f.get("consultation_cnt_90d", 0),
            m.get("avg_balance_3m", 0), m.get("total_deposit_amt_30d", 0), m.get("total_withdrawal_amt_30d", 0),
            m.get("monthly_card_spend_amt", 0), m.get("loan_balance_amt", 0), m.get("deposit_maturity_amt_60d", 0),
            m.get("idle_cash_amt", 0), m.get("avg_balance_percentile", 0),
            p.get("has_salary_account", 0), p.get("has_credit_card", 0), p.get("has_check_card", 0), p.get("has_loan", 0),
            p.get("has_business_account", 0), p.get("has_merchant_account", 0), p.get("has_isa", 0),
            p.get("has_fund", 0), p.get("has_fx_account", 0),
            json.dumps(missing, ensure_ascii=False),
            c.get("recent_consult_topic"), c.get("recent_consult_topics_90d"),
            c.get("loan_inquiry_flag_90d", 0), c.get("card_inquiry_flag_90d", 0), c.get("deposit_inquiry_flag_90d", 0),
            c.get("fx_inquiry_flag_90d", 0), c.get("investment_inquiry_flag_90d", 0),
            c.get("campaign_reject_cnt_180d", 0), c.get("card_reject_flag_90d", 0), c.get("complaint_flag_180d", 0),
            fatigue, c.get("preferred_channel", "영업점"),
            llm_json,
        ))

    conn.executemany(INSERT_SQL, rows)
    conn.commit()
    print(f"Feature Mart 적재 완료: {len(rows)}명")

    run_quality_checks(conn)
    conn.close()

    print("\n=== 샘플 출력 (C001, C003, DEMO-2) ===")
    _print_sample(["C001", "C003", "DEMO-2"])


def _print_sample(cust_ids: list[str]) -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    for cid in cust_ids:
        row = conn.execute(
            "SELECT llm_input_json FROM customer_rfmpc_feature_mart WHERE cust_id=? AND base_date=?",
            (cid, BASE_DATE),
        ).fetchone()
        if row:
            data = json.loads(row["llm_input_json"])
            print(f"\n--- {cid} ---")
            print(json.dumps(data, ensure_ascii=False, indent=2))
    conn.close()


if __name__ == "__main__":
    main()
