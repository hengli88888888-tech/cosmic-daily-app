#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
import importlib.util


ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = ROOT / "scripts" / "build_qimen_reasoning_assets.py"
OUT_DIR = ROOT / "data" / "import-runs" / "qimen-yangpan"


def load_build_module():
    spec = importlib.util.spec_from_file_location("qimen_build", BUILD_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["qimen_build"] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: report_qimen_single_document.py <source_ref_substring>")
        return 1

    needle = sys.argv[1]
    os.environ["QIMEN_DOC_SOURCE_FILTER"] = needle
    os.environ["QIMEN_FORCE_DEEP_OCR"] = "1"
    build = load_build_module()
    docs = build.load_document_sources()
    source = next((doc for doc in docs if needle in doc.source_ref), None)
    if source is None:
        print(f"document not found: {needle}")
        return 2

    payload = build.build_single_document_deep_payload(source)
    rules = payload["rule_cards"]
    cases = payload["case_cards"]
    patterns = payload.get("pattern_cards", [])
    notes = payload["term_notes"]
    conflicts = payload["conflict_cards"]
    blocks = build.split_document_case_blocks(build.document_casebook_text(source))

    stem = source.path.stem
    json_path = OUT_DIR / f"{stem}-deep-extraction.json"
    md_path = OUT_DIR / f"{stem}-deep-extraction-report.md"

    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        f"# 单书深拆报告",
        "",
        f"- source_ref: {payload['source_ref']}",
        f"- teacher: {payload['teacher']}",
        f"- course_or_book: {payload['course_or_book']}",
        f"- extraction_method: {payload['extraction_method']}",
        f"- text_length: {payload['text_length']}",
        f"- case_blocks: {payload['case_blocks']}",
        f"- rules: {len(rules)}",
        f"- cases: {len(cases)}",
        f"- patterns: {len(patterns)}",
        f"- notes: {len(notes)}",
        f"- conflicts: {len(conflicts)}",
        "",
        "## Rule Titles",
        "",
    ]
    for item in rules[:20]:
        lines.append(f"- {item['title']}")
    lines.extend(["", "## Pattern Titles", ""])
    for item in patterns[:20]:
        lines.append(f"- {item['title']} / {item['question_type']}")
    lines.extend(["", "## Case Titles", ""])
    for item in cases[:20]:
        lines.append(f"- {item['title']} / {item['question_type']}")
    lines.extend(["", "## Conflict Titles", ""])
    for item in conflicts[:20]:
        lines.append(f"- {item['title']} / {item['question_type']}")
    lines.extend(["", "## Sample Blocks", ""])
    for block in blocks[:5]:
        lines.append(f"- {build.compress_reasoning_text(block[:220])}")
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(str(md_path))
    print(str(json_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
