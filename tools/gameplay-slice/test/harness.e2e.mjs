// End-to-end: play the battery-in check on a phone-sized touch screen by tapping the photo and buttons
// like a player would: the title card, three mics by hand (one with reversed batteries), then "Check the rest",
// which stops on the unpaired mic.
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
let page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)\.com/.test(m.location().url || '')) errs.push(m.text()); });
await page.goto(BASE + '#VJ-48217', { waitUntil: 'networkidle' });
const shot = async n => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/slice-${n}.png`, fullPage: true }); };
const tapHot = async label => { await page.tap(`#hot polygon[aria-label="${label}"]`); await page.waitForTimeout(250); };
const tapBack = async () => { await page.tap('#back'); await page.waitForTimeout(250); };
const tap = async sel => { await page.tap(sel); await page.waitForTimeout(150); };
const where = () => page.textContent('#where');
const chip = ch => page.$eval(`.chips .chip[data-ch="${ch}"]`, c => c.dataset.s);
const inSlot = (id, act) => `.handslot[data-id="${id}"] [data-act="${act}"]`;
// with two mics in hand the dock shows one at a time: pick its tab first
const tapIn = async (id, act) => { if (await page.$(`.htab[data-id="${id}"]`)) await tap(`.htab[data-id="${id}"]`); await tap(inSlot(id, act)); };
const stepsDone = () => page.$$eval('#steps li', ls => ls.filter(l => l.classList.contains('done')).map(l => l.dataset.step));
// the title card: the bad news, then Cary, Morgan and Magnolia
ok(!(await page.$eval('#intro', e => e.hidden)), 'title card opens on arrival');
ok(/OH NO!/.test(await page.textContent('#intro1')) && /10 minutes/.test(await page.textContent('#intro1 em')), 'title card: OH NO, 10 minutes');
await shot('0-title');
await tap('#introNext');
await page.waitForFunction(() => [...document.querySelectorAll('.crew img')].every(i => i.complete && i.naturalWidth > 0));
ok((await page.$$eval('.crew figcaption', f => f.map(x => x.textContent))).join() === 'Cary,Morgan,Magnolia', 'title card: the crew, with their photos');
ok(/Relax, let's handle this!/.test(await page.textContent('.bubble')), `title card: "Relax, let's handle this!"`);
await shot('0-crew');
ok(await page.$eval('#introGo', b => b.disabled), `"Let's go" waits for a mentor`);
await tap('[data-mentor="morgan"]');
ok((await page.$$eval('[data-mentor]', b => b.map(x => x.getAttribute('aria-pressed')))).join() === 'false,true,false', 'picked Morgan as mentor');
await tap('#introGo');
ok(await page.$eval('#intro', e => e.hidden), `title card closes on "Let's go"`);
ok(/Morgan/.test(await page.textContent('#mentor')) && /Rehearsal at 5:00/.test(await page.textContent('#mentor')), 'Morgan greets you in a speech bubble');
ok(/Ask 3/.test(await page.textContent('#hintBtn')) && (await page.$('#hintBtn img')) !== null, "the hint button is Morgan's face: Ask 3");
ok(/^10:00 to rehearsal/.test(await page.textContent('#due')), 'clock bar: 10:00 to rehearsal');
const fault = await page.evaluate(() => document.querySelector('#dbg').textContent.match(/fault: (handheld-\d\d)/)[1]);
const faultCh = +fault.slice(-2);
const unp = await page.evaluate(() => document.querySelector('#dbg').textContent.match(/fault: (handheld-\d\d) \(a handheld that is not paired/)[1]);
const unpCh = +unp.slice(-2);
ok(unpCh >= 5 && unpCh <= 13, `seed VJ-48217 puts the unpaired mic on ch ${unpCh} (5-13)`);
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
  ok((await page.$eval(`.handslot[data-id="${id}"] .lcdbox svg`, s => s.getAttribute('aria-label'))) === 'Display: blank', `CH ${ch}: its display shows as soon as it is in hand (blank: no batteries)`);
  await tapIn(id, 'batteries');
  ok((await stepsDone()).join() === 'take,batteries', `CH ${ch}: batteries in`);
  await tapIn(id, 'hold');
  if (ch === faultCh) {
    ok(/does not switch on/.test(await page.textContent('#toast')), `CH ${ch}: it does not switch on (NOTICE)`);
    ok((await stepsDone()).join() === 'take,batteries', `CH ${ch}: not on`);
    await shot('3-fault');
    await tapIn(id, 'checkbat');
    ok(/wrong way round/.test(await page.textContent('#toast')), `CH ${ch}: the batteries are the wrong way round (TRACE)`);
    await tapIn(id, 'reseat'); await tapIn(id, 'hold');                             // ACT
  }
  ok((await stepsDone()).join() === 'take,batteries,power', `CH ${ch}: switched on`);
  const lcd = await page.$eval(`.handslot[data-id="${id}"] .lcdbox svg`, s => s.getAttribute('aria-label'));
  ok(/group [1-6], channel [1-6]/.test(lcd) && !lcd.includes('muted'), `CH ${ch}: display reads "${lcd}" with no extra tap`);
  if (ch === 1) {                                                                             // VERIFY from the drawer: it walks you to the X32
    ok(/Talk at X32/.test(await page.textContent(inSlot(id, 'talk'))), `CH ${ch}: away from a meter, the talk button says it goes to the X32`);
    await tapIn(id, 'talk'); await page.waitForTimeout(250);
    ok((await where()) === 'X32', `CH ${ch}: talking from the drawer took the mic to the X32`);
  } else {
    await tapBack(); await tapBack();
    await tapHot('X32'); ok((await where()) === 'X32', `CH ${ch}: at the X32 with the mic`);
    await tapIn(id, 'talk');                                                            // VERIFY
  }
  ok((await chip(ch)) === 'verified', `CH ${ch}: verified after talking at the X32`);
  ok(await page.$eval(`.strip[data-point="foh-x32:in:${ch}"] i`, i => i.getAnimations().length > 0), `CH ${ch}: its X32 meter animates`);
  ok((await stepsDone()).join() === 'take,batteries,power,talk', `CH ${ch}: steps 1-4 ticked`);
  await tapIn(id, 'chair');
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
await tapIn('handheld-04', 'drawer'); await tapIn('handheld-05', 'drawer');
await tapBack(); await tapBack();
ok(!(await page.$eval('#skipBtn', b => b.disabled)), 'Check the rest is offered after 3 by hand');
await shot('4-skip-offered');
await tap('#skipBtn');
await page.waitForTimeout(600);
// the skip stops on the unpaired mic: trace it (display vs its receiver slot), set it aside, let the skip finish
ok(/stopped at Mic \d+/.test(await page.textContent('#toast')), 'Check the rest stops at the unpaired mic: ' + (await page.textContent('#toast')));
ok((await where()) === 'X32' && (await chip(unpCh)) === 'no-signal-seen', `CH ${unpCh}: no signal at the X32, in hand`);
await shot('5-skip-stopped');
await tap('#hintBtn');
ok(!(await page.$eval('#mentor', m => m.hidden)) && /Morgan/.test(await page.textContent('#mentor')) && /transmitter to its receiver/.test(await page.textContent('#mentor')), 'a hint comes as a speech bubble from Morgan');
await shot('5b-mentor-hint');
await tapIn(unp, 'checkbat');
ok(/right way round/.test(await page.textContent('#toast')), `CH ${unpCh}: batteries are fine`);
const disp = (await page.$eval(`.handslot[data-id="${unp}"] .lcdbox svg`, s => s.getAttribute('aria-label'))).match(/group (\d), channel (\d)/).slice(1).join('·');
await tapBack(); await tapHot('Wireless rack'); await tapHot('Receivers');
await tapIn(unp, 'talk');
const slot = await page.$eval(`.strip[data-point="ptu6000-rx:${unpCh}"] .rf`, x => x.textContent);
ok(disp !== slot, `CH ${unpCh}: its display says ${disp}, its receiver slot listens on ${slot} (TRACE)`);
ok(await page.$eval(`.strip[data-point="ptu6000-rx:${unpCh}"]`, s => s.classList.contains('dead')), `CH ${unpCh}: dead at its receiver`);
for (const id of await page.$$eval('.handslot.full', s => s.map(x => x.dataset.id))) if (id !== unp) await tapIn(id, 'chair');   // a trip partner goes on the chair unchecked
ok(await page.$(inSlot(unp, 'bad')) === null, `CH ${unpCh}: no "bad mic" button away from the drawer`);
await tapBack(); await tapBack(); await tapHot('Mic cabinet'); await tapHot('Mic drawer');
await tapIn(unp, 'bad');                                                                       // ACT: bad mics go back in the drawer (Cary)
ok((await chip(unpCh)) === 'set-aside', `CH ${unpCh}: back in the drawer as a bad mic`);
ok(await page.$(`.drawer .slot.bad[data-id="${unp}"]`) !== null, `CH ${unpCh}: shown in the drawer, marked bad`);
ok(await page.$(`#chair button[data-id="${unp}"][data-s="set-aside"]`) !== null, `CH ${unpCh}: listed under bad mics`);
await tapBack(); await tapBack();
await tap('#skipBtn');
await page.waitForTimeout(1600);
ok((await page.$$eval('.chips .chip[data-s="verified"]', c => c.length)) === 15, 'Check the rest verifies the others: 15 verified');
ok((await page.$$eval('#chair .chair button[data-s="verified"]', b => b.length)) === 15, '15 on the chair');
ok(!(await page.$eval('#sheet', s => s.hidden)), 'debrief opens when every mic is verified or set aside');
const lines = await page.$$eval('#dbList li', ls => ls.map(l => l.textContent));
ok(/Ready: 15 mics verified at the X32 and 1 set aside/.test(lines[0]), 'debrief: ready, 1 set aside');
for (const step of ['NOTICE ✓', 'TRACE ✓', 'ACT ✓', 'VERIFY ✓']) ok(lines.filter(l => l.startsWith(step)).length === 2, `debrief: ${step} for both faults`);
ok(lines.some(l => /a spare covers it/.test(l)), 'debrief: a spare covers the bad mic');
ok(lines.some(l => /3 mics checked by hand, 12 by Check the rest \(it stopped at Mic \d+/.test(l)), 'debrief: 3 by hand, 12 by Check the rest, one stop');
await shot('6-debrief');

// ---- the line check, straight on from the debrief (Cary, 2026-10-02) ----
const clockAtEnd = await page.textContent('#clock');
ok(!(await page.$eval('#lineBtn', b => b.hidden)), 'debrief offers the line check');
await tap('#lineBtn'); await page.waitForTimeout(300);
ok((await where()) === 'X32', 'line check: you start at the X32');
const lineChs = await page.$$eval('.chips .chip', c => c.map(x => +x.dataset.ch));
ok(lineChs.length === 13 && !lineChs.includes(unpCh) && lineChs.includes(14), `line check: 13 singers; spare 14 stands in for bad mic ${unpCh}`);
ok((await page.textContent('#clock')) === clockAtEnd, 'line check: the clock carries on from the battery-in check');
ok(/Morgan/.test(await page.textContent('#mentor')) && /down the line/.test(await page.textContent('#mentor')), 'Morgan explains the line check');
const KIND = [['switched their mic off', 'off'], ['muted', 'muted'], ['too quietly', 'quiet'], ['pointed', 'aimed'], ['monitor amp', 'amp']];
const lineFaults = async () => Object.fromEntries((await page.textContent('#dbg')).split('\n').map(l => l.match(/^fault: (\S+) \((.*?)\)/)).filter(Boolean).map(m => [m[1], KIND.find(([t]) => m[2].includes(t))[1]]));
const lchip = id => page.$eval(`.chips .chip[data-id="${id}"]`, c => c.dataset.s);
const toast = () => page.textContent('#toast');
const say = async act => { await tap(`#hand [data-act="${act}"]`); };
// play the line check like a player: by hand, then Go down the line; each fault gets noticed, traced, fixed and verified
async function playLine(name) {
  const faults = await lineFaults(), fixed = new Set();
  ok(Object.keys(faults).length === 2, `${name}: two faults (${Object.entries(faults).map(([d, k]) => `${k} on ${d}`).join(', ')})`);
  // first the wedges: the Wii Shop theme through Bus 1 (Cary)
  await tap('[data-pb="bus1"]');
  if (Object.values(faults).includes('amp')) {
    ok(/nothing comes out of the wedges/.test(await toast()) && await page.$eval('#wedges', w => w.classList.contains('silent')), `${name}: amp off: silent wedges (NOTICE)`);
    await tap('[data-pb="mains"]'); ok(/plays through the mains/.test(await toast()), `${name}: it plays through the mains: the problem is after Bus 1 (TRACE)`);
    await tap('[data-a2amp="check"]'); ok(/monitor amp is off/.test(await toast()), `${name}: the A2 finds the monitor amp off`);
    await tap('[data-a2amp="on"]'); await tap('[data-pb="bus1"]');                                                                     // ACT, VERIFY
  }
  ok(/plays in all three wedges|Wedge check done/.test(await toast()) && /Wedge check done/.test(await page.textContent('#steps')), `${name}: wedge check done`);
  for (let guard = 0; guard < 40 && (await page.$eval('#sheet', s => s.hidden)); guard++) {
    const [done, of] = (await page.textContent('#score')).split('/'); if (done === of) break;
    const id = await page.$eval('#hand .singer', s => s.dataset.id), kind = !fixed.has(id) && faults[id];
    if (!kind && !(await page.$eval('#skipBtn', b => b.disabled))) { await tap('#skipBtn'); await page.waitForTimeout(250); continue; }
    if (!kind) { await say('call'); await say('hear'); ok((await lchip(id)) === 'verified' || !(await page.$eval('#sheet', s => s.hidden)), `${name}: ${id} checked by hand`); continue; }
    if (!(await lchip(id)).match(/no-signal-seen|low|ringing/)) await say('call');                                                    // NOTICE
    if (kind === 'off' || kind === 'muted') {
      ok((await lchip(id)) === 'no-signal-seen', `${name}: ${id} (${kind}): no signal at the X32`);
      if (kind === 'off') { await say('a2'); ok(/is switched off/.test(await toast()), `${name}: ${id}: the A2 walks out and looks (TRACE)`); }
      else { await say('check'); ok(/line through it/.test(await toast()), `${name}: ${id}: the singer reads the display (TRACE)`); }
      await say(kind === 'off' ? 'hold' : 'tap');                                                                                       // ACT
    } else if (kind === 'quiet') {
      ok((await lchip(id)) === 'low', `${name}: ${id} (quiet): the meter barely moves`);
      await say('check'); await say('louder');
    } else {
      ok((await lchip(id)) === 'ringing' && await page.$eval('#wedges', w => w.classList.contains('ring')), `${name}: ${id} (aimed at the wedge): it rings, the wedges flash`);
      await say('down'); await say('call');
      ok((await lchip(id)) === 'monitor', `${name}: ${id}: send down, the ring stops (TRACE)`);
      await say('aim'); await say('up');
    }
    await say('call'); await say('hear');                                                                                               // VERIFY
    ok((await lchip(id)) === 'verified', `${name}: ${id} fixed and checked`);
    fixed.add(id);
  }
  await page.waitForTimeout(1600);
  ok(!(await page.$eval('#sheet', s => s.hidden)) && /line check/i.test(await page.textContent('#dbTitle')), `${name}: the line check debrief opens`);
  const dl = await page.$$eval('#dbList li', ls => ls.map(l => l.textContent));
  ok(/Line check done: the wedges and all 13 singers checked/.test(dl[0]), `${name}: ${dl[0]}`);
  for (const step of ['NOTICE ✓', 'TRACE ✓', 'ACT ✓', 'VERIFY ✓']) ok(dl.filter(l => l.startsWith(step)).length === 2, `${name}: ${step} for both faults`);
}
await page.tap('#closeBtn').catch(() => {});
await shot('7-line-start');
await playLine('line check (VJ-48217 → LC-48217)');
await shot('8-line-debrief');
ok((await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])).reduce((a, b) => a - b) <= 0, 'line check: no sideways scroll');

// a direct link to the line check, with the other two faults (switched off, muted); the mentor is remembered
const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
await p2.goto(BASE + '#LC-20164', { waitUntil: 'networkidle' });
const page0 = page; page = p2;
ok(await page.$eval('#intro', e => e.hidden), 'direct line check link: no title card once a mentor is picked');
ok((await page.$$eval('.chips .chip', c => c.length)) === 13, 'direct line check link: 13 singers');
// the receivers tell switched off from muted: RF or not
await tapBack(); await tapHot('Wireless rack'); await tapHot('Receivers');
const rf = async ch => page.$eval(`#panel .strip[data-ch="${ch}"] .rfdot`, d => d.classList.contains('on'));
ok((await rf(3)) === true && (await rf(13)) === false && (await rf(1)) === true, 'receivers: the muted mic (3) has RF, the switched-off one (13) has none');
await tapBack(); await tapBack(); await tapHot('X32');
await playLine('line check (LC-20164)');
page = page0;
ok(await page.evaluate(() => parseFloat(document.body.style.paddingBottom) >= document.querySelector('#dock').offsetHeight), 'the page ends clear of the hands dock');
ok((await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])).reduce((a, b) => a - b) <= 0, 'no sideways scroll at phone width');
ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
await browser.close(); server.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASS'); process.exit(failures ? 1 : 0);
