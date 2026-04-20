#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from upload_knowledge_vectors_to_supabase import (
    DEFAULT_EMBED_MODEL,
    EmbeddingsClient,
    ensure_any_env,
    ensure_env,
    load_env_file,
)


DEFAULT_ENV_FILE = ".env.knowledge-import"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate Supabase knowledge vector retrieval with a natural-language query."
    )
    parser.add_argument("query", help="Natural-language query to embed and search.")
    parser.add_argument("--top-k", type=int, default=5, help="How many matches to return.")
    parser.add_argument(
        "--scope",
        choices=["qimen", "bazi"],
        default=None,
        help="Optional scope filter.",
    )
    parser.add_argument("--question-type", default=None, help="Optional question_type metadata filter.")
    parser.add_argument("--collection", default=None, help="Optional collection metadata filter.")
    parser.add_argument("--language-code", default=None, help="Optional language filter.")
    parser.add_argument(
        "--no-title-dedupe",
        action="store_true",
        help="Disable title-level dedupe in both RPC payload and local output.",
    )
    parser.add_argument(
        "--embed-provider",
        choices=["qwen", "openai"],
        default="qwen",
        help="Embedding provider for the query vector.",
    )
    parser.add_argument("--embed-model", default=DEFAULT_EMBED_MODEL)
    parser.add_argument(
        "--env-file",
        default=DEFAULT_ENV_FILE,
        help="Optional dotenv-style file with Supabase and embedding API keys.",
    )
    return parser.parse_args()


def call_match_rpc(
    supabase_url: str,
    supabase_secret: str,
    query_embedding: list[float],
    top_k: int,
    scope: str | None,
    language_code: str | None,
    question_type: str | None,
    collection: str | None,
    dedupe_by_title: bool,
) -> list[dict[str, Any]]:
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/rpc/match_document_chunks"
    payload = {
        "query_embedding": query_embedding,
        "match_count": top_k,
        "filter_scope": scope,
        "filter_language_code": language_code,
        "filter_question_type": question_type,
        "filter_collection": collection,
        "dedupe_by_title": dedupe_by_title,
    }
    headers = {
        "Content-Type": "application/json",
        "apikey": supabase_secret,
        "Authorization": f"Bearer {supabase_secret}",
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        # Backward compatibility: if the RPC in Supabase has not yet been updated
        # to the newest signature, retry with the older payload shape.
        if (
            error.code == 404
            and "dedupe_by_title" in body
        ):
            legacy_payload = {
                "query_embedding": query_embedding,
                "match_count": top_k,
                "filter_scope": scope,
                "filter_language_code": language_code,
                "filter_question_type": question_type,
                "filter_collection": collection,
            }
            legacy_request = urllib.request.Request(
                endpoint,
                data=json.dumps(legacy_payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            try:
                with urllib.request.urlopen(legacy_request, timeout=120) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as legacy_error:
                legacy_body = legacy_error.read().decode("utf-8", errors="replace")
                raise RuntimeError(
                    f"Supabase RPC match_document_chunks failed: HTTP {legacy_error.code} {legacy_body}"
                ) from legacy_error
        raise RuntimeError(f"Supabase RPC match_document_chunks failed: HTTP {error.code} {body}") from error


def preview(text: str, max_chars: int = 180) -> str:
    single_line = " ".join(text.split())
    if len(single_line) <= max_chars:
        return single_line
    return f"{single_line[: max_chars - 1].rstrip()}..."


def dedupe_matches_by_title(rows: list[dict[str, Any]], top_k: int) -> list[dict[str, Any]]:
    seen_titles: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for row in rows:
        title = str(row.get("title") or "").strip()
        if title in seen_titles:
            continue
        seen_titles.add(title)
        deduped.append(row)
        if len(deduped) >= top_k:
            break
    return deduped


def main() -> int:
    args = parse_args()
    load_env_file(Path(args.env_file).expanduser())

    supabase_url = ensure_env("SUPABASE_URL")
    supabase_secret = ensure_any_env("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    api_key = ensure_env("DASHSCOPE_API_KEY" if args.embed_provider == "qwen" else "OPENAI_API_KEY")

    embeddings = EmbeddingsClient(
        provider=args.embed_provider,
        api_key=api_key,
        model=args.embed_model,
        batch_size=1,
    )
    vector = embeddings.embed([args.query])[0]
    matches = call_match_rpc(
        supabase_url=supabase_url,
        supabase_secret=supabase_secret,
        query_embedding=vector,
        top_k=args.top_k * 5 if not args.no_title_dedupe else args.top_k,
        scope=args.scope,
        language_code=args.language_code,
        question_type=args.question_type,
        collection=args.collection,
        dedupe_by_title=not args.no_title_dedupe,
    )
    if not args.no_title_dedupe:
        matches = dedupe_matches_by_title(matches, args.top_k)

    print(f"Query: {args.query}")
    if not matches:
        print("No matches.")
        return 0

    for index, row in enumerate(matches, start=1):
        metadata = row.get("metadata") or {}
        print(f"\n[{index}] {row['title']}  similarity={row['similarity']:.4f}")
        print(
            f"scope={metadata.get('scope')} question_type={metadata.get('question_type')} "
            f"collection={metadata.get('collection')} language={row['language_code']}"
        )
        print(f"url={row['canonical_url']}")
        print(preview(row["content"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
