from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
QIMEN_DIR = ROOT / "specs" / "knowledge-base" / "qimen"
REPORT_MD = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-case-replay-readiness-report.md"
REPORT_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-case-replay-readiness-report.json"

PLATE_MARKERS = [
    "用神",
    "落宫",
    "值符",
    "值使",
    "门",
    "星",
    "神",
    "旬首",
    "年命",
    "太岁",
    "宫",
    "旺衰",
    "格局",
]
NOISE_MARKERS = ["qq.com", "http", "zyqmdj", "zyamdj", "20472836", "//w."]
FOCUS_SOURCES = [
    "王兴兵-易宇山人《奇门遁甲预测案例解析》清楚.pdf",
    "王兴兵-易宇山人《奇门遁甲预测应用》300页--彩扫--400线.pdf",
    "王兴兵-易宇山人《奇门遁甲运筹策划.pdf",
]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def cjk_ratio(text: str) -> float:
    if not text:
        return 0.0
    cjk = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
    return cjk / max(1, len(text))


def plausible_date(text: str) -> bool:
    matched = re.search(r"\b(20\d{6})\b", text)
    if not matched:
        return False
    token = matched.group(1)
    year = int(token[:4])
    month = int(token[4:6])
    day = int(token[6:8])
    return 2000 <= year <= 2035 and 1 <= month <= 12 and 1 <= day <= 31


def noise_hit(text: str) -> bool:
    sample = text.lower()
    return any(marker in sample for marker in NOISE_MARKERS)


def plate_marker_count(text: str) -> int:
    return sum(1 for marker in PLATE_MARKERS if marker in text)


@dataclass
class ReplayAssessment:
    id: str
    title: str
    source_teacher: str
    source_ref: str
    source_section_title: str
    question_type: str
    readiness: str
    score: int
    reasons: list[str]


def assess_case(row: dict) -> ReplayAssessment:
    question_summary = str(row.get("question_summary") or "")
    conclusion = str(row.get("teacher_conclusion") or "")
    reasoning = " ".join(row.get("teacher_reasoning_steps") or [])
    source_section_title = str(row.get("source_section_title") or "")
    evidence_refs = row.get("evidence_refs") or []
    sample = " ".join([question_summary, conclusion, reasoning, source_section_title])

    score = 0
    reasons: list[str] = []

    if source_section_title:
        score += 1
        reasons.append("有单案锚点")
    if plausible_date(f"{source_section_title} {question_summary}"):
        score += 2
        reasons.append("有可信日期")
    if cjk_ratio(question_summary) >= 0.45:
        score += 1
        reasons.append("题干中文密度够")
    if plate_marker_count(sample) >= 3:
        score += 2
        reasons.append("盘面术语较足")
    elif plate_marker_count(sample) >= 1:
        score += 1
        reasons.append("有部分盘面术语")
    if isinstance(evidence_refs, list) and len(evidence_refs) >= 1:
        score += 1
        reasons.append("有证据引用")
    if not noise_hit(sample):
        score += 1
        reasons.append("无明显网页噪声")

    if noise_hit(sample):
        score -= 2
        reasons.append("仍有OCR/网页噪声")
    if cjk_ratio(question_summary) < 0.30:
        score -= 1
        reasons.append("题干中文密度弱")

    if score >= 6:
        readiness = "ready"
    elif score >= 4:
        readiness = "partial"
    else:
        readiness = "quote_only"

    return ReplayAssessment(
        id=str(row.get("id") or ""),
        title=str(row.get("title") or ""),
        source_teacher=str(row.get("source_teacher") or ""),
        source_ref=str(row.get("source_ref") or ""),
        source_section_title=source_section_title,
        question_type=str(row.get("question_type") or ""),
        readiness=readiness,
        score=score,
        reasons=reasons,
    )


def main() -> int:
    payload = load_json(QIMEN_DIR / "qimen-case-cards.json")
    rows = payload["cases"]
    assessments = [assess_case(row) for row in rows]

    by_teacher = defaultdict(list)
    by_source = defaultdict(list)
    for item in assessments:
        by_teacher[item.source_teacher].append(item)
        by_source[item.source_ref].append(item)

    summary = {
        "total_cases": len(assessments),
        "ready": sum(1 for item in assessments if item.readiness == "ready"),
        "partial": sum(1 for item in assessments if item.readiness == "partial"),
        "quote_only": sum(1 for item in assessments if item.readiness == "quote_only"),
    }

    focus_sources = {
        source: [item for item in assessments if source in item.source_ref]
        for source in FOCUS_SOURCES
    }

    report_json = {
        "summary": summary,
        "by_teacher": {
            teacher: dict(Counter(item.readiness for item in items))
            for teacher, items in by_teacher.items()
        },
        "focus_sources": {
            source: {
                "counts": dict(Counter(item.readiness for item in items)),
                "examples": [
                    {
                        "title": item.title,
                        "section": item.source_section_title,
                        "question_type": item.question_type,
                        "readiness": item.readiness,
                        "score": item.score,
                        "reasons": item.reasons,
                    }
                    for item in sorted(items, key=lambda row: (-row.score, row.title))[:12]
                ],
            }
            for source, items in focus_sources.items()
        },
    }
    REPORT_JSON.write_text(json.dumps(report_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# QiMen Case Replay Readiness Report",
        "",
        "这份报告判断现有案例卡是否具备“可拿来做多老师重跑比对”的最低结构条件。",
        "口径：",
        "- `ready`: 有单案锚点、可信日期/较强题干、足够盘面术语、证据引用、且无明显网页噪声。",
        "- `partial`: 可以引用和人工辅助比对，但还不够稳定，不能直接当自动重跑样本。",
        "- `quote_only`: 目前只适合引用，不适合拿来做多老师同题重跑。",
        "",
        "## Summary",
        "",
        f"- total_cases: {summary['total_cases']}",
        f"- ready: {summary['ready']}",
        f"- partial: {summary['partial']}",
        f"- quote_only: {summary['quote_only']}",
        "",
        "## By Teacher",
        "",
    ]

    for teacher in sorted(by_teacher):
        counts = Counter(item.readiness for item in by_teacher[teacher])
        lines.extend(
            [
                f"### {teacher}",
                f"- ready: {counts.get('ready', 0)}",
                f"- partial: {counts.get('partial', 0)}",
                f"- quote_only: {counts.get('quote_only', 0)}",
                "",
            ]
        )

    lines.extend(["## Wang Xingbing Focus", ""])
    for source in FOCUS_SOURCES:
        items = focus_sources[source]
        counts = Counter(item.readiness for item in items)
        lines.extend(
            [
                f"### {source}",
                f"- ready: {counts.get('ready', 0)}",
                f"- partial: {counts.get('partial', 0)}",
                f"- quote_only: {counts.get('quote_only', 0)}",
                "",
            ]
        )
        for item in sorted(items, key=lambda row: (-row.score, row.title))[:8]:
            lines.append(
                f"- {item.source_section_title or item.title}: {item.readiness} (score={item.score}) / {'；'.join(item.reasons[:4])}"
            )
        lines.append("")

    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT_MD}")
    print(f"Wrote {REPORT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
