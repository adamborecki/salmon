// End-to-end: the SUPER SECRET FINAL LEVEL on a phone: the gate (wrong, then right), the intro, and a whole
// fight played through the menus (FL-1 is a win, FL-16 a loss for this strategy). Reduced motion keeps it quick.
// Run from the repo root after `python3 tools/final-level/build.py`:  node tools/final-level/test/final.e2e.mjs
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
  const path = join(DIST, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(await readFile(path)); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;
let failures = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
const page = await ctx.newPage(); const errs = [];
// the real password stays out of this public repo: serve the page with a test password's hash instead
// (same gate code, different lock)
const TEST_PW = 'open-sesame', REAL = JSON.parse(await readFile(join(DIST, '..', 'content', 'final-battle.json'), 'utf8')).gate.password_sha256;
const testHash = (await import('node:crypto')).createHash('sha256').update(TEST_PW).digest('hex');
await ctx.route(/\/(index\.html)?(\?[^#]*)?$/, async route => {
  const r = await route.fetch(), body = (await r.text()).replace(REAL, testHash);
  await route.fulfill({ response: r, body, headers: { ...r.headers(), 'content-type': 'text/html' } });
});
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)\.com/.test(m.location().url || '')) errs.push(m.text()); });
const tap = async sel => { await page.tap(sel); await page.waitForTimeout(40); };

await page.goto(BASE + '#FL-1', { waitUntil: 'networkidle' });
ok(!(await page.$eval('#gate', e => e.hidden)) && /SUPER SECRET/.test(await page.textContent('h1')), 'the gate: SUPER SECRET FINAL LEVEL');
ok(/"password_sha256":"[0-9a-f]{64}"/.test(await page.content()) && !/"password"\s*:/.test(await page.content()), 'the page holds only a password hash');
await page.fill('#pw', 'adam'); await tap('#gateForm button');
await page.waitForFunction(() => /ACCESS DENIED/.test(document.querySelector('#no').textContent));
ok(await page.$eval('#intro', e => e.hidden), 'a wrong password: ACCESS DENIED');
await page.fill('#pw', TEST_PW.toUpperCase()); await tap('#gateForm button');
await page.waitForFunction(() => !document.querySelector('#intro').hidden);
ok(/Adam Borecki blocks the path/.test(await page.textContent('#crawl')), 'the right password (any case): the intro');
await tap('#fight');
ok(/ADAM BORECKI/.test(await page.textContent('#bossName')) && (await page.$('#boss svg')) !== null, 'the boss: Adam Borecki (a silhouette until there is a photo)');
await page.waitForFunction(() => [...document.querySelectorAll('.pm img')].every(i => i.complete && i.naturalWidth > 0));
ok((await page.$$eval('.pm b', b => b.map(x => x.textContent))).join() === 'CARY,MORGAN,MAGNOLIA', 'the party: Cary, Morgan, Magnolia, with portraits');

// the strategy, through the menus: revive with the spare mic, Cary heals when two are hurt, Magnolia gain-stages, else attack
async function fight() {
  for (let n = 0; n < 400; n++) {
    if (!(await page.$eval('#end', e => e.hidden))) return;
    if (await page.evaluate(() => window.__finalLevel.busy()) || await page.$eval('#menu', m => m.hidden)) { await page.waitForTimeout(60); continue; }
    const g = await page.evaluate(() => window.__finalLevel.state());
    const id = g.party.find(p => p.hp > 0 && !g.pending[p.id]).id, m = g.party.find(p => p.id === id);
    const low = g.party.filter(p => p.hp > 0 && p.hp < p.maxHp * .45), down = g.party.find(p => p.hp <= 0), pend = Object.values(g.pending);
    if (down && g.items.spare > 0 && !pend.some(c => c.item === 'spare')) { await tap('[data-c="item"]'); await tap('[data-x="spare"]'); await tap(`[data-t="${down.id}"]`); }
    else if (id === 'cary' && !m.silenced && low.length >= 2 && m.mp >= 8) { await tap('[data-c="skill"]'); await tap('[data-x="wii-shop"]'); }
    else if (id === 'magnolia' && !m.silenced && m.mp >= 12) { await tap('[data-c="skill"]'); await tap('[data-x="gain-staging"]'); }
    else await tap('[data-c="attack"]');
  }
}
await fight();
let end = await page.textContent('#end');
ok(/VICTORY!/.test(end) && /Adam Borecki is defeated/.test(end), 'FL-1: victory over Adam Borecki');
ok((await page.evaluate(() => window.__finalLevel.state().boss.hp)) === 0, 'the boss is at 0 HP');
ok((await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])).reduce((a, b) => a - b) <= 0, 'no sideways scroll');

await tap('#again');
ok(!(await page.$eval('#battle', e => e.hidden)) && (await page.$eval('#end', e => e.hidden)), 'FIGHT AGAIN starts a new fight');

// the unlock lasts for the browser session: a reload skips the password
await page.goto(BASE + '?again=1#FL-16', { waitUntil: 'networkidle' });   // a real reload, not just a hash change
ok(await page.$eval('#gate', e => e.hidden) && !(await page.$eval('#intro', e => e.hidden)), 'reload: already unlocked this session');
await tap('#fight'); await fight();
end = await page.textContent('#end');
ok(/GAME OVER/.test(end) && /Back to the battery-in check/.test(end), 'FL-16: this strategy loses, and the game says so');
ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
await browser.close(); server.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASS'); process.exit(failures ? 1 : 0);
