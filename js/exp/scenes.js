// 程序化绘制的实验场景（1600x900 逻辑坐标）。实验页与教师大屏热图背景共用。
import { seededRandom } from '../api.js';
import { CB2 } from './cb_scenes2.js';

const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
const txt = (ctx, s, x, y, { size = 20, color = '#fff', align = 'center', weight = '500', base = 'middle' } = {}) => {
  ctx.font = `${weight} ${size}px "PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y);
};
function car(ctx, x, y, w, h, color, { lights = false } = {}) {
  ctx.fillStyle = color; rr(ctx, x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.18); ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,.55)'; rr(ctx, x - w * 0.36, y - h * 0.42, w * 0.72, h * 0.32, 4); ctx.fill();
  ctx.fillStyle = lights ? '#fff6c0' : '#d33';
  ctx.fillRect(x - w * 0.45, y + h * 0.2, w * 0.14, h * 0.12); ctx.fillRect(x + w * 0.31, y + h * 0.2, w * 0.14, h * 0.12);
}

// ======================= 驾驶场景（单屏五通道，仿郑老师 & McConkie 模拟器布局）=======================
// 挡风玻璃（上 2/3）+ 车内后视镜（右上）+ 左/右侧后视镜（左下/右下）+ 车速表（底部中央）
// st: {t, events:[{aoi,onset,dur,side}], speed}
function mirrorView(ctx, x, y, w, h, flip, cars) {
  ctx.save(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#a9c1d6'); g.addColorStop(0.45, '#d5e0e8'); g.addColorStop(0.46, '#8a8f97'); g.addColorStop(1, '#5d6168');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const hy = y + h * 0.46, vx = flip ? x + w * 0.75 : x + w * 0.25;
  ctx.fillStyle = '#4a4e57'; ctx.beginPath(); ctx.moveTo(vx - 8, hy); ctx.lineTo(vx + 8, hy); ctx.lineTo(flip ? x : x + w, y + h); ctx.lineTo(flip ? x + w * 0.55 : x + w * 0.45, y + h); ctx.fill();
  ctx.fillStyle = '#9aa0a8'; for (let i = 0; i < 4; i++) ctx.fillRect(flip ? x + w * 0.85 - i * 22 : x + w * 0.1 + i * 22, hy - 30 - i * 6, 18, 30 + i * 6);
  for (const c of cars) car(ctx, c[0], c[1], c[2], c[2] * 0.62, c[3], { lights: true });
  ctx.restore();
  ctx.strokeStyle = '#0b0d11'; ctx.lineWidth = 10; rr(ctx, x, y, w, h, 18); ctx.stroke();
}
export function drawDriving(ctx, st = {}) {
  const t = st.t || 0, evs = st.events || [];
  const active = (aoi) => evs.filter(e => e.aoi === aoi && t >= e.onset && t <= e.onset + e.dur);
  // —— 挡风玻璃：天空/建筑（"其他"）+ 道路 ——
  const sky = ctx.createLinearGradient(0, 0, 0, 260); sky.addColorStop(0, '#6f98c6'); sky.addColorStop(1, '#cfdde9');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1600, 600);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (const [cx, cy, s] of [[260, 80, 1], [620, 60, 1.3], [1450, 110, .9], [1050, 200, .7]]) { const dx = ((t / 120) % 1800); ctx.beginPath(); ctx.ellipse((cx + dx) % 1800 - 100, cy, 90 * s, 28 * s, 0, 0, 7); ctx.fill(); }
  const bcol = ['#9aa7b8', '#b7ab98', '#8f9db0', '#c4b9a7', '#a6b2a2'];
  for (let i = 0; i < 6; i++) { const x = i * 55, h = 160 + (i % 3) * 70; ctx.fillStyle = bcol[i % 5]; ctx.fillRect(x, 300 - h, 52, h + 2); ctx.fillStyle = 'rgba(40,60,90,.45)'; for (let yy = 310 - h; yy < 290; yy += 22) ctx.fillRect(x + 8, yy, 36, 10); }
  for (let i = 0; i < 6; i++) { const x = 1600 - (i + 1) * 58, h = 150 + (i % 3) * 80; ctx.fillStyle = bcol[(i + 2) % 5]; ctx.fillRect(x, 300 - h, 56, h + 2); ctx.fillStyle = 'rgba(40,60,90,.45)'; for (let yy = 310 - h; yy < 290; yy += 22) ctx.fillRect(x + 8, yy, 40, 10); }
  ctx.fillStyle = '#8c9a7c'; ctx.fillRect(0, 300, 1600, 300);
  ctx.fillStyle = '#4a4e57'; ctx.beginPath(); ctx.moveTo(760, 300); ctx.lineTo(840, 300); ctx.lineTo(1420, 600); ctx.lineTo(180, 600); ctx.fill();
  const off = ((t / 9) % 60) / 60;
  ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 3;
  for (const lane of [-1, 1]) for (let k = 0; k < 9; k++) {
    const z0 = (k + off) / 9, z1 = (k + off + 0.45) / 9, y0 = 300 + 300 * z0 * z0, y1 = 300 + 300 * z1 * z1;
    const xAt = (y) => 800 + lane * (14 + (y - 300) / 300 * 200);
    ctx.beginPath(); ctx.moveTo(xAt(y0), y0); ctx.lineTo(xAt(y1), y1); ctx.stroke();
  }
  ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(770, 300); ctx.lineTo(300, 600); ctx.stroke();
  car(ctx, 800, 360, 64, 40, '#5b6b84');
  for (const e of active('road')) {
    const p = (t - e.onset) / e.dur, side = e.side || 1, y = 430 + 25 * p, x = 800 + side * 250 * (1 - Math.min(1, p * 1.4) * 0.85);
    car(ctx, x, y, 110, 70, '#6d7380');
    ctx.fillStyle = '#f5a623'; ctx.globalAlpha = (Math.floor(t / 250) % 2) ? 0.9 : 0.2; ctx.fillRect(x - side * 52 - 6, y + 8, 12, 10); ctx.globalAlpha = 1;
  }
  // —— 车内后视镜（右上）——
  const rv = active('rearview')[0];
  const rp = rv ? (t - rv.onset) / rv.dur : 0;
  mirrorView(ctx, 860, 20, 480, 150, false, rv ? [[1100, 95 + 20 * rp, 40 + 70 * rp, '#3c4555']] : [[1100, 88, 26, '#7a7f88']]);
  // —— 仪表台 ——
  ctx.fillStyle = '#2a2f38'; ctx.fillRect(0, 600, 1600, 300);
  ctx.fillStyle = '#353b45'; ctx.beginPath(); ctx.moveTo(0, 600); ctx.quadraticCurveTo(800, 560, 1600, 600); ctx.lineTo(1600, 640); ctx.quadraticCurveTo(800, 600, 0, 640); ctx.fill();
  // 左右侧后视镜
  const ml = active('mirror_l')[0], mr = active('mirror_r')[0];
  mirrorView(ctx, 20, 640, 330, 230, false, ml ? [[120 + 80 * ((t - ml.onset) / ml.dur), 790, 70 + 50 * ((t - ml.onset) / ml.dur), '#5a2d3a']] : []);
  mirrorView(ctx, 1250, 640, 330, 230, true, mr ? [[1480 - 80 * ((t - mr.onset) / mr.dur), 790, 70 + 50 * ((t - mr.onset) / mr.dur), '#2d4a5a']] : []);
  // 车速表（底部中央）
  let speed = st.speed ?? (62 + 4 * Math.sin(t / 1300));
  if (active('speedo').length) speed = 112 + 4 * Math.sin(t / 200);
  const cx = 800, cy = 765, R = 118;
  ctx.fillStyle = '#9ea3ab'; rr(ctx, 615, 625, 370, 265, 14); ctx.fill();
  ctx.fillStyle = '#0d0f13'; ctx.beginPath(); ctx.arc(cx, cy, R + 10, 0, 7); ctx.fill();
  ctx.strokeStyle = '#d9dde3'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, 7); ctx.stroke();
  const ang = (v) => Math.PI * 0.75 + (v / 160) * Math.PI * 1.5;
  ctx.strokeStyle = '#a33'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R - 8, ang(100), ang(160)); ctx.stroke();
  for (let v = 0; v <= 160; v += 20) { const a = ang(v); txt(ctx, String(v), cx + Math.cos(a) * (R - 32), cy + Math.sin(a) * (R - 32), { size: 15, color: '#e6e9ee' }); }
  ctx.strokeStyle = '#e53935'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang(speed)) * (R - 12), cy + Math.sin(ang(speed)) * (R - 12)); ctx.stroke();
  ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 7); ctx.fill();
  txt(ctx, 'km/h', cx, cy + 42, { size: 15, color: '#c9ced6' });
  txt(ctx, '限速 100', cx, cy + 66, { size: 13, color: '#9aa3b0' });
}

// ======================= 座舱六块仪表 =======================
export const COCKPIT_LAYOUT = {
  asi: [400, 260], ai: [800, 260], alt: [1200, 260], tc: [400, 640], hi: [800, 640], vsi: [1200, 640],
};
const CK_LABEL = { asi: '空速表', ai: '姿态仪', alt: '高度表', tc: '转弯协调仪', hi: '航向仪', vsi: '升降速度表' };
// st: {vals:{k: -1..1 归一化偏差}, alarm:{k:bool}, flash:{k:t}}
export function drawCockpit(ctx, st = {}) {
  ctx.fillStyle = '#20252c'; ctx.fillRect(0, 0, 1600, 900);
  ctx.fillStyle = '#2a3038'; rr(ctx, 170, 40, 1260, 820, 30); ctx.fill();
  for (const [k, [cx, cy]] of Object.entries(COCKPIT_LAYOUT)) {
    const v = (st.vals && st.vals[k]) || 0, R = 150;
    ctx.fillStyle = '#0c0f13'; ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, Math.PI * 2); ctx.fill();
    if (k === 'ai') {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(v * 0.75);
      ctx.fillStyle = '#3d7fc4'; ctx.fillRect(-R * 2, -R * 2, R * 4, R * 2);
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-R * 2, 0, R * 4, R * 2);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx - 70, cy); ctx.lineTo(cx - 20, cy); ctx.lineTo(cx, cy + 16); ctx.lineTo(cx + 20, cy); ctx.lineTo(cx + 70, cy); ctx.stroke();
      ctx.strokeStyle = '#c33'; ctx.lineWidth = 8;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx, cy, R - 6, -Math.PI / 2 + s * 0.55, -Math.PI / 2 + s * 0.9, s < 0); ctx.stroke(); }
    } else {
      ctx.fillStyle = '#111419'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      const a0 = Math.PI * 0.75, span = Math.PI * 1.5, ang = (u) => a0 + (u + 1) / 2 * span;
      ctx.strokeStyle = '#2f7d3a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx, cy, R - 18, ang(-0.6), ang(0.6)); ctx.stroke();
      ctx.strokeStyle = '#b02a2a'; ctx.beginPath(); ctx.arc(cx, cy, R - 18, ang(0.75), ang(1)); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R - 18, ang(-1), ang(-0.75)); ctx.stroke();
      ctx.strokeStyle = '#cfd6e0'; ctx.lineWidth = 2;
      for (let i = 0; i <= 10; i++) { const a = ang(-1 + i * 0.2); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - 34), cy + Math.sin(a) * (R - 34)); ctx.lineTo(cx + Math.cos(a) * (R - 46), cy + Math.sin(a) * (R - 46)); ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang(v)) * (R - 30), cy + Math.sin(ang(v)) * (R - 30)); ctx.stroke();
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    }
    if (st.flash && st.flash[k] && performance.now() - st.flash[k] < 350) { ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, R + 16, 0, Math.PI * 2); ctx.stroke(); }
    txt(ctx, CK_LABEL[k], cx, cy + R + 32, { size: 18, color: '#b8c2d2' });
  }
}

// ======================= 变化盲场景（8 个） =======================
function bgClutter(ctx, rnd, n, box, palette) {
  for (let i = 0; i < n; i++) {
    const x = box[0] + rnd() * box[2], y = box[1] + rnd() * box[3], s = 10 + rnd() * 30;
    ctx.fillStyle = palette[Math.floor(rnd() * palette.length)];
    rr(ctx, x, y, s * (1 + rnd()), s, 4); ctx.fill();
  }
}
const CB = {
  street(ctx, ch) {
    const r = seededRandom('street');
    const g = ctx.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, '#9cc3e6'); g.addColorStop(1, '#dbe9f3'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1600, 420);
    for (let i = 0; i < 12; i++) { const x = i * 140 - 20, h = 180 + r() * 200; ctx.fillStyle = ['#b7a58c', '#8f9fb3', '#c9b8a8', '#a4b0a0'][i % 4]; ctx.fillRect(x, 420 - h, 130, h);
      ctx.fillStyle = 'rgba(40,60,90,.55)'; for (let yy = 440 - h; yy < 400; yy += 34) for (let xx = x + 12; xx < x + 118; xx += 30) ctx.fillRect(xx, yy, 18, 20); }
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(0, 420, 1600, 480); ctx.fillStyle = '#9a9a96'; ctx.fillRect(0, 420, 1600, 40); ctx.fillRect(0, 840, 1600, 60);
    ctx.fillStyle = '#eee'; for (let x = 0; x < 1600; x += 120) ctx.fillRect(x, 640, 60, 8);
    car(ctx, 300, 560, 180, 90, '#2d5d8a'); car(ctx, 1220, 720, 200, 100, '#d9d4c7'); car(ctx, 1420, 560, 160, 84, '#3b3b3b'); car(ctx, 140, 760, 200, 100, '#7a1f2b');
    ctx.fillStyle = ch ? '#2f6db3' : '#c8462f'; rr(ctx, 650, 390, 310, 170, 16); ctx.fill();
    ctx.fillStyle = 'rgba(25,35,50,.7)'; for (let x = 670; x < 940; x += 56) ctx.fillRect(x, 410, 44, 50);
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(710, 560, 22, 0, 7); ctx.arc(900, 560, 22, 0, 7); ctx.fill();
    txt(ctx, '108 路', 805, 500, { size: 26, color: '#fff', weight: '700' });
    for (let i = 0; i < 9; i++) { const x = 60 + r() * 1480; ctx.fillStyle = '#3d3d3d'; ctx.fillRect(x, 400 - 10, 6, 50); ctx.fillStyle = ['#e2b','#2a8','#e93','#46c'][i % 4]; ctx.beginPath(); ctx.arc(x + 3, 380, 12, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#2f6b2f'; for (const x of [80, 560, 1080, 1520]) { ctx.beginPath(); ctx.arc(x, 380, 50, 0, 7); ctx.fill(); }
  },
  dash(ctx, ch) {
    ctx.fillStyle = '#111317'; ctx.fillRect(0, 0, 1600, 900);
    ctx.fillStyle = '#1d2128'; rr(ctx, 60, 120, 1480, 700, 60); ctx.fill();
    for (const [x, lab] of [[420, 'km/h'], [1180, 'r/min']]) { ctx.strokeStyle = '#3b4352'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(x, 430, 210, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke(); ctx.strokeStyle = '#e7e7e7'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, 430); ctx.lineTo(x + 120, 300); ctx.stroke(); txt(ctx, lab, x, 520, { size: 28, color: '#9aa6b8' }); }
    ctx.fillStyle = '#0b1622'; rr(ctx, 660, 260, 280, 340, 20); ctx.fill(); txt(ctx, 'D', 800, 380, { size: 90, color: '#e0e6ef', weight: '700' }); txt(ctx, '续航 412 km', 800, 500, { size: 26, color: '#8fb8e0' });
    const lights = [['#e33', 180], ['#fb3', 260], ['#3c6', 340], ['#39f', 420], ['#fb3', 1100], ['#e33', 1180], ['#3c6', 1260], ['#39f', 1340]];
    for (const [c, x] of lights) { ctx.fillStyle = c; rr(ctx, x, 690, 50, 40, 8); ctx.fill(); }
    txt(ctx, '23.5°C', 800, 700, { size: 30, color: '#cfd6e0' });
    if (!ch) { ctx.fillStyle = '#f5b400'; ctx.beginPath(); ctx.moveTo(1445, 775); ctx.lineTo(1470, 815); ctx.lineTo(1420, 815); ctx.fill(); txt(ctx, '!', 1445, 802, { size: 22, color: '#111', weight: '800' }); }
  },
  web(ctx, ch) {
    ctx.fillStyle = '#f4f5f7'; ctx.fillRect(0, 0, 1600, 900);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1600, 80); txt(ctx, '优选商城', 120, 40, { size: 30, color: '#d23', weight: '800' });
    ['首页', '分类', '秒杀', '会员', '客服'].forEach((s, i) => txt(ctx, s, 520 + i * 130, 40, { size: 22, color: '#444' }));
    ctx.fillStyle = '#e8edf5'; rr(ctx, 1260, 22, 260, 36, 18); ctx.fill();
    ctx.fillStyle = '#dfe7f2'; rr(ctx, 560, 120, 480, 300, 16); ctx.fill();
    ctx.fillStyle = '#8fb0d8'; ctx.beginPath(); ctx.arc(800, 270, 100, 0, 7); ctx.fill(); txt(ctx, '降噪耳机 Pro', 800, 455, { size: 34, color: '#222', weight: '700' }); txt(ctx, '¥ 899', 800, 495, { size: 28, color: '#d23', weight: '700' });
    ctx.fillStyle = ch ? '#2a9d55' : '#f07a1a'; rr(ctx, 640, 530, 320, 70, 35); ctx.fill(); txt(ctx, '立即购买', 800, 565, { size: 30, color: '#fff', weight: '700' });
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#fff'; rr(ctx, 120 + i * 350, 660, 310, 200, 12); ctx.fill(); ctx.fillStyle = '#e3e8ef'; ctx.fillRect(140 + i * 350, 680, 270, 110); txt(ctx, '推荐商品 ' + (i + 1), 275 + i * 350, 825, { size: 20, color: '#555' }); }
    ctx.fillStyle = '#fff'; rr(ctx, 60, 120, 400, 480, 12); ctx.fill(); ['数码', '家电', '服饰', '美妆', '图书', '运动', '食品'].forEach((s, i) => txt(ctx, s, 120, 165 + i * 62, { size: 22, color: '#555', align: 'left' }));
    ctx.fillStyle = '#fff'; rr(ctx, 1140, 120, 400, 480, 12); ctx.fill(); txt(ctx, '限时优惠', 1340, 160, { size: 24, color: '#d23', weight: '700' });
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#eef1f6'; ctx.fillRect(1170, 200 + i * 95, 340, 75); }
  },
  room(ctx, ch) {
    ctx.fillStyle = '#e9dfcf'; ctx.fillRect(0, 0, 1600, 600); ctx.fillStyle = '#9c7b58'; ctx.fillRect(0, 600, 1600, 300);
    ctx.fillStyle = '#bcd3e6'; ctx.fillRect(1050, 90, 380, 300); ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.strokeRect(1050, 90, 380, 300); ctx.beginPath(); ctx.moveTo(1240, 90); ctx.lineTo(1240, 390); ctx.stroke();
    if (!ch) { ctx.fillStyle = '#6b4a2e'; ctx.fillRect(100, 100, 150, 110); ctx.fillStyle = '#d9b26a'; ctx.fillRect(112, 112, 126, 86); ctx.fillStyle = '#5e8c4a'; ctx.beginPath(); ctx.moveTo(112, 198); ctx.lineTo(170, 140); ctx.lineTo(238, 198); ctx.fill(); }
    ctx.fillStyle = '#5d6f8c'; rr(ctx, 380, 420, 760, 260, 30); ctx.fill(); ctx.fillStyle = '#6f82a1'; rr(ctx, 410, 380, 700, 120, 30); ctx.fill();
    ctx.fillStyle = '#c7a37a'; rr(ctx, 560, 720, 480, 60, 10); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillRect(1380, 420, 12, 300); ctx.fillStyle = '#f2d98d'; ctx.beginPath(); ctx.moveTo(1330, 420); ctx.lineTo(1440, 420); ctx.lineTo(1410, 340); ctx.lineTo(1360, 340); ctx.fill();
    ctx.fillStyle = '#4c7a3a'; ctx.beginPath(); ctx.arc(250, 560, 70, 0, 7); ctx.fill(); ctx.fillStyle = '#8b5e3c'; ctx.fillRect(215, 600, 70, 90);
    for (const [x, c] of [[480, '#d55'], [640, '#5a5'], [800, '#da3']]) { ctx.fillStyle = c; rr(ctx, x, 450, 110, 90, 16); ctx.fill(); }
  },
  parking(ctx, ch) {
    ctx.fillStyle = '#6b6f75'; ctx.fillRect(0, 0, 1600, 900);
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 4;
    for (let row = 0; row < 4; row++) for (let i = 0; i <= 10; i++) { const x = 100 + i * 140, y = 120 + row * 190; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 140); ctx.stroke(); }
    const r = seededRandom('parking'); const cols = ['#c33', '#ddd', '#246', '#333', '#7a8', '#a84', '#558'];
    for (let row = 0; row < 4; row++) for (let i = 0; i < 10; i++) {
      if (row === 0 && i >= 8) continue;
      if (r() < 0.22) continue;
      car(ctx, 170 + i * 140, 190 + row * 190, 90, 130, cols[Math.floor(r() * cols.length)]);
    }
    car(ctx, ch ? 1475 : 1335, 190, 90, 130, '#e0c341');
  },
  cockpit(ctx, ch) {
    ctx.fillStyle = '#1e2329'; ctx.fillRect(0, 0, 1600, 900);
    ctx.fillStyle = '#2c333c'; rr(ctx, 80, 180, 1440, 620, 30); ctx.fill();
    ctx.fillStyle = '#6aa3d8'; ctx.fillRect(0, 0, 1600, 170);
    for (const [x, y] of [[300, 330], [300, 600], [1300, 330], [1300, 600]]) { ctx.fillStyle = '#0c0f13'; ctx.beginPath(); ctx.arc(x, y, 100, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60, y - 50); ctx.stroke(); }
    const cx = 800, cy = 450, R = 140; ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip(); ctx.translate(cx, cy); ctx.rotate(ch ? 0.32 : 0);
    ctx.fillStyle = '#3d7fc4'; ctx.fillRect(-300, -300, 600, 300); ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-300, 0, 600, 300); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-200, 0); ctx.lineTo(200, 0); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx - 70, cy); ctx.lineTo(cx - 20, cy); ctx.lineTo(cx, cy + 16); ctx.lineTo(cx + 20, cy); ctx.lineTo(cx + 70, cy); ctx.stroke();
    for (let i = 0; i < 12; i++) { ctx.fillStyle = ['#3a4', '#666', '#fb3', '#666'][i % 4]; rr(ctx, 520 + i * 48, 690, 34, 26, 4); ctx.fill(); }
  },
  metro(ctx, ch) {
    ctx.fillStyle = '#fbfbf8'; ctx.fillRect(0, 0, 1600, 900);
    const lines = [['#d33', [[60, 450], [500, 450], [800, 300], [1500, 300]]], ['#27a', [[200, 820], [600, 600], [800, 300], [900, 80]]], ['#3a5', [[100, 150], [500, 450], [900, 700], [1550, 700]]], ['#e90', [[1400, 140], [1100, 450], [900, 700], [800, 860]]]];
    for (const [c, pts] of lines) { ctx.strokeStyle = c; ctx.lineWidth = 14; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k <= 3; k++) { const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / 3, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / 3; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); ctx.stroke(); } }
    const names = [['西直门', 470, 420], ['积水潭', 620, 360], ['鼓楼', 900, 270], ['东直门', 1180, 270], ['动物园', 160, 480], ['宣武门', 560, 640], ['崇文门', 960, 730], ['国贸', 1300, 730], ['北土城', 870, 110], ['学院路', 210, 180], ['大望路', 1500, 670], ['永定门', 820, 840]];
    for (const [s, x, y] of names) txt(ctx, s, x, y, { size: 22, color: '#333' });
    if (!ch) txt(ctx, '望京西站', 1440, 150, { size: 24, color: '#333', weight: '600' });
    ctx.fillStyle = '#0D2B5C'; ctx.fillRect(0, 0, 330, 70); txt(ctx, '城市轨道交通线路图', 165, 35, { size: 22, color: '#fff' });
  },
  desk(ctx, ch) {
    ctx.fillStyle = '#d8dee6'; ctx.fillRect(0, 0, 1600, 900);
    ctx.fillStyle = '#a7845f'; ctx.fillRect(80, 300, 1440, 560);
    ctx.fillStyle = '#2b2f36'; rr(ctx, 260, 330, 380, 250, 14); ctx.fill(); ctx.fillStyle = '#5a8dd0'; rr(ctx, 280, 350, 340, 200, 8); ctx.fill(); ctx.fillStyle = '#3a3f47'; ctx.fillRect(220, 580, 460, 26);
    ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(1050 + i * 30, 520 + i * 10); ctx.rotate(0.1 * i - 0.1); ctx.fillRect(0, 0, 220, 290); ctx.restore(); }
    ctx.fillStyle = '#2d6a3e'; ctx.fillRect(1350, 360, 90, 120); ctx.fillStyle = '#3e8a52'; ctx.beginPath(); ctx.arc(1395, 340, 60, 0, 7); ctx.fill();
    ctx.fillStyle = '#e6c03a'; for (let i = 0; i < 5; i++) ctx.fillRect(900 + i * 18, 360, 12, 120);
    if (!ch) { ctx.fillStyle = '#f2f2f2'; rr(ctx, 730, 500, 110, 125, 12); ctx.fill(); ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(845, 560, 30, -1.2, 1.2); ctx.stroke(); ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.ellipse(785, 508, 50, 12, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#333'; rr(ctx, 300, 680, 300, 110, 10); ctx.fill(); ctx.fillStyle = '#555'; for (let i = 0; i < 10; i++) for (let j = 0; j < 3; j++) ctx.fillRect(312 + i * 28, 692 + j * 32, 22, 24);
  },
};
// 真实驾驶刺激（drive1-4，郑老师 & McConkie 驾驶变化盲研究，匿名文件名）：1024x768 居中放入舞台
export const CB_IMG = {};
export function preloadCB(scenes) {
  return Promise.all(scenes.filter(s => s.img).flatMap(s => ['a', 'b'].map(k => new Promise((res) => {
    if (CB_IMG[s.id + k]) return res();
    const im = new Image(); im.onload = () => { CB_IMG[s.id + k] = im; res(); }; im.onerror = () => res(); im.src = s.img + k + '.jpg';
  }))));
}
export function drawChangeScene(ctx, id, changed) {
  const im = CB_IMG[id + (changed ? 'b' : 'a')];
  if (id.startsWith('drive')) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1600, 900);
    if (im) ctx.drawImage(im, 200, 0, 1200, 900);
    else txt(ctx, '图片加载失败', 800, 450, { size: 30 });
    return;
  }
  ctx.save(); (CB[id] || CB2[id] || CB.street)(ctx, !!changed); ctx.restore();
}

// ======================= 传球计数（非注意盲） =======================
// 球员位置由种子决定（确定性），使前端回放与后端判定一致
export function makeCourt(seed = 'court-v1', dur = 26000) {
  const rnd = seededRandom(seed);
  const players = [];
  for (let i = 0; i < 8; i++) {
    players.push({ team: i < 4 ? 'white' : 'black', cx: 330 + rnd() * 940, cy: 230 + rnd() * 440,
      ax: 160 + rnd() * 170, ay: 90 + rnd() * 120, fx: 0.00035 + rnd() * 0.0004, fy: 0.0004 + rnd() * 0.0005, px: rnd() * 6.28, py: rnd() * 6.28 });
  }
  const pos = (p, t) => [p.cx + p.ax * Math.sin(p.fx * t + p.px), p.cy + p.ay * Math.sin(p.fy * t + p.py)];
  const passes = { white: [], black: [] };
  for (const team of ['white', 'black']) {
    const idx = players.map((p, i) => p.team === team ? i : -1).filter(i => i >= 0);
    let t = 900 + rnd() * 500, holder = idx[0];
    while (t < dur - 1200) {
      let to = holder; while (to === holder) to = idx[Math.floor(rnd() * idx.length)];
      passes[team].push({ from: holder, to, t0: t, t1: t + 520 });
      holder = to; t += (team === 'white' ? 1500 : 1300) + rnd() * 1100;
    }
  }
  const ballPos = (team, t) => {
    const ps = passes[team]; let holder = ps.length ? ps[0].from : 0;
    for (const p of ps) {
      if (t < p.t0) break;
      if (t <= p.t1) { const a = pos(players[p.from], t), b = pos(players[p.to], t), u = (t - p.t0) / (p.t1 - p.t0); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * 40]; }
      holder = p.to;
    }
    const h = pos(players[holder], t); return [h[0] + 22, h[1] + 8];
  };
  return { players, pos, passes, ballPos, trueCount: (T) => passes.white.filter(p => p.t1 <= T).length };
}
export function gorillaPos(u, t) {
  if (t < u.t0 || t > u.t1) return null;
  const move = u.t1 - u.t0 - u.pause_ms, d1 = Math.abs(u.x0 - u.pause_at), d2 = Math.abs(u.pause_at - u.x1);
  const t1 = move * d1 / (d1 + d2), dt = t - u.t0;
  let x;
  if (dt <= t1) x = u.x0 + (u.pause_at - u.x0) * (dt / t1);
  else if (dt <= t1 + u.pause_ms) x = u.pause_at;
  else x = u.pause_at + (u.x1 - u.pause_at) * Math.min(1, (dt - t1 - u.pause_ms) / (move - t1));
  return [x, u.y];
}
function person(ctx, x, y, team, t) {
  const legs = Math.sin(t / 120 + x) * 10;
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + 30); ctx.lineTo(x - 10 + legs, y + 72); ctx.moveTo(x, y + 30); ctx.lineTo(x + 10 - legs, y + 72); ctx.stroke();
  ctx.fillStyle = team === 'white' ? '#f6f6f6' : '#1c1c1c'; ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
  rr(ctx, x - 20, y - 18, 40, 52, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e0b48f'; ctx.beginPath(); ctx.arc(x, y - 32, 15, 0, 7); ctx.fill();
  ctx.fillStyle = '#2b1d14'; ctx.beginPath(); ctx.arc(x, y - 38, 13, Math.PI, 0); ctx.fill();
}
export function drawGorilla(ctx, x, y, t, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#151515';
  const sw = Math.sin(t / 140) * 8;
  ctx.beginPath(); ctx.ellipse(x, y, 46, 60, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y - 72, 26, 0, 7); ctx.fill();
  ctx.lineWidth = 18; ctx.strokeStyle = '#151515'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 40, y - 30); ctx.lineTo(x - 66, y + 30 + sw); ctx.moveTo(x + 40, y - 30); ctx.lineTo(x + 66, y + 30 - sw);
  ctx.moveTo(x - 18, y + 50); ctx.lineTo(x - 24 - sw, y + 100); ctx.moveTo(x + 18, y + 50); ctx.lineTo(x + 24 + sw, y + 100); ctx.stroke();
  ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.ellipse(x, y - 64, 14, 10, 0, 0, 7); ctx.fill();
  ctx.restore();
}
export function drawCourt(ctx, court, t, { unexpected = null, showGorilla = true, highlight = false } = {}) {
  ctx.fillStyle = '#cfcac0'; ctx.fillRect(0, 0, 1600, 900);
  ctx.fillStyle = '#bdb6a8'; ctx.fillRect(0, 0, 1600, 160);
  ctx.fillStyle = '#a49c8c'; for (let x = 60; x < 1600; x += 260) ctx.fillRect(x, 30, 150, 110);
  ctx.fillStyle = '#b3ab9c'; ctx.fillRect(0, 780, 1600, 120);
  const order = court.players.map((p, i) => [i, court.pos(p, t)]).sort((a, b) => a[1][1] - b[1][1]);
  let gDrawn = false;
  const g = unexpected && showGorilla ? gorillaPos(unexpected, t) : null;
  for (const [i, [x, y]] of order) {
    if (g && !gDrawn && g[1] < y) { drawGorilla(ctx, g[0], g[1], t); gDrawn = true; }
    person(ctx, x, y, court.players[i].team, t);
  }
  if (g && !gDrawn) drawGorilla(ctx, g[0], g[1], t);
  if (g && highlight) { ctx.strokeStyle = '#C8A44A'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(g[0], g[1] - 10, 110, 0, 7); ctx.stroke(); }
  for (const team of ['white', 'black']) { const [bx, by] = court.ballPos(team, t); ctx.fillStyle = '#e07a1f'; ctx.beginPath(); ctx.arc(bx, by, 12, 0, 7); ctx.fill(); ctx.strokeStyle = '#7a3a0a'; ctx.lineWidth = 2; ctx.stroke(); }
}
