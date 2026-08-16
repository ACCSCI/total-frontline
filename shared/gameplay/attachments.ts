export const ATTACHMENT_CATALOG = {
  optic: {
    micro_dot: { name: '微型红点', mods: { adsTime: 0.96 } },
    holo: { name: '方窗全息瞄具', mods: { adsTime: 0.99 } },
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
} as const;

export function campaignStartAttachments(weaponId: string): Record<string, string> {
  if (weaponId === 'm4' || weaponId === 'rifle') {
    return {
      optic: 'micro_dot',
      muzzle: 'suppressor',
      underbarrel: 'vertical_grip',
      magazine: 'extended',
    };
  }
  if (weaponId === 'p9' || weaponId === 'pistol') return { muzzle: 'suppressor' };
  if (weaponId === 'ak' || weaponId === 'ak12') {
    return {
      optic: 'micro_dot',
      muzzle: 'compensator',
      underbarrel: 'angled_grip',
      magazine: 'standard',
    };
  }
  return {};
}

export function applyAttachmentMods<T extends Record<string, unknown>>(
  base: T,
  attachments: Record<string, string>
): T {
  const out = { ...base };
  for (const [slot, id] of Object.entries(attachments)) {
    const spec = (
      ATTACHMENT_CATALOG as Record<string, Record<string, { mods: Record<string, number> }>>
    )[slot]?.[id];
    if (!spec) continue;
    for (const [stat, mul] of Object.entries(spec.mods)) {
      const cur = out[stat];
      if (typeof cur === 'number') (out as Record<string, unknown>)[stat] = cur * mul;
    }
  }
  if (typeof out.magSize === 'number')
    (out as Record<string, unknown>).magSize = Math.round(out.magSize as number);
  return out;
}

export function isSuppressed(attachments?: Record<string, string> | null) {
  return attachments?.muzzle === 'suppressor';
}
