// 9 点校准 + 5 点验证（px 与估计视角误差）
// 角度换算假设：视距 60 cm、CSS 像素 ≈ 0.0265 cm（96 dpi）——只是估计值，用于课堂比较
import { GazeHub } from './gaze_hub.js';
import { sleep } from '../api.js';

export const VIEW_CM = 60;
export const CM_PER_PX = 2.54 / 96;
export const pxToDeg = (px) => Math.atan((px * CM_PER_PX) / VIEW_CM) * 180 / Math.PI;
export const ERR_LIMIT_PX = 200;

function overlay(html) {
  const o = document.createElement('div');
  o.className = 'calib-overlay';
  o.innerHTML = html;
  document.body.appendChild(o);
  return o;
}

// 9 点校准：每个点注视并点击 5 次（WebGazer 用点击时刻的眼部图像训练回归）
export async function runCalibration() {
  GazeHub.clearCalibration();
  GazeHub.setTraining(true);
  GazeHub.showPreview(true);
  const o = overlay(`<div class="calib-msg"><b>校准（9 点）</b><br>请保持头部不动，<b>眼睛盯住</b>金色圆点并点击它 5 次。<br>屏幕上方的小窗是你的摄像头画面（只在本机处理，不会上传）。</div>`);
  const pts = [];
  for (const y of [0.1, 0.5, 0.9]) for (const x of [0.08, 0.5, 0.92]) pts.push([x, y]);
  pts.sort(() => Math.random() - 0.5);
  for (const [x, y] of pts) {
    await new Promise((res) => {
      const d = document.createElement('button');
      d.className = 'calib-dot'; d.style.left = (x * 100) + '%'; d.style.top = (y * 100) + '%';
      let n = 0; d.textContent = '5';
      d.onclick = () => { n++; d.textContent = String(5 - n); d.style.opacity = String(1 - n * 0.15); if (n >= 5) { d.remove(); res(); } };
      o.appendChild(d);
    });
  }
  o.remove();
  GazeHub.setTraining(false);
  return runValidation();
}

// 5 点验证：每点注视 1.8 秒，取后 1.2 秒预测的中位数与目标点的距离
export async function runValidation({ quick = false } = {}) {
  GazeHub.showPreview(false);
  GazeHub.setTraining(false);
  const o = overlay(`<div class="calib-msg"><b>${quick ? '快速验证' : '验证（5 点）'}</b><br>只需<b>看着</b>出现的圆点，不要点击。</div>`);
  const targets = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]];
  const per = [];
  GazeHub.resetStats();
  await sleep(800);
  for (const [tx, ty] of targets) {
    const d = document.createElement('div');
    d.className = 'calib-dot val'; d.style.left = (tx * 100) + '%'; d.style.top = (ty * 100) + '%';
    o.appendChild(d);
    const W = window.innerWidth, H = window.innerHeight, px = tx * W, py = ty * H;
    const got = [];
    const t0 = performance.now();
    const fn = (c) => { if (performance.now() - t0 > 600) got.push([c.x, c.y]); };
    GazeHub.listeners.add(fn);
    await sleep(quick ? 1400 : 1800);
    GazeHub.listeners.delete(fn);
    d.remove();
    if (got.length) {
      const med = (a) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
      const mx = med(got.map(g => g[0])), my = med(got.map(g => g[1]));
      per.push({ tx: +tx.toFixed(2), ty: +ty.toFixed(2), err: Math.hypot(mx - px, my - py), n: got.length });
    } else per.push({ tx, ty, err: null, n: 0 });
  }
  o.remove();
  const valid = per.filter(p => p.err !== null);
  const err = valid.length ? valid.reduce((a, p) => a + p.err, 0) / valid.length : null;
  return {
    ok: err !== null && err <= ERR_LIMIT_PX && valid.length >= 3,
    err_px: err, err_deg: err !== null ? pxToDeg(err) : null,
    hz: GazeHub.hz(), face_loss: GazeHub.faceLoss(), n_points: valid.length, per,
    screen: [window.innerWidth, window.innerHeight],
  };
}
