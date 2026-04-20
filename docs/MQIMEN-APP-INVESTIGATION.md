# mQimen.app Investigation

## Result

`/Applications/mQimen.app` is not a fully opaque native binary. It is an iOS/Cordova-style wrapper that exposes:

- bundled web assets
- a local SQLite database
- compressed JavaScript chart logic

This makes it technically inspectable.

## Bundle shape

Relevant paths:

- `/Applications/mQimen.app/Wrapper/mQimen.app/www/index.html`
- `/Applications/mQimen.app/Wrapper/mQimen.app/www/js/database.js`
- `/Applications/mQimen.app/Wrapper/mQimen.app/www/js/script.min.js`
- `/Applications/mQimen.app/Wrapper/mQimen.app/www/mqmfree.db`

Observed app metadata:

- bundle id: `com.stapplers.mqimen`
- display name: `mQimen`
- version: `6.1.0`

## What is inside

### Database

The bundled SQLite database contains:

- `ecliptic`
- `setting`

`ecliptic` currently spans:

- min: `1823-12-30 00:00:00`
- max: `2065-01-05 00:00:00`
- rows: `5786`

This strongly suggests the app relies on a precomputed solar-term / calendrical table rather than deriving everything from a single compact formula at runtime.

### JavaScript

`database.js` shows:

- the app queries the `ecliptic` table around the target datetime
- it passes those rows into `process_chart(...)`

`script.min.js` shows:

- chart logic lives in compressed JavaScript
- supported systems visible in UI strings:
  - `拆补`
  - `置闰`
  - `阴盘`
- chart metadata labels present:
  - `旬首`
  - `值符`
  - `值使`
  - `空亡`
  - `驿马`
- there is explicit `23:00` rollover logic that increments the day stem and branch

## Practical conclusion

### Yes, it can be inspected

Technically, yes. This app is inspectable enough to:

- compare output behavior
- study solar-term reference behavior
- study duty star / duty gate placement behavior
- confirm boundary handling such as `23:00` rollover

### No, it should not be our implementation source

Using it as a direct implementation source is the wrong path.

Reasons:

- the logic is compressed and vendor-specific
- internal assumptions are mixed into minified UI code
- copying vendor code creates avoidable licensing and maintenance risk
- our plugin needs an explicit, auditable rule profile, not a reverse-engineered black box

## Recommended use

Use `mQimen.app` as an **oracle** and **reference asset**, not as source code to transplant.

Recommended roles:

- oracle validation target
- solar-term boundary reference
- bureau behavior comparison
- duty star / duty gate comparison target

Avoid:

- direct code copy
- embedding the vendor database or assets into our production plugin
- treating its minified JavaScript as our primary engine design

## Repo assets

Structured findings have been captured in:

- `/Users/liheng/Desktop/cosmic-daily-app/specs/qimen-engine/mqimen-oracle-profile.json`
- `/Users/liheng/Desktop/cosmic-daily-app/scripts/inspect_mqimen_oracle.py`

To regenerate the inspection report:

```bash
python3 /Users/liheng/Desktop/cosmic-daily-app/scripts/inspect_mqimen_oracle.py
```
