from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
QIMEN_DIR = ROOT / "specs" / "knowledge-base" / "qimen"
READINESS_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-case-replay-readiness-report.json"
ALIGNMENT_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-case-alignment-report.json"
OUT_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-case-replay-packs.json"
OUT_MD = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-case-replay-packs.md"

PLATE_MARKERS = ["值符", "值使", "旬首", "阳遁", "阴遁", "局", "落宫", "年命", "太岁", "门", "星", "神"]
QUESTION_LABELS = {
    "career_work": "事业工作",
    "love_relationship": "感情婚姻",
    "money_wealth": "财运合作",
    "health_energy": "健康身体",
}
TARGET_TEACHERS = ["钟波", "文艺复兴", "王永源", "苗道长"]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def plausible_date(text: str) -> str:
    matched = re.search(r"\b(20\d{6})\b", text)
    if not matched:
        return ""
    token = matched.group(1)
    year = int(token[:4])
    month = int(token[4:6])
    day = int(token[6:8])
    if 2000 <= year <= 2035 and 1 <= month <= 12 and 1 <= day <= 31:
        return token
    return ""


def plausible_time(text: str) -> str:
    matched = re.search(r"([01]?\d|2[0-3])时([0-5]?\d)?", text)
    return matched.group(0) if matched else ""


def mentioned_plate_markers(text: str) -> list[str]:
    return [marker for marker in PLATE_MARKERS if marker in text]


def replay_mode(date_token: str, markers: list[str], evidence_refs: list[str]) -> str:
    if date_token and len(markers) >= 4 and len(evidence_refs) >= 1:
        return "near_replay"
    if len(markers) >= 2:
        return "logic_alignment_only"
    return "quote_only"


def missing_fields(date_token: str, time_token: str, markers: list[str]) -> list[str]:
    missing: list[str] = []
    if not date_token:
        missing.append("date")
    if not time_token:
        missing.append("time")
    if len(markers) < 4:
        missing.append("full_plate_markers")
    return missing


def main() -> int:
    readiness = load_json(READINESS_JSON)
    alignment = load_json(ALIGNMENT_JSON)
    cases = load_json(QIMEN_DIR / "qimen-case-cards.json")["cases"]

    ready_keys = {
        (item["section"], item["question_type"], item["title"])
        for source in readiness["focus_sources"].values()
        for item in source["examples"]
        if item["readiness"] == "ready"
    }
    alignment_index = {
        (item["source_section_title"], item["question_type"], item["title"]): item
        for item in alignment["comparisons"]
    }

    packs = []
    for row in cases:
        if row.get("source_teacher") != "王兴兵":
            continue
        key = (
            str(row.get("source_section_title") or ""),
            str(row.get("question_type") or ""),
            str(row.get("title") or ""),
        )
        if key not in ready_keys:
            continue

        sample = " ".join(
            [
                str(row.get("question_summary") or ""),
                " ".join(row.get("teacher_reasoning_steps") or []),
                str(row.get("teacher_conclusion") or ""),
            ]
        )
        date_token = plausible_date(sample) or plausible_date(str(row.get("source_section_title") or ""))
        time_token = plausible_time(sample)
        markers = mentioned_plate_markers(sample)
        evidence_refs = list(row.get("evidence_refs") or [])
        mode = replay_mode(date_token, markers, evidence_refs)
        missing = missing_fields(date_token, time_token, markers)

        aligned = alignment_index.get(key, {})
        teacher_alignment = {}
        for teacher in TARGET_TEACHERS:
            run = next((item for item in aligned.get("teacher_runs", []) if item.get("teacher") == teacher), None)
            teacher_alignment[teacher] = {
                "alignment": run.get("alignment") if run else "missing",
                "rule": (run or {}).get("matches", {}).get("rule"),
                "pattern": (run or {}).get("matches", {}).get("pattern"),
                "conflict": (run or {}).get("matches", {}).get("conflict"),
                "case": (run or {}).get("matches", {}).get("case"),
            }

        packs.append(
            {
                "id": row.get("id"),
                "title": row.get("title"),
                "question_type": row.get("question_type"),
                "question_type_label": QUESTION_LABELS.get(str(row.get("question_type") or ""), str(row.get("question_type") or "")),
                "source_ref": row.get("source_ref"),
                "source_section_title": row.get("source_section_title"),
                "source_section_anchor": row.get("source_section_anchor"),
                "replay_mode": mode,
                "missing_fields": missing,
                "date_token": date_token,
                "time_token": time_token,
                "plate_markers": markers,
                "question_summary": row.get("question_summary"),
                "teacher_reasoning_steps": row.get("teacher_reasoning_steps"),
                "teacher_conclusion": row.get("teacher_conclusion"),
                "feedback_summary": row.get("feedback_summary"),
                "evidence_refs": evidence_refs,
                "teacher_alignment": teacher_alignment,
            }
        )

    OUT_JSON.write_text(json.dumps({"packs": packs}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# QiMen Case Replay Packs",
        "",
        "这份清单把王兴兵 `ready` 案例整理成后续多老师复跑包。",
        "- `near_replay`: 已有可信日期、一定盘面术语和证据引用，补标准盘面后可进入严格复跑。",
        "- `logic_alignment_only`: 目前适合做逻辑骨架对照，不足以直接严格复盘。",
        "",
        f"- total_packs: {len(packs)}",
        "",
    ]

    for pack in packs:
        lines.extend(
            [
                f"## {pack['source_section_title']} / {pack['question_type_label']}",
                f"- replay_mode: {pack['replay_mode']}",
                f"- missing_fields: {'、'.join(pack['missing_fields']) if pack['missing_fields'] else '无'}",
                f"- date_token: {pack['date_token'] or '—'}",
                f"- time_token: {pack['time_token'] or '—'}",
                f"- plate_markers: {'、'.join(pack['plate_markers']) if pack['plate_markers'] else '—'}",
                f"- source_ref: {pack['source_ref']}",
                f"- question_summary: {normalize_text(pack['question_summary'])}",
                f"- wang_conclusion: {normalize_text(pack['teacher_conclusion'])}",
                "",
                "### Teacher Alignment",
            ]
        )
        for teacher in TARGET_TEACHERS:
            item = pack["teacher_alignment"][teacher]
            lines.append(f"- {teacher}: {item['alignment']}")
        lines.append("")

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_MD}")
    print(f"Wrote {OUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
