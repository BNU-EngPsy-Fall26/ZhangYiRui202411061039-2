// 主控：被试信息 →（可选）摄像头眼动 + 9 点校准 → 实验选择 → 实验一 / 实验二 → 数据结论
import { toast } from './api.js';
import { Stage } from './stage.js';
import { submitData, downloadCSV, PROJECTS, suggestParticipant } from './lib/upload.js';
import { GazeHub } from './gaze/gaze_hub.js';
import { runCalibration, ERR_LIMIT_PX } from './gaze/calibration.js';
import * as CB from './exp/cb_cued.js';
import * as YAH from './exp/yah_cued.js';
import { main as renderResults } from './results.js';
import { main as renderAnalysis } from './analysis.js';
import { main as renderReport } from './report.js';

const $ = (id) => document.getElementById(id);
const state = { sid: '', name: '', cb: null, yah: null, calibErr: null, lowQuality: false, eyeAsked: false };

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

/* ---------------- 视图：实验 / 全班汇总 / 我的数据分析 / 图表报告 ---------------- */
let resultsLoaded = false;
let analysisLoaded = false;
let reportLoaded = false;
let analysisCtx = null;

function showView(v, { reload = false } = {}) {
  document.querySelectorAll('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'results' && (!resultsLoaded || reload)) { resultsLoaded = true; renderResults(); }
  if (v === 'analysis' && (!analysisLoaded || reload)) { analysisLoaded = true; renderAnalysis(analysisCtx || {}); }
  if (v === 'report' && (!reportLoaded || reload)) { reportLoaded = true; renderReport(); }
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
}

function openAnalysis() {
  analysisCtx = { cb: state.cb, yah: state.yah, sid: state.sid };
  showView('analysis', { reload: true });
}

if (/(^|[#/])report/.test(location.hash)) showView('report', { reload: true });
else if (/(^|[#/])analysis/.test(location.hash)) showView('analysis', { reload: true });
else if (/(^|[#/])results/.test(location.hash)) showView('results');
const refreshBtn = $('btn-results-refresh');
if (refreshBtn) refreshBtn.onclick = () => showView('results', { reload: true });
if ($('btn-analysis-back')) $('btn-analysis-back').onclick = () => goLab();
if ($('btn-analysis-group')) $('btn-analysis-group').onclick = () => showView('results', { reload: true });
if ($('btn-report-back')) $('btn-report-back').onclick = () => goLab();
if ($('btn-report-detail')) $('btn-report-detail').onclick = () => openAnalysis();

// 从结果类页面回到「实验选择」；没登录过就回登录页
function goLab() {
  showView('lab');
  if (state.sid) showHub(); else show('screen-login');
}

/* ---------------- 登录 → 实验选择 ---------------- */
$('btn-login').onclick = () => {
  const sid = $('in-sid').value.trim();
  const name = $('in-name').value.trim();
  if (!sid) { $('login-err').textContent = '请填写被试编号（如 P01）。'; return; }
  $('login-err').textContent = '';
  state.sid = sid; state.name = name;
  try { localStorage.setItem('hw2_name', name); } catch (e) { /* ignore */ }
  showHub();
};
$('in-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-login').click(); });

/* 打开页面时按后端已有编号预填下一个（P05 → P06）；读不到就保持空白，不硬塞 */
(async () => {
  const inp = $('in-sid'), hint = $('sid-hint');
  if (!inp) return;
  let s = null;
  try { s = await suggestParticipant(); } catch (e) { s = null; }
  if (!s) return;
  if (!inp.value.trim()) inp.value = s.sid;          // 用户已经动手填了就不覆盖
  if (hint) hint.textContent = `已按后端 ${s.n} 名被试预填 ${s.sid}，可手动改。`;
})();

/* ---------------- 实验选择（hub） ---------------- */
function showHub() {
  showView('lab');
  updateHub();
  show('screen-hub');
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
}

function setCard(key, label, done, doneText, idleText) {
  const card = $('hub-card-' + key), badge = $('hub-badge-' + key);
  const meta = $('hub-meta-' + key), btn = $('btn-start-' + key);
  if (!card) return;
  card.classList.toggle('done', done);
  badge.classList.toggle('done', done);
  badge.textContent = done ? '已完成' : '未开始';
  meta.textContent = done ? doneText : idleText;
  btn.textContent = (done ? '重做' : '开始') + label;
}

function updateHub() {
  const cb = state.cb, yah = state.yah;
  const sidEl = $('hub-sid');
  if (sidEl) sidEl.textContent = state.sid ? `当前被试 ${state.sid}。` : '';

  setCard('cb', '实验一', !!cb,
    cb ? `已完成 · 觉察 ${cb.summary.detected}/${cb.summary.n}，定位正确 ${cb.summary.located}` : '',
    '36 试次 · 约 5–6 分钟');
  setCard('yah', '实验二', !!yah,
    yah ? `已完成 · 正确率 ${(yah.summary.acc * 100).toFixed(0)}%（${yah.summary.correct}/${yah.summary.n}）` : '',
    '2 练习 + 48 试次 · 约 5 分钟');

  const missing = (cb ? 0 : 1) + (yah ? 0 : 1);
  const btn = $('btn-hub-report'), note = $('hub-finish-note');
  if (btn) btn.hidden = missing > 0;
  if (note) {
    note.textContent = missing === 0
      ? '两个实验都完成了，谢谢参与！可以去看数据结论。'
      : `还剩 ${missing} 个实验没做，做完后这里会出现「查看数据结论」。`;
  }
}

$('btn-start-cb').onclick = () => {
  if (!state.eyeAsked) { show('screen-consent'); return; }   // 只有实验一用到眼动
  runExp('cb');
};
$('btn-start-yah').onclick = () => runExp('yah');
$('btn-consent-back').onclick = () => showHub();
$('btn-hub-report').onclick = () => showView('report', { reload: true });

/* ---------------- 摄像头眼动（可选，失败不阻塞流程） ---------------- */
function afterEyeDecision() {
  state.eyeAsked = true;
  runExp('cb');
}
$('btn-nocam').onclick = () => { GazeHub.mode = null; afterEyeDecision(); };

$('btn-cam').onclick = async () => {
  const st = $('cam-status');
  const btn = $('btn-cam');
  btn.disabled = true;
  st.textContent = '正在加载本地眼动模型并请求摄像头权限……（首次约 5–15 秒）';
  try {
    await GazeHub.startWebGazer();
    st.textContent = '摄像头已就绪，进入校准。';
    await calibrateFlow();
    GazeHub.showPreview(false);
    afterEyeDecision();
  } catch (e) {
    GazeHub.mode = null;
    GazeHub.wg = null;
    // 清理 WebGazer 可能已经挂上的视频层，避免挡住后续实验画面
    try { if (window.webgazer) { window.webgazer.end(); window.webgazer.showVideo(false); } } catch (e2) { /* ignore */ }
    const vc = document.getElementById('webgazerVideoContainer');
    if (vc) vc.remove();
    st.textContent = '无法启用摄像头眼动：' + (e.message || e) + '。可以点「不用摄像头，直接开始」继续。';
    toast('摄像头眼动不可用：' + (e.message || e), 'err', 7000);
  } finally {
    btn.disabled = false;
  }
};

function modal(html, buttons) {
  return new Promise((res) => {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal">${html}<div class="instr-actions">${buttons.map((b, i) => `<button class="btn ${b[2] || 'btn-o'}" data-i="${i}">${b[0]}</button>`).join('')}</div></div>`;
    document.body.appendChild(bg);
    bg.querySelectorAll('button[data-i]').forEach((b) => {
      b.onclick = () => { bg.remove(); res(buttons[+b.dataset.i][1]); };
    });
  });
}

// 9 点校准 + 5 点验证；误差超限时给「重校准 / 不用摄像头 / 标记低质量继续」三个选择
async function calibrateFlow() {
  for (;;) {
    const r = await runCalibration();
    state.calibErr = r.err_px;
    const ok = r.ok;
    const stat = `平均误差 <b>${r.err_px != null ? Math.round(r.err_px) + ' px（约 ' + r.err_deg.toFixed(1) + '°）' : '无有效数据'}</b>　帧率 ${r.hz.toFixed(1)} Hz　人脸丢失 ${(r.face_loss * 100).toFixed(0)}%`;
    const msg = ok
      ? `<h3>校准完成</h3><p>${stat}</p><p class="muted">网页眼动典型误差 150–250 px，够用来区分大的兴趣区；这次的注视数据只作辅助分析。</p>`
      : `<h3 style="color:#c62828">校准误差${r.err_px != null ? ' ' + Math.round(r.err_px) + ' px' : '无法计算'}，超过 ${ERR_LIMIT_PX} px</h3>
         <p>建议：正对屏幕、脸部光线均匀、避免背光、保持头部不动，然后重新校准。</p><p>${stat}</p>`;
    const choice = await modal(msg, ok
      ? [['重新校准', 'again'], ['开始实验', 'go', 'btn-gold']]
      : [['不用摄像头继续', 'skip'], ['仍然继续（标记低质量）', 'go'], ['重新校准', 'again', 'btn-gold']]);
    if (choice === 'again') continue;
    if (choice === 'skip') { GazeHub.mode = null; return; }
    state.lowQuality = !ok;
    return;
  }
}

/* ---------------- 跑一个实验 → 上传 → 回选择界面 ---------------- */
let running = false;

async function runExp(which) {
  if (running) return;
  running = true;
  show('');
  const stage = new Stage();
  window.__stage = stage;
  const eyeOn = GazeHub.mode === 'webgazer';
  let note = null;

  try {
    if (which === 'cb') {
      const r = await CB.run({ stage, hub: GazeHub, subject: state.sid });
      if (r.aborted) { note = { msg: '已退出实验一，本次数据未上传。', type: 'err' }; return; }
      state.cb = r;
      const up = await upload(stage, PROJECTS.cb, 'changeblind_cue_arrow', r, eyeOn ? 'webgazer' : 'mouse');
      note = { msg: up ? `实验一完成，数据已上传（本项目累计 ${up.participants} 人）。` : '实验一完成，但上传失败，已下载 CSV 备份。', type: up ? 'ok' : 'err' };
    } else {
      const r = await YAH.run({ stage, subject: state.sid });
      if (r.aborted) { note = { msg: '已退出实验二，本次数据未上传。', type: 'err' }; return; }
      state.yah = r;
      const up = await upload(stage, PROJECTS.yah, 'yah_heading_cue', r, 'within');
      note = { msg: up ? `实验二完成，数据已上传（本项目累计 ${up.participants} 人）。` : '实验二完成，但上传失败，已下载 CSV 备份。', type: up ? 'ok' : 'err' };
    }
  } catch (e) {
    console.error('[runExp]', e);
    note = { msg: '实验出错：' + (e.message || e), type: 'err' };
  } finally {
    try { stage.destroy(); } catch (e) { /* ignore */ }
    running = false;
    showHub();
    if (note) toast(note.msg, note.type, 6000);
  }
}

async function upload(stage, project, experiment, result, condition) {
  const rows = result.trials.map((t) => Object.assign({}, t));
  const meta = Object.assign({}, result.meta, {
    eye: GazeHub.mode === 'webgazer' ? 'webgazer' : 'none',
    calib_err_px: state.calibErr != null ? Math.round(state.calibErr) : null,
    low_quality: state.lowQuality ? 1 : 0,
  });
  stage.setHud('<div class="hud-tl" style="left:116px">正在上传数据…</div>');
  try {
    const r = await submitData(project, experiment, state.sid || 'anonymous', rows, condition, meta);
    stage.setHud('');
    return r;
  } catch (e) {
    stage.setHud('');
    toast('上传失败：' + (e.message || e), 'err', 7000);
    downloadCSV(`hw2_${experiment}_${state.sid || 'anon'}.csv`, rows);
    return null;
  }
}
