import assert from 'node:assert/strict';
import { rawScore, newCard, applyScore, legalCats, grandTotal, isComplete, jokerActive, upperBonus, scoreFor, CATS } from '../app/src/main/assets/www/js/game/rules.js';
import { decideHold, decideCategory } from '../app/src/main/assets/www/js/game/ai.js';
const t = (n, f) => { try { f(); console.log('ok  ', n); } catch (e) { console.error('FAIL', n, e.message); process.exitCode = 1; } };
t('upper', () => { assert.equal(rawScore('fours', [4, 4, 1, 2, 4]), 12); assert.equal(rawScore('ones', [2, 3, 4, 5, 6]), 0); });
t('kinds', () => { assert.equal(rawScore('threeKind', [3, 3, 3, 1, 2]), 12); assert.equal(rawScore('threeKind', [3, 3, 4, 1, 2]), 0); assert.equal(rawScore('fourKind', [5, 5, 5, 5, 1]), 21); assert.equal(rawScore('fourKind', [5, 5, 5, 1, 1]), 0); });
t('full house', () => { assert.equal(rawScore('fullHouse', [2, 2, 3, 3, 3]), 25); assert.equal(rawScore('fullHouse', [2, 2, 2, 2, 2]), 0); assert.equal(rawScore('fullHouse', [1, 2, 3, 3, 3]), 0); });
t('straights', () => { assert.equal(rawScore('smallStraight', [1, 2, 3, 4, 6]), 30); assert.equal(rawScore('smallStraight', [3, 4, 5, 6, 6]), 30); assert.equal(rawScore('smallStraight', [1, 2, 3, 5, 6]), 0); assert.equal(rawScore('largeStraight', [2, 3, 4, 5, 6]), 40); assert.equal(rawScore('largeStraight', [1, 2, 3, 4, 6]), 0); assert.equal(rawScore('smallStraight', [1, 2, 2, 3, 4]), 30); });
t('schatzi/chance', () => { assert.equal(rawScore('schatzi', [4, 4, 4, 4, 4]), 50); assert.equal(rawScore('schatzi', [4, 4, 4, 4, 3]), 0); assert.equal(rawScore('chance', [1, 2, 3, 4, 6]), 16); });
t('upper bonus', () => { const c = newCard(); for (const [k, n] of [['ones', 3], ['twos', 3], ['threes', 3], ['fours', 3], ['fives', 3], ['sixes', 3]]) c.scores[k] = n * ({ ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 }[k]); assert.equal(upperBonus(c), 35); assert.equal(grandTotal(c), 63 + 35); });
t('joker rules', () => {
  const c = newCard(); c.scores.schatzi = 50; const d = [3, 3, 3, 3, 3];
  assert.ok(jokerActive(c, d)); assert.deepEqual(legalCats(c, d), ['threes']);
  c.scores.threes = 9; const l = legalCats(c, d); assert.ok(l.includes('fullHouse') && !l.includes('ones')); assert.equal(scoreFor(c, 'fullHouse', d), 25); assert.equal(scoreFor(c, 'largeStraight', d), 40);
  const r = applyScore(c, 'smallStraight', d); assert.equal(r.pts, 30); assert.equal(r.schatziBonus, 100); assert.equal(c.bonusCount, 1);
  const z = newCard(); z.scores.schatzi = 0; const r2 = applyScore(z, 'threes', d); assert.equal(r2.schatziBonus, 0);
});
t('joker falls back to upper zero', () => { const c = newCard(); c.scores.schatzi = 50; for (const k of ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'chance']) c.scores[k] = 1; c.scores.threes = 9; const l = legalCats(c, [3, 3, 3, 3, 3]); assert.ok(l.includes('ones') && l.every((x) => ['ones', 'twos', 'fours', 'fives', 'sixes'].includes(x))); });
t('illegal throws', () => { const c = newCard(); c.scores.ones = 2; assert.throws(() => applyScore(c, 'ones', [1, 1, 2, 3, 4])); });
// Simulate full AI games
const rnd = () => 1 + Math.floor(Math.random() * 6);
function play(cfg) { const c = newCard(); for (let r = 0; r < 13; r++) { let d = [rnd(), rnd(), rnd(), rnd(), rnd()]; for (let k = 2; k > 0; k--) { const h = decideHold(c, d, k, cfg); if (h.stop) break; d = d.map((v, i) => (h.mask[i] ? v : rnd())); } const cat = decideCategory(c, d, cfg); applyScore(c, cat, d); } assert.ok(isComplete(c)); return grandTotal(c); }
const avg = (cfg, n) => { let s = 0; for (let i = 0; i < n; i++) s += play(cfg); return s / n; };
const cfgs = { hard: { noise: 0, randomHold: 0, categoryNoise: 0 }, medium: { noise: 2.4, randomHold: 0.04, categoryNoise: 1.6 }, easy: { noise: 7, randomHold: 0.22, categoryNoise: 5 } };
const t0 = Date.now(); const res = {};
for (const k of ['hard', 'medium', 'easy']) res[k] = avg(cfgs[k], k === 'hard' ? 150 : 100);
console.log('avg scores', res, 'ms', Date.now() - t0);
t('difficulty ordering', () => { assert.ok(res.hard > res.medium && res.medium > res.easy, JSON.stringify(res)); assert.ok(res.hard > 190, 'hard too weak ' + res.hard); });
void CATS;
