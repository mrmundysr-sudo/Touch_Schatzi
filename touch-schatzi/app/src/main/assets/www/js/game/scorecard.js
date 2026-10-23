// Score card (art-driven overlay) + slide-up sheet.
import { Assets } from '../lib/assets.js';
import { Emitter, h, clamp, sleep } from '../lib/util.js';
import { CATS, UPPER, CFG, upperSum, upperTotal, lowerTotal, grandTotal } from './rules.js';
import { avatar, charDef } from './characters.js';
import { makeRing, sparkles } from './fx.js';

const pct = (v, t) => (v / t * 100) + '%';

export async function tween(el, from, to, ms = 600, fmt = (v) => Math.round(v)) {
  if (from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  await new Promise((res) => { const f = (t) => { const u = clamp((t - t0) / ms, 0, 1); const e = 1 - Math.pow(1 - u, 3); el.textContent = fmt(from + (to - from) * e); u < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
}

export class ScoreCard extends Emitter {
  constructor(layout, player, { crop = false } = {}) {
    super(); this.L = layout; this.player = player; const [W, H] = layout.size; this.W = W; this.H = H;
    const [cx, cy, cw, ch] = crop ? layout.crop.landscape : [0, 0, W, H]; this.crop = [cx, cy, cw, ch];
    this.img = h('img.sc-art', { alt: '', draggable: 'false', style: { width: pct(W, cw), left: pct(-cx, cw), top: pct(-cy, ch) } }); this.img.src = Assets.url('ui.scorecard');
    this.el = h('div.scorecard', { style: { aspectRatio: `${cw} / ${ch}` } }, this.img);
    this.cells = {}; this.rowEls = {}; this.potential = null; this.selected = null; this.legal = null;
    const place = (box, extra = '') => { const [x, y, w, hh] = box; return { left: pct(x - cx, cw), top: pct(y - cy, ch), width: pct(w, cw), height: pct(hh, ch) }; };
    for (const c of CATS) {
      const row = h('div.sc-row', { 'data-cat': c, style: place(layout.rows[c]), onpointerdown: (e) => this._rowTap(c, e) }); this.el.append(row); this.rowEls[c] = row;
      const cell = h('div.sc-cell', { style: place(layout.boxes[c]) }, h('span')); this.el.append(cell); this.cells[c] = cell;
    }
    for (const k of ['upperTotal', 'lowerTotal', 'total']) { const cell = h('div.sc-cell.sc-tot.' + k, { style: place(layout.boxes[k]) }, h('span')); this.el.append(cell); this.cells[k] = cell; }
    this.badge = h('div.sc-badge', { style: place([layout.boxes.upperTotal[0] + 70, layout.boxes.upperTotal[1] - 34, 90, 40]) }, '+35'); this.el.append(this.badge);
    this.noteU = h('div.sc-note', { style: place(layout.notes.upper) }); this.noteL = h('div.sc-note', { style: place(layout.notes.lower) }); this.el.append(this.noteU, this.noteL);
    this.ring = makeRing('rect'); this.ring.style.display = 'none'; this.el.append(this.ring);
    this.shown = { upperTotal: 0, lowerTotal: 0, total: 0 };
    this._ro = new ResizeObserver(() => { const w = this.el.clientWidth; this.el.style.fontSize = (w * (this.W / cw) * 0.0505) + 'px'; }); this._ro.observe(this.el);
  }
  setActive(on) { this.ring.style.display = on ? '' : 'none'; }
  /** Render values from a rules card. animate=false jumps instantly. */
  render(card, { animate = false } = {}) {
    for (const c of CATS) {
      const v = card.scores[c], cell = this.cells[c], s = cell.firstChild;
      cell.classList.toggle('filled', v !== null); cell.classList.toggle('zero', v === 0); cell.classList.remove('potential', 'selected', 'dim');
      s.textContent = v === null ? '' : v; this.rowEls[c].classList.remove('hot', 'sel', 'dim');
    }
    const ut = upperTotal(card), lt = lowerTotal(card), gt = grandTotal(card);
    const filledAny = CATS.some((c) => card.scores[c] !== null);
    const set = (k, v) => { const s = this.cells[k].firstChild; if (animate) { tween(s, this.shown[k], v, 700); } else s.textContent = filledAny || v ? v : ''; this.shown[k] = v; };
    set('upperTotal', ut); set('lowerTotal', lt); set('total', gt);
    const up = upperSum(card), got = up >= CFG.upperThreshold; this.badge.classList.toggle('on', got);
    this.noteU.textContent = got ? 'BONUS +35 ★' : `bonus at ${CFG.upperThreshold}: ${up}/${CFG.upperThreshold}`; this.noteU.classList.toggle('got', got);
    this.noteL.textContent = card.bonusCount ? `Schatzi bonus ×${card.bonusCount}  +${card.bonusCount * CFG.schatziBonus}` : ''; this.noteL.classList.toggle('got', !!card.bonusCount);
    this.card = card;
  }
  /** Show tappable potentials. legal: Set of cats allowed; pts: {cat:points} */
  showChoices(pts, legal) {
    this.potential = pts; this.legal = legal; this.selected = null;
    for (const c of CATS) {
      const open = this.card.scores[c] === null, ok = open && legal.has(c); const cell = this.cells[c];
      if (open) { cell.firstChild.textContent = ok ? pts[c] : ''; cell.classList.toggle('potential', ok); cell.classList.toggle('dim', !ok); this.rowEls[c].classList.toggle('hot', ok); this.rowEls[c].classList.toggle('dim', !ok); }
    }
  }
  clearChoices() { this.potential = null; this.legal = null; this.selected = null; if (this.card) this.render(this.card); }
  select(c) {
    if (this.selected) { this.cells[this.selected].classList.remove('selected'); this.rowEls[this.selected].classList.remove('sel'); }
    this.selected = c; if (c) { this.cells[c].classList.add('selected'); this.rowEls[c].classList.add('sel'); }
  }
  _rowTap(c, e) {
    if (!this.potential || !this.legal || !this.legal.has(c)) { if (this.potential && this.card.scores[c] === null) this.emit('illegal', c); return; }
    e.stopPropagation(); this.emit('tap', c);
  }
  /** Pop animation when a score lands. */
  async land(cat, pts, big = false) {
    const cell = this.cells[cat]; cell.firstChild.textContent = pts; cell.classList.remove('potential', 'selected', 'dim'); cell.classList.add('filled'); cell.classList.toggle('zero', pts === 0);
    cell.animate([{ transform: 'scale(2.1)', filter: 'brightness(2.2)' }, { transform: 'scale(.92)', offset: 0.55 }, { transform: 'scale(1)', filter: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1)' });
    const r = cell.getBoundingClientRect(), host = this.el.closest('.sheet') || this.el; const hr = host.getBoundingClientRect();
    if (pts > 0) sparkles(host, r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2, big ? 14 : 7, big ? 90 : 50);
  }
  destroy() { this._ro.disconnect(); this.el.remove(); }
}

/** The pull-up sheet that holds one or two score cards (portrait: one, landscape: you + an opponent). */
export class ScoreSheet extends Emitter {
  constructor(host, layout, game) {
    super(); this.host = host; this.L = layout; this.game = game; this.isOpen = false; this.focus = 0; this.cards = {}; this.choose = null; this.orient = 'portrait'; this.dragY = 0;
    this.grab = h('div.sheet-grab', h('div.grab-bar'), h('div.grab-text', 'SCORE CARD'));
    this.tabs = h('div.sheet-tabs'); this.cardsEl = h('div.sheet-cards'); this.footer = h('div.sheet-footer');
    this.confirm = h('button.btn.gold.confirm', { onclick: () => this._confirm() }, 'SCORE');
    this.hint = h('div.sheet-hint');
    this.footer.append(this.hint, this.confirm);
    this.root = h('div.sheet', { 'data-asset-bg': 'bg.scorecard' }, this.grab, this.tabs, this.cardsEl, this.footer); host.appendChild(this.root); Assets.bind(this.root);
    this.root.style.transform = 'translateY(105%)'; this.root.style.visibility = 'hidden';
    this._gestures(); this.rebuild();
  }
  get landscape() { return window.innerWidth > window.innerHeight; }
  rebuild() {
    this.orient = this.landscape ? 'landscape' : 'portrait'; this.cardsEl.textContent = ''; this.tabs.textContent = ''; this.cards = {};
    const ps = this.game.players;
    ps.forEach((p, i) => {
      const card = new ScoreCard(this.L, p, { crop: this.landscape }); card.render(p.card); card.on('tap', (c) => this._tap(c)); card.on('illegal', () => this.emit('illegal'));
      const wrap = h('div.card-wrap', { 'data-i': i }, h('div.card-head', avatar(p.charId), h('span.ch-name', p.name), h('span.ch-score', String(grandTotal(p.card)))), card.el); this.cards[i] = { card, wrap };
      const tab = h('button.tab', { 'data-i': i, onclick: () => { this.emit('click'); this.setFocus(i); } }, avatar(p.charId), h('span.t-name', p.name), h('span.t-score', String(grandTotal(p.card)))); this.tabs.append(tab);
    });
    this._layoutCards(); this._size();
    if (this.choose) this._applyChoose();
  }
  _visible() { const n = this.game.players.length; if (!this.landscape || n === 1) return [this.focus]; const me = this.game.players.findIndex((p) => p.human); const other = this.focus === me ? (me === 0 ? 1 : 0) : this.focus; return [me, other]; }
  _layoutCards() {
    const vis = this._visible(); this.cardsEl.textContent = ''; vis.forEach((i) => this.cardsEl.append(this.cards[i].wrap));
    this.tabs.querySelectorAll('.tab').forEach((t) => { const i = +t.dataset.i; t.classList.toggle('on', vis.includes(i)); t.classList.toggle('turn', this.game.turn === i && !this.game.over); });
    this.tabs.style.display = this.game.players.length > 1 ? '' : 'none';
    this.cardsEl.classList.toggle('two', vis.length > 1);
  }
  _size() {
    const vw = window.innerWidth, vh = window.innerHeight, safeT = 18; const n = this._visible().length; const [W, H] = this.L.size;
    const multi = this.game.players.length > 1; const availH = this.landscape ? vh - safeT - 22 - 40 - 22 : vh - safeT - 22 - (multi ? 52 : 0) - 58 - 34; const tabsW = this.landscape && multi ? 124 : 0;
    const cw = this.landscape ? this.L.crop.landscape[2] : W, ch = this.landscape ? this.L.crop.landscape[3] : H;
    const maxByH = availH / ch * cw, maxByW = (vw - 16 - tabsW - (n - 1) * 12) / n; const w = Math.max(120, Math.min(maxByH, maxByW, this.landscape ? 440 : 520));
    this.cardsEl.style.setProperty('--card-w', w + 'px'); this.root.style.setProperty('--sheet-h', this.landscape ? (vh - safeT) + 'px' : Math.min(vh - safeT, (w / cw * ch) + 22 + (multi ? 52 : 0) + 58 + 34 + 24) + 'px');
  }
  setFocus(i) { this.focus = i; this._layoutCards(); this._size(); this.emit('focus', i); }
  /** Refresh totals/values for all cards. */
  refresh({ animate = false } = {}) {
    this.game.players.forEach((p, i) => { this.cards[i].card.render(p.card, { animate }); this.cards[i].wrap.querySelector('.ch-score').textContent = grandTotal(p.card); this.tabs.children[i].querySelector('.t-score').textContent = grandTotal(p.card); });
    this._layoutCards(); if (this.choose) this._applyChoose();
  }
  /** Human can pick: dice results already in game. */
  setChoices(pts, legal) { this.choose = { pts, legal }; this._applyChoose(); this._updateFooter(); }
  clearChoices() { this.choose = null; Object.values(this.cards).forEach(({ card }) => card.clearChoices()); this._updateFooter(); }
  _applyChoose() { const me = this.game.players.findIndex((p) => p.human); if (me < 0) return; this.cards[me].card.render(this.game.players[me].card); this.cards[me].card.showChoices(this.choose.pts, this.choose.legal); if (!this._visible().includes(me) && this.isOpen) this.setFocus(me); }
  _tap(c) {
    const me = this.game.players.findIndex((p) => p.human), card = this.cards[me].card;
    if (card.selected === c) { this._confirm(); return; }
    card.select(c); this.emit('select', c); this._updateFooter();
  }
  _updateFooter() {
    const me = this.game.players.findIndex((p) => p.human), sel = me >= 0 && this.choose ? this.cards[me].card.selected : null;
    this.confirm.classList.toggle('show', !!sel); this.hint.classList.toggle('hide', !!sel);
    if (sel) this.confirm.innerHTML = `SCORE <b>${this.choose.pts[sel]}</b> <small>in ${this._label(sel)}</small> ✓`;
    this.hint.textContent = this.choose ? 'Tap a box to choose where to score' : 'Swipe down to close';
  }
  _label(c) { return { ones: 'Aces', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes', threeKind: '3 of a Kind', fourKind: '4 of a Kind', fullHouse: 'Full House', smallStraight: 'Sm. Straight', largeStraight: 'Lg. Straight', schatzi: 'Schatzi', chance: 'Chance' }[c]; }
  _confirm() { const me = this.game.players.findIndex((p) => p.human), sel = this.cards[me]?.card.selected; if (sel && this.choose) this.emit('pick', sel); }
  open() { if (this.isOpen) return; this.isOpen = true; if (this.orient !== (this.landscape ? 'landscape' : 'portrait')) this.rebuild(); this._size(); this.root.style.visibility = ''; this.root.style.transition = 'transform .42s cubic-bezier(.2,.9,.25,1)'; this.root.style.transform = 'translateY(0)'; this.root.classList.add('open'); this.emit('open'); }
  close() { if (!this.isOpen) return; this.isOpen = false; this.root.style.transition = 'transform .34s cubic-bezier(.5,0,.8,.4)'; this.root.style.transform = 'translateY(105%)'; this.root.classList.remove('open'); this.emit('close'); setTimeout(() => { if (!this.isOpen) this.root.style.visibility = 'hidden'; }, 360); }
  toggle() { this.isOpen ? this.close() : this.open(); }
  _gestures() {
    let g = null; const r = this.root;
    r.addEventListener('pointerdown', (e) => { if (!this.isOpen || e.target.closest('button')) return; g = { x: e.clientX, y: e.clientY, t: performance.now(), drag: false, id: e.pointerId }; });
    r.addEventListener('pointermove', (e) => {
      if (!g) return; const dy = e.clientY - g.y, dx = e.clientX - g.x;
      if (!g.drag && dy > 10 && dy > Math.abs(dx) * 1.2) { g.drag = true; r.setPointerCapture(g.id); r.style.transition = 'none'; }
      if (g.drag) { this.dragY = Math.max(0, dy); r.style.transform = `translateY(${this.dragY}px)`; }
    });
    const end = (e) => { if (!g) return; const d = g; g = null; if (!d.drag) return; const v = this.dragY / Math.max(1, performance.now() - d.t); if (this.dragY > 90 || v > 0.6) this.close(); else { r.style.transition = 'transform .25s ease-out'; r.style.transform = 'translateY(0)'; } this.dragY = 0; };
    r.addEventListener('pointerup', end); r.addEventListener('pointercancel', end);
    this.grab.addEventListener('click', () => this.close());
  }
}
void sleep; void charDef; void UPPER;
