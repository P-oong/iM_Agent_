"""
RAW 원천 테이블 합성 데이터 생성 스크립트
고객 프로파일 기반으로 180일치 현실적인 원천 데이터를 생성합니다.
실행: python db/seed_raw.py
"""

import json
import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

random.seed(42)

DB_PATH = Path(__file__).parent / "im_bank.db"
TODAY = date.today()

# ── 상품명 → RAW 카테고리 매핑 ─────────────────────────────────────────────

PRODUCT_CATEGORY_MAP = {
    "수시입출금": "DEMAND_DEPOSIT",
    "자유적금": "SAVINGS",
    "정기예금": "DEPOSIT",
    "청약": "SAVINGS",
    "iM청약통장": "SAVINGS",
    "신용카드": "CREDIT_CARD",
    "체크카드": "CHECK_CARD",
    "대출": "LOAN",
    "주택담보대출": "LOAN",
    "신용대출": "LOAN",
    "ISA": "ISA",
    "펀드": "FUND",
    "변액보험": "INSURANCE",
    "외화예금": "FX_ACCOUNT",
    "외화예금 (USD)": "FX_ACCOUNT",
    "외화예금 (EUR)": "FX_ACCOUNT",
    "퇴직연금": "RETIREMENT",
    "법인당좌예금": "BUSINESS_ACCOUNT",
    "기업자유적금": "SAVINGS",
    "무역금융": "TRADE_FINANCE",
    "사업자통장": "BUSINESS_ACCOUNT",
    "사업자카드": "CREDIT_CARD",
    "법인카드": "CREDIT_CARD",
    "법인 입출금통장": "BUSINESS_ACCOUNT",
    "가맹점(카드)": "MERCHANT_ACCOUNT",
    "가맹점(VAN·카드)": "MERCHANT_ACCOUNT",
    "결제계좌(당행)": "MERCHANT_ACCOUNT",
    "결제계좌(타행)": "DEMAND_DEPOSIT",
    "B2B전자결제": "MERCHANT_ACCOUNT",
    "인터넷뱅킹": "DEMAND_DEPOSIT",
    "개업초기": "BUSINESS_ACCOUNT",
    "온라인(배민·쿠팡)": "MERCHANT_ACCOUNT",
}

# 만기 생성이 필요한 카테고리 (개월 수 범위)
MATURITY_MONTHS = {
    "SAVINGS": (6, 36),
    "DEPOSIT": (3, 24),
}

# 고객별 상담 주제 매핑 (notes 기반)
CONTACT_PROFILES = {
    "C001": [("주택구입 문의", "LOAN", "관심"), ("신용카드 안내", "CARD", "보류")],
    "C002": [("ISA 계좌 문의", "ISA", "관심"), ("청약 일정 확인", "SAVINGS", "관심")],
    "C003": [("신용대출 문의", "LOAN", "관심"), ("가맹점 정산 문의", "MERCHANT_ACCOUNT", "관심")],
    "C004": [("ISA 개설 문의", "ISA", "관심"), ("펀드 안내", "FUND", "보류")],
    "C005": [("ISA 추가납입 문의", "ISA", "관심"), ("신탁 상품 문의", "FUND", "관심"), ("세금 절감 상담", "INVESTMENT", "관심")],
    "C006": [("설비대출 문의", "LOAN", "관심"), ("법인카드 한도 상향", "CARD", "가입"), ("퇴직연금 문의", "INVESTMENT", "관심")],
    "C007": [("외환 헤지 문의", "FX", "관심"), ("운전자금 한도 문의", "LOAN", "관심")],
    "C008": [("소자본 대출 문의", "LOAN", "관심"), ("사업자카드 혜택 문의", "CARD", "거절"), ("노란우산 공제 안내", "INVESTMENT", "관심")],
    "C009": [("정기예금 만기 상담", "DEPOSIT", "관심"), ("ISA 개설 문의", "ISA", "가입"), ("IRP 세액공제 문의", "INVESTMENT", "관심")],
    "C010": [("결제계좌 당행 이전 안내", "MERCHANT_ACCOUNT", "관심"), ("노란우산 공제 안내", "INVESTMENT", "보류")],
    "DEMO-1": [("이체한도 상향 요청", "DEPOSIT", "가입"), ("급여이체 안내", "DEPOSIT", "관심")],
    "DEMO-2": [
        ("사업자대출 금리 문의",     "LOAN",              "관심"),
        ("운전자금 한도 상담",        "LOAN",              "관심"),
        ("가맹점 정산 이전 문의",     "MERCHANT_ACCOUNT",  "관심"),
        ("거래내역 발급",            "DEPOSIT",            "가입"),
    ],
    "DEMO-3": [("법인 OTP 재발급", "DEPOSIT", "가입"), ("이체한도 변경", "DEPOSIT", "가입"), ("법인카드 안내", "CARD", "관심")],
}

# 리스크 등급 매핑
def _risk_grade(credit_score: int) -> str:
    if credit_score >= 900:
        return "저위험"
    if credit_score >= 750:
        return "중저위험"
    if credit_score >= 650:
        return "중위험"
    return "고위험"

# 영업점 코드 매핑 (데모용)
BRANCH_MAP = {
    "VIP": "강남금융센터",
    "우량": "대구본점영업부",
    "일반": "월배영업부",
    "관리": "동대구영업부",
}


def _days_ago(n: int) -> str:
    return (TODAY - timedelta(days=n)).isoformat()


def _random_date(days_min: int, days_max: int) -> str:
    d = random.randint(days_min, days_max)
    return _days_ago(d)


def _maturity_date_from(open_days_ago: int, months: int) -> str:
    open_d = TODAY - timedelta(days=open_days_ago)
    mat_d = open_d + timedelta(days=months * 30)
    return mat_d.isoformat()


# ── RAW 테이블 초기화 ────────────────────────────────────────────────────────

RAW_TABLES = [
    "raw_digital_logs",
    "raw_crm_contacts",
    "raw_card_transactions",
    "raw_product_holdings",
    "raw_transactions",
    "raw_customer",
    "customer_rfmpc_feature_mart",
]

def reset_raw_tables(conn: sqlite3.Connection) -> None:
    for t in RAW_TABLES:
        conn.execute(f"DROP TABLE IF EXISTS {t}")
    schema_path = Path(__file__).parent / "schema.sql"
    with open(schema_path, encoding="utf-8") as f:
        conn.executescript(f.read())
    print("RAW 테이블 초기화 완료")


# ── raw_customer 적재 ────────────────────────────────────────────────────────

def seed_raw_customer(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT customer_id, age, gender, customer_type, job, grade, credit_score FROM customers"
    ).fetchall()
    customers = []
    for r in rows:
        cid, age, gender, ctype, job, grade, credit = r
        customers.append({
            "cust_id": cid, "age": age, "gender": gender,
            "customer_type": ctype, "job": job, "grade": grade, "credit_score": credit,
        })
        conn.execute(
            "INSERT INTO raw_customer VALUES (?,?,?,?,?,?,?)",
            (cid, age, gender, ctype, job, _risk_grade(credit), BRANCH_MAP.get(grade, "월배영업부")),
        )
    print(f"raw_customer {len(customers)}명 적재")
    return customers


# ── raw_product_holdings 적재 ─────────────────────────────────────────────────

def seed_raw_product_holdings(conn: sqlite3.Connection) -> None:
    accounts = conn.execute(
        "SELECT customer_id, account_number, product, balance, status FROM accounts"
    ).fetchall()
    for cid, acct_no, product, balance, status in accounts:
        cat = PRODUCT_CATEGORY_MAP.get(product, "DEMAND_DEPOSIT")
        open_days = random.randint(60, 720)
        open_date = _days_ago(open_days)
        maturity_date = None
        if cat in MATURITY_MONTHS:
            months = random.randint(*MATURITY_MONTHS[cat])
            maturity_date = _maturity_date_from(open_days, months)
        raw_status = "ACTIVE" if status == "정상" else ("CLOSED" if status == "해지" else "MATURED")
        conn.execute(
            """INSERT INTO raw_product_holdings
               (cust_id, product_code, product_category, open_date, maturity_date, balance, status)
               VALUES (?,?,?,?,?,?,?)""",
            (cid, product, cat, open_date, maturity_date, balance, raw_status),
        )

    # 일부 고객에게 만기 임박 상품 추가 (60일 이내 만기 시나리오)
    soon_maturity_customers = ["C002", "C009"]
    for cid in soon_maturity_customers:
        days_until = random.randint(10, 55)
        mat_date = (TODAY + timedelta(days=days_until)).isoformat()
        open_date = _days_ago(365)
        conn.execute(
            """INSERT INTO raw_product_holdings
               (cust_id, product_code, product_category, open_date, maturity_date, balance, status)
               VALUES (?,?,?,?,?,?,?)""",
            (cid, "정기예금(만기임박)", "DEPOSIT", open_date, mat_date, random.randint(5_000_000, 30_000_000), "ACTIVE"),
        )

    # 일부 고객에게 대출 만기 임박 추가
    loan_maturity_customers = ["C003", "C008"]
    for cid in loan_maturity_customers:
        days_until = random.randint(20, 58)
        mat_date = (TODAY + timedelta(days=days_until)).isoformat()
        open_date = _days_ago(700)
        conn.execute(
            """INSERT INTO raw_product_holdings
               (cust_id, product_code, product_category, open_date, maturity_date, balance, status)
               VALUES (?,?,?,?,?,?,?)""",
            (cid, "신용대출(만기임박)", "LOAN", open_date, mat_date, random.randint(10_000_000, 50_000_000), "ACTIVE"),
        )

    # ── 시연 고객 DEMO-2 (박성호, 개인사업자) 시나리오 강제 ─────────────────────
    # 1) 사업자대출 만기 D-58 (개업 후 운전자금 대출)
    demo2_open = _days_ago(540)
    demo2_loan_mat = (TODAY + timedelta(days=58)).isoformat()
    conn.execute(
        """INSERT INTO raw_product_holdings
           (cust_id, product_code, product_category, open_date, maturity_date, balance, status)
           VALUES (?,?,?,?,?,?,?)""",
        ("DEMO-2", "사업자운전자금대출", "LOAN", demo2_open, demo2_loan_mat, 35_000_000, "ACTIVE"),
    )
    # 2) 사업자통장 (BUSINESS_ACCOUNT) - 마스터에 이미 있지만 RAW에 없을 경우 보강
    conn.execute(
        """INSERT INTO raw_product_holdings
           (cust_id, product_code, product_category, open_date, maturity_date, balance, status)
           VALUES (?,?,?,?,?,?,?)""",
        ("DEMO-2", "사업자통장(추가)", "BUSINESS_ACCOUNT", _days_ago(800), None, 8_200_000, "ACTIVE"),
    )
    print(f"raw_product_holdings 적재 완료")


# ── raw_transactions 생성 ─────────────────────────────────────────────────────

def _txn(cid, acct, date_str, txn_type, amount, channel, counterparty, memo):
    return (cid, acct, date_str, txn_type, amount, counterparty, channel, memo)


def _generate_personal_txns(c: dict) -> list:
    """개인 고객 거래 생성"""
    cid = c["cust_id"]
    monthly_income = c.get("annual_income", 4000) * 10000 / 12
    txns = []
    channels = ["MOBILE"] * 5 + ["ATM"] * 3 + ["INTERNET"] * 2 + ["BRANCH"] * 1

    for month_back in range(6):
        base_day = TODAY - timedelta(days=month_back * 30)
        # 급여 입금 (25일 전후)
        salary_day = (base_day.replace(day=1) + timedelta(days=24)).isoformat()
        txns.append(_txn(cid, f"{cid}-DDA", salary_day, "DEPOSIT",
                         round(monthly_income * random.uniform(0.95, 1.05), -3),
                         "INTERNET", "타행", "급여입금"))
        # 월세/공과금 (1일 자동이체)
        bill_day = (base_day.replace(day=1)).isoformat()
        txns.append(_txn(cid, f"{cid}-DDA", bill_day, "AUTO_DEBIT",
                         random.randint(300_000, 1_200_000), "INTERNET", None, "공과금 자동이체"))
        # ATM 출금 (주 1~2회)
        for _ in range(random.randint(4, 8)):
            day = (base_day - timedelta(days=random.randint(0, 29))).isoformat()
            txns.append(_txn(cid, f"{cid}-DDA", day, "WITHDRAWAL",
                             random.randint(100_000, 500_000), "ATM", None, "ATM 출금"))
        # 이체 (주 1~3회)
        for _ in range(random.randint(4, 12)):
            day = (base_day - timedelta(days=random.randint(0, 29))).isoformat()
            is_in = random.random() < 0.4
            txns.append(_txn(cid, f"{cid}-DDA", day,
                             "TRANSFER_IN" if is_in else "TRANSFER_OUT",
                             random.randint(50_000, 2_000_000),
                             random.choice(channels), "타행" if is_in else None,
                             "이체입금" if is_in else "이체출금"))
    return txns


def _generate_selfemployed_txns(c: dict) -> list:
    """개인사업자 거래 생성 - 카드매출 입금, 매입, 임대료 등"""
    cid = c["cust_id"]
    monthly_revenue = c.get("annual_income", 6000) * 10000 / 12
    txns = []

    for month_back in range(6):
        base_day = TODAY - timedelta(days=month_back * 30)
        # 카드 매출 입금 (주 2~3회, 각 회 일일 매출)
        for _ in range(random.randint(8, 14)):
            day = (base_day - timedelta(days=random.randint(0, 29))).isoformat()
            daily_sales = monthly_revenue / 25 * random.uniform(0.6, 1.8)
            txns.append(_txn(cid, f"{cid}-BIZ", day, "DEPOSIT",
                             round(daily_sales, -3), "INTERNET", "카드사", "카드매출 정산입금"))
        # 원재료/매입 비용 (주 1~2회)
        for _ in range(random.randint(4, 8)):
            day = (base_day - timedelta(days=random.randint(0, 29))).isoformat()
            txns.append(_txn(cid, f"{cid}-BIZ", day, "TRANSFER_OUT",
                             random.randint(500_000, 5_000_000), "INTERNET", None, "매입 대금"))
        # 임대료 (1일)
        rent_day = (base_day.replace(day=1)).isoformat()
        txns.append(_txn(cid, f"{cid}-BIZ", rent_day, "AUTO_DEBIT",
                         random.randint(800_000, 3_000_000), "INTERNET", None, "임대료 이체"))
        # 인건비 (25일)
        payroll_day = (base_day.replace(day=1) + timedelta(days=24)).isoformat()
        if c.get("annual_income", 0) > 5000:
            txns.append(_txn(cid, f"{cid}-BIZ", payroll_day, "TRANSFER_OUT",
                             random.randint(2_000_000, 10_000_000), "INTERNET", None, "직원 급여"))
    return txns


def _generate_corporate_txns(c: dict) -> list:
    """법인 거래 생성 - 대규모 입출금"""
    cid = c["cust_id"]
    monthly_revenue = c.get("annual_income", 100000) * 10000 / 12
    txns = []

    for month_back in range(6):
        base_day = TODAY - timedelta(days=month_back * 30)
        # 매출 입금 (주 1~2회, 대규모)
        for _ in range(random.randint(3, 6)):
            day = (base_day - timedelta(days=random.randint(0, 29))).isoformat()
            txns.append(_txn(cid, f"{cid}-CORP", day, "DEPOSIT",
                             round(monthly_revenue / 4 * random.uniform(0.5, 1.8), -4),
                             "INTERNET", "타행", "매출 대금 입금"))
        # 원자재/매입 (주 1~2회)
        for _ in range(random.randint(2, 5)):
            day = (base_day - timedelta(days=random.randint(0, 29))).isoformat()
            txns.append(_txn(cid, f"{cid}-CORP", day, "TRANSFER_OUT",
                             round(monthly_revenue / 6 * random.uniform(0.4, 1.5), -4),
                             "INTERNET", None, "원자재 대금 이체"))
        # 급여 일괄 이체 (25일)
        payroll_day = (base_day.replace(day=1) + timedelta(days=24)).isoformat()
        txns.append(_txn(cid, f"{cid}-CORP", payroll_day, "TRANSFER_OUT",
                         round(monthly_revenue * 0.15 * random.uniform(0.9, 1.1), -4),
                         "INTERNET", None, "급여 일괄 이체"))
        # 세금 납부
        tax_day = (base_day.replace(day=10)).isoformat()
        txns.append(_txn(cid, f"{cid}-CORP", tax_day, "AUTO_DEBIT",
                         round(monthly_revenue * 0.05, -4), "INTERNET", None, "법인세/부가세 납부"))
    return txns


def seed_raw_transactions(conn: sqlite3.Connection, customers: list[dict]) -> None:
    all_txns = []
    for c in customers:
        ctype = c["customer_type"]
        if ctype == "개인":
            txns = _generate_personal_txns(c)
        elif ctype == "개인사업자":
            txns = _generate_selfemployed_txns(c)
        else:
            txns = _generate_corporate_txns(c)
        all_txns.extend(txns)

    conn.executemany(
        """INSERT INTO raw_transactions
           (cust_id, account_id, txn_date, txn_type, amount, counterparty_bank, channel, memo)
           VALUES (?,?,?,?,?,?,?,?)""",
        all_txns,
    )
    print(f"raw_transactions {len(all_txns)}건 생성")


# ── raw_card_transactions 생성 ────────────────────────────────────────────────

MERCHANT_CATS = ["음식점", "쇼핑", "교통", "의료", "교육", "여행", "공과금", "편의점", "온라인"]


def seed_raw_card_transactions(conn: sqlite3.Connection, customers: list[dict]) -> None:
    rows = []
    for c in customers:
        cid = c["cust_id"]
        annual = c.get("annual_income", 3000)  # 만원
        # 월 카드 소비 = 연소득의 15~25%
        monthly_spend = annual * 10000 * random.uniform(0.15, 0.25) / 12
        has_own_card = c["customer_type"] in ("개인사업자", "법인") or random.random() > 0.3

        for day_back in range(90):
            d = TODAY - timedelta(days=day_back)
            # 약 2~5회/주 카드 사용
            if random.random() < 0.35:
                amt = monthly_spend / 20 * random.uniform(0.3, 2.5)
                rows.append((
                    cid, f"{cid}-CARD01", d.isoformat(),
                    round(amt, -2), random.choice(MERCHANT_CATS),
                    1 if has_own_card else 0,
                ))
    conn.executemany(
        "INSERT INTO raw_card_transactions (cust_id, card_id, approved_date, amount, merchant_category, is_own_bank_card) VALUES (?,?,?,?,?,?)",
        rows,
    )
    print(f"raw_card_transactions {len(rows)}건 생성")


# ── raw_crm_contacts 생성 ─────────────────────────────────────────────────────

def seed_raw_crm_contacts(conn: sqlite3.Connection, customers: list[dict]) -> None:
    rows = []
    for c in customers:
        cid = c["cust_id"]
        contacts = CONTACT_PROFILES.get(cid, [])

        for i, (topic, prod_cat, result) in enumerate(contacts):
            # 최근 90일 내 분산 배치
            days_ago = random.randint(3, 88)
            channel = "영업점" if result == "가입" else random.choice(["영업점", "콜센터", "모바일"])
            rows.append((
                cid, _days_ago(days_ago), channel, topic,
                f"{topic} 관련 고객 문의", result, prod_cat,
            ))

        # 민원 고객 (C003만 민원 있음)
        if cid == "C003":
            rows.append((
                cid, _days_ago(random.randint(30, 160)), "콜센터",
                "수수료 민원", "ATM 수수료 과다 부과 민원", "보류", "COMPLAINT",
            ))
        # 캠페인 거절 추가 (C008은 카드 거절)
        if cid == "C008":
            rows.append((
                cid, _days_ago(random.randint(10, 85)), "영업점",
                "신용카드 발급 거절", "신용카드 발급 거절 (신용점수 부족)", "거절", "CARD",
            ))

    conn.executemany(
        "INSERT INTO raw_crm_contacts (cust_id, contact_date, channel, topic, memo, result, product_category) VALUES (?,?,?,?,?,?,?)",
        rows,
    )
    print(f"raw_crm_contacts {len(rows)}건 생성")


# ── raw_digital_logs 생성 ─────────────────────────────────────────────────────

DIGITAL_FREQ = {"high": 0.7, "medium": 0.35, "low": 0.1}
PAGE_VIEWS = {
    "C001": [("PRODUCT_PAGE_VIEW", "LOAN", "주택담보대출 상품 페이지")],
    "C002": [("PRODUCT_PAGE_VIEW", "ISA", "ISA 상품 안내"), ("RATE_INQUIRY", "SAVINGS", "청약 금리 조회")],
    "C004": [("PRODUCT_PAGE_VIEW", "ISA", "ISA 가입 안내"), ("CALCULATOR", "SAVINGS", "적금 계산기")],
    "C005": [("PRODUCT_PAGE_VIEW", "FUND", "펀드 상품 조회"), ("RATE_INQUIRY", "DEPOSIT", "정기예금 금리 조회")],
    "C009": [("PRODUCT_PAGE_VIEW", "ISA", "ISA 개설 안내"), ("RATE_INQUIRY", "DEPOSIT", "예금 금리 조회")],
    "DEMO-2": [
        ("PRODUCT_PAGE_VIEW", "LOAN", "사업자대출 상품 페이지"),
        ("RATE_INQUIRY",      "LOAN", "사업자대출 금리 조회"),
        ("CALCULATOR",        "LOAN", "대출 한도 계산기"),
    ],
}


def seed_raw_digital_logs(conn: sqlite3.Connection, customers: list[dict]) -> None:
    rows = []
    for c in customers:
        cid = c["cust_id"]
        engagement = c.get("digital_engagement", "medium") if "digital_engagement" in c else "medium"
        # customers 테이블에서 digital_engagement 조회
        freq = DIGITAL_FREQ.get(engagement, 0.35)

        for day_back in range(60):
            d = TODAY - timedelta(days=day_back)
            if random.random() < freq:
                # 로그인
                rows.append((cid, f"{d.isoformat()} {random.randint(8,22):02d}:{random.randint(0,59):02d}:00",
                              "LOGIN", None, "메인화면"))
                # 상품 페이지 뷰
                if random.random() < 0.3:
                    extra = PAGE_VIEWS.get(cid, [("PRODUCT_PAGE_VIEW", "DEPOSIT", "예금 상품 안내")])
                    etype, pcat, pname = random.choice(extra)
                    rows.append((cid, f"{d.isoformat()} {random.randint(8,22):02d}:{random.randint(0,59):02d}:30",
                                 etype, pcat, pname))

    # ── 시연 고객 DEMO-2: 대출 페이지 조회를 최근 30일 내 강제 5회 보장 ──────────
    demo2_loan_views = [
        ("PRODUCT_PAGE_VIEW", "LOAN", "사업자대출 상품 페이지"),
        ("RATE_INQUIRY",      "LOAN", "사업자대출 금리 조회"),
        ("CALCULATOR",        "LOAN", "대출 한도 계산기"),
        ("RATE_INQUIRY",      "LOAN", "운전자금 대출 금리 조회"),
        ("PRODUCT_PAGE_VIEW", "LOAN", "사업자 운전자금 안내"),
    ]
    for i, (etype, pcat, pname) in enumerate(demo2_loan_views):
        d = TODAY - timedelta(days=random.randint(2, 28))
        rows.append((
            "DEMO-2",
            f"{d.isoformat()} {random.randint(9,21):02d}:{random.randint(0,59):02d}:{random.randint(0,59):02d}",
            etype, pcat, pname,
        ))

    conn.executemany(
        "INSERT INTO raw_digital_logs (cust_id, event_time, event_type, product_category, page_name) VALUES (?,?,?,?,?)",
        rows,
    )
    print(f"raw_digital_logs {len(rows)}건 생성")


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main() -> None:
    conn = sqlite3.connect(DB_PATH)

    print("=== RAW 테이블 초기화 ===")
    reset_raw_tables(conn)

    print("\n=== RAW 데이터 적재 ===")
    customers = seed_raw_customer(conn)

    # customers 테이블에서 추가 정보 조회 (digital_engagement 등)
    rows = conn.execute(
        "SELECT customer_id, annual_income, digital_engagement, customer_type, grade, credit_score FROM customers"
    ).fetchall()
    customer_detail = {r[0]: {"annual_income": r[1], "digital_engagement": r[2],
                               "customer_type": r[3], "grade": r[4], "credit_score": r[5]} for r in rows}
    for c in customers:
        c.update(customer_detail.get(c["cust_id"], {}))

    seed_raw_product_holdings(conn)
    seed_raw_transactions(conn, customers)
    seed_raw_card_transactions(conn, customers)
    seed_raw_crm_contacts(conn, customers)
    seed_raw_digital_logs(conn, customers)

    conn.commit()
    conn.close()
    print("\n=== RAW 데이터 생성 완료 ===")


if __name__ == "__main__":
    main()
