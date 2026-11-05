// 单文件版自检：node test/smoke.mjs
// 用本机 Chrome / Edge 的无头模式打开构建产物 index.html，跑两组断言（模块与绘制 / 完整流程），
// 打印 PASS/FAIL，任一失败则以非零码退出。需要先 `node build.mjs` 生成 index.html。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(TEST_DIR);
const INDEX = path.join(ROOT, 'index.html');

if (!fs.existsSync(INDEX)) {
  console.error('缺少 index.html，请先运行 node build.mjs');
  process.exit(1);
}

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const browser = BROWSERS.find((p) => fs.existsSync(p));
if (!browser) {
  console.error('未找到 Chrome / Edge，跳过浏览器自检');
  process.exit(1);
}

const CASES = [
  { name: '模块与绘制', script: '_smoke.js', id: 'SMOKE' },
  { name: '完整流程', script: '_smoke2.js', id: 'SMOKE2' },
];

const html = fs.readFileSync(INDEX, 'utf8');
let failed = 0;

for (const c of CASES) {
  const page = path.join(TEST_DIR, c.script.replace('.js', '.html'));
  fs.writeFileSync(page, html.replace('</body>', `<script src="${c.script}"></script>\n</body>`), 'utf8');

  const r = spawnSync(browser, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1440,900', '--virtual-time-budget=3000', '--dump-dom',
    pathToFileURL(page).href,
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  const m = (r.stdout || '').match(new RegExp(`<pre id="${c.id}">([\\s\\S]*?)</pre>`));
  fs.rmSync(page, { force: true }); // 用完即删，避免仓库里留下 145KB 的副本
  console.log(`\n== ${c.name} ==`);
  if (!m) {
    console.log('FAIL 未拿到结果块（页面脚本报错？）');
    console.log((r.stderr || '').split('\n').filter((l) => /CONSOLE|Uncaught/.test(l)).slice(0, 5).join('\n'));
    failed++;
    continue;
  }
  const text = m[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  console.log(text);
  failed += text.split('\n').filter((l) => l.startsWith('FAIL')).length;
}

console.log(failed ? `\n有 ${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
