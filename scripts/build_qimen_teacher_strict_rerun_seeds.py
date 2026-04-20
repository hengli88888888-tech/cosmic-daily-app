from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path("/Users/liheng/Desktop/cosmic-daily-app")
INPUTS_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-case-replay-inputs.json"
OUT_JSON = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-strict-rerun-seeds.json"
OUT_MD = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-teacher-strict-rerun-seeds.md"

DEFAULT_TIMEZONE = "Asia/Shanghai"
DEFAULT_SYSTEM_PROFILE = "chai_bu"
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


def iso_local(date_token: str, time_token: str) -> str:
    year = date_token[:4]
    month = date_token[4:6]
    day = date_token[6:8]
    hour = "00"
    minute = "00"
    if "时" in time_token:
        hour = time_token.split("时", 1)[0].zfill(2)
        tail = time_token.split("时", 1)[1]
        minute_match = re.search(r"(\d{1,2})", tail)
        if minute_match:
            minute = minute_match.group(1).zfill(2)
    return f"{year}-{month}-{day}T{hour}:{minute}:00"


def main() -> int:
    rows = [
        row
        for row in load_json(INPUTS_JSON).get("inputs", [])
        if row.get("replay_grade") in {"strict_rerun_candidate", "strict_rerun_ready"}
    ]
    seeds = []
    for row in rows:
        date_token = str(row.get("date_token") or "")
        time_token = str(row.get("time_token") or "")
        if not date_token or not time_token:
            continue
        case_id = row.get("case_id")
        title = SOURCE_SECTION_TITLE_OVERRIDES.get(case_id, row.get("source_section_title"))
        seed = {
            "case_id": case_id,
            "source_section_title": title,
            "source_ref": row.get("source_ref"),
            "submitted_at": iso_local(date_token, time_token),
            "timezone": DEFAULT_TIMEZONE,
            "system_profile": DEFAULT_SYSTEM_PROFILE,
            "question_type": row.get("question_type"),
            "question_type_label": row.get("question_type_label"),
            "evaluation_track": row.get("evaluation_track") or "main",
            "normalized_question": NORMALIZED_QUESTION_OVERRIDES.get(title, row.get("normalized_question")),
            "expected_conclusion_family": row.get("expected_conclusion_family"),
            "expected_axes": row.get("expected_axes") or [],
            "plate_markers": row.get("plate_markers") or [],
            "wang_conclusion": row.get("wang_conclusion"),
            "wang_reasoning_steps": row.get("wang_reasoning_steps") or [],
            "fidelity_check_notes": row.get("fidelity_check_notes") or [],
            "target_teachers": row.get("target_teachers") or [],
            "teacher_prompts": {},
            "result_slots": {},
            "seed_status": "ready_for_strict_rerun",
        }
        seeds.append(seed)

    expected_ids = {row.get("case_id") for row in rows if row.get("case_id")}
    actual_ids = {seed.get("case_id") for seed in seeds if seed.get("case_id")}
    if actual_ids != expected_ids:
        missing = sorted(expected_ids - actual_ids)
        extra = sorted(actual_ids - expected_ids)
        raise RuntimeError(
            f"Strict rerun seeds count mismatch: expected {len(expected_ids)}, got {len(actual_ids)}; "
            f"missing={missing[:5]} extra={extra[:5]}"
        )

    seeds.sort(key=lambda item: (item.get("submitted_at") or "", item.get("source_section_title") or ""))

    payload = {"seeds": seeds}
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# QiMen Teacher Strict Rerun Seeds",
        "",
        "这份种子包把当前严格重跑案例收成统一输入，可直接喂给后续五老师逐案重跑流程。",
        f"- timezone: {DEFAULT_TIMEZONE}",
        f"- system_profile: {DEFAULT_SYSTEM_PROFILE}",
        f"- total_seeds: {len(seeds)}",
        "",
    ]

    for seed in seeds:
        lines.extend(
            [
                f"## {seed['source_section_title']} / {seed['question_type_label']}",
                f"- submitted_at: {seed['submitted_at']}",
                f"- timezone: {seed['timezone']}",
                f"- system_profile: {seed['system_profile']}",
                f"- normalized_question: {seed['normalized_question']}",
                f"- evaluation_track: {seed['evaluation_track']}",
                f"- expected_conclusion_family: {seed['expected_conclusion_family']}",
                f"- expected_axes: {'、'.join(seed['expected_axes']) if seed['expected_axes'] else '—'}",
                f"- plate_markers: {'、'.join(seed['plate_markers']) if seed['plate_markers'] else '—'}",
                f"- wang_conclusion: {seed['wang_conclusion']}",
                f"- fidelity_check_notes: {' / '.join(seed['fidelity_check_notes']) if seed['fidelity_check_notes'] else '—'}",
                "",
            ]
        )

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_MD}")
    print(f"Wrote {OUT_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
