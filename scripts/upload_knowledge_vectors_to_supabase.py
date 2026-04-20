#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import textwrap
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
QIMEN_KB_DIR = ROOT / "specs" / "knowledge-base" / "qimen"
BAZI_RULE_LIBRARY = ROOT / "specs" / "knowledge-base" / "teacher-rule-library.json"

NAMESPACE = uuid.UUID("6e996efd-9652-4d8f-90d4-d76b2415df24")

DEFAULT_EMBED_PROVIDER = "qwen"
DEFAULT_EMBED_MODEL = "text-embedding-v4"
DEFAULT_QWEN_DIMENSIONS = 1536
DEFAULT_CHUNK_SIZE = 1200
DEFAULT_CHUNK_OVERLAP = 150
DEFAULT_BATCH_SIZE = 50
DEFAULT_ENV_FILE = ".env.knowledge-import"
RETRYABLE_HTTP_CODES = {429, 500, 502, 503, 504}


@dataclass
class KnowledgeDocument:
    source_slug: str
    source_name: str
    source_type: str
    source_language_codes: list[str]
    authority_level: str
    document_slug: str
    doc_type: str
    title: str
    language_code: str
    publisher: str
    authors: list[dict[str, str]]
    abstract_text: str
    summary_zh: str
    canonical_url: str
    content: str
    metadata: dict[str, Any]


def stable_uuid(value: str) -> str:
    return str(uuid.uuid5(NAMESPACE, value))


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def clean_lines(lines: Iterable[str]) -> str:
    normalized: list[str] = []
    for raw in lines:
        line = str(raw).strip()
        if line:
            normalized.append(line)
    return "\n".join(normalized).strip()


def join_list(label: str, values: list[Any]) -> str:
    cleaned = [str(value).strip() for value in values if str(value).strip()]
    if not cleaned:
        return ""
    return f"{label}: " + " | ".join(cleaned)


def build_text_block(pairs: list[tuple[str, Any]]) -> str:
    lines: list[str] = []
    for label, value in pairs:
        if value is None:
            continue
        if isinstance(value, list):
            if value and all(isinstance(item, str) for item in value):
                block = join_list(label, value)
                if block:
                    lines.append(block)
                continue
            if value:
                lines.append(f"{label}: {compact_json(value)}")
            continue
        text = str(value).strip()
        if text:
            lines.append(f"{label}: {text}")
    return clean_lines(lines)


def assemble_qimen_documents() -> list[KnowledgeDocument]:
    specs: list[tuple[str, str, str, str]] = [
        ("qimen-case-cards.json", "cases", "qimen-case-cards", "case"),
        ("qimen-rule-cards.json", "rules", "qimen-rule-cards", "article"),
        ("qimen-reasoning-patterns.json", "patterns", "qimen-reasoning-patterns", "article"),
        ("qimen-term-notes.json", "notes", "qimen-term-notes", "article"),
        ("qimen-conflict-resolution-cards.json", "cards", "qimen-conflict-resolution-cards", "article"),
    ]

    documents: list[KnowledgeDocument] = []
    for filename, collection_key, source_slug, doc_type in specs:
        path = QIMEN_KB_DIR / filename
        if not path.exists():
            continue
        payload = load_json(path)
        for item in payload.get(collection_key, []):
            item_id = str(item.get("id", "")).strip()
            if not item_id:
                continue
            title = str(item.get("title") or item.get("topic") or item_id).strip()
            metadata = {
                "scope": "qimen",
                "collection": collection_key,
                "source_file": filename,
                "item_id": item_id,
                "question_type": item.get("question_type"),
                "knowledge_tier": item.get("knowledge_tier"),
                "source_teacher": item.get("source_teacher"),
                "source_course_or_book": item.get("source_course_or_book"),
                "source_lesson_title": item.get("source_lesson_title"),
                "source_ref": item.get("source_ref"),
                "teacher_priority": item.get("teacher_priority"),
                "confidence": item.get("confidence"),
                "tags": item.get("tags", []),
                "evidence_refs": item.get("evidence_refs", []),
            }
            content = build_text_block(
                [
                    ("Title", title),
                    ("Question type", item.get("question_type")),
                    ("Question summary", item.get("question_summary")),
                    ("Plate focus", item.get("plate_focus")),
                    ("Teacher conclusion", item.get("teacher_conclusion")),
                    ("Teacher reasoning steps", item.get("teacher_reasoning_steps", [])),
                    ("Rule text", item.get("rule_text")),
                    ("Applicability", item.get("applicability")),
                    ("Boundary note", item.get("boundary_note")),
                    ("Trigger terms", item.get("trigger_terms", [])),
                    ("Steps", item.get("steps", [])),
                    ("Decision rules", item.get("decision_rules", [])),
                    ("Notes", item.get("notes")),
                    ("Term", item.get("term")),
                    ("Normalized term", item.get("normalized_term")),
                    ("Aliases", item.get("aliases", [])),
                    ("Term note", item.get("term_note")),
                    ("Usage note", item.get("usage_note")),
                    ("Conflict rule", item.get("conflict_rule")),
                    ("Resolution note", item.get("resolution_note")),
                    ("Feedback summary", item.get("feedback_summary")),
                    ("Tags", item.get("tags", [])),
                ]
            )
            abstract_text = (
                str(item.get("question_summary") or item.get("rule_text") or item.get("term_note") or title).strip()
            )
            summary_zh = (
                str(item.get("teacher_conclusion") or item.get("resolution_note") or item.get("rule_text") or "").strip()
            )
            documents.append(
                KnowledgeDocument(
                    source_slug=source_slug,
                    source_name=f"QiMen KB / {collection_key}",
                    source_type="internal_curated_knowledge",
                    source_language_codes=["zh"],
                    authority_level="B",
                    document_slug=item_id,
                    doc_type=doc_type,
                    title=title,
                    language_code="zh",
                    publisher="Oraya",
                    authors=[{"name": str(item.get("source_teacher", "")).strip()}] if item.get("source_teacher") else [],
                    abstract_text=abstract_text,
                    summary_zh=summary_zh,
                    canonical_url=f"oraya://knowledge/qimen/{collection_key}/{item_id}",
                    content=content,
                    metadata=metadata,
                )
            )
    return documents


def assemble_bazi_documents() -> list[KnowledgeDocument]:
    if not BAZI_RULE_LIBRARY.exists():
        return []
    payload = load_json(BAZI_RULE_LIBRARY)
    documents: list[KnowledgeDocument] = []
    for teacher in payload.get("teachers", []):
        teacher_name = str(teacher.get("teacher", "")).strip() or "unknown"
        source_slug = f"bazi-{teacher_name.lower().replace(' ', '-')}"
        for item in teacher.get("rules", []):
            item_id = str(item.get("id", "")).strip()
            if not item_id:
                continue
            topic = str(item.get("topic", "")).strip()
            title = topic or item_id
            metadata = {
                "scope": "bazi",
                "teacher": teacher_name,
                "status": teacher.get("status"),
                "topic": topic,
                "topic_family": item.get("topic_family"),
                "confidence": item.get("confidence"),
                "source": item.get("source", {}),
            }
            content = build_text_block(
                [
                    ("Title", title),
                    ("Topic family", item.get("topic_family")),
                    ("Claim", item.get("claim")),
                    ("Interpretation", item.get("interpretation")),
                    ("Conditions", item.get("conditions", [])),
                    ("Reasoning path", item.get("reasoning_path", [])),
                    ("Branch conditions", item.get("branch_conditions", [])),
                    ("Product safe advice", item.get("product_safe_advice", [])),
                    ("Do not say", item.get("do_not_say", [])),
                ]
            )
            documents.append(
                KnowledgeDocument(
                    source_slug=source_slug,
                    source_name=f"BaZi teacher rule library / {teacher_name}",
                    source_type="internal_curated_knowledge",
                    source_language_codes=["zh"],
                    authority_level="B",
                    document_slug=item_id,
                    doc_type="article",
                    title=title,
                    language_code="zh",
                    publisher="Oraya",
                    authors=[{"name": teacher_name}],
                    abstract_text=str(item.get("claim") or title).strip(),
                    summary_zh=str(item.get("interpretation") or "").strip(),
                    canonical_url=f"oraya://knowledge/bazi/{teacher_name}/{item_id}",
                    content=content,
                    metadata=metadata,
                )
            )
    return documents


def split_text(text: str, max_chars: int, overlap: int) -> list[str]:
    paragraphs = [part.strip() for part in text.split("\n") if part.strip()]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        candidate = paragraph if not current else f"{current}\n{paragraph}"
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            chunks.append(current.strip())
        if len(paragraph) <= max_chars:
            current = paragraph
            continue
        start = 0
        while start < len(paragraph):
            end = min(start + max_chars, len(paragraph))
            segment = paragraph[start:end].strip()
            if segment:
                chunks.append(segment)
            if end >= len(paragraph):
                break
            start = max(end - overlap, start + 1)
        current = ""

    if current:
        chunks.append(current.strip())
    return chunks


def estimate_token_count(text: str) -> int:
    return max(1, math.ceil(len(text) / 4))


class EmbeddingsClient:
    def __init__(self, provider: str, api_key: str, model: str, batch_size: int):
        self.provider = provider
        self.api_key = api_key
        self.model = model
        self.batch_size = batch_size

    def _embed_openai(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        total = len(texts)
        for start in range(0, total, self.batch_size):
            batch = texts[start : start + self.batch_size]
            batch_no = (start // self.batch_size) + 1
            batch_total = math.ceil(total / self.batch_size)
            print(f"[embed:{self.provider}] batch {batch_no}/{batch_total} ({len(batch)} chunks)")
            payload = {"model": self.model, "input": batch}
            result = self._post_json_with_retry(
                "https://api.openai.com/v1/embeddings",
                payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}",
                },
                label=f"openai batch {batch_no}/{batch_total}",
            )
            data = result.get("data", [])
            if len(data) != len(batch):
                raise RuntimeError(
                    f"Embedding count mismatch: expected {len(batch)} vectors, got {len(data)}"
                )
            vectors.extend([item["embedding"] for item in data])
        return vectors

    def _embed_qwen(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        qwen_batch_size = min(self.batch_size, 10)
        total = len(texts)
        for start in range(0, total, qwen_batch_size):
            batch = texts[start : start + qwen_batch_size]
            batch_no = (start // qwen_batch_size) + 1
            batch_total = math.ceil(total / qwen_batch_size)
            print(f"[embed:{self.provider}] batch {batch_no}/{batch_total} ({len(batch)} chunks)")
            payload = {
                "model": self.model,
                "input": batch,
                "dimensions": DEFAULT_QWEN_DIMENSIONS,
            }
            result = self._post_json_with_retry(
                "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/embeddings",
                payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}",
                },
                label=f"qwen batch {batch_no}/{batch_total}",
            )
            data = result.get("data", [])
            if len(data) != len(batch):
                raise RuntimeError(
                    f"Embedding count mismatch: expected {len(batch)} vectors, got {len(data)}"
                )
            vectors.extend([item["embedding"] for item in data])
        return vectors

    def embed(self, texts: list[str]) -> list[list[float]]:
        if self.provider == "qwen":
            return self._embed_qwen(texts)
        if self.provider == "openai":
            return self._embed_openai(texts)
        raise RuntimeError(f"Unsupported embedding provider: {self.provider}")

    def _post_json_with_retry(
        self,
        url: str,
        payload: dict[str, Any],
        headers: dict[str, str],
        label: str,
        max_attempts: int = 5,
    ) -> dict[str, Any]:
        body_bytes = json.dumps(payload).encode("utf-8")
        for attempt in range(1, max_attempts + 1):
            request = urllib.request.Request(
                url,
                data=body_bytes,
                headers=headers,
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as error:
                error_body = error.read().decode("utf-8", errors="replace")
                if error.code in RETRYABLE_HTTP_CODES and attempt < max_attempts:
                    sleep_seconds = min(2 ** (attempt - 1), 8)
                    print(
                        f"[embed:{self.provider}] retry {attempt}/{max_attempts - 1} after HTTP {error.code} "
                        f"on {label}; sleeping {sleep_seconds}s"
                    )
                    time.sleep(sleep_seconds)
                    continue
                provider_name = "Qwen" if self.provider == "qwen" else "Embedding"
                raise RuntimeError(
                    f"{provider_name} embedding request failed: HTTP {error.code} {error_body}"
                ) from error


class SupabaseRestClient:
    def __init__(self, base_url: str, service_role_key: str):
        self.base_url = base_url.rstrip("/")
        self.service_role_key = service_role_key

    def upsert(
        self,
        table: str,
        rows: list[dict[str, Any]],
        on_conflict: str = "id",
        batch_size: int | None = None,
    ) -> None:
        if not rows:
            return
        total = len(rows)
        effective_batch_size = batch_size or total
        endpoint = f"{self.base_url}/rest/v1/{table}?on_conflict={urllib.parse.quote(on_conflict)}"
        headers = {
            "Content-Type": "application/json",
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }
        for start in range(0, total, effective_batch_size):
            batch = rows[start : start + effective_batch_size]
            batch_no = (start // effective_batch_size) + 1
            batch_total = math.ceil(total / effective_batch_size)
            print(f"[supabase] upserting {len(batch)} row(s) into {table} (batch {batch_no}/{batch_total})")
            request = urllib.request.Request(
                endpoint,
                data=json.dumps(batch, ensure_ascii=False).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    if response.status >= 300:
                        body = response.read().decode("utf-8", errors="replace")
                        raise RuntimeError(f"Supabase upsert failed: HTTP {response.status} {body}")
            except urllib.error.HTTPError as error:
                body = error.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"Supabase upsert failed for {table}: HTTP {error.code} {body}") from error


def prepare_documents(scopes: list[str]) -> list[KnowledgeDocument]:
    documents: list[KnowledgeDocument] = []
    if "qimen" in scopes:
        documents.extend(assemble_qimen_documents())
    if "bazi" in scopes:
        documents.extend(assemble_bazi_documents())
    return documents


def ensure_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def ensure_any_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    raise SystemExit(f"Missing required environment variable. Expected one of: {', '.join(names)}")


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if value.startswith(("\"", "'")) and value.endswith(("\"", "'")) and len(value) >= 2:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def build_source_row(document: KnowledgeDocument) -> dict[str, Any]:
    source_id = stable_uuid(f"source::{document.source_slug}")
    return {
        "id": source_id,
        "name": document.source_name,
        "source_type": document.source_type,
        "home_url": None,
        "country_code": None,
        "language_codes": document.source_language_codes,
        "authority_level": document.authority_level,
        "license_notes": "Internal Oraya knowledge base",
        "is_active": True,
    }


def build_document_rows(
    documents: list[KnowledgeDocument],
    chunk_size: int,
    chunk_overlap: int,
    embeddings: EmbeddingsClient | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], dict[str, int]]:
    source_rows: dict[str, dict[str, Any]] = {}
    document_rows: list[dict[str, Any]] = []
    version_rows: list[dict[str, Any]] = []
    chunk_rows: list[dict[str, Any]] = []

    pending_chunk_texts: list[str] = []
    pending_chunk_indices: list[int] = []

    for document in documents:
        source_row = build_source_row(document)
        source_rows[source_row["id"]] = source_row

        document_id = stable_uuid(f"document::{document.canonical_url}")
        version_id = stable_uuid(f"version::{document_id}::1")
        doc_metadata = dict(document.metadata)
        doc_metadata.setdefault("canonical_url", document.canonical_url)

        document_rows.append(
            {
                "id": document_id,
                "source_id": source_row["id"],
                "doc_type": document.doc_type,
                "title": document.title,
                "title_zh": document.title if document.language_code == "zh" else None,
                "language_code": document.language_code,
                "publisher": document.publisher,
                "authors": document.authors,
                "abstract_text": document.abstract_text or None,
                "summary_zh": document.summary_zh or None,
                "canonical_url": document.canonical_url,
                "publish_date": None,
                "doi": None,
                "patent_number": None,
                "standard_code": None,
                "video_platform": None,
                "full_text_status": "full_text",
                "review_status": "approved",
                "authority_level": document.authority_level,
                "metadata": doc_metadata,
            }
        )

        version_rows.append(
            {
                "id": version_id,
                "document_id": document_id,
                "version_no": 1,
                "raw_content_uri": document.canonical_url,
                "extracted_text": document.content,
                "translated_text_zh": document.content if document.language_code == "zh" else None,
                "extraction_metadata": {
                    "chunk_size": chunk_size,
                    "chunk_overlap": chunk_overlap,
                    "ingest_scope": document.metadata.get("scope"),
                },
            }
        )

        chunks = split_text(document.content, chunk_size, chunk_overlap)
        for chunk_index, chunk_text in enumerate(chunks):
            chunk_id = stable_uuid(f"chunk::{document_id}::{chunk_index}")
            chunk_rows.append(
                {
                    "id": chunk_id,
                    "document_id": document_id,
                    "version_id": version_id,
                    "chunk_index": chunk_index,
                    "section_title": document.title,
                    "language_code": document.language_code,
                    "content": chunk_text,
                    "content_zh": chunk_text if document.language_code == "zh" else None,
                    "token_count": estimate_token_count(chunk_text),
                    "embedding": None,
                    "metadata": {
                        "scope": document.metadata.get("scope"),
                        "collection": document.metadata.get("collection"),
                        "question_type": document.metadata.get("question_type"),
                        "document_slug": document.document_slug,
                        "canonical_url": document.canonical_url,
                    },
                }
            )
            pending_chunk_texts.append(chunk_text)
            pending_chunk_indices.append(len(chunk_rows) - 1)

    if embeddings and pending_chunk_texts:
        vectors = embeddings.embed(pending_chunk_texts)
        for target_index, vector in zip(pending_chunk_indices, vectors, strict=True):
            chunk_rows[target_index]["embedding"] = vector

    stats = {
        "sources": len(source_rows),
        "documents": len(document_rows),
        "versions": len(version_rows),
        "chunks": len(chunk_rows),
    }
    return list(source_rows.values()), document_rows, version_rows, chunk_rows, stats


def print_summary(scope: list[str], stats: dict[str, int], dry_run: bool) -> None:
    prefix = "Dry run" if dry_run else "Prepared"
    print(
        textwrap.dedent(
            f"""
            {prefix} knowledge vector import
              scopes: {", ".join(scope)}
              sources: {stats['sources']}
              documents: {stats['documents']}
              versions: {stats['versions']}
              chunks: {stats['chunks']}
            """
        ).strip()
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Chunk curated knowledge, embed it, and upload it into Supabase pgvector tables."
    )
    parser.add_argument(
        "--scope",
        choices=["qimen", "bazi", "all"],
        default="all",
        help="Which knowledge scope to import.",
    )
    parser.add_argument("--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE)
    parser.add_argument("--chunk-overlap", type=int, default=DEFAULT_CHUNK_OVERLAP)
    parser.add_argument(
        "--embed-provider",
        choices=["qwen", "openai"],
        default=DEFAULT_EMBED_PROVIDER,
        help="Embedding provider for chunk vectors.",
    )
    parser.add_argument("--embed-model", default=DEFAULT_EMBED_MODEL)
    parser.add_argument("--embed-batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument(
        "--env-file",
        default=DEFAULT_ENV_FILE,
        help="Optional dotenv-style file to preload SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and embedding API keys.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print counts without calling embeddings or Supabase.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_env_file(Path(args.env_file).expanduser())
    scopes = ["qimen", "bazi"] if args.scope == "all" else [args.scope]

    documents = prepare_documents(scopes)
    if not documents:
        raise SystemExit("No knowledge documents found for the requested scope.")

    embeddings: EmbeddingsClient | None = None
    if not args.dry_run:
        api_key = ensure_env("DASHSCOPE_API_KEY" if args.embed_provider == "qwen" else "OPENAI_API_KEY")
        embeddings = EmbeddingsClient(
            provider=args.embed_provider,
            api_key=api_key,
            model=args.embed_model,
            batch_size=args.embed_batch_size,
        )

    source_rows, document_rows, version_rows, chunk_rows, stats = build_document_rows(
        documents=documents,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        embeddings=embeddings,
    )
    print_summary(scopes, stats, args.dry_run)

    if args.dry_run:
        return 0

    supabase_url = ensure_env("SUPABASE_URL")
    supabase_secret = ensure_any_env("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    client = SupabaseRestClient(supabase_url, supabase_secret)
    client.upsert("sources", source_rows, batch_size=50)
    client.upsert("documents", document_rows, batch_size=100)
    client.upsert("document_versions", version_rows, batch_size=100)
    client.upsert("document_chunks", chunk_rows, batch_size=100)
    print("Uploaded knowledge vectors to Supabase.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
