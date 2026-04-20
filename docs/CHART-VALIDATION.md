# Chart Validation

The current golden cases for the custom BaZi engine live in:

- `/Users/liheng/Desktop/cosmic-daily-app/specs/chart-engine/validation-cases.json`

They contain 30 user-provided reference cases covering:

- standard modern charts
- Li Chun / Jing Zhe / seasonal boundaries
- `23:00` zi-hour day rollover
- special structures such as `魁罡` and `十恶大败`
- international timezone / DST scenarios

## Run the validator

Start local Supabase and functions first, then run:

```bash
node scripts/verify_chart_engine_cases.mjs
```

If you want to compare the same cases against the 问真八字 public oracle instead of only the local engine, use:

```bash
node scripts/verify_against_wz_oracle.mjs
```

Two generated baselines are kept on disk:

- `/Users/liheng/Desktop/cosmic-daily-app/specs/chart-engine/wz-oracle-baseline.raw.json`
- `/Users/liheng/Desktop/cosmic-daily-app/specs/chart-engine/wz-oracle-baseline.product.json`

They represent two different comparison modes:

- `raw`: send the original civil time directly to 问真
- `product`: first apply our product rule set (`true solar time` front-loaded), then send the corrected time to 问真

There is also a diagnostic-only oracle mode in the script:

- `local_true_solar_beijing`

Use it only to inspect问真海外页的“北京时间语义”行为. Do not treat it as product truth, because it distorts overseas `day/hour` pillars even when it improves some month-boundary cases.

Optional environment variables:

```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=...
SUPABASE_ACCESS_TOKEN=...
CASE_LIMIT=5
```

Behavior:

- If `SUPABASE_ACCESS_TOKEN` is not supplied, the script creates a disposable auth user.
- It calls `chart-preview` for each case.
- It compares:
  - four pillars
  - `dayun.displayAge`
  - day pillar `十二长生`
  - `空亡`
  - `纳音`
  - `神煞`

For the 问真八字 oracle investigation notes, see:

- `/Users/liheng/Desktop/cosmic-daily-app/docs/WZ-ORACLE-INVESTIGATION.md`

## Current calibration status

As of the latest calibration round:

- the user-provided 30 cases do **not** match 问真 and should no longer be treated as external goldens
- `raw` vs 问真 is mostly useful for proving those old samples are off-source
- `product` mode now matches 问真 on `29 / 30` cases for the four pillars

The single remaining mismatch is:

- case `029` (`Rio de Janeiro`)

That case is not a generic pillar error. It exposes a different overseas flow in 问真:

- when we send `local true solar time` directly, 问真 still differs on the month pillar
- when that same corrected local time is first converted to **Beijing time** and then sent to 问真, the month pillar aligns

So the remaining gap is specifically about 问真海外页的“北京时间语义”转换，而不是当前自研引擎在本地时区真太阳时逻辑上的普遍错误。

## Random calibration rounds

To avoid overfitting only the named acceptance cases, random batches can be generated and replayed:

```bash
node /Users/liheng/Desktop/cosmic-daily-app/scripts/generate_random_chart_cases.mjs
CASES_PATH=/Users/liheng/Desktop/cosmic-daily-app/specs/chart-engine/random-calibration-cases.json \
INCLUDE_LOCAL=1 \
WZ_INPUT_MODE=local_true_solar \
node /Users/liheng/Desktop/cosmic-daily-app/scripts/verify_against_wz_oracle.mjs
```

Latest random replay:

- seed: `20260316`
- sample size: `40`
- case file: `/Users/liheng/Desktop/cosmic-daily-app/specs/chart-engine/random-calibration-cases.json`
- result: `localMatchedWz = 40 / 40` under `product` mode

That run is important because it confirms the current engine is not only fitting the named validation list; it also aligns with the 问真 oracle on a fresh random batch across domestic, DST, and overseas locations.

## Important

These cases are product acceptance targets supplied by the user. They are not derived from the current implementation.

That means:

- the validation script may currently report mismatches
- those mismatches should be treated as implementation gaps, not test-file errors
