#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
DATA_DIR = ROOT / "data" / "import-runs" / "qimen-yangpan"
INPUT_PATH = DATA_DIR / "qimen-teacher-case-replay-inputs.json"
JSON_OUT = DATA_DIR / "qimen-case-coverage-report.json"
MD_OUT = DATA_DIR / "qimen-case-coverage-report.md"
DEEP_EXTRACTION_PATHS = [
    DATA_DIR / "王兴兵-易宇山人《奇门遁甲预测应用》300页--彩扫--400线-deep-extraction.json",
    DATA_DIR / "王兴兵-易宇山人《奇门遁甲运筹策划-deep-extraction.json",
    DATA_DIR / "王兴兵-易宇山人《奇门遁甲预测案例解析》清楚-deep-extraction.json",
]

DATE_PATTERN = re.compile(r"(20\d{2})[.\-/年 ]?(\d{2})[.\-/月 ]?(\d{2})")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_text(value: str) -> str:
    value = value or ""
    value = re.sub(r"\s+", "", value)
    for old, new in [
        ("？", "?"),
        ("，", ","),
        ("。", ""),
        ("、", ""),
        ("；", ""),
        ("：", ""),
        ("“", ""),
        ("”", ""),
        ("'", ""),
        ('"', ""),
        ("*", ""),
    ]:
        value = value.replace(old, new)
    return value.strip()


def extract_date_token(*values: str) -> str:
    for value in values:
        match = DATE_PATTERN.search(value or "")
        if match:
            year, month, day = match.groups()
            if 1 <= int(month) <= 12 and 1 <= int(day) <= 31:
                return f"{year}{month}{day}"
    return ""


def chinese_only(value: str) -> str:
    return "".join(re.findall(r"[\u4e00-\u9fff]", value or ""))


def ngrams(value: str, min_len: int = 2, max_len: int = 4) -> set[str]:
    text = chinese_only(value)
    tokens: set[str] = set()
    for size in range(min_len, max_len + 1):
        for idx in range(0, max(0, len(text) - size + 1)):
            tokens.add(text[idx : idx + size])
    return tokens


def build_input_index(inputs: list[dict]) -> dict[str, list[dict]]:
    indexed: dict[str, list[dict]] = defaultdict(list)
    for item in inputs:
        indexed[item.get("date_token", "")].append(item)
    return indexed


def card_question_text(card: dict) -> str:
    return str(card.get("question_summary") or card.get("title") or card.get("source_section_title") or "")


def is_match(card: dict, input_item: dict) -> bool:
    if card.get("question_type") != input_item.get("question_type"):
        return False

    card_text = normalize_text(card_question_text(card))
    input_question = normalize_text(
        str(input_item.get("normalized_question") or input_item.get("question") or "")
    )
    input_title = normalize_text(str(input_item.get("source_section_title") or ""))

    if not card_text:
        return False
    if card_text == input_question or card_text == input_title:
        return True
    if card_text in input_question or input_question in card_text:
        return True
    if card_text in input_title or input_title in card_text:
        return True
    return False


def best_overlap_match(card: dict, candidates: list[dict]) -> dict | None:
    card_text = " ".join(
        [
            str(card.get("source_section_title") or ""),
            str(card.get("question_summary") or ""),
            str(card.get("title") or ""),
        ]
    )
    card_ngrams = ngrams(card_text)
    if not card_ngrams:
        return None

    scored = []
    for candidate in candidates:
        candidate_text = " ".join(
            [
                str(candidate.get("source_section_title") or ""),
                str(candidate.get("normalized_question") or ""),
                str(candidate.get("question") or ""),
            ]
        )
        score = 0
        for token in card_ngrams:
            if token in candidate_text:
                score += len(token) * len(token)
        if score > 0:
            scored.append((score, candidate))

    if not scored:
        return None

    scored.sort(key=lambda item: item[0], reverse=True)
    if len(scored) == 1 or scored[0][0] > scored[1][0]:
        return scored[0][1]
    return None


def build_report() -> dict:
    inputs = load_json(INPUT_PATH)["inputs"]
    indexed_inputs = build_input_index(inputs)
    input_by_date_only: dict[str, list[dict]] = defaultdict(list)
    for item in inputs:
        input_by_date_only[item.get("date_token", "")].append(item)

    source_rows = []
    covered_cards = []
    missing_cards = []
    match_status_counts = Counter()

    for path in DEEP_EXTRACTION_PATHS:
        payload = load_json(path)
        cards = payload.get("case_cards") or []
        dated_cards = []
        for card in cards:
            date_token = extract_date_token(
                str(card.get("source_section_title") or ""),
                str(card.get("question_summary") or ""),
                str(card.get("title") or ""),
            )
            if not date_token:
                continue
            dated_cards.append(card | {"date_token": date_token})

        source_missing = []
        source_covered = []
        for card in dated_cards:
            matched_input = None
            match_status = "missing"
            for input_item in indexed_inputs.get(card["date_token"], []):
                if is_match(card, input_item):
                    matched_input = input_item
                    match_status = "text_match"
                    break

            if not matched_input:
                same_type_inputs = [
                    item
                    for item in indexed_inputs.get(card["date_token"], [])
                    if item.get("question_type") == card.get("question_type")
                ]
                if len(same_type_inputs) == 1:
                    matched_input = same_type_inputs[0]
                    match_status = "same_date_type_unique"

            if not matched_input:
                same_date_inputs = input_by_date_only.get(card["date_token"], [])
                if len(same_date_inputs) == 1:
                    matched_input = same_date_inputs[0]
                    match_status = "same_date_cross_type_unique"

            if not matched_input:
                overlap_match = best_overlap_match(card, input_by_date_only.get(card["date_token"], []))
                if overlap_match:
                    matched_input = overlap_match
                    match_status = "same_date_overlap_match"

            row = {
                "date_token": card["date_token"],
                "question_type": card.get("question_type"),
                "source_section_title": card.get("source_section_title"),
                "question_summary": card.get("question_summary"),
                "source_file": path.name,
            }

            if matched_input:
                row["matched_case_id"] = matched_input.get("case_id")
                row["matched_input_title"] = matched_input.get("source_section_title")
                row["match_status"] = match_status
                source_covered.append(row)
                covered_cards.append(row)
                match_status_counts[match_status] += 1
            else:
                source_missing.append(row)
                missing_cards.append(row)
                match_status_counts["missing"] += 1

        source_rows.append(
            {
                "source_file": path.name,
                "total_case_cards": len(cards),
                "dated_case_cards": len(dated_cards),
                "covered_dated_cards": len(source_covered),
                "missing_dated_cards": len(source_missing),
                "match_status_counts": dict(Counter(item["match_status"] for item in source_covered)),
                "missing_cases": source_missing,
            }
        )

    return {
        "summary": {
            "input_cases": len(inputs),
            "deep_extraction_sources": len(DEEP_EXTRACTION_PATHS),
            "dated_case_cards": len(covered_cards) + len(missing_cards),
            "covered_dated_cards": len(covered_cards),
            "missing_dated_cards": len(missing_cards),
            "match_status_counts": dict(match_status_counts),
            "coverage_rate": (
                round(len(covered_cards) / (len(covered_cards) + len(missing_cards)), 4)
                if covered_cards or missing_cards
                else 1.0
            ),
        },
        "sources": source_rows,
        "missing_cases": missing_cards,
        "covered_samples": covered_cards[:20],
    }


def write_markdown(report: dict) -> None:
    summary = report["summary"]
    lines = [
        "# 奇门案例覆盖率审计",
        "",
        f"- 输入案例数: {summary['input_cases']}",
        f"- Deep extraction 来源数: {summary['deep_extraction_sources']}",
        f"- 带日期 case cards 数: {summary['dated_case_cards']}",
        f"- 已覆盖带日期 case cards 数: {summary['covered_dated_cards']}",
        f"- 缺失带日期 case cards 数: {summary['missing_dated_cards']}",
        f"- 覆盖率: {summary['coverage_rate']:.2%}",
        f"- 覆盖方式: {json.dumps(summary['match_status_counts'], ensure_ascii=False)}",
        "",
        "## 分来源统计",
        "",
    ]

    for row in report["sources"]:
        lines.extend(
            [
                f"### {row['source_file']}",
                f"- total_case_cards: {row['total_case_cards']}",
                f"- dated_case_cards: {row['dated_case_cards']}",
                f"- covered_dated_cards: {row['covered_dated_cards']}",
                f"- missing_dated_cards: {row['missing_dated_cards']}",
                f"- match_status_counts: {json.dumps(row['match_status_counts'], ensure_ascii=False)}",
                "",
            ]
        )

    lines.extend(["## 缺失案例", ""])
    if report["missing_cases"]:
        for item in report["missing_cases"]:
            lines.append(
                f"- {item['date_token']} / {item['question_type']} / {item['source_section_title']} / {item['source_file']}"
            )
    else:
        lines.append("- 无")

    lines.extend(["", "## 已覆盖样本", ""])
    for item in report["covered_samples"]:
        lines.append(
            f"- {item['date_token']} / {item['source_section_title']} -> {item['matched_input_title']} ({item['matched_case_id']}, {item['match_status']})"
        )

    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    report = build_report()
    JSON_OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(report)
    print(f"wrote {JSON_OUT}")
    print(f"wrote {MD_OUT}")


if __name__ == "__main__":
    main()
