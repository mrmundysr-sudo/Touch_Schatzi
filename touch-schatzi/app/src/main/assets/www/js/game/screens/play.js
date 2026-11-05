// Gameplay screen: scene, seats, slot machine, HUD, turn orchestration.
import { Assets } from '../../lib/assets.js';
import { SlotMachine } from '../../lib/slotmachine/SlotMachine.js';
import { Haptics } from '../../lib/haptics.js';
import { h, sleep, clamp, rand, pick, store } from '../../lib/util.js';
import { Game } from '../Game.js';
import { CAT_LABEL, tier, isSchatzi, counts, grandTotal } from '../rules.js';
import { decideHold, decideCategory, hintFor, bestCategory } from '../ai.js';
import { ScoreSheet, tween } from '../scorecard.js';
import { CharacterSprite, avatar, charDef } from '../characters.js';
import { TrashTalk } from '../trashtalk.js';
import { Particles, floatText, makeRing, sparkles } from '../fx.js';
import { SceneFrame } from '../scene.js';

class Aborted extends Error {}
const ICON = {
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.5" height="14" rx="1.5"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5"/></svg>',
  ff: '<svg viewBox="0 0 24 24"><path d="M4 5l8 7-8 7zM12 5l8 7-8 7z"/></svg>',
  card: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  crown: '<svg viewBox="0 0 24 16"><path d="M2 14L1 3l6 5 5-7 5 7 6-5-1 11z" fill="#ffd24a" stroke="#8a5a00" stroke-width="1.2" stroke-linejoin="round"/></svg>',
};

export class PlayScreen {
  constructor(app, setup) {
    this.app = app; this.setup = setup; this.A = app.audio; this.dead = false; this.paused = false; this.fast = !!app.settings.fast; this.busy = false; this.seats = {}; this.timers = new Set();
    const settings = app.settings;
    const players = [{ id: 'me', name: (settings.name || 'You').trim().slice(0, 12) || 'You', charId: null, human: true }];
    setup.opponents.forEach((cid) => players.push({ id: cid, name: charDef(cid).name, charId: cid, human: false }));
    this.game = new Game(players, { rounds: app.cfg.rounds, rolls: app.cfg.rollsPerTurn });
    this.diff = app.cfg.difficulty[setup.difficulty] || app.cfg.difficulty.medium;
    this.frame = new SceneFrame(app.layout);
  }

  // ======================================================= build / layout
  mount(host) {
    const g = this.game, A = this.A; this.host = host;
    this.root = h('div.screen.play');
    this.bg = h('div.scene-bg'); this.scene = h('div.scene'); this.fxLayer = h('div.fx-layer'); this.bubbles = h('div.bubbles');
    this.root.append(this.bg, this.scene, this.fxLayer, this.bubbles);
    // seats
    this.game.players.filter((p) => !p.human).forEach((p, n) => {
      const sprite = new CharacterSprite(p.charId, { audio: A });
      const ring = makeRing('oval'); ring.style.display = 'none';
      const miniHost = h('div.mini'); const tag = h('div.seat-tag', { style: { '--c': charDef(p.charId).color } }, p.name);
      const seat = h('div.seat', { 'data-char': p.charId }, ring, sprite.root, miniHost, tag); this.scene.append(seat);
      const mini = new SlotMachine(miniHost, { art: { machine: Assets.url('ui.slotMachine'), lever: Assets.url('ui.slotLever') }, mini: true, interactive: false });
      mini.lever?.classList.add('off'); mini.setValues([...Array(5)].map(() => 1 + Math.floor(Math.random() * 6))); mini.setDim(true);
      this._wireMachine(mini, true);
      this.seats[g.players.indexOf(p)] = { p, el: seat, sprite, ring, mini, miniHost, tag, n };
    });
    // player machine
    this.zone = h('div.player-zone'); this.pring = makeRing('rect'); this.pring.style.display = 'none'; this.mHost = h('div.machine'); this.zone.append(this.pring, this.mHost); this.scene.append(this.zone);
    this.machine = new SlotMachine(this.mHost, { art: { machine: Assets.url('ui.slotMachine'), lever: Assets.url('ui.slotLever') }, interactive: true });
    this.machine.setValues([1, 4, 6, 3, 5]); this._wireMachine(this.machine, false);
    this.machine.on('reeltap', (i) => this.onReelTap(i)); this.machine.on('pull', () => this.requestSpin(true));
    this.mHost.addEventListener('pointerdown', () => { if (this.busy) this.machine.hurry(); });
    // HUD
    this.pauseBtn = h('button.hud-btn', { html: ICON.pause, onclick: () => { this.A.play('click'); this.pause(true); } });
    this.roundPill = h('div.round-pill', h('small', 'ROUND'), h('b', '1'), h('span', ` / ${g.rounds}`));
    this.ffBtn = h('button.hud-btn.ff', { html: ICON.ff, onclick: () => { this.fast = !this.fast; this.ffBtn.classList.toggle('on', this.fast); this.A.play('click'); } });
    this.ffBtn.classList.toggle('on', this.fast);
    this.chips = h('div.chips'); this.chipEls = g.players.map((p, i) => { const c = h('div.chip', avatar(p.charId), h('div.c-info', h('div.c-name', p.name), h('div.c-score', '0')), h('div.c-crown', { html: ICON.crown })); c.append(makeRing('rect')); this.chips.append(c); return c; });
    this.hud = h('div.hud', h('div.hud-top', this.pauseBtn, this.roundPill, this.chips, this.ffBtn));
    this.banner = h('div.banner'); this.hint = h('div.turn-hint');
    // controls
    this.pips = h('div.pips', h('small', 'ROLLS'), h('div.pip-row', [0, 1, 2].map(() => h('i.pip.on'))));
    this.spinBtn = h('button.btn.spin', { onclick: () => this.requestSpin(false) }, h('span.sp-main', 'SPIN'), h('span.sp-sub', ''));
    this.cardBtn = h('button.btn.cardbtn', { onclick: () => { this.A.play('click'); this.sheet.toggle(); } }, h('span.ic', { html: ICON.card }), h('span.lb', 'SCORE CARD'), h('span.up', { html: ICON.up }));
    this.controls = h('div.controls', this.pips, this.spinBtn, this.cardBtn);
    this.root.append(this.hud, this.banner, this.hint, this.controls);
    // sheet
    this.sheet = new ScoreSheet(this.root, this.app.cardLayout, g);
    this.sheet.on('pick', (c) => this.onPick(c)); this.sheet.on('click', () => this.A.play('click')); this.sheet.on('illegal', () => { this.A.play('nope'); Haptics.pulse(30); });
    this.sheet.on('select', () => { this.A.play('select'); Haptics.tap(); }); this.sheet.on('open', () => { this.A.play('sheetUp'); Haptics.tap(); this.root.classList.add('sheet-open'); }); this.sheet.on('close', () => { this.A.play('sheetDown'); this.root.classList.remove('sheet-open'); });
    this._edgeSwipe();
    this.particles = new Particles(this.root);
    // trash talk
    this.talk = new TrashTalk(this.bubbles, A); this.talk.data = this.app.trashData; this.talk.setEnabled(this.app.settings.trash !== false); this.talk.freq = { low: 0.5, normal: 1, high: 1.6 }[this.app.settings.chatty || 'normal'];
    this.talk.anchor = (cid) => { const s = Object.values(this.seats).find((x) => x.p.charId === cid); if (!s) return null; const r = s.sprite.root.getBoundingClientRect(), hr = this.bubbles.getBoundingClientRect(); return { x: r.left - hr.left + r.width / 2, y: r.top - hr.top + r.height * 0.06 }; };
    this.pause = this.pause.bind(this);
    // pause overlay
    this.pauseEl = this._buildPause(); this.root.append(this.pauseEl);
    host.append(this.root); this.layout(); this._onResize = () => this.layout(); addEventListener('resize', this._onResize);
    this.refreshHud(true); Assets.bind(this.root, this.frame.orient);
    this.app.onBack = () => { if (this.sheet.isOpen) { this.sheet.close(); return true; } this.pause(!this.paused); return true; };
  }
  _wireMachine(m, mini) {
    const A = this.A; let lastTick = 0;
    m.on('tick', (i, sp) => { if (mini) return; const now = performance.now(); if (now - lastTick > 42) { lastTick = now; A.play('tick', { pitch: 0.75 + Math.min(sp, 18) / 36, vol2: Math.min(1, sp / 12), minGap: 0 }); } });
    m.on('stop', (i) => { A.play('reelStop', { index: i, soft: mini, vol: mini ? 0.55 : 1 }); if (!mini) Haptics.thud(); });
    m.on('anticipate', () => { if (!mini) { A.play('anticipation'); Haptics.pulse([20, 30, 20, 30, 20]); this.root.classList.add('tense'); } });
    m.on('hold', (i, on) => { A.play(on ? 'hold' : 'unhold', { vol: mini ? 0.5 : 1 }); });
  }
  _buildPause() {
    const s = this.app.settings;
    const tog = (key, label, on, fn) => { const b = h('button.tgl' + (on ? '.on' : ''), { onclick: () => { const v = !b.classList.contains('on'); b.classList.toggle('on', v); fn(v); this.A.play('click'); } }, h('span.knob'), h('span.lbl', label)); return b; };
    const el = h('div.overlay.pause', h('div.panel', h('h2', 'PAUSED'),
      h('button.btn.gold.big', { onclick: () => { this.A.play('click'); this.pause(false); } }, 'RESUME'),
      h('div.tgls', tog('music', 'Music', s.music !== false, (v) => this.app.setSetting('music', v)), tog('sfx', 'Sound FX', s.sfx !== false, (v) => this.app.setSetting('sfx', v)),
        tog('trash', 'Trash talk', s.trash !== false, (v) => { this.app.setSetting('trash', v); this.talk.setEnabled(v); }), tog('hints', 'Hints', !!s.hints, (v) => { this.app.setSetting('hints', v); this.refreshHints(); }),
        tog('fast', 'Fast opponents', !!s.fast, (v) => { this.app.setSetting('fast', v); this.fast = v; this.ffBtn.classList.toggle('on', v); }),
        Haptics.supported() ? tog('haptics', 'Haptics', s.haptics !== false, (v) => { this.app.setSetting('haptics', v); if (v) Haptics.tap(); }) : null),
      h('div.row', h('button.btn.purple', { onclick: () => { this.A.play('click'); this.pause(false); this.restart(); } }, 'RESTART'), h('button.btn.purple', { onclick: () => { this.A.play('click'); this.quit(); } }, 'QUIT TO MENU'))));
    return el;
  }
  layout() {
    const vw = this.root.clientWidth || innerWidth, vh = this.root.clientHeight || innerHeight; const F = this.frame.update(vw, vh), c = F.cfg; const land = F.orient === 'landscape';
    this.root.dataset.orient = F.orient; this.root.style.setProperty('--u', F.u);
    this.bg.style.backgroundImage = `url("${Assets.url('bg.gameplay', F.orient)}")`;
    const opps = Object.values(this.seats); const cfgSeats = c.seats[String(clamp(opps.length, 1, 3))] || [];
    opps.forEach((s, n) => {
      const sc = cfgSeats[n] || cfgSeats[cfgSeats.length - 1]; const cw = F.W(sc.w), chh = cw / s.sprite.A; const cx = F.X(sc.x);
      Object.assign(s.sprite.root.style, { width: cw + 'px', left: cx - cw / 2 + 'px', top: F.Y(c.charBottom) - chh + 'px' });
      s.sprite.root.style.position = 'absolute';
      const mw = F.W(c.miniW), mh = mw * 808 / 1946; Object.assign(s.miniHost.style, { width: mw + 'px', left: cx - mw / 2 + 'px', top: F.Y(c.miniTop) + 'px' });
      Object.assign(s.tag.style, { left: cx + 'px', top: F.Y(c.miniTop) - 4 * F.u + 'px' });
      const rw = cw * 1.04, rh = chh * 1.06; Object.assign(s.ring.style, { width: rw + 'px', height: rh + 'px', left: cx - rw / 2 + 'px', top: F.Y(c.charBottom) - chh - rh * 0.02 + 'px' });
      s.geo = { cx, cw, chh, top: F.Y(c.charBottom) - chh, mh };
    });
    const m = c.machine, mw = F.W(m.w), mh = mw * 808 / 1946, mx = F.X(m.x), my = F.Y(m.top);
    Object.assign(this.mHost.style, { width: mw + 'px', left: mx - mw / 2 + 'px', top: my + 'px' });
    Object.assign(this.pring.style, { width: mw * 1.04 + 'px', height: mh * 0.98 + 'px', left: mx - mw * 0.52 + 'px', top: my + mh * 0.04 + 'px' });
    this.machine.redraw(); Object.values(this.seats).forEach((s) => s.mini.redraw());
    this.bg.style.setProperty('--ty', '0'); Assets.bind(this.root, F.orient);
    if (this.sheet && this.sheet.orient !== (land ? 'landscape' : 'portrait')) { this.sheet.rebuild(); }
    else this.sheet?._size();
  }

  // ======================================================= helpers
  async wait(ms, { fast = true } = {}) {
    let left = ms * (fast && this.fast ? this.app.cfg.pacing.fastMultiplier : 1);
    while (left > 0) { if (this.dead) throw new Aborted(); if (this.paused) { await sleep(120); continue; } const s = Math.min(left, 60); await sleep(s); left -= s; }
    if (this.dead) throw new Aborted();
  }
  async gate() { while (this.paused) { await sleep(100); if (this.dead) throw new Aborted(); } if (this.dead) throw new Aborted(); }
  pause(on) { if (this.dead) return; this.paused = on; this.pauseEl.classList.toggle('show', on); if (on) this.A.duck(0.3, 600); }
  showBanner(text, cls = '') { const b = h('div.banner-in' + (cls ? '.' + cls : ''), text); this.banner.append(b); b.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.2 }, { transform: 'scale(1)', opacity: 1, offset: 0.75 }, { transform: 'scale(1.25) translateY(-30px)', opacity: 0 }], { duration: 1500, easing: 'ease-out' }).onfinish = () => b.remove(); }
  pname() { const n = (this.game.human.name || '').trim(); return !n || n === 'You' ? (this._nick ||= pick(['buddy', 'champ', 'rookie', 'friend'])) : n; }
  get meIdx() { return this.game.players.findIndex((p) => p.human); }
  entityCenter(i) { const hr = this.root.getBoundingClientRect(); if (this.game.players[i].human) { const r = this.mHost.getBoundingClientRect(); return { x: r.left - hr.left + r.width / 2, y: r.top - hr.top + r.height * 0.1 }; } const s = this.seats[i], r = s.sprite.root.getBoundingClientRect(); return { x: r.left - hr.left + r.width / 2, y: r.top - hr.top + r.height * 0.18 }; }
  refreshHud(initial = false) {
    const g = this.game, t = g.totals(); const lead = g.leader();
    this.roundPill.querySelector('b').textContent = Math.min(g.round, g.rounds);
    g.players.forEach((p, i) => { const el = this.chipEls[i]; const sc = el.querySelector('.c-score'); const from = +sc.dataset.v || 0; sc.dataset.v = t[i]; if (initial) sc.textContent = t[i]; else tween(sc, from, t[i], 600); el.classList.toggle('turn', g.turn === i && !g.over); el.classList.toggle('lead', lead === i && g.players.length > 1); el.classList.toggle('you', p.human); });
  }
  setTurnRings() {
    const g = this.game, me = g.current.human;
    this.pring.style.display = me ? '' : 'none'; this.machine.setDim(!me);
    Object.entries(this.seats).forEach(([i, s]) => { const on = +i === g.turn; s.ring.style.display = on ? '' : 'none'; s.mini.setDim(!on); s.el.classList.toggle('active', on); });
    this.root.classList.toggle('my-turn', me); this.root.classList.toggle('opp-turn', !me);
  }
  setPips() { const g = this.game; this.pips.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('on', i < g.rollsLeft)); }
  updateControls() {
    const g = this.game, me = g.current.human, canSpin = me && !this.busy && g.rollsLeft > 0 && !(g.rolled && g.held.every(Boolean)) && !this.awaitingPick;
    this.spinBtn.disabled = !canSpin; this.spinBtn.classList.toggle('ready', canSpin);
    this.spinBtn.querySelector('.sp-main').textContent = !me ? `${g.current.name.toUpperCase()}…` : g.rolled ? (g.rollsLeft > 0 ? 'SPIN AGAIN' : 'CHOOSE') : 'SPIN';
    const unheld = g.held.filter((x) => !x).length; this.spinBtn.querySelector('.sp-sub').textContent = me && g.rolled && g.rollsLeft > 0 ? `${unheld} reel${unheld === 1 ? '' : 's'} · ${g.rollsLeft} left` : '';
    this.machine.setEnabled(me && !this.busy && g.rollsLeft > 0 && !g.held.every(Boolean) || (me && !g.rolled)); this.cardBtn.classList.toggle('pulse', me && g.rolled && !this.busy);
    this.cardBtn.querySelector('.lb').textContent = me && g.rolled ? 'CHOOSE SCORE' : 'SCORE CARD';
  }
  refreshHints() {
    const g = this.game; this.machine.setHints(null); this.sheet.cards[this.meIdx]?.card.el.classList.remove('rec');
    if (!this.app.settings.hints || !g.current.human || !g.rolled || this.busy) return;
    if (g.rollsLeft > 0) { const hnt = hintFor(g.current.card, g.dice, g.rollsLeft); if (!hnt.stop) this.machine.setHints(hnt.mask); }
    const rec = bestCategory(g.current.card, g.dice); this.sheet.cards[this.meIdx]?.card.rowEls[rec]?.classList.add('rec');
  }
  _edgeSwipe() {
    let s = null; const el = this.root;
    el.addEventListener('pointerdown', (e) => { const r = el.getBoundingClientRect(); const land = this.frame.orient === 'landscape'; if (!this.sheet.isOpen && (r.bottom - e.clientY < 70 * this.frame.u) && !e.target.closest('button') && !e.target.closest('.sm-lever')) s = { y: e.clientY, x: e.clientX }; });
    el.addEventListener('pointermove', (e) => { if (!s) return; if (s.y - e.clientY > 36 && Math.abs(e.clientX - s.x) < 80) { s = null; this.sheet.open(); } });
    el.addEventListener('pointerup', () => { s = null; }); el.addEventListener('pointercancel', () => { s = null; });
  }

  // ======================================================= flow
  async start() {
    const g = this.game; this.A.playMusic('game');
    await this.wait(500, { fast: false });
    const ai = Object.values(this.seats); if (ai.length) { const sp = pick(ai); this.talk.say(sp.p.charId, 'gameStart', { p: this.pname() }, { priority: 2, force: true }); }
    this.showBanner('LET\'S PLAY!'); this.A.play('whoosh'); await this.wait(900, { fast: false });
    try { await this.loop(); } catch (e) { if (!(e instanceof Aborted)) { console.error(e); throw e; } }
  }
  async loop() {
    const g = this.game;
    for (;;) {
      await this.gate(); g.startTurn(); await this.beginTurn();
      if (g.current.human) await this.humanTurn(); else await this.aiTurn(g.turn);
      this.A.setMusicIntensity(clamp((g.round - 8) / 5, 0, 1));
      if (!g.advance()) break; this.refreshHud();
    }
    await this.finish();
  }
  async beginTurn() {
    const g = this.game, p = g.current; this.setTurnRings(); this.refreshHud(); this.setPips(); this.machine.clearHolds(); Object.values(this.seats).forEach((s) => s.mini.clearHolds()); this.sheet.clearChoices(); this.awaitingPick = false; this.root.classList.remove('tense');
    this.updateControls();
    if (p.human) {
      this.A.play('myTurn'); Haptics.success(); this.showBanner(g.round >= g.rounds ? 'FINAL TURN!' : 'YOUR TURN', 'mine'); this.hint.textContent = 'Pull the lever or tap SPIN!'; this.hint.classList.add('show');
      if (g.round === g.rounds && this.game.players.length > 1) { const s = pick(Object.values(this.seats)); this.talk.say(s.p.charId, 'lastRound', { p: this.pname() }, { priority: 1 }); }
    } else { this.A.play('turnChime'); this.showBanner(`${p.name.toUpperCase()}'S TURN`, 'theirs'); this.hint.classList.remove('show'); this.seats[g.turn].sprite.nod(); }
    await this.wait(p.human ? 250 : 450, { fast: !p.human });
  }

  // ---------- human
  async humanTurn() {
    const g = this.game; this.turnDone = new Promise((r) => { this.resolveTurn = r; }); this.lastAct = performance.now(); this._nudgeTimer = setInterval(() => this._nudge(), 1500); this.timers.add(this._nudgeTimer);
    this.updateControls();
    await this.turnDone; clearInterval(this._nudgeTimer); this.timers.delete(this._nudgeTimer);
  }
  _nudge() {
    const g = this.game; if (this.paused || this.busy || !g.current.human || this.awaitingPick && this.sheet.isOpen) return; const S = this.app.trashData?.settings?.nudgeAfterMs || 15000;
    if (performance.now() - this.lastAct > S) { this.lastAct = performance.now() - S * 0.35; const ai = Object.values(this.seats); if (ai.length) this.talk.say(pick(ai).p.charId, 'nudge', { p: this.pname() }, { priority: 1, force: true }); (g.rolled ? this.cardBtn : this.spinBtn).animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12) rotate(-2deg)' }, { transform: 'scale(1) rotate(2deg)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 700 }); }
  }
  async requestSpin(viaLever) {
    const g = this.game; this.lastAct = performance.now(); this.A.unlock();
    if (this.busy || !g.current.human || g.rollsLeft <= 0 || this.awaitingPick || this.paused) return; if (g.rolled && g.held.every(Boolean)) { this.A.play('nope'); return; }
    this.busy = true; this.updateControls(); this.hint.classList.remove('show'); this.sheet.close(); this.sheet.clearChoices(); this.machine.setHints(null);
    if (!viaLever) { this.machine.pullLever(); await this.wait(90, { fast: false }); }
    this.A.play('leverPull'); Haptics.pulse([14, 30, 26]);
    try { await this.rollMachine(this.machine, false); } catch (e) { this.busy = false; throw e; }
    this.busy = false; this.afterHumanRoll();
  }
  /** Shared by human + AI: roll in the model, animate the given machine. */
  async rollMachine(machine, mini) {
    const g = this.game, held = g.held.slice(); const dice = g.roll(held); this.setPips();
    const results = dice.map((v, i) => (held[i] ? null : v)); const spinning = results.map((v) => v !== null);
    const ant = this.anticipation(dice, spinning); const P = this.app.cfg.pacing; const loop = mini ? null : this.A.loop('spin', { vol: 0.9 });
    if (!mini) this.root.classList.remove('tense');
    const fm = (mini && this.fast) ? P.fastMultiplier : 1;
    await machine.spin(results, { minTime: (mini ? P.opponentSpinMin : P.spinMin) * fm, stagger: (mini ? P.reelStagger * 0.6 : P.reelStagger) * fm, anticipate: ant, speed: mini ? 16 : 17, tail: mini ? 0.26 : 0.46 });
    loop?.stop(0.1); this.root.classList.remove('tense'); await this.gate();
    return dice;
  }
  /** Tease the last spinning reel(s) when the other four dice make a Schatzi / 4-kind / big straight possible. */
  anticipation(dice, spinning) {
    const ant = dice.map(() => false); const idx = spinning.map((s, i) => (s ? i : -1)).filter((i) => i >= 0); if (!idx.length) return ant;
    const last = idx[idx.length - 1]; const others = dice.filter((_, i) => i !== last);
    const c = counts(others); const four = c.some((n) => n === 4);
    const set = new Set(others); const straightish = set.size === 4 && [...set].every((v) => v >= 1) && (() => { const a = [...set].sort((x, y) => x - y); return a[3] - a[0] === 3; })();
    if (idx.length >= 3 || idx.length === 1) { if (four || (straightish && Math.random() < 0.5)) ant[last] = true; }
    if (idx.length === 5 && isSchatzi(dice)) ant[last] = true;
    return ant;
  }
  afterHumanRoll() {
    const g = this.game; this.lastAct = performance.now();
    if (g.rollsLeft === 0) { this.machine.clearHolds(); g.held = g.held.map(() => false); }
    const ptsMap = g.preview(), legal = g.legal(); this.sheet.setChoices(ptsMap, legal); this.awaitingPick = g.rollsLeft === 0; this.updateControls(); this.refreshHints();
    const d = g.dice; if (isSchatzi(d)) { this.celebrateSchatziRoll(); }
    if (g.rollsLeft === 0) { this.hint.textContent = 'Choose where to score'; this.hint.classList.add('show'); setTimeout(() => { if (!this.dead && this.awaitingPick && !this.sheet.isOpen) this.sheet.open(); }, 450); }
    else { this.hint.textContent = 'Tap reels to HOLD, then spin again'; this.hint.classList.add('show'); }
  }
  celebrateSchatziRoll() { this.A.play('schatzi'); this.A.duck(0.35, 2); Haptics.big(); this.showBanner('SCHATZI!', 'big'); const r = this.mHost.getBoundingClientRect(), hr = this.root.getBoundingClientRect(); this.particles.burst(r.left - hr.left + r.width / 2, r.top - hr.top + r.height * 0.3, { n: 70, coins: 0.45, speed: 12 }); this.machine.flashReels(null, 1); }
  onReelTap(i) {
    const g = this.game; this.lastAct = performance.now(); this.A.unlock();
    if (!g.current.human || this.busy || !g.rolled || g.rollsLeft <= 0) { if (g.current.human && g.rolled && g.rollsLeft <= 0) this.A.play('nope'); return; }
    const on = g.toggleHold(i); this.machine.setHeld(g.held); this.A.play(on ? 'hold' : 'unhold'); Haptics.tap(); this.machine.flashReels([i], 0.5); this.updateControls(); this.refreshHints();
    this.hint.textContent = g.held.every(Boolean) ? 'All held — time to score!' : 'Tap reels to HOLD, then spin again';
    if (g.held.every(Boolean)) { this.cardBtn.classList.add('pulse'); }
  }
  async onPick(cat) {
    const g = this.game; if (!g.current.human || this.committing) return; this.committing = true; this.lastAct = performance.now();
    this.hint.classList.remove('show');
    const res = g.score(cat); this.sheet.clearChoices(); this.awaitingPick = false; this.updateControls();
    this.sheet.refresh(); // totals update after land
    await this.reactToScore(res, g.turn);
    this.sheet.close(); await this.wait(350, { fast: false }); this.committing = false; this.resolveTurn?.();
  }

  // ---------- AI
  async aiTurn(i) {
    const g = this.game, s = this.seats[i], p = g.players[i], cfg = this.diff; const T = (a, b) => rand(a, b);
    this.updateControls();
    s.mini.setDim(false); await this.aiSpin(s);
    for (let r = 0; r < 2; r++) {
      const stop = s.sprite.think(); const [t0, t1] = cfg.think; await this.wait(T(t0, t1)); stop();
      const dec = decideHold(p.card, g.dice, g.rollsLeft, cfg); if (dec.stop) break;
      g.held = dec.mask.slice(); s.mini.setHeld(g.held); this.A.play('hold', { vol: 0.5 }); await this.wait(320);
      await this.aiSpin(s);
    }
    const stop = s.sprite.think(); await this.wait(T(...cfg.think) * 0.45); stop();
    const cat = decideCategory(p.card, g.dice, cfg); s.mini.clearHolds();
    const res = g.score(cat); this.sheet.refresh();
    await this.reactToScore(res, i); await this.wait(this.app.cfg.pacing.afterScore * 0.3);
  }
  async aiSpin(s) { s.mini.lever && s.mini.pullLever(); await this.wait(120, { fast: false }); this.A.play('whoosh', { vol: 0.35 }); await this.rollMachine(s.mini, true); }

  // ---------- reactions
  async reactToScore(res, who) {
    const g = this.game, P = g.players[who], t = tier(res), human = P.human; const pos = this.entityCenter(who);
    const name = CAT_LABEL[res.cat]; const seat = this.seats[who];
    // sheet visual
    const card = this.sheet.cards[who]?.card; if (card) { if (this.sheet.isOpen) card.land(res.cat, res.pts, t === 'great' || t === 'schatzi'); }
    this.sheet.refresh({ animate: this.sheet.isOpen }); this.refreshHud();
    // sound + text
    const big = t === 'great' || t === 'schatzi';
    this.A.play(t === 'schatzi' ? 'schatzi' : t === 'zero' ? 'zero' : big || t === 'good' ? 'scoreBig' : 'scoreSmall'); if (t === 'zero') Haptics.pulse([40, 40, 40]); else if (big) Haptics.big(); else Haptics.success();
    floatText(this.fxLayer, t === 'zero' ? `0  ${name}` : `+${res.pts}  ${name}`, pos.x, pos.y, { cls: t === 'zero' ? 'zero' : big ? 'big' : '' });
    if (res.schatziBonus) { await this.wait(300, { fast: false }); floatText(this.fxLayer, `SCHATZI BONUS +${res.schatziBonus}!`, pos.x, pos.y - 30, { cls: 'big', dur: 1800 }); this.A.play('bonus'); }
    if (res.gotUpperBonus) { await this.wait(200, { fast: false }); floatText(this.fxLayer, 'UPPER BONUS +35!', pos.x, pos.y - 30, { cls: 'big', dur: 1800 }); this.A.play('bonus'); this.showBanner('UPPER BONUS +35!', 'bonus'); if (card) card.badge.animate([{ transform: 'scale(.2)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 600 }); }
    if (t === 'schatzi') { this.showBanner('SCHATZI!', 'big'); this.A.duck(0.35, 2); this.particles.burst(pos.x, pos.y + 40, { n: 80, coins: 0.5, speed: 13 }); }
    else if (big) this.particles.burst(pos.x, pos.y + 40, { n: 26, speed: 9 });
    // characters
    const ais = Object.values(this.seats); const others = ais.filter((s) => s.p !== P);
    if (!human) {
      if (t === 'schatzi' || t === 'great') { seat.sprite.cheer(t === 'schatzi' ? 3 : 2); this.talk.say(P.charId, 'selfBig', { p: this.pname(), pts: res.pts, c: name }, { priority: t === 'schatzi' ? 2 : 1 }); }
      else if (t === 'good') seat.sprite.cheer(1);
      else if (t === 'zero') { this.talk.say(P.charId, 'selfZero', { p: this.pname() }, { priority: 1 }); seat.sprite.mad(); }
      else if (t === 'low') { this.talk.say(P.charId, 'selfLow', { p: this.pname() }, { priority: 1 }); }
      if (t === 'schatzi') others.forEach((o) => o.sprite.gasp());
      if (t === 'schatzi' && others.length) this.talk.say(pick(others).p.charId, 'oppSchatzi', { n: P.name }, { priority: 2 });
      else if ((t === 'great') && others.length) this.talk.say(pick(others).p.charId, 'oppBig', { n: P.name }, { priority: 1 });
      else if (t === 'zero' && others.length) { const o = pick(others); this.talk.say(o.p.charId, 'oppZero', { n: P.name }, { priority: 1 }); }
    } else {
      if (t === 'schatzi') { others.forEach((o) => o.sprite.gasp()); if (others.length) { const o = pick(others); this.talk.say(o.p.charId, 'playerSchatzi', { p: this.pname() }, { priority: 2 }); o.sprite.mad({ ms: 700 }); } }
      else if (t === 'zero') { if (others.length) { const o = pick(others); this.talk.say(o.p.charId, 'playerZero', { p: this.pname() }, { priority: 1 }); o.sprite.smirk(); } }
      else if (big) { if (others.length) { const o = pick(others); this.talk.say(o.p.charId, 'playerBig', { p: this.pname() }, { priority: 1 }); o.sprite.gasp(); } }
      else if (t === 'low' && others.length) this.talk.say(pick(others).p.charId, 'playerLow', { p: this.pname() }, { priority: 1 });
    }
    if (res.tookLead && who !== 0 && !human) this.talk.say(P.charId, 'takeLead', { p: this.pname() }, { priority: 1 });
    else if (res.lostLeadFrom >= 0 && !g.players[res.lostLeadFrom].human) this.talk.say(g.players[res.lostLeadFrom].charId, 'loseLead', { n: P.name }, { priority: 1 });
    if (res.gotUpperBonus && !human) this.talk.say(P.charId, 'bonus', {}, { priority: 1 });
    this.refreshHud();
    await this.wait(human ? (this.sheet.isOpen ? 950 : 500) : (this.sheet.isOpen ? 700 : 450), { fast: !human });
  }

  // ---------- end
  async finish() {
    const g = this.game; this.sheet.close(); this.setTurnRings(); this.root.classList.remove('my-turn', 'opp-turn'); this.hint.classList.remove('show'); this.pring.style.display = 'none'; Object.values(this.seats).forEach((s) => { s.ring.style.display = 'none'; });
    this.showBanner('FINAL SCORES!', 'big'); this.A.play('whoosh'); await this.wait(1800, { fast: false });
    const rank = g.ranking(); const me = rank.find((r) => r.p.human); const best = rank[0].total; const won = g.players.length > 1 ? me.total >= best : me.total >= this.app.cfg.soloWinScore;
    const hs = store.get('best', 0); const newBest = me.total > hs; if (newBest) store.set('best', me.total);
    this.dead = true; this.app.showResults({ players: g.players.map((p, i) => ({ ...p, total: grandTotal(p.card), card: p.card })), rank: rank.map((r) => ({ id: r.p.id, name: r.p.name, charId: r.p.charId, human: r.p.human, total: r.total, place: r.place })), won, tie: g.players.length > 1 && won && rank.filter((r) => r.total === best).length > 1, newBest, best: Math.max(hs, me.total), setup: this.setup });
  }
  restart() { this.dead = true; this.app.startGame(this.setup); }
  quit() { this.dead = true; this.app.showMenu(); }
  destroy() {
    this.dead = true; this.timers.forEach((t) => clearInterval(t)); removeEventListener('resize', this._onResize); this.talk?.clear(); this.machine?.destroy(); Object.values(this.seats).forEach((s) => { s.mini.destroy(); s.sprite.destroy(); });
    this.root?.remove(); this.app.onBack = null;
  }
}
void ScoreSheet;
