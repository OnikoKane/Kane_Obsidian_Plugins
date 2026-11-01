# 本地改动清单（相对上游 3.0.18）

在 `main.js` 里搜索 `[ZCode patch]` 可以定位每一处改动（共 57 条注释）；
`styles.css` 末尾是一整段补充样式。修改上游版本后，按下表锚点重打即可。

| # | 位置 | 改动 |
| --- | --- | --- |
| 1 | `isReadingModeOnly()` | 新增工具方法：`MarkdownView.getMode() !== "source"` |
| 2 | `tryShowSelectionMenu()` | 编辑模式不弹标注菜单 |
| 3 | `handleMobileSelectionStable()` | 移动端同上 |
| 4 | `registerMarkClickInteraction()` | 编辑模式不接管标注点击 |
| 5 | `annotateSelectionWithColor()` | 编辑模式颜色命令不生效 |
| 6 | i18n `annotationViewTitle` | 去掉标签页标题的「【标注视图】/【Anno Mode】」前缀 |
| 7 | `openAnnotationView()` | 进入标注视图固定 **preview（阅读+标注）**，并记录进入前的模式 |
| 8 | `closeAnnotationView()` | 关闭时恢复进入前的 **阅读/编辑** 模式 |
| 9 | `createListButton()` | emoji 图标 → Lucide `notebook-pen` SVG |
| 10 | `SelectionMenu.show()` | 去掉「选择颜色立即标注」文字；点空白处关闭菜单 |
| 11 | `SelectionMenu.hide()` | 摘掉「点空白关闭」监听 |
| 12 | `registerImageEmbedFixer()` | 标注视图里 `./`、`../` 相对路径图片（含 HTML `<img>`）按原笔记目录解析 |
| 13 | `installAnnotationLinkResolutionPatch()` | 重定向 `metadataCache.getFirstLinkpathDest` 的 `sourcePath` |
| 14 | `AnnotationListPanel.positionPanel()` | 批注列表贴住入口图标；拖动图标、窗口缩放时同步移动 |
| 15 | `AnnotationListPanel.renderContent()` | 条目纵向两段：上边「跨段」徽标 + 原文（暗色），下边批注（亮色 + 图标） |
| 16 | `AnnotationListPanel.hide()` | 释放 resize 监听 |
| 17 | `styles.css` 末尾整段 | 更紧凑的悬浮窗；颜色选项 20px 圆角方形；批注列表标题栏与两段式条目 |
| 18 | `syncFromOriginal()` / `extractAnnotationNotes()` / `restoreAnnotationNotes()` | 合并原笔记改动时保护 `data-annotation-note` |
| 19 | `styles.css`（字体） | 标注菜单 / 批注列表 / 右键菜单 / 悬浮提示 / 侧栏 / 导入导出框统一字形 |
| 20 | `styles.css`（Adjustable Media） | 行高兜底 + 尺寸就位前隐藏图片 |
| 21 | `AnnotationListPanel.restoreButtonPosition()` / `saveButtonPosition()` | 入口图标位置按容器比例存进设置，重启后回到原位 |
| 22 | `SelectionMenu.applySavedMenuSize()` + `.annotation-selection-menu { resize: both }` | 窗口与批注输入框都可拖拽缩放，只在拖拽松手时记住尺寸 |
| 23 | `buildRubySection()` ×2 + CSS | 注音默认收成一行，整行可点，展开后才出现输入区 |
| 24 | `registerMarkClickInteraction()` + `SelectionMenu.show()` | 点已有批注复用「添加标注」窗口：标题「批注」、预填内容，「保存」= 更新原标注 |
| 25 | `installViewActionEntry()` | 「标注模式」入口从左侧功能区移到笔记视图右上角操作区（`View.addAction`） |
| 26 | `styles.css`（批注输入框） | 「批注内容」与字数同水平线；输入框描边常驻 |
| 27 | `styles.css`（标题栏） | 悬浮窗与批注列表标题栏统一尺寸，标题与关闭按钮同中线 |
| 28 | `styles.css`（批注列表） | 条目之间加细分隔线 |
| 29 | `installViewActionEntry()` + `registerCommands()` | 标注视图内也挂同一图标（作用为关闭、高亮显示）；图标被重建后自动补挂；命令改为常驻 `callback`，可在快捷键设置中绑定 |
| 30 | `createFakeTFile()` | 给注入的假文件加只读 `basename` getter，标题显示原笔记名而不是「目录&.文件名」 |
| 31 | `prepareVmlBoot()` / `gateVmlBoot()` / `refreshViewActions()` | 开/关标注视图时先隐藏尚未被 Adjustable Media 接管的图片（1.5s 窗口 + 精确打标兜底）；换文件后补扫视图头部按钮 |
| 32 | `getSavedScroll()` / `captureScrollAnchor()` / `pinScroll()` | 滚动位置改从可见滚动容器读取；过渡窗口内以「视口上方最近的标题」为锚点按帧校正，滚到中间再开/关不会跳回顶部 |

## 数据保护三道防线

1. **批注字段保护**：合并外部改动只应移动正文，写回前把每条标注的 `data-annotation-note` 恢复成合并前的值。
2. **全丢兜底**：合并前有标注、合并结果一个都不剩时，直接放弃写回并在控制台告警。
3. **递归防护**：当前文件本身就是标注副本、且会话表里没有记录时，不再“给标注文件建标注”。

## 与 Adjustable Media 的兼容

- 标注视图渲染的是注入 `vault.fileMap` 的假文件，第三方渲染器拿 `ctx.sourcePath` 解析相对路径会失败，
  因此重定向 `getFirstLinkpathDest`（第 13 项）。
- 它的图片布局块是“先铺原图、再换成设定行高”，所以过渡窗口内需要隐藏未就位的图片（第 20 / 31 项）。

## 备份与回退

- 上游版本升级会覆盖 `main.js` / `styles.css`，本分支已把 `version` 抬到 `99.0.0` 阻止自动更新；
  如果仍被覆盖，按上表锚点重打即可。
- 补充样式集中在 `styles.css` 末尾的注释块，删掉整段即可还原外观。
