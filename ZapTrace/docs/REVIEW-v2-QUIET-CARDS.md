# ZapTrace v2 · Quiet Cards 视觉改版验收（REVIEW-v2-QUIET-CARDS）

- 验收对象：`Kane_Obsidian_Plugins/ZapTrace` v0.1.0（v2 Quiet Cards）
- 验收环境：**Obsidian 1.14.5**（`E:\Software\Obsidian\Obsidian.exe`），vault `E:\NoteCache`，系统 1920×1080，暗色主题
- 安装：已把仓库构建产物（`main.js` / `styles.css` / `manifest.json`）覆盖到 `E:\NoteCache\.obsidian\plugins\ZapTrace\`，**保留 `data.json`**（2304B，4 张 demo 卡状态未变）
- 验收方式：静态代码/样式审查 + `npm test` / `typecheck` / 干净副本 `build` + **wincu 真机 UI 冒烟与截图**
- 只写本文档与 `tests/review-v2/**`；不改实现。

---

## 0. 结论

**判定：RELEASE FAIL。**

核心逻辑、构建、单测全部通过；**视觉验收不通过**：Obsidian 原生 `button` 样式未被压住，导致规范要求的「38px 透明扁平折叠行」和「透明文本按钮」在真机渲染成**灰色圆角大按钮**（折叠行实测高 48px），��� `题集表格行主体`、`状态 chip`、`分段按钮`、`图标按钮` 均带原生底色/边框。这与 DESIGN-v2 §4.2 / §11.2（按钮 reset 必须 `!important`）直接冲突，属于阻塞发布的视觉缺陷。另有 3 个次要缺陷（见 §4）。

---

## 1. 命令实证

```
cd Kane_Obsidian_Plugins/ZapTrace
npm.cmd test            → 53 pass / 0 fail（TEST_EXIT=0）
npm.cmd run typecheck   → tsc -noEmit -skipLibCheck exit 0
干净副本 npm ci && npm run build → BUILD_EXIT=0
REPO_main.js_SHA256 = 72F4CF4B4B8F76A599B9D863CABAF2804636CD1E6AD8AD92C4D909259C62CAA0
FRESH_main.js_SHA256= 72F4CF4B4B8F76A599B9D863CABAF2804636CD1E6AD8AD92C4D909259C62CAA0  → MATCH=True
```
- `src/core/**` 与 `src/store/stateStore.ts` 的 mtime 仍为 **15:24:01**（v2 改动集中在 16:14–16:22 的 view/styles/main），佐证「v2 未改 core 数据语义」。
- 安装到 vault 的 `main.js` SHA-256 与仓库一致（`72F4CF4B…CAA0`），`data.json` 保留未动。

---

## 2. 真机 UI 冒烟（Obsidian 1.14.5，暗色，1920×1080）

| # | 场景 | 截图 | 观察 |
|---|---|---|---|
| S1 | 阅读卡默认态（暗） | `tests/review-v2/screenshots/v2-S1-reading-default-dark-1920.png`；局部放大 `v2-S1-crop-card.png` | 卡片单层 1px 边、圆角 14、无投影；学科+知识点 chip 正确；**但「答案 / 个人笔记」折叠行是灰色圆角大按钮**（非 38px 透明扁平行），右侧「定位原文 / 练习此卡」是**原生按钮底色/边框** |
| S2 | 点击「答案」展开（暗） | `v2-S2-reading-answer-expanded-dark-1920.png` | 展开内容正常（无内框、公式/文本显示、箭头旋转）；**折叠行本身仍为原生圆角框**，聚焦时有 2px 蓝环 |
| S5 | 题库 · 题卡流双列（暗） | `v2-S5-library-cards-dark-1920.png` | 页头「题库 + 全部题目·4 题 + 搜索 + 随机练一题」、6 状态 chips（带计数：全部4/到期0/已收藏1/未练4/需完善0/错题0）、科目/排序/Tags/清除、分段控件、**双列卡片**均正确；按钮/chips 仍原生样式。卡片题干预览把 LaTeX 原文（`$...$`）直接当文本显示（见 §4-②），且每卡出现 **「未练 未练」重复**（§4-③） |
| S7 | 题库 · 紧凑表格（暗） | `v2-S7-library-table-dark-1920.png` | 表头/列（题干·科目·标签·状态·复习）齐全、4 行；**行主体是整块原生圆角按钮**；状态与复习均显示「未练」重复 |
| S8 | 题库 · 独立复习（暗） | `v2-S8-review-view-dark-1920.png` | 今日到期 0 +「今日无到期，去练一题?」+ 随机练一题 + 时间记录（近 7 天，暂无记录）结构正确；按钮原生样式 |
| S9 | 练习抽屉（≥1440 右侧分栏） | `v2-S9-practice-drawer-dark-1920.png` | 右侧 420px「练习」分栏、进度 1/1、只显示题干、显示答案/跳过、未揭晓无评分条（H4 正确）；「显示答案」按钮亦为原生样式 |
| S11 | 窄屏 700（覆盖/全屏 sheet） | `v2-S11-narrow-700-drawer-sheet.png` | 窗口缩到 700px 时练习抽屉覆盖显示、内容自适应 |
| S11b | 窄屏 980（单列） | `v2-S11b-narrow-980-single-column.png` | 题卡流降为**单列**、页头换行、状态 chips 横向溢出可滚动——响应式行为正确 |

> 截图为 printwindow/screen-region 原始像素；S1 另存放大裁切用于逐像素确认折叠行/按钮外观。

---

## 3. 代码/样式审查（逐项）

| 项 | 判定 | 证据 / 说明 |
|---|---|---|
| 阅读视图「单层边 + 无内框」 | **PASS** | `styles.css:480-535` `.pd-card` 仅 `border:1px var(--pd-line)`、`box-shadow:none`、折叠区只有上下 hairline |
| 阅读视图「38px 透明折叠行」 | **FAIL（真机）** | CSS `.pd-fold-head`（`styles.css:536-553`）写了 `background:transparent;border:0;height:38px`，但**元素是 `<button>` 且缺 `!important`**；UIA 实测折叠行高 **48px**（见 S1 find 结果 `height:48`），真机呈灰色圆角按钮。Obsidian 原生 `button` 背景/边框/圆角/内边距把它覆盖了 |
| 阅读卡 `⋯` 菜单 / 收藏入菜单 | **PASS（结构）** | `card.ts:54-91` 仅保留 `⋯`，收藏/打开原文/复制题干在菜单；`menu.ts` 有 role/键盘/Esc/外点关闭。真机 `⋯` 也因原生按钮带灰底（同源缺陷） |
| 「定位原文 / 练习此卡」透明文本按钮 | **FAIL（真机）** | `styles.css:182-206` 只对 `button.pd-btn` reset 了 border/box-shadow，**background 未 `!important`**；真机「定位原文」呈原生灰底/边框（S1 裁切图可见） |
| 工作台题库页头 / 计数 / 搜索 / 主 CTA | **PASS** | `libraryPanel.ts:67-111`；真机 S5 正确（CTA 到期=0 时显示「随机练一题」） |
| 6 状态 chips 计数/单选/可重叠 | **PASS** | `libStatus.ts:69-119` `statusCounts` 口径与附录 A 一致；`libraryPanel.ts:320-354` 单选切换 `all`、`aria-pressed`（真机计数 4/0/1/4/0/0 正确） |
| 科目/Tags/排序/清除筛选 | **PASS** | `libraryPanel.ts:356-414` 复用 `filterCards/sortCards`；真机 S5/S7 正常 |
| 分段「题卡流 / 紧凑表格 / 独立复习」 | **PASS（结构）** | `libraryPanel.ts:181-246` `role=tablist/tab/tabpanel`、`←/→` 切换；真机三视图均能切换（S5/S7/S8） |
| 题卡流 ≥1024 双列、<1024 单列 | **PASS** | `styles.css:738` `repeat(2,…)` + `:1298-1301` `<1023` 单列；真机 1920 双列（S5）、980 单列（S11b） |
| 紧凑表格 46px 行 / 吸顶表头 | **CONCERN** | `styles.css:862-...` 有 grid；真机行主体被原生按钮撑大且占满，行高/对齐不达 Quiet Cards 预期（同源按钮缺陷） |
| 独立复习保留现有行为 | **PASS** | `libraryPanel.ts` 复用 `ReviewPanel`；真机 S8 结构/文案正确 |
| 练习抽屉（≥1440 分栏 / <1440 覆盖 / <720 sheet） | **PASS** | `workbenchView.ts:154-179` 按 `window.innerWidth<1440` 切 role；真机 S9 分栏、S11 覆盖 |
| `prefers-reduced-motion` | **PASS（静态）** | `styles.css:1346-1360` 有 reduce 规则压到 1ms |
| `hover:none` 工具常驻 | **PASS（静态）** | `styles.css:1362-1367` `.pd-card-tools/.pd-qcard-tools{opacity:1}`；真机因原生按钮仍显框（同源） |
| `--pd-*` 令牌 / 暗亮 | **PASS（静态）** | `styles.css:8-111` 暗色默认 + `body.theme-light` 亮色令牌，值与 DESIGN-v2 §2 一致；**本轮只实机截了暗色**，亮色未截图（建议补） |
| ARIA 语义 | **PASS（静态，含小缺）** | tabs/chips/折叠/菜单/表 list 均有 role；但 `aria-controls` 指向的折叠行仍按按钮渲染（视觉缺陷不影响语义） |
| 不改 core 数据语义 / 不写 Markdown | **PASS** | core 文件 mtime 15:24 未动；`npm test` 53 全绿；全仓库仍只有「插入模板」写正文、`saveData` 写 data.json |
| 不新增 data 字段 / schemaVersion 不变 | **PASS** | `src/core/types.ts` 未改；`data.json` schemaVersion=1 |

---

## 4. 缺陷清单（按阻塞性）

### ① 阻塞 · 原生 `button` 样式未压制（折叠行/文本按钮/表格行/chips/seg/图标按钮全部受影响）
- **现象**：DESIGN-v2 §4.2 要求「38px 透明无内框折叠行」「13/500 无边框文本按钮」，真机为**灰色圆角大按钮**；UIA 实测折叠行高 **48px**（规范 38px）。`定位原文` 呈原生灰底；表格行主体是整块圆角按钮；状态 chip/分段按钮/图标按钮均带原生底边。
- **根因**：`styles.css:182-186` 只对 `button.pd-btn, button.pd-icon-btn` 设 `border:0!important; box-shadow:none!important`，**未含 `background`**；`.pd-fold-head`（:536）、`.pd-trow-main`、`.pd-chip`、`.pd-seg-btn` 等 `<button>` 完全没有对原生 `background/border/box-shadow/height` 的 `!important` 重置。Obsidian 的 `button`/`.theme-dark button` 规则胜出。
- **精确修复（CSS）**：
  ```css
  /* 全局按钮复位（放在 pd 令牌之后、组件之前） */
  .pd-root button {
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
    border-radius: 0;           /* 具体组件再覆盖 */
    font-family: var(--pd-font);
  }
  /* 关键组件再显式声明规格（!important 对抗原生） */
  button.pd-fold-head {
    height: var(--pd-row-h) !important;   /* 38px */
    padding: 0 2px !important;
    background: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  button.pd-btn:not(.is-primary) {
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
  }
  button.pd-btn.is-primary { background: var(--pd-accent-soft) !important; }
  button.pd-trow-main { background: transparent !important; border: 0 !important; box-shadow: none !important; height: auto !important; }
  button.pd-seg-btn { background: transparent !important; border: 0 !important; box-shadow: none !important; }
  button.pd-chip { border: 0 !important; box-shadow: none !important; }  /* 保留背景由组件设 */
  ```
  并复验：DevTools/取值确认 `.pd-fold-head` `height=38px`、`background=transparent`、`border=0`；`.pd-btn:not(.is-primary)` `background=transparent`。

### ② 中 · 题卡流把 LaTeX 源码当纯文本显示
- **现象**：S5 卡片题干显示 `求 $f(x)=x^{2}$ … $$ \lim_{\Delta x\to0}… $$` 原文，线性代数卡显示 `$A=\begin{pmatrix}1&2\\3&4\end{pmatrix}$`。
- **原因**：`libraryPanel.ts:471-474` `stem.textContent = card.stem`（纯文本）。
- **建议**：卡片预览用清洗后的题干（去掉 `$…$`/`$$…$$` 定界符或做轻量渲染），至少不把原始 TeX 当正文展示；性能敏感可只对前 2 行做轻量 MathJax。

### ③ 低 · 「未练」重复显示 & 「继续练习」不该常驻
- **现象**：每张题卡/表格行状态列显示 **「未练 未练」**（`libStatus.dueLine` 与状态 chip 都返回「未练」）。
- **建议**：`dueLine` 在无 `due` 时返回空串（或状态 chip 为「未练」时脚注不重复）。
- **现象**：底部「继续练习」在无会话/抽屉关闭时仍显示（S5/S7/S8 右下角）。
- **原因**：`.pd-btn{display:inline-flex}` 覆盖了 `hidden` 属性的 `display:none`。
- **修复**：`.pd-resume[hidden]{display:none!important}`（或统一 `.pd-root [hidden]{display:none!important}`）。

---

## 5. 影像证据清单

| 文件 | 说明 |
|---|---|
| `tests/review-v2/screenshots/v2-S1-reading-default-dark-1920.png` | 阅读卡默认（暗） |
| `tests/review-v2/screenshots/v2-S1-crop-card.png` | 卡片放大（折叠行/按钮像素证据） |
| `tests/review-v2/screenshots/v2-S2-reading-answer-expanded-dark-1920.png` | 答案展开（暗） |
| `tests/review-v2/screenshots/v2-S5-library-cards-dark-1920.png` | 题库题卡流双列（暗） |
| `tests/review-v2/screenshots/v2-S7-library-table-dark-1920.png` | 紧凑表格（暗） |
| `tests/review-v2/screenshots/v2-S8-review-view-dark-1920.png` | 独立复习（暗） |
| `tests/review-v2/screenshots/v2-S9-practice-drawer-dark-1920.png` | 练习抽屉（≥1440 分栏） |
| `tests/review-v2/screenshots/v2-S11-narrow-700-drawer-sheet.png` | 窄屏 700 抽屉覆盖 |
| `tests/review-v2/screenshots/v2-S11b-narrow-980-single-column.png` | 窄屏 980 单列 |

---

## 6. 发布判定

- **RELEASE FAIL**：视觉阻塞缺陷 ①（原生按钮样式未压制）必须修复；②③ 建议同批修复。
- 复验建议：修 CSS 后重新构建、覆盖安装 `E:\NoteCache\.obsidian\plugins\ZapTrace`，重截 S1/S2/S5/S7（重点看折叠行 38px 透明、按钮无底无边、表格行不高耸），通过后可判 RELEASE PASS。
- 核心功能（解析/ID/评分/复习/data.json/门禁/构建）本轮**无回归**，问题集中在 CSS 选择器优先级与少量文案/布局细节。

*Obsidian 版本 1.14.5；插件版本 0.1.0；构建 main.js SHA-256 = 72F4CF4B…CAA0；系统缩放 100%。*

---

## 7. 复审结论（Round 2 · 修复复核）

- 复审时间：2026-11-02 16:46（Asia/Shanghai）
- 复审对象：task_mvz0411wdr4l4n 的修复；环境仍为 **Obsidian 1.14.5 / vault E:\NoteCache**，暗色 100%。
- 安装：已重新构建并覆盖 `main.js` / `styles.css` / `manifest.json` 到 `E:\NoteCache\.obsidian\plugins\ZapTrace`，**保留 data.json（2304B 未动）**；随后用「重新加载 Obsidian（不保存）」真正重载，确认新 CSS 生效。
- 构建指纹：`main.js` SHA-256 = **9F78B105CB3FB72238ACF9017C667400CB4701D69FF4C9C45BC10D6B5044D1F9**（干净副本重建后与仓库一致，MATCH=True）。

### 7.1 命令实证
```
npm.cmd test            → 53 pass / 0 fail（TEST_EXIT=0）
npm.cmd run typecheck   → tsc -noEmit -skipLibCheck exit 0
干净副本 npm ci && npm run build → BUILD_EXIT=0
REPO main.js = 9F78B105…D1F9
FRESH main.js= 9F78B105…D1F9   MATCH=True
```

### 7.2 逐项复核（对照 §4）

| 项 | 判定 | 证据 |
|---|---|---|
| ①a 折叠行实际高度 = 38px | **PASS** | DevTools 计算样式：`.pd-fold-head` computed **height: 38px**；可见实例 `getBoundingClientRect().height` 序列 = **`0,0,0,38,38`**（3 个隐藏/离屏为 0，2 个可见均为 38）。截图 `v2-R2-computed-style.png` / `v2-R2-computed-heights.png` |
| ①b 折叠行背景透明、border 0 | **PASS** | 计算样式 `backgroundColor: rgba(0,0,0,0)`、`borderTopWidth: 0px`、`borderBottomWidth: 0px`、`padding: 0px`、`box-sizing: border-box`；真机 S1/S2 折叠行为扁平发丝分隔行（`v2-R2-S1-reading-default-dark-1920.png`、`v2-R2-S1-crop-card.png`、`v2-R2-S2-reading-answer-expanded-dark-1920.png`） |
| ①c 定位原文/练习此卡为文本按钮、无原生底边 | **PASS** | 全局 `.pd-root button{background:transparent!important;border:0!important;box-shadow:none!important}` + `button.pd-btn:not(.is-primary){background:transparent!important}`；S1 裁切图显示「定位原文」纯文本、「练习此卡」accent 文本，无原生灰底/边框 |
| ② 表格行主体不被原生按钮撑大 | **PASS** | `button.pd-trow-main{background:transparent!important;border:0!important;height:auto!important;…}`；S7 行高约 46px、行主体为普通文本，不再是整块圆角按钮（`v2-R2-S7-library-table-dark-1920.png`） |
| ③a 卡片预览无原始 `$...$`/TeX | **PASS** | 新增 `src/view/plainText.ts`（去 `$…$`/`$$…$$`/TeX 命令/花括号），`libraryPanel.ts:465,585` 预览改用 `toPreviewText`；S5 显示「求 在 处的导数，并写出定义式。」无 `$f(x)=x^{2}$`/`\begin{pmatrix}`（`v2-R2-S5-library-cards-dark-1920.png`） |
| ③b 无「未练 未练」重复 | **PASS** | `libStatus.ts:52-53` 无 due 返回空串；S5/S7 每行仅一个「未练」状态 chip，复习列为空 |
| ③c 关闭抽屉后「继续练习」不常驻 | **PASS** | 新增 `.pd-root [hidden]{display:none!important}`（修复 `.pd-btn{display:inline-flex}` 覆盖 `[hidden]`）；S5/S7 右下角无「继续练习」按钮 |
| 结构未回归 | **PASS** | 阅读卡单层边/标签、题库页头+6 状态 chips 计数、筛选、分段、双列、紧凑表格均正常（S1/S2/S5/S7） |
| core 语义 / 不写 Markdown 未变 | **PASS** | `src/core/**` 未改（仍 mtime 15:24）；`npm test` 53 全绿；仍只有「插入模板」写正文 |

### 7.3 本轮截图证据
| 文件 | 说明 |
|---|---|
| `tests/review-v2/screenshots/v2-R2-S1-reading-default-dark-1920.png` | 阅读卡默认（暗，修复后） |
| `tests/review-v2/screenshots/v2-R2-S1-crop-card.png` | 卡片放大（折叠行扁平/文本按钮像素证据） |
| `tests/review-v2/screenshots/v2-R2-S2-reading-answer-expanded-dark-1920.png` | 答案展开（暗） |
| `tests/review-v2/screenshots/v2-R2-S5-library-cards-dark-1920.png` | 题库题卡流双列（LaTeX 已清洗、无重复未练、无继续练习） |
| `tests/review-v2/screenshots/v2-R2-S7-library-table-dark-1920.png` | 紧凑表格（行主体不再高耸、状态单列） |
| `tests/review-v2/screenshots/v2-R2-computed-style.png` | DevTools 计算样式（height 38px / 透明 / border 0） |
| `tests/review-v2/screenshots/v2-R2-computed-heights.png` | 可见折叠行 rect 高度序列 `0,0,0,38,38` |

### 7.4 残余（非阻塞，可选优化）
1. 题干预览去除行内公式后留下空格（如「求 在 处的导数」），语义可读性略降；建议后续用「⋯」或轻量公式占位替换。
2. 紧凑表格「题干」表头与题干列有轻微对齐偏差（视觉细节），不影响使用。

> **复审最终结论：RELEASE PASS。** §4 阻塞① 与次要②③ 均已关闭；核心逻辑/构建/单测零回归。上述残余为可选优化。

---

## 8. 最终打磨复核（Fast Re-check · 2026-11-02 16:5x）

**结论：FINAL RELEASE PASS。** 沿用 §7 的 RELEASE PASS，本轮只做快速复验，未发现回归；未修改实现。

| 项 | 证据 |
|---|---|
| 构建 | 仓库重建后 `main.js` = **117,783 B**，SHA-256 `B4EAB3E03AA255079C8F7DA707DDF85DFBFC1D7BBF7C3AC467FF32DAEB6AC62E`；`styles.css` `D589E898…F52150C5`；`manifest.json` `2C51B8D5…4C32E2` |
| 命令 | `npm.cmd test` → **53 pass / 0 fail**；`npm.cmd run typecheck` → exit 0；`npm.cmd run build` → exit 0 |
| 部署 | 三件套覆盖到 `E:\NoteCache\.obsidian\plugins\ZapTrace`，部署后三文件 SHA 与仓库**逐一相同** |
| data.json | 部署前后 SHA-256 均为 `68BC8765350DB6B42FD228E8562CBCD1496DBAF7D54B90C4211B776C6F7F13AE`，2304 B，mtime 仍为 `16:53:50`；4 张 demo 卡状态未变、`reviewLog` 仍为空 |
| plainText 预览 | 代码实证 `toPreviewText`：`求 f(x)=x^2 在 x=1 处的导数，并写出定义式。 〔公式〕`；`判断矩阵 〔矩阵〕 是否可逆。`；纯公式题 → `（公式题）`。真机题库题卡流显示 `求 f(x)=x^2 在 x=1 处的导数，并写出定义式。 〔公式〕` 与 `判断矩阵 〔矩阵〕 是否可逆。`，无原始 `$…$`/`\begin{pmatrix}` |
| 紧凑表格题干左对齐 | CSS：`.pd-thead{justify-items:start}`、`.pd-thead span{text-align:left;justify-self:start}`、`button.pd-trow-main{text-align:left!important}`、`.pd-trow-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`；真机切到「紧凑表格」，表头「题干」与 4 行题干均**左对齐**，行主体无原生按钮框 |
| 工作台/阅读卡实看 | 工作台：题库 + 全部题目·4 题 + 状态 chips（4/0/1/4/0/0）+ 三段控件 + 双列卡；阅读卡：单层 1px 边、38px 扁平折叠行（答案/个人笔记）、文本按钮「定位原文/练习此卡」、`⋯`，无大描边框 |
| 实现未改 | 本轮只跑构建与部署、只读查看；源码 mtime 未变（styles 16:51 / main 16:52）；本轮仅追加本节到 `REVIEW-v2-QUIET-CARDS.md` |

> §7.4 的两项残余（行内公式去符号后的空格、表头与列的轻微对齐偏差）仍为**非阻塞可选优化**，不影响发布。
