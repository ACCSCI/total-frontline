import { weaponFamily } from '../../shared/gameplay';

const LAYERS: Record<string, string> = {
  rifle: 'weapons/layers/rifle-transient.ogg',
  ak: 'weapons/layers/ak-transient.ogg',
  shotgun: 'weapons/layers/shotgun-transient.ogg',
  pistol: 'weapons/layers/pistol-transient.ogg',
  sniper: 'weapons/layers/sniper-transient.ogg',
  lmg: 'weapons/layers/lmg-transient.ogg',
  vector: 'weapons/layers/vector-transient.ogg',
  p90: 'weapons/layers/p90-transient.ogg',
  rifleSuppressed: 'weapons/layers/rifle-suppressed.ogg',
  pistolSuppressed: 'weapons/layers/pistol-suppressed.ogg',
  p90Suppressed: 'weapons/layers/p90-suppressed.ogg',
  vectorSuppressed: 'weapons/layers/vector-suppressed.ogg',
  shotgunSuppressed: 'weapons/layers/shotgun-suppressed.ogg',
  sniperSuppressed: 'weapons/layers/sniper-suppressed.ogg',
  lmgSuppressed: 'weapons/layers/lmg-suppressed.ogg',
};

const IMPACT: Record<string, string[]> = {
  metal: ['impacts/metal-1.ogg', 'impacts/metal-2.ogg'],
  flesh: ['impacts/flesh-1.ogg', 'impacts/flesh-2.ogg'],
  footstep: ['impacts/footstep-1.ogg', 'impacts/footstep-2.ogg'],
};

const RELOAD_WEAPONS = ['rifle', 'ak', 'pistol', 'sniper', 'lmg', 'vector', 'p90', 'shotgun'];
const RELOAD_STAGES = ['lift', 'out', 'in', 'action'];

function audioUrl(rel: string) {
  return `/assets/audio/${rel}`;
}

function layerKind(id: string) {
  if (id === 'ak12' || id === 'ak') return 'ak';
  if (id === 'p90') return 'p90';
  if (id === 'vector') return 'vector';
  return weaponFamily(id);
}

export function createSampleBank() {
  const buffers = new Map<string, AudioBuffer>();
  let ctx: AudioContext | null = null;
  let dest: AudioNode | null = null;
  let started = false;
  let musicWanted = false;

  function connect(context: AudioContext, master: AudioNode) {
    ctx = context;
    dest = master;
    if (!started) {
      started = true;
      void loadAll();
    }
  }

  async function loadAll() {
    const jobs: Array<[string, string]> = [];
    for (const [key, rel] of Object.entries(LAYERS)) jobs.push([`layer.${key}`, rel]);
    for (const [kind, files] of Object.entries(IMPACT)) {
      for (let i = 0; i < files.length; i++) jobs.push([`impact.${kind}.${i}`, files[i]]);
    }
    for (const weapon of RELOAD_WEAPONS)
      for (const stage of RELOAD_STAGES)
        jobs.push([`reload.${weapon}.${stage}`, `weapons/reload/${weapon}-${stage}.ogg`]);
    for (let i = 1; i <= 6; i++) jobs.push([`shell.brass.${i - 1}`, `shells/brass-${i}.ogg`]);
    for (let i = 1; i <= 4; i++) jobs.push([`shell.heavy.${i - 1}`, `shells/heavy-${i}.ogg`]);
    jobs.push(['music.frontline', 'music/frontline-loop.mp3']);
    await Promise.allSettled(jobs.map(([key, rel]) => loadOne(key, rel)));
  }

  async function loadOne(key: string, rel: string) {
    if (!ctx) return;
    const response = await fetch(audioUrl(rel), { cache: 'force-cache' });
    if (!response.ok) return;
    const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
    buffers.set(key, decoded);
    if (key === 'music.frontline' && musicWanted) setMusic(true);
  }

  function play(key: string, gain: number, pan = 0, delay = 0, rate = 1) {
    if (!ctx || !dest) return false;
    const buffer = buffers.get(key);
    if (!buffer) return false;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(g);
    g.connect(p);
    p.connect(dest);
    const t0 = ctx.currentTime + delay;
    src.start(t0);
    src.stop(t0 + buffer.duration / Math.max(0.5, rate) + 0.05);
    return true;
  }

  function pick(prefix: string, count: number) {
    const ready: string[] = [];
    for (let i = 0; i < count; i++) {
      const key = `${prefix}.${i}`;
      if (buffers.has(key)) ready.push(key);
    }
    return ready.length ? ready[(Math.random() * ready.length) | 0] : '';
  }

  function gunshot(id: string, pan: number, dist: number, suppressed = false) {
    let kind = layerKind(id);
    if (suppressed && kind === 'ak') kind = 'rifle';
    const key = suppressed ? `layer.${kind}Suppressed` : `layer.${kind}`;
    if (!buffers.has(key)) return false;
    const vol = Math.max(0.018, 0.64 / (1 + (dist / 11) ** 1.65));
    const heavy = kind === 'shotgun' || kind === 'sniper';
    return play(
      key,
      vol * (heavy ? 0.9 : kind === 'pistol' ? 0.72 : 0.82),
      pan,
      dist / 343,
      0.995 + Math.random() * 0.01
    );
  }

  function impact(kind: 'metal' | 'flesh' | 'footstep', gain: number, pan: number, dist?: number) {
    const key = pick(`impact.${kind}`, IMPACT[kind].length);
    if (!key) return false;
    const far = dist == null ? 1 : Math.max(0.12, Math.min(1, 1 - dist / 65));
    return play(key, gain * far, pan, 0, 0.94 + Math.random() * 0.12);
  }

  function reload(weapon: string, stage: string) {
    const family = layerKind(weapon);
    const key = `reload.${family}.${stage}`;
    return play(key, stage === 'lift' ? 0.46 : 0.68, 0, 0, 0.985 + Math.random() * 0.03);
  }

  function shell(heavy: boolean, pan: number) {
    const key = pick(heavy ? 'shell.heavy' : 'shell.brass', heavy ? 4 : 6);
    return key ? play(key, heavy ? 0.52 : 0.38, pan, 0, 0.94 + Math.random() * 0.13) : false;
  }

  let music: AudioBufferSourceNode | null = null;
  function setMusic(on: boolean) {
    musicWanted = on;
    if (!ctx || !dest) return;
    if (!on) {
      try {
        music?.stop();
      } catch {
        /* already stopped */
      }
      music = null;
      return;
    }
    const buffer = buffers.get('music.frontline');
    if (!buffer || music) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.28;
    src.connect(g);
    g.connect(dest);
    src.start();
    music = src;
  }

  return { connect, gunshot, impact, reload, shell, setMusic, loaded: () => buffers.size };
}
