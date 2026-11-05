// 变化盲：新增的程序化场景（1600x900）。每个场景 draw(ctx, changed)；变化只发生在一个目标物体上，
// 其余内容尽量丰富（种子决定的杂物、文字、图标），避免变化区域一眼可见。变化区域框与参数写在 design.json。
import { seededRandom } from '../api.js';

const rr = (c, x, y, w, h, r = 8) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
const T = (c, s, x, y, size = 20, col = '#222', w = '500', al = 'center') => { c.font = `${w} ${size}px "PingFang SC","Microsoft YaHei",sans-serif`; c.fillStyle = col; c.textAlign = al; c.textBaseline = 'middle'; c.fillText(s, x, y); };
const PAL = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98', '#117a65', '#ba4a00', '#5d6d7e', '#d4ac0d', '#a93226'];
function car(c, x, y, w, h, col, front = false) {
  c.fillStyle = col; rr(c, x - w / 2, y - h / 2, w, h, Math.min(w, h) * .2); c.fill();
  c.fillStyle = 'rgba(25,35,50,.6)'; rr(c, x - w * .35, y - h * .4, w * .7, h * .3, 4); c.fill();
  c.fillStyle = front ? '#fff6c0' : '#c0392b'; c.fillRect(x - w * .45, y + h * .18, w * .14, h * .12); c.fillRect(x + w * .31, y + h * .18, w * .14, h * .12);
}
function person(c, x, y, s, col) {
  c.fillStyle = '#e0b48f'; c.beginPath(); c.arc(x, y - s * 1.55, s * .22, 0, 7); c.fill();
  c.fillStyle = col; rr(c, x - s * .3, y - s * 1.3, s * .6, s * .75, 4); c.fill();
  c.fillStyle = '#333'; c.fillRect(x - s * .25, y - s * .55, s * .18, s * .55); c.fillRect(x + s * .07, y - s * .55, s * .18, s * .55);
}
function shelfItems(c, rnd, x, y, w, h, n) { for (let i = 0; i < n; i++) { const iw = 18 + rnd() * 28, ih = 30 + rnd() * (h - 34); c.fillStyle = PAL[Math.floor(rnd() * PAL.length)]; c.fillRect(x + i * (w / n) + 4, y + h - ih, Math.min(iw, w / n - 6), ih); } }
function textLines(c, rnd, x, y, w, n, gap = 26, col = '#c9ced6') { for (let i = 0; i < n; i++) { c.fillStyle = col; c.fillRect(x, y + i * gap, w * (0.5 + rnd() * 0.5), 9); } }
function icons(c, rnd, x, y, cols, rows, s, gap) { for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { c.fillStyle = PAL[Math.floor(rnd() * PAL.length)]; rr(c, x + i * gap, y + j * gap, s, s, s * .22); c.fill(); } }

export const CB2 = {
  // ===== 简单（中心兴趣、较大、颜色/出现消失） =====
  intersection(c, ch) { // 十字路口：中央红车变蓝
    const r = seededRandom('intersection');
    c.fillStyle = '#7f8c8d'; c.fillRect(0, 0, 1600, 900);
    c.fillStyle = '#5d6d7e'; c.fillRect(0, 330, 1600, 260); c.fillRect(640, 0, 320, 900);
    c.fillStyle = '#eee'; for (let i = 0; i < 8; i++) { c.fillRect(600 - i * 0, 340 + i * 30, 30, 14); c.fillRect(970, 340 + i * 30, 30, 14); c.fillRect(660 + i * 36, 290, 18, 30); c.fillRect(660 + i * 36, 600, 18, 30); }
    for (const [x, y] of [[0, 0], [1000, 0], [0, 630], [1000, 630]]) { c.fillStyle = '#a3a39b'; c.fillRect(x, y, 600, 270); for (let k = 0; k < 6; k++) { c.fillStyle = PAL[Math.floor(r() * 10)]; c.fillRect(x + 30 + k * 95, y + 40, 70, 180); c.fillStyle = 'rgba(255,255,255,.4)'; for (let w = 0; w < 4; w++) c.fillRect(x + 40 + k * 95, y + 60 + w * 40, 50, 20); } }
    for (let i = 0; i < 6; i++) car(c, 120 + i * 220, 400, 120, 60, PAL[Math.floor(r() * 10)]);
    for (let i = 0; i < 5; i++) car(c, 1500 - i * 230, 530, 120, 60, PAL[Math.floor(r() * 10)], true);
    for (let i = 0; i < 9; i++) person(c, 40 + r() * 1520, 310 + (r() < .5 ? 0 : 340), 40, PAL[Math.floor(r() * 10)]);
    car(c, 800, 460, 170, 100, ch ? '#2471a3' : '#c0392b');
    c.fillStyle = '#222'; c.fillRect(590, 250, 12, 80); c.fillStyle = '#2ecc71'; c.beginPath(); c.arc(596, 240, 12, 0, 7); c.fill();
  },
  atm(c, ch) { // ATM：中央"取款"大按钮消失
    const r = seededRandom('atm');
    c.fillStyle = '#d5d8dc'; c.fillRect(0, 0, 1600, 900);
    c.fillStyle = '#2c3e50'; rr(c, 300, 40, 1000, 820, 30); c.fill();
    c.fillStyle = '#0b3d5c'; rr(c, 380, 100, 840, 520, 14); c.fill();
    T(c, '中国某某银行 · 自助服务', 800, 140, 30, '#fff', '700');
    const btns = [['查询余额', 430, 200], ['转账汇款', 430, 300], ['存款', 430, 400], ['修改密码', 430, 500], ['缴费', 970, 200], ['外币兑换', 970, 300], ['打印凭条', 970, 500]];
    for (const [s, x, y] of btns) { c.fillStyle = '#1f618d'; rr(c, x, y, 200, 70, 12); c.fill(); T(c, s, x + 100, y + 35, 24, '#fff', '600'); }
    if (!ch) { c.fillStyle = '#d4ac0d'; rr(c, 660, 330, 280, 130, 18); c.fill(); T(c, '取 款', 800, 395, 44, '#1b1b1b', '800'); }
    c.fillStyle = '#17202a'; rr(c, 420, 660, 300, 40, 8); c.fill(); rr(c, 880, 660, 300, 40, 8); c.fill();
    for (let i = 0; i < 12; i++) { c.fillStyle = '#bdc3c7'; rr(c, 560 + (i % 3) * 90, 720 + Math.floor(i / 3) * 30, 70, 24, 5); c.fill(); }
    textLines(c, r, 60, 80, 200, 12, 50, '#aab'); textLines(c, r, 1340, 80, 200, 12, 50, '#aab');
  },
  app(c, ch) { // 手机 App：中央大卡片图片颜色改变
    const r = seededRandom('app');
    c.fillStyle = '#e8eaed'; c.fillRect(0, 0, 1600, 900);
    for (const ox of [80, 1160]) { c.fillStyle = '#fff'; rr(c, ox, 80, 360, 740, 30); c.fill(); icons(c, r, ox + 30, 130, 4, 6, 60, 82); }
    c.fillStyle = '#111'; rr(c, 560, 20, 480, 860, 50); c.fill(); c.fillStyle = '#fff'; rr(c, 580, 60, 440, 780, 30); c.fill();
    T(c, '9:41', 620, 85, 18, '#111', '600', 'left');
    textLines(c, r, 610, 120, 380, 2, 24, '#555');
    c.fillStyle = ch ? '#1e8449' : '#ba4a00'; rr(c, 610, 190, 380, 260, 20); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(800, 300, 60, 0, 7); c.fill();
    T(c, '今日推荐', 640, 480, 24, '#111', '700', 'left'); textLines(c, r, 640, 510, 320, 3, 22, '#bbb');
    for (let i = 0; i < 3; i++) { c.fillStyle = PAL[Math.floor(r() * 10)]; rr(c, 610 + i * 130, 600, 120, 120, 14); c.fill(); }
    icons(c, r, 615, 760, 5, 1, 50, 78);
  },
  market(c, ch) { // 超市货架：中央大促销牌出现/消失
    const r = seededRandom('market');
    c.fillStyle = '#f2e6d0'; c.fillRect(0, 0, 1600, 900);
    for (let row = 0; row < 4; row++) { c.fillStyle = '#8d6e63'; c.fillRect(60, 200 + row * 170, 1480, 14); shelfItems(c, r, 60, 70 + row * 170, 1480, 130, 34); }
    for (let i = 0; i < 6; i++) { c.fillStyle = '#fff'; c.fillRect(100 + i * 250, 212 + (i % 4) * 170, 60, 22); T(c, '¥' + (5 + Math.floor(r() * 40)), 130 + i * 250, 223 + (i % 4) * 170, 14, '#c0392b', '700'); }
    if (!ch) { c.fillStyle = '#e74c3c'; rr(c, 640, 360, 320, 170, 16); c.fill(); T(c, '买一送一', 800, 425, 46, '#fff', '800'); T(c, '限时特惠', 800, 490, 26, '#ffe', '600'); }
  },
  // ===== 中等 =====
  carui(c, ch) { // 汽车中控：右侧较小的空调图标颜色改变（边缘、颜色）
    const r = seededRandom('carui');
    c.fillStyle = '#15191f'; c.fillRect(0, 0, 1600, 900);
    c.fillStyle = '#0d1117'; rr(c, 200, 80, 1200, 700, 30); c.fill();
    c.fillStyle = '#1b2838'; rr(c, 240, 120, 760, 520, 16); c.fill();
    c.strokeStyle = '#2b4a5e'; c.lineWidth = 3; for (let i = 0; i < 10; i++) { c.beginPath(); c.moveTo(250, 140 + i * 50); c.lineTo(990, 120 + i * 55 + r() * 20); c.stroke(); }
    c.strokeStyle = '#3aa0ff'; c.lineWidth = 8; c.beginPath(); c.moveTo(620, 620); c.lineTo(620, 380); c.lineTo(820, 300); c.stroke();
    T(c, '前方 800 米 右转', 620, 160, 26, '#cfe3f5', '700');
    for (let i = 0; i < 5; i++) { c.fillStyle = '#1f2a37'; rr(c, 1040, 130 + i * 102, 320, 86, 12); c.fill(); T(c, ['音乐', '电话', '车辆设置', '能耗', '座椅'][i], 1120, 173 + i * 102, 24, '#9fb3c8', '600', 'left'); c.fillStyle = PAL[i]; c.beginPath(); c.arc(1080, 173 + i * 102, 18, 0, 7); c.fill(); }
    for (let i = 0; i < 8; i++) { c.fillStyle = '#263241'; rr(c, 250 + i * 140, 670, 120, 80, 12); c.fill(); }
    c.fillStyle = ch ? '#e74c3c' : '#3498db'; c.beginPath(); c.arc(1310, 710, 32, 0, 7); c.fill(); T(c, '❄', 1310, 712, 30, '#fff');
    T(c, '22.5°C', 1180, 710, 30, '#fff', '700');
  },
  kitchen(c, ch) { // 厨房：灶台上较小的水壶出现/消失
    const r = seededRandom('kitchen');
    c.fillStyle = '#ede4d3'; c.fillRect(0, 0, 1600, 900);
    c.fillStyle = '#b7950b'; c.fillRect(0, 520, 1600, 380);
    c.fillStyle = '#fdfefe'; for (let i = 0; i < 6; i++) { rr(c, 60 + i * 250, 60, 220, 220, 8); c.fill(); c.fillStyle = '#d5d8dc'; c.fillRect(160 + i * 250, 150, 20, 40); c.fillStyle = '#fdfefe'; }
    c.fillStyle = '#566573'; c.fillRect(0, 470, 1600, 60);
    c.fillStyle = '#2c3e50'; rr(c, 560, 400, 480, 80, 8); c.fill();
    for (const x of [640, 760, 880, 980]) { c.strokeStyle = '#888'; c.lineWidth = 6; c.beginPath(); c.arc(x, 440, 26, 0, 7); c.stroke(); }
    shelfItems(c, r, 80, 330, 420, 140, 12); shelfItems(c, r, 1100, 330, 420, 140, 12);
    c.fillStyle = '#7b241c'; rr(c, 600, 300, 120, 110, 30); c.fill(); // 锅
    if (!ch) { c.fillStyle = '#95a5a6'; rr(c, 850, 340, 90, 80, 22); c.fill(); c.fillRect(930, 360, 30, 12); c.fillStyle = '#626567'; c.fillRect(875, 330, 40, 12); }
    for (let i = 0; i < 10; i++) { c.fillStyle = PAL[Math.floor(r() * 10)]; c.beginPath(); c.arc(120 + r() * 1360, 600 + r() * 250, 18 + r() * 22, 0, 7); c.fill(); }
  },
  office(c, ch) { // 办公室：左侧墙边的大盆栽出现/消失（边缘、出现消失）
    const r = seededRandom('office');
    c.fillStyle = '#dfe6ec'; c.fillRect(0, 0, 1600, 900); c.fillStyle = '#9aa7b1'; c.fillRect(0, 640, 1600, 260);
    for (let i = 0; i < 4; i++) { c.fillStyle = '#c7d2db'; c.fillRect(300 + i * 300, 80, 240, 200); c.fillStyle = '#7fb3d5'; c.fillRect(310 + i * 300, 90, 220, 180); }
    for (let i = 0; i < 4; i++) { c.fillStyle = '#6e4b2a'; c.fillRect(260 + i * 300, 480, 260, 24); c.fillStyle = '#2c3e50'; rr(c, 320 + i * 300, 380, 140, 90, 6); c.fill(); c.fillStyle = PAL[Math.floor(r() * 10)]; c.fillRect(330 + i * 300, 390, 120, 70); person(c, 390 + i * 300, 640, 70, PAL[Math.floor(r() * 10)]); }
    shelfItems(c, r, 1320, 300, 240, 120, 9); shelfItems(c, r, 1320, 450, 240, 120, 9);
    if (!ch) { c.fillStyle = '#6e2c00'; c.fillRect(70, 520, 110, 120); c.fillStyle = '#1e8449'; for (let k = 0; k < 6; k++) { c.beginPath(); c.ellipse(125 + Math.cos(k) * 40, 470 - k * 22, 45, 26, k, 0, 7); c.fill(); } }
    T(c, '会议室 A', 1440, 120, 28, '#2c3e50', '700');
  },
  airport(c, ch) { // 机场航显：中部一行状态文字颜色改变（较小、颜色）
    const r = seededRandom('airport');
    c.fillStyle = '#1b1f27'; c.fillRect(0, 0, 1600, 900);
    c.fillStyle = '#0b0e13'; rr(c, 120, 60, 1360, 780, 14); c.fill();
    T(c, '出发  DEPARTURES', 800, 110, 34, '#f4d03f', '800');
    const cities = ['上海虹桥', '广州', '成都双流', '西安', '昆明', '深圳', '杭州', '重庆', '哈尔滨', '厦门', '武汉', '南京', '长沙'];
    for (let i = 0; i < 13; i++) {
      const y = 170 + i * 50; c.fillStyle = i % 2 ? '#141a22' : '#10151c'; c.fillRect(140, y - 22, 1320, 46);
      T(c, `CA${1200 + Math.floor(r() * 800)}`, 200, y, 24, '#f8f9f9', '600', 'left'); T(c, cities[i], 420, y, 24, '#f8f9f9', '600', 'left');
      T(c, `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${String(Math.floor(r() * 6) * 10).padStart(2, '0')}`, 760, y, 24, '#f8f9f9', '600', 'left');
      T(c, `${String.fromCharCode(65 + Math.floor(r() * 6))}${Math.floor(1 + r() * 40)}`, 960, y, 24, '#f8f9f9', '600', 'left');
      const st = i === 6 ? (ch ? ['延误', '#e74c3c'] : ['正在登机', '#2ecc71']) : [['计划', '#aab'], ['值机', '#5dade2'], ['正在登机', '#2ecc71'], ['延误', '#e74c3c']][Math.floor(r() * 4)];
      T(c, st[0], 1180, y, 24, st[1], '700', 'left');
    }
  },
  classroom(c, ch) { // 教室：右侧墙上海报颜色改变（边缘、颜色）
    const r = seededRandom('classroom');
    c.fillStyle = '#f5eee0'; c.fillRect(0, 0, 1600, 900); c.fillStyle = '#c8a97e'; c.fillRect(0, 620, 1600, 280);
    c.fillStyle = '#1e5631'; rr(c, 420, 70, 760, 340, 10); c.fill(); for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(470, 110 + i * 48, 300 + r() * 300, 10); }
    T(c, '工程心理学', 800, 380, 30, '#fff', '700');
    for (let i = 0; i < 3; i++) { c.fillStyle = PAL[Math.floor(r() * 10)]; c.fillRect(80, 100 + i * 160, 220, 120); }
    c.fillStyle = ch ? '#7d3c98' : '#d4ac0d'; c.fillRect(1330, 140, 200, 260); T(c, '安全守则', 1430, 190, 26, '#fff', '700'); textLines(c, r, 1350, 230, 160, 5, 30, 'rgba(255,255,255,.8)');
    for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) { c.fillStyle = '#8d6e63'; c.fillRect(150 + i * 230, 520 + j * 120, 170, 18); person(c, 235 + i * 230, 520 + j * 120, 50, PAL[Math.floor(r() * 10)]); }
  },
  // ===== 困难（边缘兴趣 + 位置/小） =====
  plaza(c, ch) { // 商业广场：远处边缘一个小行人的位置改变
    const r = seededRandom('plaza');
    const g = c.createLinearGradient(0, 0, 0, 380); g.addColorStop(0, '#85c1e9'); g.addColorStop(1, '#d6eaf8'); c.fillStyle = g; c.fillRect(0, 0, 1600, 380);
    for (let i = 0; i < 14; i++) { const x = i * 118, h = 150 + r() * 200; c.fillStyle = PAL[Math.floor(r() * 10)]; c.globalAlpha = .55; c.fillRect(x, 380 - h, 110, h); c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.5)'; for (let w = 0; w < 5; w++) c.fillRect(x + 12, 390 - h + w * 34, 86, 14); }
    c.fillStyle = '#c9c2b2'; c.fillRect(0, 380, 1600, 520);
    c.strokeStyle = '#b3aa98'; for (let i = 0; i < 20; i++) { c.beginPath(); c.moveTo(800, 380); c.lineTo(i * 85 - 50, 900); c.stroke(); }
    c.fillStyle = '#5d6d7e'; c.beginPath(); c.ellipse(800, 640, 220, 70, 0, 0, 7); c.fill(); c.fillStyle = '#85c1e9'; c.beginPath(); c.ellipse(800, 630, 190, 55, 0, 0, 7); c.fill();
    for (let i = 0; i < 26; i++) { const y = 400 + r() * 480, s = 20 + (y - 380) / 8; person(c, 40 + r() * 1520, y, s, PAL[Math.floor(r() * 10)]); }
    person(c, ch ? 1470 : 1395, 430, 26, '#c0392b');
  },
  inbox(c, ch) { // 邮件收件箱：左侧边栏的一个小红点（未读标记）出现/消失
    const r = seededRandom('inbox');
    c.fillStyle = '#f4f6f8'; c.fillRect(0, 0, 1600, 900);
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1600, 70); T(c, '邮箱', 60, 35, 28, '#2471a3', '800', 'left'); c.fillStyle = '#eef1f5'; rr(c, 400, 18, 700, 36, 18); c.fill();
    c.fillStyle = '#eef2f7'; c.fillRect(0, 70, 280, 830);
    const folders = ['收件箱', '星标邮件', '已发送', '草稿箱', '订阅', '广告', '已删除', '归档', '工作', '课程'];
    folders.forEach((f, i) => { T(c, f, 40, 120 + i * 52, 20, '#34495e', '500', 'left'); T(c, String(Math.floor(r() * 30)), 240, 120 + i * 52, 16, '#7f8c8d', '500'); });
    if (!ch) { c.fillStyle = '#e74c3c'; c.beginPath(); c.arc(205, 432, 8, 0, 7); c.fill(); }
    for (let i = 0; i < 14; i++) { const y = 100 + i * 56; c.fillStyle = i % 2 ? '#fff' : '#fbfcfd'; c.fillRect(290, y, 1290, 52); c.fillStyle = PAL[Math.floor(r() * 10)]; c.beginPath(); c.arc(320, y + 26, 14, 0, 7); c.fill(); T(c, ['教务处', '图书馆', '王老师', '学院办公室', '课程助教', '学生会'][Math.floor(r() * 6)], 350, y + 26, 18, '#222', '600', 'left'); c.fillStyle = '#c9ced6'; c.fillRect(560, y + 20, 500 + r() * 400, 10); T(c, `${10 + Math.floor(r() * 12)}:${String(Math.floor(r() * 60)).padStart(2, '0')}`, 1540, y + 26, 16, '#888'); }
  },
  platform(c, ch) { // 地铁站台：右侧远处指示牌位置平移
    const r = seededRandom('platform');
    c.fillStyle = '#d0d3d4'; c.fillRect(0, 0, 1600, 900);
    c.fillStyle = '#566573'; c.beginPath(); c.moveTo(0, 520); c.lineTo(1600, 520); c.lineTo(1600, 900); c.lineTo(0, 900); c.fill();
    c.fillStyle = '#f4d03f'; c.fillRect(0, 520, 1600, 14);
    c.fillStyle = '#2e4053'; c.fillRect(0, 300, 1600, 220); for (let i = 0; i < 12; i++) { c.fillStyle = '#85c1e9'; c.fillRect(30 + i * 133, 330, 100, 110); }
    c.fillStyle = '#1a5276'; c.fillRect(0, 300, 1600, 20); T(c, '4 号线 → 安河桥北', 800, 270, 30, '#1a5276', '800');
    for (let i = 0; i < 6; i++) { c.fillStyle = '#7f8c8d'; c.fillRect(100 + i * 280, 60, 18, 240); }
    for (let i = 0; i < 18; i++) { const y = 560 + r() * 320; person(c, 40 + r() * 1520, y, 40 + (y - 520) / 6, PAL[Math.floor(r() * 10)]); }
    for (let i = 0; i < 4; i++) { c.fillStyle = '#17202a'; rr(c, 160 + i * 300, 100, 180, 50, 6); c.fill(); T(c, ['A 出口', 'B 出口', '换乘', '卫生间'][i], 250 + i * 300, 125, 22, '#fff', '600'); }
    c.fillStyle = '#1e8449'; rr(c, ch ? 1395 : 1305, 110, 150, 46, 6); c.fill(); T(c, 'C 出口 →', (ch ? 1395 : 1305) + 75, 133, 20, '#fff', '700');
  },
};
