// Run: node --test tools/gameplay-slice/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { engine } from '../engine.js';

const content = JSON.parse(readFileSync(new URL('../content/vj-battery-in-check.json', import.meta.url)));
const eng = engine(content);

// helper: apply actions, failing loudly on any rejected action
function run(g, ...actions) {
  let events = [];
  for (const a of actions) {
    const r = eng.act(g, a);
    assert.equal(r.error, null, `${JSON.stringify(a)} rejected: ${r.error && r.error.message}`);
    g = r.game; events = events.concat(r.events);
  }
  return { g, events };
}
// the by-hand routine for one mic: drawer -> X32 -> read display, talk -> chair
const checkAtX32 = mic => [{ type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: mic }, { type: 'go', scene: 'x32-top' }, { type: 'inspect' }, { type: 'talk' }, { type: 'put', place: 'chair' }];
const healthy = g => g.inPlay.filter(m => m !== g.fault.device);
const status = (g, mic) => eng.view(g).objective.mics.find(m => m.id === mic).status;
const mic = ch => 'handheld-' + String(ch).padStart(2, '0');

test('16 mics in play (13 musicians + 2 spares + 1 FOH talkback), in channel order', () => {
  const g = eng.start('x');
  assert.equal(g.inPlay.length, 16);
  assert.deepEqual(g.inPlay, Array.from({ length: 16 }, (_, i) => mic(i + 1)));
  const s = content.setup.mic_roles.value; assert.equal(s.musicians + s.spares + s.foh_talkback, 16);
});

test('the seed decides which mic is muted, reproducibly, and it is always channel 2 or 3 (owner)', () => {
  assert.equal(eng.start('VJ-48217').fault.device, eng.start('VJ-48217').fault.device);
  const hit = new Set();
  for (let i = 0; i < 200; i++) hit.add(eng.start('VJ-' + i).fault.device);
  assert.deepEqual([...hit].sort(), [mic(2), mic(3)]);
  const g = eng.start('VJ-48217');
  assert.equal(g.devices[g.fault.device].state.muted, true);
  assert.equal(g.devices[g.fault.device].state.power, 'on');
  assert.equal(eng.start('VJ-1', { faultChannel: 9 }).fault.device, mic(9), 'tests and the instructor can place it elsewhere');
});

test('a healthy mic is verified by talking into it while watching the X32', () => {
  const g0 = eng.start('VJ-1'), m = healthy(g0)[0];
  const { g, events } = run(g0, ...checkAtX32(m));
  assert.equal(status(g, m), 'verified');
  assert.equal(g.where[m], 'chair');
  assert.ok(events.some(e => e.type === 'verified' && /X32 ch \d/.test(e.text)));
});

test('talking where no meter is visible gives no evidence', () => {
  const g0 = eng.start('VJ-1'), m = healthy(g0)[0];
  const { g, events } = run(g0, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: m }, { type: 'talk' });
  assert.equal(status(g, m), 'not-checked');
  assert.ok(events.some(e => e.type === 'no-display'));
});

test('the muted mic shows no signal at the receiver or the X32 (NOTICE), and its display says muted', () => {
  const g0 = eng.start('VJ-7'), f = g0.fault.device;
  let { g, events } = run(g0, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: f }, { type: 'go', scene: 'x32-top' }, { type: 'talk' });
  assert.ok(events.some(e => e.type === 'meter' && e.signal === false));
  ({ g, events } = run(g, { type: 'go', scene: 'foh-rack-closeup' }, { type: 'talk' }));
  assert.ok(events.some(e => e.type === 'meter' && e.point.startsWith('ptu6000-rx:') && e.signal === false));
  assert.equal(status(g, f), 'no-signal-seen');
  assert.deepEqual(eng.view(g).lcd, {}, 'the display is not read until you look at it');
  ({ g, events } = run(g, { type: 'inspect' }));
  assert.deepEqual(events.find(e => e.type === 'inspect').lcd, { on: true, channel: g0.devices[f] && content.devices[f].channel, muted: true, battery: 'full' });
  assert.equal(eng.view(g).lcd[f].muted, true);
});

test('hands: two slots, one mic at a time (owner undecided); reading a display needs it in hand', () => {
  let g = eng.start('VJ-1');
  assert.deepEqual(g.hands, [null, null]);
  assert.equal(eng.act(g, { type: 'inspect' }).error.code, 'empty-hands');
  ({ g } = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: mic(1) }));
  assert.deepEqual(eng.view(g).hands, [mic(1), null]);
  const r = eng.act(g, { type: 'pick_up', device: mic(4) });
  assert.equal(r.error.code, 'hands-full');
  assert.match(r.error.message, /one mic at a time/);
});

test('the chair left of FOH: reachable from the FOH scenes, not from elsewhere; mics can be picked up again', () => {
  let { g } = run(eng.start('VJ-1'), ...checkAtX32(mic(1)));
  assert.equal(g.where[mic(1)], 'chair');
  ({ g } = run(g, { type: 'go', scene: 'foh-wide' }, { type: 'pick_up', device: mic(1) }));
  assert.equal(g.where[mic(1)], 'hand');
  ({ g } = run(g, { type: 'go', scene: 'storage-closet' }));
  assert.equal(eng.act(g, { type: 'put', place: 'chair' }).error.code, 'not-here');
  assert.equal(eng.act(g, { type: 'put', place: 'drawer' }).error.code, 'not-here');
  ({ g } = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'put', place: 'drawer' }));
  assert.equal(g.where[mic(1)], 'drawer');
  assert.equal(eng.act(g, { type: 'go', scene: 'storage-closet' }).game.scene, 'storage-closet');
  assert.equal(eng.act(run(g, { type: 'go', scene: 'storage-closet' }).g, { type: 'pick_up', device: mic(1) }).error.code, 'not-here');
});

test('fixed is not verified: unmuting alone never completes the objective', () => {
  const g0 = eng.start('VJ-7'), f = g0.fault.device;
  let { g } = run(g0, ...healthy(g0).flatMap(checkAtX32));
  ({ g } = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: f }, { type: 'press', how: 'tap' }));
  const v = eng.view(g);
  assert.equal(v.objective.complete, false);
  assert.ok(v.debug.mechanicallySatisfied.includes(f), 'the path works now');
  assert.notEqual(status(g, f), 'verified');
  const { g: g2, events } = run(g, { type: 'go', scene: 'x32-top' }, { type: 'talk' });
  assert.equal(eng.view(g2).objective.complete, true);
  assert.ok(events.some(e => e.type === 'objective-complete'));
});

test('evidence from before a change does not count (regression needs re-verifying)', () => {
  const g0 = eng.start('VJ-7'), m = healthy(g0)[0];
  let { g } = run(g0, ...checkAtX32(m));
  ({ g } = run(g, { type: 'pick_up', device: m }, { type: 'press', how: 'tap' }));        // mutes a working mic
  assert.equal(status(g, m), 'recheck');
  ({ g } = run(g, { type: 'press', how: 'tap' }));                                         // unmute again
  assert.equal(status(g, m), 'recheck', 'still needs fresh evidence');
  ({ g } = run(g, { type: 'talk' }));
  assert.equal(status(g, m), 'verified');
});

test('power-cycling a muted mic clears the mute (owner-confirmed), and the debrief says that is how it was fixed', () => {
  assert.equal(content.behaviour.mute_survives_power_cycle.value, false);
  const g0 = eng.start('VJ-7'), f = g0.fault.device;
  const { g } = run(g0, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: f }, { type: 'press', how: 'hold' }, { type: 'press', how: 'hold' });
  assert.deepEqual(g.devices[f].state, { power: 'on', muted: false, battery: 'ok' });
  const d = eng.debrief(g);
  assert.equal(d.loop.act, true);
  assert.match(d.lines.join('\n'), /off and on, which cleared the mute/);
});

test('tapping a switched-off mic does nothing, says so, and its display is blank', () => {
  const g0 = eng.start('VJ-7'), m = healthy(g0)[0];
  const { g, events } = run(g0, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: m }, { type: 'press', how: 'hold' }, { type: 'press', how: 'tap' }, { type: 'inspect' });
  assert.deepEqual(g.devices[m].state, { power: 'off', muted: false, battery: 'ok' });
  assert.ok(events.some(e => e.type === 'nothing'));
  assert.deepEqual(eng.view(g).lcd[m], { on: false });
});

test('hint ladder: concept, then location, then direct, then no more', () => {
  let g = eng.start('VJ-7'); const kinds = [];
  for (let i = 0; i < 3; i++) { const r = eng.act(g, { type: 'hint' }); g = r.game; kinds.push(r.events[0].kind); }
  assert.deepEqual(kinds, ['concept', 'location', 'direct']);
  assert.equal(eng.act(g, { type: 'hint' }).error.code, 'no-more-hints');
  assert.equal(eng.view(g).hintsLeft, 0);
});

test('rejected actions change nothing', () => {
  const g0 = eng.start('VJ-7');
  for (const a of [{ type: 'press', how: 'tap' }, { type: 'talk' }, { type: 'put', place: 'chair' }, { type: 'pick_up', device: mic(1) }, { type: 'pick_up', device: 'foh-x32' }, { type: 'inspect' }, { type: 'check_rest' }, { type: 'fly' }]) {
    const r = eng.act(g0, a);
    assert.ok(r.error, JSON.stringify(a));
    assert.equal(r.game, g0);
  }
});

test('step list: ticks for the mic in hand, then moves on to the next mic in colour order', () => {
  let g = eng.start('VJ-1');
  let p = eng.view(g).procedure;
  assert.deepEqual(p.steps.map(s => s.id), ['take', 'batteries', 'display', 'talk', 'chair']);
  assert.equal(p.mic, mic(1));
  assert.deepEqual(p.steps.map(s => s.done), [false, null, false, false, false], 'batteries: not simulated yet');
  const seen = [];
  for (const a of checkAtX32(mic(1)).slice(0, -1)) { g = run(g, a).g; seen.push(eng.view(g).procedure.steps.map(s => s.done)); }
  assert.deepEqual(seen.at(-1), [true, null, true, true, false]);
  g = run(g, { type: 'put', place: 'chair' }).g;
  p = eng.view(g).procedure;
  assert.equal(p.mic, mic(2), 'on to the next one');
  assert.equal(p.steps[1].simulated, false);
});

test('Check the rest: only after 3 mics by hand and with empty hands; then it does the same routine for the others', () => {
  const g0 = eng.start('VJ-48217'), f = g0.fault.device;          // the fault is ch 2 or 3, met by hand
  let g = run(g0, ...checkAtX32(mic(1))).g;
  assert.equal(eng.act(g, { type: 'check_rest' }).error.code, 'skip-unavailable');
  assert.match(eng.view(g).procedure.skip.reason, /2 more by hand/);
  // mic 2 and 3 by hand, fixing the muted one on the way
  for (const m of [mic(2), mic(3)]) {
    g = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: m }, { type: 'go', scene: 'x32-top' }, { type: 'inspect' }, { type: 'talk' }).g;
    if (m === f) g = run(g, { type: 'press', how: 'tap' }, { type: 'talk' }).g;
    if (m === mic(3)) assert.equal(eng.act(g, { type: 'check_rest' }).error.code, 'skip-unavailable', 'hands full');
    g = run(g, { type: 'put', place: 'chair' }).g;
  }
  assert.equal(eng.view(g).procedure.skip.available, true);
  const t0 = g.t, { g: g2, events } = run(g, { type: 'check_rest' });
  const v = eng.view(g2);
  assert.equal(v.objective.complete, true);
  assert.ok(v.objective.mics.every(m => m.where === 'chair'));
  assert.ok(events.some(e => e.type === 'skip-done' && e.checked.length === 13));
  assert.ok(events.some(e => e.type === 'objective-complete'));
  assert.ok(g2.t - t0 >= 13 * (2 * content.clock.move_s + 4 * content.clock.action_s), 'costs the same game time as by hand');
  const d = eng.debrief(g2);
  assert.equal(d.byHand, 3); assert.equal(d.bySkip, 13); assert.deepEqual(d.skipStops, []);
  assert.deepEqual(d.loop, { notice: true, trace: true, act: true, verify: true });
  assert.match(d.lines.join('\n'), /3 mics checked by hand, 13 by Check the rest\. All on the chair\./);
  assert.equal(eng.view(g2).procedure.skip.available, false);
});

test('Check the rest stops at the first abnormal mic, with it in hand at the X32 (principle 4.10)', () => {
  let g = eng.start('VJ-5', { faultChannel: 9 });
  g = run(g, ...[1, 2, 3].flatMap(ch => checkAtX32(mic(ch)))).g;
  let { g: g2, events } = run(g, { type: 'check_rest' });
  const stop = events.find(e => e.type === 'skip-stopped');
  assert.equal(stop.mic, mic(9));
  assert.match(stop.text, /muted.*no signal at X32 ch 9/);
  assert.deepEqual(stop.checked, [4, 5, 6, 7, 8].map(mic));
  assert.deepEqual(eng.view(g2).hands, [mic(9), null]);
  assert.equal(g2.scene, 'x32-top');
  for (let ch = 10; ch <= 16; ch++) assert.equal(status(g2, mic(ch)), 'not-checked', `ch ${ch} untouched`);
  // the player fixes it, verifies it, and runs the skip again
  ({ g: g2 } = run(g2, { type: 'press', how: 'tap' }, { type: 'talk' }, { type: 'put', place: 'chair' }, { type: 'check_rest' }));
  assert.equal(eng.view(g2).objective.complete, true);
  const d = eng.debrief(g2);
  assert.equal(d.loop.notice, true, 'the skip surfaced it');
  assert.equal(d.loop.trace, false, 'the skip read the display, not the player');
  assert.deepEqual(d.skipStops, [mic(9)]);
  assert.match(d.lines.join('\n'), /Check the rest stopped on Mic 9 \(grey \/ red\)/);
});

test('future battery faults: a mic that will not switch on is caught by the skip too (not built into scenarios yet)', () => {
  const c2 = structuredClone(content);
  c2.fault = { ...c2.fault, id: 'battery-reversed', set: c2.future_faults['battery-reversed'].set };
  const e2 = engine(c2);
  let g = e2.start('VJ-5', { faultChannel: 12 });
  const r = (...as) => { for (const a of as) { const x = e2.act(g, a); assert.equal(x.error, null, JSON.stringify(a)); g = x.game; } };
  r(...[1, 2, 3].flatMap(ch => checkAtX32(mic(ch))));
  const x = e2.act(g, { type: 'check_rest' }); g = x.game;
  const stop = x.events.find(e => e.type === 'skip-stopped');
  assert.equal(stop.mic, mic(12));
  assert.match(stop.text, /display is blank/);
  const y = e2.act(g, { type: 'press', how: 'hold' });
  assert.ok(y.events.some(e => e.type === 'nothing' && /does not switch on/.test(e.text)));
});

test('debrief: a systematic run gets NOTICE, TRACE, ACT, VERIFY and no extra changes', () => {
  const g0 = eng.start('VJ-48217'), f = g0.fault.device;
  let { g } = run(g0, ...healthy(g0).flatMap(checkAtX32));
  ({ g } = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: f }, { type: 'go', scene: 'x32-top' }, { type: 'talk' },   // NOTICE
    { type: 'go', scene: 'foh-rack-closeup' }, { type: 'talk' },                                         // TRACE: dead at the receiver too
    { type: 'inspect' }, { type: 'press', how: 'tap' },                                                  // ACT
    { type: 'go', scene: 'x32-top' }, { type: 'talk' }, { type: 'put', place: 'chair' }));               // VERIFY
  const d = eng.debrief(g);
  assert.deepEqual(d.loop, { notice: true, trace: true, act: true, verify: true });
  assert.equal(d.ready, true);
  assert.equal(d.changesOtherThanFix, 0);
  assert.match(d.lines.join('\n'), /Ready: all 16 mics verified/);
});

test('debrief: fixing by fiddling before noticing is reported as such, without blocking progress', () => {
  const g0 = eng.start('VJ-48217'), f = g0.fault.device;
  let { g } = run(g0, { type: 'go', scene: 'foh-mic-drawer' });
  for (const m of g.inPlay.slice(0, 4)) ({ g } = run(g, { type: 'pick_up', device: m }, { type: 'press', how: 'tap' }, { type: 'put', place: 'drawer' }));  // tap mics 1-4
  ({ g } = run(g, ...checkAtX32(f)));
  const d = eng.debrief(g);
  assert.equal(d.loop.notice, false);
  assert.equal(d.loop.act, true);
  assert.equal(d.silencedWorkingMic, 3, 'tapping the healthy mics muted them');
  assert.equal(d.ready, false);
  assert.match(d.lines.join('\n'), /still silent/);
});

test('no soft-locks: after any random sequence of actions, the same recovery always completes', () => {
  const scenes = ['foh-wide', 'foh-mic-drawer', 'x32-top', 'foh-rack-closeup', 'storage-closet'];
  const R = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
  for (let trial = 0; trial < 150; trial++) {
    let g = eng.start('SL-' + trial);
    for (let i = 0; i < 80; i++) {
      const pool = [{ type: 'go', scene: scenes[Math.floor(R() * scenes.length)] }, { type: 'pick_up', device: g.inPlay[Math.floor(R() * g.inPlay.length)] },
        { type: 'put', place: R() < .5 ? 'drawer' : 'chair' }, { type: 'press', how: R() < .5 ? 'tap' : 'hold' }, { type: 'talk' }, { type: 'inspect' }, { type: 'hint' }, { type: 'check_rest' }];
      g = eng.act(g, pool[Math.floor(R() * pool.length)]).game;   // rejected actions just leave g as is
    }
    // recovery: put down whatever you hold, then for every mic make it on + unmuted, verify it at the X32 and put it on the chair
    g = run(g, { type: 'go', scene: 'x32-top' }).g;
    if (eng.view(g).holding) g = run(g, { type: 'put', place: 'chair' }).g;
    for (const m of g.inPlay) {
      g = run(g, { type: 'go', scene: g.where[m] === 'drawer' ? 'foh-mic-drawer' : 'x32-top' }, { type: 'pick_up', device: m }).g;
      if (g.devices[m].state.power === 'off') g = run(g, { type: 'press', how: 'hold' }).g;
      if (g.devices[m].state.muted) g = run(g, { type: 'press', how: 'tap' }).g;
      g = run(g, { type: 'go', scene: 'x32-top' }, { type: 'talk' }, { type: 'put', place: 'chair' }).g;
    }
    assert.equal(eng.view(g).objective.complete, true, `trial ${trial} did not recover`);
    assert.equal(eng.debrief(g).ready, true);
  }
});

test('content: every device named in a connection or display exists, and every mic in play has a full path to the X32', () => {
  const ids = new Set(Object.keys(content.devices));
  for (const c of content.connections) for (const p of [c.from, c.to]) assert.ok(ids.has(p.split(':')[0]), p);
  for (const d of Object.values(content.displays)) assert.ok(ids.has(d.device));
  const g = eng.start('x');
  for (const m of g.inPlay) assert.deepEqual(eng.path(m), [m, `ptu6000-rx:${content.devices[m].channel}`, `foh-x32:in:${content.devices[m].channel}`]);
  for (const s of content.procedure.steps) assert.ok(s.simulated === false || ['take', 'display', 'talk', 'chair'].includes(s.id), s.id);
});
