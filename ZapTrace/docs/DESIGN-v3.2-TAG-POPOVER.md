# ZapTrace v3.2 增量设计：标签下拉、分类面板与星标交互

> 版本：v3.2 · 2026-11-02
> 依据：`docs/DESIGN-v3-ENHANCEMENTS.md`、`docs/DESIGN-v3.1-METADATA-EDITOR.md`、`docs/REVIEW-v3-ENHANCEMENTS.md`、现有源码（`card.ts` / `libraryPanel.ts` / `menu.ts` / `noteEditor.ts` / `settingsTab.ts` / `main.ts` / `styles.css`）、用户 18:xx 批注截图
> 性质：**增量设计，只写本文档，不改代码**。不扩 PDF / AI / 批注。

---

## 0. 一页结论

| 用户批注 | v3.2 落点 |
| --- | --- |
| 「科目和子科目需要到 ZapTrace 的面板进行设置，这里只可以指定，但可以新增标签」 | 工作台顶部新增 **「分类设置」**（+ 设置页入口）；taxonomy 存 `settings.taxonomy`；卡片 popover 只能**选已配置**，不能创建大/子科目；标签可自由新增（§1、§3） |
| 「定义标签的图标放在这里，且改为下拉框，而不是现在的弹窗」 | 阅读卡/题库卡右侧工具区加 **`tags` 图标**，点击打开**紧凑 popover（非 modal）**：大科目 select → 子科目 select 联动 + 标签 chips 增删（§2） |
| 「⭐ 默认是隐藏的状态……点击收藏后，填满星星颜色，且点击有音效反馈」 | 星标默认 `opacity:0`，hover/focus 才显示；点击后实心填充 amber；**本地 Web Audio 短音效**（无外部资源、失败静默、不阻塞）（§3） |
| 「不要 v3.1 的旧 modal」 | 移除菜单里的「编辑分类与标签」旧 modal 入口；保留 `patchCardMetadata` 纯函数与 `saveMetadata` 适配，供 popover 复用（§4） |
| 验收截图 | 分类设置 / popover / 同色 chips / 星标 hover·active / 音效代码路径（§7） |

**硬约束**：分类配置只进 `settings.taxonomy`（settings 现有存储，不新增 data.json 顶层字段、不改 schemaVersion）；卡片编辑仍只写目标 `zaptrace` 块头部 `category/subject/tags`，不改题干/答案/笔记/其它块。

---

## 1. 分类配置（Taxonomy）

### 1.1 数据模型

```ts
export interface TaxonomyCategory {
  name: string;                 // 大科目，trim、非空
  subjects: string[];           // 子科目列表，trim、去重
  [key: string]: unknown;       // 前向兼容：保留未知字段
}
export interface TaxonomyConfig {
  categories: TaxonomyCategory[];
  /** 是否已完成「从现有题卡一次性播种」 */
  seeded: boolean;
  [key: string]: unknown;
}
```

```ts
export interface ZaptraceSettings {
  // ...现有字段...
  /** v3.2 新增：分类配置（大科目 → 子科目）；只影响选择器，不改卡片 */
  taxonomy: TaxonomyConfig;
}

export const DEFAULT_SETTINGS: ZaptraceSettings = {
  // ...
  taxonomy: { categories: [], seeded: false },
};
```

- **不动 `data.json.schemaVersion`**（仍为 1）：这是 settings 的子字段，读旧数据时自动补默认，属兼容增量。
- `category` 仍不写入 `QuestionState`；taxonomy 是「可选值字典」，不是卡片状态。

### 1.2 默认与迁移

`normalizeSettings()` 内新增：

```ts
merged.taxonomy = normalizeTaxonomy(record.taxonomy);
```

`normalizeTaxonomy(raw)`（建议放 `src/core/taxonomy.ts`，纯函数）：

1. `raw` 缺失/null → `{ categories: [], seeded: false }`。
2. 兼容旧/手写形态：数组（字符串或 `{name, subjects}`）、或 `{categories, seeded}`。
3. 每个 category：`name.trim()` 非空才保留；`subjects` 数组逐项 trim、去重；category 重名合并（保留首次，subjects 并集）。
4. 保留每个 category 与顶层对象上的**未知字段**（`{...extra, name, subjects}`）。
5. `seeded` 必须是 boolean，否则 `false`。

**一次性播种（可选但推荐）**：插件 `rebuildIndex()` 成功后，若 `!settings.taxonomy.seeded` 且 `categories.length===0` 且当前有题卡：

- 按 `card.category`（缺省 `数学`）分组，收集去重后的 `card.subject`；
- 写入 `settings.taxonomy.categories`，`seeded=true`，`saveSettings`；
- 只读模式下不播种、不写盘；
- 用户之后清空 categories 不会再次自动播种（`seeded` 已 true）。

> 播种是**迁移便利**，不是「卡片创建分类」：卡片本身仍不可写 taxonomy；用户也可完全手动配置。

### 1.3 入口与面板

| 入口 | 行为 |
| --- | --- |
| **工作台顶部** `.pd-lib-header` 的 `.pd-header-actions` 加 `分类设置` 按钮（icon `tags`，文字按钮） | 打开 `TaxonomyModal` |
| **插件设置页** 新增一行「分类设置」+「编辑分类」按钮 | 打开同一个 `TaxonomyModal`（复用同一编辑器组件） |

`TaxonomyModal`（Obsidian `Modal` 子类；`pd-root pd-modal-host`，尺寸 `min(560px, calc(100vw-32px))`）：

```
分类设置
管理大科目与子科目；只影响选择器，不改写已有题卡。

[大科目列表]
┌ 数学                  [删除]
│ 子科目: [高等数学 ×] [线性代数 ×] [+ 子科目输入][添加]
├ 英语                  [删除]
│ 子科目: [阅读理解 ×] [+ 子科目输入][添加]
└ [+ 新增大科目输入][添加]

（题卡中出现但未配置）
[数学A] [概率论] …  [加入配置]

[未保存修改提示 / 错误]
                              [取消] [保存]
```

- 编辑全部在**内存草稿**中进行；`保存` 才写 `settings.taxonomy`，`取消` 丢弃。
- 新增/删除大科目；给每个大科目新增/删除子科目；删除大科目连带删除其子科目（仅草稿）。
- 重名/空名：行内红字（`aria-live`）；不允许保存。
- 「未配置项」来自当前卡片 `category/subject` 去重；点「加入配置」把该值加入草稿（大科目加入 categories，子科目加入对应 category），**不自动写卡**。
- 保存：`plugin.updateSettings({ taxonomy: { categories, seeded: true } })`；不触发卡片重写；如需刷新下拉，调用 `plugin.refreshAll()`（popover 每次打开重新读取 settings）。
- 删除已有卡片在用的大科目：确认提示「不会修改已有题卡，但相关卡片会显示为未配置」；保存后卡片值保留。

### 1.4 与卡片/筛选的关系

- **卡片不能创建分类**：popover 的大科目/子科目 select 只列 taxonomy 中的值；当前卡片值不在 taxonomy 时，显示为禁用项「（未配置）X」并提示去分类设置添加。
- 题库筛选仍按现有 v3 逻辑从**卡片实际值**生成（taxonomy 不强制过滤选项）；taxonomy 只约束编辑时的可选值。
- 卡片显示仍 `card.category || "数学"`、`card.subject || "未分类"`。

---

## 2. 标签图标与 popover

### 2.1 触发位置

阅读卡与题库卡右侧工具区统一为：

```
.pd-card-tools / .pd-qcard-tools
├─ button.pd-icon-btn.pd-tag-btn   [tags]  ← 新：编辑标签（常驻可见）
├─ button.pd-icon-btn.pd-star      [★]     ← 默认隐藏，hover/focus/已收藏才显示
└─ button.pd-icon-btn              [⋯]     ← hover/focus 显示（保持现状）
```

- `pd-tag-btn`：22×22 命中，16px `tags` 图标，`aria-label="编辑标签"`，`aria-haspopup="dialog"`。
- 三个工具图标固定在右上；标题/标签行右侧需留白：阅读卡 `padding-right ≥72px`、题库卡 `padding-right ≥84px`，避免图标压住 chips。
- 点击：`openTagPopover(anchor, plugin, card)`；不打开 v3.1 旧 modal。
- 触摸设备（`hover:none`）：tag 图标与 ⋯ 常驻；星标规则见 §3。
- 表格行 `⋯` 可额外加「编辑标签」菜单项打开同一 popover（可选，不影响卡片要求）。

### 2.2 Popover 结构与尺寸（非 modal）

```
.pd-root.pd-popover.pd-tag-popover
├─ .pd-popover-head
│  ├─ span「标签」
│  └─ button.pd-icon-btn [x]（关闭）
├─ .pd-pop-row
│  ├─ label 大科目
│  └─ select.pd-pop-select  （仅 taxonomy.categories；当前未配置→disabled option）
├─ .pd-pop-row
│  ├─ label 子科目
│  └─ select.pd-pop-select  （taxonomy[category].subjects；随大科目联动）
├─ .pd-pop-row.is-tall
│  ├─ label 已选标签
│  ├─ .pd-tag-selected  [chip ×] [chip ×] …
│  └─ input.pd-pop-input  （输入标签，回车添加；datalist 建议）
├─ .pd-pop-hint 「大科目/子科目需在「分类设置」中添加；标签可自由新增」
├─ .pd-pop-error[role=status][aria-live=polite]
└─ .pd-pop-actions [取消][保存]
```

| 项 | 值 |
| --- | --- |
| 宽度 | `320px`（移动 `<480px` 时 `calc(100vw-24px)`） |
| 最大高 | `min(420px, calc(100vh-32px))`，内容滚动 |
| 背景 | `--pd-pop` + `backdrop-filter: blur(16px)` |
| 边/圆角/阴影 | 1px `--pd-line` / 12px / `--pd-shadow` |
| 内边距 | 12px |
| 行间距 | 10px |
| select / input | 高 30 / 圆角 8 / `--pd-surface-2` 底 / 无边框 / 13px |
| 已选 chip | 复用 `.pd-tag.is-topic` 20px + 9px `×` 按钮 |
| 按钮 | `.pd-btn` 26px（取消）/ `.pd-btn.is-primary`（保存） |
| 动效 | 120ms `opacity + translateY(-4px→0)`；`reduced-motion` 1ms |

### 2.3 联动与编辑规则

1. **大科目**：options = `taxonomy.categories`（配置顺序）；首项「请选择」不可保存。
   - 当前 `card.category` 不在 taxonomy → 追加 `disabled` 项「（未配置）<值>」并选中，提示「请先在分类设置中添加」；用户可改选已配置值。
2. **子科目**：`disabled` 直到大科目有值；options = 该 category 的 subjects；
   - 当前 `card.subject` 不在该列表 → 追加 disabled「（未配置）<值>」；可改为已配置值或留空（留空=文件夹/未分类回退）。
3. **标签 chips**：初始 = `card.tags`；`×` 移除；输入框回车/点「添加」追加（trim、去重、忽略空）；输入为空按 Backspace 移除最后一个 chip（可选）。
4. **建议**：`datalist` 汇总当前 category 下所有卡片 tags（去重、排除已选）；不限制自由输入。
5. **保存**：
   - 大科目必须有值（配置项或当前未配置项）；否则保存禁用 + 提示。
   - 调用 `plugin.saveMetadata(card, { category, subject, tags })`（复用 v3.1 `patchCardMetadata` + `vault.process`）。
   - 成功：关闭 popover → `rebuildIndex` + `refreshAll`（已在 `saveMetadata` 内）→ 卡片 chips 与题库筛选更新；焦点回 tag 按钮。
   - 失败：popover 保持打开，`.pd-pop-error` 红字；不改文件、不改缓存。
   - `changed=false`：关闭并提示「内容未变化」。

### 2.4 定位 / 关闭 / 键盘

- **定位**：`position:fixed`；默认贴 `pd-tag-btn` 右下方 6px，右对齐；下方不够翻到上方；左右夹 8px；滚动/resize 重新定位；锚点不可见则关闭。
- **关闭**：点击外部、`Esc`、点 `×`、再次点 tag 按钮。
- **脏检测**：若修改过再关闭（外部/Esc/×），`window.confirm("放弃未保存的标签修改？")`；确认后关闭并恢复锚点焦点。
- **焦点**：打开后焦点落「大科目」select；`Tab` 顺序 大科目→子科目→标签输入→chips ×→取消→保存；`Esc` 关闭回到 tag 按钮；不设焦点陷阱（popover 非 modal）。
- **键盘**：标签输入 `Enter` 添加（阻止表单提交）；`Ctrl/Cmd+Enter` 保存；`Backspace` 空输入删最后一个 chip。
- **移动端**：`<480px` 改为底部固定面板（`position:fixed; left:12px; right:12px; bottom:12px; max-height:70vh`），保留 `role="dialog" aria-label="编辑标签"`；无遮罩点击外部语义改为「点面板外关闭」。

---

## 3. 星标交互与音效

### 3.1 默认隐藏、hover/focus 显示

| 状态 | 表现 |
| --- | --- |
| 默认（未收藏） | `opacity:0`，不占视觉焦点（仍保留命中框，不 `display:none`） |
| 卡片 hover / `:focus-within` | `opacity:1`，显示空心星（`--pd-muted`） |
| 已收藏 | **常驻可见**，实心 amber（即使不 hover） |
| 收藏动画 | 120ms `transform: scale(.9→1)` + 颜色过渡 |

```css
.pd-card-tools .pd-star,
.pd-qcard-tools .pd-star {
  width: 22px; height: 22px;
  opacity: 0;
  transform: scale(.92);
  transition: opacity 120ms ease, transform 120ms ease, color 120ms ease;
}
.pd-card:hover .pd-star,
.pd-card:focus-within .pd-star,
.pd-qcard:hover .pd-star,
.pd-qcard:focus-within .pd-star,
.pd-star.is-active {
  opacity: 1; transform: none;
}
.pd-star.is-active { color: var(--pd-amber); }
.pd-star.is-active svg { fill: currentColor; }   /* Lucide 默认 fill:none */
```

- 星标点击只写 `data.json.questions[qid].star`（现有 `toggleStar`），不写 Markdown。
- `⋯` 菜单仍保留「收藏/取消收藏」；星标只是独立快捷入口。
- `hover:none` 设备：星标常驻可见（无 hover 可用），未收藏用空心、已收藏实心。

### 3.2 点击音效（本地 Web Audio）

- 新增 `src/view/starSound.ts`：

```ts
let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

/** 一次极短「嗒」声；失败静默、不阻塞、不抛错。 */
export function playStarClick(): void {
  try {
    const ac = getCtx();
    if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.05);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  } catch { /* 静默 */ }
}
```

- **调用时机**：星标点击、`toggleStar` 成功后 `playStarClick()`（fire-and-forget，不 `await`）。
- **无外部资源**：单 oscillator，无音频文件、无网络请求。
- **失败静默**：无 `AudioContext`、构造异常、`resume` 拒绝、自动播放策略限制——全部 `try/catch` 吞掉，不影响收藏状态更新。
- AudioContext 单例懒创建（首次用户点击手势内创建，符合浏览器自动播放策略）；插件卸载可选择 `ctx?.close()`（失败忽略）。
- 不做音量设置项（保持 v3.2 最小）；后续如需可加 `soundEnabled`。

---

## 4. 元数据保存（复用 v3.1）

- **保留**：`patchCardMetadata()` 纯函数（行令牌化、只改目标块 header）与 `plugin.saveMetadata(card, {category,subject,tags})` 适配完全复用，不重写。
- **移除**：v3.1 `MetadataEditorModal` 的菜单入口与 wiring；旧 modal 文件可删除或留作 dead code（不参与构建路径）。菜单中不再出现「编辑分类与标签」modal 项。
- 保存流程与 v3.1 §5 一致：fresh read → rescan 定位 qid → patch → `vault.process` → `rebuildIndex` + `refreshAll`；失败零副作用。
- **不新增 data.json 字段**：taxonomy 在 `settings`（现有存储）；卡片元数据只写 Markdown header。
- 保存后题库筛选联动：`rebuildIndex` 刷新 `card.category/subject/tags`，大科目/子科目/tag 选项与列表随之更新。
- 并发/移动：保存前重读文件并按 qid 重定位；找不到提示「题卡已移动/删除，请刷新索引」。

---

## 5. 同色 chips（沿用 v3.1）

```css
/* v3.1 已定：category 与 subject 同色；v3.2 不变 */
.pd-tag.is-category,
.pd-tag.is-subject {
  background: var(--pd-accent-soft);
  color: var(--pd-accent);
}
.pd-tag.is-topic {
  background: color-mix(in srgb, var(--pd-fg) 5%, transparent);
  color: var(--pd-fg-2);
}
```

- 阅读卡与题库卡共用 `.pd-tag`，一处生效；题库小尺寸只改 height/font-size。
- 分类设置面板与 popover 的预览 chips 统一 `.pd-tag.is-topic`（中性）。

---

## 6. 组件 / CSS / ARIA

### 6.1 新增类/文件

| 类 / 文件 | 用途 |
| --- | --- |
| `.pd-taxonomy-btn` | 工作台顶部「分类设置」按钮 |
| `TaxonomyModal` / `.pd-taxonomy-*` | 分类设置面板 |
| `.pd-tag-btn` | 卡片工具区标签图标 |
| `.pd-popover.pd-tag-popover` / `.pd-pop-*` | 标签下拉 |
| `.pd-tag-selected` | 已选标签 chip 容器 |
| `.pd-star` 状态规则（§3） | 隐藏/显示/实心 |
| `src/view/tagPopover.ts` / `src/view/taxonomyPanel.ts` / `src/view/starSound.ts` | 新组件 |
| `src/core/taxonomy.ts` | `normalizeTaxonomy` 纯函数（可测） |

### 6.2 CSS 摘要

```css
.pd-popover {
  position: fixed; z-index: calc(var(--layer-popover, 50) + 3);
  width: 320px; max-height: min(420px, calc(100vh - 32px));
  overflow: auto; padding: 12px;
  border: 1px solid var(--pd-line); border-radius: 12px;
  background: var(--pd-pop); box-shadow: var(--pd-shadow);
  backdrop-filter: blur(16px);
  opacity: 0; transform: translateY(-4px);
  transition: opacity 120ms ease, transform 120ms ease;
}
.pd-popover.is-open { opacity: 1; transform: none; }
.pd-pop-row { display: grid; grid-template-columns: 64px minmax(0,1fr); gap: 8px 10px; margin-bottom: 10px; }
.pd-pop-select, .pd-pop-input {
  height: 30px; border: 0; border-radius: 8px; padding: 0 8px;
  background: var(--pd-surface-2); color: var(--pd-fg);
  font-family: var(--pd-font); font-size: 13px;
}
.pd-tag-selected { grid-column: 2; display: flex; flex-wrap: wrap; gap: 6px; }
.pd-pop-error { min-height: 16px; font-size: 11.5px; color: var(--pd-red); }
.pd-pop-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
@media (max-width: 479px) {
  .pd-popover { left: 12px; right: 12px; bottom: 12px; width: auto; max-height: 70vh; }
}
```

### 6.3 ARIA / 键盘

| 项 | 规格 |
| --- | --- |
| tag 按钮 | `aria-label="编辑标签"`，`aria-haspopup="dialog"`，`aria-expanded` 随开合 |
| popover | `role="dialog" aria-label="编辑标签"`（非 modal，无焦点陷阱）；标题 id |
| 大/子科目 | `select` + `label`；禁用 `disabled aria-disabled title` |
| 标签 chip × | `button aria-label="移除标签 <名称>"` |
| 错误 | `.pd-pop-error` `role="status" aria-live="polite"` |
| 关闭 | 外部点击 / `Esc`，焦点回 tag 按钮；脏时确认 |
| 分类设置 | Modal 自带 role dialog / 焦点陷阱；Esc 关闭（脏时确认） |
| reduced-motion | popover/星标/分类面板过渡压到 1ms |

---

## 7. 单测与验收（Obsidian 1.14.5）

### 7.1 单测（`tests/taxonomy.test.ts`）

1. `normalizeTaxonomy(undefined)` → `{categories:[],seeded:false}`。
2. 数组/对象两种旧形态归一；trim、去重、去空。
3. 重名 category 合并 subjects 并集；保留未知字段。
4. 非 boolean `seeded` → false。
5. `normalizeSettings` 旧 data.json（无 taxonomy）→ 默认；未知外层字段保留。
6. `patchCardMetadata` 回归：v3.1 的 19 条测试保持全绿（本版不改纯函数）。
7. `saveMetadata` 适配层失败路径：找不到文件/块移动 → 不写盘（可 mock）。

### 7.2 真机截图点

| # | 场景 | 期望 |
| --- | --- | --- |
| S1 | 工作台顶部「分类设置」入口 → 面板 | 可新增大科目、给大科目加子科目、删除；保存后 toast/无错误 |
| S2 | 分类设置保存后 → 卡片 tag 图标 popover | 大科目/子科目下拉出现新值；未配置值以禁用项提示 |
| S3 | 阅读卡工具区默认态 | 无星标；可见 `tags` 图标 +（hover 时）⋯ |
| S4 | 阅读卡 hover/聚焦 | 星标淡入（空心）；点击后实心 amber；再点取消 |
| S5 | 标签 popover 打开 | 大科目 select → 子科目联动；已选标签 chips 可 ×；输入新增；保存/取消 |
| S6 | 保存后卡片与筛选 | 卡片 chips 更新；题库大科目/子科目/tags 选项与列表联动；仅 header 字节变化 |
| S7 | 题库卡同样操作 | 与阅读卡一致（同色 chips、tools 顺序一致） |
| S8 | 关闭行为 | 外部点击/Esc 关闭；脏时确认；焦点回 tag 按钮；移动宽度 <480 为底部面板 |
| S9 | 星标音效 | 无法截图；记录代码路径 `src/view/starSound.ts::playStarClick`；手动听「嗒」；Console 无异常；禁用 AudioContext 时静默 |
| S10 | data.json | `settings.taxonomy` 新增/更新；卡片无新字段；schemaVersion 仍 1；未知字段保留 |

### 7.3 步骤

1. Obsidian 1.14.5，vault `E:\NoteCache`，暗色 100%；备份 `data.json` 与测试笔记。
2. `npm.cmd test` / `npm.cmd run typecheck` / `npm.cmd run build` 全绿；覆盖三件套到 `E:\NoteCache\.obsidian\plugins\ZapTrace`（保留 data.json），`Ctrl+R` 重载。
3. 按 S1→S10 顺序操作与截图；音效人工听 + Console 检查；`data.json` 前后对比 key 集合。
4. 结束记录：Obsidian 版本、插件版本、main.js SHA-256、系统缩放。

---

## 8. 文件影响 / 实施顺序 / 非目标

| 阶段 | 内容 |
| --- | --- |
| P0 | `src/core/taxonomy.ts` + `tests/taxonomy.test.ts`；`ZaptraceSettings.taxonomy` + `DEFAULT_SETTINGS` + `normalizeSettings` |
| P0 | 一次性 seed（rebuild 后，只读跳过）；分类设置 Modal + 入口（workbench header / settings tab） |
| P1 | `tagPopover.ts` + 卡片工具区 tag 图标；移除旧 metadata modal 菜单入口 |
| P1 | 复用 `saveMetadata`；保存后刷新 |
| P2 | 星标隐藏/实心 CSS + `starSound.ts` 音效 |
| P2 | 同色 chips 回归、ARIA/键盘/移动端 |

**影响文件**：`src/core/types.ts`、`src/core/state.ts`（normalizeSettings）、`src/core/taxonomy.ts`（新）、`tests/taxonomy.test.ts`（新）、`src/view/taxonomyPanel.ts`（新）、`src/view/tagPopover.ts`（新）、`src/view/starSound.ts`（新）、`src/view/card.ts`、`src/view/libraryPanel.ts`、`src/view/workbenchView.ts`、`src/view/settingsTab.ts`、`src/main.ts`、`styles.css`。
**不改**：`patchCardMetadata` 算法、解析/ID/评分/复习、data.json schemaVersion、`examples/zaptrace-demo.md`。

**非目标**：不在卡片内创建大/子科目；不做分类批量迁移/重命名卡片；不做 AI 分类、PDF、批注；不做音量设置项。

---

## 附录 A · 交互速查

| 区域 | 默认 | hover/focus | 点击 |
| --- | --- | --- | --- |
| `tags` 图标 | 可见 | 底色 8% | 打开标签 popover |
| 星标 | 隐藏 | 显示空心 | 收藏/取消 + 实心/空心 + 音效 |
| ⋯ | 隐藏 | 显示 | 菜单（收藏/打开原文/复制题干） |

## 附录 B · taxonomy 示例

```json
{
  "settings": {
    "taxonomy": {
      "categories": [
        { "name": "数学", "subjects": ["高等数学", "线性代数", "概率论"] },
        { "name": "英语", "subjects": ["阅读理解", "词汇"] }
      ],
      "seeded": true
    }
  }
}
```

---

*本文为 v3.2 增量设计，只写文档；实现按 §8 顺序落地，卡片元数据保存仍复用 v3.1 纯函数与既有 data.json 边界。*
