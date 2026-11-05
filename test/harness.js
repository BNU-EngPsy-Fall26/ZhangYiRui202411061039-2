// 自检：?mode=draw 渲染关键画面；?mode=flow 用自动作答跑完实验一
import { Stage } from '../js/stage.js';
import { drawChangeScene } from '../js/exp/scenes.js';
import { drawYah } from '../js/exp/yah_cued.js';
import { run as runCB } from '../js/exp/cb_cued.js';
import { run as runYAH } from '../js/exp/yah_cued.js';

const out = document.getElementById('out');
const mode = new URLSearchParams(location.search).get('mode') || 'draw';
const log = (s) => { out.textContent += '\n' + s; };
window.addEventListener('error', (e) => { out.style.color = '#ff8a80'; out.textContent += '\nJS ERROR: ' + e.message + ' @' + e.filename + ':' + e.lineno; });
window.addEventListener('unhandledrejection', (e) => { out.style.color = '#ff8a80'; out.textContent += '\nREJECT: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason); });

if (mode === 'app') {
  const f = document.createElement('iframe');
  f.src = '/';
  f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
  document.body.appendChild(f);
  await new Promise((r) => { f.onload = r; });
  await new Promise((r) => setTimeout(r, 400));
  const d = f.contentDocument;
  const checks = [];
  const has = (id) => !!d.getElementById(id);
  checks.push(['登录页存在', has('btn-login') && d.getElementById('screen-login').classList.contains('active')]);
  d.getElementById('in-sid').value = 'TEST01';
  d.getElementById('in-name').value = '自检';
  d.getElementById('btn-login').click();
  await new Promise((r) => setTimeout(r, 1200));
  const stage = d.querySelector('.stage-root');
  checks.push(['实验舞台已创建', !!stage]);
  const card = d.querySelector('.instr-card');
  checks.push(['出现实验一说明卡', !!card && /实验一/.test(card.textContent)]);
  out.style.color = checks.every(([_, ok]) => ok) ? '#7CFC9A' : '#ff8a80';
  out.textContent = checks.map(([k, ok]) => (ok ? 'PASS ' : 'FAIL ') + k).join('\n') + '\n\n说明卡标题：' +
    (card ? card.querySelector('h2').textContent : '(none)');
}

if (mode === 'draw') {
  const cv = document.getElementById('grid');
  cv.style.display = 'block';
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1600, 900);

  const tile = (x, y, label, fn) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(0.5, 0.5); fn(ctx); ctx.restore();
    ctx.fillStyle = '#111'; ctx.font = '600 20px sans-serif'; ctx.fillText(label, x + 12, y + 28);
  };
  tile(0, 0, 'CB · room（改后）', (c) => drawChangeScene(c, 'room', true));
  tile(800, 0, 'CB · kitchen（改后）', (c) => drawChangeScene(c, 'kitchen', true));
  const names = { F: '图书馆', R: '食堂', B: '体育馆', L: '教学楼' };
  tile(0, 450, 'YAH · 无提示 · 旋转 180°', (c) => drawYah(c, names, 180, 'R'));
  tile(800, 450, 'YAH · 有提示 · 旋转 180°', (c) => drawYah(c, names, 180, 'R', { cue: true }));
  out.textContent = 'draw ok';
}

if (mode === 'yah') {
  new MutationObserver(() => {
    document.querySelectorAll('.instr-card button').forEach((b) => { if (!b.dataset.auto) { b.dataset.auto = '1'; setTimeout(() => b.click(), 60); } });
  }).observe(document.body, { childList: true, subtree: true });

  const stage = new Stage();
  window.__stage = stage;
  // 自动按方向键：随机选一个方向（不追求正确率，只验证流程与记录字段）
  const keyTimer = setInterval(() => {
    const codes = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
    window.dispatchEvent(new KeyboardEvent('keydown', { code: codes[Math.floor(Math.random() * 4)], bubbles: true }));
  }, 500);

  try {
    const res = await runYAH({ stage, subject: 'TEST' });
    clearInterval(keyTimer);
    const t = res.trials;
    const cells = {};
    t.forEach((x) => { const k = `${x.cue}-${x.rot}`; cells[k] = (cells[k] || 0) + 1; });
    const checks = [
      ['试次数 = 48', t.length === 48],
      ['6 格 × 8', Object.values(cells).length === 6 && Object.values(cells).every((n) => n === 8)],
      ['key 全部记录', t.every((x) => ['F', 'R', 'B', 'L', 'none'].includes(x.key))],
      ['correct/sys_err 为 0/1', t.every((x) => [0, 1].includes(x.correct) && [0, 1].includes(x.sys_err))],
      ['sys_err 蕴含答错', t.every((x) => !(x.sys_err === 1) || x.correct === 0)],
      ['rot 均匀', ['0', '90', '180'].every((r) => t.filter((x) => x.rot === +r).length === 16)],
    ];
    const bad = checks.filter(([_, ok]) => !ok);
    out.style.color = bad.length ? '#ff8a80' : '#7CFC9A';
    out.textContent = checks.map(([k, ok]) => (ok ? 'PASS ' : 'FAIL ') + k).join('\n') +
      `\n\n正确率 ${(res.summary.acc * 100).toFixed(1)}%　样例：` + JSON.stringify(t[0]);
  } catch (e) {
    out.textContent = 'ERROR ' + (e && e.message) + '\n' + (e && e.stack);
  }
}

if (mode === 'flow') {
  // 自动点掉说明卡
  new MutationObserver(() => {
    document.querySelectorAll('.instr-card button').forEach((b) => { if (!b.dataset.auto) { b.dataset.auto = '1'; setTimeout(() => b.click(), 60); } });
  }).observe(document.body, { childList: true, subtree: true });

  const stage = new Stage();
  window.__stage = stage;

  // 自动按空格（发现变化）与点击（报告位置）
  const spaceTimer = setInterval(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  }, 400);
  const clickTimer = setInterval(() => {
    if (stage.hud.textContent.includes('请点击')) {
      const r = stage.rect();
      stage.box.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.5, bubbles: true }));
    }
  }, 350);

  try {
    const res = await runCB({ stage, subject: 'TEST' });
    clearInterval(spaceTimer); clearInterval(clickTimer);
    const t = res.trials;
    const checks = [
      ['试次数 = 12', t.length === 12],
      ['全部有觉察时间', t.every((x) => typeof x.resp_ms === 'number')],
      ['全部有点击记录', t.every((x) => x.clicked === 1)],
      ['click_ok 为 0/1', t.every((x) => x.click_ok === 0 || x.click_ok === 1)],
      ['cue_valid 计数 9/3', t.filter((x) => x.cue_valid === 1).length === 9],
      ['无 NaN 字段', t.every((x) => Object.values(x).every((v) => typeof v !== 'number' || Number.isFinite(v)))],
    ];
    const bad = checks.filter(([_, ok]) => !ok);
    out.style.color = bad.length ? '#ff8a80' : '#7CFC9A';
    out.textContent = checks.map(([k, ok]) => (ok ? 'PASS ' : 'FAIL ') + k).join('\n') +
      '\n\n样例试次：' + JSON.stringify(t[0]);
  } catch (e) {
    out.textContent = 'ERROR ' + (e && e.message) + '\n' + (e && e.stack);
  }
}
