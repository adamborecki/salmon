// Gameplay slice engine, part 2: the line check (Cary, 2026-10-02; PRODUCT_DESIGN sections 3, 43, 45, 46).
// The mics are in the singers' hands on stage; the player is the A1 at the X32 and can't touch them.
// First the wedge check: known playback (the Wii Shop theme) through Bus 1. Then down the line, black / red
// first: each singer says something (the X32 meter is the input check), then says whether they can hear
// themselves in the wedges (Bus 1 -> monitor amp -> wedges: the Monitor 1 check).
// Pure functions over plain JSON state, like engine.js.
//
//   const eng = lineEngine(lineContent, micContent.devices);
//   let g = eng.start('LC-12345', { t: 312, lineup: ['handheld-01', ...] });   // both optional
//   opts.wedgeChecked: you did the monitors yourself, so the wedge check is done (and the amp can't be off)
//   ({ game: g, events, error } = eng.act(g, { type: 'call', device: 'handheld-01' }));
//
// Actions: go {scene} · play {to: bus1|mains} (the known playback) · call {device} (they say something)
//          · ask {device, what: hold|tap|louder|aim|check|hear} · mains {device} (their channel through the mains)
//          · send {device, dir: +1|-1} (that channel's Bus 1 send) · a2 {device} (the A2 goes and looks at that mic)
//          · a2 {amp: check|on} (the A2 goes to the monitor amp) · hint · line (the skip: "Go down the line")
//
// Faults are data (content.faults): each `set` changes one singer's state (switched off, muted, too quiet,
// aimed at the wedge) or the monitor amp's (off). The player changes a mic only through what they ask the
// singer to do, so the wrong instruction can make it worse ("press and hold" switches a working mic off).
//
// Key rule (section 3): a singer counts as checked only by evidence newer than the last change: a healthy
// meter at their X32 input with no ring, and then "yes, I can hear myself" with no ring. Changing their
// send (or the amp) re-opens only the monitor check; changing the mic re-opens both. The line check is done
// when the wedges passed the playback check (newer than any amp change) and every singer is checked.

import { clockText } from './engine.js';

const clone = o => JSON.parse(JSON.stringify(o));
function hashSeed(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
function rng(seed) { let a = hashSeed(seed); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const toSec = hms => { const [h, m, s] = hms.split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };

export function lineEngine(content, devices) {
  const D = devices, C = content.clock, SC = content.scenes, BUS = content.bus1, S = content.skip, I = content.instructions;
  const AMP = content.monitor_amp, PB = content.playback, A2 = content.a2;
  const FS = content.faults, FBY = Object.fromEntries(FS.map(f => [f.id, f]));
  const handhelds = Object.keys(D).filter(id => D[id].type === 'wireless-handheld').sort((a, b) => D[a].channel - D[b].channel);
  const micFor = ch => handhelds.find(id => D[id].channel === ch);
  const STEPS = BUS.steps_db, stepOf = db => STEPS.indexOf(db), dbAt = (g, m) => STEPS[g.send[m]];
  const atLeast = (db, min) => db != null && db >= min;
  const onAmp = f => FBY[f.id].target === 'amp';
  const labelOf = id => id === AMP.id ? AMP.label : D[id].label;

  const ampOn = g => g.amp.power === 'on';
  // what reaches where when this singer makes sound: RF to the receiver, audio level at the X32, and a ring
  // (a ring needs the wedges to be making sound: the send up and the monitor amp on)
  function sound(g, m) {
    const s = g.singer[m], rf = s.power === 'on', af = rf && !s.muted ? s.level : 'none';
    return { rf, af, feedback: af !== 'none' && s.aim === 'wedge' && atLeast(dbAt(g, m), BUS.feedback_at_db) && ampOn(g) };
  }
  const srcChange = (g, m) => g.changed[m] || 0, sendChange = (g, m) => g.sendChanged[m] || 0, ampChange = g => g.changed[AMP.id] || 0;
  const inputOk = (g, m) => g.evidence.some(e => e.mic === m && e.kind === 'x32' && e.level === 'normal' && !e.feedback && e.seq > srcChange(g, m));
  const monitorOk = (g, m) => g.evidence.some(e => e.mic === m && e.kind === 'hear' && e.ok && e.seq > Math.max(srcChange(g, m), sendChange(g, m), ampChange(g)));
  const wedgeOk = g => g.evidence.some(e => e.kind === 'wedges' && e.ok && e.seq > ampChange(g));
  const verified = (g, m) => inputOk(g, m) && monitorOk(g, m);
  const verifiedCount = g => g.lineup.filter(m => verified(g, m)).length;
  const complete = g => wedgeOk(g) && g.lineup.every(m => verified(g, m));
  const stateOf = (g, f) => onAmp(f) ? g.amp : g.singer[f.device];
  const faultActive = (g, i) => Object.entries(FBY[g.faults[i].id].set).every(([k, v]) => stateOf(g, g.faults[i])[k] === v);
  const byHand = g => g.lineup.filter(m => g.evidence.some(e => e.mic === m && e.via === 'hand' && e.kind === 'hear' && e.ok) && verified(g, m));
  const remaining = g => g.lineup.filter(m => !verified(g, m));
  // has the player seen this fault's symptom? (a wrong meter, ring or "can't hear" for a singer; silent wedges for the amp)
  const wrongWith = (g, f) => onAmp(f)
    ? g.evidence.some(e => (e.kind === 'wedges' && !e.ok) || (e.kind === 'hear' && e.reason === 'no-monitor'))
    : g.evidence.some(e => e.mic === f.device && ((e.kind === 'x32' && (e.level !== 'normal' || e.feedback)) || (e.kind === 'hear' && !e.ok && e.reason !== 'no-monitor')));

  function skipState(g) {
    const n = byHand(g).length, left = remaining(g).length;
    if (n < S.after_by_hand) return { available: false, byHand: n, need: S.after_by_hand, left, reason: `Check ${S.after_by_hand - n} more by hand first.` };
    if (!left) return { available: false, byHand: n, need: S.after_by_hand, left, reason: 'Every singer is checked.' };
    return { available: true, byHand: n, need: S.after_by_hand, left, reason: null };
  }
  // a hint is about what you're working on if you've seen it go wrong, else any problem you've seen,
  // else the next one down the line
  function hintTarget(g) {
    const open = g.faults.map((f, i) => i).filter(i => faultActive(g, i) || (onAmp(g.faults[i]) ? !wedgeOk(g) : !verified(g, g.faults[i].device)));
    const last = [...g.log].reverse().find(e => e.device)?.device;
    const i = open.find(i => g.faults[i].device === last && wrongWith(g, g.faults[i])) ?? open.find(i => wrongWith(g, g.faults[i])) ?? open[0];
    return i == null ? null : g.faults[i].id;
  }

  function start(seed = 'LC-00001', opts = {}) {
    const lineup = (opts.lineup || Array.from({ length: content.setup.singers }, (_, i) => micFor(i + 1))).slice()
      .sort((a, b) => D[a].channel - D[b].channel);
    if (lineup.some(m => !D[m])) throw new Error('lineup names an unknown mic');
    const singer = {}, send = {}, faults = [], amp = clone(AMP.start);
    for (const m of lineup) { singer[m] = clone(content.singer.start); send[m] = stepOf(BUS.start_db); }
    // which faults (faults_per_run of them, by seed); singer faults go on different singers, never the first in line
    const r = rng(seed), kinds = (opts.faults || FS.map(f => f.id).filter(id => !(opts.wedgeChecked && FBY[id].target === 'amp'))).slice();
    if (!opts.faults) for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    const pool = lineup.slice(1).filter(m => content.fault_channels.includes(D[m].channel));
    for (const id of kinds.slice(0, opts.faults ? kinds.length : content.faults_per_run)) {
      if (FBY[id].target === 'amp') { Object.assign(amp, FBY[id].set); faults.push({ id, device: AMP.id }); continue; }
      const forced = opts.faultMics && opts.faultMics[id], free = pool.filter(m => !faults.some(f => f.device === m));
      const m = forced || free[Math.floor(r() * free.length)];
      if (!m) throw new Error(`fault ${id}: no free singer`);
      Object.assign(singer[m], FBY[id].set); faults.push({ id, device: m });
    }
    const order = f => f.device === AMP.id ? -1 : lineup.indexOf(f.device);   // the amp is met first, at the wedge check
    faults.sort((a, b) => order(a) - order(b));
    const g = {
      v: 2, content: content.id, seed, seq: 0, t: opts.t ?? C.default_offset_s, scene: SC.x32,
      lineup, singer, send, amp, faults, changed: {}, sendChanged: {}, evidence: [], hints: {}, log: [], completedAt: null,
    };
    if (opts.wedgeChecked) {                         // proved during the monitor setup, before the singers
      g.seq = 1; g.evidence.push({ seq: 1, kind: 'wedges', ok: true, via: 'monitors' });
      g.log.push({ seq: 1, t: g.t, type: 'play', to: 'bus1', ok: true, device: AMP.id, via: 'monitors' });
    }
    return g;
  }

  // one basic action, applied in place; returns an error {code, message} or null
  function apply(g, a, via, events) {
    const fail = (code, message) => ({ code, message });
    const entry = { seq: g.seq + 1, t: null, type: a.type };
    if (via !== 'hand') entry.via = via;
    const faultWas = g.faults.map((_, i) => faultActive(g, i));
    const who = () => (!a.device || !g.singer[a.device]) ? [null, fail('bad-device', 'say which singer (their mic)')] : [a.device, null];
    const L = m => D[m].label;
    switch (a.type) {
      case 'go': {
        if (!a.scene) return fail('bad-action', 'go needs a scene');
        g.scene = a.scene; g.t += C.move_s; entry.scene = a.scene;
        break;
      }
      case 'play': {                                   // the known playback from FOH, through Bus 1 (the wedges) or the mains
        if (!['bus1', 'mains'].includes(a.to)) return fail('bad-action', "play needs to: 'bus1' or 'mains'");
        g.t += C.play_s; entry.to = a.to;
        if (a.to === 'bus1') {
          const ok = ampOn(g); entry.ok = ok; entry.device = AMP.id;
          g.evidence.push({ seq: entry.seq, kind: 'wedges', ok, via });
          events.push({ type: 'playback', to: 'bus1', ok, text: ok ? `${PB.label} plays in all three wedges.` : `The Bus 1 meter moves on the X32, but nothing comes out of the wedges.` });
        } else {
          entry.ok = true; entry.device = AMP.id;
          g.evidence.push({ seq: entry.seq, kind: 'mains-play', ok: true, via });
          events.push({ type: 'playback', to: 'mains', ok: true, text: `${PB.label} plays through the mains.` });
        }
        break;
      }
      case 'call': {                                   // "Mic 3, say something": they talk; you see what your screen shows
        const [m, err] = who(); if (err) return err;
        g.t += C.call_s; Object.assign(entry, { device: m, scene: g.scene });
        const s = sound(g, m);
        if (g.scene === SC.x32) {
          const level = s.af === 'quiet' ? 'quiet' : s.af === 'normal' ? 'normal' : 'none';
          g.evidence.push({ seq: entry.seq, mic: m, kind: 'x32', level, feedback: s.feedback, via });
          entry.observed = { at: 'x32', level, feedback: s.feedback };
          events.push({ type: 'meter', at: 'x32', mic: m, level, feedback: s.feedback });
        } else if (g.scene === SC.receivers) {
          g.evidence.push({ seq: entry.seq, mic: m, kind: 'rx', rf: s.rf, af: s.af, feedback: s.feedback, via });
          entry.observed = { at: 'rx', rf: s.rf, af: s.af, feedback: s.feedback };
          events.push({ type: 'meter', at: 'rx', mic: m, rf: s.rf, af: s.af, feedback: s.feedback });
        } else events.push({ type: 'no-display', text: 'You hear them, but nothing here shows the signal. Watch the X32 while they talk.' });
        if (s.feedback) events.push({ type: 'feedback', mic: m, text: `A loud ring from the wedges while ${L(m)} talks!` });
        break;
      }
      case 'mains': {                                  // put their channel in the mains and have them say something
        const [m, err] = who(); if (err) return err;
        g.t += C.mains_s; entry.device = m;
        const heard = sound(g, m).af !== 'none'; entry.heard = heard;
        g.evidence.push({ seq: entry.seq, mic: m, kind: 'mains', heard, via });
        events.push({ type: 'mains', mic: m, heard, text: heard ? `You hear ${L(m)} through the mains.` : `Nothing from ${L(m)} in the mains either.` });
        break;
      }
      case 'ask': {                                    // tell the singer to do something with their mic, or ask them something
        const [m, err] = who(); if (err) return err;
        if (!I[a.what] || !['hold', 'tap', 'louder', 'aim', 'check', 'hear'].includes(a.what)) return fail('bad-action', 'ask what? (hold, tap, louder, aim, check, hear)');
        g.t += C.ask_s; Object.assign(entry, { device: m, what: a.what });
        const s = g.singer[m], before = clone(s);
        let reply;
        if (a.what === 'hold') {
          if (s.power === 'on') { s.power = 'off'; reply = 'Okay, I held it. The display went dark.'; }
          else { s.power = 'on'; if (!content.singer.mute_survives_power_cycle) s.muted = false; reply = 'Okay, I held it. The display lit up.'; }
        } else if (a.what === 'tap') {
          if (s.power === 'on') { s.muted = !s.muted; reply = 'Okay, I tapped it.'; } else reply = 'I tapped it. Nothing happened.';
        } else if (a.what === 'louder') { s.level = 'normal'; reply = 'Like this? Sure.'; }
        else if (a.what === 'aim') { s.aim = 'away'; reply = 'Oh, sorry. Pointing it at my mouth now.'; }
        else if (a.what === 'check') {
          const disp = s.power !== 'on' ? 'blank' : s.muted ? 'muted' : 'normal';
          reply = { blank: 'The display is blank.', muted: 'It shows a speaker with a line through it.', normal: 'It shows a group and channel, and a full battery.' }[disp];
          g.evidence.push({ seq: entry.seq, mic: m, kind: 'display', display: disp, via }); entry.display = disp;
        } else if (a.what === 'hear') {
          const snd = sound(g, m), db = dbAt(g, m);
          const reason = snd.feedback ? 'ring' : snd.af === 'none' ? 'no-mic' : db == null ? 'send-off' : !atLeast(db, BUS.hear_at_db) ? 'send-low'
            : !ampOn(g) ? 'no-monitor' : snd.af === 'quiet' ? 'quiet' : 'ok';
          const ok = reason === 'ok';
          reply = { ring: "It's ringing!", 'no-mic': "I don't hear anything. Is my mic on?", 'send-off': 'Nothing in the monitor.', 'send-low': 'Barely. Can you turn me up?',
            'no-monitor': 'Nothing in the monitor.', quiet: 'A little, I guess?', ok: 'Yes, I can hear myself.' }[reason];
          g.evidence.push({ seq: entry.seq, mic: m, kind: 'hear', ok, reason, feedback: snd.feedback, via }); Object.assign(entry, { ok, reason, feedback: snd.feedback });
          if (snd.feedback) events.push({ type: 'feedback', mic: m, text: `A loud ring from the wedges while ${L(m)} sings!` });
        }
        if (JSON.stringify(before) !== JSON.stringify(s)) { g.changed[m] = entry.seq; entry.changed = true; entry.before = before; }
        entry.reply = reply;
        events.push({ type: 'reply', mic: m, what: a.what, text: `${L(m)}: "${reply}"` });
        break;
      }
      case 'a2': {                                     // the A2 walks out (to a singer, or to the monitor amp) while you stay at the X32
        g.t += C.a2_s;
        let report;
        if (a.amp) {
          if (!['check', 'on'].includes(a.amp)) return fail('bad-action', "a2 amp: 'check' or 'on'");
          Object.assign(entry, { device: AMP.id, amp: a.amp });
          if (a.amp === 'check') { report = ampOn(g) ? A2.amp_on : A2.amp_off; g.evidence.push({ seq: entry.seq, kind: 'a2-amp', on: ampOn(g), via }); }
          else if (ampOn(g)) report = A2.amp_already_on;
          else { g.amp.power = 'on'; g.changed[AMP.id] = entry.seq; entry.changed = true; report = A2.amp_switched_on; }
        } else {
          const [m, err] = who(); if (err) { g.t -= C.a2_s; return err; }
          const s = g.singer[m]; entry.device = m;
          report = (s.power !== 'on' ? A2.mic_off : s.muted ? A2.mic_muted : s.aim === 'wedge' ? A2.mic_aimed : s.level === 'quiet' ? A2.mic_quiet : A2.mic_fine).replace(/\{mic\}/g, L(m));
          g.evidence.push({ seq: entry.seq, mic: m, kind: 'a2', via });
        }
        entry.report = report;
        events.push({ type: 'a2', device: entry.device, text: `${A2.label}: "${report}"` });
        break;
      }
      case 'send': {                                   // that channel's send on fader to Bus 1 (the wedges)
        const [m, err] = who(); if (err) return err;
        const to = g.send[m] + (a.dir > 0 ? 1 : -1);
        if (to < 0 || to >= STEPS.length) return fail('send-limit', a.dir > 0 ? 'that send is all the way up' : 'that send is already off');
        const from = dbAt(g, m); g.send[m] = to; g.sendChanged[m] = entry.seq; g.t += C.send_s;
        Object.assign(entry, { device: m, from, to: STEPS[to] });
        events.push({ type: 'send', mic: m, db: STEPS[to] });
        break;
      }
      case 'hint': {
        const id = hintTarget(g);
        if (!id) return fail('no-hint', 'Nothing needs a hint right now.');
        const hs = FBY[id].hints, used = g.hints[id] || 0;
        if (used >= hs.length) return fail('no-more-hints', 'no more hints for this problem');
        const h = hs[used]; g.hints[id] = used + 1; Object.assign(entry, { level: h.level, fault: id });
        events.push({ type: 'hint', level: h.level, of: hs.length, kind: h.kind, fault: id, text: h.text });
        break;
      }
      default: return fail('bad-action', `unknown action ${a.type}`);
    }
    g.faults.forEach((f, i) => { if (faultWas[i] && !faultActive(g, i)) entry.fixedFault = f.id; });
    g.seq = entry.seq; entry.t = g.t; g.log.push(entry);
    return null;
  }

  // "Go down the line" (principle 4.10): the by-hand routine for every remaining singer, in order,
  // stopping at the first one whose meter is wrong, rings, or who can't hear themselves
  function line(g, events) {
    const st = skipState(g);
    if (!st.available) return { code: 'skip-unavailable', message: st.reason };
    const step = a => { const e = apply(g, a, 'skip', events); if (e) throw new Error(`go down the line, ${a.type}: ${e.message}`); };
    const checked = []; let stoppedAt = null, why = null;
    if (g.scene !== SC.x32) step({ type: 'go', scene: SC.x32 });
    for (const m of remaining(g)) {
      if (!inputOk(g, m)) {
        step({ type: 'call', device: m });
        const e = g.evidence.at(-1);
        if (e.feedback) { stoppedAt = m; why = 'it rang in the wedges'; break; }
        if (e.level !== 'normal') { stoppedAt = m; why = e.level === 'none' ? `no signal at X32 ch ${D[m].channel}` : `only a little signal at X32 ch ${D[m].channel}`; break; }
      }
      step({ type: 'ask', device: m, what: 'hear' });
      if (!monitorOk(g, m)) { const e = g.log.at(-1); stoppedAt = m; why = e.feedback ? 'it rang in the wedges' : `they can't hear themselves ("${e.reply}")`; break; }
      checked.push(m);
    }
    for (let i = events.length - 1; i >= 0; i--) if (events[i].type === 'reply' || events[i].type === 'meter' || events[i].type === 'send') events.splice(i, 1);
    const entry = { seq: g.seq + 1, t: g.t, type: 'line', checked, stoppedAt, why };
    g.seq = entry.seq; g.log.push(entry);
    events.push(stoppedAt
      ? { type: 'skip-stopped', mic: stoppedAt, checked, text: `${S.label} stopped at ${D[stoppedAt].label}: ${why}.` }
      : { type: 'skip-done', checked, text: `${S.label}: ${checked.length} more singers checked.` });
    return null;
  }

  function act(g0, a) {
    const g = clone(g0), events = [];
    const err = a && a.type === 'line' ? line(g, events) : apply(g, a || {}, 'hand', events);
    if (err) return { game: g0, events: [], error: err };
    for (const m of g.lineup) if (verified(g, m) && !verified(g0, m) && a.type !== 'line')
      events.push({ type: 'verified', mic: m, text: `${D[m].label}: checked at the X32 and in the wedges.` });
    if (wedgeOk(g) && !wedgeOk(g0)) events.push({ type: 'wedges-ok', text: `Wedge check done: ${PB.label} in all three wedges.` });
    if (g.completedAt == null && complete(g)) {
      g.completedAt = { seq: g.seq, t: g.t };
      events.push({ type: 'objective-complete', text: `${content.objective.label}: the wedges and all ${g.lineup.length} singers checked.` });
    }
    return { game: g, events, error: null };
  }

  function micStatus(g, m) {
    if (verified(g, m)) return 'verified';
    const x = g.evidence.filter(e => e.mic === m && e.kind === 'x32').at(-1), h = g.evidence.filter(e => e.mic === m && e.kind === 'hear').at(-1);
    if (!x && !h) return 'not-checked';
    const last = [x, h].filter(Boolean).sort((p, q) => q.seq - p.seq)[0];
    if (last.feedback) return 'ringing';
    if (last === x && x.level === 'none') return 'no-signal-seen';
    if (last === x && x.level === 'quiet') return 'low';
    if (inputOk(g, m)) return 'monitor';                 // input fine; the wedge check is still to do (or failed)
    return 'recheck';
  }
  function view(g) {
    const target = hintTarget(g), next = remaining(g)[0] || null;
    const lastWedge = g.evidence.filter(e => e.kind === 'wedges').at(-1);
    return {
      clock: clockText(toSec(C.start) + g.t), readyBy: clockText(toSec(C.ready_by)), scene: g.scene,
      wedge: { ok: wedgeOk(g), tried: !!lastWedge, silent: !!lastWedge && !lastWedge.ok && lastWedge.seq > ampChange(g) },
      singers: g.lineup.map(m => ({ id: m, label: D[m].label, channel: D[m].channel, status: micStatus(g, m), sendDb: dbAt(g, m), input: inputOk(g, m), monitor: monitorOk(g, m) })),
      next, verified: verifiedCount(g), of: g.lineup.length, complete: g.completedAt != null,
      procedure: { mic: next, wedge: wedgeOk(g), steps: content.procedure.steps.map(s => ({ ...s, done: next ? { call: g.evidence.some(e => e.mic === next && e.kind === 'x32' && e.seq > srcChange(g, next)), meter: inputOk(g, next), monitor: monitorOk(g, next) }[s.id] : true })),
        skip: { label: S.label, ...skipState(g) } },
      hintsLeft: target ? FBY[target].hints.length - (g.hints[target] || 0) : 0,
      debug: { seed: g.seed, faults: g.faults.map((f, i) => ({ ...f, label: FBY[f.id].label, active: faultActive(g, i) })), singer: g.singer, send: g.send, amp: g.amp },
    };
  }

  function debrief(g) {
    const Lg = g.log, at = e => clockText(toSec(C.start) + e.t), lines = [], loops = {};
    const done = complete(g);
    lines.push(done
      ? `✅ Line check done: the wedges and all ${g.lineup.length} singers checked by ${clockText(toSec(C.start) + g.completedAt.t)} (rehearsal at ${clockText(toSec(C.ready_by))}).`
      : `✅ Not done yet: ${[...(wedgeOk(g) ? [] : ['the wedge check']), ...remaining(g).map(m => D[m].label)].join(', ')}.`);
    const wedgeE = Lg.find(e => e.type === 'play' && e.to === 'bus1' && e.ok), firstCall = Lg.find(e => e.type === 'call');
    lines.push(wedgeE ? `🔊 Wedge check ✓ ${at(wedgeE)}: ${PB.label} in all three wedges${firstCall && firstCall.seq < wedgeE.seq ? ' (after the singers had started: do it first next time)' : ', before the singers'}.`
      : `🔊 Wedge check ✗: play known playback through Bus 1 before the singers.`);
    g.faults.forEach((gf, i) => {
      const F = FBY[gf.id], f = gf.device, amp = onAmp(gf), lbl = labelOf(f), say = t => t.replace(/\{mic\}/g, lbl);
      const actE = Lg.find(e => e.fixedFault === gf.id), actSeq = actE ? actE.seq : Infinity;
      const noticeE = amp
        ? Lg.find(e => e.seq < actSeq && ((e.type === 'play' && e.to === 'bus1' && !e.ok) || (e.type === 'ask' && e.what === 'hear' && e.reason === 'no-monitor')))
        : Lg.find(e => e.seq < actSeq && e.device === f && ((e.type === 'call' && e.observed && (e.observed.feedback || (e.observed.at === 'x32' && e.observed.level !== 'normal')))
          || (e.type === 'ask' && e.what === 'hear' && (e.feedback || !e.ok))));
      const noticeSeq = noticeE ? noticeE.seq : Infinity;
      const traceE = amp
        ? Lg.find(e => !e.via && e.seq < actSeq && ((F.trace_by.includes('mains') && e.seq > noticeSeq && ((e.type === 'play' && e.to === 'mains') || (e.type === 'mains' && e.heard)))
          || (F.trace_by.includes('a2-amp') && e.type === 'a2' && e.amp === 'check')))
        : Lg.find(e => !e.via && e.seq < actSeq && e.device === f && (
          (F.trace_by.includes('check') && e.type === 'ask' && e.what === 'check') ||
          (F.trace_by.includes('rx') && e.type === 'call' && e.observed && e.observed.at === 'rx') ||
          (F.trace_by.includes('a2') && e.type === 'a2') ||
          (F.trace_by.includes('send-down') && e.type === 'send' && e.seq > noticeSeq && (e.to == null || e.to < e.from))));
      const verifyE = !actE ? null : amp
        ? (wedgeOk(g) ? Lg.find(e => e.seq > actSeq && ((e.type === 'play' && e.to === 'bus1' && e.ok) || (e.type === 'ask' && e.what === 'hear' && e.ok))) : null)
        : (verified(g, f) ? Lg.find(e => e.seq > actSeq && e.device === f && e.type === 'ask' && e.what === 'hear' && e.ok) : null);
      lines.push(`🧠 What failed: ${say(F.debrief.failed)}`);
      lines.push(noticeE ? `  NOTICE ✓ ${at(noticeE)}: ${noticeE.via ? `${S.label} stopped on ${labelOf(noticeE.device)}` : noticeE.type === 'play' ? 'the wedges were silent with the playback going through Bus 1'
          : noticeE.type === 'ask' ? `${labelOf(noticeE.device)}'s singer said "${noticeE.reply}"` : noticeE.observed.feedback ? `${lbl} rang in the wedges` : `X32 ch ${D[f].channel} showed ${noticeE.observed.level === 'none' ? 'no signal' : 'only a little signal'}`}.`
        : actE ? '  NOTICE ✗ the problem was never observed before the fix (that came first).' : '  NOTICE ✗ not yet.');
      lines.push(traceE ? `  TRACE ✓ ${at(traceE)}: ${traceE.type === 'play' ? 'it played through the mains, so the source and the X32 were fine: the problem was after Bus 1'
          : traceE.type === 'mains' ? `${labelOf(traceE.device)} came through the mains, so the mic was fine: the problem was after Bus 1`
          : traceE.type === 'a2' ? (amp ? `you sent ${A2.label} to look at the monitor amp ("${traceE.report}")` : `you sent ${A2.label} to look at ${lbl} ("${traceE.report}")`)
          : traceE.type === 'ask' ? `you asked what ${lbl}'s display says ("${traceE.reply}")` : traceE.type === 'send' ? `you pulled ${lbl}'s Bus 1 send down to find the ring` : `you watched ${lbl}'s receiver while they talked`}.`
        : actE ? `  TRACE ✗ you acted before narrowing it down (${amp ? 'the mains, or the amp itself' : 'the display, its receiver, its send, or the A2'}).` : '  TRACE ✗ not yet.');
      lines.push(actE ? `  ACT ✓ ${at(actE)}: ${say(F.debrief.act)}` : `  ACT ✗ ${faultActive(g, i) ? say(F.debrief.still) : 'not yet.'}`);
      lines.push(verifyE ? `  VERIFY ✓ ${at(verifyE)}: ${amp ? 'sound in the wedges again' : `a healthy meter at X32 ch ${D[f].channel}, and they hear themselves in the wedge`}.`
        : actE ? `  VERIFY ✗ fixed but not verified: ${amp ? 'play through Bus 1 again and listen to the wedges' : 'have them say something at the X32, then ask if they can hear themselves'}.` : '  VERIFY ✗ not yet.');
      loops[gf.id] = { notice: !!noticeE, trace: !!traceE, act: !!actE, verify: !!verifyE };
    });
    // instructions that changed a mic that had nothing wrong with it (e.g. "press and hold" on a working mic)
    const faultMics = new Set(g.faults.map(f => f.device));
    const harm = Lg.filter(e => e.type === 'ask' && e.changed && !e.fixedFault && ['hold', 'tap'].includes(e.what));
    if (harm.length) lines.push(`⚠️ ${harm.length} instruction${harm.length > 1 ? 's' : ''} changed a mic that didn't need it: ${harm.map(e => `"${I[e.what].label}" to ${D[e.device].label}`).join(', ')}${harm.some(e => !faultMics.has(e.device)) ? ' (a working mic)' : ''}.`);
    const lowSends = g.lineup.filter(m => !atLeast(dbAt(g, m), BUS.hear_at_db));
    if (lowSends.length) lines.push(`⚠️ Bus 1 send too low for the singer to hear themselves: ${lowSends.map(m => D[m].label).join(', ')}.`);
    const trips = Lg.filter(e => e.type === 'a2').length;
    if (trips) lines.push(`🚶 ${A2.label} made ${trips} trip${trips > 1 ? 's' : ''} (${trips * C.a2_s} s while you stayed at the X32).`);
    const lineRuns = Lg.filter(e => e.type === 'line'), nHand = byHand(g).length;
    lines.push(`🔁 Routine: ${nHand} by hand${lineRuns.length ? `, ${lineRuns.reduce((s, e) => s + e.checked.length, 0)} by ${S.label}${lineRuns.some(e => e.stoppedAt) ? ` (it stopped at ${lineRuns.filter(e => e.stoppedAt).map(e => D[e.stoppedAt].label).join(', ')})` : ''}` : ''}.`);
    const hintsUsed = Object.entries(g.hints).filter(([, n]) => n);
    lines.push(`🆘 Hints used: ${hintsUsed.length ? hintsUsed.map(([id, n]) => `${FBY[id].label.toLowerCase()}: ${FBY[id].hints.slice(0, n).map(h => h.kind).join(' → ')}`).join('; ') : 'none'}.`);
    lines.push(`📚 Concepts: known source first; mic → receiver → X32 input → Bus 1 → monitor amp → wedges; ${g.faults.map(f => FBY[f.id].debrief.concepts).join('; ')}; on stage you fix things through the singer or the A2.`);
    return { ready: done, loops, harm: harm.length, lowSends, wedgeCheck: !!wedgeE, byHand: nHand, hints: Object.values(g.hints).reduce((a, b) => a + b, 0), actions: Lg.length, gameSeconds: g.t, lines };
  }

  return { start, act, view, debrief, sound: (g, m) => sound(g, m) };
}
