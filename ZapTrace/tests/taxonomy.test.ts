import { test } from "node:test";
import assert from "node:assert/strict";

import {
	normalizeTaxonomy,
	taxonomyCategoryNames,
	taxonomySubjectTags,
	taxonomySubjects,
	withSubjectTags,
} from "../src/core/taxonomy.ts";
import { normalizeSettings, DEFAULT_SETTINGS } from "../src/core/state.ts";

test("normalizeTaxonomy(undefined) → 空配置", () => {
	assert.deepEqual(normalizeTaxonomy(undefined), { categories: [], seeded: false });
});

test("数组与对象两种旧形态归一，trim/去重/去空", () => {
	const fromArray = normalizeTaxonomy([
		{ name: " 数学 ", subjects: [" 高等数学 ", "高等数学", "", "线性代数"] },
		"英语",
	]);
	assert.deepEqual(taxonomyCategoryNames(fromArray), ["数学", "英语"]);
	assert.deepEqual(taxonomySubjects(fromArray, "数学"), ["高等数学", "线性代数"]);
	const fromObject = normalizeTaxonomy({
		categories: [{ name: "数学", subjects: ["高等数学"] }],
		seeded: true,
	});
	assert.equal(fromObject.seeded, true);
	assert.deepEqual(taxonomySubjects(fromObject, "数学"), ["高等数学"]);
});

test("重名 category 合并 subjects 并集，保留未知字段", () => {
	const result = normalizeTaxonomy({
		categories: [
			{ name: "数学", subjects: ["高数"], color: "red" },
			{ name: "数学", subjects: ["线代", "高数"] },
		],
		seeded: false,
		extraTop: 1,
	});
	assert.equal(result.categories.length, 1);
	assert.deepEqual(result.categories[0].subjects, ["高数", "线代"]);
	assert.equal((result.categories[0] as Record<string, unknown>).color, "red");
	assert.equal((result as Record<string, unknown>).extraTop, 1);
});

test("非 boolean seeded → false", () => {
	assert.equal(normalizeTaxonomy({ categories: [], seeded: "yes" }).seeded, false);
});

test("subjectTags 归一：按子科目保留、trim/去重、丢弃孤儿键", () => {
	const taxonomy = normalizeTaxonomy({
		categories: [
			{
				name: "数学",
				subjects: [" 线性代数 ", "线性代数"],
				subjectTags: {
					" 线性代数 ": [" 行列式 ", "行列式", "", "向量空间"],
					离散数学: ["图论"],
				},
			},
		],
	});
	assert.deepEqual(taxonomySubjects(taxonomy, "数学"), ["线性代数"]);
	assert.deepEqual(taxonomySubjectTags(taxonomy, "数学", "线性代数"), ["行列式", "向量空间"]);
	assert.deepEqual(taxonomySubjectTags(taxonomy, "数学", "离散数学"), []);
	assert.deepEqual(taxonomySubjectTags(taxonomy, "数学", ""), []);
});

test("withSubjectTags 合并并去重，且不改原配置", () => {
	const base = normalizeTaxonomy({
		categories: [{ name: "数学", subjects: ["线性代数"], subjectTags: { 线性代数: ["行列式"] } }],
	});
	const next = withSubjectTags(base, "数学", "线性代数", ["行列式", " 举证 ", "举证"]);
	assert.deepEqual(taxonomySubjectTags(next, "数学", "线性代数"), ["行列式", "举证"]);
	assert.deepEqual(taxonomySubjectTags(base, "数学", "线性代数"), ["行列式"]);
	// 不在 subjects 里的子科目不会被创建
	const noop = withSubjectTags(base, "数学", "离散数学", ["图论"]);
	assert.deepEqual(taxonomySubjectTags(noop, "数学", "离散数学"), []);
});

test("normalizeSettings 旧数据缺 taxonomy → 默认，未知设置字段保留", () => {
	const settings = normalizeSettings({ theme: "auto", legacyFlag: true });
	assert.deepEqual(settings.taxonomy, { categories: [], seeded: false });
	assert.equal((settings as unknown as Record<string, unknown>).legacyFlag, true);
	assert.deepEqual(DEFAULT_SETTINGS.taxonomy, { categories: [], seeded: false });
});
