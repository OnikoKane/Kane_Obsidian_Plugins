# ZapTrace v3 增量设计：科目层级 · 答案与笔记合并 · 紧凑三列卡片

> 版本：v3.0 · 2026-11-02
> 依据：
> - 《插件 UI 设计规范 · Quiet Cards》`C:\Users\10784\Desktop\pluginDesign.md`（v1.0）
> - 现行 `docs/DESIGN-v2-QUIET-CARDS.md`（已上线的 Quiet Cards 基线）
> - 用户最新批注截图（2026-11-02 17:17，见 §1 逐条）
> - 现有源码实测：`src/core/{types,parse,index,state}.ts`、`src/store/stateStore.ts`、`src/view/{card,libraryPanel,dom,plainText}.ts`、`styles.css`
> 性质：**v3 增量设计，不改代码**。只写本文档；不扩 PDF / AI / 批注。

---

## 0. 一页结论

| 需求（来自批注） | v3 设计落点 |
| --- | --- |
| 「科目分为大科目 + 子科目」「数学 / 高等数学 作主标签，导数 / 极限 作子标签」 | 新增头部字段 `category`（大科目）；`subject` 仍是子科目；`tags` 仍是章节/知识点（§2） |
| 「答案和笔记合并到一个折叠框」「默认关闭；打开过就记录，下次读此 MD 保持打开」 | 阅读卡合并为单折叠「答案与笔记」；`data.json` 新增 `foldOpen`（按 qid，三态）持久化（§3） |
| 「没有笔记编辑框，只能通过 html 输入，添加个笔记编辑框」 | 折叠展开内嵌 textarea + 保存/取消；保存只改目标块 `### 个人笔记`（§3、§5） |
| 「笔记需要有最后记录时间，若无笔记则无记录时间」 | `data.json` 新增 `notesUpdatedAt`；笔记为空则 `null` 且不显示（§3.4、§5.5） |
| 「收藏星星独立一个图标 ⭐ ⋯」 | 星标常驻可见（`aria-pressed`），`⋯` 菜单保留收藏项（§3.5） |
| 「UI 紧凑化，现在太多留白」 | 卡内/页头/栅格紧凑尺寸下调（§6） |
| 「题卡流中紧凑化摆放，希望一行 3 卡片，且默认展开答案和笔记（也可折叠+编辑）」 | ≥1440px 三列；库卡默认展开「答案与笔记」并可就地编辑（§4） |
| 「选中对应大科目才能选标签」 | 大科目下拉为前置；未选时子科目与标签置灰禁用（§4.2） |

**硬约束**：`subject` 语义不变（子科目）；`data.json` **只新增 `notesUpdatedAt` 与 `foldOpen`**；旧数据自动默认、未知字段保留；解析/ID/评分/复习算法不动。

---

## 1. 用户最新批注逐条 → 设计响应

> 来自 2026-11-02 17:17 两张批注截图（题库页 + 阅读卡）。

| # | 批注原文（截图） | 设计响应 |
| --- | --- | --- |
| A1 | 「科目分为大科目 + 子科目」 | 头部新增 `category`；`subject` 为子科目（§2） |
| A2 | 「选中对应大科目才能选标签」 | 大科目下拉未选时，子科目与 tags 均 `disabled`；选择后按 category 过滤选项（§4.2） |
| A3 | 「如数学 高等数学 作为主标签，导数 极限作为其子标签」 | 卡片标签顺序：`category` → `subject` → `tags`；视觉区分三档 chip（§2.4） |
| A4 | 「答案和笔记合并到一个折叠框」「默认关闭，打开过的话记录打开过的状态，下次读此 MD 保持打开」 | 阅读卡单一「答案与笔记」折叠；`foldOpen` 持久化到 data.json（§3.1、§3.3） |
| A5 | 「没有笔记编辑框，我只能通过 html 输入，添加个笔记编辑框」 | 展开内嵌 textarea + 保存/取消；保存协议见 §5 |
| A6 | 「UI 紧凑化，现在太多留白」 | 全局紧凑间距（§6.2） |
| A7 | 「收藏星星独立一个图标 即 ⭐ ⋯」 | 星标常驻可见 + `⋯` 菜单（§3.5） |
| A8 | 「笔记需要有最后记录时间，若无笔记则无记录时间」 | `notesUpdatedAt`；空白笔记为 null 不显示（§3.4、§7） |
| A9 | 「题卡流中，紧凑化摆放，我希望一行 3 卡片，且默认展开答案和笔记（也可以折叠+编辑）」 | ≥1440 三列；库卡默认展开答案与笔记、可就地编辑（§4） |

---

## 2. 科目层级数据语法

### 2.1 三个字段的职责（不混用）

| 字段 | 语义 | 示例 | 来源 |
| --- | --- | --- | --- |
| `category`（**新增**） | 大科目 | `数学` / `英语` / `政治` | 头部 `category:`；缺省推断 `数学` |
| `subject`（**语义固定**） | 子科目 | `高等数学` / `线性代数` / `概率论` | 头部 `subject:`；缺省沿用现有 `defaultSubject` / 文件夹名 |
| `tags`（**语义固定**） | 章节 / 知识点 | `导数`、`极限`、`行列式` | 头部 `tags:`（逗号/顿号分隔） |

> 现有 v2 的卡片标签只显示 `subject + tags`。v3 只是**在 subject 之前插入 category**，不改 subject/tags 的含义与解析方式。

### 2.2 Markdown 语法

```zaptrace
category: 数学
subject: 高等数学
tags: 导数, 极限
source: 高等数学 第七版 p.86
---

### 题干
...
### 答案
...
### 个人笔记
...
```

- `category` 加入解析器的 `KNOWN_KEYS`（与 `subject/tags/source/star/difficulty/pdf` 同级）。
- 单行 `key: value`、首个冒号后取全值，沿用 v1/v2 头部规则（H3：仅首行合法 key 才可能有头部）。
- 头部未知键仍原样进 `extra`，不改写文件。

### 2.3 推断与合法性

```
category = header.category.trim() || "数学"
subject  = header.subject.trim()  || settings.defaultSubject.trim() || subjectFromPath(file)
tags     = splitTags(header.tags)
```

- **无 `category` → 推断 `数学`**（硬要求）。即使卡片文件夹是 `英语/`，也**不猜**为英语；要英语请显式写 `category: 英语`。
- `category`/`subject` 允许任意非空短文本；去首尾空白；内部空格保留（如「线性代数 B」）。
- 空 `subject` 仍按现有 fallback（设置 → 文件夹名）处理，并在卡片上显示 `未分类` 兜底。
- 不新增设置项；不需要 `defaultCategory`（默认硬编码 `数学`）。

### 2.4 卡片标签显示

顺序与视觉（Quiet Cards chip 规格：高 22 / 内距 8 / 圆角 6 / 11.5px / 500 / 无边框）：

| 顺序 | 类 | 样式 | 内容 |
| --- | --- | --- | --- |
| 1 | `.pd-tag.is-category` | `--pd-surface-3` 底 + `--pd-fg-2` 字（500 字重） | `数学` |
| 2 | `.pd-tag.is-subject` | `--pd-accent-soft` 底 + `--pd-accent` 字 | `高等数学` |
| 3.. | `.pd-tag.is-topic` | 5% 前景底 + `--pd-fg-2` | `导数`、`极限`（最多 2 个 + `+N`） |

- 阅读卡与题库卡统一：`category + subject + ≤2 tags`。
- **不再把 subject 当唯一主标签**；大科目以小号中性 chip 出现，避免视觉噪音。

### 2.5 题库筛选联动（详见 §4.2）

1. **大科目下拉**：选项来自 `card.category` 去重排序。
2. **未选大科目**：子科目下拉 + 标签 chips **`disabled`**（视觉 40% 透明 + `title="先选择大科目"`）。
3. **选中大科目后**：子科目选项 = 该 category 下的 subject 去重；标签 chips = 该 category 下所有 tags。
4. 切换大科目时**清空**子科目与标签已选值；「清除筛选」恢复全部为空。

### 2.6 现有数据迁移

| 对象 | 处理 |
| --- | --- |
| Markdown 卡片 | **不重写**。v3 之前无 `category` 的卡，索引时推断为 `数学`；用户想改就自己加一行 `category:` |
| `data.json` | **不新增 category 字段**（category 是纯派生，不落状态；筛选读实时索引）。`QuestionState.subject/tags` 缓存保持原样 |
| 旧 `subject` 其实是大科目（如「数学」） | 插件不猜测映射；若发现 `subject === category`，卡片只显示一个重复 chip，建议用户把 `subject` 改为子科目 |
| 筛选/计数 | 全部基于实时索引的 `card.category`，与 data.json 无关；因此无需迁移、无写放大 |

---

## 3. 阅读卡 v3

### 3.1 结构变化

```
.pd-root.pd-card
├─ .pd-card-head
│  ├─ .pd-tags                 [数学][高等数学][导数][极限][+N]
│  └─ .pd-card-tools          默认常驻：★（可见） + ⋯
├─ .pd-stem.pd-body
├─ .pd-folds
│  └─ .pd-fold[data-fold="answer-notes"]      ← 合并「答案与笔记」
│     ├─ button.pd-fold-head (38px)
│     │  ├─ chevron
│     │  ├─ label「答案与笔记」
│     │  └─ meta「答案 2 行 · 笔记 1 行」（无笔记只显示答案行数）
│     └─ .pd-fold-body
│        └─ .pd-fold-content
│           ├─ .pd-answer-render           答案（MarkdownRenderer）
│           ├─ .pd-note-block
│           │  ├─ .pd-note-head「个人笔记」 + .pd-note-time「更新于 2026-11-02 16:40」
│           │  ├─ textarea.pd-note-input   （Markdown 原文）
│           │  └─ .pd-note-actions [保存][取消] + .pd-note-status
│           └─ （可选）AI 笔记仍为独立折叠行，若存在）
└─ .pd-card-foot  [出处] [定位原文][练习此卡]
```

- **答案与个人笔记合并为一条 38px 折叠行**「答案与笔记」；不再有独立的「答案」「个人笔记」两条。
- AI 笔记不在此次合并范围：若存在，仍作为独立折叠行放在合并行之后（保持 v2 行为）。
- 折叠默认 **关闭**（阅读场景）。

### 3.2 规格（阅读卡）

| 项 | v2 | v3（紧凑） |
| --- | --- | --- |
| 卡内边距 | `20 22 14` | `16 18 12` |
| 题干字号/行高 | 16 / 2.1 | 16 / 2.1（正文观感不变，只收紧间距） |
| 折叠行高 | 38 | **38（不变）** |
| 折叠区上间距 | 16 | 12 |
| 底部 foot 上间距 | 12 + 6 | 8 + 4 |
| 标签与题干之间 | 14 | 10 |
| 卡片圆角 | 14 | 14（不变） |
| 边 | 1px `--pd-line` | 不变（唯一一条） |

### 3.3 折叠状态持久化（`foldOpen`）

- 新增 `QuestionState.foldOpen?: boolean`（**可选三态**：`true` / `false` / `undefined` 未设置）。
- **取值规则**：
  - 阅读卡默认：`state.foldOpen ?? false`（默认关闭）。
  - 题库卡默认：`state.foldOpen ?? true`（默认展开，见 §4.3）。
- 用户点击折叠行 → 翻转并**立刻写显式布尔值**（`plugin.setFoldOpen(qid, open)`），`markDirty()` 350ms 防抖保存；卸载前 `flush`。
- 同一 qid 的多个渲染实例共享同一状态：在题库卡里折叠后，阅读卡也折叠（这是「按 qid 持久化」的直接结果，符合批注「记录打开过的状态」）。
- 不用 `data-fold` 的 DOM 状态当持久源；DOM 只反映 `state.foldOpen`。
- 与 H4 评分门禁无关；折叠不写入 `reviewLog`、不影响到期。

### 3.4 展开内容：答案 + 笔记编辑 + 时间

1. **答案区**：`MarkdownRenderer.render(card.answer)`，懒渲染（首次展开才渲染）。缺答案显示红字提示（既有）。
2. **笔记区**：
   - `<label class="pd-note-label" for="zt-note-<seq>">个人笔记</label>`
   - `<textarea class="pd-note-input" id="zt-note-<seq>" aria-label="编辑个人笔记（Markdown）">`，预填 `card.notes` 原文。
   - 时间：`.pd-note-time` 文本 `更新于 YYYY-MM-DD HH:mm`；**笔记为空 或 `notesUpdatedAt` 为 null → 不渲染该元素**。
   - 操作：`保存`（主操作，脏时可用）+ `取消`（恢复为 `card.notes`）。`未保存` 状态用 `aria-live="polite"` 报告。
3. **编辑不改变答案/题干**：保存协议只触碰 `### 个人笔记` 节（§5）。
4. **只读模式**（data.json 只读/安全模式）：textarea `readOnly`，按钮禁用，`title` 说明原因。

### 3.5 收藏星标（独立可见）

- `.pd-card-tools` 内含：
  1. `button.pd-icon-btn.pd-star`（★）：**常驻可见**（不再 opacity:0），18px 图标，`aria-pressed`，`aria-label="收藏"/"取消收藏"`；选中 `color: var(--pd-amber)`，未选 `--pd-muted`。
  2. `button.pd-icon-btn`（⋯）：`aria-haspopup="menu"`，菜单保留「收藏/取消收藏、打开原文、复制题干」。
- `⋯` 仍可 hover/focus 淡入；星标始终可见（批注「收藏星星独立一个图标 ⭐ ⋯」）。
- 星标点击只写 `data.json.questions[qid].star`，不写 Markdown。

### 3.6 边界与降级

- 缺答案/缺笔记节：正常渲染，缺答案红字；笔记节缺失时编辑框仍可保存（§5 会插入新节）。
- 语法错误卡（`card.errors`）：显示红字；编辑框禁用，提示先修语法。
- Live Preview 缩略卡：仍只读，不出现编辑框/星标；提供「打开工作台」。
- 并发编辑：保存前用最新文件内容重新定位（§5.5），失败提示并保留草稿。

---

## 4. 题库 v3（紧凑与联动）

### 4.1 一行三卡断点

| 内容区宽度（视口兜底） | 列数 |
| --- | --- |
| ≥ 1080px（视口 ≥1440 且无抽屉占位时成立） | **3 列**（`repeat(3, minmax(0,1fr))`） |
| 700–1079px | 2 列（现状） |
| < 700px | 1 列（现状） |

```css
.pd-grid { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
/* 首选容器查询：按内容区实际宽度决定列数（右侧练习分栏占 420 时不会挤压成窄列） */
.pd-content { container-type: inline-size; }
@container (min-width: 1080px) {
  .pd-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
}
@container (max-width: 1079px) and (min-width: 700px) {
  .pd-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
@container (max-width: 699px) {
  .pd-grid { grid-template-columns: 1fr; }
}
/* 兜底（不支持 container query 的环境）：按视口 */
@media (min-width: 1440px) {
  .pd-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
}
@media (max-width: 1023px) {
  .pd-grid { grid-template-columns: 1fr; }
}
```

> **口径**：需求「一行 3 卡（≥1440）」按**内容区实际宽度 ≥1080px** 落地；在 1920 无抽屉时内容区约 1450–1500px → 3 列，每列约 470px；若右侧练习分栏固定（占 420），内容区约 1080px，仍 3 列（每列约 340px）；再窄则自动降 2 列。Obsidian 1.14.5 支持 container query；不支持时回落视口断点。

### 4.2 大科目 → 子科目 → 标签 联动筛选

页头筛选区顺序：`搜索 | 大科目 ▾ | 子科目 ▾ | 排序 ▾ | 标签 chips | 清除`。

| 状态 | 大科目 | 子科目 | 标签 chips |
| --- | --- | --- | --- |
| 初始 | 全部（空） | **disabled**，placeholder「先选大科目」 | **disabled**，40% 透明 |
| 已选 `数学` | 数学 | enabled，选项=数学下的 subject | enabled，选项=数学下的 tags |
| 切换大科目 | 重置子科目与标签为空 | 重新计算选项 | 重新计算 |
| 清除筛选 | 回到初始 | disabled | disabled |

- 实现要点：`.pd-select[disabled]` + `aria-disabled="true"` + `title="先选择大科目"`；标签容器 `aria-disabled="true"`，每个 chip `disabled`。
- 筛选语义：`category` 精确匹配；`subject` 精确匹配；`tags` 交集（沿用 `filterCards` 的全部命中）。
- 搜索仍全局；状态 chips 与排序不变。
- 计数：页头「全部题目 · N 题」保持总数；状态 chips 计数保持全库口径（不随大科目变小），避免误导。

### 4.3 题库卡片：默认展开答案与笔记，可就地编辑

**库卡结构（与点击区分离，避免嵌套交互）：**

```
.pd-qcard[role=listitem][data-qid]
├─ .pd-qcard-open  (div role=button tabindex=0)   ← 点击 = 进入练习
│  ├─ .pd-qcard-head  tags（category/subject/tags）
│  ├─ .pd-qcard-stem  题干纯文本预览（2 行）
│  └─ .pd-qcard-foot  [状态][复习日期][出处]
├─ .pd-qcard-tools    ★（常驻）+ ⋯（hover/focus）
└─ .pd-qcard-fold     「答案与笔记」折叠（**默认展开**）
   ├─ button.pd-fold-head (30px, 库卡紧凑)
   └─ .pd-fold-body
      ├─ .pd-qcard-answer   答案纯文本预览（`toPreviewText`，最多 4 行，`max-height` 省略）
      └─ .pd-note-block     笔记编辑（同 §3.4 组件）
```

- **默认展开**：`open = state.foldOpen ?? true`；用户折叠后写 `foldOpen=false`，下次所有卡片/阅读卡也折叠。
- 为什么库卡答案用**纯文本预览**：三列 × 多卡时，全量 `MarkdownRenderer` 代价过高；`toPreviewText` 已能显示 `f(x)=x^2`、`〔矩阵〕`、`〔公式〕`（v2 打磨版）。要看完整渲染，点卡片进练习/阅读。
- 卡内编辑与阅读卡**同一个 `createNoteEditor` 组件**，共用保存协议（§5）与 `notesUpdatedAt`。
- 卡高随内容变化；`.pd-grid { align-items: start }`，不做等高拉伸。
- 展开只影响视觉高度，不影响 `filterCards/sortCards` 结果顺序（排序仍按数据，不按高度）。

### 4.4 题库紧凑尺寸

| 项 | v2 | v3 |
| --- | --- | --- |
| `--pd-grid-gap` | 16 | **12** |
| `--pd-qcard-pad` | `16 18 14` | **`12 14 10`** |
| 卡片圆角 | 14 | 12 |
| 题干预览 | 16 / 1.7 / 2 行 | **15 / 1.6 / 2 行** |
| 标签 chip 高 | 22 | **20**（字号 11） |
| foot 上间距 | 12 | **8** |
| 页头 padding | `20 24 12` | **`14 20 8`** |
| 状态栏 padding | `0 24 12` | **`0 20 8`** |
| 筛选栏 padding | `0 24 8` | **`0 20 6`**，gap 8 |
| 内容 padding | `0 24 32` | **`0 20 24`** |
| 库卡折叠行高 | — | **30**（`--pd-fold-h-lib`） |
| 答案预览最大高 | — | **96px**（4 行，超出省略） |
| 笔记 textarea | — | 最小 62 / 最大 180，13px/1.55 |

> 阅读卡保持 38px 折叠行（批注只要求阅读卡合并折叠；题库为紧凑版 30px）。

### 4.5 紧凑表格与独立复习

- 紧凑表格：保持 v2 结构，仅在「科目」列前增加「大科目」信息（把 `subject` 显示为 `category · subject` 或两行 11.5px），列宽微调；不新增交互。
- 独立复习：完全保持 v2；不参与 category 筛选（复习队列仍是全科目按到期）。

---

## 5. 笔记保存协议（核心，纯函数 + 单测）

### 5.1 约束（硬）

1. **只修改目标 `` ```zaptrace `` 块内的「### 个人笔记」节**。
2. **答案、题干、头部、其它分节、块外所有内容、行尾、缩进、文件末尾换行**一律不变。
3. 保存前必须**重新读取最新文件**（不能使用可能过期的 `cachedRead`），避免覆盖用户在编辑器里的并发修改。
4. 保存失败/定位失败 → **不写任何文件**，返回错误，编辑器保留草稿。
5. 绝不从笔记内容推断/改写答案或题干。

### 5.2 纯函数 API（`src/core/notes.ts`，禁止 import obsidian）

```ts
export interface NoteBlockRef {
  /** 1-based：zaptrace 围栏起始行 */
  line: number;
  /** 1-based：zaptrace 围栏结束行（闭栏行；无闭栏则文件末行） */
  endLine: number;
}

export interface NotePatchResult {
  content: string;        // 新全文（未变化时原样返回）
  changed: boolean;
  error?: "block_not_found" | "not_zaptrace" | "reserved_heading_in_notes";
}

export function replacePersonalNotes(
  markdown: string,
  ref: NoteBlockRef,
  notes: string
): NotePatchResult;
```

**算法（行令牌化，保真行尾）：**

```
1. tokenize(markdown) → Line[] { text, eol }   // 正则 /([^\r\n]*)(\r\n|\n|\r|$)/g
   · 每行保留自己的 eol（CRLF/LF/CR 混排也可原样保留）
   · 最后一行若无换行，eol=""
2. 校验 lines[ref.line-1].text 匹配 /^\s{0,3}`{3,}\s*zaptrace\s*$/i
   · 不匹配 → error="not_zaptrace"
   · 越界 → error="block_not_found"
3. innerStart = ref.line        // 0-based 索引 = 起始围栏下一行
   innerEnd   = ref.endLine - 1 // 闭栏行索引（不含）
4. 在 [innerStart, innerEnd) 找标题：
   headingRe = /^(\s*)#{3,}\s*个人笔记\s*$/
   sectionRe = /^\s*#{3,}\s*(题干|答案|个人笔记|AI\s*笔记)\s*$/
5. 若找到 heading（索引 h）：
   · indent = heading 捕获的缩进前缀
   · contentStart = h+1
   · contentEnd = 从 h+1 起第一条 sectionRe 命中行，或 innerEnd
   · 用 buildNoteLines(indent, notes) 替换 [contentStart, contentEnd)
6. 若未找到 heading：
   · 若 notes.trim()==="" → changed=false（无需创建空节）
   · 否则定位插入点：
       a) 找「### 答案」标题；其 contentEnd（同上规则）即为插入点
       b) 无答案节 → 插入点 = innerEnd（闭栏前）
       c) 缩进取答案标题缩进；无答案则取围栏行缩进
   · 插入 ["", "### 个人笔记", "", ...noteLines]（前后各留一空行，去掉多余空行）
7. 校验：notes 中若存在整行匹配 sectionRe（如用户笔记里写了 `### 答案`），
   → error="reserved_heading_in_notes"（拒绝保存，提示用户改标题层级）
8. 逐行重建：lines.map(l => l.text + l.eol).join("")
9. changed = (newContent !== markdown)
```

`buildNoteLines(indent, notes)`：

- `notes` 去首尾空行后按 `\r?\n` 拆行；
- 每行非空 → `indent + line`；空行 → `""`；
- 结果前后各加一个空行（与相邻分节隔开）。

### 5.3 边界规则表

| 情况 | 结果 |
| --- | --- |
| 有 `### 个人笔记` 且有内容 | 仅替换该节内容（保留标题行原样、缩进与行尾） |
| 有 `### 个人笔记` 但为空 | 写入新内容；空内容 → 该节保留标题 + 一个空行 |
| 无 `### 个人笔记`，有 `### 答案` | 在答案节末尾后插入新节 |
| 无任何分节（无题干/答案） | 在闭栏前插入「### 个人笔记」块；**不碰已有正文** |
| 笔记为空且无笔记节 | `changed=false`，不写盘 |
| 题目在列表/引用中被缩进 | 新行沿用标题缩进；块外缩进不变 |
| CRLF 文件 | 每行保留原 EOL；新行使用该块主导 EOL |
| 混合 EOL | 逐行保留；新行取第一条非空行 EOL |
| 文件末尾无换行 | 保持无换行 |
| 行号越界 / 围栏不是 zaptrace | `error`，原文返回，`changed=false` |
| 笔记含 `### 答案` 等保留标题 | `reserved_heading_in_notes`，拒绝保存 |
| 其它块（同文件第 1/3 块） | 字节不变（单测断言） |

### 5.4 单测清单（`tests/notes.test.ts`，node:test）

1. 替换已有笔记：目标节变化，**其余行逐字节相同**；答案/题干不变。
2. 无笔记节 + 有答案节：插入位置正确（答案节之后、下一节之前）。
3. 无分节块：追加到闭栏前，正文不变。
4. 空笔记保存：节清空；无笔记且无节 → `changed=false`。
5. CRLF：保存后全文仍 CRLF；混合 EOL 逐行保留。
6. 4 反引号外层 + 内含 3 反引号代码：块边界正确、不会被内部围栏截断。
7. 整体缩进 4 空格的题卡：新行与标题缩进一致，块外不变。
8. 同文件 3 个块：只改第 2 块，第 1/3 块原文不变。
9. 行号错/非 zaptrace：返回 error，内容原样。
10. 相同内容再保存：`changed=false`，不多写一次。
11. 笔记含保留标题：返回 error，不写。
12. 文件末尾无换行：保存后仍无换行。
13. 笔记含 Markdown 列表/公式/空行：内容原样进入节内，行尾/缩进正确。

### 5.5 写入流程（视图/适配层）

```
onSave(qid, draft):
  1. state 只读？ → 拒绝，提示
  2. file = plugin.getCardByQid(qid).file
  3. fresh = await app.vault.read(file)                  // 最新内容，非 cached
  4. 重新扫描 fresh：
       found = scanZaptraceBlocks(file, fresh).cards
                 .filter(c => c.qid === qid 或 c.key === 旧 key)
                 若多个同 qid → 取 |c.line - 旧line| 最小者
     找不到 → Notice「题卡已移动/删除，请刷新索引」，返回失败
  5. res = replacePersonalNotes(fresh, {line: found.line, endLine: found.endLine}, draft)
     有 error → 行内红字提示，返回失败
     changed=false → 视为成功但无写入（更新时间不变）
  6. 若 changed：await app.vault.process(file, () => res.content)   // 原子替换
                （若 1.14.5 无 process，则 read-modify-write + 冲突检测）
  7. 成功后：
       state = ensureQuestionFromCard(data, found, nowIso)
       state.notesUpdatedAt = draft.trim() === "" ? null : nowIso
       plugin.requestSave()               // data.json 350ms 防抖
       await plugin.rebuildIndex()        // 刷新卡片 notes 与标签
       plugin.refreshAll()                // 重渲染阅读卡/题库，保持 foldOpen
  8. 失败：不改 notesUpdatedAt、不写 data.json；编辑器保留草稿
```

- `notesUpdatedAt` 仅在**内容实际改变并保存成功**时更新；打开折叠/仅渲染不更新。
- 笔记为空（trim 后）→ `notesUpdatedAt = null`（批注「无笔记则无记录时间」）。
- 保存只写目标文件一次；不改任何其它文件。

---

## 6. 组件与 CSS 变更

### 6.1 新增/调整的类

| 类 | 作用 |
| --- | --- |
| `.pd-tag.is-category` | 大科目 chip（新） |
| `.pd-tag.is-subject` | 子科目 chip（沿用，含义固定） |
| `.pd-fold[data-fold="answer-notes"]` | 阅读卡合并折叠（取代两条独立折叠） |
| `.pd-fold-h-lib` / `.pd-qcard-fold` | 库卡 30px 紧凑折叠 |
| `.pd-answer-render` | 答案渲染容器 |
| `.pd-note-block` / `.pd-note-head` / `.pd-note-label` / `.pd-note-time` / `.pd-note-input` / `.pd-note-actions` / `.pd-note-status` | 笔记编辑器（新） |
| `.pd-btn.is-small` | 26px 高的小按钮（保存/取消） |
| `.pd-qcard-open` | 库卡点击区（新，替换 `role=button` 的内层 main） |
| `.pd-qcard-answer` | 库卡答案纯文本预览 |
| `.pd-star.is-active` | 已收藏星标（amber） |
| `.pd-select[disabled]` / `.pd-tagfilter[aria-disabled="true"]` | 联动禁用态 |

### 6.2 新增令牌（v3 增量）

```css
.pd-root {
  /* 紧凑化覆盖 */
  --pd-qcard-pad: 12px 14px 10px;
  --pd-grid-gap: 12px;
  --pd-card-pad: 16px 18px 12px;
  --pd-fold-h-lib: 30px;
  --pd-qcard-min: 280px;
  --pd-answer-preview-h: 96px;
  --pd-note-min-h: 62px;
  --pd-note-max-h: 180px;
  --pd-tag-h-sm: 20px;
  --pd-tag-fs-sm: 11px;
  --pd-grid-cols: 2;
}
@media (min-width: 1440px) {
  .pd-root { --pd-grid-cols: 3; }
}
.pd-grid { grid-template-columns: repeat(var(--pd-grid-cols), minmax(0, 1fr)); }
```

### 6.3 关键 CSS 片段

```css
/* 三列 */
.pd-grid { display:grid; grid-template-columns:repeat(var(--pd-grid-cols),minmax(0,1fr));
  gap:var(--pd-grid-gap); align-items:start; }

/* 库卡：点击区与折叠分离，避免按钮嵌套 */
.pd-qcard { position:relative; background:var(--pd-surface); border:var(--pd-border);
  border-radius:12px; padding:var(--pd-qcard-pad); }
.pd-qcard-open { display:block; width:100%; text-align:left; cursor:pointer; }
.pd-qcard-stem { margin-top:6px; font-size:15px; line-height:1.6;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.pd-qcard-tools { position:absolute; top:8px; right:10px; display:flex; align-items:center; gap:2px; }
.pd-qcard-tools .pd-star { opacity:1; }
.pd-qcard-head { padding-right:64px; }

/* 库卡紧凑折叠 30px */
.pd-qcard-fold .pd-fold-head { height:var(--pd-fold-h-lib); font-size:12.5px; }

/* 答案纯文本预览 */
.pd-qcard-answer { font-size:12.5px; line-height:1.55; color:var(--pd-fg-2);
  max-height:var(--pd-answer-preview-h); overflow:hidden;
  display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; }

/* 笔记编辑器（无内框：用底色不用边框） */
.pd-note-block { margin-top:10px; padding-top:10px; border-top:1px solid var(--pd-line-2); }
.pd-note-head { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
.pd-note-label { font-size:12.5px; font-weight:500; color:var(--pd-fg-2); }
.pd-note-time { margin-left:auto; font-size:11px; color:var(--pd-faint); }
.pd-note-input { width:100%; min-height:var(--pd-note-min-h); max-height:var(--pd-note-max-h);
  resize:vertical; padding:8px 10px; border:0; border-radius:8px;
  background:var(--pd-surface-2); color:var(--pd-fg);
  font-family:var(--pd-font); font-size:13px; line-height:1.55; }
.pd-note-input:focus-visible { outline:2px solid var(--pd-accent); outline-offset:2px; }
.pd-note-actions { display:flex; align-items:center; gap:8px; margin-top:6px; }
.pd-note-actions .pd-btn { height:26px; padding:0 9px; font-size:12.5px; }
.pd-note-status { font-size:11px; color:var(--pd-muted); }

/* 星标 */
.pd-star { width:22px; height:22px; color:var(--pd-muted); }
.pd-star.is-active { color:var(--pd-amber); }

/* 禁用联动 */
.pd-select[disabled], .pd-tagfilter[aria-disabled="true"] .pd-chip {
  opacity:.4; pointer-events:none;
}
```

> 遵循 Quiet Cards：**卡片仍只有一条边**；textarea 用底色 `--pd-surface-2` 而非描边，聚焦才出 accent 环；不用 `!important` 覆盖自身。

### 6.4 与 v2 的类/结构兼容

- `zt-collapse` 行为钩子保留；合并折叠仍用 `createCollapsible`（label 改「答案与笔记」，`startsOpen` 由 foldOpen 决定，`onFirstOpen` 同时渲染答案与编辑器）。
- `pd-fold-head` 38px（阅读）/30px（库卡）由作用域类区分。
- 旧的三条折叠（答案/个人笔记/AI 笔记）在阅读卡合并为一条 + 可选 AI 行；题库卡也使用合并折叠。
- 其余 `pd-*` 类不变；`styles.css` 分段顺序不变，新增段「v3 增量」放在题库段之后、响应式之前。

---

## 7. data.json v3 增量

### 7.1 只新增两个字段

`QuestionState` 增加：

```ts
export interface QuestionState {
  // ...v2 既有字段不变...
  /** 个人笔记最后保存时间（本地 ISO）；无笔记/未保存过 → null */
  notesUpdatedAt: string | null;
  /**
   * 「答案与笔记」折叠是否展开；
   * 省略（undefined）= 未设置 → 阅读卡默认 false、题库卡默认 true。
   * 一旦用户手动开合，写显式 true/false。
   */
  foldOpen?: boolean;
}
```

**不新增**：`category`（纯派生，不落状态）、笔记正文、答案、题干、任何其它字段。

### 7.2 示例片段

```json
"demo-gaoshu-deriv-001": {
  "id": "demo-gaoshu-deriv-001",
  "star": true,
  "subject": "高等数学",
  "tags": ["导数", "极限"],
  "source": "示例 · 高等数学 第七版 p.86",
  "file": "zaptrace-demo.md",
  "stemHash": "03153823b992",
  "firstSeenAt": "2026-11-02T15:34:13+08:00",
  "lastSeenAt": "2026-11-02T16:53:50+08:00",
  "step": -1,
  "due": null,
  "lapses": 0,
  "reviews": [],
  "orphaned": false,
  "notesUpdatedAt": "2026-11-02T17:42:10+08:00",
  "foldOpen": true
}
```

### 7.3 归一化与默认

在 `normalizeQuestionState` 内：

```ts
notesUpdatedAt:
  typeof record.notesUpdatedAt === "string" && record.notesUpdatedAt !== ""
    ? record.notesUpdatedAt
    : null,
...(typeof record.foldOpen === "boolean" ? { foldOpen: record.foldOpen } : {}),
```

- `knownState` 集合加入 `"notesUpdatedAt"`、`"foldOpen"`；其余未知字段继续原样保留。
- 新建状态（`ensureQuestionFromCard`）：`notesUpdatedAt: null`，**不写** `foldOpen`（保持 undefined）。
- `schemaVersion` **保持 1**：两个字段都是可选增量，旧数据经 normalize 自动默认，不需要破坏性迁移。
  - 若团队强制版本号递增，则加 `migrate_1_to_2`：仅给每个 question 补 `notesUpdatedAt: null`（foldOpen 保持缺省），并保留原备份流程；本文推荐**不 bump**。
- 读写边界：
  - `notesUpdatedAt` 只由「笔记保存成功」写；空笔记 → `null`。
  - `foldOpen` 只由「折叠开合」写；无其它写路径。
  - `category` 永不写入 data.json；筛选/显示读实时索引 `card.category`。
  - 未知字段与旧版 `theme` 等设置字段全部保留（现有 normalize 深合并逻辑不变）。

### 7.4 兼容性矩阵

| 旧 data.json | v3 行为 |
| --- | --- |
| 无 `notesUpdatedAt` | 读取为 `null`；显示「无时间」；首次保存后写入 |
| 无 `foldOpen` | `undefined`：阅读默认关、题库默认开；用户开合后写入 |
| 有未知字段 | 原样保留（现有 knownState/knownTop 白名单机制） |
| `schemaVersion` 1 | 正常加载，不做迁移 |
| `schemaVersion` 0 | 走现有 0→1 迁移，再按 v3 normalize |
| `schemaVersion` > 1 | 只读模式（现有安全策略不变） |

---

## 8. 空态 / ARIA / 键盘 / 动效

### 8.1 空态

| 场景 | 文案/行为 |
| --- | --- |
| 未选大科目 | 子科目下拉禁用，提示「先选择大科目」；标签 chips 禁用 |
| 大科目下无题 | 「该大科目下暂无题目」+「清除筛选」 |
| 筛选无结果 | 沿用 v2「没有符合条件的题」 |
| 笔记为空 | textarea placeholder「写点什么…（支持 Markdown 与 $公式$）」；**不显示时间** |
| 保存中/保存成功 | `.pd-note-status`：`aria-live="polite"`「保存中…」→「已保存 17:42」 |
| 保存失败 | 行内红字「保存失败：…」+ 保留草稿 |

### 8.2 ARIA

- 折叠行：`button aria-expanded` + `aria-controls`（id 用自增 `zt-collapse-N`，不用 qid）。
- 星标：`button aria-pressed`，`aria-label` 随状态。
- 大科目/子科目：`select` + `label`；禁用加 `disabled` + `aria-disabled` + `title`。
- 标签 chips 容器：`role="group" aria-label="标签筛选"`；禁用时 `aria-disabled="true"`，chip `disabled`。
- 笔记：`label[for]` + `textarea id`；`aria-describedby` 指向时间/状态；`aria-invalid` 在保存失败时设 true。
- 库卡点击区：`role="button" tabindex="0"`，`aria-label="练习：题干摘要"`；折叠与星标为**兄弟按钮**，绝不嵌套在点击区里（避免嵌套交互元素）。
- 动态保存状态 `aria-live="polite"`。

### 8.3 键盘

| 场景 | 键 |
| --- | --- |
| 折叠 | `Enter` / `Space` 开合 |
| 星标 | `Enter` / `Space` 切换 |
| 笔记 textarea | 正常输入；`Ctrl/Cmd+Enter` 保存；`Esc` 取消（脏时 `confirm` 后丢弃） |
| 库卡 | `Tab` 到 `pd-qcard-open`，`Enter` 练习；再 `Tab` 到星标/⋯/折叠/textarea |
| 筛选 | 原生 select；标签 chips `Enter/Space` 切换 |
| 分段 | `←/→` 切换（v2 已有） |

### 8.4 动效 / reduced-motion

- 折叠展开保持 `grid-template-rows 0fr→1fr`，220ms（库卡 220ms 同样）；
- 笔记编辑器出现不额外做入场动画，避免长高跳动；
- `prefers-reduced-motion: reduce` 把 `.pd-fold`, `.pd-fold-body`, `.pd-fold-chevron`, `.pd-note-*` 全部压到 1ms（沿用 v2 规则并补新类）。
- 触摸设备 `hover:none`：星标与 ⋯ 常驻可见；库卡工具始终显示。

---

## 9. Obsidian 1.14.5 真机验收与截图步骤

### 9.1 准备

1. Obsidian 1.14.5，vault `E:\NoteCache`，暗色 100%；记录 `manifest.json` 版本。
2. `npm.cmd run build`；把 `main.js` / `manifest.json` / `styles.css` 覆盖到 `E:\NoteCache\.obsidian\plugins\ZapTrace`（**保留 data.json**）；`Ctrl+R` 重载，确认新 CSS/JS。
3. 测试数据（不改 `examples/zaptrace-demo.md`；复制到 vault 后另建副本测试）：
   - 卡 1：`category: 数学` + `subject: 高等数学` + `tags: 导数, 极限` + 有笔记；
   - 卡 2：`category: 数学` + `subject: 线性代数` + `tags: 行列式` + 无笔记；
   - 卡 3：无 `category`（验证推断为数学）+ `subject: 概率论`；
   - 卡 4：`category: 英语` + `subject: 阅读理解`（验证第二组大科目）。

### 9.2 截图清单

| # | 场景 | 操作 | 期望 |
| --- | --- | --- | --- |
| V1 | 阅读卡折叠（默认关） | 打开 demo 阅读视图 | 单条「答案与笔记」38px 折叠行；★ 常驻 + ⋯；标签为 [数学][高等数学][…] |
| V2 | 展开 + 笔记编辑 | 点开折叠 | 答案渲染 + 笔记 textarea + 保存/取消 + 「更新于 …」；（无笔记卡不显示时间） |
| V3 | 保存笔记 | 修改笔记→保存 | 目标文件仅「### 个人笔记」节变化；答案/题干/其它块不变（git diff/字节对比）；时间更新 |
| V4 | 折叠状态持久化 | 展开→关闭 Obsidian/重开该 MD | 下次进入仍保持上次开合（reading 默认关；题库默认开） |
| V5 | 题库三列（1920） | 打开工作台题卡流 | 一行 3 卡、间距 12、卡内紧凑 |
| V6 | 大科目联动 | 选「数学」→子科目/标签可用；未选时灰色禁用 | 选项仅该 category 下；切换重置 |
| V7 | 库卡默认展开+编辑 | 打开题卡流 | 每卡默认展开「答案与笔记」，可折叠、可就地编辑 |
| V8 | 1200 / 1000 宽 | 缩窗 | 1200→2 列；1000→1 列 |
| V9 | 亮色/焦点/触摸 | 亮色 + Tab + DevTools 触摸 | 对比度正常、2px accent 焦点环、星标/⋯ 常驻 |
| V10 | reduced-motion | DevTools 模拟 | 无位移/缩放动画 |
| V11 | 空态 | 未选大科目 / 大科目无题 | 禁用提示 / 空态文案正确 |
| V12 | data.json | 保存笔记前后 diff | 仅 `notesUpdatedAt`（或 `foldOpen`）变化；未知字段保留；schemaVersion 仍 1 |

### 9.3 验证脚本建议

- 保存前后对目标 `.md` 做 `git diff` 或字节比对，断言只有目标 `### 个人笔记` 节变化。
- `npm.cmd test` 必须包含 `tests/notes.test.ts` 全绿；`npm.cmd run typecheck`、`npm.cmd run build` exit 0。
- data.json 校验：`notesUpdatedAt` 为 ISO 或 null；`foldOpen` 只在用户开合后出现。

---

## 10. 实施顺序与文件影响

| 阶段 | 内容 | 出口 |
| --- | --- | --- |
| P0 | 解析器 `category` + 索引/标签 + 类型字段（`QuestionCard.category`） | 单测：category 推断/字段解析 |
| P0 | `src/core/notes.ts` 纯函数 + `tests/notes.test.ts` | 13 条 fixture 全绿 |
| P1 | `QuestionState` 两字段 + normalize + setFoldOpen/saveNotes 适配 | 旧 data.json 兼容测试 |
| P1 | 阅读卡合并折叠 + 编辑器 + 星标 | V1–V4 通过 |
| P2 | 题库三列 + 大科目联动 + 库卡默认展开/编辑 | V5–V8 通过 |
| P2 | 紧凑尺寸、空态、ARIA、reduced-motion | V9–V12 通过 |

**影响文件（实现阶段）**：
- `src/core/types.ts`（加 `category`、两个 state 字段）
- `src/core/parse.ts`（KNOWN_KEYS + `category`）
- `src/core/index.ts`（category 汇总/去重）
- `src/core/state.ts`（normalize/ensure 两字段；不改评分）
- `src/core/notes.ts`（**新增纯函数**）
- `src/view/card.ts`（合并折叠+编辑器+星标）
- `src/view/libraryPanel.ts`（三列、联动筛选、库卡折叠/编辑）
- `src/view/dom.ts`（createCollapsible 支持 startsOpen/自定义 head 内容；模式不变）
- `src/view/pluginContext.ts` / `src/main.ts`（`saveNotes`、`setFoldOpen` 适配）
- `styles.css`（v3 增量段）
- `tests/notes.test.ts`（新增）、既有 core 测试保持

**明确不动**：解析规则（除新增可选 header key）、qid/instanceKey、评分/复习算法、H1–H4、`data.json` 既有字段、`examples/zaptrace-demo.md`。

---

## 11. 明确非目标（本次不做）

- ❌ PDF 导入 / 解析 / 来源筛选（`pdf` 字段仍只展示）。
- ❌ AI 生成笔记/答案（`AI 笔记` 仍是纯文本折叠行，不调用模型）。
- ❌ 批注/高亮/划词。
- ❌ 多笔记版本历史、协同编辑、云端同步。
- ❌ 题库批量编辑、拖拽排序、复杂组卷。
- ❌ 富文本编辑器（笔记编辑框是纯 Markdown textarea）。

---

## 附录 A · 纯函数草案（category / 筛选 / fold 默认）

```ts
// parse.ts 内
const KNOWN_KEYS = new Set([
  "id", "subject", "category", "tags", "source",
  "star", "difficulty", "pdf",
]);

// buildIndex 内，与 subject fallback 并列
const category = card.category?.trim() || "数学";

// 题库联动筛选（视图层纯函数）
function categoryOptions(cards: QuestionCard[]): string[] { ...去重排序... }
function subjectOptions(cards: QuestionCard[], category: string | null): string[] {
  if (!category) return [];
  return unique(cards.filter(c => c.category === category).map(c => c.subject));
}
function tagOptions(cards: QuestionCard[], category: string | null): string[] {
  if (!category) return [];
  return unique(cards.filter(c => c.category === category).flatMap(c => c.tags));
}

// fold 默认
const foldDefault = (state: QuestionState | undefined, context: "reading" | "library") =>
  state?.foldOpen ?? (context === "library");
```

## 附录 B · 笔记保存 fixture（示例）

**输入（节选）**：
```markdown
### 答案

$f'(1)=2$。

### 个人笔记

- 旧笔记 A
- 旧笔记 B

### AI 笔记

> 旧 AI 笔记
```
**draft**：`- 新笔记：先增量比再取极限`
**期望**：仅 `### 个人笔记` 与 `### AI 笔记` 之间内容替换为 `- 新笔记：先增量比再取极限`；答案、AI 笔记、行尾、缩进、文件末尾换行完全不变；`notesUpdatedAt` 更新。

## 附录 C · 类名/令牌增量索引

| 新类/令牌 | 说明 |
| --- | --- |
| `.pd-tag.is-category` | 大科目 chip |
| `.pd-fold[data-fold="answer-notes"]` | 阅读卡合并折叠 |
| `.pd-qcard-fold` / `--pd-fold-h-lib:30px` | 库卡紧凑折叠 |
| `.pd-qcard-open` | 库卡点击区（与折叠/星标分离） |
| `.pd-qcard-answer` | 库卡答案纯文本预览 |
| `.pd-note-block/-head/-label/-time/-input/-actions/-status` | 笔记编辑器 |
| `.pd-btn.is-small` | 26px 小按钮 |
| `.pd-star.is-active` | 收藏星标 amber |
| `--pd-grid-cols` / `--pd-qcard-pad` / `--pd-grid-gap` / `--pd-answer-preview-h` / `--pd-note-min-h/max-h` | v3 紧凑令牌 |

---

*本文为 v3 增量设计，只写文档；实现请按 §10 顺序落地，解析/ID/data.json 既有语义与 `DESIGN.md` 契约不变。*
