# P0 — WebGPU-first 线性灰盒垂直切片

独立于主工程的浏览器原型，验证《泥泞前线》战役管线：

- Vite + TypeScript ES Modules
- three.js r185 `WebGPURenderer`，WebGL2 自动回退
- 全新线性地图「黑森林河谷」灰盒（不复用现有地图）
- 第一人称移动、目标链、检查点标记
- 引擎内实时过场 Sequencer（开场 + 收尾）
- 程序化环境音频：雨、风、雷、脚步，全部 Web Audio 实时合成
- P0 关卡几何全部为程序化生成，启动零外部模型请求
- `public/models/supply_crate.glb` 与 `scripts/make-crate-glb.mjs` 保留为后续 glTF 管线样例，不参与 P0 启动

## 运行

```powershell
cd proto/p0
npm run dev
```

## 构建与预览

```powershell
npm run build
npm run preview
```

## 冒烟测试

先启动 `npm run preview`，再另开终端：

```powershell
npm run smoke
```

当前结果（headless Chrome，D3D11）：

- WebGPU：约 58fps @ 1280×720
- WebGL2 回退：约 59fps @ 1280×720
- 启动路径：纯程序化几何，无外部模型请求

## 验收脚本

`npm run typecheck` 以及主工程的 Puppeteer 冒烟脚本。
