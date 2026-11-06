// 实验一试次生成自检：条件配额、位置分布、是否与既有行人/喷泉重叠
import { buildTrials, N_TOTAL, N_PER_CUE } from '../js/exp/cb_cued.js';
import { plazaLayout, personBox } from '../js/exp/cb_scenes2.js';

const out = [];
const ok = (c, msg) => out.push((c ? 'PASS ' : 'FAIL ') + msg);

const { people } = plazaLayout();
let failCond = 0, failCount = 0, failOverlap = 0, failBound = 0, failFountain = 0;
const TYPE_CN = { 0: '无箭头', 1: '指向正确', 2: '指向相反' };
const counts = { 0: 0, 1: 0, 2: 0 };
const ROUNDS = 200;

for (let r = 0; r < ROUNDS; r++) {
  const list = buildTrials();
  if (list.length !== N_TOTAL) failCount++;
  const c = { 0: 0, 1: 0, 2: 0 };
  const seen = new Set();
  for (const t of list) {
    c[t.cue_type]++;
    // 位置必须在广场地面范围内
    if (t.extra.x < 60 || t.extra.x > 1540 || t.extra.y < 400 || t.extra.y > 830) failBound++;
    // 不能落在喷泉里
    const inF = ((t.extra.x - 800) / 245) ** 2 + ((t.extra.y - 630) / 110) ** 2 < 1;
    if (inF) failFountain++;
    // 不能和既有行人重叠
    if (people.some((p) => Math.hypot(p.x - t.extra.x, p.y - t.extra.y) < 55)) failOverlap++;
    // bbox 必须包含图形本体
    const [bx, by, bw, bh] = t.bbox;
    if (!(bx < t.extra.x && t.extra.x < bx + bw && by < t.extra.y - 5 && t.extra.y < by + bh + 1)) failBound++;
    // 同一批内位置不应重复（可为空）
    const key = Math.round(t.extra.x) + ',' + Math.round(t.extra.y);
    if (seen.has(key)) failOverlap++;
    seen.add(key);
  }
  for (const k of [0, 1, 2]) if (c[k] !== N_PER_CUE) failCond++;
  counts[0] += c[0]; counts[1] += c[1]; counts[2] += c[2];
}

ok(failCount === 0, `每次生成 ${N_TOTAL} 试次（${ROUNDS} 次抽样全部通过）`);
ok(failCond === 0, `每个线索条件恰好 ${N_PER_CUE} 试次（${ROUNDS} 次抽样全部通过）`);
ok(failBound === 0, '变化点与判定框都在广场范围内');
ok(failFountain === 0, '变化点不与喷泉重叠');
ok(failOverlap === 0, '变化点不与既有行人重叠、同批内不重复');

// 位置是否真的分散（看 6×4 网格的覆盖率）
const grid = new Set();
const list = buildTrials();
for (const t of list) grid.add(Math.floor((t.extra.x - 130) / 224) + ',' + Math.floor((t.extra.y - 450) / 90));
ok(grid.size >= 12, `36 个变化点落在 ${grid.size} 个网格里（≥12 视为分散）`);

// 均衡性：各条件数量在多次抽样后的总偏差
const total = counts[0] + counts[1] + counts[2];
ok(Math.abs(counts[0] - total / 3) <= N_PER_CUE * 2, `条件配额在多次抽样间稳定（${counts[0]}/${counts[1]}/${counts[2]}）`);

console.log(out.join('\n'));
console.log(`\n抽样示例（第 1 批）：${list.slice(0, 6).map((t) => `${TYPE_CN[t.cue_type]}@(${Math.round(t.extra.x)},${Math.round(t.extra.y)})`).join('  ')}`);
const fail = out.filter((s) => s.startsWith('FAIL')).length;
console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
