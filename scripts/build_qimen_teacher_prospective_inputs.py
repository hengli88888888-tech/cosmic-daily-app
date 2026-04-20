from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
OUT_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-prospective-inputs.json"
OUT_MD = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-prospective-inputs.md"

TARGET_TEACHERS = ["钟波", "文艺复兴", "王兴兵", "王永源", "苗道长"]

QUESTION_LABELS = {
    "career_work": "事业工作",
    "love_relationship": "感情婚姻",
    "money_wealth": "财运合作",
    "health_energy": "健康身体",
}

PROSPECTIVE_CASES = [
    {
        "case_id": "prospective-20260326-kindergarten-trip-safety",
        "source_label": "2026-03-26 用户提问：幼儿园校车出游是否平安",
        "source_type": "live_pending",
        "submitted_at": "2026-03-26T22:53:00",
        "timezone": "America/Toronto",
        "system_profile": "chai_bu",
        "question_type": "health_energy",
        "normalized_question": "问明天小女儿乘幼儿园校车去枫糖小屋玩，往返路上和活动现场是否平安，是否有需要特别防范的小风险。",
        "expected_followup_window": "2026-03-27 当天返程后即可验证整体平安与否；若有波动，也应在当天晚间前确认。",
        "verification_axes": ["整体平安", "上下车磕碰", "户外受凉", "短时走散", "热食热饮小风险"],
        "feedback_status": "pending",
        "feedback_notes": "",
        "feedback_summary": "",
        "root_cause": None,
        "target_teachers": TARGET_TEACHERS,
    }
]

PRESERVED_FIELDS = [
    "feedback_status",
    "feedback_notes",
    "feedback_summary",
    "root_cause",
]


def load_existing_inputs() -> dict[str, dict]:
    if not OUT_JSON.exists():
        return {}
    payload = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    rows = payload.get("inputs") or []
    return {str(row.get("case_id")): row for row in rows if row.get("case_id")}


def render_markdown(rows: list[dict]) -> str:
    lines = [
        "# QiMen Teacher Prospective Inputs",
        "",
        "这份清单只放真实新问题，先断后验，不与历史复盘混统计。",
        "",
        f"- total_inputs: {len(rows)}",
        "",
    ]

    for row in rows:
        lines.extend(
            [
                f"## {row['source_label']}",
                f"- question_type: {row['question_type_label']}",
                f"- submitted_at: {row['submitted_at']} ({row['timezone']})",
                f"- normalized_question: {row['normalized_question']}",
                f"- expected_followup_window: {row['expected_followup_window']}",
                f"- verification_axes: {'、'.join(row['verification_axes']) if row['verification_axes'] else '—'}",
                f"- feedback_status: {row['feedback_status']}",
                f"- feedback_summary: {row.get('feedback_summary') or '—'}",
                f"- feedback_notes: {row.get('feedback_notes') or '—'}",
                f"- root_cause: {row.get('root_cause') or '—'}",
                "",
            ]
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    existing = load_existing_inputs()
    rows = []
    for item in PROSPECTIVE_CASES:
        row = {
            **item,
            "question_type_label": QUESTION_LABELS.get(item["question_type"], item["question_type"]),
        }
        previous = existing.get(str(item["case_id"]), {})
        for field in PRESERVED_FIELDS:
            if field in previous and previous.get(field) not in (None, ""):
                row[field] = previous[field]
        rows.append(row)

    payload = {
        "generated_at": "2026-03-27T00:00:00Z",
        "inputs": rows,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    OUT_MD.write_text(render_markdown(rows), encoding="utf-8")
    print(f"Wrote {OUT_MD}")
    print(f"Wrote {OUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
