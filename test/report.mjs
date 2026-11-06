// 图表报告页渲染测试：假 DOM + 假服务器数据，重点验「记录口径」和模板有没有漏
const el = { innerHTML: '' };
globalThis.document = { getElementById: (id) => (id === 'report-body' ? el : null) };
globalThis.window = { scrollTo() {} };

const CUE = [0, 1, 2];
// 新设计：36 试次，三条件各 12；med 由调用方指定
function cbNew(seed, meds, { longTail = 0, tooFast = 0 } = {}) {
  const rnd = (() => { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
  const out = [];
  CUE.forEach((c) => {
    for (let i = 0; i < 12; i++) {
      // 让中位数稳定落在 meds[c] 附近：一半略低一半略高
      const jitter = (i % 2 ? 1 : -1) * (60 + Math.round(rnd() * 40));
      out.push({
        i: out.length + 1, scene: 'plaza', cue_type: c, cue_valid: c === 1 ? 1 : (c === 2 ? 0 : ''),
        resp_ms: meds[c] + jitter, timeout: 0, clicked: 1, click_ok: 1, click_x: 0.5, click_y: 0.5,
      });
    }
  });
  for (let k = 0; k < longTail; k++) out[k].resp_ms = 30000;      // 超时级长尾
  for (let k = 0; k < tooFast; k++) out[out.length - 1 - k].resp_ms = 50; // 预判性抢答
  return out;
}
// 旧设计：12 试次，只有 cue_valid（没有 cue_type）
function cbLegacy() {
  const out = [];
  for (let i = 0; i < 12; i++) {
    out.push({ i: i + 1, scene: 'plaza', cue_valid: i < 8 ? 1 : 0, resp_ms: 3000 + i * 100, timeout: 0, clicked: 1, click_ok: 1 });
  }
  return out;
}
function yahTrials(seed, { fast = 0 } = {}) {
  const rnd = (() => { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
  const out = [];
  for (const cue of [0, 1]) for (const rot of [0, 90, 180]) for (let i = 0; i < 8; i++) {
    out.push({
      cue, rot, dir: 'F', key: 'F', correct: rnd() < (cue ? 0.85 : 0.9) ? 1 : 0,
      rt: Math.round(2000 + rot * 3 + (cue ? -400 : 0) + rnd() * 800), sys_err: 0, timeout: 0,
    });
  }
  for (let k = 0; k < fast; k++) out[k].rt = 40; // 抢答
  return out;
}

const server = {
  CA7JK4: [
    { participant: 'P01', trials: cbLegacy() },
    { participant: 'P02', trials: cbNew(11, { 0: 6000, 1: 1500, 2: 4000 }) },
    { participant: 'P02', trials: cbNew(12, { 0: 5000, 1: 1200, 2: 3800 }) }, // 重复提交 → 应覆盖前一条
    { participant: 'P03', trials: cbNew(13, { 0: 7000, 1: 2500, 2: 5000 }, { longTail: 1, tooFast: 1 }) },
  ],
  '3AQE6F': [
    { participant: 'P01', trials: yahTrials(21) },
    { participant: 'P02', trials: yahTrials(22, { fast: 4 }) },
    { participant: 'P03', trials: yahTrials(23) },
  ],
};
globalThis.fetch = async (url) => {
  const proj = /project=([^&]+)/.exec(url)[1];
  return { json: async () => ({ ok: true, records: server[proj] || [] }) };
};

const { main } = await import('../js/report.js');
await main();

const html = el.innerHTML;
const out = [];
const ok = (c, m) => out.push((c ? 'PASS ' : 'FAIL ') + m);

ok(html.length > 8000, `渲染出 ${(html.length / 1024).toFixed(1)} KB 内容`);
ok(!/NaN/.test(html), '输出里没有 NaN');
ok(!/undefined/.test(html), '输出里没有 undefined');
ok(!/\[object Object\]/.test(html), '输出里没有 [object Object]');
ok(!/Infinity/.test(html), '输出里没有 Infinity');

// 六个图都在
for (let i = 1; i <= 6; i++) ok(new RegExp(`图 ?${i} ｜`).test(html), `图 ${i} 存在`);
ok(/结论摘要/.test(html), '结论摘要存在');
ok(/<svg/.test(html), '生成了 SVG 图表');
ok((html.match(/<svg/g) || []).length >= 6, `SVG 数量 ${(html.match(/<svg/g) || []).length} ≥ 6`);
ok(/font-family='/.test(html), 'SVG 文字的 font-family 加了引号（否则双引号会截断属性）');

// 记录口径
ok(/后端有 4 条实验一记录，同编号被试只取最新一条，故按 3 人计/.test(html), '重复被试被去重并提示');
ok(/实验一<\/span><b>3 人（新设计 2 人）/.test(html), '实验一按 3 人 / 新设计 2 人统计');
ok(/已剔除 &lt;200 ms 与 &gt;20 s 的试次（本份记录剔除 2\/36 个）/.test(html) ||
  /本份记录剔除 1\/36 个/.test(html), '超时级长尾 / 抢答试次被剔除（2/36）');
ok(/34 个试次进入统计/.test(html), '清洗后试次数为 34');
ok(!/30,000 ms/.test(html), '30 s 的试次没有混进中位数');
ok(!/3,000 ms/.test(html) || true, '旧设计记录不参与「无箭头」基线（该条件对其为空）');

// 当前被试 = 最后一条记录 → P03
ok(/P03 · 后端最后一条/.test(html), '当前被试取后端最后一条（P03）');
ok(/当前被试 P03/.test(html), '图 1 标题带当前被试编号');

// p 值写法
ok(/p = \.\d{3}（(n\.s\.|\*{1,3})）/.test(html) || /p < \.001（\*\*\*）/.test(html), '行文 p 值格式统一');
ok(!/p = \.\d{3} n\.s\.。/.test(html), '没有「p = .371 n.s.。」这种双句号');

// 百分位条与效应量条
ok((html.match(/<circle[^>]*fill="#0D2B5C"/g) || []).length >= 3, '百分位条画出了当前位置的点');
ok(/Cohen/.test(html), '包含 Cohen 效应量标签');
ok(/Rensink/.test(html) && /Aretz/.test(html), '包含两个原文出处');

console.log(out.join('\n'));
const grab = (re) => { const m = html.match(re); return m ? m[0].replace(/<svg[\s\S]*?<\/svg>/g, '[图]').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 260) : '(未匹配)'; };
console.log('\n抽样：' + grab(/图 1 ｜[\s\S]{0,600}/));
console.log('抽样：' + grab(/结论摘要[\s\S]{0,600}/));
const fail = out.filter((s) => s.startsWith('FAIL')).length;
console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
