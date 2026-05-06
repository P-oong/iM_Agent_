"""Policy RAG 서비스 - 상품 ID 기반 문서 검색 (파일 기반 MVP)"""

from __future__ import annotations

import json
from pathlib import Path


def _load_policy_index(data_dir: Path) -> list[dict]:
    index_path = data_dir / "policy_docs" / "policy_index.json"
    if not index_path.exists():
        return []
    with open(index_path, encoding="utf-8") as f:
        return json.load(f)


def _load_doc_content(doc: dict, data_dir: Path) -> str:
    """개별 문서 txt 파일을 읽어 반환합니다."""
    file_path = data_dir / doc.get("file_path", "")
    if file_path.exists():
        return file_path.read_text(encoding="utf-8")
    return doc.get("summary", "")


def retrieve_policy_docs(
    product_id: str,
    data_dir: Path,
    query: str = "",
    top_k: int = 3,
) -> list[dict]:
    """
    상품 ID를 기준으로 관련 공문/정책 문서를 검색합니다.
    매핑된 문서가 없는 경우 키워드 기반 보완 검색을 수행합니다.

    Returns:
        각 dict에 doc_id, doc_title, doc_type, content, matched_reason 포함
    """
    docs = _load_policy_index(data_dir)

    # 1) 상품 ID 직접 매핑
    matched = [d for d in docs if product_id in d.get("linked_product_ids", [])]

    # 2) 키워드 보완 검색 (top_k 채우기용)
    if query and len(matched) < top_k:
        query_tokens = set(query.lower().split())
        extras = []
        for d in docs:
            if d in matched:
                continue
            text = f"{d['doc_title']} {d.get('summary', '')}".lower()
            score = sum(1 for t in query_tokens if t in text)
            if score > 0:
                extras.append((score, d))
        extras.sort(key=lambda x: x[0], reverse=True)
        matched += [d for _, d in extras[: top_k - len(matched)]]

    result = []
    for d in matched[:top_k]:
        content = _load_doc_content(d, data_dir)
        result.append({
            "doc_id":       d["doc_id"],
            "doc_title":    d["doc_title"],
            "doc_type":     d["doc_type"],
            "summary":      d.get("summary", ""),
            "content":      content,
            "matched_reason": f"상품 ID '{product_id}' 기반 연결 문서",
        })
    return result
