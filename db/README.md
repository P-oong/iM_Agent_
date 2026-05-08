# iM Bank Demo DB

에이전트 서버(`agentserver`)와 프론트엔드가 공통으로 사용하는 **SQLite** 데이터베이스입니다.  
실제 운영 스키마가 아니라 **시연·개발용** 더미 데이터입니다.

## 디렉터리 구성

```
db/
├── im_bank.db           # SQLite 본체 (seed 후 생성·갱신)
├── schema.sql           # 테이블 정의
├── seed.py              # 마스터 적재 (고객 메타, products, KPI 마스터 등)
├── seed_raw.py          # raw_* 테이블용 합성 데이터 (약 180일 분량 트랜잭션 등)
├── build_feature_mart.py
│                        # raw → customer_rfmpc_feature_mart (llm_input_json 생성)
└── README.md
```

## 초기화 절차 (저장소 루트에서)

```powershell
python db/seed.py
python db/seed_raw.py
python db/build_feature_mart.py
```

Feature Mart 가 없으면 iM BRIDGE API/CLI 가 고객 분석 단계에서 실패합니다.  
`build_feature_mart.py` 는 **오늘 날짜(`base_date`)** 행을 생성합니다.

## 에이전트 서버와의 경로 연결

`agentserver/src/bank_sales_agent/config/settings.py` 에서 기본 DB 경로는 다음과 같습니다.

- 저장소 루트: `{repo}/db/im_bank.db`

Python에서 직접 열 때:

```python
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[N]  # N은 파일 위치에 맞게
DB_PATH = REPO_ROOT / "db" / "im_bank.db"
```

## 주요 테이블 (요약)

| 구분 | 테이블 예시 | 설명 |
|------|-------------|------|
| 마스터 | `customers`, `products`, `kpi_metrics`, … | 시연용 고객·상품·KPI 정의 |
| RAW | `raw_transactions`, `raw_crm_contacts`, `raw_product_holdings`, … | 합성 원천 이력 |
| 마트 | `customer_rfmpc_feature_mart` | 고객별 `llm_input_json` (RFM-PC, behavior/explainable signals) |

`products` / 문서 건수는 시연 상품 추가에 따라 늘어날 수 있습니다.  
시연 시나리오 고객: **`DEMO-2`** 등 (`seed.py` / `seed_raw.py` 참고).

## 상품 카테고리 (개략)

마스터 데이터는 **수신·여신·카드·투자(ISA/펀드)·퇴직연금·보험(노란우산 등)·외환** 등 복수 카테고리를 포함합니다.  
iM BRIDGE Router 의 7개 라벨(여신·수신·카드·방카·신탁·펀드·외환)은 LLM 분류 결과이며, DB `products.category` 문자열과 1:1이 아닐 수 있습니다.
