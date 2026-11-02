import { sha1Hex } from "./hash.ts";

/**
 * 题干规范化（DESIGN §4.2）：
 * 1. Unicode NFC；2. 每行去行尾空白；3. 行内连续空格/制表符压成一个空格；
 * 4. 去掉首尾空行；5. 以 \n 连接。
 *
 * 不做大小写折叠 —— 数学符号大小写有别。
 */
export function normalizeStem(text: string): string {
	const nfc = text.normalize("NFC");
	const lines = nfc
		.split(/\r?\n/)
		.map((line) => line.replace(/[ \t]+/g, " ").replace(/ +$/, ""));
	while (lines.length > 0 && lines[0].trim() === "") lines.shift();
	while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
	return lines.join("\n");
}

/** 题干哈希（12 位 hex），用于检测题干被改。 */
export function stemHashOf(stem: string): string {
	return sha1Hex(normalizeStem(stem)).slice(0, 12);
}

/** 自动派生 qid：auto:<12 位 hex>。只依赖题干。 */
export function deriveQid(stem: string): string {
	return `auto:${stemHashOf(stem)}`;
}

/** 手写 id 的合法字符集（DESIGN §3.2）。 */
export function isValidExplicitId(id: string): boolean {
	return /^[A-Za-z0-9._:-]+$/.test(id);
}
