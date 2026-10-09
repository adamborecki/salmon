// End-to-end check of the public site at phone size. Run after `python3 tools/public-site/build.py`:
//   node tools/public-site/test/site.e2e.mjs            (SHOTS=<dir> saves screenshots)
// Serves tools/public-site/dist/ under /salmon/, like GitHub Pages does, so relative links are tested.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
let pw; try { pw = await import('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const { chromium, devices } = pw;
const HERE = dirname(fileURLToPath(import.meta.url)), DIST = join(HERE, '..', 'dist'), ROOT = join(HERE, '..', '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (!p.startsWith('/salmon/')) { res.writeHead(404); return res.end(); }
  const dir = p.endsWith('/'); p = join(DIST, p.slice('/salmon/'.length)); if (dir) p = join(p, 'index.html');
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/salmon/`;
const SHOTS = process.env.SHOTS;
let failures = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
const page = await ctx.newPage(); const errs = [], missing = [];
page.on('pageerror', e => errs.push(e.message));
page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) missing.push(r.url().slice(BASE.length)); });
const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const imgsLoaded = () => page.$$eval('img', is => is.every(i => i.complete && i.naturalWidth > 0));

// landing page
await page.goto(BASE, { waitUntil: 'networkidle' });
ok((await page.title()) === 'Salmon Simulator', 'landing: title');
ok(/Under construction/i.test(await page.textContent('.tape')), 'landing: under construction');
ok(await imgsLoaded(), 'landing: every image loads');
const stats = (await page.$$eval('.stats span', ss => ss.map(x => x.textContent))).join(' · ');
ok(/^\d+ scenes · \d+ links · \d+ equipment close-ups$/.test(stats), 'landing: counts filled in: ' + stats);
ok(!/__[A-Z]+__/.test(await page.content()), 'landing: no unfilled placeholders');
ok(await noSideScroll(), 'landing: no sideways scroll at phone width');
if (SHOTS) await page.screenshot({ path: `${SHOTS}/site-1-landing.png`, fullPage: true });

// walk around (public editor)
await page.tap('a.way[href="walk/"]'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
ok(page.url() === BASE + 'walk/', 'walk: link works under /salmon/');
ok(/public preview/.test(await page.textContent('#status')), 'walk: says edits are not saved');
ok((await page.getAttribute('#tWalk', 'aria-pressed')) === 'true', 'walk: opens in the Walk tab');
ok(await page.isVisible('#home') && await page.isVisible('#export'), 'walk: Home and Export JSON are shown');
if (SHOTS) await page.screenshot({ path: `${SHOTS}/site-2-walk.png` });
const [dl] = await Promise.all([page.waitForEvent('download'), page.tap('#export')]);
const exported = JSON.parse(readFileSync(await dl.path(), 'utf8'));
const repo = JSON.parse(readFileSync(join(ROOT, 'docs', 'scene-graph.json'), 'utf8'));
ok(/^salmon-scene-graph-\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()), 'walk: export file name ' + dl.suggestedFilename());
ok(JSON.stringify({ nodes: exported.nodes, edges: exported.edges }) === JSON.stringify({ nodes: repo.nodes, edges: repo.edges }), 'walk: unedited export = the repo graph');
await Promise.all([page.waitForURL(BASE, { timeout: 5000 }).catch(() => {}), page.tap('#home')]);
ok(page.url() === BASE, 'walk: Home goes back to the landing page');

// the game
await page.tap('a.way[href="battery-check/"]'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(400);
ok((await page.$$eval('.chips .chip', c => c.length)) === 16, 'battery check: loads with 16 channels');
ok(await imgsLoaded(), 'battery check: photo loads');
ok(await noSideScroll(), 'battery check: no sideways scroll');

// the SUPER SECRET FINAL LEVEL: linked from the landing page, behind its gate
await page.goto(BASE, { waitUntil: 'networkidle' });
ok(/SUPER SECRET FINAL LEVEL/.test(await page.textContent('a.way[href="final/"]')), 'landing: the secret card');
await Promise.all([page.waitForURL(/\/final\/$/), page.tap('a.way[href="final/"]')]); await page.waitForLoadState('networkidle');
ok(!(await page.$eval('#gate', e => e.hidden)) && /"password_sha256":"[0-9a-f]{64}"/.test(await page.content()), 'final level: the gate (only a password hash in the page)');
ok(await noSideScroll(), 'final level: no sideways scroll');

// the upstairs signal flow: linked from the landing page
await page.goto(BASE, { waitUntil: 'networkidle' });
ok(/Upstairs signal flow/.test(await page.textContent('a.way[href="upstairs/"]')), 'landing: the upstairs card');
await Promise.all([page.waitForURL(/\/upstairs\/$/), page.tap('a.way[href="upstairs/"]')]); await page.waitForLoadState('networkidle');
ok((await page.$$eval('#svg .node', n => n.length)) > 10, 'upstairs: the diagram draws');
ok(await noSideScroll(), 'upstairs: no sideways scroll');
await Promise.all([page.waitForURL(BASE, { timeout: 5000 }).catch(() => {}), page.tap('.top a')]);
ok(page.url() === BASE, 'upstairs: the back link goes to the landing page');

// anonymized photos are what is served (differs from a plain build of the original, where one exists)
for (const f of ['walk/p/outside-entry.jpg', 'walk/p/foh-wide.jpg', 'battery-check/p/foh-wide.jpg']) {
  const plain = join(ROOT, 'tools', f.startsWith('walk') ? 'scene-graph-editor' : 'gameplay-slice', 'dist', f.replace(/^[^/]+\//, ''));
  if (existsSync(plain)) ok(!readFileSync(join(DIST, f)).equals(readFileSync(plain)), `${f}: anonymized copy, not the original`);
}
ok(!existsSync(join(DIST, 'work')), 'nothing but the site is published');
ok(missing.length === 0, 'no missing files: ' + missing.join(', '));
ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
await browser.close(); server.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASS'); process.exit(failures ? 1 : 0);
