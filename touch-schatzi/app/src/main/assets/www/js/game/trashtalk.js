// Character banter. Content lives in config/trashtalk.json — add characters/lines/events freely.
import { h, sleep, pick } from '../lib/util.js';
import { charDef } from './characters.js';

export class TrashTalk {
  constructor(host, audio) { this.host = host; this.audio = audio; this.enabled = true; this.freq = 1; this.data = null; this.cur = null; this.queue = []; this.lastEnd = 0; this.recent = {}; this.anchor = () => null; }
  async load(url = 'config/trashtalk.json') { try { this.data = await (await fetch(url)).json(); } catch { this.data = { settings: { chance: {}, cooldownMs: 4000 }, lines: {} }; } }
  setEnabled(v) { this.enabled = v; if (!v) this.clear(); }
  clear() { this.queue.length = 0; if (this.cur) { this.cur.el.remove(); this.cur.cancel = true; this.cur = null; } }
  lineFor(charId, event, vars = {}) {
    const pool = this.data?.lines?.[charId]?.[event]; if (!pool || !pool.length) return null;
    const key = charId + event; const rec = (this.recent[key] ||= []); let line, tries = 0;
    do { line = pick(pool); tries++; } while (rec.includes(line) && tries < 6 && pool.length > 2);
    rec.push(line); if (rec.length > 2) rec.shift();
    return line.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }
  /** Try to voice an event. Returns a promise (resolves when bubble is done) or null if skipped. */
  say(charId, event, vars = {}, { priority = 1, force = false } = {}) {
    if (!this.enabled || !charDef(charId)) return null;
    const S = this.data?.settings || {}; const chance = (S.chance?.[event] ?? 0.5) * this.freq;
    if (!force && Math.random() > chance) return null;
    const now = performance.now(); if (!force && priority < 2 && (this.cur || now - this.lastEnd < (S.cooldownMs ?? 3800))) return null;
    const text = this.lineFor(charId, event, vars); if (!text) return null;
    if (this.cur) { if (priority < 2) return null; if (this.queue.length >= 1) return null; return new Promise((res) => this.queue.push({ charId, text, res })); }
    return this._show(charId, text);
  }
  async _show(charId, text) {
    const def = charDef(charId); const el = h('div.bubble', { style: { '--c': def.color } }, h('div.b-name', def.name), h('div.b-text'), h('div.b-tail'));
    this.host.appendChild(el); const cur = this.cur = { el, cancel: false }; const tx = el.querySelector('.b-text');
    const place = () => { const a = this.anchor(charId); if (!a) return; const w = el.offsetWidth, hw = this.host.clientWidth; let left = Math.min(hw - w / 2 - 8, Math.max(w / 2 + 8, a.x)); el.style.left = left + 'px'; el.style.top = a.y + 'px'; el.style.setProperty('--tail', (a.x - left) + 'px'); };
    tx.textContent = text; place(); tx.textContent = ''; el.classList.add('in');
    for (let i = 0; i < text.length && !cur.cancel; i++) { tx.textContent = text.slice(0, i + 1); if (i % 2 === 0) this.audio?.play('blip', { pitch: def.voice.pitch, wave: def.voice.wave, bus: 'voice', vol: 0.8, force: true, minGap: 0 }); place(); await sleep(26); }
    if (!cur.cancel) await sleep(1100 + text.length * 38);
    el.classList.remove('in'); el.classList.add('out'); await sleep(260); el.remove();
    if (this.cur === cur) this.cur = null; this.lastEnd = performance.now();
    const next = this.queue.shift(); if (next) this._show(next.charId, next.text).then(next.res);
  }
}
