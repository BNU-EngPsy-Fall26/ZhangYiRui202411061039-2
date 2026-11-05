// 实验一 · 变化盲（Rensink, O'Regan & Clark, 1997）+ 方向箭头线索（本作业的改进）
// 素材：沿用课堂原项目 changeblind 的「困难」档场景（data/design.json 里 tier=hard 的 6 个程序化场景，
//       原档 8 个中 drive3/drive4 需要驾驶模拟器原图，本项目未附带图片素材，故用这 6 个）
// 参数：困难档 = 灰屏 160 ms + 对比度 70%（原项目 levels.hard），6 场景 × 2 轮 = 12 试次
// 改进：每个试次开始前先出现一个从屏幕中心指向变化位置的箭头，75% 正确（错误时指向反方向）
// 流程与采集字段沿用课堂 Attention Lab：闪烁 240ms / 灰屏，空格报告觉察，再点击位置
import { instruct } from '../lib/instruct.js';
import { sleep } from '../api.js';
import { gazeSummary } from '../lib/upload.js';
import { drawChangeScene } from './scenes.js';
import { focusGuard, hud } from './w6_common.js';

// 困难档场景（bbox 为变化区域，坐标基于 1600×900 舞台；数值与原项目 design.json 一致）
export const CB_SCENES = [
  { id: 'dash', label: '汽车仪表台', type: 'MI', change: 'presence', desc: '右下角小警示灯消失', bbox: [1400, 760, 90, 70] },
  { id: 'parking', label: '停车场', type: 'MI', change: 'position', desc: '远处一辆车位置移动', bbox: [1280, 115, 250, 150] },
  { id: 'metro', label: '地铁线路图', type: 'MI', change: 'presence', desc: '边缘一个站名消失', bbox: [1330, 120, 220, 60] },
  { id: 'plaza', label: '商业广场', type: 'MI', change: 'position', desc: '远处边缘一个小行人位置改变', bbox: [1380, 380, 105, 55] },
  { id: 'inbox', label: '邮件收件箱', type: 'MI', change: 'presence', desc: '左侧边栏一个未读红点消失', bbox: [195, 422, 20, 20] },
  { id: 'platform', label: '地铁站台', type: 'MI', change: 'position', desc: '右上远处的出口指示牌平移', bbox: [1300, 105, 250, 56] },
];

const ON_MS = 240;      // 原图呈现
const BLANK_MS = 160;   // 灰屏（困难档）
const CONTRAST = 0.7;   // 对比度（困难档）
const TIMEOUT_MS = 30000;
const CUE_MS = 900;     // 箭头呈现时长
const CUE_GAP_MS = 300; // 箭头消失到闪烁开始的间隔
const CUE_VALID_P = 0.75;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 对比度：先画到临时画布，再以 filter contrast() 合成（与原项目 changeblind 的做法一致）
function offscreen(id, changed, contrast = 1) {
  const raw = document.createElement('canvas'); raw.width = 1600; raw.height = 900;
  drawChangeScene(raw.getContext('2d'), id, changed);
  if (contrast >= 0.999) return raw;
  const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
  const x = c.getContext('2d');
  x.filter = `contrast(${contrast})`; x.drawImage(raw, 0, 0); x.filter = 'none';
  return c;
}

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
  // 中心注视点，保证箭头起点明确来自屏幕中央
  ctx.fillStyle = '#e5e7ea'; ctx.beginPath(); ctx.arc(800, 450, 9, 0, Math.PI * 2); ctx.fill();
}

function drawCue(ctx, angle) {
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 1600, 900);
  drawArrow(ctx, angle);
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.font = '600 22px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('箭头提示变化的方位（不一定对）', 800, 800);
}

export function buildTrials() {
  const list = [];
  for (let rep = 0; rep < 2; rep++) {
    shuffle(CB_SCENES.map((s) => s.id)).forEach((id) => {
      const sc = CB_SCENES.find((s) => s.id === id);
      const [x, y, w, h] = sc.bbox;
      const cx = x + w / 2, cy = y + h / 2;
      const trueAngle = Math.atan2(cy - 450, cx - 800) * 180 / Math.PI;
      list.push({ scene: sc, rep, true_angle: +trueAngle.toFixed(1), cue_valid: 0, cue_angle: 0, ab_first: Math.random() < 0.5 ? 'A' : 'B' });
    });
  }
  // 固定配额：12 试次中恰好 9 个有效（75%）
  const idx = shuffle([...Array(list.length).keys()]);
  idx.forEach((i, k) => {
    const t = list[i];
    t.cue_valid = k < 9 ? 1 : 0;
    t.cue_angle = +((t.true_angle + (t.cue_valid ? 0 : 180) + 540) % 360 - 180).toFixed(1);
  });
  return shuffle(list);
}

async function oneTrial(stage, hub, t, i, total, rec) {
  const ctx = stage.ctx;
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 1600, 900);
  // 1) 方向箭头
  hud(stage, `第 ${i + 1}/${total} 张 · 记住箭头指向`, '发现变化 → 空格');
  drawCue(ctx, t.cue_angle);
  await sleep(CUE_MS);
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 1600, 900);
  await sleep(CUE_GAP_MS);

  // 2) 闪烁（原图 A / 改图 B 轮流，中间夹灰屏；困难档降低对比度）
  const A = offscreen(t.scene.id, false, CONTRAST);
  const B = offscreen(t.scene.id, true, CONTRAST);
  const [first, second] = t.ab_first === 'A' ? [A, B] : [B, A];

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

  // 3) 报告位置
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

  // 4) 反馈
  const [bx, by, bw, bh] = t.scene.bbox;
  ctx.drawImage(second, 0, 0, 1600, 900);
  ctx.strokeStyle = '#C8A44A'; ctx.lineWidth = 6; ctx.strokeRect(bx, by, bw, bh);
  if (click) { ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(click[0] * 1600, click[1] * 900, 10, 0, Math.PI * 2); ctx.fill(); }
  stage.setHud(`<div class="hud-tl">变化：${t.scene.desc}（${t.scene.type === 'CI' ? '中心兴趣' : '边缘兴趣'}）· 箭头${t.cue_valid ? '正确' : '错误'}</div>`);
  await sleep(1500);
  stage.setHud('');

  // 5) 记录（平铺字段）
  const MARGIN = 64;
  const clickOk = click && click[0] * 1600 >= bx - MARGIN && click[0] * 1600 <= bx + bw + MARGIN
    && click[1] * 900 >= by - MARGIN && click[1] * 900 <= by + bh + MARGIN;
  const gs = gazeSummary(g);
  return {
    i: i + 1,
    scene: t.scene.id,
    type: t.scene.type,
    change: t.scene.change,
    cue_valid: t.cue_valid,
    cue_deg: t.cue_angle,
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
  await instruct(stage, `<h2>实验一 · 闪烁找变化（困难）</h2>
    <p>每张画面会和一张"几乎一样"的画面快速交替闪烁，中间夹着灰屏。两张图之间有<b>一处</b>不同。</p>
    <p>每个试次开始前，屏幕中央会先出现一个<b>金色箭头</b>：它<b>大多数时候（75%）</b>指向变化所在的方位，有时会故意指反。箭头消失后立即开始闪烁。</p>
    <p>一旦发现变化，<b>立即按空格键</b>，然后用<b>鼠标点击</b>变化的位置。每张最多 ${TIMEOUT_MS / 1000} 秒。</p>
    <p class="muted">难度为<b>困难档</b>（沿用课堂原项目：变化都在画面边缘、很小，灰屏 ${BLANK_MS} ms、对比度 ${Math.round(CONTRAST * 100)}%）。共 ${list.length} 张（6 个场景 × 2 轮），约 6 分钟。${rec ? '摄像头眼动已开启：会记录每张图上的注视汇总。' : '未启用摄像头：只记录按键、点击与时间。'}</p>`, '开始实验一');

  const guard = focusGuard(stage);
  const trials = [];
  try {
    for (let i = 0; i < list.length; i++) {
      trials.push(await oneTrial(stage, hub, list[i], i, list.length, rec));
      if (i === 5) {
        await instruct(stage, `<h2>第一轮完成</h2><p>休息一下，第二轮还是这 6 个场景，但变化位置与箭头指向会重新随机。</p>`, '继续');
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
    meta: { level: 'hard', on_ms: ON_MS, blank_ms: BLANK_MS, contrast: CONTRAST, timeout_ms: TIMEOUT_MS, cue_valid_p: CUE_VALID_P, eye: rec },
  };
}
