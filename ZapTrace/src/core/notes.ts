/**
 * 个人笔记保存协议（DESIGN-v3 §5）——纯函数，禁止 import "obsidian"。
 *
 * 只替换目标 ```zaptrace 块内「### 个人笔记」节的内容；
 * 题干、答案、头部、其它分节、块外内容、逐行 EOL、末尾换行全部保持不变。
 */

export interface NoteBlockRef {
	/** 1-based：zaptrace 围栏起始行 */
	line: number;
	/** 1-based：zaptrace 围栏结束行（闭栏行；无闭栏则文件末行） */
	endLine: number;
}

export interface NotePatchResult {
	content: string;
	changed: boolean;
	error?: "block_not_found" | "not_zaptrace" | "reserved_heading_in_notes";
}

interface Line {
	text: string;
	eol: string;
}

const FENCE_RE = /^\s*`{3,}\s*zaptrace\s*$/i;
const SECTION_RE = /^(\s*)#{3,}\s*(题干|答案|AI\s*笔记|个人笔记|笔记)\s*$/;

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

function trimmedNoteLines(notes: string): string[] {
	const normalized = notes.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	const lines = normalized.split("\n");
	let start = 0;
	let end = lines.length;
	while (start < end && lines[start].trim() === "") start++;
	while (end > start && lines[end - 1].trim() === "") end--;
	return lines.slice(start, end);
}

/** 带前后空行的整段（替换已有节时使用）。 */
function buildSectionLines(
	indent: string,
	notes: string,
	eol: string,
	trailingBlank: boolean
): Line[] {
	const body = trimmedNoteLines(notes);
	if (body.length === 0) return [{ text: "", eol }];
	const result: Line[] = [{ text: "", eol }];
	for (const line of body) {
		result.push({ text: line.trim() === "" ? "" : `${indent}${line}`, eol });
	}
	if (trailingBlank) result.push({ text: "", eol });
	return result;
}

export function replacePersonalNotes(
	markdown: string,
	ref: NoteBlockRef,
	notes: string
): NotePatchResult {
	const unchanged: NotePatchResult = { content: markdown, changed: false };
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
	if (ref.endLine <= ref.line) {
		return { ...unchanged, error: "block_not_found" };
	}
	const innerStart = startIndex + 1;
	const innerEnd = Math.min(ref.endLine - 1, lines.length);
	if (innerEnd < innerStart) return { ...unchanged, error: "block_not_found" };

	// 笔记正文不能含保留分节标题，否则会污染解析
	const rawNotes = notes.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	if (rawNotes.split("\n").some((line) => SECTION_RE.test(line))) {
		return { ...unchanged, error: "reserved_heading_in_notes" };
	}

	const sections: Array<{ index: number; indent: string; name: string }> = [];
	for (let i = innerStart; i < innerEnd; i++) {
		const match = SECTION_RE.exec(lines[i].text);
		if (match) {
			sections.push({ index: i, indent: match[1], name: match[2].replace(/\s+/g, "") });
		}
	}
	const eol = dominantEol(lines, innerStart, innerEnd);
	const notesSection = sections.find(
		(section) => section.name === "个人笔记" || section.name === "笔记"
	);

	let resultLines: Line[];
	if (notesSection) {
		let contentEnd = innerEnd;
		for (const section of sections) {
			if (section.index > notesSection.index) {
				contentEnd = section.index;
				break;
			}
		}
		const replacement = buildSectionLines(
			notesSection.indent,
			notes,
			eol,
			contentEnd < innerEnd
		);
		resultLines = [
			...lines.slice(0, notesSection.index + 1),
			...replacement,
			...lines.slice(contentEnd),
		];
	} else {
		if (notes.trim() === "") return unchanged;
		const answer = sections.find((section) => section.name === "答案");
		let insertAt = innerEnd;
		let indent = "";
		if (answer) {
			indent = answer.indent;
			insertAt = innerEnd;
			for (const section of sections) {
				if (section.index > answer.index) {
					insertAt = section.index;
					break;
				}
			}
		} else {
			const leading = /^\s*/.exec(lines[startIndex].text);
			indent = leading ? leading[0] : "";
		}
		const body = trimmedNoteLines(notes);
		const block: Line[] = [
			{ text: "", eol },
			{ text: `${indent}### 笔记`, eol },
			{ text: "", eol },
			...body.map((line) => ({ text: line.trim() === "" ? "" : `${indent}${line}`, eol })),
			{ text: "", eol },
		];
		resultLines = [...lines.slice(0, insertAt), ...block, ...lines.slice(insertAt)];
	}

	const content = resultLines.map((line) => line.text + line.eol).join("");
	return { content, changed: content !== markdown };
}
