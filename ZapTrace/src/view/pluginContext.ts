import type { App } from "obsidian";
import type {
	QuestionCard,
	QuestionState,
	ZaptraceData,
	ZaptraceSettings,
} from "../core/types.ts";
import type { TagRename } from "../core/taxonomy.ts";

export interface WorkbenchHandle {
	refreshAll(): void;
	startPractice(cards: QuestionCard[]): void;
	setActiveTab(tab: "practice" | "library" | "review"): void;
}

/**
 * 视图层只依赖这个接口，不直接依赖 Plugin 类，避免循环依赖，
 * 也让视图可以脱离 Obsidian 单独推理（DOM 部分仍需 Obsidian 环境）。
 *
 * 注意：不暴露 `component`（插件实例）——MarkdownRenderer 的 owner
 * 必须由每次渲染自建的 RenderScope 承担（REVIEW-implementation §3-①）。
 */
export interface PluginContext {
	app: App;
	settings: ZaptraceSettings;
	data: ZaptraceData;

	today(): string;
	nowIso(): string;

	getCards(): QuestionCard[];
	getCardByQid(qid: string): QuestionCard | undefined;
	findCardByLocation(file: string, line: number): QuestionCard | undefined;
	getState(qid: string): QuestionState | undefined;

	/** 切换收藏；返回新状态（false 表示该 qid 不在索引里） */
	toggleStar(qid: string): boolean;
	requestSave(): void;
	refreshAll(): void;
	/** 是否只读（data.json 安全模式） */
	isReadOnly(): boolean;
	/** 目标文件的修改时间（epoch ms）；文件不存在返回 null（笔记时间 fallback） */
	getFileMtime(path: string): number | null;
	/** 持久化「答案与笔记」折叠开合（按 qid） */
	setFoldOpen(qid: string, open: boolean): void;
	/** 记住某题的笔记编辑框高度（px） */
	setNoteHeight(qid: string, height: number): void;
	/** 把标签并入「科目 > 子科目 > 小标签」库（settings.taxonomy） */
	rememberTags(category: string, subject: string, tags: string[]): void;
	/** 小标签重命名后，批量改写对应题卡的头部 tags；返回改写的题卡数 */
	syncTagRenames(renames: TagRename[]): Promise<number>;
	/** 删除题目：从源文件移除整个 zaptrace 块（确认后执行） */
	deleteCard(card: QuestionCard): Promise<{ ok: boolean; error?: string }>;
	/** 保存个人笔记：只替换目标 zaptrace 块的「### 个人笔记」节 */
	saveNotes(card: QuestionCard, notes: string): Promise<{ ok: boolean; error?: string; changed?: boolean }>;
	/** 保存分类与标签：只改目标 zaptrace 块头部 category/subject/tags */
	saveMetadata(
		card: QuestionCard,
		next: { category: string; subject: string; tags: string[] }
	): Promise<{ ok: boolean; error?: string; changed?: boolean }>;

	openWorkbench(): Promise<void>;
	startPractice(cards: QuestionCard[]): Promise<void>;
	/** 打开题卡所在源文件并定位到 card.line-1 */
	openSource(card: QuestionCard): Promise<void>;
	rebuildIndex(): Promise<void>;
	saveSettings(next: ZaptraceSettings): Promise<void>;
	openSettings(): void;
	registerWorkbench(view: WorkbenchHandle): () => void;
}
