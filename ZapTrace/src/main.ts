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
import { fixedTodayString, localIsoWithOffset, todayString } from "./core/date.ts";
import type {
	QuestionCard,
	QuestionState,
	ZaptraceData,
	ZaptraceSettings,
} from "./core/types.ts";
import { StateStore, type DataAdapter } from "./store/stateStore.ts";
import { renderQuestionCard } from "./view/card.ts";
import { RenderScope } from "./view/renderOwner.ts";
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
				editor.replaceSelection(`${QUESTION_TEMPLATE}\n`);
			},
		});

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

	refreshAll(): void {
		this.workbench?.refreshAll();
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
			this.refreshAll();
		} catch (error) {
			console.error("[ZapTrace] 重建索引失败", error);
			new Notice("ZapTrace: 重建索引失败，详见控制台");
		} finally {
			this.rebuilding = false;
		}
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
