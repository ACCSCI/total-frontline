import * as THREE from 'three';
import missionsData from '../../shared/missions.json';
import type { Enemy } from './campaign';
import type { SoldierRig } from './soldier';

export type EnemyIdleRole = 'eat' | 'camp' | 'lean' | 'patrol';

interface CampDef {
  x: number;
  z: number;
  roles: string[];
}

export function assignEnemyIdles(enemies: Enemy[]) {
  const camps = (missionsData.mission01 as { camps?: CampDef[] }).camps || [];
  for (const camp of camps) {
    const nearby = enemies
      .map((e, index) => ({
        index,
        d: Math.hypot(e.root.position.x - camp.x, e.root.position.z - camp.z),
      }))
      .filter((n) => n.d < 18)
      .sort((a, b) => a.d - b.d);
    nearby.forEach((n, k) => {
      enemies[n.index].idleRole =
        (camp.roles[k % camp.roles.length] as EnemyIdleRole) || 'camp';
    });
  }
  for (const e of enemies) {
    if (!e.idleRole) {
      const nearPost = Math.hypot(e.root.position.x - 7.2, e.root.position.z + 860) < 14;
      const nearTruck = Math.hypot(e.root.position.x, e.root.position.z + 985) < 14;
      if (nearPost || nearTruck) e.idleRole = 'lean';
    }
  }
}

export function poseIdleEnemy(p: SoldierRig, role: EnemyIdleRole, time: number) {
  const breathe = Math.sin(time * 1.6) * 0.02;
  if (role === 'eat') {
    p.model.position.y = -0.34;
    p.body.rotation.x = 0.22 + breathe;
    p.legs[0].hip.rotation.x = -1.1;
    p.legs[0].knee.rotation.x = 1.35;
    p.legs[1].hip.rotation.x = -0.8;
    p.legs[1].knee.rotation.x = 0.9;
    p.arms[0].sh.rotation.x = 0.55 + Math.sin(time * 2.1) * 0.08;
    p.arms[0].sh.rotation.z = 0.4;
    p.arms[1].sh.rotation.x = 0.85;
    p.arms[1].sh.rotation.z = -0.35;
    p.arms[0].el.rotation.x = -1.1;
    p.arms[1].el.rotation.x = -1.5;
    p.head.rotation.x = 0.45;
    p.gun.position.set(0.2, -0.32, -0.3);
    p.gun.rotation.set(0.7, 0, 0.2);
    p.rig.rotation.x = 0;
  } else if (role === 'camp') {
    p.model.position.y = 0;
    p.body.rotation.x = breathe;
    p.body.rotation.z = 0.05;
    p.legs[0].hip.rotation.x = 0;
    p.legs[1].hip.rotation.x = 0.18;
    p.legs[0].knee.rotation.x = 0;
    p.legs[1].knee.rotation.x = 0.14;
    p.arms[0].sh.rotation.x = 0.95;
    p.arms[0].sh.rotation.z = 0.55;
    p.arms[1].sh.rotation.x = 1.15;
    p.arms[1].sh.rotation.z = -0.35;
    p.arms[0].el.rotation.x = -0.2;
    p.arms[1].el.rotation.x = -1.2;
    p.head.rotation.y = 0.25 + Math.sin(time * 0.6) * 0.12;
    p.gun.position.set(0.14, -0.3, -0.2);
    p.gun.rotation.set(-0.45, -0.1, 0.18);
    p.rig.rotation.x = 0;
  } else if (role === 'lean') {
    p.model.position.y = 0;
    p.model.rotation.z = -0.1;
    p.body.rotation.z = 0.16 + breathe;
    p.legs[0].hip.rotation.x = -0.12;
    p.legs[1].hip.rotation.x = 0.28;
    p.legs[1].knee.rotation.x = 0.3;
    p.arms[0].sh.rotation.x = 0.7;
    p.arms[0].sh.rotation.z = 0.8;
    p.arms[1].sh.rotation.x = 1.4;
    p.arms[1].sh.rotation.z = -0.6;
    p.arms[0].el.rotation.x = -1.1;
    p.arms[1].el.rotation.x = -1.6;
    p.head.rotation.y = -0.3;
    p.gun.position.set(0.16, -0.26, -0.2);
    p.gun.rotation.set(-0.6, 0, 0.16);
    p.rig.rotation.x = 0;
  }
}
