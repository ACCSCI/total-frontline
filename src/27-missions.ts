'use strict';
/* Campaign slots are empty. Skirmish maps stay deathmatch-only. */
const CAMPAIGN_MISSIONS = [];

function setMissionHud(text) {
  const el = UI.missionObj;
  if (!el) return;
  if (!text) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  if (el.textContent !== text) el.textContent = text;
}

function clearMission() {
  G.mode = 'skirmish';
  G.mission = null;
  document.body.classList.remove('campaign');
  setMissionHud('');
}

function clearCampaign() {
  clearMission();
}

function restartMission() {
  return false;
}

function tickMission(_dt) {}
