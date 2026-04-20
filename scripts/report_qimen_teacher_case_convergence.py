from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
PACKS_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-case-replay-packs.json"
OUT_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-case-convergence-report.json"
OUT_MD = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-case-convergence-report.md"

TEACHERS = ["钟波", "文艺复兴", "王永源", "苗道长"]
QUESTION_LABELS = {
    "career_work": "事业工作",
    "love_relationship": "感情婚姻",
    "money_wealth": "财运合作",
    "health_energy": "健康身体",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def count_parts(item: dict) -> int:
    return sum(1 for key in ("rule", "pattern", "conflict", "case") if item.get(key))


def strong_parts(item: dict) -> int:
    thresholds = {
        "rule": 6.0,
        "pattern": 3.0,
        "conflict": 2.0,
        "case": 8.0,
    }
    hits = 0
    for key, threshold in thresholds.items():
        row = item.get(key) or {}
        score = float(row.get("score") or 0.0)
        if score >= threshold:
            hits += 1
    return hits


def convergence_label(replay_mode: str, item: dict) -> str:
    matched = count_parts(item)
    strong = strong_parts(item)
    has_rule = bool(item.get("rule"))
    has_pattern_or_conflict = bool(item.get("pattern")) or bool(item.get("conflict"))
    has_case = bool(item.get("case"))

    if replay_mode == "near_replay":
        if has_rule and has_pattern_or_conflict and has_case and strong >= 3 and matched >= 4:
            return "same_result_likely"
        if has_rule and has_pattern_or_conflict and strong >= 2 and matched >= 3:
            return "same_logic_family"
        if matched >= 2:
            return "partial"
        return "unsupported"

    if replay_mode == "logic_alignment_only":
        if has_rule and has_pattern_or_conflict and strong >= 2 and matched >= 3:
            return "same_logic_family"
        if matched >= 2:
            return "partial"
        return "unsupported"

    if has_rule and has_pattern_or_conflict and matched >= 2:
        return "partial"
    return "unsupported"


def main() -> int:
    packs = load_json(PACKS_JSON).get("packs", [])
    teacher_summary: dict[str, Counter] = defaultdict(Counter)
    qtype_summary: dict[str, dict[str, Counter]] = defaultdict(lambda: defaultdict(Counter))
    case_rows = []

    for pack in packs:
        row = {
            "title": pack.get("title"),
            "source_section_title": pack.get("source_section_title"),
            "question_type": pack.get("question_type"),
            "question_type_label": pack.get("question_type_label") or QUESTION_LABELS.get(pack.get("question_type"), pack.get("question_type")),
            "replay_mode": pack.get("replay_mode"),
            "wang_conclusion": pack.get("teacher_conclusion"),
            "teacher_runs": [],
        }
        for teacher in TEACHERS:
            item = (pack.get("teacher_alignment") or {}).get(teacher) or {}
            label = convergence_label(str(pack.get("replay_mode") or ""), item)
            matched = count_parts(item)
            strong = strong_parts(item)
            teacher_summary[teacher][label] += 1
            qtype_summary[str(pack.get("question_type") or "")][teacher][label] += 1
            row["teacher_runs"].append(
                {
                    "teacher": teacher,
                    "convergence": label,
                    "matched_parts": matched,
                    "strong_parts": strong,
                    "alignment": item.get("alignment"),
                }
            )
        case_rows.append(row)

    payload = {
        "total_packs": len(packs),
        "teacher_summary": {teacher: dict(counter) for teacher, counter in teacher_summary.items()},
        "question_type_summary": {
            qtype: {teacher: dict(counter) for teacher, counter in teacher_map.items()}
            for qtype, teacher_map in qtype_summary.items()
        },
        "cases": case_rows,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# QiMen Teacher Case Convergence Report",
        "",
        "这份报告把“逻辑骨架对齐”再收紧一层，区分：",
        "- `same_result_likely`: 在可近似复盘案例上，已具备较完整的规则/路径/冲突/案例骨架，结果大概率同向。",
        "- `same_logic_family`: 逻辑主线相容，但还不足以严格证明最终结果完全一致。",
        "- `partial`: 只能证明局部方法相容。",
        "- `unsupported`: 当前证据不足。",
        "",
        "注意：这仍不是严格盘面复算，只是比单纯检索对齐更严格的一层。",
        "",
        f"- total_packs: {len(packs)}",
        "",
        "## Teacher Summary",
        "",
    ]

    for teacher in TEACHERS:
        counter = teacher_summary[teacher]
        lines.extend(
            [
                f"### {teacher}",
                f"- same_result_likely: {counter.get('same_result_likely', 0)}",
                f"- same_logic_family: {counter.get('same_logic_family', 0)}",
                f"- partial: {counter.get('partial', 0)}",
                f"- unsupported: {counter.get('unsupported', 0)}",
                "",
            ]
        )

    lines.extend(["## Question Type Summary", ""])
    for qtype, label in QUESTION_LABELS.items():
        lines.append(f"### {label}")
        for teacher in TEACHERS:
            counter = qtype_summary[qtype][teacher]
            lines.append(
                f"- {teacher}: same_result_likely={counter.get('same_result_likely', 0)}, "
                f"same_logic_family={counter.get('same_logic_family', 0)}, "
                f"partial={counter.get('partial', 0)}, unsupported={counter.get('unsupported', 0)}"
            )
        lines.append("")

    lines.extend(["## Case Rows", ""])
    for row in case_rows:
        lines.extend(
            [
                f"### {row['source_section_title']} / {row['question_type_label']}",
                f"- replay_mode: {row['replay_mode']}",
                f"- wang_conclusion: {row['wang_conclusion']}",
            ]
        )
        for item in row["teacher_runs"]:
            lines.append(
                f"- {item['teacher']}: {item['convergence']} "
                f"(matched_parts={item['matched_parts']}, strong_parts={item['strong_parts']}, alignment={item['alignment']})"
            )
        lines.append("")

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_MD}")
    print(f"Wrote {OUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
