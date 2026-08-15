'use strict';
/* =========================================================================
   18. VIEWMODEL ANIMATION
   ========================================================================= */
let swayX = 0,
  swayY = 0,
  swayLagX = 0,
  swayLagY = 0;

function poseReloadHand(
  vm,
  target,
  offset,
  rotation,
  blend,
  hand = vm.leftHand,
  hideForearm = true
) {
  if (!hand || blend <= 0) return;
  /* The hand and detachable magazine do not always share a parent (the
     pistol mag lives under its angled grip, for example). Resolve the grab
     point through world space, then convert it back into the hand parent's
     local space so both objects really meet instead of receiving merely
     similar-looking local offsets. */
  vm.group.updateMatrixWorld(true);
  const grab = vm._reloadHandTarget || (vm._reloadHandTarget = new THREE.Vector3());
  grab.copy(offset);
  target.localToWorld(grab);
  hand.parent.worldToLocal(grab);
  hand.position.lerp(grab, blend);
  hand.rotation.x = lerp(hand.rotation.x, rotation.x, blend);
  hand.rotation.y = lerp(hand.rotation.y, rotation.y, blend);
  hand.rotation.z = lerp(hand.rotation.z, rotation.z, blend);
  if (hideForearm && hand.forearm) hand.forearm.visible = blend < 0.002;
}

function updateViewmodel(dt, mdx, mdy) {
  const w = WEAPONS[player.weapon];
  const vm = w.vm;

  /* sway from mouse movement */
  const heavy = w.heavy ? 1 : 0;
  swayX = damp(swayX, clamp(-mdx * 0.0016, -0.055, 0.055), heavy ? 6 : 12, dt);
  swayY = damp(swayY, clamp(mdy * 0.0016, -0.045, 0.045), heavy ? 6 : 12, dt);
  swayLagX = damp(swayLagX, swayX, heavy ? 4.5 : 9, dt);
  swayLagY = damp(swayLagY, swayY, heavy ? 4.5 : 9, dt);

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

  /* Compressed high-ready: stock in the pec, muzzle up along the ribs. */
  const sprintK = damp(vm._sprintK || 0, player.sprint && player.bobAmp > 0.6 ? 1 : 0, 9, dt);
  vm._sprintK = sprintK;
  const amp = player.bobAmp * (1 - sprintK * 0.65);
  px += Math.sin(player.bob) * (heavy ? 0.015 : 0.022) * amp;
  py += (Math.abs(Math.cos(player.bob)) - 0.5) * (heavy ? 0.028 : 0.02) * amp;
  rz += Math.sin(player.bob) * (heavy ? 0.044 : 0.03) * amp;
  rx += Math.cos(player.bob * 2) * 0.014 * amp;

  /* airborne float */
  if (!player.onGround) {
    py -= clamp(player.vel.y * 0.006, -0.05, 0.05);
    rx += clamp(player.vel.y * 0.01, -0.09, 0.09);
  }

  px = lerp(px, heavy ? -0.01 : -0.048, sprintK);
  py -= sprintK * (heavy ? 0.17 : 0.208);
  pz += sprintK * (heavy ? 0.2 : 0.275);
  rx = lerp(rx, heavy ? 0.68 : 0.86, sprintK);
  ry = lerp(ry, heavy ? 0.4 : 0.46, sprintK);
  rz = lerp(rz, heavy ? -0.34 : -0.5, sprintK);

  /* crouch: tucked in slightly */
  const crouchK = damp(vm._crouchK || 0, player.crouch ? 1 : 0, 10, dt);
  vm._crouchK = crouchK;
  px -= crouchK * 0.018;
  py += crouchK * 0.012;
  pz += crouchK * 0.02;

  if (vm.mag) {
    vm._magPos ||= vm.mag.position.clone();
    vm._magRot ||= vm.mag.rotation.clone();
    vm.mag.position.copy(vm._magPos);
    vm.mag.rotation.copy(vm._magRot);
    const interrupted = w.reloadState;
    vm.mag.visible = !(interrupted?.magOut && !interrupted?.inserted);
  }
  if (vm.newMag) {
    vm._newMagPos ||= vm.newMag.position.clone();
    vm._newMagRot ||= vm.newMag.rotation.clone();
    vm.newMag.position.copy(vm._newMagPos);
    vm.newMag.rotation.copy(vm._newMagRot);
    vm.newMag.visible = false;
  }
  if (w.id === 'ak' && vm.ejectedMag && !w.reloadState && !vm._magFlight)
    vm.ejectedMag.visible = false;
  for (const hand of [vm.leftHand, vm.rightHand]) {
    if (!hand) continue;
    hand._reloadBasePos ||= hand.position.clone();
    hand._reloadBaseRot ||= hand.rotation.clone();
    hand.position.copy(hand._reloadBasePos);
    hand.rotation.copy(hand._reloadBaseRot);
    if (hand.forearm) hand.forearm.visible = true;
  }
  if (vm.weaponPivot) {
    vm._weaponPivotPos ||= vm.weaponPivot.position.clone();
    vm._weaponPivotRot ||= vm.weaponPivot.rotation.clone();
    vm.weaponPivot.position.copy(vm._weaponPivotPos);
    vm.weaponPivot.rotation.copy(vm._weaponPivotRot);
  }
  if (vm.topCover) {
    vm._coverRot ||= vm.topCover.rotation.clone();
    vm.topCover.rotation.copy(vm._coverRot);
  }
  if (vm.chargeHandle) {
    vm._chargePos ||= vm.chargeHandle.position.clone();
    vm.chargeHandle.position.copy(vm._chargePos);
  }
  vm._reloadSlide = 0;
  vm._reloadBoltLift = 0;
  vm._reloadBoltBack = 0;
  vm._reloadPump = 0;
  if (vm.reloadShell) vm.reloadShell.visible = false;

  /* Keep the receiver inside the lower-centre safe area. The magazine itself
     now leaves and re-enters the well, rather than faking the action by moving
     the whole weapon off the right or bottom of the screen. */
  if (player.reloadT > 0) {
    const total = player.reloadDuration || w.reloadTime;
    const t = 1 - player.reloadT / total;
    const dip =
      t < 0.22 ? easeOutCubic(t / 0.22) : t < 0.72 ? 1 : 1 - easeInOutCubic((t - 0.72) / 0.28);
    /* Each weapon exposes the part the operator actually needs to reach. */
    if (w.id === 'rifle') {
      /* M4-specific presentation: snap the receiver across the body and hold
         it nearly horizontal long enough to see the empty magwell, insertion,
         and final palm strike. */
      const present =
        easeOutCubic(clamp(t / 0.12, 0, 1)) * (1 - easeInOutCubic(clamp((t - 0.86) / 0.14, 0, 1)));
      px = lerp(px, 0.015, present);
      py += present * 0.12;
      pz -= present * 0.11;
      rx = lerp(rx, 0.04, present);
      ry = lerp(ry, 0.1, present);
      rz = lerp(rz, 0.02, present);
      const turnRot = rifleTurnRotation(
        t,
        vm._rifleTurnRot || (vm._rifleTurnRot = new THREE.Euler())
      );
      vm.weaponPivot.rotation.x += turnRot.x;
      vm.weaponPivot.rotation.y += turnRot.y;
      vm.weaponPivot.rotation.z += turnRot.z;
      /* A short overshoot makes this read as a deliberate sideways flick,
         instead of the receiver simply interpolating into a display pose. */
      const flick = Math.sin(PI * clamp((t - 0.035) / 0.13, 0, 1));
      px -= flick * 0.065;
      poseReloadHand(
        vm,
        vm.rightGrip,
        vm._rifleRightGrip || (vm._rifleRightGrip = new THREE.Vector3()),
        vm._rifleRightRot || (vm._rifleRightRot = new THREE.Vector3(0.34, 0.1, -0.34)),
        present,
        vm.rightHand,
        false
      );
    } else if (w.id === 'ak') {
      /* Keep the arms upright while the receiver rolls into a readable AK
         rock-and-lock presentation. The support hand owns both magazines. */
      const side =
        easeOutCubic(clamp(t / 0.13, 0, 1)) * (1 - easeInOutCubic(clamp((t - 0.9) / 0.1, 0, 1)));
      px = lerp(px, 0.035, side);
      py += side * 0.105;
      pz -= side * 0.095;
      rx = lerp(rx, 0.04, side);
      ry = lerp(ry, 0.1, side);
      rz = lerp(rz, -0.02, side);
      vm.weaponPivot.rotation.x += side * 0.08;
      vm.weaponPivot.rotation.y += side * 0.18;
      vm.weaponPivot.rotation.z -= side * 0.82;
      poseReloadHand(
        vm,
        vm.rightGrip,
        vm._akRightGrip || (vm._akRightGrip = new THREE.Vector3()),
        vm._akRightRot || (vm._akRightRot = new THREE.Vector3(0.3, 0.08, -0.25)),
        side * 0.86,
        vm.rightHand,
        false
      );
    } else if (w.id === 'shotgun') {
      px = lerp(px, 0.06, dip);
      py += dip * 0.095;
      pz -= dip * 0.08;
      rx = lerp(rx, 0.17, dip);
      ry = lerp(ry, 0.22, dip);
      rz = lerp(rz, -0.045, dip);
    } else if (w.id === 'pistol') {
      px = lerp(px, 0.045, dip);
      py += dip * 0.08;
      pz -= dip * 0.055;
      rx = lerp(rx, 0.12, dip);
      ry = lerp(ry, 0.2, dip);
      rz = lerp(rz, -0.07, dip);
    } else if (w.id === 'sniper') {
      /* Only the rifle rolls. The camera-space carry and shoulders stay
         upright; wrists follow individual controls without twisting arms. */
      const side =
        easeOutCubic(clamp(t / 0.18, 0, 1)) * (1 - easeInOutCubic(clamp((t - 0.86) / 0.135, 0, 1)));
      px = lerp(px, 0.045, side);
      py += side * 0.08;
      pz -= side * 0.07;
      rx = lerp(rx, 0.04, side);
      ry = lerp(ry, 0.13, side);
      rz = lerp(rz, -0.04, side);
      vm.weaponPivot.rotation.x += side * 0.04;
      vm.weaponPivot.rotation.y += side * 0.2;
      vm.weaponPivot.rotation.z -= side * 1.15;
      poseReloadHand(
        vm,
        vm.rightGrip,
        vm._sniperRightGrip || (vm._sniperRightGrip = new THREE.Vector3()),
        vm._sniperRightRot || (vm._sniperRightRot = new THREE.Vector3(0.28, 0.08, -0.22)),
        side * 0.82,
        vm.rightHand,
        false
      );
    } else if (w.id === 'lmg') {
      px = lerp(px, 0.09, dip);
      py += dip * 0.07;
      pz -= dip * 0.09;
      rx = lerp(rx, 0.11, dip);
      ry = lerp(ry, 0.25, dip);
      rz = lerp(rz, -0.04, dip);
    } else if (w.id === 'vector' || w.id === 'p90') {
      const smgPose = [px, py, pz];
      animateSmgReloadPresentation(w, vm, t, smgPose);
      [px, py, pz] = smgPose;
    }
    if (w.id !== 'rifle' && w.id !== 'shotgun') animateDistinctMagazine(w, vm, t);

    if (w.id === 'rifle') {
      /* Release at peak receiver speed. The old magazine then lives outside
         weaponPivot and follows a tiny frame-rate-independent rigid-body
         trajectory: initial velocity + gravity + angular velocity. */
      animateRifleEjectedMag(vm, t, total, w.reloadState);

      /* 44–70%: a distinct fresh mag rises from below in the support hand and
         seats along the actual magwell axis. */
      const insert = 1 - easeInOutCubic(clamp((t - 0.47) / 0.23, 0, 1));
      vm.newMag.visible = t >= 0.42 && t < 0.9;
      vm.newMag.position.x -= insert * 0.16;
      vm.newMag.position.y -= insert * 0.32;
      vm.newMag.position.z += insert * 0.08;
      vm.newMag.rotation.x += insert * 0.12;
      vm.newMag.rotation.z += insert * 0.38;
      if (vm.leftHand && t >= 0.42) {
        const hold =
          easeInOutCubic(clamp((t - 0.42) / 0.06, 0, 1)) *
          (1 - easeInOutCubic(clamp((t - 0.79) / 0.1, 0, 1)));
        poseReloadHand(
          vm,
          vm.newMag,
          vm._rifleMagGrip || (vm._rifleMagGrip = new THREE.Vector3(-0.056, -0.025, 0.012)),
          vm._rifleMagGripRot || (vm._rifleMagGripRot = new THREE.Vector3(0.16, 0.12, -0.48)),
          hold
        );
      }
    }

    if (w.id === 'rifle') {
      const slap = Math.sin(PI * clamp((t - 0.7) / (player.reloadEmpty ? 0.17 : 0.13), 0, 1));
      poseReloadHand(
        vm,
        vm.reloadSlap,
        vm._slapOffset || (vm._slapOffset = new THREE.Vector3()),
        vm._slapRot || (vm._slapRot = new THREE.Vector3(0.05, 0.18, -0.62)),
        slap
      );
      py += slap * 0.024;
      pz += slap * 0.028;
      rx -= slap * 0.09;
      rz += slap * 0.06;
    }
    if (w.id === 'pistol' && player.reloadEmpty) {
      const rack = Math.sin(PI * clamp((t - 0.7) / 0.2, 0, 1));
      vm._reloadSlide = rack;
      poseReloadHand(
        vm,
        vm.slide,
        vm._pistolRackGrip || (vm._pistolRackGrip = new THREE.Vector3(-0.046, 0.025, 0.035)),
        vm._pistolRackRot || (vm._pistolRackRot = new THREE.Vector3(0.2, 0.2, -0.58)),
        rack
      );
      pz += rack * 0.025;
    }
    if (w.id === 'ak' && player.reloadEmpty) {
      const rack = Math.sin(PI * clamp((t - 0.76) / 0.17, 0, 1));
      vm.chargeHandle.position.z += rack * 0.105;
      poseReloadHand(
        vm,
        vm.chargeHandle,
        vm._akRackGrip || (vm._akRackGrip = new THREE.Vector3(-0.042, 0, 0.012)),
        vm._akRackRot || (vm._akRackRot = new THREE.Vector3(0.16, -0.1, -0.52)),
        rack,
        vm.leftHand,
        false
      );
      py += rack * 0.015;
      pz += rack * 0.025;
    }
    animateSmgReloadRack(w, vm, t);
    if (w.id === 'sniper') {
      const action = clamp((t - 0.89) / 0.1, 0, 1);
      vm._reloadBoltLift = Math.sin(PI * action);
      vm._reloadBoltBack = Math.sin(PI * clamp((action - 0.16) / 0.72, 0, 1));
      poseReloadHand(
        vm,
        vm.knob,
        vm._boltGrip || (vm._boltGrip = new THREE.Vector3(0.035, -0.005, 0.015)),
        vm._boltGripRot || (vm._boltGripRot = new THREE.Vector3(0.08, -0.12, -0.42)),
        Math.sin(PI * action),
        vm.rightHand,
        false
      );
    }
    if (w.id === 'lmg') {
      const open =
        easeInOutCubic(clamp((t - 0.1) / 0.18, 0, 1)) *
        (1 - easeInOutCubic(clamp((t - 0.72) / 0.14, 0, 1)));
      vm.topCover.rotation.x += open * 1.08;
      const rack = Math.sin(PI * clamp((t - 0.84) / 0.12, 0, 1));
      vm.chargeHandle.position.z += rack * 0.085;
      py += rack * 0.018;
      pz += rack * 0.025;
    }
    if (vm.reloadShell) {
      const elapsed = t * total,
        loadStart = 0.2,
        shellTime = 0.42,
        rounds = Math.max(1, player.reloadRounds || 1),
        shellIndex = Math.floor(Math.max(0, elapsed - loadStart) / shellTime),
        cycle = clamp((elapsed - loadStart - shellIndex * shellTime) / shellTime, 0, 1),
        feed = easeInOutCubic(clamp(cycle / 0.78, 0, 1));
      vm.reloadShell.visible = elapsed >= loadStart && shellIndex < rounds;
      vm.reloadShell.position.set(-0.18 * (1 - feed), -0.2 * (1 - feed) - 0.075, -0.015);
      vm.reloadShell.rotation.set(0.25, 0, -0.45 * (1 - feed));
      if (vm.leftHand) {
        const shellHandBlend =
          easeInOutCubic(clamp(cycle / 0.14, 0, 1)) *
          (1 - easeInOutCubic(clamp((cycle - 0.76) / 0.18, 0, 1)));
        poseReloadHand(
          vm,
          vm.reloadShell,
          vm._shellHandOffset || (vm._shellHandOffset = new THREE.Vector3(-0.047, -0.006, 0.012)),
          vm._shellHandRotation || (vm._shellHandRotation = new THREE.Vector3(0.16, 0.1, -0.5)),
          shellHandBlend
        );
      }
      const seat = Math.sin(PI * clamp((cycle - 0.58) / 0.32, 0, 1));
      py += seat * 0.012;
      rx -= seat * 0.035;
      const loadEnd = loadStart + rounds * shellTime;
      if (player.reloadEmpty && elapsed > loadEnd)
        vm._reloadPump = Math.sin(PI * clamp((elapsed - loadEnd) / 0.16, 0, 1));
    }
  }
  if (player.meleeT > 0) {
    const mt = 1 - player.meleeT / 0.46,
      wind = easeInOutCubic(clamp(mt / 0.32, 0, 1)),
      strike = Math.sin(PI * clamp((mt - 0.25) / 0.55, 0, 1));
    px -= wind * 0.14;
    py += wind * 0.06;
    pz += strike * 0.2;
    rx -= strike * 0.45;
    ry += wind * 0.5 - strike * 0.72;
    rz -= wind * 0.38;
  }
  /* draw/holster */
  if (player.switching > 0) {
    const w2 = WEAPONS[player.switchTo >= 0 ? player.switchTo : player.weapon];
    let k = 0;
    if (player.switchTo >= 0) {
      k = 1 - clamp((player.switching - w2.drawTime) / player.holsterAt, 0, 1); // holstering
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
    let slide = vm._reloadPump || 0;
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
    vm.slide.position.z = Math.max(t * 0.045, (vm._reloadSlide || 0) * 0.07);
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
    lift = Math.max(lift, vm._reloadBoltLift || 0);
    back = Math.max(back, vm._reloadBoltBack || 0);
    vm.bolt.position.z = 0.1 + back * 0.125;
    /* positive Z swings the handle up over the receiver, where it's visible
       from the left-side view the player actually has */
    vm.bolt.rotation.z = lift * 1.2;
    px -= back * 0.012;
    pz += back * 0.022;
    ry -= lift * 0.055;
    rz -= lift * 0.035;
    if (player.boltT > 0) {
      const cycle = 1 - player.boltT / w.boltTime;
      const grip = Math.sin(PI * clamp(cycle / 0.9, 0, 1));
      poseReloadHand(
        vm,
        vm.knob,
        vm._boltGrip || (vm._boltGrip = new THREE.Vector3(0.035, -0.005, 0.015)),
        vm._boltGripRot || (vm._boltGripRot = new THREE.Vector3(0.08, -0.12, -0.42)),
        grip,
        vm.rightHand,
        false
      );
    }
  }

  /* ---- ADS: slide the sight onto the camera axis ---- */
  const ae = player.adsEase;
  const equippedOptic = w.attachments?.optic;
  if (vm.dotGlow) {
    vm.dotGlow.material.opacity = lerp(0.24, 0.82, ae);
    const dotScale = lerp(0.0062, 0.0074, ae);
    vm.dotGlow.scale.set(dotScale, dotScale, 1);
  }
  if (vm.opticGlass) vm.opticGlass.material.opacity = lerp(0.12, 0.19, ae);
  if (ae > 0.0005 && vm.adsPos) {
    const opticNode = vm.attachmentNodes?.optic?.[equippedOptic];
    /* The world ray and HUD confirmation are fixed to screen centre. Each
       optic has a different rail/window height, so lift that actual optical
       axis to y=0 instead of reusing the iron-sight pose for every attachment. */
    const adsAimY = opticNode
      ? -(opticNode.position.y + (opticNode.userData.aimY || 0) * opticNode.scale.y) *
        vm.group.scale.y
      : vm.adsPos.y;
    const adsAimX = opticNode ? -opticNode.position.x * vm.group.scale.x : vm.adsPos.x;
    px = lerp(px, adsAimX, ae);
    py = lerp(py, adsAimY, ae);
    const opticDepth =
      equippedOptic === 'prism_2_5'
        ? -0.34
        : equippedOptic === 'holo'
          ? -0.4
          : equippedOptic === 'micro_dot'
            ? -0.42
            : vm.adsPos.z;
    pz = lerp(pz, opticDepth, ae);
    rx = lerp(rx, vm.adsRot.x, ae);
    ry = lerp(ry, vm.adsRot.y, ae);
    rz = lerp(rz, vm.adsRot.z, ae);
  }
  /* Pull the eye back and narrow the lens by the matching amount. The sight is
     on the camera's -Z axis, so sliding along that axis cannot break alignment
     — it only trades wide-angle bulge for telephoto flatness. */
  {
    const ref = vm.adsRef || 0.68;
    const optic = equippedOptic;
    /* COD-style eye relief: mounted optics come to the eye and dominate the
       frame. Do not counter-shrink them with the old telephoto dolly formula. */
    const opticDolly =
      optic === 'prism_2_5'
        ? -0.14
        : optic === 'holo'
          ? -0.11
          : optic === 'micro_dot'
            ? -0.1
            : null;
    const dolly = w.bracedAim ? 0 : (opticDolly ?? VM_ADS_DOLLY) * ae;
    const f = optic
      ? VM_FOV
      : (Math.atan((Math.tan((VM_FOV * PI) / 360) * ref) / (ref + dolly)) * 360) / PI;
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
  if (vm.barrels) {
    const spinWant = player.triggerHeld && G.running && !player.dead ? 32 : 0;
    vm.barrelSpin = damp(vm.barrelSpin || 0, spinWant, spinWant ? 8 : 3.2, dt);
    vm.barrels.rotation.z += vm.barrelSpin * dt;
  }

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
