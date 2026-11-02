/**
 * 题卡头部元数据编辑（DESIGN-v3.1 §4）——纯函数，禁止 import "obsidian"。
 *
 * 只修改目标 ```zaptrace 块头部的 category / subject / tags 三行；
 * 保留 id/source/star/difficulty/pdf 等未知键、其它行、逐行 EOL、缩进与其它块。
 */

export interface CardMetadataPatch {
	category: string;
	subject: string;
	tags: string[];
}

export interface MetaPatchResult {
	content: string;
	changed: boolean;
	error?: "block_not_found" | "not_zaptrace";
}

export interface MetaBlockRef {
	line: number;
	endLine: number;
}

interface Line {
	text: string;
	eol: string;
}

const FENCE_RE = /^\s*`{3,}\s*zaptrace\s*$/i;
const KEY_VALUE_RE = /^(\s*)([A-Za-z][A-Za-z0-9_-]*)(\s*:\s*)(.*)$/;

function tokenize(markdown: string): Line[] {
	const lines: Line[] = [];
	const re = /([^\r\n]*)(\r\n|\n|\r)/g;
	let match: RegExpExecArray | null;
	let lastIndex = 0;
	while ((match = re.exec(markdown)) !== null) {
		lines.push({ text: match[1], eol: match[2] });
		lastIndex = re.lastIndex;
	}
	if (lastIndex < markdown.length) {
		lines.push({ text: markdown.slice(lastIndex), eol: "" });
	}
	return lines;
}

function dominantEol(lines: Line[], start: number, end: number): string {
	for (let i = start; i < end; i++) {
		if (lines[i].eol !== "") return lines[i].eol;
	}
	return "\n";
}

function leadingIndent(text: string): string {
	const match = /^\s*/.exec(text);
	return match ? match[0] : "";
}

function normalizeValue(value: string): string {
	return value.replace(/\r?\n|\r/g, " ").trim();
}

export function joinTags(tags: string[]): string {
	return tags.join(", ");
}

export function patchCardMetadata(
	markdown: string,
	ref: MetaBlockRef,
	next: CardMetadataPatch
): MetaPatchResult {
	const unchanged: MetaPatchResult = { content: markdown, changed: false };
	if (!Number.isInteger(ref.line) || !Number.isInteger(ref.endLine)) {
		return { ...unchanged, error: "block_not_found" };
	}
	const lines = tokenize(markdown);
	const startIndex = ref.line - 1;
	if (startIndex < 0 || startIndex >= lines.length) {
		return { ...unchanged, error: "block_not_found" };
	}
	if (!FENCE_RE.test(lines[startIndex].text)) {
		return { ...unchanged, error: "not_zaptrace" };
	}
	if (ref.endLine <= ref.line) return { ...unchanged, error: "block_not_found" };
	const innerStart = startIndex + 1;
	const innerEnd = Math.min(ref.endLine - 1, lines.length);
	if (innerEnd < innerStart) return { ...unchanged, error: "block_not_found" };

	const category = normalizeValue(next.category);
	const subject = normalizeValue(next.subject);
	const tags = [
		...new Set(next.tags.map((tag) => tag.trim()).filter((tag) => tag !== "")),
	];
	const allEmpty = category === "" && subject === "" && tags.length === 0;
	const eol = dominantEol(lines, innerStart, innerEnd);
	const fenceIndent = leadingIndent(lines[startIndex].text);

	// 紧邻围栏的第一条非空行
	let first = -1;
	for (let i = innerStart; i < innerEnd; i++) {
		if (lines[i].text.trim() !== "") {
			first = i;
			break;
		}
	}
	const hasHeader = first >= 0 && KEY_VALUE_RE.test(lines[first].text);

	if (!hasHeader) {
		if (allEmpty) return unchanged;
		const headerLines: Line[] = [];
		const push = (key: string, value: string): void => {
			headerLines.push({ text: `${fenceIndent}${key}: ${value}`, eol });
		};
		if (category !== "") push("category", category);
		if (subject !== "") push("subject", subject);
		if (tags.length > 0) push("tags", joinTags(tags));
		headerLines.push({ text: `${fenceIndent}---`, eol });
		headerLines.push({ text: "", eol });
		const content = [...lines.slice(0, innerStart), ...headerLines, ...lines.slice(innerStart)]
			.map((line) => line.text + line.eol)
			.join("");
		return { content, changed: content !== markdown };
	}

	// 头部态：扫描 key 行 / --- 终止 / 非 key 结束
	const keyIndices: number[] = [];
	const keyNames: string[] = [];
	let dashIndex = -1;
	let headerEnd = innerEnd;
	for (let i = first; i < innerEnd; i++) {
		const text = lines[i].text;
		if (text.trim() === "") continue;
		if (text.trim() === "---") {
			dashIndex = i;
			headerEnd = i;
			break;
		}
		const match = KEY_VALUE_RE.exec(text);
		if (!match) {
			headerEnd = i;
			break;
		}
		keyIndices.push(i);
		keyNames.push(match[2].toLowerCase());
	}
	if (keyIndices.length === 0) return unchanged;

	const headerIndent = leadingIndent(lines[keyIndices[0]].text);
	const deletions = new Set<number>();
	const replacements = new Map<number, string>();
	const insertions: Array<{ key: string; value: string }> = [];

	interface FieldSpec {
		key: "category" | "subject" | "tags";
		value: string;
	}
	const fields: FieldSpec[] = [
		{ key: "category", value: category },
		{ key: "subject", value: subject },
		{ key: "tags", value: tags.length > 0 ? joinTags(tags) : "" },
	];

	for (const field of fields) {
		const index = keyNames.indexOf(field.key);
		if (field.value !== "") {
			if (index >= 0) {
				const lineIndex = keyIndices[index];
				const match = KEY_VALUE_RE.exec(lines[lineIndex].text);
				if (match) {
					replacements.set(lineIndex, `${match[1]}${match[2]}${match[3]}${field.value}`);
				}
			} else {
				insertions.push({ key: field.key, value: field.value });
			}
		} else if (index >= 0) {
			deletions.add(keyIndices[index]);
		}
	}

	// 删除后剩余 key 行
	const remainingKeys = keyIndices.filter((index) => !deletions.has(index));
	let anchor: number;
	let insertIndex: number;
	if (remainingKeys.length > 0) {
		anchor = remainingKeys[remainingKeys.length - 1];
		insertIndex = anchor + 1;
	} else {
		anchor = first;
		insertIndex = first;
	}

	// 若删除后一条 key 都不剩且存在 ---，一并删除 ---
	if (remainingKeys.length === 0 && dashIndex >= 0) {
		deletions.add(dashIndex);
	}

	const out: Line[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (insertIndex === i && insertions.length > 0) {
			for (const item of insertions) {
				out.push({ text: `${headerIndent}${item.key}: ${item.value}`, eol });
			}
		}
		if (deletions.has(i)) continue;
		const replacement = replacements.get(i);
		if (replacement !== undefined) {
			out.push({ text: replacement, eol: lines[i].eol });
		} else {
			out.push(lines[i]);
		}
	}
	if (insertIndex >= lines.length && insertions.length > 0) {
		for (const item of insertions) {
			out.push({ text: `${headerIndent}${item.key}: ${item.value}`, eol });
		}
	}
	// anchor 仅用于可读性，避免未使用告警
	void anchor;

	const content = out.map((line) => line.text + line.eol).join("");
	return { content, changed: content !== markdown };
}
