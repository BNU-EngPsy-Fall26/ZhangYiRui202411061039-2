// 实验一 · 变化盲（Rensink, O'Regan & Clark, 1997）+ 方向箭头线索（本作业的改进条件）
// 素材：单一场景「商业广场」——6 个多场景版本每场景只有 2 试次，试次间无法比较，故改为单场景、
//       变化（多出来的一个行人）的位置逐试次变化，其余画面逐像素相同。
// 设计：3 线索条件（无箭头 / 有效 / 无效）× 12 试次 = 36，平衡随机；每个条件 ≥ 10 试次。
//       「无箭头」是基线，有了它才能检验「加箭头到底有没有用」，而不只是「指对了有没有用」。
// 流程与采集字段沿用课堂 Attention Lab：闪烁 240ms / 灰屏 160ms，空格报告觉察，再点击位置
import { instruct } from '../lib/instruct.js';
import { sleep } from '../api.js';
import { gazeSummary } from '../lib/upload.js';
import { drawPlaza, plazaLayout, personBox } from './cb_scenes2.js';
import { focusGuard, hud } from './w6_common.js';

const ON_MS = 240;       // 原图呈现
const BLANK_MS = 160;    // 灰屏（困难档）
const CONTRAST = 0.7;    // 对比度（困难档）
const TIMEOUT_MS = 30000;
const CUE_MS = 900;      // 箭头呈现时长（无箭头试次同样给 900 ms 注视屏，保证时序可比）
const CUE_GAP_MS = 300;
const MARGIN = 32;       // 点击判定边距（原来 64 太宽，6 个场景的定位率全是 100%，没有方差）

export const N_PER_CUE = 12;                     // 每个线索条件的试次数（作业要求 ≥10）
export const N_TOTAL = N_PER_CUE * 3;            // 36
export const CUE_NONE = 0, CUE_VALID = 1, CUE_INVALID = 2;
export const CUE_LABEL = { 0: '无箭头', 1: '箭头指向正确', 2: '箭头指向相反' };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ---------------- 变化位置：抖动网格 + 避开喷泉与既有行人 ---------------- */
const FOUNTAIN = { x: 800, y: 630, rx: 245, ry: 110 };
const inFountain = (x, y) => ((x - FOUNTAIN.x) / FOUNTAIN.rx) ** 2 + ((y - FOUNTAIN.y) / FOUNTAIN.ry) ** 2 < 1;
const MIN_GAP = 62;   // 与既有行人的最小中心距（行人宽约 25–45 px）

// 安全点池：广场地面上所有「不在喷泉里、也不贴着既有行人」的位置。基础布局是种子固定的，故只算一次。
let POOL = null;
function safePool() {
  if (POOL) return POOL;
  const { people } = plazaLayout();
  const pts = [];
  for (let x = 90; x <= 1510; x += 40) {
    for (let y = 410; y <= 815; y += 25) {
      if (inFountain(x, y)) continue;
      if (people.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_GAP)) continue;
      pts.push([x, y]);
    }
  }
  POOL = pts;
  return pts;
}

function buildSpots(n) {
  const pool = safePool();
  const people = plazaLayout().people;
  // 8×7 网格作为「理想位置」，每格取一个最近的安全点 → 既保证分散，又保证合法、不重复
  const cells = [];
  const COLS = 8, ROWS = 7;
  for (let ci = 0; ci < COLS; ci++) {
    for (let ri = 0; ri < ROWS; ri++) {
      cells.push([130 + (1470 - 130) * (ci + 0.5) / COLS + (Math.random() - 0.5) * 90,
        450 + (780 - 450) * (ri + 0.5) / ROWS + (Math.random() - 0.5) * 40]);
    }
  }
  shuffle(cells);
  const used = new Set();
  const out = [];
  for (const [cx, cy] of cells) {
    if (out.length >= n) break;
    let best = -1, bd = Infinity;
    for (let i = 0; i < pool.length; i++) {
      if (used.has(i)) continue;
      const d = (pool[i][0] - cx) ** 2 + (pool[i][1] - cy) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) continue;
    used.add(best);
    out.push({ x: pool[best][0], y: pool[best][1] });
  }
  while (out.length < n) {
    const i = Math.floor(Math.random() * pool.length);
    if (!used.has(i)) { used.add(i); out.push({ x: pool[i][0], y: pool[i][1] }); }
  }
  // 轻微抖动，避免位置排成整齐的网格；抖动后仍要合法
  return out.map((p) => {
    const x = p.x + (Math.random() - 0.5) * 22, y = p.y + (Math.random() - 0.5) * 14;
    const legal = !inFountain(x, y) && !people.some((q) => Math.hypot(q.x - x, q.y - y) < MIN_GAP)
      && x > 70 && x < 1530 && y > 400 && y < 830;
    return legal ? { x, y } : p;
  });
}

export function buildTrials() {
  const spots = buildSpots(N_TOTAL);
  const types = [];
  for (let k = 0; k < N_PER_CUE; k++) types.push(CUE_VALID, CUE_INVALID, CUE_NONE);
  const mix = shuffle(types);
  const list = spots.map((sp, i) => {
    const s = 20 + (sp.y - 380) / 8;
    const type = mix[i];
    const trueAngle = Math.atan2((sp.y - s * 0.9) - 450, sp.x - 800) * 180 / Math.PI;
    return {
      extra: { x: sp.x, y: sp.y, s },
      bbox: personBox(sp.x, sp.y, s),
      cue_type: type,
      cue_valid: type === CUE_VALID ? 1 : (type === CUE_INVALID ? 0 : ''),
      true_angle: +trueAngle.toFixed(1),
      cue_angle: +(((trueAngle + (type === CUE_INVALID ? 180 : 0)) + 540) % 360 - 180).toFixed(1),
      ecc: Math.round(Math.hypot(sp.x - 800, sp.y - 450)),   // 变化点离注视中心的距离（px）
    };
  });
  return shuffle(list);
}

/* ---------------- 画面：原图（无人）全局只画一次并缓存 ---------------- */
let CACHE_BASE = null;
function baseImage() {
  if (CACHE_BASE) return CACHE_BASE;
  const raw = document.createElement('canvas'); raw.width = 1600; raw.height = 900;
  drawPlaza(raw.getContext('2d'), null);
  const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
  const x = c.getContext('2d');
  x.filter = `contrast(${CONTRAST})`; x.drawImage(raw, 0, 0); x.filter = 'none';
  CACHE_BASE = c;
  return c;
}
function changedImage(t) {
  const raw = document.createElement('canvas'); raw.width = 1600; raw.height = 900;
  drawPlaza(raw.getContext('2d'), t.extra);
  const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
  const x = c.getContext('2d');
  x.filter = `contrast(${CONTRAST})`; x.drawImage(raw, 0, 0); x.filter = 'none';
  return c;
}

/* ---------------- 线索屏 ---------------- */
// 方向箭头：画在屏幕中心，angle 为「正弦/余弦坐标系」角度（deg，0 = 向右，顺时针为正）
function drawArrow(ctx, angle) {
  const cx = 800, cy = 450, len = 190, head = 74;
  const a = angle * Math.PI / 180;
  const tipX = cx + Math.cos(a) * (len + head * 0.35), tipY = cy + Math.sin(a) * (len + head * 0.35);
  ctx.save();
  ctx.translate(tipX, tipY); ctx.rotate(a);
  const g = ctx.createLinearGradient(-len - head, 0, 0, 0);
  g.addColorStop(0, 'rgba(200,164,74,.25)'); g.addColorStop(1, 'rgba(200,164,74,.95)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-head, -head * 0.52); ctx.lineTo(-head, -head * 0.2);
  ctx.lineTo(-len - head, -head * 0.2); ctx.lineTo(-len - head, head * 0.2); ctx.lineTo(-head, head * 0.2);
  ctx.lineTo(-head, head * 0.52); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#e5e7ea'; ctx.beginPath(); ctx.arc(800, 450, 9, 0, Math.PI * 2); ctx.fill();
}

function drawCue(ctx, t) {
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 1600, 900);
  ctx.font = '600 22px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (t.cue_type === CUE_NONE) {
    ctx.fillStyle = '#e5e7ea'; ctx.beginPath(); ctx.arc(800, 450, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fillText('本试次没有箭头提示', 800, 800);
  } else {
    drawArrow(ctx, t.cue_angle);
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fillText('箭头提示变化的方位（不一定对）', 800, 800);
  }
}

/* ---------------- 单个试次 ---------------- */
async function oneTrial(stage, hub, t, i, total, rec) {
  const ctx = stage.ctx;
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 1600, 900);
  hud(stage, `第 ${i + 1}/${total} 张 · ${t.cue_type === CUE_NONE ? '无箭头提示' : '记住箭头指向'}`, '发现变化 → 空格');
  drawCue(ctx, t);
  await sleep(CUE_MS);
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 1600, 900);
  await sleep(CUE_GAP_MS);

  // 闪烁：原图（无人）↔ 灰屏 ↔ 改图（多一个人）↔ 灰屏
  const first = baseImage(), second = changedImage(t);
  const cyc = 2 * (ON_MS + BLANK_MS);
  let resp = null;
  const t0 = rec ? hub.startRecording(stage) : performance.now();
  const onKey = (e) => { if (e.code === 'Space') { e.preventDefault(); if (resp === null) resp = Math.round(performance.now() - t0); } };
  window.addEventListener('keydown', onKey);
  await new Promise((res) => {
    let done = false;
    const finish = () => { if (done) return; done = true; clearInterval(wd); res(); };
    // 看门狗：即使 rAF 被浏览器节流（切后台/无头环境），按键也能立即结束试次
    const wd = setInterval(() => { if (resp !== null || performance.now() - t0 >= TIMEOUT_MS) finish(); }, 50);
    const loop = () => {
      if (done) return;
      const el = performance.now() - t0;
      if (resp !== null || el >= TIMEOUT_MS) return finish();
      const ph = el % cyc;
      if (ph < ON_MS) ctx.drawImage(first, 0, 0, 1600, 900);
      else if (ph < ON_MS + BLANK_MS) { ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 1600, 900); }
      else if (ph < 2 * ON_MS + BLANK_MS) ctx.drawImage(second, 0, 0, 1600, 900);
      else { ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 1600, 900); }
      hud(stage, `第 ${i + 1}/${total} 张 · ${Math.ceil((TIMEOUT_MS - el) / 1000)} 秒`, '发现变化 → 空格');
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  window.removeEventListener('keydown', onKey);
  const g = rec ? hub.stopRecording() : null;

  // 报告位置
  let click = null;
  if (resp !== null) {
    ctx.drawImage(second, 0, 0, 1600, 900);
    stage.setHud('<div class="hud-tl">请点击你看到变化的位置</div>');
    click = await new Promise((res) => {
      const f = (e) => {
        stage.box.removeEventListener('mousedown', f);
        const [x, y] = stage.toNorm(e.clientX, e.clientY);
        res([+x.toFixed(4), +y.toFixed(4)]);
      };
      stage.box.addEventListener('mousedown', f);
    });
  }

  // 反馈
  const [bx, by, bw, bh] = t.bbox;
  ctx.drawImage(second, 0, 0, 1600, 900);
  ctx.strokeStyle = '#C8A44A'; ctx.lineWidth = 5; ctx.strokeRect(bx, by, bw, bh);
  if (click) { ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(click[0] * 1600, click[1] * 900, 9, 0, Math.PI * 2); ctx.fill(); }
  stage.setHud(`<div class="hud-tl">变化：广场上多了一个行人 · ${CUE_LABEL[t.cue_type]}</div>`);
  await sleep(1300);
  stage.setHud('');

  // 记录（平铺字段）
  const clickOk = click && click[0] * 1600 >= bx - MARGIN && click[0] * 1600 <= bx + bw + MARGIN
    && click[1] * 900 >= by - MARGIN && click[1] * 900 <= by + bh + MARGIN;
  const gs = gazeSummary(g);
  return {
    i: i + 1,
    scene: 'plaza',
    type: 'MI',
    change: 'presence',
    cue_type: t.cue_type,
    cue_valid: t.cue_valid,
    cue_deg: t.cue_type === CUE_NONE ? '' : t.cue_angle,
    ex: +t.extra.x.toFixed(0),
    ey: +t.extra.y.toFixed(0),
    ecc: t.ecc,
    resp_ms: resp,
    timeout: resp === null ? 1 : 0,
    clicked: click ? 1 : 0,
    click_ok: resp !== null ? (clickOk ? 1 : 0) : null,
    click_x: click ? click[0] : null,
    click_y: click ? click[1] : null,
    gaze_n: gs.gaze_n,
    gaze_x: gs.gaze_x,
    gaze_y: gs.gaze_y,
    gaze_lost: gs.gaze_lost,
    gaze_qc: gs.gaze_qc,
  };
}

export async function run({ stage, hub, subject }) {
  const rec = !!(hub && hub.mode === 'webgazer');
  const list = buildTrials();
  await instruct(stage, `<h2>实验一 · 闪烁找变化</h2>
    <p>同一张广场画面会和「多了一个行人」的版本快速交替闪烁，中间夹着灰屏。变化就是<b>多出来的那个人</b>，每张图它的位置都不一样。</p>
    <p>每个试次开始前，屏幕中央可能出现一个<b>金色箭头</b>，指向变化的大致方位。<b>有些试次没有箭头</b>，只有中央注视点；有箭头时它也不一定指对。</p>
    <p>一旦发现变化，<b>立即按空格键</b>，然后用<b>鼠标点击</b>那个多出来的人。每张最多 ${TIMEOUT_MS / 1000} 秒。</p>
    <p class="muted">共 ${list.length} 张（无箭头 / 指向正确 / 指向相反，各 ${N_PER_CUE} 张，顺序随机），约 5–6 分钟。灰屏 ${BLANK_MS} ms、对比度 ${Math.round(CONTRAST * 100)}%。${rec ? '摄像头眼动已开启：会记录每张图上的注视汇总。' : '未启用摄像头：只记录按键、点击与时间。'}</p>`, '开始实验一');

  const guard = focusGuard(stage);
  const trials = [];
  try {
    for (let i = 0; i < list.length; i++) {
      trials.push(await oneTrial(stage, hub, list[i], i, list.length, rec));
      if (i === 11 || i === 23) {
        await instruct(stage, `<h2>第 ${i === 11 ? 1 : 2}/3 段完成</h2><p>休息一下。后面还是同一个广场，只是多出来的那个人会换位置。</p>`, '继续');
      }
    }
  } finally {
    guard.done();
    stage.setHud('');
  }
  const okN = trials.filter((t) => t.resp_ms !== null).length;
  const corrN = trials.filter((t) => t.click_ok === 1).length;
  return {
    trials,
    summary: { n: trials.length, detected: okN, located: corrN, subject },
    meta: { level: 'hard', scene: 'plaza', design: '3cue x 12', on_ms: ON_MS, blank_ms: BLANK_MS, contrast: CONTRAST, timeout_ms: TIMEOUT_MS, margin_px: MARGIN, eye: rec },
  };
}
