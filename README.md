# GPT-6 Astra · One Shot 游戏测试

两次 One Shot，测试 Astra 的游戏设计与实现能力。保留原始 Prompt 和 HTML 产物，方便体验与 Fork。

## 01 · 瓜体实验室

半流体西瓜游戏，测试物理性质、形变与合成玩法。
[项目来源](https://github.com/Ayi1337/gpt6-astra-one-shot-games/tree/main)

```text
用最短的时间设计一款全新概念（物理性质）的半流体西瓜游戏（html游戏）
```

## 02 · Mosswing

最初版本是移动端 3D 单键飞行游戏；当前 `v1.0.1` 同时保留原飞行玩法，并新增完整的回合制模式“浮岛造境”。

“浮岛造境”以12天为一局：玩家选择心芽和4种植物，在5×5棋盘中规划资源、开花与授粉连锁，同时处理天气和污染。首版包含四步教学、8种植物、3种心芽、祝福/突变、图鉴、固定解锁和本地存档。

```text
Remaster the classic "tap-to-flap" game — the one where you tap to keep a small creature airborne while gliding through an endless series of gaps — as a 3D game playable in a mobile browser. One index.html, opens and plays instantly, no external assets (CDN libraries are allowed; your call).  Keep the core exactly as everyone remembers it: one-tap control, gravity, gaps that scroll toward you, one hit and you're done, score is gaps passed. Everything else is yours to decide: what the creature is, what the obstacles are, the world, the camera, the feel of the flap, how far to take the visuals. Design an original character and style rather than copying the original's art. I won't answer clarifying questions.  I'm judging a complete, elegant, great-feeling piece of work — not a feature list. Small and finished beats big and rough.
```

## 运行

下载对应 HTML，用现代浏览器直接打开即可，无需安装依赖或构建。

- Mosswing 成品：`mosswing/mosswing.html`
- 重新构建：`python3 mosswing/src/build.py`
- 花园规则与平衡回归：`node mosswing/src/garden-check.cjs`
- 原飞行回归：`node mosswing/src/check.cjs`
- 完整执行与验收记录：`mosswing/src/design/mode-floating-garden-execution.md`
- “织风巡游”2.0改造执行基线：`mosswing/src/design/mode-floating-garden-v2-execution.md`
