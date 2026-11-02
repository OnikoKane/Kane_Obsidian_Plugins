/** 分类配置（taxonomy）纯函数：settings 子字段，不进入 data.json 顶层。 */

export interface TaxonomyCategory {
	name: string;
	subjects: string[];
	/** 子科目 → 小标签（章节/知识点）；键为子科目名。三层绑定：科目 > 子科目 > 小标签 */
	subjectTags: Record<string, string[]>;
	[key: string]: unknown;
}

export interface TaxonomyConfig {
	categories: TaxonomyCategory[];
	seeded: boolean;
	[key: string]: unknown;
}

/** 「科目 > 子科目」下的小标签重命名（用于同步改写题卡头部 tags）。 */
export interface TagRename {
	category: string;
	subject: string;
	from: string;
	to: string;
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

function normalizeNames(raw: unknown): string[] {
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

/** 只保留仍存在于 subjects 下的标签表；键与值都 trim/去重。 */
function normalizeSubjectTags(
	raw: unknown,
	subjects: string[]
): Record<string, string[]> {
	const record = asRecord(raw);
	if (!record) return {};
	const subjectSet = new Set(subjects);
	const out: Record<string, string[]> = {};
	for (const [key, value] of Object.entries(record)) {
		const subject = key.trim();
		if (subject === "" || !subjectSet.has(subject)) continue;
		out[subject] = normalizeNames(value);
	}
	return out;
}

function normalizeCategory(raw: unknown): TaxonomyCategory | null {
	if (typeof raw === "string") {
		const name = raw.trim();
		return name === "" ? null : { name, subjects: [], subjectTags: {} };
	}
	const record = asRecord(raw);
	if (!record) return null;
	const name = cleanName(record.name);
	if (name === "") return null;
	const extra: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) {
		if (key !== "name" && key !== "subjects" && key !== "subjectTags") extra[key] = value;
	}
	const subjects = normalizeNames(record.subjects);
	return {
		...extra,
		name,
		subjects,
		subjectTags: normalizeSubjectTags(record.subjectTags, subjects),
	};
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
			for (const subject of union) {
				const tags = new Set([
					...(existing.subjectTags[subject] ?? []),
					...(category.subjectTags[subject] ?? []),
				]);
				if (tags.size > 0) existing.subjectTags[subject] = [...tags];
			}
		} else {
			byName.set(category.name, category);
		}
	}
	result.categories = [...byName.values()];
	result.seeded = seeded;
	return result;
}

/** 当前配置中的科目名（顺序保留）。 */
export function taxonomyCategoryNames(taxonomy: TaxonomyConfig): string[] {
	return taxonomy.categories.map((category) => category.name);
}

/** 某科目下的子科目；未配置返回 []。 */
export function taxonomySubjects(taxonomy: TaxonomyConfig, category: string): string[] {
	return taxonomy.categories.find((item) => item.name === category)?.subjects ?? [];
}

/** 某科目+子科目下的小标签；未配置返回 []。 */
export function taxonomySubjectTags(
	taxonomy: TaxonomyConfig,
	category: string,
	subject: string
): string[] {
	if (subject === "") return [];
	return taxonomy.categories.find((item) => item.name === category)?.subjectTags[subject] ?? [];
}

/** 把一批小标签并入某科目+子科目的标签库（返回新配置，不改原对象）。 */
export function withSubjectTags(
	taxonomy: TaxonomyConfig,
	category: string,
	subject: string,
	tags: string[]
): TaxonomyConfig {
	const next = normalizeTaxonomy(JSON.parse(JSON.stringify(taxonomy)) as unknown);
	const target = next.categories.find((item) => item.name === category);
	if (!target || subject.trim() === "") return next;
	const key = subject.trim();
	if (!target.subjects.includes(key)) return next;
	const merged = new Set([...(target.subjectTags[key] ?? []), ...tags.map((tag) => tag.trim())]);
	merged.delete("");
	target.subjectTags[key] = [...merged];
	return next;
}
