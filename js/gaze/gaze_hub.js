// GazeHub：摄像头眼动这一层（WebGazer.js + 自托管 MediaPipe FaceMesh）
// 资源全部相对页面定位（vendor/ 目录），因此放在 GitHub Pages 的子路径下也能用。
// 摄像头视频只在本地浏览器内处理，任何时候都不上传；上传的只是每试次的聚合值。
import { OneEuro2D } from './one_euro.js';

const SAMPLE_MS = 66;          // ≈15 Hz 降采样（原项目同参数）
const STALE_MS = 400;          // 超过该时长没有预测 → 记为人脸丢失

// 页面所在目录（index.html 同目录），不依赖站点根路径
const asset = (p) => new URL(p, document.baseURI).href;

// WebGazer 的 FaceMesh 求解器需要这 5 个文件同时在 solutionPath 目录下。
// 其中 face_mesh.binarypb 是「计算图」，最容易漏：少了它 wasm 会在 loadGraph 里 abort(undefined)，
// 报错信息完全看不出原因（这个坑踩过）。
const FACE_MESH_FILES = [
  'face_mesh.binarypb',
  'face_mesh_solution_packed_assets_loader.js',
  'face_mesh_solution_packed_assets.data',
  'face_mesh_solution_simd_wasm_bin.js',
  'face_mesh_solution_simd_wasm_bin.wasm',
];
// 与本仓库 vendor 的资产同版本（.data 3986256 / simd .wasm 6161697 可对上）
const FACE_MESH_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619';

// 挑出缺失的文件（只用 HEAD，失败就当「取不到」而不是「缺」）
async function missingAssets(base) {
  const root = base.replace(/\/+$/, '');
  const bad = [];
  await Promise.all(FACE_MESH_FILES.map(async (f) => {
    try {
      const r = await fetch(root + '/' + f, { method: 'HEAD' });
      if (!r.ok) bad.push(f + ' → HTTP ' + r.status);
    } catch (e) { /* 服务器不支持 HEAD 时交由实际加载报错 */ }
  }));
  return bad;
}

// 优先自托管；部署漏了文件就退到 CDN，别让整个眼动层直接挂掉
async function resolveSolutionPath(local) {
  const bad = await missingAssets(local);
  if (!bad.length) return local;
  console.warn('[GazeHub] 本地 FaceMesh 资产缺失（' + bad.join('，') + '），改用 CDN');
  const cdnBad = await missingAssets(FACE_MESH_CDN);
  if (cdnBad.length) {
    throw new Error('FaceMesh 模型文件缺失且 CDN 也不可用：' + bad.concat(cdnBad).join('，'));
  }
  return FACE_MESH_CDN;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.webgazer) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('脚本加载失败：' + src));
    document.head.appendChild(s);
  });
}

export const GazeHub = {
  mode: null,            // 'webgazer' | null
  cur: null,             // 最新（滤波后）注视点 {x, y, t}（视口像素）
  wg: null,
  filter: new OneEuro2D({ minCutoff: 0.6, beta: 0.004 }),
  stats: { frames: 0, nulls: 0, times: [] },
  rec: null,
  listeners: new Set(),

  hasCameraApi() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },

  // 启动 WebGazer。失败（无摄像头 / 拒绝授权 / 模型加载失败）时抛错，由调用方决定是否继续无眼动
  async startWebGazer() {
    if (!this.hasCameraApi()) throw new Error('浏览器不支持摄像头接口（需 HTTPS 或 localhost）');
    await loadScript(asset('vendor/webgazer/webgazer.js'));
    const wg = window.webgazer;
    // 关键：WebGazer 默认相对页面路径找 FaceMesh（./mediapipe/face_mesh），这里显式指向自托管目录
    // （用绝对 URL，避免 worker 内相对路径解析出错）
    wg.params.faceMeshSolutionPath = await resolveSolutionPath(asset('vendor/webgazer/mediapipe/face_mesh'));
    wg.params.showVideoPreview = true;
    wg.saveDataAcrossSessions(false);
    wg.applyKalmanFilter(false);          // 用我们自己的 One-Euro
    wg.setRegression('ridge');
    let failed = null;
    wg.setGazeListener((data) => {
      const now = performance.now();
      this.stats.frames++;
      if (!data) { this.stats.nulls++; return; }
      this.stats.times.push(now);
      if (this.stats.times.length > 120) this.stats.times.shift();
      const [fx, fy] = this.filter.filter(data.x, data.y, now);
      this.cur = { x: fx, y: fy, t: now };
      this.listeners.forEach((f) => f(this.cur));
    });
    await wg.begin(() => { failed = new Error('摄像头不可用或被拒绝'); });
    if (failed) throw failed;
    // 等待第一帧人脸模型就绪（最多 25 秒）
    const t0 = performance.now();
    while (performance.now() - t0 < 25000) {
      if (this.stats.frames > 3) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (this.stats.frames <= 3) throw new Error('人脸模型初始化超时（模型文件可能没加载到）');
    wg.showPredictionPoints(false);
    this.wg = wg; this.mode = 'webgazer';
    return wg;
  },

  showPreview(on) {
    if (!this.wg) return;
    try { this.wg.showVideo(on); this.wg.showFaceOverlay(on); this.wg.showFaceFeedbackBox(on); } catch (e) { /* ignore */ }
    // WebGazer 默认把预览放在左上角且 z-index 很高，会挡住左上角的校准点；缩小并移到上/中两排之间
    if (on) {
      try { this.wg.setVideoViewerSize(240, 180); } catch (e) { /* ignore */ }
      const c = document.getElementById('webgazerVideoContainer');
      if (c) Object.assign(c.style, { left: '50%', top: '30%', transform: 'translate(-50%,-50%)', borderRadius: '10px', overflow: 'hidden' });
    }
  },
  setTraining(on) {   // 校准阶段允许点击训练；实验阶段关闭，避免点击/移动污染模型
    if (!this.wg) return;
    try { on ? this.wg.addMouseEventListeners() : this.wg.removeMouseEventListeners(); } catch (e) { /* ignore */ }
  },
  clearCalibration() { if (this.wg) { try { this.wg.clearData(); } catch (e) { /* ignore */ } } this.filter.reset(); },

  // 最近 2 秒的有效预测频率
  hz() {
    if (this.mode !== 'webgazer') return 0;
    const ts = this.stats.times, now = performance.now();
    const recent = ts.filter((t) => now - t < 2000);
    return recent.length / 2;
  },
  faceLoss() { const s = this.stats; return s.frames ? s.nulls / s.frames : 1; },
  resetStats() { this.stats = { frames: 0, nulls: 0, times: [] }; },

  // 开始记录：stage 需提供 toNorm(clientX, clientY) → [x,y]（舞台 0-1）
  startRecording(stage) {
    this.stopRecording();
    this.resetStats();
    const t0 = performance.now();
    const rec = { stage, t0, samples: [], lost: 0, ticks: 0 };
    rec.timer = setInterval(() => {
      const now = performance.now();
      rec.ticks++;
      const c = this.cur;
      if (!c || (this.mode === 'webgazer' && now - c.t > STALE_MS)) {
        rec.lost++;
        rec.samples.push([Math.round(now - t0), -1, -1]);
        return;
      }
      const [x, y] = stage.toNorm(c.x, c.y);
      rec.samples.push([Math.round(now - t0), +x.toFixed(4), +y.toFixed(4)]);
    }, SAMPLE_MS);
    this.rec = rec;
    return t0;
  },
  stopRecording() {
    const rec = this.rec;
    if (!rec) return null;
    clearInterval(rec.timer);
    this.rec = null;
    const durS = Math.max(0.001, (performance.now() - rec.t0) / 1000);
    return {
      samples: rec.samples,
      hz: this.mode === 'webgazer' ? (this.stats.frames - this.stats.nulls) / durS : 0,
      face_loss: this.mode === 'webgazer' ? (this.stats.frames ? this.stats.nulls / this.stats.frames : 1) : 1,
      lost_share: rec.ticks ? rec.lost / rec.ticks : 0,
    };
  },
  // 记录中的相对时间（ms）
  now() { return this.rec ? performance.now() - this.rec.t0 : 0; },
};
