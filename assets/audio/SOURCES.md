# Audio sources and licensing

## Firearm recordings

- Active weapon reports: extracted *Call of Duty: Modern Warfare 2* WAV collection downloaded from the source link published with [Modern Warfare 2 Weapons Sounds](https://www.youtube.com/watch?v=4E7cV7XBKyE). Current mapping: M4, AK-47, Glock, CheyTac, M249, Winchester 1200, KRISS Vector and P90.
- The complete local source libraries are retained under `.audio-import/mw2/`: 451 fire/weapon WAV files and 245 reload WAV files. This directory is excluded from Git and the normal static build; processed active reports, staged reload foley and shell bounces are copied into game assets.

- Source: [The Free Firearm Sound Library on OpenGameArt](https://opengameart.org/content/the-free-firearm-sound-library)
- Authors/recordists: Ben Jaszczak, Brian Nelson, Kevin Heras, and Matthew Nanney
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Runtime derivatives: `weapons/*.ogg`, trimmed and Opus-encoded from the prepared WAV library.
- Mapping: AR-15 → rifle; Walther PPQ → pistol; Mossberg Model 190 → shotgun; Tikka T3 → sniper; PPSh → LMG.

The source page explicitly states that the library may be used without royalty or credit for personal or professional applications. Attribution is retained here as provenance even though CC0 does not require it.

## Impacts and footsteps

- Source: [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds)
- Author: Kenney
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Runtime files: `impacts/*.ogg` (metal impacts, punch/body impacts, and concrete footsteps).

## Original generated media

- `voice/*.mp3`: original Mandarin tactical callouts generated for Total Frontline with MiniMax `speech-2.8-hd` (`male-qn-jingying`).
- `music/frontline-loop.mp3`: original instrumental tactical electronic loop generated for Total Frontline with MiniMax `music-3.0`, 110 BPM in A minor.
- `music/main-menu-theme-epic-1.mp3` and `main-menu-theme-epic-3.mp3`: the two active homepage BGM candidates. Generated with MiniMax `music-3.0` (see `scripts/generate-menu-music-variants.py`), post-processed into seamless loops (epic-1 ~245s, epic-3 ~134s). Both are instrumental, no vocals, epic/tragic war-game atmosphere. On each main-menu open the game randomly picks one of these two tracks.
- `weapons/layers/*-transient.ogg`: locally imported game weapon reports, edited and mastered from the retained WAV source library.
- `weapons/layers/*-suppressed.ogg`: first-person silenced reports from the same Modern Warfare 2 fire library (M4 / USP-SD / P90 / Magpul / shotgun / sniper / M240). Used only when a suppressor is equipped; unsuppressed reports stay on the transient layers.
- `weapons/layers/*-mech.ogg` and `*-tail.ogg`: original mechanisms and outdoor tails generated with ByteDance Seed Audio; retained as spare assets but no longer layered over the imported reports.
- Generated on 2026-08-13. The menu theme was re-generated with MiniMax music-3.0 on 2026-08-15. No prompt referenced any artist, soundtrack, protected character, or existing composition.

MiniMax-generated files are project-specific generated outputs rather than third-party stock recordings. Their use remains subject to the MiniMax service terms applicable to the account that generated them.

## Runtime fallback

Every sampled sound is optional at runtime. `src/01-audio.ts` and `src/01b-audio-weapons.ts` remain the permanent procedural Web Audio implementation. If fetch, codec support, decoding, autoplay permission, or an individual asset fails, gameplay continues with procedural weapon reports, impacts, footsteps, radio texture, and ambience.

## Mastering and runtime mix

- Close weapon transients: 48 kHz Opus, high-pass at 28 Hz, 2.4:1 transient compression, target -16 LUFS / -2 dBTP.
- Weapon mechanisms: 48 kHz Opus, high-pass at 120 Hz, 3:1 compression, target -22 LUFS / -4 dBTP.
- Outdoor tails: band-limited, target -25 LUFS / -6 dBTP (light) and -23 LUFS / -5 dBTP (heavy).
- CC0 weapon body layers: target -19 LUFS / -2.5 dBTP. Impacts and footsteps: target -22 LUFS / -3 dBTP.
- Radio dialogue: high-pass at 90 Hz, target -18 LUFS / -3 dBTP. Music: target -20 LUFS / -2 dBTP.
- Runtime routes weapon, impact, dialogue and music into separate EQ/compressor buses. Gunfire and dialogue duck music; a fast final safety limiter catches overlapping peaks.
- Reload foley is split into lift, magazine-out, magazine-in and action stages and follows animation checkpoints. Shell bounces use six light-brass and four heavy-shell variations selected at each physical bounce.
- Weapon distance gain uses a shared inverse-power curve for sampled and procedural reports: 0 m ≈ 0.64, 10 m ≈ 0.35, 20 m ≈ 0.17, 40 m ≈ 0.068 and 70 m ≈ 0.029, with progressively stronger low-pass filtering. Only local/very-near fire ducks music.
