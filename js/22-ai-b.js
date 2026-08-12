'use strict';
function updateEnemy(e, dt) {
  const obj = e.obj,
    p = e.p;

  /* ---------- death ---------- */
  if (e.dead) {
    if (e.deathT < 1) {
      e.deathT = Math.min(1, e.deathT + dt / 0.85);
      const k = easeOutCubic(e.deathT);
      p.model.rotation.x = k * (PI * 0.5) * 0.98;
      p.model.position.y = -k * 0.1;
      p.model.rotation.z = Math.sin(e.deathT * 4) * 0.08 * (1 - k);
      p.legs.forEach((l, i) => {
        l.hip.rotation.x = lerp(l.hip.rotation.x, i ? 0.3 : -0.25, dt * 6);
        l.knee.rotation.x = lerp(l.knee.rotation.x, 0.55, dt * 6);
      });
      p.arms.forEach((a, i) => {
        a.sh.rotation.x = lerp(a.sh.rotation.x, i ? 0.6 : 0.35, dt * 6);
        a.sh.rotation.z = lerp(a.sh.rotation.z, (i ? 1 : -1) * 0.5, dt * 6);
        a.el.rotation.x = lerp(a.el.rotation.x, 0.2, dt * 6);
      });
      p.rig.rotation.x = lerp(p.rig.rotation.x, 0, dt * 6);
      if (!e.gunDropped && e.deathT > 0.14) {
        e.gunDropped = true;
        scene.attach(p.gun);
        e.gunVel = new THREE.Vector3(rand(-1.6, 1.6), rand(0.6, 1.8), rand(-1.6, 1.6));
        e.gunAV = new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6));
      }
    }
    if (e.gunDropped && e.gunVel) {
      e.gunVel.y -= 17 * dt;
      p.gun.position.addScaledVector(e.gunVel, dt);
      p.gun.rotation.x += e.gunAV.x * dt;
      p.gun.rotation.y += e.gunAV.y * dt;
      p.gun.rotation.z += e.gunAV.z * dt;
      const gy = 0.07;
      if (p.gun.position.y <= gy) {
        p.gun.position.y = gy;
        if (Math.abs(e.gunVel.y) < 0.7) {
          e.gunVel = null;
          p.gun.rotation.set(rand(-0.1, 0.1), rand(0, 7), PI / 2 + rand(-0.3, 0.3));
        } else {
          e.gunVel.y *= -0.32;
          e.gunVel.x *= 0.55;
          e.gunVel.z *= 0.55;
          e.gunAV.multiplyScalar(0.5);
          SFX.shellDrop(clamp((p.gun.position.x - camera.position.x) / 14, -1, 1));
        }
      }
    }
    return;
  }

  /* ---------- perception ---------- */
  e.losTimer -= dt;
  if (e.losTimer <= 0) {
    e.losTimer = 0.13 + Math.random() * 0.06;
    const see = !player.dead && hasLOS(e);
    /* no eyes on the player — a squadmate in the open is just as valid a
       target, and the nearest one wins */
    let tgt = null;
    if (!see) {
      let bd = 45;
      for (const a of allies) {
        if (a.dead) continue;
        const d = Math.hypot(a.obj.position.x - obj.position.x, a.obj.position.z - obj.position.z);
        if (d < bd && hasLOS(e, allyChest(a, _allyT))) {
          bd = d;
          tgt = a;
        }
      }
    }
    e.tgt = tgt;
    const anySee = see || !!tgt;
    if (anySee && !e.canSee && e.state === ST.PATROL) {
      e.state = ST.ALERT;
      e.reactT = rand(0.3, 0.8); // human reaction delay
      e.alerted = true;
      e.tag.draw(e.hp, true);
    }
    e.canSee = anySee;
    if (anySee) e.lastSeen = 0;
  }
  e.lastSeen += dt;
  if (e.hunt > 0) e.hunt -= dt;
  if (e.alerted && e.lastSeen > 7 && e.hunt <= 0 && e.state !== ST.PATROL) {
    e.state = ST.PATROL;
    e.alerted = false;
    e.tag.draw(e.hp, false);
  }

  /* ---------- flinch ---------- */
  if (e.flinch > 0) e.flinch = Math.max(0, e.flinch - dt * 3.2);

  targetChest(e, _ePos);
  const toP = _ePos.clone().sub(obj.position);
  const distToP = toP.length();
  let desiredX = 0,
    desiredZ = 0,
    moveSpeed = 0;

  /* ---------- state machine ---------- */
  if (e.state === ST.ALERT) {
    e.reactT -= dt;
    e.targetYaw = Math.atan2(toP.x, toP.z) + PI;
    if (e.reactT <= 0) {
      e.state = ST.COMBAT;
      e.tacticT = 0;
      e.engage = 0;
      comms(
        e,
        pick([
          '发现敌人，' + bearingWord(e) + '方向',
          '目标出现 — ' + bearingWord(e),
          '目视确认，' + bearingWord(e),
          '有敌意目标，' + bearingWord(e),
        ]),
        true
      );
    }
  } else if (e.state === ST.COMBAT) {
    e.targetYaw = Math.atan2(toP.x, toP.z) + PI;
    e.aimPitch = lerp(
      e.aimPitch,
      clamp(Math.atan2(toP.y - 1.5, Math.hypot(toP.x, toP.z)), -0.7, 0.7),
      dt * 8
    );
    e.lastKnown.set(_ePos.x, 0, _ePos.z);

    /* magazine discipline — a reload is the window the player gets to push */
    if (e.reloadT > 0) {
      e.reloadT -= dt;
      e.burst = 0;
      if (e.reloadT <= 0) e.rounds = 30;
    }

    /* re-roll intent periodically so an engagement has phases */
    e.tacticT -= dt;
    if (e.tacticT <= 0) {
      e.tacticT = rand(2.6, 5.2);
      const roll = Math.random();
      const wasFlank = e.tactic === 'flank';
      e.tactic = roll < 0.42 ? 'hold' : roll < 0.72 ? 'flank' : 'push';
      e.cover = null;
      if (e.tactic === 'flank' && !wasFlank && Math.random() < 0.55)
        comms(
          e,
          pick([
            '从' + (e.strafeDir > 0 ? '右' : '左') + '侧包抄',
            '拉开距离迂回',
            '我绕过去，压制他',
          ])
        );
      if (e.tactic === 'push' && Math.random() < 0.35)
        comms(e, pick(['正在推进', '逼近目标', '贴上去了']));
    }

    if (e.canSee) {
      e.engage += dt;
      e.strafeT -= dt;
      if (e.strafeT <= 0) {
        e.strafeT = rand(0.7, 1.9);
        if (Math.random() < 0.55) e.strafeDir *= -1;
      }
      const fwd = new THREE.Vector3(toP.x, 0, toP.z).normalize();
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(e.strafeDir);

      if (e.tactic === 'hold' || e.reloadT > 0) {
        if (!e.cover) e.cover = pickCover(e, _ePos.x, _ePos.z);
        if (e.cover) {
          const cdx = e.cover.x - obj.position.x,
            cdz = e.cover.z - obj.position.z;
          const cd = Math.hypot(cdx, cdz);
          if (cd > 1.1) {
            desiredX = cdx / cd;
            desiredZ = cdz / cd;
            moveSpeed = e.upper ? 2.0 : 3.4;
          } else {
            /* settled: lean out along the cover face to shoot */
            desiredX = side.x * 0.55;
            desiredZ = side.z * 0.55;
            moveSpeed = 1.1;
          }
        } else {
          desiredX = side.x * 0.85;
          desiredZ = side.z * 0.85;
          moveSpeed = e.upper ? 1.6 : 2.5;
        }
      } else if (e.tactic === 'flank') {
        /* orbit the player at a working distance instead of trading head-on */
        const ideal = 12;
        const closeness = clamp((distToP - ideal) / 9, -1, 1);
        desiredX = side.x * 1.0 + fwd.x * closeness * 0.5;
        desiredZ = side.z * 1.0 + fwd.z * closeness * 0.5;
        moveSpeed = e.upper ? 1.9 : 3.5;
      } else {
        const ideal = 8.5;
        const closeness = clamp((distToP - ideal) / 7, -1, 1);
        desiredX = side.x * 0.55 + fwd.x * closeness * 1.1;
        desiredZ = side.z * 0.55 + fwd.z * closeness * 1.1;
        moveSpeed = e.upper ? 1.8 : 3.3;
      }

      /* fire in bursts — only while the director has cleared this enemy */
      e.fireT -= dt;
      if (e.fireT <= 0 && e.reloadT <= 0) {
        if (e.burst > 0) {
          e.burst--;
          e.rounds--;
          enemyShoot(e);
          e.fireT = rand(0.11, 0.15);
          if (e.burst === 0) e.fireT = rand(0.85, 1.9);
          if (e.rounds <= 0) {
            e.burst = 0;
            e.reloadT = rand(2.0, 2.9);
            e.cover = null;
            if (Math.random() < 0.6) comms(e, pick(['装填中 — 掩护我', '弹匣打空', '更换弹匣']));
          }
        } else if (e.mayFire) {
          if (muzzleClear(e)) {
            e.burst = randI(2, 4);
            e.fireT = 0.03;
          } else {
            /* sees you, can't shoot you: give up the spot instead of hosing
               the crate he is standing behind */
            e.fireT = 0.3;
            e.cover = null;
            e.tacticT = 0;
          }
        } else {
          e.fireT = 0.25;
        }
      }
    } else {
      /* lost sight — push to the last known position, spraying it on the way */
      e.engage = Math.max(0, e.engage - dt * 0.6);
      const lk = e.lastKnown;
      const dx = lk.x - obj.position.x,
        dz = lk.z - obj.position.z;
      const d = Math.hypot(dx, dz) || 1;
      desiredX = dx / d;
      desiredZ = dz / d;
      moveSpeed = e.upper ? 1.8 : 3.2;
      /* suppressive fire into the last known spot */
      e.fireT -= dt;
      if (e.suppress > 0 && e.reloadT <= 0 && e.fireT <= 0 && e.mayFire && d > 3) {
        e.suppress--;
        e.rounds--;
        enemyShoot(e, lk);
        e.fireT = e.suppress > 0 ? rand(0.12, 0.18) : rand(1.4, 2.6);
        if (e.rounds <= 0) {
          e.reloadT = rand(2.0, 2.9);
          e.suppress = 0;
        }
      } else if (e.fireT <= 0 && e.lastSeen < 2.2 && Math.random() < 0.02) {
        e.suppress = randI(2, 4);
      }
      e.burst = 0;
      if (e.lastSeen > 2.4 && !e.saidLost) {
        e.saidLost = true;
        if (Math.random() < 0.5) comms(e, pick(['丢失目标', '人在哪', '目标脱离接触']));
      }
      if (e.lastSeen > 4.5 && e.hunt <= 0) e.state = ST.PATROL;
    }
    if (e.canSee) e.saidLost = false;
  } else {
    /* PATROL */
    e.aimPitch = lerp(e.aimPitch, 0, dt * 4);
    const wp = e.route[e.wp];
    _wpDir.set(wp[0] - obj.position.x, 0, wp[1] - obj.position.z);
    const d = _wpDir.length();
    if (d < 1.4) {
      e.wp = (e.wp + 1) % e.route.length;
      e.idleT = Math.random() < 0.35 ? rand(0.6, 1.8) : 0;
    }
    if (e.idleT > 0) {
      e.idleT -= dt;
      e.targetYaw += Math.sin(perfNow * 0.0006 + e.idx) * dt * 0.6;
      moveSpeed = 0;
    } else {
      _wpDir.divideScalar(Math.max(d, 0.001));
      desiredX = _wpDir.x;
      desiredZ = _wpDir.z;
      moveSpeed = e.upper ? 1.2 : 1.75;
      e.targetYaw = Math.atan2(desiredX, desiredZ) + PI;
    }
  }

  /* ---------- obstacle whiskers ----------
     Side choice is committed and only released once the direct line has been
     clear for a while — without that hysteresis the enemy ping-pongs between
     "walk at the crate" and "step around it" and never leaves the spot. */
  if (moveSpeed > 0) {
    /* The probe has to use the same vertical band as the mover. It used to test
       from 0.4 up while moveSlide collides from 0.3, so anything topping out in
       between — a two-pallet stack is exactly 0.33 — was invisible to pathing
       and solid to movement: the whiskers reported open ground and the soldier
       leaned into it at a full run, on the spot, until the stuck timer fired. */
    const px = obj.position.x,
      pz = obj.position.z,
      y0 = obj.position.y + 0.3,
      y1 = obj.position.y + 1.65;
    /* A heading only counts if the body can start down it *now*. Probing at
       1.9m alone happily returns a direction that is open out there but whose
       first step is into the corner you are already standing in — moveSlide
       then blocks both axes and the soldier walks on the spot at full speed
       until the stuck timer fires seconds later. Near probe first. */
    const clearAt = (nx, nz, len) =>
      !blocked(px + nx * 0.55, pz + nz * 0.55, y0, y1, 0.46) &&
      !blocked(px + nx * len, pz + nz * len, y0, y1, 0.5);
    e.repathT -= dt;
    if (e.repathT <= 0) {
      e.repathT = 0.15;
      const probe = 1.9;
      if (clearAt(desiredX, desiredZ, probe)) {
        e.clearT += 0.15;
        if (e.clearT > 0.45) {
          e.avoidT = 0;
          e.avoidSide = 0;
        } else e.avoidT = 0.25; /* keep sliding until the corner is truly rounded */
      } else {
        e.clearT = 0;
        const ang = Math.atan2(desiredX, desiredZ);
        if (!e.avoidSide) e.avoidSide = Math.random() < 0.5 ? 1 : -1;
        let best = null;
        for (let pass = 0; pass < 2 && !best; pass++) {
          const s = pass ? -e.avoidSide : e.avoidSide;
          for (const mag of [0.55, 0.95, 1.4, 1.9, 2.45]) {
            const a2 = ang + s * mag,
              nx = Math.sin(a2),
              nz = Math.cos(a2);
            if (clearAt(nx, nz, probe)) {
              best = [nx, nz];
              e.avoidSide = s;
              break;
            }
          }
        }
        if (best) {
          e.avoidX = best[0];
          e.avoidZ = best[1];
          e.avoidT = 0.25;
        } else {
          e.avoidX = -desiredX;
          e.avoidZ = -desiredZ;
          e.avoidT = 0.3;
          e.avoidSide = -e.avoidSide;
        }
      }
    }
    if (e.avoidT > 0) {
      e.avoidT -= dt;
      desiredX = e.avoidX;
      desiredZ = e.avoidZ;
      /* Steering, not facing. The whisker is allowed to pick a heading up to
         2.45 rad off the one it wanted, and slamming the body onto it turned a
         man rounding a crate in the middle of a firefight to point his rifle at
         the crate — the "enemies shooting backwards" bug, measured at 135 deg
         off target. In contact he stays square to whoever he is shooting at and
         walks the detour sideways; out of contact, facing the way you are going
         is the natural thing and the whisker keeps it. */
      if (!(e.state === ST.COMBAT && e.lastSeen < 1.2))
        e.targetYaw = Math.atan2(desiredX, desiredZ) + PI;
    }
  } else {
    e.avoidT = 0;
    e.avoidSide = 0;
    e.clearT = 0;
  }

  /* ---------- move ---------- */
  const flinchSlow = 1 - e.flinch * 0.6;
  const sp = moveSpeed * flinchSlow;
  if (sp > 0.01) {
    moveSlide(obj.position, desiredX * sp * dt, desiredZ * sp * dt, 0.42, 1.7);
    obj.position.x = clamp(obj.position.x, -HALF + 1, HALF - 1);
    obj.position.z = clamp(obj.position.z, -HALF + 1, HALF - 1);
  }
  e.speed = damp(e.speed, sp, 10, dt);

  /* Nothing may ever be standing inside a container. moveSlide ejects a body
     that is walking, but one that stops dead inside — shoved there by a corner,
     dropped in by the ground snap, wedged between two boxes — would sit in the
     steel and trade shots through it. Checked every frame; when the shove can't
     find a way out, fall back to relocating to open ground nearby. */
  {
    const y0 = obj.position.y + 0.3,
      y1 = obj.position.y + 1.65;
    if (blocked(obj.position.x, obj.position.z, y0, y1, 0.42)) {
      depenetrate(obj.position, 0.42, y0, y1);
      if (blocked(obj.position.x, obj.position.z, y0, y1, 0.42)) {
        const f = nearestFree(obj.position.x, obj.position.z, 0.5, 1.7, 8, obj.position.y);
        obj.position.x = f[0];
        obj.position.z = f[1];
        e.avoidT = 0;
        e.avoidSide = 0;
        e.clearT = 0;
        e.cover = null;
      }
    }
  }

  /* Last-resort unstick: walking but going nowhere -> abandon the goal. Sampled
     twice a second, so a soldier who does get wedged is moving again inside a
     second rather than standing there long enough for you to notice. */
  e.stuckT += dt;
  if (e.stuckT >= 0.5) {
    const moved = Math.hypot(obj.position.x - e.stuckX, obj.position.z - e.stuckZ);
    if (sp > 0.2 && moved < 0.22) {
      if (++e.stuckN >= 2) {
        e.stuckN = 0;
        e.avoidSide = 0;
        e.avoidT = 0;
        e.clearT = 0;
        if (e.state === ST.PATROL) {
          e.wp = (e.wp + 1) % e.route.length;
          e.idleT = 0;
        } else {
          const f = nearestFree(
            obj.position.x + rand(-5, 5),
            obj.position.z + rand(-5, 5),
            0.5,
            1.7,
            6,
            obj.position.y
          );
          e.lastKnown.set(f[0], obj.position.y, f[1]);
          e.cover = null;
        }
      }
    } else e.stuckN = 0;
    e.stuckT = 0;
    e.stuckX = obj.position.x;
    e.stuckZ = obj.position.z;
  }

  /* gravity / ground snap */
  const gy = groundAt(obj.position.x, obj.position.z, obj.position.y + 0.75);
  if (gy !== null) {
    if (obj.position.y > gy + 0.05) obj.position.y = Math.max(gy, obj.position.y - 12 * dt);
    else obj.position.y = gy;
  } else obj.position.y = Math.max(0, obj.position.y - 12 * dt);

  /* ---------- facing ---------- */
  let dy = e.targetYaw - e.yaw;
  while (dy > PI) dy -= PI * 2;
  while (dy < -PI) dy += PI * 2;
  e.yaw += dy * Math.min(1, dt * (e.state === ST.COMBAT ? 9 : 4.2));
  obj.rotation.y = e.yaw;

  /* ---------- animation ---------- */
  const walk = clamp(e.speed / 2.4, 0, 1);
  e.walkPhase += dt * (3.0 + e.speed * 2.2);
  const s1 = Math.sin(e.walkPhase),
    c1 = Math.cos(e.walkPhase);
  p.legs[0].hip.rotation.x = s1 * 0.62 * walk;
  p.legs[1].hip.rotation.x = -s1 * 0.62 * walk;
  p.legs[0].knee.rotation.x = Math.max(0, -Math.cos(e.walkPhase)) * 0.7 * walk;
  p.legs[1].knee.rotation.x = Math.max(0, Math.cos(e.walkPhase)) * 0.7 * walk;
  p.body.position.y = Math.abs(c1) * 0.045 * walk - e.flinch * 0.03;
  p.body.rotation.z = s1 * 0.035 * walk;

  const combat = e.state === ST.COMBAT || e.state === ST.ALERT ? 1 : 0;
  e.combatBlend = damp(e.combatBlend === undefined ? 0 : e.combatBlend, combat, 7, dt);
  const cb = e.combatBlend;
  /* Arms: low-ready carry on patrol, rifle in the shoulder in contact. Both sets
     of angles were solved against the weapon's own grip and handguard, so the
     gloves sit on the rifle instead of near it. A positive shoulder pitch swings
     the arm forward — down -Z, the way the man is facing. */
  p.arms[0].sh.rotation.x = lerp(0.85 + s1 * 0.25 * walk, 1.5, cb); // support
  p.arms[0].sh.rotation.z = lerp(0.65, 0.62, cb);
  p.arms[0].el.rotation.x = lerp(-0.11, -0.15, cb);
  p.arms[1].sh.rotation.x = lerp(1.12 - s1 * 0.25 * walk, 1.99, cb); // trigger
  p.arms[1].sh.rotation.z = lerp(-0.28, -0.68, cb);
  p.arms[1].el.rotation.x = lerp(-1.39, -1.69, cb);
  p.gun.position.set(lerp(0.14, 0.1, cb), lerp(-0.3, -0.05, cb), lerp(-0.2, -0.26, cb));
  p.gun.rotation.set(lerp(-0.42, 0, cb), lerp(-0.16, 0, cb), lerp(0.2, 0, cb));
  p.rig.rotation.x = lerp(0, e.aimPitch, cb);
  p.head.rotation.x = lerp(0, e.aimPitch * 0.5, cb);

  /* Flinch rocks the torso back off the shot. -Z is the way he is facing, so
     both of these have to be positive or a hit visibly walks him into it. */
  p.model.position.z = e.flinch * 0.14;
  p.model.rotation.x = e.flinch * 0.2;

  /* nameplate — suppressed on the menus, where it would read as debug overlay */
  const dCam = obj.position.distanceTo(camera.position);
  e.tag.sprite.visible = G.started && dCam < 46;
  if (e.tag.sprite.visible) {
    /* the sprite lives in world space, so a narrowed FOV magnifies it along
       with everything else — at 15x a nameplate covers the man wearing it.
       Cancelling the zoom keeps it the same size on screen at any aim state. */
    const s = clamp(dCam * 0.055, 0.85, 2.4) * (camera.fov / BASE_FOV);
    e.tag.sprite.scale.set(1.55 * s, 0.46 * s, 1);
    e.tag.sprite.position.y = 2.16;
  }
}
