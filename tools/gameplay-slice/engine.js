// Gameplay slice engine: the battery-in check at FOH, a NOTICE -> TRACE -> ACT -> VERIFY loop
// (PRODUCT_DESIGN.md sections 3, 45, 46, 51, 94 and principle 4.10). Pure functions over plain JSON
// state: no DOM, no dependencies, no UI assumptions, so it fits whichever app shape the owner picks
// (section 84 is still open).
//
//   const eng = engine(content);            // content: tools/gameplay-slice/content/*.json
//   let g = eng.start('VJ-48217');          // seeded: the same seed always mutes the same mic
//   ({ game: g, events, error } = eng.act(g, { type: 'go', scene: 'foh-mic-drawer' }));
//   eng.view(g)     -> what the player can know (evidence only) plus a debug view (the truth)
//   eng.debrief(g)  -> what failed, what was noticed / traced / changed / verified, hints, time
//
// Actions: go {scene} · pick_up {device} · put {place: 'drawer'|'chair'} · press {how: 'tap'|'hold'}
//          · inspect (read the held mic's display) · talk · hint · check_rest
//
// Key rule (section 3, "fixed is not the same as verified"): a mic only counts as verified by evidence
// seen at its X32 input while talking into it, and that evidence must be newer than the last state
// change of any device on its path. Unmuting alone never completes anything.
//
// "Check the rest" (principle 4.10) is a macro of the same basic actions, so it produces the same
// evidence, costs the same game time, and stops at the first mic that looks or sounds abnormal.

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
  const handhelds = Object.keys(D).filter(id => D[id].type === 'wireless-handheld');
  const micFor = ch => handhelds.find(id => D[id].channel === ch);
  const inPlay = content.setup.mics_in_play.map(micFor);
  if (inPlay.some(x => !x)) throw new Error('mics_in_play names a channel with no handheld');
  inPlay.sort((a, b) => D[a].channel - D[b].channel);
  const HANDS = B.hands.value, chairScenes = new Set(P.chair.reachable_from);
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
    if (d.type === 'wireless-handheld') return s.power === 'on' && !s.muted;         // a bad battery never gets this far: it does not switch on
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
    return s.power === 'on' ? { on: true, channel: D[mic].channel, muted: !!s.muted, battery: 'full' } : { on: false };
  }
  const displayWarning = (g, mic) => { const l = lcd(g, mic); return !l.on || l.muted; };
  const done = (g, mic) => validPositive(g, mic) && g.where[mic] === 'chair';
  const remaining = g => g.inPlay.filter(m => !done(g, m));
  const byHand = g => g.inPlay.filter(m => g.evidence.some(e => e.mic === m && e.via === 'hand' && e.point === x32Point(m) && e.signal));
  function skipState(g) {
    const n = byHand(g).length, left = remaining(g);
    if (n < S.after_by_hand) return { available: false, byHand: n, need: S.after_by_hand, left: left.length, reason: `Check ${S.after_by_hand - n} more by hand first.` };
    if (!left.length) return { available: false, byHand: n, need: S.after_by_hand, left: 0, reason: 'Every mic is verified and on the chair.' };
    if (held(g).length) return { available: false, byHand: n, need: S.after_by_hand, left: left.length, reason: `Put the mic${held(g).length > 1 ? 's' : ''} in your hands down first.` };
    return { available: true, byHand: n, need: S.after_by_hand, left: left.length, reason: null };
  }

  function start(seed = 'VJ-00001', opts = {}) {
    const chans = opts.faultChannel != null ? [opts.faultChannel] : content.fault.placement.channels;
    const pool = chans.map(micFor).filter(m => inPlay.includes(m));
    if (!pool.length) throw new Error('fault placement names no mic in play');
    const pick = pool[Math.floor(rng(seed)() * pool.length)];
    const devices = {}, where = {};
    for (const [id, d] of Object.entries(D)) devices[id] = { type: d.type, state: clone(d.state) };
    for (const m of handhelds) where[m] = D[m].home;
    Object.assign(devices[pick].state, content.fault.set);
    return {
      v: 2, content: content.id, seed, seq: 0, t: 0, scene: 'foh-wide',
      hands: Array(HANDS.slots).fill(null), where, read: {},
      devices, inPlay: [...inPlay], fault: { id: content.fault.id, device: pick },
      changed: {}, evidence: [], hints: 0, log: [], completedAt: null,
    };
  }

  // one basic action, applied in place to g; returns an error {code, message} or null
  function apply(g, a, via, events) {
    const fail = (code, message) => ({ code, message });
    const tick = s => { g.t += s; };
    const entry = { seq: g.seq + 1, t: null, type: a.type };
    if (via !== 'hand') entry.via = via;
    // the mic an action is about: the one named, or the only one held; [id, error]
    const inHand = empty => {
      const h = held(g);
      if (a.device) return h.includes(a.device) ? [a.device, null] : [null, fail('not-held', `you are not holding ${D[a.device] ? D[a.device].label : a.device}`)];
      if (!h.length) return [null, fail('empty-hands', empty)];
      return h.length === 1 ? [h[0], null] : [null, fail('which-mic', 'you have two mics in hand: say which one')];
    };

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
        if (from === 'drawer' && g.scene !== P.drawer.scene) return fail('not-here', `${d.label} is in the ${P.drawer.label.toLowerCase()}`);
        if (from === 'chair' && !chairScenes.has(g.scene)) return fail('not-here', `${d.label} is on the ${P.chair.label.toLowerCase()}`);
        g.hands[g.hands.indexOf(null)] = id; g.where[id] = 'hand'; tick(C.action_s);
        entry.device = id; entry.from = from;
        break;
      }
      case 'put': {
        const [id, err] = inHand('you are not holding a mic'); if (err) return err;
        if (a.place === 'drawer' && g.scene !== P.drawer.scene) return fail('not-here', 'the mic drawer is not here');
        if (a.place === 'chair' && !chairScenes.has(g.scene)) return fail('not-here', 'the chair is not here');
        if (a.place !== 'drawer' && a.place !== 'chair') return fail('bad-action', "put needs place: 'drawer' or 'chair'");
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
        else events.push({ type: 'nothing', text: a.how === 'tap' ? 'Nothing happens: it is switched off.' : 'Nothing happens: it does not switch on.' });
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
        if (g.hints >= content.hints.length) return fail('no-more-hints', 'no more hints');
        const h = content.hints[g.hints]; g.hints++; entry.level = h.level;
        events.push({ type: 'hint', level: h.level, kind: h.kind, text: h.text });
        break;
      }
      default: return fail('bad-action', `unknown action ${a.type}`);
    }
    g.seq = entry.seq; entry.t = g.t; g.log.push(entry);
    return null;
  }

  // "Check the rest" (principle 4.10): the by-hand routine for every remaining mic, in channel order,
  // stopping at the first abnormal one with it in your hand at the X32
  function checkRest(g, events) {
    const st = skipState(g);
    if (!st.available) return { code: 'skip-unavailable', message: st.reason };
    const step = a => { const e = apply(g, a, 'skip', []); if (e) throw new Error(`check the rest, ${a.type}: ${e.message}`); };
    const checked = [], todo = remaining(g); let stoppedAt = null, why = null;
    // one trip per hands-full: take up to max_mics from the same place, then check each at the X32
    for (let i = 0; i < todo.length && !stoppedAt;) {
      const from = g.where[todo[i]], trip = [];
      while (trip.length < HANDS.max_mics && i < todo.length && g.where[todo[i]] === from) trip.push(todo[i++]);
      step({ type: 'go', scene: from === 'drawer' ? P.drawer.scene : x32Scene });
      for (const m of trip) step({ type: 'pick_up', device: m });
      if (from === 'drawer') step({ type: 'go', scene: x32Scene });
      for (const m of trip) {
        step({ type: 'inspect', device: m }); step({ type: 'talk', device: m });
        const blank = !lcd(g, m).on, warn = S.stop_if.includes('display-warning') && displayWarning(g, m);
        const silent = S.stop_if.includes('no-signal-at-x32') && !validPositive(g, m);
        if (warn || silent) { stoppedAt = m; why = [warn && (blank ? 'its display is blank' : 'its display shows it is muted'), silent && `no signal at X32 ch ${D[m].channel}`].filter(Boolean).join(', and '); break; }
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
    if (g.completedAt == null && g.inPlay.every(m => validPositive(g, m))) {
      g.completedAt = { seq: g.seq, t: g.t };
      events.push({ type: 'objective-complete', text: `${content.objective.label}: all ${g.inPlay.length} verified.` });
    }
    return { game: g, events, error: null };
  }

  // what the player can know, from their own evidence only; `debug` is the instructor view (section 80)
  function micStatus(g, mic) {
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
      display: m => g.where[m] === 'hand' && !!g.read[m],
      talk: m => validPositive(g, m),
      chair: m => g.where[m] === 'chair',
    };
    return {
      mic: cur, steps: content.procedure.steps.map(s => ({ id: s.id, text: s.text, simulated: s.simulated !== false,
        done: s.simulated === false ? null : cur ? tick[s.id](cur) : true })),
      skip: { label: S.label, ...skipState(g) },
    };
  }
  function view(g) {
    const mics = g.inPlay.map(m => ({ id: m, label: D[m].label, channel: D[m].channel, windscreen: D[m].windscreen, ring: D[m].ring, status: micStatus(g, m), where: g.where[m] }));
    return {
      clock: clockText(toSec(C.start) + g.t), readyBy: clockText(toSec(C.ready_by)),
      scene: g.scene, hands: [...g.hands], held: held(g), holding: held(g)[0] || null, display: content.displays[g.scene] || null,
      lcd: Object.fromEntries(held(g).filter(m => g.read[m]).map(m => [m, lcd(g, m)])),
      canPut: { drawer: g.scene === P.drawer.scene, chair: chairScenes.has(g.scene) },
      objective: { label: content.objective.label, goal: content.objective.goal, verified: mics.filter(m => m.status === 'verified').length, of: mics.length, complete: g.completedAt != null, mics },
      procedure: procedure(g),
      hintsLeft: content.hints.length - g.hints,
      debug: {
        seed: g.seed, fault: g.fault,
        reach: Object.fromEntries(g.inPlay.map(m => [m, reach(g, m)])),
        state: Object.fromEntries(g.inPlay.map(m => [m, g.devices[m].state])),
        mechanicallySatisfied: g.inPlay.filter(m => reach(g, m).every(x => x.signal)),
      },
    };
  }

  function debrief(g) {
    const f = g.fault.device, ch = D[f].channel, L = g.log;
    const fixE = L.find(e => e.type === 'press' && e.device === f && e.changed && !e.passedBefore && e.passedAfter);
    const fixSeq = fixE ? fixE.seq : Infinity;
    const noticeE = L.find(e => e.type === 'talk' && e.mic === f && e.seq < fixSeq && (e.observed || []).some(o => !o.signal));
    const traceE = L.find(e => e.seq < fixSeq && ((e.type === 'talk' && e.mic === f && (e.observed || []).some(o => o.point === rxPoint(f) && !o.signal)) || (e.type === 'inspect' && e.device === f && !e.via)));
    const verifyE = L.find(e => e.type === 'talk' && e.mic === f && e.seq > fixSeq && (e.observed || []).some(o => o.point === x32Point(f) && o.signal));
    const extra = L.filter(e => e.type === 'press' && e.changed && e !== fixE);
    const broke = extra.filter(e => e.passedBefore && !e.passedAfter);
    const endBroken = g.inPlay.filter(m => !reach(g, m).every(x => x.signal));
    const allVerified = g.inPlay.every(m => validPositive(g, m));
    const skips = L.filter(e => e.type === 'check_rest');
    const viaSkip = g.inPlay.filter(m => validPositive(g, m) && !g.evidence.some(e => e.mic === m && e.via === 'hand' && e.signal && e.point === x32Point(m)));
    const offChair = g.inPlay.filter(m => g.where[m] !== 'chair');
    const at = e => clockText(toSec(C.start) + e.t);
    const lines = [];

    lines.push(allVerified
      ? `✅ Ready: all ${g.inPlay.length} mics verified at the X32 by ${clockText(toSec(C.start) + (g.completedAt ? g.completedAt.t : g.t))} (rehearsal at ${clockText(toSec(C.ready_by))}).`
      : `✅ Not ready yet: ${g.inPlay.filter(m => !validPositive(g, m)).map(m => D[m].label).join(', ')} not verified.`);
    lines.push(`🧠 What failed: ${D[f].label} was powered on but muted, so no audio left the transmitter.`);
    lines.push(noticeE ? `  NOTICE ✓ ${at(noticeE)}: ${noticeE.via === 'skip' ? `${S.label} stopped on ${D[f].label}: no signal` : `you talked into ${D[f].label} and saw no signal`} at the ${noticeE.observed.some(o => o.point === rxPoint(f)) ? 'receiver' : 'X32'}.`
      : `  NOTICE ✗ the silence was never observed before the fix${fixE ? ' (the fix came first)' : ''}.`);
    lines.push(traceE ? `  TRACE ✓ ${at(traceE)}: ${traceE.type === 'inspect' ? `you read ${D[f].label}'s display` : 'you checked the receiver, which put the problem upstream of it'}.`
      : '  TRACE ✗ you did not check a point upstream of the X32 (receiver or transmitter) before changing anything.');
    lines.push(fixE ? (fixE.how === 'hold' ? `  ACT ✓ ${at(fixE)}: you switched ${D[f].label} off and on, which cleared the mute. It works, though a tap would have unmuted it directly.` : `  ACT ✓ ${at(fixE)}: you unmuted ${D[f].label}.`) : `  ACT ✗ ${D[f].label} is still ${g.devices[f].state.power === 'on' ? 'muted' : 'off'}.`);
    lines.push(verifyE ? `  VERIFY ✓ ${at(verifyE)}: you talked into it and saw signal at X32 ch ${ch}.`
      : fixE ? `  VERIFY ✗ fixed but not verified: talk into it while watching X32 ch ${ch}.` : '  VERIFY ✗ not yet.');
    const nHand = byHand(g).length;
    lines.push(`🔁 Routine: ${nHand} mic${nHand === 1 ? '' : 's'} checked by hand` + (skips.length
      ? `, ${viaSkip.length} by ${S.label}${skips.some(e => e.stoppedAt) ? ` (it stopped at ${skips.filter(e => e.stoppedAt).map(e => D[e.stoppedAt].label).join(', ')})` : ''}.`
      : '.') + (offChair.length ? ` Not on the chair yet: ${offChair.length}.` : ' All on the chair.'));
    lines.push(`⏱️ ${L.length} actions, ${Math.round(g.t / 60 * 10) / 10} game minutes.` + (extra.length ? ` ${extra.length} change${extra.length > 1 ? 's' : ''} other than the fix: ${extra.map(e => `${e.how} on ${D[e.device].label}`).join(', ')}.` : ' No changes other than the fix.'));
    if (broke.length) lines.push(`  ${broke.length} of those silenced a working mic${endBroken.length ? `; still silent: ${endBroken.map(m => D[m].label).join(', ')}` : ', and you put it right'}.`);
    lines.push(`🆘 Hints used: ${g.hints ? content.hints.slice(0, g.hints).map(h => h.kind).join(' → ') : 'none'}.`);
    lines.push('📚 Concepts: handheld → receiver → X32 input; a transmitter can be on but muted; fixed is not verified; a shortcut may skip repetition, never the checking.');

    return {
      ready: allVerified, fault: { device: f, label: content.fault.label },
      loop: { notice: !!noticeE, trace: !!traceE, act: !!fixE, verify: !!verifyE },
      byHand: nHand, bySkip: viaSkip.length, skipStops: skips.filter(e => e.stoppedAt).map(e => e.stoppedAt), offChair,
      changesOtherThanFix: extra.length, silencedWorkingMic: broke.length, stillBroken: endBroken, hints: g.hints,
      actions: L.length, gameSeconds: g.t, lines,
    };
  }

  return { start, act, view, debrief, path, reach: (g, m) => reach(g, m), lcd: (g, m) => lcd(g, m) };
}
