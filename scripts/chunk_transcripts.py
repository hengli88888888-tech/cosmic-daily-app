#!/usr/bin/env python3
import argparse
from pathlib import Path

from transcript_utils import chunk_transcript_file


def main() -> int:
    parser = argparse.ArgumentParser(description="Chunk transcript text files into extraction-ready JSON.")
    parser.add_argument("--input-dir", default="data/raw-transcripts")
    parser.add_argument("--output-dir", default="data/extracted-notes/chunks")
    parser.add_argument("--min-chars", type=int, default=800)
    parser.add_argument("--max-chars", type=int, default=1800)
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    transcript_files = sorted(input_dir.rglob("*.txt")) + sorted(input_dir.rglob("*.md"))
    if not transcript_files:
        print("No transcript files found.")
        return 0

    for transcript_path in transcript_files:
        result = chunk_transcript_file(transcript_path, input_dir, output_dir, args.min_chars, args.max_chars)
        print(f"Chunked {result['relative_source']} -> {result['chunk_count']} chunks")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
