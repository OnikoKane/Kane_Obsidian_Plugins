# ZapTrace v3.3 增量设计：三级分类、题型系统与题卡体验修正

> 版本：v3.3 · 2026-11-02
> 依据：`docs/DESIGN-v3.2-TAG-POPOVER.md`、`docs/REVIEW-v3.2-TAG-POPOVER.md`、用户批注截图（科目命名 / 瀑布流 / 笔记框 / 黑色气泡 / 三级标签 / 题型 / 删除题目 / 虚线添加框 / 水平对齐 / 提交答案）
> 性质：**增量设计**。不扩 PDF / AI / 批注；Markdown 仍是唯一内容真源。

---

## 0. 一页结论

| 用户批注 | v3.3 落点 |
| --- | --- |
| 「不用"大科目"描述，改为"科目"」 | 全部 UI 文案 `大科目 → 科目`（筛选、popover、分类设置、设置页）；数据键名 `category` 不变（§1） |
| 「各列的题卡要动态贴住，现在有太多的空白」 | 题卡流 grid → **多列瀑布流**（`column-count` + `break-inside: avoid`）（§2.1） |
| 「设编辑框默认大小，且记住对每道题目调整后的编辑框大小」 | 笔记框默认 120px；拖拽后按题写入 `questions[qid].noteHeight`（§2.2） |
| 「去除插件内该类批注弹窗」+「莫名其妙的黑色弹窗」 | 全插件 `--no-tooltip: true` 关闭 Obsidian 原生 `aria-label` 悬浮提示（§2.3） |
| 「点击题目会出现"练习"弹窗不需要」 | 题库卡/表格行移除点击进抽屉；抽屉仅由显式入口打开（§2.4） |
| 「科目 > 子科目 > 小标签，彼此绑定」「小标签跟在对应子科目后面」 | taxonomy 新增第三层 `subjectTags`；面板逐子科目编辑；popover「可选标签」按子科目过滤（§3） |
| 「小标签添加后要能够修改 并同步到题库的题目」 | 面板内点标签名就地改名；保存时 `syncTagRenames()` 批量改写题卡头部 tags（§3.3） |
| 「添加的框改为虚线样式（MD 内同步）」 | 面板与 popover 的添加框统一为虚线 `＋ 添加…` chip，点击就地展开输入（§3.4） |
| 「灰色小标签最多支持在外边显示 3 个」 | 卡片头部章节 tags 截取 3 个 + `+N`（§3.5） |
| 「没有选择(单选/多选)/判断的UI」 | 头部 `type/options/answer` 解析 + 三处作答 UI（阅读卡/题库卡/练习抽屉）（§4） |
| 「加入一个"提交答案"按钮 触发后显示答案+对错」「多选题仅标注"多选题"」 | 卡内 `提交答案` 按钮：染色对错 + 自动展开答案折叠；题型标注 `单选题/多选题/判断题`（§4.3） |
| 「右键 > 插入题目」 | 编辑器右键菜单「插入题目」+ 新模板（含 `type/options/answer`、`### 笔记`）（§5） |
| 「加入删除题目 X删除题目(红色字体)」 | `⋯` 菜单红色 danger「删除题目」，确认后整块移除（§6） |
| 「"出处"和"未练"的位置互换」 | 题库卡底部：出处居左、状态/到期居右（§2.5） |

**硬约束不变**：Markdown 是内容真源；插件只在用户显式操作时写目标 `zaptrace` 块（插入模板 / 保存笔记 / 头部三行 / 重命名同步 / 删除整块）。

---

## 1. 命名与文案

- UI 一律「科目 / 子科目」；`category` 字段名、data 结构不变。
- 笔记编辑器标题「个人笔记 → 笔记」；分节标题新增 **`### 笔记`** 别名（与 `### 个人笔记` 等价），新模板/新插入统一用 `### 笔记`。

---

## 2. 题卡体验修正

### 2.1 题卡流瀑布流

- `.pd-grid` 由 `display: grid` 改为 `column-count: var(--pd-grid-cols)`；卡片 `break-inside: avoid`，空态 `column-span: all`。
- 容器查询（≥1080 三列 / 700–1079 两列 / <700 单列）与媒体查询兜底同步改为 `column-count`。
- 已知取舍：卡片顺序为列优先（自上而下再跨列）；换取每列紧密贴合。

### 2.2 笔记编辑框

- 默认高度 `--pd-note-min-h: 120px`（阅读卡与题库卡一致），上限 480px。
- `ResizeObserver` 防抖 350ms，拖拽后写 `questions[qid].noteHeight`（钳制 56–480）；下次渲染恢复。
- 左右各内收 4px（`width: calc(100% - 8px)`），选择器升权 `.pd-root .pd-note-input`，避免被主题按钮/输入样式覆盖。
- 「更新于 …」时间 `white-space: nowrap`，不再被截断。

### 2.3 关闭原生悬浮提示

- Obsidian 对 `[aria-label]` 元素弹原生 tooltip；其开关是计算样式 `--no-tooltip`。
- `.pd-root { --no-tooltip: true }` 一次性关闭插件内全部黑色气泡；`aria-label` 保留（无障碍不回退）。
- 例外：Obsidian 标签页自身的 tooltip 不在插件 DOM 内，不处理。

### 2.4 点击行为收敛

- 题库卡整卡 / 紧凑表格行不再触发练习抽屉；抽屉入口仅剩：页头 CTA、阅读卡「练习此卡」、独立复习。

### 2.5 卡片头部与底部

- 标签编辑图标（`tags`）内联到标签 chips 之后；右上角只留 ⭐ 与 `⋯`；阅读卡与题库卡同一套尺寸/显隐规则。
- 题库卡底部：`出处` 居左（`margin-right: auto`）、状态 chip 与到期居右，与阅读卡一致。
- `⋯` 菜单去重：移除「收藏」「编辑标签」（分别由星标、标签图标承担）。

---

## 3. 三级分类（科目 > 子科目 > 小标签）

### 3.1 数据模型

```ts
export interface TaxonomyCategory {
  name: string;
  subjects: string[];
  /** 子科目 → 小标签；键为子科目名，值 trim/去重 */
  subjectTags: Record<string, string[]>;
  [key: string]: unknown;
}
```

- `normalizeTaxonomy` 兼容旧数据（缺 `subjectTags` 补 `{}`）；孤儿键（子科目不存在）丢弃；重名 category 合并 subjects 与 subjectTags 并集。
- 纯函数：`taxonomySubjectTags(taxonomy, category, subject)`、`withSubjectTags(taxonomy, category, subject, tags)`（返回新配置，不改原对象）。

### 3.2 分类设置面板

- 每个子科目一行：`[子科目 chip ×] [小标签 chips ×] [＋ 添加小标签]`；小标签**点击名称就地改名**（Enter/失焦提交、Esc 取消）。
- 面板底部「题卡中出现但未配置」建议扩展到三层：`科目 · 子科目 · 小标签` 一键入库。
- 面板超高时内部滚动，`取消/保存` 吸底常驻；输入框底色 `--pd-surface-3` 保证可见。

### 3.3 重命名同步（写盘边界）

- 草稿期内记录 `renames[]`（连续改名合并 `A→B→C ⇒ A→C`；改回原名则移除记录）。
- 保存时先写 `settings.taxonomy`，再 `syncTagRenames(renames)`：
  - 仅匹配 **`category + subject` 相同且 tags 含旧名** 的题卡；
  - 逐卡复用 `saveMetadata`（重读文件 → 重定位块 → `patchCardMetadata` 只改头部三行）；
  - 返回改写题卡数，`Notice` 提示「已同步 N 道题的小标签」。
- 改名目标与已有标签重名 → 阻止（合并语义留待后续）。

### 3.4 虚线添加框（面板 + popover 同款）

- `＋ 添加小标签` / `＋ 添加标签`：1px 虚线边、透明底、`--pd-muted` 文字、高度与标签 chip 一致（22px）、6px 圆角。
- 点击就地展开 120px 输入框；Enter/失焦提交（popover 失焦提交顺带修掉「输入未回车就保存会丢」旧问题）、Esc 取消。

### 3.5 popover 联动

- 新增「可选标签」行：只列当前 **科目 + 子科目** 标签库（点选即加入），输入候选同样按子科目过滤。
- 保存时 `rememberTags(category, subject, tags)` 把使用中的标签并入库（无变化不写盘）。
- 卡片头部章节 tags 最多显示 **3 个 + `+N`**。

---

## 4. 题型系统

### 4.1 数据模型（派生，不落 data.json）

```ts
export type QuestionType = "short" | "single" | "multiple" | "judge";
export interface QuestionOption { label: string; text: string }
// QuestionCard 新增：type / options / correct: string[]
```

### 4.2 头部语法与解析

```
type: single            # short（默认）/ single / multiple / judge（中英文别名均认）
options: A. 2 | B. -2 | C. 0 | D. 1   # | 分隔；无字母自动 A/B/C…
answer: B               # 多选 `A,C` 或 `AC`；判断填 对/错（true/false 亦认）
```

- 推断：未写 `type` 时，有选项 → 单选/多选（按答案个数）；答案为对/错 → 判断；否则 short。
- 纠偏：`single` 但答案 >1 → 自动按 `multiple`；选项 <2 的选择题记解析错误。
- 判断题选项固定 `正确/错误`；`### 笔记` 与 `### 个人笔记` 等价（解析与笔记保存同步支持）。

### 4.3 作答 UI（阅读卡 / 题库卡 / 练习抽屉三处共用 `choices.ts`）

- 单选=radio、多选=checkbox、判断=双选项；选择仅存于当前渲染实例，不写盘。
- 卡内新增 **`提交答案`** 按钮（未作答置灰）：点击 → 染色（正确绿 / 选错红）+ 锁定选项 + 自动展开「答案与笔记」；答案区顶部显示 `正确答案：…`。
- 题型标注在选项上方：`单选题 / 多选题 / 判断题`（简答题不渲染任何题型 UI）。
- 练习抽屉：保持「显示答案 → 评分」流程；揭晓后标记对错并显示 `回答正确 / 回答错误 / 未作答`，选项锁定。
- 未作答时展开答案折叠不染色（避免泄露正确项）。

---

## 5. 插入题目

- 编辑器右键菜单（`editor-menu` 事件）新增「插入题目」，与命令「插入题卡模板」共用模板；光标不在行首时先补空行。
- 模板含 `id/category/subject/tags/source/difficulty/type/options/answer` + `### 题干/答案/笔记`。

---

## 6. 删除题目

- 阅读卡与题库卡 `⋯` 菜单新增红色 danger「删除题目」（`x` 图标）。
- `deleteCard(card)`：确认框 → 重读文件 → 按 qid/key/line 重定位 → 整块移除 `[开栏..闭栏]`（保留每行原 EOL；前后均空行时收敛一行）→ 重建索引。
- 练习记录保留（孤儿状态），同题干重建后自动接上；`data.json` 不新增字段。

---

## 7. 数据与持久化增量

| 字段 | 位置 | 语义 |
| --- | --- | --- |
| `noteHeight` | `questions[qid]` | 笔记框高度（px，56–480）；undefined = 默认 |
| `lastPracticedAt` | `questions[qid]` | 最后练习时间；旧数据用最后一条 reviews 回填；`null` = 从未练习 |
| `subjectTags` | `settings.taxonomy.categories[]` | 三级标签库 |
| `type/options/answer` | 题卡头部 | 派生，不落 data.json |
| 「编辑过吗？」 | `notesUpdatedAt !== null` | 布尔语义由 null 性表达，不另设字段 |

---

## 8. 兼容与迁移

- 旧 `data.json`：`subjectTags` 补空表、`lastPracticedAt` 回填、`noteHeight` 缺省；未知字段照旧保留，`schemaVersion` 仍为 1。
- 旧题卡：无 `type/options/answer` ⇒ 简答题，UI 与 v3.2 一致；`### 个人笔记` 继续可用。
