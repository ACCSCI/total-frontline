#!/usr/bin/env python3
"""Generate several epic/tragic war-game BGM variants with MiniMax music-3.0.

Each variant is generated as an instrumental track, then post-processed into a
seamless loop of at least 90 seconds so they are easy to compare in the menu.

Outputs:
    assets/audio/music/main-menu-theme-epic-1.mp3
    assets/audio/music/main-menu-theme-epic-3.mp3
"""

from __future__ import annotations

import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 44100
CROSSFADE_SECONDS = 2.0
MIN_DURATION = 90.0

VARIANTS = [
    {
        "name": "epic-1",
        "prompt": (
            "Epic tragic war game main menu theme, modern military shooter soundtrack, "
            "Call of Duty style, grand and sorrowful, heroic sacrifice, massive cinematic "
            "orchestra, low brass lament, deep strings, taiko drums, timpani, military snare, "
            "no vocals, no singing, instrumental. Seamless continuous loop, no intro, no outro, "
            "no fade out, suitable for repeating as game menu music, about 90 seconds long."
        ),
        "mood": "epic, tragic, grand, sorrowful, heroic",
        "instruments": "cinematic orchestra, low brass, deep strings, taiko drums, timpani, military snare, sub bass",
        "bpm": "80",
        "key": "D minor",
    },
    {
        "name": "epic-3",
        "prompt": (
            "Emotional cinematic war theme, tragic and epic, solemn strings, french horns, "
            "timpani, heavy drums, sub bass, no vocals, no singing, grand sad atmosphere, "
            "military shooter main menu, Call of Duty style, instrumental. Seamless continuous "
            "loop, no intro, no outro, no fade out, suitable for repeating as game menu music, "
            "about 90 seconds long."
        ),
        "mood": "emotional, tragic, epic, solemn, grand, sad",
        "instruments": "strings, french horns, timpani, heavy drums, sub bass, low brass",
        "bpm": "75",
        "key": "C minor",
    },
]


def run(cmd: list[str]) -> None:
    subprocess.run(subprocess.list2cmdline(cmd), shell=True, check=True)


def generate_raw(out: Path, variant: dict) -> None:
    run([
        "mmx", "music", "generate",
        "--prompt", variant["prompt"],
        "--genre", "cinematic orchestral military",
        "--mood", variant["mood"],
        "--instruments", variant["instruments"],
        "--tempo", "slow, powerful",
        "--bpm", variant["bpm"],
        "--key", variant["key"],
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
    root = Path("assets/audio/music")
    root.mkdir(parents=True, exist_ok=True)
    for variant in VARIANTS:
        out = root / f"main-menu-theme-{variant['name']}.mp3"
        with tempfile.TemporaryDirectory() as td:
            raw = Path(td) / "raw.mp3"
            print(f"Generating {variant['name']} ...")
            generate_raw(raw, variant)
            make_loop(raw, out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
