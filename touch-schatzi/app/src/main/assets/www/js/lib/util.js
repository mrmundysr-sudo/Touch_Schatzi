// Small shared helpers (framework-free, reusable in any project).
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const raf = () => new Promise((r) => requestAnimationFrame(r));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t, c1 = 1.4) => { const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const easeOutElastic = (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1);

/** Uniform integer in [min,max] using crypto when available (fair dice, no modulo bias). */
export function randInt(min, max) {
  const range = max - min + 1;
  if (globalThis.crypto && crypto.getRandomValues) {
    const buf = new Uint32Array(1); const lim = Math.floor(0x100000000 / range) * range;
    do { crypto.getRandomValues(buf); } while (buf[0] >= lim);
    return min + (buf[0] % range);
  }
  return min + Math.floor(Math.random() * range);
}
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/** Tiny DOM builder: h('div.cls#id', {attrs}, ...children) */
export function h(sel, attrs, ...kids) {
  const m = sel.match(/^([a-z0-9-]*)((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m && m[1] ? m[1] : 'div');
  if (m && m[2]) m[2].replace(/([.#])([\w-]+)/g, (_, t, n) => { if (t === '.') el.classList.add(n); else el.id = n; });
  if (attrs && (attrs.nodeType || typeof attrs === 'string' || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const k in attrs || {}) {
    const v = attrs[k]; if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v; else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
export const svgNS = 'http://www.w3.org/2000/svg';
export function svg(markup) { const t = document.createElement('div'); t.innerHTML = `<svg xmlns="${svgNS}">${markup}</svg>`; return t.firstChild; }

/** Safe localStorage JSON store. */
export const store = {
  get(k, d) { try { const v = localStorage.getItem('ts.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ts.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

export class Emitter {
  constructor() { this._l = {}; }
  on(e, f) { (this._l[e] ||= new Set()).add(f); return () => this.off(e, f); }
  off(e, f) { this._l[e]?.delete(f); }
  emit(e, ...a) { this._l[e]?.forEach((f) => { try { f(...a); } catch (err) { console.error(err); } }); }
}
