import type { FireWeapon, ReloadState, ReloadWeapon } from '../../shared/gameplay';
import type { CarriedWeapon } from './campaign';

export function reloadView(w: CarriedWeapon): ReloadWeapon {
  return {
    get id() {
      return w.def.id;
    },
    get mag() {
      return w.mag;
    },
    set mag(v) {
      w.mag = v;
    },
    get reserve() {
      return w.reserve;
    },
    set reserve(v) {
      w.reserve = v;
    },
    get magSize() {
      return w.def.magSize;
    },
    get reloadTime() {
      return w.def.reloadTime;
    },
    get tacticalReloadTime() {
      return w.def.tacticalReloadTime;
    },
    get reloadState() {
      return w.reloadState;
    },
    set reloadState(v: ReloadState | null) {
      w.reloadState = v;
    },
  };
}

export function fireView(w: CarriedWeapon): FireWeapon {
  return {
    get id() {
      return w.def.id;
    },
    get auto() {
      return w.def.auto;
    },
    get semi() {
      return w.semi;
    },
    set semi(v) {
      w.semi = v;
    },
    get mag() {
      return w.mag;
    },
    set mag(v) {
      w.mag = v;
    },
    get reserve() {
      return w.reserve;
    },
    set reserve(v) {
      w.reserve = v;
    },
    get rpm() {
      return w.def.rpm;
    },
    get pumpTime() {
      return w.def.pumpTime;
    },
    get boltTime() {
      return w.def.boltTime;
    },
    get spread() {
      return w.spread;
    },
    set spread(v) {
      w.spread = v;
    },
    get spreadMax() {
      return w.def.spreadMax;
    },
    get spreadShot() {
      return w.def.spreadShot;
    },
  };
}
