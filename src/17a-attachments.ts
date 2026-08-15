'use strict';
const ATTACHMENT_CATALOG = {
  optic: {
    micro_dot: { name: '微型红点', mods: { adsTime: 0.96 } },
    holo: { name: '方窗全息瞄具', mods: { adsTime: 0.99 } },
    /* 75° base to 34° is a geometric 2.5x angular magnification. */
    prism_2_5: { name: '2.5× 棱镜镜', mods: { adsTime: 1.14, adsFov: 0.895 } },
  },
  muzzle: {
    compensator: {
      name: '战术制退器',
      mods: { recoilKick: 0.9, recoilRot: 0.9, camPitch: 0.88, camYaw: 0.82, noise: 1.08 },
    },
    suppressor: {
      name: '快拆消音器',
      mods: { noise: 0.62, range: 0.92, recoilKick: 0.96, camPitch: 0.96 },
    },
  },
  underbarrel: {
    angled_grip: { name: '斜角握把', mods: { adsTime: 0.91, moveSpread: 0.9 } },
    vertical_grip: {
      name: '垂直握把',
      mods: { recoilKick: 0.86, recoilRot: 0.78, camPitch: 0.78, camYaw: 0.7, spreadShot: 0.88 },
    },
  },
  magazine: {
    standard: { name: '标准弹匣', mods: {} },
    extended: {
      name: '扩容弹匣',
      mods: { magSize: 1.33, reloadTime: 1.12, tacticalReloadTime: 1.12 },
    },
  },
};

function attachmentWeapons() {
  return WEAPONS.filter((w) => w.id === 'rifle' || w.id === 'ak');
}

function captureWeaponBaseStats(w) {
  if (w.baseStats) return;
  w.baseStats = {};
  for (const slot of Object.values(ATTACHMENT_CATALOG))
    for (const item of Object.values(slot))
      for (const stat of Object.keys(item.mods)) w.baseStats[stat] = w[stat];
}

function setAttachmentNode(vm, slot, selected) {
  const nodes = vm.attachmentNodes?.[slot];
  if (!nodes) return;
  for (const [id, node] of Object.entries(nodes) as [string, any][]) node.visible = id === selected;
}

function applyWeaponAttachments(w, refresh = true) {
  captureWeaponBaseStats(w);
  for (const [stat, value] of Object.entries(w.baseStats)) w[stat] = value;
  for (const [slot, id] of Object.entries(w.attachments)) {
    const spec = ATTACHMENT_CATALOG[slot]?.[id];
    if (!spec) continue;
    for (const [stat, multiplier] of Object.entries(spec.mods) as [string, number][])
      w[stat] *= multiplier;
    setAttachmentNode(w.vm, slot, id);
  }
  w.magSize = Math.round(w.magSize);
  w.mag = Math.min(w.mag, w.magSize);
  if (w.vm?.muzzle) {
    const suppressed = w.attachments.muzzle === 'suppressor';
    w.vm.muzzle.position.z =
      w.id === 'ak' ? (suppressed ? -1.1 : -1.02) : suppressed ? -0.92 : -0.73;
  }
  if (refresh) {
    updateAttachmentPanel();
    updateAmmoUI();
  }
}

function setWeaponAttachment(weaponId, slot, id) {
  const w = WEAPONS.find((item) => item.id === weaponId);
  if (!w || !ATTACHMENT_CATALOG[slot]?.[id]) return false;
  w.attachments[slot] = id;
  applyWeaponAttachments(w);
  localStorage.setItem(`tf.attachments.${weaponId}`, JSON.stringify(w.attachments));
  return true;
}

function initWeaponAttachments() {
  for (const w of attachmentWeapons()) {
    const defaults = {
      optic: 'micro_dot',
      muzzle: 'compensator',
      underbarrel: 'angled_grip',
      magazine: 'standard',
    };
    try {
      const saved = JSON.parse(localStorage.getItem(`tf.attachments.${w.id}`) || '{}');
      w.attachments = { ...defaults };
      for (const slot of Object.keys(defaults))
        if (ATTACHMENT_CATALOG[slot]?.[saved[slot]]) w.attachments[slot] = saved[slot];
    } catch {
      w.attachments = defaults;
    }
    applyWeaponAttachments(w, false);
  }
}

function updateAttachmentPanel() {
  const panel = document.getElementById('attachmentPanel');
  if (!panel) return;
  const weaponId =
    (document.getElementById('attachmentWeapon') as HTMLSelectElement)?.value || 'ak';
  const w = WEAPONS.find((item) => item.id === weaponId);
  for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-attachment]')) {
    const [slot, id] = button.dataset.attachment.split(':');
    button.classList.toggle('on', w?.attachments?.[slot] === id);
  }
  const status = document.getElementById('attachmentStatus');
  if (status && w) {
    const optic = ATTACHMENT_CATALOG.optic[w.attachments.optic];
    status.textContent = `${w.name} // 已装备：${optic?.name || '机械瞄具'}`;
  }
}

function bindAttachmentPanel() {
  const weapon = document.getElementById('attachmentWeapon') as HTMLSelectElement;
  weapon?.addEventListener('change', updateAttachmentPanel);
  document.getElementById('attachmentPanel')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-attachment]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const [slot, id] = button.dataset.attachment.split(':');
    if (setWeaponAttachment(weapon.value, slot, id)) {
      button.animate(
        [
          { transform: 'translateX(-2px)', filter: 'brightness(1.8)' },
          { transform: 'translateX(0)', filter: 'brightness(1)' },
        ],
        { duration: 180, easing: 'ease-out' }
      );
    }
  });
  updateAttachmentPanel();
}

/* This file is evaluated after every viewmodel has been constructed, so both
   saved stat modifiers and their visible rail furniture can be applied once. */
initWeaponAttachments();
