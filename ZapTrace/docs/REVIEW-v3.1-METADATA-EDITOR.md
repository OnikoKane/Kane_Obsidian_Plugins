# ZapTrace v3.1 分类标签编辑器与同色 chips 验收（REVIEW-v3.1-METADATA-EDITOR）

- 验收对象：`Kane_Obsidian_Plugins/ZapTrace` v0.1.0 + v3.1 增量（元数据编辑器 + category/subject 同色 chips）
- 环境：**Obsidian 1.14.5**，vault `E:\NoteCache`，1920×1080，暗色 100%
- 安装：覆盖安装 `main.js` / `styles.css` / `manifest.json` 到 `E:\NoteCache\.obsidian\plugins\ZapTrace`，**保留 data.json**（备份 `tests/review-v3.1/backups/data.before.json`）；「重新加载 Obsidian」后生效。
- 构建指纹：`main.js` SHA-256 = **2B526C2E969D6DC6791CF1FCDC9238F5681AF055BC9E66656A51FC56AD84517D**（干净副本重建一致，MATCH=True）。
- 说明：实机操作中途用户按 Esc 中止了 computer-use 会话（策略要求本轮不重试桌面输入），因此 C 项的「computedStyle JS 取值」未能执行；改用**共享 CSS 规则 + 真机像素/截图**验证（见 §C）。

---

## 0. 结论

**判定：RELEASE PASS。**

A 菜单入口/模态预填/编辑/保存真机通过；B 保存只改目标 block 头部 3 行、其余 84 行逐行不变，chips 立即更新，data.json key 集合不变；C 分类与子科目 chips 由同一 CSS 规则赋同色（截图像素一致），tags 保持中性色；D 83 测试全绿、typecheck/build 通过、干净副本 hash 一致、data.json 无 category 字段、examples 未动。无阻塞项。

---

## 1. 命令实证

```
npm.cmd test            → 83 pass / 0 fail（TEST_EXIT=0；含 metadata.test 16 条）
npm.cmd run typecheck   → tsc -noEmit -skipLibCheck exit 0
干净副本 npm ci && npm run build → BUILD_EXIT=0
REPO_main.js_SHA256 = 2B526C2E969D6DC6791CF1FCDC9238F5681AF055BC9E66656A51FC56AD84517D
FRESH_main.js_SHA256= 2B526C2E969D6DC6791CF1FCDC9238F5681AF055BC9E66656A51FC56AD84517D  → MATCH=True
```

---

## 2. A. 菜单入口与模态（真机 + 代码）

| 子项 | 判定 | 证据 |
|---|---|---|
| 阅读卡 `⋯` 菜单含「编辑分类与标签」 | **PASS** | 真机截图 `v31-A1-reading-menu-entry.png`：菜单项顺序 收藏 / **编辑分类与标签** / 打开原文 / 复制题干；代码 `card.ts:100-106` |
| 题库卡 `⋯` 菜单同一入口（表格行复用） | **PASS（静态）** | `libraryPanel.ts:749-755` 在「打开原文」前插入同一项，表格行 `openCardMenu` 复用（本轮桌面中断未能截题库菜单） |
| 点击打开 Quiet Cards 模态 | **PASS** | 真机 `v31-A2-modal-prefill.png`：标题「编辑分类与标签」、副标题、`.pd-modal` 样式、关闭 X |
| 三字段预填生效值 | **PASS** | 预填 大科目=数学、子科目=高等数学、章节/知识点=「导数, 极限」；代码 `metadataModal.ts:71-98`（category `card.category ?? "数学"`，tags `join(", ")`） |
| 标签实时预览 chips | **PASS** | `metadataModal.ts:100-108`；编辑后预览出现「导数/极限/新标签」（`v31-A3-modal-edited.png`） |
| 保存 / 取消 | **PASS** | 真机保存成功（模态关闭、chips 更新）；取消 `close()`（dirty 时 confirm）；`metadataModal.ts:240-262,265-271` |
| Esc 关闭 | **PASS（静态）** | 使用 Obsidian `Modal` 子类，自带 Esc/焦点陷阱；`close()` 重写做 dirty 确认 |
| 键盘（Ctrl/Cmd+Enter 保存） | **PASS（静态）** | `metadataModal.ts:148-152` |

---

## 3. B. 保存只改头部 + 联动（真机字节级校验）

对夹具 `zt-v3-fixture.md`（5 个 zaptrace 块）在真机把卡 1 由 `数学 / 高等数学 / 导数,极限` 改为 `数学A / 高等数学B / 导数,极限,新标签` 后保存：

| 检查 | 判定 | 证据 |
|---|---|---|
| 仅目标 block 头部三行变化 | **PASS** | 逐行对比：**differing 1-based lines = 5,6,7**（category / subject / tags 三行），共 85 行中仅此 3 行变化 |
| 题干/答案/笔记/其它块逐行不变 | **PASS** | 第 22 行至文末（其余 4 个块）`tail identical=True`；题干、`### 答案`、`### 个人笔记` 行均未变 |
| 卡片 chips 立即更新 | **PASS** | `v31-B3-reading-chips-updated.png`：chips 变为 `[数学A][高等数学B][导数][极限][+1]` |
| 题库筛选立即更新 | **PASS（代码+机制）** | `main.ts:280-284` `vault.process → rebuildIndex → refreshAll → refreshReadingViews`；大科目下拉由实时索引 `collectCategories()` 生成，保存后新「数学A」进入选项（本轮桌面中断未单独截题库筛选） |
| 同文件其它块无变化 | **PASS** | 同上 tail identical |
| 空值回退正确 | **PASS** | 纯函数按空值删除对应 header 行（`metadata.ts:164-196`），交给现有推断链；`tests/metadata.test.ts`（16 条）覆盖空 category/subject/tags、无头部插入、`---` 清理等，83 测试全绿 |
| 不改 qid/data 字段 | **PASS** | 元数据只写 Markdown 头部；data.json 无 `category` 字段（实测 `category in data.json? False`） |

---

## 4. C. 分类与子科目同色 chips

| 检查 | 判定 | 证据 |
|---|---|---|
| category 与 subject 计算颜色一致 | **PASS** | `styles.css:1657-1661`：`.pd-tag.is-category, .pd-tag.is-subject { background: var(--pd-accent-soft); color: var(--pd-accent); }` —— 两条选择器**共用同一规则**，计算值必然相同；真机截图 `v31-A-reading-chips-samecolor.png` / `v31-B3-reading-chips-updated.png` 中两者均为同一幕布紫底/字 |
| tags 保持不同中性色 | **PASS** | `styles.css:1662-1665`（`.pd-tag.is-topic` 用 `color-mix(--pd-fg 5%)` + `--pd-fg-2`）；截图「导数/极限」为中性灰底 |

> 说明：原计划用 DevTools `getComputedStyle` 输出三项背景/前景值，但用户 Esc 中止了桌面会话（策略禁止本轮重试）。因同色由**同一 CSS 声明块**保证，且真机像素外观一致，判定 PASS；如实记录未取得 JS 计算值。

---

## 5. D. 回归与约束

| 子项 | 判定 | 证据 |
|---|---|---|
| 67+ 测试回归 | **PASS** | 83 pass / 0 fail（含 metadata 16、notes 13、core 53 等） |
| typecheck / build | **PASS** | typecheck 0；干净副本 build exit 0，main.js hash MATCH（2B526C2E…517D） |
| data.json key 集合不变 | **PASS** | 保存前后 key 集合逐项相等（`data-keys.before.txt` 对比 `key set unchanged? True`）；无 `category` 字段 |
| 用户示例未动 | **PASS** | `examples/zaptrace-demo.md` mtime `2026-11-02 17:00:23`，早于 v3.1 全部改动（18:00+） |
| 解析/ID/评分/复习/ schema | **PASS** | 仅新增 `src/core/metadata.ts` 纯函数与视图；`parse/id/state` 未改；schemaVersion 仍 1 |

---

## 6. 截图证据（`tests/review-v3.1/screenshots/`）

| 文件 | 场景 |
|---|---|
| `v31-A-reading-chips-samecolor.png` | 阅读卡：category/subject 同色 chips、tags 中性 |
| `v31-A1-reading-menu-entry.png` | 阅读卡 `⋯` 菜单含「编辑分类与标签」 |
| `v31-A2-modal-prefill.png` | 模态三字段预填（数学 / 高等数学 / 导数, 极限） |
| `v31-A3-modal-edited.png` | 修改为 数学A / 高等数学B / 导数,极限,新标签（含预览 chips） |
| `v31-B3-reading-chips-updated.png` | 保存后卡片 chips 立即更新（[数学A][高等数学B][导数][极限][+1]） |

（夹具备份/结果：`tests/review-v3.1/fixtures/zt-v3-fixture.before.md`、`zt-v3-fixture.after-metadata.md`；测试后已把 vault 夹具恢复为 before，避免污染。）

---

## 7. 发布判定

- **RELEASE PASS**：A/B/C/D 全部通过；核心行为（仅改头部、chips 联动、同色、无新增 data 字段、回归全绿）有代码+字节级+真机证据。
- 遗留说明（非阻塞）：C 的 computedStyle JS 因桌面会话被用户中止未执行，已用共享 CSS 规则 + 截图像素替代；题库菜单/筛选联动未单独截图，代码路径与 rebuildIndex/refreshAll 机制明确。

*Obsidian 1.14.5；插件 version 0.1.0；构建 main.js SHA-256 = 2B526C2E…517D；系统缩放 100%。*
