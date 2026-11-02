# ZapTrace 首版实现验收（REVIEW-implementation）

- 验收对象：`D:\Files\Agent_WorkSpace\Learning\Kane_Obsidian_Plugins\ZapTrace`（v0.1.0）
- 验收人：独立验收成员（reviewer）
- 验收方式：通读全部 `src/**`、`styles.css`、`README.md`、`examples/`、`manifest.json`；**实际运行** `npm.cmd test` / `npm.cmd run typecheck` / 干净副本 `npm.cmd run build`；另建独立测试 `tests/review-independent/review.extra.test.ts` 复核边界。
- 不修改开发实现；仅新增 `tests/review-independent/**` 与本文档。
- 说明：本验收为**静态审查 + 核心单测 + 构建复现**；未在真实 Obsidian 运行时里跑 UI 冒烟（无可用 vault/GUI 会话），视觉/ARIA/交互的最终确认见 §6 建议人工项。

---

## 0. 总体结论

**判定：PASS（有条件通过）。核心闭环、数据安全、构建与核心单测全部通过；发布前必须修复 2 项、建议修 1 项（见 §3）。**

### 验收评分表

| # | 验收项 | 判定 | 证据（命令 / 文件:行） |
|---|---|---|---|
| 1 | 全部源码/样式/README/示例已检查 | PASS | 已读 12 个 core + 10 个 view/store/main + styles + README + examples |
| 2 | `npm test` 实际运行 | **PASS** | 43 开发用例 + 8 独立用例 = **51 pass / 0 fail**，exit 0 |
| 3 | `npm run build` 实际运行 | **PASS** | 干净副本 `npm ci && npm run build` exit 0；产物 `main.js` SHA-256 与仓库内一致 |
| 4 | manifest / main.js / styles.css 齐全 | **PASS** | manifest 361B、main.js 92411B（CJS banner）、styles.css 16374B |
| 5 | TypeScript 无跳过错误 | **PASS** | `tsc -noEmit` exit 0；全仓库无 `@ts-ignore/@ts-expect-error/@ts-nocheck/eval` |
| 6 | 核心单测是否有效 | **PASS** | 覆盖 SHA-1 向量、附录 B 全 12 条、日期边界、解析器、H1/H2 去重、迁移/损坏/只读、裁剪、recordReview、Star、筛选/排序、H4 门禁 |
| 7 | 扫描避免代码块嵌套误判 | **PASS** | `parse.ts:274-314` 跟踪所有反引号围栏；用例「文档示例块里的 zaptrace 不进入索引」+ 我的 REVIEW-D（5/4 嵌套）通过 |
| 8 | ID 对同文重复题稳定 | **PASS** | `index.ts:55-100` 索引键/状态键分离 + 确定性消歧；用例 + 我的 REVIEW-A（跨文件、乱序）通过 |
| 9 | MarkdownRenderer 组件生命周期清理 | **CONCERN** | `card.ts:16`、`main.ts:44` 统一传 **插件实例** 作 component；重渲染时旧渲染的 child 不随 DOM 清理 → 会话内累积（详见 §3-①） |
| 10 | 折叠与评分门控 | **PASS** | `core/practice.ts` 三态机；`practicePanel.ts:45-65,120-208`；答案 DOM 仅揭晓后注入、无揭晓不渲染评分条；用例 H4 + 我的 REVIEW-F 通过 |
| 11 | Star / 筛选 / 到期队列 | **PASS** | Star `card.ts:41-58`、`libraryPanel.ts:323-338`；筛选/排序 `core/filter.ts`；到期队列 `reviewPanel.ts:21-49`；单测覆盖 |
| 12 | 来源跳转（出处 → 源文件行） | **CONCERN** | 全仓库无 `openLinkText/setCursor/openFile`；题卡出处仅纯文本（`card.ts:145-148`）。README:12「可跳回源文档练习」与实现不符（详见 §3-②） |
| 13 | data.json 损坏与迁移 | **PASS** | `core/state.ts:199-328` 安全模式/只读/迁移、未知字段保留；`store.test.ts` 全绿；我的 REVIEW-E 通过 |
| 14 | 绝不写原 Markdown | **PASS** | 唯一写 `.md`：`main.ts:92` 用户显式「插入题卡模板」；其余全 `saveData`；仅 `main.ts:380` 写插件目录备份 |
| 15 | 卸载清理 | **CONCERN** | `main.ts:129-136` 清定时器/刷盘/卸视图；但 `applyTheme`（`main.ts:206-211`）挂的 `body.zaptrace-mubu-dark` **卸载时不移除** → 残留类名 |
| 16 | ARIA / reduced-motion / 亮暗 / 窄屏 | **PASS**（含小 CONCERN） | `dom.ts` aria-expanded/controls、`ratingBar.ts` radiogroup/radio、`workbenchView.ts` tablist；`styles.css:841-855` reduced-motion、`795-838` <900 单栏+Tab、`35-48` mubu-dark；小问题：Tab 无 `aria-controls/tabpanel` |
| 17 | 无网络 / AI / PDF / 批注越界 | **PASS** | 全仓库无 `fetch/requestUrl`；PDF 仅占位（`types.ts:42`、`libraryPanel.ts:87-101`）；无 AI 调用、无批注模块 |

---

## 1. 命令实证（可复现）

### 1.1 单元测试（仓库内，只读）
```
> zaptrace@0.1.0 test
> node --test "tests/**/*.test.ts"
ℹ tests 51
ℹ pass 51
ℹ fail 0
TEST_EXIT=0
```
（43 条为开发用例；其中 8 条为本次独立新增 `REVIEW-A..H`。）

### 1.2 类型检查
```
> tsc -noEmit -skipLibCheck
TYPECHECK_EXIT=0
```
补充：`tsconfig.json` `strict:true`、`noImplicitAny:true`；`grep @ts-ignore|@ts-expect-error|@ts-nocheck` 在 `src/` 无命中。

### 1.3 构建（干净副本，不污染开发产物）
```
robocopy ZapTrace → %TEMP%\zt-build-check（排除 node_modules）
npm.cmd ci            → NPMCI_EXIT=0
npm.cmd run build     → BUILD_EXIT=0（tsc -noEmit + esbuild production）
REPO_main.js_SHA256 = 6898F9554627623E81F0801914AB01F3B1BE7416048E2D9519AA7B7474AB6D49
FRESH_main.js_SHA256= 6898F9554627623E81F0801914AB01F3B1BE7416048E2D9519AA7B7474AB6D49
MATCH=True
```
结论：仓库内 `main.js` 就是当前 `src/` 的**新鲜构建产物**，构建可复现；无需先构建即可发布三件套。

### 1.4 产物齐全
| 文件 | 大小 | 说明 |
|---|---|---|
| `manifest.json` | 361 B | id=zaptrace / version=0.1.0 / minAppVersion=1.5.0 / isDesktopOnly=false |
| `main.js` | 92 411 B | esbuild CJS，首行 banner 正确 |
| `styles.css` | 16 374 B | 幕布令牌 + reduced-motion + 移动端媒体查询 |

---

## 2. 逐项审查要点（补充证据）

- **解析器（`core/parse.ts`）**：H3 头部边界修正到位——只有首行匹配 `^[A-Za-z][A-Za-z0-9_-]*\s*:` 才进入头部（`parse.ts:87-115`）；无头部题干里的 `---` 安全（用例 H3 通过）。分节宽松匹配 `#{3,}` + 允许空格/缩进（`parse.ts:20,125-152`）+ `dedentLines`（`parse.ts:38-51`）。空块忽略、缺答案报错不阻断（`parse.ts:213-215`）。
- **围栏扫描（`parse.ts:274-314`）**：遇到任意反引号开栏即跳到其合法闭栏，非 zaptrace 块整体跳过 → 文档示例里的 ````zaptrace 不会被误索引（用例「文档示例块…」通过；我的 5/4 嵌套 REVIEW-D 通过）。
  - 限制：不支持 `~~~` 波浪号围栏（CommonMark 允许），`~~~zaptrace` 不会被识别。属已知边界，非本版要求。
- **ID/去重（`core/id.ts`、`core/index.ts:55-100`）**：自动 ID 只依赖规范化题干（`id.ts:10-28`）；索引键 `${file}#${blockIndex}` 与 qid 分离（`types.ts:26-37`）；重复组按 `key` 字典序确定性归属，与 `getMarkdownFiles()` 顺序无关（`index.ts:65-96`）→ H1/H2 落实。我的 REVIEW-A（跨文件同文、乱序输入）验证一致。
- **评分/日期（`core/scheduler.ts`、`core/date.ts`）**：转移表与公式逐格一致（`scheduler.ts:41-59`），`clampStep` 防越界（`:22-28`）；日期用 `Date.UTC` 日历分量运算（`date.ts:39-46`），无 `+86400000`。单测 12 条向量 + 5 边界全绿。
- **状态与迁移（`core/state.ts`）**：`migrateData` 处理缺失/非对象/版本过新/结构损坏，安全模式下 `readOnly` 且绝不写盘；未知字段（顶层/settings/问句/meta）逐层保留（`:93-96,141-160,294-316`）。`store/stateStore.ts:35-52` 迁移前备份；`markDirty/saveNow` 只读时丢弃写（`:60-95`）。`store.test.ts` + 我的 REVIEW-E 通过。
- **练习门控（`core/practice.ts`）**：`viewing→revealed→rated`；`rate()` 非 revealed 直接返回 null、不调用 `recordReview`（`practice.ts:81-89`）；`practicePanel.handleKeydown` 仅 `canRate` 时接受 1–4（`practicePanel.ts:45-65`），且输入框内不处理（`:67-71`）；答案/评分条仅在揭晓后渲染（`:120-208`）。H4 用例 + REVIEW-F 通过。
- **数据安全**：`grep vault.modify|vault.append|vault.create|vault.process` 无命中；唯一 `adapter.write` 是备份（`main.ts:377-381`）；唯一写正文是插入模板命令（`main.ts:88-94`）。
- **索引同步防写放大（`main.ts:281-311`）**：先算签名再决定 `markDirty`，`subject/tags/source` 变化才落盘（C11 落实）。

---

## 3. 必须修复项（发布前，按优先级）

### ① 高｜MarkdownRenderer 组件未按「渲染实例」清理（内存/句柄累积）
- **现象**：`card.ts:15-17`、`practicePanel.ts:110-162` 与 `main.ts:44-46` 一律把**插件实例 `this`** 作为 `MarkdownRenderer.render(...)` 的 `component`。每次重渲染（切换题、每次评分后 `render()`、每次 `rebuildIndex→refreshAll`、阅读视图代码块重渲染）都会向插件注册新的渲染 child，而 `clearElement`（`dom.ts:123-125`）只删 DOM、不会 unload 这些 child。长会话下 child/句柄累积，属真实泄漏。
- **影响**：功能性不立即出错，但长时使用内存与事件累积；也是 Obsidian 官方建议避免的用法。
- **精确修复建议**：
  1. 阅读视图（`registerMarkdownCodeBlockProcessor`）回调里改用 **`ctx`** 关联生命周期：为每个代码块创建 `const child = new MarkdownRenderChild(el); ctx.addChild(child);`，并把 `child` 传给 `MarkdownRenderer.render(app, text, el, sourcePath, child)`；块移除时 Obsidian 自动 unload。
  2. 工作台/面板：为每次 `render()` 创建一个新的 `Component`（或让 `ZaptraceView` 作为 owner component）：渲染前 `new Component()`，`this.addChild(comp)` 或在重建时 `comp.unload()`；`clearElement` 前先 unload 上一个渲染组件。
  3. 验收方式：DevTools 里反复切换题/评分 50 次，观察 `app.workspace` 注册的 MarkdownRenderChild 数量不随渲染次数单调增长。

### ② 中｜「来源跳转」缺失 / 文档表述与实现不符
- **现象**：全仓库无 `workspace.openLinkText` / `editor.setCursor` / `openFile`；题卡底部出处是纯文本（`card.ts:145-148`），无点击跳转。README:12「可跳回源文档练习」容易被理解为可跳回原文，但实现只有「命令：练习当前题卡（从光标所在块进入练习）」（`main.ts:80-86,349-365`），**没有「从题卡/工作台打开对应 .md 的行」**。
- **影响**：若产品预期「点出处跳到源文件该行」，则属功能缺口；否则属 README 表述需校正。
- **修复建议（二选一）**：
  - A. 实现跳转：在题卡 footer 的出处与工作台题行加「打开源文件」按钮，调用 `this.app.workspace.openLinkText(card.file, "", false)` 后 `MarkdownView.editor.setCursor({line: card.line-1, ch:0})` 并 `revealLeaf`；深度链接需注意跨文件。
  - B. 若不做跳转：把 README:12 改为「可用命令『练习当前题卡』从当前块进入练习」，避免歧义。
- **判定**：若 Lead 视「来源跳转」为必需功能 → 本项按 **FAIL** 计；否则按 CONCERN。

### ③ 低｜卸载残留 body 类名
- **现象**：`main.ts:206-211` `applyTheme()` 给 `document.body` 加 `zaptrace-mubu-dark`；`onunload()`（`main.ts:129-136`）未移除。禁用/卸载插件后类名残留。
- **修复**：`onunload()` 中 `document.body.classList.remove("zaptrace-mubu-dark")`；或改为在 `applyTheme` 里始终 toggle，并在 `onunload` 兜底 removeAll。
- **验收**：禁用插件后 `document.body.className` 不含 `zaptrace-mubu-dark`。

---

## 4. 次要问题 / 建议（不阻塞）

- **Tabs 无障碍**：`workbenchView.ts:114-136` 有 `role=tablist/tab` 但缺 `tabpanel` 与 `aria-controls`；建议补 `role=tabpanel` + `aria-controls` + 方向键切换。
- **`~~~` 围栏**：扫描器不支持波浪号围栏（`parse.ts:16-17,282`）。可在 README「已知限制」补一句，或扩展正则同时接受 `~{3,}`。
- **英文题干以 `Word:` 开头**：若题卡无 `---`、首行形如 `Note: ...` 且无分节，会被当作头部键（未知键进 `extra`）导致正文丢失（`parse.ts:87-115`）。中文题干无此问题；建议头部识别额外要求「首行 key 属于已知键或存在 `---`」以消歧。
- **`renderCodeBlock` 未命中索引时用 `blockIndex:0` 解析**（`main.ts:325-335`）：索引过期瞬间可能得到与索引不同的 qid；建议命中失败时触发一次 `rebuildIndex` 再渲染。
- **`store.saveNow` 失败后已置 `dirty=false`**（`stateStore.ts:79-95`）：写失败仅 `console.error`，下次 flush 可能不再重试；建议失败时保持 `dirty=true` 以便重试。
- **`onunload` 的 flush 是 fire-and-forget**（`main.ts:134`）：进程退出前最后 <350ms 的状态可能丢失；已有 `beforeunload` 兜底，风险低。

---

## 5. 本次新增的独立测试（`tests/review-independent/review.extra.test.ts`）

| 用例 | 覆盖点 | 结果 |
|---|---|---|
| REVIEW-A | 跨文件同文重复题：两卡两 qid、索引键不同、与文件输入顺序无关 | 通过 |
| REVIEW-B | 时间筛选边界：今天到期 / 已到期 / 7 天内 互不重叠（含 +7 / +8 边界） | 通过 |
| REVIEW-C | CRLF 行尾不污染题干/答案 | 通过 |
| REVIEW-D | 外层 5 反引号套内层 4 反引号代码块不截断 | 通过 |
| REVIEW-E | 缺 `schemaVersion` 视作 v1、不迁移、不只读 | 通过 |
| REVIEW-F | 重复 reveal 返回 false；评分后不可再评；reviewLog 只写一次 | 通过 |
| REVIEW-G | 头部 `star` 仅首次初始值，取消后重新索引不复活 | 通过 |
| REVIEW-H | 自动 ID 只依赖题干，改答案/标签不换 qid | 通过 |

> 这些用例独立于开发的 `tests/core.test.ts` / `store.test.ts`，用于交叉验证。可随时删除，不影响插件构建。

---

## 6. 未覆盖 / 建议人工冒烟（本验收的边界）

1. **真实 Obsidian 运行时 UI**：未在具体 Obsidian 版本（建议 ≥1.5.0）里加载插件做人工走查——需人工确认：阅读视图卡片渲染与折叠、Live Preview 只读缩略卡、三栏/窄屏单栏、评分条键盘、aria-live 播报、mubu-dark 与亮暗主题。
2. **100+ 题卡大库**：性能目标（500 卡 <1.5s）需真实 vault 实测。
3. **多设备 data.json 冲突**：依赖 Obsidian Sync，未覆盖。
4. **MarkdownRenderer 泄漏**：需 DevTools 观察注册 child 数量（见 §3-①）。

---

## 7. 证据索引（关键文件:行）

- 入口/生命周期：`src/main.ts:52-136`（onload/onunload）、`:114-116`（code block processor）、`:206-211`（applyTheme 残留）、`:315-345`（renderCodeBlock）、`:377-381`（backup 写）
- 解析：`src/core/parse.ts:16-20`（正则）、`:38-51`（dedent）、`:87-115`（头部 H3）、`:125-152`（分节）、`:274-314`（围栏扫描）
- ID/索引：`src/core/id.ts:10-33`、`src/core/index.ts:38-100`（确定性去重）、`:102-144`（buildIndex）
- 评分/日期：`src/core/scheduler.ts:7-59`、`src/core/date.ts:39-90`
- 状态/迁移：`src/core/state.ts:199-328`（migrate）、`:340-449`（ensure/star/recordReview）、`src/store/stateStore.ts:35-95`
- 门控：`src/core/practice.ts:22-113`、`src/view/practicePanel.ts:45-71,120-288`
- 视图：`src/view/card.ts:15-17,117-140`、`src/view/dom.ts:26-85,123-125`、`src/view/libraryPanel.ts:33-127,225-350`、`src/view/reviewPanel.ts:21-169`
- 样式：`styles.css:9-48`（令牌/暗色）、`:795-838`（窄屏）、`:841-855`（reduced-motion）
- 测试：`tests/core.test.ts`（43 例）、`tests/store.test.ts`（6 例）、`tests/review-independent/review.extra.test.ts`（8 例）

---

*本报告基于静态审查 + 可复现命令 + 独立单测；UI 运行时与主观视觉需人工冒烟补充。*

---

## 8. 复审结论（Round 2 · 修复复核）

- 复审时间：2026-11-02 15:2x（Asia/Shanghai）
- 复审范围：针对本文 §3 的 ① MarkdownRenderer 生命周期、② 来源跳转、③ 卸载残留 body 类名，以及 §4 的 **store 保存失败 dirty 重试**，逐项复核；并确认原有测试不回归。
- 结论：**FINAL PASS（可发布）**。三项修复均落实，store 重试已实现且有单测；原 51 个用例（43 开发 + 8 独立）全部保留通过，开发另加 2 条 store 用例，共 **53 pass / 0 fail**。

### 8.1 命令证据（本轮重跑）

```
npm.cmd test            → 53 pass / 0 fail（43 原开发 + 2 新 store + 8 独立），TEST_EXIT=0
npm.cmd run typecheck   → tsc -noEmit -skipLibCheck exit 0
干净副本 npm ci && npm run build → BUILD_EXIT=0
REPO_main.js_SHA256 = B6EDEA5C2C2CD9AA956867C367D6E8E35D89CB37650F91BDCFD69B3785E5241B
FRESH_main.js_SHA256= B6EDEA5C2C2CD9AA956867C367D6E8E35D89CB37650F91BDCFD69B3785E5241B  → MATCH=True
```
（仓库内 `main.js` 16:20 重建、96 577 B，与干净副本重建一致 → 产物新鲜、可复现。）

### 8.2 逐项复核

| 修复项 | 判定 | 证据 |
|---|---|---|
| ① MarkdownRenderer 生命周期 | **PASS** | 新增 `src/view/renderOwner.ts:11-19`（`RenderScope extends MarkdownRenderChild`，`createRenderScope(parent,el)=parent.addChild(...)`）；`main.ts:366-369` 每个代码块 `new RenderScope(el)` + `ctx.addChild(owner)`，并把 `owner` 传入 `renderQuestionCard`；`practicePanel.ts:31-39` `beginRender()` 先 `scope.unload()` 再新建，`render()` 全程用本轮 `scope`（`:126-132,170-176,182-202`）；`libraryPanel.ts:38-44,182`、`reviewPanel.ts:32` 同法；`pluginContext.ts:15-21` 已**移除 `component`**，`grep plugin\.component` 在 `src/` 无命中 → 不再把插件实例当长期 owner |
| ② 来源跳转 | **PASS** | `main.ts:201-225 openSource()`：`vault.getAbstractFileByPath`→`leaf.openFile(file,{eState:{line:card.line-1}})`→`revealLeaf`→`setEphemeralState({line})`，源码模式再 `editor.setCursor/scrollIntoView/focus`；`card.ts:71-89` 新增「定位原文」按钮，用于 compact（`:116`）与 footer（`:180`）；`libraryPanel.ts:362-371` 每行「打开原文」按钮（`stopPropagation` 不影响主点击）；`README:11,12,109` 已改为准确表述（明确「打开源笔记并跳到题卡所在行」，并说明只读、不改 Markdown） |
| ③ onunload 移除 body 类名 | **PASS** | `main.ts:132` `document.body.classList.remove("zaptrace-mubu-dark")` |
| + store 保存失败 dirty 重试 | **PASS** | `stateStore.ts:28-29` 增 `revision`；`:82-107` 保存失败 `dirty=true` 保留待重试，保存期间 `revision` 变化也保持 `dirty=true`；新增 `tests/store.test.ts:105-136`（失败→下次 flush 重试成功）、`:138-164`（保存中产生新改动不丢 dirty）均通过 |

### 8.3 不回归确认
- 原 43 条 `tests/core.test.ts` 与 8 条 `tests/review-independent/review.extra.test.ts` **全部仍在且通过**（见 8.1 列表）。
- `npm run build` 产物与源码一致（hash MATCH），未引入构建/类型回归。

### 8.4 残余（非阻塞，可选优化）
1. `main.ts:366-369` 在 `livePreview === "source"` 早退（`:373`）之前就 `new RenderScope` + `ctx.addChild`，会留下一个空 scope（随 `ctx` 卸载，无泄漏，仅多余）；可把 owner 创建移到该 early-return 之后。
2. 仍建议人工在真实 Obsidian（≥1.5.0）做一次 UI 冒烟：阅读视图/题集行的「定位原文」在 **preview 模式**滚动到题卡行、LP 缩略卡、窄屏与键盘。静态 + 类型 + 单测已覆盖其余逻辑。

> **复审最终结论：FINAL PASS（可发布）。** 上述 2 点为可选优化，不影响交付。
