export async function runMenuSmoke(page, check) {
  const root = await page.evaluate(() => ({
    navVisible: !document.getElementById('mainMenuNav').hidden,
    pagesHidden: [...document.querySelectorAll('.menuPage')].every((node) => node.hidden),
    renderer: document.getElementById('menuRendererState').textContent,
  }));
  check(root.navVisible && root.pagesHidden, 'main menu opens at the four-entry command terminal');
  check(!root.renderer.includes('检测中'), 'menu background resolves WebGPU or its static fallback');
  await page.click('[data-menu-target="loadoutMenu"]');
  check(
    await page.evaluate(() => !document.getElementById('loadoutMenu').hidden),
    'weapon configuration opens as its own main-menu page'
  );
  await page.select('#attachmentWeapon', 'ak');
  await page.click('[data-attachment="optic:prism_2_5"]');
  const prism = await page.evaluate(() => ({
    selected: WEAPONS.find((w) => w.id === 'ak').attachments.optic,
    buttonOn: document.querySelector('[data-attachment="optic:prism_2_5"]').classList.contains('on'),
    status: document.getElementById('attachmentStatus').textContent,
  }));
  check(prism.selected === 'prism_2_5' && prism.buttonOn && prism.status.includes('2.5×'), 'clicking the 2.5x menu button visibly equips and persists the prism optic');
  await page.click('[data-attachment="optic:micro_dot"]');
  await page.click('#loadoutMenu .menuBack');
  await page.click('[data-menu-target="settingsMenu"]');
  await page.evaluate(() => {
    const set = (id, value) => {
      const input = document.getElementById(id);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('menuSensitivity', '1.35'); set('menuFov', '82'); set('menuVolume', '76');
  });
  const settings = await page.evaluate(() => ({
    sensitivity: SETTINGS.mouseSensitivity,
    fov: BASE_FOV,
    volume: localStorage.getItem('tf.masterVolume'),
  }));
  check(settings.sensitivity === 1.35 && settings.fov === 82, 'global sensitivity and FOV update live');
  check(settings.volume === '0.76', 'global volume persists through the shared audio master');
  await page.keyboard.press('Escape');
  await page.click('[data-menu-target="singleMenu"]');
  check(await page.evaluate(() => !document.getElementById('singleMenu').hidden), 'single-player entry owns the two existing maps');
  await page.keyboard.press('Escape');
  await page.click('[data-menu-target="campaignMenu"]');
  const campaignEntry = await page.evaluate(() => ({
    visible: !document.getElementById('campaignMenu').hidden,
    mission: document.getElementById('campaignLaunch')?.querySelector('.mn')?.textContent || '',
    hint: document.querySelector('#campaignMenu .hint')?.textContent || '',
  }));
  check(
    campaignEntry.visible && campaignEntry.mission.includes('鹰落') && campaignEntry.hint.includes('不提供连杀奖励'),
    'campaign entry is reachable from the shared main menu'
  );
  await page.keyboard.press('Escape');
  await page.click('[data-menu-target="singleMenu"]');
}
