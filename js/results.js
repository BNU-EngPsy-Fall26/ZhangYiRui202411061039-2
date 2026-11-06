// 全班汇总页：从课程服务器读取两个实验的匿名数据并汇总（被试级 + 条件级）
import { loadAll, PROJECTS } from './lib/upload.js';

const $ = (id) => document.getElementById(id);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const pct = (x) => (x == null ? '—' : (x * 100).toFixed(1) + '%');
const ms = (x) => (x == null ? '—' : Math.round(x) + ' ms');

function bar(v, max) {
  const w = max > 0 ? Math.max(2, Math.min(100, (v / max) * 100)) : 0;
  return `<div class="bar"><i style="width:${w}%"></i></div>`;
}

export async function main() {
  let recsCB = [], recsYAH = [], err = null;
  const fail = (e) => { err = err || e; return []; };
  [recsCB, recsYAH] = await Promise.all([
    loadAll(PROJECTS.cb, 'changeblind_cue_arrow').catch(fail),
    loadAll(PROJECTS.yah, 'yah_heading_cue').catch(fail),
  ]);

  $('msg').innerHTML = err
    ? `<div class="warn">无法读取服务器数据：${err.message}。<br>可能原因：没有联网，或页面以<b>本地文件</b>方式打开（浏览器会拦截跨域请求）。实验本身不受影响，数据上传失败时会自动下载 CSV 备份；要看全班汇总请用 http/https 打开本页。</div>`
    : `<span class="pill">实验一 ${recsCB.length} 份记录</span><span class="pill">实验二 ${recsYAH.length} 份记录</span>
       <p class="note" style="margin-top:8px">每份记录 = 一名被试完成一次实验。下面是按条件合并全部被试后的结果。</p>`;

  renderCB(recsCB);
  renderYAH(recsYAH);
}

/* ---------------- 实验一 ---------------- */
const CUE_NAME = { 0: '无箭头（基线）', 1: '箭头指向正确', 2: '箭头指向相反' };
const cueOf = (t) => (t.cue_type != null && t.cue_type !== '' ? +t.cue_type : (+t.cue_valid === 1 ? 1 : 0));

function renderCB(records) {
  const box = $('cb-box');
  const trials = [];
  records.forEach((r) => (r.trials || []).forEach((t) => trials.push(t)));
  if (!trials.length) { box.innerHTML = '<p class="note">暂无数据。完成一次实验一并上传后会出现在这里。</p>'; return; }

  const stat = (c) => {
    const a = trials.filter((t) => cueOf(t) === c);
    const det = a.filter((t) => t.resp_ms != null && t.resp_ms !== '');
    const rts = det.map((t) => +t.resp_ms);
    const loc = a.filter((t) => +t.click_ok === 1).length;
    return { n: a.length, detected: det.length, rt: mean(rts), loc_rate: det.length ? loc / det.length : null };
  };
  const S = [stat(0), stat(1), stat(2)];
  const maxRt = Math.max(...S.map((s) => s.rt || 0), 1);

  box.innerHTML = `
    <table>
      <tr><th>线索条件</th><th>试次数</th><th>觉察率</th><th>平均觉察时间</th><th>定位正确率</th></tr>
      ${[0, 1, 2].map((c) => `<tr><td>${CUE_NAME[c]}</td><td>${S[c].n}</td>
        <td>${pct(S[c].detected / Math.max(1, S[c].n))}</td><td>${ms(S[c].rt)}</td><td>${pct(S[c].loc_rate)}</td></tr>`).join('')}
    </table>
    <div style="margin-top:14px">
      <div class="note" style="margin-bottom:4px">平均觉察时间对比（条越长越慢）</div>
      ${[0, 1, 2].map((c) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:13px">
        <span style="width:150px">${CUE_NAME[c]}</span><div style="flex:1">${bar(S[c].rt || 0, maxRt)}</div>
        <span style="width:80px;text-align:right">${ms(S[c].rt)}</span></div>`).join('')}
    </div>
    <p class="note" style="margin-top:12px">每位被试 36 试次（单一广场场景，变化位置逐试次随机），三个线索条件各 12 试次。「无箭头」是基线，用来检验「加箭头有没有用」，而不只是「指对了有没有用」。</p>`;
}

/* ---------------- 实验二 ---------------- */
const RT_FLOOR = 200;   // 低于此视为抢答（注视点出现前就按键）

function renderYAH(records) {
  const box = $('yah-box');
  const trials = [];
  records.forEach((r) => (r.trials || []).forEach((t) => { if (t.rt == null || t.rt === '' || +t.rt >= RT_FLOOR) trials.push(t); }));
  if (!trials.length) { box.innerHTML = '<p class="note">暂无数据。完成一次实验二并上传后会出现在这里。</p>'; return; }

  const cells = [];
  for (const cue of [0, 1]) for (const rot of [0, 90, 180]) {
    const a = trials.filter((t) => +t.cue === cue && +t.rot === rot);
    const good = a.filter((t) => +t.correct === 1 && t.rt != null);
    cells.push({
      cue, rot, n: a.length,
      rt: mean(good.map((t) => +t.rt)),
      acc: a.length ? a.filter((t) => +t.correct === 1).length / a.length : null,
      sys: a.length ? a.filter((t) => +t.sys_err === 1).length / a.length : null,
    });
  }
  const maxRt = Math.max(...cells.map((c) => c.rt || 0), 1);

  const rows = [0, 1].map((cue) => {
    const cs = cells.filter((c) => c.cue === cue);
    return `<tr><td>${cue ? '有朝向提示（红色视锥）' : '无朝向提示'}</td>` +
      cs.map((c) => `<td>${ms(c.rt)}<br><span class="note">正确率 ${pct(c.acc)}</span><br><span class="note">系统错误 ${pct(c.sys)}</span></td>`).join('') +
      `<td>${ms(cs[2].rt != null && cs[0].rt != null ? cs[2].rt - cs[0].rt : null)}</td></tr>`;
  }).join('');

  const bars = cells.map((c) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:13px">
      <span style="width:150px">${c.cue ? '有提示' : '无提示'} · ${c.rot}°</span>
      <div style="flex:1">${bar(c.rt || 0, maxRt)}</div>
      <span style="width:82px;text-align:right">${ms(c.rt)}</span>
    </div>`).join('');

  box.innerHTML = `
    <table>
      <tr><th>提示条件</th><th>旋转 0°</th><th>旋转 90°</th><th>旋转 180°</th><th>RT 增幅 (180−0)</th></tr>
      ${rows}
    </table>
    <div style="margin-top:14px"><div class="note" style="margin-bottom:4px">各条件平均反应时（已剔除 RT &lt; ${RT_FLOOR} ms 的抢答试次）</div>${bars}</div>
    <p class="note" style="margin-top:12px">每人 48 试次（2 提示 × 3 旋转 × 8）。预测②③：有提示时「旋转 180° − 旋转 0°」的 RT 差应明显小于无提示条件；系统性错误率也应在有提示时下降。</p>`;
}

// 独立结果页（results.html）自动渲染；单文件版 index.html 由 app.js 在切到「结果」视图时调用
if (!document.documentElement.hasAttribute('data-no-auto-results')) main();
