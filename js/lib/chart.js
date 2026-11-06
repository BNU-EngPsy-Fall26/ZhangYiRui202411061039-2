// 极简 SVG 图表库：柱状图 / 分组柱状图 / 散点条 / 效应量条 / 百分位条
// 不依赖任何第三方库，直接拼 SVG 字符串，离线可用。

const GOLD = '#C8A44A', NAVY = '#0D2B5C', MUTED = '#8b97ab', GRID = '#e6eaf1', SOFT = '#f2f5fa';

// 图表内字体：与页面正文同族，避免 SVG 里 fallback 到衬线体
const FONT = '"Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const T = (x, y, s, { size = 12, fill = NAVY, anchor = 'middle', weight = 500, dy = 0, halo = false } = {}) =>
  `<text x="${x}" y="${y + dy}" font-family='${FONT}' font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}"${halo ? ' stroke="#fff" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round"' : ''}>${esc(s)}</text>`;

// 从 0 起、步长「好看」的刻度：保证顶端刻度 >= max，且不为了包住最大值而白留半屏
function ticks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const e = Math.pow(10, Math.floor(Math.log10(raw)));
  const mults = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  let step = e, k = count;
  for (const m of mults) {
    const st = m * e;
    const kk = Math.ceil(max / st - 1e-9);
    if (kk < 2) continue;
    step = st; k = kk;
    if (kk >= 2 && kk <= count + 1) break;
  }
  const out = [];
  for (let i = 0; i <= k; i++) out.push(+(i * step).toFixed(6));
  return out;
}

// 任意区间的「好看」刻度（散点条用，不从 0 开始）
function niceTicks(lo, hi, count = 4) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / count;
  const e = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / e;
  const step = (n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 5 ? 5 : 10) * e;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out.length >= 2 ? out : [lo, hi];
}

const wrap = (W, H, body) =>
  `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible" role="img">${body}</svg>`;

/* ---------------- 柱状图（带 SD 误差线） ---------------- */
export function barChart({ items, fmt = (v) => Math.round(v), height = 300, ref = null, refLabel = '', barColor = GOLD }) {
  const W = 680, H = height, L = 66, R = 16, Tp = 26, B = 52;
  const iw = W - L - R, ih = H - Tp - B;
  const m0 = Math.max(...items.map((d) => (d.value || 0) + (d.sd || 0)));
  const maxV = m0 > 0 ? m0 : 1;
  const tk = ticks(maxV * 1.04, 4);
  const top = tk[tk.length - 1];
  const y = (v) => Tp + ih - (v / top) * ih;
  const step = iw / items.length;
  const bw = Math.min(110, step * 0.5);
  let s = '';
  tk.forEach((v) => {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${GRID}" stroke-width="1"/>`;
    s += T(L - 10, y(v), fmt(v), { anchor: 'end', fill: MUTED, size: 11 });
  });
  if (ref != null) {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(ref)}" y2="${y(ref)}" stroke="${NAVY}" stroke-width="1.5" stroke-dasharray="5 4" opacity=".55"/>`;
    if (refLabel) s += T(W - R, y(ref) - 6, refLabel, { anchor: 'end', fill: NAVY, size: 11 });
  }
  items.forEach((d, i) => {
    const cx = L + step * (i + 0.5);
    const h = Math.max(2, ih - (y(d.value) - Tp));
    s += `<rect x="${cx - bw / 2}" y="${y(d.value)}" width="${bw}" height="${h}" rx="5" fill="${d.color || barColor}"/>`;
    if (d.sd) {
      const yy = y(d.value + d.sd), cap = 9;
      s += `<line x1="${cx}" x2="${cx}" y1="${y(d.value)}" y2="${yy}" stroke="${NAVY}" stroke-width="1.6" opacity=".65"/>`;
      s += `<line x1="${cx - cap}" x2="${cx + cap}" y1="${yy}" y2="${yy}" stroke="${NAVY}" stroke-width="1.6" opacity=".65"/>`;
    }
    s += T(cx, y(d.value) - (d.sd ? 12 : 8), fmt(d.value), { size: 13, weight: 700, halo: true });
    s += T(cx, H - B + 20, d.label, { size: 12, fill: '#44506a' });
    if (d.note) s += T(cx, H - B + 37, d.note, { size: 11, fill: MUTED });
  });
  s += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#c9d2e0" stroke-width="1.2"/>`;
  return wrap(W, H, s);
}

/* ---------------- 分组柱状图（多系列 × 多组） ---------------- */
export function groupedBar({ groups, series, fmt = (v) => Math.round(v), height = 310, colors = [GOLD, '#5b7fb5'] }) {
  const W = 680, H = height, L = 66, R = 16, Tp = 40, B = 52;
  const iw = W - L - R, ih = H - Tp - B;
  const all = series.flatMap((se) => groups.map((g) => se.values[g] || 0));
  const m0 = Math.max(...all);
  const maxV = m0 > 0 ? m0 : 1;
  const tk = ticks(maxV * 1.04, 4);
  const top = tk[tk.length - 1];
  const y = (v) => Tp + ih - (v / top) * ih;
  const gstep = iw / groups.length;
  const bw = Math.min(56, gstep * 0.5 / series.length);
  let s = '';
  tk.forEach((v) => {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${GRID}" stroke-width="1"/>`;
    s += T(L - 10, y(v), fmt(v), { anchor: 'end', fill: MUTED, size: 11 });
  });
  groups.forEach((g, gi) => {
    const cx = L + gstep * (gi + 0.5);
    series.forEach((se, si) => {
      const v = se.values[g] || 0;
      const x = cx - (series.length * bw) / 2 + si * bw;
      const h = Math.max(2, ih - (y(v) - Tp));
      s += `<rect x="${x + 3}" y="${y(v)}" width="${bw - 6}" height="${h}" rx="4" fill="${se.color || colors[si]}"/>`;
      s += T(x + bw / 2, y(v) - 7, fmt(v), { size: 11.5, weight: 700, halo: true });
    });
    s += T(cx, H - B + 20, g, { size: 12, fill: '#44506a' });
  });
  series.forEach((se, si) => {
    const x = L + si * 150;
    s += `<rect x="${x}" y="10" width="12" height="12" rx="3" fill="${se.color || colors[si]}"/>`;
    s += T(x + 18, 20, se.name, { anchor: 'start', size: 12, fill: '#44506a', weight: 500 });
  });
  s += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#c9d2e0" stroke-width="1.2"/>`;
  return wrap(W, H, s);
}

/* ---------------- 散点条：每个被试一个点，突出「你」 ---------------- */
export function dotPlot({ points, you = null, fmt = (v) => Math.round(v), height = 240, xLabel = '', avg = null, avgLabel = '' }) {
  const W = 680, L = 66, R = 150, Tp = 34, B = 46;
  const H = Math.max(height, Tp + B + 22 * Math.max(points.length, 1));
  const iw = W - L - R;
  const vals = points.map((p) => p.v).concat(you != null ? [you] : []);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.12 || 1;
  const d0 = lo - pad, d1 = hi + pad;
  const x = (v) => L + ((v - d0) / (d1 - d0)) * iw;
  let s = '';
  if (avg != null) {
    s += `<line x1="${x(avg)}" x2="${x(avg)}" y1="${Tp - 8}" y2="${Tp + 22 * points.length}" stroke="${NAVY}" stroke-width="1.4" stroke-dasharray="5 4" opacity=".55"/>`;
  }
  const tk = niceTicks(d0, d1, 4);
  tk.forEach((vv) => {
    s += `<line x1="${x(vv)}" x2="${x(vv)}" y1="${Tp - 6}" y2="${Tp + 22 * points.length}" stroke="${GRID}" stroke-width="1"/>`;
    s += T(x(vv), Tp - 12, fmt(vv), { size: 11, fill: MUTED });
  });
  points.forEach((p, i) => {
    const cy = Tp + 11 + i * 22;
    s += `<line x1="${L}" x2="${W - R}" y1="${cy}" y2="${cy}" stroke="${SOFT}" stroke-width="1"/>`;
    s += T(L - 10, cy, p.label, { anchor: 'end', size: 11, fill: MUTED });
    s += `<circle cx="${x(p.v)}" cy="${cy}" r="5.5" fill="#9fb0c8"/>`;
    if (p.hi) s += `<circle cx="${x(p.v)}" cy="${cy}" r="5.5" fill="${GOLD}"/>`;
  });
  if (you != null) {
    const cy = Tp + 11 + points.length * 22;
    s += `<line x1="${L}" x2="${W - R}" y1="${cy}" y2="${cy}" stroke="${SOFT}" stroke-width="1"/>`;
    s += T(L - 10, cy, '你', { anchor: 'end', size: 11.5, fill: NAVY, weight: 700 });
    s += `<circle cx="${x(you)}" cy="${cy}" r="7" fill="${NAVY}"/>`;
    s += `<circle cx="${x(you)}" cy="${cy}" r="3" fill="#fff"/>`;
    s += T(x(you) + 14, cy, fmt(you), { anchor: 'start', size: 12, fill: NAVY, weight: 700 });
  }
  if (xLabel) s += T(L + iw / 2, H - 10, xLabel, { size: 11, fill: MUTED });
  return wrap(W, H, s);
}

/* ---------------- 效应量条（以 0 为中心，左右展开） ---------------- */
export function effectBar({ items, height = 40 }) {
  const W = 680, rowH = 46, L = 200, R = 90;
  const H = Math.max(height, 20 + items.length * rowH);
  const iw = W - L - R;
  const maxAbs = Math.max(...items.map((d) => Math.abs(d.v || 0)), 0.5);
  const cx = L + iw / 2;
  const sc = (v) => cx + (v / (maxAbs * 1.15)) * (iw / 2);
  let s = `<line x1="${cx}" x2="${cx}" y1="6" y2="${H - 10}" stroke="#c9d2e0" stroke-width="1.2"/>`;
  items.forEach((d, i) => {
    const cy = 20 + i * rowH;
    const w = Math.abs(sc(d.v) - cx);
    const x0 = d.v >= 0 ? cx : sc(d.v);
    s += T(L - 12, cy + 4, d.label, { anchor: 'end', size: 12, fill: '#44506a' });
    s += `<rect x="${x0}" y="${cy - 9}" width="${Math.max(2, w)}" height="18" rx="4" fill="${d.v >= 0 ? GOLD : '#b0bccd'}"/>`;
    // 条太长时数值放在条内（白字），否则放在条的末端外侧
    if (w > 76) {
      s += T(d.v >= 0 ? sc(d.v) - 9 : sc(d.v) + 9, cy + 4, d.text, {
        anchor: d.v >= 0 ? 'end' : 'start', size: 11.5, weight: 700, fill: '#fff',
      });
    } else {
      s += T(d.v >= 0 ? sc(d.v) + 8 : sc(d.v) - 8, cy + 4, d.text, {
        anchor: d.v >= 0 ? 'start' : 'end', size: 12, weight: 700, fill: NAVY,
      });
    }
  });
  s += T(L + iw / 2, H - 2, '← 更小        效应量（Cohen\'s d / dz）        更大 →', { size: 10.5, fill: MUTED });
  return wrap(W, H, s);
}

/* ---------------- 百分位条：你在分布里的位置 ---------------- */
export function pctRow({ label, value, pct, hint = `高于 ${Math.round((pct || 0) * 100)}% 的人`, height = 46 }) {
  const W = 680, L = 180, R = 132, H = height;
  const iw = W - L - R;
  const cy = H / 2;
  let s = T(L - 14, cy + 4, label, { anchor: 'end', size: 12, fill: '#44506a' });
  s += `<rect x="${L}" y="${cy - 7}" width="${iw}" height="14" rx="7" fill="${SOFT}"/>`;
  s += `<rect x="${L}" y="${cy - 7}" width="${Math.max(3, (pct || 0) * iw)}" height="14" rx="7" fill="${GOLD}"/>`;
  const px = L + (pct || 0) * iw;
  s += `<circle cx="${px}" cy="${cy}" r="7.5" fill="${NAVY}"/>`;
  s += `<circle cx="${px}" cy="${cy}" r="3" fill="#fff"/>`;
  s += T(W - R + 12, cy - 2, value, { anchor: 'start', size: 12.5, weight: 700, fill: NAVY });
  s += T(W - R + 12, cy + 14, hint, { anchor: 'start', size: 10, fill: MUTED });
  return wrap(W, H, s);
}
