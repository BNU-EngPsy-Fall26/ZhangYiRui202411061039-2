// 静态自检：解析构建产物里的内联脚本（语法层）+ 检查关键符号与资源是否都在
import fs from 'node:fs';
import vm from 'node:vm';

const dir = 'D:/项目/EngineeringPsychology/AttentionExperiment/AttentionExperiment/hw2-lab';
const html = fs.readFileSync(dir + '/index.html', 'utf8');
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
  ['btn-analysis', 'analysis entry button'],
  ['Cohen', "Cohen's d label"],
  ['Rensink', 'original-paper reference'],
  ['no consent', 'x'],
]) {
  if (label === 'x') continue;
  ok(html.includes(needle), label + ' present');
}

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

const fail = out.filter((s) => s.startsWith('FAIL')).length;
console.log(out.join('\n'));
console.log('\n' + (fail ? fail + ' 项失败' : '全部通过'));
process.exit(fail ? 1 : 0);
