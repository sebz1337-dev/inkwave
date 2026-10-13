// INKWAVE character sheet — sweep one style slot through the character lab and screenshot every frame.
//
// The face/hair art passes are judged on images, and one browser + N frames beats N browser launches: this opens
// tools/character-lab.html once, drives `window.lab.go({style})` per option, and writes one PNG per option.
//
// usage: node tools/char-sheet.mjs [--slot hair] [--from 0] [--to 7] [--cam face] [--lod hero]
//                                  [--url http://localhost:8490] [--out /tmp/inkwave-sheet] [--w 640] [--h 640]
// Prints the option names it rendered and one output path per line, in slot order.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const base = opt('url', 'http://localhost:8490').replace(/\/$/, '');
const out = opt('out', '/tmp/inkwave-sheet');
const slot = opt('slot', 'hair');
const cam = opt('cam', 'face');
const lod = opt('lod', 'hero');
const W = +opt('w', 640), H = +opt('h', 640);
const from = +opt('from', 0);
const to = opt('to', null);

mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });

await page.goto(`${base}/tools/character-lab.html?ui=0`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.lab && window.lab.hero', { timeout: 60000 });

const names = await page.evaluate(async (s) => {
  const M = await import('/src/game/character-style.js');
  const t = M.SLOT_NAMES[s];
  return t ? t.slice() : null;
}, slot);
if (!names) { console.log(`unknown slot '${slot}' — SLOT_NAMES has: hair, skin, outfit, eyes, hat, brows`); await browser.close(); process.exit(2); }

const last = to == null ? names.length - 1 : Math.min(+to, names.length - 1);
console.log(`${slot}: ${names.length} options (${names.join(' · ')})`);
const lodArg = lod ? `lod: ${JSON.stringify(lod)}` : 'lod: null';
for (let i = from; i <= last; i++) {
  await page.evaluate(`window.lab.go({ style: { ${slot}: ${i} }, cam: ${JSON.stringify(cam)}, t: 0.6, ${lodArg} })`);
  await new Promise((r) => setTimeout(r, 260));   // let the frame + wash settle (lab.go renders synchronously)
  const p = `${out}/${slot}-${String(i).padStart(2, '0')}.png`;
  await page.screenshot({ path: p });
  console.log(`${p}  ${names[i] || ''}`);
}
await browser.close();
process.exit(0);
