#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a single queue file from transcript chunks.")
    parser.add_argument("--chunks-dir", default="data/extracted-notes/chunks")
    parser.add_argument("--output-file", default="data/extracted-notes/extraction-queue.jsonl")
    args = parser.parse_args()

    chunks_dir = Path(args.chunks_dir)
    output_file = Path(args.output_file)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    chunk_files = sorted(path for path in chunks_dir.rglob("*.json") if path.name != "manifest.json")
    with output_file.open("w", encoding="utf-8") as handle:
        for path in chunk_files:
            payload = json.loads(path.read_text(encoding="utf-8"))
            record = {
                "chunk_id": payload["chunk_id"],
                "source_file": payload["source_file"],
                "sequence": payload["sequence"],
                "chunk_path": str(path),
                "status": "pending",
            }
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Wrote {len(chunk_files)} queue items to {output_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
