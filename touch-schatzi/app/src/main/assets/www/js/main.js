// App shell: boot, settings, screen manager, audio unlock, Android back button.
import { Assets } from './lib/assets.js';
import { AudioEngine } from './lib/audio.js';
import { Haptics } from './lib/haptics.js';
import { store } from './lib/util.js';
import { installSounds } from './game/sounds.js';
import { loadCharacters } from './game/characters.js';
import { SplashScreen } from './game/screens/splash.js';
import { MenuScreen } from './game/screens/menu.js';
import { PlayScreen } from './game/screens/play.js';
import { ResultsScreen } from './game/screens/results.js';

const j = async (u) => (await fetch(u)).json();
const DEFAULTS = { name: '', difficulty: 'medium', opponents: ['lily', 'scoobert', 'max'], trash: true, music: true, sfx: true, hints: false, fast: false, chatty: 'normal' };

export const App = {
  audio: new AudioEngine(), screen: null, onBack: null,
  settings: { ...DEFAULTS, ...store.get('settings', {}), best: store.get('best', 0) },
  async boot() {
    this.host = document.getElementById('app');
    await Assets.init('assets/manifest.json');
    [this.cfg, this.layout, this.cardLayout, this.trashData] = await Promise.all([j('config/game.json'), j('config/layout.json'), j('config/scorecard.json'), j('config/trashtalk.json')]);
    await loadCharacters('config/characters.json');
    installSounds(this.audio); this.applyAudioSettings();
    const unlock = () => { this.audio.unlock(); this.audio.loadSamples(Object.fromEntries(Assets.audioNames().map((n) => [n, Assets.audioUrl(n)]))); };
    ['pointerdown', 'touchstart', 'keydown'].forEach((e) => addEventListener(e, unlock, { passive: true }));
    try { unlock(); } catch { /* needs gesture on plain browsers */ }
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.audio.ctx?.suspend?.(); else this.audio.ctx?.resume?.(); });
    window.TS = { app: this, onBack: () => (this.onBack ? this.onBack() : false),
      setPaused: (p) => { try { this.audio.ctx?.[p ? 'suspend' : 'resume']?.(); if (p && this.screen?.game && this.screen.pause) this.screen.pause(true); } catch { /* ignore */ } } };
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.getElementById('boot')?.remove();
    const q = new URLSearchParams(location.search); const go = q.get('screen');
    if (go === 'menu') this.showMenu(); else if (go === 'play') this.startGame({ opponents: (q.get('opp') || 'lily,scoobert,max').split(',').filter(Boolean), difficulty: q.get('diff') || 'medium' }); else this.swap(new SplashScreen(this));
  },
  setSetting(k, v) { this.settings[k] = v; const { best, ...rest } = this.settings; store.set('settings', rest); if (k === 'music' || k === 'sfx') this.applyAudioSettings(); if (k === 'haptics') Haptics.setEnabled(v); },
  applyAudioSettings() { this.audio.setEnabled('music', this.settings.music !== false); this.audio.setEnabled('sfx', this.settings.sfx !== false); },
  swap(next) {
    const old = this.screen; this.screen = next; next.mount(this.host);
    if (old) { old.root?.classList.add('leaving'); setTimeout(() => old.destroy(), 380); }
  },
  showMenu() { this.audio.stopMusic?.(); this.swap(new MenuScreen(this)); this.audio.playMusic('menu'); },
  startGame(setup) { const s = new PlayScreen(this, setup); this.swap(s); this.audio.stopMusic(); s.start().catch((e) => console.error(e)); },
  showResults(res) { this.swap(new ResultsScreen(this, res)); },
};
App.boot().catch((e) => { console.error(e); const b = document.getElementById('boot'); if (b) b.textContent = 'Failed to start: ' + e.message; });

