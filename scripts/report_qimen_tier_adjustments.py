#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QIMEN_DIR = ROOT / "specs" / "knowledge-base" / "qimen"
REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-tier-adjustment-report.md"
JSON_REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-tier-adjustment-candidates.json"

ASSET_CONFIG = [
    ("qimen-rule-cards.json", "rules", "rule"),
    ("qimen-case-cards.json", "cases", "case"),
    ("qimen-reasoning-patterns.json", "patterns", "pattern"),
    ("qimen-term-notes.json", "notes", "term"),
    ("qimen-conflict-resolution-cards.json", "cards", "conflict"),
]

STEP_TRACE_KIND_MAP = {
    "video_rules": {"rule": 1.0, "pattern": 0.8},
    "case_alignment": {"case": 1.0},
    "document_support": {"term": 0.9, "conflict": 0.85},
    "decision_compose": {"case": 0.45, "conflict": 0.45},
}


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def fetch_feedback_rows(base_url: str, service_role_key: str) -> list[dict]:
    params = urllib.parse.urlencode(
        {
            "select": "thread_id,question_type,verdict,failed_step,failed_support_id,failure_tags,updated_at",
            "verdict": "in.(partially_matched,missed)",
            "limit": "1000",
        }
    )
    url = f"{base_url.rstrip('/')}/rest/v1/qimen_outcome_feedback?{params}"
    request = urllib.request.Request(
        url,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = response.read().decode("utf-8")
    return json.loads(payload)


def fetch_feedback_rows_via_function(base_url: str, service_role_key: str) -> list[dict]:
    url = f"{base_url.rstrip('/')}/functions/v1/admin-qimen-feedback?action=export"
    request = urllib.request.Request(
        url,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = response.read().decode("utf-8")
    parsed = json.loads(payload)
    rows = parsed.get("rows", [])
    return rows if isinstance(rows, list) else []


def load_cards() -> dict[str, dict]:
    cards: dict[str, dict] = {}
    for filename, key, trace_kind in ASSET_CONFIG:
        payload = json.loads((QIMEN_DIR / filename).read_text(encoding="utf-8"))
        for item in payload.get(key, []):
            entry = dict(item)
            entry["trace_kind"] = trace_kind
            cards[str(item["id"])] = entry
    return cards


def compute_candidates(rows: list[dict], cards: dict[str, dict]) -> tuple[list[dict], dict[str, dict], Counter]:
    id_counts: Counter[str] = Counter()
    step_counts_by_type: dict[str, Counter[str]] = defaultdict(Counter)
    tag_counts_by_type: dict[str, Counter[str]] = defaultdict(Counter)

    for row in rows:
        question_type = str(row.get("question_type") or "unknown")
        failed_support_id = str(row.get("failed_support_id") or "").strip()
        failed_step = str(row.get("failed_step") or "").strip()
        if failed_support_id:
            id_counts[failed_support_id] += 1
        if failed_step:
            step_counts_by_type[question_type][failed_step] += 1
        tags = row.get("failure_tags") or []
        if isinstance(tags, list):
            for tag in tags:
                normalized = str(tag).strip()
                if normalized:
                    tag_counts_by_type[question_type][normalized] += 1

    candidates: list[dict] = []
    for card_id, count in id_counts.items():
        card = cards.get(card_id)
        if not card:
            continue
        if str(card.get("knowledge_tier")) != "support":
            continue
        question_type = str(card.get("question_type") or "general")
        trace_kind = str(card.get("trace_kind") or "")
        id_penalty = min(count * 0.6, 2.4)
        step_penalty = 0.0
        for step, step_count in step_counts_by_type.get(question_type, {}).items():
            weight = STEP_TRACE_KIND_MAP.get(step, {}).get(trace_kind, 0.0)
            step_penalty += min(step_count * 0.18, 0.9) * weight
        feedback_penalty = round(id_penalty + step_penalty, 2)
        if feedback_penalty < 1.2:
            continue
        candidates.append(
            {
                "id": card_id,
                "title": str(card.get("title") or card_id),
                "question_type": question_type,
                "trace_kind": trace_kind,
                "current_tier": "support",
                "suggested_tier": "reference",
                "id_penalty": round(id_penalty, 2),
                "step_penalty": round(step_penalty, 2),
                "feedback_penalty": feedback_penalty,
                "source_teacher": str(card.get("source_teacher") or ""),
                "source_course_or_book": str(card.get("source_course_or_book") or ""),
                "reason": (
                    "这张卡自身在历史反馈里反复出错，更适合先降到背景参考层。"
                    if id_penalty >= step_penalty
                    else "这类卡在当前题型对应错步里持续不稳，更适合先降到背景参考层。"
                ),
            }
        )

    candidates.sort(key=lambda item: (-item["feedback_penalty"], item["question_type"], item["title"]))
    return candidates, step_counts_by_type, tag_counts_by_type


def write_report(
    rows: list[dict],
    candidates: list[dict],
    step_counts_by_type: dict[str, Counter[str]],
    tag_counts_by_type: dict[str, Counter[str]],
    fetch_error: str | None = None,
) -> None:
    lines = [
        "# QiMen Tier Adjustment Report",
        "",
        f"- generated_at: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"- feedback_rows: {len(rows)}",
        f"- suggested_downgrades: {len(candidates)}",
        "",
    ]

    if fetch_error:
        lines.extend(
            [
                "## Fetch Status",
                "",
                f"- error: {fetch_error}",
                "- note: Local Supabase REST may not be running. Start local Supabase or point the script at a running project, then rerun.",
                "",
            ]
        )

    lines.extend([
        "## Suggested Downgrades",
        "",
    ])

    if candidates:
        for item in candidates[:20]:
            lines.extend(
                [
                    f"### {item['title']}",
                    f"- question_type: {item['question_type']}",
                    f"- trace_kind: {item['trace_kind']}",
                    f"- current_tier: {item['current_tier']}",
                    f"- suggested_tier: {item['suggested_tier']}",
                    f"- feedback_penalty: {item['feedback_penalty']}",
                    f"- id_penalty: {item['id_penalty']}",
                    f"- step_penalty: {item['step_penalty']}",
                    f"- source_teacher: {item['source_teacher']}",
                    f"- source_course_or_book: {item['source_course_or_book']}",
                    f"- reason: {item['reason']}",
                    "",
                ]
            )
    else:
        lines.extend(["No downgrade suggestions met the threshold.", ""])

    lines.extend(["## By Question Type", ""])
    for question_type in sorted(step_counts_by_type):
        lines.append(f"### {question_type}")
        step_summary = "、".join(f"{key}({count})" for key, count in step_counts_by_type[question_type].most_common(5)) or "—"
        tag_summary = "、".join(f"{key}({count})" for key, count in tag_counts_by_type.get(question_type, Counter()).most_common(5)) or "—"
        lines.append(f"- common_failed_steps: {step_summary}")
        lines.append(f"- common_failure_tags: {tag_summary}")
        top_candidates = [item for item in candidates if item["question_type"] == question_type][:5]
        if top_candidates:
            lines.append(
                "- top_candidates: "
                + "、".join(f"{item['title']}(-{item['feedback_penalty']})" for item in top_candidates)
            )
        else:
            lines.append("- top_candidates: —")
        lines.append("")

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_json_report(rows: list[dict], candidates: list[dict], step_counts_by_type: dict[str, Counter[str]], tag_counts_by_type: dict[str, Counter[str]], fetch_error: str | None = None) -> None:
    payload = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "feedback_rows": len(rows),
        "suggested_downgrades": len(candidates),
        "fetch_error": fetch_error,
        "candidates": candidates,
        "by_question_type": {
            question_type: {
                "failed_steps": [{"key": key, "count": count} for key, count in step_counts_by_type[question_type].most_common(5)],
                "failure_tags": [{"key": key, "count": count} for key, count in tag_counts_by_type.get(question_type, Counter()).most_common(5)],
            }
            for question_type in sorted(step_counts_by_type)
        },
    }
    JSON_REPORT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    env = {**load_env(ROOT / ".env"), **os.environ}
    base_url = env.get("SUPABASE_URL") or env.get("ORAYA_SUPABASE_URL")
    service_role_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("ORAYA_SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_role_key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    try:
        rows = fetch_feedback_rows(base_url, service_role_key)
        fetch_error = None
    except Exception as rest_error:
        try:
            rows = fetch_feedback_rows_via_function(base_url, service_role_key)
            fetch_error = None
        except Exception as function_error:
            rows = []
            fetch_error = f"REST failed: {rest_error}; function export failed: {function_error}"

    cards = load_cards()
    candidates, step_counts_by_type, tag_counts_by_type = compute_candidates(rows, cards)
    write_report(rows, candidates, step_counts_by_type, tag_counts_by_type, fetch_error=fetch_error)
    write_json_report(rows, candidates, step_counts_by_type, tag_counts_by_type, fetch_error=fetch_error)
    if fetch_error:
        print(f"Wrote {REPORT_PATH} without live feedback data ({fetch_error}).")
    else:
        print(f"Wrote {REPORT_PATH} with {len(candidates)} suggested downgrades from {len(rows)} feedback rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
