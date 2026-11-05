/* 单文件版自检（file:// 下运行）：模块、绘制、页面结构、完整流程入口 */
(async function () {
  const out = [];
  const ok = (c, msg) => out.push((c ? 'PASS ' : 'FAIL ') + msg);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const txt = (sel) => { const e = document.querySelector(sel); return e ? e.textContent.trim() : null; };

  try {
    const H = window.__hw2;
    ok(!!H, 'bundle exposed');

    // ---- 实验一：困难档素材 ----
    const t1 = H.CBCUED.buildTrials();
    ok(t1.length === 12, 'CB 12 trials: ' + t1.length);
    ok(t1.filter((t) => t.cue_valid).length === 9, 'CB 9 valid cues: ' + t1.filter((t) => t.cue_valid).length);
    const ids = [...new Set(t1.map((t) => t.scene.id))].sort().join(',');
    ok(ids === 'dash,inbox,metro,parking,platform,plaza', 'CB hard scenes: ' + ids);

    const cv = document.createElement('canvas');
    cv.width = 1600; cv.height = 900;
    const ctx = cv.getContext('2d');
    ['dash', 'parking', 'metro', 'plaza', 'inbox', 'platform'].forEach((id) => {
      H.SCENES.drawChangeScene(ctx, id, false);
      H.SCENES.drawChangeScene(ctx, id, true);
    });
    ok(true, 'hard scenes drawn');

    // ---- 实验二 ----
    const t2 = H.YAHCUED.buildTrials();
    ok(t2.length === 48, 'YAH 48 trials: ' + t2.length);
    const cells = {};
    t2.forEach((t) => { const k = t.cue + '-' + t.rot; cells[k] = (cells[k] || 0) + 1; });
    ok(Object.keys(cells).length === 6 && Object.values(cells).every((v) => v === 8), 'YAH 6 cells x 8');

    // ---- 舞台 ----
    const st = new H.STAGE.Stage();
    ok(!!document.querySelector('.stage-root'), 'stage mounted');
    st.destroy();
    ok(!document.querySelector('.stage-root'), 'stage destroyed');

    // ---- 首页：只有被试信息 ----
    ok(!document.querySelector('.hero'), 'hero removed');
    ok(!document.querySelector('.topbar nav'), 'topbar nav removed');
    ok(!!document.getElementById('in-sid') && !!document.getElementById('btn-login'), 'login form present');
    ok(!!document.getElementById('screen-login').classList.contains('active'), 'login is first screen');

    // ---- 结束页：只有感谢 ----
    ok(txt('#screen-final h2') === '实验结束', 'final title: ' + txt('#screen-final h2'));
    ok(/感谢你的参与/.test(txt('#screen-final')), 'final says thanks');
    ok(!document.getElementById('final-stat'), 'no stats on final page');
    ok(!document.getElementById('btn-restart') && !document.getElementById('btn-results'), 'no data buttons on final page');

    // ---- 结果视图存在但被试流程里没有入口 ----
    ok(!!document.getElementById('view-results') && !document.getElementById('view-results').classList.contains('active'), 'results view hidden');

    // ---- 眼动相关界面已全部移除 ----
    ok(!document.getElementById('screen-consent'), 'no consent screen');
    ok(!document.getElementById('btn-cam') && !document.getElementById('chk-headpose'), 'no camera controls');
    ok(!H.GAZE && !H.CALIB && !H.HEADPOSE, 'no gaze modules in bundle');

    // ---- 登录后直接进入实验一（不再有知情同意/校准） ----
    document.getElementById('in-sid').value = 'P99';
    document.getElementById('btn-login').click();
    await wait(600);
    ok(!!document.querySelector('.stage-root'), 'login -> stage created');
    ok(!!document.querySelector('.instr-card'), 'login -> experiment 1 instruction');
    ok(!!document.getElementById('screen-login'), 'login screen still in DOM (hidden)');
    ok(!document.getElementById('screen-login').classList.contains('active'), 'login screen deactivated');
  } catch (e) {
    out.push('FAIL exception: ' + e.message + ' @ ' + String((e.stack || '').split('\n')[1] || '').trim());
  }

  document.title = 'SMOKE ' + out.filter((s) => s.startsWith('PASS')).length + '/' + out.length;
  const pre = document.createElement('pre');
  pre.id = 'SMOKE';
  pre.textContent = out.join('\n');
  document.body.appendChild(pre);
})();
