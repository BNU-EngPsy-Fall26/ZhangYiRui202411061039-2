// 原始注视轨迹的紧凑编码 + 注视点识别（I-DT）
//
// 为什么不用对象数组：/api/hw2/submit 只收「平铺标量」，嵌套结构会被服务端转换并回一条 warning。
// 字符串可以长一些（服务端上限 2000 字）。这里把每个注视点压成 3 个字符 = 18 bit：
// 前 9 bit 是 x、后 9 bit 是 y（0-1 归一化坐标各量化到 512 级，1600×900 上约 3 px，远小于
// WebGazer 120-200 px 的误差）。30 s × 15 Hz ≈ 450 点 ≈ 1350 字符，一个字段装得下。
//
// 时间不单独存：采样间隔固定 66 ms，第 i 个点的时间就是 i × step × 66 ms。

export const PATH_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const SAMPLE_MS = 66;    // 与 gaze_hub.js 的 SAMPLE_MS 一致
export const QLEVEL = 512;      // 每轴量化级数
const LOST_CODE = QLEVEL * QLEVEL - 1;   // 262143 保留给「该点人脸丢失」
// 262143 的三个 6 bit 分组都是 63，即编码表最后一个字符（'_'）
const LOST_CHARS = PATH_ALPHA[63] + PATH_ALPHA[63] + PATH_ALPHA[63];

// 注意：这里必须一个 export 只声明一个常量。build.mjs 的打包器按 `export const NAME` 抓名字，
// 写成 `export const SW = 1600, SH = 900;` 只会导出 SW，SH 在单文件版里会变成 undefined
// （canvas.height = undefined → 0 → drawImage 直接报错）。test/static.mjs 里有对应检查。
export const SW = 1600;
export const SH = 900;

function idxOf(ch) {
  const i = PATH_ALPHA.indexOf(ch);
  return i;
}

// x/y < 0 或非数字 → 丢失点
export function encodePoint(x, y) {
  if (!(x >= 0) || !(y >= 0)) return LOST_CHARS;
  const xq = Math.min(QLEVEL - 1, Math.round(Math.max(0, Math.min(1, x)) * (QLEVEL - 1)));
  const yq = Math.min(QLEVEL - 1, Math.round(Math.max(0, Math.min(1, y)) * (QLEVEL - 1)));
  let v = xq * QLEVEL + yq;
  if (v >= LOST_CODE) v = LOST_CODE - 1;   // 右上角那一个点让给「丢失」，误差 0.2%
  return PATH_ALPHA[(v >> 12) & 63] + PATH_ALPHA[(v >> 6) & 63] + PATH_ALPHA[v & 63];
}

// 返回 [x, y]（0-1）；丢失点返回 null
export function decodePoint(code) {
  if (!code || code.length !== 3) return null;
  const a = idxOf(code[0]), b = idxOf(code[1]), c = idxOf(code[2]);
  if (a < 0 || b < 0 || c < 0) return null;
  const v = (a << 12) | (b << 6) | c;
  if (v >= LOST_CODE) return null;
  return [Math.floor(v / QLEVEL) / (QLEVEL - 1), (v % QLEVEL) / (QLEVEL - 1)];
}

// samples: [[t_ms, x, y], ...]（x/y < 0 表示丢失）→ { path, step, n }
// 太长的轨迹按 step 抽稀，保证不超 maxChars。
// 1000 字是有意压低的：36 个试次全取满也只有 ~36 KB，加上其它字段仍在服务端请求体上限之内
// （express.json 默认 100kb）。正常试次 60–140 点根本用不到抽稀，只有接近 30 s 超时的才会 step=2。
export function encodePath(samples, { maxChars = 1000 } = {}) {
  if (!samples || !samples.length) return { path: '', step: 1, n: 0 };
  let step = 1;
  while (Math.ceil(samples.length / step) * 3 > maxChars) step++;
  let s = '';
  for (let i = 0; i < samples.length; i += step) s += encodePoint(+samples[i][1], +samples[i][2]);
  return { path: s, step, n: Math.ceil(samples.length / step) };
}

// → [{ t, x, y, lost }]，x/y 为 0-1
export function decodePath(path, step = 1, dt = SAMPLE_MS) {
  const out = [];
  if (!path) return out;
  const st = Math.max(1, Math.round(+step) || 1);
  for (let i = 0; i + 3 <= path.length; i += 3) {
    const p = decodePoint(path.slice(i, i + 3));
    const t = Math.round((i / 3) * st * dt);
    out.push(p ? { t, x: p[0], y: p[1], lost: false } : { t, x: -1, y: -1, lost: true });
  }
  return out;
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

// I-DT（离散度阈值法）：连续采样里「(maxX-minX)+(maxY-minY) ≤ disp 像素」且持续 ≥ minMs 的一段算一个注视点。
// 与原项目 js/gaze_viz.js 用的口径一致（disp=120 px、minMs=100 ms）。
export function fixations(pts, { disp = 120, minMs = 100, gapMs = 3 * SAMPLE_MS } = {}) {
  const good = (pts || []).filter((p) => p && !p.lost && p.x >= 0 && p.y >= 0);
  const out = [];
  let win = [];
  const flush = () => {
    if (win.length >= 2) {
      const t0 = win[0].t, t1 = win[win.length - 1].t;
      if (t1 - t0 >= minMs) {
        out.push({ x: avg(win.map((p) => p.x)), y: avg(win.map((p) => p.y)), t0, t1, n: win.length });
      }
    }
    win = [];
  };
  for (const p of good) {
    if (win.length && p.t - win[win.length - 1].t > gapMs) flush();   // 中间丢了太久，断开
    const test = win.concat([p]);
    const xs = test.map((q) => q.x * SW), ys = test.map((q) => q.y * SH);
    const spread = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) + (Math.max.apply(null, ys) - Math.min.apply(null, ys));
    if (win.length && spread > disp) { flush(); win = [p]; }
    else win = test;
  }
  flush();
  return out;
}

// 轨迹统计。bbox 为舞台像素坐标 [x, y, w, h]，margin 为容差（同点击判定的 MARGIN）
export function pathStats(pts, bbox, { margin = 30, disp = 120, minMs = 100 } = {}) {
  const all = pts || [];
  const good = all.filter((p) => p && !p.lost && p.x >= 0 && p.y >= 0);
  const fixes = fixations(all, { disp, minMs });
  const box = bbox ? [bbox[0] - margin, bbox[1] - margin, bbox[2] + 2 * margin, bbox[3] + 2 * margin] : null;
  const inBox = (px, py) => !!box && px >= box[0] && px <= box[0] + box[2] && py >= box[1] && py <= box[1] + box[3];

  let length = 0;
  for (let i = 1; i < good.length; i++) {
    length += Math.hypot((good[i].x - good[i - 1].x) * SW, (good[i].y - good[i - 1].y) * SH);
  }
  let dwell = 0, hit = 0, firstHit = null;
  for (const f of fixes) {
    const px = f.x * SW, py = f.y * SH;
    if (!inBox(px, py)) continue;
    hit++;
    dwell += f.t1 - f.t0;
    if (firstHit === null) firstHit = f.t0;
  }
  const totalDwell = fixes.reduce((a, f) => a + (f.t1 - f.t0), 0);
  const mx = avg(good.map((p) => p.x)), my = avg(good.map((p) => p.y));
  const cx = bbox ? bbox[0] + bbox[2] / 2 : null, cy = bbox ? bbox[1] + bbox[3] / 2 : null;

  return {
    n: all.length,           // 采样点总数（含丢失）
    ok: good.length,         // 有效采样点
    lostShare: all.length ? 1 - good.length / all.length : null,
    dur: all.length ? all[all.length - 1].t - all[0].t : 0,
    fixes,
    nFix: fixes.length,
    meanFixMs: fixes.length ? totalDwell / fixes.length : null,
    length,
    hitFix: hit,                         // 落在目标框（含容差）里的注视点数
    hitDwell: dwell,
    hitShare: totalDwell ? dwell / totalDwell : null,
    firstHit,                            // 首个进入目标框的注视点起始时刻（ms）
    mean: mx == null ? null : { x: mx, y: my },
    meanDist: mx == null || cx == null ? null : Math.hypot(mx * SW - cx, my * SH - cy),
  };
}
