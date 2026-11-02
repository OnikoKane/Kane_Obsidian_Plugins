import { test } from "node:test";
import assert from "node:assert/strict";

import { sha1Hex } from "../src/core/hash.ts";
import { deriveQid, isValidExplicitId, normalizeStem, stemHashOf } from "../src/core/id.ts";
import { addDays, diffDays, isValidDateString, todayString } from "../src/core/date.ts";
import { applyRating, previewDays, STEP_DAYS } from "../src/core/scheduler.ts";
import { parseBlockInner, scanZaptraceBlocks } from "../src/core/parse.ts";
import { buildIndex, dedupeCards, subjectFromPath } from "../src/core/index.ts";
import {
	createDefaultData,
	ensureQuestionFromCard,
	migrateData,
	normalizeQuestionState,
	pruneReviewLog,
	recordReview,
	setStar,
	toggleStar,
} from "../src/core/state.ts";
import { filterCards, sortCards } from "../src/core/filter.ts";
import { PracticeSession } from "../src/core/practice.ts";
import { dueBadge, intervalLabel } from "../src/core/format.ts";
import type { QuestionCard, Rating, ZaptraceData } from "../src/core/types.ts";

/* ---------------------------------------------------------------- *
 * SHA-1 / 稳定 ID
 * ---------------------------------------------------------------- */

test("sha1Hex 匹配标准测试向量", () => {
	assert.equal(sha1Hex(""), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
	assert.equal(sha1Hex("abc"), "a9993e364706816aba3e25717850c26c9cd0d89d");
	assert.equal(sha1Hex("中文 \$x^2\$"), sha1Hex("中文 \$x^2\$"));
	assert.equal(sha1Hex("a").length, 40);
});

test("normalizeStem 只规范化空白，不改大小写", () => {
	// 连续空格/制表符压成一个空格；行尾空白去掉；不改大小写
	assert.equal(normalizeStem("  A  +   B\t\tC  \n\n  D  \n"), " A + B C\n\n D");
	assert.notEqual(normalizeStem("X"), normalizeStem("x"));
	assert.equal(normalizeStem("\n\n题\n\n"), "题");
});

test("deriveQid 稳定、只依赖题干；stemHash 为 12 位", () => {
	const a = deriveQid("求 \$x^2\$ 的导数");
	const b = deriveQid("求 \$x^2\$ 的导数");
	assert.equal(a, b);
	assert.match(a, /^auto:[0-9a-f]{12}$/);
	assert.notEqual(deriveQid("题一"), deriveQid("题二"));
	assert.equal(stemHashOf("求 导").length, 12);
});

test("isValidExplicitId 只接受允许字符", () => {
	assert.equal(isValidExplicitId("2024-gaoshu-deriv-001"), true);
	assert.equal(isValidExplicitId("auto:abcd"), true);
	assert.equal(isValidExplicitId("有 空格"), false);
	assert.equal(isValidExplicitId(""), false);
});

/* ---------------------------------------------------------------- *
 * 日期边界（DESIGN 附录 B）
 * ---------------------------------------------------------------- */

test("addDays 跨月/跨年/闰年/平年/大月", () => {
	assert.equal(addDays("2026-01-31", 3), "2026-02-03");
	assert.equal(addDays("2026-12-30", 7), "2027-01-06");
	assert.equal(addDays("2028-02-28", 1), "2028-02-29");
	assert.equal(addDays("2027-02-28", 1), "2027-03-01");
	assert.equal(addDays("2026-11-02", 30), "2026-12-02");
	assert.equal(addDays("2026-11-02", 1), "2026-11-03");
	assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("isValidDateString 拒绝不存在的日期", () => {
	assert.equal(isValidDateString("2026-02-30"), false);
	assert.equal(isValidDateString("2026-13-01"), false);
	assert.equal(isValidDateString("2026-1-1"), false);
	assert.equal(isValidDateString("2028-02-29"), true);
	assert.equal(isValidDateString(null), false);
});

test("diffDays 与 todayString 基本正确", () => {
	assert.equal(diffDays("2026-11-02", "2026-11-05"), 3);
	assert.equal(diffDays("2026-12-31", "2027-01-01"), 1);
	assert.match(todayString(new Date(2026, 10, 2)), /^2026-11-02$/);
});

/* ---------------------------------------------------------------- *
 * 四档评分状态机（附录 B 全 12 条）
 * ---------------------------------------------------------------- */

test("STEP_DAYS 阶梯为 1/3/7/15/30", () => {
	assert.deepEqual([...STEP_DAYS], [1, 3, 7, 15, 30]);
});

test("附录 B 评分向量逐条匹配", () => {
	const vectors: Array<[number, Rating, number, number]> = [
		[-1, "again", -1, 1],
		[-1, "hard", -1, 1],
		[-1, "good", 0, 1],
		[-1, "easy", 1, 3],
		[0, "good", 1, 3],
		[1, "good", 2, 7],
		[2, "hard", 1, 3],
		[2, "easy", 4, 30],
		[4, "hard", 3, 15],
		[3, "good", 4, 30],
		[4, "easy", 4, 30],
		[0, "again", -1, 1],
	];
	for (const [step, rating, expectedStep, expectedDays] of vectors) {
		const outcome = applyRating(step, rating);
		assert.equal(outcome.step, expectedStep, `step ${step} ${rating} -> step`);
		assert.equal(outcome.days, expectedDays, `step ${step} ${rating} -> days`);
	}
	assert.equal(applyRating(2, "again").lapse, true);
	assert.equal(applyRating(2, "hard").lapse, false);
	assert.equal(previewDays(-1, "easy"), 3);
});

test("附录 B 期望 due 由 today=2026-11-02 推出", () => {
	const cases: Array<[number, Rating, string]> = [
		[-1, "again", "2026-11-03"],
		[-1, "easy", "2026-11-05"],
		[1, "good", "2026-11-09"],
		[2, "easy", "2026-12-02"],
		[4, "hard", "2026-11-17"],
	];
	for (const [step, rating, due] of cases) {
		const outcome = applyRating(step, rating);
		assert.equal(addDays("2026-11-02", outcome.days), due);
	}
});

/* ---------------------------------------------------------------- *
 * 解析器
 * ---------------------------------------------------------------- */

function demoCardMarkdown(): string {
	return [
		"```zaptrace",
		"id: q-1",
		"subject: 高等数学",
		"tags: 导数、 极限, 导数",
		"source: 高等数学 第七版 p.86: 例3",
		"difficulty: 3",
		"star: true",
		"---",
		"",
		"### 题干",
		"",
		"求 $f(x)=x^{2}$ 在 $x=1$ 处的导数。",
		"",
		"### 答案",
		"",
		"$f'(1)=2$。",
		"",
		"### 个人笔记",
		"",
		"- 先增量比再取极限",
		"",
		"### AI 笔记",
		"",
		"> 常见错误：把导数当函数值之差。",
		"```",
	].join("\n");
}

test("解析四节题卡与头部字段", () => {
	const scanned = scanZaptraceBlocks("高数/第二章.md", demoCardMarkdown());
	assert.equal(scanned.cards.length, 1);
	const card = scanned.cards[0];
	assert.equal(card.qid, "q-1");
	assert.equal(card.explicitId, "q-1");
	assert.equal(card.subject, "高等数学");
	assert.deepEqual(card.tags, ["导数", "极限"]);
	assert.equal(card.source, "高等数学 第七版 p.86: 例3");
	assert.equal(card.difficulty, 3);
	assert.equal(card.starInitial, true);
	assert.match(card.stem, /x\^\{2\}/);
	assert.equal(card.answer, "$f'(1)=2$。");
	assert.match(card.notes, /先增量比/);
	assert.match(card.aiNotes, /常见错误/);
	assert.deepEqual(card.errors, []);
	assert.equal(card.line, 1);
	assert.equal(card.stemHash.length, 12);
});

test("未知头部键保留进 extra；缺 --- 时按开头 key: value 识别", () => {
	const md = [
		"```zaptrace",
		"subject: 线性代数",
		"chapter: 3",
		"### 题干",
		"判断矩阵是否可逆。",
		"### 答案",
		"看行列式。",
		"```",
	].join("\n");
	const card = scanZaptraceBlocks("线代.md", md).cards[0];
	assert.equal(card.subject, "线性代数");
	assert.equal(card.extra.chapter, "3");
	assert.match(card.stem, /判断矩阵/);
});

test("缺 ### 答案 时给出错误但不丢弃卡片", () => {
	const md = ["```zaptrace", "### 题干", "只有题干。", "```"].join("\n");
	const card = scanZaptraceBlocks("x.md", md).cards[0];
	assert.equal(card.stem.trim(), "只有题干。");
	assert.equal(card.answer, "");
	assert.ok(card.errors.some((e) => e.includes("缺少答案分节")));
});

test("完全无分节时整段作题干并告警", () => {
	const md = ["```zaptrace", "subject: 概率论", "一道没有分节的题。", "```"].join("\n");
	const card = scanZaptraceBlocks("x.md", md).cards[0];
	assert.equal(card.stem.trim(), "一道没有分节的题。");
	assert.ok(card.errors.some((e) => e.includes("缺少答案分节")));
});

test("空代码块被忽略", () => {
	const md = ["```zaptrace", "```", "", "```zaptrace", "   ", "```"].join("\n");
	const result = scanZaptraceBlocks("x.md", md);
	assert.equal(result.cards.length, 0);
	assert.equal(result.skippedBlocks, 2);
});

test("外层四反引号时，答案内的三反引号代码块不截断卡片", () => {
	const md = [
		"````zaptrace",
		"id: code-1",
		"---",
		"### 题干",
		"阅读代码输出。",
		"### 答案",
		"```ts",
		"const a = 1;",
		"```",
		"````",
	].join("\n");
	const scanned = scanZaptraceBlocks("code.md", md);
	assert.equal(scanned.cards.length, 1);
	assert.match(scanned.cards[0].answer, /const a = 1/);
	assert.equal(scanned.cards[0].qid, "code-1");
});

test("同一文件两道无 id 同题干：自动隔离为 -2，状态不共用", () => {
	const block = ["```zaptrace", "### 题干", "完全相同的题干。", "### 答案", "答。", "```"].join(
		"\n"
	);
	const md = [block, "", block].join("\n");
	const scanned = scanZaptraceBlocks("dup.md", md);
	assert.equal(scanned.cards.length, 2);
	// 解析阶段两张卡的原始 qid 相同（auto hash 只依赖题干）
	assert.equal(scanned.cards[0].qid, scanned.cards[1].qid);
	// 索引键不同 → 不会 Map 覆盖丢卡（H1）
	assert.notEqual(scanned.cards[0].key, scanned.cards[1].key);
	const deduped = dedupeCards(scanned.cards);
	assert.equal(deduped.length, 2);
	assert.equal(new Set(deduped.map((c) => c.qid)).size, 2);
	assert.equal(deduped[1].duplicateId, true);
	assert.match(deduped[1].qid, /^auto:[0-9a-f]{12}-[0-9a-f]{6}$/);
	assert.ok(deduped[1].errors.some((e) => e.includes("重复题干")));

	// 状态隔离：两张卡的 qid 不同 → 状态记录互不覆盖
	const data = createDefaultData("0.1.0");
	ensureQuestionFromCard(data, deduped[0], "2026-11-02T10:00:00+08:00");
	ensureQuestionFromCard(data, deduped[1], "2026-11-02T10:00:00+08:00");
	assert.equal(Object.keys(data.questions).length, 2);
	recordReview(data, deduped[0], "good", {
		today: "2026-11-02",
		at: "2026-11-02T10:05:00+08:00",
		elapsedMs: 1000,
	});
	assert.equal(data.questions[deduped[0].qid].step, 0);
	assert.equal(data.questions[deduped[1].qid].step, -1);
});

test("显式 id 与派生后缀碰撞时确定性避让", () => {
	const cards: QuestionCard[] = [
		parseBlockInner("a.md", ["id: dup", "---", "### 题干", "甲", "### 答案", "1"], 1, 1)
			.card as QuestionCard,
		parseBlockInner("b.md", ["id: dup-2", "---", "### 题干", "乙", "### 答案", "2"], 1, 1)
			.card as QuestionCard,
		parseBlockInner("c.md", ["id: dup", "---", "### 题干", "丙", "### 答案", "3"], 1, 1)
			.card as QuestionCard,
	];
	const deduped = dedupeCards(cards);
	assert.equal(deduped[0].qid, "dup");
	assert.equal(deduped[1].qid, "dup-2"); // 独立的显式 id，不受重复隔离影响
	assert.match(deduped[2].qid, /^dup-[0-9a-f]{6}$/);
	assert.equal(deduped[2].duplicateId, true);
	assert.equal(new Set(deduped.map((card) => card.qid)).size, 3);

	// H2：结果与输入顺序无关（重排文件不会改变状态归属）
	const shuffled = dedupeCards([cards[2], cards[1], cards[0]]);
	const byOriginal = new Map<string, string>();
	for (const card of deduped) byOriginal.set(card.key, card.qid);
	for (const card of shuffled) {
		assert.equal(byOriginal.get(card.key), card.qid, "同一卡实例在重排后 qid 不变");
	}
});

test("buildIndex 排序稳定并填充缺省科目", () => {
	const a = ["```zaptrace", "### 题干", "B 题", "### 答案", "b", "```"].join("\n");
	const b = ["```zaptrace", "### 题干", "A 题", "### 答案", "a", "```"].join("\n");
	const index = buildIndex([
		{ path: "概率论/z.md", content: a },
		{ path: "高数/a.md", content: b },
		{ path: "高数/skip.txt", content: "not markdown" },
	]);
	assert.equal(index.scannedFiles, 2);
	assert.deepEqual(
		index.cards.map((card) => card.file),
		["概率论/z.md", "高数/a.md"]
	);
	assert.equal(index.cards[0].subject, "概率论");
	assert.equal(subjectFromPath("根文件.md"), "未分类");
});

/* ---------------------------------------------------------------- *
 * data.json 迁移与状态
 * ---------------------------------------------------------------- */

test("首次运行生成 schemaVersion 1 与默认设置", () => {
	const result = migrateData(null, "0.1.0");
	assert.equal(result.data.schemaVersion, 1);
	assert.equal(result.data.settings.dailyReviewLimit, 20);
	assert.equal(result.data.settings.theme, "auto");
	assert.equal(result.migrated, false);
});

test("schemaVersion 0 迁移保留 reviews / reviewLog", () => {
	const raw = {
		schemaVersion: 0,
		questions: {
			q1: {
				star: true,
				step: 1,
				due: "2026-11-05",
				lapses: 2,
				reviews: [{ at: "2026-11-01T09:00:00+08:00", rating: "good", days: 1, due: "2026-11-02" }],
			},
		},
		reviewLog: [
			{ qid: "q1", at: "2026-11-01T09:00:00+08:00", rating: "good", elapsedMs: 10, subject: "高数" },
		],
	};
	const result = migrateData(raw, "0.1.0");
	assert.equal(result.migrated, true);
	assert.equal(result.fromVersion, 0);
	assert.equal(result.data.schemaVersion, 1);
	assert.equal(result.data.questions.q1.reviews.length, 1);
	assert.equal(result.data.reviewLog.length, 1);
	assert.equal(result.data.questions.q1.lapses, 2);
	assert.equal(result.data.meta.schemaMigratedFrom, 0);
});

test("结构损坏进入安全模式", () => {
	const brokenQuestions = migrateData({ schemaVersion: 1, questions: "oops" }, "0.1.0");
	assert.equal(brokenQuestions.structurallyInvalid, true);

	const notObject = migrateData([1, 2, 3], "0.1.0");
	assert.equal(notObject.structurallyInvalid, true);
	assert.equal(notObject.readOnly, true);
});

test("未来版本只读", () => {
	const future = migrateData({ schemaVersion: 99, questions: {} }, "0.1.0");
	assert.equal(future.readOnly, true);
	assert.equal(future.data.schemaVersion, 1);
});

test("reviewLog 超 5000 裁剪最旧并记 logTruncated", () => {
	const data = createDefaultData("0.1.0");
	for (let i = 0; i < 5005; i++) {
		data.reviewLog.push({
			qid: `q${i}`,
			at: "2026-11-02T10:00:00+08:00",
			rating: "good",
			elapsedMs: null,
			subject: "x",
		});
	}
	const removed = pruneReviewLog(data);
	assert.equal(removed, 5);
	assert.equal(data.reviewLog.length, 5000);
	assert.equal(data.meta.logTruncated, 5);
	assert.equal(data.reviewLog[0].qid, "q5");
});

test("单卡 reviews 超过 20 条裁剪最旧", () => {
	const reviews = Array.from({ length: 25 }, (_, i) => ({
		at: `2026-11-01T09:00:${String(i).padStart(2, "0")}+08:00`,
		rating: "good",
		days: 1,
		due: "2026-11-02",
	}));
	const state = normalizeQuestionState("q", { reviews }, "2026-11-02T00:00:00+08:00");
	assert.equal(state.reviews.length, 20);
});

test("recordReview 写入 step/due/lapses/reviews/reviewLog", () => {
	const card = scanZaptraceBlocks(
		"a.md",
		["```zaptrace", "id: card-1", "### 题干", "题", "### 答案", "答", "```"].join("\n")
	).cards[0];
	const data = createDefaultData("0.1.0");
	const first = recordReview(data, card, "good", {
		today: "2026-11-02",
		at: "2026-11-02T14:10:33+08:00",
		elapsedMs: 42000,
	});
	assert.equal(first.state.step, 0);
	assert.equal(first.due, "2026-11-03");
	assert.equal(first.state.lapses, 0);
	assert.equal(first.state.reviews.length, 1);
	assert.equal(data.reviewLog.length, 1);

	const second = recordReview(data, card, "again", {
		today: "2026-11-03",
		at: "2026-11-03T09:00:00+08:00",
		elapsedMs: null,
	});
	assert.equal(second.state.step, -1);
	assert.equal(second.due, "2026-11-04");
	assert.equal(second.state.lapses, 1);
});

test("Star 初始值与切换", () => {
	const card = scanZaptraceBlocks(
		"a.md",
		["```zaptrace", "id: s1", "star: true", "### 题干", "题", "### 答案", "答", "```"].join("\n")
	).cards[0];
	const data = createDefaultData("0.1.0");
	const state = ensureQuestionFromCard(data, card, "2026-11-02T00:00:00+08:00");
	assert.equal(state.star, true);
	assert.equal(setStar(data, "s1", false), true);
	assert.equal(data.questions.s1.star, false);
	assert.equal(toggleStar(data, "s1"), true);
	assert.equal(toggleStar(data, "missing"), false);
});

/* ---------------------------------------------------------------- *
 * 筛选与排序
 * ---------------------------------------------------------------- */

function makeCard(qid: string, stem: string, tags: string[], subject: string): QuestionCard {
	return {
		key: `${subject}.md#0`,
		blockIndex: 0,
		qid,
		explicitId: qid,
		duplicateId: false,
		subject,
		tags,
		source: "",
		difficulty: null,
		pdf: "",
		extra: {},
		starInitial: false,
		stem,
		answer: "答",
		notes: "",
		aiNotes: "",
		file: `${subject}.md`,
		line: 1,
		endLine: 5,
		errors: [],
		stemHash: "0123456789ab",
	};
}

test("筛选：Tags 交集、搜索、科目、时间、收藏", () => {
	const data = createDefaultData("0.1.0");
	const cards = [
		makeCard("a", "求导数的定义", ["导数", "极限"], "高数"),
		makeCard("b", "矩阵可逆判断", ["矩阵"], "线代"),
		makeCard("c", "级数收敛", ["级数", "极限"], "高数"),
	];
	for (const card of cards) ensureQuestionFromCard(data, card, "2026-11-02T00:00:00+08:00");
	data.questions.a.due = "2026-11-02";
	data.questions.a.star = true;
	data.questions.b.due = "2026-11-05";
	data.questions.c.due = null;

	const today = "2026-11-02";
	const byTags = filterCards(cards, data, { ...empty(), tags: ["极限", "导数"] }, today);
	assert.deepEqual(byTags.map((c) => c.qid), ["a"]);

	const bySearch = filterCards(cards, data, { ...empty(), search: "矩阵" }, today);
	assert.deepEqual(bySearch.map((c) => c.qid), ["b"]);

	const bySubject = filterCards(cards, data, { ...empty(), subject: "高数" }, today);
	assert.deepEqual(bySubject.map((c) => c.qid), ["a", "c"]);

	const overdue = filterCards(cards, data, { ...empty(), time: "overdue" }, today);
	assert.deepEqual(overdue.map((c) => c.qid), []);

	const todayOnly = filterCards(cards, data, { ...empty(), time: "today" }, today);
	assert.deepEqual(todayOnly.map((c) => c.qid), ["a"]);

	const week = filterCards(cards, data, { ...empty(), time: "week" }, today);
	assert.deepEqual(week.map((c) => c.qid), ["b"]);

	const unrated = filterCards(cards, data, { ...empty(), time: "unrated" }, today);
	assert.deepEqual(unrated.map((c) => c.qid), ["c"]);

	const starred = filterCards(cards, data, { ...empty(), starredOnly: true }, today);
	assert.deepEqual(starred.map((c) => c.qid), ["a"]);
});

test("排序：到期升序（未排期在后）、收藏优先、科目", () => {
	const data = createDefaultData("0.1.0");
	const cards = [
		makeCard("n", "无排期", [], "高数"),
		makeCard("late", "晚到期", [], "高数"),
		makeCard("soon", "早到期", [], "线代"),
	];
	for (const card of cards) ensureQuestionFromCard(data, card, "2026-11-02T00:00:00+08:00");
	data.questions.n.due = null;
	data.questions.late.due = "2026-11-09";
	data.questions.soon.due = "2026-11-03";
	data.questions.soon.star = true;

	assert.deepEqual(
		sortCards(cards, data, "due", "2026-11-02").map((c) => c.qid),
		["soon", "late", "n"]
	);
	assert.deepEqual(
		sortCards(cards, data, "starred", "2026-11-02").map((c) => c.qid),
		["soon", "late", "n"]
	);
	assert.deepEqual(
		sortCards(cards, data, "subject", "2026-11-02").map((c) => c.subject),
		["高数", "高数", "线代"] // zh 拼音序：高 < 线
	);
});

test("到期徽标与间隔文案", () => {
	const state = normalizeQuestionState("q", { due: "2026-11-02" }, "2026-11-02T00:00:00+08:00");
	assert.equal(dueBadge(state, "2026-11-02").text, "今天");
	assert.equal(dueBadge(state, "2026-11-03").text, "已到期");
	const tomorrow = normalizeQuestionState("q", { due: "2026-11-03" }, "2026-11-02T00:00:00+08:00");
	assert.equal(dueBadge(tomorrow, "2026-11-02").text, "明天");
	assert.equal(dueBadge(undefined, "2026-11-02").text, "未练");
	assert.equal(intervalLabel(1), "明天");
	assert.equal(intervalLabel(7), "7 天后");
});

/* ---------------------------------------------------------------- *
 * H3 / C1 / C2 解析边界回归
 * ---------------------------------------------------------------- */

test("H3 无头部时题干里的 --- 不会被误当分隔符", () => {
	const md = [
		"```zaptrace",
		"### 题干",
		"第一段",
		"",
		"---",
		"",
		"第二段",
		"",
		"### 答案",
		"答",
		"```",
	].join("\n");
	const card = scanZaptraceBlocks("h3.md", md).cards[0];
	assert.match(card.stem, /第一段/);
	assert.match(card.stem, /---/);
	assert.match(card.stem, /第二段/);
	assert.equal(card.answer, "答");
	assert.deepEqual(card.extra, {});
});

test("H3 头部态遇到非 key 行立即结束头部，内容不丢", () => {
	const md = [
		"```zaptrace",
		"id: keep-1",
		"subject: 高数",
		"---",
		"### 题干",
		"题面",
		"### 答案",
		"答",
		"```",
	].join("\n");
	const card = scanZaptraceBlocks("h3b.md", md).cards[0];
	assert.equal(card.qid, "keep-1");
	assert.equal(card.subject, "高数");
	assert.equal(card.stem.trim(), "题面");
});

test("C1 分节标题允许无空格/多空格/缩进", () => {
	const md = [
		"```zaptrace",
		"  ###题干",
		"  题面",
		"  ###   答案",
		"  答",
		"```",
	].join("\n");
	const card = scanZaptraceBlocks("c1.md", md).cards[0];
	assert.equal(card.stem.trim(), "题面");
	assert.equal(card.answer.trim(), "答");
});

test("C2 只有答案没有题干 → 卡片保留并报错", () => {
	const md = ["```zaptrace", "### 答案", "只有答案", "```"].join("\n");
	const card = scanZaptraceBlocks("c2.md", md).cards[0];
	assert.equal(card.answer.trim(), "只有答案");
	assert.ok(card.errors.some((e) => e.includes("缺少题干分节")));
});

test("文档示例块里的 ```zaptrace 不进入索引（围栏跟踪）", () => {
	const md = [
		"````markdown",
		"```zaptrace",
		"### 题干",
		"这是文档里的示例，不应被索引。",
		"### 答案",
		"示例答案",
		"```",
		"````",
		"",
		"```js",
		"const zaptrace = 1;",
		"```",
		"",
		"```zaptrace",
		"id: real-1",
		"### 题干",
		"这是真正的题。",
		"### 答案",
		"真答案",
		"```",
	].join("\n");
	const result = scanZaptraceBlocks("docs.md", md);
	assert.equal(result.cards.length, 1);
	assert.equal(result.cards[0].qid, "real-1");
	assert.match(result.cards[0].stem, /真正的题/);
	assert.equal(result.cards[0].blockIndex, 0);
});

/* ---------------------------------------------------------------- *
 * H4 练习门禁：未揭晓不得评分、不得写盘
 * ---------------------------------------------------------------- */

test("H4 未揭晓时 rate() 返回 null 且不写 data.json", () => {
	const card = scanZaptraceBlocks(
		"h4.md",
		["```zaptrace", "id: h4-1", "### 题干", "题", "### 答案", "答", "```"].join("\n")
	).cards[0];
	const data = createDefaultData("0.1.0");
	const session = new PracticeSession([card]);
	assert.equal(session.phase, "viewing");
	assert.equal(session.canRate, false);

	const blocked = session.rate(data, "good", {
		today: "2026-11-02",
		at: "2026-11-02T14:00:00+08:00",
		elapsedMs: null,
	});
	assert.equal(blocked, null);
	assert.equal(Object.keys(data.questions).length, 0);
	assert.equal(data.reviewLog.length, 0);
	assert.equal(session.phase, "viewing");

	assert.equal(session.reveal(), true);
	const ok = session.rate(data, "good", {
		today: "2026-11-02",
		at: "2026-11-02T14:00:10+08:00",
		elapsedMs: 10000,
	});
	assert.ok(ok);
	assert.equal(ok?.state.step, 0);
	assert.equal(ok?.due, "2026-11-03");
	assert.equal(data.reviewLog.length, 1);

	// 已评分后重复评分同样被拒
	assert.equal(
		session.rate(data, "easy", {
			today: "2026-11-02",
			at: "2026-11-02T14:00:20+08:00",
			elapsedMs: null,
		}),
		null
	);
	assert.equal(data.reviewLog.length, 1);
	assert.equal(session.advance(), false);
	assert.equal(session.finished, true);
});

test("H4 跳过不写 data.json", () => {
	const card = scanZaptraceBlocks(
		"h4b.md",
		["```zaptrace", "id: h4-2", "### 题干", "题", "### 答案", "答", "```"].join("\n")
	).cards[0];
	const data = createDefaultData("0.1.0");
	const session = new PracticeSession([card]);
	session.markShown(1000);
	assert.equal(session.skip(), false);
	assert.equal(session.finished, true);
	assert.equal(Object.keys(data.questions).length, 0);
	assert.equal(data.reviewLog.length, 0);
});

/* 小工具 */
function empty() {
	return { search: "", tags: [] as string[], subject: null, time: "all" as const, starredOnly: false };
}
