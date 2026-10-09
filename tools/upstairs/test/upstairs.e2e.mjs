// End-to-end: the upstairs signal-flow page at phone size. Run from the repo root after
// `python3 tools/upstairs/build.py`:  node tools/upstairs/test/upstairs.e2e.mjs   (SHOTS=<dir> saves screenshots)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
let pw; try { pw = await import('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const { chromium, devices } = pw;
const HERE = dirname(fileURLToPath(import.meta.url)), DIST = join(HERE, '..', 'dist');
const C = JSON.parse(await readFile(join(HERE, '..', 'content', 'upstairs.json'), 'utf8'));
const TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  const path = join(DIST, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(await readFile(path)); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`, SHOTS = process.env.SHOTS;
let failures = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };
const browser = await chromium.launch();

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: scheme, reducedMotion: 'reduce' });
  const page = await ctx.newPage(); const errs = [], missing = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) missing.push(r.url().slice(BASE.length)); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const tag = `[${scheme}]`;
  ok((await page.title()) === 'Upstairs Signal Flow', `${tag} title`);
  ok(await page.$$eval('#svg .node', n => n.length) === C.devices.length, `${tag} every device is drawn (${C.devices.length})`);
  ok(await page.$$eval('#svg .link', n => n.length) === C.links.length, `${tag} every link is drawn (${C.links.length})`);
  ok(!(await page.content()).includes('__DATA__'), `${tag} content inlined`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${tag} no sideways scroll`);
  // nothing in a box spills out of it
  const spill = await page.$$eval('#svg .node', ns => ns.flatMap(g => { const r = g.querySelector('rect.box').getBBox();
    return [...g.querySelectorAll('text.name,text.sub')].filter(t => { const b = t.getBBox(); return b.x < r.x || b.x + b.width > r.x + r.width + .5; }).map(t => t.textContent); }));
  ok(spill.length === 0, `${tag} all text fits its box ${spill.join(', ')}`);
  if (SHOTS) await page.locator('.diagram').screenshot({ path: `${SHOTS}/upstairs-${scheme}.png` });
  if (scheme === 'dark') { ok(errs.length === 0, `${tag} no page errors ${errs.join('; ')}`); await ctx.close(); continue; }

  // tap a device: the sheet shows its notes with sources, and its connections
  await page.tap('#svg .node[data-id="tio"]');
  ok(!(await page.$eval('#sheet', e => e.hidden)) && (await page.textContent('#dTitle')) === 'Yamaha Tio1608-D', 'tap the Tio: the detail sheet opens');
  ok((await page.$$eval('#dNotes li', l => l.length)) === C.devices.find(d => d.id === 'tio').notes.length, 'the Tio: every note is listed');
  ok(/Dante Controller screenshot/.test(await page.textContent('#dNotes')), 'the Tio: notes cite their source');
  ok(await page.$$eval('#svg.dim .link.on', l => l.length) === C.links.filter(l => l.from === 'tio' || l.to === 'tio').length, 'the Tio: its links are highlighted');
  // follow a connection to the link, then to the other end
  await page.tap('#dConns button >> text=ATEM Production Studio 4K');
  ok(/Tio1608-D → ATEM Production Studio 4K/.test(await page.textContent('#dTitle')), 'a connection opens the link');
  await page.tap('#dConns button >> nth=1');
  ok((await page.textContent('#dTitle')) === 'ATEM Production Studio 4K', 'the link opens its other end');
  await page.tap('#dClose');
  ok(await page.$eval('#sheet', e => e.hidden) && !(await page.$eval('#svg', s => s.classList.contains('dim'))), 'close: back to everything');

  // a path highlights exactly its links
  const live = C.paths.find(p => p.name === 'Livestream');
  await page.tap('#pathbar button >> text=Livestream');
  const on = await page.$$eval('#svg .link.on', l => l.map(x => x.dataset.id).sort());
  ok(JSON.stringify(on) === JSON.stringify([...live.links].sort()), 'Livestream path: ' + on.join(', '));
  ok((await page.textContent('#pathnote')) === live.text, 'the path is explained');
  if (SHOTS) await page.locator('.diagram').screenshot({ path: `${SHOTS}/upstairs-livestream.png` });

  // the lists
  ok(await page.$$eval('#questions li', l => l.length) === C.questions.length, 'every open question is listed');
  await page.tap('#questions li >> nth=0 >> button');
  ok((await page.textContent('#dTitle')) === 'Zoom F8', 'a question links to its device');
  await page.tap('#dClose');
  ok(await page.$$eval('#dante .card', l => l.length) === C.dante_devices.length, 'the Dante devices are listed');
  for (const img of await page.$$('#photos img')) await img.scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  ok(await page.$$eval('#photos img', is => is.length && is.every(i => i.complete && i.naturalWidth > 0)), 'every photo loads');
  ok(missing.length === 0, 'no missing files ' + missing.join(', '));
  ok(errs.length === 0, `${tag} no page errors ${errs.join('; ')}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/upstairs-page.png`, fullPage: true });
  await ctx.close();
}
await browser.close(); server.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASS'); process.exit(failures ? 1 : 0);
