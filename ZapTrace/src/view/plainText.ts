/**
 * 题干预览纯文本清洗（视图层，不改 core 字段）。
 *
 * 题库卡片/表格只用纯文本预览；直接 `textContent = card.stem` 会把
 * `$...$`、`$$...$$`、`\begin{pmatrix}` 等 LaTeX 源码当正文显示。
 *
 * 规则（DESIGN-v2 打磨）：
 * - 块级 `$$...$$` / `\[...\]` → 「〔公式〕」占位；
 * - 行内 `$...$` 保留可读内文并清理 TeX（\begin/\end、\frac、\left/\right、
 *   常见符号命令与花括号）；矩阵环境整体输出「〔矩阵〕」；
 * - 全篇只有公式（无其他可读文字）→ 「（公式题）」。
 */

const MATRIX_ENV_RE = /\\begin\{(?:[pbBvV]?matrix\*?|array|cases|aligned)\}/;

const COMMAND_SYMBOLS: Record<string, string> = {
	"\\cdot": "·",
	"\\times": "×",
	"\\div": "÷",
	"\\pm": "±",
	"\\mp": "∓",
	"\\leq": "≤",
	"\\le": "≤",
	"\\geq": "≥",
	"\\ge": "≥",
	"\\neq": "≠",
	"\\ne": "≠",
	"\\approx": "≈",
	"\\equiv": "≡",
	"\\to": "→",
	"\\rightarrow": "→",
	"\\Rightarrow": "⇒",
	"\\leftarrow": "←",
	"\\infty": "∞",
	"\\partial": "∂",
	"\\nabla": "∇",
	"\\sum": "Σ",
	"\\prod": "∏",
	"\\int": "∫",
	"\\Delta": "Δ",
	"\\delta": "δ",
	"\\alpha": "α",
	"\\beta": "β",
	"\\gamma": "γ",
	"\\theta": "θ",
	"\\lambda": "λ",
	"\\mu": "μ",
	"\\pi": "π",
	"\\sigma": "σ",
	"\\phi": "φ",
	"\\omega": "ω",
	"\\lim": "lim",
	"\\log": "log",
	"\\ln": "ln",
	"\\sin": "sin",
	"\\cos": "cos",
	"\\tan": "tan",
	"\\max": "max",
	"\\min": "min",
	"\\exp": "exp",
};

const SYMBOL_RE = new RegExp(
	Object.keys(COMMAND_SYMBOLS)
		.sort((a, b) => b.length - a.length)
		.map((key) => `${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`)
		.join("|"),
	"g"
);

/** 把一段行内数学内容转成可读文本。 */
function cleanInlineMath(raw: string): string {
	if (MATRIX_ENV_RE.test(raw)) return "〔矩阵〕";
	let s = raw;
	// \left / \right / \big 等尺寸命令
	s = s.replace(/\\(?:left|right|middle|big|Big|bigg|Bigg)\b/g, "");
	// \text{...} / \mathrm{...} 等保留内部文字
	for (const cmd of [
		"text",
		"textrm",
		"mathrm",
		"mathbf",
		"mathit",
		"mathsf",
		"operatorname",
		"mathcal",
		"mathbb",
	]) {
		const re = new RegExp(`\\\\${cmd}\\s*\\{([^{}]*)\\}`, "g");
		s = s.replace(re, "$1");
	}
	// \frac{a}{b} → a/b（最多迭代 3 层）
	for (let i = 0; i < 3; i++) {
		const next = s.replace(/\\(?:d|c|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2");
		if (next === s) break;
		s = next;
	}
	// 常见符号命令 → Unicode
	s = s.replace(SYMBOL_RE, (match) => COMMAND_SYMBOLS[match] ?? " ");
	// 残余 \begin{...} / \end{...} 与其它命令
	s = s.replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}/g, " ");
	s = s.replace(/\\[a-zA-Z]+/g, " ");
	// 上下标保留可读：x^{2} → x^2，x_{1} → x_1
	s = s.replace(/\^\s*\{([^{}]*)\}/g, "^$1");
	s = s.replace(/_\s*\{([^{}]*)\}/g, "_$1");
	// 花括号、反斜杠、对齐符
	s = s.replace(/[{}\\]/g, " ");
	s = s.replace(/&/g, " ");
	s = s.replace(/\s+/g, " ").trim();
	return s === "" ? "〔公式〕" : s;
}

export function toPreviewText(text: string, maxLength = 180): string {
	if (!text) return "";
	let out = text;
	// 代码块整体移除（预览不展开代码）
	out = out.replace(/```[\s\S]*?```/g, " ");
	// 块级公式 → 「〔公式〕」
	out = out.replace(/\$\$[\s\S]*?\$\$/g, " 〔公式〕 ");
	out = out.replace(/\\\[[\s\S]*?\\\]/g, " 〔公式〕 ");
	// 行内公式 → 保留可读内文
	out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_match, inner: string) => ` ${cleanInlineMath(inner)} `);
	out = out.replace(/\$([^$\n]+)\$/g, (_match, inner: string) => ` ${cleanInlineMath(inner)} `);
	// 行内代码保留内容
	out = out.replace(/`([^`]*)`/g, "$1");
	// 图片 / 链接
	out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
	out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
	// 标题 / 列表 / 引用前缀
	out = out.replace(/^[ \t]*#{1,6}[ \t]*/gm, "");
	out = out.replace(/^[ \t]*[-*+][ \t]+/gm, "");
	out = out.replace(/^[ \t]*>[ \t]?/gm, "");
	// 强调符
	out = out.replace(/[*_~]{1,3}/g, "");
	// HTML 标签
	out = out.replace(/<[^>]+>/g, " ");
	// 残余 TeX 命令与花括号
	out = out.replace(/\\[a-zA-Z]+/g, " ");
	out = out.replace(/[{}]/g, " ");
	out = out.replace(/\s+/g, " ").trim();
	// 纯公式题判定：原文在去掉代码/数学/标点后没有可读文字
	const readable = text
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/\$\$[\s\S]*?\$\$/g, " ")
		.replace(/\\\[[\s\S]*?\\\]/g, " ")
		.replace(/\\\([\s\S]*?\\\)/g, " ")
		.replace(/\$[^$\n]+?\$/g, " ")
		.replace(/[\s\p{P}\p{S}]/gu, "");
	if (readable === "") out = "（公式题）";
	return out.length > maxLength ? `${out.slice(0, maxLength)}…` : out;
}
