#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QIMEN_DIR = ROOT / "specs" / "knowledge-base" / "qimen"
SEGMENTS_DIR = ROOT / "data" / "reviewed-rules" / "qimen-ingestion-drafts"
INDEX_PATH = QIMEN_DIR / "qimen-keyword-index.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def iter_segment_payloads() -> list[dict]:
    payloads: list[dict] = []
    if not SEGMENTS_DIR.exists():
        return payloads
    for path in sorted(SEGMENTS_DIR.rglob("*.json")):
        payload = load_json(path)
        payload["_path"] = str(path.relative_to(ROOT))
        payloads.append(payload)
    return payloads


def build_keyword_hits(seed_keywords: list[str], payloads: list[dict]) -> tuple[list[dict], list[dict]]:
    totals = Counter()
    segment_index: list[dict] = []
    for payload in payloads:
        combined_parts = [
            str(payload.get("transcript_excerpt", "")),
            str(payload.get("board_summary_draft", "")),
            str(payload.get("final_conclusion_draft", "")),
            " ".join(payload.get("reasoning_steps_draft", [])),
        ]
        for block in payload.get("ocr_blocks", []):
            combined_parts.append(str(block.get("text", "")))
        combined_text = "\n".join(part for part in combined_parts if part).strip()
        hit_map: dict[str, int] = {}
        for keyword in seed_keywords:
            count = combined_text.count(keyword)
            if count:
                hit_map[keyword] = count
                totals[keyword] += count
        segment_index.append(
            {
                "clip_id": payload.get("clip_id"),
                "teacher": payload.get("teacher"),
                "course": payload.get("course"),
                "question_type_guess": payload.get("question_type_guess", ""),
                "system_profile_guess": payload.get("system_profile_guess", ""),
                "system_profile_mentions": payload.get("system_profile_mentions", []),
                "path": payload["_path"],
                "keyword_hits": hit_map,
            }
        )
    keywords = [
        {"keyword": keyword, "count": count}
        for keyword, count in totals.most_common()
    ]
    return keywords, segment_index


def build_card_index() -> list[dict]:
    index: list[dict] = []
    for filename, key in [
        ("qimen-case-cards.json", "cases"),
        ("qimen-rule-cards.json", "rules"),
        ("qimen-reasoning-patterns.json", "patterns"),
        ("qimen-term-notes.json", "notes"),
        ("qimen-conflict-resolution-cards.json", "cards"),
    ]:
        path = QIMEN_DIR / filename
        if not path.exists():
            continue
        payload = load_json(path)
        for item in payload.get(key, []):
            index.append(
                {
                    "source_file": filename,
                    "id": item.get("id"),
                    "title": item.get("title") or item.get("topic") or item.get("label"),
                }
            )
    return index


def main() -> int:
    seed = load_json(QIMEN_DIR / "qimen-keywords-seed.json")
    payloads = iter_segment_payloads()
    keywords, segment_index = build_keyword_hits(seed.get("keywords", []), payloads)
    index = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "qimen_multimodal",
        "keywords": keywords,
        "segment_index": segment_index,
        "card_index": build_card_index(),
    }
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Reindexed {len(payloads)} QiMen segment drafts into {INDEX_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
