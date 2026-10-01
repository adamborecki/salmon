// Gameplay slice engine: the battery-in check at FOH, a NOTICE -> TRACE -> ACT -> VERIFY loop
// (PRODUCT_DESIGN.md sections 3, 45, 46, 51, 94 and principle 4.10). Pure functions over plain JSON
// state: no DOM, no dependencies, no UI assumptions, so it fits whichever app shape the owner picks
// (section 84 is still open).
//
//   const eng = engine(content);            // content: tools/gameplay-slice/content/*.json
//   let g = eng.start('VJ-48217');          // seeded: the same seed always puts the faults on the same mics
//   ({ game: g, events, error } = eng.act(g, { type: 'go', scene: 'foh-mic-drawer' }));
//   eng.view(g)     -> what the player can know (evidence only) plus a debug view (the truth)
//   eng.debrief(g)  -> per fault: what failed, what was noticed / traced / changed / verified; hints, time
//
// Actions: go {scene} · pick_up {device} · put {place: 'drawer'|'chair'|'bad'} · insert_batteries (at the charger)
//          · check_batteries · reseat_batteries · press {how: 'tap'|'hold'}
//          · inspect (look closely at the held mic's display; the view shows it anyway) · talk · hint · check_rest
// With two mics in hand, actions on a mic take {device}.
//
// Faults are data (content.faults): each one's `set` is applied to a mic chosen by the seed, either at
// the start or when that mic's batteries go in (`apply_on`). A fault is resolved either by a fix
// (`resolution: 'fix'`: its `set` no longer holds) or by setting the mic aside as bad
// (`resolution: 'replace'`: a spare covers it). Hints and debrief text come with each fault, so the
// same engine runs the mute fault (content.fault_library) for the line check later.
//
// Key rule (section 3, "fixed is not the same as verified"): a mic only counts as verified by evidence
// seen at its X32 input while talking into it, and that evidence must be newer than the last state
// change of any device on its path. Unmuting alone never completes anything.
//
// "Check the rest" (principle 4.10) is a macro of the same basic actions, so it produces the same
// evidence, costs the same game time, and stops at the first mic that shows no signal at the X32.

const clone = o => JSON.parse(JSON.stringify(o));

function hashSeed(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
function rng(seed) { let a = hashSeed(seed); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const devOf = point => point.split(':')[0];
const toSec = hms => { const [h, m, s] = hms.split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };
export function clockText(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function engine(content) {
  const D = content.devices, B = content.behaviour, C = content.clock, P = content.places, S = content.skip;
  const FS = content.faults, FBY = Object.fromEntries(FS.map(f => [f.id, f]));
  const handhelds = Object.keys(D).filter(id => D[id].type === 'wireless-handheld');
  const micFor = ch => handhelds.find(id => D[id].channel === ch);
  const inPlay = content.setup.mics_in_play.map(micFor);
  if (inPlay.some(x => !x)) throw new Error('mics_in_play names a channel with no handheld');
  inPlay.sort((a, b) => D[a].channel - D[b].channel);
  const HANDS = B.hands.value, CELLS = B.battery.value.cells_per_mic;
  const chairScenes = new Set(P.chair.reachable_from), badScenes = new Set((P.bad || P.chair).reachable_from);
  const NEED = content.objective.need_verified ? content.objective.need_verified.value : inPlay.length;
  const x32Scene = Object.keys(content.displays).find(k => content.displays[k].device === 'foh-x32');

  // the signal path from a source, following connections: handheld-06 -> ptu6000-rx:6 -> foh-x32:in:6
  function path(src) {
    const out = [src]; let at = src;
    for (let guard = 0; guard < 16; guard++) {
      const c = content.connections.find(c => c.from === at); if (!c) break;
      out.push(c.to); at = c.to;
    }
    return out;
  }
  const x32Point = mic => path(mic).find(p => devOf(p) === 'foh-x32');
  const rxPoint = mic => path(mic).find(p => devOf(p) === 'ptu6000-rx');

  // does this point pass audio on, given current device state? (device behaviour by type; per-type
  // rules live here rather than in content until a second device of a type needs something different)
  function passes(g, point) {
    const d = g.devices[devOf(point)], s = d.state;
    // a bad battery never gets this far (it does not switch on); an unpaired mic transmits, but not to its receiver
    if (d.type === 'wireless-handheld') return s.power === 'on' && !s.muted && s.paired !== false;
    return s.power === 'on';
  }
  // talking into `mic`: which points on its path carry signal right now
  function reach(g, mic) {
    let ok = true;
    return path(mic).map((p, i) => { if (i === 0) { const live = passes(g, p); ok = live; return { point: p, signal: true, passesOn: live }; }
      ok = ok && passes(g, p); return { point: p, signal: ok }; });
  }
  const lastChange = (g, mic) => Math.max(0, ...path(mic).map(p => g.changed[devOf(p)] || 0));
  const validPositive = (g, mic) => g.evidence.some(e => e.mic === mic && e.point === x32Point(mic) && e.signal && e.seq > lastChange(g, mic));

  const held = g => g.hands.filter(Boolean);
  // what the handheld's small LCD shows (layout is a placeholder: content behaviour.lcd)
  function lcd(g, mic) {
    const s = g.devices[mic].state;
    return s.power === 'on' ? { on: true, group: g.rf[mic].group, channel: g.rf[mic].channel, muted: !!s.muted, battery: 'full' } : { on: false };
  }
  // is fault i present on its mic right now? (every field of its `set` still holds)
  const faultActive = (g, i) => Object.entries(FBY[g.faults[i].id].set).every(([k, v]) => g.devices[g.faults[i].device].state[k] === v);
  const resolved = (g, i) => FBY[g.faults[i].id].resolution === 'replace' ? g.where[g.faults[i].device] === 'bad' : g.faults[i].applied && !faultActive(g, i);
  const setAside = g => g.inPlay.filter(m => g.where[m] === 'bad');
  const verifiedCount = g => g.inPlay.filter(m => validPositive(g, m)).length;
  const complete = g => g.inPlay.every(m => validPositive(g, m) || g.where[m] === 'bad') && verifiedCount(g) >= NEED;
  const done = (g, mic) => (validPositive(g, mic) && g.where[mic] === 'chair') || g.where[mic] === 'bad';
  const remaining = g => g.inPlay.filter(m => !done(g, m));
  const byHand = g => g.inPlay.filter(m => g.evidence.some(e => e.mic === m && e.via === 'hand' && e.point === x32Point(m) && e.signal));
  function skipState(g) {
    const n = byHand(g).length, left = remaining(g);
    if (n < S.after_by_hand) return { available: false, byHand: n, need: S.after_by_hand, left: left.length, reason: `Check ${S.after_by_hand - n} more by hand first.` };
    if (!left.length) return { available: false, byHand: n, need: S.after_by_hand, left: 0, reason: 'Every mic is verified and on the chair, or set aside.' };
    if (held(g).length) return { available: false, byHand: n, need: S.after_by_hand, left: left.length, reason: `Put the mic${held(g).length > 1 ? 's' : ''} in your hands down first.` };
    return { available: true, byHand: n, need: S.after_by_hand, left: left.length, reason: null };
  }
  // which fault a hint is about: one you've seen go wrong and are holding, else any you've seen go wrong,
  // else the next unresolved one (holding a faulty mic you haven't noticed yet must not give it away)
  function hintTarget(g) {
    const open = g.faults.map((f, i) => i).filter(i => !resolved(g, i));
    const seenWrong = i => { const m = g.faults[i].device; return g.evidence.some(e => e.mic === m && !e.signal) || g.log.some(e => e.device === m && e.nothing); };
    const i = open.find(i => g.hands.includes(g.faults[i].device) && seenWrong(i)) ?? open.find(seenWrong) ?? open[0];
    return i == null ? null : g.faults[i].id;
  }

  function start(seed = 'VJ-00001', opts = {}) {
    const devices = {}, where = {}, rf = {}, rfRx = {}, taken = new Set(), faults = [];
    for (const [id, d] of Object.entries(D)) devices[id] = { type: d.type, state: clone(d.state) };
    for (const m of handhelds) where[m] = D[m].home;
    FS.forEach((f, k) => {
      if (opts.only && !opts.only.includes(f.id)) return;
      const forced = (opts.faultChannels || {})[f.id] ?? (k === 0 ? opts.faultChannel : undefined);
      const pool = (forced != null ? [forced] : f.placement.channels).map(micFor).filter(m => inPlay.includes(m) && !taken.has(m));
      if (!pool.length) throw new Error(`fault ${f.id}: placement names no free mic in play`);
      const pick = pool[Math.floor(rng(k === 0 ? seed : `${seed}:${f.id}`)() * pool.length)];
      taken.add(pick);
      if (f.apply_on === 'start') Object.assign(devices[pick].state, f.set);
      faults.push({ id: f.id, device: pick, applied: f.apply_on === 'start' });
    });
    // RF group/channel: seeded, unique per mic (placeholder values, content.rf); a paired mic and its receiver
    // slot share them; an unpaired mic shows a combination nobody else uses
    const r = rng(seed + ':rf'), combos = [];
    for (let gi = 1; gi <= content.rf.groups; gi++) for (let ci = 1; ci <= content.rf.channels_per_group; ci++) combos.push({ group: gi, channel: ci });
    if (combos.length <= handhelds.length) throw new Error('not enough RF group/channel combinations for every mic');
    for (let i = combos.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [combos[i], combos[j]] = [combos[j], combos[i]]; }
    let spare = handhelds.length;
    handhelds.slice().sort((a, b) => D[a].channel - D[b].channel).forEach((m, i) => {
      rfRx[m] = combos[i]; rf[m] = devices[m].state.paired === false ? combos[spare++] : combos[i];
    });
    return {
      v: 4, content: content.id, seed, seq: 0, t: 0, scene: 'foh-wide',
      hands: Array(HANDS.slots).fill(null), where, read: {}, rf, rfRx, cells: P.charger.cells,
      devices, inPlay: [...inPlay], faults,
      changed: {}, evidence: [], hints: {}, log: [], completedAt: null,
    };
  }

  // one basic action, applied in place to g; returns an error {code, message} or null
  function apply(g, a, via, events) {
    const fail = (code, message) => ({ code, message });
    const tick = s => { g.t += s; };
    const entry = { seq: g.seq + 1, t: null, type: a.type };
    if (via !== 'hand') entry.via = via;
    const faultWas = g.faults.map((_, i) => faultActive(g, i));
    // the mic an action is about: the one named, or the only one held; [id, error]
    const inHand = empty => {
      const h = held(g);
      if (a.device) return h.includes(a.device) ? [a.device, null] : [null, fail('not-held', `you are not holding ${D[a.device] ? D[a.device].label : a.device}`)];
      if (!h.length) return [null, fail('empty-hands', empty)];
      return h.length === 1 ? [h[0], null] : [null, fail('which-mic', 'you have two mics in hand: say which one')];
    };
    const reachable = { drawer: s => s === P.drawer.scene, chair: s => chairScenes.has(s), bad: s => badScenes.has(s) };
    const placeName = { drawer: P.drawer.label.toLowerCase(), chair: P.chair.label.toLowerCase(), bad: 'set-aside spot' };

    switch (a.type) {
      case 'go': {
        if (!a.scene) return fail('bad-action', 'go needs a scene');
        g.scene = a.scene; tick(C.move_s); entry.scene = a.scene;
        const disp = content.displays[a.scene]; if (disp) entry.looksAt = disp.device;
        break;
      }
      case 'pick_up': {
        const id = a.device, d = D[id];
        if (!d || d.type !== 'wireless-handheld') return fail('bad-device', 'you can only pick up a handheld here');
        if (g.hands.includes(id)) return fail('already-held', `${d.label} is already in your hand`);
        if (held(g).length >= HANDS.max_mics) return fail('hands-full', HANDS.max_mics === 1 ? `Put ${D[held(g)[0]].label} down first: one mic at a time for now.` : 'Your hands are full: put a mic down first.');
        const from = g.where[id];
        if (!reachable[from](g.scene)) return fail('not-here', `${d.label} is in the ${placeName[from]}`);
        g.hands[g.hands.indexOf(null)] = id; g.where[id] = 'hand'; tick(C.action_s);
        entry.device = id; entry.from = from;
        break;
      }
      case 'put': {
        const [id, err] = inHand('you are not holding a mic'); if (err) return err;
        if (!reachable[a.place]) return fail('bad-action', "put needs place: 'drawer', 'chair' or 'bad'");
        if (!reachable[a.place](g.scene)) return fail('not-here', `the ${placeName[a.place]} is not here`);
        g.hands[g.hands.indexOf(id)] = null; g.where[id] = a.place; delete g.read[id]; tick(C.action_s);
        entry.device = id; entry.place = a.place;
        break;
      }
      case 'press': {
        const [id, err] = inHand('pick up a handheld first'); if (err) return err;
        const s = g.devices[id].state, before = clone(s), passedBefore = passes(g, id);
        if (a.how === 'tap') { if (s.power === 'on') s.muted = !s.muted; }
        else if (a.how === 'hold') {
          if (s.power === 'on') s.power = 'off';
          else if (s.battery === 'ok') { s.power = 'on'; if (!B.mute_survives_power_cycle.value) s.muted = false; }
        } else return fail('bad-action', "press needs how: 'tap' or 'hold'");
        tick(C.action_s);
        Object.assign(entry, { device: id, how: a.how, before, after: clone(s), passedBefore, passedAfter: passes(g, id) });
        if (JSON.stringify(before) !== JSON.stringify(s)) { g.changed[id] = entry.seq; entry.changed = true; }
        else {
          entry.nothing = true;
          events.push({ type: 'nothing', device: id, text: a.how === 'tap' ? 'Nothing happens: it is switched off.' : s.battery === 'none' ? 'Nothing happens: there are no batteries in it.' : 'Nothing happens: it does not switch on.' });
        }
        break;
      }
      case 'insert_batteries': {                 // two cells from the charger (content behaviour.battery, places.charger)
        const [id, err] = inHand('pick up a mic first'); if (err) return err;
        if (g.scene !== P.charger.scene) return fail('not-here', 'the battery charger is not here');
        const s = g.devices[id].state;
        if (s.battery !== 'none') return fail('batteries-in', `${D[id].label} already has batteries in it`);
        if (g.cells < CELLS) return fail('charger-empty', 'the charger has no charged batteries left');
        g.cells -= CELLS; s.battery = 'ok';
        for (const f of g.faults) if (f.device === id && !f.applied && FBY[f.id].apply_on === 'insert_batteries') { Object.assign(s, FBY[f.id].set); f.applied = true; }
        g.changed[id] = g.seq + 1; tick(C.action_s); entry.device = id;
        events.push({ type: 'batteries-in', device: id, cellsLeft: g.cells });
        break;
      }
      case 'check_batteries': {                  // open it and look: orientation shows, charge doesn't
        const [id, err] = inHand('pick up a mic first'); if (err) return err;
        const b = g.devices[id].state.battery;
        if (b === 'none') return fail('no-batteries', `${D[id].label} has no batteries in it`);
        tick(C.action_s); entry.device = id;
        events.push({ type: 'batteries', device: id, reversed: b === 'reversed', text: b === 'reversed' ? `The batteries in ${D[id].label} are in the wrong way round.` : `The batteries in ${D[id].label} are in the right way round.` });
        break;
      }
      case 'reseat_batteries': {                 // take them out and put them back the right way round
        const [id, err] = inHand('pick up a mic first'); if (err) return err;
        const s = g.devices[id].state, before = clone(s);
        if (s.battery === 'none') return fail('no-batteries', `${D[id].label} has no batteries in it`);
        s.power = 'off';
        if (s.battery === 'reversed') s.battery = 'ok';
        tick(C.action_s); entry.device = id;
        if (JSON.stringify(before) !== JSON.stringify(s)) { g.changed[id] = entry.seq; entry.changed = true; }
        else events.push({ type: 'nothing', device: id, text: 'They were already the right way round.' });
        break;
      }
      case 'inspect': {                          // read the small display: it has to be in your hand
        const [id, err] = inHand('pick up a mic to read its display'); if (err) return err;
        g.read[id] = true; tick(C.action_s); entry.device = id; entry.lcd = lcd(g, id);
        events.push({ type: 'inspect', device: id, lcd: lcd(g, id) });
        break;
      }
      case 'talk': {
        const [mic, err] = inHand('hold a handheld to talk into it'); if (err) return err;
        const r = reach(g, mic), disp = content.displays[g.scene];
        tick(C.action_s); entry.mic = mic; entry.scene = g.scene;
        const seen = disp ? r.filter(x => devOf(x.point) === disp.device) : [];
        entry.observed = seen.map(x => ({ point: x.point, signal: x.signal }));
        for (const x of seen) { g.evidence.push({ seq: entry.seq, mic, point: x.point, signal: x.signal, via }); events.push({ type: 'meter', point: x.point, signal: x.signal }); }
        if (!seen.length) events.push({ type: 'no-display', text: 'Nothing here shows the signal. Talk while looking at a meter.' });
        break;
      }
      case 'hint': {
        const id = hintTarget(g);
        if (!id) return fail('no-hint', 'Nothing needs a hint right now.');
        const hs = FBY[id].hints, used = g.hints[id] || 0;
        if (used >= hs.length) return fail('no-more-hints', 'no more hints for this problem');
        const h = hs[used]; g.hints[id] = used + 1; entry.level = h.level; entry.fault = id;
        events.push({ type: 'hint', level: h.level, kind: h.kind, fault: id, text: h.text });
        break;
      }
      default: return fail('bad-action', `unknown action ${a.type}`);
    }
    g.faults.forEach((f, i) => { if (faultWas[i] && !faultActive(g, i)) entry.fixedFault = f.id; });
    g.seq = entry.seq; entry.t = g.t; g.log.push(entry);
    return null;
  }

  // "Check the rest" (principle 4.10): the by-hand routine for every remaining mic, in channel order,
  // stopping at the first abnormal one with it in your hand at the X32
  function checkRest(g, events) {
    const st = skipState(g);
    if (!st.available) return { code: 'skip-unavailable', message: st.reason };
    const step = a => { const e = apply(g, a, 'skip', []); if (e) throw new Error(`check the rest, ${a.type}: ${e.message}`); };
    const goTo = scene => { if (g.scene !== scene) step({ type: 'go', scene }); };
    const checked = [], todo = remaining(g); let stoppedAt = null, why = null;
    // one trip per hands-full: take up to max_mics from the same place, batteries in and switch on, then check each at the X32
    for (let i = 0; i < todo.length && !stoppedAt;) {
      const from = g.where[todo[i]], trip = [];
      while (trip.length < HANDS.max_mics && i < todo.length && g.where[todo[i]] === from) trip.push(todo[i++]);
      goTo(from === 'drawer' ? P.drawer.scene : x32Scene);
      for (const m of trip) step({ type: 'pick_up', device: m });
      if (trip.some(m => g.devices[m].state.battery === 'none')) {
        goTo(P.charger.scene);
        for (const m of trip) if (g.devices[m].state.battery === 'none') step({ type: 'insert_batteries', device: m });
      }
      for (const m of trip) if (g.devices[m].state.power === 'off') step({ type: 'press', how: 'hold', device: m });
      goTo(x32Scene);
      for (const m of trip) {
        step({ type: 'talk', device: m });
        if (S.stop_if.includes('no-signal-at-x32') && !validPositive(g, m)) { stoppedAt = m; why = `no signal at X32 ch ${D[m].channel}`; break; }
        step({ type: 'put', place: 'chair', device: m }); checked.push(m);
      }
    }
    const entry = { seq: g.seq + 1, t: g.t, type: 'check_rest', checked, stoppedAt, why };
    g.seq = entry.seq; g.log.push(entry);
    events.push(stoppedAt
      ? { type: 'skip-stopped', mic: stoppedAt, checked, text: `${S.label} stopped at ${D[stoppedAt].label}: ${why}. It is in your hand, at the X32${held(g).length > 1 ? `, with ${held(g).filter(m => m !== stoppedAt).map(m => D[m].label).join(', ')} (not checked yet)` : ''}.` }
      : { type: 'skip-done', checked, text: `${S.label}: ${checked.length} more verified at the X32 and put on the chair.` });
    return null;
  }

  function act(g0, a) {
    const g = clone(g0), events = [];
    const err = a && a.type === 'check_rest' ? checkRest(g, events) : apply(g, a || {}, 'hand', events);
    if (err) return { game: g0, events: [], error: err };
    // a mic that just became verified by hand gets the non-blocking toast of section 55
    if (a.type === 'talk') for (const m of g.inPlay) if (validPositive(g, m) && !validPositive(g0, m))
      events.push({ type: 'verified', mic: m, text: `Signal verified: receiver → X32 ch ${D[m].channel}.` });
    if (a.type === 'put' && a.place === 'bad') events.push({ type: 'set-aside', device: g.log.at(-1).device, text: `${D[g.log.at(-1).device].label} set aside as a bad mic. A spare covers it.` });
    if (g.completedAt == null && complete(g)) {
      g.completedAt = { seq: g.seq, t: g.t };
      const b = setAside(g).length;
      events.push({ type: 'objective-complete', text: `${content.objective.label}: ${verifiedCount(g)} verified${b ? `, ${b} set aside` : ''}.` });
    }
    return { game: g, events, error: null };
  }

  // what the player can know, from their own evidence only; `debug` is the instructor view (section 80)
  function micStatus(g, mic) {
    if (g.where[mic] === 'bad') return 'set-aside';
    if (validPositive(g, mic)) return 'verified';
    const mine = g.evidence.filter(e => e.mic === mic);
    if (!mine.length) return 'not-checked';
    const lastSeq = Math.max(...mine.map(e => e.seq)), latest = mine.filter(e => e.seq === lastSeq);
    if (latest.some(e => !e.signal)) return 'no-signal-seen';
    if (latest.some(e => e.point === x32Point(mic))) return 'recheck';   // it read fine, but something on its path changed since
    return 'receiver-only';                                            // signal seen at the receiver; the goal is the X32 input
  }
  // the visible step list, ticked for the mic in hand, or else the next one not yet done
  function procedure(g) {
    const h = held(g), cur = h.find(m => !validPositive(g, m)) || h[0] || remaining(g)[0] || null;
    const tick = {
      take: m => g.where[m] === 'hand',
      batteries: m => g.where[m] === 'hand' && g.devices[m].state.battery !== 'none',
      power: m => g.where[m] === 'hand' && g.devices[m].state.power === 'on',
      talk: m => validPositive(g, m),
      chair: m => g.where[m] === 'chair',
    };
    return {
      mic: cur, steps: content.procedure.steps.map(s => ({ id: s.id, text: s.text, simulated: s.simulated !== false,
        done: s.simulated === false ? null : cur ? tick[s.id](cur) : true })), optional: content.procedure.optional, badMic: content.procedure.bad_mic,
      skip: { label: S.label, ...skipState(g) },
    };
  }
  function view(g) {
    const mics = g.inPlay.map(m => ({ id: m, label: D[m].label, channel: D[m].channel, windscreen: D[m].windscreen, ring: D[m].ring, status: micStatus(g, m), where: g.where[m] }));
    const target = hintTarget(g);
    return {
      clock: clockText(toSec(C.start) + g.t), readyBy: clockText(toSec(C.ready_by)),
      scene: g.scene, hands: [...g.hands], held: held(g), holding: held(g)[0] || null, display: content.displays[g.scene] || null,
      lcd: Object.fromEntries(held(g).map(m => [m, lcd(g, m)])),                                     // a mic in hand shows its display (Cary, 2026-10-01)
      canPut: { drawer: g.scene === P.drawer.scene, chair: chairScenes.has(g.scene), bad: badScenes.has(g.scene) },
      charger: { label: P.charger.label, here: g.scene === P.charger.scene, cells: g.cells },
      batteriesIn: Object.fromEntries(held(g).map(m => [m, g.devices[m].state.battery !== 'none'])),   // what the player put in, not how
      rfRx: Object.fromEntries(g.inPlay.map(m => [m, g.rfRx[m]])),                                       // printed on each receiver slot
      objective: { label: content.objective.label, goal: content.objective.goal, verified: verifiedCount(g), setAside: setAside(g).length, need: NEED,
        of: mics.length, complete: g.completedAt != null, mics },
      procedure: procedure(g),
      hintsLeft: target ? FBY[target].hints.length - (g.hints[target] || 0) : 0,
      debug: {
        seed: g.seed, faults: g.faults.map((f, i) => ({ ...f, label: FBY[f.id].label, active: faultActive(g, i), resolved: resolved(g, i) })),
        reach: Object.fromEntries(g.inPlay.map(m => [m, reach(g, m)])),
        state: Object.fromEntries(g.inPlay.map(m => [m, g.devices[m].state])),
        mechanicallySatisfied: g.inPlay.filter(m => reach(g, m).every(x => x.signal)),
      },
    };
  }

  function debrief(g) {
    const L = g.log, at = e => clockText(toSec(C.start) + e.t);
    const faultMics = new Set(g.faults.map(f => f.device));
    const allDone = complete(g), aside = setAside(g);
    const skips = L.filter(e => e.type === 'check_rest');
    const viaSkip = g.inPlay.filter(m => validPositive(g, m) && !g.evidence.some(e => e.mic === m && e.via === 'hand' && e.signal && e.point === x32Point(m)));
    const offChair = g.inPlay.filter(m => g.where[m] !== 'chair' && g.where[m] !== 'bad');
    // changes beyond the routine (switching a mic on is part of it) and beyond the fixes
    const extra = L.filter(e => e.type === 'press' && e.changed && !e.fixedFault && !(e.how === 'hold' && e.before.power === 'off'));
    const broke = extra.filter(e => e.passedBefore && !e.passedAfter);
    const endBroken = g.inPlay.filter(m => g.where[m] !== 'bad' && !reach(g, m).every(x => x.signal));
    const lines = [], loops = {};

    lines.push(allDone
      ? `✅ Ready: ${verifiedCount(g)} mics verified at the X32${aside.length ? ` and ${aside.length} set aside` : ''} by ${clockText(toSec(C.start) + (g.completedAt ? g.completedAt.t : g.t))} (rehearsal at ${clockText(toSec(C.ready_by))}).`
      : `✅ Not ready yet: ${g.inPlay.filter(m => !validPositive(g, m) && g.where[m] !== 'bad').map(m => D[m].label).join(', ') || 'no mic left to check'}${verifiedCount(g) < NEED ? `; ${verifiedCount(g)} verified, and every musician needs a mic (${NEED})` : ''}.`);

    g.faults.forEach((gf, i) => {
      const F = FBY[gf.id], T = F.debrief, f = gf.device, ch = D[f].channel, lbl = D[f].label, say = t => t.replace(/\{mic\}/g, lbl);
      if (!gf.applied) { lines.push(`🧠 ${F.label}: it didn't come up this time (${lbl}'s batteries never went in).`); loops[gf.id] = null; return; }
      const actE = F.resolution === 'replace' ? L.find(e => e.type === 'put' && e.place === 'bad' && e.device === f) : L.find(e => e.fixedFault === gf.id);
      const actSeq = actE ? actE.seq : Infinity;
      const noticeE = L.find(e => e.seq < actSeq && ((e.type === 'talk' && e.mic === f && (e.observed || []).some(o => !o.signal)) ||
        (e.type === 'press' && e.device === f && e.nothing && e.how === 'hold' && e.before.battery !== 'none')));
      const traceE = L.find(e => e.seq < actSeq && !e.via && ((e.type === 'talk' && e.mic === f && (e.observed || []).some(o => o.point === rxPoint(f) && !o.signal)) ||
        (['inspect', 'check_batteries'].includes(e.type) && e.device === f)));
      const verifyE = F.resolution === 'replace' ? null : L.find(e => e.type === 'talk' && e.mic === f && e.seq > actSeq && (e.observed || []).some(o => o.point === x32Point(f) && o.signal));
      const covered = F.resolution === 'replace' && actE && g.where[f] === 'bad' && verifiedCount(g) >= NEED;
      lines.push(`🧠 What failed: ${say(T.failed)}`);
      lines.push(noticeE ? `  NOTICE ✓ ${at(noticeE)}: ${noticeE.via === 'skip' ? `${S.label} stopped on ${lbl}: no signal at the X32`
          : noticeE.type === 'press' ? `you tried to switch ${lbl} on and nothing happened`
          : `you talked into ${lbl} and saw no signal at the ${noticeE.observed.some(o => o.point === rxPoint(f)) ? 'receiver' : 'X32'}`}.`
        : actE ? `  NOTICE ✗ the problem was never observed before ${F.resolution === 'replace' ? 'you set it aside' : 'the fix'} (that came first).` : '  NOTICE ✗ not yet.');
      lines.push(traceE ? `  TRACE ✓ ${at(traceE)}: ${traceE.type === 'check_batteries' ? `you checked ${lbl}'s batteries` : traceE.type === 'inspect' ? `you read ${lbl}'s display` : 'you checked the receiver, which put the problem upstream of it'}.`
        : actE ? '  TRACE ✗ you did not look upstream of the X32 (receiver, transmitter, batteries) before acting.' : '  TRACE ✗ not yet.');
      const actKey = actE && (actE.type === 'press' ? `press:${actE.how}` : actE.type === 'put' ? 'put:bad' : actE.type);
      lines.push(actE ? `  ACT ✓ ${at(actE)}: ${say(T.act[actKey] || 'you fixed {mic}.')}` : `  ACT ✗ ${F.resolution === 'replace' || faultActive(g, i) ? say(T.still) : 'not yet.'}`);
      lines.push(F.resolution === 'replace'
        ? (covered ? `  VERIFY ✓ a spare covers it: ${verifiedCount(g)} mics verified, enough for every musician (${NEED}).` : `  VERIFY ✗ ${actE ? `only ${verifiedCount(g)} mics verified so far; every musician needs one (${NEED}).` : 'not yet.'}`)
        : verifyE ? `  VERIFY ✓ ${at(verifyE)}: you talked into it and saw signal at X32 ch ${ch}.`
        : actE ? `  VERIFY ✗ fixed but not verified: switch it on and talk into it while watching X32 ch ${ch}.` : '  VERIFY ✗ not yet.');
      loops[gf.id] = { notice: !!noticeE, trace: !!traceE, act: !!actE, verify: F.resolution === 'replace' ? !!covered : !!verifyE };
    });

    const wrongAside = aside.filter(m => !g.faults.some(f => f.device === m && FBY[f.id].resolution === 'replace'));
    if (wrongAside.length) lines.push(`⚠️ Set aside but fixable or working: ${wrongAside.map(m => {
      const f = g.faults.find(x => x.device === m); return D[m].label + (f ? ` (${FBY[f.id].fix})` : ' (it worked)'); }).join('; ')}. Each one uses up a spare.`);
    const nHand = byHand(g).length;
    lines.push(`🔁 Routine: ${nHand} mic${nHand === 1 ? '' : 's'} checked by hand` + (skips.length
      ? `, ${viaSkip.length} by ${S.label}${skips.some(e => e.stoppedAt) ? ` (it stopped at ${skips.filter(e => e.stoppedAt).map(e => D[e.stoppedAt].label).join(', ')})` : ''}.`
      : '.') + (offChair.length ? ` Not on the chair yet: ${offChair.length}.` : ' All on the chair or set aside.'));
    lines.push(`⏱️ ${L.length} actions, ${Math.round(g.t / 60 * 10) / 10} game minutes.` + (extra.length ? ` ${extra.length} change${extra.length > 1 ? 's' : ''} beyond the routine and the fixes: ${extra.map(e => `${e.how} on ${D[e.device].label}`).join(', ')}.` : ' No changes beyond the routine and the fixes.'));
    if (broke.length) lines.push(`  ${broke.length} of those silenced a working mic${endBroken.filter(m => !faultMics.has(m)).length ? `; still silent: ${endBroken.filter(m => !faultMics.has(m)).map(m => D[m].label).join(', ')}` : ', and you put it right'}.`);
    const hintsUsed = Object.entries(g.hints).filter(([, n]) => n);
    lines.push(`🆘 Hints used: ${hintsUsed.length ? hintsUsed.map(([id, n]) => `${FBY[id].label.toLowerCase()}: ${FBY[id].hints.slice(0, n).map(h => h.kind).join(' → ')}`).join('; ') : 'none'}.`);
    lines.push(`📚 Concepts: handheld → receiver → X32 input; ${g.faults.map(f => FBY[f.id].debrief.concepts).join('; ')}; fixed is not verified; a shortcut may skip repetition, never the checking.`);

    const first = g.faults[0];
    return {
      ready: allDone, faults: g.faults.map(f => ({ id: f.id, device: f.device, label: FBY[f.id].label })),
      loops, loop: first ? loops[first.id] : null,
      byHand: nHand, bySkip: viaSkip.length, skipStops: skips.filter(e => e.stoppedAt).map(e => e.stoppedAt), offChair, setAside: aside, wrongAside,
      changesOtherThanFix: extra.length, silencedWorkingMic: broke.length, stillBroken: endBroken, hints: Object.values(g.hints).reduce((a, b) => a + b, 0),
      actions: L.length, gameSeconds: g.t, lines,
    };
  }

  return { start, act, view, debrief, path, reach: (g, m) => reach(g, m), lcd: (g, m) => lcd(g, m) };
}
