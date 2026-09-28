// Run: node --test tools/gameplay-slice/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { engine } from '../engine.js';

const content = JSON.parse(readFileSync(new URL('../content/vj-battery-in-check.json', import.meta.url)));
const eng = engine(content);

// the mute fault from the library, as the on-stage line check will use it: mics already on, with batteries
const mutedContent = structuredClone(content);
mutedContent.fault = { ...content.fault_library['tx-muted'], placement: content.fault.placement };
for (const d of Object.values(mutedContent.devices)) if (d.type === 'wireless-handheld') d.state = { power: 'on', muted: false, battery: 'ok' };
const engM = engine(mutedContent);

// helper: apply actions, failing loudly on any rejected action
function runWith(e, g, ...actions) {
  let events = [];
  for (const a of actions) {
    const r = e.act(g, a);
    assert.equal(r.error, null, `${JSON.stringify(a)} rejected: ${r.error && r.error.message}`);
    g = r.game; events = events.concat(r.events);
  }
  return { g, events };
}
const run = (g, ...as) => runWith(eng, g, ...as);
const mic = ch => 'handheld-' + String(ch).padStart(2, '0');
// the owner's routine for one healthy mic: drawer -> batteries in (charger is on the mic cabinet) -> switch on -> X32 -> talk -> chair
const takeAndPower = m => [{ type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: m }, { type: 'insert_batteries' }, { type: 'press', how: 'hold' }];
const checkAtX32 = m => [...takeAndPower(m), { type: 'go', scene: 'x32-top' }, { type: 'talk' }, { type: 'put', place: 'chair' }];
// the same routine where mics are already on (mute variant)
const checkOn = m => [{ type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: m }, { type: 'go', scene: 'x32-top' }, { type: 'talk' }, { type: 'put', place: 'chair' }];
const healthy = g => g.inPlay.filter(m => m !== g.fault.device);
const status = (g, m, e = eng) => e.view(g).objective.mics.find(x => x.id === m).status;
// fix the reversed-battery fault mic, which is in hand: look, reseat, switch on
const fixBatteries = [{ type: 'check_batteries' }, { type: 'reseat_batteries' }, { type: 'press', how: 'hold' }];

test('16 mics in play, in channel order: 1-13 for musicians, 14-16 interchangeable spares at FOH', () => {
  const g = eng.start('x');
  assert.deepEqual(g.inPlay, Array.from({ length: 16 }, (_, i) => mic(i + 1)));
  const r = content.setup.mic_roles.value;
  assert.deepEqual([...r.musicians, ...r.stay_at_foh], Array.from({ length: 16 }, (_, i) => i + 1));
  for (const m of g.inPlay) assert.equal(content.devices[m].role, content.devices[m].channel <= 13 ? 'musician' : 'spare');
});

test('every mic starts in the drawer, off, with no batteries; the charger holds 32 charged cells', () => {
  const g = eng.start('VJ-1');
  for (const m of g.inPlay) { assert.deepEqual(g.devices[m].state, { power: 'off', muted: false, battery: 'none' }); assert.equal(g.where[m], 'drawer'); }
  assert.equal(eng.view(g).charger.cells, 32);
});

test('the seed picks the reversed-battery mic, always channel 2 or 3 (owner), and the fault happens as its batteries go in', () => {
  assert.equal(eng.start('VJ-48217').fault.device, eng.start('VJ-48217').fault.device);
  const hit = new Set();
  for (let i = 0; i < 200; i++) hit.add(eng.start('VJ-' + i).fault.device);
  assert.deepEqual([...hit].sort(), [mic(2), mic(3)]);
  let g = eng.start('VJ-48217'); const f = g.fault.device;
  assert.equal(g.devices[f].state.battery, 'none', 'nothing wrong until the batteries go in');
  g = run(g, ...takeAndPower(f).slice(0, 3)).g;
  assert.equal(g.devices[f].state.battery, 'reversed');
  assert.equal(eng.start('VJ-1', { faultChannel: 9 }).fault.device, mic(9), 'tests and the instructor can place it elsewhere');
});

test('RF group/channel: seeded, unique per mic, 6 groups x 6 channels (owner), shown on the display when on', () => {
  const a = eng.start('VJ-7'), b = eng.start('VJ-7'), c = eng.start('VJ-8');
  assert.deepEqual(a.rf, b.rf);
  assert.notDeepEqual(a.rf, c.rf);
  const combos = a.inPlay.map(m => `${a.rf[m].group}/${a.rf[m].channel}`);
  assert.equal(new Set(combos).size, 16, 'unique');
  for (const m of a.inPlay) { assert.ok(a.rf[m].group >= 1 && a.rf[m].group <= 6); assert.ok(a.rf[m].channel >= 1 && a.rf[m].channel <= 6); }
  const m = healthy(a)[0];
  const { g, events } = run(a, ...takeAndPower(m), { type: 'inspect' });
  assert.deepEqual(events.find(e => e.type === 'inspect').lcd, { on: true, group: a.rf[m].group, channel: a.rf[m].channel, muted: false, battery: 'full' });
  assert.deepEqual(eng.view(g).rf[m], a.rf[m], 'the receiver side shows the same pair');
});

test('batteries: only at the charger, two cells each, once; no batteries means it will not switch on', () => {
  let g = eng.start('VJ-1'); const m = healthy(g)[0];
  g = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: m }).g;
  const r0 = eng.act(g, { type: 'press', how: 'hold' });
  assert.match(r0.events.find(e => e.type === 'nothing').text, /no batteries/);
  assert.equal(eng.act(run(g, { type: 'go', scene: 'x32-top' }).g, { type: 'insert_batteries' }).error.code, 'not-here');
  g = run(g, { type: 'insert_batteries' }).g;
  assert.equal(g.devices[m].state.battery, 'ok');
  assert.equal(eng.view(g).charger.cells, 30);
  assert.equal(eng.act(g, { type: 'insert_batteries' }).error.code, 'batteries-in');
  assert.deepEqual(eng.view(g).batteriesIn, { [m]: true });
  // an empty charger refuses
  const c2 = structuredClone(content); c2.places.charger.cells = 2;
  const e2 = engine(c2); let h = e2.start('VJ-1');
  h = runWith(e2, h, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: mic(1) }, { type: 'insert_batteries' }, { type: 'pick_up', device: mic(4) }).g;
  assert.equal(e2.act(h, { type: 'insert_batteries', device: mic(4) }).error.code, 'charger-empty');
});

test('a healthy mic is verified by the routine: batteries, switch on, talk while watching the X32', () => {
  const g0 = eng.start('VJ-1'), m = healthy(g0)[0];
  const { g, events } = run(g0, ...checkAtX32(m));
  assert.equal(status(g, m), 'verified');
  assert.equal(g.where[m], 'chair');
  assert.ok(events.some(e => e.type === 'verified' && /X32 ch \d/.test(e.text)));
});

test('talking where no meter is visible gives no evidence', () => {
  const g0 = eng.start('VJ-1'), m = healthy(g0)[0];
  const { g, events } = run(g0, ...takeAndPower(m), { type: 'talk' });
  assert.equal(status(g, m), 'not-checked');
  assert.ok(events.some(e => e.type === 'no-display'));
});

test('reversed batteries: it will not switch on (NOTICE), the batteries show it (TRACE), reseat (ACT), verify', () => {
  const g0 = eng.start('VJ-48217'), f = g0.fault.device;
  let { g, events } = run(g0, ...takeAndPower(f));
  assert.match(events.find(e => e.type === 'nothing').text, /does not switch on/);
  ({ g, events } = run(g, { type: 'go', scene: 'x32-top' }, { type: 'talk' }));
  assert.equal(status(g, f), 'no-signal-seen');
  ({ g, events } = run(g, { type: 'check_batteries' }));
  assert.match(events.find(e => e.type === 'batteries').text, /wrong way round/);
  ({ g, events } = run(g, { type: 'reseat_batteries' }, { type: 'press', how: 'hold' }));
  assert.equal(g.devices[f].state.power, 'on');
  assert.notEqual(status(g, f), 'verified', 'fixed is not verified');
  ({ g } = run(g, { type: 'talk' }));
  assert.equal(status(g, f), 'verified');
  const d = eng.debrief(g);
  assert.deepEqual(d.loop, { notice: true, trace: true, act: true, verify: true });
  const text = d.lines.join('\n');
  assert.match(text, /What failed: the batteries went into Mic \d \(black \/ \w+\) the wrong way round/);
  assert.match(text, /NOTICE ✓ .*you tried to switch Mic \d .* on and nothing happened/);
  assert.match(text, /TRACE ✓ .*you checked Mic \d .*'s batteries/);
  assert.match(text, /ACT ✓ .*you put the batteries back into Mic \d .* the right way round/);
  assert.match(text, /no power, no signal/);
  assert.equal(d.changesOtherThanFix, 0, 'switching mics on is the routine, not an extra change');
});

test('reseating good batteries changes nothing, and says so', () => {
  const g0 = eng.start('VJ-1'), m = healthy(g0)[0];
  const r = eng.act(run(g0, ...takeAndPower(m).slice(0, 3)).g, { type: 'reseat_batteries' });
  assert.ok(r.events.some(e => e.type === 'nothing' && /already the right way round/.test(e.text)));
});

test('hands: two slots, up to two mics (owner); with two in hand, an action must say which mic', () => {
  let g = eng.start('VJ-1');
  assert.deepEqual(g.hands, [null, null]);
  assert.equal(eng.act(g, { type: 'inspect' }).error.code, 'empty-hands');
  ({ g } = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: mic(1) }));
  run(g, { type: 'inspect' });                                             // one in hand: no need to say which
  ({ g } = run(g, { type: 'pick_up', device: mic(4) }));
  assert.deepEqual(eng.view(g).hands, [mic(1), mic(4)]);
  assert.equal(eng.act(g, { type: 'pick_up', device: mic(5) }).error.code, 'hands-full');
  for (const t of ['inspect', 'talk', 'press', 'put', 'insert_batteries', 'check_batteries', 'reseat_batteries'])
    assert.equal(eng.act(g, { type: t, how: 'tap', place: 'drawer' }).error.code, 'which-mic', t);
  assert.equal(eng.act(g, { type: 'talk', device: mic(7) }).error.code, 'not-held');
  ({ g } = run(g, { type: 'insert_batteries', device: mic(1) }, { type: 'insert_batteries', device: mic(4) }, { type: 'press', how: 'hold', device: mic(1) }, { type: 'press', how: 'hold', device: mic(4) },
    { type: 'go', scene: 'x32-top' }, { type: 'talk', device: mic(4) }, { type: 'talk', device: mic(1) }, { type: 'put', place: 'chair', device: mic(4) }));
  assert.equal(status(g, mic(1)), 'verified'); assert.equal(status(g, mic(4)), 'verified');
  assert.deepEqual(eng.view(g).hands, [mic(1), null]);
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
  assert.equal(eng.act(run(g, { type: 'go', scene: 'storage-closet' }).g, { type: 'pick_up', device: mic(1) }).error.code, 'not-here');
});

test('fixed is not verified: reseating and switching on never completes the objective by itself', () => {
  const g0 = eng.start('VJ-7'), f = g0.fault.device;
  let { g } = run(g0, ...healthy(g0).flatMap(checkAtX32));
  ({ g } = run(g, ...takeAndPower(f), ...fixBatteries));
  const v = eng.view(g);
  assert.equal(v.objective.complete, false);
  assert.ok(v.debug.mechanicallySatisfied.includes(f), 'the path works now');
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

test('tapping a switched-off mic does nothing, says so, and its display is blank', () => {
  const g0 = eng.start('VJ-7'), m = healthy(g0)[0];
  const { g, events } = run(g0, ...takeAndPower(m), { type: 'press', how: 'hold' }, { type: 'press', how: 'tap' }, { type: 'inspect' });
  assert.deepEqual(g.devices[m].state, { power: 'off', muted: false, battery: 'ok' });
  assert.ok(events.some(e => e.type === 'nothing'));
  assert.deepEqual(eng.view(g).lcd[m], { on: false });
});

test('hint ladder for the battery fault: concept, then location, then direct, then no more', () => {
  let g = eng.start('VJ-7'); const kinds = [];
  for (let i = 0; i < 3; i++) { const r = eng.act(g, { type: 'hint' }); g = r.game; kinds.push(r.events[0].kind); }
  assert.deepEqual(kinds, ['concept', 'location', 'direct']);
  assert.equal(eng.act(g, { type: 'hint' }).error.code, 'no-more-hints');
  assert.equal(eng.view(g).hintsLeft, 0);
});

test('rejected actions change nothing', () => {
  const g0 = eng.start('VJ-7');
  for (const a of [{ type: 'press', how: 'tap' }, { type: 'talk' }, { type: 'put', place: 'chair' }, { type: 'pick_up', device: mic(1) }, { type: 'pick_up', device: 'foh-x32' },
    { type: 'inspect' }, { type: 'insert_batteries' }, { type: 'check_batteries' }, { type: 'reseat_batteries' }, { type: 'check_rest' }, { type: 'fly' }]) {
    const r = eng.act(g0, a);
    assert.ok(r.error, JSON.stringify(a));
    assert.equal(r.game, g0);
  }
});

test('step list (owner procedure): take, batteries, switch on, talk, chair; then on to the next mic in colour order', () => {
  let g = eng.start('VJ-1');
  let p = eng.view(g).procedure;
  assert.deepEqual(p.steps.map(s => s.id), ['take', 'batteries', 'power', 'talk', 'chair']);
  assert.ok(p.steps.every(s => s.simulated), 'every step is simulated now');
  assert.match(p.optional, /display/, 'reading the display is optional');
  assert.equal(p.mic, mic(1));
  const seen = [];
  for (const a of checkAtX32(mic(1))) { g = run(g, a).g; seen.push(eng.view(g).procedure.steps.map(s => s.done)); }
  assert.deepEqual(seen[1], [true, false, false, false, false], 'picked up');
  assert.deepEqual(seen[2], [true, true, false, false, false], 'batteries in');
  assert.deepEqual(seen[3], [true, true, true, false, false], 'switched on');
  assert.deepEqual(seen[5], [true, true, true, true, false], 'verified at the X32');
  assert.equal(eng.view(g).procedure.mic, mic(2), 'on to the next one');
});

test('Check the rest: only after 3 mics by hand and with empty hands; then the same routine for the others', () => {
  const g0 = eng.start('VJ-48217'), f = g0.fault.device;          // the fault is ch 2 or 3, met by hand
  let g = run(g0, ...checkAtX32(mic(1))).g;
  assert.equal(eng.act(g, { type: 'check_rest' }).error.code, 'skip-unavailable');
  assert.match(eng.view(g).procedure.skip.reason, /2 more by hand/);
  for (const m of [mic(2), mic(3)]) {
    g = run(g, ...takeAndPower(m), { type: 'go', scene: 'x32-top' }, { type: 'talk' }).g;
    if (m === f) g = run(g, ...fixBatteries, { type: 'talk' }).g;
    if (m === mic(3)) assert.equal(eng.act(g, { type: 'check_rest' }).error.code, 'skip-unavailable', 'hands full');
    g = run(g, { type: 'put', place: 'chair' }).g;
  }
  assert.equal(eng.view(g).procedure.skip.available, true);
  const t0 = g.t, { g: g2, events } = run(g, { type: 'check_rest' });
  const v = eng.view(g2);
  assert.equal(v.objective.complete, true);
  assert.ok(v.objective.mics.every(m => m.where === 'chair'));
  assert.equal(v.charger.cells, 0, 'all 32 cells used');
  assert.ok(events.some(e => e.type === 'skip-done' && e.checked.length === 13));
  // two per trip: go to the drawer, per mic pick up + batteries + switch on, go to the X32, per mic talk + chair
  // = per mic 1 move + 5 actions; 13 is odd, so the last trip carries one and costs one extra move
  assert.equal(g2.t - t0, 13 * (content.clock.move_s + 5 * content.clock.action_s) + content.clock.move_s, 'same game time as by hand, two at a time');
  const d = eng.debrief(g2);
  assert.equal(d.byHand, 3); assert.equal(d.bySkip, 13); assert.deepEqual(d.skipStops, []);
  assert.deepEqual(d.loop, { notice: true, trace: true, act: true, verify: true });
  assert.match(d.lines.join('\n'), /3 mics checked by hand, 13 by Check the rest\. All on the chair\./);
  assert.equal(d.changesOtherThanFix, 0);
});

test('Check the rest stops at the first abnormal mic, with it in hand at the X32 (principle 4.10)', () => {
  let g = eng.start('VJ-5', { faultChannel: 9 });
  g = run(g, ...[1, 2, 3].flatMap(ch => checkAtX32(mic(ch)))).g;
  let { g: g2, events } = run(g, { type: 'check_rest' });
  const stop = events.find(e => e.type === 'skip-stopped');
  assert.equal(stop.mic, mic(9));
  assert.match(stop.text, /stopped at Mic 9 \(grey \/ red\): no signal at X32 ch 9/);
  assert.deepEqual(stop.checked, [4, 5, 6, 7, 8].map(mic));
  assert.deepEqual(eng.view(g2).held, [mic(9)], 'mic 8 (its trip partner) was fine and went on the chair');
  assert.equal(g2.scene, 'x32-top');
  for (let ch = 10; ch <= 16; ch++) assert.equal(status(g2, mic(ch)), 'not-checked', `ch ${ch} untouched`);
  ({ g: g2 } = run(g2, ...fixBatteries, { type: 'talk' }, { type: 'put', place: 'chair' }, { type: 'check_rest' }));
  assert.equal(eng.view(g2).objective.complete, true);
  const d = eng.debrief(g2);
  assert.equal(d.loop.notice, true, 'the skip surfaced it');
  assert.equal(d.loop.trace, true, 'the player then checked the batteries');
  assert.deepEqual(d.skipStops, [mic(9)]);
  assert.match(d.lines.join('\n'), /Check the rest stopped on Mic 9 \(grey \/ red\)/);
});

test('dead cells (library fault, not in a scenario yet): look fine, will not switch on, and the skip still stops on it', () => {
  const c2 = structuredClone(content);
  c2.fault = { ...content.fault_library['battery-dead'], placement: content.fault.placement, hints: content.fault.hints, debrief: content.fault.debrief };
  const e2 = engine(c2);
  let g = e2.start('VJ-5', { faultChannel: 12 });
  g = runWith(e2, g, ...[1, 2, 3].flatMap(ch => checkAtX32(mic(ch)))).g;
  const x = e2.act(g, { type: 'check_rest' }); g = x.game;
  const stop = x.events.find(e => e.type === 'skip-stopped');
  assert.equal(stop.mic, mic(12));
  assert.match(stop.text, /no signal at X32 ch 12.*with Mic 13 \(grey \/ blue\) \(not checked yet\)/);
  assert.deepEqual(e2.view(g).held, [mic(12), mic(13)], 'its trip partner is still in hand, unchecked');
  const y = e2.act(g, { type: 'check_batteries', device: mic(12) });
  assert.match(y.events.find(e => e.type === 'batteries').text, /right way round/, 'you cannot see charge by looking');
});

test('mute fault (for the line check): power-cycling clears it (owner), tapping unmutes, and the debrief names each fix', () => {
  assert.equal(content.behaviour.mute_survives_power_cycle.value, false);
  const g0 = engM.start('VJ-7'), f = g0.fault.device;
  assert.equal(g0.devices[f].state.muted, true, 'applied at the start');
  const { g } = runWith(engM, g0, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: f }, { type: 'press', how: 'hold' }, { type: 'press', how: 'hold' });
  assert.deepEqual(g.devices[f].state, { power: 'on', muted: false, battery: 'ok' });
  assert.match(engM.debrief(g).lines.join('\n'), /off and on, which cleared the mute/);
  const { g: g2 } = runWith(engM, g0, ...checkOn(f).slice(0, 4), { type: 'go', scene: 'foh-rack-closeup' }, { type: 'talk' }, { type: 'inspect' }, { type: 'press', how: 'tap' }, { type: 'go', scene: 'x32-top' }, { type: 'talk' });
  const d = engM.debrief(g2);
  assert.deepEqual(d.loop, { notice: true, trace: true, act: true, verify: true });
  assert.match(d.lines.join('\n'), /ACT ✓ .*you unmuted Mic/);
  assert.match(d.lines.join('\n'), /on but muted/);
  let h = g0; const kinds = [];
  for (let i = 0; i < 3; i++) { const r = engM.act(h, { type: 'hint' }); h = r.game; kinds.push(r.events[0].text); }
  assert.deepEqual(kinds, content.fault_library['tx-muted'].hints.map(x => x.text), 'section 46 ladder, verbatim');
});

test('mute fault: fiddling before noticing is reported as such, without blocking progress', () => {
  const g0 = engM.start('VJ-48217'), f = g0.fault.device;
  let { g } = runWith(engM, g0, { type: 'go', scene: 'foh-mic-drawer' });
  for (const m of g.inPlay.slice(0, 4)) ({ g } = runWith(engM, g, { type: 'pick_up', device: m }, { type: 'press', how: 'tap' }, { type: 'put', place: 'drawer' }));
  ({ g } = runWith(engM, g, ...checkOn(f)));
  const d = engM.debrief(g);
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
        { type: 'put', place: R() < .5 ? 'drawer' : 'chair' }, { type: 'press', how: R() < .5 ? 'tap' : 'hold' }, { type: 'talk' }, { type: 'inspect' }, { type: 'hint' },
        { type: 'insert_batteries' }, { type: 'check_batteries' }, { type: 'reseat_batteries' }, { type: 'check_rest' }];
      g = eng.act(g, pool[Math.floor(R() * pool.length)]).game;   // rejected actions just leave g as is
    }
    // recovery: put down what you hold, then for every mic: batteries in the right way, on, unmuted, verified at the X32, on the chair
    g = run(g, { type: 'go', scene: 'x32-top' }).g;
    for (const m of eng.view(g).held) g = run(g, { type: 'put', place: 'chair', device: m }).g;
    for (const m of g.inPlay) {
      g = run(g, { type: 'go', scene: g.where[m] === 'drawer' ? 'foh-mic-drawer' : 'x32-top' }, { type: 'pick_up', device: m }).g;
      const s = () => g.devices[m].state;
      if (s().battery === 'none') g = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'insert_batteries' }).g;
      if (s().battery === 'reversed') g = run(g, { type: 'reseat_batteries' }).g;
      if (s().power === 'off') g = run(g, { type: 'press', how: 'hold' }).g;
      if (s().muted) g = run(g, { type: 'press', how: 'tap' }).g;
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
  for (const f of [content.fault, content.fault_library['tx-muted']]) assert.equal(f.hints.length, 3, f.id);
});
