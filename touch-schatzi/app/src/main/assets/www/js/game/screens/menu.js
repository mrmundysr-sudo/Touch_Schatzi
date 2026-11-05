import { Assets } from '../../lib/assets.js';
import { h, store } from '../../lib/util.js';
import { Characters, charDef, avatar } from '../characters.js';
import { sparkles } from '../fx.js';

const DIFFS = [['easy', 'EASY', 1], ['medium', 'MEDIUM', 2], ['hard', 'HARD', 3]];
const paw = '<svg viewBox="0 0 24 24"><ellipse cx="6" cy="9" rx="2.2" ry="2.8"/><ellipse cx="11" cy="5.5" rx="2.2" ry="2.8"/><ellipse cx="17" cy="6.5" rx="2.2" ry="2.8"/><ellipse cx="21" cy="11" rx="2" ry="2.6"/><path d="M12 11c-3.6 0-6.5 3.2-6.5 6 0 2 1.6 3 3.4 3 1.4 0 2-.7 3.1-.7s1.7.7 3.1.7c1.8 0 3.4-1 3.4-3 0-2.8-2.9-6-6.5-6z"/></svg>';

export class MenuScreen {
  constructor(app) { this.app = app; }
  mount(host) {
    const A = this.app.audio, S = this.app.settings; this.sel = new Set((S.opponents || Characters.order).filter((c) => charDef(c)));
    const title = h('div.title', h('div.t-top', h('i', { html: paw }), 'Touch', h('i', { html: paw })), h('div.t-main', 'Schatzi'), h('div.t-sub', 'THE GAME'));
    this.cards = Characters.order.map((cid) => { const d = charDef(cid); const b = h('button.opp', { 'data-c': cid, style: { '--c': d.color }, onclick: () => this.toggleOpp(cid, b) }, avatar(cid), h('span.o-name', d.name), h('span.o-check', '✓')); b.classList.toggle('on', this.sel.has(cid)); return b; });
    this.count = h('div.count');
    const diff = h('div.seg', DIFFS.map(([k, label, n]) => h('button.seg-b' + (S.difficulty === k ? '.on' : ''), { 'data-k': k, onclick: (e) => { this.setDiff(k); } }, h('span.stars', '★'.repeat(n) + '☆'.repeat(3 - n)), label)));
    this.diffEl = diff;
    const nameIn = h('input.name-in', { type: 'text', maxlength: '12', placeholder: 'You', value: S.name || '', autocomplete: 'off', autocapitalize: 'words', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': 'Your name', oninput: (e) => this.app.setSetting('name', e.target.value), onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); } });
    const tg = (key, label, def = true) => { const on = S[key] === undefined ? def : S[key]; const b = h('button.tgl' + (on ? '.on' : ''), { onclick: () => { const v = !b.classList.contains('on'); b.classList.toggle('on', v); this.app.setSetting(key, v); A.play('click'); } }, h('span.knob'), h('span.lbl', label)); return b; };
    this.play = h('button.btn.gold.play', { onclick: () => this.start() }, h('span', 'PLAY'));
    const how = h('button.btn.purple.small', { onclick: () => { A.play('click'); this.howTo(); } }, '? HOW TO PLAY');
    this.best = h('div.best', S.best ? `Best score: ${S.best}` : '');
    const left = h('div.m-left', title, h('div.m-cta', this.play, how, this.best));
    const right = h('div.m-right', h('section.panel', h('h3', 'OPPONENTS'), h('div.opps', this.cards), this.count),
      h('section.panel', h('h3', 'DIFFICULTY'), diff), h('section.panel.two', h('div', h('h3', 'YOUR NAME'), nameIn), h('div', h('h3', 'OPTIONS'), h('div.tgls', tg('music', 'Music'), tg('sfx', 'Sound FX'), tg('trash', 'Trash talk'), tg('hints', 'Hints', false)))));
    this.root = h('div.screen.menu', h('div.menu-bg', { 'data-asset-bg': 'bg.menu' }), h('div.menu-vignette'), h('div.menu-body', left, right));
    host.append(this.root); Assets.bind(this.root); this.updateCount(); this.app.audio.playMusic('menu');
    requestAnimationFrame(() => this.root.classList.add('in'));
  }
  toggleOpp(cid, b) {
    const on = !this.sel.has(cid); if (on) this.sel.add(cid); else this.sel.delete(cid); b.classList.toggle('on', on); this.app.audio.play(on ? 'select' : 'unhold'); this.app.setSetting('opponents', [...this.sel]); this.updateCount();
    if (on) { const r = b.getBoundingClientRect(), hr = this.root.getBoundingClientRect(); sparkles(this.root, r.left - hr.left + r.width / 2, r.top - hr.top + 30, 6, 40); }
  }
  updateCount() { const n = this.sel.size; this.count.textContent = n === 0 ? 'Solo practice — beat your best score' : `You + ${n} opponent${n > 1 ? 's' : ''} = ${n + 1} players`; }
  setDiff(k) { this.app.audio.play('click'); this.app.setSetting('difficulty', k); this.diffEl.querySelectorAll('.seg-b').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); }
  start() {
    this.app.audio.unlock(); this.app.audio.play('scoreBig'); this.app.audio.duck(0.4, 1);
    const opponents = Characters.order.filter((c) => this.sel.has(c)); this.app.setSetting('opponents', opponents);
    this.root.classList.add('out'); setTimeout(() => this.app.startGame({ opponents, difficulty: this.app.settings.difficulty || 'medium' }), 320);
  }
  howTo() {
    const rows = [['Aces – Sixes', 'Add up only that number'], ['3 of a Kind', 'Total of all dice'], ['4 of a Kind', 'Total of all dice'], ['Full House', '25'], ['Small Straight', '30 (4 in a row)'], ['Large Straight', '40 (5 in a row)'], ['Schatzi (5 of a kind)', '50'], ['Chance', 'Total of all dice']];
    const el = h('div.overlay.show.howto', { onclick: (e) => { if (e.target === el) el.remove(); } }, h('div.panel.wide', h('h2', 'HOW TO PLAY'),
      h('ol', h('li', 'Pull the lever to spin the five reels — they are your dice.'), h('li', 'Tap reels to ', h('b', 'HOLD'), ' them, then spin the rest. You get 3 spins per turn.'), h('li', 'Pick a box on your score card (swipe up the card). Each box is used once — 13 turns.'), h('li', 'Score 63+ in the top section for a ', h('b', '+35 bonus'), '. Extra Schatzis are worth ', h('b', '+100'), ' each!')),
      h('table', rows.map(([a, b]) => h('tr', h('td', a), h('td', b)))), h('button.btn.gold', { onclick: () => { this.app.audio.play('click'); el.remove(); } }, 'GOT IT')));
    this.root.append(el);
  }
  destroy() { this.root?.remove(); }
}
