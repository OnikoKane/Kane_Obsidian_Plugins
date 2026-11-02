import type { ParseInputFile, QuestionCard } from "./types.ts";
import { scanZaptraceBlocks } from "./parse.ts";
import { sha1Hex } from "./hash.ts";

/**
 * 全库索引（纯函数，DESIGN §6.1）。
 * 输入是 [{path, content}]，输出卡片数组 + 各种倒排；不碰 vault API。
 */

export interface IndexResult {
	cards: QuestionCard[];
	/** 索引键 → 卡片（H1：索引键与状态键分离，永不覆盖丢卡） */
	byKey: Map<string, QuestionCard>;
	/** 状态键 → 卡片（dedupe 后 qid 唯一） */
	byQid: Map<string, QuestionCard>;
	categories: string[];
	subjects: string[];
	tags: string[];
	scannedFiles: number;
	skippedBlocks: number;
}

export interface BuildOptions {
	/** 卡片没有 subject 时使用 */
	defaultSubject?: string;
	/** 是否只扫描某个目录前缀（空 = 全库） */
	cardFolder?: string;
}

/** 取文件所在文件夹名（缺省科目）。 */
export function subjectFromPath(path: string): string {
	const parts = path.split("/");
	if (parts.length >= 2) {
		return parts[parts.length - 2];
	}
	return "未分类";
}

function compareLocator(a: QuestionCard, b: QuestionCard): number {
	if (a.key !== b.key) return a.key < b.key ? -1 : 1;
	if (a.line !== b.line) return a.line - b.line;
	return 0;
}

/**
 * 重复 qid 的确定性隔离（H1 / H2，REVIEW-design §2）。
 *
 * 规则：
 * - 以「原始 qid」分组（手写 id 与 auto hash 同等对待）；
 * - 组内按 `${路径}#${块序号}` 字典序排序 —— 与 `getMarkdownFiles()` 的枚举顺序无关，
 *   因此重排文件不会改变「谁持有原始 qid」；
 * - 第一名持有原始 qid，其余追加 `-<sha1(key) 前 6 位>`；若仍与已用 qid 冲突
 *   （显式 id 与派生后缀碰撞），再追加 -2/-3，直到唯一；
 * - 所有被改名的卡片 `duplicateId=true` 并附清晰告警，状态键各不相同 → 学习状态隔离。
 */
export function dedupeCards(cards: QuestionCard[]): QuestionCard[] {
	const groups = new Map<string, QuestionCard[]>();
	for (const card of cards) {
		const list = groups.get(card.qid);
		if (list) list.push(card);
		else groups.set(card.qid, [card]);
	}

	const used = new Set<string>();
	const assigned = new Map<string, QuestionCard>();
	const bases = Array.from(groups.keys()).sort();

	for (const base of bases) {
		const list = groups.get(base);
		if (!list) continue;
		const sorted = [...list].sort(compareLocator);
		sorted.forEach((card, index) => {
			if (index === 0 && !used.has(base)) {
				used.add(base);
				assigned.set(card.key, card);
				return;
			}
			const locator = sha1Hex(card.key).slice(0, 6);
			let candidate = `${base}-${locator}`;
			let counter = 2;
			while (used.has(candidate)) {
				candidate = `${base}-${locator}-${counter}`;
				counter++;
			}
			used.add(candidate);
			const kind = card.explicitId ? "重复 ID" : "重复题干";
			assigned.set(card.key, {
				...card,
				qid: candidate,
				duplicateId: true,
				errors: [
					...card.errors,
					`${kind}：${base}，已确定性隔离为 ${candidate}（状态互不共用）`,
				],
			});
		});
	}

	// 保持输入顺序输出，便于 UI 稳定
	return cards.map((card) => assigned.get(card.key) ?? card);
}

export function buildIndex(files: ParseInputFile[], options: BuildOptions = {}): IndexResult {
	const folder = (options.cardFolder ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	const filtered = files
		.filter((file) => file.path.endsWith(".md"))
		.filter((file) => !folder || file.path === folder || file.path.startsWith(`${folder}/`))
		.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

	const rawCards: QuestionCard[] = [];
	let skippedBlocks = 0;
	for (const file of filtered) {
		const scanned = scanZaptraceBlocks(file.path, file.content);
		skippedBlocks += scanned.skippedBlocks;
		for (const card of scanned.cards) {
			const fallback = options.defaultSubject?.trim() ?? "";
			rawCards.push({
				...card,
				category: card.category || "数学",
				subject: card.subject || fallback || subjectFromPath(card.file),
			});
		}
	}

	const cards = dedupeCards(rawCards);
	const byKey = new Map<string, QuestionCard>();
	const byQid = new Map<string, QuestionCard>();
	const categories = new Set<string>();
	const subjects = new Set<string>();
	const tags = new Set<string>();
	for (const card of cards) {
		byKey.set(card.key, card);
		byQid.set(card.qid, card);
		categories.add(card.category ?? "数学");
		subjects.add(card.subject);
		for (const tag of card.tags) tags.add(tag);
	}

	return {
		cards,
		byKey,
		byQid,
		categories: Array.from(categories).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
		subjects: Array.from(subjects).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
		tags: Array.from(tags).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
		scannedFiles: filtered.length,
		skippedBlocks,
	};
}

export function emptyIndex(): IndexResult {
	return {
		cards: [],
		byKey: new Map(),
		byQid: new Map(),
		categories: [],
		subjects: [],
		tags: [],
		scannedFiles: 0,
		skippedBlocks: 0,
	};
}
