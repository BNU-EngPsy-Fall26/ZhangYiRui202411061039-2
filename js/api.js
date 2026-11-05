// API 封装：任何失败都弹出可见提示（不再静默吞掉错误）
export function toast(msg, kind = 'err', ms = 5000) {
  let box = document.getElementById('toastBox');
  if (!box) { box = document.createElement('div'); box.id = 'toastBox'; document.body.appendChild(box); }
  const d = document.createElement('div');
  d.className = 'toast ' + kind; d.textContent = msg;
  box.appendChild(d);
  setTimeout(() => d.classList.add('out'), ms);
  setTimeout(() => d.remove(), ms + 400);
}
export async function api(path, { method = 'GET', body, token, quiet = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['X-Admin-Token'] = token;
  else { try { const st = sessionStorage.getItem('att_student_token'); if (st) headers['X-Student-Token'] = st; } catch (e) { /* ignore */ } }
  let res, data;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    if (!quiet) toast('网络错误：无法连接服务器（' + path + '）。数据未保存，请检查网络后重试。');
    throw e;
  }
  try { data = await res.json(); } catch (e) { data = { ok: false, msg: 'HTTP ' + res.status }; }
  if (!res.ok || data.ok === false) {
    if (!quiet) toast('服务器返回错误：' + (data.msg || ('HTTP ' + res.status)));
    const err = new Error(data.msg || ('HTTP ' + res.status)); err.data = data; err.status = res.status; throw err;
  }
  return data;
}
export function seededRandom(seed) {
  let s = (typeof seed === 'string' ? [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) : seed) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
