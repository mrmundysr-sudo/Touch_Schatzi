// Opponent brain: exact expectimax over a single turn (all reroll outcomes as multisets) with a
// heuristic terminal value (points minus the category's expected future, plus upper-bonus equity).
import { CATS, UPPER, FACE, legalCats, scoreFor, upperSum, isOpen, openCats, jokerActive, CFG, counts } from './rules.js';

const BASE = { ones: 2.1, twos: 5.3, threes: 8.6, fours: 12.1, fives: 15.7, sixes: 19.2, threeKind: 21.7, fourKind: 13.1, fullHouse: 22.6, smallStraight: 29.5, largeStraight: 32.7, schatzi: 16.9, chance: 22.0 };

// ---- state tables (built once): every sorted 5-dice multiset gets an id (252 total) ----
const STATES = [], IDX = new Map();
(function () { const rec = (cur, from) => { if (cur.length === 5) { IDX.set(cur.join(''), STATES.length); STATES.push(cur.slice()); return; } for (let f = from; f <= 6; f++) { cur.push(f); rec(cur, f); cur.pop(); } }; rec([], 1); })();
const FACT = [1, 1, 2, 6, 24, 120];
const OUTCOMES = []; // OUTCOMES[k] = [{dice, p}] multisets of k dice
(function () {
  for (let k = 0; k <= 5; k++) {
    const list = [];
    (function rec(face, left, cur) {
      if (face === 6) { cur[6] = left; const dice = []; for (let f = 1; f <= 6; f++) for (let i = 0; i < cur[f]; i++) dice.push(f); let p = FACT[k]; for (let f = 1; f <= 6; f++) p /= FACT[cur[f]]; list.push({ dice, p: p / Math.pow(6, k) }); return; }
      for (let n = 0; n <= left; n++) { cur[face] = n; rec(face + 1, left - n, cur); }
    })(1, k, [0, 0, 0, 0, 0, 0, 0]);
    OUTCOMES[k] = list;
  }
})();
const idOf = (dice) => IDX.get(dice.slice().sort((a, b) => a - b).join(''));
const HOLDS = []; // lazily: HOLDS[id] = [{held, ids:Int16Array, ps:Float64Array}]
function holdsOf(id) {
  if (HOLDS[id]) return HOLDS[id];
  const sorted = STATES[id], c = counts(sorted), res = [];
  const rec = (face, cur) => {
    if (face === 7) {
      const held = []; for (let f = 1; f <= 6; f++) for (let i = 0; i < cur[f]; i++) held.push(f);
      if (held.length === 5) return;
      const outs = OUTCOMES[5 - held.length]; const ids = new Int16Array(outs.length), ps = new Float64Array(outs.length);
      outs.forEach((o, i) => { ids[i] = idOf(held.concat(o.dice)); ps[i] = o.p; });
      res.push({ held, ids, ps }); return;
    }
    for (let n = 0; n <= c[face]; n++) { cur[face] = n; rec(face + 1, cur); }
  };
  rec(1, [0, 0, 0, 0, 0, 0, 0]); return (HOLDS[id] = res);
}

export function makeEvaluator(card) {
  const open = openCats(card), turnsLeft = open.length, scale = 0.62 + 0.38 * (turnsLeft / 13);
  const up0 = upperSum(card); const openUp = UPPER.filter((c) => isOpen(card, c));
  const bonusEq = (up, openSet) => { if (up >= CFG.upperThreshold) return CFG.upperBonus; let exp = up; for (const c of openSet) exp += BASE[c] * 1.04; return CFG.upperBonus / (1 + Math.exp(-(exp - CFG.upperThreshold) / 4.2)); };
  const bonus0 = bonusEq(up0, openUp);
  const n = STATES.length, V0 = new Float64Array(n), C0 = new Array(n), V1 = new Float64Array(n);
  for (let id = 0; id < n; id++) {
    const dice = STATES[id], legal = legalCats(card, dice); let best = -1e9, bc = legal[0];
    const jb = jokerActive(card, dice) && card.scores.schatzi === 50 ? CFG.schatziBonus : 0;
    for (const c of legal) {
      const pts = scoreFor(card, c, dice); let val = pts - BASE[c] * scale + jb;
      if (FACE[c]) val += bonusEq(up0 + pts, openUp.filter((x) => x !== c)) - bonus0;
      if (val > best) { best = val; bc = c; }
    }
    V0[id] = best; C0[id] = bc;
  }
  for (let id = 0; id < n; id++) { let best = V0[id]; for (const h of holdsOf(id)) { let s = 0; for (let i = 0; i < h.ids.length; i++) s += h.ps[i] * V0[h.ids[i]]; if (s > best) best = s; } V1[id] = best; }
  return {
    terminal: (dice) => { const id = idOf(dice); return { v: V0[id], cat: C0[id] }; },
    /** Value of every hold option for a roll with `rollsLeft` rerolls remaining. */
    holdOptions(dice, rollsLeft) {
      const id = idOf(dice); const table = rollsLeft === 1 ? V0 : V1; const opts = [{ held: STATES[id], v: V0[id], stop: true }];
      for (const h of holdsOf(id)) { let s = 0; for (let i = 0; i < h.ids.length; i++) s += h.ps[i] * table[h.ids[i]]; opts.push({ held: h.held, v: s, stop: false }); }
      return opts;
    },
  };
}

/** Turn a held multiset into a boolean mask over the actual dice order. */
export function maskFromHeld(dice, held) {
  const need = counts(held), mask = dice.map(() => false);
  dice.forEach((v, i) => { if (need[v] > 0) { need[v]--; mask[i] = true; } });
  return mask;
}

const sortD = (d) => d.slice().sort((a, b) => a - b);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

/** Decide what to keep. Returns {stop:boolean, mask:boolean[]}. */
export function decideHold(card, dice, rerollsLeft, cfg) {
  if (rerollsLeft <= 0) return { stop: true, mask: dice.map(() => true) };
  const ev = makeEvaluator(card); const opts = ev.holdOptions(dice, rerollsLeft);
  if (cfg.randomHold && Math.random() < cfg.randomHold) { const o = opts[Math.floor(Math.random() * opts.length)]; return o.stop ? { stop: true, mask: dice.map(() => true) } : { stop: false, mask: maskFromHeld(dice, o.held) }; }
  let best = null, bv = -1e9;
  for (const o of opts) { const v = o.v + (cfg.noise ? gauss() * cfg.noise : 0); if (v > bv) { bv = v; best = o; } }
  return best.stop ? { stop: true, mask: dice.map(() => true) } : { stop: false, mask: maskFromHeld(dice, best.held) };
}

/** Pick the category to score. */
export function decideCategory(card, dice, cfg) {
  const ev = makeEvaluator(card); const legal = legalCats(card, dice); const sorted = sortD(dice);
  if (!cfg.categoryNoise) return ev.terminal(sorted).cat;
  // noisy re-evaluation per legal cat
  let best = legal[0], bv = -1e9; const base = ev.terminal(sorted);
  for (const c of legal) { const pts = scoreFor(card, c, dice); let v = pts - BASE[c] * 0.8 + gauss() * cfg.categoryNoise + (c === base.cat ? 2 : 0); if (v > bv) { bv = v; best = c; } }
  return best;
}

/** What the hint button shows a human: best mask or stop. */
export function hintFor(card, dice, rerollsLeft) { return decideHold(card, dice, rerollsLeft, {}); }
export function bestCategory(card, dice) { return decideCategory(card, dice, {}); }
void CATS;
