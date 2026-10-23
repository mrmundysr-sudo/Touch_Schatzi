// Match model: turn order, dice, holds, scoring. Pure logic + events; the screens drive pacing.
import { Emitter, randInt } from '../lib/util.js';
import { newCard, applyScore, legalCats, scoreFor, grandTotal, isComplete, CATS } from './rules.js';

export class Game extends Emitter {
  /** players: [{id, name, charId|null, human}] */
  constructor(players, { rounds = 13, rolls = 3 } = {}) {
    super(); this.players = players.map((p) => ({ ...p, card: newCard() })); this.rounds = rounds; this.maxRolls = rolls;
    this.turn = 0; this.round = 1; this.over = false; this.dice = [0, 0, 0, 0, 0]; this.held = [false, false, false, false, false]; this.rollsLeft = rolls; this.rolled = false;
    this.lead = -1;
  }
  get current() { return this.players[this.turn]; }
  get human() { return this.players.find((p) => p.human); }
  totals() { return this.players.map((p) => grandTotal(p.card)); }
  /** Ranking (best first) with ties sharing a place. */
  ranking() { const t = this.totals(); return this.players.map((p, i) => ({ p, i, total: t[i] })).sort((a, b) => b.total - a.total).map((r, k, arr) => ({ ...r, place: arr.findIndex((x) => x.total === r.total) + 1 })); }
  leader() { const t = this.totals(); const m = Math.max(...t); const idx = t.indexOf(m); return t.filter((x) => x === m).length > 1 && m === 0 ? -1 : idx; }
  startTurn() { this.dice = this.dice.map(() => 0); this.held = this.held.map(() => false); this.rollsLeft = this.maxRolls; this.rolled = false; this.emit('turnstart', this.turn); }
  /** Generate results for the unheld dice and return the new array (fair RNG). */
  roll(heldMask = this.held) {
    if (this.rollsLeft <= 0) throw new Error('no rolls left');
    this.held = heldMask.slice(); this.dice = this.dice.map((v, i) => (this.held[i] && v ? v : randInt(1, 6))); this.rollsLeft--; this.rolled = true; this.emit('rolled', this.dice.slice()); return this.dice.slice();
  }
  toggleHold(i) { if (!this.rolled || this.rollsLeft <= 0) return false; this.held[i] = !this.held[i]; return this.held[i]; }
  legal() { return new Set(legalCats(this.current.card, this.dice)); }
  preview() { const pts = {}; for (const c of CATS) if (this.current.card.scores[c] === null) pts[c] = scoreFor(this.current.card, c, this.dice); return pts; }
  score(cat) {
    const prevLead = this.leader(); const res = applyScore(this.current.card, cat, this.dice); res.player = this.turn; this.emit('scored', res);
    const lead = this.leader(); res.tookLead = lead === this.turn && prevLead !== this.turn && Math.max(...this.totals()) > 0; res.lostLeadFrom = prevLead !== lead && prevLead >= 0 ? prevLead : -1;
    return res;
  }
  /** Advance to next player. Returns false when the game is over. */
  advance() {
    if (this.players.every((p) => isComplete(p.card))) { this.over = true; this.emit('over'); return false; }
    this.turn = (this.turn + 1) % this.players.length; if (this.turn === 0) this.round++; return true;
  }
}
