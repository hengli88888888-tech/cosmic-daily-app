#!/usr/bin/env python3
from __future__ import annotations

import argparse
import http.client
import json
import os
import shutil
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path("/Volumes/Hard Drive/阳盘奇门")
SERVER_URL = os.getenv("INGESTION_SERVER_URL", "http://127.0.0.1:8765")
STATE_DIR = ROOT / "data" / "import-runs" / "qimen-yangpan"
STATE_PATH = STATE_DIR / "state.json"
RAW_DOCS_ROOT = ROOT / "data" / "raw-documents" / "qimen"
DOC_INDEX_PATH = ROOT / "specs" / "knowledge-base" / "qimen" / "qimen-document-sources.json"

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".html", ".jpg", ".jpeg", ".png"}
SUCCESS_STATUSES = {"ready_for_review", "completed"}
FAILURE_STATUSES = {"failed"}
IN_PROGRESS_STATUSES = {"queued", "running"}


@dataclass
class SourceItem:
    source_path: Path
    rel_path: str
    teacher_folder: str
    teacher: str
    course: str
    kind: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def derive_item(path: Path) -> SourceItem:
    rel = path.relative_to(SOURCE_ROOT)
    teacher_folder = rel.parts[0]
    teacher = teacher_folder.removesuffix(" 阳盘奇门").strip() or teacher_folder.strip()
    course_parts = rel.parts[1:-1]
    course = " / ".join(course_parts) if course_parts else path.stem
    suffix = path.suffix.lower()
    if suffix in VIDEO_EXTENSIONS:
        kind = "video"
    elif suffix in DOCUMENT_EXTENSIONS:
        kind = "document"
    else:
        kind = "skip"
    return SourceItem(
        source_path=path,
        rel_path=str(rel),
        teacher_folder=teacher_folder,
        teacher=teacher,
        course=course,
        kind=kind,
    )


def iter_source_items() -> list[SourceItem]:
    items: list[SourceItem] = []
    for path in sorted(SOURCE_ROOT.rglob("*")):
        if not path.is_file():
            continue
        item = derive_item(path)
        if item.kind == "skip":
            continue
        items.append(item)
    return items


def ensure_server_available(server_url: str) -> None:
    try:
        with urllib.request.urlopen(f"{server_url}/api/jobs", timeout=10) as response:
            if response.status != 200:
                raise RuntimeError(f"Unexpected server status: {response.status}")
    except Exception as error:
        raise RuntimeError(f"Ingestion server unavailable at {server_url}: {error}") from error


def ensure_state() -> dict[str, Any]:
    state = read_json(
        STATE_PATH,
        {
            "version": 1,
            "source_root": str(SOURCE_ROOT),
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "entries": {},
        },
    )
    state.setdefault("entries", {})
    state["updated_at"] = now_iso()
    return state


def save_state(state: dict[str, Any]) -> None:
    state["updated_at"] = now_iso()
    write_json(STATE_PATH, state)


def mark_failure(state: dict[str, Any], item: SourceItem, error: Exception) -> None:
    entry = state["entries"].setdefault(item.rel_path, {})
    entry.update(
        {
            "kind": item.kind,
            "teacher": item.teacher,
            "course": item.course,
            "status": "failed",
            "error": str(error),
            "failed_at": now_iso(),
        }
    )
    save_state(state)


def prune_empty_parents(path: Path, stop_at: Path) -> None:
    current = path.parent
    while current != stop_at and current.is_dir():
        try:
            current.rmdir()
        except OSError:
            return
        current = current.parent


def update_document_index(state: dict[str, Any]) -> None:
    sources: list[dict[str, Any]] = []
    for rel_path, entry in sorted(state["entries"].items()):
        if entry.get("kind") != "document":
            continue
        if not entry.get("copied_path"):
            continue
        sources.append(
            {
                "source_rel_path": rel_path,
                "teacher": entry.get("teacher", ""),
                "course": entry.get("course", ""),
                "copied_path": entry.get("copied_path"),
                "source_size": entry.get("source_size", 0),
                "status": entry.get("status", ""),
                "copied_at": entry.get("copied_at", ""),
            }
        )
    payload = {
        "version": 1,
        "scope": "yangpan_qimen_documents",
        "generated_at": now_iso(),
        "source_root": str(SOURCE_ROOT),
        "sources": sources,
    }
    write_json(DOC_INDEX_PATH, payload)


def copy_document(item: SourceItem, state: dict[str, Any]) -> None:
    entry = state["entries"].setdefault(item.rel_path, {})
    destination = RAW_DOCS_ROOT / item.rel_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(item.source_path, destination)
    entry.update(
        {
            "kind": item.kind,
            "teacher": item.teacher,
            "course": item.course,
            "status": "copied",
            "source_size": item.source_path.stat().st_size,
            "copied_path": str(destination.relative_to(ROOT)),
            "copied_at": now_iso(),
        }
    )
    save_state(state)


def upload_video(server_url: str, item: SourceItem) -> str:
    parsed = urllib.parse.urlsplit(server_url)
    if parsed.scheme not in {"http", "https"}:
        raise RuntimeError(f"Unsupported server URL scheme: {server_url}")
    connection_class = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    path = (parsed.path.rstrip("/") or "") + "/api/upload"
    headers = {
        "Content-Type": "application/octet-stream",
        "Content-Length": str(item.source_path.stat().st_size),
        "X-Filename": urllib.parse.quote(item.source_path.name),
        "X-Teacher": urllib.parse.quote(item.teacher),
        "X-Course": urllib.parse.quote(item.course),
        "X-Course-Mode": "qimen_multimodal",
        "X-Preprocess-Audio": "true",
    }
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if api_key:
        headers["X-OpenAI-Key"] = urllib.parse.quote(api_key)

    connection = connection_class(host, port, timeout=1200)
    try:
        connection.putrequest("POST", path)
        for key, value in headers.items():
            connection.putheader(key, value)
        connection.endheaders()
        with item.source_path.open("rb") as handle:
            while True:
                chunk = handle.read(1024 * 1024)
                if not chunk:
                    break
                connection.send(chunk)
        response = connection.getresponse()
        body = response.read().decode("utf-8", errors="replace")
    finally:
        connection.close()

    if response.status >= 300:
        raise RuntimeError(f"Upload failed for {item.rel_path}: HTTP {response.status} {body}")
    payload = json.loads(body)
    job_id = payload.get("job_id", "")
    if not job_id:
        raise RuntimeError(f"Upload response missing job_id for {item.rel_path}")
    return job_id


def fetch_job(server_url: str, job_id: str) -> dict[str, Any]:
    with urllib.request.urlopen(f"{server_url}/api/jobs", timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    for job in payload.get("jobs", []):
        if job.get("id") == job_id:
            return job
    raise RuntimeError(f"Job {job_id} not found in /api/jobs response")


def wait_for_job(server_url: str, job_id: str, poll_seconds: int = 20) -> dict[str, Any]:
    while True:
        job = fetch_job(server_url, job_id)
        status = job.get("status", "")
        if status in SUCCESS_STATUSES | FAILURE_STATUSES:
            return job
        time.sleep(poll_seconds)


def process_video(item: SourceItem, state: dict[str, Any], server_url: str) -> None:
    entry = state["entries"].setdefault(item.rel_path, {})
    entry.update(
        {
            "kind": item.kind,
            "teacher": item.teacher,
            "course": item.course,
            "source_size": item.source_path.stat().st_size,
            "status": "uploading",
            "started_at": now_iso(),
        }
    )
    save_state(state)

    job_id = upload_video(server_url, item)
    entry["job_id"] = job_id
    entry["status"] = "uploaded"
    save_state(state)

    job = wait_for_job(server_url, job_id)
    final_status = job.get("status", "unknown")
    entry["job_status"] = final_status
    entry["job_message"] = job.get("message", "")
    entry["finished_at"] = now_iso()

    if final_status in SUCCESS_STATUSES:
        if item.source_path.exists():
            item.source_path.unlink()
            prune_empty_parents(item.source_path, SOURCE_ROOT)
        entry["status"] = "source_deleted"
        entry["source_deleted_at"] = now_iso()
    else:
        entry["status"] = "failed"

    save_state(state)


def should_skip(entry: dict[str, Any], item: SourceItem) -> bool:
    if item.kind == "document":
        return entry.get("status") == "copied"
    return entry.get("status") == "source_deleted"


def should_resume_uploaded(entry: dict[str, Any], item: SourceItem) -> bool:
    return item.kind == "video" and entry.get("status") == "uploaded" and bool(entry.get("job_id"))


def summarize_scan(items: list[SourceItem]) -> dict[str, int]:
    counts = {"video": 0, "document": 0}
    for item in items:
        counts[item.kind] = counts.get(item.kind, 0) + 1
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch import Yang Pan QiMen source materials.")
    parser.add_argument("--max-videos", type=int, default=0, help="Optional video import limit for the current run.")
    parser.add_argument("--docs-only", action="store_true", help="Only archive documents, skip video ingestion.")
    parser.add_argument("--server-url", default=SERVER_URL, help="Knowledge ingestion server URL.")
    args = parser.parse_args()

    if not SOURCE_ROOT.exists():
        raise SystemExit(f"Source root not found: {SOURCE_ROOT}")

    state = ensure_state()
    items = iter_source_items()
    scan_counts = summarize_scan(items)
    state["scan_summary"] = scan_counts
    save_state(state)

    print(
        f"Scanned {len(items)} files under {SOURCE_ROOT} "
        f"({scan_counts.get('video', 0)} videos, {scan_counts.get('document', 0)} documents)."
    )

    documents = [item for item in items if item.kind == "document"]
    for item in documents:
        entry = state["entries"].setdefault(item.rel_path, {})
        if should_skip(entry, item):
            continue
        try:
            copy_document(item, state)
            print(f"Archived document: {item.rel_path}")
        except Exception as error:
            mark_failure(state, item, error)
            print(f"Document failed: {item.rel_path} -> {error}")
    update_document_index(state)

    if args.docs_only:
        print("Document archival complete.")
        return 0

    ensure_server_available(args.server_url)

    processed_videos = 0
    for item in items:
        if item.kind != "video":
            continue
        entry = state["entries"].setdefault(item.rel_path, {})
        if should_skip(entry, item):
            continue
        if should_resume_uploaded(entry, item):
            try:
                job = wait_for_job(args.server_url, entry["job_id"])
                final_status = job.get("status", "unknown")
                entry["job_status"] = final_status
                entry["job_message"] = job.get("message", "")
                entry["finished_at"] = now_iso()
                if final_status in SUCCESS_STATUSES:
                    if item.source_path.exists():
                        item.source_path.unlink()
                        prune_empty_parents(item.source_path, SOURCE_ROOT)
                    entry["status"] = "source_deleted"
                    entry["source_deleted_at"] = now_iso()
                elif final_status in FAILURE_STATUSES:
                    entry["status"] = "failed"
                save_state(state)
                print(f"Resumed uploaded video: {item.rel_path} -> {entry['status']}")
            except Exception as error:
                mark_failure(state, item, error)
                print(f"Resume failed: {item.rel_path} -> {error}")
            continue
        try:
            process_video(item, state, args.server_url)
            processed_videos += 1
            print(f"Processed video: {item.rel_path} -> {state['entries'][item.rel_path].get('status')}")
        except Exception as error:
            mark_failure(state, item, error)
            print(f"Video failed: {item.rel_path} -> {error}")
        if args.max_videos and processed_videos >= args.max_videos:
            break

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
