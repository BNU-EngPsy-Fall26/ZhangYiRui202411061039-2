// 主控：被试信息 → 实验一（找不同 + 方向箭头）→ 上传 → 实验二（YAH + 朝向提示）→ 上传 → 结束
import { toast } from './api.js';
import { Stage } from './stage.js';
import { ask } from './lib/instruct.js';
import { submitData, downloadCSV, PROJECTS } from './lib/upload.js';
import * as CB from './exp/cb_cued.js';
import * as YAH from './exp/yah_cued.js';
import { main as renderResults } from './results.js';

const $ = (id) => document.getElementById(id);
const state = { sid: '', name: '', cb: null, yah: null };

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

/* ---------------- 视图：实验 / 结果（结果页不给被试入口，只能用 #/results 打开） ---------------- */
let resultsLoaded = false;

function showView(v, { reload = false } = {}) {
  document.querySelectorAll('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'results' && (!resultsLoaded || reload)) { resultsLoaded = true; renderResults(); }
}

if (/(^|[#/])results/.test(location.hash)) showView('results');
const refreshBtn = $('btn-results-refresh');
if (refreshBtn) refreshBtn.onclick = () => showView('results', { reload: true });

/* ---------------- 登录 → 直接开始 ---------------- */
$('btn-login').onclick = () => {
  const sid = $('in-sid').value.trim();
  const name = $('in-name').value.trim();
  if (!sid) { $('login-err').textContent = '请填写被试编号（如 P01）。'; return; }
  $('login-err').textContent = '';
  state.sid = sid; state.name = name;
  try { localStorage.setItem('hw2_name', name); } catch (e) { /* ignore */ }
  startAll();
};
$('in-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-login').click(); });

/* ---------------- 实验主流程 ---------------- */
async function startAll() {
  show('');
  const stage = new Stage();
  window.__stage = stage;

  // 实验一
  const r1 = await CB.run({ stage, subject: state.sid });
  state.cb = r1;
  const uploaded1 = await upload(stage, PROJECTS.cb, 'changeblind_cue_arrow', r1, 'mouse');
  const go = await ask(stage,
    `<h2>实验一完成</h2>
     <p>你共看了 ${r1.trials.length} 张图，报告觉察 ${r1.summary.detected} 次，定位正确 ${r1.summary.located} 次。</p>
     <p>${uploaded1 ? `数据已上传（本项目累计 <b>${uploaded1.participants}</b> 人）。` : '数据上传失败，本地已下载 CSV 备份。'}</p>
     <p>是否继续做<b>实验二</b>（「你在这里」地图，约 5 分钟）？</p>`,
    [{ label: '继续实验二', value: 'go', cls: 'btn-gold' }, { label: '到此结束', value: 'stop', cls: 'btn-o' }]);
  if (go === 'stop') { stage.destroy(); return finish(); }

  // 实验二
  const r2 = await YAH.run({ stage, subject: state.sid });
  state.yah = r2;
  const uploaded2 = await upload(stage, PROJECTS.yah, 'yah_heading_cue', r2, 'within');
  await ask(stage,
    `<h2>实验二完成</h2>
     <p>共 ${r2.trials.length} 次，正确 ${r2.summary.correct} 次（正确率 ${(r2.summary.acc * 100).toFixed(0)}%）。</p>
     <p>${uploaded2 ? `数据已上传（本项目累计 <b>${uploaded2.participants}</b> 人）。` : '数据上传失败，本地已下载 CSV 备份。'}</p>
     <p>两个实验都完成了，谢谢你的参与！</p>`,
    [{ label: '完成', value: 'ok', cls: 'btn-gold' }]);
  stage.destroy();
  finish();
}

async function upload(stage, project, experiment, result, condition) {
  const rows = result.trials.map((t) => Object.assign({}, t));
  stage.setHud('<div class="hud-tl">正在上传数据…</div>');
  try {
    const r = await submitData(project, experiment, state.sid || 'anonymous', rows, condition, result.meta || {});
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
