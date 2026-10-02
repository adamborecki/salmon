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
  let { g } = run(g0, ...check(mic(1)), ...check(mic(2)));
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
      const pool = [{ type: 'go', scene: scenes[Math.floor(R() * 3)] }, call(m), ask(m, whats[Math.floor(R() * whats.length)]), send(m, R() < .5 ? 1 : -1), { type: 'hint' }, { type: 'line' }];
      g = eng.act(g, pool[Math.floor(R() * pool.length)]).game;
    }
    g = run(g, { type: 'go', scene: lc.scenes.x32 }).g;
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
