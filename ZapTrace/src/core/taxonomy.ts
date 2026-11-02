/** 分类配置（taxonomy）纯函数：settings 子字段，不进入 data.json 顶层。 */

export interface TaxonomyCategory {
	name: string;
	subjects: string[];
	[key: string]: unknown;
}

export interface TaxonomyConfig {
	categories: TaxonomyCategory[];
	seeded: boolean;
	[key: string]: unknown;
}

export function createDefaultTaxonomy(): TaxonomyConfig {
	return { categories: [], seeded: false };
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function cleanName(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function normalizeSubjects(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of raw) {
		const name = cleanName(item);
		if (name === "" || seen.has(name)) continue;
		seen.add(name);
		out.push(name);
	}
	return out;
}

function normalizeCategory(raw: unknown): TaxonomyCategory | null {
	if (typeof raw === "string") {
		const name = raw.trim();
		return name === "" ? null : { name, subjects: [] };
	}
	const record = asRecord(raw);
	if (!record) return null;
	const name = cleanName(record.name);
	if (name === "") return null;
	const extra: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) {
		if (key !== "name" && key !== "subjects") extra[key] = value;
	}
	return { ...extra, name, subjects: normalizeSubjects(record.subjects) };
}

export function normalizeTaxonomy(raw: unknown): TaxonomyConfig {
	const result: TaxonomyConfig = createDefaultTaxonomy();
	let items: unknown[] = [];
	let seeded = false;
	if (Array.isArray(raw)) {
		items = raw;
	} else {
		const record = asRecord(raw);
		if (!record) return result;
		items = Array.isArray(record.categories) ? record.categories : [];
		seeded = typeof record.seeded === "boolean" ? record.seeded : false;
		for (const [key, value] of Object.entries(record)) {
			if (key !== "categories" && key !== "seeded") result[key] = value;
		}
	}
	const byName = new Map<string, TaxonomyCategory>();
	for (const item of items) {
		const category = normalizeCategory(item);
		if (!category) continue;
		const existing = byName.get(category.name);
		if (existing) {
			const union = new Set([...existing.subjects, ...category.subjects]);
			existing.subjects = [...union];
		} else {
			byName.set(category.name, category);
		}
	}
	result.categories = [...byName.values()];
	result.seeded = seeded;
	return result;
}

/** 当前配置中的大科目名（顺序保留）。 */
export function taxonomyCategoryNames(taxonomy: TaxonomyConfig): string[] {
	return taxonomy.categories.map((category) => category.name);
}

/** 某大科目下的子科目；未配置返回 []。 */
export function taxonomySubjects(taxonomy: TaxonomyConfig, category: string): string[] {
	return taxonomy.categories.find((item) => item.name === category)?.subjects ?? [];
}
