import type { DueBadge, QuestionState, Rating } from "./types.ts";
import { diffDays, isValidDateString } from "./date.ts";
import { previewDays } from "./scheduler.ts";

/** 展示层文案工具（纯函数）。 */

export function dueBadge(state: QuestionState | undefined, today: string): DueBadge {
	if (!state || !isValidDateString(state.due)) {
		return { text: "未练", tone: "none" };
	}
	const due = state.due;
	if (due < today) return { text: "已到期", tone: "danger" };
	if (due === today) return { text: "今天", tone: "accent" };
	const days = diffDays(today, due);
	if (days === 1) return { text: "明天", tone: "muted" };
	return { text: `${days} 天后`, tone: "muted" };
}

/** 评分条小字：本次评分后的间隔预告。 */
export function intervalLabel(days: number): string {
	if (days === 1) return "明天";
	return `${days} 天后`;
}

export function ratingPreview(step: number, rating: Rating): string {
	return intervalLabel(previewDays(step, rating));
}

/** 练习结束小结。 */
export function summaryText(counts: Record<Rating, number>): string {
	const total =
		counts.again + counts.hard + counts.good + counts.easy;
	return `本次 ${total} 题，忘记 ${counts.again} / 困难 ${counts.hard} / 想起 ${counts.good} / 秒答 ${counts.easy}`;
}

/** 列表行题干首行（去掉多余空白，过长省略由 CSS 处理）。 */
export function firstLine(text: string): string {
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed !== "") return trimmed;
	}
	return "";
}
