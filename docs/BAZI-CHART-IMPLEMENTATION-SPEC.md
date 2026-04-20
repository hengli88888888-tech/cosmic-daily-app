# BaZi Chart Implementation Spec

This app now has a dedicated chart-engine spec layer in `/specs/chart-engine`.

Locked implementation rules:

- Zi hour day-boundary: `23:00` starts the next day.
- True solar time pipeline:
  - local civil time
  - DST correction
  - UTC conversion
  - longitude correction
  - equation of time
  - true solar time
- Dayun start:
  - `3 days = 1 year`
  - `1 day = 4 months`
  - `start age = floor(total_days / 3)`
  - `remaining months = floor(remaining_days * 4)`

Structured rule assets:

- `/specs/chart-engine/time-rules.json`
- `/specs/chart-engine/twelve-life-stages.json`
- `/specs/chart-engine/nayin-table.json`
- `/specs/chart-engine/shensha-rules.json`

Engineering decisions:

- Use IANA timezone data as the primary source for timezone and DST transitions.
- Use custom historical overrides only when timezone data is ambiguous for the supported date range.
- Keep interpretation logic separate from chart calculation logic.
- Output should clearly expose whether a chart came from a verified engine or from fallback logic.
