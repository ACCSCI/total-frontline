import puppeteer from 'puppeteer-core';

const chrome = process.env.P0_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--enable-unsafe-webgpu', '--no-sandbox', '--window-size=1280,720'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const url = process.env.P0_URL || 'http://127.0.0.1:4173/';
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(
  () => !document.getElementById('loading') || document.getElementById('loading').hidden,
  { timeout: 60000 }
);
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 1500));
const state = await page.evaluate(() => ({
  objective: document.getElementById('objectiveText')?.textContent || '',
  radio: document.getElementById('radioLine')?.textContent || '',
  slotA: document.getElementById('p0SlotA')?.textContent || '',
  slotB: document.getElementById('p0SlotB')?.textContent || '',
  title: document.title,
}));
await browser.close();
const ok =
  /鹰落|苏醒|通讯|夜视|河谷/.test(`${state.objective}${state.radio}${state.title}`) &&
  state.slotA.includes('M4') &&
  state.slotB.includes('P-9');
console.log(JSON.stringify({ ok, ...state }));
if (!ok) process.exit(1);
