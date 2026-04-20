# QiMen Multimodal Ingestion

## Goal

Capture enough evidence from QiMen Dun Jia course videos that a human reviewer can reconstruct:

- what board, slide, or whiteboard content the teacher was reading
- what question type the segment appears to address
- what reasoning path the teacher followed
- what conclusion the teacher landed on

This is a capture-first workflow. It does not try to fully auto-parse a QiMen chart in v1.

## Pipeline

1. Upload the video in `QiMen multimodal mode`.
2. Transcribe audio into plain text plus timestamped subtitles.
3. Extract keyframes:
   - scene changes
   - fixed interval fallback
4. Run OCR on those keyframes.
5. Align transcript and visual evidence into `aligned segment` JSON files.
6. Optionally enrich segment drafts with AI.
7. Review the generated markdown pack and JSON drafts.
8. Promote reviewed material into:
   - `qimen-case-cards.json`
   - `qimen-rule-cards.json`
   - `qimen-reasoning-patterns.json`

## Directory Layout

```text
data/raw-videos/qimen/
data/raw-transcripts/qimen/
data/extracted-notes/keyframes/qimen/
data/extracted-notes/ocr/qimen/
data/extracted-notes/aligned-segments/qimen/
data/reviewed-rules/qimen-ingestion-drafts/
data/reviewed-rules/qimen-review-ready/
data/import-runs/qimen-yangpan/
specs/knowledge-base/qimen/
```

Additional archived source material:

- `data/raw-documents/qimen/`
- `specs/knowledge-base/qimen/qimen-document-sources.json`

Batch import helper:

- `scripts/import_yangpan_qimen_batch.py`

The importer will:

- archive PDFs/HTML/images into `data/raw-documents/qimen/`
- upload videos in `QiMen multimodal mode`
- delete the original source video from the external drive only after the job reaches `ready_for_review` or `completed`

## Aligned Segment Fields

Each segment JSON contains:

- `clip_id`
- `source_video`
- `teacher`
- `course`
- `lesson`
- `start_timestamp`
- `end_timestamp`
- `transcript_excerpt`
- `keyframes`
- `ocr_blocks`
- `board_summary_draft`
- `reasoning_steps_draft`
- `question_type_guess`
- `final_conclusion_draft`
- `reusable_rule_hint`
- `system_profile_mentions`
- `matched_profile_terms`
- `system_profile_guess`
- `review_status`

## Review Workflow

For each segment:

1. Check the transcript excerpt against the keyframes.
2. Rewrite the board summary into a cleaner description.
3. Expand the reasoning steps into the teacher's real reading order.
4. Check whether the segment explicitly supports `拆补`, `置闰`, `超接`, `转盘`, or `飞盘`.
5. Decide whether the segment is:
   - a case card
   - a reusable rule
   - a reasoning pattern
6. Merge the approved result into the QiMen knowledge base files.
