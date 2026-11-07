// 眼动轨迹编码 / 解码 / 注视点识别的单元测试（纯函数，不碰 DOM 与网络）
const out = [];
const ok = (c, m) => out.push((c ? 'PASS ' : 'FAIL ') + m);

const GP = await import('../js/lib/gazepath.js');
const { encodePoint, decodePoint, encodePath, decodePath, fixations, pathStats, SAMPLE_MS } = GP;

/* ---------- 1. 单点编解码 ---------- */
{
  const p = [0.4321, 0.8765];
  const code = encodePoint(p[0], p[1]);
  ok(code.length === 3, `编码长度 3 字符（${code}）`);
  const back = decodePoint(code);
  ok(back && Math.abs(back[0] - p[0]) < 0.004 && Math.abs(back[1] - p[1]) < 0.004,
    `往返误差 < 0.4%（x ${back[0].toFixed(4)} / y ${back[1].toFixed(4)}）`);
}
// 丢失点
ok(encodePoint(-1, -1) === '___', '丢失点编码为 ___（三个 63）');
ok(decodePoint('___') === null, '___ 解码为 null（不当作坐标 (1,1)）');
// 右上角不能和丢失撞码
{
  const c = encodePoint(1, 1);
  ok(c !== '___', '坐标 (1,1) 不占用保留码');
  const b = decodePoint(c);
  ok(b && b[0] > 0.99 && b[1] > 0.99, '(1,1) 仍解码到右上角');
}
// 越界坐标被夹住而不是溢出到别的点
{
  const b = decodePoint(encodePoint(1.4, -0.2));
  ok(b === null, 'x>1 且 y<0 视为无效');
  const b2 = decodePoint(encodePoint(1.4, 0.5));
  ok(b2 && b2[0] === 1, 'x>1 被夹到 1');
}
// 非法字符
ok(decodePoint('a$b') === null, '含非法字符的码返回 null');
ok(decodePoint('ab') === null, '长度不足返回 null');

/* ---------- 2. 整条轨迹 ---------- */
{
  const n = 300, samples = [];
  for (let i = 0; i < n; i++) samples.push([i * SAMPLE_MS, 0.2 + 0.5 * i / n, 0.3]);
  const e = encodePath(samples);
  ok(e.path.length === 900 && e.step === 1 && e.n === 300, `300 点 → 900 字符、未抽稀（${e.path.length} / step ${e.step}）`);

  const pts = decodePath(e.path, e.step);
  ok(pts.length === 300, '解码点数与原采样一致');
  ok(pts[0].t === 0 && pts[10].t === 10 * SAMPLE_MS, '时间按 i×step×66 ms 还原');
  ok(Math.abs(pts[299].x - (0.2 + 0.5 * 299 / 300)) < 0.004, '末点 x 还原正确');

  // 超长轨迹（接近 30 s 超时）自动抽稀，但整段时长不丢
  const many = [];
  for (let i = 0; i < 450; i++) many.push([i * SAMPLE_MS, 0.2 + 0.6 * i / 450, 0.4]);
  const e2 = encodePath(many);
  ok(e2.step === 2 && e2.path.length <= 1000, `450 点（30 s）抽稀：step=${e2.step}，${e2.path.length} 字符`);
  ok(e2.path.length === e2.n * 3, '字符数 = 点数 × 3');
  const pts2 = decodePath(e2.path, e2.step);
  ok(pts2[pts2.length - 1].t === 448 * SAMPLE_MS, `抽稀后时间间隔翻倍，仍覆盖到 ${pts2[pts2.length - 1].t} ms`);
  ok(Math.abs(pts2[pts2.length - 1].x - (0.2 + 0.6 * 448 / 450)) < 0.005, '抽稀后末点位置仍正确');

  // 极端情况也不会超过上限
  const huge = [];
  for (let i = 0; i < 3000; i++) huge.push([i * SAMPLE_MS, 0.5, 0.5]);
  ok(encodePath(huge).path.length <= 1000, '3000 点仍被压到 1000 字符以内');
}
// 空输入
ok(encodePath([]).path === '' && encodePath(null).path === '', '空轨迹返回空串');
ok(decodePath('').length === 0, '空串解码为空数组');
ok(decodePath('', 1).length === 0, '空串 + 任意 step 都安全');

/* ---------- 3. I-DT 注视点 ---------- */
{
  const samples = [];
  for (let i = 0; i < 8; i++) samples.push([i * SAMPLE_MS, 0.5, 0.5]);      // 定住 462 ms
  for (let i = 8; i < 16; i++) samples.push([i * SAMPLE_MS, 0.9, 0.15]);    // 跳到另一处
  const pts = decodePath(encodePath(samples).path, 1);
  const fx = fixations(pts);
  ok(fx.length === 2, `两处驻留 → 2 个注视点（实际 ${fx.length}）`);
  ok(Math.abs(fx[0].x - 0.5) < 0.01 && Math.abs(fx[0].y - 0.5) < 0.01, '第一个注视点位置正确');
  ok(fx[0].t0 === 0 && fx[0].t1 === 7 * SAMPLE_MS, `第一个注视点 0–${fx[0].t1} ms`);
  ok(fx[1].t0 === 8 * SAMPLE_MS, '第二个注视点从跳转处开始');
}
// 短于 100 ms 的单独点不算注视点
{
  const pts = [{ t: 0, x: 0.1, y: 0.1, lost: false }, { t: 66, x: 0.9, y: 0.9, lost: false }, { t: 132, x: 0.1, y: 0.1, lost: false }];
  const fx = fixations(pts);
  ok(fx.length === 0, '来回乱跳（每处仅 66 ms）不产生注视点');
}
// 丢失点会把注视点打断
{
  const pts = [];
  for (let i = 0; i < 5; i++) pts.push({ t: i * 66, x: 0.5, y: 0.5, lost: false });
  for (let i = 5; i < 10; i++) pts.push({ t: i * 66, x: -1, y: -1, lost: true });
  for (let i = 10; i < 15; i++) pts.push({ t: i * 66, x: 0.5, y: 0.5, lost: false });
  ok(fixations(pts).length === 2, '中间丢脸 300 ms → 断成两个注视点');
}

/* ---------- 4. 轨迹统计 ---------- */
{
  const bbox = [760, 420, 80, 60];            // 目标框（像素）
  const samples = [];
  for (let i = 0; i < 10; i++) samples.push([i * SAMPLE_MS, 0.5, 0.5]);     // 正中目标
  for (let i = 10; i < 30; i++) samples.push([i * SAMPLE_MS, 0.05, 0.9]);   // 左下角闲逛
  const pts = decodePath(encodePath(samples).path, 1);
  const st = pathStats(pts, bbox, { margin: 30 });
  ok(st.n === 30 && st.ok === 30 && st.lostShare === 0, '采样点统计正确（30/30，无丢脸）');
  ok(st.nFix === 2, `两个注视点（实际 ${st.nFix}）`);
  ok(st.hitFix === 1, `只有 1 个注视点落在目标框内（实际 ${st.hitFix}）`);
  ok(st.firstHit === 0, '首个命中时刻 = 0 ms');
  ok(st.hitShare > 0.2 && st.hitShare < 0.6, `目标区注视占比 ${(st.hitShare * 100).toFixed(0)}%（介于 20%–60%）`);
  ok(st.length > 700 && st.length < 900, `轨迹长度 ${Math.round(st.length)} px（一次 720×360 的跳转 ≈ 805 px）`);
  ok(st.meanDist > 100, `平均注视点距目标中心 ${Math.round(st.meanDist)} px`);
  ok(st.meanFixMs > 100, `平均注视时长 ${Math.round(st.meanFixMs)} ms`);
}
// 没有 bbox / 没有数据时不炸
{
  const st = pathStats([], null);
  ok(st.n === 0 && st.fixes.length === 0 && st.mean === null && st.firstHit === null, '空输入返回零值而不是 NaN');
  const one = pathStats([{ t: 0, x: 0.5, y: 0.5, lost: false }], null);
  ok(Number.isFinite(one.length) && one.hitShare === null, '单点轨迹：长度 0、命中占比 null');
}

/* ---------- 5. 与上传链路的契约 ---------- */
{
  const { gazeSummary, sanitizeTrials, nextParticipant } = await import('../js/lib/upload.js');
  const rec = { samples: [], hz: 14 };
  for (let i = 0; i < 60; i++) rec.samples.push([i * 66, 0.4 + i * 0.001, 0.6]);
  const gs = gazeSummary(rec);
  ok(typeof gs.gaze_path === 'string' && gs.gaze_path.length === 180, 'gazeSummary 里带 180 字符的轨迹（60 点）');
  ok(gs.gaze_step === 1, 'gaze_step = 1');
  ok(gs.gaze_n === 60 && gs.gaze_qc === 1, '原有字段没被破坏');

  const rows = sanitizeTrials([{ i: 1, gaze_path: gs.gaze_path, note: 'x'.repeat(900) }]);
  ok(rows[0].gaze_path.length === 180, 'sanitizeTrials 保留 gaze_path 全程');
  ok(rows[0].note.length === 500, '其它字符串仍截到 500（原行为不变）');

  // 超长轨迹会被放宽到 2000 而不是 500
  const long = { samples: [], hz: 14 };
  for (let i = 0; i < 700; i++) long.samples.push([i * 66, 0.5, 0.5]);
  const g2 = gazeSummary(long);
  const r2 = sanitizeTrials([{ gaze_path: g2.gaze_path }]);
  ok(r2[0].gaze_path.length === g2.gaze_path.length, `长轨迹未被截断（${r2[0].gaze_path.length} 字符，step ${g2.gaze_step}）`);

  // 无眼动时字段存在且为空，不会变成 undefined
  const empty = gazeSummary(null);
  ok(empty.gaze_path === '' && empty.gaze_step === 1, '无眼动时 gaze_path 为空串而不是 undefined');
  ok(nextParticipant([{ participant: 'P07' }]) === 'P08', '被试编号推算未受影响');
}

/* ---------- 6. 结果页汇总口径 ---------- */
{
  const { hasPath, hasGaze, recordGazeSummary } = await import('../js/gazeviz.js');
  const mk = (extra) => Object.assign({ i: 1, ex: 800, ey: 450, gaze_n: 10, gaze_x: 0.5, gaze_y: 0.5, click_x: 0.5, click_y: 0.5, clicked: 1, resp_ms: 3000 }, extra);
  const withPathTrial = mk({ gaze_path: encodePath([...Array(20)].map((_, i) => [i * 66, 0.5, 0.5])).path, gaze_step: 1 });
  const oldTrial = mk({ gaze_path: '', gaze_step: 1 });
  ok(hasPath(withPathTrial) && !hasPath(oldTrial), 'hasPath 区分新旧记录');
  ok(hasGaze(withPathTrial) && hasGaze(oldTrial), 'hasGaze 对新旧记录都为真');

  const s = recordGazeSummary({ participant: 'P02', trials: [withPathTrial, oldTrial, mk({ gaze_n: 0, gaze_path: '' })] });
  ok(s.n === 3 && s.withGaze === 2 && s.withPath === 1, `汇总：3 题 / 2 题有眼动 / 1 题有轨迹（实际 ${s.n}/${s.withGaze}/${s.withPath}）`);
  ok(s.hitSee === 1 && s.hitMiss === 0, '命中目标且报告了变化 → 算了「看了才看见」');
}

const pass = out.filter((s) => s.startsWith('PASS')).length;
console.log(out.join('\n'));
console.log(`\n${pass}/${out.length} 通过`);
process.exit(pass === out.length ? 0 : 1);
