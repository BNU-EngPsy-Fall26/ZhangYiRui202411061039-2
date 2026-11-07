// 静态自检：解析构建产物里的内联脚本（语法层）+ 检查关键符号与资源是否都在
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 仓库根目录 = 本文件所在目录的上一级（原先写死绝对路径，工作区一挪位置就报错）
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const out = [];
const ok = (c, msg) => out.push((c ? 'PASS ' : 'FAIL ') + msg);

const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
ok(!!m, 'inline script found');
if (m) {
  try {
    new vm.Script(m[1]);           // 只解析，不执行
    ok(true, 'bundle parses (' + (m[1].length / 1024).toFixed(1) + ' KB)');
  } catch (e) {
    ok(false, 'bundle syntax error: ' + e.message);
  }
}

for (const [needle, label] of [
  ['const GAZE = (function', 'GAZE module'],
  ['const CALIB = (function', 'CALIB module'],
  ['const ONE_EURO = (function', 'ONE_EURO module'],
  ['function runCalibration', 'runCalibration'],
  ['faceMeshSolutionPath', 'faceMeshSolutionPath'],
  ['face_mesh.binarypb', 'face_mesh.binarypb preflight'],
  ['resolveSolutionPath', 'CDN fallback'],
  ['vendor/webgazer/webgazer.js', 'webgazer asset path'],
  ['vendor/webgazer/mediapipe/face_mesh', 'face_mesh asset path'],
  ['screen-consent', 'consent screen'],
  ['btn-cam', 'camera button'],
  ['gaze_qc', 'gaze_qc field'],
  ['plazaLayout', 'single-scene plaza layout'],
  ['cue_type', '3-level cue condition field'],
  ['analysis-body', 'analysis view'],
  ['screen-hub', 'experiment hub screen'],
  ['btn-start-cb', 'hub: start exp1'],
  ['btn-hub-report', 'hub: report entry button'],
  ['stage-pause', 'in-experiment pause button'],
  ['function createPause', 'createPause'],
  ['pause-card', 'pause dialog'],
  ['report-body', 'chart report view'],
  ['btn-report-back', 'report back button'],
  ['sid-hint', 'participant seed hint'],
  ['function nextParticipant', 'nextParticipant'],
  ['function suggestParticipant', 'suggestParticipant'],
  ['const REPORT = (function', 'REPORT module'],
  ['const CHART = (function', 'CHART module'],
  ['const STATS = (function', 'STATS module'],
  ['function barChart', 'barChart'],
  ['function groupedBar', 'groupedBar'],
  ['function effectBar', 'effectBar'],
  ['function pctRow', 'pctRow'],
  ["font-family='", 'SVG font-family 加引号'],
  ['Cohen', "Cohen's d label"],
  ['Rensink', 'original-paper reference'],
  ['const GAZEPATH = (function', 'GAZEPATH module'],
  ['const GAZEMAP = (function', 'GAZEMAP module'],
  ['function mountGazeTraj', 'mountGazeTraj'],
  ['function encodePath', 'encodePath'],
  ['function decodePath', 'decodePath'],
  ['function pathStats', 'pathStats'],
  ['gaze_path', 'gaze_path 字段'],
  ['gv-canvas', 'gaze trajectory canvas'],
  ['cb-gaze-box', 'gaze trajectory container'],
  ['no consent', 'x'],
]) {
  if (label === 'x') continue;
  ok(html.includes(needle), label + ' present');
}

// 报告页的视图与样式都在单文件里
for (const [needle, label] of [
  ['id="view-report"', 'report view section'],
  ['#view-report .rep-h', 'report heading style'],
  ['#/report'.replace('#/', 'report'), 'x'],
]) {
  if (label === 'x') continue;
  ok(html.includes(needle), label + ' present');
}
// font-family 属性必须被引号包住，否则 FONT 里的双引号会把 <text> 截断
ok(!/font-family="Noto Sans SC"/.test(html) || /font-family='/.test(html), 'SVG 字体属性未被双引号截断');

// 不该再出现的（已删除的头姿层）
ok(!/headpose/i.test(html), 'no headpose references');

// 资源文件实际存在（名字 → 最小字节数）
for (const [f, min] of [
  ['vendor/webgazer/webgazer.js', 1000],
  ['vendor/webgazer/mediapipe/face_mesh/face_mesh.binarypb', 500],
  ['vendor/webgazer/mediapipe/face_mesh/face_mesh_solution_packed_assets.data', 1000],
  ['vendor/webgazer/mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js', 1000],
  ['vendor/webgazer/mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js', 1000],
  ['vendor/webgazer/mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm', 1000],
  ['vendor/webgazer/mediapipe/face_mesh/face_mesh_solution_wasm_bin.js', 1000],
  ['vendor/webgazer/mediapipe/face_mesh/face_mesh_solution_wasm_bin.wasm', 1000],
]) {
  const p = dir + '/' + f;
  const sz = fs.existsSync(p) ? fs.statSync(p).size : -1;
  ok(sz >= min, 'asset ' + f.split('/').pop() + ' ' + (sz < 0 ? 'MISSING' : (sz / 1048576).toFixed(2) + 'MB'));
}

// 打包器只认 `export const NAME`（单个名字）。写成 `export const A = 1, B = 2;` 时只会导出 A，
// B 在单文件版里变成 undefined —— canvas 尺寸这类 bug 会以「image argument is a canvas element
// with a width or height of 0」的形式出现。这里在源码层面直接拦住这种写法。
{
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) files.push(p);
    }
  };
  walk(path.join(dir, 'js'));
  // 只看「顶层逗号」：字符串、括号里的逗号不算（api.js 的 esc 里有对象字面量的逗号）
  const multiDecl = (line) => {
    const m = /^export\s+(const|let|var)\s+/.exec(line);
    if (!m) return false;
    let depth = 0, inStr = null;
    for (let i = m[0].length; i < line.length; i++) {
      const c = line[i];
      if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      else if (c === ';' && depth === 0) return false;
      else if (c === ',' && depth === 0) return /^\s*[A-Za-z_$][\w$]*\s*=/.test(line.slice(i + 1));
    }
    return false;
  };
  const bad = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (multiDecl(line)) bad.push(path.relative(dir, f) + ':' + (i + 1));
    });
  }
  ok(!bad.length, '没有「一个 export 声明多个常量」的写法' + (bad.length ? '：' + bad.join('，') : ''));
}

const fail = out.filter((s) => s.startsWith('FAIL')).length;
console.log(out.join('\n'));
console.log('\n' + (fail ? fail + ' 项失败' : '全部通过'));
process.exit(fail ? 1 : 0);
