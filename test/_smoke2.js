/* 流程自检：登录 → 知情同意 → 不用摄像头 → 实验一说明卡 → 试次开始 */
(function () {
  const out = [];
  const ok = (c, msg) => out.push((c ? 'PASS ' : 'FAIL ') + msg);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  (async function () {
    try {
      document.getElementById('in-sid').value = 'P99';
      document.getElementById('btn-login').click();
      await wait(200);
      document.getElementById('btn-nocam').click(); // 无眼动分支 → startAll → 实验一说明卡
      await wait(400);

      const card = document.querySelector('.instr-card');
      ok(!!card, 'instruct card shown');
      ok(!!card && /实验一/.test(card.textContent), 'card is 实验一: ' + (card ? card.querySelector('h2').textContent : '—'));

      const btn = card && card.querySelector('button');
      if (btn) btn.click();
      await wait(400); // 箭头提示 900ms 之内
      const hud = document.querySelector('.hud .hud-tl');
      ok(!!hud, 'trial started, hud: ' + (hud ? hud.textContent.trim() : '—'));

      const canvas = document.querySelector('.stage-box canvas');
      ok(!!canvas && canvas.width > 100, 'canvas sized ' + (canvas ? canvas.width + 'x' + canvas.height : '—'));

      // 键盘提示符存在（空格报告）
      ok(/空格/.test(document.querySelector('.hud').textContent), 'hint shows 空格');
    } catch (e) {
      out.push('FAIL exception: ' + e.message);
    }
    document.title = 'SMOKE2 ' + out.filter((s) => s.startsWith('PASS')).length + '/' + out.length;
    const pre = document.createElement('pre');
    pre.id = 'SMOKE2';
    pre.textContent = out.join('\n');
    document.body.appendChild(pre);
  })();
})();
