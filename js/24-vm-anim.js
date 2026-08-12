'use strict';
/* =========================================================================
   18. VIEWMODEL ANIMATION
   ========================================================================= */
let swayX = 0,
  swayY = 0,
  swayLagX = 0,
  swayLagY = 0;
function updateViewmodel(dt, mdx, mdy) {
  const w = WEAPONS[player.weapon];
  const vm = w.vm;

  /* sway from mouse movement */
  swayX = damp(swayX, clamp(-mdx * 0.0016, -0.055, 0.055), 12, dt);
  swayY = damp(swayY, clamp(mdy * 0.0016, -0.045, 0.045), 12, dt);
  swayLagX = damp(swayLagX, swayX, 9, dt);
  swayLagY = damp(swayLagY, swayY, 9, dt);

  /* recoil spring */
  const K = 210,
    D = 19;
  vmRec.vz += -vmRec.pz * K * dt;
  vmRec.vz -= vmRec.vz * D * dt;
  vmRec.pz += vmRec.vz * dt;
  vmRec.vy += -vmRec.py * K * dt;
  vmRec.vy -= vmRec.vy * D * dt;
  vmRec.py += vmRec.vy * dt;
  vmRec.vrx += -vmRec.rx * K * dt;
  vmRec.vrx -= vmRec.vrx * D * dt;
  vmRec.rx += vmRec.vrx * dt;
  vmRec.vry += -vmRec.ry * K * dt;
  vmRec.vry -= vmRec.vry * D * dt;
  vmRec.ry += vmRec.vry * dt;
  vmRec.vrz += -vmRec.rz * K * dt;
  vmRec.vrz -= vmRec.vrz * D * dt;
  vmRec.rz += vmRec.vrz * dt;

  /* base pose */
  let px = vm.basePos.x,
    py = vm.basePos.y,
    pz = vm.basePos.z;
  let rx = vm.baseRot.x,
    ry = vm.baseRot.y,
    rz = vm.baseRot.z;

  /* bob synced to footsteps */
  const amp = player.bobAmp;
  px += Math.sin(player.bob) * 0.022 * amp;
  py += (Math.abs(Math.cos(player.bob)) - 0.5) * 0.02 * amp;
  rz += Math.sin(player.bob) * 0.03 * amp;
  rx += Math.cos(player.bob * 2) * 0.014 * amp;

  /* airborne float */
  if (!player.onGround) {
    py -= clamp(player.vel.y * 0.006, -0.05, 0.05);
    rx += clamp(player.vel.y * 0.01, -0.09, 0.09);
  }

  /* sprint: gun lowered and canted */
  const sprintK = damp(vm._sprintK || 0, player.sprint && player.bobAmp > 0.6 ? 1 : 0, 9, dt);
  vm._sprintK = sprintK;
  px += sprintK * 0.045;
  py -= sprintK * 0.085;
  pz += sprintK * 0.055;
  rx += sprintK * 0.3;
  ry -= sprintK * 0.55;
  rz += sprintK * 0.42;

  /* crouch: tucked in slightly */
  const crouchK = damp(vm._crouchK || 0, player.crouch ? 1 : 0, 10, dt);
  vm._crouchK = crouchK;
  px -= crouchK * 0.018;
  py += crouchK * 0.012;
  pz += crouchK * 0.02;

  /* reload: dip out of frame and back */
  if (player.reloadT > 0) {
    const total = w.reloadTime;
    const t = 1 - player.reloadT / total;
    const dip =
      t < 0.22 ? easeOutCubic(t / 0.22) : t < 0.72 ? 1 : 1 - easeInOutCubic((t - 0.72) / 0.28);
    py -= dip * 0.34;
    pz += dip * 0.14;
    px += dip * 0.05;
    rx += dip * 0.85;
    rz += dip * 0.55;
    ry -= dip * 0.3;
    /* mag-swap shake in the middle */
    if (t > 0.25 && t < 0.7) {
      const j = Math.sin((t - 0.25) * 46);
      py += j * 0.01;
      rx += j * 0.03;
    }
  }
  /* draw/holster */
  if (player.switching > 0) {
    const w2 = WEAPONS[player.switchTo >= 0 ? player.switchTo : player.weapon];
    let k;
    if (player.switchTo >= 0) {
      k = 1 - clamp((player.switching - w2.drawTime) / 0.22, 0, 1); // holstering: 0 → 1
    } else {
      k = clamp(player.switching / w.drawTime, 0, 1); // drawing
    }
    const e2 = easeOutCubic(k);
    py -= e2 * 0.4;
    pz += e2 * 0.1;
    rx += e2 * 1.05;
    rz += e2 * 0.45;
  }
  /* pump action */
  if (vm.forend) {
    let slide = 0;
    if (player.pumpT > 0) {
      const t = 1 - player.pumpT / w.pumpTime;
      slide = t < 0.45 ? easeOutCubic(t / 0.45) : 1 - easeOutCubic((t - 0.45) / 0.55);
    }
    vm.forend.position.z = -0.34 + slide * 0.105;
    pz += slide * 0.028;
    rx -= slide * 0.05;
  }
  /* pistol slide cycling */
  if (vm.slide) {
    const t = clamp(flashT / flashDur, 0, 1);
    vm.slide.position.z = t * 0.045;
  }
  /* bolt: lift, pull, hold, push, lock */
  if (vm.bolt) {
    let back = 0,
      lift = 0;
    if (player.boltT > 0) {
      const t = 1 - player.boltT / w.boltTime;
      lift = t < 0.14 ? easeOutCubic(t / 0.14) : t > 0.74 ? 1 - easeOutCubic((t - 0.74) / 0.26) : 1;
      back =
        t < 0.14
          ? 0
          : t < 0.4
            ? easeOutCubic((t - 0.14) / 0.26)
            : t < 0.56
              ? 1
              : t < 0.74
                ? 1 - easeInOutCubic((t - 0.56) / 0.18)
                : 0;
    }
    vm.bolt.position.z = 0.1 + back * 0.125;
    /* positive Z swings the handle up over the receiver, where it's visible
       from the left-side view the player actually has */
    vm.bolt.rotation.z = lift * 1.2;
    px -= back * 0.012;
    pz += back * 0.022;
    ry -= lift * 0.055;
    rz -= lift * 0.035;
  }

  /* ---- ADS: slide the sight onto the camera axis ---- */
  const ae = player.adsEase;
  if (ae > 0.0005 && vm.adsPos) {
    px = lerp(px, vm.adsPos.x, ae);
    py = lerp(py, vm.adsPos.y, ae);
    pz = lerp(pz, vm.adsPos.z, ae);
    rx = lerp(rx, vm.adsRot.x, ae);
    ry = lerp(ry, vm.adsRot.y, ae);
    rz = lerp(rz, vm.adsRot.z, ae);
  }
  /* Pull the eye back and narrow the lens by the matching amount. The sight is
     on the camera's -Z axis, so sliding along that axis cannot break alignment
     — it only trades wide-angle bulge for telephoto flatness. */
  {
    const ref = vm.adsRef || 0.68;
    const dolly = VM_ADS_DOLLY * ae;
    const f = (Math.atan((Math.tan((VM_FOV * PI) / 360) * ref) / (ref + dolly)) * 360) / PI;
    if (vmCamera.position.z !== dolly || vmCamera.fov !== f) {
      vmCamera.position.z = dolly;
      vmCamera.fov = f;
      vmCamera.updateProjectionMatrix();
    }
  }

  /* lift the fill only while aiming — see the light rig comment up top */
  vmAmb.intensity = VM_LIGHT_BASE.amb + 0.24 * ae;
  vmKey.intensity = VM_LIGHT_BASE.key + 0.4 * ae;
  vmFill.intensity = VM_LIGHT_BASE.fill + 0.3 * ae;
  vmRim.intensity = VM_LIGHT_BASE.rim + 0.16 * ae;

  /* sway is what breaks sight alignment, so damp it hard while aiming */
  const swayK = 1 - 0.88 * ae;

  /* apply */
  vmSway.position.set(px + swayLagX * swayK, py + swayLagY * swayK, pz);
  vmSway.rotation.set(
    rx + swayLagY * 1.6 * swayK,
    ry + swayLagX * 2.1 * swayK,
    rz - swayLagX * 1.4 * swayK
  );
  vmRecoil.position.set(0, vmRec.py * 0.5, vmRec.pz);
  vmRecoil.rotation.set(vmRec.rx * 0.6, vmRec.ry * 0.6, vmRec.rz * 0.6);

  /* muzzle flash */
  if (flashT > 0) {
    flashT -= dt;
    const k = clamp(flashT / flashDur, 0, 1);
    vm.muzzle.getWorldPosition(_tmpV);
    muzzleSprite.position.copy(_tmpV);
    muzzleGlow.position.copy(_tmpV);
    /* Sized against the frame, not the gun. The muzzle sits ~1.6 units from the
       viewmodel eye, where the visible frame is only ~1.2 units tall, so a sprite
       scaled in model units balloons: the old 0.89 covered three quarters of the
       screen height and full-auto turned the lower half of the frame into a white
       sheet. A real flash reads at roughly a sixth of frame height. */
    const sc = (0.065 + 0.075 * flashPower) * (0.55 + k * 0.8);
    /* The sprites hang off vmScene rather than vmRoot, so hiding the gun behind
       the scope leaves them floating in the middle of the sight picture. Down a
       scope the muzzle is a metre forward and well below the optical axis; you
       do not see the flash at all, so it fades out with the weapon. */
    const seen = 1 - (w.scope ? clamp((player.adsEase - 0.45) / 0.4, 0, 1) : 0);
    muzzleSprite.scale.set(sc, sc, 1);
    muzzleSprite.material.rotation = muzzleSprite.material.rotation || 0;
    muzzleSprite.material.opacity = k * seen;
    muzzleGlow.scale.set(sc * 1.9, sc * 1.9, 1);
    muzzleGlow.material.opacity = k * 0.62 * seen;
    vmMuzzleLight.position.copy(_tmpV);
    vmMuzzleLight.intensity = k * 9 * flashPower * seen;
    camera.getWorldDirection(_fwd);
    muzzleLight.position.copy(camera.position).addScaledVector(_fwd, 0.8);
    muzzleLight.intensity = k * 11 * flashPower;
    if (flashT <= 0) {
      muzzleSprite.material.opacity = 0;
      muzzleGlow.material.opacity = 0;
      vmMuzzleLight.intensity = 0;
      muzzleLight.intensity = 0;
    }
  }
}
