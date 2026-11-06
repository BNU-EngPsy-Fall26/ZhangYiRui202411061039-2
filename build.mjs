// build.mjs —— 把 js/ 下的 ES Module 源码 + css/lab.css + results.html 的结果视图
// 打包进一个自包含的 index.html（无任何外部依赖，双击即可运行）。
//   node build.mjs
// 源文件仍保持模块化；index.html 是构建产物，不要直接手改。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const p = (...a) => path.join(ROOT, ...a);
const read = (f) => fs.readFileSync(p(f), 'utf8');

/* ---------------- 模块清单（按依赖顺序） ---------------- */
// [源文件, 打包后的命名空间常量名]
const MODS = [
  ['js/api.js', 'API'],
  ['js/gaze/one_euro.js', 'ONE_EURO'],
  ['js/stage.js', 'STAGE'],
  ['js/gaze/gaze_hub.js', 'GAZE'],
  ['js/gaze/calibration.js', 'CALIB'],
  ['js/lib/instruct.js', 'INSTRUCT'],
  ['js/lib/upload.js', 'UPLOAD'],
  ['js/lib/stats.js', 'STATS'],
  ['js/lib/chart.js', 'CHART'],
  ['js/exp/cb_scenes2.js', 'CB2MOD'],
  ['js/exp/scenes.js', 'SCENES'],
  ['js/exp/w6_common.js', 'W6'],
  ['js/exp/cb_cued.js', 'CBCUED'],
  ['js/exp/yah_cued.js', 'YAHCUED'],
  ['js/results.js', 'RESULTS'],
  ['js/analysis.js', 'ANALYSIS'],
  ['js/report.js', 'REPORT'],
  ['js/app.js', 'APP'],
];

const NS = new Map(MODS.map(([f, ns]) => [path.posix.normalize(f), ns]));

/* ---------------- 单文件模块 → IIFE ---------------- */
function bundleModule(file) {
  const ns = NS.get(file);
  let src = read(file);
  const head = [];
  const exported = [];

  // import { a, b as c } from './x.js'  |  import * as X from './x.js'
  src = src.replace(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm, (_m, spec, from) => {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), from));
    const dep = NS.get(target);
    if (!dep) throw new Error(`${file}: 无法解析依赖 ${from}（${target}）`);
    spec = spec.trim();
    if (/^\*/.test(spec)) {
      head.push(`const ${spec.replace(/^\*\s*as\s*/, '')} = ${dep};`);
    } else {
      const names = spec.replace(/^\{|\}$/g, '').split(',').map((s) => s.trim()).filter(Boolean)
        .map((s) => { const a = s.split(/\s+as\s+/); return a.length > 1 ? `${a[0]}: ${a[1]}` : a[0]; });
      head.push(`const { ${names.join(', ')} } = ${dep};`);
    }
    return '';
  });

  // export function / class / const / let / var
  src = src.replace(/^export\s+(async\s+)?(function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (_m, asyncKw, kw, name) => {
    exported.push(name);
    return `${asyncKw || ''}${kw} ${name}`;
  });
  // export { a, b as c }
  src = src.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (_m, list) => {
    list.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => exported.push(s.split(/\s+as\s+/).pop()));
    return '';
  });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(`${file}: 还有未处理的 import/export 语句`);

  return `/* ===== ${file} ===== */\nconst ${ns} = (function () {\n'use strict';\n${head.join('\n')}\n${src}\nreturn { ${exported.join(', ')} };\n})();`;
}

/* ---------------- 组装 ---------------- */
const labCss = read('css/lab.css');
const shell = read('src/shell.html');

// 结果视图：从 results.html 抽出 .wrap 里的内容，单文件版里作为第二个视图复用
const resultsHtml = read('results.html');
const m = resultsHtml.match(/<div class="wrap">([\s\S]*?)<\/div>\s*<script/);
if (!m) throw new Error('无法从 results.html 提取结果视图内容');
const resultsBody = m[1].trim();

const code = [
  '(function () {',
  "'use strict';",
  ...MODS.map(([f]) => bundleModule(f)),
  '// 调试口：便于在控制台复用模块、也供自动自检使用',
  'window.__hw2 = { API, STAGE, GAZE, CALIB, INSTRUCT, UPLOAD, STATS, CHART, SCENES, CB2MOD, CBCUED, YAHCUED, W6, RESULTS, ANALYSIS, REPORT };',
  '})();',
].join('\n\n').replace(/<\/script/gi, '<\\/script');

const html = shell
  .replace('{{LAB_CSS}}', () => labCss.trim())
  .replace('{{RESULTS}}', () => resultsBody)
  .replace('{{JS}}', () => code);

fs.writeFileSync(p('index.html'), html, 'utf8');

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('已生成 index.html', kb(Buffer.byteLength(html)), `（内联 CSS ${kb(Buffer.byteLength(labCss))} + JS ${kb(Buffer.byteLength(code))}）`);
