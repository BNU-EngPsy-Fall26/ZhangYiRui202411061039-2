// 统计小工具：描述统计 + t 检验 + 效应量（不依赖任何第三方库）

export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export const sd = (a) => {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

export const med = (a) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  const k = Math.floor(b.length / 2);
  return b.length % 2 ? b[k] : (b[k - 1] + b[k]) / 2;
};

// 线性插值分位数（p ∈ [0,1]），用于 IQR
export const quant = (a, p) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  if (b.length === 1) return b[0];
  const h = (b.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
  return lo === hi ? b[lo] : b[lo] + (b[hi] - b[lo]) * (h - lo);
};

/* ---- 双尾 p：t 分布 → 正则化不完全 beta ---- */
export function lnGamma(z) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

export function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}

export const pFromT = (t, df) => (df > 0 && Number.isFinite(t) ? betai(df / 2, 0.5, df / (df + t * t)) : null);

// 独立样本 Welch t + Cohen's d（pooled）
export function indT(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a), mb = mean(b), sa = sd(a), sb = sd(b);
  const se = Math.sqrt(sa * sa / a.length + sb * sb / b.length);
  if (!se) return null;
  const t = (ma - mb) / se;
  const df = (sa * sa / a.length + sb * sb / b.length) ** 2 /
    ((sa * sa / a.length) ** 2 / (a.length - 1) + (sb * sb / b.length) ** 2 / (b.length - 1));
  const sp = Math.sqrt(((a.length - 1) * sa * sa + (b.length - 1) * sb * sb) / (a.length + b.length - 2));
  return { t, df, p: pFromT(t, df), diff: ma - mb, d: sp ? (ma - mb) / sp : null, n1: a.length, n2: b.length };
}

// 配对 t（被试内）+ Cohen's dz
export function pairedT(diffs) {
  const n = diffs.length;
  if (n < 2) return null;
  const m = mean(diffs), s = sd(diffs);
  if (!s) return null;
  const t = m / (s / Math.sqrt(n));
  return { t, df: n - 1, p: pFromT(t, n - 1), diff: m, dz: m / s, n };
}

// 在参考分布里的位置
export function rankOf(mine, others) {
  const v = others.filter((x) => x != null && Number.isFinite(x));
  if (!v.length || mine == null || !Number.isFinite(mine)) return null;
  return {
    pct: v.filter((x) => x < mine).length / v.length,
    n: v.length,
    min: Math.min(...v),
    max: Math.max(...v),
    mean: mean(v),
  };
}
