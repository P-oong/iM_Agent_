"""
iM Bank Demo DB - 초기 데이터 적재 스크립트
실행: python db/seed.py
"""

import json
import math
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "im_bank.db"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


# ── 헬퍼 ────────────────────────────────────────────────────────────────────

def _segment(customer_type: str, grade: str, age: int) -> str:
    if customer_type in ("법인",):
        return "corporate"
    if customer_type == "개인사업자":
        return "self_employed"
    if grade == "VIP" or grade == "우량":
        return "affluent"
    if age < 35:
        return "young_professional"
    if age < 55:
        return "family_builder"
    return "retiree"


def _life_stage(segment: str) -> str:
    return {
        "young_professional": "starter",
        "family_builder": "growth",
        "retiree": "retirement",
        "affluent": "expansion",
        "self_employed": "growth",
        "corporate": "expansion",
    }.get(segment, "growth")


def _primary_goal(total_assets: float, total_debt: float, age: int, grade: str, annual_income: float) -> str:
    if total_debt > total_assets:
        return "reduce_loan_cost"
    if age >= 55:
        return "protect_assets"
    if annual_income > 50_000 or grade == "VIP":
        return "grow_investments"
    return "build_savings"


def _preferred_channel(age: int) -> str:
    if age < 40:
        return "mobile"
    if age < 55:
        return "hybrid"
    return "branch"


def _digital_engagement(age: int) -> str:
    if age < 40:
        return "high"
    if age < 55:
        return "medium"
    return "low"


# ── 고객 데이터 ──────────────────────────────────────────────────────────────

RAW_CUSTOMERS = [
    # ── 개인 고객 ──
    dict(
        customer_id="C001", resident_id_front="010101",
        name="홍길동", age=34, gender="남", job="직장인 (IT 개발자)",
        customer_type="개인", annual_income=6800, credit_score=872,
        total_assets=23000, total_debt=5000, grade="VIP",
        products=["수시입출금", "자유적금"],
        accounts=[
            dict(number="013-00001-00001", product="자유적금",   balance=5_420_000, status="정상"),
            dict(number="013-00001-00002", product="수시입출금", balance=1_230_000, status="정상"),
        ],
        transactions=[
            dict(date="2026-01-12", desc="타행입금",    amount=3_000),
            dict(date="2026-01-10", desc="이체출금",    amount=-500_000),
            dict(date="2026-01-08", desc="급여입금",    amount=5_600_000),
            dict(date="2026-01-05", desc="ATM 출금",    amount=-300_000),
            dict(date="2026-01-01", desc="공과금 이체", amount=-120_000),
        ],
        notes="IT 대기업 재직 중. 결혼 2년차, 자녀 계획 있음. 주택 구입 관심 표명. 투자 경험 없음.",
    ),
    dict(
        customer_id="C002", resident_id_front="020202",
        name="이몽룡", age=39, gender="남", job="공무원 (행정직)",
        customer_type="개인", annual_income=5200, credit_score=911,
        total_assets=45000, total_debt=8500, grade="우량",
        products=["수시입출금", "신용카드", "자유적금", "청약"],
        accounts=[
            dict(number="013-00002-00001", product="신용카드",   balance=0,         status="정상"),
            dict(number="013-00002-00002", product="자유적금",   balance=8_100_000, status="정상"),
            dict(number="013-00002-00003", product="청약",       balance=2_400_000, status="정상"),
        ],
        transactions=[
            dict(date="2026-01-11", desc="카드 이용",  amount=-85_000),
            dict(date="2026-01-09", desc="급여입금",   amount=4_330_000),
            dict(date="2026-01-05", desc="ATM 출금",   amount=-200_000),
            dict(date="2025-12-28", desc="적금 납입",  amount=-500_000),
            dict(date="2025-12-25", desc="카드 이용",  amount=-230_000),
        ],
        notes="안정적인 공무원 수입. 자녀 2명(초등). 내년 아파트 청약 예정. 재테크 관심 높음. ISA 관련 문의 이력 있음.",
    ),
    dict(
        customer_id="C003", resident_id_front="030303",
        name="성춘향", age=49, gender="여", job="자영업 (공예 공방)",
        customer_type="개인사업자", annual_income=3800, credit_score=648,
        total_assets=12000, total_debt=15000, grade="일반",
        products=["수시입출금"],
        accounts=[
            dict(number="013-00003-00001", product="수시입출금", balance=450_000, status="정상"),
        ],
        transactions=[
            dict(date="2026-01-10", desc="카드 단말기 수수료", amount=-45_000),
            dict(date="2026-01-08", desc="재료비 이체",        amount=-1_200_000),
            dict(date="2026-01-05", desc="매출 입금",          amount=2_300_000),
            dict(date="2026-01-01", desc="임대료 이체",        amount=-800_000),
            dict(date="2025-12-28", desc="매출 입금",          amount=1_900_000),
        ],
        notes="부채가 자산 초과 상태. 신용대출 이력 있음. 사업 매출 변동성 큼. 노후 준비 거의 없음. 자녀 대학 입학 예정.",
    ),
    dict(
        customer_id="C004", resident_id_front="040404",
        name="심청", age=27, gender="여", job="사회초년생 (디자이너)",
        customer_type="개인", annual_income=3600, credit_score=740,
        total_assets=3500, total_debt=1200, grade="일반",
        products=["수시입출금", "체크카드"],
        accounts=[
            dict(number="013-00004-00001", product="수시입출금", balance=1_850_000, status="정상"),
            dict(number="013-00004-00002", product="체크카드",   balance=0,         status="정상"),
        ],
        transactions=[
            dict(date="2026-01-12", desc="급여입금",  amount=2_800_000),
            dict(date="2026-01-10", desc="월세 이체", amount=-650_000),
            dict(date="2026-01-08", desc="카드 이용", amount=-120_000),
            dict(date="2026-01-05", desc="카드 이용", amount=-55_000),
            dict(date="2026-01-01", desc="보험료",    amount=-89_000),
        ],
        notes="취업 2년차. 결혼 계획 없음. 재테크 시작 희망. 학자금 대출 상환 중. ISA·펀드 관심 표명.",
    ),
    dict(
        customer_id="C005", resident_id_front="050505",
        name="전우치", age=58, gender="남", job="은퇴 (전직 교수)",
        customer_type="개인", annual_income=4800, credit_score=955,
        total_assets=120000, total_debt=0, grade="VIP",
        products=["수시입출금", "정기예금", "신용카드", "펀드", "변액보험"],
        accounts=[
            dict(number="013-00005-00001", product="정기예금",   balance=50_000_000, status="정상"),
            dict(number="013-00005-00002", product="수시입출금", balance=8_500_000,  status="정상"),
            dict(number="013-00005-00003", product="펀드",       balance=24_000_000, status="정상"),
        ],
        transactions=[
            dict(date="2026-01-12", desc="연금 입금", amount=4_000_000),
            dict(date="2026-01-10", desc="증권 이체", amount=-3_000_000),
            dict(date="2026-01-08", desc="카드 이용", amount=-250_000),
            dict(date="2026-01-05", desc="의료비",    amount=-180_000),
            dict(date="2026-01-01", desc="펀드 수익", amount=650_000),
        ],
        notes="자녀 2명 모두 독립. 건강 이상 없음. 유산 계획 있음. 해외여행 잦음. ISA·신탁 상품 추가 관심. 세금 절감 방법 문의.",
    ),
    # ── 법인 고객 ──
    dict(
        customer_id="C006", resident_id_front="060606",
        name="김만덕", age=52, gender="여", job="법인 대표 (금속 부품 제조)",
        customer_type="법인", annual_income=128000, credit_score=843,
        total_assets=380000, total_debt=95000, grade="VIP",
        products=["법인당좌예금", "기업자유적금", "법인카드", "무역금융", "퇴직연금"],
        accounts=[
            dict(number="013-00006-00001", product="법인당좌예금", balance=42_000_000, status="정상"),
            dict(number="013-00006-00002", product="기업자유적금", balance=18_000_000, status="정상"),
            dict(number="013-00006-00003", product="무역금융",     balance=0,          status="정상"),
        ],
        transactions=[
            dict(date="2026-01-13", desc="원자재 대금 이체",    amount=-85_000_000),
            dict(date="2026-01-11", desc="수출 대금 입금",      amount=210_000_000),
            dict(date="2026-01-08", desc="급여 일괄 이체",      amount=-48_000_000),
            dict(date="2026-01-05", desc="설비 리스료",         amount=-3_200_000),
            dict(date="2026-01-01", desc="법인세 납부",         amount=-12_000_000),
        ],
        notes="제조업 중소기업. 직원 62명. 수출 비중 40%. 설비 증설 자금 대출 검토 중. 퇴직연금 운용 확대 관심. 법인카드 한도 상향 요청.",
    ),
    dict(
        customer_id="C007", resident_id_front="070707",
        name="장보고", age=45, gender="남", job="법인 대표 (글로벌 무역)",
        customer_type="법인", annual_income=320000, credit_score=892,
        total_assets=890000, total_debt=210000, grade="VIP",
        products=["법인당좌예금", "외화예금", "법인카드", "무역금융", "B2B전자결제", "퇴직연금"],
        accounts=[
            dict(number="013-00007-00001", product="법인당좌예금",    balance=150_000_000, status="정상"),
            dict(number="013-00007-00002", product="외화예금 (USD)",  balance=95_000_000,  status="정상"),
            dict(number="013-00007-00003", product="외화예금 (EUR)",  balance=38_000_000,  status="정상"),
        ],
        transactions=[
            dict(date="2026-01-14", desc="해외 송금 (中)",     amount=-320_000_000),
            dict(date="2026-01-12", desc="수입 대금 입금",     amount=680_000_000),
            dict(date="2026-01-09", desc="급여 일괄 이체",     amount=-95_000_000),
            dict(date="2026-01-06", desc="환전 (USD→KRW)",     amount=58_000_000),
            dict(date="2026-01-02", desc="무역보험료",         amount=-4_500_000),
        ],
        notes="수출입 전문 무역법인. 직원 140명. 미·중·유럽 거래처 보유. 외환 리스크 헤지 상품 관심. 운전자금 한도 증액 검토. 주거래 은행 전환 제안 수용적.",
    ),
    # ── 개인사업자 ──
    dict(
        customer_id="C008", resident_id_front="080808",
        name="박문수", age=47, gender="남", job="개인사업자 (한식당 운영)",
        customer_type="개인사업자", annual_income=9600, credit_score=712,
        total_assets=28000, total_debt=18000, grade="일반",
        products=["사업자통장", "수시입출금", "사업자카드", "가맹점(카드)", "결제계좌(당행)"],
        accounts=[
            dict(number="013-00008-00001", product="사업자통장",  balance=4_200_000, status="정상"),
            dict(number="013-00008-00002", product="수시입출금",  balance=880_000,   status="정상"),
        ],
        transactions=[
            dict(date="2026-01-13", desc="식재료 매입",        amount=-2_800_000),
            dict(date="2026-01-11", desc="카드 매출 입금",     amount=6_400_000),
            dict(date="2026-01-08", desc="임대료 이체",        amount=-1_500_000),
            dict(date="2026-01-05", desc="직원 급여",          amount=-2_100_000),
            dict(date="2026-01-01", desc="부가세 납부",        amount=-480_000),
        ],
        notes="3년차 한식당. 좌석 40석. 카드 매출 비중 70%. 시설 리모델링 소자본 대출 문의. 사업자 카드 혜택 개선 희망. 노란우산공제 미가입.",
    ),
    dict(
        customer_id="C009", resident_id_front="090909",
        name="허준", age=41, gender="남", job="개인사업자 (한의원 원장)",
        customer_type="개인사업자", annual_income=18000, credit_score=781,
        total_assets=65000, total_debt=22000, grade="우량",
        products=["사업자통장", "정기예금", "사업자카드", "수시입출금"],
        accounts=[
            dict(number="013-00009-00001", product="사업자통장",  balance=11_500_000, status="정상"),
            dict(number="013-00009-00002", product="정기예금",    balance=30_000_000, status="정상"),
        ],
        transactions=[
            dict(date="2026-01-13", desc="보험 청구 입금",     amount=8_200_000),
            dict(date="2026-01-11", desc="의료기기 리스료",    amount=-1_200_000),
            dict(date="2026-01-09", desc="직원 급여",          amount=-4_800_000),
            dict(date="2026-01-06", desc="카드 매출 입금",     amount=5_400_000),
            dict(date="2026-01-01", desc="임대료 이체",        amount=-2_200_000),
        ],
        notes="개원 6년차 한의원. 의료기기 최신 업그레이드 검토. 정기예금 만기 도래(3월). ISA 계좌 개설 관심. 노후 연금 상품 문의. 세금 절감 방법 적극 요청.",
    ),
    dict(
        customer_id="C010", resident_id_front="101010",
        name="한비즈", age=36, gender="여", job="개인사업자 (브런치카페)",
        customer_type="개인사업자", annual_income=4200, credit_score=748,
        total_assets=8500, total_debt=3500, grade="우량",
        products=["사업자통장", "사업자카드", "가맹점(VAN·카드)", "결제계좌(타행)", "개업초기", "온라인(배민·쿠팡)"],
        accounts=[
            dict(number="013-00010-00001", product="사업자통장", balance=2_100_000, status="정상"),
            dict(number="013-00010-00002", product="사업자카드", balance=0,          status="정상"),
        ],
        transactions=[
            dict(date="2026-01-14", desc="카드매출입금(타행)", amount=1_850_000),
            dict(date="2026-01-12", desc="원두·유가공 매입",  amount=-620_000),
            dict(date="2026-01-10", desc="배민정산입금",      amount=980_000),
            dict(date="2026-01-08", desc="임대료 이체",       amount=-1_100_000),
            dict(date="2026-01-05", desc="직원 급여",         amount=-1_400_000),
        ],
        notes="개업 4개월차 소형 카페. 카드·배민 매출은 타행 계좌로 입금 중. 노란우산·가맹점 결제계좌 당행 이전·네이버페이 커넥트·보증서 대출 연계가 핵심 제안 포인트.",
    ),
    # ── 시연 전용 고객 ──
    dict(
        customer_id="DEMO-1", resident_id_front="940301",
        name="김민지", age=32, gender="여", job="직장인",
        customer_type="개인", annual_income=3840, credit_score=741,
        total_assets=6800, total_debt=0, grade="일반",
        products=["수시입출금", "체크카드"],
        accounts=[
            dict(number="013-11001-00001", product="수시입출금", balance=5_800_000, status="정상"),
            dict(number="013-11001-00002", product="체크카드",   balance=0,         status="정상"),
        ],
        transactions=[
            dict(date="2026-04-28", desc="전세보증금 이체",   amount=-50_000_000),
            dict(date="2026-04-25", desc="타행 급여입금",     amount=3_200_000),
            dict(date="2026-04-20", desc="생활비 카드(타행)", amount=-950_000),
            dict(date="2026-04-15", desc="보험료 자동이체",   amount=-180_000),
        ],
        notes="전세 계약 예정. 급여·생활비 카드 모두 타행 중심. 이번 내점 목적: 전세보증금 이체한도 상향.",
    ),
    dict(
        customer_id="DEMO-2", resident_id_front="810502",
        name="박성호", age=45, gender="남", job="음식점 운영 (개인사업자)",
        customer_type="개인사업자", annual_income=45600, credit_score=698,
        total_assets=12000, total_debt=0, grade="일반",
        products=["사업자통장", "수시입출금"],
        accounts=[
            dict(number="013-12001-00001", product="사업자통장", balance=8_200_000, status="정상"),
        ],
        transactions=[
            dict(date="2026-04-28", desc="식자재 대금",        amount=-14_500_000),
            dict(date="2026-04-25", desc="카드매출입금(타행)", amount=27_000_000),
            dict(date="2026-04-20", desc="임대료 이체",        amount=-3_500_000),
            dict(date="2026-04-15", desc="인건비",             amount=-9_000_000),
        ],
        notes="월 매출 3,800만원. 카드매출 2,700만원이 타행으로 입금. 이번 내점 목적: 거래내역 발급(세무신고 추정).",
    ),
    dict(
        customer_id="DEMO-3", resident_id_front="660101",
        name="대구정밀부품(주)", age=0, gender="남", job="자동차 부품 제조업 (법인)",
        customer_type="법인", annual_income=576000, credit_score=812,
        total_assets=320000, total_debt=12000, grade="VIP",
        products=["법인 입출금통장", "인터넷뱅킹"],
        accounts=[
            dict(number="013-13001-00001", product="법인 입출금통장", balance=73_000_000, status="정상"),
        ],
        transactions=[
            dict(date="2026-04-28", desc="원자재 대금",   amount=-260_000_000),
            dict(date="2026-04-25", desc="매출 입금",     amount=480_000_000),
            dict(date="2026-04-20", desc="급여 일괄이체", amount=-95_000_000),
            dict(date="2026-04-15", desc="기존 대출 이자",amount=-1_200_000),
        ],
        notes="월 매출 4.8억. 직원 38명. 법인카드·CMS·급여이체 미이용. 이번 내점 목적: 법인 OTP 재발급 및 이체한도 변경.",
    ),
]

# ── 상품 마스터 ──────────────────────────────────────────────────────────────

RAW_PRODUCTS = [
    # 수신
    dict(
        product_id="P001", product_name="iM 자유적금", product_name_en="Free Savings",
        category="수신", sub_category="적금",
        target_types=["개인", "개인사업자"],
        min_age=18, max_age=65,
        target_segments=["young_professional", "family_builder", "self_employed"],
        priority_tags=["저축", "목돈마련", "디지털"],
        base_fit_score=62,
        customer_value="월 자유납입으로 목돈을 마련하는 적금 상품",
        description="월 1만~100만원 자유납입, 최대 연 3.5% 금리. 모바일 가입 시 우대금리 0.2%p.",
        requires_review=0,
    ),
    dict(
        product_id="P002", product_name="iM 정기예금", product_name_en="Time Deposit",
        category="수신", sub_category="예금",
        target_types=["개인", "개인사업자", "법인"],
        min_age=18, max_age=99,
        target_segments=["family_builder", "retiree", "affluent", "self_employed"],
        priority_tags=["안전자산", "금리", "만기관리"],
        base_fit_score=60,
        customer_value="안정적인 확정금리로 목돈을 운용하는 예금 상품",
        description="1개월~36개월 가입, 최대 연 3.8% 금리. 만기 자동갱신 설정 가능.",
        requires_review=0,
    ),
    dict(
        product_id="P003", product_name="iM 주택청약종합저축", product_name_en="Housing Subscription",
        category="수신", sub_category="청약",
        target_types=["개인"],
        min_age=19, max_age=50,
        target_segments=["young_professional", "family_builder"],
        priority_tags=["청약", "주택", "장기저축"],
        base_fit_score=58,
        customer_value="내 집 마련을 위한 청약 자격 적립 상품",
        description="매월 2~50만원 납입. 납입 기간·금액에 따라 청약 1순위 자격 부여.",
        requires_review=0,
    ),
    # 여신
    dict(
        product_id="P004", product_name="iM 주택담보대출", product_name_en="Mortgage Loan",
        category="여신", sub_category="주담대",
        target_types=["개인"],
        min_age=20, max_age=65,
        target_segments=["family_builder", "young_professional", "affluent"],
        priority_tags=["주택", "장기대출", "저금리"],
        base_fit_score=55,
        customer_value="내 집 마련 또는 전세자금을 위한 담보대출",
        description="담보인정비율(LTV) 최대 70%, 최저 연 3.9%. 신용점수 700 이상 우대금리 적용.",
        requires_review=1,
    ),
    dict(
        product_id="P005", product_name="iM 신용대출", product_name_en="Credit Loan",
        category="여신", sub_category="신용대출",
        target_types=["개인", "개인사업자"],
        min_age=20, max_age=60,
        target_segments=["young_professional", "family_builder", "self_employed"],
        priority_tags=["생활자금", "신용"],
        base_fit_score=50,
        customer_value="신용점수 기반 무담보 생활자금 대출",
        description="최대 1억원, 최저 연 4.5%. 신용점수 800 이상 한도 우대.",
        requires_review=1,
    ),
    dict(
        product_id="P006", product_name="iM 사업자대출 (소상공인)", product_name_en="SME Loan",
        category="여신", sub_category="사업자대출",
        target_types=["개인사업자"],
        min_age=20, max_age=65,
        target_segments=["self_employed"],
        priority_tags=["운전자금", "시설자금", "소상공인"],
        base_fit_score=55,
        customer_value="소상공인 시설·운전자금 전용 대출",
        description="최대 5억원, 보증서 연계 시 우대금리. 사업 1년 이상 필수.",
        requires_review=1,
    ),
    # 카드
    dict(
        product_id="P007", product_name="iM 라이프스타일 신용카드", product_name_en="Lifestyle Credit Card",
        category="카드", sub_category="신용카드",
        target_types=["개인"],
        min_age=20, max_age=99,
        target_segments=["young_professional", "affluent", "family_builder"],
        priority_tags=["혜택", "라이프스타일", "디지털"],
        base_fit_score=60,
        customer_value="쇼핑·외식·교통 혜택 중심의 라이프스타일 카드",
        description="전월 실적 30만원 이상 시 캐시백 최대 1.5%. OTT·배달 10% 할인.",
        requires_review=0,
    ),
    dict(
        product_id="P008", product_name="iM 사업자카드", product_name_en="Business Card",
        category="카드", sub_category="법인·사업자카드",
        target_types=["개인사업자", "법인"],
        min_age=20, max_age=99,
        target_segments=["self_employed", "corporate"],
        priority_tags=["경비처리", "사업자", "세금계산서"],
        base_fit_score=65,
        customer_value="사업 경비 자동 분류 및 세금계산서 연동 카드",
        description="전표 자동 분류, 부가세 신고 연동, 가맹점 수수료 우대.",
        requires_review=0,
    ),
    # 투자
    dict(
        product_id="P009", product_name="iM ISA (개인종합자산관리계좌)", product_name_en="ISA",
        category="투자", sub_category="ISA",
        target_types=["개인"],
        min_age=19, max_age=99,
        target_segments=["young_professional", "family_builder", "affluent", "self_employed"],
        priority_tags=["세금절감", "절세", "투자", "장기"],
        base_fit_score=65,
        customer_value="비과세 혜택으로 세금을 줄이며 투자하는 절세 계좌",
        description="연 2,000만원 한도, 의무가입 3년. 일반형 200만원·서민형 400만원 비과세.",
        requires_review=0,
    ),
    dict(
        product_id="P010", product_name="iM 펀드 (공모펀드)", product_name_en="Mutual Fund",
        category="투자", sub_category="펀드",
        target_types=["개인"],
        min_age=19, max_age=99,
        target_segments=["affluent", "family_builder", "retiree"],
        priority_tags=["투자", "수익", "분산투자"],
        base_fit_score=55,
        customer_value="전문가가 운용하는 분산투자 상품",
        description="국내외 주식·채권 펀드 200종 이상. 최소 가입금액 10만원.",
        requires_review=1,
    ),
    # 보험·연금
    dict(
        product_id="P011", product_name="iM 퇴직연금 (IRP)", product_name_en="IRP",
        category="퇴직연금", sub_category="IRP",
        target_types=["개인", "개인사업자"],
        min_age=18, max_age=70,
        target_segments=["family_builder", "affluent", "retiree", "self_employed"],
        priority_tags=["노후", "절세", "퇴직연금", "세액공제"],
        base_fit_score=60,
        customer_value="연말정산 세액공제(최대 148.5만원)를 받으며 노후를 준비",
        description="연 900만원 납입 한도, 세액공제율 13.2~16.5%. 55세 이후 연금 수령.",
        requires_review=0,
    ),
    dict(
        product_id="P012", product_name="노란우산공제", product_name_en="Yellow Umbrella",
        category="보험", sub_category="공제",
        target_types=["개인사업자"],
        min_age=20, max_age=65,
        target_segments=["self_employed"],
        priority_tags=["소상공인", "폐업보장", "절세"],
        base_fit_score=70,
        customer_value="소상공인 전용 폐업·노후 대비 공제 상품",
        description="월 5~100만원 납입. 소득공제 최대 500만원. 폐업·노령·사망 시 지급.",
        requires_review=0,
    ),
    # 기업·외환
    dict(
        product_id="P013", product_name="iM 외화예금", product_name_en="Foreign Currency Deposit",
        category="외환", sub_category="외화예금",
        target_types=["개인", "법인"],
        min_age=18, max_age=99,
        target_segments=["affluent", "corporate"],
        priority_tags=["환율", "외화", "해외"],
        base_fit_score=55,
        customer_value="달러·엔·유로 등 외화로 환율 리스크를 관리하는 예금",
        description="USD·JPY·EUR·CNY 등 12개 통화 지원. 수시 입출금 가능.",
        requires_review=0,
    ),
    dict(
        product_id="P014", product_name="iM 무역금융", product_name_en="Trade Finance",
        category="기업", sub_category="무역금융",
        target_types=["법인", "개인사업자"],
        min_age=20, max_age=99,
        target_segments=["corporate", "self_employed"],
        priority_tags=["수출", "수입", "무역", "L/C"],
        base_fit_score=60,
        customer_value="수출입 기업을 위한 신용장·무역금융 종합 서비스",
        description="수출환어음 매입, L/C 개설, 무역보험 연계. 전담 외환 데스크 지원.",
        requires_review=1,
    ),
    dict(
        product_id="P015", product_name="iM 기업대출 (운전·시설자금)", product_name_en="Corporate Loan",
        category="여신", sub_category="기업대출",
        target_types=["법인"],
        min_age=0, max_age=99,
        target_segments=["corporate"],
        priority_tags=["운전자금", "시설자금", "법인"],
        base_fit_score=62,
        customer_value="법인 운전·시설자금 전용 기업 대출",
        description="최대 50억원, 담보·보증서·신용 방식. 전담 기업금융 RM 배정.",
        requires_review=1,
    ),
    # ── 카드 (시연 강화: 박성호용) ─────────────────────────────────────────────
    dict(
        product_id="P016", product_name="iM i 카드", product_name_en="iM i Card",
        category="카드", sub_category="신용카드",
        target_types=["개인", "개인사업자"],
        min_age=20, max_age=99,
        target_segments=["young_professional", "family_builder", "self_employed"],
        priority_tags=["라이프스타일", "캐시백", "디지털", "전월실적"],
        base_fit_score=68,
        customer_value="iM뱅크 대표 라이프스타일 카드. 생활비 영역 통합 캐시백.",
        description="전월 실적 30만원 이상 시 생활비(마트·편의점·외식·교통) 0.7~1.5% 캐시백, OTT·배달 10% 할인. 연회비 1만원, 모바일 발급 시 첫 해 면제.",
        requires_review=0,
    ),
    dict(
        product_id="P017", product_name="BIZ 소호 카드", product_name_en="BIZ SOHO Card",
        category="카드", sub_category="사업자카드",
        target_types=["개인사업자"],
        min_age=20, max_age=99,
        target_segments=["self_employed"],
        priority_tags=["소상공인", "경비처리", "매입할인", "세무"],
        base_fit_score=78,
        customer_value="소상공인 전용 사업자 카드. 매입처 자동 분류 및 부가세 신고 연동.",
        description="식자재·POS·도매 업종 가맹점 0.5%p 추가 할인, 전표 자동 분류, 부가세 신고서 자동 생성. 연회비 2만원, 사업장 매출 100만원 이상 발생 시 면제.",
        requires_review=0,
    ),
    dict(
        product_id="P018", product_name="BIZ 플러스 카드", product_name_en="BIZ Plus Card",
        category="카드", sub_category="사업자카드",
        target_types=["개인사업자", "법인"],
        min_age=20, max_age=99,
        target_segments=["self_employed", "corporate"],
        priority_tags=["프리미엄", "경비처리", "한도우대", "공항라운지"],
        base_fit_score=72,
        customer_value="중·대형 사업자용 프리미엄 사업자카드. 한도·해외 우대.",
        description="연 매출 3억 이상 사업자 대상. 기본 한도 5천만원, 해외 가맹점 1.0% 적립, 국내·외 공항 라운지 연 6회. 연회비 10만원.",
        requires_review=0,
    ),
    # ── 여신 (시연 강화: 박성호용) ─────────────────────────────────────────────
    dict(
        product_id="P019", product_name="iM 소상공인 보증서 대출", product_name_en="SMB Guaranteed Loan",
        category="여신", sub_category="사업자대출",
        target_types=["개인사업자"],
        min_age=20, max_age=70,
        target_segments=["self_employed"],
        priority_tags=["보증서", "지역신보", "소상공인", "정책자금"],
        base_fit_score=82,
        customer_value="지역신용보증재단 보증서 연계 소상공인 대출. 신용점수 부족 고객도 한도 확보.",
        description="지역신보 보증비율 최대 90%, 한도 최대 3억원, 금리 연 4.2%~6.5%. 보증료 0.5~1.5% 별도. 사업 영위 6개월 이상.",
        requires_review=1,
    ),
    dict(
        product_id="P020", product_name="iM 개인사업자 특판 대출", product_name_en="SMB Special Loan",
        category="여신", sub_category="사업자대출",
        target_types=["개인사업자"],
        min_age=20, max_age=70,
        target_segments=["self_employed"],
        priority_tags=["특판", "운전자금", "만기연장", "우대금리"],
        base_fit_score=80,
        customer_value="기존 사업자대출 만기 임박 고객 대상 특판 우대 상품.",
        description="기존 사업자대출 만기 90일 전 ~ 연장 시 대상. 한도 최대 5억원, 금리 연 4.5%~6.0%, 일반 대비 0.4%p 우대. 운전자금 한정.",
        requires_review=1,
    ),
    dict(
        product_id="P021", product_name="iM 온누리 가맹점주 대출", product_name_en="Onnuri Merchant Loan",
        category="여신", sub_category="사업자대출",
        target_types=["개인사업자"],
        min_age=20, max_age=70,
        target_segments=["self_employed"],
        priority_tags=["전통시장", "온누리상품권", "가맹점주", "저금리"],
        base_fit_score=76,
        customer_value="전통시장·골목상권 온누리 가맹점주 전용 저금리 대출.",
        description="온누리상품권 가맹 등록 사업자 대상. 한도 최대 1억원, 금리 연 3.9%~5.5%(정책자금 연계), 거치 1년 가능. 가맹 인증서 필요.",
        requires_review=1,
    ),
    # ── 수신 (시연 강화: 박성호용 가맹점 결제계좌) ────────────────────────────
    dict(
        product_id="P022", product_name="iM 사업자 정산 통장", product_name_en="Merchant Settlement Account",
        category="수신", sub_category="가맹점 결제계좌",
        target_types=["개인사업자", "법인"],
        min_age=20, max_age=99,
        target_segments=["self_employed", "corporate"],
        priority_tags=["가맹점", "결제계좌", "정산", "수수료우대"],
        base_fit_score=80,
        customer_value="카드매출·PG 매출을 통합 정산하는 사업자 전용 수신 계좌.",
        description="카드사·PG사 정산 자동 입금, 정산 주기 D+1로 단축, 결제수수료 0.05%p 감면, 첫 3개월 정산 수수료 면제. 사업자등록증·가맹 계약서 필요.",
        requires_review=0,
    ),
]

# ── KPI 지표 ─────────────────────────────────────────────────────────────────

RAW_KPI = [
    dict(product_id="P001", kpi_score=72, revenue_score=65, strategic_score=75, retention_score=78),
    dict(product_id="P002", kpi_score=68, revenue_score=70, strategic_score=60, retention_score=74),
    dict(product_id="P003", kpi_score=74, revenue_score=60, strategic_score=82, retention_score=80),
    dict(product_id="P004", kpi_score=85, revenue_score=90, strategic_score=80, retention_score=85),
    dict(product_id="P005", kpi_score=78, revenue_score=82, strategic_score=72, retention_score=70),
    dict(product_id="P006", kpi_score=80, revenue_score=85, strategic_score=78, retention_score=72),
    dict(product_id="P007", kpi_score=70, revenue_score=72, strategic_score=68, retention_score=72),
    dict(product_id="P008", kpi_score=75, revenue_score=70, strategic_score=80, retention_score=75),
    dict(product_id="P009", kpi_score=82, revenue_score=70, strategic_score=90, retention_score=85),
    dict(product_id="P010", kpi_score=76, revenue_score=80, strategic_score=72, retention_score=76),
    dict(product_id="P011", kpi_score=83, revenue_score=75, strategic_score=88, retention_score=86),
    dict(product_id="P012", kpi_score=77, revenue_score=65, strategic_score=85, retention_score=80),
    dict(product_id="P013", kpi_score=65, revenue_score=68, strategic_score=62, retention_score=65),
    dict(product_id="P014", kpi_score=88, revenue_score=92, strategic_score=85, retention_score=82),
    dict(product_id="P015", kpi_score=90, revenue_score=95, strategic_score=88, retention_score=82),
    # ── 데모 강화 신규 상품 KPI ───────────────────────────────────────────────
    dict(product_id="P016", kpi_score=78, revenue_score=72, strategic_score=78, retention_score=80),  # iM i 카드
    dict(product_id="P017", kpi_score=88, revenue_score=82, strategic_score=92, retention_score=86),  # BIZ 소호 카드
    dict(product_id="P018", kpi_score=80, revenue_score=85, strategic_score=78, retention_score=75),  # BIZ 플러스 카드
    dict(product_id="P019", kpi_score=92, revenue_score=78, strategic_score=98, retention_score=90),  # 보증서 대출
    dict(product_id="P020", kpi_score=90, revenue_score=88, strategic_score=92, retention_score=88),  # 개인사업자 특판
    dict(product_id="P021", kpi_score=85, revenue_score=72, strategic_score=95, retention_score=82),  # 온누리 가맹점주
    dict(product_id="P022", kpi_score=86, revenue_score=80, strategic_score=90, retention_score=85),  # 사업자 정산 통장
]

# ── 상품 지식 문서 ───────────────────────────────────────────────────────────

RAW_DOCUMENTS = [
    dict(
        title="2026 봄 특판 적금 캠페인",
        summary="모바일 가입 시 iM 자유적금 우대금리 0.3%p 추가 제공. 사회초년생 첫 거래 고객 대상 스타벅스 쿠폰 증정.",
        channel_hint="mobile",
        tags=["적금", "특판", "MZ세대", "디지털"],
        related_product_ids=["P001"],
        valid_from="2026-03-01", valid_until="2026-06-30",
    ),
    dict(
        title="ISA 절세 혜택 집중 홍보 (5월)",
        summary="5월 종합소득세 신고 시즌 연계 ISA 계좌 개설 캠페인. 개설 고객 전원 OTT 구독권 1개월 증정.",
        channel_hint="all",
        tags=["ISA", "절세", "종합소득세", "소득공제"],
        related_product_ids=["P009"],
        valid_from="2026-04-15", valid_until="2026-05-31",
    ),
    dict(
        title="소상공인 노란우산 가입 지원 이벤트",
        summary="노란우산 신규 가입 소상공인 대상 가입비 면제 및 첫 달 납입금 2배 매칭 이벤트.",
        channel_hint="branch",
        tags=["소상공인", "노란우산", "공제", "개인사업자"],
        related_product_ids=["P012"],
        valid_from="2026-01-01", valid_until="2026-12-31",
    ),
    dict(
        title="IRP 세액공제 시즌 안내 (연말정산)",
        summary="IRP 납입액 최대 900만원, 세액공제 최대 148.5만원 환급 가능. 가입 절차 10분 이내.",
        channel_hint="all",
        tags=["IRP", "퇴직연금", "세액공제", "연말정산", "노후"],
        related_product_ids=["P011"],
        valid_from="2026-10-01", valid_until="2026-12-31",
    ),
    dict(
        title="법인 주거래 전환 패키지",
        summary="타행 주거래 법인 전환 시 기업대출 우대금리 0.5%p, 무역금융 수수료 30% 감면, 법인카드 한도 우대.",
        channel_hint="branch",
        tags=["법인", "주거래", "기업대출", "무역금융"],
        related_product_ids=["P014", "P015"],
        valid_from="2026-01-01", valid_until="2026-12-31",
    ),
    dict(
        title="청약통장 1순위 조건 안내",
        summary="아파트 청약 1순위 조건(납입 횟수·금액) 집중 안내. 미가입 고객 대상 가입 유도 캠페인.",
        channel_hint="all",
        tags=["청약", "주택", "1순위"],
        related_product_ids=["P003"],
        valid_from="2026-01-01", valid_until="2026-12-31",
    ),
    dict(
        title="주담대 금리 인하 특판 (봄 이사철)",
        summary="3~5월 이사철 한정, 신규 주택담보대출 금리 0.2%p 인하. 신용점수 750 이상 추가 우대.",
        channel_hint="branch",
        tags=["주담대", "이사철", "금리인하", "주택구입"],
        related_product_ids=["P004"],
        valid_from="2026-03-01", valid_until="2026-05-31",
    ),
    dict(
        title="사업자 카드 매출 당행 정산 이전 이벤트",
        summary="타행 정산 중인 카드 매출을 iM뱅크로 이전 시 결제 수수료 0.05%p 감면 및 3개월 정산 수수료 면제.",
        channel_hint="branch",
        tags=["사업자카드", "카드정산", "매출이전", "개인사업자"],
        related_product_ids=["P008"],
        valid_from="2026-01-01", valid_until="2026-12-31",
    ),
    # ── 데모 시연 강화 문서 ───────────────────────────────────────────────
    dict(
        title="2026 봄 BIZ 소호 카드 신규 발급 캠페인",
        summary="식자재·POS·도매 업종 사업자 대상 BIZ 소호 카드 신규 발급 시 첫 해 연회비 면제 + 매입처 0.5%p 추가 캐시백.",
        channel_hint="branch",
        tags=["BIZ소호", "사업자카드", "캐시백", "외식업"],
        related_product_ids=["P017"],
        valid_from="2026-04-01", valid_until="2026-06-30",
    ),
    dict(
        title="iM i 카드 모바일 발급 첫 해 연회비 면제",
        summary="iM뱅크 모바일 앱에서 iM i 카드 신규 발급 시 첫 해 연회비 1만원 면제 및 OTT 1개월 구독권 증정.",
        channel_hint="mobile",
        tags=["iM i카드", "라이프스타일", "연회비면제", "디지털"],
        related_product_ids=["P016"],
        valid_from="2026-03-01", valid_until="2026-12-31",
    ),
    dict(
        title="소상공인 보증서 대출 정책자금 한도 확대",
        summary="2026년 정책자금 연계 지역신보 보증서 대출 한도가 최대 3억원으로 상향. 보증료 일부 지원 병행.",
        channel_hint="branch",
        tags=["보증서대출", "지역신보", "정책자금", "소상공인"],
        related_product_ids=["P019"],
        valid_from="2026-04-01", valid_until="2026-12-31",
    ),
    dict(
        title="개인사업자 특판 대출 만기연장 우대 캠페인",
        summary="기존 사업자대출 만기 90일 이내 고객 대상 특판 우대금리 0.4%p, 연장 수수료 면제.",
        channel_hint="branch",
        tags=["특판대출", "만기연장", "운전자금", "우대금리"],
        related_product_ids=["P020", "P006"],
        valid_from="2026-05-01", valid_until="2026-08-31",
    ),
    dict(
        title="온누리 가맹점주 전용 저금리 대출 안내",
        summary="전통시장·골목상권 온누리 가맹점주 대상 저금리(연 3.9%~5.5%) 운전자금 대출. 거치 1년 가능.",
        channel_hint="branch",
        tags=["온누리", "전통시장", "가맹점주", "저금리"],
        related_product_ids=["P021"],
        valid_from="2026-01-01", valid_until="2026-12-31",
    ),
    dict(
        title="사업자 정산 통장 결제수수료 우대 이벤트",
        summary="카드매출·PG 매출 정산 계좌를 iM뱅크 사업자 정산 통장으로 이전 시 결제수수료 0.05%p 감면 + 첫 3개월 정산 수수료 면제.",
        channel_hint="branch",
        tags=["사업자정산", "가맹점결제", "수수료우대", "PG"],
        related_product_ids=["P022", "P017"],
        valid_from="2026-04-01", valid_until="2026-12-31",
    ),
    dict(
        title="노란우산공제 사업자 가입 지원 (소득공제 최대 600만원)",
        summary="개인사업자 노란우산공제 신규 가입 시 첫 달 납입금 매칭 지원. 연 소득공제 최대 600만원 활용 가능.",
        channel_hint="branch",
        tags=["노란우산", "소득공제", "소상공인", "절세"],
        related_product_ids=["P012"],
        valid_from="2026-01-01", valid_until="2026-12-31",
    ),
]


# ── DB 생성 메인 ──────────────────────────────────────────────────────────────

def create_db() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
        print(f"기존 DB 삭제: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    with open(SCHEMA_PATH, encoding="utf-8") as f:
        conn.executescript(f.read())
    print("스키마 생성 완료")

    # ── 고객 데이터 적재 ──
    for c in RAW_CUSTOMERS:
        seg = _segment(c["customer_type"], c["grade"], c["age"])
        ls = _life_stage(seg)
        pg = _primary_goal(c["total_assets"], c["total_debt"], c["age"], c["grade"], c["annual_income"])
        pc = _preferred_channel(c["age"])
        de = _digital_engagement(c["age"])
        mi = round(c["annual_income"] / 12, 2)

        conn.execute(
            """
            INSERT INTO customers (
                customer_id, resident_id_front, name, age, gender, job,
                customer_type, annual_income, credit_score, total_assets, total_debt,
                grade, notes, segment, life_stage, primary_goal,
                preferred_channel, digital_engagement, monthly_income
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                c["customer_id"], c["resident_id_front"], c["name"], c["age"], c["gender"], c["job"],
                c["customer_type"], c["annual_income"], c["credit_score"], c["total_assets"], c["total_debt"],
                c["grade"], c["notes"], seg, ls, pg, pc, de, mi,
            ),
        )

        for acc in c["accounts"]:
            conn.execute(
                "INSERT INTO accounts (customer_id, account_number, product, balance, status) VALUES (?,?,?,?,?)",
                (c["customer_id"], acc["number"], acc["product"], acc["balance"], acc["status"]),
            )

        for tx in c["transactions"]:
            conn.execute(
                "INSERT INTO transactions (customer_id, tx_date, description, amount) VALUES (?,?,?,?)",
                (c["customer_id"], tx["date"], tx["desc"], tx["amount"]),
            )

    print(f"고객 {len(RAW_CUSTOMERS)}명 적재 완료")

    # ── 상품 마스터 적재 ──
    for p in RAW_PRODUCTS:
        conn.execute(
            """
            INSERT INTO products (
                product_id, product_name, product_name_en, category, sub_category,
                target_types, min_age, max_age, target_segments, priority_tags,
                base_fit_score, customer_value, description, requires_review
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                p["product_id"], p["product_name"], p["product_name_en"],
                p["category"], p["sub_category"],
                json.dumps(p["target_types"], ensure_ascii=False),
                p["min_age"], p["max_age"],
                json.dumps(p["target_segments"], ensure_ascii=False),
                json.dumps(p["priority_tags"], ensure_ascii=False),
                p["base_fit_score"], p["customer_value"], p["description"],
                p["requires_review"],
            ),
        )
    print(f"상품 {len(RAW_PRODUCTS)}개 적재 완료")

    # ── KPI 적재 ──
    for k in RAW_KPI:
        conn.execute(
            "INSERT INTO kpi_metrics VALUES (?,?,?,?,?)",
            (k["product_id"], k["kpi_score"], k["revenue_score"], k["strategic_score"], k["retention_score"]),
        )
    print(f"KPI {len(RAW_KPI)}건 적재 완료")

    # ── 문서 적재 ──
    for d in RAW_DOCUMENTS:
        conn.execute(
            """
            INSERT INTO product_documents (title, summary, channel_hint, tags, related_product_ids, valid_from, valid_until)
            VALUES (?,?,?,?,?,?,?)
            """,
            (
                d["title"], d["summary"], d["channel_hint"],
                json.dumps(d["tags"], ensure_ascii=False),
                json.dumps(d["related_product_ids"], ensure_ascii=False),
                d["valid_from"], d["valid_until"],
            ),
        )
    print(f"상품 지식 문서 {len(RAW_DOCUMENTS)}건 적재 완료")

    conn.commit()
    conn.close()
    print(f"\nDB 생성 완료: {DB_PATH}")


if __name__ == "__main__":
    create_db()
