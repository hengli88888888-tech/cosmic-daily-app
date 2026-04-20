#!/usr/bin/env python3
from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "state.json"
SUMMARY_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "progress-summary.md"
REVIEW_ROOT = ROOT / "data" / "reviewed-rules" / "qimen-review-ready"
SERVER_URL = "http://127.0.0.1:8765/api/jobs"


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def fetch_jobs() -> list[dict[str, Any]]:
    try:
        with urllib.request.urlopen(SERVER_URL, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return []
    return payload.get("jobs", [])


def collect_counts(entries: dict[str, dict[str, Any]]) -> tuple[Counter, Counter]:
    status_counts = Counter()
    kind_counts = Counter()
    for entry in entries.values():
        status_counts[entry.get("status", "unknown")] += 1
        kind_counts[entry.get("kind", "unknown")] += 1
    return status_counts, kind_counts


def latest_entries(entries: dict[str, dict[str, Any]], *, status: str, limit: int = 5) -> list[tuple[str, dict[str, Any]]]:
    rows = [
        (rel_path, entry)
        for rel_path, entry in entries.items()
        if entry.get("status") == status
    ]
    rows.sort(key=lambda row: row[1].get("updated_at") or row[1].get("finished_at") or row[1].get("copied_at") or "", reverse=True)
    return rows[:limit]


def format_job_block(job: dict[str, Any]) -> list[str]:
    logs = job.get("logs", [])
    recent_logs = logs[-3:] if logs else []
    lines = [
        f"- job_id: `{job.get('id', '')}`",
        f"- file: `{job.get('filename', '')}`",
        f"- teacher: {job.get('teacher', '')}",
        f"- course: {job.get('course', '')}",
        f"- status: `{job.get('status', '')}`",
        f"- message: {job.get('message', '')}",
    ]
    if recent_logs:
        lines.append("- recent logs:")
        for log in recent_logs:
            lines.append(f"  - {log}")
    return lines


def main() -> int:
    state = load_json(STATE_PATH, {"entries": {}, "scan_summary": {}})
    entries: dict[str, dict[str, Any]] = state.get("entries", {})
    status_counts, kind_counts = collect_counts(entries)
    jobs = fetch_jobs()
    running_jobs = [job for job in jobs if job.get("status") in {"queued", "running"}]
    review_files = sorted(REVIEW_ROOT.rglob("*review.md")) if REVIEW_ROOT.exists() else []

    lines = [
        "# Yang Pan QiMen Import Progress",
        "",
        f"- generated_at: {datetime.now(timezone.utc).isoformat()}",
        f"- source_root: `/Volumes/Hard Drive/阳盘奇门`",
        f"- tracked_entries: {len(entries)}",
        f"- tracked_videos: {kind_counts.get('video', 0)}",
        f"- tracked_documents: {kind_counts.get('document', 0)}",
        f"- review_ready_files: {len(review_files)}",
        "",
        "## Status Counts",
        "",
    ]
    for status, count in sorted(status_counts.items()):
        lines.append(f"- `{status}`: {count}")

    lines.extend(["", "## Current Queue", ""])
    if running_jobs:
        for job in running_jobs[:3]:
            lines.extend(format_job_block(job))
            lines.append("")
    else:
        lines.append("- No queued or running jobs.")

    lines.extend(["## Recent Completed Video Imports", ""])
    recent_deleted = latest_entries(entries, status="source_deleted", limit=5)
    if recent_deleted:
        for rel_path, entry in recent_deleted:
            lines.append(f"- `{rel_path}`")
            lines.append(f"  - teacher: {entry.get('teacher', '')}")
            lines.append(f"  - course: {entry.get('course', '')}")
            lines.append(f"  - job_id: `{entry.get('job_id', '')}`")
            lines.append(f"  - source_deleted_at: {entry.get('source_deleted_at', '')}")
        lines.append("")
    else:
        lines.append("- No completed video imports yet.")
        lines.append("")

    lines.extend(["## Recent Failures", ""])
    recent_failed = latest_entries(entries, status="failed", limit=5)
    if recent_failed:
        for rel_path, entry in recent_failed:
            lines.append(f"- `{rel_path}`")
            lines.append(f"  - error: {entry.get('error', '')}")
        lines.append("")
    else:
        lines.append("- No failed items recorded.")
        lines.append("")

    lines.extend(["## Document Archive", ""])
    copied_docs = latest_entries(entries, status="copied", limit=10)
    if copied_docs:
        for rel_path, entry in copied_docs:
            lines.append(f"- `{rel_path}` -> `[archived](/Users/liheng/Desktop/cosmic-daily-app/{entry.get('copied_path', '')})`")
    else:
        lines.append("- No archived documents yet.")
    lines.append("")

    lines.extend(["## Progress Files", ""])
    lines.append(f"- state: [state.json]({STATE_PATH})")
    lines.append(f"- document sources: [/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/qimen/qimen-document-sources.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/qimen/qimen-document-sources.json)")
    lines.append(f"- review-ready root: [/Users/liheng/Desktop/cosmic-daily-app/data/reviewed-rules/qimen-review-ready](/Users/liheng/Desktop/cosmic-daily-app/data/reviewed-rules/qimen-review-ready)")
    lines.append("")

    SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(SUMMARY_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
