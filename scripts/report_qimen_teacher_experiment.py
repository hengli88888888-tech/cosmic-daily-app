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
REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-experiment-report.md"
JSON_REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-experiment-report.json"


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


def clean_string(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def fetch_rows_via_function(base_url: str, service_role_key: str) -> list[dict]:
    url = f"{base_url.rstrip('/')}/functions/v1/admin-qimen-feedback?action=teacher_experiment_export"
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


def normalize_decision_label(question_type: str, text: str) -> str:
    sample = clean_string(text)
    positive_terms = (
        ["复合", "推进", "继续", "靠近", "结婚", "能成"]
        if question_type == "love_relationship"
        else ["恢复", "好转", "缓解", "稳定"]
        if question_type == "health_energy"
        else ["推进", "落地", "中标", "回款", "兑现", "可成", "顺利"]
    )
    negative_terms = (
        ["离婚", "分开", "结束", "难成", "走散"]
        if question_type == "love_relationship"
        else ["偏重", "风险", "恶化", "反复", "拖长"]
        if question_type == "health_energy"
        else ["落空", "失败", "不中", "受阻", "难成", "卡住"]
    )
    mixed_terms = ["波动", "反复", "拉扯", "不稳", "拖延", "观望"]
    risk_terms = ["谨慎", "止损", "保守", "先不要", "风险", "防"]

    positive_score = sum(1 for term in positive_terms if term in sample)
    negative_score = sum(1 for term in negative_terms if term in sample)
    mixed_score = sum(1 for term in mixed_terms if term in sample)
    risk_score = sum(1 for term in risk_terms if term in sample)

    if negative_score > max(positive_score, mixed_score):
        return "negative"
    if positive_score > max(negative_score, mixed_score):
        return "positive"
    if risk_score > 0 and risk_score >= mixed_score:
        return "risk"
    if mixed_score > 0:
        return "mixed"
    return "unclear"


def normalize_timing_bucket(text: str) -> str:
    sample = clean_string(text)
    if not sample:
        return "unclear"
    if any(term in sample for term in ["马上", "很快", "近期", "短期", "尽快", "这几天", "本周"]):
        return "near"
    if any(term in sample for term in ["本月", "这个月", "几个月", "阶段", "今年", "年内"]):
        return "mid"
    if any(term in sample for term in ["长期", "后面", "未来", "大运", "流年", "明年", "一年后"]):
        return "long"
    return "unclear"


def run_decision_key(question_type: str, run: dict) -> str:
    decision = run.get("normalized_decision")
    if isinstance(decision, dict):
        key = clean_string(decision.get("key"))
        if key:
            return key
    label = normalize_decision_label(question_type, " ".join(
        [
            clean_string(run.get("main_judgment")),
            clean_string(run.get("timing_line")),
            " ".join(str(item) for item in (run.get("reason_chain") or []) if isinstance(item, str)),
        ]
    ))
    timing = normalize_timing_bucket(clean_string(run.get("timing_line")))
    return f"{label}::{timing}"


def compute_report(rows: list[dict]) -> dict:
    by_qtype: dict[str, dict] = defaultdict(lambda: {
        "threads": 0,
        "early_match": 0,
        "late_match": 0,
        "split": 0,
        "teacher_stats": defaultdict(lambda: {
            "runs": 0,
            "majority_aligned": 0,
            "feedback_matched": 0,
            "feedback_partial": 0,
            "feedback_missed": 0,
        }),
        "pair_disagreements": Counter(),
    })

    overall = {
        "threads": 0,
        "early_match": 0,
        "late_match": 0,
        "split": 0,
    }

    for row in rows:
        qtype = clean_string(row.get("question_type")) or "general"
        teacher_runs = row.get("teacher_runs") or []
        if not isinstance(teacher_runs, list) or not teacher_runs:
            continue
        consensus_level = clean_string(row.get("consensus_level")) or "split"
        verdict = clean_string(row.get("verdict")) or "pending"
        majority_key = clean_string(row.get("consensus_majority_key"))

        overall["threads"] += 1
        by_qtype[qtype]["threads"] += 1
        if consensus_level == "early_match":
            overall["early_match"] += 1
            by_qtype[qtype]["early_match"] += 1
        elif consensus_level == "late_match":
            overall["late_match"] += 1
            by_qtype[qtype]["late_match"] += 1
        else:
            overall["split"] += 1
            by_qtype[qtype]["split"] += 1

        normalized_runs: list[tuple[str, str]] = []
        for run in teacher_runs:
            if not isinstance(run, dict):
                continue
            teacher_id = clean_string(run.get("teacher_id"))
            if not teacher_id:
                continue
            key = run_decision_key(qtype, run)
            normalized_runs.append((teacher_id, key))
            stats = by_qtype[qtype]["teacher_stats"][teacher_id]
            stats["runs"] += 1
            if majority_key and key == majority_key:
                stats["majority_aligned"] += 1
                if verdict == "matched":
                    stats["feedback_matched"] += 1
                elif verdict == "partially_matched":
                    stats["feedback_partial"] += 1
                elif verdict == "missed":
                    stats["feedback_missed"] += 1

        for index, (left_teacher, left_key) in enumerate(normalized_runs):
            for right_teacher, right_key in normalized_runs[index + 1:]:
                if left_key == right_key:
                    continue
                pair = " / ".join(sorted([left_teacher, right_teacher]))
                by_qtype[qtype]["pair_disagreements"][pair] += 1

    teacher_totals: dict[str, dict] = defaultdict(lambda: {"runs": 0, "majority_aligned": 0, "feedback_matched": 0, "feedback_partial": 0, "feedback_missed": 0})
    for qtype_data in by_qtype.values():
        for teacher, stats in qtype_data["teacher_stats"].items():
            target = teacher_totals[teacher]
            for key, value in stats.items():
                target[key] += value

    return {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "rows": len(rows),
        "overall": overall,
        "by_question_type": {
            qtype: {
                "threads": data["threads"],
                "early_match": data["early_match"],
                "late_match": data["late_match"],
                "split": data["split"],
                "teacher_stats": {
                    teacher: stats
                    for teacher, stats in sorted(data["teacher_stats"].items(), key=lambda item: (-item[1]["majority_aligned"], -item[1]["runs"], item[0]))
                },
                "pair_disagreements": [{"pair": pair, "count": count} for pair, count in data["pair_disagreements"].most_common(8)],
            }
            for qtype, data in sorted(by_qtype.items())
        },
        "teacher_totals": {
            teacher: stats for teacher, stats in sorted(teacher_totals.items(), key=lambda item: (-item[1]["majority_aligned"], -item[1]["runs"], item[0]))
        },
    }


def write_report(payload: dict, fetch_error: str | None) -> None:
    overall = payload["overall"]
    lines = [
        "# QiMen Teacher Experiment Report",
        "",
        f"- generated_at: {payload['generated_at']}",
        f"- experiment_rows: {payload['rows']}",
        f"- early_match: {overall['early_match']}",
        f"- late_match: {overall['late_match']}",
        f"- split: {overall['split']}",
        "",
    ]
    if fetch_error:
        lines.extend(["## Fetch Status", "", f"- error: {fetch_error}", ""])

    lines.extend(["## Teacher Totals", ""])
    for teacher, stats in payload["teacher_totals"].items():
        runs = stats["runs"] or 1
        lines.extend(
            [
                f"### {teacher}",
                f"- runs: {stats['runs']}",
                f"- majority_aligned: {stats['majority_aligned']} ({(stats['majority_aligned'] / runs) * 100:.1f}%)",
                f"- feedback_matched: {stats['feedback_matched']}",
                f"- feedback_partial: {stats['feedback_partial']}",
                f"- feedback_missed: {stats['feedback_missed']}",
                "",
            ]
        )

    lines.extend(["## By Question Type", ""])
    for qtype, data in payload["by_question_type"].items():
        lines.extend(
            [
                f"### {qtype}",
                f"- threads: {data['threads']}",
                f"- early_match: {data['early_match']}",
                f"- late_match: {data['late_match']}",
                f"- split: {data['split']}",
            ]
        )
        if data["pair_disagreements"]:
            lines.append("- pair_disagreements: " + "、".join(f"{item['pair']}({item['count']})" for item in data["pair_disagreements"]))
        else:
            lines.append("- pair_disagreements: —")
        for teacher, stats in data["teacher_stats"].items():
            runs = stats["runs"] or 1
            lines.append(
                f"- {teacher}: majority_aligned={stats['majority_aligned']} ({(stats['majority_aligned'] / runs) * 100:.1f}%), matched={stats['feedback_matched']}, partial={stats['feedback_partial']}, missed={stats['feedback_missed']}"
            )
        lines.append("")

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    JSON_REPORT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    env = {**load_env(ROOT / ".env"), **os.environ}
    base_url = env.get("SUPABASE_URL") or env.get("ORAYA_SUPABASE_URL")
    service_role_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("ORAYA_SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_role_key:
      raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    try:
        rows = fetch_rows_via_function(base_url, service_role_key)
        fetch_error = None
    except Exception as error:
        rows = []
        fetch_error = str(error)

    payload = compute_report(rows)
    write_report(payload, fetch_error)
    print(f"Wrote {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
