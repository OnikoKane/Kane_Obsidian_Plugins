import type { App } from "obsidian";
import type {
	QuestionCard,
	QuestionState,
	ZaptraceData,
	ZaptraceSettings,
} from "../core/types.ts";

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

	openWorkbench(): Promise<void>;
	startPractice(cards: QuestionCard[]): Promise<void>;
	/** 打开题卡所在源文件并定位到 card.line-1 */
	openSource(card: QuestionCard): Promise<void>;
	rebuildIndex(): Promise<void>;
	saveSettings(next: ZaptraceSettings): Promise<void>;
	openSettings(): void;
	registerWorkbench(view: WorkbenchHandle): () => void;
}
