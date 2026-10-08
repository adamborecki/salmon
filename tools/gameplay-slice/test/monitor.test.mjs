// Monitor setup engine rules. Run: node --test tools/gameplay-slice/test/monitor.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monitorEngine } from '../monitor-engine.js';

const mc = JSON.parse(readFileSync(new URL('../content/vj-monitors.json', import.meta.url)));
const G = JSON.parse(readFileSync(new URL('../../../docs/scene-graph.json', import.meta.url)));
const eng = monitorEngine(mc, G);
const SC = mc.scenes;
function run(g, ...actions) {
  const events = [];
  for (const a of actions) { const r = eng.act(g, a); assert.equal(r.error, null, `${JSON.stringify(a)}: ${r.error && r.error.message}`); g = r.game; events.push(...r.events); }
  return { g, events };
}
// shortest route through the scene graph, as go actions
function route(from, to) {
  const prev = { [from]: null }, q = [from];
  const next = s => [...G.edges.filter(e => e.from === s).map(e => e.to), ...G.edges.filter(e => e.to === s && e.kind !== 'walk').map(e => e.from)];
  while (q.length) { const s = q.shift(); if (s === to) break; for (const n of next(s)) if (!(n in prev)) { prev[n] = s; q.push(n); } }
  if (!(to in prev)) throw new Error(`no route from ${from} to ${to}`);
  const out = []; for (let s = to; s !== from; s = prev[s]) out.unshift({ type: 'go', scene: s });
  return out;
}
const walk = (g, to) => run(g, ...route(g.scene, to)).g;
const fresh = (opts = {}) => eng.start('MN-T', { faults: [], ...opts });
// the whole job, the way Cary does it: two wedges, then one; cables; power; test
function setUp(g, { channel = 'A' } = {}) {
  g = walk(g, SC.storage); g = run(g, { type: 'take', count: 2 }).g;
  g = walk(g, SC.stage); g = run(g, { type: 'place', spot: 'left' }, { type: 'place', spot: 'center' }).g;
  g = walk(g, SC.storage); g = run(g, { type: 'take', count: 1 }).g;
  g = walk(g, SC.stage); g = run(g, { type: 'place', spot: 'right' }).g;
  g = walk(g, SC.rack_rear);
  g = run(g, { type: 'cable', cable: 'run' }, { type: 'cable', cable: 'link1' }, { type: 'cable', cable: 'link2' }).g;
  if (!g.cables.run.ends.a) g = run(g, { type: 'plug', cable: 'run', jack: `nx3000:${channel}` }).g;
  g = walk(g, SC.stage);
  g = run(g, { type: 'plug', cable: 'run', jack: 'w1:1' }, { type: 'plug', cable: 'link1', jack: 'w1:2' }, { type: 'plug', cable: 'link1', jack: 'w2:1' },
    { type: 'plug', cable: 'link2', jack: 'w2:2' }, { type: 'plug', cable: 'link2', jack: 'w3:1' }).g;
  g = walk(g, SC.rack_front); g = run(g, { type: 'switch', device: 'furman' }, { type: 'switch', device: 'nx3000' }).g;
  return walk(g, SC.stage);
}
const test_ = (g) => run(g, { type: 'a1', play: 'bus1' }, { type: 'listen' });

test('start: at FOH, wedges in storage, cables on the hook, the rack off; faults by seed', () => {
  const g = fresh();
  assert.equal(g.scene, 'foh-wide');
  assert.deepEqual(Object.values(g.wedges).map(w => w.at), ['storage', 'storage', 'storage']);
  assert.deepEqual(Object.values(g.cables).map(c => c.at), ['hook', 'hook', 'hook']);
  assert.deepEqual(g.rack, { furman: 'off', nx3000: 'off' });
  assert.deepEqual(eng.start('MN-5').faults, eng.start('MN-5').faults, 'same seed, same faults');
  const counts = { 'run-in-ch-b': 0, 'loose-speakon': 0 };
  for (let i = 0; i < 200; i++) for (const f of eng.start('S' + i).faults) counts[f.id]++;
  assert.ok(counts['run-in-ch-b'] > 60 && counts['run-in-ch-b'] < 140 && counts['loose-speakon'] > 60 && counts['loose-speakon'] < 140, JSON.stringify(counts));
  assert.equal(eng.start('X', { faults: ['run-in-ch-b'] }).cables.run.ends.a, 'nx3000:B');
});

test('walking costs time by distance, more when carrying; only along the scene graph', () => {
  let g = fresh();
  assert.equal(eng.act(g, { type: 'go', scene: SC.storage }).error.code, 'no-way');
  const t0 = g.t; g = walk(g, SC.storage); const empty = g.t - t0;
  assert.ok(empty > 5, `foh -> storage took ${empty} s`);
  g = run(g, { type: 'take', count: 1 }).g; let t1 = g.t; const g1 = walk(g, SC.stage); const one = g1.t - t1;
  g = run(g, { type: 'take', count: 1 }).g; t1 = g.t; const g2 = walk(g, SC.stage); const two = g2.t - t1;
  assert.ok(two > one, `two wedges (${two} s) are slower than one (${one} s)`);
});

test('carrying: two at most, only in the storage closet; failed lifts cost time', () => {
  let g = fresh();
  assert.equal(eng.act(g, { type: 'take', count: 1 }).error.code, 'not-here');
  g = walk(g, SC.storage);
  assert.equal(eng.act(g, { type: 'take', count: 3 }).error.code, 'hands-full');
  const t = g.t; g = run(g, { type: 'take', count: 2, fails: 2 }).g;
  assert.equal(g.t - t, mc.clock.take_s * 3);
  assert.equal(eng.act(g, { type: 'take', count: 1 }).error.code, 'hands-full');
  assert.deepEqual(eng.view(g).carrying, ['w1', 'w2']);
  assert.equal(eng.view(g).left, 1);
});

test('placing: on stage, one per spot; a plugged wedge must be unplugged before it moves', () => {
  let g = walk(fresh(), SC.storage); g = run(g, { type: 'take', count: 2 }).g;
  assert.equal(eng.act(g, { type: 'place', spot: 'left' }).error.code, 'not-here');
  g = walk(g, SC.stage); g = run(g, { type: 'place', spot: 'left' }).g;
  assert.equal(eng.act(g, { type: 'place', spot: 'left' }).error.code, 'taken');
  g = walk(g, SC.rack_rear); g = run(g, { type: 'cable', cable: 'run' }).g; g = walk(g, SC.stage);
  g = run(g, { type: 'plug', cable: 'run', jack: 'w1:1' }).g;
  assert.equal(eng.act(g, { type: 'pick_up', spot: 'left' }).error.code, 'plugged');
  assert.equal(eng.act(g, { type: 'plug', cable: 'run', jack: 'w2:1' }).error.code, 'not-placed', 'w2 is still in my hands');
});

test('cables: off the hook at the rack rear; jacks only where they are; one plug per jack; links are short', () => {
  let g = fresh();
  g = walk(g, SC.rack_front);
  assert.equal(eng.act(g, { type: 'cable', cable: 'run' }).error.code, 'not-here');
  g = walk(g, SC.rack_rear); g = run(g, { type: 'cable', cable: 'run' }, { type: 'cable', cable: 'link1' }).g;
  assert.equal(eng.act(g, { type: 'plug', cable: 'run', jack: 'w1:1' }).error.code, 'not-here');
  g = run(g, { type: 'plug', cable: 'run', jack: 'nx3000:A' }).g;
  assert.equal(eng.act(g, { type: 'plug', cable: 'link1', jack: 'nx3000:A' }).error.code, 'occupied');
  g = run(g, { type: 'plug', cable: 'link1', jack: 'nx3000:B' }).g;
  g = walk(g, SC.storage); g = run(g, { type: 'take', count: 1 }).g; g = walk(g, SC.stage); g = run(g, { type: 'place', spot: 'left' }).g;
  assert.equal(eng.act(g, { type: 'plug', cable: 'link1', jack: 'w1:1' }).error.code, 'too-short');
  g = run(g, { type: 'plug', cable: 'run', jack: 'w1:1' }).g;
  assert.equal(eng.act(g, { type: 'plug', cable: 'run', jack: 'w1:2' }).error.code, 'both-plugged');
});

test('the whole job: two then one, cabled and chained, Furman then NX3000, Wii Shop through Bus 1 = all three heard', () => {
  let g = setUp(fresh());
  assert.deepEqual(eng.view(g).steps.map(s => s.done), [true, true, true, false]);
  const { g: g2, events } = test_(g);
  assert.ok(events.some(e => e.type === 'listen' && /all three wedges/.test(e.text)));
  assert.ok(events.some(e => e.type === 'objective-complete'));
  const d = eng.debrief(g2);
  assert.equal(d.ready, true);
  assert.match(d.lines[0], /Monitors ready/);
  assert.match(d.lines.join('\n'), /2 trips with wedges \(2 \+ 1\)/);
  assert.equal(d.intoB, 0); assert.equal(d.earlyAmp, false);
});

test('nothing plays until it is all there: no playback, the mains, the rack off, or a missing link', () => {
  let g = setUp(fresh());
  let ev = run(g, { type: 'listen' }).events;
  assert.match(ev[0].text, /Nothing is playing through Bus 1/);
  ev = run(g, { type: 'a1', play: 'mains' }, { type: 'listen' }).events;
  assert.ok(ev.some(e => /You hear it through the mains/.test(e.text)) && ev.find(e => e.type === 'listen').result.every(x => !x.playing));
  let g2 = walk(g, SC.rack_front); g2 = run(g2, { type: 'switch', device: 'nx3000' }).g; g2 = walk(g2, SC.stage);
  assert.ok(test_(g2).events.find(e => e.type === 'listen').result.every(x => !x.playing), 'amp off: silent');
  const g3 = run(g, { type: 'unplug', jack: 'w3:1' }).g;
  const res = test_(g3).events.find(e => e.type === 'listen').result;
  assert.deepEqual(res.map(x => x.playing), [true, true, false], 'the last wedge is off the chain');
});

test('the NX3000 before the Furman: nothing lights up until the Furman; the debrief notes the order', () => {
  let g = walk(fresh(), SC.rack_front);
  const ev = run(g, { type: 'switch', device: 'nx3000' }).events;
  assert.match(ev[0].text, /nothing lights up: the Furman is off/);
  let rigged = walk(setUp(fresh()), SC.rack_front); rigged = run(rigged, { type: 'switch', device: 'furman' }).g;     // Furman off, NX3000 still on
  assert.equal(eng.view(rigged).front.powerLed, false);
  assert.ok(test_(walk(rigged, SC.stage)).events.find(e => e.type === 'listen').result.every(x => !x.playing), 'no Furman, no amp');
  g = run(g, { type: 'switch', device: 'nx3000' }, { type: 'switch', device: 'furman' }).g;
  assert.equal(eng.view(g).front.powerLed, true);
  assert.match(eng.debrief(g).lines.join('\n'), /NX3000 was switched on before the Furman/);
});

test('your own mistake: the run into Channel B = silent wedges; the CH A SIGNAL light still moves; move it to A', () => {
  let g = setUp(fresh(), { channel: 'B' });
  let r = test_(g);
  assert.ok(r.events.find(e => e.type === 'listen').result.every(x => !x.playing));
  g = walk(r.g, SC.rack_front);
  assert.deepEqual(eng.view(g).front.sig, { A: true, B: false });
  g = walk(g, SC.rack_rear); g = run(g, { type: 'unplug', jack: 'nx3000:B' }, { type: 'plug', cable: 'run', jack: 'nx3000:A' }).g;
  g = walk(g, SC.stage); r = run(g, { type: 'listen' });
  assert.ok(r.events.some(e => e.type === 'objective-complete'));
  assert.match(eng.debrief(r.g).lines.join('\n'), /plugged a cable into Channel B once: Bus 1 comes in on Channel A, and you moved it/);
});

test('fault: the run left in Channel B; notice (silent), trace (amp lights or rear), act (move to A), verify (all heard)', () => {
  let g = setUp(eng.start('MN-T', { faults: ['run-in-ch-b'] }));
  assert.equal(g.cables.run.ends.a, 'nx3000:B', 'it came off the hook already in Channel B');
  g = test_(g).g;
  assert.equal(eng.act(g, { type: 'hint' }).events[0].about, 'run-in-ch-b');
  g = walk(g, SC.rack_rear);
  g = run(g, { type: 'unplug', jack: 'nx3000:B' }, { type: 'plug', cable: 'run', jack: 'nx3000:A' }).g;
  g = walk(g, SC.stage); g = run(g, { type: 'listen' }).g;
  assert.deepEqual(eng.debrief(g).loops['run-in-ch-b'], { notice: true, trace: true, act: true, verify: true });
});

test('fault: a speakON that will not lock; part of the chain is silent; reseating along the flow finds it', () => {
  // the 4th speakON plug is link1 into w2:1 (run at the amp, run at w1, link1 at w1, then link1 at w2): wedges 2 and 3 go silent
  let g = setUp(eng.start('MN-T', { faults: ['loose-speakon'], looseAt: 4 }));
  assert.deepEqual(g.loose, { cable: 'link1', end: 'b', jack: 'w2:1' });
  assert.deepEqual(eng.view(g).steps.map(s => s.done).slice(0, 3), [true, true, true], 'it looks plugged in');
  let r = test_(g);
  assert.deepEqual(r.events.find(e => e.type === 'listen').result.map(x => x.playing), [true, false, false]);
  g = r.g;
  const h = [1, 2, 3].map(() => { const x = eng.act(g, { type: 'hint' }); g = x.game; return x.events[0].text; });
  assert.match(h[2], /Wedge 2 jack 1 isn't locked/);
  r = run(g, { type: 'reseat', jack: 'w1:2' }, { type: 'reseat', jack: 'w2:1' });
  assert.ok(r.events.some(e => e.type === 'reseat' && !e.wasLoose && /already locked/.test(e.text)));
  assert.ok(r.events.some(e => e.type === 'reseat' && e.wasLoose && /clicks\. Locked/.test(e.text)));
  g = run(r.g, { type: 'listen' }).g;
  const d = eng.debrief(g);
  assert.equal(d.ready, true);
  assert.deepEqual(d.loops['loose-speakon'], { notice: true, trace: true, act: true, verify: true });
  assert.match(d.lines.join('\n'), /2 connectors reseated to find it/);
});

test('fixed is not verified: any change to the chain after hearing it re-opens the test', () => {
  let g = test_(setUp(fresh())).g;
  assert.equal(eng.view(g).complete, true);
  g = run(g, { type: 'unplug', jack: 'w3:1' }, { type: 'plug', cable: 'link2', jack: 'w3:1' }).g;
  assert.equal(eng.view(g).heardCount, 0, 'heard before the change does not count after it');
  g = run(g, { type: 'listen' }).g;
  assert.equal(eng.view(g).heardCount, 3);
});

test('hints follow what is missing: wedges, run, chain, power, then the test', () => {
  const key = g => { const r = eng.act(g, { type: 'hint' }); return r.events[0].about; };
  let g = fresh();
  assert.equal(key(g), 'wedges');
  g = walk(g, SC.storage); g = run(g, { type: 'take', count: 2 }).g; g = walk(g, SC.stage); g = run(g, { type: 'place', spot: 'left' }, { type: 'place', spot: 'center' }).g;
  g = walk(g, SC.storage); g = run(g, { type: 'take', count: 1 }).g; g = walk(g, SC.stage); g = run(g, { type: 'place', spot: 'right' }).g;
  assert.equal(key(g), 'run');
  g = walk(g, SC.rack_rear); g = run(g, { type: 'cable', cable: 'run' }, { type: 'plug', cable: 'run', jack: 'nx3000:A' }).g;
  g = walk(g, SC.stage); g = run(g, { type: 'plug', cable: 'run', jack: 'w1:1' }).g;
  assert.equal(key(g), 'chain');
  let off = walk(setUp(fresh()), SC.rack_front); off = run(off, { type: 'switch', device: 'nx3000' }).g;
  assert.equal(key(off), 'power');
  assert.equal(key(setUp(fresh())), 'verify');
});

test('no soft-locks: after random actions, the same recovery always completes', () => {
  const R = (() => { let s = 4242; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
  const jacks = ['nx3000:A', 'nx3000:B', 'w1:1', 'w1:2', 'w2:1', 'w2:2', 'w3:1', 'w3:2'], cables = ['run', 'link1', 'link2'], spots = ['left', 'center', 'right'];
  const pick = a => a[Math.floor(R() * a.length)];
  for (let trial = 0; trial < 100; trial++) {
    let g = eng.start('SL-' + trial);
    for (let i = 0; i < 80; i++) {
      const outs = [...G.edges.filter(e => e.from === g.scene).map(e => e.to), ...G.edges.filter(e => e.to === g.scene && e.kind !== 'walk').map(e => e.from)];
      const pool = [outs.length && { type: 'go', scene: pick(outs) }, { type: 'take', count: 1 + (R() < .5) }, { type: 'place', spot: pick(spots) }, { type: 'pick_up', spot: pick(spots) },
        { type: 'cable', cable: pick(cables) }, { type: 'plug', cable: pick(cables), jack: pick(jacks) }, { type: 'unplug', jack: pick(jacks) }, { type: 'reseat', jack: pick(jacks) },
        { type: 'switch', device: R() < .5 ? 'furman' : 'nx3000' }, { type: 'a1', play: pick(['bus1', 'mains', 'stop']) }, { type: 'listen' }, { type: 'hint' }].filter(Boolean);
      g = eng.act(g, pick(pool)).game;
    }
    // recovery: unplug everything, put wedges back to rights, cable A -> w1 -> w2 -> w3, power, test
    g = walk(g, SC.rack_rear); for (const j of ['nx3000:A', 'nx3000:B']) if (eng.act(g, { type: 'unplug', jack: j }).error == null) g = run(g, { type: 'unplug', jack: j }).g;
    for (const c of cables) if (g.cables[c].at === 'hook') g = run(g, { type: 'cable', cable: c }).g;
    g = walk(g, SC.stage); for (const j of jacks.slice(2)) if (eng.act(g, { type: 'unplug', jack: j }).error == null) g = run(g, { type: 'unplug', jack: j }).g;
    for (const c of cables) for (const end of ['a', 'b']) if (g.cables[c].ends[end]) { g = walk(g, g.cables[c].ends[end].startsWith('nx') ? SC.rack_rear : SC.stage); g = run(g, { type: 'unplug', jack: g.cables[c].ends[end] }).g; }
    g = walk(g, SC.stage);
    for (const s of spots) if (g.spots[s] && g.spots[s] !== { left: 'w1', center: 'w2', right: 'w3' }[s]) { if (g.carrying.length >= 2) { const free = spots.find(x => !g.spots[x]); g = run(g, { type: 'place', spot: free }).g; } g = run(g, { type: 'pick_up', spot: s }).g; }
    for (let k = 0; k < 6 && !spots.every(s => g.spots[s]); k++) {
      for (const s of spots) if (!g.spots[s] && g.carrying.length) g = run(g, { type: 'place', spot: s }).g;
      if (!spots.every(s => g.spots[s])) { g = walk(g, SC.storage); const n = Math.min(2 - g.carrying.length, Object.values(g.wedges).filter(w => w.at === 'storage').length); if (n > 0) g = run(g, { type: 'take', count: n }).g; g = walk(g, SC.stage); }
    }
    const [wl, wc, wr] = spots.map(s => g.spots[s]);
    g = walk(g, SC.rack_rear); g = run(g, { type: 'plug', cable: 'run', jack: 'nx3000:A' }).g;
    g = walk(g, SC.stage); g = run(g, { type: 'plug', cable: 'run', jack: `${wl}:1` }, { type: 'plug', cable: 'link1', jack: `${wl}:2` }, { type: 'plug', cable: 'link1', jack: `${wc}:1` },
      { type: 'plug', cable: 'link2', jack: `${wc}:2` }, { type: 'plug', cable: 'link2', jack: `${wr}:1` }).g;
    if (g.loose) { g = walk(g, g.loose.jack.startsWith('nx') ? SC.rack_rear : SC.stage); g = run(g, { type: 'reseat', jack: g.loose.jack }).g; }
    g = walk(g, SC.rack_front); if (g.rack.furman !== 'on') g = run(g, { type: 'switch', device: 'furman' }).g; if (g.rack.nx3000 !== 'on') g = run(g, { type: 'switch', device: 'nx3000' }).g;
    g = walk(g, SC.stage); g = run(g, { type: 'a1', play: 'bus1' }, { type: 'listen' }).g;
    assert.equal(eng.view(g).complete, true, `trial ${trial} did not recover`);
  }
});
