// The SUPER SECRET FINAL LEVEL (Cary, 2026-10-08): a Final Fantasy style, party-based, turn-based battle.
// Each round the player picks a command for every standing party member (attack, skill, defend, item);
// then everyone, the boss included, acts in speed order. Pure functions over plain JSON state, seeded
// (the random state lives in the game, so a game can be saved, replayed and tested).
//
//   const b = battle(content);                        // content: content/final-battle.json
//   let g = b.start('FL-1', { order: ['morgan', 'player', 'cary', 'magnolia'], names: { player: 'Sam' } });   // opts optional
//   ({ game: g, events, error } = b.choose(g, 'cary', { type: 'attack' }));
//   ...once every standing member has a command, the round resolves and `events` tells the story.

const clone = o => JSON.parse(JSON.stringify(o));
function hashSeed(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
// mulberry32 with its state in the game: next(g) advances g.rng
function next(g) { g.rng = (g.rng + 0x6D2B79F5) | 0; let t = Math.imul(g.rng ^ (g.rng >>> 15), 1 | g.rng); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

export function battle(content) {
  const SK = content.skills, IT = content.items, B = content.boss, R = content.rules;
  const say = (t, o) => t.replace(/\{user\}/g, o.user || '').replace(/\{target\}/g, o.target || '');

  function start(seed = 'FL-00001', opts = {}) {
    const ids = content.party.map(p => p.id), order = opts.order && opts.order.length === ids.length && ids.every(i => opts.order.includes(i)) ? opts.order : ids;
    const party = order.map(i => content.party.find(p => p.id === i)).map(p => ({ id: p.id, name: (opts.names && opts.names[p.id]) || p.name, player: !!p.player, hp: p.hp, maxHp: p.hp, mp: p.mp, maxMp: p.mp, atk: p.atk, def: p.def, mag: p.mag, spd: p.spd,
      skills: p.skills.slice(), silenced: 0, buff: null, guard: false }));
    const boss = { id: B.id, name: B.name, hp: B.hp, maxHp: B.hp, atk: B.atk, def: B.def, mag: B.mag, spd: B.spd, debuff: null, exposed: null, phase: 1 };
    return { v: 1, content: content.id, seed, rng: hashSeed(seed), round: 1, party, boss, items: Object.fromEntries(Object.entries(IT).map(([k, v]) => [k, v.count])),
      pending: {}, log: [], outcome: null };
  }
  const member = (g, id) => g.party.find(p => p.id === id);
  const standing = g => g.party.filter(p => p.hp > 0);
  const variance = g => R.variance[0] + next(g) * (R.variance[1] - R.variance[0]);
  const atkOf = p => p.atk * (p.buff ? p.buff.mult : 1);
  const bossAtk = b => b.atk * (b.debuff ? b.debuff.mult : 1);
  const bossDef = b => b.def * (b.exposed ? b.exposed.mult : 1);

  // the commands a member may pick right now (the UI's menu, and the rules choose() enforces)
  function options(g, id) {
    const p = member(g, id); if (!p || p.hp <= 0 || g.outcome) return null;
    return {
      attack: true, defend: true,
      skills: p.skills.map(s => ({ id: s, ...SK[s], ok: !p.silenced && p.mp >= SK[s].mp, why: p.silenced ? 'muted' : p.mp < SK[s].mp ? 'not enough MP' : null })),
      items: Object.entries(IT).map(([k, it]) => ({ id: k, ...it, left: g.items[k], ok: g.items[k] > 0 && (it.target !== 'fallen' || g.party.some(x => x.hp <= 0)) })),
    };
  }

  function choose(g0, id, cmd) {
    const g = clone(g0), fail = (code, message) => ({ game: g0, events: [], error: { code, message } });
    if (g.outcome) return fail('over', 'the battle is over');
    const p = member(g, id); if (!p) return fail('who', 'no such party member');
    if (p.hp <= 0) return fail('down', `${p.name} is down`);
    if (g.pending[id]) return fail('chosen', `${p.name} already has a command`);
    if (!cmd || !['attack', 'defend', 'skill', 'item'].includes(cmd.type)) return fail('bad', 'attack, defend, skill or item');
    if (cmd.type === 'skill') {
      const s = SK[cmd.skill]; if (!s || !p.skills.includes(cmd.skill)) return fail('skill', `${p.name} doesn't know that`);
      if (p.silenced) return fail('muted', `${p.name} is muted: no skills`);
      if (p.mp < s.mp) return fail('mp', 'not enough MP');
      if (s.target === 'ally' && !(member(g, cmd.target) && member(g, cmd.target).hp > 0)) return fail('target', 'pick a standing ally');
    }
    if (cmd.type === 'item') {
      const it = IT[cmd.item]; if (!it) return fail('item', 'no such item');
      if (g.items[cmd.item] - Object.values(g.pending).filter(c => c.type === 'item' && c.item === cmd.item).length <= 0) return fail('none-left', `no ${it.name} left`);
      const t = member(g, cmd.target); if (!t) return fail('target', 'pick a party member');
      if (it.target === 'fallen' ? t.hp > 0 : t.hp <= 0) return fail('target', it.target === 'fallen' ? 'that one is still standing' : 'pick a standing ally');
    }
    g.pending[id] = clone(cmd);
    const events = [{ type: 'chosen', id }];
    if (standing(g).every(m => g.pending[m.id])) resolve(g, events);
    return { game: g, events, error: null };
  }

  function hit(g, target, raw, events, from) {
    let dmg = Math.max(1, Math.round(raw));
    if (target.guard) dmg = Math.max(1, Math.round(dmg * R.defend));
    target.hp = Math.max(0, target.hp - dmg);
    events.push({ type: 'damage', from, target: target.id, amount: dmg, down: target.hp === 0 });
    return dmg;
  }

  function act(g, actor, events) {
    if (actor === 'boss') return bossAct(g, events);
    const p = member(g, actor); if (p.hp <= 0) return;
    const c = g.pending[actor], b = g.boss;
    if (c.type === 'attack') { events.push({ type: 'act', actor, text: `${p.name} attacks!` }); hit(g, b, (atkOf(p) * 2 - bossDef(b)) * variance(g), events, actor); }
    else if (c.type === 'defend') events.push({ type: 'act', actor, text: `${p.name} braces.` });
    else if (c.type === 'skill') {
      const s = SK[c.skill];
      if (p.silenced) { events.push({ type: 'act', actor, text: `${p.name} tries ${s.name}... but MUTE ALL is on.`, fizzle: true }); return; }
      p.mp -= s.mp; const t = c.target && member(g, c.target);
      events.push({ type: 'act', actor, skill: c.skill, text: say(s.text, { user: p.name, target: t ? t.name : '' }) });
      if (s.kind === 'heal') for (const m of standing(g)) { const h = Math.round(s.power + p.mag * 0.3); m.hp = Math.min(m.maxHp, m.hp + h); events.push({ type: 'heal', target: m.id, amount: h }); }
      else if (s.kind === 'cleanse') { const tt = t && t.hp > 0 ? t : p; tt.silenced = 0; const h = Math.round(s.power); tt.hp = Math.min(tt.maxHp, tt.hp + h); events.push({ type: 'heal', target: tt.id, amount: h, cleansed: true }); }
      else if (s.kind === 'multi') for (let k = 0; k < s.hits && b.hp > 0; k++) hit(g, b, (atkOf(p) * 2 - bossDef(b)) * s.power * variance(g), events, actor);
      else if (s.kind === 'magic') hit(g, b, (p.mag * 2 - bossDef(b)) * s.power * variance(g) / 2, events, actor);
      else if (s.kind === 'expose') { b.exposed = { mult: s.power, rounds: s.rounds }; events.push({ type: 'expose', target: 'boss' }); }
      else if (s.kind === 'buff') for (const m of standing(g)) { m.buff = { mult: s.power, rounds: s.rounds }; events.push({ type: 'buff', target: m.id }); }
      else if (s.kind === 'debuff') { b.debuff = { mult: s.power, rounds: s.rounds }; events.push({ type: 'debuff', target: 'boss' }); }
    } else if (c.type === 'item') {
      const it = IT[c.item], t = member(g, c.target);
      if (g.items[c.item] <= 0) { events.push({ type: 'act', actor, text: `${p.name} reaches for a ${it.name}... none left.`, fizzle: true }); return; }
      if (it.kind === 'revive' ? t.hp > 0 : t.hp <= 0) { events.push({ type: 'act', actor, text: `${p.name} holds the ${it.name}, but it isn't needed now.`, fizzle: true }); return; }
      g.items[c.item]--; events.push({ type: 'act', actor, item: c.item, text: say(it.text, { user: p.name, target: t.name }) });
      if (it.kind === 'heal') { t.hp = Math.min(t.maxHp, t.hp + it.power); events.push({ type: 'heal', target: t.id, amount: it.power }); }
      else if (it.kind === 'mp') { t.mp = Math.min(t.maxMp, t.mp + it.power); events.push({ type: 'mp', target: t.id, amount: it.power }); }
      else if (it.kind === 'revive') { t.hp = Math.round(t.maxHp * it.power); t.silenced = 0; events.push({ type: 'revive', target: t.id, amount: t.hp }); }
    }
  }

  function bossAct(g, events) {
    const b = g.boss; if (b.hp <= 0) return;
    const pool = B.moves.filter(m => !m.phase || m.phase <= b.phase), total = pool.reduce((s, m) => s + m.weight, 0);
    let r = next(g) * total, mv = pool[0]; for (const m of pool) { r -= m.weight; if (r < 0) { mv = m; break; } }
    events.push({ type: 'act', actor: 'boss', move: mv.id, text: `${b.name}: ${mv.name}! ${mv.text}` });
    const targets = mv.target === 'party' ? standing(g) : [standing(g)[Math.floor(next(g) * standing(g).length)]];
    for (const t of targets) {
      if (mv.kind === 'silence') { t.silenced = mv.rounds; events.push({ type: 'silence', target: t.id }); }
      else hit(g, t, ((mv.kind === 'magic' ? b.mag : bossAtk(b)) * 2 - t.def) * mv.power * variance(g), events, 'boss');
    }
  }

  function resolve(g, events) {
    for (const m of standing(g)) m.guard = g.pending[m.id].type === 'defend';           // defending takes effect at once
    const order = [...standing(g).map(m => ({ id: m.id, spd: m.spd })), { id: 'boss', spd: B.spd }].sort((a, b) => b.spd - a.spd);
    events.push({ type: 'round', round: g.round });
    for (const { id } of order) {
      act(g, id, events);
      if (g.boss.phase === 1 && g.boss.hp > 0 && g.boss.hp <= g.boss.maxHp * B.phase2_at) { g.boss.phase = 2; events.push({ type: 'phase', text: B.phase2_text }); }
      if (g.boss.hp <= 0) { g.outcome = 'victory'; break; }
      if (!standing(g).length) { g.outcome = 'defeat'; break; }
    }
    // the end of the round: statuses tick down, guards drop, the next round's menu opens
    for (const m of g.party) { m.guard = false; if (m.silenced) m.silenced--; if (m.buff && --m.buff.rounds <= 0) m.buff = null; }
    if (g.boss.debuff && --g.boss.debuff.rounds <= 0) g.boss.debuff = null;
    if (g.boss.exposed && --g.boss.exposed.rounds <= 0) g.boss.exposed = null;
    g.log.push({ round: g.round, commands: g.pending, events: events.filter(e => e.type !== 'chosen').length });
    g.pending = {}; g.round++;
    if (g.outcome) events.push({ type: g.outcome, text: (g.outcome === 'victory' ? content.victory : content.defeat).join(' ') });
  }

  // whose command is next (the first standing member without one), or null while a round resolves / after the end
  const nextUp = g => g.outcome ? null : (standing(g).find(m => !g.pending[m.id]) || null);

  return { start, choose, options, nextUp: g => { const m = nextUp(g); return m ? m.id : null; } };
}
