#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
STRICT_RERUN_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-strict-rerun-report.json"
OUT_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-routing-report.json"
OUT_MD = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-routing-report.md"

QUESTION_LABELS = {
    "career_work": "事业工作",
    "love_relationship": "感情婚姻",
    "money_wealth": "财运合作",
    "health_energy": "健康身体",
}

PRIMARY_TEACHER = "王兴兵"
GRAY_TEACHERS = ["钟波", "文艺复兴"]
OFFLINE_ONLY_TEACHERS = ["王永源", "苗道长"]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def track_label(value: str) -> str:
    if value == "environmental_edge_case":
        return "environmental_edge_case"
    return "main"


def routing_recommendation(question_type: str, counts: Counter, track_counts: Counter) -> dict[str, str | list[str]]:
    if question_type == "love_relationship":
        return {
            "mode": "gray",
            "primary_teacher": PRIMARY_TEACHER,
            "gray_teachers": GRAY_TEACHERS,
            "reason": "历史 majority_same_as_wang 集中出现在感情婚姻主类，线上继续保留灰度复核。",
        }
    if track_counts.get("environmental_edge_case", 0) > 0:
        return {
            "mode": "gray_when_environmental",
            "primary_teacher": PRIMARY_TEACHER,
            "gray_teachers": GRAY_TEACHERS,
            "reason": "该题型下含环境/公共事件边界样本，线上仅在低频环境类问题触发灰度。",
        }
    return {
        "mode": "primary_only",
        "primary_teacher": PRIMARY_TEACHER,
        "gray_teachers": [],
        "reason": "历史复盘已高度收敛，线上默认单老师直出。",
    }


def main() -> int:
    payload = load_json(STRICT_RERUN_JSON)
    cases = payload.get("cases", [])

    by_question_type: dict[str, list[dict]] = defaultdict(list)
    for case in cases:
        question_type = str(case.get("question_type") or "")
        if not question_type:
            continue
        by_question_type[question_type].append(case)

    qtype_rows: list[dict] = []
    for question_type, rows in sorted(by_question_type.items()):
        outcome_counts = Counter(str(row.get("case_outcome") or "") for row in rows)
        fidelity_counts = Counter(str(row.get("case_fidelity") or "") for row in rows)
        track_counts = Counter(track_label(str(row.get("evaluation_track") or "")) for row in rows)
        notable_cases = [
            {
                "case_id": row.get("case_id"),
                "title": row.get("source_section_title"),
                "case_outcome": row.get("case_outcome"),
                "evaluation_track": row.get("evaluation_track"),
            }
            for row in rows
            if str(row.get("case_outcome") or "") != "all_same_result"
        ]
        recommendation = routing_recommendation(question_type, outcome_counts, track_counts)
        qtype_rows.append(
            {
                "question_type": question_type,
                "question_type_label": QUESTION_LABELS.get(question_type, question_type),
                "total_cases": len(rows),
                "outcome_counts": dict(outcome_counts),
                "fidelity_counts": dict(fidelity_counts),
                "track_counts": dict(track_counts),
                "recommendation": recommendation,
                "notable_cases": notable_cases,
            }
        )

    overall = {
        "total_cases": len(cases),
        "accuracy_cases": payload.get("accuracy_cases"),
        "excluded_cases": payload.get("excluded_cases"),
        "primary_teacher": PRIMARY_TEACHER,
        "gray_teachers": GRAY_TEACHERS,
        "offline_only_teachers": OFFLINE_ONLY_TEACHERS,
    }
    report = {
        "generated_at": payload.get("generated_at"),
        "overall": overall,
        "by_question_type": qtype_rows,
    }
    OUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# QiMen Teacher Routing Report",
        "",
        f"- generated_at: {payload.get('generated_at')}",
        f"- total_cases: {overall['total_cases']}",
        f"- accuracy_cases: {overall['accuracy_cases']}",
        f"- excluded_cases: {overall['excluded_cases']}",
        f"- primary_teacher: {PRIMARY_TEACHER}",
        f"- gray_teachers: {'、'.join(GRAY_TEACHERS)}",
        f"- offline_only_teachers: {'、'.join(OFFLINE_ONLY_TEACHERS)}",
        "",
        "## Question Type Recommendations",
        "",
    ]

    for row in qtype_rows:
        recommendation = row["recommendation"]
        outcome_counts = row["outcome_counts"]
        fidelity_counts = row["fidelity_counts"]
        track_counts = row["track_counts"]
        lines.extend(
            [
                f"### {row['question_type_label']}",
                f"- total_cases: {row['total_cases']}",
                f"- all_same_result: {outcome_counts.get('all_same_result', 0)}",
                f"- majority_same_as_wang: {outcome_counts.get('majority_same_as_wang', 0)}",
                f"- exact_match: {fidelity_counts.get('exact_match', 0)}",
                f"- main_track: {track_counts.get('main', 0)}",
                f"- environmental_edge_case: {track_counts.get('environmental_edge_case', 0)}",
                f"- recommendation: {recommendation['mode']}",
                f"- routing_reason: {recommendation['reason']}",
            ]
        )
        if recommendation["gray_teachers"]:
            lines.append(f"- gray_teachers: {'、'.join(recommendation['gray_teachers'])}")
        if row["notable_cases"]:
            lines.append("- notable_cases:")
            for case in row["notable_cases"]:
                lines.append(
                    f"  - {case['title']} / {case['case_outcome']} / {case['evaluation_track']}"
                )
        lines.append("")

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_MD}")
    print(f"Wrote {OUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
