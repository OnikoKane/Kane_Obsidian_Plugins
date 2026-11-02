# Kane Obsidian Plugins

个人维护的 Obsidian 插件，每个插件一个目录。

| 目录 | 插件 | 说明 |
| --- | --- | --- |
| [`AnnotationMarker_zcode/`](AnnotationMarker_zcode/) | Annotation Marker（ZCode 版） | 给笔记加高亮 / 批注 / 注音，标注写在插件目录的影子副本里，不改正文 |
| [`MubuStyle/`](MubuStyle/) | MubuStyle | 把笔记外观换成幕布（Mubu）风：字体 / 纸张式背景 / 实心圆点 / 缩进参考线 / 悬浮格式栏 |
| [`ZapTrace/`](ZapTrace/) | ZapTrace | 数学 Markdown 题卡、折叠答案与笔记、收藏题集，以及四档评分驱动的本地间隔复习 |

## 使用方式

每个子目录就是一份可以直接放进
`<你的仓库>/.obsidian/plugins/<插件id>/` 的插件，包含：
`main.js`、`styles.css`、`manifest.json`（外加说明文档与源码）。

具体安装、功能与配置见各子目录的 `README.md`。

## 说明

- `AnnotationMarker_zcode` 是改造版：基于原作者 3.0.18 打了本地补丁，`manifest.json` 的
  `author` 标为 ZCode，`version` 抬到 `99.0.0`，避免被上游版本自动覆盖。
- `MubuStyle` 包含 TypeScript 源码与构建产物。
- 原始项目的著作权归各自原作者所有，详见各子目录的「致谢与许可」。
