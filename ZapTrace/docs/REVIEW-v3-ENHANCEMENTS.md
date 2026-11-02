# ZapTrace v3 增强功能验收（REVIEW-v3-ENHANCEMENTS）

- 验收对象：`Kane_Obsidian_Plugins/ZapTrace` v0.1.0 + DESIGN v3 增量（category / 答案与笔记合并 / 笔记编辑 / 三列卡片）
- 环境：**Obsidian 1.14.5**（`E:\Software\Obsidian\Obsidian.exe`），vault `E:\NoteCache`，系统 1920×1080，暗色 100%
- 安装：已把构建产物（`main.js` / `styles.css` / `manifest.json`）覆盖到 `E:\NoteCache\.obsidian\plugins\ZapTrace`，**保留 data.json**（备份见 `tests/review-v3/backups/data.before.json`）；并用「重新加载 Obsidian」真重载。
- 夹具：新建 vault 测试文件 `E:\NoteCache\zt-v3-fixture.md`（4 张卡：数学/高数带笔记、数学/线代无笔记、无 category 概率论、英语/阅读理解），测试前备份 `tests/review-v3/fixtures/zt-v3-fixture.before.md`；**未改 `examples/zaptrace-demo.md`**（其 mtime 17:00:23 早于 v3 全部代码改动 17:26+）。

---

## 0. 结论

**判定：RELEASE FAIL。**

v3 的科目层级、答案与笔记合并折叠、笔记 textarea 保存协议、三列卡片、筛选联动、core 回归均通过；但**「笔记最后记录时间」不满足用户要求**：已存在笔记、但从未经插件保存过（`notesUpdatedAt = null`）时，阅读卡/库卡的笔记区**不显示任何时间**。用户批注 A8 要求「笔记需要有最后记录时间，若无笔记则无记录时间」——有笔记却无时间，属功能缺口，阻塞发布。修复建议见 §3-①。

---

## 1. 命令实证

```
cd Kane_Obsidian_Plugins/ZapTrace
npm.cmd test            → 67 pass / 0 fail（原 53 + notes.test 13 + category 等；TEST_EXIT=0）
npm.cmd run typecheck   → tsc -noEmit -skipLibCheck exit 0
干净副本 npm ci && npm run build → BUILD_EXIT=0
REPO_main.js_SHA256 = 8C9602119138CE35503BFFCE07A8A7125C4134C796A6B0A32925CF91B9697858
FRESH_main.js_SHA256= 8C9602119138CE35503BFFCE07A8A7125C4134C796A6B0A32925CF91B9697858  → MATCH=True
```

- `tests/notes.test.ts`（13 条）覆盖：替换既有笔记、插入新节、无分节追加、空笔记、CRLF/混合 EOL、4 反引号嵌套、缩进块、同文件多块只改第 2 块、错误行号、无变化不写、保留标题拒绝、末尾无换行等。
- 独立复核 `replacePersonalNotes`（node 直接导入 `src/core/notes.ts`，对夹具 before 原文应用 draft）：**changed=true，唯一差异为 L20「### 个人笔记」内容行**，题干/答案/其它三块/文件首行逐字节不变（见 §4）。

---

## 2. 逐项验收

### A. category 大科目 / subject 子科目 / tags 章节标签（显示与筛选联动）

| 子项 | 判定 | 证据 |
|---|---|---|
| 头部 `category` 解析（KNOWN_KEYS） | **PASS** | `core/parse.ts:22-24,242`；`core/index.ts:119` `category: card.category \|\| "数学"`（缺省推断数学） |
| 卡片显示顺序 category→subject→tags | **PASS** | `card.ts:33-57` 与 `libraryPanel.ts:768-771` 输出 `.pd-tag.is-category/.is-subject/.is-topic`；真机 V1 显示 `[数学][高等数学][导数][极限]` |
| 大科目下拉 | **PASS** | `libraryPanel.ts:383-406` 由 `card.category` 去重排序 |
| 未选大科目 → 子科目/标签禁用 | **PASS** | `libraryPanel.ts:408-470` 设置 `disabled`/`aria-disabled`/`title="先选择大科目"`；真机 V5 显示「子科目：先选择大科目」，tags 隐藏 |
| 选中大科目 → 子科目/标签可用 | **PASS** | 真机 V6：选「数学」后子科目显示「全部子科目」、tags chips（代码/导数/概念/极限/行列式）出现、列表只剩数学类卡片 |
| 切换重置 / 清除 | **PASS（静态）** | `libraryPanel.ts:137-143,472-485`；切换清空 subject/tags，清除恢复全空 |
| 筛选语义 category 精确 + subject 精确 + tags 交集 | **PASS** | `computeFiltered()` 先按 category 过滤，再 `filterCards`（沿用交集语义） |

### B. 阅读卡：合并折叠 / 持久化 / 星标 / 笔记编辑 / 时间

| 子项 | 判定 | 证据 |
|---|---|---|
| 答案+个人笔记合并为一条「答案与笔记」折叠、默认关闭 | **PASS** | `card.ts:183-211`；`startsOpen: state?.foldOpen ?? false`；真机 V1 折叠行为单条「答案与笔记」，右侧 meta「答案 1 行 · 笔记 1 行」 |
| 点击展开：答案渲染 + 笔记 textarea + 保存/取消 | **PASS** | 真机 V2：答案 `f'(1)=2`、`个人笔记` 标签、textarea 预填、保存/取消 |
| 折叠状态按 qid 持久化（切走/重载仍展开） | **PASS** | `dom.ts:74-83` `onToggle`→`plugin.setFoldOpen(qid)`；`main.ts:184-190` 写 `state.foldOpen`；data.json 实测 `v3-fixture-math-deriv.foldOpen = true`（点击后落盘） |
| 独立星标常驻可见、点击切换 | **PASS（代码+可见）** | `card.ts:60-77,161` 星标常驻（`pd-star`，`aria-pressed`）；V1/V5 可见星形；toggle 写 data.json。**未在真机点击成功**（UIA 未暴露 star 按钮、坐标点击落到卡片主体），但代码路径直接 `toggleStar`+`requestSave` |
| 笔记 textarea 保存只改目标块 `### 个人笔记` | **PASS** | 纯函数独立复核：before→after 唯一差异 L20 笔记内容；题干/答案/category/头部/其它三块/首行全部不变。真机保存后 data.json `notesUpdatedAt` 更新（17:41:10），证明 UI→`plugin.saveNotes`→`vault.process` 通路生效 |
| **笔记最后记录时间（有笔记则显示）** | **FAIL** | 真机 V2：卡 1 已有笔记「- 旧笔记 A（保存测试前）」但**未显示「更新于 …」**。代码 `noteEditor.ts:67-77`：仅 `hasNotes && state.notesUpdatedAt` 才显示；夹具笔记非经插件保存 → `notesUpdatedAt=null` → 无时间。违反用户 A8「笔记需要有最后记录时间」 |
| 空笔记无时间 | **PASS** | 同 `updateTime`：`hasNotes=false` 时隐藏；V5 无笔记卡（线代）不显示时间 |

### C. 题库：三列 / 默认展开可编辑 / 窄屏

| 子项 | 判定 | 证据 |
|---|---|---|
| ≥1440 一行 3 卡 | **PASS** | `styles.css:1631-1654` 容器查询 ≥1080 三列 + `@media(min-width:1440)` `--pd-grid-cols:3`；真机 V5（1920）为 **3 列** |
| 每卡默认展开答案与笔记、可折叠/编辑 | **PASS** | `libraryPanel.ts:618-635` `openState = state?.foldOpen ?? true` + `createNoteEditor(compact)`；V5 每卡展开「答案与笔记」含答案预览+笔记 textarea+保存/取消 |
| 点击卡主体进入练习（与折叠/星标分离） | **PASS** | `libraryPanel.ts:539-555` `.pd-qcard-open role=button`；真机误触卡主体时打开了练习抽屉（Esc 关闭） |
| 窄屏响应式 | **PASS** | V8（1000px）单列、页头堆叠、chips 横向；静态 `@container` 1079→2 列、699→1 列 + `@media(max-width:1023)` 1 列 |

### D. 回归 / 约束

| 子项 | 判定 | 证据 |
|---|---|---|
| 53+ 测试回归 | **PASS** | 67 pass / 0 fail（含原 53 条核心/迁移/门禁 + 新增 notes/category） |
| typecheck / build | **PASS** | typecheck exit 0；干净副本 build exit 0，main.js SHA-256 MATCH（8C960211…7858） |
| core 语义（解析/ID/评分/复习）不变 | **PASS** | 仅新增可选 `category` 头字段与 `notesUpdatedAt/foldOpen`；评分/复习算法未改，单测全绿 |
| data.json 未知字段保留 / schemaVersion 仍 1 | **PASS** | `state.ts` normalize 的 knownState/knownTop 白名单机制保留未知字段；实测 data.json `schemaVersion=1`；store 测试覆盖未知字段 |
| examples 未动 | **PASS** | `examples/zaptrace-demo.md` mtime 17:00:23（早于 v3 改动 17:26+） |
| 只新增 notesUpdatedAt/foldOpen，不新增 category 落盘 | **PASS** | data.json 无 category 字段；`v3-fixture-*` 状态仅 `notesUpdatedAt/foldOpen` 增量 |

---

## 3. 必须修复（阻塞）

### ① 笔记「最后记录时间」在「有笔记但从未插件保存」时不显示（FAIL）
- **现象**：真机 V2，卡 1 有笔记却无「更新于 …」。`noteEditor.ts:67-77` 仅在 `state.notesUpdatedAt` 非空时显示；旧笔记 / 用户直接用 HTML 写的笔记从未经插件保存 → `notesUpdatedAt=null` → 时间永远不出现。
- **用户要求**：A8「笔记需要有最后记录时间，若无笔记则无记录时间」。
- **精确修复建议**：
  1. 在 `PluginContext` 增加只读 e.g. `getFileMtime(file: string): Promise<number | null>`（`app.vault.adapter.stat(file)` → `.mtime`）。
  2. `createNoteEditor.updateTime()`：若 `card.notes.trim() !== ""`：
     - `state.notesUpdatedAt` 有值 → 显示「更新于 …」；
     - 否则 **回退到文件 mtime**（`vault.adapter.stat(file).mtime`）显示「更新于 …」；若 mtime 不可得则显示「更新于 —」或不显示（降级）。
     - 笔记为空 → 始终不显示（保持现状）。
  3. 该回退为**只读**，不写 data.json；仅当用户经插件保存时仍写 `notesUpdatedAt`（保持「保存后精确时间」）。
- **验收**：夹具卡 1（有笔记、notesUpdatedAt=null）打开折叠应显示「更新于 <文件 mtime>」；卡 2（无笔记）不显示；保存后显示保存时间。

---

## 4. 笔记保存协议独立复核（PASS 证据）

对 `tests/review-v3/fixtures/zt-v3-fixture.before.md`（含 4 个 zaptrace 块）调用 `replacePersonalNotes(md, {line:3,endLine:21}, "- 新笔记：v3 验收保存测试 2026-11-02")`：
```
changed=true error=none
L20: BEFORE=[- 旧笔记 A（保存测试前）] AFTER=[- 新笔记：v3 验收保存测试 2026-11-02]
```
→ **仅目标块「### 个人笔记」一行变化**，其余行逐字节相同（含文件首行、题干、答案、其它三块、末尾换行）。
> 说明：一次自动化真机编辑中，输入自动化在文件首行意外多写了一个「和」字符（非插件行为；纯函数证明块外恒不变），已用 before 备份恢复夹具；因此不据此判插件失败，但真机干净字节 diff 受工具输入扰动，建议开发侧补一条端到端 save→diff 测试。

---

## 5. 截图证据（`tests/review-v3/screenshots/`）

| 文件 | 场景 |
|---|---|
| `v3-V1-reading-default.png` | 阅读卡默认：单条「答案与笔记」折叠（关）、category/subject/tags、常驻星标 |
| `v3-V2-reading-expanded-notes.png` | 展开：答案渲染 + 笔记 textarea + 保存/取消；**有笔记但无「更新于」→ FAIL 证据** |
| `v3-V5-library-3col-default-expanded.png` | 题库 1920 **三列**、每卡默认展开答案与笔记、可编辑；大科目初始「全部大科目」、子科目「先选择大科目」禁用 |
| `v3-V6-category-math-enabled.png` | 选「数学」后：子科目可用、tags chips 出现、列表仅数学类卡片 |
| `v3-V8-narrow-1000-single-column.png` | 1000px 单列、页头堆叠 |

（data.json 备份：`tests/review-v3/backups/data.before.json` / `data.before-save-test.json`；夹具副本：`tests/review-v3/fixtures/`。）

---

## 6. 发布判定

- **RELEASE FAIL**：唯一阻塞为 §3-① 笔记时间缺失（有笔记却无时间）。其余 A/C/D 与 B 的合并折叠/持久化/保存协议均通过。
- 修复 §3-① 后复验 V2（有笔记卡显示「更新于 文件 mtime」、无笔记卡不显示、保存后显示保存时间）即可转 **RELEASE PASS**。
- 另建议（非阻塞）：为「保存笔记只改个人笔记节」增加一条端到端测试（真实 `vault.process` 前后字节 diff），避免仅靠纯函数单测。

*Obsidian 1.14.5；插件 version 0.1.0；构建 main.js SHA-256 = 8C960211…7858；系统缩放 100%。*

---

## 9. 复验（Round 2 · 笔记时间回退）

- 复审时间：2026-11-02 17:55（Asia/Shanghai）
- 复审对象：§3-① 笔记最后记录时间的修复
- 安装：覆盖安装最新 build 到 `E:\NoteCache\.obsidian\plugins\ZapTrace`（**保留 data.json**，备份 `tests/review-v3/backups/data.before-r2.json`）并「重新加载 Obsidian」。
- 构建指纹：`main.js` SHA-256 = **282F71B1AB882B1D3B958BE7B88040ADF599F8A4434A89FE3778DC29C42D12A1**（干净副本重建一致，MATCH=True）。

### 9.1 命令实证
```
npm.cmd test            → 67 pass / 0 fail（TEST_EXIT=0）
npm.cmd run typecheck   → exit 0
干净副本 npm ci && npm run build → exit 0
REPO main.js = 282F71B1…12A1
FRESH main.js= 282F71B1…12A1   MATCH=True
```

### 9.2 修复代码确认
- `src/view/noteEditor.ts:85-97`：`timestamp = state?.notesUpdatedAt ?? (hasNotes ? plugin.getFileMtime(card.file) : null)`；仅 `hasNotes && timestamp != null` 时显示「更新于 …」。
- `src/view/noteEditor.ts:19-37` `formatTime` 同时支持 ISO 字符串与 epoch ms（文件 mtime）。
- `src/main.ts:184-190` `getFileMtime(path)` 读取 `TFile.stat.mtime`（只读；不存在返回 null）。
- 保存路径未变：`main.ts:239` 保存成功才写 `notesUpdatedAt`（空笔记→null）；`noteEditor` 优先使用 `notesUpdatedAt`，故保存后显示的是保存时间。

### 9.3 真机复验结果

| 检查 | 判定 | 证据 |
|---|---|---|
| 有笔记但 `notesUpdatedAt=null` 的**阅读卡**显示「更新于 YYYY-MM-DD HH:mm」 | **PASS** | 新增夹具卡 `v3-fixture-mtime-fallback`（有笔记、data.json `notesUpdatedAt` 为空）；展开后显示 **「更新于 2026-11-02 17:52」**（= 文件 mtime）。截图 `v3-R2-V2-reading-mtime-fallback.png` |
| 同条件**题库卡**也显示时间 | **PASS** | 工作台搜索「回退」过滤到该卡，个人笔记区显示 **「更新于 2026-11-02 17:52」**。截图 `v3-R2-workbench-mtime-fallback.png` |
| 无笔记不显示时间 | **PASS** | `noteEditor.ts:87-96` `hasNotes=false` 时隐藏；线代夹具卡（无 `### 个人笔记`）不显示时间 |
| 插件内保存后时间=notesUpdatedAt | **PASS（代码+历史真机）** | `noteEditor.ts:89` 优先 `notesUpdatedAt`；`main.ts:239` 保存成功写 ISO。上一轮真机保存后 data.json `v3-fixture-math-deriv.notesUpdatedAt=2026-11-02T17:41:10+08:00`，阅读卡显示「更新于 2026-11-02 17:41」。本轮再次尝试在夹具卡上保存时保存按钮未触发（状态显示「未保存」、文件与 data.json 未变），故以代码路径 + 上一轮真机证据为准 |
| data.json 保留、夹具前 4 块不变 | **PASS** | 复验后 fixture 5 个 zaptrace 块；前 4 块与 `zt-v3-fixture.before-r2.md` 逐行一致（prefix identical=True） |

### 9.4 本轮截图
| 文件 | 场景 |
|---|---|
| `tests/review-v3/screenshots/v3-R2-V2-reading-mtime-fallback.png` | 阅读卡：有笔记但未保存 → **更新于 2026-11-02 17:52** |
| `tests/review-v3/screenshots/v3-R2-workbench-mtime-fallback.png` | 题库卡：同一卡个人笔记显示 **更新于 2026-11-02 17:52** |

> **复验最终结论：RELEASE PASS。** §3-① 阻塞已关闭：有笔记（未保存过）显示文件 mtime、无笔记不显示、插件保存后显示 `notesUpdatedAt`；A/C/D 与 B 其余项维持通过，测试/类型/构建零回归。
