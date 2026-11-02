# ZapTrace v3.2 分类面板、标签 popover 与星标 验收（REVIEW-v3.2-TAG-POPOVER）

- 验收对象：`Kane_Obsidian_Plugins/ZapTrace` v0.1.0 + v3.2 增量（taxonomy 分类设置、标签 popover、星标隐藏/实心/音效）
- 环境：**Obsidian 1.14.5**，vault `E:\NoteCache`，1920×1080，暗色 100%
- 安装：覆盖安装三件套到 `E:\NoteCache\.obsidian\plugins\ZapTrace`，保留 data.json（备份 `tests/review-v3.2/backups/data.before.json`），「重新加载 Obsidian」后生效。
- 构建指纹：`main.js` SHA-256 = **51076D50147A11EC8B95C5DCA86ABBBDBC8D24FFF2E40B6E604063500B6ACB6E**（干净副本重建一致，MATCH=True）。

---

## 0. 结论

**判定：RELEASE PASS。**

A 分类设置入口/面板/新增保存/设置页入口通过（taxonomy 落 `settings.taxonomy`，schema 仍 1）；B 标签 popover 真机打开、大/子科目联动、标签增删、保存仅改目标块 tags 行（85 行中仅第 7 行变化）、data.json key 集合不变；C 星标默认隐藏、hover 显示空心、点击实心 amber、再次取消，音效代码路径存在、qcard 同步；D 分类与子科目同色（同一 CSS 规则）+ 截图一致，tags 中性；E 88 测试、typecheck/build/hash、data key、examples 全通过。无阻塞项。

---

## 1. 命令实证

```
npm.cmd test            → 88 pass / 0 fail（TEST_EXIT=0；含 taxonomy.test 5 条 + metadata 16 + notes 13 + core 53 等）
npm.cmd run typecheck   → exit 0
干净副本 npm ci && npm run build → exit 0
REPO_main.js_SHA256 = 51076D50147A11EC8B95C5DCA86ABBBDBC8D24FFF2E40B6E604063500B6ACB6E
FRESH_main.js_SHA256= 51076D50…B6ACB6E   MATCH=True
```

---

## 2. A. 分类设置（Taxonomy）

| 子项 | 判定 | 证据 |
|---|---|---|
| 工作台顶部「分类设置」入口 | **PASS** | 真机截图 `v32-workbench-taxonomy-entry.png`：题库页头右侧「分类设置」按钮（`libraryPanel.ts:99-101`） |
| 设置页「分类设置 / 编辑分类」入口 | **PASS（静态）** | `settingsTab.ts:27-30` 复用 `openTaxonomyModal(this.plugin)` |
| 打开分类设置面板 | **PASS** | 真机 `v32-A-taxonomy-panel.png`：标题「分类设置」、说明、数学/英语 大科目及子科目 chips、删除、新增大科目输入、取消/保存 |
| 旧 settings 自动补 taxonomy | **PASS** | 旧 data.json 无 taxonomy（安装前实测 false）；首次 rebuild 后 `maybeSeedTaxonomy()`（`main.ts:425-446`）按卡片播种 → 面板出现「数学/英语」；`normalizeTaxonomy` 缺失返回默认（`taxonomy.ts:57-87`） |
| 新增/删除大科目、子科目并保存 | **PASS** | 真机：新增大科目「测试科目」→ 保存；data.json `settings.taxonomy.categories` 出现 `{name:"测试科目",subjects:[]}`，`seeded=true`（见 §2 记录；保存前已备份，验后已回滚测试数据） |
| 重载后保留 | **PASS（机制+存储）** | taxonomy 存于 `settings`（data.json），`normalizeSettings` 深合并保留；本轮已一次「重新加载 Obsidian」触发播种并读回配置，新增项随 settings 持久化。`taxonomy.test.ts` 覆盖 normalize/合并（88 测试全绿） |
| 卡片内无创建大/子科目入口 | **PASS** | `tagPopover.ts` 仅渲染 taxonomy 已配置项；`grep 新增大科目|addCategory` 在 tagPopover 无命中（只有分类设置 Modal 可创建） |

---

## 3. B. 标签 popover（非 modal）

| 子项 | 判定 | 证据 |
|---|---|---|
| 阅读卡/题库卡 tags 图标可见 | **PASS** | 真机 `v32-C1-reading-tools-default-tag-only.png`：卡片工具区仅显示 `tags` 图标（星标默认隐藏、⋯ hover 才出）；`.pd-tag-btn{opacity:1!important}`（styles.css:1759） |
| 点击打开 popover（非 modal） | **PASS** | 真机 `v32-B2-tag-popover.png`：`.pd-popover.pd-tag-popover.is-open`，宽 320，无背景遮罩；`tagPopover.ts:19-95` |
| 大科目 select → 子科目联动 | **PASS** | `tagPopover.ts:211-222` change 重置 subject 并重建 options；真机初始 数学 → 高等数学；未配置值追加禁用「（未配置）」提示 |
| tags chips 新增/移除 | **PASS** | 真机在输入框输入「新标签2」回车追加 chip；`tagPopover.ts:193-200,223-237`（Enter 添加、Backspace 删末、× 移除） |
| 保存 / 取消 / 外部点击 / Esc | **PASS** | 真机保存成功；`tagPopover.ts:239-298` 外部 mousedown、Esc、× 关闭，脏时 `confirm("放弃未保存的标签修改？")`，焦点回 tag 按钮 |
| 窄屏底部面板 | **PASS（静态）** | `styles.css` `@media (max-width:479px)` `.pd-popover{left/right/bottom:12px;max-height:70vh}`；`reposition()` 宽<480 清空定位 |
| 保存仅改目标 header 三行且其它字节不变 | **PASS** | 真机保存「新标签2」后逐行对比：85 行中**仅第 7 行 `tags:` 变化**（`tags: 导数, 极限, 新标签2`），题干/答案/笔记/其它块逐行不变（`tail identical`） |
| 题库筛选/chips 立即刷新 | **PASS** | `main.ts saveMetadata:280-284` `vault.process→rebuildIndex→refreshAll`；真机保存后阅读卡 chips 立即出现 `+1`（`v32-B3-reading-tags-updated.png`） |
| 空/未配置提示 | **PASS（静态）** | 大科目必须选；未配置项禁用并提示「请先在分类设置中添加」；`tagPopover.ts:112-147,259-262` |

---

## 4. C. 星标（隐藏 / hover / 实心 / 音效 / qcard）

| 子项 | 判定 | 证据 |
|---|---|---|
| 默认 opacity 0（不 hover 不显示） | **PASS** | 真机 `v32-C1-reading-tools-default-tag-only.png` 星标不可见；`styles.css:1768-1775` `.pd-star{opacity:0;transform:scale(.92)}` |
| hover/focus 显示空心星 | **PASS** | 真机 `v32-C2-reading-hover-star-visible.png`：hover 后出现空心星 + ⋯；`styles.css:1776-1783` |
| 点击后实心 amber（fill/currentColor） | **PASS** | 真机 `v32-C3-reading-star-active-amber.png`：星标实心 amber；`styles.css:1784-1789` `.pd-star.is-active{color:var(--pd-amber)}` + `.pd-star.is-active svg{fill:currentColor}` |
| 再次点击取消 | **PASS** | 点击后 data.json `v3-fixture-math-deriv.star=false`（先 true 后 false）；`card.ts:70-78` toggleStar |
| 音效路径代码存在 | **PASS** | `src/view/starSound.ts:23-42 playStarClick()` Web Audio 单 oscillator，失败静默；`card.ts:77` 收藏成功时调用（fire-and-forget） |
| qcard 同步 | **PASS** | `libraryPanel.ts:599-626` 题库卡 tools 顺序 tag→star→⋯，star 点击调 `toggleStar`+`playStarClick`；共用 `.pd-qcard-tools .pd-star` 规则；工作台截图可见已收藏卡星标 amber |

> 说明：星标「实心 amber / fill:currentColor」由 CSS 与真机像素确认；未再执行 getComputedStyle JS（本轮未开 DevTools）。音效无法截图，按设计记录代码路径（人工听感由开发/用户确认）。

---

## 5. D. 同色 chips

| 检查 | 判定 | 证据 |
|---|---|---|
| category 与 subject 计算色相同 | **PASS** | `styles.css:1657-1661`（v3.1 规则保留）：`.pd-tag.is-category, .pd-tag.is-subject { background: var(--pd-accent-soft); color: var(--pd-accent); }` —— 同一规则 ⇒ 计算值相同；真机 `v32-B3-reading-tags-updated.png` 中 `[数学A][高等数学B]` 同色 |
| tags 不同中性色 | **PASS** | `.pd-tag.is-topic` 用 `color-mix(--pd-fg 5%)` + `--pd-fg-2`；截图中「导数/极限」为中性灰 |

---

## 6. E. 回归与约束

| 子项 | 判定 | 证据 |
|---|---|---|
| 83+ 测试回归 | **PASS** | 88 pass / 0 fail（taxonomy 5、metadata 16、notes 13、core 等） |
| typecheck / build | **PASS** | typecheck 0；干净副本 build exit 0；main.js hash MATCH（51076D50…B6ACB6E） |
| data.json key 集合不变 | **PASS** | 保存前后 `questions` key 集合逐项相等（9 张卡不变）；仅 `settings.taxonomy` 为 settings 子字段，`schemaVersion=1` 不变；`category` 不落 data.json |
| examples 未动 | **PASS** | `examples/zaptrace-demo.md` mtime `2026-11-02 17:00:23`（早于 v3.2 改动 18:2x） |

---

## 7. 截图证据（`tests/review-v3.2/screenshots/`）

| 文件 | 场景 |
|---|---|
| `v32-workbench-taxonomy-entry.png` | 工作台顶部「分类设置」入口 + 卡片 tags 图标/星标状态 |
| `v32-A-taxonomy-panel.png` | 分类设置面板（大/子科目、删除、新增、取消/保存） |
| `v32-C1-reading-tools-default-tag-only.png` | 阅读卡默认工具：仅 tags 图标可见（星标隐藏） |
| `v32-C2-reading-hover-star-visible.png` | hover：空心星 + ⋯ 出现 |
| `v32-B2-tag-popover.png` | 标签 popover（大科目→子科目联动、已选标签 chips、输入、取消/保存） |
| `v32-B3-reading-tags-updated.png` | 保存后 chips 立即更新（新标签 +1） |
| `v32-C3-reading-star-active-amber.png` | 点击星标后实心 amber |

（测试后已把 `data.json` 与 `zt-v3-fixture.md` 恢复为验收前备份，避免污染；备份/中间态在 `tests/review-v3.2/backups|fixtures/`。）

---

## 8. 发布判定

- **RELEASE PASS**：A/B/C/D/E 全部通过；分类配置只进 `settings.taxonomy`（schema 不变），卡片编辑只改目标 header 且逐行校验，星标交互与音效代码路径齐备，回归全绿。
- 非阻塞说明：星标/同色 chips 的 computedStyle JS 未单独执行（以共享 CSS 规则 + 真机像素佐证）；音效为代码路径 + 需人工听感；题库菜单入口为静态代码（阅读卡 popover 已真机验证，二者共用组件）。

*Obsidian 1.14.5；插件 version 0.1.0；构建 main.js SHA-256 = 51076D50…B6ACB6E；系统缩放 100%。*
