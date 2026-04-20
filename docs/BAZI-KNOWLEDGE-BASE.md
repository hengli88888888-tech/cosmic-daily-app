# BaZi Knowledge Base

## Goal
Build a private internal knowledge base that supports:

- structured BaZi interpretation
- daily guidance generation
- annual insight generation
- expert-review writing

This knowledge base is internal only. It should never expose detailed mechanics such as pillar calculation logic, hidden stems, or rule names directly to end users unless explicitly intended.

## Design Principles

1. Separate raw metaphysics from product wording.
2. Store rules in structured form before turning them into prose.
3. Keep each rule small, testable, and composable.
4. Distinguish hard rules from soft heuristics.
5. Mark all high-risk claims as prohibited for user-facing output.

## Suggested Structure

- `specs/knowledge-base/README.md`
- `specs/knowledge-base/day-master-profiles.json`
- `specs/knowledge-base/five-elements.json`
- `specs/knowledge-base/element-balance-rules.json`
- `specs/knowledge-base/ten-gods.json`
- `specs/knowledge-base/occupation-patterns.json`
- `specs/knowledge-base/life-event-patterns.json`
- `specs/knowledge-base/teacher-rule-library.json`
- `specs/knowledge-base/inference-framework.json`
- `specs/knowledge-base/document-sources.json`
- `specs/knowledge-base/daily-guidance-mapping.json`
- `specs/knowledge-base/prohibited-claims.json`
- `specs/knowledge-base/case-notes.md`

## How To Build It

### Phase 1
Create the minimum decision layer needed for daily guidance:

- day master traits
- five-element excess/deficiency interpretation
- favorable vs unfavorable tendencies
- mapping from chart signals to daily advice categories

### Phase 2
Add richer interpretive layers:

- ten gods
- combinations and clashes
- season/month strength adjustments
- timing overlays
- teacher-specific rule packs that remain internal and auditable

### Phase 3
Add product-specific output controls:

- tone rules
- severity controls
- disclaimer policy
- premium vs free output depth

## Writing Rules

- Use one JSON object per concept family.
- Prefer canonical keys in English for system use.
- Add Chinese labels where useful for authoring.
- Keep user-facing copy out of raw rule files whenever possible.
- Add examples only when they clarify behavior.

## Review Standard

Every rule file should answer:

- what signal is detected
- what it usually implies
- what action bias it creates
- what user-facing advice categories it can influence
- what it must never be used to claim

## Next Step

Populate the starter files in `specs/knowledge-base/` and then update prompt assembly so the AI uses these structured rules instead of relying on vague intuition.

## Current Working Mode

For this project, the immediate priority is:

- keep ingesting BaZi course knowledge first
- normalize it into internal structured files
- delay user-page decisions until the knowledge layer is broad enough

Track current transcript coverage in:

- `specs/knowledge-base/ingestion-status.json`
- `scripts/report_kb_coverage.py`

Track external PDF/DOCX source coverage in:

- `specs/knowledge-base/document-sources.json`
- `data/raw-documents/`

Track cross-system reasoning architecture in:

- `specs/knowledge-base/inference-framework.json`
- `docs/METAPHYSICS-INFERENCE-ARCHITECTURE.md`
