#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = ROOT / "scripts" / "build_qimen_reasoning_assets.py"


def load_build_module():
    spec = importlib.util.spec_from_file_location("qimen_build", BUILD_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["qimen_build"] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def main() -> int:
    build = load_build_module()
    deep_payloads = build.load_deep_extraction_payloads()
    if not deep_payloads:
        print("No deep extraction payloads found.")
        return 0

    rules_payload = build.load_json(build.RULE_CARDS_PATH)
    cases_payload = build.load_json(build.CASE_CARDS_PATH)
    patterns_payload = build.load_json(build.PATTERN_CARDS_PATH)
    notes_payload = build.load_json(build.TERM_NOTES_PATH)
    conflicts_payload = build.load_json(build.CONFLICT_CARDS_PATH)
    lesson_index_payload = build.load_json(build.LESSON_INDEX_PATH)
    tier_overrides = build.load_tier_overrides()

    merged_rules = build.apply_tier_overrides(
        build.merge_deep_extraction_items(rules_payload["rules"], deep_payloads, "rule_cards"),
        tier_overrides,
    )
    merged_cases = build.apply_tier_overrides(
        build.merge_deep_extraction_items(cases_payload["cases"], deep_payloads, "case_cards"),
        tier_overrides,
    )
    merged_patterns = build.apply_tier_overrides(
        build.merge_deep_extraction_items(patterns_payload["patterns"], deep_payloads, "pattern_cards"),
        tier_overrides,
    )
    merged_notes = build.apply_tier_overrides(
        build.merge_deep_extraction_items(notes_payload["notes"], deep_payloads, "term_notes"),
        tier_overrides,
    )
    merged_conflicts = build.apply_tier_overrides(
        build.merge_deep_extraction_items(conflicts_payload["cards"], deep_payloads, "conflict_cards"),
        tier_overrides,
    )

    rules_payload["updated_at"] = build.datetime.now(build.timezone.utc).isoformat()
    cases_payload["updated_at"] = rules_payload["updated_at"]
    notes_payload["updated_at"] = rules_payload["updated_at"]
    conflicts_payload["updated_at"] = rules_payload["updated_at"]
    patterns_payload["updated_at"] = rules_payload["updated_at"]

    rules_payload["rules"] = merged_rules
    cases_payload["cases"] = merged_cases
    patterns_payload["patterns"] = merged_patterns
    notes_payload["notes"] = merged_notes
    conflicts_payload["cards"] = merged_conflicts

    build.write_json(build.RULE_CARDS_PATH, rules_payload)
    build.write_json(build.CASE_CARDS_PATH, cases_payload)
    build.write_json(build.PATTERN_CARDS_PATH, patterns_payload)
    build.write_json(build.TERM_NOTES_PATH, notes_payload)
    build.write_json(build.CONFLICT_CARDS_PATH, conflicts_payload)

    build.write_generated_ts(
        rules_payload,
        cases_payload,
        patterns_payload,
        notes_payload,
        conflicts_payload,
        lesson_index_payload,
    )

    print(
        "Applied deep extractions:",
        f"rules={len(merged_rules)}",
        f"cases={len(merged_cases)}",
        f"patterns={len(merged_patterns)}",
        f"notes={len(merged_notes)}",
        f"conflicts={len(merged_conflicts)}",
        f"sources={len(deep_payloads)}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
