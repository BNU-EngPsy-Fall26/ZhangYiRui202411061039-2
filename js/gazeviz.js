// 结果页 · 眼动轨迹视图（对照原项目 js/gaze_viz.js 的做法：扫描路径 + 注视点 + 热图 + 回放）
//
// 与原项目的三点不同：
// 1) 原项目从服务端拿 samples / fixations；这里服务端只存了 gaze_path 字符串，解码在 lib/gazepath.js；
// 2) 底板不另外存图：实验一只有一个场景，画面上唯一的差异就是「多出来的那个人」，
//    它的脚点 (ex, ey) 已逐试次记录，用 drawPlaza(ctx, extra) 就能逐像素复原当时的刺激；
// 3) 旧记录没有 gaze_path，降级成「平均注视点 + 点击位置 + 变化区域」的关系图，仍能回答
//    「他看的地方离变化有多远」。
import { drawPlaza, personBox } from './exp/cb_scenes2.js';
import { decodePath, pathStats, SW, SH } from './lib/gazepath.js';

const CONTRAST = 0.7;      // 与 js/exp/cb_cued.js 的 CONTRAST 一致
const MARGIN = 30;         // 判定/统计容差（像素）
const CUE_LABEL = { 0: '无箭头', 1: '箭头指向正确', 2: '箭头指向相反' };
const $sel = (el, s) => el.querySelector(s);

export function hasPath(t) {
  return !!(t && typeof t.gaze_path === 'string' && t.gaze_path.length >= 6);
}
export function hasGaze(t) { return !!(t && +t.gaze_n > 0); }

// 由 ex/ey 复原「带变化目标」的那一版画面（与实验里 second 图一致：同底板 + 多一个人 + 对比度）
export function stimCanvas(ex, ey, contrast = CONTRAST) {
  const raw = document.createElement('canvas'); raw.width = SW; raw.height = SH;
  const s = 20 + (ey - 380) / 8;
  drawPlaza(raw.getContext('2d'), { x: ex, y: ey, s });
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const cx = c.getContext('2d');
  cx.filter = 'contrast(' + contrast + ')';
  cx.drawImage(raw, 0, 0);
  cx.filter = 'none';
  return c;
}

const ms = (x) => (x == null ? '—' : Math.round(x) + ' ms');
const pct = (x) => (x == null ? '—' : (x * 100).toFixed(0) + '%');
const fmt = (x) => (x == null ? '—' : Math.round(x).toLocaleString('zh-CN'));

// 一条记录的轨迹汇总（供表头/降级提示用）
export function recordGazeSummary(rec) {
  const ts = (rec && rec.trials) || [];
  const withGaze = ts.filter(hasGaze);
  const withPath = ts.filter(hasPath);
  let hitSee = 0, hitMiss = 0;
  for (const t of withPath) {
    const st = pathStats(decodePath(t.gaze_path, t.gaze_step), bboxOf(t), { margin: MARGIN });
    if (st.hitFix > 0) { if (t.resp_ms !== null && t.resp_ms !== '') hitSee++; else hitMiss++; }
  }
  return { n: ts.length, withGaze: withGaze.length, withPath: withPath.length, hitSee, hitMiss };
}

function bboxOf(t) {
  const ex = +t.ex, ey = +t.ey;
  if (!isFinite(ex) || !isFinite(ey)) return null;
  return personBox(ex, ey, 20 + (ey - 380) / 8);
}

/* ---------------- 主入口 ---------------- */
export function mountGazeTraj(el, records, opts = {}) {
  if (!el) return null;
  const recs = (records || []).filter((r) => (r.trials || []).some(hasGaze));
  if (!recs.length) {
    el.innerHTML = '<p class="note">还没有带眼动的记录。眼动是可选层：登录后点「开启摄像头眼动」并完成 9 点校准，实验一才会记录注视数据。</p>';
    return null;
  }

  const totalPath = recs.reduce((a, r) => a + (r.trials || []).filter(hasPath).length, 0);
  const totalTrials = recs.reduce((a, r) => a + (r.trials || []).length, 0);

  el.innerHTML = `
    <div class="gv-bar">
      <label class="gv-f">被试 <select class="gv-rec">${recs.map((r, i) => `<option value="${i}">${r.participant}${r.created_at ? ' · ' + String(r.created_at).slice(5, 16) : ''}</option>`).join('')}</select></label>
      <label class="gv-f">试次 <select class="gv-trial"></select></label>
      <label class="gv-f"><input type="checkbox" class="gv-heat"> 热图</label>
      <label class="gv-f"><input type="checkbox" class="gv-fixchk" checked> 注视点</label>
      <button type="button" class="btn btn-o btn-sm gv-play">▶ 回放</button>
    </div>
    <div class="gv-stage"><canvas class="gv-canvas" width="${SW}" height="${SH}"></canvas></div>
    <div class="gv-timeline"><input type="range" class="gv-slider" min="0" max="1000" value="1000"><span class="gv-time"></span></div>
    <p class="gv-info"></p>
    <p class="gv-sum"></p>
    <p class="note gv-hint"></p>`;

  const canvas = $sel(el, '.gv-canvas'), ctx = canvas.getContext('2d');
  const selRec = $sel(el, '.gv-rec'), selTrial = $sel(el, '.gv-trial');
  const chkHeat = $sel(el, '.gv-heat'), chkFix = $sel(el, '.gv-fixchk');
  const slider = $sel(el, '.gv-slider'), timeEl = $sel(el, '.gv-time');
  const playBtn = $sel(el, '.gv-play'), infoEl = $sel(el, '.gv-info'), sumEl = $sel(el, '.gv-sum');

  let rec = recs[0], trial = null, t = Infinity, playing = false, raf = 0, cache = new Map(), dur = 0;
  const contrast = opts.contrast || CONTRAST;

  const stim = (ex, ey) => {
    const k = ex + ',' + ey;
    if (!cache.has(k)) cache.set(k, stimCanvas(ex, ey, contrast));
    return cache.get(k);
  };

  function fillTrials() {
    const ts = rec.trials || [];
    selTrial.innerHTML = ts.map((tr, i) => {
      const tag = hasPath(tr) ? '' : (hasGaze(tr) ? '（无轨迹）' : '（无眼动）');
      const rt = tr.resp_ms === null || tr.resp_ms === '' ? '未报告' : (tr.resp_ms / 1000).toFixed(1) + ' s';
      return `<option value="${i}">#${tr.i} ${CUE_LABEL[+tr.cue_type] || ''} · ${rt}${tag}</option>`;
    }).join('');
    // 默认挑第一个有轨迹的试次，没有就挑第一个有眼动的
    const first = ts.findIndex(hasPath);
    const alt = ts.findIndex(hasGaze);
    const pick = first >= 0 ? first : (alt >= 0 ? alt : 0);
    selTrial.value = String(pick);
    pickTrial();
  }

  function pickTrial() {
    const ts = rec.trials || [];
    trial = ts[+selTrial.value] || null;
    stop();
    const pts = trial && hasPath(trial) ? decodePath(trial.gaze_path, trial.gaze_step) : [];
    dur = pts.length ? pts[pts.length - 1].t : 0;
    t = Infinity;
    slider.value = 1000;
    draw();
  }

  function draw() {
    if (!trial) { ctx.clearRect(0, 0, SW, SH); return; }
    const ex = +trial.ex, ey = +trial.ey, bbox = bboxOf(trial);
    const tt = Math.min(t, dur || Infinity);
    const pts = hasPath(trial) ? decodePath(trial.gaze_path, trial.gaze_step) : [];
    const tShow = isFinite(tt) ? tt : dur;
    const shown = pts.filter((p) => p.t <= tShow);

    // 1) 底板
    if (isFinite(ex) && isFinite(ey)) ctx.drawImage(stim(ex, ey), 0, 0);
    else { ctx.fillStyle = '#c9c2b2'; ctx.fillRect(0, 0, SW, SH); }
    ctx.fillStyle = 'rgba(10,16,30,.26)'; ctx.fillRect(0, 0, SW, SH);

    // 2) 热图（叠加在底板上，越看越亮）
    if (chkHeat.checked && shown.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const p of shown) {
        if (p.lost) continue;
        const x = p.x * SW, y = p.y * SH, r = 58;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,120,0,.075)'); g.addColorStop(1, 'rgba(255,120,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    // 3) 变化区域（黄金框）
    if (bbox) {
      ctx.save();
      ctx.strokeStyle = '#C8A44A'; ctx.lineWidth = 5; ctx.setLineDash([]);
      ctx.strokeRect(bbox[0], bbox[1], bbox[2], bbox[3]);
      ctx.restore();
    }

    // 4) 原始轨迹折线（只画到现在这一刻）
    const line = shown.filter((p) => !p.lost);
    if (line.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      line.forEach((p, i) => { const x = p.x * SW, y = p.y * SH; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.restore();
    }

    // 5) 注视点（I-DT）：圆大小 ∝ 时长，编号是顺序；落在变化区里的标红
    const st = pathStats(shown, bbox, { margin: MARGIN });
    if (chkFix.checked) {
      const fx = st.fixes;
      const inBox = (f) => {
        if (!bbox) return false;
        const x = f.x * SW, y = f.y * SH;
        return x >= bbox[0] - MARGIN && x <= bbox[0] + bbox[2] + MARGIN && y >= bbox[1] - MARGIN && y <= bbox[1] + bbox[3] + MARGIN;
      };
      fx.forEach((f, i) => {
        const x = f.x * SW, y = f.y * SH, r = Math.min(44, 9 + (f.t1 - f.t0) / 25);
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
        ctx.fillStyle = inBox(f) ? 'rgba(229,57,53,.72)' : 'rgba(20,32,64,.55)';
        ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        if (fx.length <= 40) {
          ctx.fillStyle = '#fff'; ctx.font = '700 15px system-ui,sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), x, y);
        }
      });
    }

    // 6) 当前视线（黄色光点）
    const last = line.length ? line[line.length - 1] : null;
    if (last && isFinite(tShow)) {
      const x = last.x * SW, y = last.y * SH;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
      g.addColorStop(0, 'rgba(255,214,0,.95)'); g.addColorStop(1, 'rgba(255,214,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.fill();
    }

    // 7) 点击位置（红点）与平均注视点（青十字，旧记录唯一能画的眼动信息）
    if (+trial.clicked === 1 && trial.click_x !== null && trial.click_x !== '') {
      const x = +trial.click_x * SW, y = +trial.click_y * SH;
      ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    }
    if (trial.gaze_x !== null && trial.gaze_x !== '' && !hasPath(trial)) {
      const x = +trial.gaze_x * SW, y = +trial.gaze_y * SH;
      ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x + 16, y); ctx.moveTo(x, y - 16); ctx.lineTo(x, y + 16); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.stroke();
    }

    // 8) 文字信息
    if (hasPath(trial)) {
      infoEl.innerHTML =
        `采样 <b>${st.n}</b> 点（有效 ${st.ok}，丢脸 ${pct(st.lostShare)}）· 注视点 <b>${st.nFix}</b> 个`
        + `（I-DT ≤120 px / ≥100 ms，平均 ${ms(st.meanFixMs)}）· 轨迹长 ${fmt(st.length)} px`
        + `<br>首个进入变化区的注视：<b>${st.firstHit == null ? '未进入' : ms(st.firstHit)}</b>`
        + `　变化区内注视占比 <b>${pct(st.hitShare)}</b>（${st.hitFix}/${st.nFix} 个）`
        + `　平均注视点距变化中心 ${fmt(st.meanDist)} px`;
    } else {
      infoEl.innerHTML = hasGaze(trial)
        ? `这一题<b>没有原始轨迹</b>（旧版本只上传了整题的算术平均）。图中青色十字 = 平均注视点，`
          + `距变化中心 <b>${fmt(trial.gaze_x !== '' && bbox ? Math.hypot(+trial.gaze_x * SW - (bbox[0] + bbox[2] / 2), +trial.gaze_y * SH - (bbox[1] + bbox[3] / 2)) : null)}</b> px；`
          + `丢脸率 ${pct(+trial.gaze_lost)}，有效采样 ${trial.gaze_n} 个。`
        : '这一题没有眼动记录（被试未开启摄像头，或该题眼动全部丢失）。图中只有变化区域与点击位置。';
    }
    timeEl.textContent = hasPath(trial) && dur ? `${(Math.min(tShow, dur) / 1000).toFixed(1)} / ${(dur / 1000).toFixed(1)} s` : '';
    playBtn.style.display = hasPath(trial) ? '' : 'none';
    slider.disabled = !hasPath(trial);
  }

  function updateSum() {
    const s = recordGazeSummary(rec);
    const noPath = s.withGaze - s.withPath;
    sumEl.innerHTML = `<b>${rec.participant}</b>：${s.n} 个试次，${s.withGaze} 个有眼动数据，其中 <b>${s.withPath}</b> 个带原始轨迹。`
      + (s.withPath
        ? `　有轨迹的试次里，注视点进过变化区的 <b>${s.hitSee + s.hitMiss}</b> 个 —— 报告了变化的 ${s.hitSee} 个（看了才看见），没报告的 ${s.hitMiss} 个（看了却没看见）。`
        : '')
      + (noPath
        ? (s.withPath
          ? `　另有 ${noPath} 个试次只有平均注视点（旧版本上传，画不出路径）。`
          : `　这 ${noPath} 个试次都只有平均注视点，没有采样序列 —— 旧版本上传时只存了整题的算术平均，所以画不出扫描路径。`)
        : '');
  }

  function stop() { playing = false; cancelAnimationFrame(raf); playBtn.textContent = '▶ 回放'; }

  playBtn.onclick = () => {
    if (playing) { stop(); return; }
    if (!hasPath(trial) || !dur) return;
    playing = true; playBtn.textContent = '⏸ 暂停';
    if (t >= dur) t = 0;
    let last = performance.now();
    const step = (now) => {
      if (!playing) return;
      t += now - last; last = now;
      if (t >= dur) { t = dur; stop(); }
      slider.value = Math.round(1000 * Math.min(1, t / dur));
      draw();
      if (playing) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  slider.oninput = () => { stop(); t = dur * slider.value / 1000; draw(); };
  chkHeat.onchange = draw;
  chkFix.onchange = draw;
  selRec.onchange = () => { rec = recs[+selRec.value] || recs[0]; fillTrials(); updateSum(); };
  selTrial.onchange = pickTrial;

  // 页面级说明：现有数据到底能不能画轨迹
  const hint = $sel(el, '.gv-hint');
  if (hint) {
    hint.innerHTML = totalPath
      ? `全班 ${recs.length} 份带眼动的记录、${totalTrials} 个试次中有 <b>${totalPath}</b> 个带原始轨迹（gaze_path 字段）。`
      : `现有 ${recs.length} 份记录、${totalTrials} 个试次都是<b>旧版本上传</b>：只存了整题的算术平均注视点，没有采样序列，`
        + `所以画不出扫描路径。要拿到轨迹，需要在<b>最新版页面</b>上重跑一次实验一（约 5–6 分钟，需开摄像头并完成 9 点校准）。`;
  }

  fillTrials();
  updateSum();
  return { reload: () => { rec = recs[+selRec.value] || recs[0]; fillTrials(); updateSum(); } };
}
