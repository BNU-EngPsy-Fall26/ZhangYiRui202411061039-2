// 数据分析页：按作业要求输出「效应量 + 与原文对比 + 改进条件检验」，并与全体被试数据对比
// 数据来源：本人本次的 trials（内存中）+ 课程服务器 /api/hw2/data（匿名全体）
import { loadAll, PROJECTS } from './lib/upload.js';

const $ = (id) => document.getElementById(id);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};
const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); const k = Math.floor(b.length / 2); return b.length % 2 ? b[k] : (b[k - 1] + b[k]) / 2; };

/* ---------------- 统计：t 检验与效应量 ---------------- */
function lnGamma(z) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
const pFromT = (t, df) => (df > 0 && Number.isFinite(t) ? betai(df / 2, 0.5, df / (df + t * t)) : null);

// 独立样本 Welch t + Cohen's d（pooled）
function indT(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a), mb = mean(b), sa = sd(a), sb = sd(b);
  const se = Math.sqrt(sa * sa / a.length + sb * sb / b.length);
  if (!se) return null;
  const t = (ma - mb) / se;
  const df = (sa * sa / a.length + sb * sb / b.length) ** 2 /
    ((sa * sa / a.length) ** 2 / (a.length - 1) + (sb * sb / b.length) ** 2 / (b.length - 1));
  const sp = Math.sqrt(((a.length - 1) * sa * sa + (b.length - 1) * sb * sb) / (a.length + b.length - 2));
  return { t, df, p: pFromT(t, df), diff: ma - mb, d: sp ? (ma - mb) / sp : null };
}
// 配对 t（被试内）+ Cohen's dz
function pairedT(diffs) {
  const n = diffs.length;
  if (n < 2) return null;
  const m = mean(diffs), s = sd(diffs);
  if (!s) return null;
  const t = m / (s / Math.sqrt(n));
  return { t, df: n - 1, p: pFromT(t, n - 1), diff: m, dz: m / s, n };
}

/* ---------------- 格式化 ---------------- */
const f0 = (x) => (x == null || !Number.isFinite(x) ? '—' : Math.round(x).toLocaleString());
const f1 = (x) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(1));
const f2 = (x) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(2));
const fp = (x) => (x == null || !Number.isFinite(x) ? '—' : x < 0.001 ? '< .001' : x.toFixed(3));
const pct = (x) => (x == null || !Number.isFinite(x) ? '—' : (x * 100).toFixed(1) + '%');
const ms = (x) => (x == null || !Number.isFinite(x) ? '—' : Math.round(x) + ' ms');
const sgn = (x, unit = ' ms') => (x == null || !Number.isFinite(x) ? '—' : (x > 0 ? '+' : '') + Math.round(x) + unit);
const dLabel = (d) => {
  const v = Math.abs(d == null ? 0 : d);
  if (d == null || !Number.isFinite(d)) return '—';
  return v < 0.2 ? '≈0（很小）' : v < 0.5 ? '小' : v < 0.8 ? '中' : '大';
};
// 显著性星号
const stars = (p) => (p == null ? '' : p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'n.s.');

const CUE_NAME = { 0: '无箭头（基线）', 1: '箭头指向正确', 2: '箭头指向相反' };
const cueOf = (t) => (t.cue_type != null && t.cue_type !== '' ? +t.cue_type : (+t.cue_valid === 1 ? 1 : 0));

/* ---------------- 实验一：按线索条件取 RT / 觉察 / 定位 ---------------- */
function cbStats(trials) {
  const out = {};
  for (const c of [0, 1, 2]) {
    const a = trials.filter((t) => cueOf(t) === c);
    const hit = a.filter((t) => t.resp_ms != null && t.resp_ms !== '');
    const rt = hit.map((t) => +t.resp_ms);
    const loc = a.filter((t) => +t.click_ok === 1).length;
    out[c] = {
      n: a.length,
      detected: hit.length,
      det_rate: a.length ? hit.length / a.length : null,
      rt: mean(rt), rt_sd: sd(rt), rt_med: med(rt), rts: rt,
      loc_rate: hit.length ? loc / hit.length : null,
    };
  }
  return out;
}

/* ---------------- 实验二：2 提示 × 3 旋转 ---------------- */
const RT_FLOOR = 200;   // 低于此视为抢答（实测有被试在注视点出现前就按键）
function yahStats(trials) {
  const clean = trials.filter((t) => t.rt == null || t.rt === '' || +t.rt >= RT_FLOOR);
  const cell = {};
  for (const cue of [0, 1]) for (const rot of [0, 90, 180]) {
    const a = clean.filter((t) => +t.cue === cue && +t.rot === rot);
    const good = a.filter((t) => +t.correct === 1 && t.rt != null && t.rt !== '');
    cell[cue + '|' + rot] = {
      n: a.length,
      acc: a.length ? a.filter((t) => +t.correct === 1).length / a.length : null,
      rt: mean(good.map((t) => +t.rt)),
      sys: a.length ? a.filter((t) => +t.sys_err === 1).length / a.length : null,
    };
  }
  const byCue = {};
  for (const cue of [0, 1]) {
    const c = [0, 90, 180].map((r) => cell[cue + '|' + r]);
    byCue[cue] = {
      n: c.reduce((s, x) => s + x.n, 0),
      acc: mean(c.map((x) => x.acc).filter((v) => v != null)),
      rt: mean(c.map((x) => x.rt).filter((v) => v != null)),
      sys: mean(c.map((x) => x.sys).filter((v) => v != null)),
    };
  }
  const dropped = trials.length - clean.length;
  return { clean, cell, byCue, dropped };
}

/* ---------------- 与全体对比：我自己在分布里的位置 ---------------- */
function rankOf(mine, others) {
  const v = others.filter((x) => x != null && Number.isFinite(x));
  if (!v.length || mine == null || !Number.isFinite(mine)) return null;
  const below = v.filter((x) => x < mine).length;
  return { pct: below / v.length, n: v.length, min: Math.min(...v), max: Math.max(...v), mean: mean(v) };
}

function compareRow(label, mine, others, unit = 'ms', higherIsBetter = false) {
  const r = rankOf(mine, others);
  if (!r) return `<tr><td>${label}</td><td>${f0(mine)}</td><td colspan="3" class="note">全体样本不足</td></tr>`;
  const fmtv = unit === '%' ? (x) => pct(x) : (x) => f0(x) + ' ms';
  const better = higherIsBetter ? mine >= r.mean : mine <= r.mean;
  return `<tr><td>${label}</td>
    <td><b>${fmtv(mine)}</b></td>
    <td>${fmtv(r.mean)}</td>
    <td>${fmtv(r.min)} – ${fmtv(r.max)}</td>
    <td>${better ? '优于' : '劣于'}全体均值 · 高于 ${Math.round(r.pct * 100)}% 的人</td></tr>`;
}

/* ---------------- 主入口 ---------------- */
export async function main(ctx = {}) {
  const body = $('analysis-body');
  if (!body) return;
  const { cb, yah, sid } = ctx;
  body.innerHTML = '<p class="note">正在读取全体被试数据……</p>';

  let recsCB = [], recsYAH = [], err = null;
  const fail = (e) => { err = err || e; return []; };
  [recsCB, recsYAH] = await Promise.all([
    loadAll(PROJECTS.cb, 'changeblind_cue_arrow').catch(fail),
    loadAll(PROJECTS.yah, 'yah_heading_cue').catch(fail),
  ]);
  // 「全体」不含自己，避免自己和自己比
  const othersCB = recsCB.filter((r) => r.participant !== sid);
  const othersYAH = recsYAH.filter((r) => r.participant !== sid);

  const html = [];
  try {
    html.push(header(ctx, recsCB, recsYAH, othersCB, othersYAH, err));
    html.push(sectionCB(cb, othersCB));
    html.push(sectionYAH(yah, othersYAH));
    html.push(sectionWrap());
    body.innerHTML = html.join('');
  } catch (e) {
    body.innerHTML = `<div class="warn">分析页渲染出错：${e && e.message ? e.message : e}。<br>
      实验数据本身已经上传，不影响；把控制台的报错发给开发者即可。</div>`;
    console.error('[analysis]', e);
  }
}

function header(ctx, recsCB, recsYAH, othersCB, othersYAH, err) {
  const pills = `<span class="pill">实验一 全体 ${recsCB.length} 份</span>
    <span class="pill">实验二 全体 ${recsYAH.length} 份</span>
    ${ctx.cb ? '<span class="pill">含你本次的实验一</span>' : ''}
    ${ctx.yah ? '<span class="pill">含你本次的实验二</span>' : ''}`;
  const warn = err ? `<div class="warn">读不到全体数据（${err.message}）。下面的「我」仍然有效，但无法与全体对比 —— 通常是没有联网，或页面以 file:// 打开被跨域拦截。</div>` : '';
  return `<h1>数据分析</h1>
    <p class="lead">下面按作业要求给出三件事：<b>效应量计算</b>、<b>与原文对比</b>、<b>改进条件检验</b>；最后把你自己放进全体被试里看位置。
    效应量：独立样本用 Cohen's <i>d</i>，被试内用 Cohen's <i>dz</i>；p 值为双尾。${stars(0.04)}记号：* p&lt;.05，** p&lt;.01，*** p&lt;.001，n.s. 不显著。</p>
    <div style="margin:10px 0 4px">${pills}</div>${warn}`;
}

/* ======================= 实验一 ======================= */
function sectionCB(mine, others) {
  const out = ['<h2>实验一 · 闪烁找变化（单场景广场 + 方向箭头）</h2>'];
  if (!mine) {
    out.push('<div class="card"><p class="note">你本次没有完成实验一，下面只显示全体的结果。</p></div>');
  }
  const allMine = mine ? mine.trials : [];
  const S = cbStats(allMine);
  const okTrials = allMine.filter((t) => t.resp_ms != null && t.resp_ms !== '').map((t) => +t.resp_ms);

  if (mine) {
    out.push(`<div class="card">
      <table>
        <tr><th>线索条件</th><th>试次</th><th>觉察率</th><th>平均觉察时间</th><th>中位数</th><th>定位正确率</th></tr>
        ${[0, 1, 2].map((c) => `<tr><td>${CUE_NAME[c]}</td><td>${S[c].n}</td><td>${pct(S[c].det_rate)}</td>
          <td>${ms(S[c].rt)}<span class="note"> ± ${f0(S[c].rt_sd)}</span></td><td>${ms(S[c].rt_med)}</td><td>${pct(S[c].loc_rate)}</td></tr>`).join('')}
      </table>
      <p class="note">你的数据：共 ${allMine.length} 试次，其中 ${allMine.length - okTrials.length} 次超时未报告。定位判定为点击落在变化区域 ±32 px 内。</p>
    </div>`);

    // 效应量（试次级，独立样本）
    const eff = [];
    const pair = (a, b, name, pred) => {
      const r = indT(S[a].rts, S[b].rts);
      if (!r) { eff.push(`<tr><td>${name}</td><td colspan="5" class="note">试次不足，无法计算</td></tr>`); return; }
      eff.push(`<tr><td>${name}</td><td>${sgn(r.diff)}</td><td>${f2(r.d)}（${dLabel(r.d)}）</td>
        <td><i>t</i>(${f1(r.df)}) = ${f2(r.t)}</td><td>${fp(r.p)} ${stars(r.p)}</td>
        <td>${pred(r.diff) ? '与预测一致' : '与预测<b>相反</b>'}</td></tr>`);
    };
    pair(2, 1, '无效 − 有效（线索有效性效应）', (d) => d > 0);
    pair(0, 1, '无箭头 − 有效（加箭头的收益）', (d) => d > 0);
    pair(0, 2, '无箭头 − 无效（错误线索的代价）', (d) => d > 0);

    out.push(`<div class="card">
      <div class="note" style="margin-bottom:6px">效应量（你的数据，试次级）</div>
      <table>
        <tr><th>对比</th><th>RT 差</th><th>Cohen's d</th><th>检验</th><th>p</th><th>方向</th></tr>
        ${eff.join('')}
      </table>
      <p class="note">预测①：箭头有效应快于无效（差值为正）。预测②（改进的核心）：加箭头应优于不加箭头，即「无箭头 − 有效」为正。</p>
    </div>`);
  }

  // 全体被试级分析
  const per = others.map((r) => {
    const s = cbStats(r.trials || []);
    return {
      participant: r.participant,
      none: s[0].rt, valid: s[1].rt, invalid: s[2].rt,
      validN: s[1].n, invalidN: s[2].n, noneN: s[0].n,
      det: (s[0].detected + s[1].detected + s[2].detected) / Math.max(1, s[0].n + s[1].n + s[2].n),
      loc: mean([s[0].loc_rate, s[1].loc_rate, s[2].loc_rate].filter((v) => v != null)),
    };
  }).filter((x) => x.validN + x.invalidN + x.noneN > 0);

  out.push(groupCB(per, mine ? cbStats(allMine) : null));

  // 我 vs 全体
  if (mine) {
    const myDet = mean([0, 1, 2].map((c) => S[c].det_rate));
    const myLoc = mean([0, 1, 2].map((c) => S[c].loc_rate).filter((v) => v != null));
    const myGain = (S[0].rt != null && S[1].rt != null) ? S[0].rt - S[1].rt : null;
    const myCost = (S[2].rt != null && S[0].rt != null) ? S[2].rt - S[0].rt : null;
    out.push(`<div class="card">
      <div class="note" style="margin-bottom:6px">你 vs 全体（每个被试一个点）</div>
      <table>
        <tr><th>指标</th><th>你</th><th>全体均值</th><th>全体范围</th><th>位置</th></tr>
        ${compareRow('无箭头 觉察时间', S[0].rt, per.map((p) => p.none))}
        ${compareRow('有效箭头 觉察时间', S[1].rt, per.map((p) => p.valid))}
        ${compareRow('无效箭头 觉察时间', S[2].rt, per.map((p) => p.invalid))}
        ${compareRow('线索收益（无箭头−有效）', myGain, per.map((p) => (p.none != null && p.valid != null ? p.none - p.valid : null)))}
        ${compareRow('错误线索代价（无效−无箭头）', myCost, per.map((p) => (p.invalid != null && p.none != null ? p.invalid - p.none : null)))}
        ${compareRow('觉察率', myDet, per.map((p) => p.det), '%', true)}
        ${compareRow('定位正确率', myLoc, per.map((p) => p.loc), '%', true)}
      </table>
      <p class="note">「高于 x% 的人」只按数值排序，不代表好坏；时间类指标数值越小越快。</p>
    </div>`);
  }

  // 与原文对比
  out.push(`<div class="card">
    <div class="note" style="margin-bottom:6px">与原文对比</div>
    <table>
      <tr><th>项目</th><th>Rensink, O'Regan &amp; Clark (1997)</th><th>本实验</th><th>说明</th></tr>
      <tr><td>范式</td><td>闪烁范式：原图 240 ms ↔ 灰屏 80 ms ↔ 改图 240 ms</td><td>240 ms ↔ <b>160 ms</b> ↔ 240 ms</td><td>灰屏更长，掩蔽更强，按说不该更快</td></tr>
      <tr><td>刺激</td><td>48 张真实照片，含中央 / 边缘兴趣物体</td><td>单个程序化广场，26 个行人，变化=多一个人</td><td>画面细节远少于照片</td></tr>
      <tr><td>平均觉察时间</td><td>约 <b>7.8–11 s</b>（不同报告口径不同）；中央兴趣 &lt; 边缘兴趣</td><td>${mine ? ms(mean(okTrials)) : '见下表'}</td><td>本实验快一个量级，属预期：素材简单、目标同质</td></tr>
      <tr><td>觉察率</td><td>大变化也可能长时间漏检（60 s 内未报告不算罕见）</td><td>${mine ? pct(mean([0, 1, 2].map((c) => S[c].det_rate))) : '—'}</td><td>本实验有 30 s 限时，且要求点击定位</td></tr>
    </table>
    <p class="note">结论：本实验复现了「闪烁范式下变化很难被发现」这一核心现象的方向，但绝对时间不能与原文直接比 —— 素材复杂度、变化物体同质性、是否要求定位都不同。报告中应写成「方向一致、量级更小」，并说明原因，而不是硬套原文数值。</p>
  </div>`);

  // 改进条件检验
  if (mine) {
    const dValid = (S[0].rt != null && S[1].rt != null) ? S[0].rt - S[1].rt : null;
    const dInvalid = (S[0].rt != null && S[2].rt != null) ? S[0].rt - S[2].rt : null;
    const verdict = dValid == null ? '数据不足' : dValid > 0 ? '支持' : '不支持';
    out.push(`<div class="card">
      <div class="note" style="margin-bottom:6px">改进条件检验（改进 = 闪烁前加方向箭头）</div>
      <p>理论依据：箭头把注意预先导向变化方位（Posner 线索化范式）。若成立，<b>有效箭头</b>应快于<b>无箭头基线</b>，<b>无效箭头</b>应慢于基线（重新定向的代价）。</p>
      <table>
        <tr><th>对比</th><th>你的差值</th><th>判断</th></tr>
        <tr><td>无箭头 − 有效（收益）</td><td>${sgn(dValid)}</td><td>${verdict}</td></tr>
        <tr><td>无箭头 − 无效（代价）</td><td>${sgn(dInvalid)}</td><td>${dInvalid == null ? '数据不足' : dInvalid > 0 ? '支持' : '不支持'}</td></tr>
      </table>
      <p class="note">注意：只有「无箭头」基线存在时，这个检验才有意义 —— 这正是把设计从 2 水平（有效/无效）改成 3 水平的原因。原来的 2 水平设计只能说明「指对了有没有用」，说明不了「加箭头有没有用」。</p>
    </div>`);
  }
  return out.join('');
}

function groupCB(per, mineS) {
  if (!per.length) return '<div class="card"><p class="note">全体还没有实验一数据。</p></div>';
  const rows = per.map((p) => `<tr><td>${p.participant}</td><td>${p.noneN}</td><td>${ms(p.none)}</td><td>${p.validN}</td><td>${ms(p.valid)}</td><td>${p.invalidN}</td><td>${ms(p.invalid)}</td><td>${pct(p.det)}</td><td>${pct(p.loc)}</td></tr>`).join('');
  const dv = per.map((p) => (p.valid != null && p.invalid != null ? p.invalid - p.valid : null)).filter((v) => v != null);
  const dn = per.map((p) => (p.valid != null && p.none != null ? p.none - p.valid : null)).filter((v) => v != null);
  const pv = pairedT(dv), pn = pairedT(dn);
  const cnt = (k) => per.filter((p) => (p[k + 'N'] || 0) >= 10).length;

  return `<div class="card">
    <div class="note" style="margin-bottom:6px">全体被试（不含你）· 每人 36 试次，每条件 12 试次</div>
    <table>
      <tr><th>被试</th><th>无箭头 n</th><th>RT</th><th>有效 n</th><th>RT</th><th>无效 n</th><th>RT</th><th>觉察率</th><th>定位率</th></tr>
      ${rows}
    </table>
    <table style="margin-top:12px">
      <tr><th>被试内效应（全体）</th><th>平均差</th><th>Cohen's dz</th><th>检验</th><th>p</th></tr>
      <tr><td>无效 − 有效（线索有效性）</td><td>${sgn(pv ? pv.diff : null)}</td><td>${pv ? f2(pv.dz) + '（' + dLabel(pv.dz) + '）' : '—'}</td><td>${pv ? `<i>t</i>(${pv.df}) = ${f2(pv.t)}` : '—'}</td><td>${pv ? fp(pv.p) + ' ' + stars(pv.p) : '—'}</td></tr>
      <tr><td>无箭头 − 有效（加箭头收益）</td><td>${sgn(pn ? pn.diff : null)}</td><td>${pn ? f2(pn.dz) + '（' + dLabel(pn.dz) + '）' : '—'}</td><td>${pn ? `<i>t</i>(${pn.df}) = ${f2(pn.t)}` : '—'}</td><td>${pn ? fp(pn.p) + ' ' + stars(pn.p) : '—'}</td></tr>
    </table>
    <p class="note">满足「每条件 ≥10 试次」的被试：${cnt('valid')} 人。检测到 ${per.length} 份记录（同一人重复做会出现多条）。</p>
  </div>`;
}

/* ======================= 实验二 ======================= */
function sectionYAH(mine, others) {
  const out = ['<h2>实验二 · 「你在这里」地图 + 朝向视锥</h2>'];
  if (!mine) out.push('<div class="card"><p class="note">你本次没有完成实验二，下面只显示全体的结果。</p></div>');

  if (mine) {
    const Y = yahStats(mine.trials);
    const c0 = Y.byCue[0], c1 = Y.byCue[1];
    const acc0 = [0, 90, 180].map((r) => Y.cell['0|' + r].acc);
    const rt0 = [0, 90, 180].map((r) => Y.cell['0|' + r].rt);
    const align = (rt0[2] != null && rt0[0] != null) ? rt0[2] - rt0[0] : null;

    out.push(`<div class="card">
      <div class="note" style="margin-bottom:6px">你的数据（2 提示 × 3 旋转，正确率 / 正确试次 RT）</div>
      <table>
        <tr><th>条件</th><th>旋转 0°</th><th>旋转 90°</th><th>旋转 180°</th></tr>
        ${[0, 1].map((cue) => `<tr><td>${cue ? '有朝向视锥' : '无视锥'}</td>` +
          [0, 90, 180].map((r) => {
            const c = Y.cell[cue + '|' + r];
            return `<td>${pct(c.acc)}<br><span class="note">${ms(c.rt)} · n=${c.n}</span></td>`;
          }).join('') + '</tr>').join('')}
      </table>
      <p class="note">${Y.dropped ? `已剔除 ${Y.dropped} 个 RT &lt; ${RT_FLOOR} ms 的抢答试次。` : '没有出现 RT 低于 ' + RT_FLOOR + ' ms 的抢答试次。'}共 ${mine.trials.length} 试次。</p>
    </div>`);

    const pairAcc = indT(
      Y.clean.filter((t) => +t.cue === 1).map((t) => +t.correct),
      Y.clean.filter((t) => +t.cue === 0).map((t) => +t.correct));
    const rtCue = (cue) => Y.clean.filter((t) => +t.cue === cue && +t.correct === 1 && t.rt != null && t.rt !== '').map((t) => +t.rt);
    const pairRt = indT(rtCue(1), rtCue(0));

    out.push(`<div class="card">
      <div class="note" style="margin-bottom:6px">效应量（你的数据）</div>
      <table>
        <tr><th>对比</th><th>差值</th><th>Cohen's d</th><th>检验</th><th>p</th></tr>
        <tr><td>视锥 − 无视锥 正确率</td><td>${pairAcc ? sgn(pairAcc.diff * 100, ' pp') : '—'}</td><td>${pairAcc ? f2(pairAcc.d) + '（' + dLabel(pairAcc.d) + '）' : '—'}</td><td>${pairAcc ? `<i>t</i>(${f1(pairAcc.df)}) = ${f2(pairAcc.t)}` : '—'}</td><td>${pairAcc ? fp(pairAcc.p) + ' ' + stars(pairAcc.p) : '—'}</td></tr>
        <tr><td>视锥 − 无视锥 正确 RT</td><td>${pairRt ? sgn(pairRt.diff) : '—'}</td><td>${pairRt ? f2(pairRt.d) + '（' + dLabel(pairRt.d) + '）' : '—'}</td><td>${pairRt ? `<i>t</i>(${f1(pairRt.df)}) = ${f2(pairRt.t)}` : '—'}</td><td>${pairRt ? fp(pairRt.p) + ' ' + stars(pairRt.p) : '—'}</td></tr>
        <tr><td>无视锥条件 180° − 0°（对齐效应）</td><td>${sgn(align)}</td><td colspan="3" class="note">${align == null ? '—' : align > 0 ? '方向与 FORT 代价曲线一致（旋转越大越慢）' : '方向与 FORT 代价曲线相反'}</td></tr>
      </table>
      <p class="note">若正确率下降而 RT 同时变快，就是典型的<b>速度–准确率权衡</b>：视锥把朝向外部化，被试更快作答但更容易错 —— 这会削弱「视锥是纯改进」的结论。</p>
    </div>`);

    out.push(`<div class="card">
      <div class="note" style="margin-bottom:6px">与原文 / 教材对比（FORT 心理旋转代价）</div>
      <table>
        <tr><th>项目</th><th>原文 / 教材</th><th>本实验（无视锥）</th><th>判断</th></tr>
        <tr><td>代价随旋转角的变化</td><td>教材 Ch5 图 5-2：90° 以内代价较小，超过 90° 后陡增，180° 处因「左右对调」的捷径略有回落（Aretz, 1991；Aretz &amp; Wickens, 1992）</td><td>0° ${ms(rt0[0])} → 90° ${ms(rt0[1])} → 180° ${ms(rt0[2])}</td><td>${(rt0[1] != null && rt0[0] != null && rt0[2] != null) ? (rt0[1] - rt0[0] < rt0[2] - rt0[1] ? '形状一致（90° 内代价小于跨 90°）' : '不一致（90° 就明显变慢）') : '—'}</td></tr>
        <tr><td>视锥的作用</td><td>Woods (1984) 视觉动量；Aretz (1991)：在地图上画出视锥，帮助在两种参照系之间建立对应</td><td>正确率 ${pct(c0.acc)} → ${pct(c1.acc)}；RT ${ms(c0.rt)} → ${ms(c1.rt)}</td><td>${(c1.acc != null && c0.acc != null) ? (c1.acc > c0.acc + 0.03 ? '支持：视锥提高正确率' : c1.acc < c0.acc - 0.03 ? '<b>不支持：视锥反而降低正确率</b>' : '无差别') : '—'}</td></tr>
      </table>
      <p class="note">教材那条曲线本身标注为「形状依据教材图 5-2，纵轴不是实测数值」，所以只能比<b>形状</b>，不能比绝对值。</p>
    </div>`);
  }

  const per = others.map((r) => {
    const Y = yahStats(r.trials || []);
    return {
      participant: r.participant,
      acc0: Y.byCue[0].acc, acc1: Y.byCue[1].acc,
      rt0: Y.byCue[0].rt, rt1: Y.byCue[1].rt,
      align: (Y.cell['0|180'].rt != null && Y.cell['0|0'].rt != null) ? Y.cell['0|180'].rt - Y.cell['0|0'].rt : null,
      n: (r.trials || []).length, dropped: Y.dropped,
    };
  }).filter((x) => x.n > 0);

  out.push(groupYAH(per, mine ? yahStats(mine.trials) : null));

  // 我 vs 全体
  if (mine) {
    const Y = yahStats(mine.trials);
    const myAlign = (Y.cell['0|180'].rt != null && Y.cell['0|0'].rt != null) ? Y.cell['0|180'].rt - Y.cell['0|0'].rt : null;
    out.push(`<div class="card">
      <div class="note" style="margin-bottom:6px">你 vs 全体（每个被试一个点）</div>
      <table>
        <tr><th>指标</th><th>你</th><th>全体均值</th><th>全体范围</th><th>位置</th></tr>
        ${compareRow('无视锥 正确率', Y.byCue[0].acc, per.map((p) => p.acc0), '%', true)}
        ${compareRow('有视锥 正确率', Y.byCue[1].acc, per.map((p) => p.acc1), '%', true)}
        ${compareRow('无视锥 RT', Y.byCue[0].rt, per.map((p) => p.rt0))}
        ${compareRow('有视锥 RT', Y.byCue[1].rt, per.map((p) => p.rt1))}
        ${compareRow('对齐效应（180°−0°）', myAlign, per.map((p) => p.align))}
      </table>
      <p class="note">对齐效应偏大说明你的心理旋转代价比多数人更强；接近 0 或负值说明你没受地图朝向影响。</p>
    </div>`);
  }
  return out.join('');
}

function groupYAH(per, mineY) {
  if (!per.length) return '<div class="card"><p class="note">全体还没有实验二数据。</p></div>';
  const rows = per.map((p) => `<tr><td>${p.participant}</td><td>${pct(p.acc0)}</td><td>${pct(p.acc1)}</td><td>${ms(p.rt0)}</td><td>${ms(p.rt1)}</td><td>${sgn(p.align)}</td><td>${p.dropped ? '<span class="note">剔除 ' + p.dropped + '</span>' : '—'}</td></tr>`).join('');

  const build = (getA, getB) => {
    const d = per.map((p) => { const a = getA(p), b = getB(p); return (a != null && b != null) ? a - b : null; }).filter((v) => v != null);
    return pairedT(d);
  };
  const pAcc = build((p) => p.acc1, (p) => p.acc0);
  const pRt = build((p) => p.rt1, (p) => p.rt0);
  const pAl = build((p) => p.align, () => 0);

  return `<div class="card">
    <div class="note" style="margin-bottom:6px">全体被试（不含你）· 每人 48 试次；RT 已剔除 &lt; ${RT_FLOOR} ms 的抢答</div>
    <table>
      <tr><th>被试</th><th>无锥正确率</th><th>有锥正确率</th><th>无锥 RT</th><th>有锥 RT</th><th>对齐效应 180−0</th><th>剔除</th></tr>
      ${rows}
    </table>
    <table style="margin-top:12px">
      <tr><th>被试内效应（全体）</th><th>平均差</th><th>Cohen's dz</th><th>检验</th><th>p</th></tr>
      <tr><td>视锥 − 无视锥 正确率</td><td>${pAcc ? sgn(pAcc.diff * 100, ' pp') : '—'}</td><td>${pAcc ? f2(pAcc.dz) + '（' + dLabel(pAcc.dz) + '）' : '—'}</td><td>${pAcc ? `<i>t</i>(${pAcc.df}) = ${f2(pAcc.t)}` : '—'}</td><td>${pAcc ? fp(pAcc.p) + ' ' + stars(pAcc.p) : '—'}</td></tr>
      <tr><td>视锥 − 无视锥 正确 RT</td><td>${pRt ? sgn(pRt.diff) : '—'}</td><td>${pRt ? f2(pRt.dz) + '（' + dLabel(pRt.dz) + '）' : '—'}</td><td>${pRt ? `<i>t</i>(${pRt.df}) = ${f2(pRt.t)}` : '—'}</td><td>${pRt ? fp(pRt.p) + ' ' + stars(pRt.p) : '—'}</td></tr>
      <tr><td>对齐效应 180°−0°（是否 &gt; 0）</td><td>${pAl ? sgn(pAl.diff) : '—'}</td><td>${pAl ? f2(pAl.dz) + '（' + dLabel(pAl.dz) + '）' : '—'}</td><td>${pAl ? `<i>t</i>(${pAl.df}) = ${f2(pAl.t)}` : '—'}</td><td>${pAl ? fp(pAl.p) + ' ' + stars(pAl.p) : '—'}</td></tr>
    </table>
    <p class="note">对齐效应一行是「每个被试的 (RT180−RT0) 与 0 做单样本检验」，即全体是否真的存在旋转代价。</p>
  </div>`;
}

/* ======================= 收尾 ======================= */
function sectionWrap() {
  return `<h2>怎么把这些写进报告</h2>
    <div class="card">
      <table>
        <tr><th>评分要求</th><th>对应上面的哪一块</th><th>写的时候注意</th></tr>
        <tr><td>每实验 ≥5 名他人、每条件 ≥10 试次</td><td>「全体被试」表里的 n 列</td><td>实验一每条件 12、实验二每条件 24；核对人数时要按<b>记录</b>去重，同一人重复做会出现两条</td></tr>
        <tr><td>效应计算</td><td>「效应量」与「全体被试内效应」两张表</td><td>被试内设计报 Cohen's <i>dz</i>，不要报 <i>d</i>；同时给出 t、df、p</td></tr>
        <tr><td>与原文对比</td><td>「与原文对比」「与原文 / 教材对比」</td><td>只比方向和形状，不比绝对值；说明素材与任务差异</td></tr>
        <tr><td>检验改进条件</td><td>「改进条件检验」与视锥那一行</td><td>必须对着<b>基线</b>说（无箭头 / 无视锥），否则只是在说「指对了有没有用」</td></tr>
      </table>
      <p class="note">数据质量提醒：实验二的 RT 低于 ${RT_FLOOR} ms 的试次是抢答（被试在注视点出现前就按键），上面已自动剔除；若你的「剔除」数很多，说明你在赶时间，这些试次的正确率不能当真。</p>
    </div>`;
}
