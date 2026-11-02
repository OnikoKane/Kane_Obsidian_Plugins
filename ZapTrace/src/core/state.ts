import type {
	QuestionCard,
	QuestionState,
	Rating,
	ReviewEntry,
	ReviewLogEntry,
	ZaptraceData,
	ZaptraceMeta,
	ZaptraceSettings,
} from "./types.ts";
import { RATINGS } from "./types.ts";
import { clampStep, applyRating } from "./scheduler.ts";
import { addDays, isValidDateString } from "./date.ts";
import { createDefaultTaxonomy, normalizeTaxonomy } from "./taxonomy.ts";

/**
 * data.json 的结构、迁移与状态写入（DESIGN §9）。
 * 全部纯函数：接收数据、返回/修改数据，不接触 Obsidian API。
 */

export const CURRENT_SCHEMA_VERSION = 1;
export const MAX_REVIEW_LOG = 5000;
export const MAX_REVIEWS_PER_QUESTION = 20;

export const DEFAULT_SETTINGS: ZaptraceSettings = {
	cardFolder: "",
	defaultSubject: "",
	dateMode: "local",
	dailyReviewLimit: 20,
	requireAnswerBeforeReveal: false,
	livePreview: "compact",
	theme: "auto",
	taxonomy: createDefaultTaxonomy(),
};

export function createDefaultData(pluginVersion: string): ZaptraceData {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		settings: { ...DEFAULT_SETTINGS, taxonomy: createDefaultTaxonomy() },
		questions: {},
		reviewLog: [],
		meta: {
			lastScanAt: null,
			pluginVersion,
			logTruncated: 0,
		},
	};
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function asString(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function asInt(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

export function isRating(value: unknown): value is Rating {
	return typeof value === "string" && (RATINGS as readonly string[]).includes(value);
}

/** settings 深合并默认值：缺项补默认，已有合法值保留。 */
export function normalizeSettings(raw: unknown): ZaptraceSettings {
	const record = asRecord(raw) ?? {};
	const merged: ZaptraceSettings = { ...DEFAULT_SETTINGS };
	merged.cardFolder = asString(record.cardFolder, merged.cardFolder).trim();
	merged.defaultSubject = asString(record.defaultSubject, merged.defaultSubject).trim();
	const dateMode = asString(record.dateMode, merged.dateMode);
	merged.dateMode = dateMode === "fixed" ? "fixed" : "local";
	const limit = asInt(record.dailyReviewLimit, merged.dailyReviewLimit);
	merged.dailyReviewLimit = Math.max(1, Math.min(500, limit));
	merged.requireAnswerBeforeReveal = asBool(
		record.requireAnswerBeforeReveal,
		merged.requireAnswerBeforeReveal
	);
	const live = asString(record.livePreview, merged.livePreview);
	merged.livePreview = live === "source" ? "source" : "compact";
	const theme = asString(record.theme, merged.theme);
	merged.theme = theme === "mubu-dark" ? "mubu-dark" : "auto";
	merged.taxonomy = normalizeTaxonomy(record.taxonomy);
	// 前向兼容：保留未知设置字段，不因升级插件而丢弃
	const knownSettings = new Set(Object.keys(DEFAULT_SETTINGS));
	for (const [key, value] of Object.entries(record)) {
		if (!knownSettings.has(key)) (merged as unknown as Record<string, unknown>)[key] = value;
	}
	return merged;
}

function normalizeReviewEntry(raw: unknown): ReviewEntry | null {
	const record = asRecord(raw);
	if (!record) return null;
	if (!isRating(record.rating)) return null;
	const at = asString(record.at, "");
	const days = asInt(record.days, 0);
	const due = asString(record.due, "");
	if (!isValidDateString(due)) return null;
	return { at, rating: record.rating, days, due };
}

export function normalizeQuestionState(
	qid: string,
	raw: unknown,
	nowIso: string
): QuestionState {
	const record = asRecord(raw) ?? {};
	const reviewsRaw = Array.isArray(record.reviews) ? record.reviews : [];
	const reviews = reviewsRaw
		.map(normalizeReviewEntry)
		.filter((entry): entry is ReviewEntry => entry !== null)
		.slice(-MAX_REVIEWS_PER_QUESTION);
	const dueRaw = asString(record.due, "");
	const firstSeenRaw = record.firstSeenAt;
	const lastSeenRaw = record.lastSeenAt;
	const state: QuestionState = {
		id: qid,
		star: asBool(record.star, false),
		subject: asString(record.subject, ""),
		tags: asStringArray(record.tags),
		source: asString(record.source, ""),
		file: asString(record.file, ""),
		stemHash: asString(record.stemHash, ""),
		firstSeenAt: typeof firstSeenRaw === "string" ? firstSeenRaw : null,
		lastSeenAt: typeof lastSeenRaw === "string" ? lastSeenRaw : nowIso,
		step: clampStep(asInt(record.step, -1)),
		due: isValidDateString(dueRaw) ? dueRaw : null,
		lapses: Math.max(0, asInt(record.lapses, 0)),
		reviews,
		orphaned: asBool(record.orphaned, false),
		notesUpdatedAt:
			typeof record.notesUpdatedAt === "string" && record.notesUpdatedAt !== ""
				? record.notesUpdatedAt
				: null,
	};
	if (typeof record.foldOpen === "boolean") state.foldOpen = record.foldOpen;
	// 前向兼容：保留单题未知字段
	const knownState = new Set([
		"id",
		"star",
		"subject",
		"tags",
		"source",
		"file",
		"stemHash",
		"firstSeenAt",
		"lastSeenAt",
		"step",
		"due",
		"lapses",
		"reviews",
		"orphaned",
		"notesUpdatedAt",
		"foldOpen",
	]);
	for (const [key, value] of Object.entries(record)) {
		if (!knownState.has(key)) (state as unknown as Record<string, unknown>)[key] = value;
	}
	return state;
}

function normalizeReviewLogEntry(raw: unknown): ReviewLogEntry | null {
	const record = asRecord(raw);
	if (!record) return null;
	if (!isRating(record.rating)) return null;
	const qid = asString(record.qid, "");
	if (qid === "") return null;
	const elapsed = record.elapsedMs;
	return {
		qid,
		at: asString(record.at, ""),
		rating: record.rating,
		elapsedMs: typeof elapsed === "number" && Number.isFinite(elapsed) ? elapsed : null,
		subject: asString(record.subject, ""),
	};
}

export interface MigrationResult {
	data: ZaptraceData;
	fromVersion: number;
	migrated: boolean;
	/** 只读模式：版本高于当前插件，禁止覆盖写 */
	readOnly: boolean;
	/** 结构损坏：进入安全模式（只读索引） */
	structurallyInvalid: boolean;
	issues: string[];
}

/**
 * 迁移 0 → 1：v0 假设为「无 schemaVersion 的旧结构」，形状相同，
 * 仅补 schemaVersion 并保留 questions / reviewLog 全部历史（DESIGN §9.5）。
 */
export function migrate_0_to_1(raw: Record<string, unknown>): Record<string, unknown> {
	return { ...raw, schemaVersion: 1 };
}

export function migrateData(raw: unknown, pluginVersion: string): MigrationResult {
	const issues: string[] = [];

	// 缺失 data.json：首次运行
	if (raw === null || raw === undefined) {
		return {
			data: createDefaultData(pluginVersion),
			fromVersion: CURRENT_SCHEMA_VERSION,
			migrated: false,
			readOnly: false,
			structurallyInvalid: false,
			issues,
		};
	}

	const record = asRecord(raw);
	if (!record) {
		issues.push("data.json 顶层不是对象，已进入安全模式（只读索引，不写状态）");
		return {
			data: createDefaultData(pluginVersion),
			fromVersion: CURRENT_SCHEMA_VERSION,
			migrated: false,
			readOnly: true,
			structurallyInvalid: true,
			issues,
		};
	}

	const rawVersion =
		typeof record.schemaVersion === "number" && Number.isFinite(record.schemaVersion)
			? Math.trunc(record.schemaVersion)
			: 1;
	const fromVersion = rawVersion;
	const readOnly = rawVersion > CURRENT_SCHEMA_VERSION;
	if (readOnly) {
		issues.push(
			`data.json 的 schemaVersion=${rawVersion} 高于插件支持的 ${CURRENT_SCHEMA_VERSION}，已进入只读模式`
		);
	}

	let working: Record<string, unknown> = record;
	let version = rawVersion;
	let migrated = false;
	if (!readOnly && version < CURRENT_SCHEMA_VERSION) {
		try {
			while (version < CURRENT_SCHEMA_VERSION) {
				if (version === 0) {
					working = migrate_0_to_1(working);
					version = 1;
					migrated = true;
				} else {
					version = CURRENT_SCHEMA_VERSION;
				}
			}
		} catch (error) {
			issues.push(`迁移失败：${String(error)}，已进入安全模式`);
			return {
				data: createDefaultData(pluginVersion),
				fromVersion,
				migrated: false,
				readOnly: true,
				structurallyInvalid: true,
				issues,
			};
		}
	}

	const settings = normalizeSettings(working.settings);

	const questionsRecord = asRecord(working.questions);
	const questions: Record<string, QuestionState> = {};
	let structurallyInvalid = false;
	if (working.questions !== undefined && questionsRecord === null) {
		structurallyInvalid = true;
		issues.push("data.json.questions 不是对象，已按空状态加载");
	}
	if (questionsRecord) {
		const nowIso = new Date().toISOString();
		for (const [qid, value] of Object.entries(questionsRecord)) {
			questions[qid] = normalizeQuestionState(qid, value, nowIso);
		}
	}

	const reviewLogRaw = Array.isArray(working.reviewLog) ? working.reviewLog : [];
	const reviewLog = reviewLogRaw
		.map(normalizeReviewLogEntry)
		.filter((entry): entry is ReviewLogEntry => entry !== null);

	const metaRecord = asRecord(working.meta) ?? {};
	const meta: ZaptraceMeta = {
		lastScanAt: typeof metaRecord.lastScanAt === "string" ? metaRecord.lastScanAt : null,
		pluginVersion,
		logTruncated: Math.max(0, asInt(metaRecord.logTruncated, 0)),
	};
	if (migrated) meta.schemaMigratedFrom = fromVersion;
	// 前向兼容：保留 meta 里的未知字段
	const knownMeta = new Set([
		"lastScanAt",
		"pluginVersion",
		"logTruncated",
		"schemaMigratedFrom",
	]);
	for (const [key, value] of Object.entries(metaRecord)) {
		if (!knownMeta.has(key)) (meta as unknown as Record<string, unknown>)[key] = value;
	}

	const data: ZaptraceData = {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		settings,
		questions,
		reviewLog,
		meta,
	};
	// 前向兼容：保留顶层未知字段（不因插件升级而丢弃）
	const knownTop = new Set(["schemaVersion", "settings", "questions", "reviewLog", "meta"]);
	for (const [key, value] of Object.entries(working)) {
		if (!knownTop.has(key)) (data as unknown as Record<string, unknown>)[key] = value;
	}
	pruneReviewLog(data);

	// 结构损坏时必须只读，避免把损坏数据覆盖写回（安全模式）
	return {
		data,
		fromVersion,
		migrated,
		readOnly: readOnly || structurallyInvalid,
		structurallyInvalid,
		issues,
	};
}

/** reviewLog 超限时从头部删最旧，并累计 meta.logTruncated。 */
export function pruneReviewLog(data: ZaptraceData): number {
	const overflow = data.reviewLog.length - MAX_REVIEW_LOG;
	if (overflow <= 0) return 0;
	data.reviewLog.splice(0, overflow);
	data.meta.logTruncated += overflow;
	return overflow;
}

/** 把卡片缓存字段同步进状态；首次收录时初始化。 */
export function ensureQuestionFromCard(
	data: ZaptraceData,
	card: QuestionCard,
	nowIso: string
): QuestionState {
	const existing = data.questions[card.qid];
	if (!existing) {
		const created: QuestionState = {
			id: card.qid,
			star: card.starInitial,
			subject: card.subject,
			tags: [...card.tags],
			source: card.source,
			file: card.file,
			stemHash: card.stemHash,
			firstSeenAt: nowIso,
			lastSeenAt: nowIso,
			step: -1,
			due: null,
			lapses: 0,
			reviews: [],
			orphaned: false,
			notesUpdatedAt: null,
		};
		data.questions[card.qid] = created;
		return created;
	}
	existing.subject = card.subject;
	existing.tags = [...card.tags];
	existing.source = card.source;
	existing.file = card.file;
	existing.stemHash = card.stemHash;
	existing.lastSeenAt = nowIso;
	existing.orphaned = false;
	return existing;
}

export function setStar(data: ZaptraceData, qid: string, value: boolean): boolean {
	const state = data.questions[qid];
	if (!state) return false;
	state.star = value;
	return true;
}

export function toggleStar(data: ZaptraceData, qid: string): boolean {
	const state = data.questions[qid];
	if (!state) return false;
	state.star = !state.star;
	return state.star;
}

/** 索引里找不到的 qid 标 orphaned（不删除，DESIGN §4.4）。 */
export function markOrphans(data: ZaptraceData, liveQids: Set<string>): void {
	for (const [qid, state] of Object.entries(data.questions)) {
		state.orphaned = !liveQids.has(qid);
	}
}

export interface ReviewContext {
	/** 评分时刻的日历日 YYYY-MM-DD（DESIGN §8.3：跨 00:00 以评分时刻为准） */
	today: string;
	/** 带本地偏移的 ISO 时间戳 */
	at: string;
	elapsedMs: number | null;
}

export interface ReviewResult {
	state: QuestionState;
	days: number;
	due: string;
}

/**
 * 写入一次评分：更新 step / due / lapses / reviews / reviewLog（DESIGN §8、§9.3）。
 * 会直接修改传入的 data（Store 负责随后去抖保存）。
 */
export function recordReview(
	data: ZaptraceData,
	card: QuestionCard,
	rating: Rating,
	ctx: ReviewContext
): ReviewResult {
	const state = ensureQuestionFromCard(data, card, ctx.at);
	const outcome = applyRating(state.step, rating);
	const due = addDays(ctx.today, outcome.days);
	state.step = outcome.step;
	state.due = due;
	if (outcome.lapse) state.lapses += 1;
	state.lastSeenAt = ctx.at;

	const entry: ReviewEntry = {
		at: ctx.at,
		rating,
		days: outcome.days,
		due,
	};
	state.reviews.push(entry);
	if (state.reviews.length > MAX_REVIEWS_PER_QUESTION) {
		state.reviews.splice(0, state.reviews.length - MAX_REVIEWS_PER_QUESTION);
	}

	data.reviewLog.push({
		qid: card.qid,
		at: ctx.at,
		rating,
		elapsedMs: ctx.elapsedMs,
		subject: card.subject,
	});
	pruneReviewLog(data);

	return { state, days: outcome.days, due };
}
