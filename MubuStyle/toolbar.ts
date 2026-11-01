import { Editor, EditorPosition, MarkdownView, Notice, setIcon } from "obsidian";
import type MubuStylePlugin from "./main";

/* ------------------------------------------------------------------ *
 * 数据
 * ------------------------------------------------------------------ */

type Palette = "amber" | "rose" | "gray" | "green" | "blue" | "purple" | "teal";

const HIGHLIGHT_COLORS: Array<[Palette, string]> = [
	["amber", "#d9a94b"],
	["rose", "#d97b7b"],
	["gray", "#9a9a9a"],
	["green", "#7fb069"],
	["blue", "#6aa9d8"],
	["purple", "#a07bc8"],
	["teal", "#5fb3ad"],
];

/** 字体颜色：和幕布色条上的 6 个 A 一致 */
const TEXT_COLORS: Array<[Palette, string]> = [
	["rose", "#e05a4a"],
	["amber", "#e0a458"],
	["green", "#70c060"],
	["blue", "#60a0e0"],
	["purple", "#6f7bd6"],
	["gray", "#d5d5d8"],
];

type EmojiEntry = [char: string, name: string];

/**
 * 表情分组照幕布「添加图标」的常用 / 表情 & 人物 / 符号 / 物品 / 自然 / 数字。
 * 名字同时当中文搜索关键词用；同一个表情不在多个分组里重复，避免搜索结果重复。
 */
const EMOJI_GROUPS: Array<[string, EmojiEntry[]]> = [
	[
		"常用",
		[
			["✅", "完成 对勾 正确"],
			["❌", "错误 叉 取消"],
			["⚠️", "警告 注意"],
			["❓", "疑问 问号"],
			["❗", "感叹 重点"],
			["❤️", "爱心 喜欢"],
			["🔥", "火 热门"],
			["⭐", "星 收藏"],
			["✨", "闪光 亮点"],
			["💡", "灵感 想法"],
			["📌", "图钉 固定"],
			["📎", "附件 回形针"],
			["🔗", "链接 关联"],
			["📅", "日历 日期"],
			["🎁", "礼物"],
			["🚀", "火箭 发布 上线"],
			["🎯", "目标 靶心"],
			["🏆", "奖杯 成就"],
		],
	],
	[
		"表情 & 人物",
		[
			["😀", "笑脸 开心"],
			["😃", "开心 张嘴"],
			["😄", "大笑 眯眼"],
			["😁", "咧嘴 得意"],
			["😆", "眯眼笑"],
			["😅", "汗笑 尴尬"],
			["😂", "笑哭"],
			["🤣", "爆笑 打滚"],
			["🙂", "微笑"],
			["😉", "眨眼"],
			["😊", "害羞笑"],
			["😇", "天使 无辜"],
			["🥰", "喜爱 爱心"],
			["😍", "爱心眼 喜欢"],
			["🤩", "星星眼 惊艳"],
			["😘", "飞吻"],
			["😋", "好吃"],
			["😜", "调皮 吐舌"],
			["🤪", "搞怪"],
			["🤔", "思考 疑问"],
			["🤨", "挑眉 怀疑"],
			["😐", "无语 平静"],
			["😑", "面无表情"],
			["😶", "沉默"],
			["🙄", "翻白眼"],
			["😏", "得意 笑"],
			["😣", "难受"],
			["😥", "失望 汗"],
			["😮", "惊讶"],
			["😯", "吃惊"],
			["😪", "困"],
			["😴", "睡觉"],
			["😌", "放松"],
			["😔", "沮丧"],
			["😕", "困惑"],
			["🙃", "倒脸"],
			["🤑", "发财"],
			["😲", "震惊"],
			["😖", "痛苦"],
			["😞", "遗憾"],
			["😤", "生气 哼"],
			["😢", "流泪"],
			["😭", "大哭"],
			["😨", "害怕"],
			["😱", "惊恐"],
			["😳", "脸红"],
			["🥺", "委屈 求求"],
			["😡", "愤怒"],
			["😠", "生气"],
			["🤯", "爆炸头 震惊"],
			["😬", "尴尬"],
			["🤗", "拥抱"],
			["🤭", "偷笑"],
			["🤫", "嘘 安静"],
			["🤤", "流口水"],
		],
	],
	[
		"手势",
		[
			["👍", "赞 好"],
			["👎", "踩 不好"],
			["👌", "OK 好的"],
			["✌️", "胜利 耶"],
			["🤞", "好运"],
			["🤟", "爱你"],
			["🤘", "摇滚"],
			["🤙", "打电话"],
			["👈", "左"],
			["👉", "右"],
			["👆", "上"],
			["👇", "下"],
			["☝️", "注意 第一"],
			["✋", "举手"],
			["🤚", "停止"],
			["🖐️", "五"],
			["🖖", "瓦肯"],
			["👋", "挥手 再见"],
			["💪", "肌肉 加油"],
			["🙏", "拜托 感谢"],
			["👏", "鼓掌"],
			["🙌", "欢呼"],
			["🤝", "握手 合作"],
			["🫶", "比心"],
		],
	],
	[
		"符号",
		[
			["💯", "满分 一百"],
			["🔴", "红"],
			["🟠", "橙"],
			["🟡", "黄"],
			["🟢", "绿"],
			["🔵", "蓝"],
			["🟣", "紫"],
			["⚫", "黑"],
			["⚪", "白"],
			["🔺", "上三角"],
			["🔻", "下三角"],
			["🔶", "橙菱形"],
			["🔷", "蓝菱形"],
			["▪️", "小方块"],
			["▫️", "小白块"],
			["➕", "加"],
			["➖", "减"],
			["✔️", "勾 正确"],
			["✖️", "叉 错误"],
		],
	],
	[
		"物品",
		[
			["📝", "笔记 记录"],
			["✏️", "铅笔 编辑"],
			["📖", "书 阅读"],
			["📚", "书堆 学习"],
			["🗂️", "文件夹"],
			["📁", "文件夹"],
			["📂", "打开文件夹"],
			["🖇️", "回形针 附件"],
			["📊", "图表 数据"],
			["📈", "上升 增长"],
			["📉", "下降"],
			["🏷️", "标签"],
			["🔖", "书签"],
			["🕐", "时钟 时间"],
			["⏰", "闹钟 提醒"],
			["📆", "日历"],
			["🗓️", "日程"],
			["💻", "电脑"],
			["📱", "手机"],
			["🖥️", "显示器"],
			["⌨️", "键盘"],
			["🖱️", "鼠标"],
		],
	],
	[
		"自然",
		[
			["🌟", "星 闪亮"],
			["🌈", "彩虹"],
			["☀️", "太阳 晴"],
			["🌙", "月亮 夜晚"],
			["☁️", "云"],
			["🌸", "樱花 花"],
			["🌻", "向日葵"],
			["🍀", "四叶草 幸运"],
			["🎉", "庆祝 彩带"],
			["🎊", "彩带 庆祝"],
			["🎈", "气球"],
			["🎂", "蛋糕 生日"],
			["🍰", "甜点"],
			["☕", "咖啡"],
			["🍵", "茶"],
			["🍎", "苹果"],
			["🍋", "柠檬"],
			["🌊", "海浪"],
			["🌲", "树"],
			["🌵", "仙人掌"],
		],
	],
	[
		"数字",
		[
			["1️⃣", "一 1"],
			["2️⃣", "二 2"],
			["3️⃣", "三 3"],
			["4️⃣", "四 4"],
			["5️⃣", "五 5"],
			["6️⃣", "六 6"],
			["7️⃣", "七 7"],
			["8️⃣", "八 8"],
			["9️⃣", "九 9"],
			["🔟", "十 10"],
		],
	],
];

const ALL_EMOJIS: EmojiEntry[] = EMOJI_GROUPS.reduce<EmojiEntry[]>(
	(all, [, items]) => all.concat(items),
	[]
);

const EMOJI_RECENT_KEY = "mubu-emoji-recent-v1";

function readRecentEmojis(): string[] {
	try {
		const raw = localStorage.getItem(EMOJI_RECENT_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((value): value is string => typeof value === "string")
			.slice(0, 16);
	} catch {
		return [];
	}
}

function rememberEmoji(char: string): void {
	try {
		const recent = [char, ...readRecentEmojis().filter((item) => item !== char)].slice(
			0,
			16
		);
		localStorage.setItem(EMOJI_RECENT_KEY, JSON.stringify(recent));
	} catch {
		/* localStorage 被禁用时不影响插入 */
	}
}

/**
 * 表情选择器：搜索 + 随机 + 最近使用 + 分类网格。
 * 工具栏和行首块菜单共用，保证两处「表情 / 添加图标」是同一套内容。
 */
function buildEmojiPicker(onPick: (char: string) => void): HTMLElement {
	const panel = document.createElement("div");
	panel.className = "mubu-emoji-picker";

	const searchRow = panel.createDiv({ cls: "mubu-emoji-search-row" });
	const search = searchRow.createEl("input", {
		cls: "mubu-emoji-search",
		attr: { type: "search", placeholder: "搜索表情" },
	});
	// 输入框要能拿到焦点：不要把 mousedown 冒泡到会 preventDefault 的面板
	search.addEventListener("mousedown", (event) => event.stopPropagation());
	const random = searchRow.createEl("button", {
		cls: "mubu-emoji-random",
		text: "随机",
	});
	random.addEventListener("mousedown", (event) => event.preventDefault());

	const body = panel.createDiv({ cls: "mubu-emoji-body" });
	// 浮层在 Obsidian 的编辑器上方，滚轮有时会被底下的编辑器抢走；
	// 这里手动把滚轮作用到表情列表上，保证鼠标停在面板里就能滚动。
	body.addEventListener(
		"wheel",
		(event) => {
			const max = body.scrollHeight - body.clientHeight;
			if (max <= 0) return;
			const next = Math.max(
				0,
				Math.min(max, body.scrollTop + event.deltaY)
			);
			if (next === body.scrollTop) return;
			body.scrollTop = next;
			event.preventDefault();
			event.stopPropagation();
		},
		{ passive: false }
	);

	const pick = (char: string): void => {
		rememberEmoji(char);
		onPick(char);
	};

	const addGroup = (title: string, entries: EmojiEntry[]): void => {
		if (entries.length === 0) return;
		body.createDiv({ cls: "mubu-emoji-section-title", text: title });
		const grid = body.createDiv({ cls: "mubu-emoji-grid" });
		for (const [char, name] of entries) {
			const cell = grid.createEl("button", {
				cls: "mubu-emoji-cell",
				text: char,
				attr: { "aria-label": name, title: name },
			});
			cell.addEventListener("mousedown", (event) => event.preventDefault());
			cell.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				pick(char);
			});
		}
	};

	const render = (query: string): void => {
		body.empty();
		const q = query.trim().toLowerCase();
		if (!q) {
			const recent = readRecentEmojis();
			if (recent.length) {
				const known = new Map(ALL_EMOJIS);
				addGroup(
					"最近使用",
					recent.map((char) => [char, known.get(char) ?? char] as EmojiEntry)
				);
			}
		}

		let total = 0;
		for (const [title, entries] of EMOJI_GROUPS) {
			const filtered = q
				? entries.filter(
						([char, name]) =>
							name.toLowerCase().includes(q) || char.includes(q)
					)
				: entries;
			total += filtered.length;
			addGroup(title, filtered);
		}
		if (total === 0) {
			body.createDiv({
				cls: "mubu-emoji-empty",
				text: "没有匹配的表情",
			});
		}
	};

	search.addEventListener("input", () => render(search.value));
	random.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		const buffer = new Uint32Array(1);
		window.crypto.getRandomValues(buffer);
		const entry = ALL_EMOJIS[buffer[0] % ALL_EMOJIS.length];
		if (entry) pick(entry[0]);
	});
	render("");
	return panel;
}

interface Item {
	id: string;
	label: string;
	hint?: string;
	icon?: string;
	glyph?: string;
	/** 字形后缀（H 的 1） */
	glyphSub?: string;
	/** 字形附加样式：B / I / U / S 用真字形而不是图标 */
	glyphClass?: string;
	/** 字形当前态（标题级别） */
	active?: boolean;
	/** 按钮下方的色条（字体颜色 / 荧光笔） */
	bar?: string;
	/** 右上角小红点 */
	dot?: boolean;
	/** 荧光笔 / 字体颜色色块 */
	swatch?: string;
	/** 字体颜色：用彩色 A 而不是色块（幕布的做法） */
	fg?: string;
	/** 危险项（删除）：红色文字 + 红色 hover 底 */
	danger?: boolean;
	run?: (ctx: Ctx) => void;
	children?: Item[];
}

interface Ctx {
	plugin: MubuStylePlugin;
	editor: Editor;
}

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

function activeEditor(plugin: MubuStylePlugin): Editor | null {
	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	return view?.editor ?? null;
}

/**
 * 用编辑器自己的选区算浮层定位矩形。
 *
 * mouseup 之后 CodeMirror 有时要等下一帧才把 DOM 选区真正落下去
 * （第三方插件在 mouseup 里抢焦点/改状态时更明显），这时
 * `window.getSelection()` 还是塌缩的；但编辑器的 from/to 已经是新选区了。
 * 用 `coordsAtPos` 把两端坐标拼成矩形，浮层就不用依赖 DOM 选区的时机。
 */
function editorSelectionRect(
	editor: Editor,
	from: EditorPosition,
	to: EditorPosition
): DOMRect | null {
	const cm = (editor as unknown as {
		cm?: {
			coordsAtPos?: (pos: number) =>
				| { left: number; right: number; top: number; bottom: number }
				| null;
		};
	}).cm;
	if (!cm?.coordsAtPos) return null;
	try {
		const start = editor.posToOffset(from);
		const end = editor.posToOffset(to);
		const a = cm.coordsAtPos(start);
		const b = cm.coordsAtPos(Math.max(start, end));
		if (!a || !b) return null;
		const left = Math.min(a.left, b.left);
		const right = Math.max(a.right, b.right);
		const top = Math.min(a.top, b.top);
		const bottom = Math.max(a.bottom, b.bottom);
		return new DOMRect(
			left,
			top,
			Math.max(right - left, 1),
			Math.max(bottom - top, 1)
		);
	} catch {
		return null;
	}
}

/** 焦点是否落在别的插件的浮层/弹窗里（例如标注卡片的输入框） */
function focusInForeignOverlay(): boolean {
	const active = document.activeElement;
	if (!(active instanceof HTMLElement)) return false;
	return !!active.closest(
		".annotation-card-menu, .annotation-selection-menu, .annotation-ruby-preview, .modal-container, .prompt, .suggestion-container"
	);
}

/**
 * DOM 里只渲染视口内的行，不能拿 querySelectorAll 的下标当行号；
 * 优先用 CodeMirror 的位置 API 反查。
 */
function lineIndexOf(editor: Editor, lineEl: HTMLElement): number {
	const cm = (editor as unknown as {
		cm?: {
			posAtDOM?: (node: Node, offset?: number) => number;
			state?: { doc: { lineAt: (pos: number) => { number: number } } };
		};
	}).cm;

	if (cm?.posAtDOM && cm.state) {
		try {
			const pos = cm.posAtDOM(lineEl, 0);
			return cm.state.doc.lineAt(pos).number - 1;
		} catch {
			/* 落到下面的兜底 */
		}
	}

	const rendered = Array.from(
		lineEl.parentElement?.querySelectorAll(".cm-line") ?? []
	);
	const local = rendered.indexOf(lineEl);
	return local >= 0 ? local : -1;
}

/** 选区外面是否已经包着 prefix/suffix，是则去掉 */
function toggleWrap(editor: Editor, prefix: string, suffix: string): void {
	const sel = editor.getSelection();
	if (!sel) return;
	const from = editor.getCursor("from");
	const to = editor.getCursor("to");

	const before = editor.getRange(
		{ line: from.line, ch: Math.max(0, from.ch - prefix.length) },
		from
	);
	const after = editor.getRange(to, {
		line: to.line,
		ch: to.ch + suffix.length,
	});

	if (before === prefix && after === suffix) {
		editor.replaceRange(
			sel,
			{ line: from.line, ch: from.ch - prefix.length },
			{ line: to.line, ch: to.ch + suffix.length }
		);
		editor.setSelection(from, { line: from.line, ch: from.ch + sel.length });
		return;
	}

	if (sel.startsWith(prefix) && sel.endsWith(suffix) && sel.length > prefix.length + suffix.length) {
		const inner = sel.slice(prefix.length, sel.length - suffix.length);
		editor.replaceSelection(inner);
		return;
	}

	editor.replaceSelection(`${prefix}${sel}${suffix}`);
	editor.setSelection(
		{ line: from.line, ch: from.ch + prefix.length },
		{ line: from.line, ch: from.ch + prefix.length + sel.length }
	);
}

/** 给当前行（或选中的每一行）加前缀，替换已有的同类前缀 */
function setLinePrefix(editor: Editor, prefix: string, strip: RegExp): void {
	const from = editor.getCursor("from");
	const to = editor.getCursor("to");
	for (let line = from.line; line <= to.line; line++) {
		const text = editor.getLine(line);
		editor.setLine(line, prefix + text.replace(strip, ""));
	}
}

/** 高亮：默认用 Obsidian 原生的 ==，彩色用内联 <mark>（可能被消毒器丢 class） */
function applyHighlight(editor: Editor, color: Palette | "none"): void {
	if (color === "none") {
		const sel = editor.getSelection();
		if (!sel) return;
		const cleaned = sel
			.replace(/<\/?mark[^>]*>/g, "")
			.replace(/^==|==$/g, "");
		if (cleaned !== sel) editor.replaceSelection(cleaned);
		return;
	}
	const open = `<mark class="mubu-hl mubu-hl-${color}">`;
	if (editor.getCursor("from").line !== editor.getCursor("to").line) {
		wrapPerLine(editor, open, "</mark>");
		return;
	}
	toggleWrap(editor, open, "</mark>");
}

/**
 * 跨行选择时逐个"段"包标记：一个 span/mark 跨过空行会被 Obsidian
 * 当成行内 HTML，把前后几段并成一段，所以必须一行一包。
 */
function wrapPerLine(editor: Editor, open: string, close: string): void {
	const from = editor.getCursor("from");
	const to = editor.getCursor("to");
	for (let line = from.line; line <= to.line; line++) {
		const text = editor.getLine(line);
		const start = line === from.line ? from.ch : 0;
		const end = line === to.line ? to.ch : text.length;
		const inner = text.slice(start, end);
		if (!inner.trim()) continue;
		editor.setLine(
			line,
			text.slice(0, start) + open + inner + close + text.slice(end)
		);
	}
}

/** 字体颜色：用 <span class="mubu-fg-*">，实时预览与阅读视图都能上色 */
function applyTextColor(editor: Editor, color: Palette | "none"): void {
	if (color === "none") {
		const sel = editor.getSelection();
		if (!sel) return;
		const cleaned = sel.replace(/<\/?span[^>]*>/g, "");
		if (cleaned !== sel) editor.replaceSelection(cleaned);
		return;
	}
	const open = `<span class="mubu-fg-${color}">`;
	if (editor.getCursor("from").line !== editor.getCursor("to").line) {
		wrapPerLine(editor, open, "</span>");
		return;
	}
	toggleWrap(editor, open, "</span>");
}

/** 图片 / 表格这类块级插入 */
function insertBlock(editor: Editor, text: string): void {
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
	const atLineStart = cursor.ch === 0;
	const needBefore = line.length > 0 && !atLineStart ? "\n" : "";
	editor.replaceSelection(`${needBefore}${text}\n`);
}

/* ------------------------------------------------------------------ *
 * 圆点折叠（原生 .collapse-indicator 的薄封装）
 * ------------------------------------------------------------------ */

/** 实时预览：某一行 DOM 的原生折叠箭头 */
function liveFoldIndicator(line: HTMLElement): HTMLElement | null {
	return line.querySelector<HTMLElement>(
		".cm-fold-indicator .collapse-indicator"
	);
}

/**
 * 阅读视图：圆点所属 li 自己的折叠箭头。
 * li 里还嵌着子列表，必须排除子项的箭头，否则会折叠错层级。
 */
function readingFoldIndicator(bullet: HTMLElement): HTMLElement | null {
	const li = bullet.closest("li");
	if (!li) return null;
	const indicators = Array.from(
		li.querySelectorAll<HTMLElement>(".list-collapse-indicator")
	);
	for (const indicator of indicators) {
		if (indicator.closest("li") === li) return indicator;
	}
	return null;
}

/**
 * 点圆点折叠：优先走原生箭头。
 * 找不到箭头时返回 false，保留 Obsidian 自己的行为，不硬造折叠。
 */
function toggleFoldFromBullet(bullet: HTMLElement): boolean {
	const line = bullet.closest<HTMLElement>(".cm-line");
	if (line) {
		const indicator = liveFoldIndicator(line);
		if (indicator) {
			indicator.click();
			return true;
		}
	}
	const indicator = readingFoldIndicator(bullet);
	if (indicator) {
		indicator.click();
		return true;
	}
	return false;
}

/** 行首菜单的「折叠/展开子主题」：先点原生箭头，实在没有再走编辑器命令 */
function toggleFoldLine(line: HTMLElement | null, editor: Editor): boolean {
	if (line) {
		const indicator = liveFoldIndicator(line);
		if (indicator) {
			indicator.click();
			return true;
		}
	}
	try {
		editor.exec("toggleFold");
		return true;
	} catch {
		return false;
	}
}

/* ------------------------------------------------------------------ *
 * 当前格式探测
 * ------------------------------------------------------------------ */

/**
 * 彩色高亮 / 字体颜色 的标签比 4 字符探针长得多
 * （`<mark class="mubu-hl mubu-hl-amber">`、`<span class="mubu-fg-green">`），
 * 这里单独扫一段宽窗口：跟踪最后一个还没闭合的标签，再看选区后面有没有闭合，
 * 避免把上一段已经结束的样式算进当前选区。
 */
function scanInlineTags(
	before: string,
	selection: string,
	after: string
): { highlight: boolean; color: Palette | null } {
	const text = `${before}${selection}${after}`;
	const end = before.length + selection.length;
	const re =
		/<mark[^>]*class="[^"]*mubu-hl[^"]*"[^>]*>|<\/mark>|<span[^>]*class="[^"]*mubu-fg-(\w+)[^"]*"[^>]*>|<\/span>/g;

	let mark = false;
	let color: Palette | null = null;
	let match: RegExpExecArray | null;

	while ((match = re.exec(text))) {
		if (match.index >= end) break;
		const tag = match[0];
		if (tag.startsWith("</mark>")) {
			mark = false;
		} else if (tag.startsWith("<mark")) {
			mark = true;
		} else if (tag.startsWith("</span>")) {
			color = null;
		} else {
			const id = match[1] as Palette;
			color = TEXT_COLORS.some(([name]) => name === id) ? id : null;
		}
	}

	const tail = text.slice(end);
	// 左边开着的标签必须在右边闭合，否则说明它是上一段已经结束的样式
	if (mark && !tail.includes("</mark>") && !selection.includes("</mark>")) {
		mark = false;
	}
	if (color && !tail.includes("</span>") && !selection.includes("</span>")) {
		color = null;
	}

	// 选区本身包含完整标签（用户选中了整段源码）
	if (!mark && /<mark[^>]*class="[^"]*mubu-hl/.test(selection)) mark = true;
	if (!color) {
		const hit = selection.match(
			/<span[^>]*class="[^"]*mubu-fg-(\w+)[^"]*"[^>]*>/
		);
		if (hit) {
			const id = hit[1] as Palette;
			if (TEXT_COLORS.some(([name]) => name === id)) color = id;
		}
	}

	return { highlight: mark, color };
}

/* ------------------------------------------------------------------ *
 * 工具栏
 * ------------------------------------------------------------------ */

export class MubuToolbar {
	/** 外层浮层：单行图标横栏（幕布 6.1.0 / 设计稿都是单行） */
	private root: HTMLElement;
	private bar: HTMLElement;
	/** 多选（跨行）时换成幕布那种竖排菜单 */
	private panel: HTMLElement;
	private sub: HTMLElement | null = null;
	private subTimer = 0;
	private menu: HTMLElement | null = null;
	private menuTimer = 0;
	private menuCloseTimer = 0;
	private tip: HTMLElement | null = null;
	private timer = 0;
	private openMenuFor: string | null = null;
	/** 打开工具栏时的选区，菜单里要防丢焦点兜底 */
	private savedRange: { from: EditorPosition; to: EditorPosition } | null = null;

	/** 最近一次 mouseup 的指针位置：决定浮层放在选区上方还是下方 */
	private lastPointer: { x: number; y: number } | null = null;
	/** 这次是不是键盘改的选区（是则 left/top 走 200ms 滑动） */
	private keyboardMove = false;
	private keyTimer = 0;
	private moveTimer = 0;
	/** mouseup 之后补跑几帧 update：CodeMirror 落选区的时机不稳定 */
	private retryTimer = 0;
	private selectionTimer = 0;
	/** 最近一次 mouseup 的时间：滚动守卫用（滚轮/滚动的收起别误伤刚做完的选区） */
	private lastMouseUpAt = 0;
	/** 指针是否按着（拖选过程中不要被 selectionchange 反复重排） */
	private pointerDown = false;
	/** 浮条是否已经播过入场动画 */
	private openOnce = false;
	/** 显示代数：切换单行/跨行时作废还没执行的入场帧 */
	private showToken = 0;
	/** 顶栏按钮表：id → 按钮，用来同步 .is-active */
	private buttons = new Map<string, HTMLElement>();

	constructor(private plugin: MubuStylePlugin) {
		this.root = document.createElement("div");
		this.root.className = "mubu-toolbar";
		this.root.setAttribute("data-mubu", "toolbar");

		this.bar = this.root.createDiv({ cls: "mubu-bar" });
		document.body.appendChild(this.root);

		this.panel = document.createElement("div");
		this.panel.className = "mubu-multi-menu";
		this.panel.addEventListener("mousedown", (event) => event.preventDefault());
		document.body.appendChild(this.panel);

		// 点按钮时别让编辑器丢焦点/丢选区
		this.root.addEventListener("mousedown", (event) => event.preventDefault());
		this.panel.addEventListener("mousemove", () => {
			window.clearTimeout(this.subTimer);
		});
		this.panel.addEventListener("mouseleave", () => this.closeSubLater());

		this.render();
		this.bindEvents();
	}

	/* ---------------- 事件 ---------------- */

	private bindEvents(): void {
		// 只在"选择完成"之后弹出：mouseup / keyup；
		// 拖选过程中不弹，避免卡顿
		document.addEventListener("mouseup", this.onMouseUp);
		document.addEventListener("keyup", this.onKeyUp);
		document.addEventListener("selectionchange", this.onSelectionChange);
		document.addEventListener("mousedown", this.onDocMouseDown, true);
		document.addEventListener("keydown", this.onKeyDown, true);
		window.addEventListener("scroll", this.onWindowScroll, true);
		window.addEventListener("resize", this.hide);
		// 表情列表的滚轮要在 Obsidian 的捕获阶段之前处理，
		// 否则滚轮会去滚底下的编辑器
		window.addEventListener("wheel", this.onEmojiWheel, {
			capture: true,
			passive: false,
		});
	}

	destroy(): void {
		document.removeEventListener("mouseup", this.onMouseUp);
		document.removeEventListener("keyup", this.onKeyUp);
		document.removeEventListener("selectionchange", this.onSelectionChange);
		document.removeEventListener("mousedown", this.onDocMouseDown, true);
		document.removeEventListener("keydown", this.onKeyDown, true);
		window.removeEventListener("scroll", this.onWindowScroll, true);
		window.removeEventListener("resize", this.hide);
		window.removeEventListener("wheel", this.onEmojiWheel, true);
		window.clearTimeout(this.keyTimer);
		window.clearTimeout(this.moveTimer);
		window.clearTimeout(this.menuTimer);
		window.clearTimeout(this.menuCloseTimer);
		window.clearTimeout(this.retryTimer);
		window.clearTimeout(this.selectionTimer);
		this.root.remove();
		this.panel.remove();
		this.closeSubNow();
		this.closeMenu();
		this.tip?.remove();
	}

	private onMouseUp = (event: MouseEvent): void => {
		this.pointerDown = false;
		const target = event.target as HTMLElement;
		if (
			target.closest(
				".mubu-toolbar, .mubu-tb-menu, .mubu-block-menu, .mubu-block-menu-sub, .mubu-block-handle, .mubu-multi-menu, .mubu-multi-sub"
			)
		)
			return;
		// 幕布按「鼠标更靠近选区的哪一半」决定浮层放上边还是下边
		this.lastPointer = { x: event.clientX, y: event.clientY };
		this.keyboardMove = false;
		this.lastMouseUpAt = Date.now();
		this.scheduleUpdate();
	};

	/**
	 * mouseup 之后多补几帧：
	 * CodeMirror 有时在 mouseup 之后才把 DOM 选区落到文档上，
	 * 第三方插件（如 Annotation Marker）在 mouseup 里抢焦点更会拖慢这一拍。
	 * 只跑一次 setTimeout(0) 会在选区还没落地时误判成"没有选区"而收起。
	 */
	private scheduleUpdate(): void {
		window.clearTimeout(this.retryTimer);
		window.clearTimeout(this.selectionTimer);
		window.setTimeout(() => this.update(), 0);
		window.requestAnimationFrame(() => this.update());
		this.retryTimer = window.setTimeout(() => this.update(), 70);
	}

	private onKeyUp = (event: KeyboardEvent): void => {
		if (event.key === "Escape") return;
		// 表情面板打开时不要因为焦点变化/输入把工具栏收掉
		if (this.openMenuFor === "emoji" && this.menu) return;
		// 在表情搜索框里打字：不要让 keyup 把工具栏收掉
		if (this.isEmojiSearchFocused()) return;
		// 键盘改选区：没有指针位置，浮层默认放下方，并用 200ms 滑过去
		this.lastPointer = null;
		this.keyboardMove = true;
		window.clearTimeout(this.keyTimer);
		this.keyTimer = window.setTimeout(() => {
			this.keyboardMove = false;
		}, 260);
		window.setTimeout(() => this.update(), 0);
		window.requestAnimationFrame(() => this.update());
	};

	/** 表情面板的搜索框是否持有焦点（输入时 DOM 选区会塌缩） */
	private isEmojiSearchFocused(): boolean {
		const active = document.activeElement;
		return (
			this.openMenuFor === "emoji" &&
			active instanceof HTMLElement &&
			!!active.closest(".mubu-emoji-picker")
		);
	}

	/** 编辑器滚动时收起浮层；但表情面板打开时不要被列表滚动/页面滚动收掉 */
	private onWindowScroll = (event: Event): void => {
		if (
			this.openMenuFor === "emoji" &&
			this.menu?.querySelector(".mubu-emoji-body")
		) {
			return;
		}
		const target = event.target;
		if (target instanceof HTMLElement && target.closest(".mubu-emoji-body")) {
			return;
		}
		// 刚选完字时 CodeMirror 会把选区滚进视口，这一下滚动不该把浮层收掉
		if (Date.now() - this.lastMouseUpAt < 160) return;
		this.hide();
	};

	/**
	 * 捕获阶段的滚轮守卫：鼠标在表情列表上时，滚动只作用于列表，
	 * 不再去滚背后的编辑器。Obsidian 自己的滚轮处理也在这个阶段，
	 * 所以必须 stopImmediatePropagation。
	 */
	private onEmojiWheel = (event: WheelEvent): void => {
		if (this.openMenuFor !== "emoji" || !this.menu) return;
		const body = this.menu.querySelector<HTMLElement>(".mubu-emoji-body");
		if (!body) return;

		const target = event.target;
		const targetInside =
			target instanceof Node && body.contains(target);
		const rect = body.getBoundingClientRect();
		const pointerInside =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;
		if (!targetInside && !pointerInside) return;

		const max = body.scrollHeight - body.clientHeight;
		if (max <= 0) return;
		const next = Math.max(0, Math.min(max, body.scrollTop + event.deltaY));
		body.scrollTop = next;
		event.preventDefault();
		event.stopImmediatePropagation();
	};

	/**
	 * 选区消失就收起；弹出交给 mouseup / keyup。
	 *
	 * 不能一塌缩就立刻收：Obsidian 自己、以及第三方插件（标注卡片、
	 * 命令面板等）会把焦点抢走，DOM 选区会短暂塌缩，下一帧又回来。
	 * 这里等 140ms 再确认，并且只要编辑器里还留着选区就不收。
	 */
	private onSelectionChange = (): void => {
		const selection = window.getSelection();
		if (selection && !selection.isCollapsed) {
			window.clearTimeout(this.selectionTimer);
			// 拖选过程中不重排；松手后 DOM 选区如果晚一拍才落地，
			// 这一下 selectionchange 正好把浮层补出来（第三方插件更会拖慢）
			if (!this.pointerDown && Date.now() - this.lastMouseUpAt < 600) {
				const node = selection.rangeCount ? selection.getRangeAt(0).commonAncestorContainer : null;
				const element =
					node?.nodeType === Node.ELEMENT_NODE
						? (node as HTMLElement)
						: node?.parentElement ?? null;
				if (element?.closest(".cm-content")) {
					this.selectionTimer = window.setTimeout(() => this.update(), 16);
				}
			}
			return;
		}
		// 点表情滚动条时编辑器会失焦、DOM 选区会塌缩；这时面板必须留着
		if (this.openMenuFor === "emoji" && this.menu) return;
		if (this.isEmojiSearchFocused()) return;
		if (focusInForeignOverlay()) return;

		window.clearTimeout(this.selectionTimer);
		this.selectionTimer = window.setTimeout(() => {
			const now = window.getSelection();
			if (now && !now.isCollapsed) return;
			if (this.openMenuFor === "emoji" && this.menu) return;
			if (focusInForeignOverlay()) return;
			// 焦点被别的插件抢走时 DOM 选区会塌缩，但编辑器自己还记着选区
			if (activeEditor(this.plugin)?.getSelection()) return;
			this.hide();
		}, 140);
	};

	private onDocMouseDown = (event: MouseEvent): void => {
		const target = event.target as HTMLElement;
		this.pointerDown = true;
		if (target.closest(".mubu-toolbar")) return;
		// 子菜单/提示条也是"工具栏的一部分"，否则 mousedown 会先把菜单拆掉，
		// 按钮上的 click 永远等不到
		if (target.closest(".mubu-tb-menu")) return;
		if (target.closest(".mubu-tooltip")) return;
		if (target.closest(".mubu-multi-menu")) return;
		if (target.closest(".mubu-multi-sub")) return;
		// 行首块菜单/把手是另一套 UI：点它时把悬浮栏收起来
		this.hide();
	};

	private onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") {
			this.hide();
			this.closeMenu();
		}
	};

	/* ---------------- 显示 / 隐藏 ---------------- */

	private update(): void {
		if (!this.plugin.settings.floatingToolbar) return this.hide();

		const editor = activeEditor(this.plugin);
		if (!editor) return this.hide();

		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		const editorRange = editor.getSelection();

		const selection = window.getSelection();
		let rect: DOMRect | null = null;
		if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);
			const node = range.commonAncestorContainer;
			const element =
				node.nodeType === Node.ELEMENT_NODE
					? (node as HTMLElement)
					: node.parentElement;
			// DOM 选区不在正文里（在弹窗/侧栏里选的）就别把浮层挂到编辑器上
			if (!element?.closest(".cm-content")) return this.hide();
			rect = range.getBoundingClientRect();
		} else if (!editorRange) {
			return this.hide();
		}

		// 记住选区：点菜单时编辑器可能失焦，动作执行前用它兜底
		this.savedRange = { from, to };

		// DOM 选区还没落地（塌缩）但编辑器已有选区：按编辑器的坐标定位
		if (!rect) rect = editorSelectionRect(editor, from, to);
		if (!rect || (rect.width === 0 && rect.height === 0)) return this.hide();

		// 幕布：选中单行里的文字 → 图标横栏；跨行（多个主题）→ 竖排菜单
		if (from.line === to.line) {
			this.showSingle(rect);
		} else {
			this.showMulti(rect, editor, from.line, to.line);
		}

		this.syncActive(editor);
	}

	private showSingle(rect: DOMRect): void {
		const root = this.root;
		const wasOpen = root.classList.contains("is-open");

		this.closeSubNow();
		this.hideTip();
		this.panel.classList.remove("is-open", "is-moving");
		this.closeMenu();

		// 重新定位时只滑不重新入场：先量尺寸（隐藏状态下也能量到）
		if (!wasOpen) {
			root.classList.remove("is-moving");
			root.style.left = "-9999px";
			root.style.top = "-9999px";
		}

		const width = root.offsetWidth;
		const height = root.offsetHeight;
		const pointer = this.lastPointer;

		// 幕布规则：鼠标更靠近选区顶部 → 浮层放选区下方（不挡鼠标）；
		// 更靠近底部 → 放上方；键盘操作没有指针，默认下方
		const below = pointer
			? Math.abs(pointer.y - rect.top) - 12 <
				Math.abs(pointer.y - rect.bottom)
			: true;

		let top = below ? rect.bottom + 8 : rect.top - height - 8;
		// 越界就翻到另一侧
		if (top + height > window.innerHeight - 8) top = rect.top - height - 8;
		if (top < 8) top = rect.bottom + 8;

		let left = rect.left + rect.width / 2 - width / 2;
		left = Math.max(8, Math.min(window.innerWidth - width - 8, left));

		if (wasOpen && this.keyboardMove) {
			// 键盘改选区：left/top 走 200ms 过渡，滑到新位置
			root.addClass("is-moving");
			window.clearTimeout(this.moveTimer);
			this.moveTimer = window.setTimeout(
				() => root.classList.remove("is-moving"),
				240
			);
		} else if (!this.keyboardMove) {
			// 鼠标拖选/点击：瞬间跳位，不留拖影
			root.classList.remove("is-moving");
		}

		root.style.left = `${Math.round(left)}px`;
		root.style.top = `${Math.round(top)}px`;

		if (!wasOpen) {
			this.openOnce = true;
			const token = ++this.showToken;
			// 强制一帧，让 60ms 的 opacity + scale 入场过渡真的播出来
			void root.offsetWidth;
			window.requestAnimationFrame(() => {
				if (token === this.showToken && this.openOnce) {
					root.classList.add("is-open");
				}
			});
		}
	}

	private showMulti(
		rect: DOMRect,
		editor: Editor,
		fromLine: number,
		toLine: number
	): void {
		const panel = this.panel;
		const wasOpen = panel.classList.contains("is-open");

		this.root.classList.remove("is-open");
		this.openOnce = false;
		this.closeSubNow();
		this.hideTip();
		this.closeMenu();

		if (!wasOpen) {
			panel.style.left = "-9999px";
			panel.style.top = "-9999px";
		}

		this.renderMulti(editor, fromLine, toLine);

		const width = panel.offsetWidth;
		const height = panel.offsetHeight;

		// 幕布把菜单贴在选区右侧，右边放不下就翻到左侧
		let left = rect.right + 12;
		if (left + width > window.innerWidth - 8) left = rect.left - width - 12;
		left = Math.max(8, Math.min(window.innerWidth - width - 8, left));

		const top = Math.max(
			8,
			Math.min(window.innerHeight - height - 12, rect.top - 6)
		);

		if (wasOpen && this.keyboardMove) {
			panel.addClass("is-moving");
			window.clearTimeout(this.moveTimer);
			this.moveTimer = window.setTimeout(
				() => panel.classList.remove("is-moving"),
				240
			);
		} else if (!this.keyboardMove) {
			panel.classList.remove("is-moving");
		}

		panel.style.left = `${Math.round(left)}px`;
		panel.style.top = `${Math.round(top)}px`;

		if (!wasOpen) {
			const token = ++this.showToken;
			void panel.offsetWidth;
			window.requestAnimationFrame(() => {
				if (token === this.showToken) panel.classList.add("is-open");
			});
		}
	}

	/* ---------------- 多选竖排菜单 ---------------- */

	private renderMulti(editor: Editor, fromLine: number, toLine: number): void {
		this.panel.empty();

		// 当前标题级别：命中的那个字母用强调色
		const first = editor.getLine(fromLine);
		const hashes = first.match(/^#{1,6}\s/);
		const level = hashes ? hashes[0].trim().length : 0;

		const heads = this.panel.createDiv({
			cls: "mubu-multi-row mubu-multi-heads",
		});
		for (const [id, label, lv] of [
			["h1", "1", 1],
			["h2", "2", 2],
			["h3", "3", 3],
			["h0", "", 0],
		] as Array<[string, string, number]>) {
			const button = heads.createEl("button", {
				cls: "mubu-multi-h",
			});
			if (lv === level) button.addClass("is-active");
			button.createSpan({ cls: "mubu-tb-glyph", text: id === "h0" ? "T" : "H" });
			if (label) button.createSpan({ cls: "mubu-tb-sub", text: label });
			button.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.runId(id);
				this.hide();
			});
		}

		const fmts = this.panel.createDiv({
			cls: "mubu-multi-row mubu-multi-fmts",
		});
		for (const [id, glyph, cls] of [
			["bold", "B", "is-bold"],
			["italic", "I", "is-italic"],
			["underline", "U", "is-underline"],
			["strike", "S", "is-strike"],
		] as Array<[string, string, string]>) {
			const button = fmts.createEl("button", {
				cls: "mubu-multi-h",
			});
			button.createSpan({ cls: `mubu-tb-glyph ${cls}`, text: glyph });
			button.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.runId(id);
				this.hide();
			});
		}

		this.panel.createDiv({ cls: "mubu-multi-sep" });

		const colorItems: Item[] = TEXT_COLORS.map(([id, color]) => ({
			id: `fg-${id}`,
			label: "字体颜色",
			fg: color,
			run: ({ editor: ed }) => applyTextColor(ed, id),
		}));
		colorItems.push({
			id: "fg-none",
			label: "默认颜色",
			fg: "#d5d5d8",
			run: ({ editor: ed }) => applyTextColor(ed, "none"),
		});

		const hlItems: Item[] = HIGHLIGHT_COLORS.map(([id, color]) => ({
			id: `hl-${id}`,
			label: "荧光笔",
			swatch: color,
			run: ({ editor: ed }) => applyHighlight(ed, id),
		}));
		hlItems.push({
			id: "hl-none",
			label: "清除高亮",
			swatch: "none",
			run: ({ editor: ed }) => applyHighlight(ed, "none"),
		});

		const rows: Array<{
			id: string;
			label: string;
			icon?: string;
			glyph?: string;
			bar?: string;
			danger?: boolean;
			sub?: Item[];
		}> = [
			{ id: "textcolor", label: "字体颜色", glyph: "A", bar: "#e05a4a", sub: colorItems },
			{ id: "highlight", label: "荧光笔", icon: "highlighter", bar: "#e8d44d", sub: hlItems },
			{ id: "todo", label: "添加待办", icon: "check-square" },
			{ id: "ordered", label: "添加编号", icon: "list-ordered" },
			{ id: "copy", label: "复制", icon: "copy" },
			{ id: "delete", label: "删除", icon: "trash-2", danger: true },
		];

		for (const row of rows) {
			const button = this.panel.createEl("button", {
				cls: "mubu-multi-item",
			});
			if (row.danger) button.addClass("is-danger");

			if (row.glyph) {
				button.createSpan({
					cls: "mubu-tb-glyph mubu-multi-glyph",
					text: row.glyph,
				});
				if (row.bar) {
					button.addClass("has-bar");
					button.style.setProperty("--mubu-bar", row.bar);
				}
			} else if (row.icon) {
				const icon = button.createSpan({ cls: "mubu-tb-icon" });
				setIcon(icon, row.icon);
				if (row.bar) icon.addClass("has-bar");
			}

			button.createSpan({ cls: "mubu-multi-label", text: row.label });

			if (row.sub) {
				button.createSpan({ cls: "mubu-multi-chevron", text: "›" });
				button.addEventListener("mouseenter", () =>
					this.openSub(button, row.sub as Item[])
				);
				button.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					this.openSub(button, row.sub as Item[]);
				});
			} else {
				button.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					this.runId(row.id);
					this.hide();
				});
			}
		}

		this.panel.createDiv({ cls: "mubu-multi-sep" });

		const footer = this.panel.createDiv({ cls: "mubu-multi-footer" });
		const text = editor.getLine(fromLine) + "";
		void text;
		footer.setText(`选中 ${toLine - fromLine + 1} 行 · ${this.selectionLength()} 字`);
	}

	private selectionLength(): number {
		const editor = activeEditor(this.plugin);
		if (!editor) return 0;
		return editor.getSelection().length;
	}

	private openSub(anchor: HTMLElement, items: Item[]): void {
		window.clearTimeout(this.subTimer);
		this.sub?.remove();
		this.sub = null;

		const isSwatches = items.some((item) => item.swatch || item.fg);
		const sub = document.createElement("div");
		sub.className = "mubu-multi-sub";
		if (isSwatches) sub.addClass("is-swatches");
		sub.addEventListener("mousedown", (event) => event.preventDefault());
		sub.addEventListener("mouseenter", () => window.clearTimeout(this.subTimer));

		for (const child of items) {
			const row = sub.createEl("button", {
				cls: "mubu-tb-menu-item",
			});
			if (child.fg) {
				const a = row.createSpan({ cls: "mubu-menu-a", text: "A" });
				a.style.color = child.fg;
			} else if (child.swatch) {
				if (child.swatch === "none") {
					row.createDiv({ cls: "mubu-swatch is-none" });
				} else {
					const swatch = row.createDiv({ cls: "mubu-swatch" });
					swatch.style.background = child.swatch;
				}
			} else {
				if (child.glyph) {
					row.createSpan({ cls: "mubu-tb-glyph", text: child.glyph });
				} else if (child.icon) {
					const icon = row.createSpan({ cls: "mubu-tb-icon" });
					setIcon(icon, child.icon);
				}
				row.createSpan({ cls: "mubu-tb-menu-label", text: child.label });
			}
			row.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.runItem(child);
				this.hide();
			});
		}

		document.body.appendChild(sub);
		this.sub = sub;

		const rect = anchor.getBoundingClientRect();
		const width = sub.offsetWidth;
		let left = rect.right + 4;
		if (left + width > window.innerWidth - 8) left = rect.left - width - 4;
		const top = Math.max(
			8,
			Math.min(window.innerHeight - sub.offsetHeight - 12, rect.top - 4)
		);
		sub.style.left = `${Math.round(left)}px`;
		sub.style.top = `${Math.round(top)}px`;
		void sub.offsetWidth;
		sub.addClass("is-open");
	}

	private closeSubNow(): void {
		window.clearTimeout(this.subTimer);
		this.sub?.remove();
		this.sub = null;
	}

	private closeSubLater(): void {
		window.clearTimeout(this.subTimer);
		this.subTimer = window.setTimeout(() => this.closeSubNow(), 160);
	}

	private runId(id: string): void {
		this.runItem({ id, label: id });
	}

	hide = (): void => {
		this.openOnce = false;
		this.showToken++;
		this.root.classList.remove("is-open", "is-moving");
		this.panel.classList.remove("is-open", "is-moving");
		window.clearTimeout(this.moveTimer);
		this.closeSubNow();
		this.closeMenu();
		this.hideTip();
	};

	/* ---------------- 渲染 ---------------- */

	private items(): Item[] {
		const heading: Item = {
			id: "heading",
			label: "标题",
			hint: "Ctrl+1/2/3",
			glyph: "H",
			glyphSub: "1",
			children: [
				{ id: "h1", label: "一级标题", hint: "Ctrl+1", glyph: "H1" },
				{ id: "h2", label: "二级标题", hint: "Ctrl+2", glyph: "H2" },
				{ id: "h3", label: "三级标题", hint: "Ctrl+3", glyph: "H3" },
				{ id: "h0", label: "正文", hint: "Ctrl+0", glyph: "T" },
			],
		};

		const highlight: Item = {
			id: "highlight",
			label: "荧光笔",
			bar: "#e8d44d",
			icon: "highlighter",
			children: [
				...HIGHLIGHT_COLORS.map<Item>(([id, color]) => ({
					id: `hl-${id}`,
					label: "彩色高亮",
					swatch: color,
					run: ({ editor }) => applyHighlight(editor, id),
				})),
				{
					id: "hl-none",
					label: "清除高亮",
					swatch: "none",
					run: ({ editor }) => applyHighlight(editor, "none"),
				},
			],
		};

		const textcolor: Item = {
			id: "textcolor",
			label: "字体颜色",
			glyph: "A",
			bar: "#e05a4a",
			children: [
				...TEXT_COLORS.map<Item>(([id, color]) => ({
					id: `fg-${id}`,
					label: "文字颜色",
					fg: color,
					run: ({ editor }) => applyTextColor(editor, id),
				})),
				{
					id: "fg-none",
					label: "默认颜色",
					fg: "#d5d5d8",
					run: ({ editor }) => applyTextColor(editor, "none"),
				},
			],
		};

		const emoji: Item = {
			id: "emoji",
			label: "表情",
			icon: "smile",
			// 真正的面板由 openEmojiMenu 动态生成（搜索 / 随机 / 最近 / 分类）
			children: [],
		};

		// 按幕布 6.1.0 的「更多」菜单：建立关联 / 复制 / 清除格式 / 删除
		const more: Item = {
			id: "more",
			label: "更多",
			icon: "more-horizontal",
			children: [
				{ id: "copy", label: "复制", hint: "Ctrl+C", icon: "copy" },
				{ id: "sep" } as Item,
				{ id: "clear", label: "清除格式", icon: "eraser" },
				{ id: "sep" } as Item,
				{ id: "delete", label: "删除", icon: "trash-2", danger: true },
			],
		};

		// 单行，顺序照幕布 6.1.0 / 设计稿：
		// B I U S | 荧光笔 字体颜色 H1 | 待办 表情 列表 图片 表格 | 链接 建立关联 代码 ···
		return [
			{ id: "bold", label: "加粗", hint: "Ctrl+B", glyph: "B", glyphClass: "is-bold" },
			{ id: "italic", label: "斜体", hint: "Ctrl+I", glyph: "I", glyphClass: "is-italic" },
			{ id: "underline", label: "下划线", hint: "Ctrl+U", glyph: "U", glyphClass: "is-underline" },
			{ id: "strike", label: "删除线", hint: "Ctrl+Shift+X", glyph: "S", glyphClass: "is-strike" },
			{ id: "sep" } as Item,
			highlight,
			textcolor,
			heading,
			{ id: "sep" } as Item,
			{ id: "todo", label: "待办", icon: "check-square" },
			emoji,
			{ id: "bullet", label: "无序列表", icon: "list" },
			{ id: "image", label: "图片", icon: "image" },
			{ id: "table", label: "表格", icon: "table" },
			{ id: "sep" } as Item,
			{ id: "link", label: "链接", hint: "Ctrl+K", icon: "link" },
			{ id: "relation", label: "建立关联", icon: "link-2" },
			{ id: "code", label: "行内代码", hint: "Ctrl+E", icon: "code" },
			more,
		];
	}

	private render(): void {
		this.bar.empty();
		this.buttons.clear();
		for (const item of this.items()) {
			if (item.id === "sep") {
				this.bar.createDiv({ cls: "mubu-tb-sep" });
				continue;
			}
			const button = this.bar.createEl("button", {
				cls: "mubu-tb-btn",
				// 有子菜单的不挂 aria-label，否则 Obsidian 会再弹一个原生 tooltip 压住色板
				attr: item.children ? {} : { "aria-label": item.label },
			});
			button.dataset.id = item.id;
			this.buttons.set(item.id, button);

			if (item.glyph) {
				button.createSpan({
					cls: `mubu-tb-glyph ${item.glyphClass ?? ""}`.trim(),
					text: item.glyph,
				});
				if (item.glyphSub) {
					button.createSpan({ cls: "mubu-tb-sub", text: item.glyphSub });
				}
			} else if (item.icon) {
				const icon = button.createSpan({ cls: "mubu-tb-icon" });
				setIcon(icon, item.icon);
			}

			if (item.bar) {
				button.addClass("has-bar");
				button.style.setProperty("--mubu-bar", item.bar);
			}
			if (item.dot) button.createDiv({ cls: "mubu-dot" });
			if (item.children) button.addClass("has-children");

			// 幕布的做法：鼠标停一下就展开内部的颜色 / 标题级别
			button.addEventListener("mouseenter", () => {
				if (!item.children) this.showTip(button, item);
				else this.scheduleMenu(item, button);
			});
			button.addEventListener("mouseleave", () => {
				this.hideTip();
				if (item.children) this.scheduleMenuClose();
			});
			button.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				if (item.children) {
					// 悬停已经展开时再点一下不要把它关掉：
					// 用户从按钮移向菜单的过程中很容易点到按钮
					if (this.openMenuFor !== item.id) this.openMenu(item, button);
				} else {
					this.runItem(item);
					this.hide();
				}
			});
		}
	}

	/** 选区被菜单/失焦弄丢时恢复 */
	private restoreSelection(editor: Editor): void {
		if (editor.getSelection()) return;
		if (this.savedRange) {
			editor.setSelection(this.savedRange.from, this.savedRange.to);
		}
	}

	/**
	 * 同步按钮的当前态：选中文字已经带 ** * ~~ <u> ` == 或 mubu-hl / mubu-fg 时，
	 * 对应按钮加 .is-active；标题按钮显示当前级别。
	 * 轻量实现：先看选区文本里的标记，再看选区两端的 DOM（实时预览把标记渲染成样式时）。
	 */
	private syncActive(editor: Editor): void {
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		const selection = editor.getSelection();
		const lineText = editor.getLine(from.line) ?? "";
		const tailText = editor.getLine(to.line) ?? "";

		// 探针：选区 + 两侧各 4 个字符，能覆盖 **粗体** 这种把选区夹在中间的情况
		const before = lineText.slice(Math.max(0, from.ch - 4), from.ch);
		const after = tailText.slice(to.ch, to.ch + 4);
		const probe = `${before}${selection}${after}`;

		// 彩色高亮 / 字体颜色是长标签，单独用宽窗口扫
		const wideBefore = lineText.slice(Math.max(0, from.ch - 64), from.ch);
		const wideAfter = tailText.slice(to.ch, to.ch + 40);
		const inline = scanInlineTags(wideBefore, selection, wideAfter);

		const dom = this.selectionMarks();
		const textColor = inline.color ?? this.selectionTextColor(probe, dom);

		const state: Record<string, boolean> = {
			bold: /\*\*[^*]+\*\*|__[^_]+__/.test(probe) || dom.has("bold"),
			italic: /(^|[^*])\*[^*][\s\S]*\*/.test(probe) || dom.has("italic"),
			underline: /<u>[\s\S]*<\/u>/.test(probe) || dom.has("underline"),
			strike: /~~[\s\S]+~~/.test(probe) || dom.has("strike"),
			code: /`[^`]+`/.test(probe) || dom.has("code"),
			highlight:
				/==[\s\S]+==/.test(probe) ||
				inline.highlight ||
				dom.has("highlight"),
			textcolor: textColor !== null || dom.has("textcolor"),
		};

		for (const [id, active] of Object.entries(state)) {
			this.buttons.get(id)?.classList.toggle("is-active", active);
		}

		// 标题：显示当前级别（正文显示 1），有级别时点亮 H 按钮
		const heading = lineText.match(/^(#{1,6})\s/);
		const level = heading ? heading[1].length : 0;
		const headingButton = this.buttons.get("heading");
		if (headingButton) {
			const sub = headingButton.querySelector(".mubu-tb-sub");
			if (sub instanceof HTMLElement) sub.setText(String(level || 1));
			headingButton.classList.toggle("is-active", level > 0);
		}
	}

	/** 选区两端的 DOM 已经带上什么样式（实时预览会把标记渲染成 span/mark） */
	private selectionMarks(): Set<string> {
		const marks = new Set<string>();
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return marks;

		const starts = [selection.anchorNode, selection.focusNode];
		for (const start of starts) {
			if (!start) continue;
			let el: HTMLElement | null =
				start.nodeType === Node.ELEMENT_NODE
					? (start as HTMLElement)
					: start.parentElement;
			let depth = 0;
			while (el && depth++ < 12) {
				const tag = el.tagName;
				const cls = el.classList;
				if (tag === "STRONG" || tag === "B" || cls.contains("cm-strong"))
					marks.add("bold");
				if (tag === "EM" || tag === "I" || cls.contains("cm-em"))
					marks.add("italic");
				if (tag === "U" || cls.contains("cm-underline"))
					marks.add("underline");
				if (tag === "S" || tag === "DEL" || cls.contains("cm-strikethrough"))
					marks.add("strike");
				if (tag === "CODE" || cls.contains("cm-inline-code"))
					marks.add("code");
				if (
					tag === "MARK" ||
					cls.contains("cm-highlight") ||
					cls.contains("mubu-hl")
				)
					marks.add("highlight");
				for (const name of Array.from(cls)) {
					if (name.startsWith("mubu-fg-")) marks.add("textcolor");
				}
				// 走到行容器就停，避免把整篇的样式算进来
				if (cls.contains("cm-line") || cls.contains("markdown-rendered"))
					break;
				el = el.parentElement;
			}
		}
		return marks;
	}

	/** 选区内正在用的字体颜色 id（没有则 null） */
	private selectionTextColor(
		probe: string,
		dom: Set<string>
	): Palette | null {
		const hit = probe.match(/<span[^>]*class="[^"]*mubu-fg-(\w+)/);
		if (hit) {
			const id = hit[1] as Palette;
			if (TEXT_COLORS.some(([color]) => color === id)) return id;
		}
		if (!dom.has("textcolor")) return null;

		// DOM 兜底：在选区两端往上找最近的 mubu-fg-* 类名
		const selection = window.getSelection();
		if (!selection) return null;
		for (const start of [selection.anchorNode, selection.focusNode]) {
			if (!start) continue;
			let el: HTMLElement | null =
				start.nodeType === Node.ELEMENT_NODE
					? (start as HTMLElement)
					: start.parentElement;
			let depth = 0;
			while (el && depth++ < 12) {
				for (const name of Array.from(el.classList)) {
					if (!name.startsWith("mubu-fg-")) continue;
					const id = name.slice("mubu-fg-".length) as Palette;
					if (TEXT_COLORS.some(([color]) => color === id)) return id;
				}
				if (el.classList.contains("cm-line")) break;
				el = el.parentElement;
			}
		}
		return null;
	}

	private showTip(anchor: HTMLElement, item: Item): void {
		if (!item.hint) {
			this.hideTip();
			return;
		}
		if (!this.tip) {
			this.tip = document.createElement("div");
			this.tip.className = "mubu-tooltip";
			document.body.appendChild(this.tip);
		}
		this.tip.setText(`${item.label}  ${item.hint}`);
		this.tip.addClass("is-open");

		const rect = anchor.getBoundingClientRect();
		const width = this.tip.offsetWidth;
		this.tip.style.left = `${Math.round(
			Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2))
		)}px`;
		this.tip.style.top = `${Math.round(rect.top - this.tip.offsetHeight - 6)}px`;
	}

	private hideTip(): void {
		this.tip?.classList.remove("is-open");
	}

	/* ---------------- 子菜单 ---------------- */

	/** 悬停 90ms 就展开，避免扫过一排图标时菜单疯狂闪 */
	private scheduleMenu(item: Item, anchor: HTMLElement): void {
		window.clearTimeout(this.menuTimer);
		window.clearTimeout(this.menuCloseTimer);
		if (this.openMenuFor === item.id) return;
		this.menuTimer = window.setTimeout(() => this.openMenu(item, anchor), 90);
	}

	/** 离开按钮后给 180ms 缓冲，够鼠标移进菜单（菜单只隔 6px，贴着按钮） */
	private scheduleMenuClose(): void {
		window.clearTimeout(this.menuTimer);
		window.clearTimeout(this.menuCloseTimer);
		this.menuCloseTimer = window.setTimeout(() => this.closeMenu(), 180);
	}

	private openEmojiMenu(anchor: HTMLElement): void {
		window.clearTimeout(this.menuCloseTimer);
		this.closeMenu();
		this.openMenuFor = "emoji";

		const menu = document.createElement("div");
		menu.className = "mubu-tb-menu is-emoji";
		menu.addEventListener("mousedown", (event) => {
			const target = event.target as HTMLElement;
			// 表情列表和滚动条要能正常拖动，不能一律 preventDefault
			if (target.closest(".mubu-emoji-body")) return;
			event.preventDefault();
		});
		menu.addEventListener("mouseenter", () => {
			window.clearTimeout(this.menuTimer);
			window.clearTimeout(this.menuCloseTimer);
		});
		menu.addEventListener("mouseleave", () => this.scheduleMenuClose());

		const picker = buildEmojiPicker((char) => {
			this.runItem({ id: `emoji-${char}`, label: char });
			this.closeMenu();
			this.hide();
		});
		menu.appendChild(picker);
		document.body.appendChild(menu);
		this.menu = menu;

		const rect = anchor.getBoundingClientRect();
		const width = menu.offsetWidth;
		const height = menu.offsetHeight;

		// 和普通子菜单一样：优先向上，放不下再向下
		let above = rect.top - height - 6 >= 8;
		if (!above) {
			const roomBelow = window.innerHeight - rect.bottom - 8;
			if (rect.bottom + height + 6 > window.innerHeight - 8) {
				above = rect.top > roomBelow;
			}
		}
		menu.addClass(above ? "is-above" : "is-below");

		let top = above ? rect.top - height - 6 : rect.bottom + 6;
		top = Math.max(8, Math.min(window.innerHeight - height - 8, top));
		const left = Math.max(
			8,
			Math.min(
				window.innerWidth - width - 8,
				rect.left + rect.width / 2 - width / 2
			)
		);
		menu.style.left = `${Math.round(left)}px`;
		menu.style.top = `${Math.round(top)}px`;
		void menu.offsetWidth;
		menu.addClass("is-open");
	}

	private openMenu(item: Item, anchor: HTMLElement): void {
		if (item.id === "emoji") {
			this.openEmojiMenu(anchor);
			return;
		}
		window.clearTimeout(this.menuCloseTimer);
		this.closeMenu();
		this.openMenuFor = item.id;

		const menu = document.createElement("div");
		menu.className = "mubu-tb-menu";
		if (item.id === "highlight" || item.id === "textcolor") {
			menu.addClass("is-swatches");
		}
		if (item.id === "more") menu.addClass("is-more");
		if (item.children && item.children.every((c) => c.swatch)) {
			menu.addClass("is-swatches");
		}
		// 点菜单别把编辑器的选区抢走
		menu.addEventListener("mousedown", (event) => event.preventDefault());
		menu.addEventListener("mouseenter", () => {
			window.clearTimeout(this.menuTimer);
			window.clearTimeout(this.menuCloseTimer);
		});
		menu.addEventListener("mouseleave", () => this.scheduleMenuClose());

		for (const child of item.children ?? []) {
			// 分隔线：占一个 id，渲染成一条细线
			if (child.id === "sep") {
				menu.createDiv({ cls: "mubu-tb-menu-sep" });
				continue;
			}

			const row = menu.createEl("button", {
				cls: "mubu-tb-menu-item",
			});
			if (child.danger) row.addClass("is-danger");

			if (child.fg) {
				const a = row.createSpan({ cls: "mubu-menu-a", text: "A" });
				a.style.color = child.fg;
			} else if (child.swatch) {
				if (child.swatch === "none") {
					row.createDiv({ cls: "mubu-swatch is-none" });
				} else {
					const swatch = row.createDiv({ cls: "mubu-swatch" });
					swatch.style.background = child.swatch;
				}
			} else {
				if (child.glyph) {
					row.createSpan({ cls: "mubu-tb-glyph", text: child.glyph });
				} else if (child.icon) {
					const icon = row.createSpan({ cls: "mubu-tb-icon" });
					setIcon(icon, child.icon);
				}
				row.createSpan({ cls: "mubu-tb-menu-label", text: child.label });
				if (child.hint) {
					row.createSpan({ cls: "mubu-tb-menu-hint", text: child.hint });
				}
			}

			row.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.runItem(child);
				this.closeMenu();
				if (child.id !== "hl-none" && !child.id.startsWith("hl-")) {
					this.hide();
				}
			});
		}

		document.body.appendChild(menu);
		this.menu = menu;

		const rect = anchor.getBoundingClientRect();
		const width = menu.offsetWidth;
		const height = menu.offsetHeight;

		// 优先贴在按钮上方展开（工具栏通常就在选区上方），放不下再翻到下方
		let above = rect.top - height - 6 >= 8;
		if (!above) {
			const roomBelow = window.innerHeight - rect.bottom - 8;
			if (rect.bottom + height + 6 > window.innerHeight - 8) {
				// 上下都挤：取空间大的一侧
				above = rect.top > roomBelow;
			}
		}
		menu.addClass(above ? "is-above" : "is-below");

		let top = above ? rect.top - height - 6 : rect.bottom + 6;
		top = Math.max(8, Math.min(window.innerHeight - height - 8, top));
		const left = Math.max(
			8,
			Math.min(
				window.innerWidth - width - 8,
				rect.left + rect.width / 2 - width / 2
			)
		);
		menu.style.left = `${Math.round(left)}px`;
		menu.style.top = `${Math.round(top)}px`;

		// 先让浏览器认下起始 transform，再加 is-open，100ms 位移+淡入才播得出来
		void menu.offsetWidth;
		menu.addClass("is-open");
	}

	private closeMenu(): void {
		window.clearTimeout(this.menuTimer);
		window.clearTimeout(this.menuCloseTimer);
		this.menu?.remove();
		this.menu = null;
		this.openMenuFor = null;
	}

	/* ---------------- 执行 ---------------- */

	private runItem(item: Item): void {
		const editor = activeEditor(this.plugin);
		if (!editor) return;

		// 选区如果被点菜单弄丢了，恢复回打开工具栏时的范围
		this.restoreSelection(editor);

		// 子菜单里的动作自己带 run，优先用
		if (item.run) {
			item.run({ plugin: this.plugin, editor });
			return;
		}

		const ctx: Ctx = { plugin: this.plugin, editor };
		switch (item.id) {
			case "bold":
				toggleWrap(editor, "**", "**");
				break;
			case "italic":
				toggleWrap(editor, "*", "*");
				break;
			case "underline":
				toggleWrap(editor, "<u>", "</u>");
				break;
			case "strike":
				toggleWrap(editor, "~~", "~~");
				break;
			case "code":
				toggleWrap(editor, "`", "`");
				break;
			case "h1":
				setLinePrefix(editor, "# ", /^#{1,6}\s+/);
				break;
			case "h2":
				setLinePrefix(editor, "## ", /^#{1,6}\s+/);
				break;
			case "h3":
				setLinePrefix(editor, "### ", /^#{1,6}\s+/);
				break;
			case "h0":
				setLinePrefix(editor, "", /^#{1,6}\s+/);
				break;
			case "todo":
				setLinePrefix(editor, "- [ ] ", /^(?:[-*+]\s+\[.\]\s+|[-*+]\s+)/);
				break;
			case "bullet":
				setLinePrefix(editor, "- ", /^(?:[-*+]\s+|>\s+|\d+\.\s+)/);
				break;
			case "quote":
				setLinePrefix(editor, "> ", /^(?:>\s+|[-*+]\s+)/);
				break;
			case "ordered":
				setLinePrefix(editor, "1. ", /^(?:[-*+]\s+|\d+\.\s+|>\s+)/);
				break;
			case "table":
				insertBlock(editor, "| 列 1 | 列 2 |\n| --- | --- |\n|  |  |");
				break;
			case "cut":
				void navigator.clipboard.writeText(editor.getSelection());
				editor.replaceSelection("");
				break;
			case "link": {
				const selected = editor.getSelection() || "链接文字";
				const from = editor.getCursor("from");
				editor.replaceSelection(`[${selected}]()`);
				editor.setCursor({
					line: from.line,
					ch: from.ch + selected.length + 3,
				});
				break;
			}
			case "image":
				editor.replaceSelection("![](图片地址)");
				break;
			case "hr":
				insertBlock(editor, "---");
				break;
			case "relation": {
				// 建立关联：有选中文字就包成 [[文字]]，没有就插入 [[]] 并把光标放到中间
				const selected = editor.getSelection();
				if (selected) {
					toggleWrap(editor, "[[", "]]");
					break;
				}
				const from = editor.getCursor("from");
				editor.replaceSelection("[[]]");
				editor.setCursor({ line: from.line, ch: from.ch + 2 });
				break;
			}
			case "clear": {
				let text = editor.getSelection();
				// 字体颜色是 <span class="mubu-fg-*">：只有选区内确实有它时才连 </span> 一起清，
				// 避免把别处的闭合标签拆掉
				if (/<span[^>]*class="[^"]*mubu-fg-/.test(text)) {
					text = text
						.replace(/<span[^>]*class="[^"]*mubu-fg-[^"]*"[^>]*>/g, "")
						.replace(/<\/span>/g, "");
				}
				editor.replaceSelection(
					text.replace(/(\*\*|~~|`|==|<u>|<\/u>|<\/?mark[^>]*>)/g, "")
				);
				break;
			}
			case "copy":
				void navigator.clipboard.writeText(editor.getSelection());
				new Notice("已复制");
				break;
			case "delete":
				editor.replaceSelection("");
				break;
			default:
				// emoji-😀
				if (item.id.startsWith("emoji-")) {
					editor.replaceSelection(item.id.slice(6));
				}
				break;
		}
		void ctx;
	}
}

/* ------------------------------------------------------------------ *
 * 块菜单（行首「⋯」）
 * ------------------------------------------------------------------ */

export class MubuBlockMenu {
	private handle: HTMLElement;
	private menu: HTMLElement | null = null;
	private lineEl: HTMLElement | null = null;
	/** 打开菜单时那一行的行号（emoji 插到行首用） */
	private lineIndex = -1;
	/** 「添加图标」的 emoji 二级菜单 */
	private sub: HTMLElement | null = null;
	private subTimer = 0;
	/** 滚轮/滚动后的冷却时间，冷却期内不跟随鼠标显示 */
	private wheelCooldown = 0;
	/** 最近一次 mouseup 的时间：拖选结束时 CodeMirror 的滚动不该把把手收掉 */
	private lastMouseUpAt = 0;
	/** 打开菜单时选中的整行范围 */
	private lineRange: { from: EditorPosition; to: EditorPosition } | null = null;

	constructor(private plugin: MubuStylePlugin) {
		this.handle = document.createElement("button");
		this.handle.className = "mubu-block-handle";
		setIcon(this.handle.createSpan({ cls: "mubu-tb-icon" }), "more-horizontal");
		this.handle.style.display = "none";
		document.body.appendChild(this.handle);

		this.handle.addEventListener("mousedown", (event) => event.preventDefault());
		this.handle.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			// 再次点把手：已经打开就关掉，不再重复 open
			if (this.menu) this.close();
			else this.open();
		});

		document.addEventListener("mousemove", this.onMouseMove);
		document.addEventListener("mouseup", this.onMouseUp);
		document.addEventListener("wheel", this.onWheel, { passive: false });
		document.addEventListener("mousedown", this.onDocMouseDown, true);
		document.addEventListener("keydown", this.onKeyDown, true);
		window.addEventListener("scroll", this.onScroll, true);
	}

	destroy(): void {
		document.removeEventListener("mousemove", this.onMouseMove);
		document.removeEventListener("mouseup", this.onMouseUp);
		document.removeEventListener("wheel", this.onWheel);
		document.removeEventListener("mousedown", this.onDocMouseDown, true);
		document.removeEventListener("keydown", this.onKeyDown, true);
		window.removeEventListener("scroll", this.onScroll, true);
		window.clearTimeout(this.subTimer);
		this.handle.remove();
		this.close();
	}

	/** 滚轮/滚动时不要跟着重新出现（已经打开的菜单也一起收掉） */
	private onWheel = (event: WheelEvent): void => {
		if (this.scrollEmoji(event)) return;
		this.wheelCooldown = Date.now() + 320;
		this.close();
		this.hideHandle();
	};

	private onScroll = (event: Event): void => {
		// 表情列表自己在滚动 / 面板打开时，不要关菜单
		if (this.sub?.classList.contains("is-emoji")) return;
		const target = event.target;
		if (target instanceof HTMLElement && target.closest(".mubu-emoji-body")) {
			return;
		}
		// 刚拖选完字时 CodeMirror 会把选区滚进视口，别把把手收掉
		if (Date.now() - this.lastMouseUpAt < 160) return;
		this.wheelCooldown = Date.now() + 320;
		this.close();
		this.hideHandle();
	};

	/**
	 * 拖选结束时按指针位置重新贴一次把手。
	 * 拖选过程中最后一次 mousemove 可能落在文字节点/选区上，
	 * 或者被别的插件的浮层截走，导致把手一直不出现。
	 */
	private onMouseUp = (event: MouseEvent): void => {
		this.lastMouseUpAt = Date.now();
		this.wheelCooldown = 0;
		if (!this.plugin.settings.blockMenu) return;
		const x = event.clientX;
		const y = event.clientY;
		window.setTimeout(() => this.syncHandleAt(x, y), 0);
	};

	private syncHandleAt(x: number, y: number): void {
		const target = document.elementFromPoint(x, y) as HTMLElement | null;
		if (!target) return;
		if (
			target.closest(".mubu-block-menu") ||
			target.closest(".mubu-block-menu-sub") ||
			target.closest(".mubu-block-handle") ||
			target.closest(".annotation-card-menu, .modal-container")
		) {
			return;
		}
		// 浮层刚好盖住指针（选完字浮层就贴在选区边上）时保持把手原样，
		// 不要因为"指针下面是工具栏"把刚显示的「⋯」收掉
		if (
			target.closest(
				".mubu-toolbar, .mubu-tb-menu, .mubu-multi-menu, .mubu-multi-sub"
			)
		) {
			return;
		}
		const line = target.closest(".cm-line") as HTMLElement | null;
		if (!line || !line.closest(".cm-content")) {
			if (!this.nearHandle(x, y)) this.hideHandle();
			return;
		}
		this.placeHandle(line);
	}

	/** 块菜单里的「添加图标」列表：把滚轮作用在列表上，返回 true 表示已处理 */
	private scrollEmoji(event: WheelEvent): boolean {
		if (!this.sub?.classList.contains("is-emoji")) return false;
		const body = this.sub.querySelector<HTMLElement>(".mubu-emoji-body");
		if (!body) return false;
		const rect = body.getBoundingClientRect();
		const target = event.target;
		const targetInside = target instanceof Node && body.contains(target);
		const pointerInside =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;
		if (!targetInside && !pointerInside) return false;
		const max = body.scrollHeight - body.clientHeight;
		if (max <= 0) return false;
		body.scrollTop = Math.max(
			0,
			Math.min(max, body.scrollTop + event.deltaY)
		);
		event.preventDefault();
		event.stopPropagation();
		return true;
	}

	/** 光标是否落在把手附近，避免"移过去就消失"：
	 *  左 24px、右 40px（把手到正文只有 6px 空隙）、上下 12px 都算还在 */
	private nearHandle(x: number, y: number): boolean {
		const rect = this.handle.getBoundingClientRect();
		return (
			x >= rect.left - 24 &&
			x <= rect.right + 40 &&
			y >= rect.top - 12 &&
			y <= rect.bottom + 12
		);
	}

	private onMouseMove = (event: MouseEvent): void => {
		if (!this.plugin.settings.blockMenu) return;
		const target = event.target as HTMLElement;
		if (
			target.closest(".mubu-block-menu") ||
			target.closest(".mubu-block-menu-sub") ||
			target.closest(".mubu-block-handle")
		) {
			return;
		}
		if (Date.now() < this.wheelCooldown) return;

		const line = target.closest(".cm-line") as HTMLElement | null;
		if (!line || !line.closest(".cm-content")) {
			// 移到行左侧的空隙/装订线时，只要还挨着把手就保持显示
			if (this.handle.style.display !== "none" && this.nearHandle(event.clientX, event.clientY)) {
				return;
			}
			this.hideHandle();
			return;
		}

		this.placeHandle(line);
	};

	/** 把把手贴到某一行的行首（垂直按"第一行"居中，长段落不会跑到段中间） */
	private placeHandle(line: HTMLElement): void {
		this.lineEl = line;
		const rect = line.getBoundingClientRect();
		// 段落可能折行，取"第一行"的高度来垂直居中，
		// 否则会跑到整段文字的正中间
		const lineHeight =
			parseFloat(getComputedStyle(line).lineHeight || "") || rect.height;
		const firstRow = Math.min(lineHeight, rect.height);

		this.handle.style.display = "flex";
		this.handle.style.left = `${Math.round(rect.left - 28)}px`;
		this.handle.style.top = `${Math.round(rect.top + firstRow / 2 - 11)}px`;
	}

	private onDocMouseDown = (event: MouseEvent): void => {
		const target = event.target as HTMLElement;
		if (
			target.closest(".mubu-block-menu") ||
			target.closest(".mubu-block-menu-sub") ||
			target.closest(".mubu-block-handle")
		) {
			return;
		}
		this.close();
	};

	private onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") this.close();
	};

	private hideHandle(): void {
		if (!this.menu) this.handle.style.display = "none";
	}

	private open(): void {
		const editor = activeEditor(this.plugin);
		const line = this.lineEl;
		if (!editor || !line) return;

		// 选中整行（相当于"点中后选择对应所有字"）
		const index = lineIndexOf(editor, line);
		this.lineIndex = index;
		if (index >= 0) {
			const text = editor.getLine(index);
			this.lineRange = {
				from: { line: index, ch: 0 },
				to: { line: index, ch: text.length },
			};
			editor.setSelection(this.lineRange.from, this.lineRange.to);
		}

		this.close();

		const menu = document.createElement("div");
		menu.className = "mubu-block-menu";
		menu.addEventListener("mousedown", (event) => event.preventDefault());
		this.menu = menu;

		menu.createDiv({ cls: "mubu-block-menu-row" }).append(
			...(["h1", "h2", "h3", "h0"] as const).map((id) => {
				const button = document.createElement("button");
				button.className = "mubu-tb-btn";
				button.createSpan({ cls: "mubu-tb-glyph", text: id === "h0" ? "T" : id.toUpperCase() });
				button.addEventListener("click", () => {
					this.apply(id);
					this.close();
				});
				return button;
			})
		);

		menu.createDiv({ cls: "mubu-block-menu-row" }).append(
			...(["bold", "italic", "underline", "strike"] as const).map((id) => {
				const button = document.createElement("button");
				button.className = "mubu-tb-btn";
				const glyph =
					id === "bold"
						? ["B", "is-bold"]
						: id === "italic"
							? ["I", "is-italic"]
							: id === "underline"
								? ["U", "is-underline"]
								: ["S", "is-strike"];
				button.createSpan({
					cls: `mubu-tb-glyph ${glyph[1]}`,
					text: glyph[0],
				});
				button.addEventListener("click", () => {
					this.apply(id);
					this.close();
				});
				return button;
			})
		);

		const swatches = menu.createDiv({ cls: "mubu-block-menu-row is-swatches" });
		const standard = document.createElement("button");
		standard.className = "mubu-tb-btn";
		standard.createSpan({ cls: "mubu-tb-glyph", text: "==" });
		standard.setAttribute("title", "标准高亮");
		standard.addEventListener("click", () => {
			this.apply("highlight-default");
			this.close();
		});
		swatches.appendChild(standard);

		swatches.append(
			...HIGHLIGHT_COLORS.map(([id, color]) => {
				const button = document.createElement("button");
				button.className = "mubu-tb-btn";
				const swatch = button.createDiv({ cls: "mubu-swatch" });
				swatch.style.background = color;
				button.addEventListener("click", () => {
					this.apply("highlight", id);
					this.close();
				});
				return button;
			})
		);

		const list = menu.createDiv({ cls: "mubu-block-menu-list" });
		const rows: Array<{
			id: string;
			label: string;
			icon?: string;
			danger?: boolean;
		}> = [
			// 幕布的单块菜单里有「添加图标」，hover 从右侧弹出 emoji
			{ id: "icon", label: "添加图标", icon: "smile" },
			{ id: "fold", label: "折叠/展开子主题", icon: "chevrons-up-down" },
			{ id: "todo", label: "转为待办", icon: "check-square" },
			{ id: "bullet", label: "转为无序列表", icon: "list" },
			{ id: "image", label: "插入图片", icon: "image" },
			{ id: "table", label: "插入表格", icon: "table" },
			{ id: "copy", label: "复制文字", icon: "copy" },
			{ id: "delete", label: "删除这一行", icon: "trash-2", danger: true },
		];
		for (const row of rows) {
			if (row.id === "delete") list.createDiv({ cls: "mubu-tb-menu-sep" });

			const button = list.createEl("button", { cls: "mubu-tb-menu-item" });
			if (row.danger) button.addClass("is-danger");
			if (row.icon) {
				const icon = button.createSpan({ cls: "mubu-tb-icon" });
				setIcon(icon, row.icon);
			}
			button.createSpan({ cls: "mubu-tb-menu-label", text: row.label });

			if (row.id === "icon") {
				button.createSpan({ cls: "mubu-multi-chevron", text: "›" });
				button.addEventListener("mouseenter", () =>
					this.openEmojiSub(button)
				);
				button.addEventListener("mouseleave", () => this.closeSubLater());
				button.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					this.openEmojiSub(button);
				});
				continue;
			}

			button.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.apply(row.id);
				this.close();
			});
		}

		const footer = menu.createDiv({ cls: "mubu-block-menu-footer" });
		const selected = editor.getSelection();
		footer.setText(`选中 ${selected.length} 字`);

		document.body.appendChild(menu);

		// 先量尺寸再定位，最后加 is-open 播 160ms 缩放+淡入
		const rect = this.handle.getBoundingClientRect();
		const width = menu.offsetWidth;
		const height = menu.offsetHeight;

		let left = rect.right + 6;
		if (left + width > window.innerWidth - 8) left = rect.left - width - 6;
		left = Math.max(8, Math.min(window.innerWidth - width - 8, left));

		let top = rect.top - 8;
		if (top + height > window.innerHeight - 8) {
			top = window.innerHeight - height - 8;
		}
		top = Math.max(8, top);

		menu.style.left = `${Math.round(left)}px`;
		menu.style.top = `${Math.round(top)}px`;
		void menu.offsetWidth;
		menu.addClass("is-open");
	}

	/** 「添加图标」：贴着行右侧弹出 emoji 面板，放不下就翻到菜单左侧 */
	private openEmojiSub(anchor: HTMLElement): void {
		window.clearTimeout(this.subTimer);
		if (this.sub) return;

		const sub = document.createElement("div");
		sub.className = "mubu-block-menu-sub is-emoji";
		sub.addEventListener("mousedown", (event) => {
			const target = event.target as HTMLElement;
			if (target.closest(".mubu-emoji-body")) return;
			event.preventDefault();
		});
		sub.addEventListener("mouseenter", () => window.clearTimeout(this.subTimer));
		sub.addEventListener("mouseleave", () => this.closeSubLater());

		sub.appendChild(
			buildEmojiPicker((char) => {
				this.insertEmoji(char);
				this.close();
			})
		);

		document.body.appendChild(sub);
		this.sub = sub;

		const rect = anchor.getBoundingClientRect();
		const width = sub.offsetWidth;
		const height = sub.offsetHeight;
		const menuRect = this.menu?.getBoundingClientRect();

		// 贴着菜单右侧弹出，放不下就翻到菜单左侧
		let left = (menuRect?.right ?? rect.right) + 4;
		if (left + width > window.innerWidth - 8) {
			left = (menuRect?.left ?? rect.left) - width - 4;
		}
		left = Math.max(8, Math.min(window.innerWidth - width - 8, left));
		const top = Math.max(
			8,
			Math.min(window.innerHeight - height - 8, rect.top - 6)
		);

		sub.style.left = `${Math.round(left)}px`;
		sub.style.top = `${Math.round(top)}px`;
		void sub.offsetWidth;
		sub.addClass("is-open");
	}

	private closeSubLater(): void {
		window.clearTimeout(this.subTimer);
		this.subTimer = window.setTimeout(() => this.closeSubNow(), 160);
	}

	private closeSubNow(): void {
		window.clearTimeout(this.subTimer);
		this.sub?.remove();
		this.sub = null;
	}

	/** emoji 插到行首的 Markdown 前缀之后（# / - / - [ ] 之后），避免把标题/列表写坏 */
	private insertEmoji(char: string): void {
		const editor = activeEditor(this.plugin);
		if (!editor || this.lineIndex < 0) return;
		const line = this.lineIndex;
		const text = editor.getLine(line);
		const prefix =
			text.match(/^(?:#{1,6}\s+|[-*+]\s+\[.\]\s+|[-*+]\s+|\d+\.\s+|>\s+)?/)?.[0] ??
			"";
		const ch = prefix.length;
		editor.replaceRange(`${char} `, { line, ch }, { line, ch });
	}

	private close(): void {
		this.closeSubNow();
		this.menu?.remove();
		this.menu = null;
	}

	private apply(id: string, color?: Palette): void {
		const editor = activeEditor(this.plugin);
		if (!editor) return;

		if (!editor.getSelection() && this.lineRange) {
			editor.setSelection(this.lineRange.from, this.lineRange.to);
		}

		switch (id) {
			case "h1":
			case "h2":
			case "h3":
			case "h0":
				setLinePrefix(
					editor,
					id === "h0" ? "" : `${"#".repeat(Number(id[1]))} `,
					/^#{1,6}\s+/
				);
				break;
			case "bold":
				toggleWrap(editor, "**", "**");
				break;
			case "italic":
				toggleWrap(editor, "*", "*");
				break;
			case "underline":
				toggleWrap(editor, "<u>", "</u>");
				break;
			case "strike":
				toggleWrap(editor, "~~", "~~");
				break;
			case "highlight":
				if (color) applyHighlight(editor, color);
				break;
			case "highlight-default":
				toggleWrap(editor, "==", "==");
				break;
			case "fold":
				// 和点圆点走同一个折叠函数：优先点原生箭头，找不到再走编辑器命令
				toggleFoldLine(this.lineEl, editor);
				break;
			case "icon":
				// 「添加图标」由 emoji 二级菜单自己处理，这里不重复执行
				break;
			case "todo":
				setLinePrefix(editor, "- [ ] ", /^(?:[-*+]\s+\[.\]\s+|[-*+]\s+)/);
				break;
			case "bullet":
				setLinePrefix(editor, "- ", /^(?:[-*+]\s+|>\s+|\d+\.\s+)/);
				break;
			case "image":
				insertBlock(editor, "![]()");
				break;
			case "table":
				insertBlock(editor, "| 列 1 | 列 2 |\n| --- | --- |\n|  |  |");
				break;
			case "copy":
				void navigator.clipboard.writeText(editor.getSelection());
				new Notice("已复制");
				break;
			case "delete": {
				const from = editor.getCursor("from");
				const line = from.line;
				const last = editor.lineCount() - 1;
				if (line < last) {
					editor.replaceRange("", { line, ch: 0 }, { line: line + 1, ch: 0 });
				} else if (line > 0) {
					editor.replaceRange(
						"",
						{ line: line - 1, ch: editor.getLine(line - 1).length },
						{ line, ch: editor.getLine(line).length }
					);
				} else {
					editor.setLine(0, "");
				}
				break;
			}
			default:
				break;
		}
	}
}

/* ------------------------------------------------------------------ *
 * 圆点折叠兜底
 * ------------------------------------------------------------------ */

/**
 * 幕布是「点圆点折叠」。
 * Obsidian 原生的命中区不一定盖住圆点（圆点被 margin 挪出了箭头范围），
 * 这里只做兜底：点击目标确实是 .list-bullet 时，替它点一下同一行的原生箭头。
 * 如果原生箭头本来就压住圆点，click 的 target 会是箭头本身，不会重复折叠。
 *
 * 另外补一个悬停态：阅读视图里 .list-bullet 在 .list-collapse-indicator 之前，
 * CSS 的 `~` 兄弟选择器够不着，这里按鼠标位置给圆点加 .is-mubu-halo，
 * 保证两个视图都能出现幕布那种 18px 圆盘。
 */
export class MubuBulletFold {
	private hovered: HTMLElement | null = null;

	constructor(private plugin: MubuStylePlugin) {
		document.addEventListener("click", this.onClick, true);
		document.addEventListener("mousemove", this.onMouseMove);
		document.addEventListener("mouseleave", this.onLeave);
	}

	destroy(): void {
		document.removeEventListener("click", this.onClick, true);
		document.removeEventListener("mousemove", this.onMouseMove);
		document.removeEventListener("mouseleave", this.onLeave);
		this.setHovered(null);
	}

	private onClick = (event: MouseEvent): void => {
		if (!this.plugin.settings.bulletFold) return;

		const target = event.target as HTMLElement | null;
		if (!target?.closest) return;

		// 点在原生折叠箭头上：交给 Obsidian 自己处理，避免双折叠
		if (
			target.closest(
				".collapse-indicator, .cm-fold-indicator, .list-collapse-indicator"
			)
		)
			return;

		const bullet =
			(target.closest(".list-bullet") as HTMLElement | null) ??
			this.bulletAtPoint(event.clientX, event.clientY, target);
		if (!bullet) return;

		// 实时预览优先走编辑器命令：原生箭头在“当前行”上 padding 为 0，
		// 而且它监听的不一定是 click，直接 .click() 可能只把光标挪过去。
		let handled = false;
		const line = bullet.closest<HTMLElement>(".cm-line");
		if (line) {
			const editor = activeEditor(this.plugin);
			const index = editor ? lineIndexOf(editor, line) : -1;
			if (editor && index >= 0) {
				try {
					editor.setCursor({ line: index, ch: 0 });
					editor.exec("toggleFold");
					handled = true;
				} catch {
					handled = false;
				}
			}
		}
		if (!handled) handled = toggleFoldFromBullet(bullet);
		if (!handled) return;

		// 已经替它做过折叠：拦住这次点击，别再触发编辑器自己的逻辑
		event.preventDefault();
		event.stopPropagation();
	};

	/**
	 * 光标所在行（`.cm-active`）的原生箭头 padding 是 0，圆点本身又是零宽，
	 * 点击经常落在 `.cm-line` 而不是 `.list-bullet` 上。
	 * 这里按坐标兜底：只有点得离圆点足够近（12px）才算点圆点，点到正文不受影响。
	 */
	private bulletAtPoint(
		x: number,
		y: number,
		target: HTMLElement
	): HTMLElement | null {
		const line = target.closest<HTMLElement>(".cm-line");
		const li = line ? null : target.closest<HTMLElement>("li");
		const scope = line ?? li;
		if (!scope) return null;

		const bullets = Array.from(
			scope.querySelectorAll<HTMLElement>(".list-bullet")
		);
		let best: HTMLElement | null = null;
		let bestDistance = 12;
		for (const bullet of bullets) {
			// 阅读视图里 li 还嵌着子列表：只认属于当前 li 的圆点
			if (li && bullet.closest("li") !== li) continue;
			const rect = bullet.getBoundingClientRect();
			const distance = Math.hypot(
				x - (rect.left + rect.width / 2),
				y - (rect.top + rect.height / 2)
			);
			if (distance < bestDistance) {
				best = bullet;
				bestDistance = distance;
			}
		}
		return best;
	}

	private onMouseMove = (event: MouseEvent): void => {
		if (!this.plugin.settings.bulletFold) {
			this.setHovered(null);
			return;
		}

		const target = event.target as HTMLElement | null;
		if (!target?.closest) return this.setHovered(null);

		const bullet = target.closest(".list-bullet") as HTMLElement | null;
		if (bullet) return this.setHovered(bullet);

		const indicator = target.closest(
			".list-collapse-indicator, .cm-fold-indicator"
		) as HTMLElement | null;
		this.setHovered(indicator ? this.bulletFor(indicator) : null);
	};

	private onLeave = (): void => this.setHovered(null);

	/** 原生折叠箭头对应的圆点（实时预览按行找，阅读视图按 li 找） */
	private bulletFor(indicator: HTMLElement): HTMLElement | null {
		const line = indicator.closest(".cm-line");
		if (line) return line.querySelector<HTMLElement>(".list-bullet");

		const li = indicator.closest("li");
		if (!li) return null;
		const bullets = Array.from(
			li.querySelectorAll<HTMLElement>(".list-bullet")
		);
		for (const bullet of bullets) {
			if (bullet.closest("li") === li) return bullet;
		}
		return null;
	}

	private setHovered(bullet: HTMLElement | null): void {
		if (this.hovered === bullet) return;
		this.hovered?.classList.remove("is-mubu-halo");
		this.hovered = bullet;
		bullet?.classList.add("is-mubu-halo");
	}
}
