# Knowledge Base Files

This folder stores the structured internal rule system for BaZi analysis and the first-stage QiMen capture knowledge base.

## File Roles

- `day-master-profiles.json`: baseline traits for each day master
- `five-elements.json`: element meanings and behavioral tendencies
- `element-balance-rules.json`: excess/deficiency interpretation rules
- `ten-gods.json`: ten-god summaries and product-safe meanings
- `occupation-patterns.json`: internal occupation and industry pattern mappings
- `life-event-patterns.json`: internal movement, property, and event-related patterns
- `teacher-rule-library.json`: teacher-specific rule packs normalized for internal retrieval
- `qimen/`: multimodal QiMen case, rule, reasoning-pattern, and keyword files
- `inference-framework.json`: shared reasoning scaffold across BaZi, Qi Men, Mei Hua, and Feng Shui
- `document-sources.json`: external PDFs/DOCX and their extraction status, text paths, and coverage mapping
- `ingestion-status.json`: transcript intake status and current normalization backlog
- `daily-guidance-mapping.json`: convert chart signals into advice categories
- `prohibited-claims.json`: hard safety and tone constraints
- `case-notes.md`: examples, edge cases, author notes

## Authoring Rules

- Keep keys stable.
- Keep values short and reusable.
- Use product-safe wording.
- Do not mix backend calculation details with front-end copy.
- Keep teacher-specific rules separate from general canonical rules until they are validated across multiple sources.
- Update `ingestion-status.json` whenever a new video batch is normalized into the knowledge base.
- Update `document-sources.json` whenever new PDF/DOCX notes are added from external storage.
- If a concept is repeated across many lessons or document sources, mark it explicitly in the rule with `knowledge_priority` and `repetition_signal`.
- Treat repeated content as either `foundational` or `core_emphasis`, not as redundant noise.
- Keep building toward an inference engine, not just a rule archive; prioritize reasoning order and branch conditions whenever they can be extracted.
- For high-value rules, add `reasoning_path` and `branch_conditions` so the system can follow the teacher's logic instead of doing keyword jumps.
