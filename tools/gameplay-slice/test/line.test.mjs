// Line check engine rules. Run: node --test tools/gameplay-slice/test/line.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lineEngine } from '../line-engine.js';

const lc = JSON.parse(readFileSync(new URL('../content/vj-line-check.json', import.meta.url)));
const bc = JSON.parse(readFileSync(new URL('../content/vj-battery-in-check.json', import.meta.url)));
const eng = lineEngine(lc, bc.devices);
const mic = ch => 'handheld-' + String(ch).padStart(2, '0');
function run(g, ...actions) {
  const events = [];
  for (const a of actions) { const r = eng.act(g, a); assert.equal(r.error, null, `${JSON.stringify(a)}: ${r.error && r.error.message}`); g = r.game; events.push(...r.events); }
  return { g, events };
}
const call = m => ({ type: 'call', device: m }), ask = (m, what) => ({ type: 'ask', device: m, what });
const send = (m, dir) => ({ type: 'send', device: m, dir });
const check = m => [call(m), ask(m, 'hear')];
const play = to => ({ type: 'play', to }), a2amp = what => ({ type: 'a2', amp: what });
const status = (g, m) => eng.view(g).singers.find(s => s.id === m).status;
const one = (id, ch = 5) => eng.start('LC-T', { faults: [id], faultMics: { [id]: mic(ch) } });
const loop = (g, id) => eng.debrief(g).loops[id];

test('start: 13 singers in colour order, two seeded faults on different singers, never the first in line', () => {
  for (let i = 0; i < 40; i++) {
    const g = eng.start('LC-' + i);
    assert.deepEqual(g.lineup, Array.from({ length: 13 }, (_, k) => mic(k + 1)));
    assert.equal(g.faults.length, 2);
    assert.notEqual(g.faults[0].device, g.faults[1].device);
    assert.notEqual(g.faults[0].id, g.faults[1].id);
    assert.ok(g.faults.every(f => f.device !== mic(1)));
  }
  assert.deepEqual(eng.start('LC-7').faults, eng.start('LC-7').faults, 'same seed, same faults');
  assert.equal(eng.start('LC-7').t, lc.clock.default_offset_s);
  const ids = new Set(Array.from({ length: 60 }, (_, i) => eng.start('S' + i).faults.map(f => f.id)).flat());
  assert.deepEqual([...ids].sort(), lc.faults.map(f => f.id).sort(), 'every fault kind turns up');
});

test('coming from the battery-in check: the clock carries on, and a spare stands in for a bad mic, in order', () => {
  const lineup = [...Array.from({ length: 13 }, (_, k) => mic(k + 1)).filter(m => m !== mic(10)), mic(14)];
  const g = eng.start('LC-9', { t: 412, lineup: lineup.reverse() });
  assert.equal(g.t, 412);
  assert.deepEqual(g.lineup.slice(-3), [mic(12), mic(13), mic(14)]);
  assert.equal(eng.view(g).clock, '4:56:52 PM');
});

test('a healthy singer: say something at the X32, then "hear yourself?" = checked; away from the X32 you see nothing', () => {
  let { g, events } = run(eng.start('LC-T', { faults: [] }), { type: 'go', scene: 'foh-wide' }, call(mic(1)));
  assert.ok(events.some(e => e.type === 'no-display'));
  assert.equal(status(g, mic(1)), 'not-checked');
  ({ g, events } = run(g, { type: 'go', scene: lc.scenes.x32 }, call(mic(1))));
  assert.ok(events.some(e => e.type === 'meter' && e.level === 'normal' && !e.feedback));
  assert.equal(status(g, mic(1)), 'monitor', 'the input is fine; the wedge check is next');
  ({ g, events } = run(g, ask(mic(1), 'hear')));
  assert.ok(events.some(e => e.type === 'reply' && /Yes, I can hear myself/.test(e.text)));
  assert.equal(status(g, mic(1)), 'verified');
  assert.ok(events.some(e => e.type === 'verified'));
});

test('fixed is not verified: a send change re-opens only the wedge check; a mic change re-opens both', () => {
  let { g } = run(eng.start('LC-T', { faults: [] }), ...check(mic(1)), send(mic(1), +1));
  assert.equal(status(g, mic(1)), 'monitor');
  ({ g } = run(g, ask(mic(1), 'hear')));
  assert.equal(status(g, mic(1)), 'verified');
  ({ g } = run(g, ask(mic(1), 'tap'), ask(mic(1), 'tap')));     // muted and unmuted again: same state, but it changed
  assert.notEqual(status(g, mic(1)), 'verified');
  ({ g } = run(g, ...check(mic(1))));
  assert.equal(status(g, mic(1)), 'verified');
});

test('switched off: no signal; no RF at its receiver; display blank; a tap does nothing; press and hold fixes it', () => {
  const m = mic(5);
  let { g, events } = run(one('switched-off'), call(m));
  assert.ok(events.some(e => e.type === 'meter' && e.level === 'none'));
  assert.equal(status(g, m), 'no-signal-seen');
  ({ g, events } = run(g, { type: 'go', scene: lc.scenes.receivers }, call(m), ask(m, 'check'), ask(m, 'tap')));
  assert.ok(events.some(e => e.type === 'meter' && e.at === 'rx' && e.rf === false));
  assert.ok(events.some(e => /display is blank/.test(e.text)));
  assert.ok(events.some(e => /Nothing happened/.test(e.text)));
  ({ g } = run(g, ask(m, 'hold'), { type: 'go', scene: lc.scenes.x32 }, ...check(m)));
  assert.equal(status(g, m), 'verified');
  assert.deepEqual(loop(g, 'switched-off'), { notice: true, trace: true, act: true, verify: true });
});

test('muted: RF but no audio at its receiver; the display shows mute; a tap fixes it (press and hold makes it worse first)', () => {
  const m = mic(6);
  let { g, events } = run(one('muted', 6), call(m), { type: 'go', scene: lc.scenes.receivers }, call(m));
  assert.ok(events.some(e => e.type === 'meter' && e.at === 'rx' && e.rf === true && e.af === 'none'));
  ({ g, events } = run(g, ask(m, 'hold')));
  assert.equal(g.singer[m].power, 'off', 'press and hold on a muted mic switches it off');
  ({ g } = run(g, ask(m, 'hold')));
  assert.deepEqual([g.singer[m].power, g.singer[m].muted], ['on', false], 'and on again: a power cycle clears the mute');
  let h = run(one('muted', 6), call(m), { type: 'hint' }).events.find(e => e.type === 'hint');
  assert.equal(h.text, 'No signal is reaching the receiver. Where could the problem be upstream?', 'section 46, level 1');
  ({ g } = run(one('muted', 6), call(m), ask(m, 'check'), ask(m, 'tap'), ...check(m)));
  assert.equal(status(g, m), 'verified');
  assert.deepEqual(loop(g, 'muted'), { notice: true, trace: true, act: true, verify: true });
});

test('too quiet: the meter barely moves; "sing out" fixes it', () => {
  const m = mic(7);
  let { g, events } = run(one('too-quiet', 7), call(m));
  assert.ok(events.some(e => e.type === 'meter' && e.level === 'quiet'));
  assert.equal(status(g, m), 'low');
  ({ g } = run(g, ask(m, 'hear')));
  assert.notEqual(status(g, m), 'verified', 'a quiet singer is not a pass');
  ({ g } = run(g, { type: 'go', scene: lc.scenes.receivers }, call(m), ask(m, 'louder'), { type: 'go', scene: lc.scenes.x32 }, ...check(m)));
  assert.equal(status(g, m), 'verified');
  assert.deepEqual(loop(g, 'too-quiet'), { notice: true, trace: true, act: true, verify: true });
});

test('aimed at the wedge: it rings with the send up; pulling the send finds it; point it away, send back up, verified', () => {
  const m = mic(8);
  let { g, events } = run(one('aimed-at-wedge', 8), call(m));
  assert.ok(events.some(e => e.type === 'feedback'));
  assert.equal(status(g, m), 'ringing');
  ({ g, events } = run(g, send(m, -1), call(m)));
  assert.ok(!events.some(e => e.type === 'feedback'), 'send down: no ring');
  ({ g } = run(g, ask(m, 'hear')));
  assert.notEqual(status(g, m), 'verified', 'with the send down they barely hear themselves');
  assert.deepEqual(eng.debrief(g).lowSends, [m]);
  ({ g } = run(g, ask(m, 'aim'), send(m, +1), ...check(m)));
  assert.equal(status(g, m), 'verified');
  assert.deepEqual(loop(g, 'aimed-at-wedge'), { notice: true, trace: true, act: true, verify: true });
  assert.deepEqual(eng.debrief(g).lowSends, []);
});

test('a send all the way off: nothing in the monitor; the limits are refused', () => {
  let g = eng.start('LC-T', { faults: [] });
  ({ g } = run(g, send(mic(2), -1), send(mic(2), -1)));
  assert.equal(eng.view(g).singers[1].sendDb, null);
  assert.equal(eng.act(g, send(mic(2), -1)).error.code, 'send-limit');
  const { events } = run(g, call(mic(2)), ask(mic(2), 'hear'));
  assert.ok(events.some(e => /Nothing in the monitor/.test(e.text)));
});

test('the wrong instruction to a working mic switches it off, and the debrief says so', () => {
  const m = mic(3);
  let { g } = run(eng.start('LC-T', { faults: [] }), ...check(m), ask(m, 'hold'));
  assert.equal(g.singer[m].power, 'off');
  assert.notEqual(status(g, m), 'verified');
  const d = eng.debrief(g);
  assert.equal(d.harm, 1);
  assert.match(d.lines.join('\n'), /"Press and hold the button" to Mic 3 .*\(a working mic\)/);
});

test('acting before noticing or tracing is not credited', () => {
  const m = mic(5);
  const { g } = run(one('switched-off'), ask(m, 'hold'), ...check(m));
  assert.deepEqual(loop(g, 'switched-off'), { notice: false, trace: false, act: true, verify: true });
});

test('hints are about the singer you are working with', () => {
  const g0 = eng.start('LC-T', { faults: ['too-quiet', 'muted'], faultMics: { 'too-quiet': mic(4), muted: mic(9) } });
  let { g } = run(g0, call(mic(4)), call(mic(9)));
  assert.equal(eng.act(g, { type: 'hint' }).events[0].fault, 'muted');
  ({ g } = run(g, call(mic(4))));
  assert.equal(eng.act(g, { type: 'hint' }).events[0].fault, 'too-quiet');
});

test('Go down the line: after 3 by hand; same routine and time as by hand; stops at the first problem', () => {
  const g0 = eng.start('LC-T', { faults: ['muted'], faultMics: { muted: mic(9) } });
  let { g } = run(g0, play('bus1'), ...check(mic(1)), ...check(mic(2)));
  assert.equal(eng.act(g, { type: 'line' }).error.code, 'skip-unavailable');
  ({ g } = run(g, ...check(mic(3))));
  const t0 = g.t; let events;
  ({ g, events } = run(g, { type: 'line' }));
  const stop = events.find(e => e.type === 'skip-stopped');
  assert.equal(stop.mic, mic(9));
  assert.match(stop.text, /no signal at X32 ch 9/);
  assert.equal(g.t - t0, 5 * (lc.clock.call_s + lc.clock.ask_s) + lc.clock.call_s, '4-8 by the routine, then 9 rang no bell');
  ({ g } = run(g, ask(mic(9), 'check'), ask(mic(9), 'tap'), ...check(mic(9))));
  ({ g, events } = run(g, { type: 'line' }));
  assert.ok(events.some(e => e.type === 'objective-complete'));
  const d = eng.debrief(g);
  assert.equal(d.ready, true);
  assert.deepEqual(d.loops.muted, { notice: true, trace: true, act: true, verify: true });
  assert.match(d.lines.join('\n'), /NOTICE ✓ .*Go down the line stopped on Mic 9/);
});

test('Go down the line stops on a ring and on a singer who cannot hear themselves', () => {
  let g = eng.start('LC-T', { faults: ['aimed-at-wedge'], faultMics: { 'aimed-at-wedge': mic(6) } });
  g = run(g, ...check(mic(1)), ...check(mic(2)), ...check(mic(3)), send(mic(5), -1), send(mic(5), -1)).g;
  let { events } = run(g, { type: 'line' });
  assert.match(events.find(e => e.type === 'skip-stopped').text, /Mic 5 .*can't hear themselves/);
  g = run(g, send(mic(5), +1), send(mic(5), +1)).g;
  let g2; ({ g: g2, events } = run(g, { type: 'line' }));
  assert.match(events.find(e => e.type === 'skip-stopped').text, /Mic 6 .*rang in the wedges/);
  assert.equal(g2.log.filter(e => e.device === mic(6) && e.what === 'hear').length, 0, 'it stops at the ring, before asking about the monitor');
});

test('no soft-locks: after any random actions, the same recovery always completes', () => {
  const R = (() => { let s = 777; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
  const whats = ['hold', 'tap', 'louder', 'aim', 'check', 'hear'], scenes = [lc.scenes.x32, lc.scenes.receivers, 'foh-wide'];
  for (let trial = 0; trial < 120; trial++) {
    let g = eng.start('SL-' + trial);
    for (let i = 0; i < 60; i++) {
      const m = g.lineup[Math.floor(R() * g.lineup.length)];
      const pool = [{ type: 'go', scene: scenes[Math.floor(R() * 3)] }, call(m), ask(m, whats[Math.floor(R() * whats.length)]), send(m, R() < .5 ? 1 : -1), { type: 'hint' }, { type: 'line' },
        play(R() < .5 ? 'bus1' : 'mains'), { type: 'mains', device: m }, { type: 'a2', device: m }, { type: 'a2', amp: R() < .5 ? 'check' : 'on' }];
      g = eng.act(g, pool[Math.floor(R() * pool.length)]).game;
    }
    g = run(g, { type: 'go', scene: lc.scenes.x32 }, { type: 'a2', amp: 'on' }, play('bus1')).g;
    for (const m of g.lineup) {
      const s = g.singer[m];
      if (s.power === 'off') g = run(g, ask(m, 'hold')).g;
      if (g.singer[m].muted) g = run(g, ask(m, 'tap')).g;
      g = run(g, ask(m, 'louder'), ask(m, 'aim')).g;
      while (eng.view(g).singers.find(x => x.id === m).sendDb == null || eng.view(g).singers.find(x => x.id === m).sendDb < lc.bus1.hear_at_db) g = run(g, send(m, +1)).g;
      g = run(g, ...check(m)).g;
    }
    assert.equal(eng.view(g).complete, true, `trial ${trial} did not recover`);
  }
});

// ---- the wedge check, the monitor amp, and the A2 (Cary, 2026-10-02) ----

test('the line check is done only with the wedge check: known playback through Bus 1, heard in the wedges', () => {
  let g = eng.start('LC-T', { faults: [] });
  for (const m of g.lineup) g = run(g, ...check(m)).g;
  assert.equal(eng.view(g).verified, 13);
  assert.equal(eng.view(g).complete, false, 'every singer checked, but no wedge check');
  assert.match(eng.debrief(g).lines.join('\n'), /Wedge check ✗/);
  const { g: g2, events } = run(g, play('bus1'));
  assert.ok(events.some(e => e.type === 'playback' && e.ok && /Wii Shop theme plays in all three wedges/.test(e.text)));
  assert.ok(events.some(e => e.type === 'objective-complete'));
  assert.match(eng.debrief(g2).lines.join('\n'), /Wedge check ✓ .*after the singers had started/);
  const g3 = run(eng.start('LC-T', { faults: [] }), play('bus1')).g;
  assert.match(eng.debrief(g3).lines.join('\n'), /Wedge check ✓ .*before the singers/);
});

test('monitor amp off: silent wedges, nobody hears themselves at any send, no ring; the mains test points past Bus 1', () => {
  const g0 = eng.start('LC-T', { faults: ['monitor-amp-off'] });
  assert.deepEqual(g0.faults, [{ id: 'monitor-amp-off', device: lc.monitor_amp.id }]);
  let { g, events } = run(g0, play('bus1'));
  assert.ok(events.some(e => e.type === 'playback' && !e.ok && /nothing comes out of the wedges/.test(e.text)));
  assert.equal(eng.view(g).wedge.silent, true);
  ({ g, events } = run(g, ...check(mic(1)), send(mic(1), 1), send(mic(1), 1), ask(mic(1), 'hear')));
  assert.equal(events.filter(e => e.type === 'reply' && /Nothing in the monitor/.test(e.text)).length, 2, 'even with the send all the way up');
  assert.notEqual(status(g, mic(1)), 'verified');
  const aimed = eng.start('LC-T', { faults: ['monitor-amp-off', 'aimed-at-wedge'], faultMics: { 'aimed-at-wedge': mic(4) } });
  assert.ok(!run(aimed, call(mic(4))).events.some(e => e.type === 'feedback'), 'no amp, no ring');
  ({ g, events } = run(g, play('mains'), { type: 'mains', device: mic(1) }));
  assert.ok(events.some(e => e.type === 'playback' && e.to === 'mains' && e.ok));
  assert.ok(events.some(e => e.type === 'mains' && e.heard));
  assert.equal(eng.act(g, { type: 'hint' }).events[0].fault, 'monitor-amp-off');
});

test('monitor amp off: the A2 checks it and switches it on; play again = verified; the whole loop is credited', () => {
  let { g, events } = run(eng.start('LC-T', { faults: ['monitor-amp-off'] }), play('bus1'), play('mains'), a2amp('check'));
  assert.ok(events.some(e => e.type === 'a2' && /The monitor amp is off/.test(e.text)));
  const t = g.t;
  ({ g, events } = run(g, a2amp('on')));
  assert.equal(g.t - t, lc.clock.a2_s, 'a trip to the amp costs the A2 time');
  assert.equal(g.amp.power, 'on');
  ({ g, events } = run(g, play('bus1')));
  assert.ok(events.some(e => e.type === 'wedges-ok'));
  assert.deepEqual(eng.debrief(g).loops['monitor-amp-off'], { notice: true, trace: true, act: true, verify: true });
  assert.match(eng.debrief(g).lines.join('\n'), /TRACE ✓ .*through the mains, so the source and the X32 were fine/);
  assert.equal(run(g, a2amp('on')).events[0].text, 'The A2: "It was already on."');
});

test('switching the amp on re-opens the wedge check and every singer\'s monitor check, not their input check', () => {
  let { g } = run(eng.start('LC-T', { faults: [] }), play('bus1'), ...check(mic(1)));
  assert.equal(status(g, mic(1)), 'verified');
  g.amp.power = 'off';                                       // as if it tripped; then the A2 switches it back on
  ({ g } = run(g, a2amp('on')));
  assert.equal(status(g, mic(1)), 'monitor');
  assert.equal(eng.view(g).wedge.ok, false);
});

test('fixing the amp without noticing or tracing is not credited', () => {
  const { g } = run(eng.start('LC-T', { faults: ['monitor-amp-off'] }), a2amp('on'), play('bus1'));
  assert.deepEqual(eng.debrief(g).loops['monitor-amp-off'], { notice: false, trace: false, act: true, verify: true });
});

test('the A2 reports what a singer\'s mic is doing (TRACE), and costs a trip', () => {
  const cases = { 'switched-off': /is switched off/, muted: /muted/, 'too-quiet': /singing really quietly/, 'aimed-at-wedge': /pointed at the wedge/ };
  for (const [id, re] of Object.entries(cases)) {
    let { g, events } = run(one(id), call(mic(5)), { type: 'a2', device: mic(5) });
    assert.match(events.find(e => e.type === 'a2').text, re, id);
    const fix = { 'switched-off': ask(mic(5), 'hold'), muted: ask(mic(5), 'tap'), 'too-quiet': ask(mic(5), 'louder'), 'aimed-at-wedge': ask(mic(5), 'aim') }[id];
    ({ g } = run(g, fix, ...check(mic(5))));
    assert.equal(eng.debrief(g).loops[id].trace, true, `${id}: the A2's look counts as tracing`);
  }
  assert.match(run(eng.start('LC-T', { faults: [] }), { type: 'a2', device: mic(2) }).events[0].text, /looks fine/);
});

test('a mains test on a dead mic: nothing there either (the problem is before Bus 1)', () => {
  const { events } = run(one('switched-off'), { type: 'mains', device: mic(5) });
  assert.ok(events.some(e => e.type === 'mains' && !e.heard));
});

test('two faults per run from all five kinds; the amp fault turns up', () => {
  const ids = new Set(Array.from({ length: 80 }, (_, i) => eng.start('K' + i).faults.map(f => f.id)).flat());
  assert.ok(ids.has('monitor-amp-off'));
  for (let i = 0; i < 40; i++) assert.equal(eng.start('K' + i).faults.length, 2);
});
