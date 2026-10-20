// End-to-end: the showcase signal-flow page at phone size. Run from the repo root after
// `python3 tools/showcase/build.py`:  node tools/showcase/test/showcase.e2e.mjs   (SHOTS=<dir> saves screenshots)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
let pw; try { pw = await import('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const { chromium, devices } = pw;
const HERE = dirname(fileURLToPath(import.meta.url)), DIST = join(HERE, '..', 'dist');
const C = JSON.parse(await readFile(join(HERE, '..', 'content', 'showcase.json'), 'utf8'));
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
  ok((await page.title()) === 'Showcase Signal Flow', `${tag} title`);
  ok(await page.$$eval('#svg .node', n => n.length) === C.devices.length, `${tag} every device is drawn (${C.devices.length})`);
  ok(await page.$$eval('#svg .link', n => n.length) === C.links.length, `${tag} every link is drawn (${C.links.length})`);
  ok(!(await page.content()).includes('__DATA__'), `${tag} content inlined`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${tag} no sideways scroll`);
  // nothing in a box spills out of it
  const spill = await page.$$eval('#svg .node', ns => ns.flatMap(g => { const r = g.querySelector('rect.box').getBBox();
    return [...g.querySelectorAll('text.name,text.sub')].filter(t => { const b = t.getBBox(); return b.x < r.x || b.x + b.width > r.x + r.width + .5; }).map(t => t.textContent); }));
  ok(spill.length === 0, `${tag} all text fits its box ${spill.join(', ')}`);
  if (SHOTS) await page.locator('.diagram').screenshot({ path: `${SHOTS}/showcase-${scheme}.png` });
  if (scheme === 'dark') { ok(errs.length === 0, `${tag} no page errors ${errs.join('; ')}`); await ctx.close(); continue; }

  // tap a device: the sheet shows its notes with sources, and its connections
  await page.tap('#svg .node[data-id="sd8"]');
  ok(!(await page.$eval('#sheet', e => e.hidden)) && (await page.textContent('#dTitle')) === 'Behringer SD8', 'tap the SD8: the detail sheet opens');
  ok((await page.$$eval('#dNotes li', l => l.length)) === C.devices.find(d => d.id === 'sd8').notes.length, 'the SD8: every note is listed');
  ok(/debrief/.test(await page.textContent('#dNotes')), 'the SD8: notes cite their source');
  ok(await page.$$eval('#svg.dim .link.on', l => l.length) === C.links.filter(l => l.from === 'sd8' || l.to === 'sd8').length, 'the SD8: its links are highlighted');
  // follow a connection to the link, then to the other end
  await page.tap('#dConns button >> text=Performer feed');
  ok(/Behringer SD8 → Performer feed/.test(await page.textContent('#dTitle')), 'a connection opens the link');
  ok(/failed/.test(await page.textContent('#dSub')), 'the broken link says so');
  await page.tap('#dConns button >> nth=1');
  ok((await page.textContent('#dTitle')) === 'Performer feed', 'the link opens its other end');
  await page.tap('#dClose');
  ok(await page.$eval('#sheet', e => e.hidden) && !(await page.$eval('#svg', s => s.classList.contains('dim'))), 'close: back to everything');

  // a path highlights exactly its links, plus any boxes it names
  const whale = C.paths.find(p => p.name === '3 Electrostatic Whale');
  await page.tap('#pathbar button >> text=3 Electrostatic Whale');
  const on = await page.$$eval('#svg .link.on', l => l.map(x => x.dataset.id).sort());
  ok(JSON.stringify(on) === JSON.stringify([...whale.links].sort()), 'Electrostatic Whale path: ' + on.join(', '));
  ok((await page.textContent('#pathnote')) === whale.text, 'the path is explained');
  await page.tap('#pathbar button >> text=1 Integrations');
  ok(await page.$eval('#svg .node[data-id="rearproj"]', n => n.classList.contains('on')), 'Integrations lights the screen too');
  if (SHOTS) await page.locator('.diagram').screenshot({ path: `${SHOTS}/showcase-whale.png` });

  // the lists
  ok(await page.$$eval('#paths .card', l => l.length) === C.paths.length, 'every piece has a card');
  ok(await page.$$eval('#questions li', l => l.length) === C.questions.length, 'every open question is listed');
  await page.tap('#questions li >> nth=0 >> button');
  ok((await page.textContent('#dTitle')) === 'Performer feed', 'a question links to its device');
  await page.tap('#dClose');
  ok(await page.$$eval('#lessons .card', l => l.length) === C.lessons.length, 'the lessons are listed');
  for (const img of await page.$$('#photos img')) await img.scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  ok(await page.$$eval('#photos img', is => is.length && is.every(i => i.complete && i.naturalWidth > 0)), 'every photo loads');
  ok(missing.length === 0, 'no missing files ' + missing.join(', '));
  ok(errs.length === 0, `${tag} no page errors ${errs.join('; ')}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/showcase-page.png`, fullPage: true });
  await ctx.close();
}
await browser.close(); server.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASS'); process.exit(failures ? 1 : 0);
