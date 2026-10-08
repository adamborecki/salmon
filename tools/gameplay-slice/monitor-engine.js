// Gameplay slice engine, part 0: the monitors (Cary, 2026-10-08; PRODUCT_DESIGN sections 30, 31, 41, 42, 43).
// The A2 gets the three wedges from the storage closet onto the stage, runs the long speakON cable from the
// NX3000 to the first wedge and daisy-chains the others, powers the Monitor Rack (the Furman, then the NX3000),
// and proves every wedge with known playback through Bus 1. It happens at the same time as the mics.
// Pure functions over plain JSON state, like engine.js and line-engine.js.
//
//   const eng = monitorEngine(content, graph);       // graph: { nodes, edges } (walk distances come from it)
//   let g = eng.start('MN-12345');
//   ({ game: g, events, error } = eng.act(g, { type: 'go', scene: 'center-wide' }));
//
// Actions: go {scene} · take {count: 1|2, fails} (wedges, at the storage closet; `fails` = failed lifts, from the
//          page's strength minigame) · place {spot} · pick_up {spot} · cable {cable} (off the hook) · plug {cable, jack}
//          · unplug {jack} · reseat {jack} (unplug, push, twist until it locks) · switch {device: furman|nx3000} · a1 {play: bus1|mains|stop} · listen · hint
//
// Key rule (section 3): a wedge counts only when heard playing Bus 1 playback after the last change to the
// monitor chain (any cable, wedge or power change). Signal: Bus 1 -> the NX3000's CH A input -> CH A output ->
// whatever wedges are connected to it through cables (a wedge's two jacks are wired together).

import { clockText } from './engine.js';

const clone = o => JSON.parse(JSON.stringify(o));
function hashSeed(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
function rng(seed) { let a = hashSeed(seed); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const toSec = hms => { const [h, m, s] = hms.split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };

export function monitorEngine(content, graph) {
  const C = content.clock, SC = content.scenes, W = content.wedges, SP = content.spots, CB = content.cables, R = content.rack;
  const FS = content.faults, FBY = Object.fromEntries(FS.map(f => [f.id, f])), H = content.hints;
  const WIDS = Object.keys(W).filter(k => W[k] && W[k].label), SPOTS = Object.keys(SP).filter(k => SP[k] && SP[k].label);
  const CIDS = Object.keys(CB).filter(k => CB[k] && CB[k].label), AMPJ = R.nx3000.channels.map(c => `nx3000:${c}`);
  const LIVE = `nx3000:${R.nx3000.bus1_input}`;
  const edges = graph.edges;
  // a walk along the graph, or back out of a close-up / turn the way you came (those links are one-way in the graph)
  const edgeOf = (a, b) => edges.find(e => e.from === a && e.to === b) || edges.find(e => e.from === b && e.to === a && e.kind !== 'walk');
  const jackScene = j => AMPJ.includes(j) ? SC.rack_rear : SC.stage;
  const jackLabel = j => AMPJ.includes(j) ? `NX3000 CH ${j.split(':')[1]} output` : `${W[j.split(':')[0]].label} jack ${j.split(':')[1]}`;

  const powered = g => g.rack.furman === 'on' && g.rack.nx3000 === 'on';
  // which jacks are joined to which: a cable joins its two ends; a wedge's own jacks are wired together
  function joined(g, from, physical = false) {
    const seen = new Set([from]), todo = [from];
    while (todo.length) {
      const j = todo.pop(), nb = [];
      for (const c of CIDS) {
        const e = g.cables[c].ends, ok = end => physical || !(g.loose && g.loose.cable === c && g.loose.end === end);   // a loose plug passes nothing
        if (e.a === j && e.b && ok('a') && ok('b')) nb.push(e.b); if (e.b === j && e.a && ok('a') && ok('b')) nb.push(e.a);
      }
      const [dev] = j.split(':'); if (W[dev]) for (let k = 1; k <= W.jacks; k++) nb.push(`${dev}:${k}`);
      for (const n of nb) if (!seen.has(n)) { seen.add(n); todo.push(n); }
    }
    return seen;
  }
  const wedgeSpot = (g, w) => SPOTS.find(s => g.spots[s] === w) || null;
  // does this placed wedge make sound right now? (playback through Bus 1, the rack on, and it hangs off CH A)
  const sounding = (g, w) => g.playing === 'bus1' && powered(g) && !!wedgeSpot(g, w) && joined(g, LIVE).has(`${w}:1`);
  const signalLed = (g, ch) => powered(g) && g.playing === 'bus1' && `nx3000:${ch}` === LIVE;   // only the channel Bus 1 feeds
  const heard = (g, w) => g.evidence.some(e => e.kind === 'wedge' && e.wedge === w && e.playing && e.seq > (g.chainChanged || 0));
  const placedAll = g => SPOTS.every(s => g.spots[s]);
  const complete = g => placedAll(g) && SPOTS.every(s => heard(g, g.spots[s]));
  const faultActive = (g, i) => {
    const F = FBY[g.faults[i].id];
    if (F.type === 'loose') return !!g.loose || g.plugs < g.faults[i].at;     // still to happen, or happened and not reseated
    return g.cables[F.set.cable].ends[F.set.end] === F.set.jack;
  };

  function start(seed = 'MN-00001', opts = {}) {
    const wedges = Object.fromEntries(WIDS.map(w => [w, { at: 'storage' }]));
    const cables = Object.fromEntries(CIDS.map(c => [c, { at: CB.home, ends: { a: null, b: null } }]));
    const faults = [], r = rng(seed);
    for (const f of FS) {
      const roll = r(), on = opts.faults ? opts.faults.includes(f.id) : roll < f.chance;
      if (!on) continue;
      if (f.type === 'loose') faults.push({ id: f.id, at: (opts.looseAt ?? 1 + Math.floor(r() * 4)) });   // which of your speakON plugs won't lock
      else { cables[f.set.cable].ends[f.set.end] = f.set.jack; faults.push({ id: f.id }); }
    }
    return {
      v: 1, content: content.id, seed, seq: 0, t: opts.t ?? 0, scene: SC.start,
      carrying: [], wedges, spots: Object.fromEntries(SPOTS.map(s => [s, null])), cables, held: [],
      rack: clone(R.start), playing: null, faults, plugs: 0, loose: null, chainChanged: 0, evidence: [], hints: {}, log: [], completedAt: null, trips: 0,
    };
  }

  function apply(g, a, events) {
    const fail = (code, message) => ({ code, message });
    const entry = { seq: g.seq + 1, t: null, type: a.type };
    const faultWas = g.faults.map((_, i) => faultActive(g, i));
    const chain = () => { g.chainChanged = entry.seq; entry.chain = true; };
    switch (a.type) {
      case 'go': {
        const e = edgeOf(g.scene, a.scene);
        if (!e) return fail('no-way', `you can't get to ${a.scene} from here`);
        const n = g.carrying.length, speed = n ? C.carry_m_per_s[n] : C.walk_m_per_s;
        const s = Math.max(1, Math.round((e.distance_m ?? (e.kind === 'closeup' ? 1 : 2)) / speed));
        g.t += s; g.scene = a.scene; Object.assign(entry, { scene: a.scene, seconds: s, carrying: n });
        // what you can see on arrival at the rack: the front panel lights, or which output each cable is in
        if (a.scene === SC.rack_front) g.evidence.push({ seq: entry.seq, kind: 'amp-front', powered: powered(g), sig: Object.fromEntries(R.nx3000.channels.map(c => [c, signalLed(g, c)])), playing: g.playing });
        if (a.scene === SC.rack_rear) g.evidence.push({ seq: entry.seq, kind: 'amp-rear', outputs: Object.fromEntries(AMPJ.map(j => [j, CIDS.find(c => Object.values(g.cables[c].ends).includes(j)) || null])) });
        break;
      }
      case 'take': {                                   // lift wedges off the floor of the storage closet
        if (g.scene !== SC.storage) return fail('not-here', 'the wedges are in the storage closet');
        const n = a.count || 1, left = WIDS.filter(w => g.wedges[w].at === 'storage');
        if (g.carrying.length + n > content.carry.max_wedges) return fail('hands-full', `you can carry ${content.carry.max_wedges} wedges at most`);
        if (left.length < n) return fail('none-left', left.length ? `only ${left.length} left in storage` : 'no wedges left in storage');
        const fails = Math.max(0, a.fails | 0);
        g.t += C.take_s * (1 + fails); left.slice(0, n).forEach(w => { g.wedges[w].at = 'hand'; g.carrying.push(w); });
        g.trips++; Object.assign(entry, { count: n, fails, wedges: g.carrying.slice(-n) });
        events.push({ type: 'took', count: n, text: `${n === 2 ? 'Two wedges' : 'A wedge'} up${fails ? ` (after ${fails} failed lift${fails > 1 ? 's' : ''})` : ''}. ${left.length - n} left in storage.` });
        break;
      }
      case 'place': {                                  // put a carried wedge down at a spot on stage, facing the singers
        if (g.scene !== SC.stage) return fail('not-here', 'the wedges go on the stage');
        if (!SP[a.spot] || !SP[a.spot].label) return fail('bad-spot', 'which spot?');
        if (g.spots[a.spot]) return fail('taken', `there's already a wedge at ${SP[a.spot].label.toLowerCase()}`);
        const w = g.carrying.shift(); if (!w) return fail('empty-hands', "you aren't carrying a wedge");
        g.wedges[w].at = a.spot; g.spots[a.spot] = w; g.t += C.place_s; chain(); Object.assign(entry, { wedge: w, spot: a.spot });
        break;
      }
      case 'pick_up': {                                // pick a placed wedge back up (unplug it first)
        if (g.scene !== SC.stage) return fail('not-here', 'that wedge is on the stage');
        const w = g.spots[a.spot]; if (!w) return fail('nothing', 'no wedge there');
        if (CIDS.some(c => Object.values(g.cables[c].ends).some(j => j && j.startsWith(w + ':')))) return fail('plugged', 'unplug its cables first');
        if (g.carrying.length >= content.carry.max_wedges) return fail('hands-full', 'your hands are full');
        g.spots[a.spot] = null; g.wedges[w].at = 'hand'; g.carrying.push(w); g.t += C.take_s; chain(); Object.assign(entry, { wedge: w, spot: a.spot });
        break;
      }
      case 'cable': {                                  // take a cable off the hook on the Monitor Rack
        const c = a.cable; if (!CB[c] || !CB[c].label) return fail('bad-cable', 'which cable?');
        if (g.cables[c].at !== CB.home) return fail('not-on-hook', `${CB[c].label} isn't on the hook`);
        if (g.scene !== SC.rack_rear) return fail('not-here', 'the cables hang on the hook on the Monitor Rack');
        g.cables[c].at = 'out'; g.held.push(c); g.t += C.take_s; entry.cable = c;
        break;
      }
      case 'plug': {                                   // plug the next free end of a cable into a jack here
        const c = a.cable, j = a.jack; if (!g.cables[c] || g.cables[c].at === CB.home) return fail('no-cable', "you don't have that cable");
        const isWedge = W[j.split(':')[0]] && +j.split(':')[1] >= 1 && +j.split(':')[1] <= W.jacks;
        if (!AMPJ.includes(j) && !isWedge) return fail('bad-jack', 'no such jack');
        if (g.scene !== jackScene(j)) return fail('not-here', `${jackLabel(j)} isn't here`);
        if (isWedge && !wedgeSpot(g, j.split(':')[0])) return fail('not-placed', 'put the wedge down first');
        if (CIDS.some(x => Object.values(g.cables[x].ends).includes(j))) return fail('occupied', `something is already in ${jackLabel(j)}`);
        const ends = g.cables[c].ends, end = !ends.a ? 'a' : !ends.b ? 'b' : null;
        if (!end) return fail('both-plugged', `both ends of ${CB[c].label} are already plugged in`);
        const other = ends[end === 'a' ? 'b' : 'a'];
        if (!CB[c].long && other && jackScene(other) !== jackScene(j)) return fail('too-short', `${CB[c].label} won't reach that far`);
        ends[end] = j; g.t += C.plug_s; chain(); g.plugs++; Object.assign(entry, { cable: c, end, jack: j });
        const lf = g.faults.find(f => FBY[f.id].type === 'loose');
        if (lf && g.plugs === lf.at) { g.loose = { cable: c, end, jack: j }; entry.loose = true; }   // it went in, but didn't lock
        break;
      }
      case 'unplug': {
        const j = a.jack, c = CIDS.find(x => Object.values(g.cables[x].ends).includes(j));
        if (!c) return fail('empty', 'nothing is plugged in there');
        if (g.scene !== jackScene(j)) return fail('not-here', `${jackLabel(j)} isn't here`);
        const end = g.cables[c].ends.a === j ? 'a' : 'b'; g.cables[c].ends[end] = null; g.t += C.plug_s; chain();
        if (g.loose && g.loose.cable === c && g.loose.end === end) { g.loose = null; entry.wasLoose = true; }
        if (!g.held.includes(c)) g.held.push(c);
        Object.assign(entry, { cable: c, end, jack: j });
        break;
      }
      case 'reseat': {                                 // unplug and plug back in, twisting until it locks
        const j = a.jack, c = CIDS.find(x => Object.values(g.cables[x].ends).includes(j));
        if (!c) return fail('empty', 'nothing is plugged in there');
        if (g.scene !== jackScene(j)) return fail('not-here', `${jackLabel(j)} isn't here`);
        const end = g.cables[c].ends.a === j ? 'a' : 'b', was = !!(g.loose && g.loose.cable === c && g.loose.end === end);
        if (was) g.loose = null;
        g.t += C.reseat_s; chain(); Object.assign(entry, { cable: c, end, jack: j, wasLoose: was });
        events.push({ type: 'reseat', jack: j, wasLoose: was, text: was ? `${jackLabel(j)}: it twists further than before, and clicks. Locked.` : `${jackLabel(j)}: unplugged and back in; it was already locked.` });
        break;
      }
      case 'switch': {                                 // the rack's power: the Furman strip, then the NX3000's POWER button
        if (!['furman', 'nx3000'].includes(a.device)) return fail('bad-device', 'switch what?');
        if (g.scene !== SC.rack_front) return fail('not-here', 'the power switches are on the front of the Monitor Rack');
        const before = powered(g); g.rack[a.device] = g.rack[a.device] === 'on' ? 'off' : 'on'; g.t += C.switch_s; chain();
        Object.assign(entry, { device: a.device, to: g.rack[a.device], poweredBefore: before, powered: powered(g), furman: g.rack.furman });
        events.push({ type: 'switch', device: a.device, to: g.rack[a.device], text: `${R[a.device].label}: ${g.rack[a.device]}${a.device === 'nx3000' && g.rack.nx3000 === 'on' && g.rack.furman !== 'on' ? ' (but nothing lights up: the Furman is off)' : powered(g) && !before ? '. The NX3000 lights up.' : ''}.` });
        // what the front panel shows now
        g.evidence.push({ seq: entry.seq, kind: 'amp-front', powered: powered(g), sig: Object.fromEntries(R.nx3000.channels.map(c => [c, signalLed(g, c)])), playing: g.playing });
        break;
      }
      case 'a1': {                                     // ask the A1 at FOH to play known playback (or stop)
        if (!['bus1', 'mains', 'stop'].includes(a.play)) return fail('bad-action', "a1 play: 'bus1', 'mains' or 'stop'");
        g.playing = a.play === 'stop' ? null : a.play; g.t += C.ask_s; entry.play = a.play;
        events.push({ type: 'a1', play: a.play, text: a.play === 'stop' ? 'The A1 stops the playback.' : `The A1 plays ${content.playback.label} through ${a.play === 'bus1' ? 'Bus 1 (the wedges)' : 'the mains'}.${a.play === 'mains' ? ' You hear it through the mains.' : ''}` });
        if (g.scene === SC.rack_front) g.evidence.push({ seq: entry.seq, kind: 'amp-front', powered: powered(g), sig: Object.fromEntries(R.nx3000.channels.map(c => [c, signalLed(g, c)])), playing: g.playing });
        break;
      }
      case 'listen': {                                 // on stage: which wedges are making sound?
        if (g.scene !== SC.stage) return fail('not-here', 'listen to the wedges from the stage');
        g.t += C.listen_s;
        const res = SPOTS.filter(s => g.spots[s]).map(s => ({ spot: s, wedge: g.spots[s], playing: sounding(g, g.spots[s]) }));
        for (const x of res) g.evidence.push({ seq: entry.seq, kind: 'wedge', wedge: x.wedge, spot: x.spot, playing: x.playing, source: g.playing });
        Object.assign(entry, { source: g.playing, result: res });
        events.push({ type: 'listen', result: res, source: g.playing, text: !res.length ? 'No wedges on stage yet.' : g.playing !== 'bus1'
          ? `Nothing is playing through Bus 1${g.playing === 'mains' ? ' (the Wii Shop theme is in the mains)' : ''}: ask the A1 to play it through Bus 1.`
          : res.every(x => x.playing) ? `${content.playback.label} in ${res.length === 3 ? 'all three wedges' : `${res.length} wedge${res.length > 1 ? 's' : ''}`}.`
          : `${res.filter(x => x.playing).length ? `Playing: ${res.filter(x => x.playing).map(x => SP[x.spot].label.toLowerCase()).join(', ')}. ` : ''}Silent: ${res.filter(x => !x.playing).map(x => SP[x.spot].label.toLowerCase()).join(', ')}.` });
        break;
      }
      case 'hint': {
        const k = hintKey(g); if (!k) return fail('no-hint', 'Nothing needs a hint right now.');
        const hs = k.fault ? FBY[k.fault].hints : H[k.key], used = g.hints[k.fault || k.key] || 0;
        if (used >= hs.length) return fail('no-more-hints', 'no more hints for this');
        const h = hs[used]; g.hints[k.fault || k.key] = used + 1; Object.assign(entry, { level: h.level, about: k.fault || k.key });
        events.push({ type: 'hint', level: h.level, of: hs.length, kind: h.kind, about: k.fault || k.key, text: h.text.replace(/\{jack\}/g, g.loose ? jackLabel(g.loose.jack) : 'one connector') });
        break;
      }
      default: return fail('bad-action', `unknown action ${a.type}`);
    }
    g.faults.forEach((f, i) => { if (faultWas[i] && !faultActive(g, i)) entry.fixedFault = f.id; });
    g.seq = entry.seq; entry.t = g.t; g.log.push(entry);
    return null;
  }

  // what's missing, in procedure order (judged by what is physically plugged in); a fault's own hints win
  // once you've heard silent wedges through Bus 1 with the rack on
  const inJack = (g, j) => CIDS.find(c => Object.values(g.cables[c].ends).includes(j)) || null;
  function hintKey(g) {
    if (complete(g)) return null;
    const active = g.faults.filter((f, k) => faultActive(g, k) && (FBY[f.id].type !== 'loose' || g.loose));
    const silentSeen = g.evidence.some(e => e.kind === 'wedge' && !e.playing && e.source === 'bus1');
    if (active.length && silentSeen && powered(g)) return { fault: active[0].id };
    if (!placedAll(g)) return { key: 'wedges' };
    if (!AMPJ.some(j => inJack(g, j))) return { key: 'run' };
    if (!SPOTS.every(s => AMPJ.some(a => joined(g, a, true).has(`${g.spots[s]}:1`)))) return { key: 'chain' };
    if (!powered(g)) return { key: 'power' };
    return { key: 'verify' };
  }

  function act(g0, a) {
    const g = clone(g0), events = [];
    const err = apply(g, a || {}, events);
    if (err) return { game: g0, events: [], error: err };
    if (g.completedAt == null && complete(g)) {
      g.completedAt = { seq: g.seq, t: g.t };
      events.push({ type: 'objective-complete', text: `${content.objective.label}: all three heard playing ${content.playback.label}.` });
    }
    return { game: g, events, error: null };
  }

  function view(g) {
    const hk = hintKey(g), hs = hk ? (hk.fault ? FBY[hk.fault].hints : H[hk.key]) : null;
    const wedgeHeard = Object.fromEntries(WIDS.map(w => [w, heard(g, w)]));
    const plugged = Object.fromEntries(CIDS.map(c => [c, { ...g.cables[c].ends }]));
    const inJack = j => CIDS.find(c => Object.values(g.cables[c].ends).includes(j)) || null;
    const steps = {
      wedges: placedAll(g),
      cable: placedAll(g) && SPOTS.every(s => AMPJ.some(a => joined(g, a, true).has(`${g.spots[s]}:1`))),
      power: powered(g),
      test: complete(g),
    };
    return {
      clock: clockText(toSec(C.start) + g.t), readyBy: clockText(toSec(C.ready_by)), scene: g.scene,
      carrying: g.carrying.slice(), left: WIDS.filter(w => g.wedges[w].at === 'storage').length, held: g.held.filter(c => g.cables[c].at !== CB.home),
      spots: SPOTS.map(s => ({ id: s, label: SP[s].label, wedge: g.spots[s], heard: g.spots[s] ? wedgeHeard[g.spots[s]] : false,
        jacks: g.spots[s] ? Array.from({ length: W.jacks }, (_, k) => ({ jack: `${g.spots[s]}:${k + 1}`, cable: inJack(`${g.spots[s]}:${k + 1}`) })) : [] })),
      hook: CIDS.filter(c => g.cables[c].at === CB.home), cables: plugged,
      amp: { outputs: AMPJ.map(j => ({ jack: j, channel: j.split(':')[1], cable: inJack(j) })) },
      // the front panel shows only what's there to see: power, and which SIGNAL light moves
      front: { furman: g.rack.furman, nx3000: g.rack.nx3000, powerLed: powered(g), sig: Object.fromEntries(R.nx3000.channels.map(c => [c, signalLed(g, c)])) },
      playing: g.playing, heardCount: SPOTS.filter(s => g.spots[s] && wedgeHeard[g.spots[s]]).length, of: SPOTS.length,
      complete: g.completedAt != null, steps: content.procedure.steps.map(s => ({ ...s, done: steps[s.id] })),
      hintsLeft: hs ? hs.length - (g.hints[hk.fault || hk.key] || 0) : 0,
      debug: { seed: g.seed, faults: g.faults.map((f, i) => ({ ...f, label: FBY[f.id].label, active: faultActive(g, i) })), rack: g.rack, cables: g.cables, live: [...joined(g, LIVE)] },
    };
  }

  function debrief(g) {
    const L = g.log, at = e => clockText(toSec(C.start) + e.t), lines = [], loops = {};
    const done = complete(g);
    lines.push(done ? `✅ Monitors ready: three wedges playing ${content.playback.label} by ${clockText(toSec(C.start) + g.completedAt.t)} (rehearsal at ${clockText(toSec(C.ready_by))}).`
      : `✅ Not ready yet: ${[!placedAll(g) && `${SPOTS.filter(s => !g.spots[s]).length} wedge spot(s) empty`, ...SPOTS.filter(s => g.spots[s] && !heard(g, g.spots[s])).map(s => `${SP[s].label.toLowerCase()} not heard playing`)].filter(Boolean).join('; ')}.`);
    g.faults.forEach((gf, i) => {
      const F = FBY[gf.id], loose = F.type === 'loose', looseE = loose ? L.find(e => e.loose) : null;
      if (loose && !looseE) { lines.push(`🧠 ${F.label}: it didn't come up this time (you hadn't made that connection yet).`); loops[gf.id] = null; return; }
      const say = t => t.replace(/\{jack\}/g, looseE ? jackLabel(looseE.jack) : '');
      const actE = L.find(e => e.fixedFault === gf.id), actSeq = actE ? actE.seq : Infinity;
      const noticeE = L.find(e => e.seq < actSeq && e.type === 'listen' && e.source === 'bus1' && e.result.some(x => !x.playing));
      const ns = noticeE ? noticeE.seq : Infinity;
      const traceE = loose
        ? L.find(e => e.seq < actSeq && e.seq > ns && ((e.type === 'listen' && e.source === 'bus1' && e.result.some(x => x.playing) && e.result.some(x => !x.playing))
          || (e.type === 'reseat' && !e.wasLoose) || g.evidence.some(x => x.seq === e.seq && x.kind === 'amp-front' && x.powered && x.playing === 'bus1')))
        : L.find(e => e.seq < actSeq && ((e.type === 'go' && e.scene === SC.rack_rear && e.seq > ns)
        || (e.seq > ns && g.evidence.some(x => x.seq === e.seq && x.kind === 'amp-front' && x.powered && x.playing === 'bus1'))));
      const verifyE = actE && done ? L.find(e => e.seq > actSeq && e.type === 'listen' && e.source === 'bus1' && e.result.length === SPOTS.length && e.result.every(x => x.playing)) : null;
      lines.push(`🧠 What failed: ${say(F.debrief.failed)}`);
      lines.push(noticeE ? `  NOTICE ✓ ${at(noticeE)}: with the Wii Shop theme going through Bus 1, ${noticeE.result.every(x => !x.playing) ? 'the wedges were silent' : `${noticeE.result.filter(x => !x.playing).length} wedge(s) were silent`}.` : actE ? `  NOTICE ✗ you ${loose ? 'reseated it' : 'moved it'} before hearing the problem (that counts as luck, not a check).` : '  NOTICE ✗ not yet.');
      lines.push(traceE ? `  TRACE ✓ ${at(traceE)}: ${traceE.type === 'go' ? 'you looked at the rack rear: which output the run was in' : traceE.type === 'listen' ? 'some wedges played and some didn\'t, which put the problem at or before the first silent one'
          : traceE.type === 'reseat' ? 'you worked along the signal flow, reseating connections' : 'you looked at the NX3000: the CH A SIGNAL light moved with the playback'}.`
        : actE ? `  TRACE ✗ you ${loose ? 'went straight to the right plug' : 'moved the cable'} before narrowing it down (${loose ? 'which wedges play, the amp lights, the chain in order' : 'its SIGNAL lights, or the rear'}).` : '  TRACE ✗ not yet.');
      if (loose) { const n = L.filter(e => e.type === 'reseat' || (e.type === 'unplug' && e.wasLoose)).filter(e => e.seq > looseE.seq && e.seq <= actSeq).length; if (actE && n > 1) lines.push(`  (${n} connectors reseated to find it: going along the whole signal flow works, it just takes time.)`); }
      lines.push(actE ? `  ACT ✓ ${at(actE)}: ${F.debrief.act}` : `  ACT ✗ ${loose ? 'that speakON is still loose' : 'the run is still in Channel B'}.`);
      lines.push(verifyE ? `  VERIFY ✓ ${at(verifyE)}: all three wedges heard playing.` : actE ? '  VERIFY ✗ fixed but not verified: listen to the wedges with Bus 1 playing.' : '  VERIFY ✗ not yet.');
      loops[gf.id] = { notice: !!noticeE, trace: !!traceE, act: !!actE, verify: !!verifyE };
    });
    // your own mistakes along the way
    const intoB = L.filter(e => e.type === 'plug' && e.jack === 'nx3000:B');
    if (intoB.length) lines.push(`⚠️ You plugged a cable into Channel B ${intoB.length > 1 ? `${intoB.length} times` : 'once'}: Bus 1 comes in on Channel A${g.cables.run.ends.a === 'nx3000:B' || g.cables.run.ends.b === 'nx3000:B' ? ', and it is still there' : ', and you moved it'}.`);
    const early = L.find(e => e.type === 'switch' && e.device === 'nx3000' && e.to === 'on' && e.furman !== 'on');
    if (early) lines.push(`⚠️ The NX3000 was switched on before the Furman (${at(early)}). The order is the Furman, then the NX3000: amps last.`);
    const lifts = L.filter(e => e.type === 'take'), fails = lifts.reduce((s, e) => s + e.fails, 0);
    lines.push(`🏋️ ${lifts.length} trip${lifts.length === 1 ? '' : 's'} with wedges (${lifts.map(e => e.count).join(' + ')})${fails ? `, ${fails} failed lift${fails > 1 ? 's' : ''}` : ''}; ${L.filter(e => e.type === 'go').reduce((s, e) => s + e.seconds, 0)} s walking.`);
    const used = Object.entries(g.hints).filter(([, n]) => n);
    lines.push(`🆘 Hints used: ${used.length ? used.map(([k, n]) => `${FBY[k] ? FBY[k].label.toLowerCase() : k}: ${n}`).join('; ') : 'none'}.`);
    lines.push(`📚 Concepts: passive wedges need an amp; plugged in isn't locked in; Bus 1 → NX3000 CH A in → CH A out → long run → wedge → links (daisy chain); power the Furman, then the amp; connected isn't working until you hear it; known source first.`);
    return { ready: done, loops, intoB: intoB.length, earlyAmp: !!early, lifts: lifts.length, failedLifts: fails, actions: L.length, gameSeconds: g.t, lines };
  }

  return { start, act, view, debrief, joined: (g, j) => [...joined(g, j)], sounding: (g, w) => sounding(g, w) };
}
