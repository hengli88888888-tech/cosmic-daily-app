#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPT_ROOT = ROOT / "data" / "raw-transcripts" / "qimen"
REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-glossary-reapply-report.md"


def load_server_module():
    server_path = ROOT / "tools" / "knowledge_ingestion" / "server.py"
    spec = importlib.util.spec_from_file_location("knowledge_ingestion_server", server_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load server module from {server_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def parse_metadata(text: str) -> tuple[dict[str, str], str]:
    header_text, body = text.split("\n\n", 1) if "\n\n" in text else ("", text)
    metadata: dict[str, str] = {}
    for line in header_text.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip()
    return metadata, body.strip()


def build_transcript_text(metadata: dict[str, str], corrected_body: str, applied_count: int) -> str:
    lines = [
        f"Teacher: {metadata.get('Teacher', 'Unknown')}",
        f"Course: {metadata.get('Course', 'Unknown')}",
        f"Lesson: {metadata.get('Lesson', 'Unknown')}",
        f"Source File: {metadata.get('Source File', 'Unknown')}",
        f"Glossary Corrections Applied: {applied_count}",
        "",
        corrected_body.strip(),
        "",
    ]
    return "\n".join(lines)


def sample_before_after(original: str, corrected: str, pairs: list[dict[str, str]]) -> list[dict[str, str]]:
    samples: list[dict[str, str]] = []
    for pair in pairs[:3]:
        wrong = pair["wrong"]
        right = pair["correct"]
        if wrong not in original or right not in corrected:
            continue
        original_idx = original.index(wrong)
        corrected_idx = corrected.index(right)
        original_excerpt = original[max(0, original_idx - 24): min(len(original), original_idx + len(wrong) + 36)].replace("\n", " ")
        corrected_excerpt = corrected[max(0, corrected_idx - 24): min(len(corrected), corrected_idx + len(right) + 36)].replace("\n", " ")
        samples.append(
            {
                "wrong": wrong,
                "correct": right,
                "before": original_excerpt,
                "after": corrected_excerpt,
            }
        )
    return samples


def main() -> int:
    parser = argparse.ArgumentParser(description="Reapply QiMen glossary corrections to existing transcripts.")
    parser.add_argument("--limit", type=int, default=0, help="Optional file limit.")
    args = parser.parse_args()

    server = load_server_module()
    load_teacher_glossary = server.load_teacher_glossary
    apply_glossary_corrections = server.apply_glossary_corrections
    clean_repetitive_noise = server.clean_repetitive_noise

    transcript_paths = sorted(TRANSCRIPT_ROOT.rglob("*.txt"))
    if args.limit:
        transcript_paths = transcript_paths[: args.limit]

    touched = 0
    total_corrections = 0
    by_teacher = Counter()
    correction_pairs = Counter()
    samples_by_teacher: dict[str, list[dict[str, str]]] = defaultdict(list)

    for path in transcript_paths:
        raw = path.read_text(encoding="utf-8", errors="replace")
        metadata, body = parse_metadata(raw)
        teacher = metadata.get("Teacher", "").strip()
        teacher_glossary, glossary_path = load_teacher_glossary(teacher)
        corrected_body, applied = apply_glossary_corrections(body, "", teacher_glossary)
        corrected_body, cleanup_notes = clean_repetitive_noise(corrected_body)

        if not applied and corrected_body == body.strip():
            continue

        touched += 1
        by_teacher[teacher or "Unknown"] += 1
        total_corrections += len(applied)
        for item in applied:
            correction_pairs[f"{item['wrong']} -> {item['correct']}"] += 1

        report_payload = {
            "teacher": teacher,
            "glossary": glossary_path or "domain-glossary.json only",
            "applied": applied,
            "cleanup_notes": cleanup_notes,
        }
        path.with_suffix(".corrections.json").write_text(
            json.dumps(report_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        path.write_text(
            build_transcript_text(metadata, corrected_body, len(applied)),
            encoding="utf-8",
        )

        if teacher and len(samples_by_teacher[teacher]) < 5:
            samples_by_teacher[teacher].extend(sample_before_after(body, corrected_body, applied))
            samples_by_teacher[teacher] = samples_by_teacher[teacher][:5]

    report_lines = [
        "# QiMen Glossary Reapply Report",
        "",
        f"- scanned_files: {len(transcript_paths)}",
        f"- touched_files: {touched}",
        f"- total_corrections: {total_corrections}",
        "",
        "## By Teacher",
        "",
    ]
    for teacher, count in by_teacher.most_common():
        report_lines.append(f"- {teacher}: {count} files")
    report_lines.extend(["", "## Top Correction Pairs", ""])
    for pair, count in correction_pairs.most_common(20):
        report_lines.append(f"- `{pair}` × {count}")

    report_lines.extend(["", "## Sample Before / After", ""])
    for teacher, samples in samples_by_teacher.items():
        report_lines.append(f"### {teacher}")
        report_lines.append("")
        if not samples:
            report_lines.append("- No sample replacements captured.")
            report_lines.append("")
            continue
        for sample in samples:
            report_lines.append(f"- `{sample['wrong']}` -> `{sample['correct']}`")
            report_lines.append(f"  - before: `{sample['before']}`")
            report_lines.append(f"  - after: `{sample['after']}`")
        report_lines.append("")

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(report_lines).strip() + "\n", encoding="utf-8")
    print(REPORT_PATH)
    print(json.dumps({
        "scanned_files": len(transcript_paths),
        "touched_files": touched,
        "total_corrections": total_corrections,
        "by_teacher": by_teacher,
    }, ensure_ascii=False, default=dict))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
