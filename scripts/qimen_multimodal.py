from __future__ import annotations

import csv
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


LogFn = Callable[[str], None]

SYSTEM_PROFILE_TERMS: dict[str, tuple[str, ...]] = {
    "chai_bu": ("拆补", "拆补局", "拆补无闰"),
    "zhi_run": ("置闰", "超接置闰", "超接"),
    "turning_plate": ("转盘奇门", "转盘"),
    "flying_plate": ("飞盘奇门", "飞盘"),
}


def slugify(value: str) -> str:
    keep: list[str] = []
    for char in value.strip().lower():
        if char.isalnum():
            keep.append(char)
        elif char in {" ", "-", "_"}:
            keep.append("-")
    return "".join(keep).strip("-") or "unknown"


def run_command(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        check=False,
    )


def seconds_to_timestamp(seconds: float) -> str:
    total_ms = max(0, int(round(seconds * 1000)))
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def parse_srt(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"\n\s*\n", text.strip())
    cues: list[dict[str, Any]] = []
    for block in blocks:
        lines = [line.strip("\ufeff") for line in block.splitlines() if line.strip()]
        if len(lines) < 3:
            continue
        time_line = lines[1]
        match = re.match(
            r"(?P<start>\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(?P<end>\d{2}:\d{2}:\d{2},\d{3})",
            time_line,
        )
        if not match:
            continue
        cues.append(
            {
                "sequence": int(lines[0]) if lines[0].isdigit() else len(cues) + 1,
                "start_seconds": srt_timestamp_to_seconds(match.group("start")),
                "end_seconds": srt_timestamp_to_seconds(match.group("end")),
                "text": " ".join(lines[2:]).strip(),
            }
        )
    return cues


def srt_timestamp_to_seconds(value: str) -> float:
    hours, minutes, rest = value.split(":")
    seconds, millis = rest.split(",")
    return (
        int(hours) * 3600
        + int(minutes) * 60
        + int(seconds)
        + int(millis) / 1000
    )


def transcript_plain_text(cues: list[dict[str, Any]]) -> str:
    return "\n".join(cue["text"] for cue in cues if cue.get("text"))


def detect_system_profile_mentions(text: str) -> dict[str, Any]:
    mentions: list[str] = []
    matched_terms: list[str] = []
    for label, terms in SYSTEM_PROFILE_TERMS.items():
        local_hits = [term for term in terms if term in text]
        if local_hits:
            mentions.append(label)
            matched_terms.extend(local_hits)
    system_guess = ""
    if "zhi_run" in mentions and "chai_bu" not in mentions:
        system_guess = "zhi_run"
    elif "chai_bu" in mentions and "zhi_run" not in mentions:
        system_guess = "chai_bu"
    return {
        "mentions": mentions,
        "matched_terms": matched_terms,
        "system_profile_guess": system_guess,
    }


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
    result = run_command(args, path.parent)
    if result.returncode != 0:
        return None
    try:
        return float(result.stdout.strip())
    except ValueError:
        return None


def has_video_stream(path: Path) -> bool:
    args = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    result = run_command(args, path.parent)
    if result.returncode != 0:
        return False
    return any(line.strip() == "video" for line in result.stdout.splitlines())


@dataclass
class Keyframe:
    path: Path
    timestamp_seconds: float
    kind: str


def extract_keyframes(
    *,
    video_path: Path,
    output_dir: Path,
    log: LogFn,
    interval_seconds: int = 20,
    scene_threshold: float = 0.35,
) -> list[dict[str, Any]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    if not has_video_stream(video_path):
        log("No video stream detected; continuing in audio-only mode without keyframes")
        return []

    scene_dir = output_dir / "scene"
    interval_dir = output_dir / "interval"
    scene_dir.mkdir(parents=True, exist_ok=True)
    interval_dir.mkdir(parents=True, exist_ok=True)

    frames: list[Keyframe] = []

    scene_pattern = scene_dir / "scene-%05d.jpg"
    scene_args = [
        "ffmpeg",
        "-hide_banner",
        "-y",
        "-i",
        str(video_path),
        "-vf",
        f"select='gt(scene,{scene_threshold})',showinfo",
        "-vsync",
        "vfr",
        str(scene_pattern),
    ]
    scene_result = run_command(scene_args, video_path.parent)
    if scene_result.returncode == 0:
        scene_paths = sorted(scene_dir.glob("scene-*.jpg"))
        scene_times = re.findall(r"pts_time:([0-9.]+)", scene_result.stderr)
        for path, value in zip(scene_paths, scene_times):
            try:
                frames.append(Keyframe(path=path, timestamp_seconds=float(value), kind="scene"))
            except ValueError:
                continue
        if scene_paths:
            log(f"Extracted {len(scene_paths)} scene keyframes")
    else:
        log("Scene keyframe extraction failed; continuing with interval frames")

    interval_pattern = interval_dir / "interval-%05d.jpg"
    interval_args = [
        "ffmpeg",
        "-hide_banner",
        "-y",
        "-i",
        str(video_path),
        "-vf",
        f"fps=1/{interval_seconds}",
        str(interval_pattern),
    ]
    interval_result = run_command(interval_args, video_path.parent)
    if interval_result.returncode == 0:
        interval_paths = sorted(interval_dir.glob("interval-*.jpg"))
        for index, path in enumerate(interval_paths):
            frames.append(
                Keyframe(
                    path=path,
                    timestamp_seconds=float(index * interval_seconds),
                    kind="interval",
                )
            )
        if interval_paths:
            log(f"Extracted {len(interval_paths)} interval keyframes")
    else:
        raise RuntimeError("Interval keyframe extraction failed")

    merged = dedupe_keyframes(frames)
    if not merged:
        raise RuntimeError("No keyframes extracted")

    result: list[dict[str, Any]] = []
    for frame in merged:
        result.append(
            {
                "path": str(frame.path),
                "timestamp_seconds": round(frame.timestamp_seconds, 3),
                "timestamp": seconds_to_timestamp(frame.timestamp_seconds),
                "kind": frame.kind,
            }
        )
    return result


def dedupe_keyframes(frames: list[Keyframe], proximity_seconds: float = 4.0) -> list[Keyframe]:
    ordered = sorted(frames, key=lambda item: (item.timestamp_seconds, 0 if item.kind == "scene" else 1))
    merged: list[Keyframe] = []
    for frame in ordered:
        if not merged:
            merged.append(frame)
            continue
        last = merged[-1]
        if abs(frame.timestamp_seconds - last.timestamp_seconds) <= proximity_seconds:
            if last.kind != "scene" and frame.kind == "scene":
                merged[-1] = frame
            continue
        merged.append(frame)
    return merged


def ocr_keyframes(
    *,
    frames: list[dict[str, Any]],
    output_dir: Path,
    log: LogFn,
    languages: str = "chi_sim+eng",
) -> list[dict[str, Any]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    for frame in frames:
        frame_path = Path(frame["path"])
        tsv_args = [
            "tesseract",
            str(frame_path),
            "stdout",
            "-l",
            languages,
            "--psm",
            "6",
            "tsv",
        ]
        result = run_command(tsv_args, frame_path.parent)
        if result.returncode != 0:
            log(f"OCR failed for {frame_path.name}")
            blocks: list[dict[str, Any]] = []
            text = ""
        else:
            blocks = parse_tesseract_tsv(result.stdout)
            text = " ".join(block["text"] for block in blocks if block.get("text")).strip()

        payload = {
            "frame_path": str(frame_path),
            "timestamp_seconds": frame["timestamp_seconds"],
            "timestamp": frame["timestamp"],
            "kind": frame["kind"],
            "text": text,
            "blocks": blocks,
        }
        target = output_dir / f"{frame_path.stem}.json"
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        results.append(payload)
    log(f"OCR completed for {len(results)} keyframes")
    return results


def parse_tesseract_tsv(raw: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(raw.splitlines(), delimiter="\t")
    blocks: list[dict[str, Any]] = []
    for row in reader:
        text = (row.get("text") or "").strip()
        if not text:
            continue
        try:
            confidence = float(row.get("conf") or "-1")
        except ValueError:
            confidence = -1.0
        blocks.append(
            {
                "text": text,
                "left": int(row.get("left") or 0),
                "top": int(row.get("top") or 0),
                "width": int(row.get("width") or 0),
                "height": int(row.get("height") or 0),
                "confidence": confidence,
            }
        )
    return blocks


def build_aligned_segments(
    *,
    cues: list[dict[str, Any]],
    ocr_results: list[dict[str, Any]],
    teacher: str,
    course: str,
    lesson: str,
    source_video: str,
    output_dir: Path,
    min_duration_seconds: int = 25,
    max_duration_seconds: int = 90,
    min_chars: int = 120,
    split_gap_seconds: int = 25,
) -> list[dict[str, Any]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    for existing in output_dir.glob("*.json"):
        existing.unlink()
    if not cues:
        cues = [
            {
                "sequence": 1,
                "start_seconds": 0.0,
                "end_seconds": max((item["timestamp_seconds"] for item in ocr_results), default=0.0),
                "text": "",
            }
        ]

    anchors = sorted(
        {
            round(item["timestamp_seconds"], 3)
            for item in ocr_results
            if item["kind"] == "scene"
        }
    )
    segments: list[dict[str, Any]] = []
    buffer: list[dict[str, Any]] = []
    anchor_index = 0
    next_anchor = anchors[anchor_index] if anchors else None

    def flush_buffer(reason: str) -> None:
        nonlocal buffer
        if not buffer:
            return
        start = buffer[0]["start_seconds"]
        end = buffer[-1]["end_seconds"]
        excerpt = " ".join(item["text"] for item in buffer if item.get("text")).strip()
        attached_frames = [
            item
            for item in ocr_results
            if item["timestamp_seconds"] >= start - 5 and item["timestamp_seconds"] <= end + 5
        ]
        profile_probe_text = "\n".join(
            [
                excerpt,
                *[item.get("text", "") for item in attached_frames],
            ]
        ).strip()
        profile_probe = detect_system_profile_mentions(profile_probe_text)
        clip_id = f"{slugify(course)}-{len(segments) + 1:04d}"
        segment = {
            "clip_id": clip_id,
            "source_video": source_video,
            "teacher": teacher,
            "course": course,
            "lesson": lesson,
            "start_timestamp": seconds_to_timestamp(start),
            "end_timestamp": seconds_to_timestamp(end),
            "start_seconds": round(start, 3),
            "end_seconds": round(end, 3),
            "transcript_excerpt": excerpt,
            "keyframes": [
                {
                    "frame_path": item["frame_path"],
                    "timestamp_seconds": item["timestamp_seconds"],
                    "timestamp": item["timestamp"],
                    "kind": item["kind"],
                    "ocr_text_preview": item["text"][:200],
                }
                for item in attached_frames
            ],
            "ocr_blocks": attached_frames,
            "board_summary_draft": "",
            "reasoning_steps_draft": [],
            "question_type_guess": "",
            "final_conclusion_draft": "",
            "reusable_rule_hint": "",
            "system_profile_mentions": profile_probe["mentions"],
            "matched_profile_terms": profile_probe["matched_terms"],
            "system_profile_guess": profile_probe["system_profile_guess"],
            "oracle_alignment_targets": [
                "mQimen.app",
                "china95.net",
            ],
            "split_reason": reason,
            "review_status": "draft",
        }
        segments.append(segment)
        buffer = []

    for cue in cues:
        buffer.append(cue)
        duration = buffer[-1]["end_seconds"] - buffer[0]["start_seconds"]
        text_len = len(" ".join(item["text"] for item in buffer))

        crossed_anchor = False
        while next_anchor is not None and cue["end_seconds"] >= next_anchor:
            crossed_anchor = True
            anchor_index += 1
            next_anchor = anchors[anchor_index] if anchor_index < len(anchors) else None

        if duration >= max_duration_seconds:
            flush_buffer("max_duration")
            continue

        if crossed_anchor and duration >= min_duration_seconds and text_len >= min_chars:
            flush_buffer("scene_anchor")
            continue

        if duration >= min_duration_seconds and text_len >= 450:
            flush_buffer("text_density")

    if buffer:
        flush_buffer("tail")

    if len(segments) > 1:
        segments = split_dense_segments(segments, split_gap_seconds=split_gap_seconds)

    for index, segment in enumerate(segments, start=1):
        target = output_dir / f"{index:04d}.json"
        target.write_text(json.dumps(segment, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return segments


def split_dense_segments(
    segments: list[dict[str, Any]],
    *,
    split_gap_seconds: int,
) -> list[dict[str, Any]]:
    rebuilt: list[dict[str, Any]] = []
    for segment in segments:
        frames = segment.get("keyframes", [])
        if len(frames) < 5:
            rebuilt.append(segment)
            continue
        frame_times = [frame["timestamp_seconds"] for frame in frames]
        if max(frame_times) - min(frame_times) < 2 * split_gap_seconds:
            rebuilt.append(segment)
            continue
        midpoint = min(frame_times) + (max(frame_times) - min(frame_times)) / 2
        left_frames = [frame for frame in frames if frame["timestamp_seconds"] <= midpoint]
        right_frames = [frame for frame in frames if frame["timestamp_seconds"] > midpoint]
        if not left_frames or not right_frames:
            rebuilt.append(segment)
            continue
        left = dict(segment)
        right = dict(segment)
        left["clip_id"] = f"{segment['clip_id']}-a"
        right["clip_id"] = f"{segment['clip_id']}-b"
        left["end_seconds"] = round(left_frames[-1]["timestamp_seconds"], 3)
        left["end_timestamp"] = seconds_to_timestamp(left["end_seconds"])
        right["start_seconds"] = round(right_frames[0]["timestamp_seconds"], 3)
        right["start_timestamp"] = seconds_to_timestamp(right["start_seconds"])
        left["keyframes"] = left_frames
        right["keyframes"] = right_frames
        left["ocr_blocks"] = [block for block in segment["ocr_blocks"] if block["timestamp_seconds"] <= midpoint]
        right["ocr_blocks"] = [block for block in segment["ocr_blocks"] if block["timestamp_seconds"] > midpoint]
        left["split_reason"] = "visual_split"
        right["split_reason"] = "visual_split"
        rebuilt.extend([left, right])
    if rebuilt:
        return rebuilt
    return segments
