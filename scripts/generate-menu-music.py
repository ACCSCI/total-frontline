#!/usr/bin/env python3
"""Regenerate the main-menu BGM for Total Frontline using MiniMax music-3.0.

Generates an epic, Call-of-Duty-style military shooter menu theme with no
vocals, then post-processes it into a longer seamless loop (>= 60s) and
loudness-normalizes to the project's music target.

Usage:
    python scripts/generate-menu-music.py [output.mp3]
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 44100
CROSSFADE_SECONDS = 2.0
MIN_DURATION = 60.0

PROMPT = (
    "Epic cinematic war game main menu theme, modern military shooter soundtrack, "
    "Call of Duty style, grand and heroic, dark and intense, powerful low brass stabs, "
    "massive taiko drums, military snare rolls, timpani, deep sub bass, wide strings, "
    "orchestral percussion, relentless heavy drums, no vocals, no singing, no lyrics, "
    "instrumental. This must be a seamless continuous loop: no intro, no outro, no fade in, "
    "no fade out, no silence at the start or end, suitable for repeating forever as game "
    "menu background music. Make it about 60 seconds long."
)


def run(cmd: list[str]) -> None:
    subprocess.run(subprocess.list2cmdline(cmd), shell=True, check=True)


def generate_raw(out: Path) -> None:
    run([
        "mmx", "music", "generate",
        "--prompt", PROMPT,
        "--genre", "cinematic orchestral military",
        "--mood", "epic, intense, grand, heroic, dark",
        "--instruments", "taiko drums, military snare, timpani, low brass, strings, sub bass, orchestral percussion",
        "--tempo", "moderate, powerful",
        "--bpm", "90",
        "--key", "D minor",
        "--avoid", "vocals, singing, lyrics, pop, EDM, soft, quiet, acoustic guitar, piano solo, fade out, intro, silence",
        "--use-case", "seamless loopable main menu theme for a first-person military shooter video game",
        "--structure", "continuous loop",
        "--instrumental",
        "--model", "music-3.0",
        "--out", str(out),
        "--non-interactive",
        "--quiet",
    ])


def decode_to_float(path: Path) -> tuple[np.ndarray, int]:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_tmp = Path(f.name)
    run(["ffmpeg", "-y", "-v", "error", "-i", str(path), "-f", "wav", str(wav_tmp)])
    try:
        with wave.open(str(wav_tmp), "rb") as w:
            n = w.getnframes()
            raw = w.readframes(n)
            sr = w.getframerate()
            ch = w.getnchannels()
    finally:
        wav_tmp.unlink(missing_ok=True)
    x = np.frombuffer(raw, dtype="<i2").reshape(-1, ch).astype(np.float64) / 32768.0
    return x, sr


def make_loop(src: Path, out: Path) -> None:
    x, sr = decode_to_float(src)
    if sr != SAMPLE_RATE:
        raise SystemExit(f"Unexpected sample rate: {sr}")
    ch = x.shape[1]
    n = len(x)
    c = int(CROSSFADE_SECONDS * sr)
    if c >= n // 2:
        c = max(1, n // 4)
    m = n - c

    # Build a seamless loop segment: crossfade the tail into the head.
    y = np.empty((m, ch), dtype=np.float64)
    y[c:] = x[c:m]
    t = np.arange(c, dtype=np.float64) / c
    for channel in range(ch):
        y[:c, channel] = x[n - c:n, channel] * (1 - t) + x[:c, channel] * t

    repeats = max(2, int(np.ceil(MIN_DURATION / (m / sr))))
    loop = np.tile(y, (repeats, 1))

    peak = np.max(np.abs(loop))
    if peak > 0:
        loop *= 0.95 / peak

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_out = Path(f.name)
    pcm = (np.clip(loop, -1.0, 1.0) * 32767).astype("<i2")
    interleaved = np.column_stack([pcm[:, 0], pcm[:, 1]]).reshape(-1)
    try:
        with wave.open(str(wav_out), "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(interleaved.tobytes())
        run([
            "ffmpeg", "-y", "-v", "error",
            "-i", str(wav_out),
            "-af", "loudnorm=I=-20:TP=-2:LRA=11",
            "-codec:a", "libmp3lame",
            "-b:a", "256k",
            "-ar", "44100",
            "-ac", "2",
            str(out),
        ])
    finally:
        wav_out.unlink(missing_ok=True)

    print(f"Wrote {out} ({out.stat().st_size} bytes, {len(loop) / sr:.2f}s)")


def main() -> int:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "assets/audio/music/main-menu-theme-epic-3.mp3")
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "raw.mp3"
        generate_raw(raw)
        make_loop(raw, out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
