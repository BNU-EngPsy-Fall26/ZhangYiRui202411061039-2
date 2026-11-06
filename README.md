# 注意与空间认知实验（作业二）

基于课堂 Attention Lab 的两个实验重写并改进。**所有界面、绘制与流程代码为本项目自行实现**，只沿用课堂范式的实验逻辑与参数（闪烁 240 ms、YAH 的 9 s 时限等）。

- 实验一：闪烁找不同（Rensink, O'Regan & Clark, 1997）+ **方向箭头线索（无箭头 / 指向正确 / 指向相反，三水平）**
- 实验二：「你在这里」地图（Aretz, 1991；教材 Ch5 FORT）+ **朝向提示（红色视锥）**

## 运行

**直接双击 `index.html` 即可做完整实验**（单文件版，HTML + CSS + JS 全部内联）。

**要用摄像头眼动，必须通过 https 或 localhost 打开**——浏览器只在安全上下文里放行 `getUserMedia`，且 `file://` 页面无法读取同目录的 wasm 模型。两种方式：

- 在线：部署到 GitHub Pages（见下），用 `https://<用户名>.github.io/AttentionExperiment/` 打开；
- 本地：在项目目录跑任意静态服务器，例如 `python -m http.server 8765`，再打开 `http://127.0.0.1:8765/index.html`。

被试流程：填被试编号 →（可选）开启摄像头眼动并做 9 点校准 → 实验一 → 实验二 → 「实验结束，感谢参与」→（可选）「查看分析报告」。

结束后有三个查看结果的地方，都需要联网读服务器数据，也可以不跑实验直接打开：

| 页面 | 地址 | 内容 |
| --- | --- | --- |
| **图表报告** | `index.html#/report`（或 `report.html`） | 六张 SVG 图 + 自动结论摘要，写作业直接用这个 |
| 数值明细 | `index.html#/analysis` | 表格为主：效应量、原文对比、改进条件检验 |
| 全班汇总 | `index.html#/results`（或 `results.html`） | 所有记录逐条列出 |

报告页默认把**后端最后一条记录**当作「当前被试」（当前 `participant` 会在页头标出），这样不跑实验也能预览。

### 部署到 GitHub Pages

仓库根目录就是站点根目录，`index.html` 在根上，所以只需开启 Pages 即可：

1. 打开仓库 `Settings → Pages`；
2. **Source** 选 `Deploy from a branch`，**Branch** 选 `main`，目录选 `/ (root)`，保存；
3. 等 1 分钟左右（Actions 里会跑一次 `pages build and deployment`）；
4. 访问 `https://<用户名>.github.io/AttentionExperiment/`。

仓库里的 `.nojekyll` 会让 Pages 跳过 Jekyll 处理，直接按静态文件发布（否则以 `_` 开头的文件会被忽略）。
Pages 会把 `.wasm` 以 `application/wasm` 返回，模型可以直接加载；但 GitHub Pages 单文件上限 100 MB、仓库建议 1 GB 以内，所以 `vendor/` 只放了眼动实际需要的 18 MB。
部署完先打开 `https://<用户名>.github.io/AttentionExperiment/test/eye-check.html` 做一次环境自检（见下）。

### 改代码后重新构建

`index.html` 是构建产物，源文件仍是 `js/` 下的 ES Module 与 `css/lab.css`：

```bash
node build.mjs        # 重新生成 index.html
```

`src/shell.html` 是单文件版的页面骨架（放置 `{{LAB_CSS}}` / `{{RESULTS}}` / `{{JS}}` 三个占位符），
`build.mjs` 负责把模块转成 IIFE、内联 CSS，并从 `results.html` 抽取结果视图内容。
注意：`index.html` 只内联**代码**，`vendor/` 里的模型资源始终是外部文件，所以**不能只拷 index.html**，要连 `vendor/` 一起。

## 眼动（可选层）

沿用课堂原项目的做法：自托管 WebGazer.js + MediaPipe FaceMesh，9 点校准 + 5 点验证，模型完全不经过第三方服务器。

| 项目 | 内容 |
|---|---|
| 组件 | `js/gaze/gaze_hub.js`（启动、15 Hz 采样、One-Euro 滤波、丢帧统计）、`js/gaze/calibration.js`（9 点校准 + 5 点验证）、`js/gaze/one_euro.js` |
| 模型 | `vendor/webgazer/webgazer.js` + `vendor/webgazer/mediapipe/face_mesh/*`（simd / 非 simd 两套 wasm，共约 18 MB） |
| 资源定位 | 用 `new URL('vendor/…', document.baseURI)` 解析，因此在 Pages 的 `/AttentionExperiment/` 子路径下也能正确加载 |
| 资产预检 | 启动前对下面 5 个必需文件逐个 HEAD 探测；本地缺文件会自动回退到 jsDelivr 上的同名同版本 CDN，并把缺失清单写进报错 |
| 校准 | 9 个点、每点点 5 次（共 45 次点击训练 ridge 回归），随后 5 点验证；平均误差 > 200 px 会提示重校准 |
| 记录 | 每试次 15 Hz 采样 → 上传 `gaze_n / gaze_x / gaze_y / gaze_lost / gaze_qc`；会话级 `calib_err_px / low_quality` |
| 剔除标准 | `gaze_qc = 0` 表示该试次人脸丢失 > 35% 或有效采样 < 10 Hz，分析时建议剔除 |
| 兜底 | 拒绝摄像头 / 模型加载失败 / 放弃校准 → 直接做无眼动版本，流程不中断 |

**`mediapipe/face_mesh/` 目录必须同时存在这 5 个文件**，少一个都会让 FaceMesh 初始化失败：

```
face_mesh.binarypb                             939 B      ← 计算图，最容易漏
face_mesh_solution_packed_assets_loader.js     9126 B
face_mesh_solution_packed_assets.data          3986256 B
face_mesh_solution_simd_wasm_bin.js            330187 B
face_mesh_solution_simd_wasm_bin.wasm          6161697 B
```

漏掉 `face_mesh.binarypb` 时，浏览器只会抛一句 `abort(undefined) ... at SolutionWasm$loadGraph`，
报错全在 wasm 内部函数里，看不出任何原因——**遇到这个报错先回来核对这 5 个文件**。
（这 5 个文件同属 `@mediapipe/face_mesh@0.4.1633559619`，可从 `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/` 取。）

**精度提醒**：网页摄像头眼动典型误差 3–5°，1600 px 舞台下约 120–200 px，**不能**用来判定"是否看到了 20–90 px 的变化"。
只建议做粗粒度分析：首次注视落在变化的半屏方向、觉察前 1 s 注视是否进入 bbox ±200 px、丢脸率与觉察率的关系。

> 未包含原项目的 MediaPipe 头部姿态层（`tasks-vision` + `face_landmarker.task`，额外约 24 MB）。需要的话把 `vendor/mediapipe/` 整个拷进来，并恢复 `js/gaze/headpose*.js` 即可。

### 眼动环境自检

部署后或换机器时，先打开 `test/eye-check.html`（在线为 `/AttentionExperiment/test/eye-check.html`），依次点四个按钮：

1. **检查运行环境** —— 必须是「安全上下文 = 是」；
2. **检查模型文件** —— 7 个文件都要 200 且体积对得上；
3. **打开摄像头** —— 出现画面即权限正常；
4. **加载 WebGazer** —— 打印出 webgazer 对象即脚本可用。

## 实验一设计

| 项目 | 内容 |
|---|---|
| 范式 | 闪烁范式（原图 240 ms ↔ 灰屏 160 ms ↔ 改图 240 ms ↔ 灰屏 160 ms），单张限时 30 s |
| 场景 | **单一场景**：程序化「商业广场」（14 栋楼 + 26 个行人 + 中央喷泉）。基础布局由种子固定，**每试次逐像素相同** |
| 变化 | 广场上**多出一个行人**（presence 变化）。它的位置逐试次变化：8×7 抖动网格取最近的安全点，避开喷泉与既有行人，保证 36 个试次的位置分散、互不重叠 |
| 难度参数 | 困难档：灰屏 160 ms、对比度 70%（沿用原项目 `levels.hard`） |
| 试次 | 3 线索条件 × 12 = **36**，条件配额固定、顺序随机 | 
| **改进** | 闪烁前 900 ms 出现指向变化方位的金色箭头，三水平：**无箭头（基线）/ 指向正确 / 指向相反**，各 12 试次。无箭头试次同样呈现 900 ms 注视屏，只显示中央注视点，保证各条件时序一致 |
| 反应 | 觉察后按空格报时，再用鼠标点击多出来的那个人（判定框 = 行人包围盒 ±32 px） |
| 数据 | `cue_type`(0/1/2)、`cue_valid`、`cue_deg`、`ex/ey/ecc`（变化点坐标与离中心距离）、`resp_ms`、`timeout`、`click_ok`、`click_x/y`；启用眼动时另有 `gaze_n / gaze_x / gaze_y / gaze_lost / gaze_qc` |
| 项目码 | `CA7JK4`（experiment = `changeblind_cue_arrow`） |

> **为什么从 6 场景改成 1 场景**：原设计 6 个场景 × 2 轮 = 12 试次，每个场景只有 2 次，
> 场景间的难度差异与试次内噪声完全混在一起，任何条件效应都无法从场景差异里分离出来。
> 改成单场景 + 变化位置随机后，36 个试次共享同一底板，差异只来自「变化在哪」，试次之间才可比。
>
> **为什么从 2 水平改成 3 水平**：原来只有「指向正确 / 指向相反」，能说明「指对了有没有用」，
> 说明不了「加箭头有没有用」——缺少无箭头基线。三水平同时解决「每条件 ≥10 试次」和「缺基线」两个问题。

**收数前写下的预测**

1. **指向正确** 的觉察时间应短于 **无箭头基线**（线索把注意预先导向正确方位，注意增益）；
2. **指向相反** 应慢于基线——错误定向需要额外的注意转移，这是重新定向的代价；
3. 线索收益的大小应随变化点偏心度（`ecc`）增大而增大：变化越靠外周，方向提示越有用；
4. 若三条件无差异，说明方向信息在长时程的闪烁搜索中作用有限（搜索是串行的，线索收益被 30 s 上限与场景记忆稀释）。

## 实验二设计

| 项目 | 内容 |
|---|---|
| 范式 | 左侧第一人称景象（你正面朝某栋楼）+ 右侧壁挂导览图（红点＝你在这里） |
| 自变量 | 2（朝向提示：无 / 红色半透明视锥）× 3（地图旋转 0° / 90° / 180°），被试内 |
| 试次 | 6 格 × 8 = 48，格内四个方向各 2 次；练习 2 次不计入 |
| **改进** | 有提示条件在地图上画出「你面朝」的扇形视锥，把朝向外部化，理论上免除心理旋转 |
| 反应 | 方向键（↑前 ↓后 ←左 →右），单次限时 9 s |
| 数据 | 提示条件、旋转角、正确答案、实际按键、是否答对、是否属「地图上方＝前方」的系统性错误、RT |
| 项目码 | `3AQE6F`（experiment = `yah_heading_cue`） |

**收数前写下的预测**

1. 无提示条件下复现对齐效应：RT 与错误率随旋转角增大（0° < 90° < 180°）；
2. 有提示条件下旋转效应显著减小——若「旋转成本」解释成立，外部化朝向后应几乎无差异；
3. 错误模式改变：无提示的错误更多落在「把地图上方当正前方」，有提示后趋于随机。第 3 条用于区分「心理旋转成本」与「参照系选择错误」两种解释。

## 文件结构

```
hw2-lab/
├── index.html            ★ 构建产物：单文件版（实验 + 分析，双击即用）
├── build.mjs             打包脚本：模块 → IIFE、内联 CSS、抽取结果视图
├── src/shell.html        单文件版的页面骨架（三个占位符）
├── results.html          独立结果页（也可用 index.html#/results）
├── report.html           图表报告页入口（跳转到 index.html#/report）
├── .nojekyll             GitHub Pages 跳过 Jekyll
├── css/lab.css           沿用课堂实验的视觉样式
├── js/app.js             主流程、知情同意、校准、上传、弹窗
├── js/stage.js           1600×900 逻辑坐标的全屏实验舞台
├── js/gaze/              眼动：gaze_hub（WebGazer 封装）、calibration（9 点校准）、one_euro（滤波）
├── js/exp/cb_cued.js     实验一（改进版，困难档素材，记录注视汇总）
├── js/exp/yah_cued.js    实验二（改进版）
├── js/exp/scenes.js      场景绘制（课堂程序的绘图函数）
├── js/exp/w6_common.js   焦点守卫、HUD、按键等待等共用工具
├── js/results.js         全班汇总页逻辑
├── js/analysis.js        数值明细页：效应量 / 原文对比 / 改进条件检验 / 我 vs 全体
├── js/report.js          图表报告页：六张 SVG 图 + 结论摘要（index.html#/report）
├── js/lib/stats.js       统计：均值/SD/中位数/分位数 + Welch t + 配对 t + Cohen d/dz
├── js/lib/chart.js       零依赖 SVG 图表：柱状 / 分组柱状 / 散点条 / 效应量条 / 百分位条
├── js/lib/upload.js      上传 / 读取 / CSV 备份 / gazeSummary
├── vendor/webgazer/      WebGazer.js + MediaPipe FaceMesh（自托管，约 18 MB）
├── docs/                 眼动集成的可行性分析
└── test/                 自检脚本与眼动环境自检页
```

## 自检

```bash
node build.mjs          # 先构建
node test/check.mjs     # 设计校验：试次平衡 / 线索配额 / 系统性错误判定
node test/trials.mjs    # 实验一试次生成：36 试次 / 三条件各 12 / 位置分散且不重叠
node test/analysis.mjs  # 分析页渲染冒烟：假 DOM + 假服务器，检查无 NaN/undefined
node test/report.mjs    # 报告页渲染：六张图齐全 / 去重 / 清洗口径 / p 值格式
node test/static.mjs    # 构建产物静态检查：脚本可解析、关键符号在、模型文件齐全
node test/smoke.mjs     # 需要能跑无头 Chrome/Edge：25 项结构与模块断言 + 5 项流程断言
# 浏览器打开（需 https 或 localhost）：
#   /test/eye-check.html           眼动环境自检（安全上下文 / 模型 / 摄像头 / WebGazer）
#   /test/harness.html?mode=draw   渲染关键画面（CB 场景、YAH 有无提示对照）
#   /test/harness.html?mode=flow   自动作答跑完实验一，检查 12 条记录字段
#   /test/harness.html?mode=yah    自动作答跑完实验二，检查 48 条记录与 6 格平衡
```

`test/check_report.txt` 与 `test/shot_*.png` 是自检输出，可保留作为开发证据。`package.json` 只为让 Node 以 ESM 解析测试脚本，不影响静态部署。

## 已知限制

- 实验一只有 1 个场景，学习效应表现为同一底板越来越熟（位置不重复，但画面重复），36 试次后段可能整体变快；分析时可按 `i<=12 / 13-24 / >24` 分三段检验时间趋势。
- 变化物体（行人）同质、底板细节少，觉察时间比 Rensink et al. (1997) 的照片场景快一个量级，**只能比方向不能比绝对值**。
- 30 s 上限下仍可能漏检，分析时用「觉察率」而不是只看 RT。
- 每名被试只有 3 个「箭头指反」试次，单被试层面检验力有限，结论应以全班合并为准。
- 眼动是**可选层**：`file://` 下无法启用（安全上下文 + 本地 wasm 双限制），要用就走 https / localhost；不启用则只记录按键、点击与反应时。
- 眼动精度约 3–5°（120–200 px），只用于粗粒度分析与质量控制，**不能**作为判定"是否看到变化"的依据。
- 实验二不记录眼动（48 试次 × 9 s 的注视数据对本作业的方位判断问题贡献有限，且会显著拉长单次时长）。

## 数据上传

```js
POST https://attention-lab-production.up.railway.app/api/hw2/submit
{ project, experiment, participant, condition, trials, meta }
```

上传失败（离线/断网）时自动下载同内容 CSV 作为兜底，流程不会中断。

## AI 使用说明

本项目的实验流程控制、Canvas 刺激绘制中的箭头/视锥、数据上传与结果页汇总代码在 AI 辅助下完成；实验范式的参数与文献依据来自课程材料与原始论文，预测在收数前确定，未根据数据修改。
