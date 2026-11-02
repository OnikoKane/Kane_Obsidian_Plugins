# ZapTrace

> 一个**只做数学刷题与间隔复习**的 Obsidian 插件：把笔记里的 ```zaptrace 题卡变成可作答、可四档评分、可排期的题目。
> **原文只读**：题干/答案/笔记永远留在你的 Markdown 里；收藏、评分、到期等运行状态只写在插件自己的 `data.json`。

![status](https://img.shields.io/badge/version-0.1.0-informational)

## 特性

- **Markdown 题卡**：围栏代码块（```` ```zaptrace ````）承载一道题，题干/答案/个人笔记/AI 笔记分节；节内支持完整 Markdown 与 LaTeX（`$…$`、`$$…$$`），由 Obsidian 的 `MarkdownRenderer` 渲染。
- **阅读视图 Quiet Card**：单层 1px 边、无卡片投影；`category`（大科目）+ `subject`（子科目）+ `tags`（章节/知识点）三档标签 chip（**大科目与子科目同色 accent**）；「答案与笔记」合并为一条 **38px 扁平折叠行**（默认关闭，`foldOpen` 持久化、下次打开保持）；展开内渲染答案 + 个人笔记 textarea 编辑（保存/取消、显示最后更新时间）；工具区为常驻 `tags` 图标 + 星标（默认隐藏、hover/聚焦显示、已收藏常驻实心 amber、点击有本地音效）+ `⋯` 菜单。
- **题库页面**：页头「题库 + 全部题目计数 + 搜索 + 分类设置 + 主 CTA」→ 6 个状态 chips → **大科目 ▾ → 子科目 ▾ → 标签 chips** 联动筛选（未选大科目时子科目与标签禁用）→ 分段视图「**题卡流 / 紧凑表格 / 独立复习**」。题卡流 **≥1440 三列 / 1024–1439 两列 / <1024 单列**；每卡默认展开「答案与笔记」、可就地编辑；点击卡片进入右侧练习抽屉，「查看详情」打开原文并定位。
- **标签编辑 popover**：阅读卡/题库卡工具区 `tags` 图标打开紧凑 popover（非 Modal）：大科目/子科目只能选「分类设置」中已配置的值，标签可自由新增（chip × 移除 / 回车添加）；保存复用 `patchCardMetadata` + `saveMetadata`，只改目标题卡头部三行。
- **分类设置**：工作台顶部「分类设置」与设置页「编辑分类」打开同一 TaxonomyModal，草稿式增删大科目/子科目，保存写入 `settings.taxonomy`（不新增 data 顶层字段、schemaVersion 不变）。
- **先作答再看答案**：未揭晓时答案 DOM 不存在、评分条不存在、`1–4` 快捷键不响应、**无任何写盘路径**（H4）。
- **四档回忆评分**：忘记 / 困难 / 想起 / 秒答 → 确定性间隔（1/3/7/15/30 天），记录本地日期与时间，并安排下次到期。
- **复习队列**：独立复习视图保留按科目分组的今日到期、每日上限 +N 顺延、按科目组卷（简单规则，非智能）与时间记录（近 7 天）。
- **Quiet Cards 视觉令牌**：`--pd-*` 暗/亮双主题；正文 16px / 2.1，UI 13px / 1.45，元信息 11.5 / 12.5px；卡片永远只有一条 1px 边且无投影（仅菜单有阴影）；动效 120 / 160 / 220ms；键盘焦点、ARIA、`prefers-reduced-motion`、`hover:none`、窄屏适配。
- **数据安全**：`data.json` 带 `schemaVersion` 迁移与迁移前备份；结构损坏/版本过新进入**只读安全模式**，绝不覆盖写。

## 安装

1. 构建或直接取以下三件套：`main.js`、`manifest.json`、`styles.css`。
2. 放入 `<你的仓库>/.obsidian/plugins/zaptrace/`。
3. 重启 Obsidian（或 `Ctrl+R`），在「设置 → 第三方插件」启用 **ZapTrace**。
4. 打开「设置 → ZapTrace」按需调整（题卡目录、默认科目、每日上限、日期模式、实时预览、主题）。

## 题卡语法

`````markdown
````zaptrace
id: 2024-gaoshu-deriv-001        # 可选，强烈建议手写（稳定状态键）
category: 数学                  # 可选，大科目；缺省推断「数学」
subject: 高等数学                # 可选，子科目；缺省取文件夹名/默认科目
tags: 导数, 极限, 易错          # 章节 / 知识点，逗号或顿号分隔
source: 高等数学 第七版 p.86 例3  # 可选，出处
difficulty: 3                    # 可选，1–5，首版只展示
pdf: 高等数学 p.86               # 可选，PDF 来源预留字段
---
### 题干

求 $f(x)=x^{2}$ 在 $x=1$ 处的导数。

### 答案

$f'(1)=2$。

### 个人笔记

可选。

### AI 笔记

可选（纯文本，插件不生成）。
````
`````

要点：

- 头部区以单独一行 `---` 结束；**只有首行是合法 `key: value` 时才进入头部**，因此题干里的 `---`（Markdown 水平线）永远安全。
- **三档标签**：`category`（大科目，缺省推断 `数学`）→ `subject`（子科目）→ `tags`（章节/知识点，最多显示 2 个 + `+N`）。大科目不写入 `data.json`，每次由实时索引派生。
- 分节标题宽松匹配：`### 题干`、`###题干`、带缩进/尾随空格都可以；`####` 也接受。
- 答案里需要写三反引号代码块时，**外层用四个反引号**（CommonMark 规则）。
- 缺 `### 答案` 会显示「缺少答案分节 + 行号」，不影响其它题卡；空代码块会被忽略。
- 文档示例里嵌的 ```` ```zaptrace ```` 不会进入索引（扫描器跟踪所有反引号和围栏）。

### 编辑标签（popover）与分类设置

- **标签**：阅读卡 / 题库卡工具区 `tags` 图标 → 紧凑 popover：大科目 select（来自「分类设置」）→ 子科目联动 → 标签 chips 增删；`Esc`/外部点击/× 关闭（脏时确认），窄屏为底部面板。保存只改写目标题卡**头部**的 `category`/`subject`/`tags` 三行，保留 `id`、未知键、题干/答案/笔记、其它题卡、行尾与缩进。
- **分类设置**：工作台顶部「分类设置」或设置页「编辑分类」→ TaxonomyModal 增删大科目与子科目（草稿式，保存才生效）；卡片里的大/子科目只能选已配置值，标签可自由新增。首次有题卡时会从现有卡片一次性播种分类（只读模式不播种）。
- 留空大科目 = 删除该行（回退「数学」）；留空子科目 = 回退默认科目/文件夹名/未分类；留空标签 = 无章节标签；tags 支持中英文逗号与顿号。无变化/失败均不写盘；只读模式禁用保存。

## 数据边界（重要）

| 内容 | 存放位置 |
| --- | --- |
| 题干、答案、笔记、标签、出处 | 你的 `.md` 文件（插件只在用户点「保存」时改写目标题卡的 `### 个人笔记` 节，或元数据编辑器里的头部三行） |
| Star、练习次数、四档评分、到期日、时间记录、笔记更新时间、折叠状态 | 插件 `data.json` |

- 会写 Markdown 的操作仅三类：用户显式触发的命令「插入题卡模板」、笔记编辑器「保存」（只替换目标 zaptrace 块 `### 个人笔记`）、元数据编辑器「保存」（只替换目标 zaptrace 块头部 `category`/`subject`/`tags` 行）；答案/题干/其它块与行尾一律不动。
- `data.json` 新增 `notesUpdatedAt`（笔记最后保存时间，空笔记为 `null`）与 `foldOpen`（「答案与笔记」折叠状态）；分类配置存于 `settings.taxonomy`（大科目/子科目，不新增 data 顶层字段）；旧数据自动补默认值，未知字段保留，`schemaVersion` 仍为 1。
- `data.json` 位置：`<vault>/.obsidian/plugins/zaptrace/data.json`。
- 迁移前写 `data.backup-v<旧版本>-<时间戳>.json` 到插件目录。
- `reviewLog` 超过 5000 条、单卡 `reviews` 超过 20 条时裁剪最旧并记录 `meta.logTruncated`。
- 未知字段（顶层 / settings / 单题 / meta）在加载与迁移后**原样保留**，方便前向兼容。

## 稳定 ID 与重复题

- 手写 `id` 优先；缺省时用 `auto:` + 题干规范化后的 SHA-1 前 12 位。
- **改答案/笔记/标签不改 ID；改题干会换 ID**，旧状态标记 `orphaned` 保留（不删除）。
- **同文重复题 / 手写重复 ID 不会被静默合并**：
  - 索引键与状态键分离（`文件#块序号` vs `qid`）；
  - 重复者的 `qid` 追加 `-<sha1(文件#块序号) 前 6 位>`，与文件枚举顺序无关；
  - 所有重复卡在题集与题卡上都有「重复」告警，状态互不共用。
- 跨文件重命名会改变「谁持有原始 id」——建议给重要题卡手写 `id`。

## 四档评分与到期

| 档位 | 含义 | 规则 |
| --- | --- | --- |
| 忘记 `again` | 想不起/做错 | `step=-1`，1 天后，`lapses+1` |
| 困难 `hard` | 吃力/勉强 | `step-1`，按阶梯取间隔 |
| 想起 `good` | 正常回忆 | `step+1`，按阶梯取间隔 |
| 秒答 `easy` | 立刻想起 | `step+2`，按阶梯取间隔 |

间隔阶梯 `1/3/7/15/30` 天；`again` 最早明天（不会当天死循环）。日期按日历日运算，正确处理跨月/跨年/闰年；`dateMode=fixed` 时固定 `Asia/Shanghai`。

## 命令与快捷键

| 命令 | 说明 |
| --- | --- |
| `ZapTrace: 打开工作台` | 打开题库页面（也可点左侧 Ribbon） |
| `ZapTrace: 练习当前题卡` | 光标在 ```zaptrace 块内时直接练习 |
| `ZapTrace: 插入题卡模板` | 在光标插入模板（唯一写 `.md` 的操作） |
| `ZapTrace: 随机练一题` | 从索引随机取一题 |
| `ZapTrace: 重建索引` | 全量重扫 |

练习内：`Enter` 显示答案（焦点不在按钮时）、`1–4` 评分（仅揭晓后）、`←/→` 在评分条内移动焦点、`/` 聚焦题库搜索、`Esc` 关闭练习抽屉。

来源跳转（只读）：阅读视图题卡底部「定位原文」与题库卡片「查看详情 / ⋯ → 打开原文」，会打开 `card.file` 对应笔记并把光标/视图定位到 `card.line-1`（题卡围栏首行）；不会修改任何 Markdown。

## 开发

```bash
npm install        # 安装开发依赖（obsidian / esbuild / typescript）
npm test           # node:test 核心单测（不依赖 Obsidian/Electron）
npm run build      # tsc -noEmit 类型检查 + esbuild 产出 main.js（CJS）
```

- 需要 **Node ≥ 22.6**（直接运行 `.ts` 测试依赖 Node 内置类型剥离；`npm test` 已在 Node 24 实测通过）。
- 逻辑全部在 `src/core/`（纯函数，禁止 `import "obsidian"`）；`src/view/` 与 `src/main.ts` 只做 Obsidian API 适配。
- `src/core/hash.ts` 自带同步 SHA-1，**不依赖 Node `crypto`**（插件可在移动端/非 Node 环境运行）。
- 构建产物为 CommonJS `main.js`（`format: "cjs"`、`external: ["obsidian", …]`），可直接放入插件目录。

目录结构：

```
ZapTrace/
├── src/
│   ├── core/        # types / hash / id / date / scheduler / parse / index / state / notes / metadata / taxonomy / filter / format / practice
│   ├── store/       # stateStore（data.json 读写、防抖、只读、备份）
│   ├── view/        # card / libraryPanel（题库页）/ practicePanel / reviewPanel / workbenchView / settingsTab / dom / ratingBar / renderOwner / menu / libStatus / noteEditor / plainText / metadataModal（已停用）/ tagPopover / taxonomyPanel / starSound
│   ├── template.ts
│   └── main.ts      # 插件入口（命令 / Ribbon / 视图 / 渲染器 / 事件清理）
├── tests/           # node:test：解析、ID、调度、日期边界、迁移/只读、筛选、练习门禁
├── examples/        # 示例题卡
├── styles.css
├── manifest.json
├── main.js          # 构建产物（CJS）
└── LICENSE
```

## 首版非目标

- ❌ PDF / 图片 / OCR 导入（仅保留 `pdf` 字段占位，不参与筛选）。
- ❌ 批注、高亮、划词（那是 Annotation Marker 的职责）。
- ❌ AI 生成题目/解释/笔记（`### AI 笔记` 只是文本字段）。
- ❌ 复杂自动组卷、难度加权、跨科目配比、遗忘曲线拟合。
- ❌ 统计图表、热力图、排行榜、仪表盘。
- ❌ 实时预览内完整评分交互（首版降级为只读缩略卡，请在阅读视图或工作台作答）。
- ❌ 导出 Anki/Quizlet、云同步、多设备冲突合并。

## 已知限制

- 实时预览（Live Preview）中题卡只渲染为只读缩略卡，评分请到阅读视图或工作台。
- 自动 ID 依赖题干；改题干会被视为新题（旧状态成为孤儿，可在 `data.json` 中看到 `orphaned: true`）。
- 大库全量重扫（首版），500 题量级可接受；后续版本考虑增量索引。
- `data.json` 的多设备同步冲突依赖 Obsidian Sync 的文件级同步，请自行评估。
- 注：MarkdownRenderer 的渲染生命周期按「每次渲染一个 RenderScope」管理（阅读视图用 `ctx.addChild`，工作台面板重渲染前 unload 上一轮），不会把插件实例当作长期 owner。
- v3 系列在 `src/core/` 增加了 `notes.ts`（笔记节替换）、`metadata.ts`（头部元数据替换）、`taxonomy.ts`（分类配置归一化）三个纯函数；解析/ID 规则、`src/store/stateStore.ts`、`data.json` 结构、评分/复习算法未改；`examples/zaptrace-demo.md` 未修改。UI（折叠、popover、抽屉、三列网格、星标音效）需在真实 Obsidian 1.14.x 中人工走查，本仓库未提供运行时截图。

## License

MIT，见 [LICENSE](LICENSE)。
