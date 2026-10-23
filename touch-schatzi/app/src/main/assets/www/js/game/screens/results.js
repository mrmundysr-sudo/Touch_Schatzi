import { Assets } from '../../lib/assets.js';
import { h, sleep, store } from '../../lib/util.js';
import { CharacterSprite, avatar, charDef, Characters } from '../characters.js';
import { Particles, floatText, sparkles } from '../fx.js';
import { SceneFrame } from '../scene.js';
import { TrashTalk } from '../trashtalk.js';
import { tween } from '../scorecard.js';
import { Haptics } from '../../lib/haptics.js';

const coinSvg = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#ffcf3a" stroke="#a86a00" stroke-width="3"/><circle cx="20" cy="20" r="11" fill="#ffe98a" stroke="#d9951a" stroke-width="2"/><text x="20" y="26" text-anchor="middle" font-size="16" font-weight="900" fill="#a86a00" font-family="sans-serif">S</text></svg>';

export class ResultsScreen {
  constructor(app, res) { this.app = app; this.res = res; this.frame = new SceneFrame(app.layout); this.sprites = []; this.stops = []; this.dead = false; }
  mount(host) {
    const { app, res } = this, A = app.audio, win = res.won; this.win = win;
    this.root = h('div.screen.results.' + (win ? 'win' : 'loss'));
    this.bg = h('div.scene-bg'); this.stage = h('div.res-stage'); this.fxL = h('div.fx-layer'); this.bubbles = h('div.bubbles');
    this.title = h('img.res-title', { alt: win ? 'You win' : 'You lose' }); this.title.src = Assets.url(win ? 'ui.youWin' : 'ui.youLose');
    this.sub = h('div.res-sub', res.tie ? 'It\'s a tie for first!' : res.rank.length === 1 ? (win ? 'Great solo game!' : 'Keep practicing!') : win ? 'You beat everyone!' : `${res.rank[0].name} takes the crown`);
    const rows = res.rank.map((r, i) => { const row = h('div.rank-row' + (r.human ? '.you' : '') + (i === 0 ? '.first' : ''), h('span.pl', i === 0 ? '👑' : String(r.place)), avatar(r.charId), h('span.nm', r.name), h('span.sc', '0')); row.dataset.t = r.total; return row; });
    this.board = h('div.board', rows, res.newBest ? h('div.newbest', '★ NEW BEST SCORE ★') : (res.best ? h('div.bestline', `Best: ${res.best}`) : null));
    this.again = h('button.again', { onclick: () => this.playAgain() }); this.againImg = h('img', { alt: 'Play again', draggable: 'false' }); this.againImg.src = Assets.url('ui.playAgain'); this.again.append(this.againImg);
    this.menuBtn = h('button.btn.purple.small.menu-link', { onclick: () => { A.play('click'); this.app.showMenu(); } }, 'MENU');
    this.root.append(this.bg, this.stage, this.title, this.sub, this.board, this.again, this.menuBtn, this.fxL, this.bubbles);
    // characters: all three family members
    this.chars = Characters.order.map((cid) => { const sp = new CharacterSprite(cid, { audio: A }); this.stage.append(sp.root); sp.root.style.position = 'absolute'; this.sprites.push(sp); return sp; });
    host.append(this.root); this.particles = new Particles(this.root); this.layout(); this._onResize = () => this.layout(); addEventListener('resize', this._onResize);
    this.talk = new TrashTalk(this.bubbles, A); this.talk.data = app.trashData; this.talk.setEnabled(app.settings.trash !== false); this.talk.anchor = (cid) => { const i = Characters.order.indexOf(cid); const r = this.sprites[i].root.getBoundingClientRect(), hr = this.bubbles.getBoundingClientRect(); return { x: r.left - hr.left + r.width / 2, y: r.top - hr.top + r.height * 0.3 }; };
    this.run();
  }
  layout() {
    const vw = this.root.clientWidth || innerWidth, vh = this.root.clientHeight || innerHeight; const F = this.frame.update(vw, vh); const land = F.orient === 'landscape';
    this.root.dataset.orient = F.orient; this.root.style.setProperty('--u', F.u);
    this.bg.style.backgroundImage = `url("${Assets.url(this.win ? 'bg.win' : 'bg.loss', F.orient)}")`;
    const xs = land ? [0.2, 0.5, 0.8] : [0.17, 0.5, 0.83]; const w = land ? [0.17, 0.18, 0.15] : [0.42, 0.44, 0.39]; const bottom = land ? 0.82 : 0.80;
    this.sprites.forEach((sp, i) => { const cw = F.W(w[i]) * (land ? 1 : 1), chh = cw / sp.A; Object.assign(sp.root.style, { width: cw + 'px', left: F.X(xs[i]) - cw / 2 + 'px', top: F.Y(bottom) - chh + 'px' }); });
    this.chh = (this.sprites[1].root.offsetHeight);
  }
  async run() {
    const { app, res } = this, A = app.audio, win = res.won, [lily, cat, max] = this.sprites; A.stopMusic(); await sleep(150);
    A.play(win ? 'win' : 'lose'); A.duck(0.2, 3); Haptics.big();
    this.root.classList.add('go');
    // title slam
    this.title.animate([{ transform: 'translateX(-50%) scale(2.4) rotate(-8deg)', opacity: 0 }, { transform: 'translateX(-50%) scale(.92) rotate(2deg)', opacity: 1, offset: 0.55 }, { transform: 'translateX(-50%) scale(1) rotate(0)', opacity: 1 }], { duration: 750, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'both' });
    if (win) { this.particles.burst(innerWidth / 2, innerHeight * 0.25, { n: 90, coins: 0.4, speed: 14 }); this.particles.rain(6, 70); A.play('confetti'); }
    // characters
    if (win) {
      this.stops.push(lily.loopCelebrate(0), max.loopCelebrate(180)); lily.voice('cheer'); setTimeout(() => max.voice('cheer'), 220);
      this.mischiefWin(cat);
    } else {
      this.stops.push(lily.loopDefeat(), max.loopDefeat()); lily.voice('groan'); setTimeout(() => max.voice('groan'), 300); this.rainClouds([lily, max]);
      this.mischiefLoss(cat);
    }
    // board count-up
    const rows = [...this.board.querySelectorAll('.rank-row')]; rows.forEach((r, i) => { r.animate([{ transform: 'translateX(-40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 500 + i * 170, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' }); setTimeout(() => { tween(r.querySelector('.sc'), 0, +r.dataset.t, 900); A.play('coin', { vol: 0.6 }); }, 500 + i * 170); });
    this.again.animate([{ transform: 'translateX(-50%) scale(0)', opacity: 0 }, { transform: 'translateX(-50%) scale(1.12)', opacity: 1, offset: 0.7 }, { transform: 'translateX(-50%) scale(1)', opacity: 1 }], { duration: 600, delay: 900, easing: 'ease-out', fill: 'backwards' });
    await sleep(1100); this.again.classList.add('pulse');
    // banter
    const w = res.rank[0]; const me = res.players.find((p) => p.human);
    if (win) { const o = res.players.filter((p) => !p.human)[0] || { charId: pick3() }; this.talk.say(o.charId || 'scoobert', 'overLose', { p: me.name === 'You' ? 'buddy' : me.name }, { priority: 2, force: true }); }
    else if (w.charId) this.talk.say(w.charId, 'overWin', { p: me.name === 'You' ? 'buddy' : me.name }, { priority: 2, force: true });
  }
  mischiefWin(cat) {
    const A = this.app.audio; this.stops.push(cat.loopMischief('win'));
    cat.root.animate([{ transform: 'translateY(60%)' }, { transform: 'translateY(-4%)', offset: 0.7 }, { transform: 'none' }], { duration: 700, easing: 'ease-out' });
    setTimeout(() => { cat.show('hat', true); A.play('pop'); }, 900); setTimeout(() => { cat.show('shades', true); A.play('coin', { f: 1400 }); A.play('meow', { pitch: 700 }); }, 1700);
    // coin heist loop
    const heist = async () => { while (!this.dead) { await sleep(3600 + Math.random() * 1600); if (this.dead) return; await this.coinSwipe(cat); } }; heist();
    this.stops.push(() => { cat.show('hat', false); cat.show('shades', false); });
  }
  async coinSwipe(cat) {
    const hr = this.root.getBoundingClientRect(), r = cat.root.getBoundingClientRect(); const coin = h('div.heist-coin', { html: coinSvg, style: { left: (r.left - hr.left + r.width * 0.9) + 'px', top: (r.top - hr.top + r.height * 0.9) + 'px' } }); this.fxL.append(coin);
    const from = { x: this.root.clientWidth * 0.85, y: this.root.clientHeight * 0.64 };
    coin.animate([{ transform: `translate(${from.x - (r.left - hr.left + r.width * 0.9)}px, ${from.y - (r.top - hr.top + r.height * 0.9)}px) scale(.6) rotate(0)`, opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: 'translate(0,0) scale(1) rotate(540deg)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.3,.8,.4,1)', fill: 'forwards' });
    cat.swipe(1); this.app.audio.play('coin'); await sleep(700); cat.voice('meow', { pitch: 800 }); sparkles(this.fxL, r.left - hr.left + r.width * 0.9, r.top - hr.top + r.height * 0.85, 8, 50); this.talk.say('scoobert', 'selfBig', { p: this.res.players.find((p) => p.human).name, pts: '', c: '' }, { priority: 1 });
    coin.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(0,-30px) scale(.4)' }], { duration: 400, fill: 'forwards' }).onfinish = () => coin.remove();
  }
  mischiefLoss(cat) {
    const A = this.app.audio; this.stops.push(cat.loopMischief('loss'));
    cat.root.animate([{ transform: 'translateX(60%) rotate(6deg)' }, { transform: 'none' }], { duration: 800, easing: 'cubic-bezier(.2,.9,.3,1)' }); setTimeout(() => { cat.voice('meow', { pitch: 480 }); }, 600);
    const sneer = async () => { while (!this.dead) { await sleep(3200 + Math.random() * 1800); if (this.dead) return; cat.swipe(-1); this.app.audio.play('pop', { vol: 0.5 }); const hr = this.root.getBoundingClientRect(), r = cat.root.getBoundingClientRect(); floatText(this.fxL, pick(['mwahaha!', 'hehehe…', 'skill issue 😼', 'nine lives, one winner', 'purr-fect.']), r.left - hr.left + r.width * 0.5, r.top - hr.top, { cls: 'taunt', dur: 1800 }); } }; sneer();
    void A;
  }
  rainClouds(sprites) {
    const hr = this.root.getBoundingClientRect(); sprites.forEach((sp, i) => { const r = sp.root.getBoundingClientRect(); const cl = h('div.raincloud', { style: { left: (r.left - hr.left + r.width / 2) + 'px', top: (r.top - hr.top - 18) + 'px', width: r.width * 0.8 + 'px' } }, h('div.cloud'), h('div.drops', [...Array(7)].map((_, k) => h('i', { style: { '--x': `${10 + k * 13}%`, '--d': `${(k * 0.23 + i * 0.1).toFixed(2)}s` } })))); this.fxL.append(cl); });
  }
  playAgain() { this.app.audio.play('scoreBig'); Haptics.success(); this.again.classList.remove('pulse'); this.root.classList.add('out'); setTimeout(() => this.app.startGame(this.res.setup), 320); }
  destroy() { this.dead = true; this.stops.forEach((s) => s()); removeEventListener('resize', this._onResize); this.talk?.clear(); this.sprites.forEach((s) => s.destroy()); this.root?.remove(); }
}
const pick3 = () => ['lily', 'max', 'scoobert'][Math.floor(Math.random() * 3)];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
void store; void charDef;
