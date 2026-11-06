// 分析页渲染冒烟测试：用假 DOM + 假服务器数据跑一遍 main()，检查输出里有没有模板 bug
const el = { innerHTML: '' };
globalThis.document = { getElementById: (id) => (id === 'analysis-body' ? el : null) };

/* ---- 造数据：3 个「别人」+ 我自己 ---- */
const CUE_TYPES = [0, 1, 2];
function makeCB(seed, n = 12) {
  const rnd = (() => { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
  const out = [];
  CUE_TYPES.forEach((c, ci) => {
    for (let i = 0; i < n; i++) {
      const base = 1400 + ci * 120;
      const rt = Math.round(base + rnd() * 700);
      out.push({ i: out.length + 1, scene: 'plaza', cue_type: c, cue_valid: c === 1 ? 1 : (c === 2 ? 0 : ''),
        resp_ms: rnd() < 0.06 ? null : rt, timeout: 0, clicked: 1,
        click_ok: rnd() < 0.8 ? 1 : 0, click_x: 0.5, click_y: 0.5 });
    }
  });
  return out;
}
const ROTS = [0, 90, 180];
function makeYAH(seed) {
  const rnd = (() => { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
  const out = [];
  for (const cue of [0, 1]) for (const rot of ROTS) for (let i = 0; i < 8; i++) {
    out.push({ cue, rot, dir: 'F', key: 'F', correct: rnd() < (cue ? 0.75 : 0.9) ? 1 : 0,
      rt: Math.round(1800 + rot * 4 + (cue ? -300 : 0) + rnd() * 900), sys_err: 0, timeout: 0 });
  }
  return out;
}

const server = {
  // 混入一条「旧设计」记录（12 试次、只有 cue_valid，没有 cue_type），验证会被排除
  'CA7JK4': [1, 2, 3].map((k) => ({ participant: 'P0' + k, trials: makeCB(k * 7) }))
    .concat([{ participant: 'OLD1', trials: Array.from({ length: 12 }, (_, i) => ({
      i: i + 1, scene: 'plaza', cue_valid: i < 9 ? 1 : 0, resp_ms: 1100 + i * 10, click_ok: 1 })) }]),
  '3AQE6F': [1, 2, 3].map((k) => ({ participant: 'P0' + k, trials: makeYAH(k * 11) })),
};
globalThis.fetch = async (url) => {
  const proj = /project=([^&]+)/.exec(url)[1];
  return { json: async () => ({ ok: true, records: server[proj] || [] }) };
};

const { main } = await import('../js/analysis.js');
await main({
  sid: 'ME',
  cb: { trials: makeCB(99) },
  yah: { trials: makeYAH(55) },
});

const html = el.innerHTML;
const out = [];
const ok = (c, m) => out.push((c ? 'PASS ' : 'FAIL ') + m);

ok(html.length > 4000, `渲染出 ${(html.length / 1024).toFixed(1)} KB 内容`);
ok(!/NaN/.test(html), '输出里没有 NaN');
ok(!/undefined/.test(html), '输出里没有 undefined');
ok(!/\[object Object\]/.test(html), '输出里没有 [object Object]');
ok(/无箭头/.test(html) && /指向相反/.test(html), '实验一三个线索条件都出现');
ok(/Cohen/.test(html), '包含 Cohen 效应量');
ok(/Rensink/.test(html), '包含原文对比（Rensink）');
ok(/Aretz/.test(html), '包含 FORT / 视锥原文（Aretz）');
ok(/改进条件检验/.test(html), '包含改进条件检验');
ok(/你 vs 全体/.test(html), '包含「我 vs 全体」对比');
ok(/全体被试/.test(html), '包含全体被试表');
ok(/<t[dh]/.test(html), '生成了表格');
ok(/旧设计记录/.test(html), '旧设计（12 试次）记录被排除并提示');
ok(!/OLD1/.test(html), '旧记录没有被计入全体表');
// 我自己 36 试次 → 三个条件各 12
ok(/无箭头（基线）<\/td><td>12<\/td>/.test(html), '我的实验一每条件 12 试次');

console.log(out.join('\n'));
// 抽样看几行关键数字，确认没被格式化坏
const grab = (re) => { const m = html.match(re); return m ? m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : '(未匹配)'; };
console.log('\n抽样：' + grab(/无效 − 有效（线索有效性）[\s\S]{0,400}/));
console.log('抽样：' + grab(/你 vs 全体[\s\S]{0,200}/));
const fail = out.filter((s) => s.startsWith('FAIL')).length;
console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
