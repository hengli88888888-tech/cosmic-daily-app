from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
QIMEN_DIR = ROOT / "specs" / "knowledge-base" / "qimen"
REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-logic-essence-report.md"

TEACHERS = ["钟波", "文艺复兴", "王兴兵", "王永源", "苗道长"]
QUESTION_LABELS = {
    "career_work": "事业工作",
    "love_relationship": "感情婚姻",
    "money_wealth": "财运合作",
    "health_energy": "健康身体",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def asset_rows(filename: str, key: str) -> list[dict]:
    return load_json(QIMEN_DIR / filename)[key]


def summarize_teacher_assets(teacher: str, rows: list[dict], field: str) -> Counter[str]:
    counter: Counter[str] = Counter()
    for row in rows:
        if row.get("source_teacher") != teacher:
            continue
        for tag in row.get(field, []) if isinstance(row.get(field), list) else []:
            if tag in QUESTION_LABELS:
                counter[tag] += 1
        qtype = str(row.get("question_type") or "")
        if qtype in QUESTION_LABELS:
            counter[qtype] += 1
    return counter


def teacher_source_summary(teacher: str, collections: list[list[dict]]) -> list[str]:
    counter: Counter[str] = Counter()
    for collection in collections:
        for row in collection:
            if row.get("source_teacher") != teacher:
                continue
            source_ref = str(row.get("source_ref") or "").strip()
            if source_ref:
                counter[source_ref] += 1
    return [f"{source_ref} ({count})" for source_ref, count in counter.most_common(8)]


def teacher_section_summary(teacher: str, collections: list[list[dict]]) -> list[str]:
    counter: Counter[str] = Counter()
    for collection in collections:
        for row in collection:
            if row.get("source_teacher") != teacher:
                continue
            section = str(row.get("source_section_title") or "").strip()
            if section:
                counter[section] += 1
    return [f"{section} ({count})" for section, count in counter.most_common(8)]


def qtype_strengths(teacher: str, collections: list[list[dict]]) -> list[str]:
    counter: Counter[str] = Counter()
    for collection in collections:
        for row in collection:
            if row.get("source_teacher") != teacher:
                continue
            qtype = str(row.get("question_type") or "")
            if qtype in QUESTION_LABELS:
                counter[qtype] += 1
    return [f"{QUESTION_LABELS[qtype]} ({count})" for qtype, count in counter.most_common()]


def book_mentions(teacher: str, collections: list[list[dict]]) -> list[str]:
    refs = teacher_source_summary(teacher, collections)
    return [ref for ref in refs if ".pdf" in ref]


def main() -> int:
    lessons = load_json(QIMEN_DIR / "qimen-lesson-index.json")["lessons"]
    rules = asset_rows("qimen-rule-cards.json", "rules")
    cases = asset_rows("qimen-case-cards.json", "cases")
    patterns = asset_rows("qimen-reasoning-patterns.json", "patterns")
    conflicts = asset_rows("qimen-conflict-resolution-cards.json", "cards")
    notes = asset_rows("qimen-term-notes.json", "notes")
    collections = [rules, cases, patterns, conflicts, notes]

    lines = [
        "# QiMen Teacher Logic Essence Report",
        "",
        "## 结论先行",
        "",
        "各老师当前已经学入系统的差异，主要仍是同一套阳盘奇门底层理论下的主线锚点、冲突取舍、方法组织和案例偏好差异。",
        "不是完全相反的宇宙观，而是同盘同理下的不同断法组织方式。",
        "",
        "## 共同底层",
        "",
        "- 先定题型和取用神",
        "- 再看落宫、门星神、旺衰和格局",
        "- 冲突时分主次、兑现条件和应期节奏",
        "- 理论基础课与方法书负责托底，实战课负责给出可复盘断链",
        "",
        "## 各老师画像",
        "",
    ]

    for teacher in TEACHERS:
        lesson_rows = [row for row in lessons if row.get("teacher") == teacher]
        status_counts = Counter(row.get("status") for row in lesson_rows)
        foundation_count = sum(1 for row in lesson_rows if row.get("closure_bucket") == "foundation_theory")
        strengths = qtype_strengths(teacher, collections)
        top_sources = teacher_source_summary(teacher, collections)
        top_sections = teacher_section_summary(teacher, collections)
        teacher_books = book_mentions(teacher, collections)

        lines.extend(
            [
                f"### {teacher}",
                f"- lesson_coverage: full={status_counts.get('full_chain', 0)}, strong={status_counts.get('strong_chain', 0)}, partial={status_counts.get('partial_chain', 0)}, foundation={foundation_count}",
                f"- strengths: {'；'.join(strengths[:4]) if strengths else '—'}",
                f"- top_sources: {'；'.join(top_sources[:6]) if top_sources else '—'}",
                f"- top_sections: {'；'.join(top_sections[:6]) if top_sections else '—'}",
                f"- document_books: {'；'.join(teacher_books[:6]) if teacher_books else '—'}",
                "",
            ]
        )

        if teacher == "钟波":
            lines.extend(
                [
                    "本质风格：路径驱动、题型驱动、主线先行。",
                    "适合担任默认主链老师，因为 lesson 主链和理论基础都最完整。",
                    "",
                ]
            )
        elif teacher == "文艺复兴":
            lines.extend(
                [
                    "本质风格：直播实战导向，特别强调条件是否成立、结果是否真实兑现。",
                    "更擅长在事业和财运题里继续追问“机会是不是你的、能不能真落地”。",
                    "",
                ]
            )
        elif teacher == "王兴兵":
            lines.extend(
                [
                    "本质风格：分类预测导向、结构化保守、边界说明强。",
                    "新并入的三本书已经把他的方法底座补厚：",
                    f"- books: {'；'.join(teacher_books[:3]) if teacher_books else '—'}",
                    f"- method_sections: {'；'.join([section for section in top_sections if any(token in section for token in ['健康疾病', '企业经营管理', '股市股票', '证件手续', '分类预测'])][:6]) or '—'}",
                    "当前更像“方法组织者 + 审核校正者”，尤其适合分类预测、边界说明和冲突降噪。",
                    "",
                ]
            )
        elif teacher == "王永源":
            lines.extend(
                [
                    "本质风格：象意与应期感较强，感情题最自然。",
                    "重点价值在关系是否成局、何时触发，以及感情/关系题的走势解释。",
                    "",
                ]
            )
        else:
            lines.extend(
                [
                    "本质风格：状态感、身体感、节奏感较强。",
                    "更擅长把抽象盘义落到身体承载线、外在触发和风险节奏上。",
                    "",
                ]
            )

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
