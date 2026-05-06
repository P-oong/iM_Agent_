# iM Bank Demo DB

에이전트 서버와 프론트엔드가 공통으로 사용하는 SQLite 데이터베이스입니다.

## 파일 구조

```
db/
├── im_bank.db      # SQLite DB 본체 (seed.py 실행 후 생성)
├── schema.sql      # 테이블 정의
├── seed.py         # 초기 데이터 적재 스크립트
└── README.md
```

## DB 초기화 방법

```bash
# 프로젝트 루트에서 실행
python db/seed.py
```

## 테이블 구성

| 테이블 | 설명 | 초기 데이터 |
|--------|------|------------|
| `customers` | 고객 기본 정보 (에이전트 분류 필드 포함) | 13명 (C001~C010, DEMO-1~3) |
| `accounts` | 고객 보유 계좌 | 27건 |
| `transactions` | 최근 거래 내역 | 62건 |
| `products` | 은행 상품 마스터 (15종) | 15개 |
| `kpi_metrics` | 상품별 KPI 지표 | 15건 |
| `product_documents` | 캠페인·이벤트 문서 | 8건 |
| `sales_opportunities` | 에이전트 분석 결과 저장 | 0건 (런타임 생성) |

## 상품 카테고리

- **수신**: iM 자유적금, iM 정기예금, iM 주택청약종합저축
- **여신**: iM 주택담보대출, iM 신용대출, iM 사업자대출, iM 기업대출
- **카드**: iM 라이프스타일 신용카드, iM 사업자카드
- **투자**: iM ISA, iM 펀드
- **퇴직연금**: iM 퇴직연금(IRP)
- **보험**: 노란우산공제
- **외환**: iM 외화예금
- **기업**: iM 무역금융

## 경로 참조 방법

```python
# agentserver (Python)
from pathlib import Path
DB_PATH = Path(__file__).resolve().parents[N] / "db" / "im_bank.db"
```
