from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
INPUTS_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-case-replay-inputs.json"
OUT_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-strict-rerun-worksheet.json"
OUT_MD = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-strict-rerun-worksheet.md"

TEACHERS = ["钟波", "文艺复兴", "王兴兵", "王永源", "苗道长"]
NORMALIZED_QUESTION_OVERRIDES = {
    "20180905-张女士戒指丢失": "问戒指到底是自己遗忘丢失还是被保姆拿走，还能不能找到，最可能在家里北方西北方、卫生间浴室水边什么位置，以及为什么一直难找。",
}
SOURCE_SECTION_TITLE_OVERRIDES = {
    "qimen-case-health_energy-20170518-gut": "20170518-上海张女士测肠胃病",
    "qimen-case-money_wealth-20181126-divorceproperty": "20181126-张女士测离婚财产纠纷",
    "qimen-case-money_wealth-20181227-debt": "20181227-赵女士测暂时还不了债",
    "qimen-case-career_work-20190106-qingdaojob": "20190106-江苏男士问去青岛求职",
    "qimen-case-career_work-20190313-layoff": "20190313-张女士测是否被裁员",
    "qimen-case-career_work-20160627-military-choice": "20160627-栗先生问去哪个军区发展好",
    "qimen-case-career_work-20190101-market": "20190101-美国卢先生咨询发展业务市场",
    "qimen-case-career_work-20190117-suspension": "20190117-王女士咨询同事被停职",
    "qimen-case-career_work-20190420-postgrad": "20190420-童女士咨询研究生复试",
    "qimen-case-health_energy-20190411-surgery": "20190411-北京李女士咨询疾病手术",
    "qimen-case-health_energy-20170517-wangdoctor": "20170517-王女士测小孩下巴拉伤",
    "qimen-case-health_energy-20170320-yin-environment": "20170320-上海张女士测健康",
    "qimen-case-money_wealth-20180428-lost-keys": "20180428-烟台王女士测钥匙丢失",
    "qimen-case-money_wealth-20190324-plustoken": "20190324-赵女士咨询这事该不该去做",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def build_teacher_prompt(case: dict, teacher: str) -> str:
    axes = "、".join(case.get("expected_axes") or [])
    markers = "、".join(case.get("plate_markers") or [])
    missing = "、".join(case.get("missing_fields") or []) or "无"
    return (
        f"请按{teacher}的断事逻辑复盘此案。"
        f"题型：{case['question_type_label']}。"
        f"标准问题：{case['normalized_question']}"
        f"重点结论轴：{axes}。"
        f"已知盘面线索：{markers or '无'}。"
        f"仍缺字段：{missing}。"
        "请给出：1. 主判断 2. 推理路径 3. 冲突取舍 4. 应期/风险线 5. 与王兴兵原结论是否同向。"
    )


def build_worksheet_item(row: dict) -> dict:
    case_id = row.get("case_id")
    title = SOURCE_SECTION_TITLE_OVERRIDES.get(case_id, row.get("source_section_title"))
    return {
        "case_id": case_id,
        "source_section_title": title,
        "source_ref": row.get("source_ref"),
        "question_type": row.get("question_type"),
        "question_type_label": row.get("question_type_label"),
        "evaluation_track": row.get("evaluation_track") or "main",
        "normalized_question": NORMALIZED_QUESTION_OVERRIDES.get(title, row.get("normalized_question")),
        "expected_conclusion_family": row.get("expected_conclusion_family"),
        "expected_axes": row.get("expected_axes") or [],
        "date_token": row.get("date_token"),
        "time_token": row.get("time_token"),
        "plate_markers": row.get("plate_markers") or [],
        "missing_fields": row.get("missing_fields") or [],
        "completion_priority": (
            "ready"
            if not row.get("missing_fields")
            else "high"
            if row.get("missing_fields") == ["time"]
            else "medium"
        ),
        "completion_note": (
            "已补齐关键时间字段，可直接进入五老师同盘重跑。"
            if not row.get("missing_fields")
            else "只缺时间，补齐后优先进入五老师同盘重跑。"
            if row.get("missing_fields") == ["time"]
            else "补齐缺失字段后可进入五老师同盘重跑。"
        ),
        "wang_conclusion": row.get("wang_conclusion"),
        "wang_reasoning_steps": row.get("wang_reasoning_steps") or [],
        "fidelity_check_notes": row.get("fidelity_check_notes") or [],
        "teacher_prompts": {teacher: build_teacher_prompt(row, teacher) for teacher in TEACHERS},
        "result_slots": {
            teacher: {
                "main_judgment": "",
                "reason_chain": [],
                "timing_line": "",
                "risk_line": "",
                "same_direction_as_wang": None,
            }
            for teacher in TEACHERS
        },
    }


def main() -> int:
    rows = load_json(INPUTS_JSON).get("inputs", [])
    strict_rows = [
        row for row in rows if row.get("replay_grade") in {"strict_rerun_candidate", "strict_rerun_ready"}
    ]

    worksheet_by_id = {}
    for row in strict_rows:
        case_id = row.get("case_id")
        if not case_id:
            continue
        worksheet_by_id[case_id] = build_worksheet_item(row)

    worksheet = list(worksheet_by_id.values())
    worksheet.sort(key=lambda item: (item.get("date_token") or "", item.get("source_section_title") or ""))

    if len(worksheet) != len({row.get("case_id") for row in strict_rows if row.get("case_id")}):
        raise RuntimeError(
            "Strict rerun worksheet count mismatch after dedupe: "
            f"expected {len({row.get('case_id') for row in strict_rows if row.get('case_id')})}, got {len(worksheet)}"
        )

    payload = {"strict_rerun_cases": worksheet}
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# QiMen Teacher Strict Rerun Worksheet",
        "",
        "这份工作单只保留当前最适合做五老师逐案重跑的案例。",
        "每个案例都给出标准问题、结论轴、缺失字段和五位老师的复盘提示语。",
        "",
        f"- total_cases: {len(worksheet)}",
        "",
    ]

    for item in worksheet:
        lines.extend(
            [
                f"## {item['source_section_title']} / {item['question_type_label']}",
                f"- normalized_question: {item['normalized_question']}",
                f"- evaluation_track: {item['evaluation_track']}",
                f"- expected_conclusion_family: {item['expected_conclusion_family']}",
                f"- expected_axes: {'、'.join(item['expected_axes']) if item['expected_axes'] else '—'}",
                f"- date_token: {item['date_token'] or '—'}",
                f"- time_token: {item['time_token'] or '—'}",
                f"- plate_markers: {'、'.join(item['plate_markers']) if item['plate_markers'] else '—'}",
                f"- missing_fields: {'、'.join(item['missing_fields']) if item['missing_fields'] else '无'}",
                f"- completion_priority: {item['completion_priority']}",
                f"- completion_note: {item['completion_note']}",
                f"- wang_conclusion: {item['wang_conclusion']}",
                f"- fidelity_check_notes: {' / '.join(item['fidelity_check_notes']) if item['fidelity_check_notes'] else '—'}",
                "",
                "### Teacher Prompts",
            ]
        )
        for teacher in TEACHERS:
            lines.append(f"- {teacher}: {item['teacher_prompts'][teacher]}")
        lines.append("")

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_MD}")
    print(f"Wrote {OUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
