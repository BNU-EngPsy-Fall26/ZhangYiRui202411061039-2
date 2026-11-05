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
