// One-Euro 滤波（Casiez, Roussel & Vogel, CHI 2012）：低速时强平滑抑制抖动，高速时降低延迟
class LowPass {
  constructor() { this.y = null; this.s = null; }
  filter(x, a) { this.s = this.s === null ? x : a * x + (1 - a) * this.s; this.y = x; return this.s; }
}
const alpha = (cutoff, dt) => { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); };

export class OneEuro {
  constructor({ minCutoff = 0.6, beta = 0.004, dCutoff = 1.0 } = {}) {
    Object.assign(this, { minCutoff, beta, dCutoff });
    this.x = new LowPass(); this.dx = new LowPass(); this.t = null;
  }
  reset() { this.x = new LowPass(); this.dx = new LowPass(); this.t = null; }
  filter(v, tMs) {
    const dt = this.t === null ? 1 / 30 : Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const prev = this.x.s;
    const d = prev === null ? 0 : (v - prev) / dt;
    const ed = this.dx.filter(d, alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(ed);
    return this.x.filter(v, alpha(cutoff, dt));
  }
}

export class OneEuro2D {
  constructor(opts) { this.fx = new OneEuro(opts); this.fy = new OneEuro(opts); }
  reset() { this.fx.reset(); this.fy.reset(); }
  filter(x, y, t) { return [this.fx.filter(x, t), this.fy.filter(y, t)]; }
}
