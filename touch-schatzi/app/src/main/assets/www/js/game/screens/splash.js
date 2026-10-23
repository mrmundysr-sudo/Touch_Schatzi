import { Assets } from '../../lib/assets.js';
import { h, sleep } from '../../lib/util.js';

export class SplashScreen {
  constructor(app) { this.app = app; }
  mount(host) {
    const u = Assets.url('bg.splash');
    this.root = h('div.screen.splash', h('div.sp-blur', { style: { backgroundImage: `url("${u}")` } }),
      this.art = h('div.sp-art', { style: { backgroundImage: `url("${u}")` } }, h('div.sp-shine'), h('div.sp-btnglow'), h('div.sp-sparks', [...Array(14)].map((_, i) => h('i', { style: { '--x': `${6 + (i * 37) % 88}%`, '--y': `${3 + (i * 23) % 20}%`, '--d': `${(i * 0.37) % 2.4}s`, '--s': `${8 + (i * 5) % 14}px` } })))),
      h('div.sp-fade'));
    host.append(this.root);
    this.root.addEventListener('pointerdown', () => this.skip()); this._done = false;
    this.run();
  }
  async run() {
    this.app.audio.unlock(); this.app.audio.playMusic('menu');
    await Promise.all([sleep(3400), Assets.preload(['bg.menu', 'bg.gameplay', 'ui.slotMachine', 'ui.slotLever', 'ui.scorecard', 'char.girl', 'char.boy', 'char.cat', 'bg.scorecard'], 'portrait')]);
    this.skip();
  }
  skip() { if (this._done) return; this._done = true; this.app.showMenu(true); }
  destroy() { this.root?.remove(); }
}
