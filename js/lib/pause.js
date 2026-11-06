// 实验内的暂停 / 退出：舞台左上角按钮 + Esc / P 快捷键
//
// 语义（刻意不做「冻结画面续算」）：
//   · 暂停 = 立刻中断当前试次，这一试次作废；点「继续」后**重做**被打断的那一题
//   · 退出 = 放弃本次实验，已做的数据不上传（否则 12/36 这种残缺记录会污染分析）
//
// 用法：
//   const p = createPause(stage, { experiment: '实验一' });
//   循环里的第一个 await 之前：if (p.quit) return { aborted: true };
//                              if (p.paused) { if (await p.waitResume() === 'quit') return { aborted: true }; }
//   试次里：const sig = p.interrupt;  // 函数入口处取一次，别在 await 之后再取
//          sig.then(() => finish('pause'));  // finish 内部置 done，返回 null 表示本试次作废
export const ABORT = 'pause-abort';

export function createPause(stage, { experiment = '本实验', note = '' } = {}) {
  const box = stage.box;
  box.classList.add('has-pause');

  // 防止暂停按钮的点击被实验里「点击位置」的 mousedown 监听吃掉
  const eat = (e) => { e.stopPropagation(); };

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'stage-pause';
  btn.title = '暂停 / 退出（Esc）';
  btn.innerHTML = '<span>❚❚</span>暂停';
  btn.addEventListener('mousedown', eat);
  btn.addEventListener('click', (e) => { e.stopPropagation(); engage(); });
  box.appendChild(btn);

  let paused = false;
  let quitFlag = false;
  let pieces = [];
  let waiters = [];
  let resolveInt = null;
  let interrupt = new Promise((r) => { resolveInt = r; });

  const fireWaiters = (v) => { const ws = waiters; waiters = []; ws.forEach((f) => f(v)); };

  const ctl = {
    get paused() { return paused; },
    get quit() { return quitFlag; },
    get interrupt() { return interrupt; },
    waitResume() {
      if (!paused) return Promise.resolve(quitFlag ? 'quit' : 'go');
      return new Promise((res) => waiters.push(res));
    },
    destroy() { cleanup(); },
  };

  function showCard() {
    const veil = document.createElement('div');
    veil.className = 'pause-veil';
    veil.addEventListener('mousedown', eat);

    const card = document.createElement('div');
    card.className = 'pause-card';
    card.addEventListener('mousedown', eat);
    card.innerHTML = `<h2>已暂停</h2>
      <p>${experiment}还没做完（当前进度会保留）。点「继续」会<b>从被打断的这一题重新开始</b>，刚才那次不算数。</p>
      ${note ? `<p class="muted">${note}</p>` : ''}
      <p class="muted">按 Esc 也可以继续。</p>
      <div class="instr-actions">
        <button class="btn btn-o" data-a="quit">退出${experiment}</button>
        <button class="btn btn-gold" data-a="go">继续</button>
      </div>`;
    card.querySelector('[data-a="go"]').onclick = () => { resume(); };
    card.querySelector('[data-a="quit"]').onclick = () => { quit(); };

    box.appendChild(veil);
    box.appendChild(card);
    pieces = [veil, card];
  }

  function closeCard() {
    pieces.forEach((el) => el.remove());
    pieces = [];
  }

  function engage() {
    if (paused || quitFlag) return;
    paused = true;
    resolveInt(ABORT);                        // 让当前试次立刻收手
    interrupt = new Promise((r) => { resolveInt = r; });
    showCard();
  }

  function resume() {
    paused = false;
    closeCard();
    fireWaiters('go');
  }

  function quit() {
    quitFlag = true;
    paused = false;
    closeCard();
    fireWaiters('quit');
    // 还开着的说明卡一并点掉，否则上层 await instruct() 会一直挂着
    box.querySelectorAll('.instr-card').forEach((el) => {
      const b = el.querySelector('button');
      if (b) b.click();
    });
    cleanup();
  }

  function cleanup() {
    window.removeEventListener('keydown', onKey, true);
    closeCard();
    btn.remove();
    box.classList.remove('has-pause');
  }

  function onKey(e) {
    if (e.code !== 'Escape' && e.code !== 'KeyP') return;
    e.preventDefault(); e.stopPropagation();
    if (quitFlag) return;
    if (paused) resume(); else engage();
  }
  window.addEventListener('keydown', onKey, true);

  return ctl;
}
