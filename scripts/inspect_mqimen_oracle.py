#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import plistlib
import sqlite3
from pathlib import Path


def read_info(app_root: Path) -> dict:
    info_path = app_root / "Wrapper" / "mQimen.app" / "Info.plist"
    with info_path.open("rb") as fh:
        info = plistlib.load(fh)
    return {
        "bundle_id": info.get("CFBundleIdentifier"),
        "display_name": info.get("CFBundleDisplayName"),
        "version": info.get("CFBundleShortVersionString"),
        "build": info.get("CFBundleVersion"),
        "platforms": info.get("CFBundleSupportedPlatforms", []),
    }


def read_db_summary(app_root: Path) -> dict:
    db_path = app_root / "Wrapper" / "mQimen.app" / "www" / "mqmfree.db"
    conn = sqlite3.connect(db_path)
    try:
        tables = [
            row[0]
            for row in conn.execute(
                "select name from sqlite_master where type='table' order by name"
            )
        ]
        row_count, min_edate, max_edate = conn.execute(
            "select count(*), min(edate), max(edate) from ecliptic"
        ).fetchone()
        first_rows = [
            {
                "id": row[0],
                "edate": row[1],
                "season_id": row[2],
                "lead": row[3],
                "leap": row[4],
                "lmonth": row[5],
                "lday": row[6],
            }
            for row in conn.execute(
                "select ID, edate, season_ID, lead, leap, lmonth, lday "
                "from ecliptic order by ID limit 5"
            )
        ]
    finally:
        conn.close()
    return {
        "tables": tables,
        "ecliptic": {
            "row_count": row_count,
            "min_edate": min_edate,
            "max_edate": max_edate,
            "sample_rows": first_rows,
        },
    }


def read_js_notes(app_root: Path) -> dict:
    js_path = app_root / "Wrapper" / "mQimen.app" / "www" / "js" / "script.min.js"
    text = js_path.read_text(errors="ignore")
    return {
        "contains_process_chart": "function process_chart" in text,
        "contains_query_ecliptic": "query_ecliptic(" in text,
        "contains_zi_hour_rollover": "23==c&&($day_hs+=1" in text,
        "contains_supported_system_labels": all(
            key in text for key in ["拆补", "置闰", "阴盘"]
        ),
        "contains_duty_markers": all(
            key in text for key in ["旬首", "值符", "值使", "空亡", "驿马"]
        ),
        "notes": [
            "App package is a Cordova/WebView wrapper, not a fully native closed binary.",
            "Core chart logic appears inside compressed JavaScript.",
            "Season/solar-term boundaries are backed by the bundled mqmfree.db ecliptic table.",
        ],
    }


def build_report(app_root: Path) -> dict:
    return {
        "app_root": str(app_root),
        "packaging": "cordova_wrapper",
        "info": read_info(app_root),
        "database": read_db_summary(app_root),
        "javascript": read_js_notes(app_root),
        "recommendation": {
            "preferred_use": [
                "oracle_validation",
                "solar_term_reference",
                "bureau_behavior_comparison",
            ],
            "avoid": [
                "direct_code_copy",
                "embedding_vendor_assets",
                "treating_minified_js_as_primary_engine_source",
            ],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect mQimen.app oracle structure.")
    parser.add_argument(
        "--app",
        default="/Applications/mQimen.app",
        help="Path to mQimen app bundle root",
    )
    parser.add_argument(
        "--output",
        help="Optional path to write JSON report",
    )
    args = parser.parse_args()

    app_root = Path(args.app)
    report = build_report(app_root)
    content = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(content + "\n")
    else:
        print(content)


if __name__ == "__main__":
    main()
