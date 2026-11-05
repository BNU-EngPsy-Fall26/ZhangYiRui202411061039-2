// 全屏 16:9 实验舞台：逻辑坐标 1600x900，自动留黑边；鼠标坐标归一化到舞台 0-1
export const SW = 1600, SH = 900;

export class Stage {
  constructor() {
    const root = document.createElement('div');
    root.className = 'stage-root';
    root.innerHTML = '<div class="stage-box"><canvas></canvas><div class="hud"></div></div>';
    document.body.appendChild(root);
    this.root = root; this.box = root.querySelector('.stage-box');
    this.canvas = root.querySelector('canvas'); this.ctx = this.canvas.getContext('2d');
    this.hud = root.querySelector('.hud');
    this._onResize = () => this.resize(); window.addEventListener('resize', this._onResize);
    this.resize();
  }
  resize() {
    const vw = window.innerWidth, vh = window.innerHeight - (this.reserve || 0);  // 触屏模式下底部让给反应按钮
    let w = vw, h = vw * SH / SW; if (h > vh) { h = vh; w = vh * SW / SH; }
    Object.assign(this.box.style, { width: w + 'px', height: h + 'px', left: (vw - w) / 2 + 'px', top: (vh - h) / 2 + 'px' });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.scale = w / SW;
    this.ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, 0, 0);
  }
  reserveBottom(px) { this.reserve = Math.max(0, px || 0); this.resize(); }
  rect() { return this.box.getBoundingClientRect(); }
  toNorm(cx, cy) {
    const r = this.rect();
    const x = (cx - r.left) / r.width, y = (cy - r.top) / r.height;
    if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) return [1.2, 1.2]; // 舞台外
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
  }
  toStage(cx, cy) { const [x, y] = this.toNorm(cx, cy); return [x * SW, y * SH]; }
  setHud(html) { this.hud.innerHTML = html; }
  destroy() { window.removeEventListener('resize', this._onResize); this.root.remove(); }
}
