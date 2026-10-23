// Slot-based asset loader. Game code asks for IDs ("bg.splash"), never filenames.
// Swap art by editing assets/manifest.json (or dropping assets/manifest.override.json).
// A missing/broken file never throws: a labelled placeholder is generated instead.
const state = { slots: {}, audio: {}, cache: new Map(), base: '' };

function placeholder(id, w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#5b2a86'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffd24a'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
  g.beginPath(); g.moveTo(8, 8); g.lineTo(w - 8, h - 8); g.moveTo(w - 8, 8); g.lineTo(8, h - 8); g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 36px sans-serif'; g.textAlign = 'center'; g.fillText(id, w / 2, h / 2);
  return c.toDataURL('image/png');
}

async function fetchJson(url) { try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch { return null; } }

export const Assets = {
  /** Load manifest (+ optional override). */
  async init(manifestUrl = 'assets/manifest.json') {
    const base = await fetchJson(manifestUrl) || { slots: {}, audio: {} };
    const over = await fetchJson(manifestUrl.replace('manifest.json', 'manifest.override.json'));
    for (const src of [base, over]) {
      if (!src) continue;
      Object.assign(state.slots, src.slots || {});
      Object.assign(state.audio, src.audio || {});
    }
    return this;
  },
  has(id) { return !!state.slots[id]; },
  /** Resolve a slot to a URL; prefers '<id>.landscape' when orientation === 'landscape'. */
  url(id, orientation) {
    const key = orientation === 'landscape' && state.slots[id + '.landscape'] ? id + '.landscape' : id;
    const s = state.slots[key];
    return s ? (typeof s === 'string' ? s : s.src) : null;
  },
  audioUrl(name) { const v = state.audio[name]; return typeof v === 'string' ? v : null; },
  audioNames() { return Object.keys(state.audio).filter((k) => !k.startsWith('_')); },
  /** Preload an image slot -> HTMLImageElement (cached, never rejects). */
  image(id, orientation) {
    const url = this.url(id, orientation) || placeholder(id);
    if (state.cache.has(url)) return state.cache.get(url);
    const p = new Promise((res) => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => res(im);
      im.onerror = () => { const f = new Image(); f.onload = () => res(f); f.src = placeholder(id); };
      im.src = url;
    });
    state.cache.set(url, p); return p;
  },
  async preload(ids, orientation) { return Promise.all(ids.map((i) => this.image(i, orientation))); },
  /** Set src / background for all [data-asset] / [data-asset-bg] elements under root. */
  bind(root = document, orientation) {
    root.querySelectorAll('[data-asset]').forEach((el) => { el.src = this.url(el.dataset.asset, orientation) || placeholder(el.dataset.asset); el.onerror = () => { el.onerror = null; el.src = placeholder(el.dataset.asset); }; });
    root.querySelectorAll('[data-asset-bg]').forEach((el) => { el.style.backgroundImage = `url("${this.url(el.dataset.assetBg, orientation) || placeholder(el.dataset.assetBg)}")`; });
  },
  list() { return Object.keys(state.slots).filter((k) => !k.startsWith('_')); },
};
