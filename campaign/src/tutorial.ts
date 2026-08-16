import type { CampaignRules, Enemy } from './campaign';
import { showHudToast } from './combat-hud';
import type { FirstPersonPlayer } from './player';

const taught = new Set<string>();

function teach(el: HTMLDivElement | null, id: string, text: string) {
  if (taught.has(id)) return;
  taught.add(id);
  showHudToast(el, text, 2.6);
}

/** One-shot teaching beats, ordered exactly like the mission spec. */
export function stepCampaignTutorial(
  toastEl: HTMLDivElement | null,
  player: FirstPersonPlayer,
  rules: CampaignRules,
  enemies: Enemy[],
  playerZ: number
) {
  if (playerZ < 985 && player.horizontalSpeed > 0.4) {
    teach(toastEl, 'move', 'WASD 移动 · SHIFT 疾跑 · 向北方公路桥推进');
  }
  if (player.crouch || player.prone) {
    teach(toastEl, 'stance', 'C 切换蹲伏 / Z 卧倒 · 降低被巡逻队发现的距离');
  }
  const active = rules.activeWeapon;
  if (active && active.mag <= active.def.magSize * 0.3 && !rules.reloading) {
    teach(toastEl, 'reload', '弹匣见底 · R 换弹');
  }
  if (enemies.some((e) => e.alive && e.engaged)) {
    teach(toastEl, 'throw', 'Q 闪光弹 / G 破片手雷 · V 战术刀可背刺秒杀');
  }
}
