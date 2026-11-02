# ZapTrace v2 · Quiet Cards 视觉改版与题库信息架构（DESIGN）

> 版本：v2.0 · 2026-11-02
> 依据：《插件 UI 设计规范 · Quiet Cards》（`C:\Users\10784\Desktop\pluginDesign.md`，v1.0）全文 + 参考图 2/3 + 现有 ZapTrace 源码实测。
> 关系：本文**取代** `DESIGN.md` 的 §10 视觉规范与 §2 三栏布局；`DESIGN.md` 的解析、ID、data.json、四档评分、H1–H4 行为契约**全部继续有效**。
> 边界：**只改视觉与题库信息架构**；**不新增任何数据字段**，不动解析 / ID / data.json 逻辑，不做 PDF 导入 / AI / 批注。

---

## 0. 一页结论

| 项 | 改前（现网，见附件图 1 / 图 4） | 改后（Quiet Cards，参考图 2 / 3） |
| --- | --- | --- |
| 题卡外观 | 大框 + 答案/笔记各一个大描边盒 + 两个描边按钮 + 孤立方块收藏图标 | **单层 1px 边**；答案/笔记/AI 笔记改 **38px 无内框折叠行**；文本按钮；收藏进 `⋯` 菜单 |
| 布局 | 固定三栏（练习 / 题集 / 复习），中栏是筛选条 + 竖列表 | **单页「题库」**：页头（题库 + 计数 + 搜索 + 主 CTA）→ 状态 chips（带计数）→ 筛选 → 分段视图（**题卡流 / 紧凑表格 / 独立复习**）→ **响应式双列题卡网格** |
| 练习 | 左栏常驻 | 点卡片/CTA 后进入**右侧练习抽屉**（窄屏变全屏 sheet），保留现有 `viewing → revealed → rated` |
| 复习 | 右栏常驻 | 「独立复习」视图（第三种分段）保留今日到期分组 + 时间记录 + 按科目组卷 |
| 技术 | `--zt-*` + `zt-*` 类 | 新增 `--pd-*` + `pd-*` 组件类；`zt-*` 只保留为**行为钩子**（dual-class 过渡） |

三条铁律（沿用 Quiet Cards）：

1. **一张卡片只有一层边。**
2. **层级用字重和留白做，不用框。**
3. **颜色只表示状态，不表示装饰。**

> 注：图 2 的参考应用是「行测选择题」形态（有 A–D 选项、作答状态、错因筛选）。ZapTrace 的数据模型是「题干 + 答案 + 笔记」的自由题卡，**没有选项/错因字段**。本文只借它的**信息架构与视觉语言**，不照搬选项渲染；状态计数全部由现有字段派生（附录 A），**不新增字段**。

---

## 1. 设计原则（Quiet Cards）

1. **一层表面，一条边。** 卡片最多 1px 发丝线；展开区、折叠行、按钮、内嵌块一律无边框。
2. **字重与留白分层。** 标题 600 / 控件 500 / 正文 400；用间距而非底色分层。
3. **控件是文字，不是盒子。** 次级操作是 13px 文本按钮，hover 出 6% 前景底；主操作配 `accent-soft` 底，仍无边框。
4. **颜色只表示状态。** accent = 当前/主操作/聚焦；green = 已掌握/成功；amber = 待复习/收藏；red = 错误/删除。标题与标签用中性色。
5. **圆点是唯一的装饰。** 圆点只属于正文（`.pd-body` 的列表），6px + 18px 圆盘；UI 列表/菜单/设置里没有圆点。
6. **动作在需要时出现。** `⋯` 默认隐形，卡片 hover / `focus-within` 才出现；静止界面只有内容。

---

## 2. 设计令牌（`--pd-*`）

> 作用域：`.pd-root`。**不复用** `--mubu-*`；只有在继承圆点颜色时用 `var(--mubu-bullet, var(--pd-muted))` 回退。

### 2.1 颜色 · 暗色（默认）

| Token | 值 | 用途 |
| --- | --- | --- |
| `--pd-bg` | `#1a1a1e` | 页面底色（**不是纯黑**） |
| `--pd-surface` | `#232327` | 卡片 / 抽屉底 |
| `--pd-surface-2` | `#1f1f23` | 展开区 / 内嵌块 / 表格 hover |
| `--pd-surface-3` | `#2d2d33` | 控件底 / 标签底 / 搜索框 |
| `--pd-surface-hover` | `#36363d` | 控件 hover |
| `--pd-line` | `#333339` | 卡片唯一一条边 |
| `--pd-line-2` | `#2c2c32` | 卡内分隔线 |
| `--pd-line-hover` | `#3d3d45` | 卡片 hover 边 |
| `--pd-fg` | `#ededf1` | 主文字 |
| `--pd-fg-2` | `#b9b9c1` | 次级文字 / 折叠行标题 |
| `--pd-muted` | `#8b8b94` | 元信息 / 占位 / 图标 |
| `--pd-faint` | `#56565f` | 最弱提示 / 计数 |
| `--pd-accent` | `#a5b4fc` | 主操作文字 / 当前状态 |
| `--pd-accent-soft` | `#2b2c47` | 主操作底 / 学科 chip 底 / 选中状态 chip 底 |
| `--pd-accent-fg` | `#14142a` | accent 实心底上的文字 |
| `--pd-sel` | `#33345a` | 列表/表格选中行 |
| `--pd-green` | `#6fd99b` | 已掌握 / 成功 |
| `--pd-green-soft` | `#1e3a2b` | 成功 chip 底 |
| `--pd-amber` | `#f2b544` | 待复习 / 收藏 / 警告 |
| `--pd-amber-soft` | `#3f3220` | 警告 chip 底 |
| `--pd-red` | `#f28b82` | 删除 / 错误 / 需完善 |
| `--pd-red-soft` | `#45272a` | 危险 chip 底 |
| `--pd-pop` | `rgba(38,38,43,.96)` | 弹出菜单底 |
| `--pd-shadow` | `0 16px 44px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.3), 0 0 0 .5px rgba(255,255,255,.1)` | **仅弹层** |

### 2.2 颜色 · 亮色

| Token | 值 |
| --- | --- |
| `--pd-bg` | `#f4f4f6` |
| `--pd-surface` | `#ffffff` |
| `--pd-surface-2` | `#f9f9fb` |
| `--pd-surface-3` | `#f1f1f4` |
| `--pd-surface-hover` | `#e9e9ee` |
| `--pd-line` | `#e3e3e8` |
| `--pd-line-2` | `#ececf0` |
| `--pd-line-hover` | `#d6d6dd` |
| `--pd-fg` | `#1c1c21` |
| `--pd-fg-2` | `#4b4b53` |
| `--pd-muted` | `#85858d` |
| `--pd-faint` | `#b9b9c2` |
| `--pd-accent` | `#4f46e5` |
| `--pd-accent-soft` | `#eeedfd` |
| `--pd-accent-fg` | `#ffffff` |
| `--pd-sel` | `#ecebfb` |
| `--pd-green` | `#189a58` |
| `--pd-green-soft` | `#e4f6ec` |
| `--pd-amber` | `#b45309` |
| `--pd-amber-soft` | `#fbf0df` |
| `--pd-red` | `#d64545` |
| `--pd-red-soft` | `#fbe9e9` |
| `--pd-pop` | `rgba(255,255,255,.94)` |
| `--pd-shadow` | `0 16px 44px rgba(20,22,30,.16), 0 2px 8px rgba(20,22,30,.06), 0 0 0 .5px rgba(20,22,30,.1)` |

> 暗色页面用 `#1a1a1e`（比纯黑高 2–3 个明度点），卡片 `#232327` 才有浮起感；亮色页面用 `#f4f4f6` 而非纯白。

### 2.3 字体与**三档字号**

| Token | 值 | 说明 |
| --- | --- | --- |
| `--pd-font` | `"Mubu Sans", "Source Sans Pro", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif` | 幕布字体栈，正文与 UI 共用 |
| `--pd-body` | `16px` | 正文 / 题干 |
| `--pd-body-lh` | `2.1` | 幕布正文行距 |
| `--pd-ui` | `13px` | 按钮 / 菜单 / 标签 / 控件 |
| `--pd-ui-lh` | `1.45` | UI 行距（**不要用 2.1**） |
| `--pd-meta` | `11.5px` | 出处 / 计数 / 分组标题 |
| `--pd-title` | `28px / 1.3 / 600` | 页面标题（题库） |
| `--pd-h2` | `17px / 1.4 / 600` | 卡片标题 / 分组标题 |
| `--pd-card-title` | `20px / 1.4 / 600` | 笔记标题 |

**只用三档：**

| 档 | 字号 | 用途 |
| --- | --- | --- |
| 内容 | 28 / 20 / 16 | 页面标题、笔记标题、题干/正文 |
| 界面 | 13 | 按钮、菜单、设置、状态 chip 文字 |
| 元信息 | 12.5 / 11.5 | 出处、计数、复习日期、分组标题 |

> 两套行距必须分开：`.pd-body` 用 2.1；`.pd-ui` 用 1.45，永不混用。中文不用 700（会糊）；标题 600、控件 500、正文 400。

### 2.4 间距与尺寸

| Token | 值 | 用途 |
| --- | --- | --- |
| `--pd-space-1` | `4px` | 图标与文字 |
| `--pd-space-2` | `8px` | 标签间距 / 按钮 gap |
| `--pd-space-3` | `12px` | 卡片间距 / 行内分组 |
| `--pd-space-4` | `16px` | 卡片内主间距 |
| `--pd-space-5` | `20px` | 卡片内边距 |
| `--pd-space-6` | `24px` | 区块间距 |
| `--pd-space-7` | `32px` | 页面上下留白 |
| `--pd-content` | `720px` | 阅读列最大宽 |
| `--pd-card-pad` | `20px 22px 14px` | 阅读卡内边距 |
| `--pd-card-gap` | `12px` | 卡片间距 |
| `--pd-row-h` | `38px` | 折叠行 |
| `--pd-ctl-h` | `30px` | 按钮 / 输入 |
| `--pd-chip-h` | `22px` | 标签 |
| `--pd-icon` | `16px` | UI 图标 |
| `--pd-icon-lg` | `20px` | 卡片图标 |

**题库专用尺寸（新增，沿用同一节奏）：**

| Token | 值 | 用途 |
| --- | --- | --- |
| `--pd-grid-gap` | `16px` | 题卡流网格间距 |
| `--pd-qcard-pad` | `16px 18px 14px` | 题库卡片内边距 |
| `--pd-qcard-min` | `300px` | 双列最小列宽 |
| `--pd-statuschip-h` | `26px` | 状态筛选 chip |
| `--pd-table-row` | `46px` | 紧凑表格行高 |
| `--pd-drawer-w` | `420px` | 练习抽屉宽 |
| `--pd-header-h` | `auto` | 题库页头（自然高） |

### 2.5 圆角 / 边 / 阴影

| Token | 值 | 用途 |
| --- | --- | --- |
| `--pd-r-card` | `14px` | 卡片 |
| `--pd-r-pop` | `12px` | 弹出菜单 |
| `--pd-r-ctl` | `9px` | 按钮 / 输入 / 分段控件 |
| `--pd-r-chip` | `6px` | 标签 |
| `--pd-r-pill` | `999px` | 胶囊 / 状态 chip |
| `--pd-border` | `1px solid var(--pd-line)` | 卡片唯一一条边 |
| `--pd-hairline` | `1px solid var(--pd-line-2)` | 卡内分隔 |
| `--pd-shadow-card` | `none` | **卡片永远不投影** |
| `--pd-shadow-pop` | `var(--pd-shadow)` | 仅菜单 / 气泡 |

### 2.6 动效

| Token | 值 |
| --- | --- |
| `--pd-ease` | `cubic-bezier(.2, .8, .2, 1)` |
| `--pd-t-hover` | `120ms` |
| `--pd-t-pop` | `160ms` |
| `--pd-t-fold` | `220ms` |
| `--pd-t-enter` | `240ms` |
| `--pd-t-seg` | `180ms` |

规则：入场 ≤240ms；hover ≤120ms；位移 ≤6px；缩放仅 0.98–1；不用 spring/bounce；卡片不 scale；展开用 `grid-template-rows`（不用 `max-height`）；`prefers-reduced-motion` 全压到 1ms。

---

## 3. 作用域与主题

- 阅读视图卡片、工作台根节点都挂 `.pd-root`（阅读卡在 `markdown-preview-view` 内，不在工作台内，必须自带来令牌）。
- 主题由 Obsidian 的 `body.theme-dark` / `body.theme-light` 决定；**不要只写暗色**。
- 旧设置 `settings.theme = "mubu-dark"` 保留字段（不改 schema），仅作为「强制暗色令牌」的兼容开关：给 `body` 挂 `zaptrace-force-dark` 时套用暗色令牌块；`auto` 时跟随 Obsidian。
- 与 MubuStyle 共存：只读 `--mubu-*` 做圆点回退，不覆盖；自身令牌全部 `--pd-*`。

```css
.pd-root { /* 字体/间距/形状/动效令牌，见 §2.3–2.6 */ }

body.theme-dark .pd-root,
body.zaptrace-force-dark .pd-root { /* §2.1 暗色 */ }
body.theme-light .pd-root { /* §2.2 亮色 */ }
```

---

## 4. 阅读视图题卡（Problem Card）

> 目标：替换现网「大框框 + 描边按钮 + 孤立收藏」。参考图 3 说明「默认收起答案/讲解、点击展开」的方向；但按本任务采用 Quiet Cards 的**三条 38px 无内框折叠行**与 **`⋯` 菜单**，不采用图 3 的答案/笔记内嵌大盒与右上角「收藏」文字按钮。

### 4.1 DOM 结构

```
.pd-root.pd-card[data-qid]
├─ .pd-card-head
│  ├─ .pd-tags                 (学科 .is-subject + 知识点 .is-topic，最多 1+3，超出 +N)
│  └─ .pd-card-tools           (opacity:0 → hover/focus 显示)
│     └─ button.pd-icon-btn[data-tool="more"]   (22×22 命中, 16px ⋯)
├─ .pd-stem.pd-body            (题干；可含公式)
├─ .pd-card-error              (仅 card.errors 非空：红字 12.5，无红底)
├─ .pd-folds
│  ├─ .pd-fold[data-fold="answer"]
│  │  ├─ button.pd-fold-head [aria-expanded][aria-controls]
│  │  │  ├─ svg.pd-fold-chevron
│  │  │  ├─ span.pd-fold-label  "答案"
│  │  │  └─ span.pd-fold-count  "3 行"（可选）
│  │  └─ .pd-fold-body > .pd-fold-content
│  ├─ .pd-fold[data-fold="notes"]     (仅 card.notes 非空)
│  └─ .pd-fold[data-fold="aiNotes"]   (仅 card.aiNotes 非空)
└─ .pd-card-foot
   ├─ span.pd-source           "出处：…"（12.5 muted，省略号）
   └─ .pd-actions
      ├─ button.pd-btn           "定位原文"
      └─ button.pd-btn.is-primary "练习此卡"
```

### 4.2 规格（对齐 pluginDesign §4.2 / §4.4 / §4.5 / §4.6）

| 项 | 值 |
| --- | --- |
| 背景 | `--pd-surface` |
| 边 | **1px `--pd-line`（整张卡唯一一条）** |
| 圆角 | `--pd-r-card` 14px |
| 内边距 | `20px 22px 14px` |
| 投影 | `none` |
| hover | 边色 → `--pd-line-hover`，120ms；背景不变 |
| focus-visible | `outline: 2px solid var(--pd-accent); outline-offset: 2px` |
| 当前题（阅读场景） | `box-shadow: inset 3px 0 0 var(--pd-accent)`（左侧 3px 竖条，不加边框） |
| 卡内节奏 | head→stem 14px；stem→folds 16px；folds→foot 12/6px；foot 单行 |

**折叠行（核心）：**

| 项 | 值 |
| --- | --- |
| 行高 | `38px` |
| 背景 | **透明** |
| 边框 | `.pd-folds` 上加 `border-top: 1px --pd-line-2`；每条 `.pd-fold` 加 `border-bottom: 1px --pd-line-2`；**无内框、无圆角** |
| 内边距 | `0 2px` |
| 标签 | 13px / 500 / `--pd-fg-2` |
| 箭头 | 14px / `--pd-muted`，`0° → 90°`，220ms |
| 右侧计数 | 11.5px / `--pd-faint` |
| hover | 标签 → `--pd-fg`；**不加底色、不加边** |
| 展开动画 | `grid-template-rows: 0fr → 1fr`，220ms `--pd-ease` |
| 展开内容 | `padding: 2px 0 14px 22px`；无背景/边框/圆角；15px / 1.9（长公式 16/2.1） |
| 懒渲染 | 首次展开才 `MarkdownRenderer.render`（保留现有 `onFirstOpen`） |

> ❌ 禁止：给折叠行加 `border:1px` + `border-radius`；给展开内容加浅色底（除非代码块/引用）；把答案/笔记做成并排按钮。

**卡片工具与收藏：**

| 项 | 值 |
| --- | --- |
| `⋯` | 22×22 命中区，16px 图标，`--pd-muted`，无边框，默认 `opacity:0`，hover/focus-within → 120ms 淡入 |
| 收藏 | **不进常驻图标**，只在 `⋯` 菜单：文案「收藏 / 取消收藏」 |
| 可选星标 | 若产品要可见收藏态：`.pd-card-tools` 内 18px 星，仅 hover 出现；已收藏时常驻 `--pd-amber`；默认不实现 |
| 菜单宽 | 196px |
| 菜单底 | `--pd-pop` + `backdrop-filter: blur(20px)` |
| 菜单边/圆角/阴影 | 1px `--pd-line` / 12px / `--pd-shadow` |
| 菜单行 | 高 30 / 内距 `0 8px` / 13px / hover 6% 前景 |
| 入场 | 160ms：`opacity 0→1` + `translateY(-4px)→0` + `scale(.98)→1`，锚点右对齐工具按钮 |
| 菜单项 | 收藏/取消收藏、打开原文、复制题干（均为现有能力，无新功能） |

**出处与操作（同一基线）：**

| 项 | 值 |
| --- | --- |
| 出处 | 12.5px / `--pd-muted` / `margin-right:auto` / 单行省略 / `title` 全文；前缀「出处：」`--pd-faint` |
| 操作 | 13px / 500 / 高 30 / 圆角 9 / 无边框；次级透明，主操作 `--pd-accent-soft` 底 + `--pd-accent` 字 |
| 对齐 | `display:flex; align-items:center; gap:8px`；操作右对齐 |
| 窄屏 | 图标保留、文字可隐藏（`aria-label` 保留） |

### 4.3 Live Preview 缩略卡

`compact` 模式只渲染：题干首行（2 行截断）+ 12.5px 提示「实时预览只读 · 在阅读视图或工作台作答」+ 两个文本按钮（打开工作台练习 / 定位原文）。**不使用折叠行、不显示 `⋯`**（LP 内交互不稳定，见 `DESIGN.md` §5.2）。全部走 `pd-*` 令牌，不再用 `zt-*` 视觉。

### 4.4 实现要点

- 现有 `createCollapsible()` 生成的 `.zt-collapse*` 结构保留其**行为**（`data-open`、`aria-expanded`、`aria-controls`、`onFirstOpen` 懒渲染）；视觉改为 `.pd-fold*`。推荐 dual-class：`class="zt-collapse pd-fold"`、header `class="zt-collapse-header pd-fold-head"`、body `zt-collapse-body pd-fold-body`、content `zt-collapse-inner pd-fold-content"`。
- 去掉 `zt-collapse-dot` 的视觉（`display:none` 或删除 DOM）；Quiet Cards 的 UI 不用圆点。
- `aria-controls` 的 id 继续用自增 `zt-collapse-N`（不要用 qid；qid 含 `.`/`:`）。
- `card.errors` 显示在题干下，红字无红底；`duplicateId` 同样归入 `.pd-card-error` 或状态 chip。

---

## 5. 工作台 · 题库（Library Workbench）

### 5.1 信息架构总览

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  题库   全部题目 · 139 题        [🔍 搜索题干 / 知识点 / 科目…]   [继续上次复习 · 今日已作答 12 题]  [⟳][⚙] │  .pd-lib-header
├──────────────────────────────────────────────────────────────────────────────┤
│  [全部题目 139] [到期复习 133] [已收藏 8] [未练 12] [需完善 1] [错题 5]                 │  .pd-statusbar
│  科目 [全部科目 ▾]   标签 [全部标签 ▾]  [导数][极限][行列式]…        排序 [按到期 ▾]  清除  │  .pd-filterbar
├──────────────────────────────────────────────────────────────────────────────┤
│  [ 题卡流 ] [ 紧凑表格 ] [ 独立复习 ]                                                   │  .pd-seg
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────┐  ┌───────────────────────────┐                 │
│  │ 高等数学  导数  极限   ⋯   │  │ 线性代数  行列式          ⋯ │                 │  .pd-grid
│  │ 求 f(x)=x² 在 x=1 处的导数… │  │ 判断矩阵 A 是否可逆…        │                 │
│  │ [未练]  来源：高数 p.86    │  │ [到期] 复习 2026-11-03      │                 │
│  └───────────────────────────┘  └───────────────────────────┘                 │
│                          （点击卡片 → 右侧练习抽屉）                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **单页取代原三栏**：不再有 `.zt-columns` 三栏常驻；练习改为右侧抽屉（§5.6），复习改为「独立复习」分段视图（§5.5）。
- 题库根节点：`.pd-root.pd-workbench`，`role="region" aria-label="ZapTrace 题库"`，`display:flex; flex-direction:column; height:100%; min-height:0; background:var(--pd-bg)`。

### 5.2 页头 `.pd-lib-header`

| 元素 | 规格 |
| --- | --- |
| 标题「题库」 | 28px / 1.3 / 600 / `--pd-fg`；左侧固定 |
| 计数 `.pd-count` | `全部题目 · {N} 题`，12.5px / `--pd-faint`，紧随标题 |
| 搜索 `.pd-search` | 高 30 / 圆角 9 / `--pd-surface-3` 底 / 13px；宽 `clamp(200px, 26vw, 360px)`；placeholder「搜索题干 / 知识点 / 科目」；左侧 16px 放大镜 |
| 主 CTA `.pd-btn.is-primary` | 若 `到期复习 > 0`：**「继续上次复习 · 今日已作答 {todayCount} 题」**（`todayCount` = `reviewLog` 中 `at` 日期为今天的条数，现有字段）；若为 0：「随机练一题」。点击分别 `startPractice(dueQueue)` / `startPractice([random])`。 |
| 次操作 | `重建索引` / `设置` 两个 `.pd-icon-btn`（保留现有命令），右对齐 |
| 布局 | `display:flex; align-items:center; gap:12px; padding:20px 24px 12px; flex-wrap:wrap`；窄屏换行 |
| 边 | 无下边框（靠留白分隔），除非吸顶时加 1px `--pd-line-2` |

### 5.3 状态筛选 chips `.pd-statusbar`（计数来自现有数据）

| Chip | 过滤条件（纯派生，不新增字段） | 计数口径 |
| --- | --- | --- |
| 全部题目 | 恒真 | `cards.length` |
| 到期复习 | `state.due && state.due <= today` | 同条件计数 |
| 已收藏 | `state.star === true` | 同 |
| 未练 | `!state || state.step === -1` | 同 |
| 需完善 | `card.errors.length>0 \|\| card.duplicateId \|\| !card.stem.trim() \|\| !card.answer.trim()` | 同 |
| 错题 | `(state.lapses ?? 0) > 0` | 同 |

- **计数相互独立、允许重叠**（一道题可同时「到期」且「错题」）；chip 是筛选器，不是互斥分类。这与参考图 2 的 133/1/1/… 口径一致。
- 视觉：高 26 / 圆角 `--pd-r-pill` / 内距 `0 10px` / 12.5px / 500；未选 `--pd-surface-3` 底 + `--pd-fg-2`；选中 `--pd-accent-soft` 底 + `--pd-accent` 字；hover 底提亮 6%。计数用 `--pd-faint`（选中时 `--pd-accent` 60%）。
- 多选语义：状态 chip **单选**（同一时刻一个状态筛选；「全部题目」= 清除状态筛选）。用 `role="group"` + 每个 `button aria-pressed`。
- 「错题」= `lapses>0`（至少评过一次「忘记」）；若将来要「顽固错题」= `lapses>=2`，可再加一个 chip，但**首版不加**（避免无字段依据的扩张）。

### 5.4 筛选 `.pd-filterbar`

| 控件 | 规格 / 行为 |
| --- | --- |
| 科目 | `.pd-select` 下拉：全部科目 + 去重排序的 `card.subject`（现有数据） |
| 标签 / Tags | 同义，按**多选 chips**：全部标签 + `card.tags` 去重排序；交集匹配（沿用现有 `filterCards` 语义）。选中 `aria-pressed` |
| 排序 | `.pd-select`：按到期 / 收藏优先 / 最近新增 / 按科目（沿用现有 `SortKey`） |
| 清除 | `.pd-btn` 文本按钮，清空状态/科目/标签/搜索/排序恢复默认 |
| PDF 来源 | 保持现状：**只展示 chip、不提供筛选**（`card.pdf` 存在时卡片右下角 11.5px 灰标签） |

- 布局：`display:flex; flex-wrap:wrap; gap:8px; padding:0 24px 12px; align-items:center`。
- 搜索与筛选状态存放在视图内存（状态筛选可在视图层单独维护，**不落 data.json、不改 core 类型**；如需复用 `filterCards`，在调用前先按状态过滤一次即可）。

### 5.5 分段控件 `.pd-seg`（题卡流 / 紧凑表格 / 独立复习）

| 项 | 值 |
| --- | --- |
| 轨道 | `--pd-surface-3`，圆角 9，内边距 2，`inline-flex` |
| 按钮 | 高 24 / 内距 `0 12px` / 12.5px / `border:0` |
| 选中 | 文字 `--pd-fg`，滑块底 `--pd-surface`（暗色可 15% 白）+ `0 1px 2px rgba(0,0,0,.28)` |
| 未选 | 文字 `--pd-muted` |
| 切换动画 | 滑块 180ms `--pd-ease`（可用伪元素 transform，不必真滑块） |
| 语义 | `role="tablist"`；每个按钮 `role="tab" aria-selected aria-controls`；内容区 `role="tabpanel"` |
| 键盘 | `←/→` 在三个 tab 间移动（可选 roving tabindex），`Home/End` 首尾 |

三种视图内容区统一包在 `.pd-content`（`flex:1; min-height:0; overflow-y:auto; padding:0 24px 32px`），切换时只替换内容，不重建页头/筛选。

#### 5.5.1 题卡流 `.pd-grid`（响应式双列）

| 项 | 值 |
| --- | --- |
| 布局 | `display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:var(--pd-grid-gap)` |
| 列宽 | 单列最小 `--pd-qcard-min: 300px`；容器不足时自动降为 1 列 |
| 断点 | `≥1024px` 双列；`720–1023px` 单列；`<720px` 单列 + 内距 12px |
| 卡片 | `.pd-qcard`：底 `--pd-surface`、1px `--pd-line`、圆角 14、内距 `16px 18px 14px`、无投影 |
| hover | 边色 `--pd-line-hover`；右上工具淡入；**不位移、不缩放** |
| focus | `outline:2px solid var(--pd-accent)` offset 2 |
| 入场 | 首屏卡片 `.is-enter`：`opacity 0→1, translateY(6px)→0`，240ms，按 30ms 递进，最多 5 张；重渲染不重播 |

**单卡结构：**

```
.pd-qcard[data-qid][role="listitem"]
├─ .pd-qcard-head
│  ├─ .pd-tags  (学科 1 + 知识点 ≤3，超出 +N)
│  └─ .pd-qcard-tools (hover/focus 显示)
│     ├─ button.pd-icon-btn[data-tool="more"]  (⋯)
│     └─ span.pd-qcard-detail  "查看详情"（文本按钮；见下）
├─ .pd-qcard-stem (16px/1.7；-webkit-line-clamp:2；最小高 2 行)
└─ .pd-qcard-foot
   ├─ .pd-status  (状态 chip：需完善/到期/错题/未练/已排期)
   ├─ span.pd-qcard-due  "复习 2026-11-05" / "已到期 3 天" / "未练"
   └─ span.pd-qcard-source  出处（11.5 muted 省略号）
```

- **点击卡片主体 → 打开练习抽屉并 `startPractice([card])`（现有练习流程，不改）**。
- **「查看详情」→ `openSource(card)`**（打开源笔记并定位到题卡首行，只读；现有能力）。
- `⋯` 菜单与阅读卡一致：收藏/取消收藏、打开原文、复制题干。
- 卡片最多 1 个学科 chip + 3 个知识点 chip；单行省略；状态 chip 只 1 个（优先级见附录 A）。
- 题干 2 行截断；**不在题库卡渲染答案/选项**（参考图 2 的 A–D 选项属于行测形态，ZapTrace 无选项字段，故不渲染）。

**为什么不是等高网格：** 卡片按内容自然高度（2 行题干 + 单行脚注），双列 `grid` 默认 `align-items:start`，避免参差被拉伸。

#### 5.5.2 紧凑表格 `.pd-table`

| 项 | 值 |
| --- | --- |
| 容器 | `--pd-surface` + 1px `--pd-line` + 圆角 12；`overflow:hidden`（表格自身裁切） |
| 表头 | 高 36 / 12px / `--pd-muted` / `letter-spacing:.04em`；吸顶（`position:sticky; top:0; background:var(--pd-surface)`） |
| 行 | 高 46；内距 `0 14px`；1px `--pd-line-2` 分隔；hover `--pd-surface-2`；选中 `--pd-sel` |
| 列 | `收藏（★图标按钮）｜题干（flex:1，单行省略）｜科目｜标签（最多2）｜状态｜复习日期｜⋯` |
| 行为 | 点行主体 → 练习；★ → 收藏（`toggleStar`）；⋯ → 菜单；行内各项为兄弟按钮，**不嵌套** |
| 语义 | `role="table"` + 行/列角色；或 `role="list"` + 每行 `button`（推荐后者，避免 div 表格语义负担） |
| 空/加载 | 同 §7 空态 / 骨架 |

> 表格是「信息密度」模式，不是另一种数据源；与题卡流共用同一 `filtered+sorted` 结果。

#### 5.5.3 独立复习 `.pd-review`

- 直接复用现有 `ReviewPanel` 的结构与行为（今日到期计数、按科目分组、每日上限 +N 顺延、按科目组卷、时间记录近 7 天），仅把 `zt-*` 视觉替换为 `pd-*`。
- 视觉：容器 `--pd-surface` + 1px 边 + 12 圆角，内距 0 0 12；组头 48 行；组行 hover `--pd-surface-2`；时间日志行 34；评分标签沿用 `--pd-red/--pd-amber/--pd-green/--pd-accent` 的文字色（不铺底）。
- 这不改变任何复习算法；只是第三分段视图。

### 5.6 练习抽屉 `.pd-drawer`

| 项 | 值 |
| --- | --- |
| 触发 | 点题卡主体 / 紧凑表格行 / 复习行 / 主 CTA |
| 位置 | 桌面 `≥1440px`：右侧**固定分栏**（与内容并列，宽 420px，1px `--pd-line` 左边）；`<1440px`：右侧**覆盖抽屉**（fixed，宽 420，`--pd-shadow`，遮罩 `rgba(0,0,0,.35)`） |
| 内容 | 现有 `PracticePanel`（进度 / 题干 / 显示答案 / 跳过 / 答案 / 笔记 / 评分条 / 小结），**行为与 H4 门禁完全不变** |
| 头 | 高 48：标题「练习」14/600 + 关闭 `.pd-icon-btn`；`aria-label="关闭练习"` |
| 窄屏 `<720px` | 全屏 sheet（`inset:0`），`role="dialog" aria-modal="true"`，焦点陷阱；Esc 关闭（评分中也可关，关闭不写盘） |
| 语义 | 桌面分栏：`role="complementary" aria-label="练习"`；覆盖/全屏：`role="dialog" aria-modal="true"` |
| 焦点 | 打开时焦点落到「显示答案」或首个可交互元素；关闭回到触发卡片 |

> 「右侧或独立复习视图保留现有练习/复习功能」的落法：**练习 = 右侧抽屉（分栏/覆盖）**；**复习 = 独立复习分段视图**。两者都不重写业务逻辑，只换外壳与样式。

---

## 6. 组件规格汇总（可直接写 CSS）

| 组件 | 规格 |
| --- | --- |
| `.pd-btn` | 高 30 / 圆角 9 / 内距 `0 10px` / 13px 500 / `border:0!important` / 无阴影 / 透明底；hover 6% 前景底 + `--pd-fg` |
| `.pd-btn.is-primary` | `--pd-accent-soft` 底 + `--pd-accent` 字；hover accent 18% 混合 |
| `.pd-icon-btn` | 28×28 / 圆角 7 / 透明 / 无边框；hover 8% 前景底 |
| `.pd-tag` | 高 22 / 内距 `0 8px` / 圆角 6 / 11.5px 500 / 5% 前景底 / 无边框；`.is-subject` accent-soft+accent；`.is-topic` 5%；`.is-status` green/amber soft |
| `.pd-status`（卡内状态） | 高 20 / 内距 `0 7px` / 圆角 6 / 11.5px / 500；`is-due` amber-soft/amber；`is-mistake`/`is-fix` red-soft/red；`is-new` 5%/muted；`is-planned` green-soft/green |
| `.pd-search` / `.pd-input` | 高 30 / 圆角 9 / `--pd-surface-3` 底 / 13px；focus 2px accent 描边 |
| `.pd-select` | 高 30 / 圆角 9 / `--pd-surface-3` / 13px；原生 select 样式收敛 |
| `.pd-menu` | 见 §4.2；`position:fixed` + `z-index: calc(var(--layer-popover,50)+2)` |
| `.pd-seg` | 见 §5.5 |
| `.pd-toggle` | 42×24 / 圆角 999 / 关 `--pd-surface-3`，开 `--pd-accent`；18px 白点 translateX 18，160ms |
| `.pd-empty` | `padding:48px 24px` 居中；标题 14/500 `--pd-fg`，说明 12.5 `--pd-muted`；无插画 |
| `.pd-skeleton` | `--pd-surface-3`，圆角 6，opacity .5–.8 呼吸 1.4s；不转圈 |
| 滚动条 | 宽 6，thumb `--pd-line`，圆角 3 |

---

## 7. 空态 / 加载 / 错误

| 场景 | 文案 | 操作 |
| --- | --- | --- |
| 全库无题卡 | 「还没有题卡。复制模板，粘进任意笔记。」 | 「复制模板」+ 折叠模板预览（沿用现有 `QUESTION_TEMPLATE`） |
| 状态/筛选无结果 | 「没有符合条件的题。」+ 当前条件摘要 | 「清除筛选」 |
| 独立复习无到期 | 「今日无到期，去练一题？」 | 「随机练一题」 |
| 时间记录空 | 「暂无练习记录。」 | 无 |
| 练习未开始 | 「选一道题开始练习」 | 无 |
| 语法错误卡 | `.pd-card-error` 红字（行号），或 `.pd-status.is-fix`「需完善」 | 「打开原文」 |
| 加载 | 骨架卡 2–4 个 | 无 |

---

## 8. 交互与可访问性（A11y）

### 8.1 语义结构

| 区域 | 角色 / 属性 |
| --- | --- |
| 工作台根 | `role="region" aria-label="ZapTrace 题库"`；标题用 `<h1>` |
| 题库标题 | `h1` 「题库」；计数 `span` |
| 搜索 | `<input type="search" aria-label="搜索题干或标签">` |
| 状态 chips | `role="group" aria-label="状态筛选"`；每个 `button aria-pressed` |
| 筛选（科目/Tags/排序） | 各 `label` + 原生 `select`；Tags chips `role="group" aria-label="标签筛选"`，`button aria-pressed` |
| 分段控件 | `role="tablist" aria-label="视图"`；`button role="tab" aria-selected aria-controls`；面板 `role="tabpanel"` |
| 题卡流 | `role="list"`；每卡 `role="listitem"`；主点击元素是 `button`（覆盖题干区），`⋯`/「查看详情」为**兄弟按钮**，不嵌套 |
| 阅读卡折叠 | `button aria-expanded aria-controls`；内容 `role="region"`（可省） |
| 阅读卡工具 | `button aria-haspopup="menu" aria-expanded`；菜单 `role="menu"`，项 `role="menuitem"` |
| 练习抽屉 | 桌面 `role="complementary"`；覆盖/全屏 `role="dialog" aria-modal="true"` |
| 评分条 | `role="radiogroup"` + `role="radio" aria-checked`（现有） |
| 反馈 | 评分结果 `aria-live="polite"`（现有） |

### 8.2 键盘

| 场景 | 键 |
| --- | --- |
| 全局 | `/` 聚焦搜索（输入框内不拦截） |
| 题卡/行 | `Tab` 到卡片主按钮，`Enter/Space` 打开练习 |
| 状态 chips | `Tab` 遍历；`Enter/Space` 切换（单选） |
| 分段 | `←/→` 切换 tab（roving tabindex），`Home/End` 首尾 |
| 折叠行 | `Enter/Space` 展开/收起 |
| 菜单 | `↑/↓` 移动，`Enter` 执行，`Esc` 关闭并回到触发按钮；外部点击关闭 |
| 练习 | `Enter` 显示答案（焦点不在按钮时）；`1–4` **仅 `revealed` 后**评分；`Esc` 关闭抽屉/返回题集 |
| 抽屉 | 打开焦点入内；`Esc` 关闭；关闭焦点回触发卡 |

### 8.3 焦点 / 触摸 / 动效

- 焦点环统一 `outline: 2px solid var(--pd-accent); outline-offset: 2px`；**禁止 `outline:none`**。
- `@media (hover: none)`：`.pd-card-tools, .pd-qcard-tools { opacity: 1 }`；触摸不依赖 hover；点击卡主体即打开练习。
- `@media (prefers-reduced-motion: reduce)`：`.pd-card, .pd-fold, .pd-menu, .pd-btn, .pd-chip, .pd-seg, .pd-toggle { transition-duration:1ms!important; animation-duration:1ms!important }`。
- 所有图标按钮 `aria-label`；父级浮层按钮用 `aria-haspopup`，避免 Obsidian 原生 tooltip 双弹（只给叶子按钮 `aria-label` 或用 `data-tooltip`）。

---

## 9. 响应式与窄屏

| 断点 | 布局 |
| --- | --- |
| `≥1440px` | 题卡流双列 + 右侧练习**固定分栏**（420px）；页头单行 |
| `1024–1439px` | 题卡流双列；练习为**覆盖抽屉**（420px） |
| `720–1023px` | 题卡流单列；页头换行（搜索占一行）；状态 chips 横向可滚动；练习覆盖抽屉 |
| `<720px` | 单列；页头堆叠；状态 chips 横向滚动；分段控件满宽；练习**全屏 sheet**；卡片工具常驻；表格降级为单列卡片行（或横向滚动） |

规则：页面左右留白 ≥24px（<720 降 16）；题库页头与第一行内容 12px；卡片间距 16（网格）/12（阅读流）。

---

## 10. 迁移映射（`zt-*` → `pd-*`）

### 10.1 原则

1. **视觉样式全部迁到 `pd-*`**；`styles.css` 中的 `zt-*` 视觉规则删除或改为 `pd-*`。
2. **`zt-*` 只保留为行为钩子**：需要 JS/测试依赖的 class 用 **dual-class**（`class="zt-collapse pd-fold"`），或把行为改挂 `data-*`。**不改任何 JS 业务逻辑**。
3. 解析 / ID / data.json / 评分 / 复习算法一行不改。

### 10.2 类名映射表

| 现类名（行为/结构） | 新类名（视觉） | 保留 zt？ |
| --- | --- | --- |
| `.zaptrace-workbench`（根） | `.pd-root.pd-workbench` | 保留（测试/定位） |
| `.zt-topbar` | `.pd-lib-header` | 否 |
| `.zt-title` | `.pd-h1` | 否 |
| `.zt-topbar-badge` | `.pd-count` | 否 |
| `.zt-topbar-actions` | `.pd-header-actions` | 否 |
| `.zt-columns` | **删除**（单页布局） | 否 |
| `.zt-panel` / `.zt-panel-title` / `.zt-panel-body` | `.pd-section` / `.pd-section-title` / `.pd-content` | 否 |
| `.zt-tabs` / `.zt-tab`（移动三栏 Tab） | **删除**（改 `.pd-seg` 三分段） | 否 |
| `.zt-filters` | `.pd-filterbar` | 否 |
| `.zt-input` / `.zt-search` | `.pd-input` / `.pd-search` | 否 |
| `.zt-field` / `.zt-field-label` / `.zt-select` / `.zt-disabled` | `.pd-field` / `.pd-label` / `.pd-select` / `.is-disabled` | 否 |
| `.zt-list-summary` | `.pd-count-inline` | 否 |
| `.zt-chip`（筛选标签） | `.pd-chip` | 否 |
| `.zt-tag`（卡内标签） | `.pd-tag`（`.is-subject` / `.is-topic`） | 否 |
| `.zt-list` / `.zt-row` | `.pd-table` / `.pd-trow`（表格视图） | 否 |
| `.zt-row-open` / `.zt-row-title` / `.zt-row-meta` | `.pd-trow-main` / `.pd-trow-title` / `.pd-trow-meta` | 否 |
| `.zt-row-locate` / `.zt-icon-button` | `.pd-icon-btn` | 否 |
| `.zt-star` / `.zt-star-small` | **删除常驻**；收藏进 `.pd-menu`；表格视图保留 `.pd-icon-btn.is-star` | 否 |
| `.zt-badge*` | `.pd-status`（`.is-due/.is-fix/.is-mistake/.is-new/.is-planned`） | 否 |
| `.zt-empty*` | `.pd-empty*` | 否 |
| `.zt-divider` | `.pd-divider` | 否 |
| `.zt-review-*` / `.zt-group-*` / `.zt-log-*` | `.pd-review-*` / `.pd-group-*` / `.pd-log-*` | 否 |
| `.zt-practice*` / `.zt-progress*` / `.zt-rating*` / `.zt-rate-status` | `.pd-practice*` / `.pd-progress*` / `.pd-rating*` / `.pd-rate-status` | 否 |
| `.zt-card` / `.zt-card-head` / `.zt-card-meta` / `.zt-card-subject` / `.zt-stem` / `.zt-card-foot` / `.zt-card-source` / `.zt-card-error` / `.zt-card-compact*` | `.pd-card` / `.pd-card-head` / `.pd-tags` / `.pd-tag.is-subject` / `.pd-stem` / `.pd-card-foot` / `.pd-source` / `.pd-card-error` / `.pd-compact*` | `.zt-card` 保留（root 定位） |
| `.zt-collapse` / `-header` / `-body` / `-inner` / `-chevron` / `-label` | `.pd-fold` / `-head` / `-body` / `-content` / `-chevron` / `-label` | 保留 `.zt-collapse` 及其 `data-open`（行为） |
| `.zt-collapse-dot` | **删除视觉**（UI 不用圆点） | 否 |
| `.zt-answer` / `.zt-answer-label` | `.pd-answer` / `.pd-answer-label`（练习区） | 否 |
| `.zt-button*` | `.pd-btn` / `.pd-btn.is-primary` / `.pd-btn.is-danger` | 否 |

### 10.3 影响文件（实现阶段）

| 文件 | 改动 |
| --- | --- |
| `styles.css` | **重写视觉**为 `--pd-*` + `.pd-*`；删除 `zt-*` 视觉规则；保留少量布局/行为 reset |
| `src/view/workbenchView.ts` | 外壳从三栏改为「题库页 + 练习抽屉」；接管分段视图；保留 `WorkbenchHandle`（可扩展 `mode`） |
| `src/view/libraryPanel.ts` | 拆成「题库页头 + 状态/筛选 + 题卡流网格 + 紧凑表格」；筛选逻辑复用 `filterCards/sortCards` |
| `src/view/card.ts` | 阅读卡改 `pd-*`；收藏从常驻按钮移入 `⋯` 菜单；折叠行改 `pd-fold` |
| `src/view/practicePanel.ts` / `reviewPanel.ts` / `ratingBar.ts` / `settingsTab.ts` | 只改 class 名与版式，不改逻辑 |
| `src/main.ts` | 仅主题类名（`zaptrace-force-dark`）与可能的 view 注册；业务不动 |

### 10.4 明确**不动**的部分（硬约束）

- `src/core/**`（parse / id / hash / index / state / scheduler / filter / format / date）**零改动**。
- `src/store/stateStore.ts` 零改动；`data.json` **不新增字段**、`schemaVersion` 不变。
- 解析规则、qid/instanceKey、H1–H4 行为、四档评分、复习日期、H4 评分门禁**全部不变**。
- `examples/zaptrace-demo.md` **不修改**（用户未提交文件，本文档也不动它）。

---

## 11. CSS 组织与实现约束

### 11.1 `styles.css` 分段顺序

1. 令牌（`.pd-root` 亮暗 + 兼容 force-dark）
2. 基础（`.pd-root` 排版、链接、滚动条）
3. 通用控件（`.pd-btn` / `.pd-icon-btn` / `.pd-input` / `.pd-select` / `.pd-tag` / `.pd-status`）
4. 分段控件 / 开关 / 菜单
5. 阅读卡（`.pd-card` / `.pd-folds` / `.pd-fold` / `.pd-source` / `.pd-actions`）
6. 题库（`.pd-lib-header` / `.pd-statusbar` / `.pd-filterbar` / `.pd-grid` / `.pd-qcard` / `.pd-table`）
7. 练习 / 复习（`.pd-practice*` / `.pd-review*`）
8. 空态 / 骨架
9. 响应式（`@media`）
10. `prefers-reduced-motion` / `@media (hover:none)` / `@media print`

### 11.2 Obsidian 覆盖坑（沿用 `DESIGN.md` §10.9 + Quiet Cards §9）

| # | 问题 | 处理 |
| --- | --- | --- |
| 1 | `button:not(...)` 给按钮加底/边 | 所有 `pd` 按钮 `border:0!important; background:transparent; box-shadow:none!important` |
| 2 | `aria-label` 触发原生 tooltip | 仅叶子按钮挂 `aria-label`；浮层父按钮用 `data-tooltip`/`title` |
| 3 | 主题覆盖段落 margin | `.pd-body p { margin-block:.5em }` 显式声明 |
| 4 | 阅读视图被主题 `max-width` 限制 | `.pd-root` 阅读卡 `max-width:720px; margin-inline:auto`，不依赖主题变量 |
| 5 | 明暗类名 | `body.theme-dark` / `body.theme-light` |
| 6 | 与 MubuStyle 共存 | 只读 `--mubu-*` 回退，不覆盖 |
| 7 | 公式被 `overflow:hidden` 裁切 | 卡片**不设** `overflow:hidden`；公式容器 `overflow-x:auto` |
| 8 | 卡片入场每次重渲染重播 | 仅首次挂载加 `.is-enter`，之后移除 |
| 9 | `color-mix` 兼容 | Obsidian 1.14.5（Chromium 新版）支持；不支持时降级 `rgba(255,255,255,.05)` |
| 10 | 打印/导出 | `@media print`：卡片去底/去圆角，保留 1px 线；工具与操作隐藏 |

```css
@media print {
  .pd-card, .pd-qcard { background: transparent; border-color: #ddd; box-shadow: none; }
  .pd-card-tools, .pd-qcard-tools, .pd-actions { display: none; }
}
@media (hover: none) {
  .pd-card-tools, .pd-qcard-tools { opacity: 1; }
}
```

### 11.3 实现红线

- 不用内联 `style`（唯一例外：进度条宽度这类动态值）。
- 不用 `!important` 覆盖 `pd-*` 自身；只在对抗 Obsidian 原生按钮时使用。
- 不给卡片加投影；卡片不 `scale`；不用 `max-height` 做展开动画。
- UI 区不出现圆点/项目符号（圆点只属于 `.pd-body`）。

---

## 12. 验收清单（可勾选）

### 12.1 阅读视图题卡

- [ ] 一张卡只有 1px 一条边；卡内无第二层边框。
- [ ] 答案 / 个人笔记 / AI 笔记是三条 **38px 无内框折叠行**，只有 1px 分隔线，无圆角、无底色。
- [ ] 折叠行整行可点，箭头 0°→90°，展开 220ms，长内容不跳。
- [ ] 「定位原文」「练习此卡」是 13/500 文本按钮，无边框；与「出处」同一基线、操作右对齐。
- [ ] 右上角无孤立方块；`⋯` 默认隐形，hover / focus-within 120ms 淡入。
- [ ] 收藏在 `⋯` 菜单内（文案随状态切换）；卡片无常驻收藏按钮。
- [ ] 标签为 22px 无边框 chip（学科 1 + 知识点 ≤3，超出 +N）。
- [ ] 字重：标题 600 / 控件 500 / 正文 400；无中文 700。
- [ ] compact（Live Preview）为只读缩略卡，无折叠/工具。

### 12.2 题库 · 页头与筛选

- [ ] 页头有「题库」+「全部题目 · N 题」+ 搜索 + 主 CTA（到期>0 显示「继续上次复习 · 今日已作答 N 题」）。
- [ ] 6 个状态 chip：全部题目 / 到期复习 / 已收藏 / 未练 / 需完善 / 错题，**计数与列表数量一致**（附录 A 口径）。
- [ ] 状态 chip 单选、`aria-pressed` 正确；计数可重叠（到期且错题）。
- [ ] 科目下拉、标签多选 chips、排序、清除均生效，且与现有 `filterCards/sortCards` 一致。
- [ ] PDF 字段只做行内小标签，不提供筛选。

### 12.3 题库 · 三种视图

- [ ] 分段控件「题卡流 / 紧凑表格 / 独立复习」可切换，`role="tablist"`，`←/→` 可用。
- [ ] 题卡流在 ≥1024px 为**双列**，<1024px 单列；卡片按内容自然高度。
- [ ] 每卡展示：标签、题干（2 行）、状态、出处、复习日期/到期、查看详情。
- [ ] 点击卡片主体 → 打开练习抽屉并开始该题（现有 `viewing→revealed→rated` 流程）。
- [ ] 「查看详情」→ 打开源笔记并定位题卡首行（只读，不改原文）。
- [ ] 紧凑表格列齐全、行 46px、吸顶表头、点行可练习。
- [ ] 独立复习保留今日到期分组、每日上限顺延、按科目组卷、时间记录。

### 12.4 练习 / 复习保留与门禁

- [ ] 练习抽屉内容等于现有练习面板；未揭晓不渲染评分条、不响应 `1–4`、不写 data.json（H4 不变）。
- [ ] 桌面 ≥1440 练习为右侧分栏；<1440 为覆盖抽屉；<720 为全屏 sheet 且 `role="dialog"`。
- [ ] 关闭抽屉不丢当前会话；Esc 可关；焦点回到触发卡。
- [ ] 复习算法、组卷规则、时间记录口径完全不变。

### 12.5 视觉 / 主题 / 响应式

- [ ] 暗色页面底 `#1a1a1e`，卡片 `#232327`；亮色底 `#f4f4f6`，卡片 `#fff`。
- [ ] 卡片无投影；只有菜单有 `--pd-shadow`。
- [ ] 亮暗主题均正确；`theme: mubu-dark` 兼容为强制暗色。
- [ ] `prefers-reduced-motion` 下无位移/缩放（1ms）。
- [ ] 触摸设备（`hover:none`）工具常驻、无 hover-only 操作。
- [ ] 100% / 125% / 150% 缩放无文字截断；<720px 布局不溢出。

### 12.6 无回归（硬约束）

- [ ] `src/core/**` 与 `data.json` 无 diff；无新增字段；`schemaVersion` 不变。
- [ ] 解析、qid/instanceKey、H1–H4、四档评分、复习日期全部与 `DESIGN.md` 一致（跑现有 `npm.cmd test` 全绿）。
- [ ] `examples/zaptrace-demo.md` 未被修改。
- [ ] 卸载插件后无 `--pd-*` 变量、无浮层、无 body 类残留。

---

## 13. Obsidian 1.14.5 真机截图步骤

> 目的：产出可复核的「改版前 / 改版后」截图。全程只读用户笔记，不改 `examples/zaptrace-demo.md`。

### 13.1 环境准备

1. 确认版本：Obsidian → 设置 → 关于 → 当前版本应为 **1.14.5**（记录版本号与安装包路径）。
2. 构建：在 `Kane_Obsidian_Plugins/ZapTrace` 执行 `npm.cmd run build`（Windows）；确认产出 `main.js`。
3. 安装：把 `main.js`、`manifest.json`、`styles.css` 复制到 `<vault>/.obsidian/plugins/zaptrace/`，`Ctrl+R` 重载，设置 → 第三方插件启用 ZapTrace。
4. 准备演示数据（**不修改 demo 文件**）：
   - 复制 `examples/zaptrace-demo.md` 到 vault（只读使用）；
   - 另建一个 `zt-fixtures.md`（临时测试笔记，截图后可删）包含：缺答案卡（触发「需完善」）、重复 `id` 卡（触发重复隔离）；
   - 用题库对 2–3 张卡评分（产生 `due` / `lapses`），使「到期复习 / 错题」计数非 0；
   - 收藏 1 张卡（使「已收藏」非 0）。

### 13.2 截图清单（每张记录：主题 / 缩放 / 窗口尺寸）

| # | 场景 | 操作 | 期望 |
| --- | --- | --- | --- |
| S1 | 阅读卡折叠（暗） | 打开 demo 阅读视图，滚到第一张卡 | 单层边、chips、三条 38px 折叠行、无内框、无孤立收藏 |
| S2 | 阅读卡展开（暗） | 点「答案」「个人笔记」 | 展开内容无背景无边框，箭头旋转，长公式不跳 |
| S3 | 阅读卡 hover 工具 | 鼠标移入卡片 | `⋯` 120ms 淡入；菜单含收藏/打开原文/复制 |
| S4 | 阅读卡（亮） | 切亮色主题 | 颜色为亮色令牌，对比度 ≥4.5:1 |
| S5 | 题库 · 题卡流双列（暗） | 打开工作台，默认题卡流 | 页头 + 6 状态 chips（带计数）+ 筛选 + 双列卡片 |
| S6 | 题库 · 状态筛选 | 点「到期复习」「错题」 | 列表/计数联动正确、可重叠 |
| S7 | 题库 · 紧凑表格 | 切「紧凑表格」 | 46px 行、吸顶表头、点行进入练习 |
| S8 | 题库 · 独立复习 | 切「独立复习」 | 今日到期分组 + 时间记录 + 按科目组卷 |
| S9 | 练习抽屉（桌面 ≥1440） | 点任一卡 | 右侧 420px 分栏练习；未揭晓无评分条 |
| S10 | 练习抽屉（<1440） | 缩窗到 1280 | 覆盖抽屉 + 遮罩 |
| S11 | 窄屏 / 移动 | 窗口 700px 或 DevTools 移动模拟 | 单列；页头堆叠；chips 横向滚动；练习全屏 sheet |
| S12 | 触摸无 hover | DevTools 勾选触摸模拟 | 卡片工具常驻可见 |
| S13 | 键盘焦点 | `Tab` 遍历 | 2px accent 焦点环；`/` 聚焦搜索；`1–4` 仅 revealed 生效 |
| S14 | reduced-motion | DevTools 模拟 `prefers-reduced-motion: reduce` | 无位移/缩放动画 |
| S15 | 空态 | 筛选到无结果 / 清空 vault 副本 | 「没有符合条件的题」「还没有题卡」两套空态 |
| S16 | 计算样式抽查 | DevTools 检查 `.pd-card` / `.pd-fold-head` | 卡片 border 1px、无 box-shadow；折叠行 38px、background 透明 |

### 13.3 截图规范

- 每张保存为 `docs/screenshots/v2-<S编号>-<theme>-<width>.png`（新建目录，不影响其他文件）。
- 同时在 `docs/screenshots/v2-notes.md` 记录：Obsidian 版本、插件版本（`manifest.json`）、构建时间、系统缩放、主题。
- 对比图：S1/S5 与附件图 1/图 4（改前）并排；S5 与参考图 2 并排说明差异（无选项渲染的原因）。

---

## 附录 A · 状态派生（纯函数，**不新增字段**）

> 全部基于现有 `QuestionCard` / `QuestionState` / `ReviewLogEntry`；实现放 `src/core/` 之外的**视图辅助纯函数**即可（或 `src/core/format.ts` 扩展，仍无 obsidian 依赖）。

```ts
type LibStatus = "needsFix" | "due" | "mistake" | "unlearned" | "planned" | "normal";

function isNeedsFix(card) {
  return (
    card.errors.length > 0 ||
    card.duplicateId === true ||
    card.stem.trim() === "" ||
    card.answer.trim() === ""
  );
}

function libStatus(card, state, today): LibStatus {
  if (isNeedsFix(card)) return "needsFix";
  if (state?.due && state.due <= today) return "due";
  if ((state?.lapses ?? 0) > 0) return "mistake";
  if (!state || state.step === -1) return "unlearned";
  if (state.due) return "planned";
  return "normal";
}

// 状态 chip 计数（互不排斥，可重叠）
function counts(cards, data, today) {
  let due = 0, starred = 0, unlearned = 0, needsFix = 0, mistake = 0;
  for (const c of cards) {
    const s = data.questions[c.qid];
    if (s?.due && s.due <= today) due++;
    if (s?.star) starred++;
    if (!s || s.step === -1) unlearned++;
    if (isNeedsFix(c)) needsFix++;
    if ((s?.lapses ?? 0) > 0) mistake++;
  }
  return { all: cards.length, due, starred, unlearned, needsFix, mistake };
}

// 主 CTA 今日已作答数（现有 reviewLog，无新字段）
function todayAnswered(data, today) {
  return data.reviewLog.filter((e) => e.at.slice(0, 10) === today).length;
}
```

状态 chip 映射：

| LibStatus | 文案 | 样式 |
| --- | --- | --- |
| `needsFix` | 需完善 | `.pd-status.is-fix`（red-soft / red） |
| `due` | 到期 | `.pd-status.is-due`（amber-soft / amber） |
| `mistake` | 错题 | `.pd-status.is-mistake`（red-soft / red） |
| `unlearned` | 未练 | `.pd-status.is-new`（5% / muted） |
| `planned` | 已排期 | `.pd-status.is-planned`（green-soft / green），后缀「复习 YYYY-MM-DD」 |
| `normal` | 已掌握 | 不显示状态 chip（或绿色 ·） |

卡片脚注日期文案（复用现有 `dueBadge` 的语义）：

- `due < today` → `已到期 N 天`；`due == today` → `今天到期`；`due > today` → `复习 YYYY-MM-DD`；无 `due` → `未练`。

---

## 附录 B · 组件类名索引

| 类名 | 角色 |
| --- | --- |
| `.pd-root` | 令牌作用域 |
| `.pd-workbench` | 题库工作台根 |
| `.pd-lib-header` / `.pd-h1` / `.pd-count` / `.pd-header-actions` | 页头 |
| `.pd-search` / `.pd-input` / `.pd-select` / `.pd-field` / `.pd-label` | 表单控件 |
| `.pd-statusbar` / `.pd-chip`（筛选） | 状态筛选 |
| `.pd-filterbar` / `.pd-tagfilter` | 筛选区 |
| `.pd-seg` | 分段控件 |
| `.pd-content` | 视图内容区 |
| `.pd-grid` / `.pd-qcard` / `.pd-qcard-head` / `.pd-qcard-stem` / `.pd-qcard-foot` / `.pd-qcard-tools` / `.pd-qcard-detail` | 题卡流 |
| `.pd-table` / `.pd-trow` / `.pd-trow-main` / `.pd-trow-title` / `.pd-trow-meta` | 紧凑表格 |
| `.pd-review-*` / `.pd-group-*` / `.pd-log-*` | 独立复习 |
| `.pd-drawer` | 练习抽屉 |
| `.pd-card` / `.pd-card-head` / `.pd-tags` / `.pd-tag` / `.pd-stem` / `.pd-folds` / `.pd-fold` / `.pd-fold-head` / `.pd-fold-body` / `.pd-fold-content` / `.pd-fold-chevron` / `.pd-fold-count` / `.pd-card-foot` / `.pd-source` / `.pd-actions` | 阅读卡 |
| `.pd-btn` / `.pd-btn.is-primary` / `.pd-icon-btn` | 按钮 |
| `.pd-status`（`.is-due/.is-fix/.is-mistake/.is-new/.is-planned`） | 卡内状态 |
| `.pd-menu` / `.pd-menu-item` / `.pd-menu-item.is-danger` | 菜单 |
| `.pd-toggle` | 开关 |
| `.pd-empty` / `.pd-skeleton` / `.pd-divider` | 空态/加载/分隔 |

---

## 附录 C · 与 `pluginDesign.md` / 参考图的取舍

| 来源 | 采用 | 不采用 / 调整 |
| --- | --- | --- |
| pluginDesign §2 令牌 | `--pd-*` 全部颜色/字体/间距/圆角/动效 | — |
| pluginDesign §4.2–4.7 阅读卡 | 单层边、chips、38px 折叠行、`⋯`、文本按钮、收藏进菜单 | — |
| 参考图 2（题库） | 页头（标题+计数+搜索+主 CTA）、状态 chips 带计数、分段三视图、双列卡网格、「查看详情」 | 不渲染 A–D 选项与「待补答案/错因」等无字段项；不引入「全部题型/全部错因」筛选 |
| 参考图 3（折叠） | 默认收起、点击展开的折叠行心智 | 不用其「答案/笔记内嵌大盒」与右上「收藏」文字按钮；改用 38px 无内框行 + `⋯` 菜单 |
| 现有源码 | 复用 `filterCards/sortCards`、`PracticeSession`、`ReviewPanel`、`MarkdownRenderer` 懒渲染、H4 门禁 | 只换外壳与样式，不改逻辑 |

---

*本文只描述视觉与信息架构；解析 / ID / data.json / 评分 / 复习逻辑维持 `DESIGN.md` 的既定契约，本次不改。*
