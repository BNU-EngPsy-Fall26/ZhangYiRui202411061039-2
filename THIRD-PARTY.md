# 第三方组件声明

本仓库除 `vendor/` 下的第三方组件外，其余代码（实验流程、刺激绘制、结果汇总、打包脚本）均为本课程作业自行实现。

## WebGazer.js

- 文件：`vendor/webgazer/webgazer.js`
- 版权：Copyright (c) 2016, Brown WebGazer Team
- 许可：**GNU GPL v3**（上游声明：估值低于 100 万美元的团队可按 LGPLv3 使用）
- 许可证全文：`vendor/webgazer/LICENSE-GPL-3.0.txt`
- 来源：https://github.com/brownhci/WebGazer

本项目以未修改的原始文件形式分发该库，并按 GPLv3 要求提供完整许可证文本与本仓库源码（本仓库本身即为公开源码）。

## MediaPipe FaceMesh 模型与运行时

- 文件：`vendor/webgazer/mediapipe/face_mesh/*`
- 版权：Copyright 2020 The MediaPipe Authors
- 许可：**Apache License 2.0**
- 许可证全文：`vendor/webgazer/mediapipe/LICENSE-Apache-2.0.txt`
- 来源：https://github.com/google-ai-edge/mediapipe

## 说明

以上组件仅用于在浏览器本地估计注视位置；摄像头画面不离开本机，不上传任何视频或图像数据。
如不希望引入 GPL 组件，可把 `js/gaze/gaze_hub.js` 里的 `loadScript(asset('vendor/webgazer/webgazer.js'))`
改为从 CDN 加载（例如 `https://cdn.jsdelivr.net/npm/webgazer@3.5.3/dist/webgazer.min.js`），
这样仓库内不再分发 GPL 代码，代价是首次打开需要联网。
