'use strict';
const REPEAT_BLOCKED_KEYS = [
  'Space', 'KeyR', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'KeyV', 'KeyB', 'KeyZ',
];
const BLOCKED_GAME_KEYS = [
  ...REPEAT_BLOCKED_KEYS, 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Tab', 'AltLeft', 'AltRight',
];
const sprintReloadSetting = document.getElementById('sprintReloadSetting') as HTMLInputElement;
const menuSprintReloadSetting = document.getElementById('menuSprintReloadSetting') as HTMLInputElement;
const menuSensitivity = document.getElementById('menuSensitivity') as HTMLInputElement;
const menuFov = document.getElementById('menuFov') as HTMLInputElement;
const menuVolume = document.getElementById('menuVolume') as HTMLInputElement;
const menuSensitivityValue = $('menuSensitivityValue') as HTMLOutputElement;
const menuFovValue = $('menuFovValue') as HTMLOutputElement;
const menuVolumeValue = $('menuVolumeValue') as HTMLOutputElement;

function syncSprintReloadSetting(value) {
  SETTINGS.sprintCancelsReload = value;
  sprintReloadSetting.checked = value;
  menuSprintReloadSetting.checked = value;
  localStorage.setItem('tf.sprintCancelsReload', String(value));
}
syncSprintReloadSetting(SETTINGS.sprintCancelsReload);
$('sprintReloadSettingWrap').addEventListener('click', (e) => e.stopPropagation());
sprintReloadSetting.addEventListener('change', (e) => {
  e.stopPropagation();
  syncSprintReloadSetting(sprintReloadSetting.checked);
});
menuSprintReloadSetting.addEventListener('change', () => syncSprintReloadSetting(menuSprintReloadSetting.checked));

const storedVolume = localStorage.getItem('tf.masterVolume');
let masterVolume = clamp(storedVolume === null ? 0.82 : Number(storedVolume), 0, 1);
function syncGlobalSettings() {
  menuSensitivity.value = String(SETTINGS.mouseSensitivity);
  menuSensitivityValue.value = SETTINGS.mouseSensitivity.toFixed(2) + '×';
  menuFov.value = String(BASE_FOV);
  menuFovValue.value = String(Math.round(BASE_FOV)) + '°';
  menuVolume.value = String(Math.round(masterVolume * 100));
  menuVolumeValue.value = String(Math.round(masterVolume * 100)) + '%';
}
menuSensitivity.addEventListener('input', () => {
  SETTINGS.mouseSensitivity = clamp(Number(menuSensitivity.value), 0.5, 2);
  localStorage.setItem('tf.mouseSensitivity', String(SETTINGS.mouseSensitivity));
  syncGlobalSettings();
});
menuFov.addEventListener('input', () => {
  BASE_FOV = clamp(Number(menuFov.value), 65, 95);
  localStorage.setItem('tf.baseFov', String(BASE_FOV));
  if (!G.started) {
    fovCur = BASE_FOV;
    camera.fov = BASE_FOV - 8;
    camera.updateProjectionMatrix();
  }
  syncGlobalSettings();
});
menuVolume.addEventListener('input', () => {
  masterVolume = clamp(Number(menuVolume.value) / 100, 0, 1);
  SFX.setMasterVolume(masterVolume);
  syncGlobalSettings();
});
syncGlobalSettings();
bindAttachmentPanel();
