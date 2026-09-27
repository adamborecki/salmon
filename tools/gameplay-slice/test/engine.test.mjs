// Run: node --test tools/gameplay-slice/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { engine } from '../engine.js';

const content = JSON.parse(readFileSync(new URL('../content/vj-line-check.json', import.meta.url)));
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
const checkAtX32 = mic => [{ type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: mic }, { type: 'go', scene: 'x32-top' }, { type: 'talk' }, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'put_back' }];
const healthy = g => g.inPlay.filter(m => m !== g.fault.device);

test('the seed decides which mic is muted, reproducibly, and covers every mic in play', () => {
  assert.equal(eng.start('VJ-48217').fault.device, eng.start('VJ-48217').fault.device);
  const hit = new Set();
  for (let i = 0; i < 200; i++) hit.add(eng.start('VJ-' + i).fault.device);
  assert.deepEqual([...hit].sort(), eng.start('x').inPlay.slice().sort());
  const g = eng.start('VJ-48217');
  assert.equal(g.devices[g.fault.device].state.muted, true);
  assert.equal(g.devices[g.fault.device].state.power, 'on');
});

test('a healthy mic is verified by talking into it while watching the X32', () => {
  const g0 = eng.start('VJ-1'), mic = healthy(g0)[0];
  const { g, events } = run(g0, ...checkAtX32(mic));
  assert.equal(eng.view(g).objective.mics.find(m => m.id === mic).status, 'verified');
  assert.ok(events.some(e => e.type === 'verified' && /X32 ch \d/.test(e.text)));
});

test('talking where no meter is visible gives no evidence', () => {
  const g0 = eng.start('VJ-1'), mic = healthy(g0)[0];
  const { g, events } = run(g0, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: mic }, { type: 'talk' });
  assert.equal(eng.view(g).objective.mics.find(m => m.id === mic).status, 'not-checked');
  assert.ok(events.some(e => e.type === 'no-display'));
});

test('the muted mic shows no signal at the receiver or the X32 (NOTICE)', () => {
  const g0 = eng.start('VJ-7'), f = g0.fault.device;
  let { g, events } = run(g0, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: f }, { type: 'go', scene: 'x32-top' }, { type: 'talk' });
  assert.ok(events.some(e => e.type === 'meter' && e.signal === false));
  ({ g, events } = run(g, { type: 'go', scene: 'foh-rack-closeup' }, { type: 'talk' }));
  assert.ok(events.some(e => e.type === 'meter' && e.point.startsWith('ptu6000-rx:') && e.signal === false));
  assert.equal(eng.view(g).objective.mics.find(m => m.id === f).status, 'no-signal-seen');
});

test('fixed is not verified: unmuting alone never completes the objective', () => {
  const g0 = eng.start('VJ-7'), f = g0.fault.device;
  let { g } = run(g0, ...healthy(g0).flatMap(checkAtX32));
  ({ g } = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: f }, { type: 'press', how: 'tap' }));
  const v = eng.view(g);
  assert.equal(v.objective.complete, false);
  assert.ok(v.debug.mechanicallySatisfied.includes(f), 'the path works now');
  assert.notEqual(v.objective.mics.find(m => m.id === f).status, 'verified');
  const { g: g2, events } = run(g, { type: 'go', scene: 'x32-top' }, { type: 'talk' });
  assert.equal(eng.view(g2).objective.complete, true);
  assert.ok(events.some(e => e.type === 'objective-complete'));
});

test('evidence from before a change does not count (regression needs re-verifying)', () => {
  const g0 = eng.start('VJ-7'), mic = healthy(g0)[0];
  let { g } = run(g0, ...checkAtX32(mic));
  ({ g } = run(g, { type: 'pick_up', device: mic }, { type: 'press', how: 'tap' }));        // mutes a working mic
  assert.equal(eng.view(g).objective.mics.find(m => m.id === mic).status, 'recheck');
  ({ g } = run(g, { type: 'press', how: 'tap' }));                                          // unmute again
  assert.equal(eng.view(g).objective.mics.find(m => m.id === mic).status, 'recheck', 'still needs fresh evidence');
  ({ g } = run(g, { type: 'go', scene: 'x32-top' }, { type: 'talk' }));
  assert.equal(eng.view(g).objective.mics.find(m => m.id === mic).status, 'verified');
});

test('power-cycling a muted mic does not clear the mute (content says so; flagged unknown)', () => {
  assert.equal(content.behaviour.mute_survives_power_cycle.value, true);
  const g0 = eng.start('VJ-7'), f = g0.fault.device;
  const { g } = run(g0, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: f }, { type: 'press', how: 'hold' }, { type: 'press', how: 'hold' });
  assert.deepEqual(g.devices[f].state, { power: 'on', muted: true });
});

test('tapping a switched-off mic does nothing, and says so', () => {
  const g0 = eng.start('VJ-7'), mic = healthy(g0)[0];
  const { g, events } = run(g0, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: mic }, { type: 'press', how: 'hold' }, { type: 'press', how: 'tap' });
  assert.deepEqual(g.devices[mic].state, { power: 'off', muted: false });
  assert.ok(events.some(e => e.type === 'nothing'));
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
  for (const a of [{ type: 'press', how: 'tap' }, { type: 'talk' }, { type: 'put_back' }, { type: 'pick_up', device: 'handheld-01' }, { type: 'pick_up', device: 'foh-x32' }, { type: 'fly' }]) {
    const r = eng.act(g0, a);
    assert.ok(r.error, JSON.stringify(a));
    assert.equal(r.game, g0);
  }
});

test('debrief: a systematic run gets NOTICE, TRACE, ACT, VERIFY and no extra changes', () => {
  const g0 = eng.start('VJ-48217'), f = g0.fault.device;
  let { g } = run(g0, ...healthy(g0).flatMap(checkAtX32));
  ({ g } = run(g, { type: 'pick_up', device: f }, { type: 'go', scene: 'x32-top' }, { type: 'talk' },   // NOTICE
    { type: 'go', scene: 'foh-rack-closeup' }, { type: 'talk' },                                         // TRACE: dead at the receiver too
    { type: 'inspect' }, { type: 'press', how: 'tap' },                                                  // ACT
    { type: 'go', scene: 'x32-top' }, { type: 'talk' }));                                                // VERIFY
  const d = eng.debrief(g);
  assert.deepEqual(d.loop, { notice: true, trace: true, act: true, verify: true });
  assert.equal(d.ready, true);
  assert.equal(d.changesOtherThanFix, 0);
  assert.match(d.lines.join('\n'), /Ready: all 4 mics verified/);
});

test('debrief: fixing by fiddling before noticing is reported as such, without blocking progress', () => {
  const g0 = eng.start('VJ-48217'), f = g0.fault.device;
  let { g } = run(g0, { type: 'go', scene: 'foh-mic-drawer' });
  for (const m of g.inPlay) ({ g } = run(g, { type: 'pick_up', device: m }, { type: 'press', how: 'tap' }, { type: 'put_back' }));  // tap every mic
  ({ g } = run(g, ...g.inPlay.flatMap(m => m === f ? checkAtX32(m) : [])));
  const d = eng.debrief(g);
  assert.equal(d.loop.notice, false);
  assert.equal(d.loop.act, true);
  assert.ok(d.silencedWorkingMic >= 3, 'tapping the healthy mics muted them');
  assert.equal(d.ready, false, 'the healthy mics are now muted');
  assert.match(d.lines.join('\n'), /still silent/);
});

test('no soft-locks: after any random sequence of actions, the same recovery always completes', () => {
  const scenes = ['foh-wide', 'foh-mic-drawer', 'x32-top', 'foh-rack-closeup', 'storage-closet'];
  const R = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
  for (let trial = 0; trial < 150; trial++) {
    let g = eng.start('SL-' + trial);
    for (let i = 0; i < 60; i++) {
      const pool = [{ type: 'go', scene: scenes[Math.floor(R() * scenes.length)] }, { type: 'pick_up', device: g.inPlay[Math.floor(R() * g.inPlay.length)] },
        { type: 'put_back' }, { type: 'press', how: R() < .5 ? 'tap' : 'hold' }, { type: 'talk' }, { type: 'inspect' }, { type: 'hint' }];
      g = eng.act(g, pool[Math.floor(R() * pool.length)]).game;   // rejected actions just leave g as is
    }
    // recovery: go to the drawer, put down whatever you hold, then for every mic make it on + unmuted and verify at the X32
    let r = run(g, { type: 'go', scene: 'foh-mic-drawer' }); g = r.g;
    if (g.holding) g = run(g, { type: 'put_back' }).g;
    for (const m of g.inPlay) {
      g = run(g, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'pick_up', device: m }).g;
      if (g.devices[m].state.power === 'off') g = run(g, { type: 'press', how: 'hold' }).g;
      if (g.devices[m].state.muted) g = run(g, { type: 'press', how: 'tap' }).g;
      g = run(g, { type: 'go', scene: 'x32-top' }, { type: 'talk' }, { type: 'go', scene: 'foh-mic-drawer' }, { type: 'put_back' }).g;
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
  for (const m of g.inPlay) assert.deepEqual(eng.path(m).map(p => p.split(':')[0]), [m, 'ptu6000-rx', 'foh-x32']);
});
