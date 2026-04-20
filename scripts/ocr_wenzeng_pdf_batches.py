#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import shutil
import subprocess
from pathlib import Path


def run_batch(pdf_path: Path, output_dir: Path, label: str, pages_per_batch: int, lang: str) -> list[Path]:
    if shutil.which("ocrmypdf") is None:
        raise SystemExit("ocrmypdf not found")

    mdls = subprocess.run(
        ["mdls", "-raw", "-name", "kMDItemNumberOfPages", str(pdf_path)],
        capture_output=True,
        text=True,
        check=True,
    )
    total_pages = int(mdls.stdout.strip())
    output_dir.mkdir(parents=True, exist_ok=True)

    chunk_paths: list[Path] = []
    for start in range(1, total_pages + 1, pages_per_batch):
        end = min(start + pages_per_batch - 1, total_pages)
        range_tag = f"{start}_{end}"
        out_pdf = output_dir / f"{label}_pages_{range_tag}.pdf"
        out_txt = output_dir / f"{label}_pages_{range_tag}.txt"
        if out_txt.exists() and out_txt.stat().st_size > 0:
            print(f"skip existing {out_txt.name}")
            chunk_paths.append(out_txt)
            continue

        print(f"ocr {label} pages {start}-{end}")
        cmd = [
            "ocrmypdf",
            "-l",
            lang,
            "--pages",
            f"{start}-{end}",
            "--sidecar",
            str(out_txt),
            str(pdf_path),
            str(out_pdf),
        ]
        subprocess.run(cmd, check=True)
        chunk_paths.append(out_txt)
    return chunk_paths


def build_combined(output_dir: Path, label: str) -> Path:
    chunk_paths = sorted(output_dir.glob(f"{label}_pages_*.txt"))
    combined = output_dir / f"{label}_combined.txt"
    parts: list[str] = []
    for chunk_path in chunk_paths:
        text = chunk_path.read_text(encoding="utf-8", errors="ignore").strip()
        if not text:
            continue
        parts.append(f"===== {chunk_path.stem} =====\n{text}")
    combined.write_text("\n\n".join(parts) + "\n", encoding="utf-8")
    return combined


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("label")
    parser.add_argument("--output-dir", type=Path, default=Path("data/raw-documents/文曾"))
    parser.add_argument("--pages-per-batch", type=int, default=48)
    parser.add_argument("--lang", default="chi_sim")
    args = parser.parse_args()

    run_batch(args.pdf, args.output_dir, args.label, args.pages_per_batch, args.lang)
    combined = build_combined(args.output_dir, args.label)
    print(f"combined -> {combined}")


if __name__ == "__main__":
    main()
