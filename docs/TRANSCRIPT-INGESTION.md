# Transcript Ingestion Workflow

## Goal

Convert long-form masterclass videos into structured internal BaZi knowledge.

## Directory Layout

- `data/raw-transcripts/`: raw transcript text files
- `data/extracted-notes/chunks/`: chunked transcript payloads
- `data/extracted-notes/extraction-queue.jsonl`: queue of chunks to process
- `data/reviewed-rules/`: reviewed extraction cards before merging into `specs/knowledge-base/`

## Step 1: Export Transcripts

Place transcript files into `data/raw-transcripts/`.

Recommended layout:

```text
data/raw-transcripts/
  teacher-a/
    fundamentals/
      lesson-01.txt
      lesson-02.txt
  teacher-b/
    advanced/
      lesson-01.txt
```

Each transcript file should start with simple metadata:

```text
Teacher: Teacher A
Course: Fundamentals
Lesson: Lesson 01
Date: 2024-04-08

[00:00:00] opening remarks...
[00:03:10] weak earth usually...
```

## Step 2: Chunk Transcripts

Run:

```bash
python3 scripts/chunk_transcripts.py
```

This creates chunk JSON files under `data/extracted-notes/chunks/`.

## Step 3: Build Extraction Queue

Run:

```bash
python3 scripts/build_extraction_queue.py
```

This creates `data/extracted-notes/extraction-queue.jsonl`.

## Step 4: Extract Rule Cards

For each chunk:

- load the chunk JSON
- use [extraction-prompt-template.md](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/extraction-prompt-template.md)
- save the extracted cards into `data/reviewed-rules/`

Recommended file naming:

```text
data/reviewed-rules/
  weak-earth/
    weak-earth-case-001.json
  day-master/
    yi-wood-001.json
```

Use [extraction-card-template.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/extraction-card-template.json) as the target schema.

## Step 5: Merge Into Product Knowledge

Only reviewed rules should be merged into:

- [day-master-profiles.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/day-master-profiles.json)
- [five-elements.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/five-elements.json)
- [element-balance-rules.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/element-balance-rules.json)
- [ten-gods.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/ten-gods.json)

## Review Checklist

- Is the extracted rule reusable?
- Does it depend on missing context?
- Is the wording deterministic or extreme?
- Can it be expressed as practical guidance?
- Does it belong in a structured JSON file or in `case-notes.md`?

## Recommended Human Workflow

1. Batch 20-50 transcript chunks.
2. Extract cards.
3. Review and deduplicate.
4. Merge into canonical JSON files.
5. Update prompt assembly only after enough rules are stable.
