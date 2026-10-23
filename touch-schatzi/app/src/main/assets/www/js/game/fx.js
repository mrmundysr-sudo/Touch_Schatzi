import { h, rand, pick, svg } from '../lib/util.js';

/** Full-screen particle canvas: confetti, gold coins, stars. */
export class Particles {
  constructor(host) {
    this.c = h('canvas.fx-canvas'); host.appendChild(this.c); this.ctx = this.c.getContext('2d'); this.p = []; this.raf = 0; this.rainUntil = 0; this.rainRate = 0;
    this._rs = new ResizeObserver(() => this.resize()); this._rs.observe(host); this.resize();
  }
  resize() { const r = this.c.getBoundingClientRect(); const d = Math.min(2, window.devicePixelRatio || 1); this.c.width = r.width * d; this.c.height = r.height * d; this.d = d; this.w = r.width; this.h = r.height; }
  burst(x, y, { n = 40, spread = 1, coins = 0.25, speed = 9, colors } = {}) {
    colors = colors || ['#ffd24a', '#ff5ea8', '#5be3ff', '#9c6bff', '#7dff8a', '#ff8a3d'];
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05) * spread + (spread < 1 ? -Math.PI / 2 * (1 - spread) : 0), s = rand(speed * 0.4, speed);
      this.p.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(0, 6.28), vr: rand(-0.3, 0.3), sz: rand(6, 12), col: pick(colors), shape: Math.random() < coins ? 'coin' : Math.random() < 0.2 ? 'star' : 'rect', life: rand(2.2, 3.6), age: 0, g: rand(0.18, 0.3) });
    }
    this._go();
  }
  rain(seconds = 4, rate = 90) { this.rainUntil = performance.now() + seconds * 1000; this.rainRate = rate; this._go(); }
  clear() { this.p.length = 0; this.rainUntil = 0; }
  _go() { if (!this.raf) { this.t0 = performance.now(); this.raf = requestAnimationFrame((t) => this._tick(t)); } }
  _tick(t) {
    const dt = Math.min(0.05, (t - this.t0) / 1000); this.t0 = t; const c = this.ctx, d = this.d;
    if (t < this.rainUntil) { const n = this.rainRate * dt; for (let i = 0; i < n + (Math.random() < n % 1 ? 1 : 0); i++) this.p.push({ x: rand(0, this.w), y: -20, vx: rand(-1, 1), vy: rand(2, 5), r: rand(0, 6.28), vr: rand(-0.2, 0.2), sz: rand(6, 11), col: pick(['#ffd24a', '#ff5ea8', '#5be3ff', '#9c6bff', '#7dff8a', '#ffd24a']), shape: Math.random() < 0.3 ? 'coin' : 'rect', life: 6, age: 0, g: 0.05 }); }
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, this.w, this.h);
    const k = dt * 60;
    this.p = this.p.filter((q) => {
      q.age += dt; if (q.age > q.life || q.y > this.h + 30) return false;
      q.vy += q.g * k; q.vx *= 1 - 0.012 * k; q.x += q.vx * k; q.y += q.vy * k; q.r += q.vr * k;
      const a = Math.min(1, (q.life - q.age) * 2); c.globalAlpha = a; c.save(); c.translate(q.x, q.y); c.rotate(q.r); c.fillStyle = q.col;
      if (q.shape === 'rect') { c.scale(1, Math.cos(q.r * 1.7)); c.fillRect(-q.sz / 2, -q.sz / 4, q.sz, q.sz / 2); }
      else if (q.shape === 'coin') { c.scale(Math.abs(Math.cos(q.r * 1.3)) + 0.12, 1); c.fillStyle = '#ffcf3a'; c.beginPath(); c.arc(0, 0, q.sz * 0.62, 0, 6.3); c.fill(); c.strokeStyle = '#a86a00'; c.lineWidth = 1.6; c.stroke(); c.fillStyle = '#ffe98a'; c.beginPath(); c.arc(0, 0, q.sz * 0.34, 0, 6.3); c.fill(); }
      else { c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? q.sz * 0.25 : q.sz * 0.7, an = i * Math.PI / 4; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); }
      c.restore(); return true;
    });
    c.globalAlpha = 1;
    this.raf = (this.p.length || t < this.rainUntil) ? requestAnimationFrame((x) => this._tick(x)) : 0;
  }
}

/** Rising, fading text ("+25", "SCHATZI!"). Position in px relative to host. */
export function floatText(host, text, x, y, { cls = '', dur = 1400, rise = 70 } = {}) {
  const el = h('div.float-text' + (cls ? '.' + cls.split(' ').join('.') : ''), { style: { left: x + 'px', top: y + 'px' } }, text);
  host.appendChild(el);
  el.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-60%) scale(1.15)', opacity: 1, offset: 0.18 }, { transform: `translate(-50%,calc(-50% - ${rise}px)) scale(1)`, opacity: 0 }], { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).onfinish = () => el.remove();
  return el;
}

export const starSvg = (c = '#fff6c0') => `<svg viewBox="-10 -10 20 20"><path d="M0-10 L2.6-2.6 10 0 2.6 2.6 0 10 -2.6 2.6 -10 0 -2.6-2.6Z" fill="${c}" stroke="#ffb400" stroke-width="1"/></svg>`;

/** Golden flashing turn ring. kind: 'oval' (around a character) or 'rect' (around the slot machine / chips). */
export function makeRing(kind = 'oval') {
  const stars = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const a = i / 8 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = kind === 'rect' ? 0.42 : 1; const x = 50 + 50 * Math.sign(c) * Math.pow(Math.abs(c), e), y = 50 + 50 * Math.sign(s) * Math.pow(Math.abs(s), e);
    return h('span.orb', { style: { left: x + '%', top: y + '%', animationDelay: (i * 0.11) + 's' }, html: starSvg() });
  });
  return h('div.turn-ring.' + kind, h('div.ring-glow'), h('div.ring-a'), h('div.ring-b'), h('div.ring-orbit', stars));
}

/** Sparkles that pop around a point. */
export function sparkles(host, x, y, n = 8, spread = 60) {
  for (let i = 0; i < n; i++) {
    const s = h('div.spark', { html: starSvg(i % 2 ? '#fff' : '#ffe27a'), style: { left: x + 'px', top: y + 'px', width: rand(10, 22) + 'px', height: rand(10, 22) + 'px' } }); host.appendChild(s);
    const a = rand(0, 6.28), dst = rand(spread * 0.4, spread);
    s.animate([{ transform: 'translate(-50%,-50%) scale(0) rotate(0)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * dst}px),calc(-50% + ${Math.sin(a) * dst}px)) scale(1) rotate(120deg)`, opacity: 1, offset: 0.5 }, { transform: `translate(calc(-50% + ${Math.cos(a) * dst * 1.2}px),calc(-50% + ${Math.sin(a) * dst * 1.2 + 14}px)) scale(0) rotate(240deg)`, opacity: 0 }], { duration: rand(550, 900), delay: rand(0, 120), easing: 'ease-out', fill: 'forwards' }).onfinish = () => s.remove();
  }
}
export { svg };
