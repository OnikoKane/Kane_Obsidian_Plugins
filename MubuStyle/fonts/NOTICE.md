# 字体来源与许可

`fonts/` 里的三个文件是 **Source Sans Pro**（Regular / Semibold / Bold），
即幕布客户端 `app.css` 中 `--font-family: SourceSansPro, ...` 实际加载的字体。

- 出处：本机已安装的幕布客户端（`%LOCALAPPDATA%\mubu\app.asar` 内的 `/web/SourceSansPro-*.ttf`）
- 版权：Copyright 2010-2019 Adobe (http://www.adobe.com/)，保留部分权利
- 许可：SIL Open Font License 1.1（https://scripts.sil.org/OFL）
  OFL 允许随软件一起复制、分发与嵌入，包括商用；保留本声明即可。
- 用途：仅在本插件里通过 `@font-face` 注册为 `"Mubu Sans"`，供笔记正文的拉丁字母与数字使用。

中文部分不使用该字体（Source Sans Pro 不含 CJK），
仍按幕布的做法回落到系统字体：PingFang SC（macOS）/ Microsoft YaHei（Windows）。

如果不希望随插件分发字体，删除 `fonts/` 目录即可，
插件会自动回落到 `"Source Sans Pro"` → 系统字体，功能不受影响。
