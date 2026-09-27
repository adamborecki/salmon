// End-to-end: play the slice on a phone-sized touch screen by tapping the photo and buttons like a
// player would. Run from the repo root after `python3 tools/gameplay-slice/build.py`:
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
const where = () => page.textContent('#where');
const chip = ch => page.$eval(`.chips .chip:nth-child(${ch}) span`, s => s.textContent);
const fault = await page.evaluate(() => document.querySelector('#dbg').textContent.match(/fault: (handheld-0\d)/)[1]);
const faultCh = +fault.slice(-1);
ok(fault === 'handheld-04', `seed VJ-48217 from the link picks ${fault}`);
ok((await page.$$eval('.chips .chip', c => c.length)) === 4, 'objective shows four channels');
await shot('1-start');

// the drawer: FOH -> Mic cabinet -> Mic drawer, all by tapping hotspots on the photo
await tapHot('Mic cabinet'); ok((await where()) === 'Mic cabinet', 'hotspot to the mic cabinet');
await tapHot('Mic drawer'); ok((await where()) === 'Mic drawer', 'hotspot into the mic drawer');
for (let ch = 1; ch <= 4; ch++) {
  await page.tap(`.mic[data-id="handheld-0${ch}"]`); await page.waitForTimeout(100);
  await tapBack(); await tapBack();                          // back out to FOH
  await tapHot('X32'); ok((await where()) === 'X32', `CH ${ch}: at the X32 with the mic`);
  await page.tap('#talkHere'); await page.waitForTimeout(200);
  if (ch === 1) await shot('2-talk-at-x32');
  if (ch !== faultCh) {
    ok((await chip(ch)) === 'verified', `CH ${ch}: verified after talking at the X32`);
    ok(await page.$eval(`.strip[data-point="foh-x32:in:${ch}"] i`, i => i.getAnimations().length > 0), `CH ${ch}: its X32 meter animates`);
  }
  else {
    ok((await chip(ch)) === 'no signal', `CH ${ch}: no signal (NOTICE)`);
    ok(await page.$eval(`.strip[data-point="foh-x32:in:${ch}"]`, s => s.classList.contains('dead')), `CH ${ch}: its X32 strip flags no signal`);
    await tapBack(); await tapHot('Wireless rack'); await tapHot('Receivers');
    await page.tap('#talkHere'); await page.waitForTimeout(200);
    ok((await page.textContent('#dbg')).length > 0 && (await chip(ch)) === 'no signal', `CH ${ch}: dead at the receiver too (TRACE)`);
    await page.tap('#inspectBtn'); await page.waitForTimeout(100);
    ok(/muted/.test(await page.textContent('#toast')), `CH ${ch}: inspecting shows it is muted`);
    await page.tap('#tapBtn'); await page.waitForTimeout(100);                                   // ACT
    ok((await chip(ch)) !== 'verified', `CH ${ch}: unmuting alone does not verify it`);
    await tapBack(); await tapBack(); await tapHot('X32');
    await page.tap('#talkHere'); await page.waitForTimeout(200);                                 // VERIFY
    ok((await chip(ch)) === 'verified', `CH ${ch}: verified after talking at the X32 again`);
  }
  await tapBack(); await tapHot('Mic cabinet'); await tapHot('Mic drawer');
  await page.tap(`.mic[data-id="handheld-0${ch}"]`); await page.waitForTimeout(100);        // put it back
}
await page.waitForTimeout(1600);
ok(!(await page.$eval('#sheet', s => s.hidden)), 'debrief opens when every mic is verified');
const lines = await page.$$eval('#dbList li', ls => ls.map(l => l.textContent));
ok(/Ready: all 4 mics verified/.test(lines[0]), 'debrief: ready');
for (const step of ['NOTICE ✓', 'TRACE ✓', 'ACT ✓', 'VERIFY ✓']) ok(lines.some(l => l.startsWith(step)), `debrief: ${step}`);
await shot('3-debrief');
ok((await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])).reduce((a, b) => a - b) <= 0, 'no sideways scroll at phone width');
ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
await browser.close(); server.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASS'); process.exit(failures ? 1 : 0);
