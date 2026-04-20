# QiMen Knowledge Base

This directory stores reviewed QiMen Dun Jia course knowledge after multimodal ingestion.

Files:

- `qimen-case-cards.json`: reviewed case-level teaching cards
- `qimen-rule-cards.json`: reusable rule-level knowledge
- `qimen-reasoning-patterns.json`: teacher-specific reading order and reasoning patterns
- `qimen-term-notes.json`: stabilized terminology, aliases, and document-backed term notes
- `qimen-conflict-resolution-cards.json`: conflict and priority rules for resolving competing signals
- `qimen-tier-overrides.json`: persistent tier overrides applied on top of generated knowledge cards
- `qimen-keyword-index.json`: searchable keyword index from OCR, transcript excerpts, and reviewed cards
- `qimen-keywords-seed.json`: seed keyword list for index generation
- `qimen-segment-extraction-prompt-template.md`: optional AI enrichment prompt for editable draft fields

Notes:

- Production now uses `王兴兵` as the default online teacher.
- Gray online review is limited to `钟波` and `文艺复兴`, and only for `love_relationship` plus low-frequency environmental/public-event edge cases.
- Five-teacher full comparison is preserved only for offline strict rerun and regression.
- See `teacher-routing.md` for the current routing policy and rationale.
- Video segments and screenshots are the main evidence for dynamic reasoning order.
- Documents are used for term normalization, boundary notes, and conflict-resolution support.
- The backend matcher consumes the generated bundle at `/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/functions/_shared/generated-qimen-knowledge.ts`.
- Tier overrides are applied by `scripts/build_qimen_reasoning_assets.py` after generation so unstable `support` cards can be formally downgraded to `reference`.

The raw capture pipeline writes its intermediate evidence under `data/`, not in this folder.
