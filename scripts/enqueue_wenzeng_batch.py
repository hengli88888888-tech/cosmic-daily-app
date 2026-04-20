#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path


SERVER = "http://127.0.0.1:8765"
QUEUE_LIMIT = 3


def jobs() -> list[dict]:
    with urllib.request.urlopen(f"{SERVER}/api/jobs", timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload.get("jobs", [])


def active_count() -> int:
    return sum(1 for job in jobs() if job.get("status") in {"queued", "running"})


def upload(video_path: Path, teacher: str) -> str:
    data = video_path.read_bytes()
    request = urllib.request.Request(f"{SERVER}/api/upload", data=data, method="POST")
    request.add_header("X-Filename", urllib.parse.quote(video_path.name))
    request.add_header("X-Teacher", urllib.parse.quote(teacher))
    request.add_header("X-Language", "zh")
    request.add_header("X-Whisper-Model", "turbo")
    request.add_header("X-Whisper-Threads", "8")
    request.add_header("X-Extraction-Workers", "1")
    request.add_header("X-Preprocess-Audio", "true")
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload["job_id"]


def existing_filenames() -> set[str]:
    current = set()
    for job in jobs():
        filename = str(job.get("filename", "")).strip()
        if filename:
            current.add(filename)
    return current


def main() -> int:
    parser = argparse.ArgumentParser(description="Queue WenZeng course videos into local ingestion UI.")
    parser.add_argument("root", help="Directory that contains WenZeng videos")
    parser.add_argument("--teacher", default="文曾")
    parser.add_argument("--sleep", type=int, default=20, help="Polling interval in seconds")
    parser.add_argument("--limit", type=int, default=QUEUE_LIMIT, help="Max running+queued jobs before waiting")
    args = parser.parse_args()

    root = Path(args.root)
    if not root.exists():
        print(f"missing root: {root}", file=sys.stderr)
        return 1

    files = sorted([path for path in root.iterdir() if path.is_file() and path.suffix.lower() == ".mp4"])
    if not files:
        print(f"no mp4 files found in {root}", file=sys.stderr)
        return 1

    queued = 0
    skipped = 0
    for video_path in files:
        while active_count() >= args.limit:
            print(f"queue busy; waiting {args.sleep}s before {video_path.name}", flush=True)
            time.sleep(args.sleep)

        if video_path.name in existing_filenames():
            skipped += 1
            print(f"skip existing job: {video_path.name}", flush=True)
            continue

        job_id = upload(video_path, args.teacher)
        queued += 1
        print(f"queued {video_path.name} -> {job_id}", flush=True)
        time.sleep(1)

    print(f"done: queued={queued} skipped={skipped}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
