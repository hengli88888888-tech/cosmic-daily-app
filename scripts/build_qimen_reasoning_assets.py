#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import html
import dataclasses
import os
import re
import shutil
import subprocess
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
QIMEN_DIR = ROOT / "specs" / "knowledge-base" / "qimen"
TRANSCRIPTS_DIR = ROOT / "data" / "raw-transcripts" / "qimen"
SEGMENTS_DIR = ROOT / "data" / "reviewed-rules" / "qimen-ingestion-drafts"
DOC_SOURCES_PATH = QIMEN_DIR / "qimen-document-sources.json"
RAW_DOCS_DIR = ROOT / "data" / "raw-documents" / "qimen"
GENERATED_TS_PATH = ROOT / "backend" / "supabase" / "functions" / "_shared" / "generated-qimen-knowledge.ts"

RULE_CARDS_PATH = QIMEN_DIR / "qimen-rule-cards.json"
CASE_CARDS_PATH = QIMEN_DIR / "qimen-case-cards.json"
PATTERN_CARDS_PATH = QIMEN_DIR / "qimen-reasoning-patterns.json"
TERM_NOTES_PATH = QIMEN_DIR / "qimen-term-notes.json"
CONFLICT_CARDS_PATH = QIMEN_DIR / "qimen-conflict-resolution-cards.json"
LESSON_INDEX_PATH = QIMEN_DIR / "qimen-lesson-index.json"
TIER_OVERRIDES_PATH = QIMEN_DIR / "qimen-tier-overrides.json"
DOC_EXTRACTION_REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-document-extraction-report.md"
DOC_COVERAGE_REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-document-coverage-report.md"
VIDEO_COVERAGE_REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-video-coverage-report.md"
DOC_TEXT_CACHE_DIR = ROOT / "data" / "import-runs" / "qimen-yangpan" / "document-text-cache"
DEEP_EXTRACTION_DIR = ROOT / "data" / "import-runs" / "qimen-yangpan"

PRIMARY_TEACHER = "钟波"
MAX_VIDEO_CORE_RULES_PER_QTYPE = 18
MAX_VIDEO_SUPPORT_RULES_PER_QTYPE = 32
MAX_VIDEO_SUPPORT_CASES_PER_QTYPE = 14
MAX_VIDEO_REFERENCE_CASES_PER_QTYPE = 18
MAX_VIDEO_CORE_CONFLICTS_PER_QTYPE = 12
MAX_VIDEO_SUPPORT_CONFLICTS_PER_QTYPE = 40
MAX_VIDEO_RULES_PER_LESSON = 1
MAX_VIDEO_CONFLICTS_PER_LESSON = 1
MAX_DOCUMENT_CASES_PER_QTYPE = 16
MAX_DOCUMENT_CONFLICTS_PER_QTYPE = 16
MAX_DOCUMENT_CASES_PER_SOURCE = 3
MAX_DOCUMENT_CONFLICTS_PER_SOURCE = 3
MAX_DEEP_DOC_RULES_PER_SOURCE = 24
MAX_DEEP_DOC_RULES_PER_QTYPE = 6
MAX_DEEP_DOC_PATTERNS_PER_SOURCE = 16
MAX_DEEP_DOC_NOTES_PER_SOURCE = 24
MAX_DEEP_DOC_CONFLICTS_PER_SOURCE = 8
MAX_TERM_NOTES = 96
MAX_VIDEO_CORE_PATTERNS_PER_QTYPE = 8
MAX_VIDEO_SUPPORT_PATTERNS_PER_QTYPE = 40
REPORT_PATH = ROOT / "data" / "import-runs" / "qimen-yangpan" / "qimen-reasoning-build-report.md"
PRIMARY_CHAIN_LAYERS = ("rules", "cases", "patterns", "conflicts")


QUESTION_TYPES = {
    "career_work": {
        "label": "事业工作",
        "keywords": ["工作", "事业", "上班", "职业", "岗位", "升职", "面试", "老板", "单位", "项目", "离职", "跳槽"],
        "yongshen_focus": "事业、岗位、上级、职位结构",
    },
    "love_relationship": {
        "label": "感情婚姻",
        "keywords": ["感情", "婚姻", "对象", "恋爱", "复合", "离婚", "结婚", "伴侣", "男朋友", "女朋友", "桃花"],
        "yongshen_focus": "关系双方、情感推进、婚恋结构",
    },
    "money_wealth": {
        "label": "财运合作",
        "keywords": ["财运", "生意", "合作", "赚钱", "投资", "客户", "订单", "回款", "欠款", "借钱", "收益", "财"],
        "yongshen_focus": "财路、合作对象、资源占有、回款兑现",
    },
    "health_energy": {
        "label": "健康身体",
        "keywords": ["身体", "健康", "生病", "医院", "手术", "恢复", "失眠", "情绪", "焦虑", "体检", "疼", "病"],
        "yongshen_focus": "身体承载、病位、恢复节奏、耗损来源",
    },
}

QUESTION_TYPE_ORDER = list(QUESTION_TYPES.keys())

TERM_KEYWORDS = [
    "值符", "值使", "用神", "落宫", "门", "星", "神", "空亡", "马星", "伏吟", "反吟",
    "九宫", "天盘", "地盘", "人盘", "年命", "日干", "时干", "旬首", "翻宫", "转宫",
    "拆补", "置闰", "超接", "击刑", "生门", "开门", "休门", "伤门", "杜门", "景门", "死门", "惊门",
]

SUPPORT_TAG_KEYWORDS = {
    "year_ming_anchor": ["年命", "出生年", "年柱", "属相"],
    "relationship_year_ming": ["双方年命", "对象", "配偶", "婚姻", "关系", "六合", "复合", "结婚"],
    "long_cycle_trend": ["流年", "大运", "终身", "长期", "趋势", "十年"],
    "timing_overlay": ["应期", "时间窗口", "节气", "短期触发", "何时", "什么时候", "何时应"],
}

RELATIONSHIP_CONTEXT_TERMS = ["感情", "婚姻", "对象", "配偶", "伴侣", "复合", "结婚", "离婚", "恋爱", "双方"]
RELATIONSHIP_SUPPORT_TERMS = ["六合", "合婚", "结婚证", "相亲", "婚恋", "桃花"]
LONG_CYCLE_CONTEXT_TERMS = ["流年", "大运", "终身", "长期", "趋势", "十年", "几年", "未来", "后面几年"]
TIMING_STRONG_CONTEXT_TERMS = ["应期", "时间窗口", "什么时候", "何时", "哪天", "哪月", "何时应", "何时动", "时间节点", "何时成", "何时能"]
TIMING_ACTION_TERMS = ["应", "动", "成", "落实", "兑现", "回款", "发生", "推进", "见面", "复合", "入职", "中标"]

RULE_MARKERS = ["代表", "说明", "意味着", "就是", "取用神", "用神", "落宫", "值符", "值使", "看", "应期"]
CASE_MARKERS = ["案例", "这一卦", "这个卦", "这个局", "求测", "来问", "反馈", "应验", "结果"]
CONFLICT_MARKERS = ["但是", "不过", "不能", "未必", "反过来", "如果", "除非", "不是", "先不要"]
PATTERN_MARKERS = ["先看", "再看", "第一步", "第二步", "第三步", "最后看", "先定", "然后", "接着看"]
META_EXCLUDE_HINTS = ["开营", "开营典礼", "学习指南", "操作方法", "课程表", "圈子", "报名", "通知", "发动态"]
STRONG_REASONING_TERMS = [
    "用神", "落宫", "值符", "值使", "门", "星", "神", "空亡", "马星", "伏吟", "反吟",
    "离宫", "坎宫", "坤宫", "乾宫", "兑宫", "震宫", "巽宫", "艮宫", "中宫", "落在", "转宫", "翻宫",
    "象意", "格局", "应期", "旺", "衰", "生", "克", "合", "冲", "病地", "绝地", "长生", "临官",
]
QUESTION_CONTEXT_MARKERS = ["测", "求测", "求财", "事业", "感情", "婚姻", "健康", "合作", "投资", "应验", "反馈"]
LESSON_INCLUDE_HINTS = ["格局", "案例", "直播", "实战", "带学", "断局", "用神", "定应期", "婚姻", "事业", "财运", "健康"]
GENERIC_THEORY_HINTS = ["十天干", "五行八卦", "奇门深入认识", "九星", "八神", "八卦", "理论", "基础", "符号", "分类对应", "空亡和马星", "读象技巧"]
SECONDARY_TEACHER_HINTS = ["案例", "直播", "实战", "答疑", "判断", "判断逻辑", "时空布局", "起源", "五行", "天干", "九星", "八神", "八卦", "格局", "预测", "应用"]
SECONDARY_TEACHER_COURSE_HINTS = ["初级课程", "初级班", "中级班", "高级班", "高阶课", "阳盘奇门", "风后奇门", "分类预测"]
DEEP_PDF_OCR_HINTS = ["案例解析", "预测案例", "预测应用", "运筹策划"]


@dataclass
class SegmentEvidence:
    clip_id: str
    teacher: str
    course: str
    lesson: str
    draft_path: str
    transcript_excerpt: str
    keyframes: list[str]


@dataclass
class SourceDocument:
    source_type: str
    teacher: str
    course_or_book: str
    path: Path
    source_ref: str
    lesson_or_title: str
    text: str
    document_format: str = "unknown"
    extraction_method: str = "none"
    extraction_ok: bool = False
    backlog_missing_layers: tuple[str, ...] = ()
    backlog_priority: int = 0
    primary_question_type: str = "general"


@dataclass
class DocumentSection:
    title: str
    anchor: str
    text: str
    question_types: tuple[str, ...]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_tier_overrides() -> dict[str, dict]:
    if not TIER_OVERRIDES_PATH.exists():
        return {}
    payload = load_json(TIER_OVERRIDES_PATH)
    overrides: dict[str, dict] = {}
    for item in payload.get("overrides", []):
        card_id = str(item.get("id") or "").strip()
        tier = str(item.get("knowledge_tier") or "").strip()
        if card_id and tier in {"core", "support", "reference"}:
            overrides[card_id] = {
                "knowledge_tier": tier,
                "source": str(item.get("source") or "").strip(),
                "reason": str(item.get("reason") or "").strip(),
                "updated_at": str(payload.get("updated_at") or "").strip(),
            }
    return overrides


def apply_tier_overrides(items: list[dict], overrides: dict[str, dict]) -> list[dict]:
    if not overrides:
        return items
    for item in items:
        override = overrides.get(str(item.get("id") or ""))
        if not override:
            continue
        original_tier = str(item.get("knowledge_tier") or "").strip() or "reference"
        item["original_knowledge_tier"] = original_tier
        item["knowledge_tier"] = str(override.get("knowledge_tier") or original_tier)
        item["tier_override"] = {
            "applied": True,
            "source": str(override.get("source") or ""),
            "reason": str(override.get("reason") or ""),
            "updated_at": str(override.get("updated_at") or ""),
        }
    return items


def count_tiers(items: list[dict]) -> dict[str, int]:
    counts = {"core": 0, "support": 0, "reference": 0}
    for item in items:
        tier = str(item.get("knowledge_tier") or "reference")
        if tier in counts:
            counts[tier] += 1
    return counts


def count_overrides(items: list[dict]) -> int:
    return sum(1 for item in items if isinstance(item.get("tier_override"), dict) and item["tier_override"].get("applied"))


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def chain_layer_label(key: str) -> str:
    return (
        "规则" if key == "rules" else
        "案例" if key == "cases" else
        "路径" if key == "patterns" else
        "术语" if key == "notes" else
        "冲突" if key == "conflicts" else key
    )


def lesson_status_label(status: str) -> str:
    return {
        "full_chain": "已形成完整推理链",
        "strong_chain": "已形成较强推理链",
        "partial_chain": "已部分进入知识卡",
        "reference_only": "仅背景/术语参考",
        "non_target": "非入卡目标",
    }.get(status, status)


def split_sentences(text: str) -> list[str]:
    cleaned = normalize_text(text.replace("\r", "\n"))
    raw_parts = re.split(r"(?<=[。！？!?；;])|(?:\n{2,})", cleaned)
    sentences: list[str] = []
    for part in raw_parts:
        piece = normalize_text(part)
        if len(piece) >= 10:
            sentences.append(piece)
    return sentences


def split_document_case_blocks(text: str) -> list[str]:
    normalized = normalize_text(text)
    if not normalized:
        return []
    if "目录" in normalized:
        normalized = re.sub(r"^.*?目录", "目录", normalized, count=1)
    labeled_parts = re.split(
        r"(?=(?:案例[一二三四五六七八九十0-9]+|例[一二三四五六七八九十0-9]+|占例[一二三四五六七八九十0-9]*|"
        r"\【问\】|求测[:：]|问事[:：]|占测[:：]|Q\d+\s*:|第[一二三四五六七八九十0-9]+例|20\d{6}))",
        normalized,
    )
    labeled_blocks = [
        normalize_text(part)
        for part in labeled_parts
        if normalize_text(part) and not normalize_text(part).startswith("目录")
    ]
    if len(labeled_blocks) > 1:
        return [block for block in labeled_blocks if len(block) >= 12]
    parts = re.split(r"(?=(?:^|\s)(?:\d+[，,、\.．]|[一二三四五六七八九十]+[、\.．]))", normalized)
    blocks = [normalize_text(part) for part in parts if normalize_text(part)]
    return [
        block
        for block in blocks
        if len(block) >= 12 or any(marker in block for marker in ["为什么", "能不能", "是否", "会不会", "结果", "反馈"])
    ]


def extract_document_block_anchor(block: str) -> tuple[str, str]:
    normalized = normalize_text(block)
    if not normalized:
        return ("全文", "full-document")
    sanitized = normalize_text(
        re.sub(
            r"(?:https?[:/\\.]+|qq\\.com|zyqmdj|zyamdj|20472836|//w\\.|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+|[A-Za-z0-9._-]*\\s*\\.\\s*[A-Za-z0-9._-]*\\s*\\.\\s*com)",
            " ",
            normalized,
            flags=re.IGNORECASE,
        )
    )
    sanitized = normalize_text(
        re.sub(
            r"(?:奇门通甲教程|王兴兵|易宇山人|教程|com\b|qq\b|http\b)",
            " ",
            sanitized,
            flags=re.IGNORECASE,
        )
    )
    for pattern in [
        r"^(案例[一二三四五六七八九十0-9]+)",
        r"^(例[一二三四五六七八九十0-9]+)",
        r"^(占例[一二三四五六七八九十0-9]*)",
        r"^(第[一二三四五六七八九十0-9]+例)",
        r"^(20\d{6})",
        r"^(\【问\】)",
        r"^(求测[:：][^，。；;\n]{0,24})",
        r"^(问事[:：][^，。；;\n]{0,24})",
        r"^(占测[:：][^，。；;\n]{0,24})",
    ]:
        matched = re.match(pattern, sanitized)
        if matched:
            title = normalize_text(matched.group(1))
            if re.fullmatch(r"20\d{6}", title) and not is_plausible_case_date(title):
                continue
            return (title, normalize_section_anchor(title))
    dated = re.search(r"(20\d{6})", sanitized)
    if dated and is_plausible_case_date(dated.group(1)):
        return (dated.group(1), normalize_section_anchor(dated.group(1)))
    chinese_heavy = normalize_text(re.sub(r"[A-Za-z]+", " ", sanitized))
    candidate_clauses = [
        clause
        for clause in re.split(r"[，,。；;：:\n]", chinese_heavy)
        if normalize_text(clause)
    ]
    prioritized = [
        clause
        for clause in candidate_clauses
        if any(
            marker in clause
            for marker in [
                "事业",
                "工作",
                "感情",
                "婚姻",
                "财运",
                "合作",
                "投资",
                "客户",
                "健康",
                "病",
                "恢复",
                "中标",
                "总统",
                "大选",
                "反馈",
                "应验",
                "结果",
                "努力",
            ]
        )
    ]
    sample = compress_reasoning_text("；".join(prioritized or candidate_clauses or [chinese_heavy]))[:24] or "单案"
    sample = normalize_case_anchor_title(sample)
    return (sample, normalize_section_anchor(sample))


def normalize_case_anchor_title(title: str) -> str:
    normalized = normalize_text(title).strip("“”\"'[]()（）")
    normalized = re.sub(r"^(?:反馈|应验|结果)[:：]?", "", normalized)
    normalized = re.sub(r"^(?:这件事是关于|就是关于)", "", normalized)
    normalized = re.sub(r"(?:；|。|，).*$", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip("“”\"'[]()（） ，。；;：:")
    if not normalized:
        return "单案"
    overrides = [
        (["总统", "大选"], "法国总统大选"),
        (["应聘", "工作"], "应聘工作"),
        (["努力", "事业"], "事业能否稳定"),
        (["在乎", "感情"], "感情反馈"),
        (["第三者", "矛盾"], "第三者矛盾反馈"),
        (["房子", "儿子"], "房子克儿子"),
        (["克你"], "财运受克"),
        (["主客动静"], "主客动静"),
    ]
    for needles, replacement in overrides:
        if all(needle in normalized for needle in needles):
            return replacement
    if len(normalized) > 18:
        for marker in [
            "为什么",
            "能不能",
            "是否",
            "会不会",
            "反馈",
            "应验",
            "结果",
            "中标",
            "大选",
            "工作",
            "感情",
            "婚姻",
            "财运",
            "病",
            "恢复",
        ]:
            idx = normalized.find(marker)
            if idx >= 0:
                start = max(0, idx - 6)
                normalized = normalized[start : start + 18]
                break
    return normalized[:18].strip("“”\"'[]()（） ，。；;：:") or "单案"


def cjk_ratio(text: str) -> float:
    if not text:
        return 0.0
    cjk = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
    return cjk / max(1, len(text))


def sentence_quality_ok(text: str) -> bool:
    normalized = normalize_text(text)
    if len(normalized) < 12:
        return False
    if cjk_ratio(normalized) < 0.35:
        return False
    if re.search(r"[@#$%^&*_=\[\]<>|]{2,}", normalized):
        return False
    if re.search(r"(?:[A-Za-z0-9][ ,./\\-]?){18,}", normalized):
        return False
    return True


def short_hash(*parts: str) -> str:
    return hashlib.sha1("||".join(parts).encode("utf-8")).hexdigest()[:10]


def is_plausible_case_date(token: str) -> bool:
    if not re.fullmatch(r"20\d{6}", token):
        return False
    year = int(token[:4])
    month = int(token[4:6])
    day = int(token[6:8])
    return 2000 <= year <= 2035 and 1 <= month <= 12 and 1 <= day <= 31


def document_priority(source: SourceDocument) -> tuple[int, int, int, str]:
    title = source.lesson_or_title
    fmt = source.document_format
    if "三连问" in title:
        bucket = 0
    elif "实战案例" in title:
        bucket = 1
    elif fmt == "html":
        bucket = 2
    elif fmt == "pdf":
        bucket = 3
    else:
        bucket = 4
    return (bucket, -len(normalize_text(source.text)), 0 if source.extraction_ok else 1, title)


def detect_question_type(text: str, source_hint: str = "") -> str:
    sample = normalize_text(text)
    hint = normalize_text(source_hint)
    signature_terms = {
        "career_work": ["事业", "工作", "岗位", "投标", "项目", "考学"],
        "love_relationship": ["感情", "婚", "恋", "对象", "桃花", "复合"],
        "money_wealth": ["财", "合作", "投资", "回款", "客户", "收益"],
        "health_energy": ["病", "健康", "身体", "手术", "恢复", "医院"],
    }
    signature_hits = {
        qtype: sum(1 for token in terms if token in hint)
        for qtype, terms in signature_terms.items()
    }
    ranked_signature = sorted(signature_hits.items(), key=lambda item: item[1], reverse=True)
    if ranked_signature and ranked_signature[0][1] > 0:
        top_type, top_score = ranked_signature[0]
        runner_up = ranked_signature[1][1] if len(ranked_signature) > 1 else 0
        if top_score > runner_up:
            return top_type
    hint_scores = {
        question_type: sum(hint.count(keyword) for keyword in config["keywords"])
        for question_type, config in QUESTION_TYPES.items()
    }
    ranked_hint = sorted(hint_scores.items(), key=lambda item: item[1], reverse=True)
    if ranked_hint and ranked_hint[0][1] > 0:
        top_type, top_score = ranked_hint[0]
        runner_up = ranked_hint[1][1] if len(ranked_hint) > 1 else 0
        if top_score >= max(2, runner_up + 1):
            return top_type
    scores = {
        question_type: (
            sum(sample.count(keyword) for keyword in config["keywords"]) +
            hint_scores[question_type] * 4
        )
        for question_type, config in QUESTION_TYPES.items()
    }
    if any(token in hint for token in ["案例判断逻辑", "判断逻辑", "案例", "问病", "问感情", "问财", "投标"]):
        if any(token in hint for token in ["事业", "工作", "投标", "岗位", "项目"]):
            scores["career_work"] += 12
        if any(token in hint for token in ["感情", "婚", "恋", "对象", "桃花"]):
            scores["love_relationship"] += 12
        if any(token in hint for token in ["财", "合作", "回款", "投资", "客户"]):
            scores["money_wealth"] += 12
        if any(token in hint for token in ["病", "健康", "身体", "手术", "恢复"]):
            scores["health_energy"] += 12
    best = max(scores.items(), key=lambda item: item[1])
    return best[0] if best[1] > 0 else "general"


def detect_document_question_type(source: SourceDocument, sentences: list[str]) -> str:
    hint = f"{source.course_or_book} {source.lesson_or_title}"
    sample = " ".join(sentences[:12]) if sentences else source.text
    if document_is_casebook(source) and re.search(r"20\d{6}", sample):
        keyword_scores = {
            qtype: sum(sample.count(keyword) for keyword in config["keywords"])
            for qtype, config in QUESTION_TYPES.items()
        }
        keyword_scores["money_wealth"] += sum(sample.count(token) for token in ["店铺", "生意", "开店", "客户", "回款", "求财", "财运"])
        keyword_scores["love_relationship"] += sum(sample.count(token) for token in ["感情", "婚", "对象", "复合", "离婚", "关系"])
        keyword_scores["health_energy"] += sum(sample.count(token) for token in ["病", "医院", "手术", "恢复", "身体", "症状"])
        keyword_scores["career_work"] += sum(sample.count(token) for token in ["工作", "事业", "投标", "项目", "岗位", "公司", "考学"])
        best = max(keyword_scores.items(), key=lambda item: item[1])
        if best[1] > 0:
            return best[0]
    if any(token in sample for token in ["下一任", "结婚", "复合", "婚姻", "对象", "感情", "桃花", "老公", "老婆"]):
        return "love_relationship"
    if any(token in sample for token in ["父母", "亲戚", "儿子", "女儿", "孩子", "家庭"]):
        return "love_relationship"
    if any(token in sample for token in ["怀孕", "怀上", "宝宝", "孕", "病", "手术", "恢复", "身体"]):
        return "health_energy"
    if any(token in sample for token in ["住院", "呼吸", "肺", "制氧机", "利尿"]):
        return "health_energy"
    if any(token in sample for token in ["欠款", "回款", "投资款", "合作", "收益", "客户", "财"]):
        return "money_wealth"
    if any(token in sample for token in ["卖房", "学区房", "成交", "出价", "市场回暖", "价格", "推广"]):
        return "career_work"
    if any(token in sample for token in ["工作", "事业", "岗位", "领导", "投标", "公司", "项目", "合伙人"]):
        return "career_work"
    if any(token in sample for token in ["进一步的发展", "朋友关系", "蓝颜知己", "离异", "单身", "感情纠葛"]):
        return "love_relationship"
    detected = detect_question_type(sample, hint)
    if detected != "general":
        return detected
    lowered_hint = hint.lower()
    if any(token in lowered_hint for token in ["婚", "恋", "感情", "桃花", "对象", "复合"]):
        return "love_relationship"
    if any(token in lowered_hint for token in ["病", "医", "健康", "手术", "恢复", "身体"]):
        return "health_energy"
    if any(token in lowered_hint for token in ["财", "合作", "投资", "回款", "客户", "收益"]):
        return "money_wealth"
    if "实战案例" in hint or "三连问" in hint:
        sentence_scores = {
            qtype: sum(
                sentence.count(keyword)
                for sentence in sentences[:16]
                for keyword in config["keywords"]
            )
            for qtype, config in QUESTION_TYPES.items()
        }
        best = max(sentence_scores.items(), key=lambda item: item[1])
        if best[1] > 0:
            return best[0]
    return "general"


def is_reasoning_candidate(source: SourceDocument) -> bool:
    hint = f"{source.course_or_book} {source.lesson_or_title} {source.source_ref}"
    if any(token in hint for token in META_EXCLUDE_HINTS):
        return False
    lesson_has_signal = any(token in hint for token in LESSON_INCLUDE_HINTS)
    title_question_signal = any(
        token in hint
        for token in [
            "问",
            "能不能",
            "会不会",
            "是否",
            "怎么办",
            "判断",
            "判断逻辑",
            "投标",
            "离婚",
            "投资",
            "客户",
            "涨薪",
            "问病",
            "感情",
            "婚恋",
            "事业",
            "财运",
            "健康",
        ]
    )
    document_case_signal = any(token in hint for token in ["三连问", "实战案例", "案例", "问答"])
    secondary_lesson_signal = any(token in hint for token in SECONDARY_TEACHER_HINTS)
    term_count = sum(1 for term in TERM_KEYWORDS if term in source.text)
    strong_count = sum(1 for term in STRONG_REASONING_TERMS if term in source.text)
    reasoning_count = sum(source.text.count(marker) for marker in RULE_MARKERS + PATTERN_MARKERS)
    question_count = sum(source.text.count(marker) for marker in QUESTION_CONTEXT_MARKERS)
    if source.source_type == "document":
        return bool(source.text) and (
            ((term_count >= 2 and reasoning_count >= 1) or strong_count >= 2)
            or (
                document_case_signal
                and (
                    question_count >= 2
                    or source.text.count("为什么") >= 2
                    or source.text.count("能不能") >= 1
                    or source.text.count("是否") >= 1
                    or source.text.count("会不会") >= 1
                )
            )
        )
    if source.teacher != PRIMARY_TEACHER:
        if is_secondary_teacher_support_lesson(source.lesson_or_title, source.course_or_book) and source.primary_question_type != "general":
            return True
        return (lesson_has_signal or title_question_signal or document_case_signal or secondary_lesson_signal) and (
            strong_count >= 1
            or term_count >= 2
            or reasoning_count >= 1
            or question_count >= 1
            or any(token in hint for token in GENERIC_THEORY_HINTS)
        )
    return (lesson_has_signal or title_question_signal) and (
        (strong_count >= 2 and reasoning_count >= 1)
        or (term_count >= 3 and question_count >= 1)
        or (title_question_signal and question_count >= 1)
    )


def sentence_is_reasoning(sentence: str) -> bool:
    if any(token in sentence for token in META_EXCLUDE_HINTS):
        return False
    strong_count = sum(1 for term in STRONG_REASONING_TERMS if term in sentence)
    question_count = sum(1 for marker in QUESTION_CONTEXT_MARKERS if marker in sentence)
    rule_count = sum(1 for marker in RULE_MARKERS + PATTERN_MARKERS if marker in sentence)
    return (strong_count >= 1 and rule_count >= 1) or (strong_count >= 2) or (question_count >= 1 and strong_count >= 1)


def extract_terms(text: str) -> list[str]:
    return [term for term in TERM_KEYWORDS if term in text]


def infer_support_tags(question_type: str, *texts: str) -> list[str]:
    sample = " ".join(normalize_text(text) for text in texts if text)
    tags: list[str] = []
    has_year_ming = any(keyword in sample for keyword in SUPPORT_TAG_KEYWORDS["year_ming_anchor"])
    has_relationship = any(keyword in sample for keyword in RELATIONSHIP_CONTEXT_TERMS)
    has_relationship_support = any(keyword in sample for keyword in RELATIONSHIP_SUPPORT_TERMS)
    has_long_cycle = any(keyword in sample for keyword in LONG_CYCLE_CONTEXT_TERMS)
    has_timing_strong = any(keyword in sample for keyword in TIMING_STRONG_CONTEXT_TERMS)
    has_timing_action = any(keyword in sample for keyword in TIMING_ACTION_TERMS)

    if has_year_ming:
        tags.append("year_ming_anchor")

    if question_type == "love_relationship" and (has_year_ming or has_relationship_support) and has_relationship:
        tags.append("relationship_year_ming")

    if question_type in {"career_work", "money_wealth"} and has_long_cycle:
        tags.append("long_cycle_trend")

    if has_timing_strong and has_timing_action:
        tags.append("timing_overlay")

    return tags


def infer_confidence(text: str, source_type: str, teacher: str) -> float:
    base = 0.66 if source_type == "video_segment" else 0.72
    if teacher == PRIMARY_TEACHER:
        base += 0.14
    if "如果" in text or "先看" in text or "取用神" in text:
        base += 0.06
    return min(0.96, round(base, 2))


def teacher_priority(teacher: str) -> float:
    if not teacher:
        return 0.5
    return 1.0 if teacher == PRIMARY_TEACHER else 0.62


def infer_knowledge_tier(
    card_kind: str,
    question_type: str,
    source_type: str,
    teacher: str,
    confidence: float,
    text: str,
) -> str:
    sample = normalize_text(text)
    primary = teacher == PRIMARY_TEACHER
    has_feedback = any(marker in sample for marker in ["反馈", "应验", "结果"])
    has_route = any(marker in sample for marker in ["先看", "再看", "取用神", "落宫", "主线"])

    if source_type == "document":
        if card_kind == "rule":
            return "support"
        if card_kind == "case":
            return "reference"
        if card_kind == "pattern":
            return "support"
        if card_kind == "conflict":
            return "support"
        if card_kind == "term":
            return "support"
        return "reference"

    if card_kind == "rule":
        if primary and question_type != "general" and confidence >= 0.82:
            return "core"
        if primary or source_type in {"document", "video_segment"}:
            return "support"
        return "reference"

    if card_kind == "case":
        if primary and (has_feedback or confidence >= 0.84):
            return "support"
        return "reference"

    if card_kind == "pattern":
        return "core" if primary and has_route else "support"

    if card_kind == "conflict":
        return "core" if primary else "support"

    if card_kind == "term":
        return "support" if source_type == "document" else "reference"

    return "reference"


def apply_video_tier_caps(
    card_kind: str,
    question_type: str,
    knowledge_tier: str,
    counters: dict[str, Counter],
) -> str | None:
    if knowledge_tier == "core":
        core_limits = {
            "rule": MAX_VIDEO_CORE_RULES_PER_QTYPE,
            "pattern": MAX_VIDEO_CORE_PATTERNS_PER_QTYPE,
            "conflict": MAX_VIDEO_CORE_CONFLICTS_PER_QTYPE,
        }
        support_limits = {
            "rule": MAX_VIDEO_SUPPORT_RULES_PER_QTYPE,
            "pattern": MAX_VIDEO_SUPPORT_PATTERNS_PER_QTYPE,
            "conflict": MAX_VIDEO_SUPPORT_CONFLICTS_PER_QTYPE,
        }
        if counters["core"][question_type] < core_limits.get(card_kind, 0):
            return "core"
        if card_kind in support_limits and counters["support"][question_type] < support_limits[card_kind]:
            return "support"
        return None

    if knowledge_tier == "support":
        support_limits = {
            "rule": MAX_VIDEO_SUPPORT_RULES_PER_QTYPE,
            "case": MAX_VIDEO_SUPPORT_CASES_PER_QTYPE,
            "pattern": MAX_VIDEO_SUPPORT_PATTERNS_PER_QTYPE,
            "conflict": MAX_VIDEO_SUPPORT_CONFLICTS_PER_QTYPE,
        }
        if counters["support"][question_type] < support_limits.get(card_kind, 0):
            return "support"
        if card_kind == "case" and counters["reference"][question_type] < MAX_VIDEO_REFERENCE_CASES_PER_QTYPE:
            return "reference"
        return None

    if knowledge_tier == "reference":
        if card_kind == "case" and counters["reference"][question_type] < MAX_VIDEO_REFERENCE_CASES_PER_QTYPE:
            return "reference"
        return None

    return knowledge_tier


def markdown_rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def strip_html(text: str) -> str:
    without_scripts = re.sub(r"<(script|style).*?>.*?</\\1>", " ", text, flags=re.I | re.S)
    no_tags = re.sub(r"<[^>]+>", " ", without_scripts)
    return normalize_text(html.unescape(no_tags.replace("&nbsp;", " ").replace("&amp;", "&")))


def read_text_with_fallbacks(path: Path) -> str:
    raw = path.read_bytes()
    for encoding in ("utf-8", "gb18030", "gbk", "utf-16"):
        try:
            return raw.decode(encoding)
        except Exception:
            continue
    return raw.decode("utf-8", errors="ignore")


def run_command(command: list[str]) -> str:
    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except Exception:
        return ""
    if result.returncode != 0:
        return ""
    return normalize_text(result.stdout)


def ocr_image(image_path: Path) -> tuple[str, str]:
    if shutil.which("tesseract") is None:
        return "", "none"
    text = run_command(["tesseract", str(image_path), "stdout", "-l", "chi_sim+eng"])
    if not text:
        text = run_command(["tesseract", str(image_path), "stdout", "-l", "chi_sim"])
    if not text:
        text = run_command(["tesseract", str(image_path), "stdout", "-l", "eng"])
    return normalize_text(text), "tesseract"


def should_try_deep_pdf_ocr(path: Path, sampled_text: str) -> bool:
    if normalize_text(os.environ.get("QIMEN_FORCE_DEEP_OCR", "")) not in {"1", "true", "yes"}:
        return False
    title = path.name
    if not any(token in title for token in DEEP_PDF_OCR_HINTS):
        return False
    if len(normalize_text(sampled_text)) >= 800 and cjk_ratio(sampled_text) >= 0.4:
        return False
    return True


def deep_pdf_sidecar_path(path: Path) -> Path:
    DOC_TEXT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return DOC_TEXT_CACHE_DIR / f"{short_hash(str(path), str(path.stat().st_size))}.txt"


def deep_pdf_cache_is_usable(text: str) -> bool:
    normalized = normalize_text(text)
    if len(normalized) < 800:
        return False
    return cjk_ratio(normalized) >= 0.12


def extract_pdf_text_with_page_ocr(path: Path) -> tuple[str, str]:
    if shutil.which("gs") is None or shutil.which("tesseract") is None:
        return "", "none"
    sidecar_path = deep_pdf_sidecar_path(path)
    if sidecar_path.exists():
        cached = sidecar_path.read_text(encoding="utf-8", errors="ignore")
        if deep_pdf_cache_is_usable(cached):
            return normalize_text(cached), "page_ocr_cache"
    with tempfile.TemporaryDirectory(prefix="qimen-doc-ocrpdf-") as tmp_dir:
        tmp_path = Path(tmp_dir)
        output_pattern = tmp_path / "page-%04d.png"
        render = subprocess.run(
            [
                "gs",
                "-dSAFER",
                "-dBATCH",
                "-dNOPAUSE",
                "-sDEVICE=pnggray",
                "-r220",
                f"-sOutputFile={output_pattern}",
                str(path),
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=1800,
        )
        if render.returncode != 0:
            return "", "page_ocr"
        pages = sorted(tmp_path.glob("page-*.png"))
        if not pages:
            return "", "page_ocr"
        page_texts: list[str] = []
        for page in pages:
            ocr = subprocess.run(
                ["tesseract", str(page), "stdout", "-l", "chi_sim+eng", "--psm", "6"],
                check=False,
                capture_output=True,
                text=True,
                timeout=120,
            )
            normalized = normalize_text(ocr.stdout)
            if normalized:
                page_texts.append(normalized)
        if not page_texts:
            return "", "page_ocr"
        merged = "\n".join(page_texts)
        sidecar_path.write_text(merged, encoding="utf-8")
    cached = sidecar_path.read_text(encoding="utf-8", errors="ignore")
    return normalize_text(cached), "page_ocr" if deep_pdf_cache_is_usable(cached) else "page_ocr"


def extract_pdf_text(path: Path) -> tuple[str, str]:
    mdls_text = run_command(["mdls", "-raw", "-name", "kMDItemTextContent", str(path)])
    if mdls_text and mdls_text != "(null)":
        return mdls_text, "mdls"
    if shutil.which("qlmanage") is None:
        return extract_pdf_text_with_page_ocr(path) if should_try_deep_pdf_ocr(path, "") else ("", "none")
    with tempfile.TemporaryDirectory(prefix="qimen-doc-pdf-") as tmp_dir:
        tmp_path = Path(tmp_dir)
        result = subprocess.run(
            ["qlmanage", "-t", "-s", "1600", "-o", str(tmp_path), str(path)],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            return extract_pdf_text_with_page_ocr(path) if should_try_deep_pdf_ocr(path, "") else ("", "none")
        thumbnail = tmp_path / f"{path.name}.png"
        if not thumbnail.exists():
            return extract_pdf_text_with_page_ocr(path) if should_try_deep_pdf_ocr(path, "") else ("", "none")
        text, method = ocr_image(thumbnail)
        if text and not should_try_deep_pdf_ocr(path, text):
            return text, f"quicklook_{method}"
        ocr_text, ocr_method = extract_pdf_text_with_page_ocr(path)
        if ocr_text:
            return ocr_text, ocr_method
        return text, f"quicklook_{method}" if text else "quicklook"


def extract_image_text(path: Path) -> tuple[str, str]:
    mdls_text = run_command(["mdls", "-raw", "-name", "kMDItemTextContent", str(path)])
    if mdls_text and mdls_text != "(null)":
        return mdls_text, "mdls"
    text, method = ocr_image(path)
    return text, method


def load_document_sources() -> list[SourceDocument]:
    payload = load_json(DOC_SOURCES_PATH)
    doc_filter = normalize_text(os.environ.get("QIMEN_DOC_SOURCE_FILTER", ""))
    docs: list[SourceDocument] = []
    for item in payload.get("sources", []):
        source_rel_path = str(item.get("source_rel_path") or "")
        if doc_filter and doc_filter not in normalize_text(source_rel_path):
            continue
        copied_path = ROOT / item["copied_path"]
        if not copied_path.exists():
            continue
        suffix = copied_path.suffix.lower()
        text = ""
        source_type = "document"
        extraction_method = "none"
        extraction_ok = False
        if suffix in {".html", ".htm"}:
            text = strip_html(read_text_with_fallbacks(copied_path))
            extraction_method = "html_decode"
        elif suffix in {".txt", ".md", ".json"}:
            text = normalize_text(read_text_with_fallbacks(copied_path))
            extraction_method = "text_decode"
        elif suffix == ".pdf":
            text, extraction_method = extract_pdf_text(copied_path)
        elif suffix in {".jpg", ".jpeg", ".png"}:
            text, extraction_method = extract_image_text(copied_path)
        else:
            text = ""
        extraction_ok = bool(text)
        docs.append(
            SourceDocument(
                source_type=source_type,
                document_format=suffix.lstrip(".") or "unknown",
                teacher=item.get("teacher") or "",
                course_or_book=item.get("course") or copied_path.parent.name,
                path=copied_path,
                source_ref=source_rel_path or markdown_rel(copied_path),
                lesson_or_title=copied_path.name,
                text=text,
                extraction_method=extraction_method,
                extraction_ok=extraction_ok,
            )
        )
    return docs


def load_deep_extraction_payloads() -> list[dict]:
    payloads: list[dict] = []
    for path in sorted(DEEP_EXTRACTION_DIR.glob("*-deep-extraction.json")):
        try:
            payload = load_json(path)
        except Exception:
            continue
        if not isinstance(payload, dict):
            continue
        if not payload.get("source_ref"):
            continue
        payloads.append(payload)
    return payloads


def dedupe_card_items(items: list[dict], text_keys: list[str]) -> list[dict]:
    seen_ids: set[str] = set()
    seen: set[str] = set()
    deduped: list[dict] = []
    for item in items:
        item_id = str(item.get("id") or "").strip()
        if item_id:
            if item_id in seen_ids:
                continue
            seen_ids.add(item_id)
        signature_parts = [
            str(item.get("source_ref") or ""),
            str(item.get("source_section_anchor") or ""),
            str(item.get("source_section_title") or ""),
            str(item.get("question_type") or ""),
            str(item.get("title") or ""),
        ]
        for key in text_keys:
            signature_parts.append(normalize_text(str(item.get(key) or "")))
        signature = "||".join(signature_parts)
        if signature in seen:
            continue
        seen.add(signature)
        deduped.append(item)
    return deduped


def select_deep_doc_rule_cards(items: list[dict]) -> list[dict]:
    deduped = dedupe_card_items(items, ["rule_text"])
    selected: list[dict] = []
    per_source = Counter()
    per_source_qtype = Counter()
    for item in sorted(deduped, key=lambda row: (-float(row.get("confidence") or 0), str(row.get("title") or ""))):
        source_ref = str(item.get("source_ref") or "")
        qtype = str(item.get("question_type") or "general")
        if per_source[source_ref] >= MAX_DEEP_DOC_RULES_PER_SOURCE:
            continue
        if per_source_qtype[(source_ref, qtype)] >= MAX_DEEP_DOC_RULES_PER_QTYPE:
            continue
        selected.append(item)
        per_source[source_ref] += 1
        per_source_qtype[(source_ref, qtype)] += 1
    return selected


def select_deep_doc_note_cards(items: list[dict]) -> list[dict]:
    deduped = dedupe_card_items(items, ["term_note"])
    selected: list[dict] = []
    per_source = Counter()
    for item in sorted(deduped, key=lambda row: (-float(row.get("confidence") or 0), str(row.get("title") or ""))):
        source_ref = str(item.get("source_ref") or "")
        if per_source[source_ref] >= MAX_DEEP_DOC_NOTES_PER_SOURCE:
            continue
        selected.append(item)
        per_source[source_ref] += 1
    return selected


def select_deep_doc_conflicts(items: list[dict]) -> list[dict]:
    deduped = dedupe_card_items(items, ["conflict_rule"])
    selected: list[dict] = []
    per_source = Counter()
    for item in sorted(deduped, key=lambda row: (-float(row.get("confidence") or 0), str(row.get("title") or ""))):
        source_ref = str(item.get("source_ref") or "")
        if per_source[source_ref] >= MAX_DEEP_DOC_CONFLICTS_PER_SOURCE:
            continue
        selected.append(item)
        per_source[source_ref] += 1
    return selected


def select_deep_doc_patterns(items: list[dict]) -> list[dict]:
    deduped = dedupe_card_items(items, ["notes"])
    selected: list[dict] = []
    per_source = Counter()
    for item in sorted(deduped, key=lambda row: (-float(row.get("confidence") or 0), str(row.get("title") or ""))):
        source_ref = str(item.get("source_ref") or "")
        if per_source[source_ref] >= MAX_DEEP_DOC_PATTERNS_PER_SOURCE:
            continue
        selected.append(item)
        per_source[source_ref] += 1
    return selected


def deep_case_card_score(item: dict) -> float:
    question_summary = normalize_text(str(item.get("question_summary") or ""))
    conclusion = normalize_text(str(item.get("teacher_conclusion") or ""))
    title = normalize_text(str(item.get("title") or ""))
    sample = f"{question_summary} {conclusion} {title}"
    if any(token in sample for token in ["qq.com", "http", "zyqmdj", "20472836"]):
        return -10.0
    score = float(item.get("confidence") or 0)
    matched_date = re.search(r"(20\d{6})", question_summary)
    if matched_date and is_plausible_case_date(matched_date.group(1)):
        score += 3
    score += sum(
        1
        for token in ["咨询", "问", "求测", "占测", "反馈", "应验", "结果", "财运", "感情", "婚", "病", "工作", "事业", "店铺"]
        if token in question_summary
    )
    if any(token in conclusion for token in ["先定", "再看", "判断", "说明", "不要只看"]):
        score += 1.5
    return score


def deep_case_card_has_real_case_anchor(item: dict) -> bool:
    question_summary = normalize_text(str(item.get("question_summary") or ""))
    source_ref = normalize_text(str(item.get("source_ref") or ""))
    matched_date = re.search(r"(20\d{6})", question_summary)
    if matched_date and is_plausible_case_date(matched_date.group(1)):
        return True
    markers = [
        "咨询",
        "求测",
        "占测",
        "占例",
        "测",
        "反馈",
        "应验",
        "结果",
        "先生",
        "女士",
        "男士",
        "女土",
        "问店",
        "问病",
    ]
    if "预测应用" in source_ref or "运筹策划" in source_ref:
        markers = ["咨询", "反馈", "应验", "先生", "女士", "男士", "女土", "问店", "问病", "问", "求测", "占测"]
    return any(
        token in question_summary
        for token in markers
    )


def select_deep_doc_case_cards(items: list[dict]) -> list[dict]:
    deduped = dedupe_card_items(items, ["teacher_conclusion", "question_summary"])
    selected: list[dict] = []
    per_source = Counter()
    for item in sorted(deduped, key=lambda row: (-deep_case_card_score(row), str(row.get("title") or ""))):
        source_ref = str(item.get("source_ref") or "")
        score = deep_case_card_score(item)
        if score < 1:
            continue
        if not deep_case_card_has_real_case_anchor(item):
            continue
        if per_source[source_ref] >= 12:
            continue
        selected.append(item)
        per_source[source_ref] += 1
    return selected


def merge_deep_extraction_items(base_items: list[dict], deep_payloads: list[dict], key: str) -> list[dict]:
    if not deep_payloads:
        return base_items
    replacement_sources = {str(payload.get("source_ref") or "") for payload in deep_payloads}
    merged = [item for item in base_items if str(item.get("source_ref") or "") not in replacement_sources]
    deep_items: list[dict] = []
    for payload in deep_payloads:
        deep_items.extend(payload.get(key, []))
    if key == "rule_cards":
        deep_items = select_deep_doc_rule_cards(deep_items)
    elif key == "term_notes":
        deep_items = select_deep_doc_note_cards(deep_items)
    elif key == "conflict_cards":
        deep_items = select_deep_doc_conflicts(deep_items)
    elif key == "pattern_cards":
        deep_items = select_deep_doc_patterns(deep_items)
    elif key == "case_cards":
        deep_items = select_deep_doc_case_cards(deep_items)
    else:
        deep_items = dedupe_card_items(deep_items, [])
    return merged + deep_items


def build_segment_index() -> tuple[list[SourceDocument], dict[tuple[str, str, str], list[SegmentEvidence]]]:
    sources: list[SourceDocument] = []
    index: dict[tuple[str, str, str], list[SegmentEvidence]] = defaultdict(list)
    if not SEGMENTS_DIR.exists():
        return sources, index
    for path in sorted(SEGMENTS_DIR.rglob("*.json")):
        payload = load_json(path)
        lesson = str(payload.get("lesson", "")).strip()
        key = (
            str(payload.get("teacher", "")).strip(),
            str(payload.get("course", "")).strip(),
            lesson,
        )
        index[key].append(
            SegmentEvidence(
                clip_id=str(payload.get("clip_id", "")),
                teacher=key[0],
                course=key[1],
                lesson=lesson,
                draft_path=markdown_rel(path),
                transcript_excerpt=str(payload.get("transcript_excerpt", "")),
                keyframes=[frame.get("frame_path", "") for frame in payload.get("keyframes", [])[:3]],
            )
        )
        sources.append(
            SourceDocument(
                source_type="video_segment",
                teacher=key[0],
                course_or_book=key[1],
                path=path,
                source_ref=markdown_rel(path),
                lesson_or_title=lesson or str(payload.get("clip_id", "")),
                text=normalize_text(
                    " ".join(
                        part
                        for part in [
                            str(payload.get("transcript_excerpt", "")),
                            str(payload.get("board_summary_draft", "")),
                            str(payload.get("final_conclusion_draft", "")),
                            " ".join(payload.get("reasoning_steps_draft", [])),
                            " ".join(block.get("text", "") for block in payload.get("ocr_blocks", [])[:2]),
                        ]
                        if part
                    )
                ),
            )
        )
    return sources, index


def segment_reasoning_score(text: str) -> int:
    sample = normalize_text(text)
    if not sample:
        return 0
    score = 0
    score += sum(3 for term in STRONG_REASONING_TERMS if term in sample)
    score += sum(2 for marker in RULE_MARKERS + PATTERN_MARKERS if marker in sample)
    score += sum(1 for marker in QUESTION_CONTEXT_MARKERS + CASE_MARKERS + CONFLICT_MARKERS if marker in sample)
    score += min(6, len(sample) // 120)
    return score


def lesson_backlog_missing_layers(counts: dict[str, int]) -> tuple[str, ...]:
    missing: list[str] = []
    for layer in PRIMARY_CHAIN_LAYERS:
        if int(counts.get(layer, 0)) <= 0:
            missing.append(layer)
    return tuple(missing)


def lesson_has_primary_layers(counts: dict[str, int]) -> bool:
    return any(int(counts.get(layer, 0)) > 0 for layer in PRIMARY_CHAIN_LAYERS)


def classify_lesson_status(
    counts: dict[str, int],
    *,
    non_target: bool,
) -> str:
    primary_present = sum(1 for key in PRIMARY_CHAIN_LAYERS if int(counts.get(key, 0)) > 0)
    has_rule = int(counts.get("rules", 0)) > 0
    has_pattern = int(counts.get("patterns", 0)) > 0
    has_conflict = int(counts.get("conflicts", 0)) > 0
    has_case = int(counts.get("cases", 0)) > 0
    has_note = int(counts.get("notes", 0)) > 0
    if has_rule and has_case and has_pattern and has_conflict:
        return "full_chain"
    if primary_present >= 3 and has_rule and (has_pattern or has_conflict):
        return "strong_chain"
    if non_target and primary_present == 0 and not has_note:
        return "non_target"
    if primary_present == 0 and has_note:
        return "reference_only"
    return "partial_chain"


def is_foundation_theory_lesson(title: str, course: str, counts: dict[str, int]) -> bool:
    hint = normalize_text(f"{course} {title}")
    if not hint:
        return False
    actionable_markers = [
        "案例",
        "答疑",
        "直播",
        "问",
        "判断",
        "客户",
        "投资",
        "离婚",
        "投标",
        "问病",
        "项目",
        "回款",
        "财运",
        "婚恋",
        "感情",
        "事业",
    ]
    if any(marker in hint for marker in actionable_markers):
        return False
    theory_markers = [
        "五行八卦",
        "十二长生",
        "八门",
        "八神",
        "十天干",
        "九星",
        "格局",
        "庚加",
        "己加",
        "壬加",
        "癸加",
        "丁加",
        "丙加",
        "乙加",
        "辛加",
        "戊加",
        "伏吟",
        "反吟",
        "击刑",
        "入墓",
        "门迫",
        "空亡",
        "符号",
    ]
    if not any(marker in hint for marker in theory_markers):
        return False
    return int(counts.get("cases", 0)) <= 0


def classify_lesson_closure_bucket(
    teacher: str,
    course: str,
    lesson_title: str,
    status: str,
    counts: dict[str, int],
    has_primary_layers: bool,
) -> str:
    if is_foundation_theory_lesson(lesson_title, course, counts):
        return "foundation_theory"
    if teacher != PRIMARY_TEACHER or status != "partial_chain" or not has_primary_layers:
        return "none"
    return "micro_tune"


def lesson_closure_note(closure_bucket: str, missing_layers: tuple[str, ...]) -> str:
    if closure_bucket == "foundation_theory":
        if "cases" in missing_layers:
            return "理论基础课，作为规则与路径的底层知识保留，不为清 backlog 硬补案例。"
        return "理论基础课，作为规则与路径的底层知识保留，后续仅做低风险微调。"
    if closure_bucket == "micro_tune":
        return "仍可自然补齐缺层，保留为后续低风险升链对象。"
    return ""


def lesson_backlog_priority(title: str, missing_layers: tuple[str, ...], counts: dict[str, int]) -> int:
    if not missing_layers:
        return 0
    score = 0
    missing = set(missing_layers)
    if counts.get("patterns", 0) and (counts.get("rules", 0) <= 0 or counts.get("conflicts", 0) <= 0):
        score += 160
    if counts.get("rules", 0) and (counts.get("patterns", 0) <= 0 or counts.get("conflicts", 0) <= 0):
        score += 140
    if "patterns" in missing:
        score += 90
    if "rules" in missing:
        score += 80
    if "conflicts" in missing:
        score += 80
    if "cases" in missing:
        score += 25
    if any(marker in title for marker in ["案例", "带学", "直播", "直播课", "答疑", "判断", "判断逻辑", "三连问", "问病", "投标", "感情", "婚恋", "财运", "问", "能不能", "会不会", "投资", "离婚", "客户", "涨薪"]):
        score += 40
    return score


def load_previous_video_backlog() -> dict[tuple[str, str], dict[str, object]]:
    if not VIDEO_COVERAGE_REPORT_PATH.exists():
        return {}
    text = VIDEO_COVERAGE_REPORT_PATH.read_text(encoding="utf-8", errors="ignore")
    if "## 钟波 Lesson Backlog" not in text:
        return {}
    section = text.split("## 钟波 Lesson Backlog", 1)[1]
    entries: dict[tuple[str, str], dict[str, object]] = {}
    current_title = ""
    current_course = ""
    counts = {"rules": 0, "cases": 0, "patterns": 0, "notes": 0, "conflicts": 0}
    for raw_line in section.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("## "):
            break
        if line.startswith("### "):
            if current_title:
                missing_layers = lesson_backlog_missing_layers(counts)
                entries[(current_course, current_title)] = {
                    "missing_layers": missing_layers,
                    "priority": lesson_backlog_priority(current_title, missing_layers, counts),
                    "counts": counts.copy(),
                }
            current_title = line.removeprefix("### ").strip()
            current_course = ""
            counts = {"rules": 0, "cases": 0, "patterns": 0, "notes": 0, "conflicts": 0}
            continue
        if line.startswith("- course:"):
            current_course = line.split(":", 1)[1].strip()
            continue
        for key in counts:
            prefix = f"- {key}:"
            if line.startswith(prefix):
                try:
                    counts[key] = int(line.split(":", 1)[1].strip())
                except Exception:
                    counts[key] = 0
                break
    if current_title:
        missing_layers = lesson_backlog_missing_layers(counts)
        entries[(current_course, current_title)] = {
            "missing_layers": missing_layers,
            "priority": lesson_backlog_priority(current_title, missing_layers, counts),
            "counts": counts.copy(),
        }
    return entries


def load_previous_lesson_question_types() -> dict[tuple[str, str, str], str]:
    if not LESSON_INDEX_PATH.exists():
        return {}
    try:
        payload = load_json(LESSON_INDEX_PATH)
    except Exception:
        return {}
    lessons = payload.get("lessons", []) if isinstance(payload, dict) else []
    hints: dict[tuple[str, str, str], str] = {}
    for lesson in lessons:
        if not isinstance(lesson, dict):
            continue
        teacher = str(lesson.get("teacher") or "").strip()
        course = str(lesson.get("course") or "").strip()
        title = str(lesson.get("lesson_title") or "").strip()
        qtype = str(lesson.get("primary_question_type") or "").strip()
        if teacher and course and title and qtype:
            hints[(teacher, course, title)] = qtype
    return hints


def load_previous_lesson_gap_hints() -> dict[tuple[str, str, str], dict[str, object]]:
    if not LESSON_INDEX_PATH.exists():
        return {}
    try:
        payload = load_json(LESSON_INDEX_PATH)
    except Exception:
        return {}
    lessons = payload.get("lessons", []) if isinstance(payload, dict) else []
    hints: dict[tuple[str, str, str], dict[str, object]] = {}
    for lesson in lessons:
        if not isinstance(lesson, dict):
            continue
        teacher = str(lesson.get("teacher") or "").strip()
        course = str(lesson.get("course") or "").strip()
        title = str(lesson.get("lesson_title") or "").strip()
        if not (teacher and course and title):
            continue
        counts = lesson.get("counts", {})
        if not isinstance(counts, dict):
            counts = {}
        normalized_counts = {
            "rules": int(counts.get("rules", 0) or 0),
            "cases": int(counts.get("cases", 0) or 0),
            "patterns": int(counts.get("patterns", 0) or 0),
            "notes": int(counts.get("notes", 0) or 0),
            "conflicts": int(counts.get("conflicts", 0) or 0),
        }
        missing_layers = tuple(
            str(layer)
            for layer in lesson.get("current_gap_layers", [])
            if str(layer).strip()
        ) or lesson_backlog_missing_layers(normalized_counts)
        hints[(teacher, course, title)] = {
            "missing_layers": missing_layers,
            "priority": lesson_backlog_priority(title, missing_layers, normalized_counts),
            "counts": normalized_counts,
        }
    return hints


def boosted_segment_reasoning_score(text: str, missing_layers: tuple[str, ...]) -> int:
    sample = normalize_text(text)
    score = segment_reasoning_score(sample)
    if not sample:
        return score
    if "rules" in missing_layers and any(marker in sample for marker in ["用神", "落宫", "门", "星", "神", "格局", "旺衰", "值符", "值使"]):
        score += 18
    if "patterns" in missing_layers and any(marker in sample for marker in PATTERN_MARKERS + ["取用神", "先定", "最后看"]):
        score += 20
    if "conflicts" in missing_layers and any(marker in sample for marker in CONFLICT_MARKERS + ["为什么这么断", "会不会", "能不能", "是否"]):
        score += 18
    if "cases" in missing_layers and any(marker in sample for marker in CASE_MARKERS + ["求测", "反馈", "应验", "结果"]):
        score += 10
    return score


def aggregate_video_lessons(sources: list[SourceDocument]) -> list[SourceDocument]:
    grouped: dict[tuple[str, str, str], list[SourceDocument]] = defaultdict(list)
    backlog_hints = load_previous_video_backlog()
    lesson_gap_hints = load_previous_lesson_gap_hints()
    question_type_hints = load_previous_lesson_question_types()
    for source in sources:
        key = (source.teacher or "UNKNOWN", source.course_or_book, source.lesson_or_title)
        grouped[key].append(source)

    aggregated: list[SourceDocument] = []
    for key, lesson_sources in sorted(grouped.items(), key=lambda item: item[0]):
        hint = lesson_gap_hints.get(key) or backlog_hints.get((key[1], key[2]), {})
        missing_layers = tuple(hint.get("missing_layers", ()))
        backlog_priority = int(hint.get("priority", 0))
        ranked = sorted(
            lesson_sources,
            key=lambda item: (
                -boosted_segment_reasoning_score(item.text, missing_layers),
                -len(normalize_text(item.text)),
                item.source_ref,
            ),
        )
        selected: list[str] = []
        seen_texts: set[str] = set()
        for item in ranked:
            normalized = normalize_text(item.text)
            if not normalized or normalized in seen_texts:
                continue
            seen_texts.add(normalized)
            selected.append(normalized)
            selection_limit = 18 if backlog_priority >= 150 else 16 if backlog_priority >= 90 else 12
            if len(selected) >= selection_limit:
                break
        if not selected:
            continue
        anchor = ranked[0]
        aggregated.append(
            SourceDocument(
                source_type="video_segment",
                teacher=key[0],
                course_or_book=key[1],
                path=anchor.path,
                source_ref=anchor.source_ref,
                lesson_or_title=key[2],
                text=normalize_text(" ".join(selected)),
                document_format="lesson",
                extraction_method="lesson_aggregate",
                extraction_ok=True,
                backlog_missing_layers=missing_layers,
                backlog_priority=backlog_priority,
                primary_question_type=question_type_hints.get(key, "general"),
            )
        )
    return aggregated


def source_gap_priority(card_kind: str, source: SourceDocument) -> tuple[int, int, int, int, str, str]:
    relevant_layer = {
        "rule": "rules",
        "case": "cases",
        "pattern": "patterns",
        "conflict": "conflicts",
    }.get(card_kind, "")
    missing_layers = set(source.backlog_missing_layers)
    lesson_title = source.lesson_or_title
    lesson_hint = f"{source.course_or_book} {lesson_title}"
    case_hint = any(marker in lesson_hint for marker in ["案例", "带学", "直播", "直播课", "答疑", "圈课", "问", "判断", "判断逻辑", "三连问"])
    if source.source_type == "video_segment" and source.teacher == PRIMARY_TEACHER:
        source_bucket = 0
    elif source.source_type == "video_segment":
        source_bucket = 1
    else:
        source_bucket = 2
    return (
        source_bucket,
        0 if relevant_layer and relevant_layer in missing_layers else 1,
        -int(source.backlog_priority or 0),
        0 if case_hint else 1,
        source.course_or_book,
        source.lesson_or_title,
    )


def resolve_source_question_type(source: SourceDocument, text: str, hint: str) -> str:
    if source.primary_question_type and source.primary_question_type != "general":
        return source.primary_question_type
    return detect_question_type(text, hint)


def build_evidence_refs(source: SourceDocument, segment_index: dict[tuple[str, str, str], list[SegmentEvidence]], snippet: str) -> list[str]:
    refs = [source.source_ref]
    if source.source_type == "document":
        if source.extraction_method and source.extraction_method != "none":
            refs.append(f"extract:{source.extraction_method}")
        return refs[:5]
    segment_key = (source.teacher, source.course_or_book, source.lesson_or_title.replace(".txt", ".mp4"))
    for segment in segment_index.get(segment_key, []):
        if not snippet:
            continue
        overlap_terms = [term for term in extract_terms(snippet) if term and term in segment.transcript_excerpt]
        if overlap_terms or snippet[:12] in segment.transcript_excerpt:
            refs.append(segment.draft_path)
            refs.extend(frame for frame in segment.keyframes if frame)
            break
    return refs[:5]


def summarize_sentence(text: str, limit: int = 68) -> str:
    text = normalize_text(text)
    text = re.sub(r"\b(?:嗯|啊|呃|对吧|就是|这个时候|其实|然后呢)\b", "", text)
    text = re.sub(r"(.)\1{2,}", r"\1", text)
    text = normalize_text(text)
    return text if len(text) <= limit else f"{text[: limit - 1]}…"


def clean_spoken_excerpt(text: str) -> str:
    cleaned = summarize_sentence(text, 220)
    cleaned = re.sub(r"(?:对吧|啊|嗯|呃|就是|然后呢|这个时候)+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ，。；;：:")
    return cleaned


def collapse_repeated_phrases(text: str) -> str:
    collapsed = text
    for size in range(2, 7):
        pattern = re.compile(rf"((?:[\u4e00-\u9fff]{{{size}}}))(?:\s*\1){{2,}}")
        collapsed = pattern.sub(r"\1", collapsed)
    collapsed = re.sub(r"([\u4e00-\u9fff]{2,})(?:\s+\1){1,}", r"\1", collapsed)
    return collapsed


def compress_reasoning_text(text: str) -> str:
    cleaned = collapse_repeated_phrases(clean_spoken_excerpt(text))
    clauses = [
        normalize_text(part)
        for part in re.split(r"[，,。；;：:]", cleaned)
        if normalize_text(part)
    ]
    if not clauses:
        return cleaned
    weighted: list[tuple[int, str]] = []
    for clause in clauses:
        score = 0
        if any(term in clause for term in STRONG_REASONING_TERMS):
            score += 3
        if any(marker in clause for marker in ["说明", "代表", "意味着", "判断", "应期", "病位", "中标", "用神"]):
            score += 2
        if any(marker in clause for marker in QUESTION_CONTEXT_MARKERS):
            score += 1
        weighted.append((score, clause))
    ranked = [clause for _, clause in sorted(weighted, key=lambda item: (-item[0], clauses.index(item[1])))]
    kept: list[str] = []
    for clause in ranked:
        if any(clause in existing or existing in clause for existing in kept):
            continue
        kept.append(clause)
        if len(kept) >= 3:
            break
    summary = "；".join(kept if kept else clauses[:2])
    summary = re.sub(r"\s+", " ", summary).strip("，。；;：:")
    return summary[:140]


def build_rule_summary(question_type: str, sentence: str) -> str:
    sample = compress_reasoning_text(sentence)
    if question_type == "health_energy":
        if any(token in sample for token in ["肾结石", "结石", "堵住", "管道", "坎工", "坎宫", "死门"]):
            return "病位偏向肾水或管道堵塞，死门和病地同见时，优先按结石、堵塞、疼痛类问题判断。"
        if any(token in sample for token in ["严重", "绝地", "天锐", "天芮", "多器官"]):
            return "天芮、绝地、病位同见时，先按病情偏重来断，再分是单点问题还是连带性问题。"
        return "先定病位，再比旺衰和门星神，判断轻重、病程长短和恢复难度。"
    if question_type == "career_work":
        if any(token in sample for token in ["投标", "中标", "甲方", "标书", "太岁"]):
            return "投标题先不凭背景预设结果，要先定用神，再看甲方态度、太岁关系和中标条件是否成立。"
        if any(token in sample for token in ["老板", "领导", "岗位", "项目", "决策"]):
            return "工作题先分清谁有决策权，再看岗位、领导态度和实际推动力落在哪一方。"
        return "事业题先定主线与决策权，再看用神落宫和项目是否真正能推进。"
    if question_type == "love_relationship":
        if any(token in sample for token in ["婚姻", "对象", "复合", "离婚"]):
            return "感情题先定双方关系主线，再看门星神是否支持推进、复合或分开。"
        return "感情题不要只看情绪强弱，要先看关系是否真的有继续推进的条件。"
    if question_type == "money_wealth":
        if any(token in sample for token in ["投资", "回款", "合作", "客户", "收益"]):
            return "财运题先看财路是否真实可控，再看合作方、兑现节奏和回款是否落地。"
        return "财运题先分清资源归属和兑现条件，不把表面机会直接当成真实收益。"
    return sample


def build_case_summary(question_type: str, question_summary: str, conclusion: str) -> str:
    merged = f"{compress_reasoning_text(question_summary)} {compress_reasoning_text(conclusion)}"
    if question_type == "health_energy":
        return build_rule_summary(question_type, merged)
    if question_type == "career_work":
        return build_rule_summary(question_type, merged)
    if question_type == "love_relationship":
        return build_rule_summary(question_type, merged)
    if question_type == "money_wealth":
        return build_rule_summary(question_type, merged)
    return compress_reasoning_text(merged)


def build_conflict_summary(question_type: str, sentence: str) -> str:
    sample = compress_reasoning_text(sentence)
    if question_type == "health_energy":
        return "健康题信号冲突时，先保留病位和轻重判断，再用门星神补边，不要被单一吉象带偏。"
    if question_type == "career_work":
        return "事业题信号冲突时，先分清是否真正满足中标/推进条件，再看背景信息，不先凭已知消息下结论。"
    if question_type == "love_relationship":
        return "感情题信号冲突时，先看关系是否成局，再分情绪波动和真实推进。"
    if question_type == "money_wealth":
        return "财运题信号冲突时，先守住归属和兑现主线，再评估机会大小。"
    return sample


def document_block_is_conflict_candidate(block: str, lesson: str) -> bool:
    if len(normalize_text(block)) < 12:
        return False
    if "三连问" in lesson:
        return any(marker in block for marker in ["为什么", "能不能", "是否", "会不会", "结果", "反馈"])
    return any(marker in block for marker in CONFLICT_MARKERS + ["为什么", "能不能", "是否", "会不会"])


def document_title_fallback_text(source: SourceDocument) -> str:
    title = source.lesson_or_title
    if source.document_format not in {"pdf", "jpg", "jpeg", "png"}:
        return ""
    snippets: list[str] = []
    if any(token in title for token in ["案例解析", "实战案例", "直播公益课"]):
        snippets.append("案例解析 实战案例 取用神 落宫 门星神 象意")
    if any(token in title for token in ["预测应用", "运筹策划"]):
        snippets.append("预测应用 运筹策划 判断条件 取用神 格局 边界")
    if any(token in title for token in ["风水调理", "转运布局", "九宫飞星", "户型图"]):
        snippets.append("风水调理 时空转运布局 九宫飞星 落宫 布局")
    if any(token in title for token in ["神奇之门", "开悟之门", "导学", "入门教程"]):
        snippets.append("入门教程 基础术语 宫位 门星神 用神")
    return normalize_text(f"{title} {' '.join(snippets)}")


def document_title_fallback_question_type(source: SourceDocument) -> str:
    title = source.lesson_or_title
    text = f"{source.course_or_book} {title}"
    if any(token in text for token in ["合作", "投资", "回款", "收益", "财", "运筹策划"]):
        return "money_wealth"
    if any(token in text for token in ["病", "怀孕", "宝宝", "恢复", "健康", "身体"]):
        return "health_energy"
    if any(token in text for token in ["婚", "恋", "感情", "桃花", "对象", "老公", "老婆"]):
        return "love_relationship"
    if any(token in text for token in ["工作", "事业", "风水", "布局", "项目", "岗位", "公司", "课程", "教程", "导学", "预测应用", "案例解析", "直播公益课"]):
        return "career_work"
    return "general"


def document_title_should_seed_rule(source: SourceDocument) -> bool:
    title = source.lesson_or_title
    return any(
        token in title
        for token in [
            "预测应用",
            "预测案例解析",
            "运筹策划",
            "风水调理",
            "时空转运布局",
            "神奇之门",
            "开悟之门",
            "入门教程",
            "导学",
            "直播公益课",
        ]
    )


def document_is_casebook(source: SourceDocument) -> bool:
    title = source.lesson_or_title
    return any(token in title for token in ["案例解析", "预测案例", "预测应用", "运筹策划", "占例", "案例汇编"])


def document_case_limit(source: SourceDocument) -> int:
    return 12 if document_is_casebook(source) else MAX_DOCUMENT_CASES_PER_SOURCE


def document_conflict_limit(source: SourceDocument) -> int:
    return 8 if document_is_casebook(source) else MAX_DOCUMENT_CONFLICTS_PER_SOURCE


def block_has_casebook_signal(block: str) -> bool:
    sample = normalize_text(block)
    if re.search(r"20\d{6}", sample):
        return True
    return any(
        marker in sample
        for marker in ["咨询", "问", "求测", "占测", "占例", "反馈", "应验", "结果"]
    )


def document_casebook_text(source: SourceDocument) -> str:
    text = source.text
    title = source.lesson_or_title
    if "预测应用" in title:
        matches = list(re.finditer(r"第十五章\s*分类预测", text))
        if matches:
            anchor = matches[-1].start()
            return text[anchor:]
    return text


def normalize_section_anchor(value: str) -> str:
    sample = normalize_text(value)
    sample = re.sub(r"\s+", "-", sample)
    sample = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff_-]+", "", sample)
    return sample[:80] or "section"


def prediction_app_section_question_types(section_title: str, section_text: str) -> tuple[str, ...]:
    hint = normalize_text(section_title)
    if "健康疾病" in hint or "怀孕脱产" in hint:
        return ("health_energy",)
    if "交友" in hint or "婚恋" in hint:
        return ("love_relationship",)
    if "股市股票" in hint:
        return ("money_wealth",)
    if "企业经营管理" in hint:
        detected = detect_question_type(section_text, section_title)
        return (detected,) if detected != "general" else ("money_wealth",)
    if "求学考试" in hint or "证件手续" in hint or "选举" in hint:
        return ("career_work",)
    detected = detect_question_type(section_text, section_title)
    return (detected,) if detected != "general" else ()


def extract_prediction_app_sections(source: SourceDocument) -> list[DocumentSection]:
    text = document_casebook_text(source)
    specs = [
        "健康疾病",
        "企业经营管理",
        "求学考试",
        "终身卦",
        "吉凶祝福",
        "怀孕脱产",
        "体育竞赛",
        "天气",
        "股市股票",
        "选举",
        "消息真假",
        "交友婚恋",
        "交友善丽",
        "名画真假",
        "证件手续",
        "常见故障",
    ]
    found: list[tuple[int, str]] = []
    for title in specs:
        idx = text.find(title)
        if idx >= 0:
            found.append((idx, title))
    found.sort()
    sections: list[DocumentSection] = []
    for i, (start, title) in enumerate(found):
        end = found[i + 1][0] if i + 1 < len(found) else len(text)
        chunk = normalize_text(text[start:end])
        if len(chunk) < 160:
            continue
        qtypes = prediction_app_section_question_types(title, chunk)
        if not qtypes:
            continue
        anchor = normalize_section_anchor(title)
        sections.append(DocumentSection(title=title, anchor=anchor, text=chunk, question_types=qtypes))
    return sections


def annotate_section_fields(items: list[dict], section_title: str, section_anchor: str) -> list[dict]:
    for item in items:
        item.setdefault("source_section_title", section_title)
        item.setdefault("source_section_anchor", section_anchor)
    return items


def force_question_type(items: list[dict], question_type: str) -> list[dict]:
    for item in items:
        title = str(item.get("title") or "")
        for candidate_type, meta in QUESTION_TYPES.items():
            label = str(meta.get("label") or "")
            target_label = question_type_title(question_type)
            if label and label != target_label and title.startswith(f"{label}案例"):
                title = title.replace(f"{label}案例", f"{target_label}案例", 1)
            elif label and label != target_label and title.startswith(f"{label} /"):
                title = title.replace(f"{label} /", f"{target_label} /", 1)
        item["title"] = title
        item["question_type"] = question_type
        item["tags"] = sorted(set([question_type, *[tag for tag in item.get("tags", []) if tag != "general"]]))
    return items


def document_is_nonknowledge_target(source: SourceDocument) -> bool:
    title = source.lesson_or_title
    if any(token in title for token in ["课表", "资料目录"]):
        return True
    if source.document_format in {"jpg", "jpeg", "png"} and not source.extraction_ok:
        return True
    return False


def find_first_term(text: str) -> str:
    for term in STRONG_REASONING_TERMS + TERM_KEYWORDS:
        if term in text:
            return term
    return ""


def question_type_title(question_type: str) -> str:
    return QUESTION_TYPES.get(question_type, {}).get("label", "综合断事")


def derive_rule_title(question_type: str, sentence: str, lesson: str) -> str:
    sample = clean_spoken_excerpt(sentence)
    lesson_name = lesson.replace(".mp4", "").replace("_batch", "").strip()
    if "用神" in sample and "落宫" in sample:
        return f"{question_type_title(question_type)} / 用神落宫优先判断"
    if "应期" in sample:
        return f"{question_type_title(question_type)} / 应期判断"
    if "值符" in sample or "值使" in sample:
        return f"{question_type_title(question_type)} / 值符值使主线"
    if question_type == "health_energy":
        if any(token in sample for token in ["严重", "病地", "绝地", "天芮", "病位"]):
            return "健康身体 / 病位与严重程度判断"
        if any(token in sample for token in ["恢复", "调理", "手术"]):
            return "健康身体 / 恢复与处理判断"
    if question_type == "career_work":
        if any(token in sample for token in ["投标", "中标", "甲方", "标书"]):
            return "事业工作 / 投标与甲方态度判断"
        if any(token in sample for token in ["老板", "领导", "岗位", "项目"]):
            return "事业工作 / 岗位与决策权判断"
    if question_type == "love_relationship":
        if any(token in sample for token in ["婚姻", "对象", "复合", "离婚"]):
            return "感情婚姻 / 关系推进判断"
    if question_type == "money_wealth":
        if any(token in sample for token in ["回款", "合作", "客户", "收益", "投资"]):
            return "财运合作 / 财路与兑现判断"
    term = find_first_term(sample)
    if term:
        return f"{question_type_title(question_type)} / {term}判断"
    return f"{question_type_title(question_type)} / {lesson_name or '规则卡'}"


def derive_case_title(question_type: str, lesson: str, question_summary: str) -> str:
    lesson_name = lesson.replace(".mp4", "").replace("_batch", "").replace("_", " ").strip()
    sample = clean_spoken_excerpt(question_summary)
    if question_type == "health_energy" and any(token in sample for token in ["病", "肚子", "手术", "恢复"]):
        return "问病案例 / 病位与轻重判断"
    if question_type == "career_work" and any(token in sample for token in ["投标", "中标", "甲方", "老板"]):
        return "事业案例 / 投标是否能中"
    if question_type == "love_relationship" and any(token in sample for token in ["婚姻", "对象", "复合", "离婚"]):
        return "感情案例 / 关系走向判断"
    if question_type == "money_wealth" and any(token in sample for token in ["投资", "合作", "客户", "回款"]):
        return "财运案例 / 合作与兑现判断"
    return f"{question_type_title(question_type)}案例 / {lesson_name or '案例'}"


def derive_conflict_title(question_type: str, sentence: str, lesson: str) -> str:
    sample = clean_spoken_excerpt(sentence)
    lesson_name = lesson.replace(".mp4", "").replace("_batch", "").replace("_", " ").strip()
    if question_type == "health_energy":
        if any(token in sample for token in ["病位", "严重", "轻重", "病地", "绝地", "天芮", "天锐"]):
            return "健康身体 / 病位与轻重冲突取舍"
        if any(token in sample for token in ["恢复", "手术", "调理"]):
            return "健康身体 / 恢复节奏冲突取舍"
        return "健康身体 / 信号冲突取舍"
    if question_type == "career_work":
        if any(token in sample for token in ["投标", "中标", "甲方", "标", "太岁"]):
            return "事业工作 / 中标条件冲突取舍"
        if any(token in sample for token in ["老板", "领导", "项目", "岗位", "决策"]):
            return "事业工作 / 决策权与推进冲突取舍"
        return "事业工作 / 信号冲突取舍"
    if question_type == "love_relationship":
        if any(token in sample for token in ["复合", "婚姻", "对象", "离婚"]):
            return "感情婚姻 / 关系走向冲突取舍"
        return "感情婚姻 / 信号冲突取舍"
    if question_type == "money_wealth":
        if any(token in sample for token in ["回款", "合作", "投资", "客户", "收益"]):
            return "财运合作 / 兑现与合作冲突取舍"
        return "财运合作 / 信号冲突取舍"
    term = find_first_term(sample)
    if term:
        return f"{question_type_title(question_type)} / {term}冲突取舍"
    return f"{question_type_title(question_type)} / {lesson_name or '冲突取舍'}"


def build_report(rules: dict, cases: dict, patterns: dict, notes: dict, conflicts: dict) -> None:
    sections = [
        ("规则卡", "rules", rules),
        ("案例卡", "cases", cases),
        ("推理路径卡", "patterns", patterns),
        ("术语卡", "notes", notes),
        ("冲突卡", "cards", conflicts),
    ]
    lines = [
        "# QiMen Reasoning Build Report",
        "",
        f"- built_at: {rules['updated_at']}",
        f"- primary_teacher: {PRIMARY_TEACHER}",
        f"- rule_cards: {len(rules['rules'])}",
        f"- case_cards: {len(cases['cases'])}",
        f"- reasoning_patterns: {len(patterns['patterns'])}",
        f"- term_notes: {len(notes['notes'])}",
        f"- conflict_cards: {len(conflicts['cards'])}",
        "",
        "## Tier Summary",
        "",
    ]
    for label, key, payload in sections:
        tier_counts = count_tiers(payload[key])
        override_count = count_overrides(payload[key])
        lines.extend(
            [
                f"### {label}",
                f"- core: {tier_counts['core']}",
                f"- support: {tier_counts['support']}",
                f"- reference: {tier_counts['reference']}",
                f"- overridden: {override_count}",
                "",
            ]
        )

    lines.extend([
        "## Samples",
        "",
    ])
    for title, key, payload in [
        ("Rule Cards", "rules", rules),
        ("Case Cards", "cases", cases),
        ("Reasoning Patterns", "patterns", patterns),
        ("Term Notes", "notes", notes),
        ("Conflict Cards", "cards", conflicts),
    ]:
        lines.append(f"### {title}")
        for item in payload[key][:5]:
            override_note = " / overridden" if item.get("tier_override", {}).get("applied") else ""
            lines.append(
                f"- {item.get('title')} [{item.get('question_type', 'general')}] / "
                f"{item.get('source_teacher', '')} / tier={item.get('knowledge_tier', 'reference')}{override_note}"
            )
        lines.append("")
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_document_extraction_report(document_sources: list[SourceDocument]) -> None:
    format_counts = Counter(source.document_format for source in document_sources)
    teacher_counts = Counter(source.teacher or "UNKNOWN" for source in document_sources)
    ok_count = sum(1 for source in document_sources if source.extraction_ok)
    method_counts = Counter(source.extraction_method for source in document_sources)
    lines = [
        "# QiMen Document Extraction Report",
        "",
        f"- built_at: {datetime.now(timezone.utc).isoformat()}",
        f"- total_documents: {len(document_sources)}",
        f"- extracted_ok: {ok_count}",
        f"- extracted_empty: {len(document_sources) - ok_count}",
        "",
        "## By Format",
        "",
    ]
    for key, count in sorted(format_counts.items()):
        lines.append(f"- {key}: {count}")
    lines.extend(["", "## By Teacher", ""])
    for key, count in sorted(teacher_counts.items()):
        lines.append(f"- {key}: {count}")
    lines.extend(["", "## Extraction Methods", ""])
    for key, count in sorted(method_counts.items()):
        lines.append(f"- {key}: {count}")
    lines.extend(["", "## Samples", ""])
    for source in document_sources[:15]:
        lines.append(
            f"- {source.teacher or 'UNKNOWN'} / {source.lesson_or_title} / "
            f"{source.document_format} / {source.extraction_method} / "
            f"{'ok' if source.extraction_ok else 'empty'}"
        )
    DOC_EXTRACTION_REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_document_coverage_report(
    document_sources: list[SourceDocument],
    rules: list[dict],
    cases: list[dict],
    notes: list[dict],
    conflicts: list[dict],
) -> None:
    by_source: dict[str, dict[str, list[str] | str]] = {}
    for source in document_sources:
        by_source[source.source_ref] = {
            "teacher": source.teacher or "UNKNOWN",
            "title": source.lesson_or_title,
            "format": source.document_format,
            "rule_titles": [],
            "case_titles": [],
            "note_titles": [],
            "conflict_titles": [],
        }

    def attach(items: list[dict], field: str):
        for item in items:
            if item.get("source_type") != "document":
                continue
            source_ref = str(item.get("source_ref") or "").strip()
            if source_ref in by_source:
                cast = by_source[source_ref][field]
                assert isinstance(cast, list)
                cast.append(str(item.get("title") or item.get("term") or item.get("id") or ""))

    attach(rules, "rule_titles")
    attach(cases, "case_titles")
    attach(notes, "note_titles")
    attach(conflicts, "conflict_titles")

    lines = [
        "# QiMen Document Coverage Report",
        "",
        f"- built_at: {datetime.now(timezone.utc).isoformat()}",
        f"- total_documents: {len(document_sources)}",
        f"- with_rules: {sum(1 for row in by_source.values() if row['rule_titles'])}",
        f"- with_cases: {sum(1 for row in by_source.values() if row['case_titles'])}",
        f"- with_notes: {sum(1 for row in by_source.values() if row['note_titles'])}",
        f"- with_conflicts: {sum(1 for row in by_source.values() if row['conflict_titles'])}",
        "",
        "## Per Document",
        "",
    ]

    for source_ref, row in sorted(by_source.items()):
        rule_titles = row["rule_titles"]
        case_titles = row["case_titles"]
        note_titles = row["note_titles"]
        conflict_titles = row["conflict_titles"]
        lines.extend(
            [
                f"### {row['teacher']} / {row['title']}",
                f"- source_ref: {source_ref}",
                f"- format: {row['format']}",
                f"- rules: {len(rule_titles)}",
                f"- cases: {len(case_titles)}",
                f"- notes: {len(note_titles)}",
                f"- conflicts: {len(conflict_titles)}",
            ]
        )
        if rule_titles:
            lines.append(f"- rule_titles: {'；'.join(rule_titles[:4])}")
        if case_titles:
            lines.append(f"- case_titles: {'；'.join(case_titles[:4])}")
        if note_titles:
            lines.append(f"- note_titles: {'；'.join(note_titles[:4])}")
        if conflict_titles:
            lines.append(f"- conflict_titles: {'；'.join(conflict_titles[:4])}")
        if not (rule_titles or case_titles or note_titles or conflict_titles):
            if document_is_nonknowledge_target(next(source for source in document_sources if source.source_ref == source_ref)):
                lines.append("- status: 非入卡目标（课表/目录/空图）")
            else:
                lines.append("- status: 尚未进入知识卡")
        lines.append("")

    DOC_COVERAGE_REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_lesson_index(
    transcript_segments: list[SourceDocument],
    transcript_sources: list[SourceDocument],
    document_sources: list[SourceDocument],
    segment_index: dict[tuple[str, str, str], list[SegmentEvidence]],
    rules: list[dict],
    cases: list[dict],
    patterns: list[dict],
    notes: list[dict],
    conflicts: list[dict],
) -> dict:
    by_source_ref: dict[str, tuple[str, str, str]] = {}
    by_lesson: dict[tuple[str, str, str], dict[str, object]] = {}
    aggregated_map = {
        (source.teacher or "UNKNOWN", source.course_or_book, source.lesson_or_title): source
        for source in transcript_sources
    }

    for source in transcript_segments:
        lesson_key = (source.teacher or "UNKNOWN", source.course_or_book, source.lesson_or_title)
        by_source_ref[source.source_ref] = lesson_key
        if lesson_key not in by_lesson:
            by_lesson[lesson_key] = {
                "teacher": source.teacher or "UNKNOWN",
                "course": source.course_or_book,
                "lesson_title": source.lesson_or_title,
                "source_refs": [],
                "clip_count": 0,
                "keyframe_refs": [],
                "document_refs": [],
                "question_type_counts": Counter(),
                "rule_titles": [],
                "case_titles": [],
                "pattern_titles": [],
                "note_titles": [],
                "conflict_titles": [],
            }
        row = by_lesson[lesson_key]
        refs = row["source_refs"]
        assert isinstance(refs, list)
        refs.append(source.source_ref)
        row["clip_count"] = int(row["clip_count"]) + 1
        keyframes = row["keyframe_refs"]
        assert isinstance(keyframes, list)
        for evidence in segment_index.get(lesson_key, []):
            for frame in evidence.keyframes:
                if frame and frame not in keyframes:
                    keyframes.append(frame)
                if len(keyframes) >= 8:
                    break
            if len(keyframes) >= 8:
                break

    def attach(items: list[dict], field: str) -> None:
        for item in items:
            source_type = str(item.get("source_type") or "").strip()
            source_ref = str(item.get("source_ref") or "").strip()
            if source_type == "document":
                continue
            lesson_key = by_source_ref.get(source_ref)
            if not lesson_key:
                continue
            row = by_lesson[lesson_key]
            cast = row[field]
            assert isinstance(cast, list)
            cast.append(str(item.get("title") or item.get("term") or item.get("id") or ""))
            qtype = str(item.get("question_type") or "").strip()
            if qtype and qtype != "general":
                qtype_counts = row["question_type_counts"]
                assert isinstance(qtype_counts, Counter)
                qtype_counts[qtype] += 1

    attach(rules, "rule_titles")
    attach(cases, "case_titles")
    attach(patterns, "pattern_titles")
    attach(notes, "note_titles")
    attach(conflicts, "conflict_titles")

    document_refs_by_qtype: dict[str, list[str]] = defaultdict(list)
    for item in [*rules, *cases, *notes, *conflicts]:
        if str(item.get("source_type") or "").strip() != "document":
            continue
        qtype = str(item.get("question_type") or "").strip() or "general"
        source_ref = str(item.get("source_ref") or "").strip()
        if source_ref and source_ref not in document_refs_by_qtype[qtype]:
            document_refs_by_qtype[qtype].append(source_ref)

    lessons: list[dict] = []
    for lesson_key, row in sorted(by_lesson.items(), key=lambda item: (item[0][0], item[0][1], item[0][2])):
        teacher, course, lesson_title = lesson_key
        counts = {
            "rules": len(row["rule_titles"]),
            "cases": len(row["case_titles"]),
            "patterns": len(row["pattern_titles"]),
            "notes": len(row["note_titles"]),
            "conflicts": len(row["conflict_titles"]),
        }
        has_primary_layers = lesson_has_primary_layers(counts)
        hint = f"{course} {lesson_title}"
        aggregated = aggregated_map.get(lesson_key)
        fallback_qtype = detect_question_type(aggregated.text if aggregated else "", hint)
        qtype_counts = row["question_type_counts"]
        assert isinstance(qtype_counts, Counter)
        ranked_candidates = sorted(qtype_counts.items(), key=lambda item: (-item[1], item[0]))
        if not ranked_candidates and fallback_qtype != "general":
            ranked_candidates = [(fallback_qtype, 1)]
        primary_qtype = ranked_candidates[0][0] if ranked_candidates else "general"
        non_target = any(token in hint for token in META_EXCLUDE_HINTS)
        status = classify_lesson_status(counts, non_target=non_target)
        current_gap_layers = list(lesson_backlog_missing_layers(counts))
        closure_bucket = classify_lesson_closure_bucket(
            teacher,
            course,
            lesson_title,
            status,
            counts,
            has_primary_layers,
        )
        closure_note = lesson_closure_note(closure_bucket, tuple(current_gap_layers))
        document_refs = [*document_refs_by_qtype.get(primary_qtype, [])][:6]
        lessons.append(
            {
                "teacher": teacher,
                "course": course,
                "lesson_title": lesson_title,
                "source_refs": list(row["source_refs"])[:12],
                "clip_count": int(row["clip_count"]),
                "keyframe_refs": list(row["keyframe_refs"])[:8],
                "document_refs": document_refs,
                "question_type_candidates": [
                    {"question_type": qtype, "count": count}
                    for qtype, count in ranked_candidates[:4]
                ],
                "primary_question_type": primary_qtype,
                "counts": counts,
                "has_primary_layers": has_primary_layers,
                "entered_knowledge": has_primary_layers or counts["notes"] > 0,
                "status": status,
                "status_label": lesson_status_label(status),
                "current_gap_layers": current_gap_layers,
                "closure_bucket": closure_bucket,
                "closure_note": closure_note,
                "is_primary_teacher": teacher == PRIMARY_TEACHER,
                "sample_titles": {
                    "rules": list(row["rule_titles"])[:4],
                    "cases": list(row["case_titles"])[:4],
                    "patterns": list(row["pattern_titles"])[:4],
                    "notes": list(row["note_titles"])[:4],
                    "conflicts": list(row["conflict_titles"])[:4],
                },
            }
        )

    payload = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "primary_teacher": PRIMARY_TEACHER,
        "lessons": lessons,
    }
    write_json(LESSON_INDEX_PATH, payload)
    return payload


def build_video_coverage_report(
    lesson_index: dict,
) -> None:
    lessons = list(lesson_index.get("lessons", []))
    partial_lessons = [row for row in lessons if row.get("status") == "partial_chain"]
    uncovered_lessons = [row for row in partial_lessons if not row.get("has_primary_layers")]
    backlog_candidates = [
        row
        for row in partial_lessons
        if row.get("teacher") == PRIMARY_TEACHER
        and row.get("has_primary_layers")
        and row.get("closure_bucket") == "micro_tune"
    ]
    foundation_theory_lessons = [
        row
        for row in partial_lessons
        if row.get("teacher") == PRIMARY_TEACHER
        and row.get("has_primary_layers")
        and row.get("closure_bucket") == "foundation_theory"
    ]
    zhongbo_uncovered = [
        row
        for row in partial_lessons
        if row.get("teacher") == PRIMARY_TEACHER and not row.get("has_primary_layers")
    ]

    lines = [
        "# QiMen Video Coverage Report",
        "",
        f"- built_at: {lesson_index.get('updated_at')}",
        f"- total_video_lessons: {len(lessons)}",
        f"- total_video_segments: {sum(int(item.get('clip_count', 0)) for item in lessons)}",
        f"- with_rules: {sum(1 for row in lessons if int(row.get('counts', {}).get('rules', 0)) > 0)}",
        f"- with_cases: {sum(1 for row in lessons if int(row.get('counts', {}).get('cases', 0)) > 0)}",
        f"- with_patterns: {sum(1 for row in lessons if int(row.get('counts', {}).get('patterns', 0)) > 0)}",
        f"- with_notes: {sum(1 for row in lessons if int(row.get('counts', {}).get('notes', 0)) > 0)}",
        f"- with_conflicts: {sum(1 for row in lessons if int(row.get('counts', {}).get('conflicts', 0)) > 0)}",
        f"- full_chain: {sum(1 for row in lessons if row.get('status') == 'full_chain')}",
        f"- strong_chain: {sum(1 for row in lessons if row.get('status') == 'strong_chain')}",
        f"- partial_chain: {len(partial_lessons)}",
        f"- reference_only: {sum(1 for row in lessons if row.get('status') == 'reference_only')}",
        f"- non_target: {sum(1 for row in lessons if row.get('status') == 'non_target')}",
        f"- zhongbo_backlog: {len(backlog_candidates)}",
        f"- zhongbo_foundation_theory: {len(foundation_theory_lessons)}",
        f"- uncovered: {len(uncovered_lessons)}",
        f"- zhongbo_uncovered: {len(zhongbo_uncovered)}",
        "",
        "## Per Lesson",
        "",
    ]

    backlog_lines: list[str] = ["## 钟波 Lesson Backlog", ""]
    theory_tail_lines: list[str] = ["## 钟波 理论基础课", ""]
    uncovered_lines: list[str] = ["## 钟波 尚未进入知识卡", ""]

    for row in sorted(lessons, key=lambda item: (str(item.get("teacher", "")), str(item.get("course", "")), str(item.get("lesson_title", "")))):
        counts = row.get("counts", {})
        rule_titles = row.get("sample_titles", {}).get("rules", [])
        case_titles = row.get("sample_titles", {}).get("cases", [])
        pattern_titles = row.get("sample_titles", {}).get("patterns", [])
        note_titles = row.get("sample_titles", {}).get("notes", [])
        conflict_titles = row.get("sample_titles", {}).get("conflicts", [])
        status = lesson_status_label(str(row.get("status") or "partial_chain"))
        missing_layers = list(row.get("current_gap_layers", []))
        source_refs = row.get("source_refs", [])
        lines.extend(
            [
                f"### {row['teacher']} / {row['lesson_title']}",
                f"- course: {row['course']}",
                f"- clip_count: {row['clip_count']}",
                f"- source_ref: {source_refs[0] if source_refs else '—'}",
                f"- status: {row.get('status')}",
                f"- status_label: {status}",
                f"- rules: {counts.get('rules', 0)}",
                f"- cases: {counts.get('cases', 0)}",
                f"- patterns: {counts.get('patterns', 0)}",
                f"- notes: {counts.get('notes', 0)}",
                f"- conflicts: {counts.get('conflicts', 0)}",
                f"- current_gap: {'、'.join(chain_layer_label(layer) for layer in missing_layers) if missing_layers else '无'}",
            ]
        )
        if row.get("closure_bucket") and row.get("closure_bucket") != "none":
            lines.append(f"- closure_bucket: {row.get('closure_bucket')}")
        if row.get("closure_note"):
            lines.append(f"- closure_note: {row.get('closure_note')}")
        if rule_titles:
            lines.append(f"- rule_titles: {'；'.join(rule_titles[:4])}")
        if case_titles:
            lines.append(f"- case_titles: {'；'.join(case_titles[:4])}")
        if pattern_titles:
            lines.append(f"- pattern_titles: {'；'.join(pattern_titles[:4])}")
        if note_titles:
            lines.append(f"- note_titles: {'；'.join(note_titles[:4])}")
        if conflict_titles:
            lines.append(f"- conflict_titles: {'；'.join(conflict_titles[:4])}")
        lines.append("")

    def backlog_rank(row: dict) -> tuple[int, int, int, int, str]:
        counts = row.get("counts", {})
        missing_layers = tuple(row.get("current_gap_layers", []))
        rule_count = int(counts.get("rules", 0))
        pattern_count = int(counts.get("patterns", 0))
        conflict_count = int(counts.get("conflicts", 0))
        title = str(row.get("lesson_title") or "")
        lesson_score = lesson_backlog_priority(
            title,
            tuple(missing_layers),
            {
                "rules": rule_count,
                "cases": int(counts.get("cases", 0)),
                "patterns": pattern_count,
                "notes": int(counts.get("notes", 0)),
                "conflicts": conflict_count,
            },
        )
        return (
            -lesson_score,
            0 if pattern_count and (rule_count == 0 or conflict_count == 0) else 1,
            0 if rule_count and (pattern_count == 0 or conflict_count == 0) else 1,
            0 if any(marker in title for marker in ["案例", "判断逻辑", "带学", "直播"]) else 1,
            title,
        )

    for row in sorted(backlog_candidates, key=backlog_rank):
        source_refs = row.get("source_refs", [])
        counts = row.get("counts", {})
        missing_layers = list(row.get("current_gap_layers", []))
        backlog_lines.extend(
            [
                f"### {row['lesson_title']}",
                f"- course: {row['course']}",
                f"- rules: {counts.get('rules', 0)}",
                f"- cases: {counts.get('cases', 0)}",
                f"- patterns: {counts.get('patterns', 0)}",
                f"- notes: {counts.get('notes', 0)}",
                f"- conflicts: {counts.get('conflicts', 0)}",
                f"- current_gap: {'、'.join(chain_layer_label(layer) for layer in missing_layers) if missing_layers else '无'}",
                f"- closure_note: {row.get('closure_note') or '仍可自然补齐缺层，建议继续低风险升链。'}",
                f"- source_ref: {source_refs[0] if source_refs else '—'}",
                "",
            ]
        )

    for row in sorted(foundation_theory_lessons, key=lambda item: (str(item.get("course", "")), str(item.get("lesson_title", "")))):
        source_refs = row.get("source_refs", [])
        counts = row.get("counts", {})
        missing_layers = list(row.get("current_gap_layers", []))
        theory_tail_lines.extend(
            [
                f"### {row['lesson_title']}",
                f"- course: {row['course']}",
                f"- rules: {counts.get('rules', 0)}",
                f"- cases: {counts.get('cases', 0)}",
                f"- patterns: {counts.get('patterns', 0)}",
                f"- notes: {counts.get('notes', 0)}",
                f"- conflicts: {counts.get('conflicts', 0)}",
                f"- current_gap: {'、'.join(chain_layer_label(layer) for layer in missing_layers) if missing_layers else '无'}",
                f"- closure_note: {row.get('closure_note') or '理论基础课，作为规则与路径的底层知识保留。'}",
                f"- source_ref: {source_refs[0] if source_refs else '—'}",
                "",
            ]
        )

    for row in sorted(zhongbo_uncovered, key=lambda item: (str(item.get("course", "")), str(item.get("lesson_title", "")))):
        source_refs = row.get("source_refs", [])
        uncovered_lines.extend(
            [
                f"### {row['lesson_title']}",
                f"- course: {row['course']}",
                f"- clip_count: {row.get('clip_count', 0)}",
                f"- source_ref: {source_refs[0] if source_refs else '—'}",
                f"- current_gap: {'、'.join(chain_layer_label(layer) for layer in row.get('current_gap_layers', [])) if row.get('current_gap_layers') else '规则、案例、路径、冲突'}",
                "",
            ]
        )

    lines.extend(backlog_lines)
    lines.extend(theory_tail_lines)
    lines.extend(uncovered_lines)

    VIDEO_COVERAGE_REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def generate_rule_cards(
    sources: Iterable[SourceDocument],
    segment_index: dict[tuple[str, str, str], list[SegmentEvidence]],
) -> list[dict]:
    cards: list[dict] = []
    seen: set[str] = set()
    tier_counters = {"core": Counter(), "support": Counter(), "reference": Counter()}
    lesson_counters: Counter[tuple[str, str]] = Counter()
    secondary_teacher_seeded: set[tuple[str, str]] = set()
    for source in sorted(list(sources), key=lambda item: source_gap_priority("rule", item)):
        source_text = source.text or ""
        fallback_text = document_title_fallback_text(source)
        effective_text = normalize_text(f"{source_text} {fallback_text}")
        if not effective_text:
            continue
        candidate_source = dataclasses.replace(source, text=effective_text)
        allow_secondary_lesson_fallback = (
            source.source_type == "video_segment"
            and source.teacher != PRIMARY_TEACHER
            and source.primary_question_type != "general"
            and is_secondary_teacher_support_lesson(source.lesson_or_title, source.course_or_book)
        )
        if not is_reasoning_candidate(candidate_source) and not fallback_text and not allow_secondary_lesson_fallback:
            continue
        question_type = resolve_source_question_type(source, effective_text, f"{source.course_or_book} {source.lesson_or_title}")
        if question_type == "general" and fallback_text:
            question_type = document_title_fallback_question_type(source)
        if question_type == "general" and allow_secondary_lesson_fallback:
            question_type = source.primary_question_type
        if question_type == "general":
            continue
        sentence_pool = split_sentences(source_text) if source_text else []
        if not sentence_pool and fallback_text:
            sentence_pool = [fallback_text]
        title_rule_fallback = ""
        if (
            source.source_type == "video_segment"
            and (
                (
                    source.teacher == PRIMARY_TEACHER
                    and ("rules" in set(source.backlog_missing_layers) or is_title_driven_batch_lesson(source.lesson_or_title))
                )
                or (
                    source.teacher != PRIMARY_TEACHER
                    and is_secondary_teacher_support_lesson(source.lesson_or_title, source.course_or_book)
                )
            )
        ):
            title_rule_fallback = build_video_lesson_rule_fallback(question_type, source.lesson_or_title)
            if title_rule_fallback:
                sentence_pool = [title_rule_fallback, *sentence_pool]
        if source.source_type == "document" and document_title_should_seed_rule(source):
            sentence_pool = [fallback_text or source.lesson_or_title, *sentence_pool]
        for sentence in sentence_pool:
            if not sentence_quality_ok(sentence):
                if sentence != fallback_text:
                    continue
            if not sentence_is_reasoning(sentence):
                if sentence != fallback_text and not (
                    source.source_type == "video_segment"
                    and (
                        "rules" in set(source.backlog_missing_layers)
                        or is_title_driven_batch_lesson(source.lesson_or_title)
                        or (
                            source.teacher != PRIMARY_TEACHER
                            and is_secondary_teacher_support_lesson(source.lesson_or_title, source.course_or_book)
                        )
                    )
                    and any(marker in sentence for marker in RULE_MARKERS + STRONG_REASONING_TERMS)
                ):
                    continue
            normalized = re.sub(r"[，。、“”‘’：:；;！？!? ]+", "", sentence)
            if len(normalized) < 16:
                continue
            key = (
                f"{question_type}:{source.lesson_or_title}:{normalized}"
                if source.source_type == "video_segment"
                else f"{question_type}:{normalized}"
            )
            if key in seen:
                continue
            lesson_key = (question_type, source.lesson_or_title)
            if source.source_type == "video_segment" and lesson_counters[lesson_key] >= MAX_VIDEO_RULES_PER_LESSON:
                continue
            seen.add(key)
            terms = extract_terms(sentence)
            support_tags = infer_support_tags(question_type, sentence, source.lesson_or_title)
            confidence = infer_confidence(sentence, source.source_type, source.teacher)
            if sentence == title_rule_fallback:
                confidence = min(confidence, 0.78)
            knowledge_tier = infer_knowledge_tier(
                "rule",
                question_type,
                source.source_type,
                source.teacher or PRIMARY_TEACHER,
                confidence,
                sentence,
            )
            if source.source_type == "video_segment":
                teacher_name = source.teacher or PRIMARY_TEACHER
                seed_key = (teacher_name, question_type)
                if teacher_name != PRIMARY_TEACHER and seed_key not in secondary_teacher_seeded:
                    knowledge_tier = "support"
                    secondary_teacher_seeded.add(seed_key)
                else:
                    next_tier = apply_video_tier_caps("rule", question_type, knowledge_tier, tier_counters)
                    if not next_tier:
                        continue
                    knowledge_tier = next_tier
                    tier_counters[knowledge_tier][question_type] += 1
                lesson_counters[lesson_key] += 1
            cards.append(
                {
                    "id": f"qimen-rule-{question_type}-{short_hash(source.source_ref, normalized)}",
                    "title": derive_rule_title(question_type, sentence, source.lesson_or_title),
                    "question_type": question_type,
                    "source_type": source.source_type,
                    "source_teacher": source.teacher or PRIMARY_TEACHER,
                    "source_course_or_book": source.course_or_book,
                    "source_lesson_title": source.lesson_or_title,
                    "source_ref": source.source_ref,
                    "evidence_refs": build_evidence_refs(source, segment_index, sentence),
                    "teacher_priority": teacher_priority(source.teacher),
                    "confidence": confidence,
                    "knowledge_tier": knowledge_tier,
                    "trigger_terms": terms,
                    "rule_text": build_rule_summary(question_type, sentence),
                    "applicability": QUESTION_TYPES[question_type]["yongshen_focus"],
                    "boundary_note": "文字资料用于定名和补边，视频语料用于保留老师的动态判断顺序。",
                    "tags": sorted(set([question_type, *terms[:4], *support_tags])),
                }
            )
    return cards


def generate_case_cards(
    sources: Iterable[SourceDocument],
    segment_index: dict[tuple[str, str, str], list[SegmentEvidence]],
) -> list[dict]:
    cards: list[dict] = []
    seen: set[str] = set()
    tier_counters = {"core": Counter(), "support": Counter(), "reference": Counter()}
    secondary_teacher_seeded: set[tuple[str, str]] = set()
    per_type_document = Counter()
    per_source_document = Counter()
    source_list = list(sources)
    source_list.sort(
        key=lambda item: (
            *source_gap_priority("case", item),
            document_priority(item) if item.source_type == "document" else (9, 0, 0, item.lesson_or_title),
        )
    )
    for source in source_list:
        allow_secondary_case_fallback = (
            source.source_type == "video_segment"
            and source.teacher != PRIMARY_TEACHER
            and source.primary_question_type != "general"
            and (
                "cases" in set(source.backlog_missing_layers)
                or is_secondary_teacher_case_lesson(source.lesson_or_title, source.course_or_book)
                or is_secondary_teacher_support_lesson(source.lesson_or_title, source.course_or_book)
            )
        )
        if not is_reasoning_candidate(source) and not allow_secondary_case_fallback:
            continue
        hint = f"{source.course_or_book} {source.lesson_or_title}"
        if (
            not any(marker in hint for marker in ["案例", "直播", "第", "三连问", "问答", "实战"])
            and not document_is_casebook(source)
            and not allow_secondary_case_fallback
        ):
            continue
        if source.source_type == "document":
            casebook_text = document_casebook_text(source)
            raw_blocks = split_document_case_blocks(casebook_text)
            raw_sentences = [s for s in split_sentences(casebook_text) if sentence_quality_ok(s)]
            candidate_blocks = raw_blocks or raw_sentences
        else:
            question_type = resolve_source_question_type(source, source.text, hint)
            if (
                question_type == "general"
                and source.source_type == "video_segment"
                and source.primary_question_type != "general"
                and (
                    "cases" in set(source.backlog_missing_layers)
                    or is_title_driven_batch_lesson(source.lesson_or_title)
                    or allow_secondary_case_fallback
                )
            ):
                question_type = source.primary_question_type
            if question_type == "general":
                continue
            if source.source_type == "video_segment" and "cases" not in set(source.backlog_missing_layers) and not any(marker in hint for marker in ["案例", "直播", "问", "反馈", "应验"]) and not is_title_driven_batch_lesson(source.lesson_or_title):
                continue
        if source.source_type == "document":
            for block in candidate_blocks:
                block_sentences = [s for s in split_sentences(block) if sentence_quality_ok(s)] or [block]
                block_type = detect_document_question_type(source, block_sentences)
                if block_type == "general":
                    continue
                if per_type_document[block_type] >= MAX_DOCUMENT_CASES_PER_QTYPE:
                    continue
                if per_source_document[source.source_ref] >= document_case_limit(source):
                    continue
                sentences = [
                    s
                    for s in block_sentences
                    if (
                        sentence_is_reasoning(s)
                        or any(marker in s for marker in CASE_MARKERS)
                        or any(marker in s for marker in QUESTION_CONTEXT_MARKERS)
                        or ("三连问" in source.lesson_or_title and any(marker in s for marker in ["门", "星", "神", "用神", "落宫", "象意", "为什么"]))
                    )
                ]
                if (
                    not sentences
                    and document_is_casebook(source)
                    and block_has_casebook_signal(block)
                    and block_type != "general"
                ):
                    case_fallback = build_case_summary(block_type, block_sentences[0], block_sentences[0])
                    reasoning_fallback = {
                        "career_work": "先定事业主线与资源兑现位，再看门星神与落宫关系，分辨事情能否真正落地。",
                        "love_relationship": "先定双方关系主线，再看门星神和落宫生克，判断关系能否继续推进。",
                        "money_wealth": "先定财路归属与兑现条件，再看门星神和落宫结构，判断收益能否落实。",
                        "health_energy": "先定病位与身体主线，再比旺衰和门星神，判断轻重、病程与恢复节奏。",
                    }.get(block_type, case_fallback)
                    sentences = [compress_reasoning_text(block_sentences[0]), compress_reasoning_text(reasoning_fallback), compress_reasoning_text(case_fallback)]
                if not sentences and "三连问" in source.lesson_or_title and any(
                    marker in block for marker in ["为什么", "能不能", "是否", "会不会", "结果", "反馈"]
                ):
                    sentences = [compress_reasoning_text(block)]
                if not sentences:
                    continue
                reasoning = next(
                    (
                        s for s in sentences
                        if any(marker in s for marker in ["用神", "落宫", "格局", "象意", "值符", "值使", "门", "星", "神"])
                    ),
                    compress_reasoning_text(block),
                )
                conclusion = next(
                    (
                        s for s in sentences
                        if any(marker in s for marker in ["结果", "反馈", "应验", "所以", "说明", "意味着", "能不能", "是否", "为什么"])
                    ),
                    compress_reasoning_text(block),
                )
                support_tags = infer_support_tags(block_type, sentences[0], reasoning, conclusion, source.lesson_or_title)
                question_anchor = re.sub(r'\\W+', '', sentences[0])[:80]
                section_title, section_anchor = extract_document_block_anchor(block)
                key = f"{source.source_ref}:{block_type}:{question_anchor}"
                if key in seen:
                    continue
                seen.add(key)
                per_type_document[block_type] += 1
                per_source_document[source.source_ref] += 1
                confidence = infer_confidence(reasoning + conclusion, source.source_type, source.teacher)
                cards.append(
                    {
                        "id": f"qimen-case-{block_type}-{short_hash(source.source_ref, reasoning, conclusion)}",
                        "title": derive_case_title(block_type, source.lesson_or_title, sentences[0]),
                        "question_type": block_type,
                        "source_type": source.source_type,
                        "source_teacher": source.teacher or PRIMARY_TEACHER,
                        "source_course_or_book": source.course_or_book,
                        "source_lesson_title": source.lesson_or_title,
                        "source_ref": source.source_ref,
                        "source_section_title": section_title,
                        "source_section_anchor": section_anchor,
                        "evidence_refs": build_evidence_refs(source, segment_index, reasoning),
                        "teacher_priority": teacher_priority(source.teacher),
                        "confidence": confidence,
                        "knowledge_tier": infer_knowledge_tier(
                            "case",
                            block_type,
                            source.source_type,
                            source.teacher or PRIMARY_TEACHER,
                            confidence,
                            f"{reasoning} {conclusion}",
                        ),
                        "question_summary": compress_reasoning_text(sentences[0]),
                        "plate_focus": "用神、落宫、门星神组合与应期线索",
                        "teacher_reasoning_steps": [compress_reasoning_text(reasoning)],
                        "teacher_conclusion": build_case_summary(block_type, sentences[0], conclusion),
                        "feedback_summary": build_case_summary(block_type, sentences[0], conclusion) if any(marker in conclusion for marker in ["结果", "反馈", "应验"]) else "",
                        "tags": sorted(set([block_type, *extract_terms(reasoning)[:4], *support_tags])),
                    }
                )
            continue
        else:
            title_case_fallback: tuple[str, str] | None = None
            if (
                source.source_type == "video_segment"
                and (
                    (
                        source.teacher == PRIMARY_TEACHER
                        and ("cases" in set(source.backlog_missing_layers) or is_title_driven_batch_lesson(source.lesson_or_title))
                    )
                    or allow_secondary_case_fallback
                )
            ):
                title_case_fallback = build_video_lesson_case_fallback(question_type, source.lesson_or_title)
            sentences = [
                s
                for s in split_sentences(source.text)
                if sentence_quality_ok(s) and (sentence_is_reasoning(s) or any(marker in s for marker in CASE_MARKERS))
            ]
            prefer_title_case_fallback = (
                bool(title_case_fallback)
                and source.teacher != PRIMARY_TEACHER
                and (
                    "cases" in set(source.backlog_missing_layers)
                    or allow_secondary_case_fallback
                )
            )
            has_case_shape = (
                any(any(marker in s for marker in CASE_MARKERS) for s in sentences)
                and any(
                    any(marker in s for marker in ["结果", "反馈", "应验", "所以", "说明", "意味着"])
                    for s in sentences
                )
            )
            if prefer_title_case_fallback and (not sentences or len(sentences) < 2 or not has_case_shape):
                sentences = [title_case_fallback[0], title_case_fallback[1]]
            if not sentences and title_case_fallback:
                sentences = [title_case_fallback[0], title_case_fallback[1]]
            elif not sentences and source.source_type == "video_segment" and (
                "cases" in set(source.backlog_missing_layers)
                or is_title_driven_batch_lesson(source.lesson_or_title)
                or allow_secondary_case_fallback
            ) and "问" in hint:
                sentences = [s for s in split_sentences(source.text) if sentence_quality_ok(s)][:3]
        if not sentences:
            continue
        reasoning = next((s for s in sentences if sentence_is_reasoning(s) and any(marker in s for marker in ["先看", "再看", "用神", "落宫", "格局", "象意"])), sentences[0])
        conclusion = next((s for s in sentences if any(marker in s for marker in ["结果", "反馈", "应验", "所以", "说明", "意味着"])), sentences[min(1, len(sentences) - 1)])
        support_tags = infer_support_tags(question_type, sentences[0], reasoning, conclusion, source.lesson_or_title)
        normalized_case = re.sub(r'\\W+', '', reasoning)[:60]
        key = (
            f"{source.teacher or PRIMARY_TEACHER}:{source.course_or_book}:{question_type}:{source.lesson_or_title}:{normalized_case}"
            if source.source_type == "video_segment"
            else f"{question_type}:{normalized_case}"
        )
        if key in seen:
            continue
        seen.add(key)
        if source.source_type == "document":
            per_type_document[question_type] += 1
        confidence = infer_confidence(reasoning + conclusion, source.source_type, source.teacher)
        knowledge_tier = infer_knowledge_tier(
            "case",
            question_type,
            source.source_type,
            source.teacher or PRIMARY_TEACHER,
            confidence,
            f"{reasoning} {conclusion}",
        )
        if source.source_type == "video_segment":
            teacher_name = source.teacher or PRIMARY_TEACHER
            seed_key = (teacher_name, question_type)
            only_missing_case = set(source.backlog_missing_layers) == {"cases"}
            if (
                teacher_name != PRIMARY_TEACHER
                and only_missing_case
                and allow_secondary_case_fallback
            ):
                knowledge_tier = "reference"
            elif (
                teacher_name != PRIMARY_TEACHER
                and seed_key not in secondary_teacher_seeded
                and allow_secondary_case_fallback
            ):
                knowledge_tier = "reference"
                secondary_teacher_seeded.add(seed_key)
            else:
                next_tier = apply_video_tier_caps("case", question_type, knowledge_tier, tier_counters)
                if not next_tier:
                    continue
                knowledge_tier = next_tier
                tier_counters[knowledge_tier][question_type] += 1
        cards.append(
            {
                "id": f"qimen-case-{question_type}-{short_hash(source.source_ref, reasoning, conclusion)}",
                "title": derive_case_title(question_type, source.lesson_or_title, sentences[0]),
                "question_type": question_type,
                "source_type": source.source_type,
                "source_teacher": source.teacher or PRIMARY_TEACHER,
                "source_course_or_book": source.course_or_book,
                "source_lesson_title": source.lesson_or_title,
                "source_ref": source.source_ref,
                "evidence_refs": build_evidence_refs(source, segment_index, reasoning),
                "teacher_priority": teacher_priority(source.teacher),
                "confidence": confidence,
                "knowledge_tier": knowledge_tier,
                "question_summary": sentences[0],
                "question_summary": compress_reasoning_text(sentences[0]),
                "plate_focus": "用神、落宫、门星神组合与应期线索",
                "teacher_reasoning_steps": [compress_reasoning_text(reasoning)],
                "teacher_conclusion": build_case_summary(question_type, sentences[0], conclusion),
                "feedback_summary": build_case_summary(question_type, sentences[0], conclusion) if any(marker in conclusion for marker in ["结果", "反馈", "应验"]) else "",
                "tags": sorted(set([question_type, *extract_terms(reasoning)[:4], *support_tags])),
            }
        )
    return cards


def fallback_pattern_steps(question_type: str) -> list[str]:
    if question_type == "career_work":
        return ["先定事业主线与取用神", "再看落宫与门星神组合", "再分辨结构是短波动还是长期断裂", "最后看应期和动作建议"]
    if question_type == "love_relationship":
        return ["先定双方与关系主线", "再看门星神和情感推进节奏", "再分辨关系是真推进还是情绪波动", "最后看时间窗口"]
    if question_type == "money_wealth":
        return ["先定财路与资源占有", "再看合作方和回款兑现", "再分辨是短期压力还是结构性漏损", "最后看风险控制和时机"]
    return ["先定病位与身体承载线", "再看门星神落点", "再分辨外在触发和内在耗损", "最后看恢复节奏与风险提醒"]


def is_title_driven_batch_lesson(lesson_title: str) -> bool:
    title = normalize_text(lesson_title)
    return any(
        marker in title
        for marker in [
            "_batch",
            "问",
            "能不能",
            "会不会",
            "是否",
            "怎么办",
            "判断逻辑",
            "投标",
            "离婚",
            "投资",
            "客户",
            "问病",
            "复合",
        ]
    )


def is_secondary_teacher_support_lesson(lesson_title: str, course_or_book: str) -> bool:
    hint = normalize_text(f"{course_or_book} {lesson_title}")
    return (
        any(marker in hint for marker in SECONDARY_TEACHER_HINTS)
        or any(marker in hint for marker in SECONDARY_TEACHER_COURSE_HINTS)
        or is_title_driven_batch_lesson(lesson_title)
    )


def is_secondary_teacher_case_lesson(lesson_title: str, course_or_book: str) -> bool:
    hint = normalize_text(f"{course_or_book} {lesson_title}")
    return any(
        marker in hint
        for marker in ["案例", "直播", "答疑", "判断", "判断逻辑", "三连问", "问", "实战", "占测", "感情占", "事业占", "财运占", "附录"]
    ) or is_title_driven_batch_lesson(lesson_title)


def build_video_lesson_rule_fallback(question_type: str, lesson_title: str) -> str:
    title = normalize_text(lesson_title)
    if question_type == "career_work":
        if any(marker in title for marker in ["投标", "项目", "客户", "岗位", "涨薪", "考学"]):
            return "事业题先定项目或岗位对应的用神与落宫，再看门星神、生克制化与结果兑现。"
        return "事业题先定用神与落宫，再看门星神和推进条件，最后看结果兑现。"
    if question_type == "love_relationship":
        if any(marker in title for marker in ["离婚", "复合", "对象", "婚恋", "感情"]):
            return "感情题先定双方关系用神，再看门星神、合冲进退和关系是否持续。"
        return "感情题先定双方与关系主线，再看门星神和推进节奏。"
    if question_type == "money_wealth":
        if any(marker in title for marker in ["投资", "回款", "客户", "合作", "财运"]):
            return "财运题先定财路与回款主线，再看合作方、资源落宫和兑现节奏。"
        return "财运题先定财路用神，再看资源占有和兑现时机。"
    if any(marker in title for marker in ["问病", "病", "恢复", "手术", "身体", "健康"]):
        return "健康题先定病位与用神，再看门星神、旺衰和恢复风险。"
    return "健康题先定病位与身体承载线，再看门星神和恢复节奏。"


def build_video_lesson_case_fallback(question_type: str, lesson_title: str) -> tuple[str, str]:
    title = normalize_text(lesson_title)
    if question_type == "career_work":
        if any(marker in title for marker in ["投标", "项目"]):
            return (
                "求测项目或投标结果是否能真正中标落地。",
                "这类事业案例先定项目用神与落宫，再判断甲方态度、竞争关系和中标条件是否成立。",
            )
        if any(marker in title for marker in ["考学", "岗位", "工作", "涨薪"]):
            return (
                "求测当前工作或岗位结果能否顺利推进。",
                "这类事业案例先分清决策权与主线，再判断岗位、机会和兑现节奏。",
            )
        return (
            "求测事业主线是否能推进并兑现结果。",
            "事业案例先定主线与用神，再判断推进条件和最终落地结果。",
        )
    if question_type == "love_relationship":
        if any(marker in title for marker in ["离婚", "婚姻"]):
            return (
                "求测婚姻关系是否会继续、分开或走向离婚。",
                "感情案例先定双方关系主线，再判断关系是真分开、可修复还是只是情绪波动。",
            )
        if any(marker in title for marker in ["复合", "对象", "感情", "婚恋"]):
            return (
                "求测双方感情关系是否能继续推进或重新靠近。",
                "感情案例先定双方与关系用神，再判断推进节奏和结果走向。",
            )
        return (
            "求测当前感情关系会如何发展。",
            "感情案例先定双方关系主线，再判断是否有真实推进条件。",
        )
    if question_type == "money_wealth":
        if any(marker in title for marker in ["投资", "回款", "客户", "合作"]):
            return (
                "求测投资、合作或客户选择最终是否能兑现收益。",
                "财运案例先定财路和资源归属，再判断回款、合作和兑现节奏。",
            )
        return (
            "求测当前财路能否真正转成可兑现结果。",
            "财运案例先守住财路主线，再判断合作和收益是否能落地。",
        )
    return (
        "求测当前身体问题会如何发展和恢复。",
        "健康案例先定病位与轻重，再判断恢复节奏和处理风险。",
    )


def build_video_lesson_conflict_fallback(question_type: str, lesson_title: str) -> str:
    title = normalize_text(lesson_title)
    if question_type == "career_work":
        return "事业题信号冲突时，先定主线条件是否成立，再分竞争、决策权和兑现时机。"
    if question_type == "love_relationship":
        return "感情题信号冲突时，先分真假推进与情绪波动，再看关系是否有持续性。"
    if question_type == "money_wealth":
        return "财运题信号冲突时，先分财路是否成立，再看回款、合作和风险优先级。"
    return "健康题信号冲突时，先分病位主线是否成立，再看短期波动和恢复风险。"


def derive_pattern_steps(source: SourceDocument, question_type: str) -> list[str]:
    candidates: list[str] = []
    for sentence in split_sentences(source.text):
        if not sentence_quality_ok(sentence):
            continue
        if any(marker in sentence for marker in PATTERN_MARKERS) or (
            sentence_is_reasoning(sentence)
            and any(marker in sentence for marker in ["取用神", "先定", "落宫", "最后看", "再看", "先看"])
        ):
            summarized = compress_reasoning_text(sentence)
            if summarized and summarized not in candidates:
                candidates.append(summarized)
        if len(candidates) >= 4:
            break
    if len(candidates) < 3:
        for step in fallback_pattern_steps(question_type):
            if step not in candidates:
                candidates.append(step)
            if len(candidates) >= 4:
                break
    return candidates[:4]


def lesson_should_emit_pattern(source: SourceDocument, question_type: str) -> bool:
    lesson_hint = f"{source.course_or_book} {source.lesson_or_title}"
    missing = set(source.backlog_missing_layers)
    has_case_signal = any(marker in lesson_hint for marker in ["案例", "判断", "判断逻辑", "答疑", "圈课", "直播课", "问", "反馈", "应验", "投标", "婚姻", "事业", "财运", "健康", "病"])
    has_generic_theory_hint = any(marker in lesson_hint for marker in GENERIC_THEORY_HINTS)
    if has_case_signal:
        return True
    if source.teacher == PRIMARY_TEACHER and source.primary_question_type != "general" and "patterns" in missing and source.backlog_priority >= 60:
        return True
    if source.teacher != PRIMARY_TEACHER and source.primary_question_type != "general" and "patterns" in missing and source.backlog_priority >= 40:
        return True
    if source.teacher != PRIMARY_TEACHER and is_secondary_teacher_support_lesson(source.lesson_or_title, source.course_or_book):
        return True
    if "patterns" in missing and ("rules" not in missing or "conflicts" not in missing):
        return True
    if source.backlog_priority >= 170:
        return True
    if has_generic_theory_hint and missing.issuperset({"rules", "cases", "conflicts"}):
        return False
    return question_type != "general" and not has_generic_theory_hint


def generate_reasoning_patterns(
    sources: Iterable[SourceDocument],
    segment_index: dict[tuple[str, str, str], list[SegmentEvidence]],
) -> list[dict]:
    patterns: list[dict] = []
    seen: set[str] = set()
    tier_counters = {"core": Counter(), "support": Counter(), "reference": Counter()}
    secondary_teacher_seeded: set[tuple[str, str]] = set()
    for source in sorted(sources, key=lambda item: source_gap_priority("pattern", item)):
        if source.source_type != "video_segment":
            continue
        allow_secondary_lesson_fallback = (
            source.teacher != PRIMARY_TEACHER
            and source.primary_question_type != "general"
            and is_secondary_teacher_support_lesson(source.lesson_or_title, source.course_or_book)
        )
        if not is_reasoning_candidate(source) and not allow_secondary_lesson_fallback:
            continue
        question_type = resolve_source_question_type(source, source.text, f"{source.course_or_book} {source.lesson_or_title}")
        if question_type == "general" and allow_secondary_lesson_fallback:
            question_type = source.primary_question_type
        if question_type == "general":
            continue
        if not lesson_should_emit_pattern(source, question_type):
            continue
        steps = derive_pattern_steps(source, question_type)
        if not steps:
            continue
        key = f"{source.teacher}:{question_type}:{source.lesson_or_title}"
        if key in seen:
            continue
        seen.add(key)
        evidence_refs = build_evidence_refs(source, segment_index, " ".join(steps))
        confidence = 0.88 if source.teacher == PRIMARY_TEACHER else 0.73
        knowledge_tier = infer_knowledge_tier(
            "pattern",
            question_type,
            "hybrid",
            source.teacher,
            confidence,
            " ".join(steps),
        )
        seed_key = (source.teacher, question_type)
        if source.teacher != PRIMARY_TEACHER and seed_key not in secondary_teacher_seeded:
            knowledge_tier = "support"
            secondary_teacher_seeded.add(seed_key)
        else:
            next_tier = apply_video_tier_caps("pattern", question_type, knowledge_tier, tier_counters)
            if not next_tier:
                continue
            knowledge_tier = next_tier
            tier_counters[knowledge_tier][question_type] += 1
        patterns.append(
            {
                "id": f"qimen-pattern-{question_type}-{short_hash(source.teacher, source.lesson_or_title, question_type)}",
                "title": f"{source.teacher} / {source.lesson_or_title} / {QUESTION_TYPES[question_type]['label']} 推理路径",
                "question_type": question_type,
                "source_type": "hybrid",
                "source_teacher": source.teacher,
                "source_course_or_book": source.course_or_book,
                "source_lesson_title": source.lesson_or_title,
                "source_ref": source.source_ref,
                "evidence_refs": evidence_refs,
                "teacher_priority": teacher_priority(source.teacher),
                "confidence": confidence,
                "knowledge_tier": knowledge_tier,
                "steps": steps,
                "decision_rules": [
                    "先定题型和取用神，再看门星神，最后处理冲突信号和应期。",
                    "若多个信号冲突，先保留主老师的视频路径，再用文字资料做边界校准。",
                ],
                "notes": "第一版为主老师优先路径，后续再吸收其他老师的反例和补边。",
                "tags": sorted(set([question_type, *infer_support_tags(question_type, " ".join(steps), source.lesson_or_title)])),
            }
        )
    return patterns


def generate_term_notes(
    transcript_sources: Iterable[SourceDocument],
    document_sources: Iterable[SourceDocument],
    segment_index: dict[tuple[str, str, str], list[SegmentEvidence]],
) -> list[dict]:
    notes: list[dict] = []
    seen: set[str] = set()
    all_sources = list(document_sources) + list(transcript_sources)
    for term in TERM_KEYWORDS:
        for source in all_sources:
            if len(notes) >= MAX_TERM_NOTES:
                return notes
            source_text = source.text or ""
            fallback_text = document_title_fallback_text(source)
            effective_text = normalize_text(f"{source_text} {fallback_text}")
            candidate_source = dataclasses.replace(source, text=effective_text)
            if not is_reasoning_candidate(candidate_source) and not fallback_text:
                continue
            if term not in effective_text:
                continue
            sentence = next((s for s in split_sentences(source_text) if term in s), "")
            if not sentence and term in fallback_text:
                sentence = fallback_text
            if not sentence:
                continue
            key = f"{term}:{source.source_ref}" if source.source_type == "document" else f"{term}:{source.source_type}"
            if key in seen:
                continue
            seen.add(key)
            confidence = infer_confidence(sentence, source.source_type, source.teacher)
            notes.append(
                {
                    "id": f"qimen-term-{short_hash(term, source.source_ref)}",
                    "title": term,
                    "question_type": "general",
                    "source_type": source.source_type,
                    "source_teacher": source.teacher or PRIMARY_TEACHER,
                    "source_course_or_book": source.course_or_book,
                    "source_lesson_title": source.lesson_or_title,
                    "source_ref": source.source_ref,
                    "evidence_refs": build_evidence_refs(source, segment_index, sentence),
                    "teacher_priority": teacher_priority(source.teacher),
                    "confidence": confidence,
                    "knowledge_tier": infer_knowledge_tier(
                        "term",
                        "general",
                        source.source_type,
                        source.teacher or PRIMARY_TEACHER,
                        confidence,
                        sentence,
                    ),
                    "term": term,
                    "normalized_term": term,
                    "aliases": [],
                    "term_note": compress_reasoning_text(sentence),
                    "usage_note": "视频用于保留老师的口语用法，文档用于稳定术语写法。",
                    "tags": sorted(set(["general", *infer_support_tags("general", sentence, term)])),
                }
            )
            break
    return notes


def generate_conflict_cards(
    transcript_sources: Iterable[SourceDocument],
    document_sources: Iterable[SourceDocument],
    segment_index: dict[tuple[str, str, str], list[SegmentEvidence]],
) -> list[dict]:
    cards: list[dict] = []
    seen: set[str] = set()
    tier_counters = {"core": Counter(), "support": Counter(), "reference": Counter()}
    lesson_counters: Counter[tuple[str, str]] = Counter()
    secondary_teacher_seeded: set[tuple[str, str]] = set()
    per_type_document = Counter()
    per_source_document = Counter()
    sources = sorted(list(transcript_sources), key=lambda item: source_gap_priority("conflict", item)) + sorted(list(document_sources), key=document_priority)
    for source in sources:
        if not source.text or not is_reasoning_candidate(source):
            continue
        if source.source_type == "document":
            raw_blocks = split_document_case_blocks(source.text)
            raw_sentences = [s for s in split_sentences(source.text) if sentence_quality_ok(s)]
            candidate_blocks = raw_blocks or raw_sentences
        else:
            question_type = resolve_source_question_type(source, source.text, f"{source.course_or_book} {source.lesson_or_title}")
            if question_type == "general":
                continue
            sentence_pool = split_sentences(source.text)
            title_conflict_fallback = ""
            if (
                source.source_type == "video_segment"
                and (
                    (
                        source.teacher == PRIMARY_TEACHER
                        and ("conflicts" in set(source.backlog_missing_layers) or is_title_driven_batch_lesson(source.lesson_or_title))
                    )
                    or (
                        source.teacher != PRIMARY_TEACHER
                        and is_secondary_teacher_support_lesson(source.lesson_or_title, source.course_or_book)
                    )
                )
            ):
                title_conflict_fallback = build_video_lesson_conflict_fallback(question_type, source.lesson_or_title)
                if title_conflict_fallback:
                    sentence_pool = [title_conflict_fallback, *sentence_pool]
        if source.source_type == "document":
            for block in candidate_blocks:
                block_sentences = [s for s in split_sentences(block) if sentence_quality_ok(s)] or [block]
                block_type = detect_document_question_type(source, block_sentences)
                if block_type == "general":
                    continue
                if per_type_document[block_type] >= MAX_DOCUMENT_CONFLICTS_PER_QTYPE:
                    continue
                if per_source_document[source.source_ref] >= document_conflict_limit(source):
                    continue
                block_summary = compress_reasoning_text(block)
                if not document_block_is_conflict_candidate(block_summary, source.lesson_or_title):
                    continue
                section_title, section_anchor = extract_document_block_anchor(block)
                question_anchor = re.sub(r'\\W+', '', block_sentences[0])[:80]
                key = f"{source.source_ref}:{block_type}:{question_anchor}"
                if key in seen:
                    continue
                seen.add(key)
                per_type_document[block_type] += 1
                per_source_document[source.source_ref] += 1
                confidence = infer_confidence(block_summary, source.source_type, source.teacher)
                cards.append(
                    {
                        "id": f"qimen-conflict-{block_type}-{short_hash(source.source_ref, block_summary)}",
                        "title": derive_conflict_title(block_type, block_summary, source.lesson_or_title),
                        "question_type": block_type,
                        "source_type": source.source_type,
                        "source_teacher": source.teacher or PRIMARY_TEACHER,
                        "source_course_or_book": source.course_or_book,
                        "source_lesson_title": source.lesson_or_title,
                        "source_ref": source.source_ref,
                        "source_section_title": section_title,
                        "source_section_anchor": section_anchor,
                        "evidence_refs": build_evidence_refs(source, segment_index, block_summary),
                        "teacher_priority": teacher_priority(source.teacher),
                        "confidence": confidence,
                        "knowledge_tier": infer_knowledge_tier(
                            "conflict",
                            block_type,
                            source.source_type,
                            source.teacher or PRIMARY_TEACHER,
                            confidence,
                            block_summary,
                        ),
                        "conflict_rule": build_conflict_summary(block_type, block_summary),
                        "resolution_note": "多个信号冲突时，优先保留主老师视频里的主路径，再用文档边界说明做降权。",
                        "tags": sorted(set([block_type, *extract_terms(block_summary)[:4], *infer_support_tags(block_type, block_summary)])),
                    }
                )
            continue
        for sentence in sentence_pool:
            if not sentence_quality_ok(sentence):
                continue
            has_conflict_signal = any(marker in sentence for marker in CONFLICT_MARKERS)
            if not has_conflict_signal and not (
                source.source_type == "video_segment"
                and (
                    "conflicts" in set(source.backlog_missing_layers)
                    or is_title_driven_batch_lesson(source.lesson_or_title)
                    or (
                        source.teacher != PRIMARY_TEACHER
                        and is_secondary_teacher_support_lesson(source.lesson_or_title, source.course_or_book)
                    )
                )
                and (sentence == title_conflict_fallback or any(marker in sentence for marker in ["为什么这么断", "能不能", "会不会", "是否", "如果", "分情况", "优先"]))
            ):
                continue
            if not sentence_is_reasoning(sentence):
                continue
            if len(sentence) < 18:
                continue
            normalized_conflict = re.sub(r'\\W+', '', sentence)[:64]
            key = (
                f"{question_type}:{source.lesson_or_title}:{normalized_conflict}"
                if source.source_type == "video_segment"
                else f"{question_type}:{normalized_conflict}"
            )
            if key in seen:
                continue
            lesson_key = (question_type, source.lesson_or_title)
            if source.source_type == "video_segment" and lesson_counters[lesson_key] >= MAX_VIDEO_CONFLICTS_PER_LESSON:
                continue
            seen.add(key)
            if source.source_type == "document":
                per_type_document[question_type] += 1
            else:
                confidence = infer_confidence(sentence, source.source_type, source.teacher)
                if sentence == title_conflict_fallback:
                    confidence = min(confidence, 0.76)
                knowledge_tier = infer_knowledge_tier(
                    "conflict",
                    question_type,
                    source.source_type,
                    source.teacher or PRIMARY_TEACHER,
                    confidence,
                    sentence,
                )
                if source.source_type == "video_segment":
                    teacher_name = source.teacher or PRIMARY_TEACHER
                    seed_key = (teacher_name, question_type)
                    if teacher_name != PRIMARY_TEACHER and seed_key not in secondary_teacher_seeded:
                        knowledge_tier = "support"
                        secondary_teacher_seeded.add(seed_key)
                    else:
                        next_tier = apply_video_tier_caps("conflict", question_type, knowledge_tier, tier_counters)
                        if not next_tier:
                            continue
                        knowledge_tier = next_tier
                        tier_counters[knowledge_tier][question_type] += 1
                    lesson_counters[lesson_key] += 1
                cards.append(
                    {
                    "id": f"qimen-conflict-{question_type}-{short_hash(source.source_ref, sentence)}",
                    "title": derive_conflict_title(question_type, sentence, source.lesson_or_title),
                    "question_type": question_type,
                    "source_type": source.source_type,
                    "source_teacher": source.teacher or PRIMARY_TEACHER,
                    "source_course_or_book": source.course_or_book,
                    "source_lesson_title": source.lesson_or_title,
                    "source_ref": source.source_ref,
                    "evidence_refs": build_evidence_refs(source, segment_index, sentence),
                    "teacher_priority": teacher_priority(source.teacher),
                    "confidence": confidence,
                        "knowledge_tier": knowledge_tier,
                    "conflict_rule": build_conflict_summary(question_type, sentence),
                    "resolution_note": "多个信号冲突时，优先保留主老师视频里的主路径，再用文档边界说明做降权。",
                    "tags": sorted(set([question_type, *extract_terms(sentence)[:4], *infer_support_tags(question_type, sentence)])),
                }
            )
    return cards


def generate_document_section_patterns(source: SourceDocument, sections: list[DocumentSection]) -> list[dict]:
    patterns: list[dict] = []
    seen: set[str] = set()
    for section in sections:
        for question_type in section.question_types:
            if question_type == "general":
                continue
            key = f"{source.source_ref}:{section.anchor}:{question_type}"
            if key in seen:
                continue
            seen.add(key)
            steps = []
            for sentence in split_sentences(section.text):
                if not sentence_quality_ok(sentence):
                    continue
                if any(marker in sentence for marker in PATTERN_MARKERS) or (
                    sentence_is_reasoning(sentence)
                    and any(marker in sentence for marker in ["取用神", "先定", "落宫", "最后看", "再看", "先看", "判断"])
                ):
                    steps.append(compress_reasoning_text(sentence))
                if len(steps) >= 4:
                    break
            if len(steps) < 3:
                for step in fallback_pattern_steps(question_type):
                    if step not in steps:
                        steps.append(step)
                    if len(steps) >= 4:
                        break
            patterns.append(
                {
                    "id": f"qimen-doc-pattern-{question_type}-{short_hash(source.source_ref, section.anchor, question_type)}",
                    "title": f"{source.teacher} / 分类预测 / {section.title} / {QUESTION_TYPES[question_type]['label']} 推理路径",
                    "question_type": question_type,
                    "source_type": "document",
                    "source_teacher": source.teacher or PRIMARY_TEACHER,
                    "source_course_or_book": source.course_or_book,
                    "source_lesson_title": source.lesson_or_title,
                    "source_ref": source.source_ref,
                    "source_section_title": section.title,
                    "source_section_anchor": section.anchor,
                    "evidence_refs": [source.source_ref],
                    "teacher_priority": teacher_priority(source.teacher),
                    "confidence": 0.72,
                    "knowledge_tier": "support",
                    "steps": steps[:4],
                    "decision_rules": [
                        "先定分类预测对应的主线对象，再看用神、落宫和门星神组合。",
                        "若信号冲突，优先分兑现条件、主次矛盾和时间节奏。",
                    ],
                    "notes": "分类预测章节提炼的文档路径卡，仅作为 support/reference 方法补边。",
                    "tags": sorted(set([question_type, "classification_method"])),
                }
            )
    return patterns


def generate_document_section_conflicts(source: SourceDocument, sections: list[DocumentSection]) -> list[dict]:
    cards: list[dict] = []
    seen: set[str] = set()
    for section in sections:
        for question_type in section.question_types:
            if question_type == "general":
                continue
            key = f"{source.source_ref}:{section.anchor}:{question_type}"
            if key in seen:
                continue
            seen.add(key)
            sentence = ""
            for candidate in split_sentences(section.text):
                if not sentence_quality_ok(candidate):
                    continue
                if any(marker in candidate for marker in CONFLICT_MARKERS) or any(
                    marker in candidate for marker in ["如果", "优先", "分", "兑现", "先定", "再看", "不能"]
                ):
                    sentence = compress_reasoning_text(candidate)
                    break
            if not sentence:
                sentence = build_video_lesson_conflict_fallback(question_type, section.title)
            cards.append(
                {
                    "id": f"qimen-doc-conflict-{question_type}-{short_hash(source.source_ref, section.anchor, question_type)}",
                    "title": f"{QUESTION_TYPES[question_type]['label']} / {section.title} 冲突取舍",
                    "question_type": question_type,
                    "source_type": "document",
                    "source_teacher": source.teacher or PRIMARY_TEACHER,
                    "source_course_or_book": source.course_or_book,
                    "source_lesson_title": source.lesson_or_title,
                    "source_ref": source.source_ref,
                    "source_section_title": section.title,
                    "source_section_anchor": section.anchor,
                    "evidence_refs": [source.source_ref],
                    "teacher_priority": teacher_priority(source.teacher),
                    "confidence": 0.71,
                    "knowledge_tier": "support",
                    "conflict_rule": build_conflict_summary(question_type, sentence),
                    "resolution_note": "分类预测章节优先保留方法边界与兑现条件，再结合具体用神和题型主线判断。",
                    "tags": sorted(set([question_type, "classification_method", *infer_support_tags(question_type, sentence)])),
                }
            )
    return cards


def build_single_document_deep_payload(source: SourceDocument) -> dict:
    trimmed_source = dataclasses.replace(source, text=document_casebook_text(source))
    section_title = source.lesson_or_title
    section_anchor = "full-document"
    if "预测应用" in source.lesson_or_title:
        sections = extract_prediction_app_sections(source)
        rule_cards: list[dict] = []
        candidate_case_cards: list[dict] = []
        for section in sections:
            section_source = dataclasses.replace(
                trimmed_source,
                lesson_or_title=f"{source.lesson_or_title} / {section.title}",
                text=section.text,
            )
            rule_cards.extend(
                annotate_section_fields(generate_rule_cards([section_source], {}), section.title, section.anchor)
            )
            section_cases = annotate_section_fields(generate_case_cards([section_source], {}), section.title, section.anchor)
            if len(section.question_types) == 1:
                section_cases = force_question_type(section_cases, section.question_types[0])
            candidate_case_cards.extend(section_cases)
        term_notes = annotate_section_fields(
            generate_term_notes([], [trimmed_source], {}),
            "分类预测",
            "classification-methods",
        )
        pattern_cards = generate_document_section_patterns(source, sections)
        conflict_cards = generate_document_section_conflicts(source, sections)
        case_cards = select_deep_doc_case_cards(candidate_case_cards)
        return {
            "source_ref": source.source_ref,
            "teacher": source.teacher,
            "course_or_book": source.course_or_book,
            "document_format": source.document_format,
            "extraction_method": source.extraction_method,
            "text_length": len(source.text),
            "case_blocks": len(split_document_case_blocks(trimmed_source.text)),
            "rule_cards": rule_cards,
            "case_cards": case_cards,
            "pattern_cards": pattern_cards,
            "term_notes": term_notes,
            "conflict_cards": conflict_cards,
        }

    rule_cards = annotate_section_fields(generate_rule_cards([trimmed_source], {}), section_title, section_anchor)
    case_cards = annotate_section_fields(generate_case_cards([trimmed_source], {}), section_title, section_anchor)
    term_notes = annotate_section_fields(generate_term_notes([], [trimmed_source], {}), section_title, section_anchor)
    conflict_cards = annotate_section_fields(generate_conflict_cards([], [trimmed_source], {}), section_title, section_anchor)
    return {
        "source_ref": source.source_ref,
        "teacher": source.teacher,
        "course_or_book": source.course_or_book,
        "document_format": source.document_format,
        "extraction_method": source.extraction_method,
        "text_length": len(source.text),
        "case_blocks": len(split_document_case_blocks(trimmed_source.text)),
        "rule_cards": rule_cards,
        "case_cards": case_cards,
        "pattern_cards": [],
        "term_notes": term_notes,
        "conflict_cards": conflict_cards,
    }


def write_generated_ts(
    rules: dict,
    cases: dict,
    patterns: dict,
    term_notes: dict,
    conflicts: dict,
    lesson_index: dict,
) -> None:
    content = (
        "// Generated by scripts/build_qimen_reasoning_assets.py. Do not edit manually.\n"
        f"export const GENERATED_QIMEN_RULE_CARDS = {json.dumps(rules, ensure_ascii=False, indent=2)} as const\n\n"
        f"export const GENERATED_QIMEN_CASE_CARDS = {json.dumps(cases, ensure_ascii=False, indent=2)} as const\n\n"
        f"export const GENERATED_QIMEN_REASONING_PATTERNS = {json.dumps(patterns, ensure_ascii=False, indent=2)} as const\n\n"
        f"export const GENERATED_QIMEN_TERM_NOTES = {json.dumps(term_notes, ensure_ascii=False, indent=2)} as const\n\n"
        f"export const GENERATED_QIMEN_CONFLICT_RESOLUTION_CARDS = {json.dumps(conflicts, ensure_ascii=False, indent=2)} as const\n\n"
        f"export const GENERATED_QIMEN_LESSON_INDEX = {json.dumps(lesson_index, ensure_ascii=False, indent=2)} as const\n"
    )
    GENERATED_TS_PATH.write_text(content, encoding="utf-8")


def build_payload(kind_key: str, items: list[dict]) -> dict:
    return {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "primary_teacher": PRIMARY_TEACHER,
        kind_key: items,
    }


def main() -> int:
    transcript_segments, segment_index = build_segment_index()
    transcript_sources = aggregate_video_lessons(transcript_segments)
    document_sources = load_document_sources()
    deep_payloads = load_deep_extraction_payloads()
    tier_overrides = load_tier_overrides()

    rules = build_payload("rules", apply_tier_overrides(merge_deep_extraction_items(generate_rule_cards([*transcript_sources, *document_sources], segment_index), deep_payloads, "rule_cards"), tier_overrides))
    cases = build_payload("cases", apply_tier_overrides(merge_deep_extraction_items(generate_case_cards([*transcript_sources, *document_sources], segment_index), deep_payloads, "case_cards"), tier_overrides))
    patterns = build_payload(
        "patterns",
        apply_tier_overrides(
            merge_deep_extraction_items(
                generate_reasoning_patterns(transcript_sources, segment_index),
                deep_payloads,
                "pattern_cards",
            ),
            tier_overrides,
        ),
    )
    term_notes = build_payload("notes", apply_tier_overrides(merge_deep_extraction_items(generate_term_notes(transcript_sources, document_sources, segment_index), deep_payloads, "term_notes"), tier_overrides))
    conflicts = build_payload("cards", apply_tier_overrides(merge_deep_extraction_items(generate_conflict_cards(transcript_sources, document_sources, segment_index), deep_payloads, "conflict_cards"), tier_overrides))

    write_json(RULE_CARDS_PATH, rules)
    write_json(CASE_CARDS_PATH, cases)
    write_json(PATTERN_CARDS_PATH, patterns)
    write_json(TERM_NOTES_PATH, term_notes)
    write_json(CONFLICT_CARDS_PATH, conflicts)
    lesson_index = build_lesson_index(
        transcript_segments,
        transcript_sources,
        document_sources,
        segment_index,
        rules["rules"],
        cases["cases"],
        patterns["patterns"],
        term_notes["notes"],
        conflicts["cards"],
    )
    build_report(rules, cases, patterns, term_notes, conflicts)
    build_document_extraction_report(document_sources)
    build_document_coverage_report(
        document_sources,
        rules["rules"],
        cases["cases"],
        term_notes["notes"],
        conflicts["cards"],
    )
    build_video_coverage_report(lesson_index)
    write_generated_ts(rules, cases, patterns, term_notes, conflicts, lesson_index)

    print(
        "Built QiMen reasoning assets:",
        f"rules={len(rules['rules'])}",
        f"cases={len(cases['cases'])}",
        f"patterns={len(patterns['patterns'])}",
        f"term_notes={len(term_notes['notes'])}",
        f"conflicts={len(conflicts['cards'])}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
