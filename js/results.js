// 结果页：从课程服务器读取两个实验的匿名数据并汇总
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
function renderCB(records) {
  const box = $('cb-box');
  const trials = [];
  records.forEach((r) => (r.trials || []).forEach((t) => trials.push(t)));
  if (!trials.length) { box.innerHTML = '<p class="note">暂无数据。完成一次实验一并上传后会出现在这里。</p>'; return; }

  const grp = (v) => trials.filter((t) => +t.cue_valid === v);
  const stat = (a) => {
    const det = a.filter((t) => t.resp_ms != null && t.resp_ms !== ''); 
    const rts = det.map((t) => +t.resp_ms);
    const loc = a.filter((t) => +t.click_ok === 1).length;
    return { n: a.length, detected: det.length, rt: mean(rts), loc_rate: a.length ? loc / a.length : null };
  };
  const V = stat(grp(1)), I = stat(grp(0));
  const maxRt = Math.max(V.rt || 0, I.rt || 0);

  box.innerHTML = `
    <table>
      <tr><th>箭头提示</th><th>试次数</th><th>觉察率</th><th>平均觉察时间</th><th>定位正确率</th></tr>
      <tr><td>指向正确（75% 的试次）</td><td>${V.n}</td><td>${pct(V.detected / V.n)}</td><td>${ms(V.rt)}</td><td>${pct(V.loc_rate)}</td></tr>
      <tr><td>指向相反（25% 的试次）</td><td>${I.n}</td><td>${pct(I.detected / I.n)}</td><td>${ms(I.rt)}</td><td>${pct(I.loc_rate)}</td></tr>
    </table>
    <div style="margin-top:14px">
      <div class="note" style="margin-bottom:4px">平均觉察时间对比（条越长越慢）</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:13px"><span style="width:150px">箭头有效</span><div style="flex:1">${bar(V.rt || 0, maxRt)}</div><span style="width:70px;text-align:right">${ms(V.rt)}</span></div>
      <div style="display:flex;align-items:center;gap:10px;font-size:13px"><span style="width:150px">箭头无效</span><div style="flex:1">${bar(I.rt || 0, maxRt)}</div><span style="width:70px;text-align:right">${ms(I.rt)}</span></div>
    </div>
    <p class="note" style="margin-top:12px">每位被试 12 试次（6 场景 × 2 轮），其中 9 次箭头有效、3 次指反。差异方向与大小可以直接对照作业里的预测①。</p>`;
}

/* ---------------- 实验二 ---------------- */
function renderYAH(records) {
  const box = $('yah-box');
  const trials = [];
  records.forEach((r) => (r.trials || []).forEach((t) => trials.push(t)));
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
    <div style="margin-top:14px"><div class="note" style="margin-bottom:4px">各条件平均反应时</div>${bars}</div>
    <p class="note" style="margin-top:12px">每人 48 试次（2 提示 × 3 旋转 × 8）。预测②③：有提示时「旋转 180° − 旋转 0°」的 RT 差应明显小于无提示条件；系统性错误率也应在有提示时下降。</p>`;
}

// 独立结果页（results.html）自动渲染；单文件版 index.html 由 app.js 在切到「结果」视图时调用
if (!document.documentElement.hasAttribute('data-no-auto-results')) main();
