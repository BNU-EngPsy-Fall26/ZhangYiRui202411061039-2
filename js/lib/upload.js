// 数据上传 / 读取 / CSV 备份
// 说明：/api/hw2/submit 只接受「平铺」字段值（数字、短字符串、布尔、数字数组），
// 因此每个试次都在本地压平成一行标量。
export const LAB = 'https://attention-lab-production.up.railway.app';
export const PROJECTS = {
  cb: 'CA7JK4',   // 实验一：找不同 + 方向箭头
  yah: '3AQE6F',  // 实验二：你在这里 + 朝向提示
};

// 服务器只接受「平铺」标量值，这里把 null/undefined/对象统一压平，避免被截断或报格式错误
export function sanitizeTrials(rows) {
  const clean = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return Number.isFinite(v) ? v : '';
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.slice(0, 500);
    return String(v).slice(0, 500);
  };
  return rows.map((o) => {
    const out = {};
    Object.keys(o).forEach((k) => { out[k] = clean(o[k]); });
    return out;
  });
}

export async function submitData(project, experiment, participant, trials, condition = '', meta = {}) {
  const metaClean = {};
  Object.keys(meta).forEach((k) => { const v = meta[k]; if (v !== null && v !== undefined) metaClean[k] = v; });
  const body = {
    project,
    experiment,
    participant: String(participant || 'anonymous').slice(0, 40),
    condition: String(condition || '').slice(0, 40),
    trials: sanitizeTrials(trials),
    meta: Object.assign({ ua: navigator.userAgent.slice(0, 80), w: innerWidth, h: innerHeight }, metaClean),
  };
  const res = await fetch(LAB + '/api/hw2/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let r;
  try { r = await res.json(); } catch (e) { throw new Error('服务器返回了无法解析的内容（HTTP ' + res.status + '）'); }
  if (!r.ok) throw new Error(r.msg || ('上传失败：HTTP ' + res.status));
  if (r.warnings) console.warn('上传警告：', r.warnings);
  return r; // { ok, participants, records, record_id, warnings? }
}

export async function loadAll(project, experiment) {
  const url = `${LAB}/api/hw2/data?project=${encodeURIComponent(project)}&experiment=${encodeURIComponent(experiment)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const r = await res.json();
  if (!r.ok) throw new Error(r.msg || '读取失败');
  return r.records || []; // [{ participant, condition, trials: [...] }, ...]
}

/* ---------------- 被试编号推算 ---------------- */
// 只认 P + 数字（P01 / P02 / p7 都算，统一成大写 P + 至少两位）；
// 早期测试留下的 test004、anonymous、空值等一律忽略，免得把编号带跑偏
const SID_RE = /^P(\d{1,4})$/i;

export function nextParticipant(records) {
  let max = 0;
  for (const r of records || []) {
    const m = SID_RE.exec(String((r && r.participant) || '').trim());
    if (m) max = Math.max(max, +m[1]);
  }
  return 'P' + String(max + 1).padStart(2, '0');
}

// 把两个实验的记录合起来算下一个编号；两个都读失败时返回 null（前端保持空白，不硬塞）
export async function suggestParticipant() {
  const res = await Promise.allSettled([
    loadAll(PROJECTS.cb, 'changeblind_cue_arrow'),
    loadAll(PROJECTS.yah, 'yah_heading_cue'),
  ]);
  const recs = [];
  const seen = new Set();
  let ok = false;
  for (const r of res) {
    if (r.status !== 'fulfilled') continue;
    ok = true;
    for (const rec of r.value || []) {
      const p = String((rec && rec.participant) || '').trim();
      const key = p.toUpperCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recs.push(rec);
    }
  }
  if (!ok) return null;
  return { sid: nextParticipant(recs), n: recs.length };
}

// 把试次数组转成 CSV（并触发下载），作为上传失败时的兜底
export function downloadCSV(filename, rows) {
  if (!rows || !rows.length) return;
  const keys = [];
  rows.forEach((o) => Object.keys(o).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const text = '\ufeff' + [keys.join(',')].concat(rows.map((o) => keys.map((k) => esc(o[k])).join(','))).join('\r\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// 眼动记录 → 每试次汇总（接口只收平铺标量，不上传原始采样序列）
// gaze_qc：1 = 该试次数据可用（人脸丢失 ≤35% 且有效采样 ≥10 Hz），0 = 建议剔除
export function gazeSummary(rec) {
  if (!rec || !rec.samples || !rec.samples.length) {
    return { gaze_n: 0, gaze_x: null, gaze_y: null, gaze_lost: null, gaze_qc: 0 };
  }
  const ok = rec.samples.filter((s) => s[1] >= 0 && s[2] >= 0);
  const n = rec.samples.length;
  const lost = 1 - ok.length / n;
  const hz = rec.hz || 0;
  return {
    gaze_n: ok.length,
    gaze_x: ok.length ? +(ok.reduce((a, s) => a + s[1], 0) / ok.length).toFixed(3) : null,
    gaze_y: ok.length ? +(ok.reduce((a, s) => a + s[2], 0) / ok.length).toFixed(3) : null,
    gaze_lost: +lost.toFixed(2),
    gaze_qc: lost <= 0.35 && hz >= 10 ? 1 : 0,
  };
}
