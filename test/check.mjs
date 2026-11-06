// 设计校验：试次平衡、线索配额、系统性错误判定（node test/check.mjs）
import fs from 'node:fs';
import * as CB from '../js/exp/cb_cued.js';
import * as YAH from '../js/exp/yah_cued.js';

const lines = [];
let fail = 0;
const ok = (cond, label, extra = '') => {
  lines.push((cond ? 'PASS  ' : 'FAIL  ') + label + (extra ? '  ' + extra : ''));
  if (!cond) fail++;
};
// 两个角度之差（归一化到 [-180, 180]）
const angDiff = (a, b) => { let d = ((a - b) % 360 + 540) % 360 - 180; return d; };

/* ---------- 实验一 ---------- */
const cb = CB.buildTrials();
ok(cb.length === 36, '实验一试次数 = 36', `got ${cb.length}`);
const cnt = { 0: 0, 1: 0, 2: 0 };
cb.forEach((t) => { cnt[t.cue_type]++; });
ok(cnt[0] === 12 && cnt[1] === 12 && cnt[2] === 12, '三线索条件各 12 试次', JSON.stringify(cnt));
ok(cb.every((t) => t.extra && Number.isFinite(t.extra.x)), '每个试次都有变化点坐标');
ok(cb.every((t) => t.bbox[0] < t.extra.x && t.extra.x < t.bbox[0] + t.bbox[2]), '判定框包住变化点');

const sameDir = cb.filter((t) => t.cue_type === 1).every((t) => Math.abs(angDiff(t.cue_angle, t.true_angle)) < 1e-6);
ok(sameDir, '有效线索与真实变化方向一致');
const oppDir = cb.filter((t) => t.cue_type === 2).every((t) => Math.abs(Math.abs(angDiff(t.cue_angle, t.true_angle)) - 180) < 1e-6);
ok(oppDir, '无效线索指向相反方向');
ok(cb.filter((t) => t.cue_type === 0).every((t) => t.cue_valid === ''), '无箭头试次不记 cue_valid');

/* ---------- 实验二 ---------- */
const yah = YAH.buildTrials();
ok(yah.length === 48, '实验二试次数 = 48', `got ${yah.length}`);
const cells = {};
yah.forEach((t) => { const k = `${t.cue}-${t.rot}`; cells[k] = (cells[k] || 0) + 1; });
ok(Object.keys(cells).length === 6 && Object.values(cells).every((n) => n === 8), '6 个格子各 8 试次', JSON.stringify(cells));
let dirBalanced = true;
for (const k of Object.keys(cells)) {
  const c = {};
  yah.filter((t) => `${t.cue}-${t.rot}` === k).forEach((t) => { c[t.dir] = (c[t.dir] || 0) + 1; });
  if (!['F', 'R', 'B', 'L'].every((d) => c[d] === 2)) dirBalanced = false;
}
ok(dirBalanced, '每格四方向各 2 次');
ok(yah.every((t) => new Set(Object.values(t.names)).size === 4), '每试次 4 个地标不重复');

/* ---------- 系统性错误判定 ---------- */
ok(YAH.mapBasedAnswer('F', 0) === 'F', 'rot 0°：地图读法与真实一致');
ok(YAH.mapBasedAnswer('F', 90) === 'R', 'rot 90°：F 被误读为 R');
ok(YAH.mapBasedAnswer('B', 180) === 'F', 'rot 180°：B 被误读为 F');
ok(YAH.mapBasedAnswer('R', 180) === 'L', 'rot 180°：R 被误读为 L');

lines.push(fail ? `\n${fail} 项未通过` : '\n全部通过');
fs.writeFileSync(new URL('./check_report.txt', import.meta.url), lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
process.exit(fail ? 1 : 0);
