# QiMen Teacher Routing

This file records which teacher chain should run for which kind of QiMen question.

Current production split:

- primary online teacher: `王兴兵`
- gray teachers: `钟波`, `文艺复兴`
- offline regression teachers only: `王永源`, `苗道长`

Why this split:

- the historical strict rerun baseline has reached `exact_match = 214`
- `career_work`, `money_wealth`, and regular `health_energy` questions are already highly converged
- the remaining historical `majority_same_as_wang` cases are concentrated in `love_relationship`
- low-frequency environmental or public-event questions still have sparse coverage and wider semantic spread

Current historical baseline used for this routing:

- report: `/Users/liheng/Desktop/cosmic-daily-app/data/import-runs/qimen-yangpan/qimen-teacher-strict-rerun-report.json`
- `career_work`: `65/65 all_same_result`
- `money_wealth`: `52/52 all_same_result`
- `health_energy`: only one non-fully-converged item, and it is a public-event edge case
- `love_relationship`: `11` `majority_same_as_wang` cases

Online routing rules:

- always run only `王兴兵` by default
- also run gray teachers for `love_relationship`
- also run gray teachers for low-frequency environmental or public-event questions

Environmental/public-event gray triggers:

- weather or rainfall
- flood or disaster-news verification
- house anomaly, grave influence, treasure-type questions
- border standoff, international trade, election, or other public-event forecasting

Current code entry points:

- routing policy:
  - `/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/functions/_shared/qimen-reasoning-engine.ts`
- production execution:
  - `/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/functions/master-reply-submit/index.ts`
- offline five-teacher regression:
  - `/Users/liheng/Desktop/cosmic-daily-app/scripts/run_qimen_teacher_strict_rerun.ts`

Generated routing report:

- markdown:
  - `/Users/liheng/Desktop/cosmic-daily-app/data/import-runs/qimen-yangpan/qimen-teacher-routing-report.md`
- json:
  - `/Users/liheng/Desktop/cosmic-daily-app/data/import-runs/qimen-yangpan/qimen-teacher-routing-report.json`

Operational rules:

- do not use five-teacher full runs in the online main path
- do not remove the five-teacher matrix from strict rerun
- if a new prospective miss appears, debug against four buckets first:
  - `plate_engine`
  - `question_routing`
  - `timing_expression`
  - `result_normalization`
- if repeated prospective misses cluster outside `love_relationship`, revisit this routing file before expanding gray coverage
