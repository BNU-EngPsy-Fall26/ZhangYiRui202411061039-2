// 教学用极简说明卡 / 弹窗：只依赖 stage.box 与 lab.css 的样式类
import { sleep } from '../api.js';

export function instruct(stage, html, btn = '开始') {
  return new Promise((res) => {
    const d = document.createElement('div');
    d.className = 'instr-card';
    d.innerHTML = `${html}<div class="instr-actions"><button class="btn btn-gold">${btn}</button></div>`;
    stage.box.appendChild(d);
    const done = () => { window.removeEventListener('keydown', onKey); d.remove(); res(); };
    const onKey = (e) => { if (e.code === 'Enter') { e.preventDefault(); done(); } };
    d.querySelector('button').onclick = done;
    window.addEventListener('keydown', onKey);
  });
}

// 多按钮弹窗：buttons = [{ label, value, cls }]，返回被点击按钮的 value
export function ask(stage, html, buttons) {
  return new Promise((res) => {
    const d = document.createElement('div');
    d.className = 'instr-card';
    d.innerHTML = `${html}<div class="instr-actions">${buttons.map((b, i) => `<button class="btn ${b.cls || 'btn-p'}" data-i="${i}">${b.label}</button>`).join('')}</div>`;
    stage.box.appendChild(d);
    d.querySelectorAll('button[data-i]').forEach((btn) => {
      btn.onclick = () => { d.remove(); res(buttons[+btn.dataset.i].value); };
    });
  });
}

export function countdown(stage, n = 3) {
  return (async () => {
    for (let k = n; k > 0; k--) { stage.setHud(`<div class="countdown">${k}</div>`); await sleep(650); }
    stage.setHud('');
  })();
}
