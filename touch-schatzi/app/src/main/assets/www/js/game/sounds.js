// All Touch Schatzi sounds, synthesized. Replace any of them with a sample via manifest "audio".
import { midi, semis } from '../lib/audio.js';

export function installSounds(A) {
  const R = (a, b) => a + Math.random() * (b - a);

  A.define('click', (a, o, t, p) => a.tone(o, { t, f: 820 * (p.pitch || 1), f2: 520, dur: 0.05, gain: 0.16, type: 'sine' }));
  A.define('select', (a, o, t) => { a.tone(o, { t, f: 988, dur: 0.07, gain: 0.12, type: 'triangle' }); a.tone(o, { t: t + 0.05, f: 1318, dur: 0.1, gain: 0.1, type: 'triangle' }); });
  A.define('tick', (a, o, t, p) => { a.noise(o, { t, dur: 0.018, gain: 0.07 * (p.vol2 ?? 1), f: 3200 * (p.pitch || 1), q: 3 }); a.tone(o, { t, f: 1700 * (p.pitch || 1), f2: 900, dur: 0.02, gain: 0.05 * (p.vol2 ?? 1), type: 'square' }); });
  A.define('reelStop', (a, o, t, p) => {
    const k = p.index || 0, g = p.soft ? 0.45 : 1;
    a.tone(o, { t, f: 170, f2: 55, dur: 0.14, gain: 0.5 * g, type: 'sine' });
    a.tone(o, { t, f: 950, f2: 400, dur: 0.035, gain: 0.12 * g, type: 'square' });
    a.noise(o, { t, dur: 0.05, gain: 0.14 * g, f: 1400, q: 0.8 });
    a.tone(o, { t: t + 0.01, f: semis(1318, k * 2), dur: 0.35, gain: 0.07 * g, type: 'sine' });
    a.tone(o, { t: t + 0.01, f: semis(1318, k * 2) * 2.76, dur: 0.18, gain: 0.025 * g, type: 'sine' });
  });
  A.define('leverPull', (a, o, t) => {
    for (let i = 0; i < 7; i++) a.tone(o, { t: t + i * 0.034, f: 1500 - i * 110, dur: 0.02, gain: 0.1, type: 'square' });
    a.noise(o, { t, dur: 0.3, gain: 0.1, f: 400, f2: 2200, q: 0.7 });
    a.tone(o, { t: t + 0.22, f: 120, f2: 70, dur: 0.12, gain: 0.35, type: 'sine' });
  });
  A.define('leverRelease', (a, o, t) => a.tone(o, { t, f: 260, f2: 140, dur: 0.28, gain: 0.14, type: 'triangle', vib: { rate: 26, depth: 14 } }));
  A.defineLoop('spin', (a, o, t) => {
    const c = a.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    s.buffer = a._noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.4; g.gain.value = 0.055;
    lfo.frequency.value = 17; lg.gain.value = 380; lfo.connect(lg); lg.connect(f.frequency);
    s.connect(f); f.connect(g); g.connect(o); s.start(t); lfo.start(t);
    const drone = a.tone(o, { t, f: 90, dur: 8, gain: 0.05, type: 'sawtooth', lp: 400 });
    return { stop() { try { s.stop(); lfo.stop(); drone.stop(); } catch { /* ignore */ } } };
  });
  A.define('hold', (a, o, t) => { a.tone(o, { t, f: 520, f2: 940, dur: 0.045, gain: 0.14, type: 'square', lp: 2500 }); a.tone(o, { t: t + 0.04, f: 1568, dur: 0.12, gain: 0.08, type: 'triangle' }); a.noise(o, { t, dur: 0.02, gain: 0.08, f: 3000 }); });
  A.define('unhold', (a, o, t) => { a.tone(o, { t, f: 880, f2: 420, dur: 0.06, gain: 0.12, type: 'square', lp: 2200 }); });
  A.define('sheetUp', (a, o, t) => { a.noise(o, { t, dur: 0.32, gain: 0.16, f: 300, f2: 2400, q: 0.6 }); a.tone(o, { t: t + 0.25, f: 140, f2: 80, dur: 0.15, gain: 0.25 }); });
  A.define('sheetDown', (a, o, t) => { a.noise(o, { t, dur: 0.28, gain: 0.14, f: 2200, f2: 280, q: 0.6 }); a.tone(o, { t: t + 0.2, f: 120, f2: 70, dur: 0.1, gain: 0.2 }); });
  A.define('coin', (a, o, t, p) => { const f = (p.f || 2093) * R(0.97, 1.04); a.tone(o, { t, f, dur: 0.22, gain: 0.1, type: 'sine' }); a.tone(o, { t, f: f * 1.5, dur: 0.14, gain: 0.05, type: 'sine' }); a.noise(o, { t, dur: 0.01, gain: 0.04, f: 6000 }); });
  A.define('scoreSmall', (a, o, t) => { a.tone(o, { t, f: 1175, dur: 0.12, gain: 0.14, type: 'triangle' }); a.tone(o, { t: t + 0.07, f: 1568, dur: 0.22, gain: 0.14, type: 'triangle' }); a.tone(o, { t: t + 0.07, f: 3136, dur: 0.12, gain: 0.04 }); });
  A.define('scoreBig', (a, o, t) => {
    a.tone(o, { t, f: 2217, dur: 0.7, gain: 0.12, type: 'sine' }); a.tone(o, { t, f: 3322, dur: 0.5, gain: 0.07, type: 'sine' }); a.tone(o, { t, f: 4435, dur: 0.3, gain: 0.04 });
    a.tone(o, { t: t + 0.09, f: 1480, dur: 0.5, gain: 0.1, type: 'triangle' });
    for (let i = 0; i < 9; i++) a.tone(o, { t: t + 0.18 + i * 0.045 + R(0, 0.02), f: R(2400, 4200), dur: 0.16, gain: 0.05 });
  });
  A.define('zero', (a, o, t) => { a.tone(o, { t, f: 233, f2: 98, dur: 0.5, gain: 0.22, type: 'sawtooth', lp: 700, vib: { rate: 6, depth: 6 } }); a.tone(o, { t: t + 0.02, f: 117, f2: 60, dur: 0.5, gain: 0.2, type: 'sine' }); });
  A.define('bonus', (a, o, t) => { [72, 76, 79, 84, 88, 91].forEach((n, i) => { a.tone(o, { t: t + i * 0.07, f: midi(n), dur: 0.35, gain: 0.11, type: 'triangle' }); a.tone(o, { t: t + i * 0.07, f: midi(n + 12), dur: 0.2, gain: 0.03, type: 'sine' }); }); a.play('scoreBig', { delay: 0.4, vol: 0.7, force: true }); });
  A.define('schatzi', (a, o, t) => {
    // fanfare + rising sweep + coin shower
    [[60, 0], [64, 0], [67, 0], [72, 0.22], [76, 0.22], [79, 0.22], [84, 0.5], [88, 0.5], [91, 0.5]].forEach(([n, d]) => { a.tone(o, { t: t + d, f: midi(n), dur: 0.6, gain: 0.09, type: 'sawtooth', lp: 3200 }); });
    a.tone(o, { t, f: 220, f2: 1760, dur: 0.5, gain: 0.08, type: 'sine' });
    for (let i = 0; i < 38; i++) a.tone(o, { t: t + 0.4 + i * 0.05 + R(0, 0.03), f: R(1800, 4600), dur: 0.2, gain: 0.05 });
    a.noise(o, { t: t + 0.45, dur: 0.9, gain: 0.08, f: 5000, type: 'highpass', q: 0.5 });
  });
  A.define('myTurn', (a, o, t) => { [79, 83, 86, 91].forEach((n, i) => a.tone(o, { t: t + i * 0.065, f: midi(n), dur: 0.55, gain: 0.07, type: 'sine', detune: i % 2 ? 6 : -6 })); a.tone(o, { t, f: midi(55), dur: 0.2, gain: 0.12, type: 'triangle' }); });
  A.define('turnChime', (a, o, t) => { a.tone(o, { t, f: midi(88), dur: 0.4, gain: 0.05, type: 'sine' }); a.tone(o, { t: t + 0.08, f: midi(95), dur: 0.5, gain: 0.04, type: 'sine' }); });
  A.define('anticipation', (a, o, t, p) => { const d = p.dur || 0.9; a.tone(o, { t, f: 330, f2: 1760, dur: d, gain: 0.07, type: 'sine', curve: 'exp', vib: { rate: 14, depth: 25 } }); a.noise(o, { t, dur: d, gain: 0.05, f: 800, f2: 6000, q: 1.5 }); });
  A.define('nope', (a, o, t) => { a.tone(o, { t, f: 160, dur: 0.1, gain: 0.18, type: 'square', lp: 600 }); a.tone(o, { t: t + 0.12, f: 140, dur: 0.14, gain: 0.18, type: 'square', lp: 600 }); });
  A.define('pop', (a, o, t) => { a.noise(o, { t, dur: 0.06, gain: 0.2, f: 1200, f2: 300, q: 0.8 }); a.tone(o, { t, f: 400, f2: 120, dur: 0.07, gain: 0.2 }); });
  A.define('whoosh', (a, o, t) => a.noise(o, { t, dur: 0.35, gain: 0.12, f: 500, f2: 3000, q: 0.5 }));

  // character voices
  A.define('blip', (a, o, t, p) => { const f = (p.pitch || 500) * R(0.88, 1.18); a.tone(o, { t, f, f2: f * 0.92, dur: 0.055, gain: 0.07, type: p.wave || 'triangle', lp: 3000 }); });
  A.define('cheer', (a, o, t, p) => {
    const base = p.pitch || 420;
    [0, 0.09, 0.18].forEach((d, i) => { const g = a.ctx.createGain(); g.gain.value = 1; g.connect(o); const bp = a.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 2.5; bp.connect(g); const tmp = a.ctx.createGain(); tmp.gain.value = 1; tmp.connect(bp); a.tone(tmp, { t: t + d, f: base * (1 + i * 0.12), f2: base * (1.45 + i * 0.12), dur: 0.2, gain: 0.35, type: 'sawtooth', curve: 'lin', vib: { rate: 8, depth: 8 } }); });
    a.noise(o, { t, dur: 0.7, gain: 0.07, f: 2500, q: 0.4 });
  });
  A.define('groan', (a, o, t, p) => { const base = (p.pitch || 420) * 0.8; const bp = a.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 2; bp.connect(o); const tmp = a.ctx.createGain(); tmp.connect(bp); a.tone(tmp, { t, f: base, f2: base * 0.55, dur: 0.6, gain: 0.45, type: 'sawtooth', curve: 'lin', vib: { rate: 5, depth: 10 } }); });
  A.define('gasp', (a, o, t) => a.noise(o, { t, dur: 0.28, gain: 0.14, f: 900, f2: 2500, q: 0.9 }));
  A.define('meow', (a, o, t, p) => {
    const bp = a.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 5; bp.connect(o);
    bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(2300, t + 0.22); bp.frequency.linearRampToValueAtTime(1000, t + 0.55);
    const tmp = a.ctx.createGain(); tmp.connect(bp); const b = p.pitch || 620;
    const osc = a.ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(b, t); osc.frequency.linearRampToValueAtTime(b * 1.5, t + 0.2); osc.frequency.linearRampToValueAtTime(b * 0.85, t + 0.55);
    const g = a.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.06); g.gain.linearRampToValueAtTime(0.35, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.58);
    osc.connect(g); g.connect(tmp); osc.start(t); osc.stop(t + 0.6);
  });
  A.define('win', (a, o, t) => {
    const seq = [[67, 0], [72, 0.16], [76, 0.32], [79, 0.48], [84, 0.7]];
    seq.forEach(([n, d], i) => { a.tone(o, { t: t + d, f: midi(n), dur: i === 4 ? 1.4 : 0.3, gain: 0.1, type: 'sawtooth', lp: 3000 }); a.tone(o, { t: t + d, f: midi(n - 12), dur: i === 4 ? 1.4 : 0.3, gain: 0.08, type: 'triangle' }); });
    [72, 76, 79, 84, 88].forEach((n) => a.tone(o, { t: t + 0.7, f: midi(n), dur: 1.4, gain: 0.05, type: 'triangle' }));
    for (let i = 0; i < 24; i++) a.tone(o, { t: t + 0.7 + i * 0.06, f: R(2200, 4800), dur: 0.15, gain: 0.04 });
  });
  A.define('lose', (a, o, t) => {
    [[62, 0], [61, 0.5], [60, 1.0], [58, 1.5]].forEach(([n, d], i) => { const f = midi(n); const bp = a.ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 900; bp.connect(o); const tmp = a.ctx.createGain(); tmp.connect(bp); a.tone(tmp, { t: t + d, f, f2: f * (i === 3 ? 0.75 : 0.97), dur: i === 3 ? 1.1 : 0.45, gain: 0.22, type: 'sawtooth', curve: 'lin', vib: { rate: i === 3 ? 6 : 0, depth: i === 3 ? 12 : 0 } }); });
  });
  A.define('confetti', (a, o, t) => { a.noise(o, { t, dur: 0.12, gain: 0.2, f: 2000, f2: 600, q: 0.7 }); for (let i = 0; i < 6; i++) a.tone(o, { t: t + i * 0.02, f: R(1500, 3500), dur: 0.1, gain: 0.04 }); });

  installMusic(A);
}

function installMusic(A) {
  // Warm marimba/pluck groove with a bass line; lookahead scheduler so it never glitches.
  const mk = ({ bpm, chords, pattern, melodyChance }) => (a, out) => {
    const c = a.ctx; let step = 0, next = c.currentTime + 0.15, stopped = false, intensity = 0;
    const spb = () => 60 / (bpm + intensity * 14) / 2; // eighth note
    const pluck = (t, n, g, dur = 0.45, type = 'triangle') => { a.tone(out, { t, f: midi(n), dur, gain: g, type, lp: 2800 }); a.tone(out, { t, f: midi(n + 12), dur: dur * 0.5, gain: g * 0.25, type: 'sine' }); };
    const timer = setInterval(() => {
      if (stopped) return;
      while (next < c.currentTime + 0.25) {
        const bar = Math.floor(step / 8) % chords.length, pos = step % 8, ch = chords[bar];
        const idx = pattern[pos]; if (idx >= 0) pluck(next, ch.tones[idx % ch.tones.length] + (idx >= ch.tones.length ? 12 : 0), 0.085, 0.4);
        if (pos === 0) a.tone(out, { t: next, f: midi(ch.root - 12), dur: 0.7, gain: 0.2, type: 'sine' });
        if (pos === 4) a.tone(out, { t: next, f: midi(ch.root - 12 + 7), dur: 0.5, gain: 0.13, type: 'sine' });
        if (pos % 2 === 1) a.noise(out, { t: next, dur: 0.03, gain: 0.025 + intensity * 0.02, type: 'highpass', f: 6500, q: 0.4 });
        if (pos === 0 || pos === 4) a.tone(out, { t: next, f: 120, f2: 55, dur: 0.1, gain: 0.12 });
        if (pos === 2 || pos === 6) a.noise(out, { t: next, dur: 0.05, gain: 0.04, f: 1800, q: 2 });
        if (Math.random() < melodyChance && pos % 2 === 0) { const sc = ch.scale; pluck(next + spb() * 0.5, sc[Math.floor(Math.random() * sc.length)] + 12, 0.06, 0.5, 'sine'); }
        if (pos === 0 && bar === 0 && step % 32 === 0) a.tone(out, { t: next, f: midi(ch.root + 24), dur: 1.2, gain: 0.025, type: 'sine' });
        next += spb(); step++;
      }
    }, 60);
    return { stop() { stopped = true; clearInterval(timer); }, setIntensity(x) { intensity = Math.max(0, Math.min(1, x)); } };
  };
  const pent = (r) => [r, r + 2, r + 4, r + 7, r + 9];
  A.defineMusic('menu', mk({ bpm: 92, melodyChance: 0.35, pattern: [0, 1, 2, 1, 3, 2, 1, 2],
    chords: [{ root: 60, tones: [60, 64, 67, 72], scale: pent(60) }, { root: 57, tones: [57, 60, 64, 69], scale: pent(60) }, { root: 53, tones: [53, 57, 60, 65], scale: pent(60) }, { root: 55, tones: [55, 59, 62, 67], scale: pent(60) }] }));
  A.defineMusic('game', mk({ bpm: 104, melodyChance: 0.3, pattern: [0, -1, 2, 1, -1, 3, 2, 1],
    chords: [{ root: 60, tones: [60, 64, 67, 72], scale: pent(60) }, { root: 55, tones: [55, 59, 62, 67], scale: pent(60) }, { root: 57, tones: [57, 60, 64, 69], scale: pent(60) }, { root: 53, tones: [53, 57, 60, 65], scale: pent(60) }] }));
}
