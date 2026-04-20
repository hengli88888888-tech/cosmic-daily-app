#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
KB_DIR = ROOT / "specs" / "knowledge-base"
RAW_DIR = ROOT / "data" / "raw-transcripts"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text())


def transcript_courses(teacher: str) -> list[str]:
    root = RAW_DIR / teacher
    if not root.exists():
        return []
    ignored = {"unknown", "盲派八字的概念"}
    return sorted([p.name for p in root.iterdir() if p.is_dir() and p.name not in ignored])


def main() -> None:
    status = load_json(KB_DIR / "ingestion-status.json")
    teacher_rules = load_json(KB_DIR / "teacher-rule-library.json")
    occupation_patterns = load_json(KB_DIR / "occupation-patterns.json")
    life_event_patterns = load_json(KB_DIR / "life-event-patterns.json")

    print("Knowledge Base Coverage")
    print()

    for teacher_entry in status["teachers"]:
        teacher = teacher_entry["teacher"]
        print(f"Teacher: {teacher}")
        print(f"Scope: {teacher_entry['scope']}")
        print()

        summary = teacher_entry["summary"]
        print("Structured totals:")
        print(f"- teacher rules: {summary['teacher_rule_count']}")
        print(f"- occupation patterns: {summary['occupation_pattern_count']}")
        print(f"- life-event patterns: {summary['life_event_pattern_count']}")
        print(f"- transcript courses on disk: {summary['transcript_course_count']}")
        print()

        tracked_courses: set[str] = set()
        print("Status groups:")
        for group in teacher_entry["status_groups"]:
            print(f"- {group['group']} [{group['status']}]: {len(group['courses'])}")
            for course in group["courses"]:
                print(f"  - {course}")
                tracked_courses.add(course.split(" -> ")[0].strip())
        print()

        on_disk = set(transcript_courses(teacher))
        untracked = sorted(on_disk - tracked_courses)
        print("Untracked transcript courses:")
        if untracked:
            for course in untracked:
                print(f"- {course}")
        else:
            print("- none")
        print()

        print("Next priority:")
        for item in teacher_entry["next_priority"]:
            print(f"- {item}")
        print()

    print("Validation snapshot:")
    print(f"- teacher-rule-library rules: {len(teacher_rules['teachers'][0]['rules'])}")
    print(f"- occupation patterns: {len(occupation_patterns['occupations'])}")
    print(f"- life-event patterns: {len(life_event_patterns['patterns'])}")


if __name__ == "__main__":
    main()
