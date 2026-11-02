/**
 * ZapTrace 核心类型定义。
 *
 * 重要边界：本文件与 core/ 下所有模块都是「纯逻辑」，**不得 import "obsidian"**，
 * 以便 tests/ 里的 node:test 单测可以在没有 Obsidian/Electron 的环境下运行。
 */

/** 四档回忆评分 */
export type Rating = "again" | "hard" | "good" | "easy";

export const RATINGS: readonly Rating[] = ["again", "hard", "good", "easy"] as const;

export const RATING_LABELS: Record<Rating, string> = {
	again: "忘记",
	hard: "困难",
	good: "想起",
	easy: "秒答",
};

/** 解析出来的一道题（派生数据，永远来自 Markdown，不落盘） */
export interface QuestionCard {
	/**
	 * 索引键（H1：索引键与状态键分离）：`${相对路径}#${块序号}`，
	 * 唯一标识「某个文件里的某个块」，同文重复题也不会互相覆盖。
	 */
	key: string;
	/** 块在文件内的序号（0-based） */
	blockIndex: number;
	/**
	 * 状态键：手写 id 或 auto:<hash>；重复者的 qid 会被确定性消歧
	 * （追加 -<locator6>），保证两张卡的状态互不共用。
	 */
	qid: string;
	/** 头部手写的 id（若有） */
	explicitId: string | null;
	/** 是否因重复 id 被重命名 */
	duplicateId: boolean;
	/** 大科目（category）；缺省推断「数学」（纯派生，不落 data.json） */
	category?: string;
	/** 子科目 */
	subject: string;
	tags: string[];
	source: string;
	difficulty: number | null;
	/** PDF 来源预留字段，首版只展示不筛选 */
	pdf: string;
	/** 未识别的头部键，原样保留 */
	extra: Record<string, string>;
	/** 头部 star: true，仅用于首次收录时的初始收藏值 */
	starInitial: boolean;
	stem: string;
	answer: string;
	notes: string;
	aiNotes: string;
	/** vault 内相对路径（含 .md） */
	file: string;
	/** 围栏起始行（1-based） */
	line: number;
	/** 围栏结束行（1-based） */
	endLine: number;
	/** 语法问题，例如「缺少答案分节」 */
	errors: string[];
	/** 题干规范化后的 sha1 前 12 位，用于检测题干被改 */
	stemHash: string;
}

export interface ReviewEntry {
	at: string;
	rating: Rating;
	days: number;
	due: string;
}

/** 持久状态（data.json.questions[qid]） */
export interface QuestionState {
	id: string;
	star: boolean;
	subject: string;
	tags: string[];
	source: string;
	file: string;
	stemHash: string;
	firstSeenAt: string | null;
	lastSeenAt: string | null;
	/** -1 = 从未练习；0..4 = 记忆阶梯 */
	step: number;
	/** 下次复习日期 YYYY-MM-DD；null = 未排期 */
	due: string | null;
	lapses: number;
	reviews: ReviewEntry[];
	orphaned: boolean;
	/** 个人笔记最后保存时间（本地 ISO）；无笔记/未保存过 → null */
	notesUpdatedAt: string | null;
	/** 「答案与笔记」折叠是否展开；undefined = 未设置（阅读默认关、题库默认开） */
	foldOpen?: boolean;
}

export type DateMode = "local" | "fixed";
export type LivePreviewMode = "compact" | "source";
export type ThemeMode = "auto" | "mubu-dark";

import type { TaxonomyConfig } from "./taxonomy.ts";

export interface ZaptraceSettings {
	/** 限定扫描目录；空 = 全库 */
	cardFolder: string;
	/** 卡片没有 subject 时使用；空则取文件夹名 */
	defaultSubject: string;
	dateMode: DateMode;
	dailyReviewLimit: number;
	/** 开启后需点「我写完了」才揭晓答案 */
	requireAnswerBeforeReveal: boolean;
	livePreview: LivePreviewMode;
	theme: ThemeMode;
	/** v3.2：分类配置（大科目 → 子科目）；只影响选择器，不改卡片 */
	taxonomy: TaxonomyConfig;
}

export interface ReviewLogEntry {
	qid: string;
	at: string;
	rating: Rating;
	elapsedMs: number | null;
	subject: string;
}

export interface ZaptraceMeta {
	lastScanAt: string | null;
	pluginVersion: string;
	/** reviewLog 被裁剪的累计条数 */
	logTruncated: number;
	/** 迁移来源版本（若发生过迁移） */
	schemaMigratedFrom?: number;
}

export interface ZaptraceData {
	schemaVersion: number;
	settings: ZaptraceSettings;
	questions: Record<string, QuestionState>;
	reviewLog: ReviewLogEntry[];
	meta: ZaptraceMeta;
}

/**
 * 时间筛选口径（C4）：
 * - today   : due == today（今天到期）
 * - overdue : due < today（已到期，不含今天）
 * - week    : today < due <= today+7（未来 7 天）
 * - unrated : 无排期（due 为空）
 */
export type TimeFilterKind = "all" | "today" | "overdue" | "week" | "unrated";

export interface CardFilter {
	search: string;
	/** 选中标签的交集（必须全部命中） */
	tags: string[];
	subject: string | null;
	time: TimeFilterKind;
	starredOnly: boolean;
}

export type SortKey = "due" | "starred" | "recent" | "subject";

export interface DueBadge {
	text: string;
	tone: "danger" | "accent" | "muted" | "none";
}

export interface ParseInputFile {
	path: string;
	content: string;
}
