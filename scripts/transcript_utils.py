from __future__ import annotations

import json
import re
from pathlib import Path


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_paragraphs(text: str) -> list[str]:
    parts = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if parts:
        return parts
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return lines


def chunk_paragraphs(paragraphs: list[str], min_chars: int, max_chars: int) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for paragraph in paragraphs:
        paragraph_len = len(paragraph)
        if current and current_len + 2 + paragraph_len > max_chars:
            chunks.append("\n\n".join(current))
            current = [paragraph]
            current_len = paragraph_len
            continue

        current.append(paragraph)
        current_len += paragraph_len if current_len == 0 else paragraph_len + 2

        if current_len >= min_chars:
            chunks.append("\n\n".join(current))
            current = []
            current_len = 0

    if current:
        chunks.append("\n\n".join(current))

    return chunks


def chunk_transcript_file(
    transcript_path: Path,
    input_root: Path,
    output_root: Path,
    min_chars: int,
    max_chars: int,
) -> dict:
    relative = transcript_path.relative_to(input_root)
    raw_text = transcript_path.read_text(encoding="utf-8")
    text = normalize_text(raw_text)
    paragraphs = split_paragraphs(text)
    chunks = chunk_paragraphs(paragraphs, min_chars, max_chars)

    stem_dir = output_root / relative.parent / transcript_path.stem
    stem_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
      "source_file": str(relative),
      "chunk_count": len(chunks),
      "min_chars": min_chars,
      "max_chars": max_chars,
    }
    (stem_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    paths: list[Path] = []
    for index, chunk in enumerate(chunks, start=1):
        payload = {
            "chunk_id": f"{transcript_path.stem}-{index:04d}",
            "source_file": str(relative),
            "sequence": index,
            "text": chunk,
        }
        chunk_path = stem_dir / f"{index:04d}.json"
        chunk_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        paths.append(chunk_path)

    return {
        "relative_source": str(relative),
        "chunk_dir": str(stem_dir),
        "chunk_count": len(chunks),
        "chunk_paths": [str(path) for path in paths],
    }
