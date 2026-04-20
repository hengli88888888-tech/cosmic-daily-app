#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RULE_LIBRARY = ROOT / "specs" / "knowledge-base" / "teacher-rule-library.json"
TRANSCRIPT_ROOTS = [
    ROOT / "data" / "raw-transcripts" / "文曾",
    ROOT / "data" / "raw-documents" / "文曾",
]
OUTPUT = ROOT / "specs" / "knowledge-base" / "chart-keyword-index.json"

KEYWORDS = {
    "year_pillar": ["年柱", "年干", "年支"],
    "month_pillar": ["月柱", "月干", "月支", "月令", "司令"],
    "day_pillar": ["日柱", "日干", "日支", "日主"],
    "hour_pillar": ["时柱", "时干", "时支", "子时", "早晚子时"],
    "dayun": ["大运", "起运", "顺排", "逆排"],
    "liunian": ["流年"],
    "liuyue": ["流月"],
    "liuri": ["流日"],
    "twelve_life_stages": ["十二长生", "长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"],
    "kongwang": ["空亡", "旬空"],
    "nayin": ["纳音"],
    "shensha": ["神煞", "天乙贵人", "桃花", "驿马", "华盖", "文昌贵人", "太极贵人", "羊刃", "魁罡", "十恶大败"],
}

REASONING_MARKERS = {
    "sequence": ["先看", "再看", "然后", "最后", "第一步", "第二步", "第三步"],
    "conditions": ["如果", "若", "则", "才", "只有", "前提", "条件"],
    "branching": ["主线", "干扰", "转线", "分叉", "降权", "退出当前主线"],
    "structure": ["成势", "会党", "叛党", "正局", "反局", "体用", "宾主", "做功", "合制", "墓制", "生化", "复合结构"],
    "application": ["落点", "应期", "职业", "婚姻", "健康", "学业", "事业", "车灾", "牢狱", "破产"],
}

SNIPPET_RADIUS = 48


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def build_snippets(text: str, terms: list[str], limit: int = 5) -> list[str]:
    snippets: list[str] = []
    seen: set[str] = set()
    for term in terms:
        for match in re.finditer(re.escape(term), text):
            start = max(0, match.start() - SNIPPET_RADIUS)
            end = min(len(text), match.end() + SNIPPET_RADIUS)
            snippet = clean_text(text[start:end])
            if snippet and snippet not in seen:
                seen.add(snippet)
                snippets.append(snippet)
            if len(snippets) >= limit:
                return snippets
    return snippets


def load_rule_library() -> dict:
    return json.loads(RULE_LIBRARY.read_text())


def collect_rule_hits() -> dict:
    library = load_rule_library()
    result: dict[str, dict] = {}
    teachers = library.get("teachers", [])
    for teacher_entry in teachers:
        for rule in teacher_entry.get("rules", []):
            corpus = " ".join(
                str(part)
                for part in [
                    rule.get("title"),
                    rule.get("claim"),
                    rule.get("interpretation"),
                    " ".join(rule.get("reasoning_path", []) or []),
                    " ".join(rule.get("branch_conditions", []) or []),
                    " ".join(rule.get("product_safe_advice", []) or []),
                ]
                if part
            )
            keyword_hits = {
                key: [term for term in terms if term in corpus]
                for key, terms in KEYWORDS.items()
            }
            keyword_hits = {k: v for k, v in keyword_hits.items() if v}
            reasoning_hits = {
                key: [term for term in terms if term in corpus]
                for key, terms in REASONING_MARKERS.items()
            }
            reasoning_hits = {k: v for k, v in reasoning_hits.items() if v}
            result[rule["id"]] = {
                "title": rule.get("title", ""),
                "teacher": teacher_entry.get("teacher", ""),
                "keyword_hits": keyword_hits,
                "reasoning_hits": reasoning_hits,
                "reasoning_path": rule.get("reasoning_path", []),
                "branch_conditions": rule.get("branch_conditions", []),
                "knowledge_priority": rule.get("knowledge_priority"),
                "repetition_signal": rule.get("repetition_signal"),
            }
    return result


def collect_document_hits() -> dict:
    files: list[Path] = []
    for root in TRANSCRIPT_ROOTS:
        if root.exists():
            files.extend(sorted(root.rglob("*.txt")))

    by_keyword: dict[str, list[dict]] = defaultdict(list)
    by_reasoning: dict[str, list[dict]] = defaultdict(list)
    stats = {"documents_scanned": len(files), "matched_documents": 0}

    for file_path in files:
        text = clean_text(file_path.read_text(errors="ignore"))
        matched = False
        for key, terms in KEYWORDS.items():
            hits = [term for term in terms if term in text]
            if hits:
                matched = True
                by_keyword[key].append(
                    {
                        "path": str(file_path),
                        "hits": hits,
                        "snippets": build_snippets(text, hits),
                    }
                )
        for key, terms in REASONING_MARKERS.items():
            hits = [term for term in terms if term in text]
            if hits:
                matched = True
                by_reasoning[key].append(
                    {
                        "path": str(file_path),
                        "hits": hits,
                        "snippets": build_snippets(text, hits),
                    }
                )
        if matched:
            stats["matched_documents"] += 1

    return {
        "stats": stats,
        "keyword_documents": by_keyword,
        "reasoning_documents": by_reasoning,
    }


def main() -> None:
    rule_hits = collect_rule_hits()
    document_hits = collect_document_hits()

    output = {
        "version": 1,
        "generated_at": datetime.now(UTC).isoformat(),
        "scope": {
            "transcript_roots": [str(path) for path in TRANSCRIPT_ROOTS],
            "rule_library": str(RULE_LIBRARY),
        },
        "keywords": KEYWORDS,
        "reasoning_markers": REASONING_MARKERS,
        "rule_index": rule_hits,
        "document_index": {
            "stats": document_hits["stats"],
            "keyword_documents": document_hits["keyword_documents"],
            "reasoning_documents": document_hits["reasoning_documents"],
        },
    }

    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"wrote {OUTPUT}")


if __name__ == "__main__":
    main()
