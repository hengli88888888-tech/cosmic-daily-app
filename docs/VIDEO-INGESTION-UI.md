# Video Ingestion UI

## What It Does

This local tool provides a drag-and-drop page for course videos.

It now supports two ingestion modes:

- `BaZi transcript mode`
- `QiMen multimodal mode`

For each uploaded file in `BaZi transcript mode` it will:

1. save the original upload
2. optionally extract a speech-optimized audio track
3. for long audio, split it into smaller Whisper segments
4. run Whisper transcription
4. write a transcript into `data/raw-transcripts/`
5. chunk the transcript into extraction-ready JSON
6. call OpenAI to extract draft rule cards
7. save those draft cards into `data/reviewed-rules/ingestion-drafts/`

After speech-audio extraction succeeds, the server immediately deletes the original uploaded video/audio file.

After a job reaches `ready_for_review` or `completed`, the server automatically deletes:

- the temporary speech-audio file
- the temporary Whisper output directory

If no API key is provided, the BaZi tool will instead:

6. generate a manual-review summary
7. save that summary into `data/reviewed-rules/review-ready/`

For each uploaded file in `QiMen multimodal mode` it will:

1. save the uploaded video under `data/raw-videos/qimen/`
2. optionally extract a speech-optimized audio track
3. transcribe the audio and save both plain text and timestamped subtitles
4. extract keyframes using scene changes and fixed intervals
5. OCR those keyframes
6. align transcript and visual evidence into segment JSON files
7. optionally enrich each segment draft with AI
8. generate a review-ready markdown pack for manual cleanup

QiMen mode is designed for whiteboard, PPT, and mixed lecture videos where the board visuals are part of the teaching logic.

## Start The UI

Run:

```bash
python3 tools/knowledge_ingestion/server.py
```

If `8765` is already in use:

```bash
INGESTION_UI_PORT=8766 python3 tools/knowledge_ingestion/server.py
```

Open:

```text
http://127.0.0.1:8765
```

Jobs are processed sequentially. You can upload many files at once, but the server will run them one by one to avoid overloading the machine.

## Inputs

- video or audio file
- course mode
- teacher name
- course name: auto-derived from each uploaded video filename
- Whisper language
- Whisper model
- Whisper threads
- speech-audio preprocessing
- OpenAI API key
- OpenAI model
- extraction workers
- optional notes about style or terminology
- optional custom glossary corrections
- teacher-specific glossary auto-load based on the `Teacher` field

## Outputs

- uploaded media: `data/uploads/` only until speech-audio extraction succeeds
- qimen uploaded media: `data/raw-videos/qimen/` until the job finishes
- preprocessed speech audio: `data/preprocessed-audio/` for in-flight jobs only
- segmented long-audio parts: inside the same job folder under `data/preprocessed-audio/`
- transcripts: `data/raw-transcripts/`
- transcript correction log: same folder as transcript, with `.corrections.json`
- chunks: `data/extracted-notes/chunks/`
- draft cards: `data/reviewed-rules/ingestion-drafts/`
- manual-review summaries: `data/reviewed-rules/review-ready/`
- qimen keyframes: `data/extracted-notes/keyframes/qimen/`
- qimen OCR payloads: `data/extracted-notes/ocr/qimen/`
- qimen aligned segments: `data/extracted-notes/aligned-segments/qimen/`
- qimen editable drafts: `data/reviewed-rules/qimen-ingestion-drafts/`
- qimen review summaries: `data/reviewed-rules/qimen-review-ready/`

## Notes

- This tool uses the local `whisper` CLI and `ffmpeg`.
- The server now prefers `mlx-whisper` on Apple Silicon when the project-local `.venv_ingestion` environment is available, and falls back to the official `whisper` CLI if MLX transcription fails.
- The server defaults to CPU for the official `openai-whisper` CLI in this environment because `mps` has been unstable and can hang or produce no output. Override with `INGESTION_WHISPER_DEVICE=mps` only if you want to test it explicitly.
- Long audio is automatically split before Whisper so the UI can report segment-level progress and long jobs do not behave like one giant black box.
- Domain vocabulary is biased in two places: Whisper `--initial_prompt` and transcript post-processing via [domain-glossary.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/domain-glossary.json).
- If `Teacher` matches a file in [teacher-glossaries](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/teacher-glossaries), that glossary is merged automatically.
- AI extraction requires an OpenAI API key.
- If no API key is provided, the job is marked as ready for manual review instead of failed.
- Manual-review summaries include top matched glossary terms and chunk previews so you can continue building the knowledge base without cloud extraction.
- Automatic intermediate cleanup is on by default. Set `INGESTION_AUTO_CLEANUP=false` if you need to keep original uploads temporarily.
- QiMen mode always ends in `ready_for_review`, because the raw capture is meant to be cleaned by a human before it becomes final knowledge.

## Speed Tips

- Use `Whisper model = turbo` for best speed.
- Keep `Speech-audio preprocessing = On` unless you are debugging the raw-video path.
- Increase `Whisper threads` to match available CPU cores.
- Increase `Extraction workers` to parallelize OpenAI rule-card extraction.
- For a first test, use a 5-20 minute clip instead of a full-length course video.

## Teacher Glossaries

Store teacher-specific glossaries in:

```text
specs/knowledge-base/teacher-glossaries/
```

Example files:

- [README.md](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/teacher-glossaries/README.md)
- [example-teacher.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/teacher-glossaries/example-teacher.json)
