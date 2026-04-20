#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
RAW_VIDEOS_DIR = DATA_DIR / "raw-videos"
RAW_QIMEN_VIDEOS_DIR = RAW_VIDEOS_DIR / "qimen"
PREPROCESSED_AUDIO_DIR = DATA_DIR / "preprocessed-audio"
RAW_TRANSCRIPTS_DIR = DATA_DIR / "raw-transcripts"
RAW_QIMEN_TRANSCRIPTS_DIR = RAW_TRANSCRIPTS_DIR / "qimen"
CHUNKS_DIR = DATA_DIR / "extracted-notes" / "chunks"
KEYFRAMES_DIR = DATA_DIR / "extracted-notes" / "keyframes" / "qimen"
OCR_DIR = DATA_DIR / "extracted-notes" / "ocr" / "qimen"
ALIGNED_SEGMENTS_DIR = DATA_DIR / "extracted-notes" / "aligned-segments" / "qimen"
DRAFTS_DIR = DATA_DIR / "reviewed-rules" / "ingestion-drafts"
REVIEW_READY_DIR = DATA_DIR / "reviewed-rules" / "review-ready"
QIMEN_DRAFTS_DIR = DATA_DIR / "reviewed-rules" / "qimen-ingestion-drafts"
QIMEN_REVIEW_READY_DIR = DATA_DIR / "reviewed-rules" / "qimen-review-ready"
SCRIPTS_DIR = ROOT / "scripts"
STATIC_DIR = Path(__file__).resolve().parent
TEACHER_GLOSSARY_DIR = ROOT / "specs" / "knowledge-base" / "teacher-glossaries"
QIMEN_KB_DIR = ROOT / "specs" / "knowledge-base" / "qimen"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))
DEFAULT_WHISPER_THREADS = max(2, min(8, os.cpu_count() or 4))
DEFAULT_EXTRACTION_WORKERS = 4
AUTO_CLEANUP_INTERMEDIATE = os.getenv("INGESTION_AUTO_CLEANUP", "true").lower() != "false"
WHISPER_DEVICE: str | None = None
WHISPER_SEGMENT_SECONDS = int(os.getenv("INGESTION_WHISPER_SEGMENT_SECONDS", "1200"))
WHISPER_SEGMENT_THRESHOLD_SECONDS = int(os.getenv("INGESTION_WHISPER_SEGMENT_THRESHOLD_SECONDS", "1800"))
INGESTION_VENV_PYTHON = ROOT / ".venv_ingestion" / "bin" / "python"
WHISPER_BACKEND = os.getenv("INGESTION_WHISPER_BACKEND", "auto").strip().lower()

for directory in [
    UPLOAD_DIR,
    RAW_QIMEN_VIDEOS_DIR,
    PREPROCESSED_AUDIO_DIR,
    RAW_TRANSCRIPTS_DIR,
    RAW_QIMEN_TRANSCRIPTS_DIR,
    CHUNKS_DIR,
    KEYFRAMES_DIR,
    OCR_DIR,
    ALIGNED_SEGMENTS_DIR,
    DRAFTS_DIR,
    REVIEW_READY_DIR,
    QIMEN_DRAFTS_DIR,
    QIMEN_REVIEW_READY_DIR,
    QIMEN_KB_DIR,
]:
    directory.mkdir(parents=True, exist_ok=True)

JOBS_LOCK = threading.Lock()
JOBS: dict[str, "Job"] = {}
JOB_QUEUE: "queue.Queue[tuple[Job, str]]" = queue.Queue()


def slugify(value: str) -> str:
    keep = []
    for char in value.strip().lower():
        if char.isalnum():
            keep.append(char)
        elif char in {" ", "-", "_"}:
            keep.append("-")
    slug = "".join(keep).strip("-")
    return slug or "unknown"


def course_from_filename(filename: str) -> str:
    return Path(filename).stem.strip() or "Untitled Course"


def json_response(handler: BaseHTTPRequestHandler, body: Any, status: int = 200) -> None:
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def text_from_response_payload(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]

    output = payload.get("output", [])
    for item in output:
        content = item.get("content", [])
        for part in content:
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                return text
            if isinstance(part.get("output_text"), str):
                return part["output_text"]
    raise ValueError("No text output found in model response")


def read_template(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def load_domain_glossary() -> dict[str, Any]:
    path = ROOT / "specs" / "knowledge-base" / "domain-glossary.json"
    return json.loads(path.read_text(encoding="utf-8"))


DOMAIN_GLOSSARY = load_domain_glossary()


def load_teacher_glossary(teacher: str) -> tuple[dict[str, Any], str | None]:
    if not teacher.strip():
        return {}, None
    path = TEACHER_GLOSSARY_DIR / f"{slugify(teacher)}.json"
    if not path.exists():
        return {}, None
    return json.loads(path.read_text(encoding="utf-8")), str(path.relative_to(ROOT))


CARD_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "cards": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "topic": {"type": "string"},
                    "topic_family": {"type": "string"},
                    "claim": {"type": "string"},
                    "conditions": {"type": "array", "items": {"type": "string"}},
                    "interpretation": {"type": "string"},
                    "product_safe_advice": {"type": "array", "items": {"type": "string"}},
                    "do_not_say": {"type": "array", "items": {"type": "string"}},
                    "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                },
                "required": [
                    "topic",
                    "topic_family",
                    "claim",
                    "conditions",
                    "interpretation",
                    "product_safe_advice",
                    "do_not_say",
                    "confidence",
                ],
            },
        }
    },
    "required": ["cards"],
}

QIMEN_SEGMENT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "board_summary_draft": {"type": "string"},
        "reasoning_steps_draft": {"type": "array", "items": {"type": "string"}},
        "question_type_guess": {"type": "string"},
        "final_conclusion_draft": {"type": "string"},
        "reusable_rule_hint": {"type": "string"},
    },
    "required": [
        "board_summary_draft",
        "reasoning_steps_draft",
        "question_type_guess",
        "final_conclusion_draft",
        "reusable_rule_hint",
    ],
}


@dataclass
class Job:
    id: str
    filename: str
    teacher: str
    course: str
    language: str
    extraction_model: str
    whisper_model: str
    whisper_threads: int
    extraction_workers: int
    preprocess_audio: bool
    course_mode: str
    notes: str
    custom_glossary: str
    upload_path: Path
    loaded_glossaries: list[str] = field(default_factory=list)
    status: str = "queued"
    message: str = "Queued"
    logs: list[str] = field(default_factory=list)

    def log(self, line: str) -> None:
        stamp = time.strftime("%H:%M:%S")
        with JOBS_LOCK:
            self.logs.append(f"[{stamp}] {line}")

    def update(self, status: str | None = None, message: str | None = None) -> None:
        with JOBS_LOCK:
            if status:
                self.status = status
            if message:
                self.message = message

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "filename": self.filename,
            "teacher": self.teacher,
            "course": self.course,
            "whisper_model": self.whisper_model,
            "whisper_threads": self.whisper_threads,
            "extraction_workers": self.extraction_workers,
            "preprocess_audio": self.preprocess_audio,
            "course_mode": self.course_mode,
            "status": self.status,
            "message": self.message,
            "loaded_glossaries": list(self.loaded_glossaries),
            "logs": list(self.logs),
        }


def run_command(args: list[str], cwd: Path, job: Job) -> subprocess.CompletedProcess[str]:
    job.log("Running: " + " ".join(args))
    result = subprocess.run(
        args,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.stdout.strip():
        job.log(result.stdout.strip().splitlines()[-1])
    if result.returncode != 0:
        if result.stderr.strip():
            job.log(result.stderr.strip().splitlines()[-1])
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(args)}")
    return result


def remove_path(path: Path) -> None:
    if not path.exists():
        return
    if path.is_dir():
        for child in path.iterdir():
            remove_path(child)
        path.rmdir()
        return
    path.unlink()


def extract_speech_audio(job: Job) -> Path:
    target_dir = PREPROCESSED_AUDIO_DIR / job.id
    target_dir.mkdir(parents=True, exist_ok=True)
    audio_path = target_dir / f"{job.upload_path.stem}.m4a"
    args = [
        "ffmpeg",
        "-y",
        "-i",
        str(job.upload_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        str(audio_path),
    ]
    run_command(args, ROOT, job)
    if not audio_path.exists():
        raise FileNotFoundError(f"Preprocessed audio not found: {audio_path}")
    job.log(f"Prepared speech audio: {audio_path.relative_to(ROOT)}")
    return audio_path


def transcription_outputs(output_dir: Path, stem: str, output_formats: tuple[str, ...]) -> dict[str, Path]:
    return {fmt: output_dir / f"{stem}.{fmt}" for fmt in output_formats}


def media_duration_seconds(path: Path) -> float | None:
    args = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    result = subprocess.run(
        args,
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    try:
        return float(result.stdout.strip())
    except ValueError:
        return None


def can_segment_as_audio(path: Path) -> bool:
    return path.suffix.lower() in {".m4a", ".mp3", ".wav", ".aac", ".flac", ".ogg", ".opus"}


def split_audio_for_whisper(job: Job, audio_path: Path) -> list[Path]:
    duration = media_duration_seconds(audio_path)
    if duration is None or duration <= WHISPER_SEGMENT_THRESHOLD_SECONDS:
        return [audio_path]

    segments_dir = audio_path.parent / "segments"
    segments_dir.mkdir(parents=True, exist_ok=True)
    segment_pattern = segments_dir / "segment-%03d.m4a"
    args = [
        "ffmpeg",
        "-y",
        "-i",
        str(audio_path),
        "-f",
        "segment",
        "-segment_time",
        str(WHISPER_SEGMENT_SECONDS),
        "-c",
        "copy",
        str(segment_pattern),
    ]
    run_command(args, ROOT, job)
    segments = sorted(segments_dir.glob("segment-*.m4a"))
    if not segments:
        raise FileNotFoundError(f"No audio segments created in {segments_dir}")
    minutes = round(duration / 60, 1)
    job.log(
        f"Split long audio into {len(segments)} segments for Whisper ({minutes} min total, {WHISPER_SEGMENT_SECONDS // 60} min each)"
    )
    return segments


def merged_hint_terms(job: Job, teacher_glossary: dict[str, Any]) -> list[str]:
    base_terms = DOMAIN_GLOSSARY.get("whisper_hint_terms", [])
    terms = list(dict.fromkeys([term for term in base_terms if isinstance(term, str)]))

    teacher_terms = teacher_glossary.get("whisper_hint_terms", [])
    for term in teacher_terms:
        if isinstance(term, str) and term not in terms:
            terms.append(term)

    extra = [part.strip() for part in job.custom_glossary.replace("\n", ",").split(",") if part.strip()]
    if extra:
        terms.extend([term for term in extra if term not in terms])
    return terms


def build_whisper_initial_prompt(job: Job, teacher_glossary: dict[str, Any]) -> str:
    terms = merged_hint_terms(job, teacher_glossary)

    terms_text = "，".join(terms[:80])
    context = []
    if job.teacher:
        context.append(f"讲师：{job.teacher}")
    if job.course:
        context.append(f"课程：{job.course}")
    if terms_text:
        context.append(f"术语：{terms_text}")
    return "；".join(context)


def detect_whisper_device() -> str | None:
    override = os.getenv("INGESTION_WHISPER_DEVICE", "").strip().lower()
    if override in {"cpu", "mps", "cuda"}:
        return override

    whisper_bin = shutil.which("whisper")
    if not whisper_bin:
        return "cpu"

    try:
        shebang = Path(whisper_bin).read_text(encoding="utf-8").splitlines()[0]
    except Exception:
        return None

    if not shebang.startswith("#!"):
        return None

    python_bin = shebang[2:].strip()
    if not python_bin:
        return None

    probe = (
        "import torch; "
        "print('cuda' if torch.cuda.is_available() else "
        "('mps' if getattr(torch.backends, 'mps', None) and torch.backends.mps.is_available() else 'cpu'))"
    )
    try:
        result = subprocess.run(
            [python_bin, "-c", probe],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=False,
        )
    except Exception:
        return None

    if result.returncode != 0:
        return None

    device = result.stdout.strip()
    if device == "cuda":
        return "cuda"

    # The official openai-whisper CLI has been unstable on MPS in this environment:
    # jobs can hang or exit without producing output files. Prefer CPU unless the
    # operator explicitly overrides the device via INGESTION_WHISPER_DEVICE.
    return "cpu"


def detect_whisper_backend() -> str:
    if WHISPER_BACKEND in {"mlx", "whisper"}:
        return WHISPER_BACKEND
    if INGESTION_VENV_PYTHON.exists():
        return "mlx"
    return "whisper"


def apply_glossary_corrections(
    text: str,
    custom_glossary: str,
    teacher_glossary: dict[str, Any],
) -> tuple[str, list[dict[str, str]]]:
    corrected = text
    applied: list[dict[str, str]] = []

    context_replacements = list(DOMAIN_GLOSSARY.get("context_corrections", []))
    context_replacements.extend(teacher_glossary.get("context_corrections", []))
    context_replacements = sorted(context_replacements, key=lambda item: len(str(item.get("pattern", ""))), reverse=True)

    for item in context_replacements:
        pattern = str(item.get("pattern", "")).strip()
        replace = str(item.get("replace", ""))
        requires_any = [str(token) for token in item.get("requires_any", []) if str(token).strip()]
        forbids_any = [str(token) for token in item.get("forbids_any", []) if str(token).strip()]
        if not pattern or not replace:
            continue

        compiled = re.compile(pattern)
        line_hits = 0
        updated_lines: list[str] = []
        for line in corrected.splitlines():
            if not compiled.search(line):
                updated_lines.append(line)
                continue
            if requires_any and not any(token in line for token in requires_any):
                updated_lines.append(line)
                continue
            if forbids_any and any(token in line for token in forbids_any):
                updated_lines.append(line)
                continue
            new_line, hits = compiled.subn(replace, line)
            updated_lines.append(new_line)
            line_hits += hits
        if line_hits:
            corrected = "\n".join(updated_lines)
            applied.append({"wrong": f"context:{pattern}", "correct": replace, "count": str(line_hits)})

    regex_replacements = list(DOMAIN_GLOSSARY.get("regex_corrections", []))
    regex_replacements.extend(teacher_glossary.get("regex_corrections", []))
    regex_replacements = sorted(regex_replacements, key=lambda item: len(str(item.get("pattern", ""))), reverse=True)

    for item in regex_replacements:
        pattern = str(item.get("pattern", "")).strip()
        replace = str(item.get("replace", ""))
        if not pattern or not replace:
            continue
        corrected, hits = re.subn(pattern, replace, corrected)
        if hits:
            applied.append({"wrong": f"re:{pattern}", "correct": replace, "count": str(hits)})

    replacements = list(DOMAIN_GLOSSARY.get("common_corrections", []))
    replacements.extend(teacher_glossary.get("common_corrections", []))
    replacements = sorted(replacements, key=lambda item: len(str(item.get("wrong", ""))), reverse=True)

    for item in replacements:
        wrong = str(item.get("wrong", "")).strip()
        correct = str(item.get("correct", ""))
        if not wrong or wrong == correct:
            continue
        if wrong in corrected:
            corrected = corrected.replace(wrong, correct)
            applied.append({"wrong": wrong, "correct": correct})

    for line in [part.strip() for part in custom_glossary.splitlines() if part.strip()]:
        if "=>" in line:
            wrong, correct = [part.strip() for part in line.split("=>", 1)]
        elif "->" in line:
            wrong, correct = [part.strip() for part in line.split("->", 1)]
        else:
            continue
        if wrong and wrong in corrected:
            corrected = corrected.replace(wrong, correct)
            applied.append({"wrong": wrong, "correct": correct})

    return corrected, applied


def clean_repetitive_noise(text: str) -> tuple[str, list[str]]:
    cleaned = text
    notes: list[str] = []

    repeated_phrase_pattern = re.compile(r"((?:[\u4e00-\u9fff]{2,10})\s*)(?:\1){9,}")
    cleaned, repeated_phrase_hits = repeated_phrase_pattern.subn("", cleaned)
    if repeated_phrase_hits:
        notes.append(f"removed {repeated_phrase_hits} repeated phrase blocks")

    repeated_char_pattern = re.compile(r"([\u4e00-\u9fff])\1{19,}")
    cleaned, repeated_char_hits = repeated_char_pattern.subn("", cleaned)
    if repeated_char_hits:
        notes.append(f"removed {repeated_char_hits} repeated character blocks")

    cleaned, repeated_blank_hits = re.subn(r"\n{3,}", "\n\n", cleaned)
    if repeated_blank_hits:
        notes.append(f"collapsed {repeated_blank_hits} oversized blank sections")

    return cleaned.strip(), notes


def write_transcript_with_metadata(
    raw_transcript: Path,
    target_path: Path,
    job: Job,
    teacher_glossary: dict[str, Any],
) -> None:
    transcript_text = raw_transcript.read_text(encoding="utf-8").strip()
    corrected_text, applied_corrections = apply_glossary_corrections(
        transcript_text,
        job.custom_glossary,
        teacher_glossary,
    )
    corrected_text, cleanup_notes = clean_repetitive_noise(corrected_text)
    content = "\n".join([
        f"Teacher: {job.teacher or 'Unknown'}",
        f"Course: {job.course or 'Unknown'}",
        f"Lesson: {job.filename}",
        f"Source File: {job.upload_path.name}",
        f"Glossary Corrections Applied: {len(applied_corrections)}",
        "",
        corrected_text,
        "",
    ])
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(content, encoding="utf-8")
    if applied_corrections:
        correction_path = target_path.with_suffix(".corrections.json")
        correction_path.write_text(
            json.dumps({"applied": applied_corrections, "cleanup_notes": cleanup_notes}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    job.log(f"Applied {len(applied_corrections)} glossary corrections")
    for note in cleanup_notes:
        job.log(f"Post-cleanup: {note}")


def mlx_model_name(model_name: str) -> str:
    mapping = {
        "turbo": "mlx-community/whisper-large-v3-turbo",
        "small": "mlx-community/whisper-small",
        "base": "mlx-community/whisper-base",
    }
    return mapping.get(model_name, "mlx-community/whisper-large-v3-turbo")


def run_mlx_whisper_transcription(
    job: Job,
    teacher_glossary: dict[str, Any],
    source_media: Path,
    output_dir: Path,
    label: str,
    output_formats: tuple[str, ...] = ("txt",),
) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    format_arg = "all" if len(output_formats) > 1 else output_formats[0]
    args = [
        str(INGESTION_VENV_PYTHON),
        "-m",
        "mlx_whisper.cli",
        str(source_media),
        "--model",
        mlx_model_name(job.whisper_model),
        "--output-name",
        source_media.stem,
        "--output-dir",
        str(output_dir),
        "--output-format",
        format_arg,
        "--verbose",
        "False",
    ]
    if job.language and job.language.lower() != "auto":
        args.extend(["--language", job.language])
    initial_prompt = build_whisper_initial_prompt(job, teacher_glossary)
    if initial_prompt:
        args.extend(["--initial-prompt", initial_prompt])
    job.update("running", label)
    run_command(args, ROOT, job)
    outputs = transcription_outputs(output_dir, source_media.stem, output_formats)
    for fmt, path in outputs.items():
        if not path.exists():
            raise FileNotFoundError(f"MLX Whisper output not found ({fmt}): {path}")
    return outputs


def run_whisper_transcription(
    job: Job,
    teacher_glossary: dict[str, Any],
    source_media: Path,
    output_dir: Path,
    label: str,
    output_formats: tuple[str, ...] = ("txt",),
) -> dict[str, Path]:
    return run_whisper_cli_transcription(
        job,
        teacher_glossary,
        source_media,
        output_dir,
        label,
        output_formats=output_formats,
    )


def run_whisper_cli_transcription(
    job: Job,
    teacher_glossary: dict[str, Any],
    source_media: Path,
    output_dir: Path,
    label: str,
    output_formats: tuple[str, ...] = ("txt",),
) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    format_arg = "all" if len(output_formats) > 1 else output_formats[0]
    args = [
        "whisper",
        str(source_media),
        "--model",
        job.whisper_model,
        "--device",
        WHISPER_DEVICE or "cpu",
        "--output_dir",
        str(output_dir),
        "--output_format",
        format_arg,
        "--threads",
        str(job.whisper_threads),
    ]
    if job.language and job.language.lower() != "auto":
        args.extend(["--language", job.language])
    initial_prompt = build_whisper_initial_prompt(job, teacher_glossary)
    if initial_prompt:
        args.extend(["--initial_prompt", initial_prompt])
    job.update("running", label)
    run_command(args, ROOT, job)
    outputs = transcription_outputs(output_dir, source_media.stem, output_formats)
    for fmt, path in outputs.items():
        if not path.exists():
            raise FileNotFoundError(f"Whisper output not found ({fmt}): {path}")
    return outputs


def run_transcription_backend(
    job: Job,
    teacher_glossary: dict[str, Any],
    source_media: Path,
    output_dir: Path,
    label: str,
    output_formats: tuple[str, ...] = ("txt",),
) -> dict[str, Path]:
    backend = detect_whisper_backend()
    if backend == "mlx":
        try:
            job.log("Using mlx-whisper backend")
            return run_mlx_whisper_transcription(
                job,
                teacher_glossary,
                source_media,
                output_dir,
                label,
                output_formats=output_formats,
            )
        except Exception as error:
            job.log(f"mlx-whisper failed, falling back to whisper CLI: {error}")
    job.log("Using whisper CLI backend")
    return run_whisper_cli_transcription(
        job,
        teacher_glossary,
        source_media,
        output_dir,
        label,
        output_formats=output_formats,
    )


def transcribe(job: Job, teacher_glossary: dict[str, Any]) -> Path:
    source_media = job.upload_path
    if job.preprocess_audio:
        job.update("running", "Extracting speech audio")
        source_media = extract_speech_audio(job)
        if AUTO_CLEANUP_INTERMEDIATE and job.upload_path.exists():
            remove_path(job.upload_path)
            job.log(f"Deleted original upload after audio extraction: {job.upload_path.relative_to(ROOT)}")

    output_dir = job.upload_path.parent / f"{job.upload_path.stem}-whisper"
    media_parts = split_audio_for_whisper(job, source_media) if can_segment_as_audio(source_media) else [source_media]
    if len(media_parts) == 1:
        outputs = run_transcription_backend(
            job=job,
            teacher_glossary=teacher_glossary,
            source_media=media_parts[0],
            output_dir=output_dir,
            label="Transcribing with Whisper",
            output_formats=("txt",),
        )
        transcript_path = outputs["txt"]
    else:
        combined_path = output_dir / f"{job.upload_path.stem}.txt"
        transcript_parts: list[str] = []
        for index, part in enumerate(media_parts, start=1):
            part_output_dir = output_dir / f"part-{index:03d}"
            outputs = run_transcription_backend(
                job=job,
                teacher_glossary=teacher_glossary,
                source_media=part,
                output_dir=part_output_dir,
                label=f"Transcribing segment {index}/{len(media_parts)}",
                output_formats=("txt",),
            )
            transcript_parts.append(outputs["txt"].read_text(encoding="utf-8").strip())
            job.log(f"Finished Whisper segment {index}/{len(media_parts)}")
        combined_path.write_text("\n\n".join(part for part in transcript_parts if part) + "\n", encoding="utf-8")
        transcript_path = combined_path

    target = RAW_TRANSCRIPTS_DIR / slugify(job.teacher) / slugify(job.course) / f"{slugify(job.upload_path.stem)}.txt"
    write_transcript_with_metadata(transcript_path, target, job, teacher_glossary)
    job.log(f"Transcript saved: {target.relative_to(ROOT)}")
    return target


def build_transcript_target(job: Job, mode_root: Path) -> Path:
    return mode_root / slugify(job.teacher) / slugify(job.course) / f"{slugify(job.upload_path.stem)}.txt"


def shift_srt_contents(raw: str, offset_seconds: float) -> str:
    def replace(match: re.Match[str]) -> str:
        start = srt_to_seconds(match.group("start")) + offset_seconds
        end = srt_to_seconds(match.group("end")) + offset_seconds
        return f"{seconds_to_srt(start)} --> {seconds_to_srt(end)}"

    return re.sub(
        r"(?P<start>\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(?P<end>\d{2}:\d{2}:\d{2},\d{3})",
        replace,
        raw,
    )


def srt_to_seconds(value: str) -> float:
    hours, minutes, rest = value.split(":")
    seconds, millis = rest.split(",")
    return (
        int(hours) * 3600
        + int(minutes) * 60
        + int(seconds)
        + int(millis) / 1000
    )


def seconds_to_srt(value: float) -> str:
    total_ms = max(0, int(round(value * 1000)))
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def renumber_srt(raw: str) -> str:
    blocks = [block.strip() for block in re.split(r"\n\s*\n", raw.strip()) if block.strip()]
    rebuilt: list[str] = []
    for index, block in enumerate(blocks, start=1):
        lines = block.splitlines()
        if len(lines) >= 2 and lines[0].isdigit():
            lines[0] = str(index)
        else:
            lines = [str(index), *lines]
        rebuilt.append("\n".join(lines))
    return "\n\n".join(rebuilt) + ("\n" if rebuilt else "")


def transcribe_qimen(job: Job, teacher_glossary: dict[str, Any]) -> tuple[Path, Path]:
    source_media = job.upload_path
    if job.preprocess_audio:
        job.update("running", "Extracting speech audio")
        source_media = extract_speech_audio(job)

    output_dir = job.upload_path.parent / f"{job.upload_path.stem}-whisper"
    media_parts = split_audio_for_whisper(job, source_media) if can_segment_as_audio(source_media) else [source_media]
    target_txt = build_transcript_target(job, RAW_QIMEN_TRANSCRIPTS_DIR)
    target_srt = target_txt.with_suffix(".srt")

    if len(media_parts) == 1:
        outputs = run_transcription_backend(
            job=job,
            teacher_glossary=teacher_glossary,
            source_media=media_parts[0],
            output_dir=output_dir,
            label="Transcribing with Whisper",
            output_formats=("txt", "srt"),
        )
        write_transcript_with_metadata(outputs["txt"], target_txt, job, teacher_glossary)
        target_srt.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(outputs["srt"], target_srt)
        job.log(f"Transcript saved: {target_txt.relative_to(ROOT)}")
        job.log(f"Timestamped transcript saved: {target_srt.relative_to(ROOT)}")
        return target_txt, target_srt

    combined_txt = output_dir / f"{job.upload_path.stem}.txt"
    combined_srt = output_dir / f"{job.upload_path.stem}.srt"
    transcript_parts: list[str] = []
    srt_parts: list[str] = []
    cumulative_offset = 0.0
    for index, part in enumerate(media_parts, start=1):
        part_output_dir = output_dir / f"part-{index:03d}"
        outputs = run_transcription_backend(
            job=job,
            teacher_glossary=teacher_glossary,
            source_media=part,
            output_dir=part_output_dir,
            label=f"Transcribing segment {index}/{len(media_parts)}",
            output_formats=("txt", "srt"),
        )
        transcript_parts.append(outputs["txt"].read_text(encoding="utf-8").strip())
        srt_parts.append(shift_srt_contents(outputs["srt"].read_text(encoding="utf-8"), cumulative_offset))
        cumulative_offset += media_duration_seconds(part) or 0.0
        job.log(f"Finished Whisper segment {index}/{len(media_parts)}")
    combined_txt.write_text("\n\n".join(part for part in transcript_parts if part) + "\n", encoding="utf-8")
    combined_srt.write_text(renumber_srt("\n\n".join(srt_parts)), encoding="utf-8")
    write_transcript_with_metadata(combined_txt, target_txt, job, teacher_glossary)
    target_srt.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(combined_srt, target_srt)
    job.log(f"Transcript saved: {target_txt.relative_to(ROOT)}")
    job.log(f"Timestamped transcript saved: {target_srt.relative_to(ROOT)}")
    return target_txt, target_srt


def cleanup_intermediate_files(job: Job) -> None:
    paths: list[Path] = [
        job.upload_path,
        PREPROCESSED_AUDIO_DIR / job.id,
        job.upload_path.parent / f"{job.upload_path.stem}-whisper",
    ]
    cleaned: list[str] = []
    for path in paths:
        if not path.exists():
            continue
        remove_path(path)
        cleaned.append(str(path.relative_to(ROOT)))
    if cleaned:
        job.log("Cleaned intermediate files: " + ", ".join(cleaned))


def process_qimen_job(job: Job, teacher_glossary: dict[str, Any], api_key: str) -> None:
    from qimen_multimodal import build_aligned_segments, extract_keyframes, ocr_keyframes, parse_srt

    transcript_path, srt_path = transcribe_qimen(job, teacher_glossary)
    cues = parse_srt(srt_path)
    paths = qimen_paths(job)

    job.update("running", "Extracting keyframes")
    keyframes = extract_keyframes(
        video_path=job.upload_path,
        output_dir=paths["keyframes"],
        log=job.log,
    )

    job.update("running", "Running OCR on keyframes")
    ocr_results = ocr_keyframes(
        frames=keyframes,
        output_dir=paths["ocr"],
        log=job.log,
    )

    job.update("running", "Aligning transcript and board evidence")
    segments = build_aligned_segments(
        cues=cues,
        ocr_results=ocr_results,
        teacher=job.teacher,
        course=job.course,
        lesson=job.filename,
        source_video=str(job.upload_path.relative_to(ROOT)),
        output_dir=paths["segments"],
    )
    job.log(f"Built {len(segments)} aligned QiMen segments")

    job.update("running", "Building editable case drafts")
    draft_paths = save_qimen_segment_drafts(job, segments, api_key)
    job.log(f"Saved {len(draft_paths)} QiMen segment drafts")

    summary_path = write_qimen_review_summary(job, transcript_path, draft_paths)
    job.log(f"Review summary saved: {summary_path.relative_to(ROOT)}")
    refresh_qimen_keyword_index(job)
    job.update("ready_for_review", f"QiMen multimodal capture complete. {len(draft_paths)} segments ready for review.")


def chunk_transcript(job: Job, transcript_path: Path) -> list[Path]:
    from transcript_utils import chunk_transcript_file

    result = chunk_transcript_file(
        transcript_path=transcript_path,
        input_root=RAW_TRANSCRIPTS_DIR,
        output_root=CHUNKS_DIR,
        min_chars=800,
        max_chars=1800,
    )
    chunk_paths = [Path(path) for path in result["chunk_paths"]]
    job.log(f"Chunked into {result['chunk_count']} pieces")
    return chunk_paths


def call_openai_qimen_extract(job: Job, segment_payload: dict[str, Any], api_key: str) -> dict[str, Any]:
    template = read_template(QIMEN_KB_DIR / "qimen-segment-extraction-prompt-template.md")
    prompt = (
        f"{template}\n\n"
        f"Teacher: {job.teacher}\n"
        f"Course: {job.course}\n"
        f"Lesson: {job.filename}\n"
        f"Notes: {job.notes or 'None'}\n"
        f"Segment JSON:\n{json.dumps(segment_payload, ensure_ascii=False, indent=2)}\n"
    )
    payload = {
        "model": job.extraction_model,
        "instructions": "Return JSON only. Extract editable QiMen segment draft fields for manual review.",
        "input": prompt,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "qimen_segment_draft",
                "strict": True,
                "schema": QIMEN_SEGMENT_SCHEMA,
            }
        },
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI request failed: {error.code} {body}") from error

    data = json.loads(raw)
    text = text_from_response_payload(data)
    return json.loads(text)


def qimen_paths(job: Job) -> dict[str, Path]:
    teacher_slug = slugify(job.teacher)
    course_slug = slugify(job.course)
    lesson_slug = slugify(job.upload_path.stem)
    return {
        "keyframes": KEYFRAMES_DIR / teacher_slug / course_slug / lesson_slug,
        "ocr": OCR_DIR / teacher_slug / course_slug / lesson_slug,
        "segments": ALIGNED_SEGMENTS_DIR / teacher_slug / course_slug / lesson_slug,
        "drafts": QIMEN_DRAFTS_DIR / teacher_slug / course_slug / lesson_slug,
        "review": QIMEN_REVIEW_READY_DIR / teacher_slug / course_slug,
    }


def save_qimen_segment_drafts(
    job: Job,
    segments: list[dict[str, Any]],
    api_key: str,
) -> list[Path]:
    paths = qimen_paths(job)
    paths["drafts"].mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    for index, segment in enumerate(segments, start=1):
        draft = dict(segment)
        if api_key:
            enriched = call_openai_qimen_extract(job, segment, api_key)
            draft.update(enriched)
        target = paths["drafts"] / f"{index:04d}.json"
        target.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        saved.append(target)
    return saved


def write_qimen_review_summary(
    job: Job,
    transcript_path: Path,
    draft_paths: list[Path],
) -> Path:
    paths = qimen_paths(job)
    paths["review"].mkdir(parents=True, exist_ok=True)
    summary_path = paths["review"] / f"{slugify(job.upload_path.stem)}-review.md"
    lines = [
        f"# QiMen Review Ready: {job.filename}",
        "",
        f"- teacher: {job.teacher or 'Unknown'}",
        f"- course: {job.course or 'Unknown'}",
        f"- mode: {job.course_mode}",
        f"- transcript: `{transcript_path.relative_to(ROOT)}`",
        f"- segment drafts: {len(draft_paths)}",
        "",
        "## Review Checklist",
        "",
        "- Confirm the board snapshot matches the transcript excerpt.",
        "- Rewrite `board_summary_draft` into a cleaner board description when needed.",
        "- Expand `reasoning_steps_draft` into the teacher's actual reading sequence.",
        "- Decide whether this is a case card, a reusable rule, or a reasoning pattern.",
        "",
        "## Draft Segments",
        "",
    ]
    for path in draft_paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        transcript_excerpt = str(payload.get("transcript_excerpt", "")).replace("\n", " ").strip()
        transcript_excerpt = transcript_excerpt[:220] + ("..." if len(transcript_excerpt) > 220 else "")
        board_summary = str(payload.get("board_summary_draft", "")).strip() or "Pending review"
        conclusion = str(payload.get("final_conclusion_draft", "")).strip() or "Pending review"
        lines.extend(
            [
                f"### {payload.get('clip_id', path.stem)}",
                "",
                f"- time: `{payload.get('start_timestamp')} -> {payload.get('end_timestamp')}`",
                f"- draft file: `{path.relative_to(ROOT)}`",
                f"- focus guess: {payload.get('question_type_guess') or 'Pending review'}",
                f"- keyframes: {len(payload.get('keyframes', []))}",
                f"- transcript excerpt: {transcript_excerpt or 'None'}",
                f"- board summary draft: {board_summary}",
                f"- conclusion draft: {conclusion}",
                "",
            ]
        )
        keyframes = payload.get("keyframes", [])[:3]
        if keyframes:
            lines.append("Keyframes:")
            for frame in keyframes:
                lines.append(f"- `{frame.get('timestamp')}` `{frame.get('frame_path')}`")
            lines.append("")
    summary_path.write_text("\n".join(lines), encoding="utf-8")
    return summary_path


def refresh_qimen_keyword_index(job: Job) -> None:
    script = SCRIPTS_DIR / "reindex_qimen_knowledge.py"
    if not script.exists():
        return
    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0 and result.stdout.strip():
        job.log(result.stdout.strip().splitlines()[-1])
    elif result.returncode != 0 and result.stderr.strip():
        job.log(f"qimen keyword reindex skipped: {result.stderr.strip().splitlines()[-1]}")


def call_openai_extract(job: Job, chunk_payload: dict[str, Any], api_key: str) -> dict[str, Any]:
    template = read_template(ROOT / "specs" / "knowledge-base" / "extraction-prompt-template.md")
    teacher_glossary, teacher_glossary_path = load_teacher_glossary(job.teacher)
    glossary_terms = list(DOMAIN_GLOSSARY.get("canonical_terms", []))
    glossary_terms.extend(teacher_glossary.get("canonical_terms", []))
    prompt = (
        f"{template}\n\n"
        f"Teacher: {job.teacher}\n"
        f"Course: {job.course}\n"
        f"Notes: {job.notes or 'None'}\n"
        f"Loaded teacher glossary: {teacher_glossary_path or 'none'}\n"
        f"Preferred canonical terms: {json.dumps(glossary_terms, ensure_ascii=False)}\n"
        f"Chunk JSON:\n{json.dumps(chunk_payload, ensure_ascii=False, indent=2)}\n"
    )
    payload = {
        "model": job.extraction_model,
        "instructions": "Return JSON only. Extract reusable BaZi knowledge cards. Do not explain.",
        "input": prompt,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "extracted_cards",
                "strict": True,
                "schema": CARD_SCHEMA,
            }
        },
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI request failed: {error.code} {body}") from error

    data = json.loads(raw)
    text = text_from_response_payload(data)
    return json.loads(text)


def save_cards(job: Job, chunk_payload: dict[str, Any], extracted: dict[str, Any]) -> int:
    cards = extracted.get("cards", [])
    if not cards:
        return 0

    count = 0
    for index, card in enumerate(cards, start=1):
        topic_family = slugify(str(card.get("topic_family", "misc")))
        topic = slugify(str(card.get("topic", "untitled")))
        target_dir = DRAFTS_DIR / topic_family
        target_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_dir / f"{topic}-{chunk_payload['chunk_id']}-{index:02d}.json"
        card_payload = {
            "id": f"{topic}-{chunk_payload['chunk_id']}-{index:02d}",
            "source": {
                "teacher": job.teacher,
                "course": job.course,
                "lesson": job.filename,
                "source_file": chunk_payload["source_file"],
                "timestamp": "",
                "chunk_id": chunk_payload["chunk_id"],
            },
            **card,
            "review_status": "draft",
        }
        target_file.write_text(
            json.dumps(card_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        count += 1
    return count


def collect_canonical_terms(teacher_glossary: dict[str, Any]) -> list[str]:
    terms: list[str] = []
    for source in [DOMAIN_GLOSSARY.get("canonical_terms", []), teacher_glossary.get("canonical_terms", [])]:
        for item in source:
            canonical = str(item.get("canonical", "")).strip()
            if canonical and canonical not in terms:
                terms.append(canonical)
    return terms


def top_term_hits(text: str, terms: list[str], limit: int = 12) -> list[tuple[str, int]]:
    hits: list[tuple[str, int]] = []
    for term in terms:
        count = len(re.findall(re.escape(term), text))
        if count > 0:
            hits.append((term, count))
    hits.sort(key=lambda item: (-item[1], -len(item[0]), item[0]))
    return hits[:limit]


def write_review_summary(job: Job, transcript_path: Path, chunk_paths: list[Path], teacher_glossary: dict[str, Any]) -> Path:
    transcript_text = transcript_path.read_text(encoding="utf-8")
    chunk_payloads = [json.loads(path.read_text(encoding="utf-8")) for path in chunk_paths]
    terms = collect_canonical_terms(teacher_glossary)
    term_hits = top_term_hits(transcript_text, terms)

    relative_transcript = transcript_path.relative_to(ROOT)
    relative_chunks = [path.relative_to(ROOT) for path in chunk_paths]
    summary_dir = REVIEW_READY_DIR / slugify(job.teacher) / slugify(job.course)
    summary_dir.mkdir(parents=True, exist_ok=True)
    summary_path = summary_dir / f"{slugify(job.upload_path.stem)}-review.md"

    lines = [
        f"# Review Ready: {job.filename}",
        "",
        f"- teacher: {job.teacher or 'Unknown'}",
        f"- course: {job.course or 'Unknown'}",
        f"- source media: `{job.upload_path.relative_to(ROOT)}`",
        f"- transcript: `{relative_transcript}`",
        f"- chunks: {len(chunk_paths)}",
        f"- loaded glossaries: {', '.join(job.loaded_glossaries) if job.loaded_glossaries else 'domain-glossary.json'}",
        "",
        "## Suggested Focus Terms",
        "",
    ]

    if term_hits:
        for term, count in term_hits:
            lines.append(f"- `{term}`: {count}")
    else:
        lines.append("- No canonical glossary terms detected strongly enough for summary.")

    lines.extend([
        "",
        "## Chunks To Review",
        "",
    ])
    for path, payload in zip(relative_chunks, chunk_payloads):
        preview = str(payload.get("text", "")).replace("\n", " ").strip()
        preview = preview[:180] + ("..." if len(preview) > 180 else "")
        lines.append(f"- `{payload.get('chunk_id', path.stem)}`")
        lines.append(f"  - file: `{path}`")
        lines.append(f"  - preview: {preview}")

    lines.extend([
        "",
        "## Next Step",
        "",
        "- Review the chunk previews above.",
        "- Turn reusable concepts into teacher rules or glossary corrections.",
        "- Merge validated rules into `specs/knowledge-base/teacher-rule-library.json`.",
        "",
    ])
    summary_path.write_text("\n".join(lines), encoding="utf-8")
    return summary_path


def process_job(job: Job, api_key: str) -> None:
    try:
        teacher_glossary, teacher_glossary_path = load_teacher_glossary(job.teacher)
        job.loaded_glossaries = ["domain-glossary.json"]
        if teacher_glossary_path:
            job.loaded_glossaries.append(teacher_glossary_path)
            job.log(f"Loaded teacher glossary: {teacher_glossary_path}")
        else:
            job.log("No teacher glossary found; using shared domain glossary only")

        if job.course_mode == "qimen_multimodal":
            process_qimen_job(job, teacher_glossary, api_key)
            return

        job.update("running", "Transcribing with Whisper")
        transcript_path = transcribe(job, teacher_glossary)

        job.update("running", "Chunking transcript")
        chunk_paths = chunk_transcript(job, transcript_path)

        if not api_key:
            summary_path = write_review_summary(job, transcript_path, chunk_paths, teacher_glossary)
            job.log(f"Review summary saved: {summary_path.relative_to(ROOT)}")
            job.log("Transcription and chunking finished without API extraction; the job is ready for manual review.")
            job.update("ready_for_review", "Transcription complete. Ready for manual review.")
            return

        total_cards = 0

        def extract_one(position: int, chunk_path: Path) -> tuple[str, int]:
            chunk_payload = json.loads(chunk_path.read_text(encoding="utf-8"))
            job.log(f"Extracting chunk {position}/{len(chunk_paths)}")
            extracted = call_openai_extract(job, chunk_payload, api_key)
            card_count = save_cards(job, chunk_payload, extracted)
            job.log(f"Saved {card_count} draft cards from {chunk_payload['chunk_id']}")
            return chunk_payload["chunk_id"], card_count

        job.update("running", f"Extracting cards with {job.extraction_workers} workers")
        with ThreadPoolExecutor(max_workers=max(1, job.extraction_workers)) as executor:
            futures = [
                executor.submit(extract_one, position, chunk_path)
                for position, chunk_path in enumerate(chunk_paths, start=1)
            ]
            completed = 0
            for future in as_completed(futures):
                chunk_id, card_count = future.result()
                completed += 1
                total_cards += card_count
                job.update("running", f"Extracted {completed}/{len(chunk_paths)} chunks; latest {chunk_id}")

        job.update("completed", f"Completed. Saved {total_cards} draft cards.")
    except Exception as error:
        job.log(str(error))
        job.update("failed", str(error))
    finally:
        if AUTO_CLEANUP_INTERMEDIATE and job.status in {"ready_for_review", "completed"}:
            cleanup_intermediate_files(job)


def worker_loop() -> None:
    while True:
        job, api_key = JOB_QUEUE.get()
        try:
            process_job(job, api_key)
        finally:
            JOB_QUEUE.task_done()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/" or self.path == "/index.html":
            data = (STATIC_DIR / "index.html").read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if self.path == "/api/jobs":
            with JOBS_LOCK:
                jobs = [job.as_dict() for job in sorted(JOBS.values(), key=lambda item: item.id, reverse=True)]
            json_response(self, {"jobs": jobs})
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        if self.path != "/api/upload":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        filename = urllib.parse.unquote(self.headers.get("X-Filename", "upload.bin"))
        teacher = urllib.parse.unquote(self.headers.get("X-Teacher", "Unknown Teacher"))
        course = urllib.parse.unquote(self.headers.get("X-Course", "")).strip()
        if not course:
            course = course_from_filename(filename)
        language = urllib.parse.unquote(self.headers.get("X-Language", "zh"))
        extraction_model = urllib.parse.unquote(self.headers.get("X-OpenAI-Model", "gpt-4o-mini"))
        whisper_model = urllib.parse.unquote(self.headers.get("X-Whisper-Model", "turbo"))
        course_mode = urllib.parse.unquote(self.headers.get("X-Course-Mode", "bazi_transcript")).strip() or "bazi_transcript"
        api_key = urllib.parse.unquote(self.headers.get("X-OpenAI-Key", os.getenv("OPENAI_API_KEY", "")))
        notes = urllib.parse.unquote(self.headers.get("X-Notes", ""))
        custom_glossary = urllib.parse.unquote(self.headers.get("X-Custom-Glossary", ""))
        whisper_threads = int(urllib.parse.unquote(self.headers.get("X-Whisper-Threads", str(DEFAULT_WHISPER_THREADS))))
        extraction_workers = int(urllib.parse.unquote(self.headers.get("X-Extraction-Workers", str(DEFAULT_EXTRACTION_WORKERS))))
        preprocess_audio = urllib.parse.unquote(self.headers.get("X-Preprocess-Audio", "true")).lower() != "false"

        body = self.rfile.read(content_length)
        job_id = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
        safe_name = slugify(Path(filename).stem) + Path(filename).suffix.lower()
        if course_mode == "qimen_multimodal":
            upload_root = RAW_QIMEN_VIDEOS_DIR / slugify(teacher) / slugify(course)
        else:
            upload_root = UPLOAD_DIR
        upload_root.mkdir(parents=True, exist_ok=True)
        upload_path = upload_root / f"{job_id}-{safe_name}"
        upload_path.write_bytes(body)

        job = Job(
            id=job_id,
            filename=filename,
            teacher=teacher,
            course=course,
            language=language,
            extraction_model=extraction_model,
            whisper_model=whisper_model,
            whisper_threads=max(1, whisper_threads),
            extraction_workers=max(1, extraction_workers),
            preprocess_audio=preprocess_audio,
            course_mode=course_mode,
            notes=notes,
            custom_glossary=custom_glossary,
            upload_path=upload_path,
        )
        with JOBS_LOCK:
            JOBS[job.id] = job

        JOB_QUEUE.put((job, api_key))
        json_response(self, {"ok": True, "job_id": job.id}, 202)


def main() -> int:
    os.chdir(ROOT)
    global WHISPER_DEVICE
    WHISPER_DEVICE = detect_whisper_device()
    port = int(os.getenv("INGESTION_UI_PORT", "8765"))
    worker = threading.Thread(target=worker_loop, daemon=True)
    worker.start()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Knowledge ingestion UI: http://127.0.0.1:{port}")
    print(f"Whisper device: {WHISPER_DEVICE or 'cpu'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
