# 迁移完成状态 — P0 → 主工程

版本：v1.0
基线：`23ce27d chore: baseline before campaign migration to main`
完成提交线：`edd6190`（共享移动数据）→ 本次收尾提交（战役战斗/视模/任务/统一入口）

## 结论

旧死斗模式与战役模式现在共用一个主入口、共用一套共享数据，并已通过同一套
自动验收：

```text
npm run typecheck        ✅ legacy + campaign
npm run build            ✅ dist/js/game.js + dist/campaign
bun scripts/smoke.mjs    ✅ SMOKE OK（旧死斗全量回归）
node campaign/scripts/smoke.mjs  ✅ WebGPU 战役全量冒烟
bun scripts/check-migration.mjs  ✅ 20/20
```

## 阶段验收

### 阶段 1 — 构建系统共存 ✅

- 根目录保留 legacy `tsc` 单文件构建。
- `campaign/` 使用 Vite + TypeScript 独立构建。
- `npm run build` 一个命令完成双构建。

### 阶段 2 — 渲染器共存 ✅

- 战役入口 WebGPU-first，WebGL2 回退。
- 旧死斗 WebGL2 渲染器零改动。
- 两套产物分别位于 `dist/` 与 `dist/campaign/`，互不冲突。

### 阶段 3 — 共享数据层 ✅

- `shared/weapons.json`：战役直接 import；legacy 由
  `scripts/build.mjs` 生成 `src/generated-weapons.ts`。
- `shared/movement.json`：战役直接 import；legacy 生成
  `src/generated-movement.ts`。
- `shared/missions.json`、`shared/loadout.json`、
  `shared/audio-params.json`：战役规则、地图、天气与音频共用。
- 修改任一 JSON，legacy 与 campaign 两侧表现同步变化。

### 阶段 4 — 战役系统迁入 ✅

- 双主武器槽，F 替换当前槽，数字键切换。
- 敌人掉落弹药/武器，补给点自动补弹并恢复投掷物。
- Q/G 投掷物上限 3，初始 1/1。
- 无连杀奖励 HUD。
- 生命 HUD、弹药 HUD、目标 HUD 均为中文。
- 调试模式（F2/G/L/滚轮）保留。

### 阶段 5 — 单人系统复用 ✅

- 移动：走/疾跑/蹲/卧、跳跃边沿触发、二段跳、ADS 减速均与主工程同源。
- 视模：从主工程 `15/16-*` 自动生成 `campaign/src/generated-viewmodels.ts`，
  建模、枪口位置、ADS 对齐全部来自主工程，并接入 ADS、换弹、切枪、后坐动画。
- 敌人 rig：`campaign/src/soldier.ts` 为主工程 `18-enemies.ts` 的程序化移植；
  30 名敌人共享模板几何/材质，远距离裁剪，禁止穿入关卡障碍。
- AI：巡逻、发现反应、横向拉扯、保持距离、视线遮挡检查、增援波次。
- 音频：战役保留程序化雨/风/雷/脚步/枪声，并新增换弹、切枪、跳跃、敌人倒地音效。

### 阶段 6 — 第一关「鹰落」集成 ✅

- 全新黑森林河谷线性地图（1.8–2.4 公里），不可复用现有 yard/nuke。
- 9 步目标链：苏醒 → 小队装备 → 旧伐木道 → 坠机点 → 解救 VEGA →
  河谷突围 → 油料场爆破 → 公路桥登车 → 撤离 CG。
- 开局配发：M4（红点 + 扩容 + 消音 + 垂直握把）与消音手枪。
- 26–34 名敌人（当前 30 名 + 2 个脚本增援波次）。
- 4 个武器拾取点、5 个弹药补给点，全部来自 `shared/missions.json`。
- 开场/收尾 CG 均为引擎内实时渲染。
- 雨、水洼、镜头水滴、风、闪电全部沿用共享天气数据。

### 阶段 7 — 总验收与切换 ✅

- 主菜单「04 // CAMPAIGN」为共享入口，可进入「鹰落」。
- 战役 HUD 提供「返回主菜单」链接。
- 旧死斗全量冒烟通过，战役全量冒烟通过。
- 无 P0 重复数值：武器、移动、任务、天气数据只有 `shared/` 一份。

### 阶段 8 — 第一关「鹰落」3A 打磨 ✅

- 开场运镜重做为 10 秒低空穿林 + 俯冲 + 翻滚 + 落地，终帧与玩家出生姿态无缝衔接。
- 出生段新增一次性教学提示：移动 / 蹲伏卧倒 / 换弹 / 投掷物，夜视教学沿用无线电。
- VEGA 解救后成为随行伤员，紧跟玩家；附近有交火敌军时会受伤，死亡触发当前检查点重开。
- 油料场爆破现在有真实爆炸：火球、浓烟、火星、燃油火光、镜头震动，并延阻 APC 推进速度。
- 河谷 B 雷击改道现在有爆炸与燃烧光源，并保留路线障碍。
- 公路桥新增可登车的撤离卡车（头灯、尾灯、蓝色信标），必须按 F 登车才进入收尾 CG。
- 玩家与敌军枪口火焰加入动态点光源；手雷爆炸统一使用浓烟 + 火星系统。
- 新增全屏电影级调色层：暗角、冷夜色调、胶片颗粒；夜视仪增加扫描线与暗角。
