/* dev-only: enemy watchdog + movement probes. Load after test-harness.js —
   it merges its methods into window.H. */
Object.assign(window.H, {
  /* Watch every enemy for `secs`: flag any that end up inside geometry, or that
     sit in one spot while not in combat. Resolves with a report. */
  watch(secs) {
    const start = performance.now();
    const rec = enemies.map((e) => ({
      n: e.name,
      inSolid: 0,
      still: 0,
      maxStill: 0,
      lx: e.obj.position.x,
      lz: e.obj.position.z,
      states: {},
      minY: 9,
      maxY: -9,
    }));
    return new Promise((resolve) => {
      const iv = setInterval(() => {
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i],
            r = rec[i],
            p = e.obj.position;
          if (e.dead) continue;
          r.states[e.state] = (r.states[e.state] || 0) + 1;
          r.minY = Math.min(r.minY, p.y);
          r.maxY = Math.max(r.maxY, p.y);
          if (blocked(p.x, p.z, p.y + 0.35, p.y + 1.6, 0.4)) r.inSolid++;
          const moved = Math.hypot(p.x - r.lx, p.z - r.lz);
          if (moved < 0.05) {
            r.still += 0.1;
            r.maxStill = Math.max(r.maxStill, r.still);
          } else r.still = 0;
          r.lx = p.x;
          r.lz = p.z;
        }
        if (performance.now() - start > secs * 1000) {
          clearInterval(iv);
          resolve(
            rec.map((r) => ({
              n: r.n,
              inSolid: r.inSolid,
              maxStill: +r.maxStill.toFixed(1),
              y: [+r.minY.toFixed(2), +r.maxY.toFixed(2)],
              states: r.states,
            }))
          );
        }
      }, 100);
    });
  },

  /* Charge the player into every collider from four sides and report any that
     it ends up standing inside. This is the direct test of "solid means solid". */
  charge() {
    const bad = [];
    const saved = player.pos.clone();
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.maxY <= 0.35) continue; // step-over lip
      const cx = (c.minX + c.maxX) / 2,
        cz = (c.minZ + c.maxZ) / 2;
      const hw = (c.maxX - c.minX) / 2,
        hd = (c.maxZ - c.minZ) / 2;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const off = (dx ? hw : hd) + 3.0;
        const sx = cx - dx * off,
          sz = cz - dz * off;
        if (Math.abs(sx) > HALF - 0.6 || Math.abs(sz) > HALF - 0.6) continue;
        if (blocked(sx, sz, 0.3, 1.65, 0.34)) continue; // can't start there
        player.pos.set(sx, 0, sz);
        player.vel.set(0, 0, 0);
        for (let s = 0; s < 120; s++) {
          moveSlide(player.pos, dx * 0.07, dz * 0.07, 0.36, player.height);
          const g = groundAt(player.pos.x, player.pos.z, player.pos.y + 1.2);
          if (g !== null && g < player.pos.y + 0.6) player.pos.y = g;
        }
        /* standing inside the footprint, and not on top of it, is a failure */
        const p = player.pos;
        const inX = p.x > c.minX - 0.05 && p.x < c.maxX + 0.05;
        const inZ = p.z > c.minZ - 0.05 && p.z < c.maxZ + 0.05;
        /* the body has to actually overlap the box in Y — walking under a
           second-floor parapet is not a penetration */
        const overlapY = p.y + player.height - 0.05 > c.minY + 0.02 && p.y + 0.3 < c.maxY - 0.02;
        if (inX && inZ && overlapY) {
          bad.push({
            i,
            at: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
            boxY: [+c.minY.toFixed(2), +c.maxY.toFixed(2)],
            dir: [dx, dz],
          });
        }
      }
    }
    player.pos.copy(saved);
    return bad;
  },

  /* try to leave the map in 32 directions; reports the furthest distance reached */
  escape() {
    const saved = player.pos.clone();
    let worst = 0,
      at = null;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const dx = Math.cos(a),
        dz = Math.sin(a);
      player.pos.set(0, 0, 24);
      player.vel.set(0, 0, 0);
      for (let s = 0; s < 900; s++) {
        moveSlide(player.pos, dx * 0.09, dz * 0.09, 0.36, player.height);
        const g = groundAt(player.pos.x, player.pos.z, player.pos.y + 1.2);
        if (g !== null && g < player.pos.y + 0.6) player.pos.y = g;
      }
      const d = Math.max(Math.abs(player.pos.x), Math.abs(player.pos.z));
      if (d > worst) {
        worst = d;
        at = [+player.pos.x.toFixed(1), +player.pos.z.toFixed(1)];
      }
    }
    player.pos.copy(saved);
    return { furthestFromCentre: +worst.toFixed(2), at, wallAt: HALF };
  },

  /* push the player at a wall from `dist` away and report whether they ended up
     on the far side. dirs is a list of [dx,dz] unit-ish vectors. */
  ram(x, z, dirs, dist) {
    dist = dist || 2.5;
    const res = [];
    for (const [dx, dz] of dirs) {
      const sx = x - dx * dist,
        sz = z - dz * dist;
      if (blocked(sx, sz, 0.3, 1.65, 0.34)) {
        res.push('start-blocked');
        continue;
      }
      player.pos.set(sx, 0, sz);
      player.vel.set(0, 0, 0);
      for (let i = 0; i < 90; i++) {
        moveSlide(player.pos, dx * 0.09, dz * 0.09, 0.36, player.height);
        const g = groundAt(player.pos.x, player.pos.z, player.pos.y + 1.2);
        if (g !== null && g < player.pos.y + 0.6) player.pos.y = g;
      }
      /* did we end up past the wall? */
      const travelled = (player.pos.x - sx) * dx + (player.pos.z - sz) * dz;
      res.push(+travelled.toFixed(2));
    }
    return res;
  },
});
H.rig();
('dev ready');
