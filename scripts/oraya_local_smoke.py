#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path


SUPABASE_URL = "http://127.0.0.1:54321"
SUPABASE_ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
BUILD_JS = Path(
    "/Users/liheng/Desktop/cosmic-daily-app/app/build/web/main.dart.js"
)


def post_json(url: str, body: dict, headers: dict[str, str]) -> tuple[int, object]:
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read().decode()
            return response.status, json.loads(payload)
    except urllib.error.HTTPError as error:
        payload = error.read().decode()
        try:
            data = json.loads(payload)
        except Exception:
            data = payload
        return error.code, data


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> int:
    print("Checking built web artifact...")
    require(BUILD_JS.exists(), f"Missing build artifact: {BUILD_JS}")
    build_text = BUILD_JS.read_text(encoding="utf-8", errors="ignore")
    require(
        "http://127.0.0.1:54321" in build_text,
        "build/web/main.dart.js does not contain local Supabase fallback URL.",
    )
    require(
        SUPABASE_ANON_KEY in build_text,
        "build/web/main.dart.js does not contain local Supabase fallback anon key.",
    )
    print("  OK: local web artifact is wired to local Supabase.")

    print("Creating anonymous session...")
    base_headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }
    status, signup = post_json(
        f"{SUPABASE_URL}/auth/v1/signup",
        {
            "data": {},
            "gotrue_meta_security": {},
            "code_challenge": None,
            "code_challenge_method": None,
        },
        base_headers,
    )
    require(status == 200, f"Anonymous signup failed: {status} {signup}")
    access_token = signup["access_token"]
    headers = {
        **base_headers,
        "Authorization": f"Bearer {access_token}",
    }
    print(f"  OK: anonymous user {signup['user']['id']}")

    print("Running create profile -> wallet -> messages -> first impression...")
    chain = [
        (
            "save-profile-and-chart",
            {
                "dob": "1991-06-28",
                "tob": "16:40",
                "birthplace": "Shanghai, Shanghai, China",
                "timezone": "Asia/Shanghai",
                "gender": "female",
                "intent": "general",
                "language": "en",
            },
        ),
        ("user-wallet", {}),
        ("member-daily-messages", {}),
        ("first-impression", {}),
    ]

    results: dict[str, object] = {}
    for function_name, body in chain:
        status, payload = post_json(
            f"{SUPABASE_URL}/functions/v1/{function_name}",
            body,
            headers,
        )
        require(status == 200, f"{function_name} failed: {status} {payload}")
        results[function_name] = payload
        print(f"  OK: {function_name}")

    save_result = results["save-profile-and-chart"]
    require(
        isinstance(save_result, dict)
        and save_result.get("verified_ready") is True
        and save_result.get("chart_source") == "verified_engine",
        f"save-profile-and-chart returned unexpected payload: {save_result}",
    )

    wallet_result = results["user-wallet"]
    require(
        isinstance(wallet_result, dict)
        and wallet_result.get("balance") == 6
        and wallet_result.get("freeFirstQuestionAvailable") is True,
        f"user-wallet returned unexpected payload: {wallet_result}",
    )

    impression_result = results["first-impression"]
    require(
        isinstance(impression_result, dict)
        and impression_result.get("ready") is True
        and impression_result.get("state") == "verified_ready"
        and len(impression_result.get("top3Insights") or []) == 3,
        f"first-impression returned unexpected payload: {impression_result}",
    )

    print("Smoke test passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Smoke test failed: {error}", file=sys.stderr)
        raise SystemExit(1)
