// Touch + keyboard regression checks for the Walk view, at phone (iPhone 13, touch) and desktop sizes.
// Run from the repo root after `python3 tools/scene-graph-editor/build.py`:
//   node tools/scene-graph-editor/tests/walk-touch.mjs
// Needs Playwright with Chromium (a local or global install both work). Serves dist/ itself.
// Chromium's touch emulation can't reproduce iOS Safari's hover quirks, so a real phone pass is still needed.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
let pw; try { pw = await import('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const { chromium, devices } = pw;
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  const path = join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(await readFile(path)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const URL = `http://localhost:${server.address().port}/`;
const SHOTS = process.env.SHOTS;  // optional: a directory to save screenshots into
const browser = await chromium.launch();
const fail = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail.push(m); };
async function labelsInside(page) {
  return page.evaluate(() => { const s = document.querySelector('#stage').getBoundingClientRect();
    return [...document.querySelectorAll('#arrows .lb')].every(l => { const r = l.getBoundingClientRect(); return r.left >= s.left - 0.5 && r.right <= s.right + 0.5; }); });
}
const visiblePv = page => page.evaluate(() => [...document.querySelectorAll('.arrow .pv')].filter(p => getComputedStyle(p).display !== 'none').length);
// ---- phone, touch ----
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  ok(!(await page.evaluate(() => matchMedia('(hover:hover)').matches)), 'phone reports no hover');
  await page.tap('#tWalk'); await page.waitForTimeout(700);
  await page.tap('#arrows .arrow'); await page.waitForTimeout(2200);
  ok((await page.textContent('#hud')).startsWith('first-entry'), 'tap walks outside-entry -> first-entry');
  ok((await visiblePv(page)) === 0, 'no stray hover preview after tapping into first-entry');
  ok(await labelsInside(page), 'first-entry arrow labels stay inside the frame');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/touch-first-entry.png` });
  // jump to foh-wide and use keyboard-free inset list to reach a screen
  await page.evaluate(() => { cur = 'x32-top'; hist = [{ id: 'foh-wide', hotspot: G.edges.find(e => e.from === 'foh-wide' && e.to === 'x32-top').hotspot }]; show(cur); });
  await page.waitForTimeout(500);
  await page.tap('.look2[data-i="0"]'); await page.waitForTimeout(1500);
  ok((await page.textContent('#hud')).startsWith('x32-screen-1'), 'inset list opens x32-screen-1');
  ok(!(await page.$eval('#backBtn', b => b.hidden)), 'Back pill shows on a screen node');
  await page.tap('#backBtn'); await page.waitForTimeout(1500);
  ok((await page.textContent('#hud')).startsWith('x32-top'), 'Back pill returns from the screen to x32-top');
  ok(errs.length === 0, 'no page errors on phone: ' + errs.join('; '));
  await ctx.close();
}
// ---- desktop, mouse + keyboard ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('#tWalk'); await page.waitForTimeout(600);
  await page.hover('#arrows .arrow'); await page.waitForTimeout(200);
  ok((await visiblePv(page)) === 1, 'desktop hover still shows the preview');
  await page.evaluate(() => { cur = 'foh-wide'; hist = []; show(cur); }); await page.waitForTimeout(500);
  await page.mouse.move(5, 5);
  await page.keyboard.press('1'); await page.waitForTimeout(1300);
  const h = await page.evaluate(() => hist[hist.length - 1]);
  ok(!!(h && h.hotspot), 'key 1 at foh-wide uses the hotspot zoom (history has hotspot)');
  ok((await page.textContent('#hud')).startsWith('x32-top'), 'key 1 lands on x32-top');
  await page.keyboard.press('Backspace'); await page.waitForTimeout(1300);
  ok((await page.textContent('#hud')).startsWith('foh-wide'), 'Backspace returns to foh-wide');
  const unroutable = await page.evaluate(() => { const hubs = Object.keys(G.nodes).filter(id => G.nodes[id].kind === 'hub'), out = [];
    for (const a of hubs) for (const z of hubs) if (a !== z && !findRoutes(a, z, 1).length) out.push(a + ' -> ' + z); return out; });
  ok(unroutable.length === 0, 'Walk to... can route between every pair of hubs' + (unroutable.length ? ': missing ' + unroutable.slice(0, 5).join(', ') : ''));
  ok(errs.length === 0, 'no page errors on desktop: ' + errs.join('; '));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fail.length ? `${fail.length} FAILED` : 'ALL PASS');
process.exit(fail.length ? 1 : 0);
