import {
  AMMO_PICKUP_AMOUNT,
  AMMO_PICKUP_COOLDOWN_MS,
  type MissionState,
  applyCheckpointRestore,
  nextAmmoCooldown,
  shouldAutoPickupAmmo,
} from '../../shared/gameplay';
import type { CampaignRules, Enemy, Pickup } from './campaign';
import type { CheckpointTrack } from './checkpoints';
import type { P0Level } from './level';
import type { FirstPersonPlayer } from './player';
import { SFX } from './sfx';

export function stepAmmoPickups(
  pickups: Pickup[],
  playerPos: { x: number; z: number },
  groundY: (x: number, z: number) => number,
  dt: number,
  rules: CampaignRules,
  toastEl: HTMLDivElement | null
) {
  const now = performance.now();
  for (const p of pickups) {
    if (!p.root.visible) continue;
    p.bobT += dt * 2.2;
    p.root.position.y =
      groundY(p.root.position.x, p.root.position.z) + 0.04 + Math.sin(p.bobT) * 0.07;
    p.root.rotation.y += dt * 0.8;
    const d = Math.hypot(p.root.position.x - playerPos.x, p.root.position.z - playerPos.z);
    if (p.kind === 'ammo' && shouldAutoPickupAmmo(d, p.coolUntil, now)) {
      rules.addAmmo(AMMO_PICKUP_AMOUNT);
      p.coolUntil = nextAmmoCooldown(now);
      p.root.visible = false;
      setTimeout(() => {
        p.root.visible = true;
      }, AMMO_PICKUP_COOLDOWN_MS);
      SFX.pickup();
      showHudToast(toastEl, `已拾取弹药 +${AMMO_PICKUP_AMOUNT}`, 2);
    }
  }
}

export function showHudToast(el: HTMLDivElement | null, text: string, duration: number) {
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  setTimeout(() => {
    if (el.textContent === text) el.hidden = true;
  }, duration * 1000);
}

export function showHudPrompt(el: HTMLDivElement | null, text: string, duration: number) {
  if (!el) return;
  if (!text) {
    el.textContent = '';
    el.hidden = true;
    return;
  }
  el.textContent = text;
  el.hidden = false;
  if (duration > 0) {
    setTimeout(() => {
      if (el.textContent === text) el.hidden = true;
    }, duration * 1000);
  }
}

export function updateHealthHud(health: number) {
  const num = document.getElementById('p0Health') as HTMLDivElement;
  const fill = document.getElementById('p0HealthFill') as HTMLDivElement;
  if (num) num.textContent = String(Math.round(health));
  if (fill) fill.style.transform = `scaleX(${health / 100})`;
}

export function respawnAtCheckpoint(
  message: string,
  ctx: {
    failEl: HTMLDivElement | null;
    toastEl: HTMLDivElement | null;
    rules: CampaignRules;
    checkpoints: CheckpointTrack;
    player: FirstPersonPlayer;
    level: P0Level;
    enemies: Enemy[];
    mission?: MissionState;
  }
) {
  if (ctx.failEl) ctx.failEl.hidden = true;
  ctx.rules.playerHealth = 100;
  ctx.rules.lastHurt = performance.now();
  updateHealthHud(100);
  ctx.checkpoints.restore(ctx.player, ctx.level);
  if (ctx.mission) applyCheckpointRestore(ctx.mission, ctx.checkpoints.currentId, ctx.enemies);
  showHudToast(ctx.toastEl, message, 1.8);
}
