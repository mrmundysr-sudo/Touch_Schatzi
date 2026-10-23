// Character registry + animated cutout sprites. Fully data-driven (config/characters.json).
// Reactions are procedural (squash/stretch + drawn expression overlays) but ANY state can be replaced
// by a real sprite sheet: add  "sheets": { "cheer": {"src":"assets/chars/lily_cheer.webp","cols":4,"rows":2,"frames":8,"fps":12} }
import { Assets } from '../lib/assets.js';
import { h, svgNS, sleep } from '../lib/util.js';
import { starSvg } from './fx.js';

export const Characters = { defs: {}, order: [] };
export async function loadCharacters(url = 'config/characters.json') {
  const j = await (await fetch(url)).json(); Characters.defs = j.characters; Characters.order = j.order || Object.keys(j.characters);
  for (const [id, d] of Object.entries(Characters.defs)) d.id = id;
}
export const charDef = (id) => Characters.defs[id];

/** Square face-crop style for avatars (scoreboard chips, menu cards, tabs). */
export function faceStyle(id) {
  const d = charDef(id); if (!d) return {};
  const A = d.aspect, [e1, e2] = d.eyes, fx = (e1[0] + e2[0]) / 2, fy = (e1[1] + e2[1]) / 2 + 0.06;
  const wf = id === 'scoobert' ? 0.74 : 0.6, hh = wf * A; const left = Math.min(1 - wf, Math.max(0, fx - wf / 2)), top = Math.min(1 - hh, Math.max(0, fy - hh / 2));
  return { backgroundImage: `url("${Assets.url(d.asset)}")`, backgroundSize: `${100 / wf}% auto`, backgroundPosition: `${left / (1 - wf) * 100}% ${top / (1 - hh) * 100}%`, backgroundRepeat: 'no-repeat' };
}
export function avatar(id, cls = '') {
  const el = h('div.avatar' + (cls ? '.' + cls : '')); if (id && charDef(id)) Object.assign(el.style, faceStyle(id), { '--c': charDef(id).color });
  else { el.classList.add('you'); el.append(h('span', 'YOU')); el.style.setProperty('--c', '#ffd24a'); }
  return el;
}

const S = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); kids.forEach((c) => e.append(c)); return e; };

export class CharacterSprite {
  constructor(id, { audio } = {}) {
    this.id = id; this.def = charDef(id); this.audio = audio; this.A = this.def.aspect; this.mood = 'idle'; this._loops = new Set(); this._sheetTimer = 0;
    this.img = h('img.char-img', { alt: this.def.name, draggable: 'false' }); this.img.src = Assets.url(this.def.asset);
    this.fx = this._buildOverlay();
    this.sheet = h('div.char-sheet', { style: { display: 'none' } });
    this.act = h('div.char-act', this.img, this.sheet, this.fx);
    this.idle = h('div.char-idle', this.act);
    this.root = h('div.char.c-' + id, { style: { aspectRatio: String(this.A) } }, this.idle);
    this.root.style.setProperty('--c', this.def.color);
    this._startIdle();
  }
  // ---- overlays ----
  _buildOverlay() {
    const A = this.A, d = this.def, [e1, e2] = d.eyes, r = d.eyeR * A;
    const svgEl = S('svg', { class: 'char-fx', viewBox: `0 0 ${A} 1`, preserveAspectRatio: 'none' });
    const eye = (e) => [e[0] * A, e[1]];
    const L = eye(e1), R = eye(e2);
    // gradients / filters
    const defs = S('defs');
    const rg = S('radialGradient', { id: 'flush-' + this.id }); rg.append(S('stop', { offset: '0', 'stop-color': '#ff2a1a', 'stop-opacity': '.62' }), S('stop', { offset: '1', 'stop-color': '#ff2a1a', 'stop-opacity': '0' })); defs.append(rg);
    svgEl.append(defs);
    this.g = {};
    const g = (name) => { const e = S('g', { class: 'fx-' + name, opacity: '0' }); this.g[name] = e; svgEl.append(e); return e; };
    // flush (angry face tint)
    const fl = g('flush'); const cx = (L[0] + R[0]) / 2, cy = (L[1] + R[1]) / 2 + 0.07; fl.append(S('ellipse', { cx, cy, rx: 0.30 * A, ry: 0.23, fill: `url(#flush-${this.id})` })); fl.style.mixBlendMode = 'multiply';
    // lids (smirk / evil)
    const lids = g('lids'); const lidFill = this.id === 'scoobert' ? '#4a2c1e' : d.color;
    const lid = (c, inner) => { const [x, y] = c; const k = r * 1.28, s = inner; const pts = [[-k, -k * 1.1], [k, -k * 1.1], [s > 0 ? k : -k, -r * 0.02], [s > 0 ? -k : k, -r * 0.7]]; return S('polygon', { points: pts.map(([px, py]) => `${x + px},${y + py}`).join(' '), fill: lidFill, stroke: '#2a160c', 'stroke-width': r * 0.08, 'stroke-linejoin': 'round' }); };
    if (this.id === 'scoobert') lids.append(lid(L, 1), lid(R, -1));
    // angry brows for the kids
    const brows = g('brows'); const bc = this.id === 'lily' ? '#7a4a1a' : '#1a100c';
    const brow = (c, sgn) => S('path', { d: `M ${c[0] - r * 1.3} ${c[1] - r * (sgn > 0 ? 1.5 : 0.85)} L ${c[0] + r * 1.3} ${c[1] - r * (sgn > 0 ? 0.85 : 1.5)}`, stroke: bc, 'stroke-width': r * 0.55, 'stroke-linecap': 'round', fill: 'none' });
    brows.append(brow(L, 1), brow(R, -1));
    // vein
    const vein = g('vein'); const vx = cx + 0.2 * A, vy = L[1] - 0.17; vein.append(S('path', { d: `M${vx - .02} ${vy - .02} q.02 .02 0 .04 M${vx + .02} ${vy - .02} q-.02 .02 0 .04 M${vx - .02} ${vy + .02} q.02 -.02 0 -.04 M${vx + .02} ${vy + .02} q-.02 -.02 0 -.04`, stroke: '#ff2a2a', 'stroke-width': 0.012, fill: 'none', 'stroke-linecap': 'round', transform: `translate(${vx} ${vy}) scale(1.6) translate(${-vx} ${-vy})` }));
    // tears
    const tears = g('tears'); [L, R].forEach((c, i) => { [0, 1].forEach((k) => tears.append(S('path', { class: 'tear', d: `M${c[0] + (i ? 0.01 : -0.01) * A} ${c[1] + r * 0.9} q${-r * 0.35} ${r * 0.7} 0 ${r * 0.95} q${r * 0.35} ${-r * 0.25} 0 ${-r * 0.95}z`, fill: '#7fd4ff', stroke: '#2c8fd0', 'stroke-width': r * 0.06, style: `animation-delay:${(i * 0.4 + k * 0.7).toFixed(2)}s` }))); });
    // sparkle eyes
    const sp = g('sparkle'); [L, R].forEach((c, i) => { const s = r * 1.1; const star = S('path', { class: 'spk', d: `M0-1 L.26-.26 1 0 .26 .26 0 1 -.26 .26 -1 0 -.26-.26Z`, fill: '#fff8c9', stroke: '#ffb400', 'stroke-width': 0.05, transform: `translate(${c[0] + r * 0.2} ${c[1] - r * 0.1}) scale(${s})`, style: `animation-delay:${i * 0.25}s` }); sp.append(star); });
    // sunglasses
    const sh = g('shades'); const ang = Math.atan2(R[1] - L[1], R[0] - L[0]) * 180 / Math.PI; const mx = (L[0] + R[0]) / 2, my = (L[1] + R[1]) / 2; const dist = Math.hypot(R[0] - L[0], R[1] - L[1]);
    const shg = S('g', { transform: `translate(${mx} ${my}) rotate(${ang})` });
    [-1, 1].forEach((s) => shg.append(S('ellipse', { cx: s * dist / 2, cy: 0, rx: r * 1.35, ry: r * 1.1, fill: '#0b0b12', stroke: '#ffd24a', 'stroke-width': r * 0.14 }), S('path', { d: `M${s * dist / 2 - r * 0.8} ${-r * 0.6} q${r * 0.6} ${-r * 0.1} ${r * 0.9} ${r * 0.1}`, stroke: '#7fb8ff', 'stroke-width': r * 0.12, fill: 'none', 'stroke-linecap': 'round', opacity: '.8' })));
    shg.append(S('path', { d: `M${-dist / 2 + r * 1.3} 0 Q0 ${-r * 0.5} ${dist / 2 - r * 1.3} 0`, stroke: '#ffd24a', 'stroke-width': r * 0.2, fill: 'none' }));
    sh.append(shg); sh.style.transformBox = 'fill-box'; sh.classList.add('shades-g');
    // party hat
    const hat = g('hat'); const hp = d.hat || [0.5, 0.12, 0.3, -12];
    const hg = S('g', { transform: `translate(${hp[0] * A} ${hp[1]}) rotate(${hp[3]}) scale(${hp[2] * A})` });
    hg.append(S('path', { d: 'M-.5 0 L0 -1.15 L.5 0 Q0 .12 -.5 0Z', fill: '#ff4fa3', stroke: '#8a1658', 'stroke-width': .04 }), S('path', { d: 'M-.33 -.45 L.33 -.45 M-.2 -.8 L.2 -.8', stroke: '#fff', 'stroke-width': .09, 'stroke-linecap': 'round' }), S('circle', { cx: 0, cy: -1.18, r: .13, fill: '#ffe27a', stroke: '#b57b00', 'stroke-width': .03 }));
    hat.append(hg);
    return svgEl;
  }
  show(name, on = true, ms = 160) { const e = this.g[name]; if (!e) return; e.getAnimations().forEach((a) => a.cancel()); e.setAttribute('opacity', on ? '1' : '0'); if (name === 'shades' || name === 'hat') { if (on) e.animate([{ transform: 'translateY(-0.35px)', opacity: 0 }, { transform: 'translateY(0.03px)', opacity: 1, offset: 0.7 }, { transform: 'translateY(0)', opacity: 1 }], { duration: ms * 3, easing: 'cubic-bezier(.3,1.4,.6,1)' }); } }
  clearExpr() { Object.keys(this.g).forEach((k) => this.g[k].setAttribute('opacity', '0')); }

  // ---- animation core ----
  _startIdle() {
    const ph = (this.id.length * 0.37) % 1;
    this.idle.animate([{ transform: 'translateY(0) scale(1,1) rotate(-0.4deg)' }, { transform: 'translateY(-0.8%) scale(1.006,1.014) rotate(0.5deg)' }, { transform: 'translateY(0) scale(1,1) rotate(-0.4deg)' }], { duration: 3200 + ph * 900, iterations: Infinity, easing: 'ease-in-out', delay: -ph * 3000 });
  }
  _anim(frames, opts) { return this.act.animate(frames, { fill: 'none', easing: 'ease-in-out', ...opts }); }
  _sheet(state) {
    const sh = this.def.sheets && this.def.sheets[state]; if (!sh) return null;
    const { cols = 1, rows = 1, frames = cols * rows, fps = 12, loop = false } = sh; clearInterval(this._sheetTimer);
    Object.assign(this.sheet.style, { display: 'block', backgroundImage: `url("${sh.src}")`, backgroundSize: `${cols * 100}% ${rows * 100}%`, aspectRatio: String(this.A) }); this.img.style.visibility = 'hidden';
    let i = 0; const set = () => { const c = i % cols, r = Math.floor(i / cols); this.sheet.style.backgroundPosition = `${cols > 1 ? c / (cols - 1) * 100 : 0}% ${rows > 1 ? r / (rows - 1) * 100 : 0}%`; }; set();
    return new Promise((res) => { this._sheetTimer = setInterval(() => { i++; if (i >= frames) { if (loop) { i = 0; } else { this._endSheet(); res(); return; } } set(); }, 1000 / fps); this._sheetRes = res; });
  }
  _endSheet() { clearInterval(this._sheetTimer); this.sheet.style.display = 'none'; this.img.style.visibility = ''; }
  voice(name, extra = {}) { this.audio?.play(name, { pitch: this.def.voice.pitch, wave: this.def.voice.wave, bus: 'voice', ...extra, force: true }); }

  async cheer(n = 2, { silent = false, sparkle = true } = {}) {
    if (!silent) this.voice(this.id === 'scoobert' ? 'meow' : 'cheer');
    if (sparkle) this.show('sparkle', true);
    const sheetP = this._sheet('cheer');
    const a = this._anim([
      { transform: 'translateY(0) scale(1,1) rotate(0)' }, { transform: 'translateY(2%) scale(1.07,.9) rotate(0)', offset: 0.18 }, { transform: 'translateY(-15%) scale(.95,1.1) rotate(-4deg)', offset: 0.5 }, { transform: 'translateY(0) scale(1.06,.93) rotate(2deg)', offset: 0.82 }, { transform: 'translateY(0) scale(1,1) rotate(0)' },
    ], { duration: 640, iterations: n });
    await (sheetP || a.finished.catch(() => {})); if (sparkle) setTimeout(() => this.show('sparkle', false), 250);
  }
  async mad({ ms = 900 } = {}) {
    this.voice(this.id === 'scoobert' ? 'meow' : 'groan', this.id === 'scoobert' ? { pitch: 520 } : {});
    ['flush', 'vein'].forEach((k) => this.show(k, true)); this.show(this.id === 'scoobert' ? 'lids' : 'brows', true);
    const sheetP = this._sheet('mad');
    const fr = []; for (let i = 0; i < 9; i++) fr.push({ transform: `translateX(${i % 2 ? 2.2 : -2.2}%) rotate(${i % 2 ? 2.2 : -2.2}deg) scale(1.03)` }); fr.push({ transform: 'none' });
    const a = this._anim(fr, { duration: ms, easing: 'linear' }); await (sheetP || a.finished.catch(() => {}));
    await sleep(500); ['flush', 'vein', 'brows', 'lids'].forEach((k) => this.show(k, false));
  }
  async sad({ ms = 1700, tears = true } = {}) {
    this.voice('groan'); if (tears) this.show('tears', true); this.show('brows', false);
    const sheetP = this._sheet('sad');
    const a = this._anim([{ transform: 'none' }, { transform: 'translateY(5%) scale(1.01,.95) rotate(-2.5deg)', offset: 0.25 }, { transform: 'translateY(5%) scale(1.01,.95) rotate(-2.5deg)', offset: 0.8 }, { transform: 'none' }], { duration: ms });
    await (sheetP || a.finished.catch(() => {})); this.show('tears', false);
  }
  async gasp() { this.audio?.play('gasp', { bus: 'voice' }); await this._anim([{ transform: 'none' }, { transform: 'scale(1.09,1.11) translateY(-2%)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,1.6,.4,1)' }).finished.catch(() => {}); }
  async nod() { await this._anim([{ transform: 'none' }, { transform: 'translateY(-2.2%) scale(1.012,.99)' }, { transform: 'none' }], { duration: 150 }).finished.catch(() => {}); }
  async smirk(ms = 1800) { if (this.id === 'scoobert') this.show('lids', true); await this._anim([{ transform: 'none' }, { transform: 'rotate(2.5deg) translateX(1.5%)', offset: 0.3 }, { transform: 'rotate(-2deg) translateX(-1%)', offset: 0.7 }, { transform: 'none' }], { duration: ms }).finished.catch(() => {}); if (this.id === 'scoobert') this.show('lids', false); }
  /** Looping pose: think (turn indicator while AI is deciding). Returns stop(). */
  think() {
    const a = this._anim([{ transform: 'rotate(-2deg) translateX(-1%)' }, { transform: 'rotate(2.2deg) translateX(1%)' }], { duration: 900, direction: 'alternate', iterations: Infinity });
    return () => a.cancel();
  }
  /** Loops for result screens. */
  loopCelebrate(delay = 0) {
    this.show('sparkle', true); const a = this._anim([
      { transform: 'translateY(0) scale(1,1) rotate(0)' }, { transform: 'translateY(2%) scale(1.07,.9)', offset: 0.2 }, { transform: 'translateY(-17%) scale(.95,1.1) rotate(-5deg)', offset: 0.52 }, { transform: 'translateY(0) scale(1.06,.93) rotate(3deg)', offset: 0.84 }, { transform: 'translateY(0) scale(1,1) rotate(0)' }], { duration: 760, iterations: Infinity, delay });
    return () => { a.cancel(); this.show('sparkle', false); };
  }
  loopDefeat() {
    this.show('tears', true); this.show('brows', false);
    const a = this._anim([{ transform: 'translateY(4%) scale(1.01,.96) rotate(-3deg)' }, { transform: 'translateY(6%) scale(1.01,.94) rotate(-1.5deg)' }], { duration: 1700, direction: 'alternate', iterations: Infinity });
    return () => { a.cancel(); this.show('tears', false); };
  }
  loopMischief(kind = 'win') {
    if (this.id === 'scoobert') this.show('lids', true);
    const a = this._anim(kind === 'win'
      ? [{ transform: 'rotate(-3deg) translateX(-3%)' }, { transform: 'rotate(3.5deg) translateX(3%) scale(1.02)' }]
      : [{ transform: 'rotate(2deg) translateX(2%) scale(1.01)' }, { transform: 'rotate(-2.5deg) translateX(-2%)' }], { duration: kind === 'win' ? 650 : 1500, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
    return () => { a.cancel(); this.show('lids', false); };
  }
  /** Quick one-shot flourish: paw swipe (cat) / point (others). */
  async swipe(dir = 1) { await this._anim([{ transform: 'none' }, { transform: `translateX(${-6 * dir}%) rotate(${-7 * dir}deg)`, offset: 0.35 }, { transform: `translateX(${9 * dir}%) rotate(${9 * dir}deg) scale(1.05)`, offset: 0.6 }, { transform: 'none' }], { duration: 520, easing: 'ease-out' }).finished.catch(() => {}); }
  destroy() { clearInterval(this._sheetTimer); this.root.remove(); }
}
void starSvg;
