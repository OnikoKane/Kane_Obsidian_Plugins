import { test } from "node:test";
import assert from "node:assert/strict";

import { patchCardMetadata, type CardMetadataPatch } from "../src/core/metadata.ts";
import { scanZaptraceBlocks } from "../src/core/parse.ts";

function mdBlock(header: string[], body = "### 题干\n\n题目\n\n### 答案\n\n答案"): string {
	return ["```zaptrace", ...header, ...body.split("\n"), "```"].join("\n");
}

function loc(markdown: string, index = 0) {
	const cards = scanZaptraceBlocks("t.md", markdown).cards;
	return { line: cards[index].line, endLine: cards[index].endLine };
}

function patch(header: string[], next: CardMetadataPatch, body?: string) {
	const md = mdBlock(header, body);
	const result = patchCardMetadata(md, loc(md), next);
	return { md, result };
}

test("正常替换：只改 category/subject/tags 三行", () => {
	const { md, result } = patch(
		["id: q1", "category: 数学", "subject: 高等数学", "tags: 导数, 极限", "source: p.1", "---"],
		{ category: "物理", subject: "力学", tags: ["牛顿定律", "受力"] }
	);
	assert.equal(result.changed, true);
	assert.match(result.content, /category: 物理/);
	assert.match(result.content, /subject: 力学/);
	assert.match(result.content, /tags: 牛顿定律, 受力/);
	assert.match(result.content, /id: q1/);
	assert.match(result.content, /source: p\.1/);
	assert.match(result.content, /### 题干/);
	// 行数不变
	assert.equal(result.content.split("\n").length, md.split("\n").length);
});

test("头部缺 category：插入到 --- 前、最后一个 key 后", () => {
	const { result } = patch(
		["id: q1", "subject: 高等数学", "tags: 导数", "---"],
		{ category: "数学", subject: "高等数学", tags: ["导数"] }
	);
	const idxCat = result.content.indexOf("category: 数学");
	const idxDash = result.content.indexOf("---");
	assert.ok(idxCat > 0 && idxCat < idxDash);
	assert.match(result.content, /tags: 导数\ncategory: 数学\n---/);
});

test("头部缺 tags：追加 tags 行，未知键保留", () => {
	const { result } = patch(
		["id: q1", "category: 数学", "subject: 高数", "foo: bar", "---"],
		{ category: "数学", subject: "高数", tags: ["极限"] }
	);
	assert.match(result.content, /foo: bar/);
	assert.match(result.content, /tags: 极限/);
});

test("无头部：插入头部 + --- + 空行，正文原样且可解析", () => {
	const md = ["```zaptrace", "### 题干", "", "题目", "### 答案", "答案", "```"].join("\n");
	const result = patchCardMetadata(md, loc(md), {
		category: "物理",
		subject: "力学",
		tags: ["受力"],
	});
	assert.equal(result.changed, true);
	const cards = scanZaptraceBlocks("t.md", result.content).cards;
	assert.equal(cards[0].category, "物理");
	assert.equal(cards[0].subject, "力学");
	assert.deepEqual(cards[0].tags, ["受力"]);
	assert.match(result.content, /### 题干/);
});

test("无头部且正文首行是 ---：新头部插入，原 --- 留在正文", () => {
	const md = ["```zaptrace", "---", "", "正文", "```"].join("\n");
	const result = patchCardMetadata(md, loc(md), {
		category: "数学",
		subject: "高数",
		tags: [],
	});
	const occurrences = result.content.match(/^---$/gm) ?? [];
	assert.equal(occurrences.length, 2); // 新头部终止 + 原水平线
});

test("头部无 ---（非 key 行结束）：只改 key 区，不补 ---", () => {
	const md = [
		"```zaptrace",
		"category: 数学",
		"subject: 高数",
		"### 题干",
		"题",
		"### 答案",
		"答",
		"```",
	].join("\n");
	const result = patchCardMetadata(md, loc(md), {
		category: "物理",
		subject: "高数",
		tags: [],
	});
	assert.match(result.content, /category: 物理/);
	assert.equal((result.content.match(/^---$/gm) ?? []).length, 0);
});

test("空值删除对应行；删除全部 key 且原 --- 时一并删除 ---", () => {
	const md = mdBlock(["category: 数学", "subject: 高数", "tags: 导数", "---"]);
	const result = patchCardMetadata(md, loc(md), { category: "", subject: "", tags: [] });
	assert.equal(result.changed, true);
	assert.doesNotMatch(result.content, /category:/);
	assert.doesNotMatch(result.content, /subject:/);
	assert.doesNotMatch(result.content, /tags:/);
	const cards = scanZaptraceBlocks("t.md", result.content);
	assert.equal(cards.cards.length, 1);
	assert.match(cards.cards[0].stem, /题目/);
});

test("tags 分隔符与去重保序", () => {
	const { result } = patch(["category: 数学", "subject: 高数", "---"], {
		category: "数学",
		subject: "高数",
		tags: ["导数", "极限", "导数", "行列式"],
	});
	assert.match(result.content, /tags: 导数, 极限, 行列式/);
});

test("CRLF：全文保持 CRLF；混合 EOL 逐行保留；末尾无换行仍无", () => {
	const crlf = mdBlock(["category: 数学", "subject: 高数", "---"]).replace(/\n/g, "\r\n");
	const result = patchCardMetadata(crlf, loc(crlf), {
		category: "物理",
		subject: "力学",
		tags: [],
	});
	assert.equal(/[^\r]\n/.test(result.content), false);
	const mixed = "前言\n" + mdBlock(["category: 数学", "---"]) + "\r\n结尾";
	const mixedResult = patchCardMetadata(mixed, loc(mixed), {
		category: "物理",
		subject: "",
		tags: [],
	});
	assert.ok(mixedResult.content.startsWith("前言\n"));
	assert.ok(mixedResult.content.endsWith("\r\n结尾"));
	const noEol = mdBlock(["category: 数学", "---"]).replace(/\n$/, "");
	const noEolResult = patchCardMetadata(noEol, loc(noEol), {
		category: "物理",
		subject: "",
		tags: [],
	});
	assert.equal(noEolResult.content.endsWith("\n"), false);
});

test("整体缩进 4 空格：新增行沿用缩进", () => {
	const md = ["    ```zaptrace", "    ### 题干", "    题", "    ```"].join("\n");
	const result = patchCardMetadata(md, { line: 1, endLine: 4 }, {
		category: "数学",
		subject: "高数",
		tags: [],
	});
	assert.match(result.content, /^ {4}category: 数学/m);
	assert.match(result.content, /^ {4}---/m);
});

test("头部重复 subject：只改第一行，第二行原样", () => {
	const { result } = patch(
		["category: 数学", "subject: 旧", "subject: 第二", "---"],
		{ category: "数学", subject: "新", tags: [] }
	);
	const subjectLines = result.content.split("\n").filter((line) => /^subject:/.test(line));
	assert.equal(subjectLines.length, 2);
	assert.match(subjectLines[0], /subject: 新/);
	assert.match(subjectLines[1], /subject: 第二/);
});

test("未知键与 id 内容顺序不变；大小写 key 保留拼写", () => {
	const { result } = patch(
		["id: q1", "Category: 数学", "difficulty: 3", "pdf: p.1", "---"],
		{ category: "物理", subject: "力学", tags: ["受力"] }
	);
	assert.match(result.content, /id: q1/);
	assert.match(result.content, /Category: 物理/);
	assert.match(result.content, /difficulty: 3/);
	assert.match(result.content, /pdf: p\.1/);
});

test("相同值保存 changed=false", () => {
	const md = mdBlock(["category: 数学", "subject: 高数", "tags: 导数", "---"]);
	const result = patchCardMetadata(md, loc(md), {
		category: "数学",
		subject: "高数",
		tags: ["导数"],
	});
	assert.equal(result.changed, false);
	assert.equal(result.content, md);
});

test("行号错/非 zaptrace 返回 error，内容原样", () => {
	const md = mdBlock(["category: 数学", "---"]);
	const bad = patchCardMetadata(md, { line: 999, endLine: 1000 }, {
		category: "物理",
		subject: "",
		tags: [],
	});
	assert.equal(bad.error, "block_not_found");
	assert.equal(bad.content, md);
	const notFence = patchCardMetadata("纯文本\n第二行", { line: 1, endLine: 2 }, {
		category: "物理",
		subject: "",
		tags: [],
	});
	assert.equal(notFence.error, "not_zaptrace");
});

test("同文件 3 块只改第 2 块，第 1/3 块逐字节不变", () => {
	const b1 = mdBlock(["category: 数学", "subject: 一", "---"]);
	const b2 = mdBlock(["category: 数学", "subject: 二", "---"]);
	const b3 = mdBlock(["category: 数学", "subject: 三", "---"]);
	const md = [b1, "", b2, "", b3].join("\n");
	const cards = scanZaptraceBlocks("t.md", md).cards;
	const result = patchCardMetadata(
		md,
		{ line: cards[1].line, endLine: cards[1].endLine },
		{ category: "物理", subject: "二改", tags: [] }
	);
	assert.ok(result.content.startsWith(b1));
	assert.ok(result.content.endsWith(b3));
	assert.match(result.content, /subject: 二改/);
});

test("值含换行/冒号/#/中文：折叠换行并原样写入", () => {
	const { result } = patch(["category: 数学", "subject: 高数", "---"], {
		category: "数学\n物理",
		subject: "线性代数 B: 上",
		tags: ["#导数"],
	});
	assert.match(result.content, /category: 数学 物理/);
	assert.match(result.content, /subject: 线性代数 B: 上/);
	assert.match(result.content, /tags: #导数/);
});
