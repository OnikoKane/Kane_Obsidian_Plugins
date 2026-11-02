# ZapTrace v3.1 增量设计：分类标签编辑与同色 chips

> 版本：v3.1 · 2026-11-02
> 依据：`pluginDesign.md`（Quiet Cards v1.0）、`docs/DESIGN-v2-QUIET-CARDS.md`、`docs/DESIGN-v3-ENHANCEMENTS.md`、现有源码（`card.ts` / `libraryPanel.ts` / `menu.ts` / `noteEditor.ts` / `styles.css`）、`docs/REVIEW-v3-ENHANCEMENTS.md`
> 性质：**增量设计，只写本文档，不改代码**。不新增 data 字段，不扩 PDF / AI / 批注。

---

## 0. 一页结论

| 需求 | v3.1 落点 |
| --- | --- |
| 阅读卡 / 题库卡 `⋯` 菜单加「编辑分类与标签」 | 两个菜单各插一项，打开同一个 Quiet Cards 模态编辑器（§1） |
| 模态编辑 category / subject / tags，当前值预填，保存/取消，Esc/焦点/错误 | Obsidian `Modal` 子类 + `pd-*` 表单；预填生效值；校验与错误提示（§2、§9） |
| 保存只改目标 zaptrace 块头部字段，绝不改题干/答案/笔记/其它块 | 新增纯函数 `patchCardMetadata()`：行令牌化、只改头部 key 行（§3、§4） |
| 空 category → 数学，空 subject → 未分类/文件夹，tags 中英文逗号/顿号 | 空值 = 删除该 header 行，交给现有推断链；tags 统一 `,` 分隔（§3.2） |
| 分类与子科目同色 chips | `.pd-tag.is-category` 改用与 `.pd-tag.is-subject` 相同的 `accent-soft/accent`（§6） |
| 不引入新 data 字段，保存后 rebuildIndex + refreshAll，失败不写盘 | 元数据只写 Markdown header；无新 schema 字段；写入失败零副作用（§5） |
| 真机验收与截图点 | Obsidian 1.14.5 六组截图（§8） |

**核心铁律**：元数据编辑器是「Markdown 头部字段编辑器」，不是「状态编辑器」；不改 `data.json` 新增字段，不改 qid，不碰正文。

---

## 1. 菜单入口

### 1.1 两个入口（同一行为）

| 位置 | 当前实现 | v3.1 变更 |
| --- | --- | --- |
| 阅读卡 `⋯` | `card.ts:79-116 buildMenuButton()` 菜单项：收藏 / 打开原文 / 复制题干 | 在「打开原文」前插入「编辑分类与标签」 |
| 题库卡 `⋯` | `libraryPanel.ts:734-763 openCardMenu()` 同三项（表格行也走它） | 同样插入「编辑分类与标签」 |

菜单项定义：

```ts
{
  label: "编辑分类与标签",
  icon: "tags",              // Lucide tags
  onSelect: () => openMetadataEditor(plugin, card, anchorButton),
}
```

- `openMenu()` 会先关闭菜单，再触发 `onSelect`；随后打开模态。
- `anchorButton` 传给模态，关闭后把焦点还给触发按钮（Obsidian Modal 自带焦点恢复，另加兜底）。
- 只读模式（`plugin.isReadOnly()`）：菜单项仍显示；模态内所有输入只读、保存按钮禁用，并显示「只读模式」。
- 表格行 `⋯` 复用 `openCardMenu`，自动获得同一入口（不影响既有行为）。

---

## 2. 模态编辑器（Quiet Cards 风格）

### 2.1 技术选型

- 用 Obsidian 内置 `Modal` 子类 `MetadataEditorModal`（自带焦点陷阱、Esc、背景遮罩、焦点恢复），**不手写 overlay**。
- 令牌挂到 `modalEl`：`this.modalEl.addClass("pd-root", "pd-modal-host")`；内容 `this.contentEl.addClass("pd-modal")`，确保 `--pd-*` 生效。
- 关闭后：`anchor?.focus()`；未保存修改时先确认（§9）。

### 2.2 结构

```
.pd-modal
├─ .pd-modal-head
│  ├─ h2#pd-meta-title.pd-modal-title 「编辑分类与标签」
│  └─ p.pd-modal-sub 「仅修改题卡头部；不改题干/答案/笔记」
├─ form.pd-meta-form (submit 阻止默认)
│  ├─ .pd-form-row
│  │  ├─ label[for=pd-meta-category].pd-field-label 「大科目」
│  │  └─ input#pd-meta-category.pd-modal-input  (datalist 建议)
│  ├─ .pd-form-row
│  │  ├─ label[for=pd-meta-subject].pd-field-label 「子科目」
│  │  └─ input#pd-meta-subject.pd-modal-input   (datalist 建议)
│  ├─ .pd-form-row.is-tall
│  │  ├─ label[for=pd-meta-tags].pd-field-label 「章节 / 知识点」
│  │  ├─ input#pd-meta-tags.pd-modal-input
│  │  ├─ .pd-tags-preview (实时 chips 预览)
│  │  └─ .pd-form-hint 「用中英文逗号或顿号分隔，如：导数, 极限」
│  └─ .pd-modal-error[role=status][aria-live=polite]
└─ .pd-modal-actions
   ├─ button.pd-btn 「取消」
   └─ button.pd-btn.is-primary 「保存」
```

### 2.3 预填与建议

| 字段 | 预填 | datalist 建议 |
| --- | --- | --- |
| `category` | `card.category ?? "数学"`（当前生效值） | 全库 `card.category` 去重排序 |
| `subject` | `card.subject ?? ""`（当前生效值） | 当前 category 下的 subject 去重排序 |
| `tags` | `card.tags.join(", ")` | 当前 category 下的 tags 去重排序 |

- 说明文案：「留空大科目 = 回退『数学』；留空子科目 = 回退文件夹名/未分类；留空标签 = 无章节标签」。
- **预填的是生效值**：若原卡缺 `category`（推断为数学），保存会把当前值显式写入头部一次；若用户不想固化，清空该字段后保存即可（删除行、回到推断）。
- 输入框 `maxlength=120`；粘贴的换行统一折叠为空格（header 是单行）。
- tags 输入实时解析：`split(/[,，、]/)` → trim → 去重 → 生成 `.pd-tag.is-topic` 预览 chips。

### 2.4 校验

| 校验 | 行为 |
| --- | --- |
| 三字段都为空 | 合法（删除三个 header 行；全部回退推断） |
| 字段值含换行 | 折叠为空格（不报错） |
| 值过长（>120） | `maxlength` 限制，不额外报错 |
| 保存无变化 | 关闭模态，提示「内容未变化」，**不写盘** |
| 保存失败 | 模态不关闭，`.pd-modal-error` 红字 + `aria-live` 播报；草稿保留 |
| 只读模式 | 输入 `readOnly`、保存禁用、顶部提示「只读模式，暂不能保存」 |

- 保存按钮在无变化时禁用；输入变化后启用。
- `Ctrl/Cmd + Enter` = 保存；`Esc` = 取消（脏时确认）；`Tab` 走完整字段顺序。

---

## 3. 字段语义与回退

### 3.1 三字段

| 字段 | header key | 空值语义 |
| --- | --- | --- |
| 大科目 | `category` | 删除 `category:` 行 → 解析/索引回退 **`数学`** |
| 子科目 | `subject` | 删除 `subject:` 行 → 现有链路：`settings.defaultSubject` → 文件夹名 → `未分类` |
| 章节/知识点 | `tags` | 删除 `tags:` 行 → `[]` |

### 3.2 解析与序列化

```ts
function parseTags(raw: string): string[] {
  const parts = raw.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
  return [...new Set(parts)];            // 去重、保序
}
function joinTags(tags: string[]): string {
  return tags.join(", ");                // 统一英文逗号+空格
}
```

- 值统一 `trim()`；不折叠内部空格（子科目「线性代数 B」保留）。
- 编辑保存后 `tags` 行统一为 `tags: 导数, 极限`。

### 3.3 回退显示（不改解析）

- 卡片显示 `card.category || "数学"`、`card.subject || "未分类"`（现有 v3 行为）。
- 编辑清空并保存后，`rebuildIndex` 让卡片重新显示回退值；无需写 data.json。

---

## 4. 纯函数 `patchCardMetadata` 精确算法

> 位置建议：`src/core/metadata.ts`（无 `import "obsidian"`），与 `notes.ts` 共用同一套行令牌化工具。
> 只改目标 `` ```zaptrace `` 块**头部 key 行**；题干/答案/笔记/AI/其它块绝不触碰。

### 4.1 API

```ts
export interface CardMetadataPatch {
  category: string;   // 已 trim；空串 = 删除该行
  subject: string;    // 已 trim；空串 = 删除该行
  tags: string[];     // 已去重；空数组 = 删除该行
}
export interface MetaPatchResult {
  content: string;
  changed: boolean;
  error?: "block_not_found" | "not_zaptrace";
}
export function patchCardMetadata(
  markdown: string,
  ref: { line: number; endLine: number },   // 1-based 围栏行（来自最新重扫）
  next: CardMetadataPatch
): MetaPatchResult;
```

### 4.2 算法（与 `replacePersonalNotes` 同款行令牌化）

```
1. tokenize(markdown) → Line[] { text, eol }   // 保留每行原 EOL（CRLF/LF/CR）、末尾无换行
2. 校验 lines[ref.line-1].text 匹配 /^\s{0,3}`{3,}\s*zaptrace\s*$/i
   → 不匹配 error="not_zaptrace"；越界 error="block_not_found"
3. innerStart = ref.line（0-based：起始围栏下一行）
   innerEnd   = ref.endLine - 1（闭栏行索引，不含）
4. 头部识别（与 parser.splitHeader 完全一致）：
   first = 从 innerStart 起第一个 trim()!=="" 的行索引
   · 若 first 不存在，或 lines[first].text 不匹配 KEY_VALUE_RE
       → 无头部（noHeader=true）
   · 否则进入头部态：
       hdrStart = first
       hdrKeyEnd = hdrStart 起逐行：
          blank → 继续
          trim()=="---" → terminator=dashIndex，key 区结束于 dashIndex（不含）
          匹配 KEY_VALUE_RE → 收集 key 行，继续
          其它 → key 区结束于该行（body 起点），无 terminator
5. 若 noHeader：
   · 若 category=="" && subject=="" && tags.length==0 → changed=false
   · 否则在第 ref.line 行之后、first 行之前插入：
       [indent+"category: "+cat]（非空才插，按 category→subject→tags 顺序）
       [indent+"subject: "+subj]
       [indent+"tags: "+joinTags(tags)]
       [indent+"---", ""]
     indent = 围栏行前导空白（块基础缩进）
6. 若已有头部：
   · 对每个字段（category/subject/tags）：
       - 在 key 区找第一条匹配 /^(\s*)([A-Za-z][A-Za-z0-9_-]*)(\s*:\s*)(.*)$/i 且 key 小写等于字段名的行
       - 期望值非空：
           · 找到 → 只替换该行值部分，保留前导缩进、原 key 拼写与冒号两侧格式
           · 未找到 → 在 key 区「最后一条非空 key 行」之后插入
                     `${indent}${key}: ${value}`，按 category→subject→tags 顺序追加
       - 期望值为空：
           · 找到 → 删除该行（连同其行尾 EOL；不动相邻空行）
           · 未找到 → 不操作
   · 保留 `---` 终止行（若有）原样；**不新增/移动 `---`**
   · 若删除后 key 区**一条 key 行都不剩** 且存在 `---`：连同该 `---` 行删除
     （否则 `---` 会落入正文变成水平线）
   · 保留未知 key（id/source/star/difficulty/pdf/extra）原顺序与内容
7. 值序列化：单行；`\r?\n` 折叠为空格；category/subject trim
8. 逐行重建 `lines.map(l=>l.text+l.eol).join("")`
9. changed = newContent !== markdown
```

### 4.3 关键边界

| 情况 | 处理 |
| --- | --- |
| 无头部、正文以 `### 题干` 开始 | 在围栏后插入 category/subject/tags + `---` + 空行，正文不动 |
| 无头部、正文第一行是 `---`（水平线） | 同样先插入新头部 + `---` + 空行；原 `---` 留在正文 |
| 有头部且已有 `---` | 只改 key 行；`---` 保留 |
| 有头部但无 `---`（靠非 key 行结束） | 只在 key 区改；**不补 `---`** |
| 头部 key 重复（如两行 subject） | 更新**第一条**；后续重复行原样保留（parser 只取第一条） |
| 未知 key | 原样保留，位置不变 |
| 空 category/subject/tags | 删除对应 key 行；不写空值 |
| 删除后 key 区为空且原有 `---` | 一并删除 `---` 行，避免它变成正文水平线 |
| 大小写 key（`Category:`） | 大小写不敏感匹配；替换时保留原 key 拼写 |
| 缩进块（列表/引用内） | 新增行沿用该块头部缩进；块外缩进不变 |
| CRLF / 混合 EOL | 逐行保留；新行用该块主导 EOL |
| 文件末尾无换行 | 保持无换行 |
| 行号错 / 围栏非 zaptrace | `error`，原文返回、`changed=false` |
| `---` 前后空行 | 原样保留，不重排 |
| 值内含冒号 | 合法（header 只按第一个冒号切 key） |
| 值内含 `#`、`$`、中文 | 合法，原样写入 |
| 同文件其它块 | 字节不变（单测断言） |

### 4.4 qid / 重复 id

- 元数据编辑**不触碰 `id`**，因此 qid、instanceKey、复习状态均不变。
- 重复 id 的卡片允许编辑 category/subject/tags；保存后 `rebuildIndex` 仍按原规则确定性隔离，不因元数据变化改变归属。
- `subject/tags` 的 `QuestionState` 缓存会在 `rebuildIndex → ensureQuestionFromCard` 中按现有机制更新（既有字段，非新增）。

---

## 5. 保存流程（失败零副作用）

```
onSave():
 1. if plugin.isReadOnly() → 拒绝，模态顶部提示
 2. 老 card = 编辑开始时的 QuestionCard（qid/key/file/line）
 3. fresh = await app.vault.read(card.file)          // 最新内容，非 cached
 4. rescan = scanZaptraceBlocks(card.file, fresh)
    found = rescan.cards.filter(c => c.qid === card.qid || c.key === card.key)
            多个同 qid → 取 |c.line - card.line| 最小
    找不到 → 模态错误「题卡已移动/删除，请刷新索引」，不写盘
 5. patch = patchCardMetadata(fresh, {line: found.line, endLine: found.endLine}, {
       category: categoryInput.trim(),
       subject: subjectInput.trim(),
       tags: parseTags(tagsInput),
    })
    error → 模态红字，不写盘
    changed=false → 关闭模态，提示「内容未变化」，不写盘
 6. await app.vault.process(card.file, () => patch.content)   // 原子替换
    失败 → 模态红字「保存失败：…」，不写盘、不改缓存
 7. await plugin.rebuildIndex()      // 重新解析 category/subject/tags，刷新筛选数据
    plugin.refreshAll()              // 阅读卡/题库卡/筛选联动重渲染
 8. modal.close(); anchor?.focus()
```

- **不新增 data.json 字段**：元数据只在 Markdown 头部；data.json 仅可能由既有 `ensureQuestionFromCard` 刷新 `subject/tags` 缓存与 `lastSeenAt`（既有字段）。
- `category` 永不写入 data.json。
- 失败路径：文件不变、索引不重建、data.json 不写。
- 编辑分类后若当前筛选不再匹配该卡，卡片从当前列表消失属预期（筛选联动）；模态关闭后再重渲染。

---

## 6. 同色 chips（category 与 subject 同色）

### 6.1 CSS 变更

现状（`styles.css:1440-1443`）：`.pd-tag.is-category` 用 `--pd-surface-3` + `--pd-fg-2`（与 subject 不同色）。
v3.1 改为与 `.pd-tag.is-subject`（`styles.css:472-475`）**完全相同的 token**：

```css
/* v3.1：分类与子科目同色；章节标签保持中性 */
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

- 阅读卡与题库卡共用 `.pd-tag`，一处 CSS 同时生效。
- 题库卡的小尺寸覆盖（`.pd-qcard .pd-tag { height:20px; font-size:11px }`）只改尺寸，不改颜色。
- 不引入新 token；沿用 v2 既有 `--pd-accent-soft` / `--pd-accent` / `--pd-surface-3`。
- 类别与 subject 仅靠文字内容区分（不靠颜色），符合「颜色只表示状态」的原则（两者同属「当前分类」语义）。

### 6.2 编辑器内预览 chips

- 模态内 `.pd-tags-preview .pd-tag.is-topic` 只用中性 chips（章节/知识点），不出现 category/subject chip，避免与表单字段混淆。

---

## 7. 组件 / CSS 规格（新增）

| 组件 | 规格 |
| --- | --- |
| `.pd-modal-host`（Obsidian `.modal`） | `background: var(--pd-surface); border:1px solid var(--pd-line); border-radius:14px; box-shadow: var(--pd-shadow); padding:0; width:min(520px, calc(100vw - 32px))` |
| `.pd-modal` | `padding:18px 20px 16px; color:var(--pd-fg); font-family:var(--pd-font)` |
| `.pd-modal-title` | 17px/600 / `--pd-fg`；`margin:0 0 4px` |
| `.pd-modal-sub` | 12.5px / `--pd-muted` / 1.5；`margin:0 0 14px` |
| `.pd-form-row` | `display:grid; grid-template-columns:78px minmax(0,1fr); gap:10px 12px; align-items:start; margin:0 0 12px` |
| `.pd-field-label` | 12.5px/500 / `--pd-fg-2`；`padding-top:7px` |
| `.pd-modal-input` | 高 32 / 圆角 9 / `--pd-surface-2` 底 / 无边框 / 13px；focus `outline:2px solid var(--pd-accent); outline-offset:2px` |
| `.pd-tags-preview` | `grid-column:2; display:flex; flex-wrap:wrap; gap:6px; min-height:20px` |
| `.pd-form-hint` | `grid-column:2; font-size:11px; color:var(--pd-faint)` |
| `.pd-modal-error` | `min-height:18px; font-size:12.5px; color:var(--pd-red)`；`.is-error` 红字 |
| `.pd-modal-actions` | `display:flex; justify-content:flex-end; gap:8px; margin-top:14px` |
| `.pd-modal-actions .pd-btn` | 30px / 圆角 9 / 13px；主操作 accent-soft |

- 全部沿用 `--pd-*` 令牌；不写内联样式；不使用 `!important`（Obsidian `.modal` 覆盖必要时用 `.pd-modal-host.modal` 提高一层特异性）。
- 模态入场可复用 Obsidian 默认（不做自定义放大/位移），`prefers-reduced-motion` 下无额外动画。

---

## 8. ARIA / 键盘 / 焦点

| 项 | 规格 |
| --- | --- |
| 对话框 | 使用 Obsidian `Modal`（内部 `role="dialog" aria-modal="true"`）；标题 `id="pd-meta-title"`，`aria-labelledby` |
| 标签 | 每个 input 有 `<label for>`；tags 输入 `aria-describedby` 指向 `.pd-form-hint` |
| 初始焦点 | `category` 输入框（打开后 `input.focus()`） |
| 焦点陷阱 | Obsidian Modal 自带；不手写 trap |
| Esc | 关闭 = 取消；脏时先 `window.confirm("放弃未保存修改？")`；确认后关闭并恢复焦点到锚点 |
| 保存 | `Ctrl/Cmd+Enter`；禁用时按钮 `disabled` |
| 错误 | `.pd-modal-error` `role="status" aria-live="polite"`；保存失败同时给对应字段 `aria-invalid`（如有） |
| 关闭 | `modal.close()` 后 `anchor.focus()`；Obsidian 默认也会把焦点还给打开前元素 |
| 只读 | 输入 `readOnly`、按钮 `disabled`、提示文字 `aria-live="polite"` |

---

## 9. 单测清单（`tests/metadata.test.ts`，node:test）

> 全部对 `patchCardMetadata()` 纯函数；断言 changed、content 与「块外逐字节不变」。

1. 已有头部含 category/subject/tags：改三值 → 仅这三行变化，题干/答案/笔记/其它块/首行不变。
2. 头部缺 category：插入到 `---` 前、最后一个 key 后；顺序 category→subject→tags。
3. 头部缺 tags：仅追加 tags 行；未知 key 原样保留。
4. 无头部 + `### 题干` 正文：插入 `category/subject/tags + --- + 空行`，正文原样；重新 `scanZaptraceBlocks` 能解析出新值。
5. 无头部 + 正文首行 `---`：插入头部后原 `---` 仍在正文；解析正确。
6. 头部无 `---`（非 key 行结束）：只在 key 区改，不补 `---`。
7. 空 category/subject/tags：删除对应行；其余不变；缺省回退语义（`category || "数学"`、`subject ||` 文件夹）。
8. tags 分隔 `,`、`，`、`、` 混合 + 空格 + 重复：解析去重保序，输出 `a, b, c`。
9. CRLF 文件：保存后全文仍 CRLF；混合 EOL 逐行保留；末尾无换行仍无。
10. 整体缩进 4 空格的题卡：新增行沿用缩进，块外不变。
11. 头部重复 subject：只改第一行，第二行原样（解析仍取第一条）。
12. 未知键（`difficulty/pdf/foo`）与 `id`：内容与顺序不变。
13. 相同值保存：`changed=false`，不写。
14. 行号错/非 zaptrace：`error`，内容原样。
15. 同文件 3 个 zaptrace 块：只改第 2 块头部，第 1/3 块逐字节相同。
16. 值含换行：折叠为空格；值含冒号/`#`/中文：原样。
17. `---` 与空行：不新增/不删除/不重排。
18. 浏览器/Node 无 obsidian 依赖：纯函数可直接导入测试。
19. 删除全部 key 且原头部有 `---`：`---` 一并删除，`scanZaptraceBlocks` 仍能解析题干/答案（`---` 不落入正文）。

---

## 10. Obsidian 1.14.5 真机验收与截图步骤

### 10.1 准备

1. Obsidian 1.14.5，vault `E:\NoteCache`，暗色 100%；备份 `data.json` 与测试笔记。
2. `npm.cmd test` / `npm.cmd run typecheck` / `npm.cmd run build` 全绿；产物覆盖 `E:\NoteCache\.obsidian\plugins\ZapTrace`（保留 data.json），`Ctrl+R` 重载。
3. 夹具：至少 2 张卡（不同 category/subject/tags；其中一张无 `category` 验证回退）；不改 `examples/zaptrace-demo.md`（复制到 vault 测试）。
4. 记录 `data.json` 的 key 集合（用于验证「无新字段」）。

### 10.2 截图点

| # | 场景 | 操作 | 期望 |
| --- | --- | --- | --- |
| E1 | 阅读卡菜单入口 | 点阅读卡 `⋯` | 菜单含「编辑分类与标签」（图标 tags），位置在「打开原文」前 |
| E2 | 模态预填与布局 | 点该菜单 | Quiet Cards 模态：大科目/子科目/章节知识点三项预填；标签输入下方实时 chips；保存/取消；初始焦点在大科目 |
| E3 | 保存后阅读卡 | 改 category/subject/tags → 保存 | 模态关闭；卡片 chips 更新；category 与 subject **同色**（accent-soft/accent）；题干/答案/笔记不变 |
| E4 | 题库卡入口 + 筛选联动 | 题库卡 `⋯` → 编辑 → 改 category | 保存后 `rebuildIndex` + `refreshAll`；大科目下拉出现新值；原筛选下卡片按规则移动/消失；三列布局不变 |
| E5 | 清空回退 | 清空 category/subject/tags → 保存 | 卡片回退显示「数学」/文件夹名/无标签；头部对应行被删除（文件 diff 仅 header） |
| E6 | 取消/Esc/焦点 | 修改后 Esc；再打开后 Esc | 脏时出现确认；取消不写盘；焦点回到触发 `⋯` 按钮 |
| E7 | 错误/只读 | 把只读模式（安全模式）下打开 | 输入只读、保存禁用、提示「只读模式」；写盘不发生 |
| E8 | 字节级验证 | 保存前后 `git diff`/字节比较 | 仅目标块 header 的 1–3 行变化；题干/答案/个人笔记/AI 笔记/其它块/首行逐字节不变；EOL/缩进不变 |
| E9 | data.json | 保存前后比较 | key 集合不变（无新字段）；仅既有缓存 `subject/tags/lastSeenAt` 可能更新；`category` 不出现 |
| E10 | 同色 chips 对照 | 阅读卡与题库卡各截一张 | `.pd-tag.is-category` 与 `.is-subject` 颜色一致；`.is-topic` 保持中性 |

### 10.3 命令记录模板

```
npm.cmd test            → __ pass / 0 fail
npm.cmd run typecheck   → exit 0
npm.cmd run build       → exit 0（记录 main.js SHA-256）
部署：main.js / manifest.json / styles.css → E:\NoteCache\.obsidian\plugins\ZapTrace
data.json sha（前后）    → ____ / ____（key 集合不变）
```

---

## 11. 文件影响与实施顺序

| 阶段 | 内容 | 出口 |
| --- | --- | --- |
| P0 | `src/core/metadata.ts` + `tests/metadata.test.ts` | 18 条单测全绿 |
| P0 | `PluginContext.saveMetadata()`（main.ts 实现，复用 read→rescan→vault.process） | 纯函数 + 失败零副作用 |
| P1 | `src/view/metadataModal.ts`（Obsidian Modal + pd 表单） | E1/E2 通过 |
| P1 | `card.ts` / `libraryPanel.ts` 菜单插入项 | E1/E4 入口 |
| P2 | `.pd-tag.is-category` 同色 CSS + 模态样式 | E3/E10 |
| P2 | ARIA/焦点/错误/只读 | E6/E7 |

**影响文件**：`src/core/metadata.ts`（新）、`tests/metadata.test.ts`（新）、`src/view/metadataModal.ts`（新）、`src/view/card.ts`、`src/view/libraryPanel.ts`、`src/view/pluginContext.ts`、`src/main.ts`、`styles.css`。
**明确不动**：`src/core/parse.ts`（只读使用）、`src/core/id.ts`、评分/复习、data.json schema、`examples/zaptrace-demo.md`。

**非目标**：不做标签管理页/批量重命名；不做 AI 自动分类；不做 PDF 来源；不做批注。

---

## 附录 A · 模态字段/默认值速查

| 字段 | 默认预填 | 留空行为 | 保存后显示 |
| --- | --- | --- | --- |
| 大科目 category | `card.category ?? "数学"` | 删除行 → 回退数学 | `card.category` 重建后 |
| 子科目 subject | `card.subject ?? ""` | 删除行 → defaultSubject/文件夹/未分类 | `card.subject` |
| 章节 tags | `card.tags.join(", ")` | 删除行 → 无标签 | `card.tags` |

## 附录 B · 菜单文案与图标

| 菜单项 | 图标 | 说明 |
| --- | --- | --- |
| 编辑分类与标签 | `tags` | 打开 MetadataEditorModal |
| 收藏 / 取消收藏 | `star` | 既有 |
| 打开原文 | `external-link` | 既有 |
| 复制题干 | `copy` | 既有 |

---

*本文为 v3.1 增量设计，只写文档；实现按 §11 顺序落地，解析/ID/评分/复习与 data.json schema 不变。*
