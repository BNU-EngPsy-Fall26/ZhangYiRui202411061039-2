// 实验二 ·「你在这里」地图（Levine, 1982）+ 朝向提示（本作业的改进）
// 改进：新增「你在图中面朝哪个方向」的半透明红色视锥。2（有/无提示）× 3（地图旋转 0/90/180°）× 8 = 48 试次
// DV：反应时、正确率、系统性错误（把「地图上方」当成「前方」作答的比例）
import { instruct } from '../lib/instruct.js';
import { sleep } from '../api.js';
import { focusGuard, hud, waitKey, shuffle, nextFrame, kbd, probe } from './w6_common.js';

const FONT = '"PingFang SC","Microsoft YaHei",sans-serif';
const D2R = Math.PI / 180;
const MX = 1180, MY = 420, MH = 290;
const COLORS = ['#b5651d', '#2f6db3', '#2e7d32', '#7d3c98'];
const KEYS = { ArrowUp: 'F', ArrowRight: 'R', ArrowDown: 'B', ArrowLeft: 'L' };
const DIRS = ['F', 'R', 'B', 'L'];
const DIR_CN = { F: '前方', R: '右边', B: '后方', L: '左边' };
export const LANDMARKS = ['图书馆', '食堂', '体育馆', '教学楼', '宿舍', '校医院', '实验楼', '礼堂'];

const FIX_MS = 300, ITI_MS = 350, TIMEOUT_MS = 9000, PRACTICE = 2;
// 安全等待一帧：个别环境（后台标签页/无头浏览器）rAF 会被节流，超时后直接继续
const safeFrame = () => Promise.race([nextFrame(), sleep(80)]);

function firstPerson(ctx, name, color) {
  const x0 = 40, y0 = 70, w = 700, h = 700;
  ctx.save(); ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x0, y0, w, h, 18); else ctx.rect(x0, y0, w, h);
  ctx.clip();
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 380); g.addColorStop(0, '#9cc8ef'); g.addColorStop(1, '#dcecf9');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, 380);
  ctx.fillStyle = '#b9c7a3'; ctx.fillRect(x0, y0 + 380, w, h - 380);
  ctx.fillStyle = '#e4dccb';
  ctx.beginPath(); ctx.moveTo(x0 + 250, y0 + h); ctx.lineTo(x0 + 330, y0 + 380); ctx.lineTo(x0 + 370, y0 + 380); ctx.lineTo(x0 + 450, y0 + h); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(x0 + 190, y0 + 150, 320, 232);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) ctx.fillRect(x0 + 210 + c * 50, y0 + 220 + r * 48, 30, 30);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 250, y0 + 166, 200, 44);
  ctx.fillStyle = '#1b1f27'; ctx.font = `700 28px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name, x0 + 350, y0 + 189);
  for (const [tx, s] of [[x0 + 60, 1.3], [x0 + 130, 0.9], [x0 + 580, 0.9], [x0 + 650, 1.3]]) {
    ctx.fillStyle = '#6d4c2f'; ctx.fillRect(tx - 8 * s, y0 + 380 + 40 * s, 16 * s, 90 * s);
    ctx.fillStyle = '#3f7a3a'; ctx.beginPath(); ctx.arc(tx, y0 + 380 + 10 * s, 70 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#cfd6e2'; ctx.font = `600 22px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('你眼前看到的（你正面朝它）', x0 + w / 2, y0 - 26);
}

// 朝向视锥：在地图上标出「你面朝」的方向（rot = 你的前方在地图上的角度，顺时针为正）
function facingCone(ctx, rot) {
  const R = 175, half = 30 * D2R;
  const a = rot * D2R;
  ctx.save();
  ctx.translate(MX, MY);
  ctx.rotate(a);
  const g = ctx.createRadialGradient(0, 0, 20, 0, 0, R);
  g.addColorStop(0, 'rgba(198,40,40,.34)');
  g.addColorStop(1, 'rgba(198,40,40,.06)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -Math.PI / 2 - half, -Math.PI / 2 + half); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(198,40,40,.75)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -Math.PI / 2 - half, -Math.PI / 2 + half); ctx.closePath(); ctx.stroke();
  ctx.setLineDash([]);
  // 锥尖处的朝向箭头
  ctx.fillStyle = 'rgba(198,40,40,.9)';
  ctx.beginPath(); ctx.moveTo(0, -R - 6); ctx.lineTo(-16, -R + 18); ctx.lineTo(16, -R + 18); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawYah(ctx, names, rot, ask, { cue = false, question = true } = {}) {
  ctx.fillStyle = '#1b1f27'; ctx.fillRect(0, 0, 1600, 900);
  firstPerson(ctx, names.F, COLORS[0]);

  ctx.fillStyle = '#5a4632'; ctx.fillRect(MX - 20, MY + MH + 10, 40, 110);
  ctx.fillStyle = '#0D2B5C';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(MX - MH - 30, MY - MH - 80, 2 * MH + 60, 2 * MH + 110, 16);
  else ctx.rect(MX - MH - 30, MY - MH - 80, 2 * MH + 60, 2 * MH + 110);
  ctx.fill();
  ctx.fillStyle = '#C8A44A'; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('校园导览图', MX, MY - MH - 44);

  ctx.save();
  ctx.beginPath(); ctx.rect(MX - MH, MY - MH, 2 * MH, 2 * MH); ctx.clip();
  ctx.fillStyle = '#eef0e6'; ctx.fillRect(MX - MH, MY - MH, 2 * MH, 2 * MH);
  ctx.translate(MX, MY); ctx.rotate(rot * D2R);
  ctx.fillStyle = '#e4dccb'; ctx.fillRect(-26, -MH - 40, 52, 2 * MH + 80); ctx.fillRect(-MH - 40, -26, 2 * MH + 80, 52);
  ctx.fillStyle = '#cfe5c0'; ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill();
  DIRS.forEach((d, i) => {
    ctx.save(); ctx.rotate(i * 90 * D2R);
    ctx.fillStyle = COLORS[i]; ctx.fillRect(-90, -MH + 30, 180, 90);
    ctx.restore();
  });
  ctx.restore();

  // 改进条件：朝向视锥（画在地图内容之上、"你在这里"之下）
  if (cue) facingCone(ctx, rot);

  // 地标名（保持正立，不随地图旋转）与「你在这里」
  ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  DIRS.forEach((d, i) => {
    const a = (i * 90 + rot) * D2R, r = MH - 75;
    const x = MX + Math.sin(a) * r, y = MY - Math.cos(a) * r;
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(x - 56, y - 18, 112, 36);
    ctx.fillStyle = '#1b1f27'; ctx.fillText(names[d], x, y);
  });
  ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(MX, MY, 14, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#c62828'; ctx.font = `700 20px ${FONT}`; ctx.fillText('你在这里', MX, MY + 34);

  if (question) {
    ctx.fillStyle = '#ffffff'; ctx.font = `600 30px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(`「${names[ask]}」在你的哪一边？`, 800, 828);
    ctx.fillStyle = '#8e97a8'; ctx.font = `500 22px ${FONT}`;
    ctx.fillText('↑ 前方　↓ 后方　← 左边　→ 右边', 800, 866);
    if (cue) { ctx.fillStyle = 'rgba(198,40,40,.9)'; ctx.font = `600 20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('红色扇形 = 你面朝的方向', MX, MY + MH + 96); }
  }
}

function makeTrial(cue, rot, dir, pool) {
  const names = shuffle([...pool]).slice(0, 4);
  const pick = DIRS.map((_, i) => names[i]);
  const map = { F: pick[0], R: pick[1], B: pick[2], L: pick[3] };
  return { cue, rot, dir, names: map };
}

export function buildTrials() {
  const list = [];
  for (const cue of [0, 1]) for (const rot of [0, 90, 180]) {
    const dirs = shuffle(['F', 'R', 'B', 'L', 'F', 'R', 'B', 'L']);
    dirs.forEach((d) => list.push(makeTrial(cue, rot, d, LANDMARKS)));
  }
  return shuffle(list);
}

// 「按地图上方=前方」会给出的答案：把目标在地图上的方位直接当作你的方位
export function mapBasedAnswer(dir, rot) {
  return DIRS[(DIRS.indexOf(dir) + Math.round(rot / 90)) % 4];
}

export async function run({ stage, subject }) {
  const trials = buildTrials();
  await instruct(stage, `<h2>实验二 ·「你在这里」地图</h2>
    <p>你站在校园里一块<b>导览图</b>前。左边画面是你<b>眼前看到的</b>：你正面朝着某栋楼。右边是导览图，红点是<b>你在这里</b>。</p>
    <p>请结合两者，尽快回答题目里那栋楼在<b>你的</b>哪一边：</p>
    <p style="text-align:center">${kbd('↑')} 前方　${kbd('↓')} 后方　${kbd('←')} 左边　${kbd('→')} 右边</p>
    <p>⚠️ 导览图不一定是"正着"挂的。有些试次地图上会出现<b style="color:#c62828">红色扇形</b>，表示你在地图上面朝的方向——但<b>不是每个试次都有</b>。</p>
    <p class="muted">先练习 ${PRACTICE} 次（有提示），再正式 ${trials.length} 次，约 5 分钟。答得又快又准。</p>`, '开始实验二');

  const guard = focusGuard(stage), ctx = stage.ctx;
  const rows = [];
  const one = async (t, practice) => {
    ctx.fillStyle = '#1b1f27'; ctx.fillRect(0, 0, 1600, 900);
    ctx.fillStyle = '#cfd6e2'; ctx.font = `600 40px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+', 800, 450);
    await sleep(FIX_MS);
    drawYah(ctx, t.names, t.rot, t.dir, { cue: !!t.cue }); await safeFrame();
    const t0 = performance.now();
    probe({ exp: 'yah', expect: t.dir, rot: t.rot, cue: t.cue });
    const r = await waitKey(KEYS, TIMEOUT_MS, t0);
    probe(null);
    const ok = r.key === t.dir;
    stage.setHud(`<div class="center-msg" style="color:${r.key == null ? '#ffd54a' : ok ? '#7CFC9A' : '#ff8a80'}">${r.key == null ? '太慢了' : ok ? '✓' : `✗ 在你的${DIR_CN[t.dir]}`}</div>`);
    await sleep(practice ? 1100 : 420);
    stage.setHud('');
    await sleep(ITI_MS);
    return {
      cue: t.cue, rot: t.rot, dir: t.dir,
      key: r.key || 'none',
      correct: r.key === t.dir ? 1 : 0,
      sys_pred: mapBasedAnswer(t.dir, t.rot),
      sys_err: (r.key && r.key !== t.dir && r.key === mapBasedAnswer(t.dir, t.rot)) ? 1 : 0,
      timeout: r.key ? 0 : 1,
      rt: r.rt == null ? null : Math.round(r.rt),
    };
  };

  try {
    for (let k = 0; k < PRACTICE; k++) {
      const p = makeTrial(1, k === 0 ? 0 : 180, k === 0 ? 'L' : 'R', LANDMARKS);
      hud(stage, `练习 ${k + 1}/${PRACTICE}`, '↑ 前 ↓ 后 ← 左 → 右');
      await one(p, true);
    }
    await instruct(stage, '<h2>练习结束</h2><p>正式开始，共 48 次。<b>有的地图有红色朝向扇形，有的没有</b>——没有的时候请自己判断方向。', '开始');
    for (let k = 0; k < trials.length; k++) {
      hud(stage, `${k + 1}/${trials.length}`, '↑ 前 ↓ 后 ← 左 → 右');
      rows.push(await one(trials[k], false));
    }
  } finally { guard.done(); stage.setHud(''); }

  const okN = rows.filter((r) => r.correct).length;
  return {
    trials: rows,
    summary: { n: rows.length, correct: okN, acc: rows.length ? okN / rows.length : 0, subject },
    meta: { design: '2cue x 3rot x 8', fix_ms: FIX_MS, timeout_ms: TIMEOUT_MS, practice: PRACTICE },
  };
}
