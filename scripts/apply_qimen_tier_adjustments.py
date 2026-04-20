#!/usr/bin/env python3
from __future__ import annotations

import json
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
JSON_REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-tier-adjustment-candidates.json"
OVERRIDES_PATH = ROOT / "specs" / "knowledge-base" / "qimen" / "qimen-tier-overrides.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    if not JSON_REPORT_PATH.exists():
        raise SystemExit(f"Missing candidate report: {JSON_REPORT_PATH}")

    report = load_json(JSON_REPORT_PATH)
    candidates = report.get("candidates", [])
    if not isinstance(candidates, list):
        raise SystemExit("Invalid candidate report")

    overrides_payload = load_json(OVERRIDES_PATH) if OVERRIDES_PATH.exists() else {
        "version": 1,
        "updated_at": None,
        "overrides": [],
    }
    current_overrides = {
        str(item.get("id")): dict(item)
        for item in overrides_payload.get("overrides", [])
        if str(item.get("id") or "").strip()
    }

    applied = 0
    for item in candidates:
        if str(item.get("suggested_tier") or "") != "reference":
            continue
        card_id = str(item.get("id") or "").strip()
        if not card_id:
            continue
        current_overrides[card_id] = {
            "id": card_id,
            "knowledge_tier": "reference",
            "source": "tier_adjustment_report",
            "reason": str(item.get("reason") or ""),
            "feedback_penalty": item.get("feedback_penalty"),
            "id_penalty": item.get("id_penalty"),
            "step_penalty": item.get("step_penalty"),
            "question_type": str(item.get("question_type") or ""),
            "trace_kind": str(item.get("trace_kind") or ""),
        }
        applied += 1

    payload = {
        "version": 1,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "overrides": sorted(current_overrides.values(), key=lambda item: (str(item.get("question_type") or ""), str(item.get("id") or ""))),
    }
    write_json(OVERRIDES_PATH, payload)
    print(f"Applied {applied} tier overrides to {OVERRIDES_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
