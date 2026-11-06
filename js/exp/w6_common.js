// W6 实验共用：键盘焦点守卫（沿用 W5 已修复机制）、按键等待、反馈、进度、打乱
import { sleep } from '../api.js';

export const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function orderFor(student, n) {
  const sid = (student && student.student_id) || 'guest';
  if (sid === 'guest') return Math.floor(Math.random() * n);
  return [...String(sid)].reduce((a, c) => a + c.charCodeAt(0), 0) % n;
}

// 键盘焦点：开始前清除页面焦点并让窗口获得焦点；失焦时显示红字提示并计数；点击画面可恢复
export function focusGuard(stage) {
  const diag = { focus_lost: 0, n_keys: 0 };
  try { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); window.focus(); } catch (e) { /* ignore */ }
  const el = document.createElement('div');
  el.className = 'hud-warn'; el.style.zIndex = 6; el.textContent = '窗口未激活：请点击画面，否则按键无效'; el.style.display = 'none';
  stage.box.appendChild(el);
  const warn = (on) => { el.style.display = on ? '' : 'none'; };
  const onBlur = () => { diag.focus_lost++; warn(true); };
  const onFocus = () => warn(false);
  const onKey = (e) => { if (!e.repeat) diag.n_keys++; if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); };
  const onDown = () => { try { window.focus(); } catch (e) { /* ignore */ } warn(!document.hasFocus()); };
  window.addEventListener('blur', onBlur); window.addEventListener('focus', onFocus);
  window.addEventListener('keydown', onKey, true); stage.box.addEventListener('mousedown', onDown);
  const poll = setInterval(() => warn(!document.hasFocus()), 1000);
  return { diag, done() { clearInterval(poll); window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); window.removeEventListener('keydown', onKey, true); stage.box.removeEventListener('mousedown', onDown); el.remove(); } };
}

// 等待按键：codes = { KeyF: 'F', KeyJ: 'J' }；返回 { key, rt }（rt 相对 t0）；超时返回 key=null
// abort 传进来时（暂停信号），会立刻解绑监听并返回 { aborted: true }，避免残留的监听抢下一次按键
export function waitKey(codes, timeout, t0 = performance.now(), abort = null) {
  return new Promise((res) => {
    let to = null;
    const f = (e) => {
      if (e.repeat) return;
      const k = codes[e.code];
      if (k === undefined) return;
      e.preventDefault();
      done({ key: k, rt: performance.now() - t0 });
    };
    const done = (r) => { window.removeEventListener('keydown', f, true); clearTimeout(to); res(r); };
    window.addEventListener('keydown', f, true);
    if (timeout) to = setTimeout(() => done({ key: null, rt: null }), Math.max(0, timeout - (performance.now() - t0)));
    if (abort) abort.then(() => done({ key: null, rt: null, aborted: true }));
  });
}

export function hud(stage, left, right = '') {
  stage.setHud(`<div class="hud-tl">${left}</div>${right ? `<div class="hud-tl" style="left:auto;right:14px">${right}</div>` : ''}`);
}
export async function flash(stage, html, ms, color = '#fff') {
  stage.setHud(`<div class="center-msg" style="color:${color}">${html}</div>`);
  await sleep(ms); stage.setHud('');
}
// 自动化测试探针（截图脚本读取当前试次的正确按键；不影响实验）
export function probe(o) { try { window.__w6probe = o; } catch (e) { /* ignore */ } }

export const KEYS_FJ = { KeyF: 'F', KeyJ: 'J' };
export const kbd = (k) => `<kbd>${k}</kbd>`;
