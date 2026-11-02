import {
	Editor,
	MarkdownFileInfo,
	MarkdownPostProcessorContext,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	WorkspaceLeaf,
} from "obsidian";

import { buildIndex, emptyIndex, type IndexResult } from "./core/index.ts";
import { parseBlockInner, scanZaptraceBlocks } from "./core/parse.ts";
import { ensureQuestionFromCard, markOrphans } from "./core/state.ts";
import { replacePersonalNotes } from "./core/notes.ts";
import { patchCardMetadata } from "./core/metadata.ts";
import { fixedTodayString, localIsoWithOffset, todayString } from "./core/date.ts";
import { withSubjectTags, type TagRename } from "./core/taxonomy.ts";import type {
	QuestionCard,
	QuestionState,
	ZaptraceData,
	ZaptraceSettings,
} from "./core/types.ts";
import { StateStore, type DataAdapter } from "./store/stateStore.ts";
import { renderQuestionCard } from "./view/card.ts";
import { RenderScope } from "./view/renderOwner.ts";
import { closeStarSound } from "./view/starSound.ts";
import { ZaptraceSettingsTab } from "./view/settingsTab.ts";
import { VIEW_TYPE_ZAPTRACE, ZaptraceView } from "./view/workbenchView.ts";
import type { PluginContext, WorkbenchHandle } from "./view/pluginContext.ts";
import { QUESTION_TEMPLATE } from "./template.ts";

/**
 * ZapTrace 插件入口：只做 Obsidian API 适配（读写 data.json、注册视图/命令/渲染器、事件清理）。
 * 业务逻辑全部在 src/core/（纯函数，可被 node:test 单测）。
 */
export default class ZapTracePlugin extends Plugin implements PluginContext {
	store!: StateStore;
	index: IndexResult = emptyIndex();
	settings!: ZaptraceSettings;

	private workbench: WorkbenchHandle | null = null;
	private rebuildTimer: number | null = null;
	private rebuilding = false;
	private lastSignature = "";

	/** 当前 data.json 内存状态（只读视图用） */
	get data(): ZaptraceData {
		return this.store.data;
	}

	async onload(): Promise<void> {
		const adapter: DataAdapter = {
			load: () => this.loadData(),
			save: (value) => this.saveData(value),
			backup: (name, content) => this.writeBackup(name, content),
		};
		this.store = new StateStore(adapter, this.manifest.version);
		const result = await this.store.load();
		this.settings = this.store.data.settings;
		for (const issue of result.issues) {
			new Notice(`ZapTrace: ${issue}`, 8000);
		}

		this.registerView(VIEW_TYPE_ZAPTRACE, (leaf: WorkspaceLeaf) => new ZaptraceView(leaf, this));
		this.applyTheme();

		this.addRibbonIcon("graduation-cap", "打开 ZapTrace 工作台", () => {
			void this.openWorkbench();
		});

		this.addCommand({
			id: "open-workbench",
			name: "打开工作台",
			callback: () => {
				void this.openWorkbench();
			},
		});

		this.addCommand({
			id: "practice-current-card",
			name: "练习当前题卡",
			editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
				this.practiceCurrentCard(editor, ctx.file ?? null);
			},
		});

		this.addCommand({
			id: "insert-card-template",
			name: "插入题卡模板",
			editorCallback: (editor: Editor) => {
				this.insertQuestionTemplate(editor);
			},
		});

		// 编辑器右键菜单：插入题目（题材模板，可随后直接编辑源码）
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				menu.addItem((item) =>
					item
						.setTitle("插入题目")
						.setIcon("list-plus")
						.onClick(() => {
							this.insertQuestionTemplate(editor);
						})
				);
			})
		);

		this.addCommand({
			id: "random-practice",
			name: "随机练一题",
			callback: () => {
				this.randomPractice();
			},
		});

		this.addCommand({
			id: "rebuild-index",
			name: "重建索引",
			callback: () => {
				void this.rebuildIndex();
			},
		});

		this.addSettingTab(new ZaptraceSettingsTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor("zaptrace", (source, el, ctx) => {
			this.renderCodeBlock(source, el, ctx);
		});

		this.app.workspace.onLayoutReady(() => {
			void this.rebuildIndex();
		});
		this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleRebuild()));
		this.registerEvent(this.app.vault.on("rename", () => this.scheduleRebuild()));
		this.registerEvent(this.app.vault.on("delete", () => this.scheduleRebuild()));
		this.registerDomEvent(window, "beforeunload", () => {
			void this.store.flush();
		});
	}

	onunload(): void {
		if (this.rebuildTimer !== null) {
			clearTimeout(this.rebuildTimer);
			this.rebuildTimer = null;
		}
		void this.store.flush();
		closeStarSound();
		document.body.classList.remove("zaptrace-force-dark");
		document.body.classList.remove("zaptrace-mubu-dark");
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_ZAPTRACE);
	}

	/* ---------------- PluginContext ---------------- */

	today(): string {
		return this.settings.dateMode === "fixed" ? fixedTodayString() : todayString();
	}

	nowIso(): string {
		return localIsoWithOffset();
	}

	getCards(): QuestionCard[] {
		return this.index.cards;
	}

	getCardByQid(qid: string): QuestionCard | undefined {
		return this.index.byQid.get(qid);
	}

	findCardByLocation(file: string, line: number): QuestionCard | undefined {
		return this.index.cards.find((card) => card.file === file && card.line === line);
	}

	getState(qid: string): QuestionState | undefined {
		return this.data.questions[qid];
	}

	toggleStar(qid: string): boolean {
		let state = this.data.questions[qid];
		if (!state) {
			const card = this.index.byQid.get(qid);
			if (!card) return false;
			state = ensureQuestionFromCard(this.data, card, this.nowIso());
		}
		state.star = !state.star;
		this.requestSave();
		return state.star;
	}

	requestSave(): void {
		this.store.markDirty();
	}

	isReadOnly(): boolean {
		return this.store.readOnly;
	}

	/** 目标文件修改时间（epoch ms），用于「从未在插件保存过」的笔记时间回退。 */
	getFileMtime(path: string): number | null {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;
		const mtime = file.stat?.mtime;
		return typeof mtime === "number" ? mtime : null;
	}

	/** 持久化「答案与笔记」折叠开合（按 qid） */
	setFoldOpen(qid: string, open: boolean): void {
		const state = this.data.questions[qid];
		if (!state) return;
		state.foldOpen = open;
		this.requestSave();
	}

	/** 记住某题的笔记编辑框高度（px），下次渲染沿用到阅读卡与题库卡 */
	setNoteHeight(qid: string, height: number): void {
		const state = this.data.questions[qid];
		if (!state) return;
		const next = Math.min(480, Math.max(56, Math.round(height)));
		if (state.noteHeight === next) return;
		state.noteHeight = next;
		this.requestSave();
	}

	/** 把标签编辑器里用到的标签并入「科目 > 子科目 > 小标签」库（不触发全量刷新）。 */
	rememberTags(category: string, subject: string, tags: string[]): void {
		if (this.store.readOnly || tags.length === 0) return;
		const next = withSubjectTags(this.settings.taxonomy, category, subject, tags);
		if (JSON.stringify(next) === JSON.stringify(this.settings.taxonomy)) return;
		this.store.updateSettings({ ...this.settings, taxonomy: next });
		this.settings = this.store.data.settings;
	}

	/**
	 * 保存个人笔记：重新读取最新文件 → 重新定位块 → 只替换「### 个人笔记」节。
	 * 绝不改答案/题干/其它块；失败不写盘。
	 */
	async saveNotes(
		card: QuestionCard,
		notes: string
	): Promise<{ ok: boolean; error?: string; changed?: boolean }> {
		if (this.store.readOnly) return { ok: false, error: "只读模式" };
		const file = this.app.vault.getAbstractFileByPath(card.file);
		if (!(file instanceof TFile)) return { ok: false, error: "找不到源文件" };
		const fresh = await this.app.vault.read(file);
		const scanned = scanZaptraceBlocks(card.file, fresh).cards;
		let candidates = scanned.filter((item) => item.qid === card.qid);
		if (candidates.length === 0) candidates = scanned.filter((item) => item.line === card.line);
		if (candidates.length === 0) {
			return { ok: false, error: "题卡已移动或删除，请刷新索引" };
		}
		const target = candidates.reduce((a, b) =>
			Math.abs(a.line - card.line) <= Math.abs(b.line - card.line) ? a : b
		);
		const patched = replacePersonalNotes(
			fresh,
			{ line: target.line, endLine: target.endLine },
			notes
		);
		if (patched.error) {
			const message =
				patched.error === "reserved_heading_in_notes"
					? "笔记不能包含「### 题干 / 答案 / 个人笔记 / AI 笔记」等保留标题"
					: patched.error === "not_zaptrace"
						? "目标块不是 zaptrace 题卡"
						: "题卡位置无效，请刷新索引后重试";
			return { ok: false, error: message };
		}
		if (patched.changed) {
			await this.app.vault.process(file, () => patched.content);
			const now = this.nowIso();
			const state = ensureQuestionFromCard(this.data, target, now);
			state.notesUpdatedAt = notes.trim() === "" ? null : now;
			this.requestSave();
			await this.rebuildIndex();
		}
		this.refreshAll();
		return { ok: true, changed: patched.changed };
	}

	/**
	 * 保存分类与标签：重新读取最新文件 → 重新定位块 → 只改头部
	 * category/subject/tags 三行；失败不写盘。
	 */
	async saveMetadata(
		card: QuestionCard,
		next: { category: string; subject: string; tags: string[] }
	): Promise<{ ok: boolean; error?: string; changed?: boolean }> {
		if (this.store.readOnly) return { ok: false, error: "只读模式" };
		const file = this.app.vault.getAbstractFileByPath(card.file);
		if (!(file instanceof TFile)) return { ok: false, error: "找不到源文件" };
		const fresh = await this.app.vault.read(file);
		const scanned = scanZaptraceBlocks(card.file, fresh).cards;
		let candidates = scanned.filter((item) => item.qid === card.qid || item.key === card.key);
		if (candidates.length === 0) candidates = scanned.filter((item) => item.line === card.line);
		if (candidates.length === 0) {
			return { ok: false, error: "题卡已移动或删除，请刷新索引" };
		}
		const target = candidates.reduce((a, b) =>
			Math.abs(a.line - card.line) <= Math.abs(b.line - card.line) ? a : b
		);
		const patched = patchCardMetadata(fresh, { line: target.line, endLine: target.endLine }, next);
		if (patched.error) {
			return {
				ok: false,
				error:
					patched.error === "not_zaptrace"
						? "目标块不是 zaptrace 题卡"
						: "题卡位置无效，请刷新索引后重试",
			};
		}
		if (!patched.changed) return { ok: true, changed: false };
		await this.app.vault.process(file, () => patched.content);
		await this.rebuildIndex();
		this.refreshAll();
		this.refreshReadingViews();
		return { ok: true, changed: true };
	}

	/** 小标签重命名后，批量改写对应题卡的头部 tags（只同步「科目 + 子科目」匹配的卡）。 */
	async syncTagRenames(renames: TagRename[]): Promise<number> {
		if (this.store.readOnly || renames.length === 0) return 0;
		const byKey = new Map<string, string>();
		for (const rename of renames) {
			if (rename.from === rename.to) continue;
			const category = rename.category || "数学";
			byKey.set(`${category}\u0000${rename.subject}\u0000${rename.from}`, rename.to);
		}
		if (byKey.size === 0) return 0;

		let updated = 0;
		for (const card of [...this.index.cards]) {
			const rawCategory = card.category ?? "";
			const category = rawCategory || "数学";
			let changed = false;
			const tags = card.tags.map((tag) => {
				const next = byKey.get(`${category}\u0000${card.subject}\u0000${tag}`);
				if (next !== undefined && next !== tag) {
					changed = true;
					return next;
				}
				return tag;
			});
			if (!changed) continue;
			const result = await this.saveMetadata(card, {
				category: rawCategory,
				subject: card.subject,
				tags,
			});
			if (result.ok && result.changed) updated++;
		}
		if (updated > 0) this.refreshReadingViews();
		return updated;
	}

	/**
	 * 删除题目：从源文件移除整个 zaptrace 块（含题干/答案/笔记），不可恢复。
	 * 练习记录保留在 data.json（标记为 orphaned），同题干重建后会自动接上。
	 */
	async deleteCard(card: QuestionCard): Promise<{ ok: boolean; error?: string }> {
		if (this.store.readOnly) return { ok: false, error: "只读模式" };
		const file = this.app.vault.getAbstractFileByPath(card.file);
		if (!(file instanceof TFile)) return { ok: false, error: "找不到源文件" };
		const confirmed = window.confirm(
			"删除题目会从源文件移除整个题卡块（含题干/答案/笔记），不可恢复。继续？"
		);
		if (!confirmed) return { ok: true };
		const fresh = await this.app.vault.read(file);
		const scanned = scanZaptraceBlocks(card.file, fresh).cards;
		let candidates = scanned.filter((item) => item.qid === card.qid || item.key === card.key);
		if (candidates.length === 0) candidates = scanned.filter((item) => item.line === card.line);
		if (candidates.length === 0) {
			return { ok: false, error: "题卡已移动或删除，请刷新索引" };
		}
		const target = candidates.reduce((a, b) =>
			Math.abs(a.line - card.line) <= Math.abs(b.line - card.line) ? a : b
		);
		// 逐行切分（保留每行自己的 EOL），删除 [开栏 .. 闭栏]
		const parts = fresh.match(/[^\r\n]*\r?\n|[^\r\n]+/g) ?? [];
		const startIdx = target.line - 1;
		const endIdx = Math.min(target.endLine, parts.length);
		if (startIdx < 0 || startIdx >= parts.length) {
			return { ok: false, error: "题卡位置无效，请刷新索引后重试" };
		}
		const kept = [...parts.slice(0, startIdx), ...parts.slice(endIdx)];
		// 前后都是空行时去掉一个，避免留出双倍空行
		const isBlank = (value: string | undefined): boolean =>
			value !== undefined && value.trim() === "";
		if (isBlank(kept[startIdx - 1]) && isBlank(kept[startIdx])) {
			kept.splice(startIdx, 1);
		}
		const content = kept.join("");
		await this.app.vault.process(file, () => content);
		await this.rebuildIndex();
		this.refreshAll();
		this.refreshReadingViews();
		return { ok: true };
	}

	refreshAll(): void {
		this.workbench?.refreshAll();
	}

	/** 在光标处插入题卡模板；光标不在行首时先补一个空行。 */
	insertQuestionTemplate(editor: Editor): void {
		const cursor = editor.getCursor();
		const before = editor.getRange({ line: cursor.line, ch: 0 }, cursor);
		const prefix = before.trim() === "" ? "" : "\n";
		editor.replaceSelection(`${prefix}${QUESTION_TEMPLATE}\n`);
	}

	async openWorkbench(): Promise<void> {
		let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_ZAPTRACE)[0];
		if (!leaf) {
			leaf = this.app.workspace.getLeaf(true);
			await leaf.setViewState({ type: VIEW_TYPE_ZAPTRACE, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
	}

	async startPractice(cards: QuestionCard[]): Promise<void> {
		if (cards.length === 0) return;
		await this.openWorkbench();
		this.workbench?.startPractice(cards);
	}

	/**
	 * 打开题卡所在源文件并定位到题卡首行（REVIEW-implementation §3-②）。
	 * 只读操作：只切视图/光标，不改写 Markdown。
	 */
	async openSource(card: QuestionCard): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(card.file);
		if (!(file instanceof TFile)) {
			new Notice(`ZapTrace: 找不到源文件 ${card.file}`);
			return;
		}
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, { eState: { line: card.line - 1 } });
		await this.app.workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof MarkdownView) {
			view.setEphemeralState({ line: card.line - 1 });
			if (view.getMode() === "source") {
				view.editor.setCursor({ line: card.line - 1, ch: 0 });
				view.editor.scrollIntoView(
					{
						from: { line: card.line - 1, ch: 0 },
						to: { line: card.line - 1, ch: 0 },
					},
					true
				);
				view.editor.focus();
			}
		}
	}

	async saveSettings(next: ZaptraceSettings): Promise<void> {
		this.store.updateSettings(next);
		this.settings = this.store.data.settings;
		this.applyTheme();
		this.refreshAll();
	}

	private applyTheme(): void {
		// mubu-dark 保留为「强制暗色令牌」兼容开关（不改 schema）
		document.body.classList.toggle(
			"zaptrace-force-dark",
			this.settings.theme === "mubu-dark"
		);
	}

	/** 重渲染当前打开的阅读视图，让题卡头部/笔记的修改立刻可见。 */
	private refreshReadingViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.getMode() === "preview") {
				try {
					view.previewMode.rerender(true);
				} catch (error) {
					console.error("[ZapTrace] 重渲染阅读视图失败", error);
				}
			}
		}
	}

	async updateSettings(patch: Partial<ZaptraceSettings>): Promise<void> {
		await this.saveSettings({ ...this.settings, ...patch });
		if (patch.cardFolder !== undefined || patch.defaultSubject !== undefined) {
			await this.rebuildIndex();
		}
	}

	openSettings(): void {
		const host = this.app as unknown as {
			setting?: { open(): void; openTabById(id: string): void };
		};
		if (host.setting) {
			host.setting.open();
			host.setting.openTabById("zaptrace");
		}
	}

	registerWorkbench(view: WorkbenchHandle): () => void {
		this.workbench = view;
		return () => {
			if (this.workbench === view) this.workbench = null;
		};
	}

	/* ---------------- 索引 ---------------- */

	async rebuildIndex(): Promise<void> {
		if (this.rebuilding) return;
		this.rebuilding = true;
		try {
			const folder = (this.settings.cardFolder ?? "")
				.replace(/\\/g, "/")
				.replace(/^\/+|\/+$/g, "");
			const files = this.app.vault.getMarkdownFiles().filter((file) => {
				if (!folder) return true;
				return file.path === folder || file.path.startsWith(`${folder}/`);
			});
			const entries = await Promise.all(
				files.map(async (file) => ({
					path: file.path,
					content: await this.app.vault.cachedRead(file),
				}))
			);
			this.index = buildIndex(entries, {
				defaultSubject: this.settings.defaultSubject,
				cardFolder: this.settings.cardFolder,
			});
			this.syncStates();
			await this.maybeSeedTaxonomy();
			this.refreshAll();
		} catch (error) {
			console.error("[ZapTrace] 重建索引失败", error);
			new Notice("ZapTrace: 重建索引失败，详见控制台");
		} finally {
			this.rebuilding = false;
		}
	}

	/** 首次有题卡且未配置分类时，从题卡一次性播种 taxonomy（只读跳过）。 */
	private async maybeSeedTaxonomy(): Promise<void> {
		if (this.store.readOnly) return;
		const taxonomy = this.settings.taxonomy;
		if (taxonomy.seeded || taxonomy.categories.length > 0) return;
		if (this.index.cards.length === 0) return;
		const map = new Map<string, Map<string, Set<string>>>();
		for (const card of this.index.cards) {
			const category = card.category || "数学";
			const subjects = map.get(category) ?? new Map<string, Set<string>>();
			const subject = card.subject?.trim() ?? "";
			if (subject !== "") {
				const tags = subjects.get(subject) ?? new Set<string>();
				for (const tag of card.tags) if (tag.trim() !== "") tags.add(tag.trim());
				subjects.set(subject, tags);
			}
			map.set(category, subjects);
		}
		const sort = (items: string[]): string[] =>
			items.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
		const categories = [...map.entries()].map(([name, subjects]) => ({
			name,
			subjects: sort([...subjects.keys()]),
			subjectTags: Object.fromEntries(
				[...subjects.entries()].map(([subject, tags]) => [subject, sort([...tags])])
			),
		}));
		await this.saveSettings({
			...this.settings,
			taxonomy: { categories, seeded: true },
		});
	}

	private scheduleRebuild(): void {
		if (this.rebuildTimer !== null) clearTimeout(this.rebuildTimer);
		this.rebuildTimer = window.setTimeout(() => {
			this.rebuildTimer = null;
			void this.rebuildIndex();
		}, 500);
	}

	/**
	 * 同步卡片缓存到 data.json（仅缓存变化时保存，避免写放大，C11）。
	 */
	private syncStates(): void {
		const now = this.nowIso();
		const orphanBefore = Object.entries(this.data.questions)
			.map(([qid, state]) => `${qid}:${state.orphaned ? 1 : 0}`)
			.sort()
			.join(",");
		const cardSignature = this.index.cards
			.map(
				(card) =>
					`${card.key}|${card.qid}|${card.stemHash}|${card.file}|${card.subject}|` +
					`${card.tags.join(",")}|${card.source}|${card.starInitial ? 1 : 0}`
			)
			.sort()
			.join("\n");

		for (const card of this.index.cards) {
			ensureQuestionFromCard(this.data, card, now);
		}
		markOrphans(this.data, new Set(this.index.cards.map((card) => card.qid)));

		const orphanAfter = Object.entries(this.data.questions)
			.map(([qid, state]) => `${qid}:${state.orphaned ? 1 : 0}`)
			.sort()
			.join(",");
		const signature = `${cardSignature}\n#\n${orphanBefore}\n#\n${orphanAfter}`;
		this.data.meta.lastScanAt = now;
		if (signature !== this.lastSignature) {
			this.lastSignature = signature;
			this.store.markDirty();
		}
	}

	/* ---------------- 渲染 ---------------- */

	private renderCodeBlock(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): void {
		const filePath = ctx.sourcePath;
		const info = ctx.getSectionInfo(el);
		const startLine = info ? info.lineStart + 1 : 1;
		const endLine = info ? info.lineEnd + 1 : startLine;

		let card = this.findCardByLocation(filePath, startLine);
		if (!card) {
			const parsed = parseBlockInner(
				filePath,
				source.split(/\r?\n/),
				startLine,
				endLine,
				{ blockIndex: 0 }
			);
			card = parsed.card ?? undefined;
		}
		if (!card) return;

		// 每个代码块一个 RenderScope，由 ctx 管理生命周期；
		// 块被移除/视图卸载时 Obsidian 自动 unload，不会把插件实例当长期 owner。
		const owner = new RenderScope(el);
		ctx.addChild(owner);

		const inSourceView = Boolean(el.closest(".markdown-source-view"));
		if (inSourceView) {
			if (this.settings.livePreview === "source") return;
			renderQuestionCard({ plugin: this, card, host: el, owner, compact: true });
			return;
		}
		renderQuestionCard({ plugin: this, card, host: el, owner });
	}

	/* ---------------- 命令辅助 ---------------- */

	private practiceCurrentCard(editor: Editor, file: TFile | null): void {
		if (!file) return;
		const cursorLine = editor.getCursor().line + 1;
		const scanned = scanZaptraceBlocks(file.path, editor.getValue());
		const located = scanned.cards.find(
			(card) => cursorLine >= card.line && cursorLine <= card.endLine
		);
		if (!located) {
			new Notice("ZapTrace: 光标不在 zaptrace 题卡内");
			return;
		}
		const indexed =
			this.index.cards.find(
				(card) => card.file === located.file && card.line === located.line
			) ?? located;
		void this.startPractice([indexed]);
	}

	private randomPractice(): void {
		const cards = this.index.cards;
		if (cards.length === 0) {
			new Notice("ZapTrace: 还没有可练习的题卡");
			return;
		}
		const random = cards[Math.floor(Math.random() * cards.length)];
		void this.startPractice([random]);
	}

	private async writeBackup(name: string, content: string): Promise<void> {
		const dir = this.manifest.dir;
		if (!dir) return;
		await this.app.vault.adapter.write(`${dir}/${name}`, content);
	}
}
