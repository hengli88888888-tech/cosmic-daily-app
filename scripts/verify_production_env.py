#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
ENV_CLOUD = ROOT / ".env.cloud"
ENV_KNOWLEDGE = ROOT / ".env.knowledge-import"
PRODUCTION_PROJECT_REF = "lckhqitjvnszcojppnnh"


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        raise RuntimeError(f"Missing required env file: {path.name}")
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def project_ref_from_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    host = parsed.netloc
    if not parsed.scheme.startswith("https") or not host.endswith(".supabase.co"):
        raise RuntimeError(f"SUPABASE_URL must be a hosted Supabase URL, got: {raw_url}")
    return host.split(".")[0]


def require_key(values: dict[str, str], key: str, source: str) -> str:
    value = values.get(key, "").strip()
    if not value:
        raise RuntimeError(f"{source} is missing {key}")
    return value


def main() -> int:
    cloud = load_env_file(ENV_CLOUD)
    knowledge = load_env_file(ENV_KNOWLEDGE)

    cloud_url = require_key(cloud, "SUPABASE_URL", ENV_CLOUD.name)
    cloud_anon_key = require_key(cloud, "SUPABASE_ANON_KEY", ENV_CLOUD.name)
    knowledge_url = require_key(knowledge, "SUPABASE_URL", ENV_KNOWLEDGE.name)
    knowledge_secret_key = knowledge.get("SUPABASE_SECRET_KEY") or knowledge.get("SUPABASE_SERVICE_ROLE_KEY")

    if not knowledge_secret_key:
        raise RuntimeError(f"{ENV_KNOWLEDGE.name} is missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY")

    cloud_ref = project_ref_from_url(cloud_url)
    knowledge_ref = project_ref_from_url(knowledge_url)

    if cloud_ref != knowledge_ref:
        raise RuntimeError(
            f"Cloud app env and knowledge import env point to different projects: "
            f"{cloud_ref} != {knowledge_ref}"
        )

    if cloud_ref != PRODUCTION_PROJECT_REF:
        raise RuntimeError(
            f"Configured Supabase project is {cloud_ref}, expected production {PRODUCTION_PROJECT_REF}"
        )

    if "localhost" in cloud_url or "127.0.0.1" in cloud_url:
        raise RuntimeError("Production SUPABASE_URL must not point to localhost")

    if len(cloud_anon_key) < 20 or len(knowledge_secret_key) < 20:
        raise RuntimeError("Supabase keys look too short; verify env files before launch")

    print(f"Production Supabase project verified: {cloud_ref}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Production env verification failed: {error}", file=sys.stderr)
        raise SystemExit(1)
