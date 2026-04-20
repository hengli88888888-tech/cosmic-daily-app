#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from upload_knowledge_vectors_to_supabase import (
    DEFAULT_CHUNK_OVERLAP,
    DEFAULT_CHUNK_SIZE,
    build_document_rows,
    ensure_any_env,
    ensure_env,
    load_env_file,
    prepare_documents,
)


DEFAULT_ENV_FILE = ".env.knowledge-import"


class SupabaseRestAuditClient:
    def __init__(self, base_url: str, secret: str):
        self.base_url = base_url.rstrip("/")
        self.secret = secret

    def fetch_ids(self, table: str, page_size: int = 1000) -> list[str]:
        start = 0
        ids: list[str] = []
        headers = {
            "apikey": self.secret,
            "Authorization": f"Bearer {self.secret}",
        }
        while True:
            end = start + page_size - 1
            endpoint = (
                f"{self.base_url}/rest/v1/{table}"
                f"?select=id&order=id.asc"
            )
            request = urllib.request.Request(endpoint, headers=headers, method="GET")
            request.add_header("Range-Unit", "items")
            request.add_header("Range", f"{start}-{end}")
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    rows = json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as error:
                body = error.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"Supabase audit fetch failed for {table}: HTTP {error.code} {body}") from error

            if not rows:
                break
            ids.extend(str(row["id"]) for row in rows)
            if len(rows) < page_size:
                break
            start += page_size
        return ids


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit knowledge vector completeness in Supabase.")
    parser.add_argument(
        "--scope",
        choices=["qimen", "bazi", "all"],
        default="all",
        help="Which scope to audit.",
    )
    parser.add_argument(
        "--env-file",
        default=DEFAULT_ENV_FILE,
        help="Optional dotenv-style file with Supabase keys.",
    )
    parser.add_argument(
        "--sample-limit",
        type=int,
        default=10,
        help="How many missing/extra IDs to print per table.",
    )
    return parser.parse_args()


def print_table_audit(
    table: str,
    expected_ids: list[str],
    actual_ids: list[str],
    sample_limit: int,
) -> bool:
    expected_set = set(expected_ids)
    actual_set = set(actual_ids)
    missing = sorted(expected_set - actual_set)
    extra = sorted(actual_set - expected_set)
    ok = not missing and not extra

    print(f"\n[{table}]")
    print(f"  expected: {len(expected_ids)}")
    print(f"  actual:   {len(actual_ids)}")
    print(f"  missing:  {len(missing)}")
    print(f"  extra:    {len(extra)}")

    if missing:
        print("  sample missing:")
        for item in missing[:sample_limit]:
            print(f"    - {item}")
    if extra:
        print("  sample extra:")
        for item in extra[:sample_limit]:
            print(f"    - {item}")
    return ok


def main() -> int:
    args = parse_args()
    load_env_file(Path(args.env_file).expanduser())

    scopes = ["qimen", "bazi"] if args.scope == "all" else [args.scope]
    documents = prepare_documents(scopes)
    source_rows, document_rows, version_rows, chunk_rows, _stats = build_document_rows(
        documents=documents,
        chunk_size=DEFAULT_CHUNK_SIZE,
        chunk_overlap=DEFAULT_CHUNK_OVERLAP,
        embeddings=None,
    )

    expected = {
        "sources": [row["id"] for row in source_rows],
        "documents": [row["id"] for row in document_rows],
        "document_versions": [row["id"] for row in version_rows],
        "document_chunks": [row["id"] for row in chunk_rows],
    }

    supabase_url = ensure_env("SUPABASE_URL")
    supabase_secret = ensure_any_env("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    client = SupabaseRestAuditClient(supabase_url, supabase_secret)

    all_ok = True
    for table, expected_ids in expected.items():
        actual_ids = client.fetch_ids(table)
        all_ok = print_table_audit(table, expected_ids, actual_ids, args.sample_limit) and all_ok

    print("\nOverall:", "OK" if all_ok else "MISMATCH")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
