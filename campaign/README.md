# Campaign — WebGPU-first 战役入口（迁移阶段 1）

《泥泞前线》战役前端，正在迁入主工程统一构建体系：

- Vite + TypeScript ES Modules
- three.js r185 `WebGPURenderer`，WebGL2 自动回退
- 全新线性地图「黑森林河谷」（不复用现有地图）
- 第一人称移动、目标链、检查点标记
- 引擎内实时过场 Sequencer（开场 + 收尾）
- 程序化环境音频：雨、风、雷、脚步，全部 Web Audio 实时合成
- 战役规则：双武器槽、F 换枪、敌人掉落、弹药补给、Q/G 投掷物
- 调试模式：F2 点选、滚轮调高、G 贴地、L 输出日志

## 运行

```powershell
cd campaign
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

## 验收脚本

`npm run typecheck` 以及主工程的 Puppeteer 冒烟脚本。
