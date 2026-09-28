// End-to-end: play the battery-in check on a phone-sized touch screen by tapping the photo and buttons
// like a player would: three mics by hand (one of them the muted one), then "Check the rest".
// Run from the repo root after `python3 tools/gameplay-slice/build.py`:
//   node tools/gameplay-slice/test/harness.e2e.mjs            (SHOTS=<dir> saves screenshots)
// Needs Playwright with Chromium (local or global install). Serves dist/ itself.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
let pw; try { pw = await import('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const { chromium, devices } = pw;
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  const path = join(DIST, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(await readFile(path)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/local.html`;
const SHOTS = process.env.SHOTS;
let failures = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)\.com/.test(m.location().url || '')) errs.push(m.text()); });
await page.goto(BASE + '#VJ-48217', { waitUntil: 'networkidle' });
const shot = async n => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/slice-${n}.png`, fullPage: true }); };
const tapHot = async label => { await page.tap(`#hot polygon[aria-label="${label}"]`); await page.waitForTimeout(250); };
const tapBack = async () => { await page.tap('#back'); await page.waitForTimeout(250); };
const tap = async sel => { await page.tap(sel); await page.waitForTimeout(150); };
const where = () => page.textContent('#where');
const chip = ch => page.$eval(`.chips .chip[data-ch="${ch}"]`, c => c.dataset.s);
const inSlot = (id, act) => `.handslot[data-id="${id}"] [data-act="${act}"]`;
const stepsDone = () => page.$$eval('#steps li', ls => ls.filter(l => l.classList.contains('done')).map(l => l.dataset.step));
const fault = await page.evaluate(() => document.querySelector('#dbg').textContent.match(/fault: (handheld-\d\d)/)[1]);
const faultCh = +fault.slice(-2);
ok(faultCh === 2 || faultCh === 3, `seed VJ-48217 from the link mutes ch ${faultCh} (always 2 or 3)`);
ok((await page.$$eval('.chips .chip', c => c.length)) === 16, 'objective shows 16 channels');
ok(/Next: Mic 1 \(black \/ red\)/.test(await page.textContent('#steps .now')), 'step list starts at Mic 1 (black / red)');
ok(await page.$eval('#skipBtn', b => b.disabled), 'Check the rest is not offered yet');
ok(!/not simulated yet/.test(await page.textContent('#steps')), 'every step is simulated now (batteries included)');
await shot('1-start');

for (let ch = 1; ch <= 3; ch++) {
  const id = 'handheld-0' + ch;
  await tapHot('Mic cabinet'); ok((await where()) === 'Mic cabinet', `CH ${ch}: hotspot to the mic cabinet`);
  await tapHot('Mic drawer'); ok((await where()) === 'Mic drawer', `CH ${ch}: hotspot into the mic drawer`);
  ok((await page.$$eval('.drawer .slot[data-id] svg.mic', s => s.length)) === 17 - ch, `CH ${ch}: ${17 - ch} mics drawn in the drawer`);
  const cells = +(await page.textContent('#panel')).match(/(\d+) charged cells/)[1];
  ok(cells === 32 - 2 * (ch - 1), `CH ${ch}: charger shows ${cells} cells`);
  if (ch === 1) await shot('2-drawer');
  await tap(`.slot[data-id="${id}"]`);
  ok((await stepsDone()).join() === 'take', `CH ${ch}: took it`);
  await tap(inSlot(id, 'batteries'));
  ok((await stepsDone()).join() === 'take,batteries', `CH ${ch}: batteries in`);
  await tap(inSlot(id, 'hold'));
  if (ch === faultCh) {
    ok(/does not switch on/.test(await page.textContent('#toast')), `CH ${ch}: it does not switch on (NOTICE)`);
    ok((await stepsDone()).join() === 'take,batteries', `CH ${ch}: not on`);
    await shot('3-fault');
    await tap(inSlot(id, 'checkbat'));
    ok(/wrong way round/.test(await page.textContent('#toast')), `CH ${ch}: the batteries are the wrong way round (TRACE)`);
    await tap(inSlot(id, 'reseat')); await tap(inSlot(id, 'hold'));                             // ACT
  }
  ok((await stepsDone()).join() === 'take,batteries,power', `CH ${ch}: switched on`);
  await tap(inSlot(id, 'read'));
  const lcd = await page.$eval('.lcdbox svg', s => s.getAttribute('aria-label'));
  ok(/group [1-6], channel [1-6]/.test(lcd) && !lcd.includes('muted'), `CH ${ch}: display reads "${lcd}"`);
  await tapBack(); await tapBack();
  await tapHot('X32'); ok((await where()) === 'X32', `CH ${ch}: at the X32 with the mic`);
  await tap(`.talkHere[data-id="${id}"]`);                                                    // VERIFY
  ok((await chip(ch)) === 'verified', `CH ${ch}: verified after talking at the X32`);
  ok(await page.$eval(`.strip[data-point="foh-x32:in:${ch}"] i`, i => i.getAnimations().length > 0), `CH ${ch}: its X32 meter animates`);
  ok((await stepsDone()).join() === 'take,batteries,power,talk', `CH ${ch}: steps 1-4 ticked`);
  await tap(inSlot(id, 'chair'));
  ok(await page.$(`#chair button[data-id="${id}"][data-s="verified"]`) !== null, `CH ${ch}: on the chair left of FOH, verified`);
  await tapBack(); ok((await where()) === 'FOH', `CH ${ch}: back at FOH`);
}
// the receivers show each slot's RF group/channel
await tapHot('Wireless rack'); await tapHot('Receivers');
ok((await page.$$eval('.strip .rf', r => r.filter(x => /^[1-6]·[1-6]$/.test(x.textContent)).length)) === 16, 'receivers: 16 RF group·channel labels');
await tapBack(); await tapBack();
ok(/Next: Mic 4/.test(await page.textContent('#steps .now')), 'step list moves on to Mic 4');
// two mics in hand (owner: allowed), then both back in the drawer
await tapHot('Mic cabinet'); await tapHot('Mic drawer');
await tap('.slot[data-id="handheld-04"]'); await tap('.slot[data-id="handheld-05"]');
ok((await page.$$eval('.handslot.full', s => s.map(x => x.dataset.id))).join() === 'handheld-04,handheld-05', 'two mics in hand, one per slot');
ok(await page.$eval('#skipBtn', b => b.disabled), 'Check the rest waits while your hands are full');
await tap('.slot[data-id="handheld-06"]');
ok(/hands are full/.test(await page.textContent('#toast')), 'a third mic is refused');
await tap(inSlot('handheld-04', 'drawer')); await tap(inSlot('handheld-05', 'drawer'));
await tapBack(); await tapBack();
ok(!(await page.$eval('#skipBtn', b => b.disabled)), 'Check the rest is offered after 3 by hand');
await shot('4-skip-offered');
await tap('#skipBtn');
await page.waitForTimeout(1600);
ok((await page.$$eval('.chips .chip[data-s="verified"]', c => c.length)) === 16, 'Check the rest verifies the other 13');
ok((await page.$$eval('#chair button', b => b.length)) === 16, 'all 16 on the chair');
ok(!(await page.$eval('#sheet', s => s.hidden)), 'debrief opens when every mic is verified');
const lines = await page.$$eval('#dbList li', ls => ls.map(l => l.textContent));
ok(/Ready: all 16 mics verified/.test(lines[0]), 'debrief: ready');
for (const step of ['NOTICE ✓', 'TRACE ✓', 'ACT ✓', 'VERIFY ✓']) ok(lines.some(l => l.startsWith(step)), `debrief: ${step}`);
ok(lines.some(l => /3 mics checked by hand, 13 by Check the rest\. All on the chair\./.test(l)), 'debrief: 3 by hand, 13 by Check the rest');
await shot('5-debrief');
ok((await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])).reduce((a, b) => a - b) <= 0, 'no sideways scroll at phone width');
ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
await browser.close(); server.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASS'); process.exit(failures ? 1 : 0);
