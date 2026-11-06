// 主控：被试信息 →（可选）摄像头眼动 + 9 点校准 → 实验一 → 上传 → 实验二 → 上传 → 结束
import { toast } from './api.js';
import { Stage } from './stage.js';
import { ask } from './lib/instruct.js';
import { submitData, downloadCSV, PROJECTS } from './lib/upload.js';
import { GazeHub } from './gaze/gaze_hub.js';
import { runCalibration, ERR_LIMIT_PX } from './gaze/calibration.js';
import * as CB from './exp/cb_cued.js';
import * as YAH from './exp/yah_cued.js';
import { main as renderResults } from './results.js';
import { main as renderAnalysis } from './analysis.js';

const $ = (id) => document.getElementById(id);
const state = { sid: '', name: '', cb: null, yah: null, calibErr: null, lowQuality: false };

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

/* ---------------- 视图：实验 / 全班汇总 / 我的数据分析 ---------------- */
let resultsLoaded = false;
let analysisLoaded = false;
let analysisCtx = null;

function showView(v, { reload = false } = {}) {
  document.querySelectorAll('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'results' && (!resultsLoaded || reload)) { resultsLoaded = true; renderResults(); }
  if (v === 'analysis' && (!analysisLoaded || reload)) { analysisLoaded = true; renderAnalysis(analysisCtx || {}); }
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
}

function openAnalysis() {
  analysisCtx = { cb: state.cb, yah: state.yah, sid: state.sid };
  showView('analysis', { reload: true });
}

if (/(^|[#/])analysis/.test(location.hash)) showView('analysis', { reload: true });
else if (/(^|[#/])results/.test(location.hash)) showView('results');
const refreshBtn = $('btn-results-refresh');
if (refreshBtn) refreshBtn.onclick = () => showView('results', { reload: true });
if ($('btn-analysis')) $('btn-analysis').onclick = () => openAnalysis();
if ($('btn-analysis-back')) $('btn-analysis-back').onclick = () => showView('lab');
if ($('btn-analysis-group')) $('btn-analysis-group').onclick = () => showView('results', { reload: true });

/* ---------------- 登录 → 选择是否开启眼动 ---------------- */
$('btn-login').onclick = () => {
  const sid = $('in-sid').value.trim();
  const name = $('in-name').value.trim();
  if (!sid) { $('login-err').textContent = '请填写被试编号（如 P01）。'; return; }
  $('login-err').textContent = '';
  state.sid = sid; state.name = name;
  try { localStorage.setItem('hw2_name', name); } catch (e) { /* ignore */ }
  show('screen-consent');
};
$('in-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-login').click(); });

/* ---------------- 摄像头眼动（可选，失败不阻塞流程） ---------------- */
$('btn-nocam').onclick = () => { GazeHub.mode = null; startAll(); };

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
    startAll();
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

/* ---------------- 实验主流程 ---------------- */
async function startAll() {
  show('');
  const stage = new Stage();
  window.__stage = stage;
  const eyeOn = GazeHub.mode === 'webgazer';

  // 实验一
  const r1 = await CB.run({ stage, hub: GazeHub, subject: state.sid });
  state.cb = r1;
  const uploaded1 = await upload(stage, PROJECTS.cb, 'changeblind_cue_arrow', r1, eyeOn ? 'webgazer' : 'mouse');
  const go = await ask(stage,
    `<h2>实验一完成</h2>
     <p>你共看了 ${r1.trials.length} 张图，报告觉察 ${r1.summary.detected} 次，定位正确 ${r1.summary.located} 次。</p>
     <p>${uploaded1 ? `数据已上传（本项目累计 <b>${uploaded1.participants}</b> 人）。` : '数据上传失败，本地已下载 CSV 备份。'}</p>
     ${eyeOn ? `<p class="muted">眼动已记录：每张图的平均注视坐标会上传（校准误差约 ${state.calibErr != null ? Math.round(state.calibErr) + ' px' : '未知'}）。</p>` : ''}
     <p>是否继续做<b>实验二</b>（「你在这里」地图，约 5 分钟）？</p>`,
    [{ label: '继续实验二', value: 'go', cls: 'btn-gold' }, { label: '到此结束', value: 'stop', cls: 'btn-o' }]);
  if (go === 'stop') { stage.destroy(); return finish(); }

  // 实验二
  const r2 = await YAH.run({ stage, subject: state.sid });
  state.yah = r2;
  const uploaded2 = await upload(stage, PROJECTS.yah, 'yah_heading_cue', r2, 'within');
  const after = await ask(stage,
    `<h2>实验二完成</h2>
     <p>共 ${r2.trials.length} 次，正确 ${r2.summary.correct} 次（正确率 ${(r2.summary.acc * 100).toFixed(0)}%）。</p>
     <p>${uploaded2 ? `数据已上传（本项目累计 <b>${uploaded2.participants}</b> 人）。` : '数据上传失败，本地已下载 CSV 备份。'}</p>
     <p>两个实验都完成了，谢谢你的参与！要不要现在看一下分析结果？</p>`,
    [{ label: '查看数据分析', value: 'analysis', cls: 'btn-gold' }, { label: '结束', value: 'ok', cls: 'btn-o' }]);
  stage.destroy();
  finish();
  if (after === 'analysis') openAnalysis();
}

async function upload(stage, project, experiment, result, condition) {
  const rows = result.trials.map((t) => Object.assign({}, t));
  const meta = Object.assign({}, result.meta, {
    eye: GazeHub.mode === 'webgazer' ? 'webgazer' : 'none',
    calib_err_px: state.calibErr != null ? Math.round(state.calibErr) : null,
    low_quality: state.lowQuality ? 1 : 0,
  });
  stage.setHud('<div class="hud-tl">正在上传数据…</div>');
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

/* ---------------- 结束页：只显示「实验结束，感谢参与」 ---------------- */
function finish() {
  show('screen-final');
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
}
