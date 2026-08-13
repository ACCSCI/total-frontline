'use strict';
/* =========================================================================
   1c. SAMPLE-BACKED AUDIO

   Real recordings are a progressive enhancement over the permanent
   procedural SFX implementation in 01-audio / 01b-audio-weapons. Assets are
   fetched only after the player's first interaction. A missing file, failed
   request, unsupported codec or decode error simply falls through to the
   original synthesised sound.
   ========================================================================= */
const AUDIO_ASSET_MANIFEST = {
  weapon: {
    rifle: ['assets/audio/weapons/rifle-1.ogg', 'assets/audio/weapons/rifle-2.ogg'],
    shotgun: ['assets/audio/weapons/shotgun-1.ogg', 'assets/audio/weapons/shotgun-2.ogg'],
    pistol: ['assets/audio/weapons/pistol-1.ogg', 'assets/audio/weapons/pistol-2.ogg'],
    sniper: ['assets/audio/weapons/sniper-1.ogg', 'assets/audio/weapons/sniper-2.ogg'],
    lmg: ['assets/audio/weapons/lmg-1.ogg', 'assets/audio/weapons/lmg-2.ogg'],
  },
  layer: {
    rifle: 'assets/audio/weapons/layers/rifle-transient.ogg',
    ak: 'assets/audio/weapons/layers/ak-transient.ogg',
    shotgun: 'assets/audio/weapons/layers/shotgun-transient.ogg',
    pistol: 'assets/audio/weapons/layers/pistol-transient.ogg',
    sniper: 'assets/audio/weapons/layers/sniper-transient.ogg',
    lmg: 'assets/audio/weapons/layers/lmg-transient.ogg',
    vector: 'assets/audio/weapons/layers/vector-transient.ogg',
    p90: 'assets/audio/weapons/layers/p90-transient.ogg',
    rifleMech: 'assets/audio/weapons/layers/rifle-mech.ogg',
    pistolMech: 'assets/audio/weapons/layers/pistol-mech.ogg',
    lmgMech: 'assets/audio/weapons/layers/lmg-mech.ogg',
    lightTail: 'assets/audio/weapons/layers/light-tail.ogg',
    heavyTail: 'assets/audio/weapons/layers/heavy-tail.ogg',
  },
  reload: {
    rifle: ['lift', 'out', 'in', 'action'],
    ak: ['lift', 'out', 'in', 'action'],
    pistol: ['lift', 'out', 'in', 'action'],
    sniper: ['lift', 'out', 'in', 'action'],
    lmg: ['lift', 'out', 'in', 'action'],
    vector: ['lift', 'out', 'in', 'action'],
    p90: ['lift', 'out', 'in', 'action'],
    shotgun: ['lift', 'out', 'in', 'action'],
  },
  shell: {
    brass: Array.from({ length: 6 }, (_, i) => `assets/audio/shells/brass-${i + 1}.ogg`),
    heavy: Array.from({ length: 4 }, (_, i) => `assets/audio/shells/heavy-${i + 1}.ogg`),
  },
  impact: {
    metal: ['assets/audio/impacts/metal-1.ogg', 'assets/audio/impacts/metal-2.ogg'],
    flesh: ['assets/audio/impacts/flesh-1.ogg', 'assets/audio/impacts/flesh-2.ogg'],
    footstep: ['assets/audio/impacts/footstep-1.ogg', 'assets/audio/impacts/footstep-2.ogg'],
  },
  voice: {
    deploy: 'assets/audio/voice/squad-deploy.mp3',
    contact: 'assets/audio/voice/enemy-contact.mp3',
    reload: 'assets/audio/voice/cover-reload.mp3',
    uav: 'assets/audio/voice/uav-online.mp3',
    airstrike: 'assets/audio/voice/airstrike-inbound.mp3',
  },
  music: 'assets/audio/music/frontline-loop.mp3',
  menuMusic: 'assets/audio/music/main-menu-theme.mp3',
};

(() => {
  const buffers = new Map<string, AudioBuffer>();
  const failures = new Set<string>();
  let loadStarted = false,
    essentialReady = false,
    mediaReady = false,
    bgmWanted = false,
    menuMusicWanted = false,
    bgmSource: AudioBufferSourceNode | null = null,
    menuMusicSource: AudioBufferSourceNode | null = null,
    voiceSource: AudioBufferSourceNode | null = null;
  let pendingVoice: { key: string; at: number } | null = null;
  let mix: any = null,
    lastWeaponDuck = -1;

  const essential: Array<[string, string]> = [];
  /* The imported game reports are complete mixes, so the older CC0 body
     recordings remain available in the asset library but are not layered on
     top of them at runtime. */
  for (const kind in AUDIO_ASSET_MANIFEST.impact) {
    AUDIO_ASSET_MANIFEST.impact[kind].forEach((path, i) => {
      essential.push([`impact.${kind}.${i}`, path]);
    });
  }
  for (const [key, path] of Object.entries(AUDIO_ASSET_MANIFEST.layer))
    essential.push([`layer.${key}`, path as string]);
  for (const [weapon, stages] of Object.entries(AUDIO_ASSET_MANIFEST.reload))
    for (const stage of stages as string[])
      essential.push([`reload.${weapon}.${stage}`, `assets/audio/weapons/reload/${weapon}-${stage}.ogg`]);
  for (const [kind, paths] of Object.entries(AUDIO_ASSET_MANIFEST.shell))
    (paths as string[]).forEach((path, i) => {
      essential.push([`shell.${kind}.${i}`, path]);
    });
  const media: Array<[string, string]> = Object.entries(AUDIO_ASSET_MANIFEST.voice).map(
    ([key, path]) => [`voice.${key}`, path]
  );
  media.push(['music.frontline', AUDIO_ASSET_MANIFEST.music]);
  media.push(['music.menu', AUDIO_ASSET_MANIFEST.menuMusic]);

  async function loadOne([key, path]: [string, string]) {
    try {
      const response = await fetch(path, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const context: AudioContext | null = SFX._context();
      if (!context) throw new Error('AudioContext unavailable');
      const decoded = await context.decodeAudioData(await response.arrayBuffer());
      buffers.set(key, decoded);
      failures.delete(key);
      if (key === 'music.frontline') startMusic();
      if (key === 'music.menu') startMenuMusic();
      if (
        pendingVoice?.key === key.slice(6) &&
        performance.now() - pendingVoice.at < 2600
      ) {
        const waiting = pendingVoice.key;
        pendingVoice = null;
        playVoice(waiting);
      }
    } catch (_) {
      failures.add(key);
    }
  }

  async function loadSet(entries: Array<[string, string]>) {
    await Promise.allSettled(entries.map(loadOne));
  }

  /* Category processing comes before the permanent master compressor. This
     keeps a rifle burst from pumping dialogue and gives music one clean gain
     point for combat/voice ducking. */
  function ensureMix() {
    if (mix) return mix;
    const context: AudioContext | null = SFX._context(),
      master: AudioNode | null = SFX._master();
    if (!context || !master) return null;
    const bus = (threshold, ratio, attack, release, gainValue, highpass?) => {
      const input = context.createGain(),
        eq = context.createBiquadFilter(),
        comp = context.createDynamicsCompressor(),
        gain = context.createGain();
      eq.type = highpass ? 'highpass' : 'peaking';
      eq.frequency.value = highpass || 2600;
      eq.Q.value = highpass ? 0.7 : 0.55;
      if (!highpass) eq.gain.value = 0;
      comp.threshold.value = threshold;
      comp.knee.value = 10;
      comp.ratio.value = ratio;
      comp.attack.value = attack;
      comp.release.value = release;
      gain.gain.value = gainValue;
      input.connect(eq);
      eq.connect(comp);
      comp.connect(gain);
      gain.connect(master);
      return { input, comp, gain };
    };
    mix = {
      weapon: bus(-13, 3.2, 0.0015, 0.085, 0.9, 32),
      impact: bus(-16, 2.4, 0.003, 0.11, 0.72, 55),
      voice: bus(-20, 4.2, 0.004, 0.16, 1.0, 105),
      music: bus(-18, 2.0, 0.018, 0.32, 0.56),
    };
    return mix;
  }

  function duckMusic(depth, release) {
    const buses = ensureMix(),
      context: AudioContext | null = SFX._context();
    if (!buses || !context) return;
    const p = buses.music.gain.gain,
      now = context.currentTime;
    p.cancelScheduledValues(now);
    p.setTargetAtTime(depth, now, 0.012);
    p.setTargetAtTime(0.56, now + release, 0.16);
  }

  function scheduleLoad() {
    if (loadStarted || !SFX._context()) return;
    loadStarted = true;
    void loadSet(essential).finally(() => {
      essentialReady = true;
      /* Large music decoding never competes with initial rendering or the
         first trigger pull. Voices and BGM enter once combat SFX are ready. */
      setTimeout(() => {
        void loadSet(media).finally(() => {
          mediaReady = true;
          startMusic();
        });
      }, 250);
    });
  }

  function playBuffer(
    key: string,
    options: {
      gain?: number;
      pan?: number;
      delay?: number;
      lowpass?: number;
      highpass?: number;
      rate?: number;
      bus?: string;
    } = {}
  ) {
    const context: AudioContext | null = SFX._context(),
      buses = ensureMix(),
      output: AudioNode | null = buses?.[options.bus || 'impact']?.input || SFX._master(),
      buffer = buffers.get(key);
    if (!context || !output || !buffer) return null;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.rate || 1;
    let tail: AudioNode = source;
    if (options.lowpass) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = options.lowpass;
      tail.connect(filter);
      tail = filter;
    }
    if (options.highpass) {
      const filter = context.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = options.highpass;
      tail.connect(filter);
      tail = filter;
    }
    if (options.pan && context.createStereoPanner) {
      const stereo = context.createStereoPanner();
      stereo.pan.value = clamp(options.pan, -1, 1);
      tail.connect(stereo);
      tail = stereo;
    }
    const gain = context.createGain();
    gain.gain.value = options.gain ?? 1;
    tail.connect(gain);
    gain.connect(output);
    source.start(context.currentTime + (options.delay || 0));
    return source;
  }

  function pickLoaded(prefix: string, count: number) {
    const first = (Math.random() * count) | 0;
    for (let i = 0; i < count; i++) {
      const key = `${prefix}.${(first + i) % count}`;
      if (buffers.has(key)) return key;
    }
    return '';
  }

  function playWeapon(kind, pan, dist) {
    const transient = `layer.${kind}`;
    /* Imported reports are already full game mixes. Missing one falls back to
       the complete procedural report instead of playing a partial layer. */
    if (!buffers.has(transient)) return false;
    const distance = dist || 0,
      distanceGain = SFX._weaponDistanceGain(distance),
      lowpass = distance > 4 ? lerp(12000, 1600, clamp((distance - 4) / 60, 0, 1)) : 0,
      heavy = kind === 'shotgun' || kind === 'sniper',
      delay = distance / 343;
    playBuffer(transient, {
      gain: distanceGain * (heavy ? 0.9 : kind === 'pistol' ? 0.72 : 0.82),
      pan,
      delay,
      lowpass,
      highpass: distance > 28 ? 85 : 32,
      rate: rand(0.995, 1.005),
      bus: 'weapon',
    });
    /* Only the local weapon should shape the music continuously. Nearby AI
       may make a short opening, but distant automatic fire must not pump the
       entire mix on every round. */
    const context: AudioContext | null = SFX._context();
    if (context && distance < 3 && context.currentTime - lastWeaponDuck > 0.075) {
      lastWeaponDuck = context.currentTime;
      duckMusic(0.32, heavy ? 0.22 : 0.1);
    }
    return true;
  }

  function playImpact(kind, gain, pan, dist?) {
    const list = AUDIO_ASSET_MANIFEST.impact[kind],
      key = list ? pickLoaded(`impact.${kind}`, list.length) : '';
    if (!key) return false;
    const far = dist == null ? 1 : clamp(1 - dist / 65, 0.12, 1);
    return !!playBuffer(key, { gain: gain * far, pan, rate: rand(0.94, 1.06), bus: 'impact' });
  }

  function playReloadStage(weapon, stage) {
    const key = `reload.${weapon}.${stage}`;
    return buffers.has(key)
      ? !!playBuffer(key, { gain: stage === 'lift' ? 0.46 : 0.68, rate: rand(0.985, 1.015), bus: 'impact' })
      : false;
  }

  function playShell(kind, pan) {
    const paths = AUDIO_ASSET_MANIFEST.shell[kind] || AUDIO_ASSET_MANIFEST.shell.brass,
      key = pickLoaded(`shell.${kind}`, paths.length);
    return key ? !!playBuffer(key, { gain: kind === 'heavy' ? 0.52 : 0.38, pan, rate: rand(0.94, 1.07), bus: 'impact' }) : false;
  }

  function playVoice(key: string) {
    const fullKey = `voice.${key}`;
    if (!buffers.has(fullKey)) {
      pendingVoice = { key, at: performance.now() };
      scheduleLoad();
      return false;
    }
    if (voiceSource) {
      try {
        voiceSource.stop();
      } catch (_) {}
    }
    duckMusic(0.2, 1.7);
    voiceSource = playBuffer(fullKey, { gain: 0.68, delay: 0.045, bus: 'voice' }) as AudioBufferSourceNode;
    if (voiceSource) voiceSource.onended = () => (voiceSource = null);
    return !!voiceSource;
  }

  function stopMusic() {
    if (!bgmSource) return;
    try {
      bgmSource.stop();
    } catch (_) {}
    bgmSource = null;
  }

  function stopMenuMusic() {
    if (!menuMusicSource) return;
    try {
      menuMusicSource.stop();
    } catch (_) {}
    menuMusicSource = null;
  }

  function startMenuMusic() {
    if (!menuMusicWanted || menuMusicSource || !buffers.has('music.menu')) return;
    const source = playBuffer('music.menu', { gain: 0.3, bus: 'music' }) as AudioBufferSourceNode;
    if (!source) return;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = source.buffer?.duration || 0;
    source.onended = () => {
      if (menuMusicSource === source) menuMusicSource = null;
    };
    menuMusicSource = source;
  }

  function startMusic() {
    if (!bgmWanted || bgmSource || !buffers.has('music.frontline')) return;
    const source = playBuffer('music.frontline', { gain: 0.34, bus: 'music' }) as AudioBufferSourceNode;
    if (!source) return;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = source.buffer?.duration || 0;
    source.onended = () => {
      if (bgmSource === source) bgmSource = null;
    };
    bgmSource = source;
  }

  const procedural = {
    init: SFX.init,
    gunshot: SFX.gunshot,
    footstep: SFX.footstep,
    impactWall: SFX.impactWall,
    impactFlesh: SFX.impactFlesh,
    magOut: SFX.magOut,
    magIn: SFX.magIn,
    boltClick: SFX.boltClick,
    shellDrop: SFX.shellDrop,
  };

  SFX.init = () => {
    procedural.init();
    scheduleLoad();
  };
  SFX.gunshot = (kind, pan, dist) => {
    if (!playWeapon(kind, pan, dist)) procedural.gunshot(kind, pan, dist);
  };
  SFX.footstep = (volume, pan) => {
    if (!playImpact('footstep', 0.42 * volume, pan)) procedural.footstep(volume, pan);
  };
  SFX.impactWall = (pan, dist) => {
    if (!playImpact('metal', 0.68, pan, dist)) procedural.impactWall(pan, dist);
  };
  SFX.impactFlesh = (pan, dist) => {
    if (!playImpact('flesh', 0.7, pan, dist)) procedural.impactFlesh(pan, dist);
  };
  SFX.reloadStage = (weapon, stage) => {
    if (playReloadStage(weapon, stage)) return;
    if (stage === 'out') procedural.magOut();
    else if (stage === 'in') procedural.magIn();
    else if (stage === 'action') procedural.boltClick();
    else SFX.weaponSwap(false);
  };
  SFX.shellDrop = (pan, heavy = false) => {
    if (!playShell(heavy ? 'heavy' : 'brass', pan)) procedural.shellDrop(pan);
  };
  SFX.voice = (key) => {
    /* The generated radio blip is both texture and permanent fallback. */
    SFX.radio();
    return playVoice(key);
  };
  SFX.music = (active) => {
    bgmWanted = !!active;
    scheduleLoad();
    if (bgmWanted) startMusic();
    else stopMusic();
  };
  SFX.menuMusic = (active) => {
    menuMusicWanted = !!active;
    scheduleLoad();
    if (menuMusicWanted) startMenuMusic();
    else stopMenuMusic();
  };
  SFX.assetStatus = () => ({
    loaded: buffers.size,
    failed: failures.size,
    essentialReady,
    mediaReady,
    musicPlaying: !!bgmSource,
    menuMusicPlaying: !!menuMusicSource,
    layeredWeapons: Object.keys(AUDIO_ASSET_MANIFEST.layer).filter((key) =>
      buffers.has(`layer.${key}`)
    ).length,
    reloadStages: [...buffers.keys()].filter((key) => key.startsWith('reload.')).length,
    shellVariants: [...buffers.keys()].filter((key) => key.startsWith('shell.')).length,
    busesReady: !!mix,
  });
})();
