// 作业报告页（图表为主）：直接读后端数据，把「最后一条记录」当作当前被试
import { loadAll, PROJECTS } from './lib/upload.js';
import { mean, sd, med, quant, pairedT, rankOf } from './lib/stats.js';
import { barChart, groupedBar, dotPlot, effectBar, pctRow } from './lib/chart.js';

const $ = (id) => document.getElementById(id);

// 实验一：<200 ms 是预判性抢答；>20 s 基本等于没看见（超时上限 30 s），两者都不进统计
const CB_FLOOR = 200, CB_CEIL = 20000;
// 实验二：RT 任务，<200 ms 一律按抢答剔除
const RT_FLOOR = 200;

const CUE_NAME = ['无箭头（基线）', '箭头指向正确', '箭头指向相反'];
const C_GRAY = '#b0bccd', C_GOLD = '#C8A44A', C_BLUE = '#5b7fb5';

const f0 = (x) => (x == null || !Number.isFinite(x) ? '—' : Math.round(x).toLocaleString());
const pc = (x) => (x == null || !Number.isFinite(x) ? '—' : (x * 100).toFixed(1) + '%');
const sgn = (x, u = ' ms') => (x == null || !Number.isFinite(x) ? '—' : (x > 0 ? '+' : '') + Math.round(x) + u);
const df2 = (x) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(2));
const stars = (p) => (p == null ? '' : p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'n.s.');
const pf = (p) => (p == null ? '—' : p < 0.001 ? '&lt;.001' : p.toFixed(3).replace(/^0/, ''));
// 行文里用的 p 值写法：p = .371（n.s.） / p < .001（***）
const pShow = (p) => (p == null ? 'p = —'
  : p < 0.001 ? 'p < .001（***）'
    : `p = ${p.toFixed(3).replace(/^0/, '')}（${stars(p)}）`);

/* ================= 记录口径 ================= */
// 新设计（36 试次、cue_type 0/1/2）与旧设计（12 试次、只有 cue_valid 0/1）分开聚合
const isNewCB = (r) => (r.trials || []).some((t) => t.cue_type != null && t.cue_type !== '');
const kindOf = (r, t) => (isNewCB(r) ? +t.cue_type : (+t.cue_valid === 1 ? 1 : 2));

// 同一被试可能重复提交，只保留最后一条
function dedupe(recs) {
  const map = new Map();
  for (const r of recs) map.set(r.participant, r);
  return [...map.values()];
}

function cbClean(r) {
  const all = r.trials || [];
  const tr = all.filter((t) => {
    const ms = +t.resp_ms;
    return t.resp_ms != null && t.resp_ms !== '' && Number.isFinite(ms) && ms >= CB_FLOOR && ms <= CB_CEIL;
  });
  return { tr, total: all.length, drop: all.length - tr.length };
}

// 指定线索条件下的反应时（已清洗）
function condRT(r, kind) {
  return cbClean(r).tr.filter((t) => kindOf(r, t) === kind).map((t) => +t.resp_ms);
}
// 中位数：变化觉察的时间分布右偏严重（含接近超时的长尾），用中位数比均值稳
const condMed = (r, kind) => med(condRT(r, kind));

function cbOne(r) {
  const c = cbClean(r);
  const out = { dropped: c.drop, total: c.total, kept: c.tr.length };
  for (const k of [0, 1, 2]) {
    const all = (r.trials || []).filter((t) => kindOf(r, t) === k);
    const rts = condRT(r, k);
    out[k] = {
      n: all.length,
      k: rts.length,
      med: med(rts),
      mean: mean(rts),
      sd: sd(rts),
      hiq: rts.length >= 4 ? (quant(rts, 0.75) - quant(rts, 0.25)) / 2 : null,
      loc: rts.length ? all.filter((t) => +t.click_ok === 1).length / all.length : null,
    };
  }
  return out;
}

/* ================= 实验二：2 提示 × 3 旋转 ================= */
function yahOne(r) {
  const tr = r.trials || [];
  const clean = tr.filter((t) => t.rt == null || t.rt === '' || +t.rt >= RT_FLOOR);
  const cell = {};
  for (const cue of [0, 1]) {
    for (const rot of [0, 90, 180]) {
      const a = clean.filter((t) => +t.cue === cue && +t.rot === rot);
      const good = a.filter((t) => +t.correct === 1 && t.rt != null && t.rt !== '' && +t.rt >= RT_FLOOR);
      cell[cue + '|' + rot] = {
        n: a.length,
        acc: a.length ? a.filter((t) => +t.correct === 1).length / a.length : null,
        rt: mean(good.map((t) => +t.rt)),
      };
    }
  }
  const by = {};
  for (const cue of [0, 1]) {
    const c = [0, 90, 180].map((r0) => cell[cue + '|' + r0]);
    by[cue] = {
      acc: mean(c.map((x) => x.acc).filter((v) => v != null)),
      rt: mean(c.map((x) => x.rt).filter((v) => v != null)),
    };
  }
  return { clean, cell, by, dropped: tr.length - clean.length };
}

/* ================= 页面装配 ================= */
const card = (title, note, svg, extra = '') =>
  `<div class="card"><h2 class="rep-h">${title}</h2>${note ? `<p class="note">${note}</p>` : ''}${svg}${extra}</div>`;

export async function main() {
  const body = $('report-body');
  if (!body) return;
  body.innerHTML = '<p class="note">正在读取后端数据……</p>';

  let rawCB = [], rawYAH = [], err = null;
  const fail = (e) => { err = err || e; return []; };
  [rawCB, rawYAH] = await Promise.all([
    loadAll(PROJECTS.cb, 'changeblind_cue_arrow').catch(fail),
    loadAll(PROJECTS.yah, 'yah_heading_cue').catch(fail),
  ]);
  if (err && !rawCB.length && !rawYAH.length) {
    body.innerHTML = `<div class="warn">读不到后端数据：${err.message}<br>请用 https 打开本页，并确认能访问课程服务器。</div>`;
    return;
  }

  // 当前被试 = 后端最后一条记录（实验一优先，取不到再看实验二）
  const who = rawCB.length ? rawCB[rawCB.length - 1].participant
    : (rawYAH.length ? rawYAH[rawYAH.length - 1].participant : null);

  const recsCB = dedupe(rawCB);
  const recsYAH = dedupe(rawYAH);
  const mineCB = recsCB.filter((r) => r.participant === who).slice(-1)[0] || null;
  const mineYAH = recsYAH.filter((r) => r.participant === who).slice(-1)[0] || null;

  const ctx = {
    who, rawCB, rawYAH, recsCB, recsYAH, mineCB, mineYAH,
    cb: mineCB ? cbOne(mineCB) : null,
    yah: mineYAH ? yahOne(mineYAH) : null,
  };

  const html = [
    sceneHeader(ctx, err),
    sceneCB1(ctx),
    sceneCB2(ctx),
    sceneYAH(ctx),
    sceneEffects(ctx),
    sceneMine(ctx),
    sceneConclusion(ctx),
  ];
  body.innerHTML = html.filter(Boolean).join('');
}

/* ---------------- 页头 ---------------- */
function sceneHeader(ctx, err) {
  const { who, rawCB, rawYAH, recsCB, recsYAH, mineYAH } = ctx;
  const t = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const when = `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
  const nNew = recsCB.filter(isNewCB).length;
  const y = mineYAH ? yahOne(mineYAH) : null;
  const bad = y && y.dropped / Math.max(1, (mineYAH.trials || []).length) > 0.25;

  return `<div class="rep-head">
    <div>
      <h1>注意与空间认知 · 实验报告</h1>
      <p class="note">实验一：闪烁找变化（Rensink, O'Regan &amp; Clark, 1997）+ 方向箭头线索<br>实验二：「你在这里」地图（Aretz, 1991）+ 朝向视锥</p>
    </div>
    <div class="rep-meta">
      <div><span>生成时间</span><b>${when}</b></div>
      <div><span>实验一</span><b>${recsCB.length} 人（新设计 ${nNew} 人）</b></div>
      <div><span>实验二</span><b>${recsYAH.length} 人</b></div>
      <div><span>当前被试</span><b>${who || '—'} · 后端最后一条</b></div>
    </div>
  </div>
  ${err ? `<div class="warn">${err.message}</div>` : ''}
  ${rawCB.length > recsCB.length ? `<div class="warn">后端有 ${rawCB.length} 条实验一记录，同编号被试只取最新一条，故按 ${recsCB.length} 人计。</div>` : ''}
  ${bad ? `<div class="warn">${who} 的实验二有 ${y.dropped}/${(mineYAH.trials || []).length} 个试次 RT &lt; ${RT_FLOOR} ms（抢答），已从分析中剔除；这类数据的正确率不宜当真。</div>` : ''}`;
}

/* ---------------- 图 1：实验一 · 当前被试三条件 ---------------- */
function sceneCB1(ctx) {
  const { cb, who, recsCB } = ctx;
  if (!cb) return card('图 1 ｜ 实验一：觉察时间', '', '<p class="note">后端还没有实验一记录</p>');

  const items = [0, 1, 2].map((c) => ({
    label: CUE_NAME[c],
    value: cb[c].med,
    sd: cb[c].hiq,
    note: cb[c].k ? `${cb[c].k} 试次` : '无数据',
    color: c === 0 ? C_GRAY : c === 1 ? C_GOLD : C_BLUE,
  })).filter((d) => d.value != null);

  const svg = items.length
    ? barChart({ items, fmt: (v) => f0(v), ref: null })
    : '<p class="note">这一份记录里没有可用的反应时</p>';

  const v = cb[1].med, inv = cb[2].med, none = cb[0].med;
  const gain = v != null && none != null ? none - v : null;
  const cost = v != null && inv != null ? inv - v : null;
  const nNew = recsCB.filter(isNewCB).length;

  const note = `柱高＝<b>中位数</b>，误差线＝半四分位距（IQR/2）。变化觉察的时间分布右偏很厉害（含接近超时的长尾），中位数比均值更能代表典型表现。` +
    `已剔除 &lt;${CB_FLOOR} ms 与 &gt;${CB_CEIL / 1000} s 的试次（本份记录剔除 ${cb.dropped}/${cb.total} 个）。` +
    (nNew === 1 ? `<br><b>注意：</b>目前只有 ${nNew} 名被试完成新设计，实验一的跨被试比较只能用「错误线索 − 正确线索」这个旧设计也有的口径。` : '');

  return card(`图 1 ｜ 实验一：三种线索条件下的觉察时间（当前被试 ${who}）`, note, svg,
    `<table style="margin-top:14px">
      <tr><th>线索条件</th><th>中位数</th><th>均值</th><th>SD</th><th>有效 / 总试次</th><th>点击命中</th></tr>
      ${[0, 1, 2].map((c) => cb[c].k === 0 ? '' :
        `<tr><td>${CUE_NAME[c]}</td><td>${f0(cb[c].med)} ms</td><td>${f0(cb[c].mean)} ms</td><td>${f0(cb[c].sd)}</td><td>${cb[c].k} / ${cb[c].n}</td><td>${pc(cb[c].loc)}</td></tr>`).join('')}
    </table>
    <p class="note" style="margin-top:10px">线索收益（无箭头 − 正确箭头，按中位数）= <b>${sgn(gain)}</b>　·　重新定向代价（错误箭头 − 正确箭头）= <b>${sgn(cost)}</b></p>`);
}

/* ---------------- 图 2：实验一 · 跨被试「错误 − 正确」 ---------------- */
function sceneCB2(ctx) {
  const { recsCB, who } = ctx;
  const rows = recsCB.map((r) => {
    const v = condMed(r, 1);
    const iv = condMed(r, 2);
    return { p: r.participant, v, iv, d: (v != null && iv != null) ? iv - v : null };
  }).filter((x) => x.d != null);
  if (rows.length < 2) return card('图 2 ｜ 实验一：错误线索的代价', '', '<p class="note">能算出该指标的被试不足 2 人</p>');

  const ds = rows.map((x) => x.d);
  const pt = pairedT(ds);
  const svg = dotPlot({
    points: rows.map((x) => ({ label: x.p, v: x.d, hi: x.p === who })),
    fmt: (v) => (v > 0 ? '+' : '') + Math.round(v),
    avg: mean(ds),
    xLabel: `错误线索 − 正确线索（ms，中位数差）。虚线＝全体平均 ${sgn(mean(ds))}；点在 0 右侧＝重新定向有代价`,
  });

  return card('图 2 ｜ 实验一：每个被试的重新定向代价',
    `${rows.length} 名被试，金点为当前被试。旧设计（12 试次）与新设计（36 试次）在这个对比上口径一致，可以放在一起比。`,
    svg,
    pt ? `<p class="note" style="margin-top:8px">被试内检验：平均差 <b>${sgn(pt.diff)}</b>，dz = <b>${df2(pt.dz)}</b>，t(${pt.df}) = ${df2(pt.t)}，${pShow(pt.p)}，n = ${pt.n}</p>` : '');
}

/* ---------------- 图 3-4：实验二 ---------------- */
function sceneYAH(ctx) {
  const { recsYAH, who } = ctx;
  if (!recsYAH.length) return card('图 3 ｜ 实验二', '', '<p class="note">后端还没有实验二记录</p>');

  const per = recsYAH.map((r) => ({ p: r.participant, y: yahOne(r) }));
  const avgOf = (cue, rot, key) => mean(per.map((x) => x.y.cell[cue + '|' + rot][key]).filter((v) => v != null));

  const rtSeries = [
    { name: '无视锥', color: C_GRAY, values: { '0°': avgOf(0, 0, 'rt'), '90°': avgOf(0, 90, 'rt'), '180°': avgOf(0, 180, 'rt') } },
    { name: '有视锥', color: C_GOLD, values: { '0°': avgOf(1, 0, 'rt'), '90°': avgOf(1, 90, 'rt'), '180°': avgOf(1, 180, 'rt') } },
  ];
  const accSeries = [
    { name: '无视锥', color: C_GRAY, values: { '0°': avgOf(0, 0, 'acc'), '90°': avgOf(0, 90, 'acc'), '180°': avgOf(0, 180, 'acc') } },
    { name: '有视锥', color: C_GOLD, values: { '0°': avgOf(1, 0, 'acc'), '90°': avgOf(1, 90, 'acc'), '180°': avgOf(1, 180, 'acc') } },
  ];
  if (rtSeries[0].values['0°'] == null && rtSeries[1].values['0°'] == null) {
    return card('图 3 ｜ 实验二', '', '<p class="note">记录里没有可用的反应时</p>');
  }

  const at = (s, k) => (s.values[k] == null ? null : s.values[k]);
  const d0 = at(rtSeries[0], '180°') != null && at(rtSeries[0], '0°') != null ? at(rtSeries[0], '180°') - at(rtSeries[0], '0°') : null;
  const d1 = at(rtSeries[1], '180°') != null && at(rtSeries[1], '0°') != null ? at(rtSeries[1], '180°') - at(rtSeries[1], '0°') : null;

  const f3 = groupedBar({ groups: ['0°', '90°', '180°'], series: rtSeries, fmt: (v) => f0(v) });
  const f4 = groupedBar({ groups: ['0°', '90°', '180°'], series: accSeries, fmt: (v) => Math.round(v * 100) + '%' });

  return card('图 3 ｜ 实验二：地图旋转对反应时的影响',
    `${per.length} 名被试的条件均值再取平均（只算正确试次）。180° − 0° 的代价：无视锥 <b>${sgn(d0)}</b>，有视锥 <b>${sgn(d1)}</b>。教材 Ch5 的 FORT 曲线预测 90° 以内代价较小、之后陡增、180° 略有回落。`,
    f3)
    + card('图 4 ｜ 实验二：正确率',
      `已剔除 RT &lt; ${RT_FLOOR} ms 的抢答试次。若视锥让人变快但正确率下降，就是速度–准确率权衡，不能算「改进」。当前被试：${who}。`,
      f4);
}

/* ---------------- 图 5：效应量汇总 ---------------- */
function sceneEffects(ctx) {
  const { recsCB, recsYAH } = ctx;
  const items = [], rows = [];

  const push = (label, res, unitFn) => {
    if (!res) return;
    items.push({ label, v: res.dz, text: `${df2(res.dz)} ${stars(res.p)}` });
    rows.push(`<tr><td>${label}</td><td>${unitFn(res.diff)}</td><td>${df2(res.dz)}</td><td>${res.n}</td><td>${pf(res.p)} ${stars(res.p)}</td></tr>`);
  };

  // 实验一：错误线索 − 正确线索（全部被试，口径统一）
  const dInv = recsCB.map((r) => {
    const v = condMed(r, 1), iv = condMed(r, 2);
    return v != null && iv != null ? iv - v : null;
  }).filter((x) => x != null);
  push('实验一　错误线索 − 正确线索', pairedT(dInv), (d) => sgn(d));

  // 实验二：视锥主效应 + 旋转代价
  const perY = recsYAH.map((r) => yahOne(r));
  const dAcc = perY.map((y) => (y.by[1].acc != null && y.by[0].acc != null ? y.by[1].acc - y.by[0].acc : null)).filter((x) => x != null);
  const dRt = perY.map((y) => (y.by[1].rt != null && y.by[0].rt != null ? y.by[1].rt - y.by[0].rt : null)).filter((x) => x != null);
  const dAlign = perY.map((y) => (y.cell['0|180'].rt != null && y.cell['0|0'].rt != null ? y.cell['0|180'].rt - y.cell['0|0'].rt : null)).filter((x) => x != null);
  push('实验二　有视锥 − 无视锥（正确率）', pairedT(dAcc), (d) => sgn(d * 100, ' pp'));
  push('实验二　有视锥 − 无视锥（反应时）', pairedT(dRt), (d) => sgn(d));
  push('实验二　180° − 0°（反应时，无视锥）', pairedT(dAlign), (d) => sgn(d));

  if (!items.length) return card('图 5 ｜ 效应量汇总', '', '<p class="note">可用被试不足 2 人，无法做被试内检验</p>');

  return card('图 5 ｜ 效应量汇总（被试内，Cohen\'s dz）',
    `每名被试贡献一个差值，再对差值做单样本 t 检验。条越长效应越大；方向只表示「谁减谁」，不代表好坏。星号双尾：* p&lt;.05，** p&lt;.01，*** p&lt;.001。`,
    effectBar({ items }),
    `<table style="margin-top:14px">
      <tr><th>对比</th><th>平均差</th><th>dz</th><th>n</th><th>p</th></tr>
      ${rows.join('')}
    </table>`);
}

/* ---------------- 图 6：当前被试 vs 全体 ---------------- */
function sceneMine(ctx) {
  const { who, recsCB, recsYAH, cb, yah, mineCB, mineYAH } = ctx;
  if (!who) return '';
  const rows = [];

  const othersCB = recsCB.filter((r) => r.participant !== who);
  const othersY = recsYAH.filter((r) => r.participant !== who);

  // ① 正确箭头条件下的觉察时间（越短越快 → 排位取 1 − pct）
  if (cb && cb[1].med != null) {
    const rk = rankOf(cb[1].med, othersCB.map((r) => condMed(r, 1)));
    if (rk) {
      rows.push(pctRow({
        label: '实验一 觉察时间（正确线索）',
        value: f0(cb[1].med) + ' ms',
        pct: 1 - rk.pct,
        hint: `快过 ${Math.round((1 - rk.pct) * 100)}% 的人（n=${rk.n}）`,
      }));
    }
  }

  // ② 重新定向代价
  const v1 = mineCB ? condMed(mineCB, 1) : null, v2 = mineCB ? condMed(mineCB, 2) : null;
  if (v1 != null && v2 != null) {
    const mine = v2 - v1;
    const rk = rankOf(mine, othersCB.map((r) => {
      const a = condMed(r, 1), b = condMed(r, 2);
      return a != null && b != null ? b - a : null;
    }));
    if (rk) rows.push(pctRow({ label: '实验一 重新定向代价', value: sgn(mine), pct: rk.pct, hint: `大于 ${Math.round(rk.pct * 100)}% 的人（n=${rk.n}）` }));
  }

  // ③ 实验二 无视锥正确率
  if (yah && yah.by[0].acc != null) {
    const rk = rankOf(yah.by[0].acc, othersY.map((r) => yahOne(r).by[0].acc));
    if (rk) rows.push(pctRow({ label: '实验二 无视锥正确率', value: pc(yah.by[0].acc), pct: rk.pct, hint: `高于 ${Math.round(rk.pct * 100)}% 的人（n=${rk.n}）` }));
  }

  // ④ 实验二 对齐代价
  if (yah && yah.cell['0|180'].rt != null && yah.cell['0|0'].rt != null) {
    const mine = yah.cell['0|180'].rt - yah.cell['0|0'].rt;
    const rk = rankOf(mine, othersY.map((r) => {
      const y = yahOne(r);
      return y.cell['0|180'].rt != null && y.cell['0|0'].rt != null ? y.cell['0|180'].rt - y.cell['0|0'].rt : null;
    }));
    if (rk) rows.push(pctRow({ label: '实验二 对齐代价 180°−0°', value: sgn(mine), pct: rk.pct, hint: `大于 ${Math.round(rk.pct * 100)}% 的人（n=${rk.n}）` }));
  }

  if (!rows.length) return card('图 6 ｜ 你 vs 全体', '', '<p class="note">当前被试缺少可与其他被试对齐的指标</p>');

  return card(`图 6 ｜ ${who} 在全体被试中的位置`,
    '长条表示排位（0% = 全体最小，100% = 全体最大），不代表好坏。唯一翻转了方向的是「觉察时间」一行——时间越短越快，所以越靠右＝越快。',
    rows.join(''));
}

/* ---------------- 结论摘要 ---------------- */
function sceneConclusion(ctx) {
  const { cb, yah, who, recsCB, recsYAH } = ctx;
  const lines = [];

  if (cb) {
    const v = cb[1].med, iv = cb[2].med, none = cb[0].med;
    if (v != null && none != null) {
      const d = none - v;
      lines.push(`<b>实验一（线索有效性）</b>：正确箭头 ${f0(v)} ms，无箭头基线 ${f0(none)} ms，线索收益 <b>${sgn(d)}</b>，${d > 0 ? '方向与「有效线索加快搜索」的预期一致' : '方向与预期相反，箭头没有帮上忙'}。`);
    }
    if (v != null && iv != null) {
      const d = iv - v;
      lines.push(`错误箭头比正确箭头${d > 0 ? '慢' : '快'} <b>${f0(Math.abs(d))} ms</b>，${d > 0 ? '符合「重新定向要付代价」的预期' : '未观察到重新定向代价，可能是线索被忽略或试次太少'}。`);
    }
    if (none == null) lines.push('当前被试记录里没有「无箭头」基线，图 1 只画出有数据的条件（旧设计只有指对 / 指反两个水平）。');
    if (cb.dropped) lines.push(`实验一共剔除 ${cb.dropped} 个试次（&lt;${CB_FLOOR} ms 或 &gt;${CB_CEIL / 1000} s），${cb.kept} 个试次进入统计。`);
  }

  if (yah) {
    const a0 = yah.by[0].acc, a1 = yah.by[1].acc, r0 = yah.by[0].rt, r1 = yah.by[1].rt;
    if (a0 != null && a1 != null) {
      const faster = r1 != null && r0 != null && r1 < r0;
      const worse = a1 < a0;
      lines.push(`<b>实验二（朝向视锥，当前被试 ${who}）</b>：正确率 ${pc(a0)} → ${pc(a1)}，反应时 ${f0(r0)} → ${f0(r1)} ms。` +
        (faster && worse ? '<b>出现速度–准确率权衡</b>：更快但更容易错，不能简单称为「改进」。'
          : a1 > a0 && faster ? '视锥让人又快又准，支持「视锥降低认知负荷」的改进假设。'
            : a1 > a0 ? '视锥提高了正确率但没加快，可能以更多注视时间为代价。'
              : '视锥没有带来明显收益。'));
    }
    const al = yah.cell['0|180'].rt != null && yah.cell['0|0'].rt != null ? yah.cell['0|180'].rt - yah.cell['0|0'].rt : null;
    if (al != null) {
      lines.push(`180° 旋转相对 0° 的代价为 <b>${sgn(al)}</b>（当前被试，无视锥）。${al > 0 ? '旋转越大越慢，与心理旋转 / FORT 曲线方向一致。' : '未出现旋转代价，可能被试已建立稳定的心理朝向。'}`);
    }
    if (yah.dropped) lines.push(`实验二有 ${yah.dropped} 个试次 RT &lt; ${RT_FLOOR} ms（抢答）已剔除，剩余 ${yah.clean.length} 个试次参与统计。`);
  }

  // 群体层面：只写有统计支撑的结论，人数不足就明说
  const gInv = recsCB.map((r) => {
    const a = condMed(r, 1), b = condMed(r, 2);
    return a != null && b != null ? b - a : null;
  }).filter((x) => x != null);
  const tInv = pairedT(gInv);
  if (tInv) {
    lines.push(`<b>全体 ${tInv.n} 人</b>：错误线索比正确线索平均慢 ${f0(tInv.diff)} ms，dz = ${df2(tInv.dz)}，${pShow(tInv.p)}。` +
      (tInv.p != null && tInv.p < 0.05 ? '重新定向代价在群体层面成立。' : '样本太少（或个体方向不一致），这个代价在群体层面还不显著，不能写进结论当作已验证的结果。'));
  }

  const perYF = recsYAH.map((r) => yahOne(r));
  const gRt = perYF.map((y) => (y.by[1].rt != null && y.by[0].rt != null ? y.by[1].rt - y.by[0].rt : null)).filter((x) => x != null);
  const tRt = pairedT(gRt);
  if (tRt) {
    lines.push(`<b>全体 ${tRt.n} 人</b>：加上视锥后反应时平均变化 ${sgn(tRt.diff)}，dz = ${df2(tRt.dz)}，${pShow(tRt.p)}。` +
      (tRt.p != null && tRt.p < 0.05 ? '视锥加速在群体层面成立。' : '群体层面未达显著。'));
  }

  if (!lines.length) return '';
  return `<div class="card rep-concl"><h2 class="rep-h">结论摘要</h2>
    <p class="note">以下判断由程序按当前数据自动生成；写报告时请结合被试数与效应量自行复核，不要直接照抄。</p>
    <ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
  </div>`;
}
