// SlotMachine — reusable canvas slot-machine component.
//   * Art-driven: pass any machine image + reel window rectangles (art pixels).
//   * Symbol-agnostic: values are anything; draw them with the default numeral renderer or your own.
//   * Deterministic outcome: you decide the results; the machine only animates them (fair RNG lives in game code).
//   * Events (on/off): 'spinstart', 'tick'(i,speed), 'anticipate'(i), 'stop'(i,value), 'spinend', 'pull', 'reeltap'(i), 'hold'(i,bool)
// Usage: const m = new SlotMachine(el, { art, symbols:[1,2,3,4,5,6] }); await m.spin([3,null,6,1,1]);
import { Emitter, clamp, easeOutBack, easeOutElastic } from '../util.js';

const DEFAULTS = {
  art: {
    machine: 'assets/ui/slot_machine.webp', lever: 'assets/ui/slot_lever.webp', size: [1946, 808],
    leverRect: [1772, 0, 174, 318], leverPivot: [0.4, 1.0],
    windows: [[381, 247, 184, 316], [630, 247, 184, 316], [880, 247, 186, 316], [1130, 247, 186, 316], [1380, 247, 184, 316]],
    radius: 16,
  },
  symbols: [1, 2, 3, 4, 5, 6],
  interactive: true, mini: false, maxSpeed: 17, dprCap: 2.5,
  theme: { cream: ['#fbf3e2', '#efe0c0', '#d9c39a'], ink: ['#ff4b3e', '#c1121f', '#7d0a14'], outline: '#4a0a10', gold: '#ffd24a' },
  drawSymbol: null, // (ctx, value, cx, cy, size, info) => void
};

let cssDone = false;
function injectCss() {
  if (cssDone) return; cssDone = true;
  const s = document.createElement('style');
  s.textContent = `.sm{position:relative;width:100%;user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent}
.sm>img,.sm>canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.sm>img{pointer-events:none;-webkit-user-drag:none}
.sm .sm-lever{position:absolute;display:block;pointer-events:auto;cursor:grab;will-change:transform;touch-action:none;-webkit-user-drag:none}
.sm .sm-lever.off{pointer-events:none}`;
  document.head.appendChild(s);
}
const mod = (a, n) => ((a % n) + n) % n;

export class SlotMachine extends Emitter {
  constructor(host, opts = {}) {
    super(); injectCss();
    this.o = { ...DEFAULTS, ...opts, art: { ...DEFAULTS.art, ...(opts.art || {}) }, theme: { ...DEFAULTS.theme, ...(opts.theme || {}) } };
    const { art } = this.o; this.W = art.size[0]; this.H = art.size[1]; this.n = art.windows.length;
    this.root = document.createElement('div'); this.root.className = 'sm' + (this.o.mini ? ' sm-mini' : ''); this.root.style.aspectRatio = `${this.W} / ${this.H}`;
    this.imgMachine = new Image(); this.imgMachine.alt = ''; this.imgMachine.draggable = false; this.imgMachine.src = art.machine;
    this.canvas = document.createElement('canvas'); this.ctx = this.canvas.getContext('2d');
    this.root.append(this.imgMachine, this.canvas);
    if (art.lever && !this.o.noLever) {
      this.lever = new Image(); this.lever.className = 'sm-lever'; this.lever.alt = ''; this.lever.draggable = false; this.lever.src = art.lever;
      const [lx, ly, lw, lh] = art.leverRect; Object.assign(this.lever.style, { left: `${lx / this.W * 100}%`, top: `${ly / this.H * 100}%`, width: `${lw / this.W * 100}%`, height: `${lh / this.H * 100}%`, transformOrigin: `${art.leverPivot[0] * 100}% ${art.leverPivot[1] * 100}%` });
      this.root.append(this.lever); this._bindLever();
    }
    host.appendChild(this.root);
    // reels
    const base = this.o.symbols; const N = base.length;
    this.reels = art.windows.map((w, i) => {
      const strip = base.slice(); // each reel gets its own fixed order so spinning reels never look identical
      let s = (i * 7 + 3) * 9301; for (let k = N - 1; k > 0; k--) { s = (s * 49297 + 233280) % 233280; const j = Math.floor(s / 233280 * (k + 1)); [strip[k], strip[j]] = [strip[j], strip[k]]; }
      return { strip, pos: i % N, vel: 0, mode: 'idle', held: false, hint: false, flash: 0, value: strip[i % N], stopT: null, wantStop: null };
    });
    this.enabled = true; this.dim = 0; this.spinning = false; this._raf = 0; this._last = 0; this._dirty = true; this._tickAcc = 0;
    this.canvas.addEventListener('pointerdown', (e) => this._onCanvasDown(e));
    this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(this.root);
    this.imgMachine.addEventListener('load', () => this.redraw());
    this._resize(); this._loop = this._loop.bind(this); this.redraw();
  }

  // ---------- public API ----------
  get values() { return this.reels.map((r) => r.value); }
  get held() { return this.reels.map((r) => r.held); }
  setEnabled(v) { this.enabled = v; this.lever?.classList.toggle('off', !v); }
  setDim(v) { this.dim = v ? 1 : 0; this.redraw(); }
  /** Instantly show values (no animation). */
  setValues(vals) { vals.forEach((v, i) => { if (v == null) return; const r = this.reels[i]; const idx = r.strip.indexOf(v); if (idx >= 0) { r.pos = idx; r.value = v; } }); this.redraw(); }
  setHeld(arr) { this.reels.forEach((r, i) => { r.held = !!arr[i]; }); this.redraw(); }
  setHints(arr) { this.reels.forEach((r, i) => { r.hint = !!(arr && arr[i]); }); this.redraw(); }
  toggleHold(i) { const r = this.reels[i]; if (!r || r.mode !== 'idle') return false; r.held = !r.held; r.flash = 1; this.emit('hold', i, r.held); this.redraw(); return r.held; }
  clearHolds() { this.reels.forEach((r) => { r.held = false; r.hint = false; }); this.redraw(); }
  flashReels(idx = null, strength = 1) { this.reels.forEach((r, i) => { if (!idx || idx.includes(i)) r.flash = strength; }); this.redraw(); }
  /** Pull the lever visually (auto animation). Resolves when released. */
  async pullLever() { if (!this.lever) return; await this._animLever(0, 1, 170); this.emit('leverBottom'); await this._animLever(1, 0, 420, true); }
  /**
   * Animate a spin. results[i] === null/undefined keeps that reel as is (held).
   * opts: { minTime=0.9, stagger=0.17, anticipate:[bool], speed }
   */
  spin(results, opts = {}) {
    if (this.spinning) return Promise.resolve(this.values);
    const { minTime = 0.9, stagger = 0.17, anticipate = [], speed = this.o.maxSpeed, tail = 0.5 } = opts;
    this.spinning = true; this.emit('spinstart');
    const now = performance.now() / 1000;
    const jobs = this.reels.map((r, i) => new Promise((resolve) => {
      const target = results[i];
      if (target == null) { resolve(); return; }
      r.mode = 'spin'; r.vel = Math.max(r.vel, 2); r.maxVel = speed * (0.93 + 0.14 * ((i * 37) % 10) / 10); r.accel = 70;
      const extra = anticipate[i] ? 0.95 : 0;
      r.wantStop = { at: now + minTime + i * stagger + extra, target, anticipate: !!anticipate[i], resolve, fired: false, tail };
    }));
    this._start();
    return Promise.all(jobs).then(() => { this.spinning = false; this.reels.forEach((r) => { r.hint = false; }); this.emit('spinend', this.values); return this.values; });
  }
  /** Impatient player: finish the current spin quickly (skips tease). */
  hurry() { if (!this.spinning) return; const now = performance.now() / 1000; let k = 0; this.reels.forEach((r) => { const w = r.wantStop; if (r.mode === 'spin' && w) { w.anticipate = false; w.tail = 0.3; w.at = Math.min(w.at, now + 0.05 + (k++) * 0.07); } }); }
  destroy() { cancelAnimationFrame(this._raf); this._ro.disconnect(); this.root.remove(); }
  redraw() { this._dirty = true; this._start(); }

  // ---------- internals ----------
  _start() { if (!this._raf) { this._last = performance.now(); this._raf = requestAnimationFrame(this._loop); } }
  _resize() {
    const r = this.root.getBoundingClientRect(); if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.o.dprCap); const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (this.canvas.width !== w) { this.canvas.width = w; this.canvas.height = h; } this.k = w / this.W; this.redraw();
  }
  _loop(ts) {
    this._raf = 0; const dt = Math.min(0.05, (ts - this._last) / 1000 || 0.016); this._last = ts;
    const active = this._update(dt); this._draw(); if (active || this._dirty) { this._dirty = false; this._raf = requestAnimationFrame(this._loop); }
  }
  _update(dt) {
    let active = false; const now = performance.now() / 1000; let tickSpeed = 0, tickReel = -1;
    this.reels.forEach((r, i) => {
      if (r.flash > 0) { r.flash = Math.max(0, r.flash - dt * 2.6); active = true; }
      if (r.mode === 'spin') {
        active = true; const w = r.wantStop;
        const prev = r.pos; r.vel = Math.min(r.maxVel, r.vel + r.accel * dt);
        if (w && w.anticipate && now > w.at - 0.95) { // crawl for the big tease
          if (!w.crawl) { w.crawl = true; this.emit('anticipate', i); }
          const k = clamp((now - (w.at - 0.95)) / 0.8, 0, 1); r.vel = Math.min(r.vel, r.maxVel * (1 - 0.62 * k) + 0.01);
        }
        r.pos += r.vel * dt;
        if (Math.floor(r.pos) !== Math.floor(prev)) { tickSpeed = Math.max(tickSpeed, r.vel); tickReel = i; }
        if (w && now >= w.at) {
          const N = r.strip.length, tgt = r.strip.indexOf(w.target);
          const T0 = w.anticipate ? 1.05 : w.tail, c1 = 1.15, idealD = Math.max(0.95, r.vel * T0 / (c1 + 3));
          let dd = mod(tgt - r.pos, N); if (dd < 0.3) dd += N; // forward distance to the target cell
          if (Math.abs(dd - idealD) <= 0.45 || now - w.at > 0.7) {
            r.stopT = { p0: r.pos, d: dd, T: Math.max(0.35, dd * (c1 + 3) / Math.max(4, r.vel)), t: 0, c1, fired: false };
            r.mode = 'stop';
          }
        }
      } else if (r.mode === 'stop') {
        active = true; const s = r.stopT; s.t += dt; const u = clamp(s.t / s.T, 0, 1); const prev = r.pos;
        r.pos = s.p0 + s.d * easeOutBack(u, s.c1);
        if (Math.floor(r.pos) !== Math.floor(prev) && u < 0.9) { tickSpeed = Math.max(tickSpeed, (1 - u) * r.maxVel); tickReel = i; }
        if (!s.fired && u >= 0.476) { s.fired = true; const w = r.wantStop; r.value = w.target; this.emit('stop', i, w.target); r.flash = 1; this._shake(); }
        if (u >= 1) { r.mode = 'idle'; r.vel = 0; r.pos = mod(Math.round(r.pos), r.strip.length); const w = r.wantStop; r.wantStop = null; w.resolve(); }
        else r.vel = (Math.abs(r.pos - prev) / dt) || 0;
      }
    });
    if (tickReel >= 0) { this._tickAcc += dt; if (this._tickAcc > 0.035) { this._tickAcc = 0; this.emit('tick', tickReel, tickSpeed); } }
    return active;
  }
  _shake() { if (this.o.mini || !this.root.animate) return; this.root.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(2.5px)' }, { transform: 'translateY(0)' }], { duration: 130, easing: 'ease-out' }); }

  _draw() {
    const c = this.ctx, k = this.k; if (!k) return; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const { art, theme } = this.o;
    this.reels.forEach((r, i) => {
      const [x, y, w, h] = art.windows[i].map((v) => v * k); const rad = art.radius * k;
      c.save(); c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, rad) : c.rect(x, y, w, h); c.clip();
      // paper
      let g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, theme.cream[2]); g.addColorStop(0.18, theme.cream[0]); g.addColorStop(0.5, theme.cream[0]); g.addColorStop(0.82, theme.cream[1]); g.addColorStop(1, theme.cream[2]);
      c.fillStyle = g; c.fillRect(x, y, w, h);
      if (r.held) { g = c.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, h * 0.7); g.addColorStop(0, 'rgba(255,214,90,.55)'); g.addColorStop(1, 'rgba(255,214,90,0)'); c.fillStyle = g; c.fillRect(x, y, w, h); }
      // symbols on a virtual drum
      const N = r.strip.length, step = 1.02, Hh = h / 2, R = Hh / Math.sin(1.2), cx = x + w / 2, cy = y + h / 2;
      const speed = r.mode === 'idle' ? 0 : r.vel; const blur = clamp((speed - 6) / 12, 0, 1);
      const j0 = Math.floor(r.pos) - 2;
      for (let j = j0; j <= j0 + 4; j++) {
        const d = r.pos - j, th = d * step; if (Math.abs(th) > 1.5) continue;
        const sy = cy + R * Math.sin(th), sc = Math.cos(th); const val = r.strip[mod(j, N)];
        const size = Math.min(w * 1.1, h * 0.8) * (0.3 + 0.7 * Math.pow(sc, 1.6));
        const passes = blur > 0.05 ? 3 : 1;
        for (let p = 0; p < passes; p++) {
          const off = passes === 1 ? 0 : (p - 1) * blur * h * 0.09; c.globalAlpha = passes === 1 ? 1 : (p === 1 ? 0.62 : 0.3);
          c.save(); c.translate(cx, sy + off); c.scale(0.92 + 0.08 * sc, sc); (this.o.drawSymbol || drawNumeral)(c, val, 0, 0, size, { theme, held: r.held, w, h, k, blur });
          c.restore();
        }
        c.globalAlpha = 1;
      }
      // cylinder shading
      g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(40,18,0,.7)'); g.addColorStop(0.16, 'rgba(60,30,0,.42)'); g.addColorStop(0.3, 'rgba(255,255,255,.1)'); g.addColorStop(0.42, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(0,0,0,.05)'); g.addColorStop(0.84, 'rgba(40,18,0,.4)'); g.addColorStop(1, 'rgba(40,18,0,.72)');
      c.fillStyle = g; c.fillRect(x, y, w, h);
      g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(30,12,0,.34)'); g.addColorStop(0.12, 'rgba(30,12,0,0)'); g.addColorStop(0.88, 'rgba(30,12,0,0)'); g.addColorStop(1, 'rgba(30,12,0,.34)'); c.fillStyle = g; c.fillRect(x, y, w, h);
      if (r.flash > 0) { c.fillStyle = `rgba(255,245,200,${0.45 * r.flash})`; c.fillRect(x, y, w, h); }
      if (this.dim) { c.fillStyle = 'rgba(20,8,30,.34)'; c.fillRect(x, y, w, h); }
      c.restore();
      // hold / hint chrome
      if (r.held) {
        c.save(); c.shadowColor = 'rgba(255,200,40,.95)'; c.shadowBlur = 14 * k; c.strokeStyle = theme.gold; c.lineWidth = Math.max(2, 7 * k); c.beginPath(); c.roundRect ? c.roundRect(x + 3 * k, y + 3 * k, w - 6 * k, h - 6 * k, rad) : c.rect(x, y, w, h); c.stroke(); c.restore();
        const pw = w * 0.82, ph = this.o.mini ? 26 * k : 40 * k, px = cx - pw / 2, py = y + h - ph - 8 * k;
        const pg = c.createLinearGradient(0, py, 0, py + ph); pg.addColorStop(0, '#ffe27a'); pg.addColorStop(1, '#e09a10'); c.fillStyle = pg; c.strokeStyle = '#6b3a00'; c.lineWidth = Math.max(1, 3 * k);
        c.beginPath(); c.roundRect ? c.roundRect(px, py, pw, ph, ph / 2) : c.rect(px, py, pw, ph); c.fill(); c.stroke();
        c.fillStyle = '#5a2c00'; c.font = `900 ${ph * 0.62}px "Lilita One","Roboto Black",sans-serif-black,Impact,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('HOLD', cx, py + ph * 0.54);
      } else if (r.hint) {
        c.save(); c.setLineDash([10 * k, 8 * k]); c.strokeStyle = 'rgba(120,255,160,.95)'; c.lineWidth = Math.max(2, 5 * k); c.shadowColor = 'rgba(80,255,140,.8)'; c.shadowBlur = 10 * k; c.beginPath(); c.roundRect ? c.roundRect(x + 3 * k, y + 3 * k, w - 6 * k, h - 6 * k, rad) : c.rect(x, y, w, h); c.stroke(); c.restore();
      }
    });
  }

  _onCanvasDown(e) {
    if (!this.o.interactive || !this.enabled) return;
    const rect = this.canvas.getBoundingClientRect(); const k = rect.width / this.W; const x = (e.clientX - rect.left) / k, y = (e.clientY - rect.top) / k;
    for (let i = 0; i < this.n; i++) { const [wx, wy, ww, wh] = this.o.art.windows[i]; if (x >= wx - 10 && x <= wx + ww + 10 && y >= wy - 20 && y <= wy + wh + 20) { this.emit('reeltap', i); return; } }
  }
  _bindLever() {
    const L = this.lever; let drag = null;
    L.addEventListener('pointerdown', (e) => { if (!this.enabled || this.spinning) return; L.setPointerCapture(e.pointerId); drag = { y0: e.clientY, p: 0, moved: false, h: this.root.getBoundingClientRect().height }; L.style.cursor = 'grabbing'; e.preventDefault(); });
    L.addEventListener('pointermove', (e) => { if (!drag) return; const dy = e.clientY - drag.y0; if (Math.abs(dy) > 5) drag.moved = true; drag.p = clamp(dy / (drag.h * 0.42), 0, 1); this._setLever(drag.p); });
    const up = async () => {
      if (!drag) return; const d = drag; drag = null; L.style.cursor = 'grab';
      if (!d.moved || d.p > 0.55) { if (d.p < 0.95) await this._animLever(d.p, 1, 120); this.emit('pull'); await this._animLever(1, 0, 420, true); } else await this._animLever(d.p, 0, 260, true);
    };
    L.addEventListener('pointerup', up); L.addEventListener('pointercancel', up);
  }
  _setLever(p) { this._lp = p; this.lever.style.transform = `translateY(${p * 52}%) scale(${1 + 0.09 * p}, ${1 - 0.58 * p}) rotate(${-4 * p}deg)`; }
  _animLever(a, b, ms, spring = false) {
    return new Promise((res) => { const t0 = performance.now(); const f = (t) => { const u = clamp((t - t0) / ms, 0, 1); const e = spring ? easeOutElastic(u) : u * u * (3 - 2 * u); this._setLever(a + (b - a) * e); u < 1 ? requestAnimationFrame(f) : (this._setLever(b), res()); }; requestAnimationFrame(f); });
  }
}

/** Default symbol renderer: chunky casino numerals with a glossy red face. */
export function drawNumeral(c, v, x, y, size, info) {
  const t = info.theme; const txt = String(v);
  c.font = `900 ${size}px "Lilita One","Roboto Black",sans-serif-black,"Arial Black",Impact,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const yy = y + size * 0.04;
  c.lineJoin = 'round'; c.lineWidth = size * 0.13; c.strokeStyle = t.outline; c.strokeText(txt, x, yy);
  const g = c.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5); g.addColorStop(0, t.ink[0]); g.addColorStop(0.55, t.ink[1]); g.addColorStop(1, t.ink[2]);
  c.fillStyle = g; c.fillText(txt, x, yy);
  c.save(); c.globalCompositeOperation = 'source-atop'; c.restore();
  c.lineWidth = size * 0.035; c.strokeStyle = 'rgba(255,255,255,.55)'; c.strokeText(txt, x - size * 0.012, yy - size * 0.015);
  c.fillStyle = g; c.fillText(txt, x, yy);
}
