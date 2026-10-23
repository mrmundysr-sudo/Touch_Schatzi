// Reusable synth-first audio engine. Every sound is a named definition; a sample file
// registered in manifest "audio" (or loadSamples) overrides the synth with no code change.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.defs = {}; this.loops = {}; this.samples = {}; this.music = {}; this.current = null;
    this.vol = { sfx: 1, music: 1, voice: 1 }; this.enabled = { sfx: true, music: true };
    this._pending = []; this._noiseBuf = null; this._lastPlay = {};
  }
  /** Must be called from a user gesture on the web / WebView; safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      this.attach(new AC({ latencyHint: 'interactive' }));
    }
    if (this.ctx.resume && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    return true;
  }
  /** Attach any BaseAudioContext (used by tests with OfflineAudioContext). */
  attach(ctx) {
    this.ctx = ctx;
    const mk = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    this.master = mk(0.9);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.busSfx = mk(this.vol.sfx); this.busMusic = mk(0.32 * this.vol.music); this.busVoice = mk(this.vol.voice);
    this.musicDuck = mk(1); this.busMusic.connect(this.musicDuck); this.musicDuck.connect(this.master);
    this.busSfx.connect(this.master); this.busVoice.connect(this.master);
    const len = ctx.sampleRate * 1.5; this._noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this._noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._pending.forEach((f) => f()); this._pending = [];
    if (this.wantMusic) this.playMusic(this.wantMusic);
  }
  define(name, fn) { this.defs[name] = fn; }
  defineLoop(name, fn) { this.loops[name] = fn; }
  defineMusic(name, fn) { this.music[name] = fn; }
  async loadSamples(map) {
    if (!this.ctx) { this._pending.push(() => this.loadSamples(map)); return; }
    await Promise.all(Object.entries(map).map(async ([name, url]) => {
      if (!url) return;
      try { const r = await fetch(url); if (!r.ok) return; const buf = await this.ctx.decodeAudioData(await r.arrayBuffer()); this.samples[name] = buf; } catch { /* keep synth */ }
    }));
  }
  setEnabled(kind, on) {
    this.enabled[kind] = on;
    if (kind === 'music') { if (!on) this.stopMusic(true); else if (this.wantMusic) this.playMusic(this.wantMusic); }
  }
  setVolume(bus, v) { this.vol[bus] = v; if (!this.ctx) return; ({ sfx: this.busSfx, voice: this.busVoice })[bus]?.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); if (bus === 'music') this.busMusic.gain.setTargetAtTime(0.32 * v, this.ctx.currentTime, 0.05); }
  /** Play a named sound. p: {vol, delay, bus} plus anything the definition reads. */
  play(name, p = {}) {
    if (!this.ctx) { return null; }
    if (!this.enabled.sfx) return null;
    const now = this.ctx.currentTime; const minGap = p.minGap ?? 0.012;
    if (now - (this._lastPlay[name] || -1) < minGap && !p.force) return null; this._lastPlay[name] = now;
    const t = now + (p.delay || 0) + 0.005;
    const bus = p.bus === 'voice' ? this.busVoice : this.busSfx;
    const out = this.ctx.createGain(); out.gain.value = p.vol ?? 1; out.connect(bus);
    const s = this.samples[name];
    if (s) { const src = this.ctx.createBufferSource(); src.buffer = s; src.playbackRate.value = p.rate || 1; src.connect(out); src.start(t); return src; }
    const fn = this.defs[name]; if (!fn) return null;
    try { return fn(this, out, t, p); } catch (e) { console.warn('sound failed', name, e); return null; }
  }
  /** Start a sustained loop sound; returns {stop()}. */
  loop(name, p = {}) {
    if (!this.ctx || !this.enabled.sfx || !this.loops[name]) return { stop() {} };
    const out = this.ctx.createGain(); out.gain.value = p.vol ?? 1; out.connect(this.busSfx);
    const h = this.loops[name](this, out, this.ctx.currentTime, p) || {};
    return { stop: (fade = 0.12) => { const t = this.ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + fade); setTimeout(() => { try { h.stop?.(); out.disconnect(); } catch { /* ignore */ } }, fade * 1000 + 60); } };
  }
  duck(level = 0.35, secs = 1.4) {
    if (!this.ctx) return; const g = this.musicDuck.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setTargetAtTime(level, t, 0.05); g.setTargetAtTime(1, t + secs, 0.4);
  }
  playMusic(name) {
    this.wantMusic = name; if (!this.ctx || !this.enabled.music) return;
    if (this.current && this.current.name === name) return; this.stopMusic();
    const fn = this.music[name]; if (!fn) return;
    const out = this.ctx.createGain(); out.gain.value = 0; out.connect(this.busMusic); out.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.2);
    this.current = { name, out, h: fn(this, out) };
  }
  stopMusic(immediate = false) {
    const c = this.current; if (!c) return; this.current = null; const t = this.ctx.currentTime;
    c.out.gain.cancelScheduledValues(t); c.out.gain.setValueAtTime(c.out.gain.value, t); c.out.gain.linearRampToValueAtTime(0, t + (immediate ? 0.05 : 0.8));
    setTimeout(() => { try { c.h?.stop?.(); c.out.disconnect(); } catch { /* ignore */ } }, immediate ? 100 : 1000);
  }
  setMusicIntensity(x) { this.current?.h?.setIntensity?.(x); }

  // ---------- synth building blocks ----------
  tone(out, { t, f, f2, dur = 0.2, type = 'sine', gain = 0.2, attack = 0.004, curve = 'exp', detune = 0, vib, lp }) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) { if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur); else o.frequency.linearRampToValueAtTime(f2, t + dur); }
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o; if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
    node.connect(g); g.connect(out);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib.rate; lg.gain.value = vib.depth; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    o.start(t); o.stop(t + dur + 0.05); return o;
  }
  noise(out, { t, dur = 0.1, gain = 0.2, type = 'bandpass', f = 2000, f2, q = 1, attack = 0.003 }) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this._noiseBuf; s.loop = true;
    fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05); return s;
  }
}
export const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
export const semis = (f, s) => f * Math.pow(2, s / 12);
