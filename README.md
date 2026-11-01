# Kane Obsidian Plugins

个人维护的 Obsidian 插件（改造版），每个插件一个目录。

| 目录 | 插件 | 说明 |
| --- | --- | --- |
| [`AnnotationMarker_zcode/`](AnnotationMarker_zcode/) | Annotation Marker（ZCode 版） | 给笔记加高亮 / 批注 / 注音，标注写在插件目录的影子副本里，不改正文 |

## 使用方式

每个子目录就是一份可以直接放进
`<你的仓库>/.obsidian/plugins/<插件id>/` 的插件，包含：
`main.js`、`styles.css`、`manifest.json`（外加说明文档）。

具体安装、功能与改动清单见各子目录的 `README.md`。

## 说明

- 这里的插件都是**改造版**：在原作者版本上打了本地补丁，`manifest.json` 的 `author` 标为 ZCode，
  `version` 抬到 `99.0.0` 以避免被上游版本自动覆盖。
- 原始项目的著作权归各自原作者所有，详见各子目录的「致谢与许可」。
