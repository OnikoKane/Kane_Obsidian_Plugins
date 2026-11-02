import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeTaxonomy, taxonomyCategoryNames, taxonomySubjects } from "../src/core/taxonomy.ts";
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

test("normalizeSettings 旧数据缺 taxonomy → 默认，未知设置字段保留", () => {
	const settings = normalizeSettings({ theme: "auto", legacyFlag: true });
	assert.deepEqual(settings.taxonomy, { categories: [], seeded: false });
	assert.equal((settings as unknown as Record<string, unknown>).legacyFlag, true);
	assert.deepEqual(DEFAULT_SETTINGS.taxonomy, { categories: [], seeded: false });
});
