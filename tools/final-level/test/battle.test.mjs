// The final level's battle rules. Run: node --test tools/final-level/test/battle.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { battle } from '../battle.js';

const C = JSON.parse(readFileSync(new URL('../content/final-battle.json', import.meta.url)));
const b = battle(C);
const ids = C.party.map(p => p.id);   // the play order in these tests is the content's order
const P = (g, id) => g.party.find(p => p.id === id), CP = id => C.party.find(p => p.id === id);
// play one round: cmds maps member -> command (members that are down are skipped)
function round(g, cmds) {
  const events = [];
  for (const id of ids) {
    if (b.nextUp(g) === null) break;
    const m = g.party.find(p => p.id === id); if (m.hp <= 0 || g.pending[id]) continue;
    const r = b.choose(g, id, typeof cmds === 'function' ? cmds(g, id) : (cmds[id] || { type: 'attack' }));
    assert.equal(r.error, null, `${id}: ${r.error && r.error.message}`);
    g = r.game; events.push(...r.events);
  }
  return { g, events };
}
// a sensible player: heal when hurt, cleanse when muted, buff, debuff, then hit hard
const left = (g, item) => g.items[item] - Object.values(g.pending).filter(c => c.type === 'item' && c.item === item).length;
const smart = (g, id) => {
  const m = g.party.find(p => p.id === id), low = g.party.filter(p => p.hp > 0 && p.hp < p.maxHp * .45), down = g.party.find(p => p.hp <= 0);
  if (down && left(g, 'spare') > 0 && !Object.values(g.pending).some(c => c.item === 'spare')) return { type: 'item', item: 'spare', target: down.id };
  if (id === 'cary' && !m.silenced && low.length >= 2 && m.mp >= 8) return { type: 'skill', skill: 'wii-shop' };
  if (low.length && left(g, 'battery') > 0) return { type: 'item', item: 'battery', target: low[0].id };
  if (m.mp < 6 && left(g, 'coffee') > 0) return { type: 'item', item: 'coffee', target: id };
  if (!m.silenced && id === 'magnolia' && m.mp >= 12) return { type: 'skill', skill: 'gain-staging' };
  if (!m.silenced && id === 'player' && !g.boss.exposed && m.mp >= 6) return { type: 'skill', skill: 'trace' };
  if (!m.silenced && id === 'morgan' && !m.buff && m.mp >= 6) return { type: 'skill', skill: 'phantom-power' };
  if (!m.silenced && id === 'morgan' && m.mp >= 10) return { type: 'skill', skill: 'check-the-rest' };
  return { type: 'attack' };
};

test('the gate stores only the hash of the password', () => {
  assert.equal(C.gate.password_sha256.length, 64);
  assert.ok(!JSON.stringify(C).toLowerCase().includes('"password":'), 'no plain password field');
  assert.equal(createHash('sha256').update('wrong').digest('hex') === C.gate.password_sha256, false);
});

test('start: the party at full health, the boss at full health, items counted; same seed, same fight', () => {
  const g = b.start('FL-1');
  assert.deepEqual(g.party.map(p => p.hp), C.party.map(p => p.hp));
  assert.equal(g.boss.hp, C.boss.hp); assert.equal(g.boss.name, 'Adam Borecki');
  assert.deepEqual(g.items, { battery: 3, coffee: 2, spare: 1 });
  const a = round(b.start('FL-1'), {}).g, c = round(b.start('FL-1'), {}).g;
  assert.deepEqual(a, c);
  assert.notDeepEqual(round(b.start('FL-2'), {}).g.boss.hp, a.boss.hp);
});

test('a round resolves only when every standing member has a command; then the boss acts too', () => {
  let g = b.start('FL-1');
  let r = b.choose(g, 'cary', { type: 'attack' }); g = r.game;
  assert.equal(b.nextUp(g), 'player', 'the first without a command'); assert.ok(!r.events.some(e => e.type === 'round'));
  assert.equal(b.choose(g, 'cary', { type: 'attack' }).error.code, 'chosen');
  ({ g } = round(g, {}));
  assert.equal(g.round, 2); assert.ok(g.boss.hp < C.boss.hp);
  assert.ok(g.party.some(p => p.hp < p.maxHp), 'the boss hit back');
});

test('defending halves the damage taken that round', () => {
  // same seed and actions, except one side defends: total party damage is lower when everyone defends
  const dmg = defend => { const { events } = round(b.start('FL-7'), id => ({ type: defend ? 'defend' : 'attack' })); return events.filter(e => e.type === 'damage' && e.from === 'boss').reduce((s, e) => s + e.amount, 0); };
  assert.ok(dmg(true) < dmg(false) * 0.75, `${dmg(true)} vs ${dmg(false)}`);
});

test('skills cost MP and do their thing: heal, multi-hit, magic, buff, debuff, cleanse', () => {
  const b = battle({ ...C, boss: { ...C.boss, moves: [C.boss.moves.find(m => m.id === 'pop-quiz')] } });   // no MUTE ALL in the way
  const round = (g, cmds) => { const events = []; for (const id of ids) { if (g.party.find(p => p.id === id).hp <= 0 || g.pending[id] || g.outcome) continue; const r = b.choose(g, id, cmds[id] || { type: 'attack' }); assert.equal(r.error, null, r.error && r.error.message); g = r.game; events.push(...r.events); } return { g, events }; };
  let g = b.start('FL-3');
  g.party.forEach(p => { p.hp = 40; });
  let r = round(g, { cary: { type: 'skill', skill: 'wii-shop' }, morgan: { type: 'skill', skill: 'phantom-power' }, magnolia: { type: 'skill', skill: 'sends-on-fader' } });
  assert.ok(r.events.filter(e => e.type === 'heal').length === 4);
  assert.equal(P(r.g, 'cary').mp, CP('cary').mp - 8);
  assert.ok(r.g.party.every(p => p.hp <= 0 || p.buff), 'phantom power on the party');
  assert.ok(r.g.boss.debuff);
  r = round(r.g, { morgan: { type: 'skill', skill: 'check-the-rest' }, magnolia: { type: 'skill', skill: 'gain-staging' } });
  assert.equal(r.events.filter(e => e.type === 'damage' && e.from === 'morgan').length, 3, 'three hits');
  g = r.g; P(g, 'morgan').silenced = 2;
  r = round(g, { cary: { type: 'skill', skill: 'reseat', target: 'morgan' } });
  assert.equal(P(r.g, 'morgan').silenced, 0, 'reseat clears MUTE ALL');
});

test('MUTE ALL: a muted member cannot pick a skill, and one queued before the mute fizzles without spending MP', () => {
  let g = b.start('FL-1'); P(g, 'cary').silenced = 1;
  assert.equal(b.choose(g, 'cary', { type: 'skill', skill: 'wii-shop' }).error.code, 'muted');
  assert.ok(b.options(g, 'cary').skills.every(s => !s.ok && s.why === 'muted'));
  // force the boss to mute before Morgan acts: Morgan (spd 14) is faster than the boss (11), so use Cary (12)... make the boss faster
  const fast = battle({ ...C, boss: { ...C.boss, spd: 99, moves: [{ ...C.boss.moves.find(m => m.id === 'mute-all'), weight: 1 }] } });
  g = fast.start('FL-1');
  for (const id of ids) g = fast.choose(g, id, id === 'cary' ? { type: 'skill', skill: 'wii-shop' } : { type: 'attack' }).game;
  assert.equal(P(g, 'cary').mp, CP('cary').mp, 'no MP spent on a fizzled skill');
  assert.ok(g.party.every(p => p.silenced > 0), 'still muted next round');
});

test('items: limited, aimed at the right people, and the spare mic revives', () => {
  let g = b.start('FL-1');
  assert.equal(b.choose(g, 'cary', { type: 'item', item: 'spare', target: 'morgan' }).error.code, 'target', 'nobody is down');
  P(g, 'morgan').hp = 0;
  let r = round(g, { cary: { type: 'item', item: 'spare', target: 'morgan' } });
  assert.ok(P(r.g, 'morgan').hp > 0 || r.events.some(e => e.type === 'damage' && e.target === 'morgan'), 'revived (unless hit again right away)');
  assert.equal(r.g.items.spare, 0);
  g = b.start('FL-1');
  g.items.battery = 1;
  g = b.choose(g, 'cary', { type: 'item', item: 'battery', target: 'cary' }).game;
  assert.equal(b.choose(g, 'morgan', { type: 'item', item: 'battery', target: 'morgan' }).error.code, 'none-left', 'one battery, already promised');
});

test('a sensible strategy beats Adam Borecki (on most seeds), with a phase change at half health', () => {
  let wins = 0, phase = 0;
  for (let s = 0; s < 20; s++) {
    let g = b.start('W-' + s), events = [];
    for (let k = 0; k < 60 && !g.outcome; k++) { const r = round(g, smart); g = r.g; events.push(...r.events); }
    if (g.outcome === 'victory') wins++;
    if (events.some(e => e.type === 'phase')) phase++;
    if (g.outcome === 'victory') assert.ok(events.some(e => e.type === 'victory' && /Adam Borecki is defeated/.test(e.text)));
  }
  assert.ok(wins >= 14, `won ${wins} of 20`);
  assert.ok(phase >= 18, 'the fight reaches phase 2');
});

test('doing nothing but defending loses (eventually), and the game says so', () => {
  let g = b.start('L-1'), events = [];
  for (let k = 0; k < 200 && !g.outcome; k++) { const r = round(g, () => ({ type: 'defend' })); g = r.g; events.push(...r.events); }
  assert.equal(g.outcome, 'defeat');
  assert.ok(events.some(e => e.type === 'defeat'));
  assert.equal(b.choose(g, 'cary', { type: 'attack' }).error.code, 'over');
});

test('a party of 4: the player plus the three mentors; your mentor leads; your name', () => {
  assert.deepEqual(C.party.map(p => p.id).sort(), ['cary', 'magnolia', 'morgan', 'player']);
  const g = b.start('FL-1', { order: ['morgan', 'player', 'cary', 'magnolia'], names: { player: 'Sam' } });
  assert.deepEqual(g.party.map(p => p.id), ['morgan', 'player', 'cary', 'magnolia']);
  assert.equal(g.party[1].name, 'Sam'); assert.equal(g.party[1].player, true);
  assert.equal(b.nextUp(g), 'morgan', 'the leader picks first');
  assert.deepEqual(b.start('FL-1', { order: ['morgan', 'nobody'] }).party.map(p => p.id), C.party.map(p => p.id), 'a bad order falls back to the default');
});

test("the player's Trace the Signal exposes the boss: everyone's attacks hit harder for a few rounds", () => {
  const calm = battle({ ...C, boss: { ...C.boss, moves: [{ ...C.boss.moves[0], power: 0.01 }] } });
  const dealt = trace => { let g = calm.start('FL-9'); if (trace) g = round(g, { player: { type: 'skill', skill: 'trace' }, cary: { type: 'defend' }, morgan: { type: 'defend' }, magnolia: { type: 'defend' } }).g;
    const hp = g.boss.hp; g = round(g, {}).g; return hp - g.boss.hp; };
  assert.ok(dealt(true) > dealt(false) * 1.15, `${dealt(true)} vs ${dealt(false)}`);
});

test("Cary's Awesome and Funny Joke (Cary, 2026-10-08): it's Cary's, costs MP, and lands on Adam", () => {
  assert.ok(CP('cary').skills.includes('awesome-joke'));
  const calm = battle({ ...C, boss: { ...C.boss, moves: [C.boss.moves.find(m => m.id === 'pop-quiz')] } });
  let g = calm.start('FL-4');
  for (const id of ids) g = calm.choose(g, id, id === 'cary' ? { type: 'skill', skill: 'awesome-joke' } : { type: 'defend' }).game;
  assert.equal(P(g, 'cary').mp, CP('cary').mp - C.skills['awesome-joke'].mp);
  assert.ok(g.boss.hp < C.boss.hp, 'it hit');
});
