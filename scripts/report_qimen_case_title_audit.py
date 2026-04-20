#!/usr/bin/env python3
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
DATA_DIR = ROOT / "data" / "import-runs" / "qimen-yangpan"
INPUT_PATH = DATA_DIR / "qimen-teacher-case-replay-inputs.json"
JSON_OUT = DATA_DIR / "qimen-case-title-audit-report.json"
MD_OUT = DATA_DIR / "qimen-case-title-audit-report.md"

SUSPICIOUS_TOKENS = [
    "页女士",
    "于失",
    "关失",
    "身身",
    "仁泛",
    "葵老公",
    "部女士",
    "举女士",
    "溉于",
]


def load_inputs():
    payload = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    return payload["inputs"]


def build_report():
    inputs = load_inputs()
    title_to_cases = defaultdict(list)
    date_to_cases = defaultdict(list)
    suspicious = []

    for item in inputs:
        title = item.get("source_section_title", "").strip()
        case_id = item["case_id"]
        title_to_cases[title].append(case_id)
        date_to_cases[item.get("date_token", "")].append((case_id, title))

        matched = [token for token in SUSPICIOUS_TOKENS if token in title]
        if matched:
            suspicious.append(
                {
                    "case_id": case_id,
                    "title": title,
                    "matched_tokens": matched,
                }
            )

    duplicate_titles = [
        {"title": title, "case_ids": case_ids}
        for title, case_ids in sorted(title_to_cases.items())
        if title and len(case_ids) > 1
    ]

    multi_case_dates = [
        {
            "date_token": date_token,
            "cases": [{"case_id": case_id, "title": title} for case_id, title in cases],
        }
        for date_token, cases in sorted(date_to_cases.items())
        if date_token and len(cases) > 1
    ]

    return {
        "summary": {
            "input_cases": len(inputs),
            "suspicious_title_cases": len(suspicious),
            "duplicate_title_groups": len(duplicate_titles),
            "multi_case_dates": len(multi_case_dates),
        },
        "suspicious_titles": suspicious,
        "duplicate_titles": duplicate_titles,
        "multi_case_dates": multi_case_dates,
    }


def write_markdown(report):
    lines = [
        "# 奇门案例标题审计",
        "",
        f"- 输入案例数: {report['summary']['input_cases']}",
        f"- 可疑标题数: {report['summary']['suspicious_title_cases']}",
        f"- 重复标题组数: {report['summary']['duplicate_title_groups']}",
        f"- 同日多案例日期数: {report['summary']['multi_case_dates']}",
        "",
        "## 可疑标题",
        "",
    ]

    if report["suspicious_titles"]:
        for item in report["suspicious_titles"]:
            lines.append(f"- {item['title']} :: {item['case_id']} :: {', '.join(item['matched_tokens'])}")
    else:
        lines.append("- 无")

    lines.extend(["", "## 重复标题", ""])
    if report["duplicate_titles"]:
        for item in report["duplicate_titles"]:
            lines.append(f"- {item['title']}")
            lines.append(f"  - case_ids: {', '.join(item['case_ids'])}")
    else:
        lines.append("- 无")

    lines.extend(["", "## 同日多案例", ""])
    for item in report["multi_case_dates"]:
        lines.append(f"- {item['date_token']}")
        for case in item["cases"]:
            lines.append(f"  - {case['title']} :: {case['case_id']}")

    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    report = build_report()
    JSON_OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(report)
    print(f"wrote {JSON_OUT}")
    print(f"wrote {MD_OUT}")


if __name__ == "__main__":
    main()
