import type * as THREE from 'three';
import type { CampaignRules } from './campaign';
import type { P0Combat } from './combat';
import type { Crosshair } from './crosshair';
import type { PropDebugger } from './debug-mode';
import type { P0Level } from './level';
import { bindPauseMenu } from './pause-menu';
import type { FirstPersonPlayer } from './player';
import type { GameRenderer } from './renderer';
import type { ScreenRain } from './screen-rain';
import type { Sequencer } from './sequencer';
import { showHudToast } from './combat-hud';
import { SETTINGS } from './settings';
import { SFX } from './sfx';
import type { ViewmodelRig } from './viewmodel';

export interface CampaignInputHost {
  canvas: HTMLCanvasElement;
  pauseEl: HTMLDivElement;
  hint: HTMLDivElement;
  introOverlay: HTMLDivElement;
  cutsceneBars: HTMLDivElement;
  completePanel: HTMLDivElement;
  keys: Set<string>;
  muzzle: THREE.Vector3;
  showPause: () => void;
  hidePause: () => void;
  requestPlayLock: () => void;
  skipIntro: () => void;
  startControls: () => void;
  startTyping: () => Promise<void>;
  get paused(): boolean;
  set paused(v: boolean);
  get firing(): boolean;
  set firing(v: boolean);
  get pointerLocked(): boolean;
  set pointerLocked(v: boolean);
  get controlsEnabled(): boolean;
  get completed(): boolean;
  get introState(): 'waiting' | 'typing' | 'flying' | 'done';
  get cutscene(): Sequencer | null;
  set cutscene(v: Sequencer | null);
  get debug(): PropDebugger | null;
  get player(): FirstPersonPlayer;
  get campaign(): CampaignRules | null;
  get combat(): P0Combat | null;
  get viewmodel(): ViewmodelRig | null;
  get level(): P0Level;
  get renderer(): GameRenderer | undefined;
  get screenRain(): ScreenRain | null;
  get crosshair(): Crosshair | null;
}

export function bindCampaignInput(host: CampaignInputHost) {
  host.canvas.addEventListener('click', (event) => {
    SFX.init();
    if (host.debug?.active) {
      host.debug.trySelect(event.clientX, event.clientY);
      return;
    }
    if (host.cutscene || host.completed || host.introState !== 'done' || host.paused) return;
    host.canvas.requestPointerLock();
  });

  host.introOverlay.addEventListener('click', () => {
    SFX.init();
    if (host.introState === 'waiting') void host.startTyping();
  });

  document.addEventListener('pointerlockchange', () => {
    host.pointerLocked = document.pointerLockElement === host.canvas;
    host.crosshair?.setHidden(
      !host.pointerLocked || !host.controlsEnabled || !!host.debug?.active || host.paused
    );
    if (host.pointerLocked) {
      host.hidePause();
      host.hint.classList.remove('on');
    } else if (host.controlsEnabled && !host.cutscene && !host.completed && !host.debug?.active) {
      host.showPause();
    }
  });

  document.addEventListener('mousemove', (event) => {
    if (host.debug?.active) return;
    if (
      !host.cutscene &&
      !host.paused &&
      document.pointerLockElement === host.canvas &&
      !host.completed
    ) {
      host.player?.addLook(event.movementX, event.movementY);
    }
  });

  document.addEventListener('mousedown', (event) => {
    if (
      event.button === 2 &&
      host.controlsEnabled &&
      !host.debug?.active &&
      !host.cutscene &&
      !host.completed &&
      !host.paused
    ) {
      event.preventDefault();
      host.player?.setAds(!host.player.ads);
      return;
    }
    if (event.button !== 0) return;
    if (
      host.debug?.active ||
      host.cutscene ||
      host.completed ||
      !host.controlsEnabled ||
      host.paused
    )
      return;
    if (document.pointerLockElement !== host.canvas) return;
    host.firing = true;
    if (host.campaign) host.campaign.triggerReleased = true;
    const gunId = host.campaign?.activeWeapon?.def.id || '';
    const shotgun = gunId === 'ks12' || gunId === 'shotgun';
    if (host.player) {
      host.player.cancelSprintForFire(shotgun);
      host.player.input.sprint = false;
    }
    host.keys.delete('ShiftLeft');
    host.keys.delete('ShiftRight');
    if (
      host.combat?.shoot(
        host.player.camera,
        host.viewmodel?.placeWorldMuzzle(host.player.camera, host.muzzle)
      )
    ) {
      host.viewmodel?.punch();
      host.crosshair?.onFire();
    }
  });

  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
      host.firing = false;
      if (host.campaign) host.campaign.triggerReleased = true;
    }
  });

  addEventListener(
    'wheel',
    (event) => {
      if (host.debug?.active && host.debug.selected) {
        event.preventDefault();
        host.debug.nudge(event.deltaY > 0 ? -0.05 : 0.05);
        return;
      }
      if (
        host.introState !== 'done' ||
        !host.controlsEnabled ||
        host.cutscene ||
        host.completed ||
        host.paused ||
        host.debug?.active ||
        !host.campaign
      )
        return;
      const dir = event.deltaY > 0 ? 1 : -1;
      const n = host.campaign.slots.length;
      host.player?.setAds(false);
      host.campaign.switchSlot((host.campaign.activeSlot + dir + n) % n);
    },
    { passive: true }
  );

  addEventListener('contextmenu', (event) => {
    if (host.debug?.active) {
      event.preventDefault();
      host.debug.clearSelection();
      return;
    }
    if (host.controlsEnabled && !host.cutscene && !host.completed) event.preventDefault();
  });

  addEventListener('keydown', (event) => {
    SFX.init();
    host.keys.add(event.code);
    const live =
      host.introState === 'done' &&
      host.controlsEnabled &&
      !host.cutscene &&
      !host.paused &&
      !host.debug?.active;
    if (
      (event.code === 'ShiftLeft' || event.code === 'ShiftRight') &&
      host.keys.has('KeyW') &&
      SETTINGS.sprintCancelsReload &&
      live
    ) {
      host.campaign?.cancelReload();
    }
    if (event.code === 'Space' && !host.paused) {
      host.player.input.jump = true;
      host.player.spaceEdge = true;
    }
    if (event.code === 'KeyC' && live && !event.repeat) {
      host.player.input.crouch = !host.player.input.crouch;
      host.keys.delete('KeyC');
      event.preventDefault();
    }
    if (event.code === 'KeyZ' && live && !event.repeat) host.player.proneRequested = true;
    const debugJump = host.introState === 'done' && !host.cutscene && !host.completed && !host.debug?.active;
    if (event.code === 'F1' && debugJump && !event.repeat) {
      event.preventDefault();
      const cp = host.combat?.checkpoints.jump(host.player, host.level, -1);
      if (!cp) showHudToast(document.getElementById('p0Toast') as HTMLDivElement | null, '已经是第一个检查点', 1.2);
    }
    if (event.code === 'F2' && debugJump && !event.repeat) {
      event.preventDefault();
      const cp = host.combat?.checkpoints.jump(host.player, host.level, 1);
      if (!cp) showHudToast(document.getElementById('p0Toast') as HTMLDivElement | null, '已经是最后一个检查点', 1.2);
    }
    if (event.code === 'F3' && host.introState === 'done') {
      event.preventDefault();
      host.debug?.toggle();
    }
    if (event.code === 'PageUp' && host.debug?.active) {
      event.preventDefault();
      host.debug.nudge(0.05);
    }
    if (event.code === 'PageDown' && host.debug?.active) {
      event.preventDefault();
      host.debug.nudge(-0.05);
    }
    if (event.code === 'KeyL' && host.debug?.active) {
      event.preventDefault();
      host.debug.writeLog();
    }
    if (event.code === 'KeyG' && host.level && host.introState === 'done') {
      if (host.debug?.active) {
        const count = host.level.resnapProps();
        const fixed = host.debug.autoFix();
        const assetStatus = document.getElementById('assetStatus');
        if (assetStatus)
          assetStatus.textContent = `一键贴地完成 · 重采样 ${count} 组 · 自动修正 ${fixed} 处`;
      } else if (!event.repeat && live && host.combat) {
        host.combat.throwGrenade('lethal', host.player.camera);
      }
    }
    if (event.code === 'KeyQ' && live && !event.repeat)
      host.combat?.throwGrenade('tactical', host.player.camera);
    if (event.code === 'KeyF' && live && !event.repeat)
      host.combat?.tryInteractWeapon(host.player.position);
    if (event.code === 'KeyN' && live && !event.repeat) host.combat?.mission.toggleNv();
    if (
      event.code === 'KeyR' &&
      host.introState === 'done' &&
      !event.repeat &&
      host.controlsEnabled &&
      !host.paused
    )
      host.campaign?.startReload();
    if (event.code === 'KeyV' && live && !event.repeat) host.combat?.startMelee(host.player.camera);
    if (
      event.code === 'KeyB' &&
      host.introState === 'done' &&
      !event.repeat &&
      host.controlsEnabled &&
      !host.paused
    ) {
      const w = host.campaign?.activeWeapon;
      if (w?.def.semiToggle) {
        w.semi = !w.semi;
        SFX.boltClick();
        host.campaign?.updateHud();
      }
    }
    if (
      (event.code === 'Digit1' || event.code === 'Digit2') &&
      host.introState === 'done' &&
      !host.paused
    ) {
      host.player?.setAds(false);
      host.campaign?.switchSlot(event.code === 'Digit1' ? 0 : 1);
    }
    if (event.code === 'Escape') {
      host.firing = false;
      if (host.introState !== 'done') {
        host.skipIntro();
        return;
      }
      if (host.cutscene) {
        const done = host.cutscene.finished;
        host.cutscene.skip();
        if (!done) {
          host.cutscene = null;
          host.cutsceneBars.hidden = true;
          if (host.completed) host.completePanel.hidden = false;
          else {
            host.player.resetPose(host.level);
            host.startControls();
          }
        }
        return;
      }
      if (host.completed) return;
      if (host.paused) host.requestPlayLock();
      else if (document.pointerLockElement) document.exitPointerLock();
      else host.showPause();
    }
  });

  addEventListener('keyup', (event) => {
    host.keys.delete(event.code);
    if (event.code === 'Space') host.player.input.jump = false;
  });

  addEventListener('blur', () => {
    host.keys.clear();
    host.player.input.jump = false;
    host.firing = false;
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    host.keys.clear();
    host.player.input.jump = false;
    host.firing = false;
    if (host.controlsEnabled && host.introState === 'done' && !host.completed && !host.cutscene) {
      if (document.pointerLockElement) document.exitPointerLock();
      else host.showPause();
    }
  });

  addEventListener('resize', () => {
    if (!host.renderer) return;
    host.renderer.setSize(innerWidth, innerHeight);
    host.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    host.player?.resize();
    host.screenRain?.resize();
    host.viewmodel?.resize();
    host.crosshair?.layout();
  });

  document.getElementById('restartBtn')?.addEventListener('click', () => { location.href = '../'; });
  bindPauseMenu(host.pauseEl, () => {
    if (host.paused) host.requestPlayLock();
  });
}
