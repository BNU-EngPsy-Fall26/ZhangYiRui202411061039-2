// 暂停 / 退出模块的逻辑测试：最小 DOM 桩 + 直接驱动 createPause 的控制流
// 重点验证：中断信号只发一次、继续后重新布防、waitResume 的 go/quit 语义、退出时把说明卡点掉

class El {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.parent = null; this.style = {};
    this._cls = new Set(); this._on = {}; this._html = ''; this._stubs = {};
    const self = this;
    this.classList = {
      add: (c) => self._cls.add(c),
      remove: (c) => self._cls.delete(c),
      contains: (c) => self._cls.has(c),
      toggle: (c, v) => { (v === undefined ? !self._cls.has(c) : v) ? self._cls.add(c) : self._cls.delete(c); },
    };
  }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this._cls].join(' '); }
  // 极简「innerHTML → 可点按钮」映射：只认 data-a="xxx"
  set innerHTML(v) {
    this._html = v;
    this._stubs = {};
    const re = /data-a="(\w+)"/g;
    let m;
    while ((m = re.exec(v))) {
      const b = new El('button');
      this._stubs[`[data-a="${m[1]}"]`] = b;
    }
  }
  get innerHTML() { return this._html; }
  appendChild(c) { this.children.push(c); c.parent = this; return c; }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
  addEventListener(t, f) { (this._on[t] = this._on[t] || []).push(f); }
  removeEventListener(t, f) { if (this._on[t]) this._on[t] = this._on[t].filter((x) => x !== f); }
  fire(t, e = {}) { (this._on[t] || []).forEach((f) => f(Object.assign({ stopPropagation() {}, preventDefault() {} }, e))); }
  click() { if (typeof this.onclick === 'function') this.onclick({ stopPropagation() {}, preventDefault() {} }); this.fire('click'); }
  querySelector(sel) {
    if (this._stubs[sel]) return this._stubs[sel];
    const byTag = /^[a-z]+$/.test(sel);
    for (const c of this.children) {
      if (byTag && c.tagName === sel) return c;
      const r = c.querySelector && c.querySelector(sel);
      if (r) return r;
    }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (n) => {
      if (!n._cls) return;
      if (sel === '.instr-card' && n._cls.has('instr-card')) out.push(n);
      n.children.forEach(walk);
    };
    this.children.forEach(walk);
    return out;
  }
}

const box = new El('div');
globalThis.document = { createElement: (t) => new El(t) };
const winListeners = {};
globalThis.window = {
  addEventListener: (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); },
  removeEventListener: (t, f) => { if (winListeners[t]) winListeners[t] = winListeners[t].filter((x) => x !== f); },
};
const key = (code) => (winListeners.keydown || []).slice().forEach((f) => f({ code, stopPropagation() {}, preventDefault() {} }));

const { createPause, ABORT } = await import('../js/lib/pause.js');

const out = [];
const ok = (c, m) => out.push((c ? 'PASS ' : 'FAIL ') + m);
const stage = { box };

const p = createPause(stage, { experiment: '实验一' });

ok(box.querySelector('.stage-pause') !== null || box.children.some((c) => c._cls.has('stage-pause')), '生成了左上角暂停按钮');
ok(box.classList.contains('has-pause'), '给舞台加了 has-pause（HUD 让位）');
ok(!p.paused, '初始不在暂停态');

// —— 第一次暂停：中断信号应立刻兑现
let fired = 0;
p.interrupt.then(() => { fired++; });
const sig1 = p.interrupt;
const btn = box.children.find((c) => c._cls.has('stage-pause'));
btn.click();
await Promise.resolve(); await Promise.resolve();
ok(p.paused, '点按钮后进入暂停态');
ok(fired === 1, '中断信号发了 1 次');
ok(p.interrupt !== sig1, '继续用的新信号已换掉旧信号');

// —— waitResume 在暂停时挂起，继续后返回 go
const waiter = p.waitResume();
let resolved = null;
waiter.then((v) => { resolved = v; });
await Promise.resolve();
ok(resolved === null, 'waitResume 在暂停期间不返回');

key('Escape');                                   // Esc 也可以继续
await Promise.resolve(); await Promise.resolve();
ok(!p.paused, 'Esc 之后恢复运行');
ok(resolved === 'go', '继续后 waitResume 返回 go');

// —— 继续之后信号必须是重新布防的（不能还处于已兑现状态）
let fired2 = 0;
p.interrupt.then(() => { fired2++; });
await Promise.resolve(); await Promise.resolve();
ok(fired2 === 0, '恢复后新信号未被触发（不会立刻把下一题也中断掉）');

// —— 第二次暂停 + 退出
btn.click();
await Promise.resolve();
ok(p.paused, '第二次暂停生效');
const waiter2 = p.waitResume();
let v2 = null;
waiter2.then((v) => { v2 = v; });

// 放一张说明卡在舞台上，退出时应被点掉，否则上层 await instruct 会一直挂着
const instr = new El('div');
instr.className = 'instr-card';
let instrClicked = false;
const ib = new El('button');
ib.onclick = () => { instrClicked = true; };
instr.appendChild(ib);
box.appendChild(instr);

const card = box.children.find((c) => c._cls.has('pause-card'));
ok(!!card, '暂停卡片存在');
ok(box.children.some((c) => c._cls.has('pause-veil')), '遮罩存在');
card.querySelector('[data-a="quit"]').onclick();
await Promise.resolve(); await Promise.resolve();

ok(p.quit === true, '退出标记为 quit');
ok(v2 === 'quit', '退出时 waitResume 返回 quit');
ok(instrClicked, '退出时把还开着的说明卡点掉了');
ok(!box.children.some((c) => c._cls.has('pause-card')), '退出后暂停卡片被移除');
ok(!box.children.some((c) => c._cls.has('stage-pause')), '退出后暂停按钮被移除');
ok(!box.classList.contains('has-pause'), '退出后舞台去掉 has-pause');
ok((winListeners.keydown || []).length === 0, '退出后解绑了快捷键');

// —— 退出之后不再响应
btn.fire('click');

console.log(out.join('\n'));
const fail = out.filter((s) => s.startsWith('FAIL')).length;
console.log('\n' + (fail ? fail + ' 项失败' : '全部通过'));
process.exit(fail ? 1 : 0);
