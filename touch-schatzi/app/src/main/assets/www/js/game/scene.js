// Maps "art space" layout numbers to screen pixels. The background is drawn cover + bottom-anchored,
// so anything placed with this stays glued to the table edge on every phone/tablet aspect ratio.
export class SceneFrame {
  constructor(layout) { this.layout = layout; this.update(innerWidth, innerHeight); }
  update(vw, vh) {
    this.vw = vw; this.vh = vh; this.orient = vw > vh ? 'landscape' : 'portrait';
    const [aw, ah] = this.layout.art[this.orient]; this.aw = aw; this.ah = ah;
    this.k = vw / aw; this.S = Math.max(vw / aw, vh / ah); this.offY = vh - ah * this.S; this.cfg = this.layout[this.orient];
    this.u = Math.max(0.78, Math.min(1.6, this.orient === 'portrait' ? Math.min(vw / 390, vh / 780) : Math.min(vh / 390, vw / 800)));
    return this;
  }
  X(f) { return f * this.vw; }
  Y(f) { return this.offY + f * this.ah * this.S; }
  W(f) { return f * this.aw * this.k; }
}
