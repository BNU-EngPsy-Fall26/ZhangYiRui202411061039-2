# 把眼动检测集成回 index.html：可行性分析与技术路线

> 结论先行：**技术上可行，但"单文件 + 双击即用 + 眼动"三者无法同时完美满足**。
> 推荐「单文件 + 本地小服务器引导」（路线 B）作为正式收数方案，「单文件 + CDN 运行时加载」（路线 A）作为演示/分享备用。
> 精度上，网页摄像头眼动（3–5°）**不足以定位困难档里 20–90 px 的变化区域**，只能当过程指标与质量控制，不能当主因变量。

---

## 1. 现有资产：恢复成本很低

| 资产 | 位置 | 说明 |
|---|---|---|
| 眼动封装 | `../js/gaze/`（上级项目） | `gaze_hub.js`（WebGazer 启动、采样、丢帧统计）、`calibration.js`（9 点校准 + 5 点验证）、`headpose.js` + `headpose_worker.js`、`one_euro.js`（滤波） |
| 模型 | `../vendor/`（55.7 MB） | WebGazer 实际只用 `webgazer.js` + `mediapipe/face_mesh/*`：simd wasm 5.9 MB + packed data 3.8 MB，运行时约 10 MB |
| 接口 | — | `hasCameraApi()` / `startWebGazer()` / `useMouse()` / `startRecording(stage)` / `stopRecording()` / `faceLoss()` / `hz()` |

上个版本"点了眼动却直接开始实验"，根因是**我写的降级逻辑**：`file://` 下 `await sleep(1600) → useMouse() → startAll()`。
WebGazer 本身没问题——这说明是工程问题，不是技术不可行。

---

## 2. 四条硬约束

| # | 约束 | 事实 | 对方案的影响 |
|---|---|---|---|
| 1 | **安全上下文** | `getUserMedia` 只在 https / localhost 稳定可用。Chrome 把 `file://` 当"可信来源"，但放不放行摄像头因版本、系统而异；Firefox、Safari 基本不放行 | 纯 `file://` 打开无法保证一定能开摄像头 |
| 2 | **模型资源加载** | MediaPipe FaceMesh 要 `fetch` `.wasm` / `.data`。`file://` 页面请求 `file://` 资源被拦（origin 为 `null`），只有加 `--allow-file-access-from-files` 才行 | **这就是上次必须在 http 下跑的直接原因**，也是"单文件"最大的坎 |
| 3 | **精度** | 1600 px 舞台在 60 cm 视距下约 39°，1° ≈ 41 px；WebGazer 典型误差 3–5° ≈ **120–200 px** | 困难档变化 bbox 只有 20–90 px → 眼动**定位不到**目标本身 |
| 4 | **数据通道** | `/api/hw2/submit` 只收平铺标量；30 Hz × 12 试次 × 30 s ≈ 万级采样 | ~~只能每试次聚合上传~~ → 已解决：轨迹压成 `gaze_path`（3 字符/点，每试次 ≤1000 字），每试次另加 `gaze_step` 抽稀步长；解码与注视点识别见 `js/lib/gazepath.js`，结果页展示见 `js/gazeviz.js` |

---

## 3. 四条技术路线

| 路线 | 真单文件 | 离线 | 首屏 | 主要风险 | 工作量 |
|---|---|---|---|---|---|
| **A. CDN 运行时加载** | ✅ | ❌ 需联网 | 10–30 s（~10 MB） | `file://` 相机是否放行；网络/CDN 可用性 | 中 |
| **B. 单文件 + 本地服务器引导** | ❌ 多一个 bat | ✅ | 3–8 s | 用户多点一次；需要 Python 或 Node | 小 |
| **C. wasm 全量内联 base64** | ✅ | ✅ | 15 s+（产物 15 MB+） | blob worker 兼容性、MediaPipe loader 改写、调试极难 | 大（1–2 天） |
| **D. 降级：只测头部/注视行为** | ✅ | ❌ | 快 | 精度不提升，只能做 QC | 小 |

### 路线 A：CDN 运行时加载（真·单文件，需联网）

- 我们自己的 gaze 代码（约 15 KB）内联进 `index.html`；WebGazer 运行时从 CDN 拉：
  ```js
  await loadScript('https://cdn.jsdelivr.net/npm/webgazer@3.3.0/dist/webgazer.min.js');
  wg.params.faceMeshSolutionPath = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619';
  ```
- **已实测**：jsDelivr 对 `webgazer.min.js` 和 `face_mesh_solution_simd_wasm_bin.wasm` 都返回 `access-control-allow-origin: *`，因此从 `file://`（origin `null`）可以取到——模型加载这一关能绕过。
- **未验证**：`file://` 下摄像头是否放行（必须真机测，见 §6）。
- 结论：技术与演示可用；正式收数不推荐（不能保证每个被试的网络与浏览器）。

### 路线 B：单文件 + 本地服务器引导（推荐）

- `index.html` 仍是单文件，双击就能做**无眼动**的实验；
- 页面检测 `location.protocol === 'file:'` 时，眼动按钮变成引导文案「双击 `启动眼动.bat`」；
- bat 起 `127.0.0.1:8765`（`python -m http.server` 或 30 行 node），用默认浏览器打开同一份 `index.html`；
- 模型可继续用本地 `vendor/`（完全离线），也可以走 CDN。
- 这是唯一能同时保证「相机可用 + wasm 可加载 + 离线 + 可复现」的组合。

### 路线 C：wasm 全量内联

- 把 `.js/.wasm/.data` base64 进 `index.html`（原始 ~10 MB → base64 后 ~13 MB，产物 15 MB+），运行时转 Blob URL，改写 MediaPipe loader 的 `locateFile` / `importScripts`。
- 坑：MediaPipe 在 worker 里 `importScripts(blob:…)` 在部分 Chrome 版本被拦；WebGazer 内部对 `faceMeshSolutionPath` 有路径假设；每次改代码都要重建巨文件。
- 只在「必须离线 + 必须单个 html 文件」时才值得。

### 路线 D：降级为「注视行为」指标

- 用 MediaPipe FaceLandmarker 只算头部朝向 + 虹膜相对偏移 + 眨眼，得到「是否在看屏幕 / 是否转头 / 丢脸率」。
- 精度不会更好，但更轻、更稳；适合当**数据质量指标**而不是因变量。

---

## 4. 推荐

- **正式收数：路线 B。** 眼动是可选层，默认关闭，开启后才有校准流程。
- **临时演示 / 发给同学试玩：路线 A。** 同一套 gaze 模块，只是把资源基址从 `vendor/` 换成 CDN。
- 两条路线可以共用一个开关：`GAZE.assetBase = CDN ? 'https://cdn.jsdelivr.net/...' : 'vendor/webgazer/'`。

---

## 5. 落地步骤（按路线 B 写，A 只是资源基址不同）

1. **恢复模块**：`../js/gaze/*` 拷回 `js/gaze/`；`build.mjs` 的 MODS 加回 `ONE_EURO / GAZE / CALIB / HEADPOSE`；`window.__hw2` 暴露出来供自检。
2. **路径参数化**：现有代码是硬编码 `/vendor/webgazer/...` 绝对路径，必须改成 `assetBase + 'webgazer.js'`、`faceMeshSolutionPath = assetBase + 'mediapipe/face_mesh'`。
3. **入口 UI**：登录页加「启用摄像头眼动（可选，推荐 Chrome）」开关，默认关；开启后走：知情同意 → 模型加载（显示已用秒数）→ 9 点校准 → 5 点验证（显示中位误差）→ 误差 > 120 px 提示重校准，允许跳过（跳过记 `eye=skipped`）。
4. **采集**：`oneTrial` 恢复 `startRecording/stopRecording`；实验阶段 `setTraining(false)`，避免鼠标移动污染回归模型；`showPreview(false)` 隐藏摄像头窗（避免遮挡刺激）。
5. **字段**：试次级 `gaze_n / gaze_x / gaze_y / gaze_lost`；会话级 `calib_err_px / hz / face_loss`；`meta.eye = 'webgazer' | 'none' | 'skipped'`。
6. **质量门**：`face_loss > 0.3` 或 `hz < 15` 的试次标 `gaze_qc = 0`；整段 `calib_err_px > 150` 的被试建议剔除（在 README 的分析说明里写明）。
7. **隐私**：视频不上传，只上传聚合值；知情同意里写清楚"画面只在浏览器本地处理"。
8. **自检**：新增 `test/eye_check.html`（`hasCameraApi`、模型可达、校准流程可走通）；浏览器流程仍用 `test/smoke.mjs`。

---

## 6. 上线前必须真机实测的 5 项

| # | 项目 | 目标 | 怎么测 |
|---|---|---|---|
| 1 | `file://` 下能否开摄像头 | 判断路线 A 是否可用 | 附录的 3 行页面，双击打开看控制台 |
| 2 | 首次加载到第一帧注视 | < 20 s | WebGazer 回调第一次拿到坐标计时间 |
| 3 | 校准后 5 点验证中位误差 | < 100 px | 现成 `calibration.js` 的 runValidation 已输出 |
| 4 | 30 s 连续采样的实际频率 | ≥ 20 Hz | `hub.hz()` |
| 5 | 戴眼镜 / 侧光 / 低照度下的丢脸率 | < 0.3 | `hub.faceLoss()` |

### 附录：3 行自测页（存成 `test/cam.html`，双击打开按 F12）

```html
<pre id="o"></pre>
<script>
  const o = document.getElementById('o');
  o.textContent = location.protocol + ' | secure=' + isSecureContext + ' | mediaDevices=' + !!navigator.mediaDevices + '\n';
  navigator.mediaDevices?.getUserMedia({ video: true })
    .then((s) => { const t = s.getVideoTracks()[0].getSettings(); o.textContent += 'OK ' + t.width + 'x' + t.height; s.getTracks().forEach((x) => x.stop()); })
    .catch((e) => { o.textContent += 'FAIL ' + e.name + ': ' + e.message; });
</script>
```

---

## 7. 工程心理学角度：眼动该拿来做什么

**可以做**（误差 120–200 px 撑得住的分析）：

- 箭头有效试次里，**首次注视落在变化的半屏方向**（左/右、上/下）是否更准——这是线索效应的过程证据；
- 觉察前 1 s 的注视是否进入变化 bbox ± 200 px 的邻域（**粗略**的"看过去了吗"）；
- 丢脸率 / 注视分散度与觉察率的关系（"是不是根本没看屏幕"）。

**不要做**：

- 用眼动坐标直接判定"有没有看到变化"——误差比目标还大，会系统性低估；
- 把 gaze RT 当唯一反应时（WebGazer 有 100–200 ms 延迟与滤波滞后）。

因此建议：主分析仍用按键 RT 与定位正确率，眼动作为**探索性指标**，并在报告里明确标注精度限制。

---

## 8. 工作量

| 路线 | 预计 | 风险 |
|---|---|---|
| B（推荐） | 4–6 小时 | 低：恢复代码 + 路径参数化 + UI + 自检 |
| A（CDN） | 再加 2–3 小时 | 中：`file://` 相机、网络、浏览器差异 |
| C（全内联） | 1–2 天 | 高：blob worker 兼容性 |
