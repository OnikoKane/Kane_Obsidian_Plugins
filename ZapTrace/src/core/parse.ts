import type { QuestionCard } from "./types.ts";
import { deriveQid, isValidExplicitId, stemHashOf } from "./id.ts";

/**
 * ```zaptrace 块解析器（DESIGN §3，并已应用 REVIEW-design 的 H3 / C1 / C2 修正）。
 *
 * 纯函数、行号从 1 开始；不做任何 I/O，便于单测。
 *
 * 关键安全规则（H3）：
 * - 只有当「第一个非空行」形如 `^[A-Za-z][A-Za-z0-9_-]*\s*:` 时，才进入头部态；
 * - 头部态内寻找第一条独立 `---`；遇到非空且非 key: value 的行 → 立即结束头部，
 *   该行起全部归正文（绝不丢弃）；
 * - 首行不是合法 key 时，整个块一律按正文解析，题干里的 `---` 不会被当成分隔符。
 */

const FENCE_OPEN_RE = /^ {0,3}(`{3,})[ \t]*zaptrace[ \t]*$/i;
const FENCE_CLOSE_RE = /^ {0,3}(`{3,})[ \t]*$/;
const KEY_VALUE_RE = /^([A-Za-z][A-Za-z0-9_-]*)[ \t]*:[ \t]*(.*)$/;
/** 宽松分节标题：允许 ###/####、允许 标题前后空白（C1）。 */
const SECTION_RE = /^\s*#{3,}\s*(题干|答案|个人笔记|AI\s*笔记)\s*$/;

const KNOWN_KEYS = new Set([
	"id",
	"category",
	"subject",
	"tags",
	"source",
	"star",
	"difficulty",
	"pdf",
]);

export interface ParsedBlock {
	card: QuestionCard | null;
	skipped: boolean;
}

/** 去掉代码块整体的公共缩进（C1）。返回新数组，不修改入参。 */
export function dedentLines(lines: string[]): string[] {
	let minIndent = Number.POSITIVE_INFINITY;
	for (const line of lines) {
		if (line.trim() === "") continue;
		const match = /^[ \t]*/.exec(line);
		const indent = match ? match[0].length : 0;
		if (indent < minIndent) minIndent = indent;
	}
	if (!Number.isFinite(minIndent) || minIndent === 0) return [...lines];
	return lines.map((line) => {
		if (line.trim() === "") return "";
		return line.slice(minIndent);
	});
}

function trimBlankLines(lines: string[]): string[] {
	let start = 0;
	let end = lines.length;
	while (start < end && lines[start].trim() === "") start++;
	while (end > start && lines[end - 1].trim() === "") end--;
	return lines.slice(start, end);
}

function splitTags(raw: string): string[] {
	const parts = raw
		.split(/[,，、]/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
	const seen = new Set<string>();
	const result: string[] = [];
	for (const part of parts) {
		if (!seen.has(part)) {
			seen.add(part);
			result.push(part);
		}
	}
	return result;
}

interface HeaderSplit {
	header: Array<[string, string]>;
	bodyLines: string[];
}

/**
 * 分离头部键值区与正文（H3 / C2 修正版）。
 *
 * 只有当首行是合法 key: value 时才可能进入头部态；否则整段都是正文。
 */
export function splitHeader(inner: string[]): HeaderSplit {
	const firstNonBlank = inner.find((line) => line.trim() !== "");
	// 首行不是合法 key → 整段正文
	if (!firstNonBlank || !KEY_VALUE_RE.test(firstNonBlank)) {
		return { header: [], bodyLines: inner };
	}

	const header: Array<[string, string]> = [];
	let index = 0;
	while (index < inner.length) {
		const line = inner[index];
		if (line.trim() === "") {
			index++;
			continue;
		}
		if (line.trim() === "---") {
			// 头部到此结束
			return { header, bodyLines: inner.slice(index + 1) };
		}
		const match = KEY_VALUE_RE.exec(line);
		if (!match) {
			// 头部态内遇到非 key 行：结束头部，该行起全部归正文，绝不丢弃
			return { header, bodyLines: inner.slice(index) };
		}
		header.push([match[1], match[2].trim()]);
		index++;
	}
	return { header, bodyLines: [] };
}

interface Sections {
	stem?: string;
	answer?: string;
	notes?: string;
	aiNotes?: string;
	hasSections: boolean;
}

function splitSections(bodyLines: string[]): Sections {
	const sections: Sections = { hasSections: false };
	let currentKey: "stem" | "answer" | "notes" | "aiNotes" | null = null;
	let buffer: string[] = [];

	const flush = (): void => {
		if (currentKey === null) return;
		sections[currentKey] = trimBlankLines(buffer).join("\n");
		buffer = [];
	};

	for (const line of bodyLines) {
		const match = SECTION_RE.exec(line);
		if (match) {
			flush();
			sections.hasSections = true;
			const label = match[1].replace(/[ \t]+/g, "");
			if (label === "题干") currentKey = "stem";
			else if (label === "答案") currentKey = "answer";
			else if (label === "个人笔记") currentKey = "notes";
			else currentKey = "aiNotes";
			continue;
		}
		if (currentKey !== null) buffer.push(line);
	}
	flush();
	return sections;
}

export interface ParseBlockOptions {
	/** 块在文件内的序号（0-based），用于索引键与确定性隔离 */
	blockIndex?: number;
}

/**
 * 解析单个 zaptrace 代码块的内文（不含围栏行）。
 * @param file vault 相对路径
 * @param rawInnerLines 围栏内部各行
 * @param startLine 围栏起始行（1-based），用于错误定位
 * @param endLine 围栏结束行（1-based）
 */
export function parseBlockInner(
	file: string,
	rawInnerLines: string[],
	startLine: number,
	endLine: number,
	options: ParseBlockOptions = {}
): ParsedBlock {
	const blockIndex = options.blockIndex ?? 0;
	const innerLines = dedentLines(rawInnerLines);
	const { header, bodyLines } = splitHeader(innerLines);
	const sections = splitSections(bodyLines);

	const headerMap = new Map<string, string>();
	const extra: Record<string, string> = {};
	for (const [key, value] of header) {
		const lower = key.toLowerCase();
		if (KNOWN_KEYS.has(lower)) {
			if (!headerMap.has(lower)) headerMap.set(lower, value);
		} else {
			extra[key] = value;
		}
	}

	let stem = "";
	let answer = "";
	let notes = "";
	let aiNotes = "";
	const errors: string[] = [];

	if (sections.hasSections) {
		stem = sections.stem ?? "";
		answer = sections.answer ?? "";
		notes = sections.notes ?? "";
		aiNotes = sections.aiNotes ?? "";
		if (sections.stem === undefined) {
			errors.push(`第 ${startLine} 行：缺少题干分节`);
		}
		if (sections.answer === undefined) {
			errors.push(`第 ${startLine} 行：缺少答案分节`);
		}
	} else {
		stem = trimBlankLines(bodyLines).join("\n");
		answer = "";
		errors.push(`第 ${startLine} 行：缺少答案分节（未发现 ### 分节）`);
	}

	// 空块忽略
	if (stem.trim() === "" && answer.trim() === "") {
		return { card: null, skipped: true };
	}

	const explicitRaw = headerMap.get("id")?.trim() ?? "";
	const explicitId =
		explicitRaw.length > 0 && isValidExplicitId(explicitRaw) ? explicitRaw : null;
	if (explicitRaw.length > 0 && explicitId === null) {
		errors.push(`第 ${startLine} 行：id 不合法（${explicitRaw}）`);
	}

	const subjectRaw = headerMap.get("subject")?.trim() ?? "";
	const difficultyRaw = headerMap.get("difficulty")?.trim() ?? "";
	let difficulty: number | null = null;
	if (difficultyRaw !== "") {
		const parsed = Number.parseInt(difficultyRaw, 10);
		if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5) difficulty = parsed;
	}
	const starRaw = headerMap.get("star")?.trim().toLowerCase() ?? "";

	const card: QuestionCard = {
		// 索引键与状态键分离（H1）：key 唯一标识「某个文件里的某个块」，
		// qid 只是 data.json 的状态键，可能因重复而被确定性消歧。
		key: `${file}#${blockIndex}`,
		blockIndex,
		qid: explicitId ?? deriveQid(stem),
		explicitId,
		duplicateId: false,
		category: headerMap.get("category")?.trim() ?? "",
		subject: subjectRaw,
		tags: splitTags(headerMap.get("tags") ?? ""),
		source: headerMap.get("source")?.trim() ?? "",
		difficulty,
		pdf: headerMap.get("pdf")?.trim() ?? "",
		extra,
		starInitial: starRaw === "true",
		stem,
		answer,
		notes,
		aiNotes,
		file,
		line: startLine,
		endLine,
		errors,
		stemHash: stemHashOf(stem),
	};
	return { card, skipped: false };
}

export interface ScanResult {
	cards: QuestionCard[];
	skippedBlocks: number;
}

/**
 * 扫描一份 Markdown 文本里的所有 ```zaptrace 块。
 *
 * 围栏规则：
 * - 开启围栏至少 3 个反引号，结束围栏需 >= 开启长度（CommonMark）；
 * - **扫描器跟踪所有反引号围栏**：遇到非 zaptrace 开栏（如 ```markdown / ```js）
 *   直接跳到它合法的闭栏之后，绝不会把文档示例块内部的 ```zaptrace 当成真题。
 */
export function scanZaptraceBlocks(file: string, content: string): ScanResult {
	const lines = content.split(/\r?\n/);
	const cards: QuestionCard[] = [];
	let skippedBlocks = 0;
	let blockIndex = 0;
	let index = 0;
	while (index < lines.length) {
		// 任意反引号开栏：``` 或 ```lang
		const anyOpen = /^ {0,3}(`{3,})(.*)$/.exec(lines[index]);
		if (!anyOpen) {
			index++;
			continue;
		}
		const fenceLength = anyOpen[1].length;
		const info = anyOpen[2].trim();
		const startLine = index + 1;
		let closeIndex = -1;
		for (let j = index + 1; j < lines.length; j++) {
			const close = FENCE_CLOSE_RE.exec(lines[j]);
			if (close && close[1].length >= fenceLength) {
				closeIndex = j;
				break;
			}
		}
		const endExclusive = closeIndex === -1 ? lines.length : closeIndex;
		const endLine = closeIndex === -1 ? lines.length : closeIndex + 1;

		if (info.toLowerCase() === "zaptrace") {
			const inner = lines.slice(index + 1, endExclusive);
			const parsed = parseBlockInner(file, inner, startLine, endLine, { blockIndex });
			if (parsed.card) {
				cards.push(parsed.card);
				blockIndex++;
			} else {
				skippedBlocks++;
			}
		}
		// 非 zaptrace 块（含文档示例）整体跳过，不进入索引
		index = closeIndex === -1 ? lines.length : closeIndex + 1;
	}
	return { cards, skippedBlocks };
}
