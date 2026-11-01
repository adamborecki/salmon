// Teardown engine rules. Run: node --test tools/gameplay-slice/test/teardown.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teardownEngine } from '../teardown-engine.js';

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const tc = read('../content/vj-teardown.json'), mc = read('../content/vj-monitors.json'), bc = read('../content/vj-battery-in-check.json');
const G = read('../../../docs/scene-graph.json');
const eng = teardownEngine(tc, G, bc.devices, mc);
const SC = tc.scenes;
const MICS = Object.keys(bc.devices).filter(id => bc.devices[id].type === 'wireless-handheld').sort((a, b) => bc.devices[a].channel - bc.devices[b].channel);
function run(g, ...actions) {
  const events = [];
  for (const a of actions) { const r = eng.act(g, a); assert.equal(r.error, null, `${JSON.stringify(a)}: ${r.error && r.error.message}`); g = r.game; events.push(...r.events); }
  return { g, events };
}
function route(from, to) {
  const prev = { [from]: null }, q = [from];
  const next = s => [...G.edges.filter(e => e.from === s).map(e => e.to), ...G.edges.filter(e => e.to === s && e.kind !== 'walk').map(e => e.from)];
  while (q.length) { const s = q.shift(); if (s === to) break; for (const n of next(s)) if (!(n in prev)) { prev[n] = s; q.push(n); } }
  if (!(to in prev)) throw new Error(`no route from ${from} to ${to}`);
  const out = []; for (let s = to; s !== from; s = prev[s]) out.unshift({ type: 'go', scene: s });
  return out;
}
const walk = (g, to) => run(g, ...route(g.scene, to)).g;
const fresh = (opts = {}) => eng.start('TD-T', { faults: [], ...opts });
const byHand = (g, id) => run(g, { type: 'unload', device: id }, { type: 'cells', device: id, to: g.mics[id].alk ? 'bin' : 'charger' }, { type: 'stow', device: id }).g;
// the whole job in the procedure's order
function mics(g) {
  g = walk(g, SC.drawer);
  for (const id of MICS.slice(0, 3)) g = byHand(g, id);
  let r = eng.act(g, { type: 'rest' }); g = r.game;
  while (r.events.some(e => e.type === 'rest-stopped')) { const id = r.events[0].device; g = run(g, { type: 'cells', device: id, to: 'bin' }, { type: 'stow', device: id }).g; r = eng.act(g, { type: 'rest' }); if (r.error) r = eng.act(g, { type: 'count' }); g = r.game; }
  return g;
}
function monitors(g) {
  g = walk(g, SC.rack_front); g = run(g, { type: 'switch', device: 'nx3000' }, { type: 'switch', device: 'furman' }).g;
  g = walk(g, SC.rack_rear); g = run(g, { type: 'unplug', jack: 'nx3000:A' }).g;
  g = walk(g, SC.stage); g = run(g, ...['w1:1', 'w1:2', 'w2:1', 'w2:2', 'w3:1'].map(jack => ({ type: 'unplug', jack }))).g;
  g = run(g, { type: 'lift', count: 2 }).g; g = walk(g, SC.storage); g = run(g, { type: 'put_away' }).g;
  g = walk(g, SC.stage); g = run(g, { type: 'lift', count: 1 }).g; g = walk(g, SC.storage); g = run(g, { type: 'put_away' }).g;
  g = walk(g, SC.rack_rear); return run(g, ...['run', 'link1', 'link2'].map(cable => ({ type: 'hang', cable }))).g;
}
const lockUp = g => run(walk(g, SC.door), { type: 'door', do: 'close_fixed' }, { type: 'door', do: 'push' }, { type: 'door', do: 'bolt' }, { type: 'door', do: 'close' }, { type: 'door', do: 'tug' });
const wireless = g => run(walk(g, SC.wireless_rack), { type: 'switch', device: 'wireless' }).g;

test('start: mics on the chair, both racks on, the wedges cabled on stage; faults by seed', () => {
  const g = fresh();
  assert.equal(g.scene, 'foh-wide');
  assert.ok(MICS.every(id => g.mics[id].at === 'chair' && g.mics[id].cells === 'in'));
  assert.equal(g.wireless, 'on'); assert.deepEqual(g.rack, { furman: 'on', nx3000: 'on' });
  assert.deepEqual(g.cables.run.ends, { a: 'nx3000:A', b: 'w1:1' });
  assert.deepEqual(eng.start('TD-5').faults, eng.start('TD-5').faults, 'same seed, same faults');
  const n = {}; for (let i = 0; i < 200; i++) for (const f of eng.start('S' + i).faults) n[f.id] = (n[f.id] || 0) + 1;
  assert.ok(n['mic-left-on-stage'] > 110 && n['alkaline-cells'] > 80 && n['door-gap'] > 100, JSON.stringify(n));
  const s = eng.start('X', { faults: ['mic-left-on-stage', 'alkaline-cells'] }), lost = s.faults[0].device;
  assert.equal(s.mics[lost].at, 'stage'); assert.equal(s.mics[lost].on, true);
  assert.equal(bc.devices[lost].role, 'musician');
  assert.notEqual(s.faults[1].device, lost, 'the alkaline mic is one on the chair');
});

test('a mic: batteries out, cells sorted, then the drawer, all at the mic drawer', () => {
  let g = fresh(); const id = MICS[0];
  assert.equal(eng.act(g, { type: 'unload', device: id }).error.code, 'not-here');
  g = walk(g, SC.drawer);
  assert.equal(eng.act(g, { type: 'stow', device: id }).error.code, 'cells-in');
  g = run(g, { type: 'unload', device: id }).g;
  assert.equal(eng.act(g, { type: 'stow', device: id }).error.code, 'cells-in-hand');
  g = run(g, { type: 'cells', device: id, to: 'charger' }, { type: 'stow', device: id }).g;
  assert.equal(g.mics[id].at, 'drawer'); assert.equal(g.mics[id].cells, 'charger');
});

test('"Stow the rest" only after three by hand; it stops at alkaline cells', () => {
  const alk = MICS[8];
  let g = walk(fresh({ faults: ['alkaline-cells'], alkaline: alk }), SC.drawer);
  g = byHand(g, MICS[0]); g = byHand(g, MICS[1]);
  assert.equal(eng.act(g, { type: 'rest' }).error.code, 'not-yet');
  g = byHand(g, MICS[2]);
  const r = eng.act(g, { type: 'rest' }); g = r.game;
  assert.ok(r.events.some(e => e.type === 'rest-stopped' && e.device === alk));
  assert.equal(g.mics[alk].cells, 'hand'); assert.equal(g.mics[MICS[9]].at, 'chair', 'it stops there');
  assert.equal(eng.view(g).hintsLeft, 3);
  const h = eng.act(g, { type: 'hint' }); assert.equal(h.events[0].about, 'alkaline-cells');
});

test('alkalines on the charger: allowed, flagged, and it blocks the finish until they go in the bin', () => {
  const alk = MICS[0];
  let g = mics(fresh({ faults: ['alkaline-cells'], alkaline: MICS[5] }));   // a clean run for comparison
  g = lockUp(monitors(wireless(g))).g; assert.ok(eng.view(g).complete);
  g = walk(fresh({ faults: ['alkaline-cells'], alkaline: alk }), SC.drawer);
  const r = run(g, { type: 'unload', device: alk }, { type: 'cells', device: alk, to: 'charger' }); g = r.g;
  assert.ok(r.events.some(e => /Never/.test(e.text)));
  g = run(g, { type: 'stow', device: alk }).g;
  g = byHand(g, MICS[1]); g = byHand(g, MICS[2]); g = run(g, { type: 'rest' }).g;
  assert.equal(eng.view(g).inDrawer, MICS.length, 'every mic is in the drawer');
  assert.equal(eng.view(g).steps.find(s => s.id === 'mics').done, false, 'but the alkalines are on the charger');
  assert.match(eng.debrief(g).lines.join('\n'), /went on the charger/);
  g = run(g, { type: 'cells', device: alk, to: 'bin' }).g;
  assert.equal(g.log.at(-1).fixedFault, 'alkaline-cells');
});

test('the mic left on stage: count, the receivers show it, fetch it, count again (the full loop)', () => {
  const lost = MICS[6];
  let g = mics(fresh({ faults: ['mic-left-on-stage'], leftOnStage: lost }));
  assert.equal(eng.view(g).inDrawer, MICS.length - 1);
  assert.equal(eng.act(g, { type: 'hint' }).events[0].about, 'mic-left-on-stage');
  const rx = run(walk(g, SC.receivers)); g = rx.g;
  assert.ok(rx.events.length === 0 && g.evidence.at(-1).rf.includes(lost), 'the receivers show its RF');
  g = walk(g, SC.stage); g = run(g, { type: 'take_mic', device: lost }).g;
  g = walk(g, SC.drawer); g = byHand(g, lost); g = run(g, { type: 'count' }).g;
  g = lockUp(monitors(wireless(g))).g;
  const d = eng.debrief(g);
  assert.ok(d.done); assert.deepEqual(d.loops['mic-left-on-stage'], { notice: true, trace: true, act: true, verify: true });
});

test('switching the wireless rack off first loses the RF clue, and the debrief says so', () => {
  const lost = MICS[3];
  let g = wireless(fresh({ faults: ['mic-left-on-stage'], leftOnStage: lost }));
  g = mics(g); g = walk(g, SC.receivers);
  assert.deepEqual(g.evidence.at(-1).rf, []);
  g = walk(g, SC.stage); g = run(g, { type: 'take_mic', device: lost }).g;
  const d = eng.debrief(g);
  assert.equal(d.loops['mic-left-on-stage'].trace, false);
  assert.match(d.lines.join('\n'), /could have told you/);
});

test('the amp: speakONs pulled with it on are flagged; off is the NX3000, then the Furman', () => {
  let g = walk(fresh(), SC.rack_rear);
  const r = run(g, { type: 'unplug', jack: 'nx3000:A' }); g = r.g;
  assert.ok(r.events.some(e => e.type === 'hot'));
  g = walk(g, SC.rack_front); g = run(g, { type: 'switch', device: 'furman' }).g;
  const d = eng.debrief(g);
  assert.equal(d.hot, 1); assert.equal(d.badOrder, true);
  let h = monitors(fresh()); assert.equal(eng.debrief(h).hot, 0); assert.equal(eng.debrief(h).badOrder, false);
});

test('cables hang only when unplugged at both ends; wedges lift only when unplugged', () => {
  let g = walk(fresh(), SC.stage);
  assert.equal(eng.act(g, { type: 'lift', count: 1 }).error.code, 'plugged');
  g = run(g, { type: 'unplug', jack: 'w3:1' }).g;
  g = run(g, { type: 'lift', count: 1 }).g; assert.deepEqual(g.carrying, ['w3']);
  assert.equal(eng.act(g, { type: 'lift', count: 2 }).error.code, 'hands-full');
  g = walk(g, SC.rack_rear);
  assert.equal(eng.act(g, { type: 'hang', cable: 'link2' }).error.code, 'plugged');
});

test('the door: flipped isn\'t latched; with the gap it fails the tug until pushed flush (the full loop)', () => {
  let g = monitors(fresh({ faults: ['door-gap'] }));
  g = walk(g, SC.door);
  assert.equal(eng.act(g, { type: 'door', do: 'bolt' }).error.code, 'open');
  let r = run(g, { type: 'door', do: 'close_fixed' }, { type: 'door', do: 'bolt' }, { type: 'door', do: 'close' }, { type: 'door', do: 'tug' }); g = r.g;
  assert.ok(r.events.some(e => e.type === 'tug' && !e.held)); assert.equal(g.door.active, 'open', 'it swung open');
  assert.equal(eng.act(g, { type: 'hint' }).events[0].about, 'door-gap');
  assert.equal(eng.act(g, { type: 'door', do: 'push' }).error.code, 'bolted');
  r = run(g, { type: 'door', do: 'look' }, { type: 'door', do: 'bolt' }, { type: 'door', do: 'push' }, { type: 'door', do: 'bolt' }, { type: 'door', do: 'close' }); g = r.g;
  assert.equal(eng.view(g).steps.find(s => s.id === 'door').done, false, 'latched, but not proved');
  g = run(g, { type: 'door', do: 'tug' }).g;
  assert.equal(eng.view(g).steps.find(s => s.id === 'door').done, true);
  const d = eng.debrief(g); assert.deepEqual(d.loops['door-gap'], { notice: true, trace: true, act: true, verify: true });
  // pushing before the bolt is the procedure: no failure at all
  const p = lockUp(monitors(fresh({ faults: ['door-gap'] }))).g;
  assert.deepEqual(eng.debrief(p).loops['door-gap'], { prevented: true });
});

test('a shut closet blocks the way in', () => {
  let g = walk(fresh(), SC.door);
  g = run(g, { type: 'door', do: 'close_fixed' }, { type: 'door', do: 'close' }).g;
  assert.equal(eng.act(g, { type: 'go', scene: SC.storage }).error.code, 'door-shut');
});

test('the whole teardown completes only with every step done; the hint ladder follows the procedure', () => {
  let g = fresh();
  assert.equal(eng.act(g, { type: 'hint' }).events[0].about, 'mics');
  g = mics(g); assert.equal(eng.act(g, { type: 'hint' }).events[0].about, 'wireless');
  g = wireless(g); assert.equal(eng.act(g, { type: 'hint' }).events[0].about, 'amp');
  g = monitors(g); assert.equal(eng.act(g, { type: 'hint' }).events[0].about, 'door');
  assert.equal(eng.view(g).complete, false);
  const r = lockUp(g);
  assert.ok(r.events.some(e => e.type === 'objective-complete')); assert.ok(eng.view(r.g).complete);
  assert.ok(eng.debrief(r.g).done);
});

test('seeded runs replay the same', () => {
  const a = mics(eng.start('TD-77')), b = mics(eng.start('TD-77'));
  assert.deepEqual(a, b);
});
