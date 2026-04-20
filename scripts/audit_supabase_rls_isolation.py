#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[1]


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def require_env(*keys: str) -> str:
    for key in keys:
        value = os.environ.get(key, "").strip()
        if value:
            return value
    raise SystemExit(f"Missing required env: {' or '.join(keys)}")


def request_json(
    method: str,
    url: str,
    headers: dict[str, str],
    body: object | None = None,
) -> tuple[int, object]:
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode()
            if not raw:
                return response.status, None
            return response.status, json.loads(raw)
    except urllib.error.HTTPError as error:
        raw = error.read().decode()
        try:
            payload: object = json.loads(raw)
        except Exception:
            payload = raw
        return error.code, payload


@dataclass(frozen=True)
class Session:
    user_id: str
    token: str


def make_headers(api_key: str, bearer: str | None = None, extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {bearer or api_key}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def anonymous_signup(supabase_url: str, anon_key: str) -> Session:
    status, payload = request_json(
        "POST",
        f"{supabase_url}/auth/v1/signup",
        make_headers(anon_key),
        {
            "data": {},
            "gotrue_meta_security": {},
            "code_challenge": None,
            "code_challenge_method": None,
        },
    )
    if status != 200 or not isinstance(payload, dict):
        raise RuntimeError(f"anonymous signup failed: {status} {payload}")
    return Session(user_id=payload["user"]["id"], token=payload["access_token"])


def rest_url(supabase_url: str, table: str, query: str = "") -> str:
    suffix = f"?{query}" if query else ""
    return f"{supabase_url}/rest/v1/{table}{suffix}"


def insert_rows(supabase_url: str, secret_key: str, table: str, rows: list[dict[str, object]]) -> None:
    status, payload = request_json(
        "POST",
        rest_url(supabase_url, table),
        make_headers(secret_key, extra={"Prefer": "return=minimal"}),
        rows,
    )
    if status not in (200, 201, 204):
        raise RuntimeError(f"seed {table} failed: {status} {payload}")


def delete_where_in(supabase_url: str, secret_key: str, table: str, column: str, values: list[str]) -> None:
    if not values:
        return
    encoded = ",".join(values)
    status, payload = request_json(
        "DELETE",
        rest_url(supabase_url, table, f"{column}=in.({encoded})"),
        make_headers(secret_key, extra={"Prefer": "return=minimal"}),
    )
    if status not in (200, 204):
        raise RuntimeError(f"cleanup {table} failed: {status} {payload}")


def select_rows(
    supabase_url: str,
    anon_key: str,
    session: Session,
    table: str,
    query: str,
) -> list[dict[str, object]]:
    status, payload = request_json(
        "GET",
        rest_url(supabase_url, table, query),
        make_headers(anon_key, bearer=session.token),
    )
    if status != 200 or not isinstance(payload, list):
        raise RuntimeError(f"select {table} failed: {status} {payload}")
    return payload


def assert_count(label: str, rows: list[dict[str, object]], expected: int) -> None:
    if len(rows) != expected:
        raise AssertionError(f"{label}: expected {expected}, got {len(rows)}")
    print(f"  OK {label}: {expected}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Supabase RLS user isolation with two anonymous users.")
    parser.add_argument(
        "--env",
        default=str(ROOT / ".env.cloud"),
        help="dotenv file with SUPABASE_URL and SUPABASE_ANON_KEY",
    )
    parser.add_argument(
        "--secret-env",
        default=str(ROOT / ".env.knowledge-import"),
        help="dotenv file with SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    )
    parser.add_argument("--keep-seed", action="store_true", help="Do not clean up seeded rows.")
    args = parser.parse_args()

    load_env(Path(args.env))
    load_env(Path(args.secret_env))
    supabase_url = require_env("SUPABASE_URL").rstrip("/")
    anon_key = require_env("SUPABASE_ANON_KEY")
    secret_key = require_env("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY")

    print("Creating two anonymous sessions...")
    user_a = anonymous_signup(supabase_url, anon_key)
    user_b = anonymous_signup(supabase_url, anon_key)
    run_id = f"rls_audit_{uuid4().hex[:12]}"
    question_a = str(uuid4())
    question_b = str(uuid4())

    print("Seeding isolated test rows with service role...")
    insert_rows(
        supabase_url,
        secret_key,
        "users",
        [
            {"id": user_a.user_id, "email": None},
            {"id": user_b.user_id, "email": None},
        ],
    )
    insert_rows(
        supabase_url,
        secret_key,
        "profiles",
        [
            {"user_id": user_a.user_id, "timezone": "UTC", "language": "en", "intent": run_id},
            {"user_id": user_b.user_id, "timezone": "UTC", "language": "en", "intent": run_id},
        ],
    )
    insert_rows(
        supabase_url,
        secret_key,
        "coin_wallets",
        [
            {"user_id": user_a.user_id, "balance": 11},
            {"user_id": user_b.user_id, "balance": 22},
        ],
    )
    insert_rows(
        supabase_url,
        secret_key,
        "master_questions",
        [
            {
                "id": question_a,
                "user_id": user_a.user_id,
                "question_text": f"{run_id} user A question",
                "category": "audit",
                "status": "delivered",
            },
            {
                "id": question_b,
                "user_id": user_b.user_id,
                "question_text": f"{run_id} user B question",
                "category": "audit",
                "status": "delivered",
            },
        ],
    )
    insert_rows(
        supabase_url,
        secret_key,
        "qimen_outcome_feedback",
        [
            {"thread_id": question_a, "user_id": user_a.user_id, "user_feedback": f"{run_id} feedback A"},
            {"thread_id": question_b, "user_id": user_b.user_id, "user_feedback": f"{run_id} feedback B"},
        ],
    )

    try:
        print("Checking direct REST visibility as user A...")
        for table, id_column, own_id, other_id in [
            ("profiles", "user_id", user_a.user_id, user_b.user_id),
            ("coin_wallets", "user_id", user_a.user_id, user_b.user_id),
            ("master_questions", "user_id", user_a.user_id, user_b.user_id),
        ]:
            assert_count(
                f"{table} own row visible",
                select_rows(supabase_url, anon_key, user_a, table, f"select=*&{id_column}=eq.{own_id}"),
                1,
            )
            assert_count(
                f"{table} other row hidden",
                select_rows(supabase_url, anon_key, user_a, table, f"select=*&{id_column}=eq.{other_id}"),
                0,
            )
            unfiltered = select_rows(supabase_url, anon_key, user_a, table, "select=*")
            leaked = [row for row in unfiltered if row.get("user_id") == other_id]
            assert_count(f"{table} unfiltered leak check", leaked, 0)

        print("Checking feedback table direct REST visibility...")
        assert_count(
            "qimen_outcome_feedback own row not directly exposed",
            select_rows(
                supabase_url,
                anon_key,
                user_a,
                "qimen_outcome_feedback",
                f"select=*&user_id=eq.{user_a.user_id}",
            ),
            0,
        )
        assert_count(
            "qimen_outcome_feedback other row hidden",
            select_rows(
                supabase_url,
                anon_key,
                user_a,
                "qimen_outcome_feedback",
                f"select=*&user_id=eq.{user_b.user_id}",
            ),
            0,
        )

        print("RLS isolation audit passed.")
        return 0
    finally:
        if not args.keep_seed:
            print("Cleaning up seeded rows...")
            delete_where_in(supabase_url, secret_key, "qimen_outcome_feedback", "thread_id", [question_a, question_b])
            delete_where_in(supabase_url, secret_key, "master_questions", "id", [question_a, question_b])
            delete_where_in(supabase_url, secret_key, "coin_wallets", "user_id", [user_a.user_id, user_b.user_id])
            delete_where_in(supabase_url, secret_key, "profiles", "user_id", [user_a.user_id, user_b.user_id])
            delete_where_in(supabase_url, secret_key, "users", "id", [user_a.user_id, user_b.user_id])


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"RLS isolation audit failed: {error}", file=sys.stderr)
        raise SystemExit(1)
