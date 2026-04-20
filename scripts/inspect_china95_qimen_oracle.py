#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


LEGACY_FORM_URL = "https://www.china95.net/paipan/qimen.asp"
RESULT_URL = "https://www.china95.net/paipan/qimen_show.asp"


@dataclass
class China95Request:
    year: int
    month: int
    day: int
    hour: int
    minute: int
    second: int
    ju: str
    time_mode: str
    city: str | None
    longitude: float | None


class TextCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        text = " ".join(data.split())
        if text:
            self.parts.append(text)


def fetch_result(payload: China95Request) -> str:
    form_payload: dict[str, str] = {
        "years": str(payload.year),
        "months": str(payload.month),
        "days": str(payload.day),
        "hours": str(payload.hour),
        "mins": str(payload.minute),
        "miao": str(payload.second),
        "ju": payload.ju,
        "R1": payload.time_mode,
        "button1": "排盘",
    }
    if payload.time_mode == "V2":
        form_payload["D1"] = payload.city or "北京"
    if payload.time_mode == "V3":
        form_payload["T1"] = str(payload.longitude if payload.longitude is not None else 120)

    data = urlencode(form_payload, encoding="gb18030").encode("ascii")
    request = Request(
        RESULT_URL,
        data=data,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Content-Type": "application/x-www-form-urlencoded; charset=gb2312",
            "Referer": LEGACY_FORM_URL,
        },
    )
    with urlopen(request, timeout=20) as response:
        return response.read().decode("gb18030", "ignore")


def text_view(html: str) -> list[str]:
    parser = TextCollector()
    parser.feed(html)
    return parser.parts


def parse_summary(html: str) -> dict[str, object]:
    summary: dict[str, object] = {
        "source": "china95.net/qimen_show.asp",
    }
    condensed = " ".join(text_view(html))

    def capture(pattern: str, key: str) -> None:
        match = re.search(pattern, condensed)
        if match:
            summary[key] = match.group(1).strip()

    capture(r"经度：\s*([0-9.]+\s*\S+)", "longitude")
    capture(r"真时：\s*([0-9年月日时分秒 ]+)", "true_solar_time")
    capture(r"公元：\s*([0-9年月日时分秒 ]+)\s*(阳\d局|阴\d局)", "civil_time")
    match = re.search(r"公元：\s*[0-9年月日时分秒 ]+\s*(阳\d局|阴\d局)", condensed)
    if match:
        summary["bureau"] = match.group(1)
    capture(r"农历：\s*([0-9年月日时分 ]+)", "lunar_time")
    match = re.search(r"立春：\s*([0-9/: ]+)\s*惊蛰：\s*([0-9/: ]+)", condensed)
    if match:
        summary["solar_terms"] = {
            "term_a": {"label": "立春", "datetime": match.group(1).strip()},
            "term_b": {"label": "惊蛰", "datetime": match.group(2).strip()},
        }
    match = re.search(r"干支：\s*(\S+)\s*年\s*(\S+)\s*月\s*(\S+)\s*日\s*(\S+)\s*时", condensed)
    if match:
        summary["pillars"] = {
            "year": match.group(1),
            "month": match.group(2),
            "day": match.group(3),
            "hour": match.group(4),
        }
    match = re.search(r"旬空：\s*(\S+)\s*空\s*(\S+)\s*空\s*(\S+)\s*空\s*(\S+)\s*空", condensed)
    if match:
        summary["xun_kong"] = [match.group(1), match.group(2), match.group(3), match.group(4)]
    match = re.search(r"直符：\s*(\S+)\s*直使：\s*(\S+)\s*旬首：\s*(\S+)", condensed)
    if match:
        summary["zhi_fu"] = match.group(1)
        summary["zhi_shi"] = match.group(2)
        summary["xun_shou"] = match.group(3)

    board_match = re.search(r"(┌──────.*?└──────┴──────┴──────┘)", condensed)
    if board_match:
        summary["board_text"] = board_match.group(1)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect china95 legacy QiMen oracle output")
    parser.add_argument("--year", type=int, default=2024)
    parser.add_argument("--month", type=int, default=2)
    parser.add_argument("--day", type=int, default=10)
    parser.add_argument("--hour", type=int, default=12)
    parser.add_argument("--minute", type=int, default=0)
    parser.add_argument("--second", type=int, default=0)
    parser.add_argument("--ju", default="拆补局")
    parser.add_argument("--time-mode", choices=["V1", "V2", "V3"], default="V2")
    parser.add_argument("--city", default="北京")
    parser.add_argument("--longitude", type=float, default=120.0)
    parser.add_argument("--save-html", type=Path)
    args = parser.parse_args()

    request = China95Request(
        year=args.year,
        month=args.month,
        day=args.day,
        hour=args.hour,
        minute=args.minute,
        second=args.second,
        ju=args.ju,
        time_mode=args.time_mode,
        city=args.city,
        longitude=args.longitude,
    )
    html = fetch_result(request)
    if args.save_html:
        args.save_html.write_text(html, encoding="gb18030")
    print(json.dumps(parse_summary(html), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
