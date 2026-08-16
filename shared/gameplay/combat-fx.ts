/** Combat FX numbers from single-player tracers / shells / death guns. */

export const SPARK_LIFE = 0.07;
export const SHELL_LIFE = 0.9;
export const SHELL_GRAVITY = 17;
export const SHELL_FLOOR = 0.04;
export const TRACER_SPEED = 285;
export const TRACER_SPEED_SNIPER = 430;
export const TRACER_SEGMENT = 3.4;
export const TRACER_SEGMENT_SNIPER = 5.2;

export interface TracerFlight {
  length: number;
  segment: number;
  speed: number;
  lead: number;
  fresh: boolean;
}

export function createTracerFlight(length: number, sniper: boolean): TracerFlight {
  const segment = sniper ? TRACER_SEGMENT_SNIPER : TRACER_SEGMENT;
  return {
    length,
    segment,
    speed: sniper ? TRACER_SPEED_SNIPER : TRACER_SPEED,
    lead: Math.min(length, segment),
    fresh: true,
  };
}

export function stepTracerFlight(tr: TracerFlight, dt: number) {
  if (tr.fresh) {
    tr.fresh = false;
    return { tail: 0, head: tr.lead, done: false, opacity: 0.95, scale: 1 };
  }
  tr.lead += tr.speed * dt;
  const tail = Math.max(0, tr.lead - tr.segment);
  if (tail >= tr.length) return { tail, head: tr.length, done: true, opacity: 0, scale: 1 };
  const head = Math.min(tr.length, tr.lead);
  const visible = Math.max(0, head - tail);
  const k = Math.min(1, visible / Math.min(tr.segment, tr.length));
  return { tail, head, done: false, opacity: k * 0.95, scale: 0.45 + k * 0.55 };
}

export function shellImpulse(rightX: number, rightZ: number, rng = Math.random) {
  return {
    vx: rightX * 2.2 + (rng() - 0.5) * 0.5,
    vy: 1.5 + rng() * 0.6,
    vz: rightZ * 2.2 + (rng() - 0.5) * 0.5,
    avx: 12,
    avy: 8,
    avz: 10,
    life: SHELL_LIFE,
  };
}

export function stepShellBody(
  s: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number },
  dt: number,
  floorY = SHELL_FLOOR
) {
  s.life -= dt;
  s.vy -= SHELL_GRAVITY * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
  let bounced = false;
  if (s.y < floorY) {
    s.y = floorY;
    s.vy *= -0.25;
    s.vx *= 0.5;
    s.vz *= 0.5;
    bounced = true;
  }
  return { dead: s.life <= 0, bounced };
}
