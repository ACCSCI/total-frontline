import { SETTINGS } from './settings';
import { SFX } from './sfx';

export function bindPauseMenu(el: HTMLDivElement, requestPlayLock: () => void) {
  const sprint = document.getElementById('sprintReloadSetting') as HTMLInputElement | null;
  if (sprint) {
    sprint.checked = SETTINGS.sprintCancelsReload;
    sprint.addEventListener('change', () => {
      SETTINGS.sprintCancelsReload = sprint.checked;
      localStorage.setItem('tf.sprintCancelsReload', String(sprint.checked));
    });
  }
  document.getElementById('sprintReloadSettingWrap')?.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  el.addEventListener('click', () => requestPlayLock());
  document.getElementById('resumeBtn')?.addEventListener('click', (event) => {
    event.stopPropagation();
    requestPlayLock();
  });
  document.getElementById('quitBtn')?.addEventListener('click', (event) => {
    event.stopPropagation();
    location.href = '../';
  });
}

export function openPause(el: HTMLDivElement, canPause: boolean, onOpen: () => void): boolean {
  if (!canPause || el.classList.contains('on')) return false;
  el.classList.add('on');
  SFX.suspend();
  onOpen();
  return true;
}

export function closePause(el: HTMLDivElement): boolean {
  if (!el.classList.contains('on')) return false;
  el.classList.remove('on');
  SFX.resume();
  return true;
}
