from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
INPUT_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-prospective-inputs.json"
INPUT_MD = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-prospective-inputs.md"
REPORT_RUNNER = ROOT / "scripts" / "run_qimen_teacher_prospective.ts"


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
                f"- verification_axes: {'、'.join(row['verification_axes']) if row.get('verification_axes') else '—'}",
                f"- feedback_status: {row.get('feedback_status') or 'pending'}",
                f"- feedback_summary: {row.get('feedback_summary') or '—'}",
                f"- feedback_notes: {row.get('feedback_notes') or '—'}",
                f"- root_cause: {row.get('root_cause') or '—'}",
                "",
            ]
        )
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update feedback fields for a prospective QiMen case and refresh the report.")
    parser.add_argument("case_id", help="Prospective case id to update")
    parser.add_argument("--status", choices=["pending", "matched", "partial", "missed"], required=True)
    parser.add_argument("--notes", default="", help="Free-form feedback notes")
    parser.add_argument("--summary", default="", help="Short feedback summary")
    parser.add_argument(
        "--root-cause",
        choices=["plate_engine", "question_routing", "timing_expression", "result_normalization"],
        default="",
        help="Root cause if the prediction was partial or missed",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = json.loads(INPUT_JSON.read_text(encoding="utf-8"))
    rows = payload.get("inputs") or []
    matched = False
    for row in rows:
      if str(row.get("case_id")) != args.case_id:
        continue
      row["feedback_status"] = args.status
      row["feedback_notes"] = args.notes
      row["feedback_summary"] = args.summary
      row["root_cause"] = args.root_cause or None
      matched = True
      break

    if not matched:
      raise SystemExit(f"case_id not found: {args.case_id}")

    payload["inputs"] = rows
    INPUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    INPUT_MD.write_text(render_markdown(rows), encoding="utf-8")

    subprocess.run(
        [
            "npx",
            "-y",
            "deno",
            "run",
            "--allow-read",
            "--allow-write",
            "--allow-env",
            str(REPORT_RUNNER),
        ],
        check=True,
    )
    print(f"Updated {args.case_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
