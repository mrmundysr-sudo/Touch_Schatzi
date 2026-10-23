// Pure scoring rules for Schatzi (classic five-dice scoring with Joker + bonus rules). No DOM, no randomness.
export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'schatzi', 'chance'];
export const CATS = [...UPPER, ...LOWER];
export const CAT_LABEL = { ones: 'Aces', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes', threeKind: '3 of a Kind', fourKind: '4 of a Kind', fullHouse: 'Full House', smallStraight: 'Small Straight', largeStraight: 'Large Straight', schatzi: 'Schatzi', chance: 'Chance' };
export const CAT_SHORT = { ones: 'Aces', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes', threeKind: '3 Kind', fourKind: '4 Kind', fullHouse: 'Full House', smallStraight: 'Sm. Straight', largeStraight: 'Lg. Straight', schatzi: 'Schatzi', chance: 'Chance' };
export const FACE = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
export const CFG = { upperThreshold: 63, upperBonus: 35, schatziBonus: 100 };

const sum = (d) => d.reduce((a, b) => a + b, 0);
export function counts(d) { const c = [0, 0, 0, 0, 0, 0, 0]; d.forEach((v) => c[v]++); return c; }
export const isSchatzi = (d) => d.length === 5 && d.every((v) => v === d[0]);
const hasRun = (c, len) => { let run = 0; for (let v = 1; v <= 6; v++) { run = c[v] ? run + 1 : 0; if (run >= len) return true; } return false; };

/** Raw points for a category (ignoring Joker context). */
export function rawScore(cat, d) {
  const c = counts(d);
  if (FACE[cat]) return c[FACE[cat]] * FACE[cat];
  switch (cat) {
    case 'threeKind': return c.some((n) => n >= 3) ? sum(d) : 0;
    case 'fourKind': return c.some((n) => n >= 4) ? sum(d) : 0;
    case 'fullHouse': return c.includes(3) && c.includes(2) ? 25 : 0;
    case 'smallStraight': return hasRun(c, 4) ? 30 : 0;
    case 'largeStraight': return hasRun(c, 5) ? 40 : 0;
    case 'schatzi': return isSchatzi(d) ? 50 : 0;
    case 'chance': return sum(d);
    default: return 0;
  }
}

export const newCard = () => ({ scores: Object.fromEntries(CATS.map((c) => [c, null])), bonusCount: 0 });
export const isOpen = (card, cat) => card.scores[cat] === null;
export const openCats = (card) => CATS.filter((c) => isOpen(card, c));
export const upperSum = (card) => UPPER.reduce((a, c) => a + (card.scores[c] || 0), 0);
export const upperBonus = (card) => (upperSum(card) >= CFG.upperThreshold ? CFG.upperBonus : 0);
export const upperTotal = (card) => upperSum(card) + upperBonus(card);
export const lowerSum = (card) => LOWER.reduce((a, c) => a + (card.scores[c] || 0), 0);
export const lowerTotal = (card) => lowerSum(card) + card.bonusCount * CFG.schatziBonus;
export const grandTotal = (card) => upperTotal(card) + lowerTotal(card);
export const isComplete = (card) => CATS.every((c) => card.scores[c] !== null);

/** Is the Joker rule in force for these dice? */
export const jokerActive = (card, d) => isSchatzi(d) && card.scores.schatzi !== null;

/** Categories the player may legally pick for these dice (Joker rule enforced). */
export function legalCats(card, d) {
  const open = openCats(card);
  if (!jokerActive(card, d)) return open;
  const upperBox = UPPER[d[0] - 1];
  if (isOpen(card, upperBox)) return [upperBox];
  const lower = open.filter((c) => LOWER.includes(c));
  return lower.length ? lower : open; // all lower full -> any open upper box (scores 0)
}

/** Points the category would score right now (Joker values applied). */
export function scoreFor(card, cat, d) {
  if (jokerActive(card, d)) {
    if (cat === 'fullHouse') return 25; if (cat === 'smallStraight') return 30; if (cat === 'largeStraight') return 40;
  }
  return rawScore(cat, d);
}

/** Apply a score; returns details for UI. Throws on illegal moves. */
export function applyScore(card, cat, d) {
  if (!legalCats(card, d).includes(cat)) throw new Error('illegal category ' + cat);
  const bonusBefore = upperBonus(card);
  const joker = jokerActive(card, d);
  const bonusSchatzi = joker && card.scores.schatzi === 50;
  const pts = scoreFor(card, cat, d);
  card.scores[cat] = pts; if (bonusSchatzi) card.bonusCount++;
  return { cat, pts, joker, schatziBonus: bonusSchatzi ? CFG.schatziBonus : 0, gotUpperBonus: bonusBefore === 0 && upperBonus(card) > 0, schatzi: isSchatzi(d) };
}

/** Quality tier of a scoring result for reactions/sounds: 'zero' | 'low' | 'ok' | 'good' | 'great' | 'schatzi'. */
export function tier(res) {
  if (res.schatzi && res.pts >= 50) return 'schatzi';
  if (res.pts === 0) return 'zero';
  if (['largeStraight', 'fullHouse', 'smallStraight'].includes(res.cat) && res.pts >= 25) return res.cat === 'largeStraight' ? 'great' : 'good';
  if (FACE[res.cat]) return res.pts >= FACE[res.cat] * 4 ? 'great' : res.pts >= FACE[res.cat] * 3 ? 'good' : res.pts >= FACE[res.cat] * 2 ? 'ok' : 'low';
  if (res.cat === 'fourKind' && res.pts >= 20) return 'great';
  if (res.pts >= 22) return 'good'; if (res.pts >= 15) return 'ok'; return 'low';
}
