# ZapTrace v3.3 三级分类、题型系统与题卡修正 验收（REVIEW-v3.3）

- 验收对象：`Kane_Obsidian_Plugins/ZapTrace` v0.1.0 + v3.3 增量（三级分类、题型系统、提交答案、删除题目、虚线添加框、瀑布流、笔记框记忆、原生提示关闭）
- 环境：Obsidian 1.14.5，测试 vault，1920×1080，暗色
- 安装：`main.js / styles.css` 覆盖到测试 vault 插件目录（保留 `data.json`；`manifest.json` 沿用用户本地版本），「重新加载 Obsidian」后生效

---

## 0. 结论

**判定：RELEASE PASS。**

A 三级分类（面板三层编辑 / popover 按子科目过滤 / 虚线添加框 / 小标签改名同步）通过；B 题型系统（解析、单选/多选/判断 UI、提交答案、判分文案）在阅读卡与题库卡真机通过，练习抽屉同组件；C 题卡修正（瀑布流、笔记框默认 120px + 按题记忆、原生黑色气泡关闭、点击不再误开抽屉、出处/状态换位、菜单去重）通过；D 数据迁移（subjectTags / lastPracticedAt / noteHeight）与 93 条单测、typecheck/build 全绿。无阻塞项。

---

## 1. 命令实证

```
npm.cmd test            → 93 pass / 0 fail（新增：题型解析与推断、### 笔记 别名、noteHeight 归一、subjectTags 归一、withSubjectTags）
npm.cmd run typecheck   → exit 0
npm.cmd run build       → exit 0（main.js/styles.css 与安装副本哈希一致）
```

---

## 2. A. 三级分类

| 子项 | 判定 | 证据 |
| --- | --- | --- |
| 面板三层编辑 | **PASS** | 真机：数学 → 高等数学 行内展示 极限/积分/数列/导数/离散数学 小标签 chips，`×` 移除、内联输入添加 |
| 小标签就地改名 | **PASS** | 点标签名变输入框；Enter/失焦提交；重名提示「该小标签已存在」；Esc 还原 |
| 改名同步题卡 | **PASS（代码路径 + 单测）** | `syncTagRenames` 仅改 `category+subject` 匹配且含旧名的卡；逐卡复用 `saveMetadata`（只改头部 tags 行）；Notice 报告同步数；连续改名合并为 A→C |
| popover「可选标签」按子科目过滤 | **PASS** | 真机：数学/高等数学 → 可选标签仅列该子科目库；切换子科目即时刷新 |
| 新增标签回写标签库 | **PASS（代码路径）** | `doSave` → `rememberTags`（withSubjectTags 单测覆盖合并/去重/不改原对象） |
| 虚线添加框（面板 + popover） | **PASS** | 真机：`＋ 添加小标签` / `＋ 添加标签` 跟随已有标签；点击就地展开输入；Esc 取消；popover 失焦自动提交 |
| 卡片灰色标签 ≤3 | **PASS** | 头部 chips 截取 3 个 + `+N`（阅读卡/题库卡一致） |
| popover 行对齐 | **PASS** | `已选标签` 行 `align-items:center`；输入框高度与 chip 一致（22px）；换行时虚线框与标签列左对齐 |

---

## 3. B. 题型系统

| 子项 | 判定 | 证据 |
| --- | --- | --- |
| 头部解析 | **PASS** | 单测：`type/options/answer` 中英文别名、无字母选项自动 A/B/C、`A,C`/`AC` 多选、判断 对/错、缺省推断、single 多答案自动转 multiple |
| 阅读卡作答 + 提交答案 | **PASS** | 真机：单选题选 A → `提交答案` → A 红 / B 绿，自动展开「答案与笔记」并显示 `正确答案：B`；提交后按钮隐藏、选项锁定 |
| 题库卡同款 | **PASS** | 真机：题库卡同组件渲染选项与 `提交答案`；提交后展开答案折叠 |
| 题型标注 | **PASS** | 选项上方 `单选题 / 多选题 / 判断题`；多选题不再带「· 可多选」；简答题不渲染 |
| 练习抽屉 | **PASS（同组件）** | 揭晓后染色 + `回答正确/回答错误/未作答`，选项锁定；评分条流程不变 |
| 判断题 | **PASS（单测）** | 固定 正确/错误 两项；`answer: 对/错`（含 true/false）映射 |

---

## 4. C. 题卡修正

| 子项 | 判定 | 证据 |
| --- | --- | --- |
| 瀑布流 | **PASS** | 像素实测：三列各自的行间距位置不同（列内紧贴），不再是整行对齐 |
| 笔记框默认 120px | **PASS** | 真机三卡一致；像素扫描高度 = 120 CSS px（125% 缩放下 150 物理 px） |
| 按题记忆高度 | **PASS** | data.json 写入 `noteHeight: 260` → 重载后恢复；验证后还原 |
| 原生黑色气泡关闭 | **PASS** | 真机悬停 搜索框/⋯/标签图标 无 tooltip；根因是 Obsidian 对 `[aria-label]` 的原生提示，`.pd-root { --no-tooltip: true }` 关闭 |
| 点击不再误开抽屉 | **PASS** | 真机点击题库卡/阅读卡内容区无反应；抽屉仅显式入口 |
| 出处/状态换位 | **PASS** | 题库卡底部 出处 居左、未练/到期 居右 |
| 菜单去重 | **PASS** | `⋯` 仅剩 打开原文 / 复制题干 / 删除题目（danger 红字） |
| 右键「插入题目」 | **PASS（代码路径）** | `editor-menu` 注册 + 模板含 type/options/answer 与 `### 笔记` |
| 删除题目 | **PASS（代码路径）** | 确认框 → 整块移除（保留逐行 EOL、收敛空行）→ 重建索引；练习记录保留为孤儿状态 |

---

## 5. D. 数据与兼容

| 子项 | 判定 | 证据 |
| --- | --- | --- |
| 旧 data.json 迁移 | **PASS** | `subjectTags` 补空表；`lastPracticedAt` 用最后一条 reviews 回填；未知字段保留；schemaVersion 仍 1 |
| `### 笔记` 别名 | **PASS** | 解析与笔记保存均支持；新插入使用 `### 笔记`；旧 `### 个人笔记` 不受影响 |
| 只读模式 | **PASS（机制）** | `syncTagRenames` / `deleteCard` / `rememberTags` 均先查 `store.readOnly` |

---

## 6. 已知问题 / 后续建议

1. **删除题目为硬删除**：依赖 vault 备份找回；如需软删除可加 `deleted` 标记（尚未实现）。
2. **考试模式缺会话记录**：建议后续增加 `sessions[]`（mode: review/exam、起止时间、题集、得分）或在 `reviewLog` 加 `mode`，供每日时间轴区分复习/考试。
3. **小标签重名即阻止**：未做「改名合并到已有标签」的并集语义。
4. **瀑布流为列优先顺序**：按到期排序时阅读顺序为纵向；如需行优先需换 JS masonry。
5. 验收用的临时笔记（题型夹具）仍在测试 vault 根目录，确认后可删除（同步清理孤儿状态）。
