// Gameplay slice engine: the first NOTICE -> TRACE -> ACT -> VERIFY loop (PRODUCT_DESIGN.md sections
// 3, 46, 51, 94). Pure functions over plain JSON state: no DOM, no dependencies, no UI assumptions,
// so it can be dropped into whichever app shape the owner picks (section 84 is still open).
//
//   const eng = engine(content);            // content: tools/gameplay-slice/content/*.json
//   let g = eng.start('VJ-48217');          // seeded: the same seed always mutes the same mic
//   ({ game: g, events, error } = eng.act(g, { type: 'go', scene: 'foh-mic-drawer' }));
//   eng.view(g)     -> what the player can know (evidence only) plus a debug view (the truth)
//   eng.debrief(g)  -> what failed, what was noticed / traced / changed / verified, hints, time
//
// Actions: go {scene} · pick_up {device} · put_back · press {how: 'tap'|'hold'} · inspect · talk · hint
//
// Key rule (section 3, "fixed is not the same as verified"): a mic only counts as verified by evidence
// seen at its X32 input while talking into it, and that evidence must be newer than the last state
// change of any device on its path. Unmuting alone never completes anything.

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
  const D = content.devices, B = content.behaviour, C = content.clock;
  const handhelds = Object.keys(D).filter(id => D[id].type === 'wireless-handheld');
  const micFor = ch => handhelds.find(id => D[id].channel === ch);
  const inPlay = content.setup.mics_in_play.map(micFor);
  if (inPlay.some(x => !x)) throw new Error('mics_in_play names a channel with no handheld');

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
    if (d.type === 'wireless-handheld') return s.power === 'on' && !s.muted;
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

  function start(seed = 'VJ-00001') {
    const pick = inPlay[Math.floor(rng(seed)() * inPlay.length)];
    const devices = {};
    for (const [id, d] of Object.entries(D)) devices[id] = { type: d.type, state: clone(d.state) };
    Object.assign(devices[pick].state, content.fault.set);
    return {
      v: 1, content: content.id, seed, seq: 0, t: 0, scene: 'foh-wide', holding: null,
      devices, inPlay: [...inPlay], fault: { id: content.fault.id, device: pick },
      changed: {}, evidence: [], hints: 0, log: [], completedAt: null,
    };
  }

  function act(g0, a) {
    const g = clone(g0), events = [];
    const fail = (code, message) => ({ game: g0, events: [], error: { code, message } });
    const tick = s => { g.t += s; };
    const entry = { seq: g.seq + 1, t: null, type: a.type };

    switch (a.type) {
      case 'go': {
        if (!a.scene) return fail('bad-action', 'go needs a scene');
        g.scene = a.scene; tick(C.move_s); entry.scene = a.scene;
        const disp = content.displays[a.scene]; if (disp) entry.looksAt = disp.device;
        break;
      }
      case 'pick_up': {
        const d = D[a.device];
        if (!d || d.type !== 'wireless-handheld') return fail('bad-device', 'you can only pick up a handheld here');
        if (g.holding) return fail('hands-full', `put ${D[g.holding].label} back first`);
        if (g.scene !== d.scene) return fail('not-here', `${d.label} is not here`);
        g.holding = a.device; tick(C.action_s); entry.device = a.device;
        break;
      }
      case 'put_back': {
        if (!g.holding) return fail('empty-hands', 'you are not holding anything');
        if (g.scene !== D[g.holding].scene) return fail('not-here', 'put it back where it lives');
        entry.device = g.holding; g.holding = null; tick(C.action_s);
        break;
      }
      case 'press': {
        if (!g.holding) return fail('empty-hands', 'pick up a handheld first');
        const id = g.holding, s = g.devices[id].state, before = clone(s), passedBefore = passes(g, id);
        if (a.how === 'tap') { if (s.power === 'on') s.muted = !s.muted; }
        else if (a.how === 'hold') {
          s.power = s.power === 'on' ? 'off' : 'on';
          if (s.power === 'on' && !B.mute_survives_power_cycle.value) s.muted = false;
        } else return fail('bad-action', "press needs how: 'tap' or 'hold'");
        tick(C.action_s);
        Object.assign(entry, { device: id, how: a.how, before, after: clone(s), passedBefore, passedAfter: passes(g, id) });
        if (JSON.stringify(before) !== JSON.stringify(s)) { g.changed[id] = entry.seq; entry.changed = true; }
        else events.push({ type: 'nothing', text: 'Nothing happens: it is switched off.' });
        break;
      }
      case 'inspect': {
        const id = a.device || g.holding;
        if (!id) return fail('empty-hands', 'nothing to inspect');
        if (id !== g.holding && g.scene !== D[id].scene) return fail('not-here', `${D[id].label} is not here`);
        tick(C.action_s); entry.device = id;
        events.push({ type: 'inspect', device: id, state: clone(g.devices[id].state) });
        break;
      }
      case 'talk': {
        if (!g.holding || D[g.holding].type !== 'wireless-handheld') return fail('empty-hands', 'hold a handheld to talk into it');
        const mic = g.holding, r = reach(g, mic), disp = content.displays[g.scene];
        tick(C.action_s); entry.mic = mic; entry.scene = g.scene;
        const seen = disp ? r.filter(x => devOf(x.point) === disp.device) : [];
        entry.observed = seen.map(x => ({ point: x.point, signal: x.signal }));
        for (const x of seen) { g.evidence.push({ seq: entry.seq, mic, point: x.point, signal: x.signal }); events.push({ type: 'meter', point: x.point, signal: x.signal }); }
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
    // a mic that just became verified gets the non-blocking toast of section 55
    if (a.type === 'talk' && validPositive(g, entry.mic) && !validPositive(g0, entry.mic))
      events.push({ type: 'verified', mic: entry.mic, text: `Signal verified: receiver → X32 ch ${D[entry.mic].channel}.` });
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
  function view(g) {
    const mics = g.inPlay.map(m => ({ id: m, label: D[m].label, channel: D[m].channel, status: micStatus(g, m) }));
    return {
      clock: clockText(toSec(C.start) + g.t), readyBy: clockText(toSec(C.ready_by)),
      scene: g.scene, holding: g.holding, display: content.displays[g.scene] || null,
      objective: { label: content.objective.label, goal: content.objective.goal, verified: mics.filter(m => m.status === 'verified').length, of: mics.length, complete: g.completedAt != null, mics },
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
    const traceE = L.find(e => e.seq < fixSeq && ((e.type === 'talk' && e.mic === f && (e.observed || []).some(o => o.point === rxPoint(f) && !o.signal)) || (e.type === 'inspect' && e.device === f)));
    const verifyE = L.find(e => e.type === 'talk' && e.mic === f && e.seq > fixSeq && (e.observed || []).some(o => o.point === x32Point(f) && o.signal));
    const extra = L.filter(e => e.type === 'press' && e.changed && e !== fixE);
    const broke = extra.filter(e => e.passedBefore && !e.passedAfter);
    const endBroken = g.inPlay.filter(m => !reach(g, m).every(x => x.signal));
    const allVerified = g.inPlay.every(m => validPositive(g, m));
    const at = e => clockText(toSec(C.start) + e.t);
    const lines = [];

    lines.push(allVerified
      ? `✅ Ready: all ${g.inPlay.length} mics verified at the X32 by ${clockText(toSec(C.start) + (g.completedAt ? g.completedAt.t : g.t))} (rehearsal at ${clockText(toSec(C.ready_by))}).`
      : `✅ Not ready yet: ${g.inPlay.filter(m => !validPositive(g, m)).map(m => D[m].label).join(', ')} not verified.`);
    lines.push(`🧠 What failed: ${D[f].label} was powered on but muted, so no audio left the transmitter.`);
    lines.push(noticeE ? `  NOTICE ✓ ${at(noticeE)}: you talked into ${D[f].label} and saw no signal at the ${noticeE.observed.some(o => o.point === rxPoint(f)) ? 'receiver' : 'X32'}.`
      : `  NOTICE ✗ the silence was never observed before the fix${fixE ? ' (the fix came first)' : ''}.`);
    lines.push(traceE ? `  TRACE ✓ ${at(traceE)}: ${traceE.type === 'inspect' ? `you inspected ${D[f].label} itself` : 'you checked the receiver, which put the problem upstream of it'}.`
      : '  TRACE ✗ you did not check a point upstream of the X32 (receiver or transmitter) before changing anything.');
    lines.push(fixE ? (fixE.how === 'hold' ? `  ACT ✓ ${at(fixE)}: you switched ${D[f].label} off and on, which cleared the mute. It works, though a tap would have unmuted it directly.` : `  ACT ✓ ${at(fixE)}: you unmuted ${D[f].label}.`) : `  ACT ✗ ${D[f].label} is still ${g.devices[f].state.power === 'on' ? 'muted' : 'off'}.`);
    lines.push(verifyE ? `  VERIFY ✓ ${at(verifyE)}: you talked into it and saw signal at X32 ch ${ch}.`
      : fixE ? `  VERIFY ✗ fixed but not verified: talk into it while watching X32 ch ${ch}.` : '  VERIFY ✗ not yet.');
    lines.push(`⏱️ ${L.length} actions, ${Math.round(g.t / 60 * 10) / 10} game minutes.` + (extra.length ? ` ${extra.length} change${extra.length > 1 ? 's' : ''} other than the fix: ${extra.map(e => `${e.how} on ${D[e.device].label}`).join(', ')}.` : ' No changes other than the fix.'));
    if (broke.length) lines.push(`  ${broke.length} of those silenced a working mic${endBroken.length ? `; still silent: ${endBroken.map(m => D[m].label).join(', ')}` : ', and you put it right'}.`);
    lines.push(`🆘 Hints used: ${g.hints ? content.hints.slice(0, g.hints).map(h => h.kind).join(' → ') : 'none'}.`);
    lines.push('📚 Concepts: handheld → receiver → X32 input; a transmitter can be on but muted; fixed is not verified.');

    return {
      ready: allVerified, fault: { device: f, label: content.fault.label },
      loop: { notice: !!noticeE, trace: !!traceE, act: !!fixE, verify: !!verifyE },
      changesOtherThanFix: extra.length, silencedWorkingMic: broke.length, stillBroken: endBroken, hints: g.hints,
      actions: L.length, gameSeconds: g.t, lines,
    };
  }

  return { start, act, view, debrief, path, reach: (g, m) => reach(g, m) };
}
