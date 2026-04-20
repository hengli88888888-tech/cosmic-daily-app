from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
QIMEN_DIR = ROOT / "specs" / "knowledge-base" / "qimen"
READINESS_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-case-replay-readiness-report.json"
REPORT_MD = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-case-alignment-report.md"
REPORT_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-case-alignment-report.json"

TEACHERS = ["钟波", "文艺复兴", "王兴兵", "王永源", "苗道长"]
QUESTION_LABELS = {
    "career_work": "事业工作",
    "love_relationship": "感情婚姻",
    "money_wealth": "财运合作",
    "health_energy": "健康身体",
}

STOPWORDS = {
    "当前",
    "这个",
    "那个",
    "我们",
    "他们",
    "老师",
    "判断",
    "案例",
    "奇门",
    "预测",
    "先生",
    "女士",
    "求测",
    "咨询",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def cjk_terms(text: str) -> list[str]:
    hits = re.findall(r"[\u4e00-\u9fff]{2,8}", normalize_text(text))
    out: list[str] = []
    for hit in hits:
        if hit in STOPWORDS:
            continue
        if hit not in out:
            out.append(hit)
    return out


def asset_rows(filename: str, key: str) -> list[dict]:
    return load_json(QIMEN_DIR / filename)[key]


def case_query_terms(case_row: dict) -> list[str]:
    raw = " ".join(
        [
            str(case_row.get("source_section_title") or ""),
            str(case_row.get("question_summary") or ""),
            str(case_row.get("teacher_conclusion") or ""),
            " ".join(case_row.get("tags") or []),
        ]
    )
    terms = cjk_terms(raw)
    boosted: list[str] = []
    for marker in [
        "病位",
        "恢复",
        "感情",
        "婚姻",
        "关系",
        "财运",
        "合作",
        "回款",
        "工作",
        "事业",
        "应聘",
        "总统",
        "大选",
        "店铺",
        "证件",
        "企业",
        "管理",
    ]:
        if marker in raw and marker not in terms:
            boosted.append(marker)
    return (boosted + terms)[:12]


def row_text(row: dict, kind: str) -> str:
    chunks = [
        str(row.get("title") or ""),
        str(row.get("source_section_title") or ""),
        " ".join(row.get("tags") or []),
    ]
    if kind == "rule":
        chunks.append(str(row.get("rule_text") or ""))
    elif kind == "pattern":
        chunks.extend(row.get("steps") or [])
        chunks.append(str(row.get("notes") or ""))
    elif kind == "conflict":
        chunks.append(str(row.get("conflict_rule") or ""))
    else:
        chunks.append(str(row.get("question_summary") or ""))
        chunks.append(str(row.get("teacher_conclusion") or ""))
    return normalize_text(" ".join(chunks))


def score_row(row: dict, kind: str, qtype: str, terms: list[str]) -> float:
    if row.get("question_type") != qtype:
        return -1.0
    text = row_text(row, kind)
    score = 0.0
    overlap = [term for term in terms if term and term in text]
    score += len(overlap) * 1.5
    if isinstance(row.get("tags"), list):
        score += sum(0.5 for tag in row["tags"] if tag in terms)
    if row.get("knowledge_tier") == "support":
        score += 0.5
    if row.get("knowledge_tier") == "core":
        score += 1.0
    if row.get("source_type") == "document":
        score += 0.2
    return score


def best_match(rows: list[dict], teacher: str, kind: str, qtype: str, terms: list[str]) -> dict | None:
    candidates = [row for row in rows if row.get("source_teacher") == teacher]
    ranked = sorted(
        ((score_row(row, kind, qtype, terms), row) for row in candidates),
        key=lambda item: (-item[0], str(item[1].get("title") or "")),
    )
    if not ranked or ranked[0][0] <= 0:
        return None
    score, row = ranked[0]
    return {
        "score": round(score, 2),
        "title": row.get("title"),
        "source_ref": row.get("source_ref"),
        "source_section_title": row.get("source_section_title"),
        "knowledge_tier": row.get("knowledge_tier"),
    }


def alignment_label(parts: dict[str, dict | None]) -> str:
    matched = sum(1 for value in parts.values() if value)
    if matched >= 3:
        return "aligned"
    if matched >= 2:
        return "partial"
    return "insufficient"


def main() -> int:
    readiness = load_json(READINESS_JSON)
    ready_map = {
        (item["section"], item["question_type"], item["title"]): item
        for source in readiness["focus_sources"].values()
        for item in source["examples"]
        if item["readiness"] == "ready"
    }

    cases = asset_rows("qimen-case-cards.json", "cases")
    rules = asset_rows("qimen-rule-cards.json", "rules")
    patterns = asset_rows("qimen-reasoning-patterns.json", "patterns")
    conflicts = asset_rows("qimen-conflict-resolution-cards.json", "cards")

    wang_ready_cases = []
    for row in cases:
        if row.get("source_teacher") != "王兴兵":
            continue
        key = (
            str(row.get("source_section_title") or ""),
            str(row.get("question_type") or ""),
            str(row.get("title") or ""),
        )
        if key in ready_map:
            wang_ready_cases.append(row)

    comparisons = []
    teacher_summary = defaultdict(Counter)

    for case_row in wang_ready_cases:
        qtype = str(case_row.get("question_type") or "")
        terms = case_query_terms(case_row)
        teacher_runs = []
        for teacher in TEACHERS:
            parts = {
                "rule": best_match(rules, teacher, "rule", qtype, terms),
                "pattern": best_match(patterns, teacher, "pattern", qtype, terms),
                "conflict": best_match(conflicts, teacher, "conflict", qtype, terms),
                "case": best_match(cases, teacher, "case", qtype, terms),
            }
            label = alignment_label(parts)
            teacher_summary[teacher][label] += 1
            teacher_runs.append(
                {
                    "teacher": teacher,
                    "alignment": label,
                    "matches": parts,
                }
            )
        comparisons.append(
            {
                "title": case_row.get("title"),
                "question_type": qtype,
                "source_ref": case_row.get("source_ref"),
                "source_section_title": case_row.get("source_section_title"),
                "question_summary": case_row.get("question_summary"),
                "teacher_conclusion": case_row.get("teacher_conclusion"),
                "terms": terms,
                "teacher_runs": teacher_runs,
            }
        )

    report_json = {
        "ready_case_count": len(wang_ready_cases),
        "teacher_summary": {teacher: dict(counter) for teacher, counter in teacher_summary.items()},
        "comparisons": comparisons,
    }
    REPORT_JSON.write_text(json.dumps(report_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# QiMen Teacher Case Alignment Report",
        "",
        "这份报告用王兴兵的 `ready` 案例做首轮跨老师逻辑对齐检查。",
        "注意：这里是“逻辑骨架对齐”，不是严格盘面复算。",
        "要严格验证“是不是会得出同一个结果”，还需要把这些案例补成可重跑案例包。",
        "",
        f"- ready_cases: {len(wang_ready_cases)}",
        "",
        "## Teacher Summary",
        "",
    ]

    for teacher in TEACHERS:
        counter = teacher_summary[teacher]
        lines.extend(
            [
                f"### {teacher}",
                f"- aligned: {counter.get('aligned', 0)}",
                f"- partial: {counter.get('partial', 0)}",
                f"- insufficient: {counter.get('insufficient', 0)}",
                "",
            ]
        )

    lines.extend(["## Case Comparisons", ""])
    for item in comparisons:
        lines.extend(
            [
                f"### {item['source_section_title']} / {QUESTION_LABELS.get(item['question_type'], item['question_type'])}",
                f"- source_ref: {item['source_ref']}",
                f"- wang_question_summary: {item['question_summary']}",
                f"- wang_conclusion: {item['teacher_conclusion']}",
                f"- query_terms: {'、'.join(item['terms'])}",
                "",
            ]
        )
        for run in item["teacher_runs"]:
            lines.append(f"- {run['teacher']}: {run['alignment']}")
            for kind in ["rule", "pattern", "conflict", "case"]:
                match = run["matches"][kind]
                if not match:
                    lines.append(f"  {kind}: —")
                else:
                    lines.append(
                        f"  {kind}: {match['title']} / {match.get('source_section_title') or '—'} / score={match['score']}"
                    )
        lines.append("")

    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT_MD}")
    print(f"Wrote {REPORT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
