from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
QIMEN_DIR = ROOT / "specs" / "knowledge-base" / "qimen"
REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-difference-report.md"

TEACHERS = ["钟波", "文艺复兴", "王兴兵", "王永源", "苗道长"]
QUESTION_TYPES = ["career_work", "love_relationship", "money_wealth", "health_energy"]
QUESTION_LABELS = {
    "career_work": "事业工作",
    "love_relationship": "感情婚姻",
    "money_wealth": "财运合作",
    "health_energy": "健康身体",
}

FEATURE_KEYWORDS = {
    "用神": ["用神"],
    "落宫": ["落宫", "宫位"],
    "门星神": ["门星神", "门", "星", "神"],
    "格局": ["格局", "反吟", "伏吟", "凶格", "击刑", "入墓"],
    "旺衰": ["旺衰", "旺", "衰", "休囚"],
    "生克制化": ["生克", "克应", "制化", "合冲", "冲合"],
    "应期节奏": ["应期", "节奏", "时机", "何时", "入秋", "年内", "近期"],
    "反馈校验": ["反馈", "应验", "结果", "落地"],
    "关系成局": ["关系", "复合", "离婚", "婚姻", "成局", "推进"],
    "财路回款": ["财运", "回款", "投资", "客户", "中标", "合作"],
    "病位病程": ["病位", "恢复", "手术", "病程", "轻重", "健康"],
    "决策权": ["决策权", "甲方", "岗位", "项目", "中标"],
    "基础理论": ["十天干", "五行", "八卦", "九星", "八神", "类象"],
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_text(value: str) -> str:
    value = value or ""
    return re.sub(r"\s+", " ", value).strip()


def percentage(numerator: int, denominator: int) -> str:
    if denominator <= 0:
        return "0.0%"
    return f"{(numerator / denominator) * 100:.1f}%"


def asset_rows(filename: str, key: str) -> list[dict]:
    payload = load_json(QIMEN_DIR / filename)
    return payload[key]


def extract_features(text: str) -> set[str]:
    sample = normalize_text(text)
    hits: set[str] = set()
    for feature, keywords in FEATURE_KEYWORDS.items():
        if any(keyword in sample for keyword in keywords):
            hits.add(feature)
    return hits


@dataclass
class TeacherSummary:
    teacher: str
    lesson_total: int
    full: int
    strong: int
    partial: int
    reference_only: int
    foundation: int
    rules: int
    cases: int
    patterns: int
    conflicts: int
    top_sources: list[str]


def build_teacher_summary(lessons: list[dict], rules: list[dict], cases: list[dict], patterns: list[dict], conflicts: list[dict]) -> list[TeacherSummary]:
    out: list[TeacherSummary] = []
    for teacher in TEACHERS:
        lesson_rows = [row for row in lessons if row.get("teacher") == teacher]
        status_counts = Counter(row.get("status") for row in lesson_rows)
        foundation_count = sum(1 for row in lesson_rows if row.get("closure_bucket") == "foundation_theory")
        source_counter: Counter[str] = Counter()
        for collection in (rules, cases, patterns, conflicts):
            for row in collection:
                if row.get("source_teacher") != teacher:
                    continue
                source_ref = str(row.get("source_ref") or "").strip()
                if not source_ref:
                    continue
                source_counter[source_ref] += 1
        out.append(
            TeacherSummary(
                teacher=teacher,
                lesson_total=len(lesson_rows),
                full=status_counts.get("full_chain", 0),
                strong=status_counts.get("strong_chain", 0),
                partial=status_counts.get("partial_chain", 0),
                reference_only=status_counts.get("reference_only", 0),
                foundation=foundation_count,
                rules=sum(1 for row in rules if row.get("source_teacher") == teacher),
                cases=sum(1 for row in cases if row.get("source_teacher") == teacher),
                patterns=sum(1 for row in patterns if row.get("source_teacher") == teacher),
                conflicts=sum(1 for row in conflicts if row.get("source_teacher") == teacher),
                top_sources=[
                    f"{source_ref} ({count})"
                    for source_ref, count in source_counter.most_common(5)
                ],
            )
        )
    return out


def feature_sets_by_teacher_and_qtype(rules: list[dict], patterns: list[dict], conflicts: list[dict]) -> dict[tuple[str, str], set[str]]:
    result: dict[tuple[str, str], set[str]] = defaultdict(set)
    for row in rules:
        teacher = row.get("source_teacher")
        qtype = row.get("question_type")
        if teacher not in TEACHERS or qtype not in QUESTION_TYPES:
            continue
        text = " ".join(
            [
                str(row.get("title", "")),
                str(row.get("rule_text", "")),
                " ".join(row.get("trigger_terms", []) if isinstance(row.get("trigger_terms"), list) else []),
                " ".join(row.get("tags", []) if isinstance(row.get("tags"), list) else []),
            ]
        )
        result[(teacher, qtype)].update(extract_features(text))
    for row in patterns:
        teacher = row.get("source_teacher")
        qtype = row.get("question_type")
        if teacher not in TEACHERS or qtype not in QUESTION_TYPES:
            continue
        text = " ".join(
            [str(row.get("title", ""))]
            + (row.get("steps", []) if isinstance(row.get("steps"), list) else [])
            + (row.get("tags", []) if isinstance(row.get("tags"), list) else [])
        )
        result[(teacher, qtype)].update(extract_features(text))
    for row in conflicts:
        teacher = row.get("source_teacher")
        qtype = row.get("question_type")
        if teacher not in TEACHERS or qtype not in QUESTION_TYPES:
            continue
        text = " ".join(
            [
                str(row.get("title", "")),
                str(row.get("conflict_rule", "")),
                " ".join(row.get("tags", []) if isinstance(row.get("tags"), list) else []),
            ]
        )
        result[(teacher, qtype)].update(extract_features(text))
    return result


def teacher_difference_rows(feature_sets: dict[tuple[str, str], set[str]]) -> list[dict]:
    rows: list[dict] = []
    for teacher in TEACHERS:
        if teacher == "钟波":
            continue
        for qtype in QUESTION_TYPES:
            teacher_features = feature_sets.get((teacher, qtype), set())
            zhongbo_features = feature_sets.get(("钟波", qtype), set())
            if not teacher_features and not zhongbo_features:
                continue
            overlap = teacher_features & zhongbo_features
            union = teacher_features | zhongbo_features
            teacher_only = teacher_features - zhongbo_features
            rows.append(
                {
                    "teacher": teacher,
                    "question_type": qtype,
                    "teacher_feature_count": len(teacher_features),
                    "zhongbo_feature_count": len(zhongbo_features),
                    "overlap_count": len(overlap),
                    "union_count": len(union),
                    "difference_ratio": 0.0 if not union else 1 - (len(overlap) / len(union)),
                    "teacher_unique_ratio": 0.0 if not teacher_features else len(teacher_only) / len(teacher_features),
                    "shared_features": sorted(overlap),
                    "teacher_unique_features": sorted(teacher_only),
                }
            )
    return rows


def write_report(
    summaries: list[TeacherSummary],
    difference_rows: list[dict],
    feature_sets: dict[tuple[str, str], set[str]],
) -> None:
    lines: list[str] = [
        "# QiMen Teacher Difference Report",
        "",
        "## Summary",
        "",
        "这份报告按 lesson 主链覆盖和 `rule/pattern/conflict` 方法特征，统计各老师当前已学入系统的差异占比。",
        "差异占比口径：以钟波为主链参照，对每位老师在同题型的方法特征集合做对比。",
        "- `difference_ratio = 1 - overlap / union`",
        "- `teacher_unique_ratio = teacher_only / teacher_features`",
        "",
        "## Teacher Coverage",
        "",
    ]

    for summary in summaries:
        lines.extend(
            [
                f"### {summary.teacher}",
                f"- lessons: {summary.lesson_total}",
                f"- full_chain: {summary.full}",
                f"- strong_chain: {summary.strong}",
                f"- partial_chain: {summary.partial}",
                f"- reference_only: {summary.reference_only}",
                f"- foundation_theory: {summary.foundation}",
                f"- assets: rules={summary.rules}, cases={summary.cases}, patterns={summary.patterns}, conflicts={summary.conflicts}",
                f"- top_sources: {'；'.join(summary.top_sources) if summary.top_sources else '—'}",
                "",
            ]
        )

    lines.extend(["## Difference vs 钟波", ""])
    for qtype in QUESTION_TYPES:
        lines.append(f"### {QUESTION_LABELS[qtype]}")
        for row in [item for item in difference_rows if item["question_type"] == qtype]:
            lines.extend(
                [
                    f"- {row['teacher']}: difference={row['difference_ratio'] * 100:.1f}%, unique={row['teacher_unique_ratio'] * 100:.1f}%, shared={row['overlap_count']}, teacher_features={row['teacher_feature_count']}",
                    f"  shared: {'、'.join(row['shared_features']) if row['shared_features'] else '—'}",
                    f"  unique: {'、'.join(row['teacher_unique_features']) if row['teacher_unique_features'] else '—'}",
                ]
            )
        lines.append("")

    lines.extend(["## Feature Footprint", ""])
    for teacher in TEACHERS:
        lines.append(f"### {teacher}")
        for qtype in QUESTION_TYPES:
            features = sorted(feature_sets.get((teacher, qtype), set()))
            if not features:
                continue
            lines.append(f"- {QUESTION_LABELS[qtype]}: {'、'.join(features)}")
        lines.append("")

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    lessons = load_json(QIMEN_DIR / "qimen-lesson-index.json")["lessons"]
    rules = asset_rows("qimen-rule-cards.json", "rules")
    cases = asset_rows("qimen-case-cards.json", "cases")
    patterns = asset_rows("qimen-reasoning-patterns.json", "patterns")
    conflicts = asset_rows("qimen-conflict-resolution-cards.json", "cards")

    summaries = build_teacher_summary(lessons, rules, cases, patterns, conflicts)
    feature_sets = feature_sets_by_teacher_and_qtype(rules, patterns, conflicts)
    diff_rows = teacher_difference_rows(feature_sets)
    write_report(summaries, diff_rows, feature_sets)
    print(f"Wrote {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
