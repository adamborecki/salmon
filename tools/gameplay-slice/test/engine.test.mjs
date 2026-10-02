// Run: node --test tools/gameplay-slice/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { engine } from '../engine.js';

const content = JSON.parse(readFileSync(new URL('../content/vj-battery-in-check.json', import.meta.url)));
const eng = engine(content);

// the mute fault from the library, as the on-stage line check will use it: mics already on, with batteries
const mutedContent = structuredClone(content);
mutedContent.faults = [{ ...content.fault_library['tx-muted'], placement: content.faults[0].placement }];
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
const healthy = g => g.inPlay.filter(m => !g.faults.some(f => f.device === m));
const [REV, UNP] = content.faults;
const fdev = (g, id = 'battery-reversed') => g.faults.find(f => f.id === id).device;
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
  for (const m of g.inPlay) {
    assert.deepEqual(g.devices[m].state, m === fdev(g, 'unpaired') ? { power: 'off', muted: false, battery: 'none', paired: false } : { power: 'off', muted: false, battery: 'none' });
    assert.equal(g.where[m], 'drawer');
  }
  assert.equal(eng.view(g).charger.cells, 32);
});

test('the seed picks the reversed-battery mic, always channel 2 or 3 (owner), and the fault happens as its batteries go in', () => {
  assert.equal(fdev(eng.start('VJ-48217')), fdev(eng.start('VJ-48217')));
  const hit = new Set();
  for (let i = 0; i < 200; i++) hit.add(fdev(eng.start('VJ-' + i)));
  assert.deepEqual([...hit].sort(), [mic(2), mic(3)]);
  let g = eng.start('VJ-48217'); const f = fdev(g);
  assert.equal(g.devices[f].state.battery, 'none', 'nothing wrong until the batteries go in');
  g = run(g, ...takeAndPower(f).slice(0, 3)).g;
  assert.equal(g.devices[f].state.battery, 'reversed');
  assert.equal(fdev(eng.start('VJ-1', { faultChannel: 9 })), mic(9), 'tests and the instructor can place it elsewhere');
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
  assert.deepEqual(eng.view(g).rfRx[m], a.rf[m], 'its receiver slot shows the same pair');
});

test('a mic in hand shows its display without an inspect action, and it costs no time (Cary, 2026-10-01)', () => {
  const a = eng.start('VJ-7'), m = healthy(a)[0];
  let { g } = run(a, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: m });
  assert.deepEqual(eng.view(g).lcd[m], { on: false }, 'blank before batteries');
  const t = g.t;
  ({ g } = run(g, { type: 'insert_batteries' }, { type: 'press', how: 'hold' }));
  assert.deepEqual(eng.view(g).lcd[m], { on: true, group: a.rf[m].group, channel: a.rf[m].channel, muted: false, battery: 'full' });
  assert.equal(g.t - t, 2 * content.clock.action_s, 'only the two actions cost time');
  ({ g } = run(g, { type: 'put', place: 'drawer' }));
  assert.equal(eng.view(g).lcd[m], undefined, 'put down: not shown');
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
  const g0 = eng.start('VJ-48217'), f = fdev(g0);
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
  const g0 = eng.start('VJ-7', { only: ['battery-reversed'] }), f = fdev(g0);
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
  const g0 = eng.start('VJ-48217', { only: ['battery-reversed'] }), f = fdev(g0);          // the fault is ch 2 or 3, met by hand
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
  assert.match(d.lines.join('\n'), /3 mics checked by hand, 13 by Check the rest\. All on the chair or set aside\./);
  assert.equal(d.changesOtherThanFix, 0);
});

test('Check the rest stops at the first abnormal mic, with it in hand at the X32 (principle 4.10)', () => {
  let g = eng.start('VJ-5', { faultChannel: 9, only: ['battery-reversed'] });
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
  c2.faults = [{ ...content.fault_library['battery-dead'], placement: REV.placement, hints: REV.hints, debrief: REV.debrief }];
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
  const g0 = engM.start('VJ-7'), f = fdev(g0, 'tx-muted');
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
  const g0 = engM.start('VJ-48217'), f = fdev(g0, 'tx-muted');
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
        { type: 'insert_batteries' }, { type: 'check_batteries' }, { type: 'reseat_batteries' }, { type: 'check_rest' }, { type: 'put', place: 'bad' }];
      g = eng.act(g, pool[Math.floor(R() * pool.length)]).game;   // rejected actions just leave g as is
    }
    // recovery: put down what you hold, then for every mic: batteries in the right way, on, unmuted, verified at the X32, on the chair
    g = run(g, { type: 'go', scene: 'x32-top' }).g;
    for (const m of eng.view(g).held) g = run(g, { type: 'put', place: 'chair', device: m }).g;
    for (const m of g.inPlay) {
      g = run(g, { type: 'go', scene: ['drawer', 'bad'].includes(g.where[m]) ? 'foh-mic-drawer' : 'x32-top' }, { type: 'pick_up', device: m }).g;
      const s = () => g.devices[m].state;
      if (s().paired === false) { g = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'put', place: 'bad' }).g; continue; }
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
  for (const f of [...content.faults, content.fault_library['tx-muted']]) assert.equal(f.hints.length, 3, f.id);
});

// ---- the unpaired "bad mic" (owner, 2026-09-28: not paired = a bad mic; set it aside, a spare covers it) ----

test('unpaired mic: one of the later musician mics (5-13), by seed; its display shows a group/channel its receiver slot does not', () => {
  const hit = new Set();
  for (let i = 0; i < 200; i++) { const g = eng.start('VJ-' + i); hit.add(fdev(g, 'unpaired')); assert.notEqual(fdev(g, 'unpaired'), fdev(g)); }
  assert.deepEqual([...hit].sort(), [5, 6, 7, 8, 9, 10, 11, 12, 13].map(mic));
  const g = eng.start('VJ-48217'), u = fdev(g, 'unpaired');
  for (const m of g.inPlay) {
    if (m === u) {
      assert.notDeepEqual(g.rf[m], g.rfRx[m], 'mismatch');
      assert.ok(g.inPlay.every(o => `${g.rfRx[o].group}/${g.rfRx[o].channel}` !== `${g.rf[m].group}/${g.rf[m].channel}`), 'a combination no receiver slot uses');
    } else assert.deepEqual(g.rf[m], g.rfRx[m]);
  }
});

test('unpaired mic: switches on fine, batteries fine, but nothing reaches its receiver; it cannot be fixed, only set aside', () => {
  const g0 = eng.start('VJ-48217'), u = fdev(g0, 'unpaired');
  let { g, events } = run(g0, ...takeAndPower(u));
  assert.equal(g.devices[u].state.power, 'on');
  assert.ok(!events.some(e => e.type === 'nothing'));
  ({ g, events } = run(g, { type: 'check_batteries' }, { type: 'inspect' }, { type: 'go', scene: 'foh-rack-closeup' }, { type: 'talk' }));
  assert.match(events.find(e => e.type === 'batteries').text, /right way round/);
  assert.deepEqual(events.find(e => e.type === 'inspect').lcd, { on: true, ...g0.rf[u], muted: false, battery: 'full' });
  assert.ok(events.some(e => e.type === 'meter' && e.point === `ptu6000-rx:${content.devices[u].channel}` && !e.signal), 'dead at its receiver');
  ({ g } = run(g, { type: 'press', how: 'hold' }, { type: 'press', how: 'hold' }, { type: 'reseat_batteries' }, { type: 'press', how: 'hold' }, { type: 'talk' }));
  assert.equal(status(g, u), 'no-signal-seen', 'power-cycling and reseating do not help');
  const r = eng.act(g, { type: 'hint' });
  assert.equal(r.events[0].fault, 'unpaired', 'a hint is about the mic in your hand');
  assert.match(r.events[0].text, /links a transmitter to its receiver/);
  assert.equal(eng.act(g, { type: 'put', place: 'bad' }).error.code, 'not-here', 'bad mics go back in the drawer (Cary, 2026-10-02)');
  ({ g, events } = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'put', place: 'bad' }));
  assert.equal(status(g, u), 'set-aside');
  assert.ok(events.some(e => e.type === 'set-aside' && /A spare covers it/.test(e.text)));
  ({ g } = run(g, { type: 'go', scene: 'storage-closet' }));
  assert.equal(eng.act(g, { type: 'pick_up', device: u }).error.code, 'not-here', 'a bad mic is in the drawer, not here');
});

test('both faults, the way a player meets them: reversed batteries by hand, then Check the rest stops on the unpaired mic', () => {
  const g0 = eng.start('VJ-48217'), f = fdev(g0), u = fdev(g0, 'unpaired');
  let g = g0;
  for (const m of [mic(1), mic(2), mic(3)]) {
    g = run(g, ...takeAndPower(m), { type: 'go', scene: 'x32-top' }, { type: 'talk' }).g;
    if (m === f) g = run(g, ...fixBatteries, { type: 'talk' }).g;
    g = run(g, { type: 'put', place: 'chair' }).g;
  }
  let { g: g2, events } = run(g, { type: 'check_rest' });
  assert.equal(events.find(e => e.type === 'skip-stopped').mic, u);
  const r = eng.act(g2, { type: 'hint' });
  assert.equal(r.events[0].fault, 'unpaired');
  // trace: read the display, compare with its receiver slot; act: set it aside; then let the skip finish
  ({ g: g2 } = run(g2, { type: 'inspect', device: u }, { type: 'go', scene: 'foh-rack-closeup' }, { type: 'talk', device: u }));
  const v = eng.view(g2);
  assert.notDeepEqual({ group: v.lcd[u].group, channel: v.lcd[u].channel }, v.rfRx[u], 'the player can see the mismatch');
  g2 = run(g2, { type: 'go', scene: 'foh-mic-drawer' }).g;
  for (const m of v.held) g2 = run(g2, { type: 'put', place: m === u ? 'bad' : 'chair', device: m }).g;
  ({ g: g2, events } = run(g2, { type: 'check_rest' }));
  const done = eng.view(g2);
  assert.equal(done.objective.complete, true);
  assert.equal(done.objective.verified, 15); assert.equal(done.objective.setAside, 1);
  assert.ok(events.some(e => e.type === 'objective-complete' && /15 verified, 1 set aside/.test(e.text)));
  const d = eng.debrief(g2);
  assert.deepEqual(d.loops, { 'battery-reversed': { notice: true, trace: true, act: true, verify: true }, unpaired: { notice: true, trace: true, act: true, verify: true } });
  const text = d.lines.join('\n');
  assert.match(text, /Ready: 15 mics verified at the X32 and 1 set aside/);
  assert.match(text, /was not paired with its receiver/);
  assert.match(text, /NOTICE ✓ .*Check the rest stopped on Mic \d+/);
  assert.match(text, /ACT ✓ .*you put Mic \d+ .* back in the drawer as a bad mic/);
  assert.match(text, /VERIFY ✓ a spare covers it: 15 mics verified, enough for every musician \(13\)/);
  assert.deepEqual(d.wrongAside, []);
});

test('setting aside a mic that works (or could be fixed) is allowed, costs a spare, and the debrief says so', () => {
  const g0 = eng.start('VJ-48217'), f = fdev(g0), ok = healthy(g0)[0];
  let { g } = run(g0, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: ok }, { type: 'pick_up', device: f },
    { type: 'insert_batteries', device: f }, { type: 'press', how: 'hold', device: f }, { type: 'put', place: 'bad', device: f }, { type: 'put', place: 'bad', device: ok });
  const d = eng.debrief(g);
  assert.deepEqual(d.wrongAside.sort(), [f, ok].sort());
  const warn = d.lines.find(l => l.startsWith('⚠️'));
  assert.match(warn, /take the batteries out and put them back the right way round/);
  assert.match(warn, /\(it worked\)/);
  assert.match(d.lines.join('\n'), /not paired[^\n]*\n  NOTICE ✗ not yet\./, 'an untouched fault reads "not yet", not as a mistake');
  assert.equal(d.loop.act, false, 'setting aside is not the fix for reversed batteries');
});

test('too many set aside and not every musician has a mic: not ready; picking them back up recovers', () => {
  let g = eng.start('VJ-48217', { only: ['battery-reversed'] });
  const aside = healthy(g).slice(0, 4);
  g = run(g, { type: 'go', scene: 'foh-mic-drawer' }, ...aside.flatMap(m => [{ type: 'pick_up', device: m }, { type: 'put', place: 'bad' }])).g;
  for (const m of g.inPlay.filter(m => !aside.includes(m))) {
    g = run(g, ...takeAndPower(m)).g;
    if (g.devices[m].state.battery === 'reversed') g = run(g, ...fixBatteries).g;
    g = run(g, { type: 'go', scene: 'x32-top' }, { type: 'talk' }, { type: 'put', place: 'chair' }).g;
  }
  let v = eng.view(g);
  assert.equal(v.objective.verified, 12);
  assert.equal(v.objective.complete, false, '12 < 13: a musician would have no mic');
  assert.match(eng.debrief(g).lines[0], /every musician needs a mic \(13\)/);
  g = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: aside[0] }, { type: 'insert_batteries' }, { type: 'press', how: 'hold' },
    { type: 'go', scene: 'x32-top' }, { type: 'talk' }, { type: 'put', place: 'chair' }).g;
  assert.equal(eng.view(g).objective.complete, true, '13 verified, 3 set aside');
});

test('hints aim at the problem in front of you: a failed mic in hand first, and never at one you have not noticed yet', () => {
  const g0 = eng.start('VJ-48217'), f = fdev(g0), u = fdev(g0, 'unpaired');
  const target = g => eng.act(g, { type: 'hint' }).events[0].fault;
  let g = run(g0, ...takeAndPower(u)).g;                                   // unpaired mic in hand, on, nothing noticed yet
  assert.equal(target(g), 'battery-reversed', 'holding it does not give it away');
  g = run(g, { type: 'go', scene: 'x32-top' }, { type: 'talk' }, { type: 'put', place: 'chair' }).g;   // now seen failing
  assert.equal(target(g), 'unpaired');
  g = run(g, ...takeAndPower(f)).g;                                        // the reversed one: in hand and seen failing (won't switch on)
  assert.equal(target(g), 'battery-reversed', 'both seen failing: the one in your hand');
  g = run(g, { type: 'put', place: 'drawer' }, { type: 'go', scene: 'x32-top' }, { type: 'pick_up', device: u }).g;
  assert.equal(target(g), 'unpaired', 'and the other way round');
});

