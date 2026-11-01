// Gameplay slice engine, part 3: teardown, the end of the night (Cary, 2026-11-01; PRODUCT_DESIGN section 70).
// Every mic back in the drawer with its batteries out and the cells sorted (rechargeables on the charger, never
// alkalines), the wireless rack off, the Monitor Rack off (the amp first), the speakON cables back on the hook, the
// wedges back in the storage closet (BH 102), and its door latched and proved. Pure functions over plain JSON
// state, like the other engines.
//
//   const eng = teardownEngine(content, graph, devices, monitors);   // devices: the battery-in content's; monitors: vj-monitors.json
//   let g = eng.start('TD-12345');
//   ({ game: g, events, error } = eng.act(g, { type: 'go', scene: 'foh-mic-drawer' }));
//
// Actions: go {scene} · unload {device} (batteries out, switches it off) · cells {device, to: charger|bin}
//          · stow {device} (the mic into the drawer) · rest (after 3 by hand) · count (the drawer) · take_mic {device} (on stage)
//          · switch {device: wireless|furman|nx3000} · unplug {jack} · hang {cable} · lift {count, fails} · put_away
//          · door {do: close_fixed|push|bolt|close|open|look|tug} · hint
//
// Key rule (section 3): the door counts only when tugged and found holding after the last change to it.

import { clockText } from './engine.js';

const clone = o => JSON.parse(JSON.stringify(o));
function hashSeed(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
function rng(seed) { let a = hashSeed(seed); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const toSec = hms => { const [h, m, s] = hms.split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };

export function teardownEngine(content, graph, devices, monitors) {
  const C = content.clock, SC = content.scenes, FS = content.faults, FBY = Object.fromEntries(FS.map(f => [f.id, f])), H = content.hints;
  const MICS = Object.keys(devices).filter(id => devices[id].type === 'wireless-handheld').sort((a, b) => devices[a].channel - devices[b].channel);
  const W = monitors.wedges, SP = monitors.spots, CB = monitors.cables, R = monitors.rack;
  const WIDS = Object.keys(W).filter(k => W[k] && W[k].label), SPOTS = Object.keys(SP).filter(k => SP[k] && SP[k].label);
  const CIDS = Object.keys(CB).filter(k => CB[k] && CB[k].label), AMPJ = R.nx3000.channels.map(c => `nx3000:${c}`);
  const BIN = content.places.bin, edges = graph.edges;
  const edgeOf = (a, b) => edges.find(e => e.from === a && e.to === b) || edges.find(e => e.from === b && e.to === a && e.kind !== 'walk');
  const jackScene = j => AMPJ.includes(j) ? SC.rack_rear : SC.stage;
  const jackLabel = j => AMPJ.includes(j) ? `NX3000 CH ${j.split(':')[1]} output` : `${W[j.split(':')[0]].label} jack ${j.split(':')[1]}`;
  const L = id => devices[id].label;
  const fillMic = (t, id) => t.replace(/\{mic\}/g, id ? L(id) : 'one mic');

  const ampOn = g => g.rack.furman === 'on' && g.rack.nx3000 === 'on';
  const rfOn = g => g.wireless === 'on' ? MICS.filter(id => g.mics[id].on) : [];
  const sorted = (g, id) => { const m = g.mics[id]; return m.cells === (m.alk ? 'bin' : 'charger'); };
  const micsDone = g => MICS.every(id => g.mics[id].at === 'drawer' && sorted(g, id));
  const inDrawer = g => MICS.filter(id => g.mics[id].at === 'drawer').length;
  const cablesHome = g => CIDS.every(c => g.cables[c].at === 'hook');
  const wedgesHome = g => WIDS.every(w => g.wedges[w].at === 'storage');
  const latched = g => g.door.fixed === 'flush' && g.door.bolt && g.door.boltIn && g.door.active === 'closed';
  const doorProved = g => latched(g) && g.evidence.some(e => e.kind === 'tug' && e.held && e.seq > g.doorChanged);
  const steps = g => ({ mics: micsDone(g), wireless: g.wireless === 'off', amp: g.rack.furman === 'off' && g.rack.nx3000 === 'off', cables: cablesHome(g), wedges: wedgesHome(g), door: doorProved(g) });
  const complete = g => Object.values(steps(g)).every(Boolean);
  const inJack = (g, j) => CIDS.find(c => Object.values(g.cables[c].ends).includes(j)) || null;
  const faultOf = (g, id) => g.faults.find(f => f.id === id);
  const faultActive = (g, f) => f.id === 'mic-left-on-stage' ? g.mics[f.device].at === 'stage'
    : f.id === 'alkaline-cells' ? g.mics[f.device].cells !== 'bin'
    : !(g.door.fixed === 'flush' && (!g.door.bolt || g.door.boltIn));

  function start(seed = 'TD-00001', opts = {}) {
    const r = rng(seed), faults = [];
    const mics = Object.fromEntries(MICS.map(id => [id, { at: 'chair', on: false, cells: 'in', alk: false }]));
    for (const f of FS) {
      const roll = r(), on = opts.faults ? opts.faults.includes(f.id) : roll < f.chance;
      if (!on) continue;
      if (f.id === 'mic-left-on-stage') { const ms = MICS.filter(id => devices[id].role === 'musician'); const id = opts.leftOnStage || ms[Math.floor(r() * ms.length)]; mics[id].at = 'stage'; mics[id].on = true; faults.push({ id: f.id, device: id }); }
      else if (f.id === 'alkaline-cells') { const ms = MICS.filter(id => mics[id].at === 'chair'); const id = opts.alkaline || ms[Math.floor(r() * ms.length)]; mics[id].alk = true; faults.push({ id: f.id, device: id }); }
      else faults.push({ id: f.id });
    }
    const S = content.start_chain, spots = clone(S.spots), wedges = Object.fromEntries(WIDS.map(w => [w, { at: SPOTS.find(s => spots[s] === w) || 'storage' }]));
    const cables = Object.fromEntries(CIDS.map(c => [c, { at: S.cables[c] ? 'out' : 'hook', ends: { a: S.cables[c]?.[0] ?? null, b: S.cables[c]?.[1] ?? null } }]));
    return {
      v: 1, content: content.id, seed, seq: 0, t: opts.t ?? 0, scene: SC.start,
      mics, hand: [], wireless: content.wireless.start, rack: clone(content.rack.start), spots, wedges, cables, held: [], carrying: [],
      door: { fixed: 'open', active: 'open', bolt: false, boltIn: false, gap: faults.some(f => f.id === 'door-gap') }, doorChanged: 0,
      faults, evidence: [], hints: {}, log: [], completedAt: null,
    };
  }

  // one mic's routine at the drawer (shared by the hand actions and "Stow the rest")
  function unload(g, id, entry, events) {
    const m = g.mics[id], wasOn = m.on;
    m.on = false; m.cells = 'hand'; g.t += C.unload_s;
    Object.assign(entry, { device: id, wasOn, alk: m.alk });
    events.push({ type: 'unloaded', device: id, alk: m.alk, text: `${L(id)}: ${wasOn ? 'switched off, ' : ''}batteries out. They're ${m.alk ? content.mics.cells.alkaline : content.mics.cells.rechargeable}.` });
  }

  function apply(g, a, events) {
    const fail = (code, message) => ({ code, message });
    const entry = { seq: g.seq + 1, t: null, type: a.type };
    const was = g.faults.map(f => faultActive(g, f));
    const atDrawer = () => g.scene === SC.drawer;
    const micOk = id => devices[id] && g.mics[id];
    const doorChange = () => { g.doorChanged = entry.seq; };
    switch (a.type) {
      case 'go': {
        const e = edgeOf(g.scene, a.scene);
        if (!e) return fail('no-way', `you can't get to ${a.scene} from here`);
        if (a.scene === SC.storage && g.door.active === 'closed' && g.door.fixed !== 'open') return fail('door-shut', 'the closet door is shut: open it first');
        const n = g.carrying.length, speed = n ? C.carry_m_per_s[n] : C.walk_m_per_s;
        const s = Math.max(1, Math.round((e.distance_m ?? (e.kind === 'closeup' ? 1 : 2)) / speed));
        g.t += s; g.scene = a.scene; Object.assign(entry, { scene: a.scene, seconds: s, carrying: n });
        if (a.scene === SC.receivers) {                // the receivers' RF lights: which mics are still on, wherever they are
          const rf = rfOn(g); g.evidence.push({ seq: entry.seq, kind: 'rf', rf, wireless: g.wireless });
          events.push({ type: 'rf', rf, text: g.wireless !== 'on' ? 'The receivers are dark: the wireless rack is off.' : rf.length ? `RF showing on ${rf.map(id => `CH ${String(devices[id].channel).padStart(2, '0')}`).join(', ')}: ${rf.length > 1 ? 'those mics are' : 'that mic is'} still on, somewhere in range.` : 'No RF on any receiver: every mic is off.' });
        }
        break;
      }
      case 'unload': {
        const id = a.device; if (!micOk(id)) return fail('bad-mic', 'which mic?');
        if (!atDrawer()) return fail('not-here', 'do this at the mic drawer (the charger is on top)');
        const m = g.mics[id]; if (!['chair', 'hand'].includes(m.at)) return fail('not-here', m.at === 'drawer' ? `${L(id)} is already in the drawer` : `${L(id)} isn't here`);
        if (m.cells !== 'in') return fail('empty', `${L(id)}'s batteries are already out`);
        unload(g, id, entry, events);
        break;
      }
      case 'cells': {
        const id = a.device; if (!micOk(id)) return fail('bad-mic', 'which mic?');
        if (!['charger', 'bin'].includes(a.to)) return fail('bad-place', "cells go on the charger or in the bin");
        const m = g.mics[id]; if (m.cells === 'in') return fail('in-mic', `take ${L(id)}'s batteries out first`);
        if (a.to === 'charger' && !atDrawer()) return fail('not-here', 'the charger is on top of the mic cabinet');
        if (a.to === 'bin' && !BIN.reachable_from.includes(g.scene)) return fail('not-here', 'the battery bin is by the FOH computer');
        if (m.cells === a.to) return fail('already', `they're already ${a.to === 'bin' ? 'in the bin' : 'on the charger'}`);
        const from = m.cells; m.cells = a.to; g.t += C.cells_s; Object.assign(entry, { device: id, from, to: a.to, alk: m.alk });
        events.push({ type: 'cells', device: id, to: a.to, alk: m.alk, text: a.to === 'charger' ? (m.alk ? `⚠️ Alkaline cells on the rechargeable charger! Never: they can leak or burst.` : `${L(id)}'s cells on the charger.`) : `${L(id)}'s cells in the battery bin${m.alk ? '' : ' (they are rechargeable: they belong on the charger)'}.` });
        break;
      }
      case 'stow': {
        const id = a.device; if (!micOk(id)) return fail('bad-mic', 'which mic?');
        if (!atDrawer()) return fail('not-here', 'the drawer is in the mic cabinet');
        const m = g.mics[id]; if (!['chair', 'hand'].includes(m.at)) return fail('not-here', m.at === 'drawer' ? `${L(id)} is already in the drawer` : `${L(id)} isn't here`);
        if (m.cells === 'in') return fail('cells-in', 'batteries out first: they go on the charger for next time');
        if (m.cells === 'hand') return fail('cells-in-hand', `put ${L(id)}'s cells somewhere first`);
        if (m.at === 'hand') g.hand = g.hand.filter(x => x !== id);
        m.at = 'drawer'; g.t += C.stow_s; entry.device = id;
        break;
      }
      case 'rest': {                                    // "Stow the rest": the same routine for every mic on the chair
        if (!atDrawer()) return fail('not-here', 'do this at the mic drawer');
        const byHand = g.log.filter(e => e.type === 'stow' && !e.via).length;
        if (byHand < content.skip.after_by_hand) return fail('not-yet', `do ${content.skip.after_by_hand - byHand} more by hand first`);
        const todo = MICS.filter(id => ['chair', 'hand'].includes(g.mics[id].at));
        if (!todo.length) return fail('nothing', 'no mics left to stow here');
        const done = []; let stopped = null;
        for (const id of todo) {
          const m = g.mics[id];
          if (m.cells === 'in') { const ev = []; unload(g, id, {}, ev); }
          if (m.cells === 'hand' && m.alk) { stopped = id; break; }
          if (m.cells === 'hand') { m.cells = 'charger'; g.t += C.cells_s; }
          if (m.at === 'hand') g.hand = g.hand.filter(x => x !== id);
          m.at = 'drawer'; g.t += C.stow_s; done.push(id);
        }
        Object.assign(entry, { stowed: done, stoppedAt: stopped });
        if (stopped) events.push({ type: 'rest-stopped', device: stopped, text: `${content.skip.label}: ${done.length} stowed. Stopped at ${L(stopped)}: its cells aren't rechargeable. Where do they go?` });
        else {
          const n = inDrawer(g); g.evidence.push({ seq: entry.seq, kind: 'count', n, of: MICS.length });
          events.push({ type: 'rest-done', text: `${content.skip.label}: ${done.length} stowed. ${n} of ${MICS.length} in the drawer${n < MICS.length ? `: ${MICS.length - n} missing` : ''}.` });
        }
        break;
      }
      case 'count': {
        if (!atDrawer()) return fail('not-here', 'count them at the drawer');
        const n = inDrawer(g); g.t += C.count_s; g.evidence.push({ seq: entry.seq, kind: 'count', n, of: MICS.length }); entry.n = n;
        const chair = MICS.filter(id => g.mics[id].at === 'chair').length, hand = g.hand.length, gone = MICS.length - n - chair - hand;
        events.push({ type: 'count', n, of: MICS.length, text: `${n} of ${MICS.length} in the drawer${chair ? `, ${chair} still on the chair` : ''}${hand ? `, ${hand} in your hand` : ''}.${gone ? ` ${gone} unaccounted for.` : ''}` });
        break;
      }
      case 'take_mic': {                                // a mic left out in the hall
        const id = a.device; if (!micOk(id)) return fail('bad-mic', 'which mic?');
        if (g.mics[id].at !== 'stage' || g.scene !== SC.stage) return fail('not-here', "that mic isn't here");
        if (g.hand.length >= content.carry.max_mics) return fail('hands-full', 'your hands are full');
        g.mics[id].at = 'hand'; g.hand.push(id); g.t += C.take_s; Object.assign(entry, { device: id, wasOn: g.mics[id].on });
        events.push({ type: 'took', text: `${L(id)}, on the stage floor by a stand${g.mics[id].on ? ', still switched on' : ''}.` });
        break;
      }
      case 'switch': {
        if (a.device === 'wireless') {
          if (g.scene !== SC.wireless_rack) return fail('not-here', "the wireless rack's Furman is at FOH, on top of the rack");
          g.wireless = g.wireless === 'on' ? 'off' : 'on'; g.t += C.switch_s;
          Object.assign(entry, { device: 'wireless', to: g.wireless, rfLeft: g.wireless === 'off' ? MICS.filter(id => g.mics[id].on) : [] });
          events.push({ type: 'switch', text: `${content.wireless.label}: ${g.wireless}.` });
          break;
        }
        if (!['furman', 'nx3000'].includes(a.device)) return fail('bad-device', 'switch what?');
        if (g.scene !== SC.rack_front) return fail('not-here', 'the power switches are on the front of the Monitor Rack');
        const ampWasOn = g.rack.nx3000 === 'on'; g.rack[a.device] = g.rack[a.device] === 'on' ? 'off' : 'on'; g.t += C.switch_s;
        Object.assign(entry, { device: a.device, to: g.rack[a.device], ampWasOn });
        events.push({ type: 'switch', text: `${R[a.device].label}: ${g.rack[a.device]}.${a.device === 'furman' && g.rack.furman === 'off' && ampWasOn ? ' (The NX3000 was still on: it went out with a thump. Amp first, then the Furman.)' : ''}` });
        break;
      }
      case 'unplug': {
        const j = a.jack, c = inJack(g, j);
        if (!c) return fail('empty', 'nothing is plugged in there');
        if (g.scene !== jackScene(j)) return fail('not-here', `${jackLabel(j)} isn't here`);
        const end = g.cables[c].ends.a === j ? 'a' : 'b', hot = ampOn(g); g.cables[c].ends[end] = null; g.t += C.plug_s;
        if (!g.held.includes(c)) g.held.push(c);
        Object.assign(entry, { cable: c, jack: j, hot });
        if (hot) events.push({ type: 'hot', text: `⚠️ You pulled a speakON with the NX3000 still on. Amp off first, then the cables.` });
        break;
      }
      case 'hang': {
        const c = a.cable; if (!CB[c] || !CB[c].label) return fail('bad-cable', 'which cable?');
        if (g.cables[c].at === 'hook') return fail('already', `${CB[c].label} is already on the hook`);
        if (g.cables[c].ends.a || g.cables[c].ends.b) return fail('plugged', `${CB[c].label} is still plugged in at ${jackLabel(g.cables[c].ends.a || g.cables[c].ends.b)}`);
        if (g.scene !== SC.rack_rear) return fail('not-here', 'the hook is on the Monitor Rack (round the back)');
        g.cables[c].at = 'hook'; g.held = g.held.filter(x => x !== c); g.t += C.hang_s; entry.cable = c;
        break;
      }
      case 'lift': {                                    // pick wedges up off the stage (the page's strength minigame gives `fails`)
        if (g.scene !== SC.stage) return fail('not-here', 'the wedges are on the stage');
        const n = a.count || 1, free = SPOTS.filter(s => g.spots[s] && !CIDS.some(c => Object.values(g.cables[c].ends).some(j => j && j.startsWith(g.spots[s] + ':'))));
        if (g.carrying.length + n > content.carry.max_wedges) return fail('hands-full', `you can carry ${content.carry.max_wedges} wedges at most`);
        if (!free.length) return fail(SPOTS.some(s => g.spots[s]) ? 'plugged' : 'none-left', SPOTS.some(s => g.spots[s]) ? 'unplug the wedges first' : 'no wedges left on stage');
        if (free.length < n) return fail('not-enough', `only ${free.length} unplugged wedge${free.length > 1 ? 's' : ''} to lift`);
        const fails = Math.max(0, a.fails | 0); g.t += C.take_s * (1 + fails);
        const took = free.slice(0, n).map(s => { const w = g.spots[s]; g.spots[s] = null; g.wedges[w].at = 'hand'; g.carrying.push(w); return w; });
        Object.assign(entry, { count: n, fails, wedges: took });
        events.push({ type: 'lifted', text: `${n === 2 ? 'Two wedges' : 'A wedge'} up${fails ? ` (after ${fails} failed lift${fails > 1 ? 's' : ''})` : ''}.` });
        break;
      }
      case 'put_away': {
        if (g.scene !== SC.storage) return fail('not-here', 'the wedges go in the storage closet');
        if (!g.carrying.length) return fail('empty-hands', "you aren't carrying a wedge");
        const n = g.carrying.length; g.carrying.forEach(w => { g.wedges[w].at = 'storage'; }); g.carrying = []; g.t += C.take_s * n; entry.count = n;
        events.push({ type: 'put-away', text: `${n === 2 ? 'Two wedges' : 'A wedge'} back in the closet. ${WIDS.filter(w => g.wedges[w].at === 'storage').length} of ${WIDS.length} home.` });
        break;
      }
      case 'door': {
        if (g.scene !== SC.door) return fail('not-here', "you're not at the closet door");
        const d = g.door, say = text => events.push({ type: 'door', do: a.do, text });
        g.t += C.door_s; entry.do = a.do;
        if (a.do === 'look') { g.evidence.push({ seq: entry.seq, kind: 'look', fixed: d.fixed, bolt: d.bolt, boltIn: d.boltIn });
          say(d.fixed === 'open' ? 'Both halves are open.' : `The fixed half is ${d.fixed === 'gap' ? 'not quite closed: a gap at the top, between the door and the frame' : 'flush with the frame, no gap at the top'}.${d.bolt ? (d.boltIn ? ' The bolt is in its hole.' : ' The bolt is flipped, but it sits on top of the frame, not in the hole.') : ' The bolt is up.'}`); break; }
        if (a.do === 'close_fixed') { if (d.fixed !== 'open') return fail('already', 'the fixed half is already closed'); if (d.active === 'closed') return fail('blocked', 'open the other half first');
          d.fixed = d.gap ? 'gap' : 'flush'; doorChange(); say('You swing the fixed half shut.'); break; }
        if (a.do === 'push') { if (d.fixed === 'open') return fail('open', 'close the fixed half first'); if (d.bolt) return fail('bolted', 'flip the bolt back up first');
          if (d.active === 'closed') return fail('blocked', 'open the other half to reach it');
          const was = d.fixed; d.fixed = 'flush'; d.gap = false; doorChange(); entry.wasGap = was === 'gap'; say(was === 'gap' ? 'You push the top of the fixed half: it moves, and sits flush with the frame.' : "You push: it's already flush."); break; }
        if (a.do === 'bolt') { if (d.fixed === 'open') return fail('open', 'close the fixed half first'); if (d.active === 'closed') return fail('blocked', 'open the other half to reach the bolt');
          d.bolt = !d.bolt; d.boltIn = d.bolt && d.fixed === 'flush'; doorChange(); entry.to = d.bolt; say(d.bolt ? 'You flip the flush bolt.' : 'You flip the flush bolt back up.'); break; }
        if (a.do === 'close') { if (d.active === 'closed') return fail('already', "it's already closed"); if (d.fixed === 'open') return fail('open', 'close the fixed half first: this half closes against it');
          if (WIDS.some(w => g.wedges[w].at !== 'storage') && !a.force) entry.early = true;
          d.active = 'closed'; doorChange(); say('You close the other half.'); break; }
        if (a.do === 'open') { if (d.active === 'open') return fail('already', "it's already open"); d.active = 'open'; doorChange(); say('You open the door.'); break; }
        if (a.do === 'tug') { if (d.active !== 'closed') return fail('open', 'close the door first'); const held = latched(g);
          g.evidence.push({ seq: entry.seq, kind: 'tug', held }); entry.held = held;
          if (!held) { d.active = 'open'; doorChange(); }
          events.push({ type: 'tug', held, text: held ? 'You tug the door. It holds: BH 102 is locked up.' : 'You tug the door and both halves swing open. The bolt never caught.' }); break; }
        return fail('bad-action', 'do what to the door?');
      }
      case 'hint': {
        const k = hintKey(g); if (!k) return fail('no-hint', 'Nothing needs a hint right now.');
        const hs = k.fault ? FBY[k.fault].hints : H[k.key], used = g.hints[k.fault || k.key] || 0;
        if (used >= hs.length) return fail('no-more-hints', 'no more hints for this');
        const h = hs[used]; g.hints[k.fault || k.key] = used + 1; Object.assign(entry, { level: h.level, about: k.fault || k.key });
        const f = k.fault && faultOf(g, k.fault);
        events.push({ type: 'hint', level: h.level, of: hs.length, kind: h.kind, about: k.fault || k.key, text: fillMic(h.text, f && f.device) });
        break;
      }
      default: return fail('bad-action', `unknown action ${a.type}`);
    }
    g.faults.forEach((f, i) => { if (was[i] && !faultActive(g, f)) entry.fixedFault = f.id; });
    g.seq = entry.seq; entry.t = g.t; g.log.push(entry);
    return null;
  }

  // what's next, in procedure order; a fault's own hints win once it shows
  function hintKey(g) {
    if (complete(g)) return null;
    const alk = faultOf(g, 'alkaline-cells');
    if (alk && ['hand', 'charger'].includes(g.mics[alk.device].cells)) return { fault: alk.id };
    const lost = faultOf(g, 'mic-left-on-stage');
    if (lost && g.mics[lost.device].at === 'stage' && MICS.every(id => id === lost.device || g.mics[id].at === 'drawer')) return { fault: lost.id };
    const gap = faultOf(g, 'door-gap');
    if (gap && !latched(g) && g.evidence.some(e => e.kind === 'tug' && !e.held)) return { fault: gap.id };
    const s = steps(g);
    return { key: ['mics', 'wireless', 'amp', 'cables', 'wedges', 'door'].find(k => !s[k]) };
  }

  function act(g0, a) {
    const g = clone(g0), events = [];
    const err = apply(g, a || {}, events);
    if (err) return { game: g0, events: [], error: err };
    if (g.completedAt == null && complete(g)) {
      g.completedAt = { seq: g.seq, t: g.t };
      events.push({ type: 'objective-complete', text: `${content.objective.label}. Lights off; good night.` });
    }
    return { game: g, events, error: null };
  }

  function view(g) {
    const hk = hintKey(g), hs = hk ? (hk.fault ? FBY[hk.fault].hints : H[hk.key]) : null, st = steps(g);
    return {
      clock: clockText(toSec(C.start) + g.t), outBy: clockText(toSec(C.out_by)), scene: g.scene,
      mics: MICS.map(id => ({ id, label: L(id), channel: devices[id].channel, at: g.mics[id].at, on: g.mics[id].on, cells: g.mics[id].cells, alk: g.mics[id].cells !== 'in' ? g.mics[id].alk : null })),
      inDrawer: inDrawer(g), of: MICS.length, hand: g.hand.slice(), wireless: g.wireless, rf: g.scene === SC.receivers ? rfOn(g) : null,
      front: { furman: g.rack.furman, nx3000: g.rack.nx3000, powerLed: ampOn(g) },
      spots: SPOTS.map(s => ({ id: s, label: SP[s].label, wedge: g.spots[s], jacks: g.spots[s] ? Array.from({ length: W.jacks }, (_, k) => ({ jack: `${g.spots[s]}:${k + 1}`, cable: inJack(g, `${g.spots[s]}:${k + 1}`) })) : [] })),
      amp: AMPJ.map(j => ({ jack: j, channel: j.split(':')[1], cable: inJack(g, j) })),
      hook: CIDS.filter(c => g.cables[c].at === 'hook'), held: g.held.slice(), carrying: g.carrying.slice(),
      wedgesHome: WIDS.filter(w => g.wedges[w].at === 'storage').length, wedgesOf: WIDS.length, door: { fixed: g.door.fixed, active: g.door.active, bolt: g.door.bolt },
      byHand: g.log.filter(e => e.type === 'stow' && !e.via).length, doneCount: Object.values(st).filter(Boolean).length,
      complete: g.completedAt != null, steps: content.procedure.steps.map(s => ({ ...s, done: st[s.id] })),
      hintsLeft: hs ? hs.length - (g.hints[hk.fault || hk.key] || 0) : 0,
      debug: { seed: g.seed, faults: g.faults.map(f => ({ ...f, label: FBY[f.id].label, active: faultActive(g, f) })), door: g.door, rack: g.rack, wireless: g.wireless },
    };
  }

  function debrief(g) {
    const Lg = g.log, at = e => clockText(toSec(C.start) + e.t), lines = [], loops = {}, done = complete(g), st = steps(g);
    lines.push(done ? `✅ The hall is put back by ${clockText(toSec(C.start) + g.completedAt.t)} (target ${clockText(toSec(C.out_by))}).`
      : `✅ Not done yet: ${content.procedure.steps.filter(s => !st[s.id]).map(s => s.short.toLowerCase()).join(', ')}.`);
    for (const f of g.faults) {
      const F = FBY[f.id], say = t => fillMic(t, f.device);
      const actE = Lg.find(e => e.fixedFault === f.id), actSeq = actE ? actE.seq : Infinity;
      if (f.id === 'alkaline-cells') {
        const opened = Lg.find(e => (e.type === 'unload' && e.device === f.device) || (e.type === 'rest' && e.stoppedAt === f.device));
        const onCharger = Lg.find(e => e.type === 'cells' && e.device === f.device && e.to === 'charger');
        if (!opened) { lines.push(`🔋 ${F.label}: you haven't opened ${L(f.device)} yet.`); loops[f.id] = null; continue; }
        lines.push(`🔋 ${say(F.debrief.failed)}`);
        lines.push(onCharger ? `  ⚠️ ${at(onCharger)}: they went on the charger${actE ? `, then into the bin at ${at(actE)}` : ', and they are still there'}. Read the cells before they go anywhere.` : actE ? `  ✓ ${at(actE)}: ${F.debrief.act}` : '  ✗ the cells are still in your hand.');
        loops[f.id] = { safe: !onCharger, act: !!actE };
        continue;
      }
      if (f.id === 'mic-left-on-stage') {
        const noticeE = Lg.find(e => e.seq < actSeq && g.evidence.some(x => x.seq === e.seq && x.kind === 'count' && x.n < x.of));
        const traceE = Lg.find(e => e.seq < actSeq && g.evidence.some(x => x.seq === e.seq && x.kind === 'rf' && x.rf.includes(f.device)));
        const verifyE = actE ? Lg.find(e => e.seq > actSeq && g.evidence.some(x => x.seq === e.seq && x.kind === 'count' && x.n === x.of)) : null;
        lines.push(`🧠 What failed: ${say(F.debrief.failed)}`);
        lines.push(noticeE ? `  NOTICE ✓ ${at(noticeE)}: the count came up short (${g.evidence.find(x => x.seq === noticeE.seq).n} of ${MICS.length}).` : actE ? '  NOTICE ✗ you found it before counting (lucky, not a check).' : '  NOTICE ✗ not yet: count the drawer.');
        lines.push(traceE ? `  TRACE ✓ ${at(traceE)}: the receivers still showed RF on its channel: on, and in range.` : actE ? '  TRACE ✗ you went looking without checking the receivers (they show which mic is still on).' : '  TRACE ✗ not yet.');
        lines.push(actE ? `  ACT ✓ ${at(actE)}: ${say(F.debrief.act)}` : '  ACT ✗ it is still out there.');
        lines.push(verifyE ? `  VERIFY ✓ ${at(verifyE)}: counted ${MICS.length} of ${MICS.length} in the drawer.` : actE ? '  VERIFY ✗ count the drawer again once it is in.' : '  VERIFY ✗ not yet.');
        const dark = Lg.find(e => e.type === 'switch' && e.device === 'wireless' && e.rfLeft && e.rfLeft.includes(f.device) && e.seq < actSeq);
        if (dark) lines.push(`  (The wireless rack went off at ${at(dark)} with that mic still on: its receivers could have told you which one was missing.)`);
        loops[f.id] = { notice: !!noticeE, trace: !!traceE, act: !!actE, verify: !!verifyE };
        continue;
      }
      // the door
      const failE = Lg.find(e => e.type === 'door' && e.do === 'tug' && e.held === false);
      const pushE = Lg.find(e => e.type === 'door' && e.do === 'push' && e.wasGap);
      if (!failE && pushE) { lines.push(`🚪 BH 102 door: the fixed half had a gap at the top, and you pushed it flush before the bolt (${at(pushE)}). That's the procedure.`); loops[f.id] = { prevented: true }; continue; }
      if (!failE && !pushE) { lines.push(`🚪 ${F.label}: ${g.door.fixed === 'open' ? "you haven't closed the door yet." : 'not found yet.'}`); loops[f.id] = null; continue; }
      const traceE = Lg.find(e => e.seq > failE.seq && e.type === 'door' && e.do === 'look' && g.evidence.some(x => x.seq === e.seq && x.kind === 'look' && (x.fixed === 'gap' || (x.bolt && !x.boltIn))));
      const fixE = Lg.find(e => e.seq > failE.seq && e.type === 'door' && e.do === 'push' && e.wasGap);
      const verifyE = fixE ? Lg.find(e => e.seq > fixE.seq && e.type === 'door' && e.do === 'tug' && e.held) : null;
      lines.push(`🧠 What failed: ${F.debrief.failed}`);
      lines.push(`  NOTICE ✓ ${at(failE)}: you tugged the door and it swung open.`);
      lines.push(traceE ? `  TRACE ✓ ${at(traceE)}: you looked at the top of the fixed half.` : fixE ? '  TRACE ✗ you pushed it without looking at why it failed.' : '  TRACE ✗ not yet: look at the top of the fixed half.');
      lines.push(fixE ? `  ACT ✓ ${at(fixE)}: ${F.debrief.act}` : '  ACT ✗ the fixed half still has a gap.');
      lines.push(verifyE ? `  VERIFY ✓ ${at(verifyE)}: tugged again, and it held.` : fixE ? '  VERIFY ✗ tug the door again.' : '  VERIFY ✗ not yet.');
      loops[f.id] = { notice: true, trace: !!traceE, act: !!fixE, verify: !!verifyE };
    }
    const hot = Lg.filter(e => e.type === 'unplug' && e.hot);
    if (hot.length) lines.push(`⚠️ ${hot.length} speakON${hot.length > 1 ? 's' : ''} pulled with the NX3000 on (first at ${at(hot[0])}). Amp off first, then the cables.`);
    const order = Lg.find(e => e.type === 'switch' && e.device === 'furman' && e.to === 'off' && e.ampWasOn);
    if (order) lines.push(`⚠️ The Furman went off with the NX3000 still on (${at(order)}). Off is the reverse of on: the amp, then the Furman.`);
    const early = Lg.find(e => e.type === 'door' && e.do === 'close' && e.early);
    if (early) lines.push(`🚪 You shut the closet at ${at(early)} before all the wedges were in.`);
    const rest = Lg.filter(e => e.type === 'rest').reduce((s, e) => s + e.stowed.length, 0);
    lines.push(`🎤 Mics: ${Lg.filter(e => e.type === 'stow').length} stowed by hand, ${rest} by "${content.skip.label}"; ${inDrawer(g)} of ${MICS.length} in the drawer.`);
    const lifts = Lg.filter(e => e.type === 'lift'), fails = lifts.reduce((s, e) => s + e.fails, 0);
    if (lifts.length) lines.push(`🏋️ ${lifts.length} trip${lifts.length === 1 ? '' : 's'} with wedges (${lifts.map(e => e.count).join(' + ')})${fails ? `, ${fails} failed lift${fails > 1 ? 's' : ''}` : ''}; ${Lg.filter(e => e.type === 'go').reduce((s, e) => s + e.seconds, 0)} s walking.`);
    const used = Object.entries(g.hints).filter(([, n]) => n);
    lines.push(`🆘 Hints used: ${used.length ? used.map(([k, n]) => `${FBY[k] ? FBY[k].label.toLowerCase() : k}: ${n}`).join('; ') : 'none'}.`);
    lines.push('📚 Concepts: count before you call it done; the receivers show which mics are still on; never alkalines on the charger; amp off before speaker cables, and off is the reverse of on; flipped isn\'t latched until it holds.');
    return { done, loops, hot: hot.length, badOrder: !!order, actions: Lg.length, gameSeconds: g.t, lines };
  }

  return { start, act, view, debrief };
}
