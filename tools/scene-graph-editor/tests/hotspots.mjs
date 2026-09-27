// Every closeup edge with a hotspot: tapping the polygon must land on the inset, and the Back pill
// must return to the parent, at phone (touch) and desktop sizes, with no page errors.
// Run from the repo root after build.py:  node tools/scene-graph-editor/tests/hotspots.mjs
// Optional: SHOTS=<dir> saves a mid-zoom frame per hotspot (useful for eyeballing the grow origin).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
let pw; try { pw = await import('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const { chromium, devices } = pw;
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const server = createServer(async (req, res) => {
  const path = join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  try { res.writeHead(200, { 'content-type': { '.html': 'text/html', '.jpg': 'image/jpeg' }[extname(path)] || 'application/octet-stream' }); res.end(await readFile(path)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const URL = `http://localhost:${server.address().port}/`;
const SHOTS = process.env.SHOTS;
const browser = await chromium.launch();
let failures = 0;
for (const [name, opts, touch] of [['phone', { ...devices['iPhone 13'] }, true], ['desktop', { viewport: { width: 1280, height: 800 } }, false]]) {
  const ctx = await browser.newContext(opts); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await (touch ? page.tap('#tWalk') : page.click('#tWalk')); await page.waitForTimeout(400);
  const edges = await page.evaluate(() => G.edges.filter(e => e.kind === 'closeup' && e.hotspot && e.hotspot.length >= 3).map(e => [e.from, e.to]));
  for (const [from, to] of edges) {
    await page.evaluate(f => { cur = f; hist = []; show(cur); }, from); await page.waitForTimeout(350);
    const sel = `#hotspots polygon.hot[aria-label="${to}"]`;
    // find a point that really hits this polygon (centroid first), and measure how much of it other
    // overlays (arrow icons) cover at this size: coverage is a layout warning, not a broken hotspot
    const { pt, cover } = await page.evaluate(s => {
      const p = document.querySelector(s), pts = [...p.points], r = p.ownerSVGElement.getBoundingClientRect();
      const inside = (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
      const at = (x, y) => ({ x: r.left + x / 100 * r.width, y: r.top + y / 100 * r.height });
      const hits = (x, y) => { const q = at(x, y); return document.elementFromPoint(q.x, q.y) === p; };
      const cx = pts.reduce((t, q) => t + q.x, 0) / pts.length, cy = pts.reduce((t, q) => t + q.y, 0) / pts.length;
      let n = 0, free = [];
      for (let x = 0; x <= 100; x++) for (let y = 0; y <= 100; y++) if (inside(x, y)) { n++; if (hits(x, y)) free.push([x, y]); }
      free.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
      const best = hits(cx, cy) ? [cx, cy] : free[0];
      return { pt: best ? at(best[0], best[1]) : null, cover: n ? Math.round(100 * (n - free.length) / n) : 100 };
    }, sel);
    const hit = !!pt;
    if (!hit) { failures++; console.log(`FAIL ${name} ${from} -> ${to} (no tappable point: fully covered)`); continue; }
    await (touch ? page.touchscreen.tap(pt.x, pt.y) : page.mouse.click(pt.x, pt.y));
    if (SHOTS) { await page.waitForTimeout(320); await page.screenshot({ path: `${SHOTS}/${name}-${from}--${to}.png` }); }
    await page.waitForTimeout(1100);
    const landed = (await page.textContent('#hud')).startsWith(to);
    const pill = !(await page.$eval('#backBtn', b => b.hidden));
    if (pill) { await (touch ? page.tap('#backBtn') : page.click('#backBtn')); await page.waitForTimeout(1100); }
    const back = (await page.textContent('#hud')).startsWith(from);
    const good = landed && pill && back;
    if (!good) failures++;
    console.log(`${good ? 'PASS' : 'FAIL'} ${name} ${from} -> ${to}` + (good ? '' : ` (landed: ${landed}, back pill: ${pill}, returned: ${back})`) + (cover >= 15 ? `  [WARN ${cover}% of it is covered by other overlays at this size]` : ''));
  }
  if (errs.length) { failures++; console.log(`FAIL ${name} page errors: ${errs.join('; ')}`); }
  await ctx.close();
}
await browser.close(); server.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASS');
process.exit(failures ? 1 : 0);
