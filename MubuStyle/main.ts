import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { MubuBlockMenu, MubuBulletFold, MubuToolbar } from "./toolbar";

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

/* 幕布官方字体栈（取自幕布客户端 app.css 的 .mm-editor 规则）：
   SourceSansPro → 系统 UI → PingFang SC → 微软雅黑。中文仍走雅黑，拉丁与数字用 Source Sans Pro。 */
const MUBU_FONT_STACK =
	'"Mubu Sans", "Source Sans Pro", "PingFang SC", "Hiragino Sans GB"';

/* 系统字体栈：不带 Source Sans Pro，中文与拉丁都用系统缺字回退字体 */
const SYSTEM_FONT_STACK = '"PingFang SC", "Hiragino Sans GB"';

type FontMode = "obsidian" | "system" | "mubu" | "custom";

type PresetName = "dark" | "light";

interface Palette {
	/** 窗口外壳：顶栏 / 标签栏 / 状态栏 */
	chrome: string;
	/** 侧栏与纸张周围的「桌面」 */
	desk: string;
	/** 笔记纸张的底色 */
	background: string;
	backgroundSecondary: string;
	text: string;
	textMuted: string;
	/** 正文链接色 */
	accent: string;
	/** UI 强调色：按钮、开关、选区、复选框（幕布是紫色） */
	uiAccent: string;
}

const PRESETS: Record<PresetName, Palette> = {
	dark: {
		chrome: "#121212",
		desk: "#212121",
		background: "#2c2c2f",
		backgroundSecondary: "#212121",
		text: "#d2d2d0",
		textMuted: "#8f8f8f",
		accent: "#96b1c6",
		uiAccent: "#5854d4",
	},
	light: {
		chrome: "#dededa",
		desk: "#e8e8e5",
		background: "#fbfbfa",
		backgroundSecondary: "#e8e8e5",
		text: "#3a3a3a",
		textMuted: "#8b8b86",
		accent: "#5b7ea6",
		uiAccent: "#4a46c0",
	},
};

/* ------------------------------------------------------------------ *
 * 设置
 * ------------------------------------------------------------------ */

interface MubuStyleSettings extends Palette {
	/** 配置结构版本，用于把旧版保存值迁移到新默认值 */
	settingsVersion: number;
	enabled: boolean;
	preset: PresetName;
	/** 字体方案：obsidian 跟随 / system 系统雅黑 / mubu 内置 Source Sans Pro / custom 自定义 */
	fontMode: FontMode;
	/** 仅 fontMode = custom 时使用 */
	fontFamily: string;
	fontSize: number;
	/** 字间距（em） */
	letterSpacing: number;
	lineHeight: number;
	/** 0 表示跟随主题的行宽设置 */
	contentWidth: number;
	/** 幕布式实心小圆点 */
	mubuBullets: boolean;
	showGuides: boolean;
	/** 纸张式背景：深色桌面 + 留白的笔记卡片 */
	paperBackground: boolean;
	pageInset: number;
	stylizeScrollbar: boolean;
	styleSidebar: boolean;
	/** 选中文字后弹出浮动工具栏 */
	floatingToolbar: boolean;
	/** 行首「⋯」块菜单 */
	blockMenu: boolean;
	/** 点列表圆点折叠/展开子项（幕布式圆盘） */
	bulletFold: boolean;
}

const DEFAULT_SETTINGS: MubuStyleSettings = {
	settingsVersion: 4,
	enabled: true,
	preset: "dark",
	...PRESETS.dark,
	fontMode: "mubu",
	fontFamily: "",
	fontSize: 16,
	letterSpacing: 0,
	lineHeight: 2.1,
	contentWidth: 0,
	mubuBullets: true,
	showGuides: true,
	paperBackground: true,
	pageInset: 12,
	stylizeScrollbar: true,
	styleSidebar: true,
	floatingToolbar: true,
	blockMenu: true,
	bulletFold: true,
};

/* ------------------------------------------------------------------ *
 * 颜色工具
 * ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

const HEX_PATTERN = /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function hexToRgb(hex: string): [number, number, number] | null {
	const value = hex.trim().replace(/^#/, "");
	if (!HEX_PATTERN.test(value)) return null;
	const expanded =
		value.length === 3
			? value
					.split("")
					.map((char) => char + char)
					.join("")
			: value;
	return [
		parseInt(expanded.slice(0, 2), 16),
		parseInt(expanded.slice(2, 4), 16),
		parseInt(expanded.slice(4, 6), 16),
	];
}

function rgbToHex(rgb: [number, number, number]): string {
	return (
		"#" +
		rgb
			.map((channel) =>
				Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0")
			)
			.join("")
	);
}

/** 按比例把 a 混向 b（t = 0 时返回 a） */
function mixColor(a: string, b: string, t: number): string {
	const from = hexToRgb(a);
	const to = hexToRgb(b);
	if (!from || !to) return a;
	return rgbToHex([
		from[0] + (to[0] - from[0]) * t,
		from[1] + (to[1] - from[1]) * t,
		from[2] + (to[2] - from[2]) * t,
	]);
}

/* ------------------------------------------------------------------ *
 * 插件
 * ------------------------------------------------------------------ */

export default class MubuStylePlugin extends Plugin {
	settings!: MubuStyleSettings;

	/** 记录内联到 body 上的 CSS 变量，便于关闭时清理 */
	private appliedKeys = new Set<string>();

	/** 当前已加载的字体个数 / 失败原因，供设置面板显示 */
	fontStatus = "尚未加载";

	/** 选中文字后的浮动工具栏 */
	private toolbar: MubuToolbar | null = null;
	/** 行首「⋯」块菜单 */
	private blockMenu: MubuBlockMenu | null = null;
	/** 点圆点折叠的兜底点击 */
	private bulletFold: MubuBulletFold | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new MubuStyleSettingTab(this.app, this));

		await this.loadFonts();
		this.applyStyles();
		this.syncUi();
		// 布局就绪后再应用一次，避免启动瞬间被主题覆盖
		this.app.workspace.onLayoutReady(() => this.applyStyles());

		this.addCommand({
			id: "toggle-mubu-style",
			name: "切换幕布样式（开/关）",
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveAndApply();
				new Notice(
					this.settings.enabled ? "MubuStyle 已启用" : "MubuStyle 已关闭"
				);
			},
		});

		this.addCommand({
			id: "use-dark-preset",
			name: "使用幕布暗色配色",
			callback: async () => {
				this.applyPreset("dark");
				await this.saveAndApply();
			},
		});

		this.addCommand({
			id: "use-light-preset",
			name: "使用幕布亮色配色",
			callback: async () => {
				this.applyPreset("light");
				await this.saveAndApply();
			},
		});

		this.addCommand({
			id: "export-config",
			name: "保存配置到插件目录",
			callback: () => this.exportConfig(),
		});

		this.addCommand({
			id: "import-config",
			name: "从插件目录读取配置",
			callback: () => this.importConfig(),
		});

		this.addCommand({
			id: "reload-fonts",
			name: "重新加载内置字体",
			callback: async () => {
				await this.loadFonts();
				new Notice(`MubuStyle 字体：${this.fontStatus}`);
			},
		});
	}

	onunload(): void {
		const body = document.body;
		this.toolbar?.destroy();
		this.toolbar = null;
		this.blockMenu?.destroy();
		this.blockMenu = null;
		this.bulletFold?.destroy();
		this.bulletFold = null;
		body.classList.remove(
			"mubu-style",
			"mubu-keep-sidebar",
			"mubu-custom-font",
			"mubu-dots",
			"mubu-guides",
			"mubu-paper",
			"mubu-scrollbar",
			"mubu-bullet-fold"
		);
		for (const key of this.appliedKeys) body.style.removeProperty(key);
		this.appliedKeys.clear();
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) ?? {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);

		const savedVersion: number = saved.settingsVersion ?? 0;

		// v1 → v2：排版默认值变了（字体/字号/行距/字间距），颜色与留白保持不变
		if (savedVersion < 2) {
			this.settings.fontSize = DEFAULT_SETTINGS.fontSize;
			this.settings.lineHeight = DEFAULT_SETTINGS.lineHeight;
			this.settings.letterSpacing = DEFAULT_SETTINGS.letterSpacing;
		}

		// v2 → v3：跟随字体开关换成四选一的字体方案
		if (savedVersion < 3) {
			this.settings.fontMode =
				saved.followObsidianFont === true ? "obsidian" : "system";
		}

		// v3 → v4：拉丁字母改用内置 Source Sans Pro，中文仍走系统回退字体；
		// 行距按幕布实测值调到 2.1
		if (savedVersion < 4) {
			this.settings.fontMode = "mubu";
			this.settings.lineHeight = DEFAULT_SETTINGS.lineHeight;
		}

		this.settings.settingsVersion = DEFAULT_SETTINGS.settingsVersion;
		if (savedVersion !== DEFAULT_SETTINGS.settingsVersion) {
			await this.saveData(this.settings);
		}
	}

	async saveAndApply(): Promise<void> {
		await this.saveData(this.settings);
		this.applyStyles();
		this.syncUi();
	}

	/** 按设置创建/销毁浮动工具栏与块菜单 */
	private syncUi(): void {
		const s = this.settings;

		if (s.floatingToolbar && !this.toolbar) {
			this.toolbar = new MubuToolbar(this);
		} else if (!s.floatingToolbar && this.toolbar) {
			this.toolbar.destroy();
			this.toolbar = null;
		}

		if (s.blockMenu && !this.blockMenu) {
			this.blockMenu = new MubuBlockMenu(this);
		} else if (!s.blockMenu && this.blockMenu) {
			this.blockMenu.destroy();
			this.blockMenu = null;
		}

		if (s.bulletFold && !this.bulletFold) {
			this.bulletFold = new MubuBulletFold(this);
		} else if (!s.bulletFold && this.bulletFold) {
			this.bulletFold.destroy();
			this.bulletFold = null;
		}
	}

	applyPreset(name: PresetName): void {
		this.settings.preset = name;
		Object.assign(this.settings, PRESETS[name]);
	}

	/* ---------------- 配置文件（存在插件目录下） ---------------- */

	/** 插件目录：<vault>/.obsidian/plugins/mubu-style */
	private pluginDir(): string {
		return (
			this.manifest.dir ??
			`${this.app.vault.configDir}/plugins/${this.manifest.id}`
		);
	}

	get configFilePath(): string {
		return `${this.pluginDir()}/mubu-style.config.json`;
	}

	/**
	 * 用 FontFace API 注册内置字体：能拿到明确的成功/失败，
	 * 失败原因直接显示在设置面板里，不用靠猜。
	 * 字体是 base64 内嵌的 woff2 —— app:// 路径会被 Chromium 的字体 CORS 拦掉。
	 */
	async loadFonts(): Promise<void> {
		if (document.fonts.check('16px "Mubu Sans"')) {
			this.fontStatus = "已加载";
			return;
		}

		const css = await this.readFontCss();
		if (!css.trim()) {
			this.fontStatus = "找不到 fonts/mubu-fonts.css";
			return;
		}

		const blocks = css.match(/font-weight:\d+[^}]*?base64,[A-Za-z0-9+/=]+\)/g) ?? [];
		let loaded = 0;
		let failure = "";

		for (const block of blocks) {
			const weight = (block.match(/font-weight:(\d+)/) ?? [])[1] ?? "400";
			const base64 = (block.match(/base64,([A-Za-z0-9+/=]+)/) ?? [])[1] ?? "";
			if (!base64) continue;

			try {
				const face = new FontFace(
					"Mubu Sans",
					`url(data:font/woff2;base64,${base64})`,
					{ weight }
				);
				await face.load();
				// 部分版本的 DOM lib 里没有 FontFaceSet.add 的类型声明
				(document.fonts as unknown as { add: (face: FontFace) => void }).add(
					face
				);
				loaded++;
			} catch (error) {
				failure = `字重 ${weight} 失败`;
			}
		}

		if (loaded > 0) {
			this.fontStatus = failure
				? `部分加载（${loaded} 个），${failure}`
				: `已加载（${loaded} 个字重）`;
		} else {
			this.fontStatus = failure || "字体解析失败";
		}
	}

	/** 读取 mubu-fonts.css：先走 vault adapter，失败再退回 Node fs */
	private async readFontCss(): Promise<string> {
		const relative = `${this.pluginDir()}/fonts/mubu-fonts.css`;
		try {
			return await this.app.vault.adapter.read(relative);
		} catch (primaryError) {
			try {
				const nodeRequire = (window as unknown as {
					require?: (module: string) => unknown;
				}).require;
				if (!nodeRequire) throw primaryError;
				const fs = nodeRequire("fs") as {
					readFileSync: (path: string, encoding: string) => string;
				};
				const adapter = this.app.vault.adapter as unknown as {
					getBasePath?: () => string;
				};
				const base = adapter.getBasePath?.() ?? "";
				if (!base) throw primaryError;
				return fs.readFileSync(`${base}/${relative}`, "utf8");
			} catch {
				this.fontStatus = `读取字体文件失败：${String(primaryError)}`;
				return "";
			}
		}
	}

	async exportConfig(): Promise<void> {
		const path = this.configFilePath;
		const payload = {
			plugin: this.manifest.id,
			version: this.manifest.version,
			savedAt: new Date().toISOString(),
			settings: this.settings,
		};
		try {
			await this.app.vault.adapter.write(
				path,
				JSON.stringify(payload, null, "\t")
			);
			new Notice(`配置已保存到 ${path}`);
		} catch (error) {
			new Notice(`保存配置失败：${String(error)}`);
		}
	}

	async importConfig(): Promise<boolean> {
		const path = this.configFilePath;
		try {
			if (!(await this.app.vault.adapter.exists(path))) {
				new Notice(`没有找到配置文件：${path}`);
				return false;
			}
			const raw = await this.app.vault.adapter.read(path);
			const parsed = JSON.parse(raw);
			const incoming = parsed?.settings ?? parsed;
			if (!incoming || typeof incoming !== "object") {
				new Notice("配置文件格式不对");
				return false;
			}
			this.settings = Object.assign({}, DEFAULT_SETTINGS, incoming);
			await this.saveAndApply();
			new Notice("已读取插件目录里的配置");
			return true;
		} catch (error) {
			new Notice(`读取配置失败：${String(error)}`);
			return false;
		}
	}

	/**
	 * 把设置写进 body：类名开关 + CSS 变量。
	 * styles.css 负责把这些 --mubu-* 令牌映射到 Obsidian 主题变量。
	 */
	applyStyles(): void {
		const body = document.body;
		const style = body.style;

		for (const key of this.appliedKeys) style.removeProperty(key);
		this.appliedKeys.clear();

		const s = this.settings;

		body.classList.toggle("mubu-style", s.enabled);
		body.classList.toggle("mubu-keep-sidebar", !s.styleSidebar);
		body.classList.toggle("mubu-custom-font", s.fontMode !== "obsidian");
		body.classList.toggle("mubu-dots", s.mubuBullets);
		body.classList.toggle("mubu-guides", s.showGuides);
		body.classList.toggle("mubu-paper", s.paperBackground);
		body.classList.toggle("mubu-scrollbar", s.stylizeScrollbar);
		body.classList.toggle("mubu-bullet-fold", s.bulletFold);

		if (!s.enabled) return;

		const set = (name: string, value: string) => {
			style.setProperty(name, value);
			this.appliedKeys.add(name);
		};

		const fontStack =
			s.fontMode === "custom"
				? s.fontFamily.trim() || SYSTEM_FONT_STACK
				: s.fontMode === "mubu"
					? MUBU_FONT_STACK
					: s.fontMode === "system"
						? SYSTEM_FONT_STACK
						: "";
		if (fontStack) set("--mubu-font", fontStack);
		set("--mubu-font-size", `${clamp(s.fontSize, 12, 24)}px`);
		set("--mubu-letter-spacing", `${clamp(s.letterSpacing, -0.05, 0.2)}em`);
		set("--mubu-line-height", String(clamp(s.lineHeight, 1.2, 2.6)));
		set("--mubu-chrome", s.chrome);
		set("--mubu-desk", s.desk);
		set("--mubu-bg", s.background);
		set("--mubu-bg-secondary", s.backgroundSecondary);
		set("--mubu-page-inset", `${clamp(s.pageInset, 0, 48)}px`);
		set("--mubu-text", s.text);
		set("--mubu-text-muted", s.textMuted);
		set("--mubu-accent", s.accent);
		set("--mubu-ui-accent", s.uiAccent);
		set(
			"--mubu-heading",
			s.preset === "light"
				? mixColor(s.text, "#000000", 0.6)
				: mixColor(s.text, "#ffffff", 0.55)
		);
		set("--mubu-bullet", s.textMuted);

		if (s.contentWidth > 0) {
			const width = `${clamp(s.contentWidth, 300, 1600)}px`;
			set("--file-line-width", width);
			// Obsidian 默认主题与 Minimal 都使用 --line-width 控制正文宽度
			set("--line-width", width);
		}
	}
}

/* ------------------------------------------------------------------ *
 * 设置界面
 * ------------------------------------------------------------------ */

class MubuStyleSettingTab extends PluginSettingTab {
	plugin: MubuStylePlugin;

	constructor(app: App, plugin: MubuStylePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const s = this.plugin.settings;
		containerEl.empty();
		containerEl.addClass("mubu-settings");

		containerEl.createEl("h2", { text: "MubuStyle" });
		containerEl.createEl("p", {
			text: "把笔记排版切换成幕布（Mubu）风格：字体、行距、背景与列表圆点。",
			cls: "setting-item-description",
		});

		/* ---------------- 预览 ---------------- */
		const preview = containerEl.createDiv({ cls: "mubu-preview" });
		preview.createEl("h1", { text: "Obsidian" });
		const list = preview.createEl("ul");
		["Mind", "Source", "设置"].forEach((label) => {
			list.createEl("li", { text: label });
		});
		const sub = list.createEl("li");
		sub.createEl("span", { text: "插件整理" });
		const subList = sub.createEl("ul");
		const subItem = subList.createEl("li");
		subItem.createEl("a", {
			text: "示例链接文本",
			href: "#",
			cls: "internal-link",
		});
		subList.createEl("li", { text: "快捷键" });
		preview.createEl("p", {
			text: "正文行距与字号的实时预览，可用 ==高亮== 与 `行内代码` 观察效果。",
		});

		/* ---------------- 基础 ---------------- */
		containerEl.createEl("h3", { text: "基础" });

		new Setting(containerEl)
			.setName("启用幕布样式")
			.setDesc("关闭后完全恢复主题的默认外观")
			.addToggle((toggle) =>
				toggle.setValue(s.enabled).onChange(async (value) => {
					s.enabled = value;
					await this.plugin.saveAndApply();
				})
			);

		new Setting(containerEl)
			.setName("配色预设")
			.setDesc("切换幕布暗色 / 亮色配色，之后仍可单独微调下方颜色")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("dark", "幕布暗色")
					.addOption("light", "幕布亮色")
					.setValue(s.preset)
					.onChange(async (value) => {
						this.plugin.applyPreset(value as PresetName);
						await this.plugin.saveAndApply();
						this.display();
					})
			);

		/* ---------------- 排版 ---------------- */
		containerEl.createEl("h3", { text: "排版" });

		new Setting(containerEl)
			.setName("字体方案")
			.setDesc(
				"幕布：中文走系统回退字体、拉丁与数字用内置 Source Sans Pro（推荐）；系统：全部用系统回退字体"
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("mubu", "幕布（Source Sans Pro + 系统中文字体）")
					.addOption("system", "系统字体（全部用系统回退）")
					.addOption("obsidian", "跟随 Obsidian 设置")
					.addOption("custom", "自定义")
					.setValue(s.fontMode)
					.onChange(async (value) => {
						s.fontMode = value as FontMode;
						await this.plugin.saveAndApply();
						this.display();
					})
			);

		const fontStatus = new Setting(containerEl)
			.setName("内置字体状态")
			.setDesc(this.plugin.fontStatus);
		fontStatus.addButton((button) =>
			button.setButtonText("重新加载").onClick(async () => {
				await this.plugin.loadFonts();
				this.display();
			})
		);

		if (s.fontMode === "custom") {
			new Setting(containerEl)
				.setName("自定义字体")
				.setDesc("CSS font-family 写法，例如：\"霞鹜文楷\", sans-serif")
				.addText((text) =>
					text
						.setPlaceholder('留空 = 系统字体')
						.setValue(s.fontFamily)
						.onChange(async (value) => {
							s.fontFamily = value;
							await this.plugin.saveAndApply();
						})
				);
		}

		new Setting(containerEl)
			.setName("字号")
			.setDesc("正文字号（px）；「跟随 Obsidian」时以 Obsidian 设置为准")
			.addSlider((slider) =>
				slider
					.setLimits(12, 24, 0.5)
					.setValue(s.fontSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						s.fontSize = value;
						await this.plugin.saveAndApply();
					})
			);

		new Setting(containerEl)
			.setName("行距")
			.setDesc("幕布默认约 1.9 倍行距")
			.addSlider((slider) =>
				slider
					.setLimits(1.2, 2.4, 0.05)
					.setValue(s.lineHeight)
					.setDynamicTooltip()
					.onChange(async (value) => {
						s.lineHeight = value;
						await this.plugin.saveAndApply();
					})
			);

		new Setting(containerEl)
			.setName("字间距")
			.setDesc("负值更紧凑，正值更松散（em）")
			.addSlider((slider) =>
				slider
					.setLimits(-0.05, 0.2, 0.005)
					.setValue(s.letterSpacing)
					.setDynamicTooltip()
					.onChange(async (value) => {
						s.letterSpacing = value;
						await this.plugin.saveAndApply();
					})
			);

		new Setting(containerEl)
			.setName("正文宽度")
			.setDesc("0 表示跟随主题；建议 700–900 之间")
			.addSlider((slider) =>
				slider
					.setLimits(0, 1400, 20)
					.setValue(s.contentWidth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						s.contentWidth = value;
						await this.plugin.saveAndApply();
					})
			);

		/* ---------------- 颜色 ---------------- */
		containerEl.createEl("h3", { text: "颜色" });

		this.addColorSetting(
			containerEl,
			"顶栏底色",
			"标签栏、标题栏、状态栏的底色",
			"chrome"
		);
		this.addColorSetting(
			containerEl,
			"窗口底色",
			"笔记纸张之外的窗口/桌面底色",
			"desk"
		);
		this.addColorSetting(containerEl, "纸张底色", "笔记正文的背景", "background");
		this.addColorSetting(
			containerEl,
			"侧栏背景色",
			"文件列表、侧边面板的背景",
			"backgroundSecondary"
		);
		this.addColorSetting(containerEl, "正文颜色", "普通文字颜色", "text");
		this.addColorSetting(
			containerEl,
			"次要文字颜色",
			"列表圆点、引用、注释等",
			"textMuted"
		);
		this.addColorSetting(
			containerEl,
			"强调色",
			"链接、选区与复选框",
			"accent"
		);
		this.addColorSetting(
			containerEl,
			"主题强调色",
			"按钮、开关、选区、复选框等 UI 用色（幕布紫 #5854d4）",
			"uiAccent"
		);

		/* ---------------- 细节 ---------------- */
		containerEl.createEl("h3", { text: "细节" });

		new Setting(containerEl)
			.setName("幕布圆点")
			.setDesc("实心灰色小圆点，与幕布一致（阅读视图与实时预览同步）")
			.addToggle((toggle) =>
				toggle.setValue(s.mubuBullets).onChange(async (value) => {
					s.mubuBullets = value;
					await this.plugin.saveAndApply();
				})
			);

		new Setting(containerEl)
			.setName("缩进参考线")
			.setDesc("在父级下方画出连接子项的细线，和幕布一样")
			.addToggle((toggle) =>
				toggle.setValue(s.showGuides).onChange(async (value) => {
					s.showGuides = value;
					await this.plugin.saveAndApply();
				})
			);

		new Setting(containerEl)
			.setName("纸张式背景")
			.setDesc("深色桌面 + 一张留白圆角的笔记纸")
			.addToggle((toggle) =>
				toggle.setValue(s.paperBackground).onChange(async (value) => {
					s.paperBackground = value;
					await this.plugin.saveAndApply();
				})
			);

		new Setting(containerEl)
			.setName("纸张留白")
			.setDesc("纸张与窗口边缘的距离（px），0 表示铺满")
			.addSlider((slider) =>
				slider
					.setLimits(0, 40, 1)
					.setValue(s.pageInset)
					.setDynamicTooltip()
					.onChange(async (value) => {
						s.pageInset = value;
						await this.plugin.saveAndApply();
					})
			);

		new Setting(containerEl)
			.setName("美化滚动条")
			.setDesc("细窄、半透明的悬浮滚动条")
			.addToggle((toggle) =>
				toggle.setValue(s.stylizeScrollbar).onChange(async (value) => {
					s.stylizeScrollbar = value;
					await this.plugin.saveAndApply();
				})
			);

		new Setting(containerEl)
			.setName("侧栏配色")
			.setDesc("用幕布的侧栏底色覆盖主题侧栏；关闭则保留主题原生侧栏")
			.addToggle((toggle) =>
				toggle.setValue(s.styleSidebar).onChange(async (value) => {
					s.styleSidebar = value;
					await this.plugin.saveAndApply();
				})
			);

		/* ---------------- 编辑辅助 ---------------- */
		containerEl.createEl("h3", { text: "编辑辅助" });

		new Setting(containerEl)
			.setName("选中浮动工具栏")
			.setDesc("选中文字后在上方浮出格式栏：加粗、荧光笔、标题、待办、链接等")
			.addToggle((toggle) =>
				toggle.setValue(s.floatingToolbar).onChange(async (value) => {
					s.floatingToolbar = value;
					await this.plugin.saveAndApply();
				})
			);

		new Setting(containerEl)
			.setName("行首块菜单")
			.setDesc("鼠标移到某一行时，左侧出现「⋯」，点开可整行选取并操作")
			.addToggle((toggle) =>
				toggle.setValue(s.blockMenu).onChange(async (value) => {
					s.blockMenu = value;
					await this.plugin.saveAndApply();
				})
			);

		new Setting(containerEl)
			.setName("圆点折叠")
			.setDesc("点击列表圆点折叠/展开子项，悬停显示幕布式圆盘")
			.addToggle((toggle) =>
				toggle.setValue(s.bulletFold).onChange(async (value) => {
					s.bulletFold = value;
					await this.plugin.saveAndApply();
				})
			);

		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText("恢复默认设置")
				.setWarning()
				.onClick(async () => {
					this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
					await this.plugin.saveAndApply();
					this.display();
				})
		);

		/* ---------------- 配置文件 ---------------- */
		containerEl.createEl("h3", { text: "配置文件" });
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: `配置会写到插件目录：${this.plugin.configFilePath}`,
		});

		new Setting(containerEl)
			.setName("保存配置")
			.setDesc("把当前所有设置写入插件目录下的 mubu-style.config.json")
			.addButton((button) =>
				button
					.setButtonText("保存")
					.setCta()
					.onClick(async () => {
						await this.plugin.exportConfig();
					})
			);

		new Setting(containerEl)
			.setName("读取配置")
			.setDesc("用插件目录下的配置文件覆盖当前设置")
			.addButton((button) =>
				button.setButtonText("读取").onClick(async () => {
					if (await this.plugin.importConfig()) this.display();
				})
			);
	}

	private addColorSetting(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		key: keyof Palette
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addColorPicker((picker) =>
				picker
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						this.plugin.settings[key] = value;
						await this.plugin.saveAndApply();
					})
			);
	}
}
