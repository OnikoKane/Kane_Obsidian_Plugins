import { test } from "node:test";
import assert from "node:assert/strict";

import { replacePersonalNotes } from "../src/core/notes.ts";
import { scanZaptraceBlocks } from "../src/core/parse.ts";
import { buildIndex } from "../src/core/index.ts";
import { ensureQuestionFromCard, normalizeQuestionState } from "../src/core/state.ts";
import { createDefaultData } from "../src/core/state.ts";

function block(parts: {
	category?: string;
	subject?: string;
	answer?: string;
	notes?: string;
	aiNotes?: string;
}): string {
	const lines = ["```zaptrace"];
	if (parts.category) lines.push(`category: ${parts.category}`);
	if (parts.subject) lines.push(`subject: ${parts.subject}`);
	lines.push("---", "", "### 题干", "", "题干内容", "", "### 答案", "", parts.answer ?? "答案内容");
	if (parts.notes !== undefined) {
		lines.push("", "### 个人笔记", "", ...(parts.notes ? [parts.notes] : []));
	}
	if (parts.aiNotes !== undefined) {
		lines.push("", "### AI 笔记", "", parts.aiNotes);
	}
	lines.push("```");
	return lines.join("\n");
}

function locator(markdown: string, index = 0) {
	const cards = scanZaptraceBlocks("t.md", markdown).cards;
	return { line: cards[index].line, endLine: cards[index].endLine };
}

test("category：显式解析、缺省推断数学、subject 仍为子科目", () => {
	const md = [block({ category: "英语", subject: "阅读理解" }), block({ subject: "高等数学" })].join(
		"\n\n"
	);
	const scanned = scanZaptraceBlocks("t.md", md);
	assert.equal(scanned.cards[0].category, "英语");
	assert.equal(scanned.cards[1].category, "");
	const index = buildIndex([{ path: "t.md", content: md }]);
	assert.equal(index.categories.length, 2);
	assert.ok(index.categories.includes("数学"));
	assert.ok(index.categories.includes("英语"));
	assert.equal(index.cards[1].category, "数学");
	assert.equal(index.cards[0].subject, "阅读理解");
});

test("QuestionState：旧数据缺省 notesUpdatedAt=null、foldOpen=undefined、未知字段保留", () => {
	const old = normalizeQuestionState("q1", { step: 1, legacy: "keep" }, "2026-11-02T00:00:00+08:00");
	assert.equal(old.notesUpdatedAt, null);
	assert.equal(old.foldOpen, undefined);
	assert.equal((old as unknown as Record<string, unknown>).legacy, "keep");
	const filled = normalizeQuestionState(
		"q2",
		{ notesUpdatedAt: "2026-11-02T10:00:00+08:00", foldOpen: false },
		"2026-11-02T00:00:00+08:00"
	);
	assert.equal(filled.notesUpdatedAt, "2026-11-02T10:00:00+08:00");
	assert.equal(filled.foldOpen, false);
});

test("新建状态：notesUpdatedAt=null 且不写 foldOpen", () => {
	const card = scanZaptraceBlocks("t.md", block({})).cards[0];
	const data = createDefaultData("0.1.0");
	const state = ensureQuestionFromCard(data, card, "2026-11-02T00:00:00+08:00");
	assert.equal(state.notesUpdatedAt, null);
	assert.equal(Object.prototype.hasOwnProperty.call(state, "foldOpen"), false);
});

test("笔记：替换已有节，其它行逐字节不变", () => {
	const md = block({ answer: "答案内容", notes: "- 旧笔记" });
	const before = md.split("\n");
	const result = replacePersonalNotes(md, locator(md), "- 新笔记：先增量比");
	assert.equal(result.changed, true);
	assert.match(result.content, /- 新笔记：先增量比/);
	assert.doesNotMatch(result.content, /- 旧笔记/);
	// 答案与题干不变
	assert.match(result.content, /答案内容/);
	assert.match(result.content, /题干内容/);
	// 除笔记节内容外，标题与其它分节顺序保持不变
	const after = result.content.split("\n");
	assert.equal(after.length, before.length);
	assert.equal(after[0], before[0]);
	assert.equal(after[after.length - 1], before[before.length - 1]);
});

test("笔记：无笔记节 + 有答案节 → 在答案节后插入", () => {
	const md = block({ answer: "答案内容" });
	const result = replacePersonalNotes(md, locator(md), "新笔记");
	assert.equal(result.changed, true);
	const idxAnswer = result.content.indexOf("### 答案");
	const idxNotes = result.content.indexOf("### 个人笔记");
	assert.ok(idxNotes > idxAnswer);
	assert.match(result.content, /新笔记/);
});

test("笔记：无分节块 → 闭栏前插入，正文不变", () => {
	const md = ["```zaptrace", "只有一段正文，没有分节。", "```"].join("\n");
	const ref = locator(md);
	const result = replacePersonalNotes(md, ref, "补充笔记");
	assert.equal(result.changed, true);
	assert.match(result.content, /只有一段正文，没有分节。/);
	const idxNotes = result.content.indexOf("### 个人笔记");
	const idxFence = result.content.lastIndexOf("```");
	assert.ok(idxNotes > 0 && idxNotes < idxFence);
});

test("笔记：空笔记保存清空节；无笔记且无节 → changed=false", () => {
	const md = block({ notes: "- 旧笔记" });
	const cleared = replacePersonalNotes(md, locator(md), "   ");
	assert.equal(cleared.changed, true);
	assert.doesNotMatch(cleared.content, /旧笔记/);
	const md2 = block({});
	const result2 = replacePersonalNotes(md2, locator(md2), "");
	assert.equal(result2.changed, false);
	assert.equal(result2.content, md2);
});

test("笔记：CRLF 全文保持 CRLF，混合 EOL 逐行保留", () => {
	const md = block({ notes: "- 旧" }).replace(/\n/g, "\r\n");
	const result = replacePersonalNotes(md, locator(md), "- 新\r\n- 第二行");
	assert.equal(result.changed, true);
	assert.equal(result.content.includes("\r\n"), true);
	assert.equal(/[^\r]\n/.test(result.content), false);
	// 混合 EOL：块外行原样
	const mixed = "前言\n" + block({ notes: "- 旧" }) + "\r\n结尾";
	const mixedResult = replacePersonalNotes(mixed, locator(mixed), "- 新");
	assert.ok(mixedResult.content.startsWith("前言\n"));
	assert.ok(mixedResult.content.endsWith("\r\n结尾"));
});

test("笔记：4 反引号外层 + 内含 3 反引号代码，块边界正确", () => {
	const md = [
		"````zaptrace",
		"### 题干",
		"题",
		"### 答案",
		"```ts",
		"const a = 1;",
		"```",
		"````",
	].join("\n");
	const result = replacePersonalNotes(md, locator(md), "笔记");
	assert.equal(result.changed, true);
	assert.match(result.content, /const a = 1;/);
	assert.match(result.content, /### 个人笔记/);
});

test("笔记：整体缩进 4 空格，新行沿用缩进，块外不变", () => {
	const md = ["    ```zaptrace", "    ### 题干", "    题", "    ### 答案", "    答", "    ```"].join(
		"\n"
	);
	// 4 空格围栏不属于 CommonMark 顶层围栏，这里直接给出块位置（notes 函数按 ref 工作）
	const result = replacePersonalNotes(md, { line: 1, endLine: 6 }, "- 笔记");
	assert.equal(result.changed, true);
	assert.match(result.content, /^ {4}### 个人笔记/m);
	assert.match(result.content, /^ {4}- 笔记/m);
});

test("笔记：同文件 3 块只改第 2 块，第 1/3 块逐字节不变", () => {
	const b1 = block({ notes: "- 一" });
	const b2 = block({ notes: "- 二" });
	const b3 = block({ notes: "- 三" });
	const md = [b1, "", b2, "", b3].join("\n");
	const cards = scanZaptraceBlocks("t.md", md).cards;
	const result = replacePersonalNotes(
		md,
		{ line: cards[1].line, endLine: cards[1].endLine },
		"- 二改"
	);
	assert.equal(result.changed, true);
	assert.ok(result.content.startsWith(b1));
	assert.ok(result.content.endsWith(b3));
	assert.match(result.content, /- 二改/);
});

test("笔记：行号错/非 zaptrace 返回 error，原文返回", () => {
	const md = block({});
	const bad = replacePersonalNotes(md, { line: 999, endLine: 1000 }, "x");
	assert.equal(bad.error, "block_not_found");
	assert.equal(bad.content, md);
	const notFence = replacePersonalNotes("普通文本\n第二行", { line: 1, endLine: 2 }, "x");
	assert.equal(notFence.error, "not_zaptrace");
	assert.equal(notFence.changed, false);
});

test("笔记：相同内容再保存 changed=false；含保留标题拒绝保存", () => {
	const md = block({ notes: "- 旧笔记" });
	const same = replacePersonalNotes(md, locator(md), "- 旧笔记");
	assert.equal(same.changed, false);
	const refused = replacePersonalNotes(md, locator(md), "### 答案\n伪造");
	assert.equal(refused.error, "reserved_heading_in_notes");
	assert.equal(refused.content, md);
});

test("笔记：文件末尾无换行时保存后仍无换行", () => {
	const md = block({ notes: "- 旧" });
	const result = replacePersonalNotes(md, locator(md), "- 新");
	assert.equal(result.changed, true);
	assert.equal(result.content.endsWith("\n"), false);
});
