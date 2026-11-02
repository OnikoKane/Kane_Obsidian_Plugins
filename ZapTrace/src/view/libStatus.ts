import type { QuestionCard, QuestionState, ZaptraceData } from "../core/types.ts";
import { diffDays, isValidDateString } from "../core/date.ts";

/**
 * 题库状态派生（DESIGN-v2 附录 A）。**纯视图辅助**，不改 core、不新增字段。
 */

export type LibStatus = "needsFix" | "due" | "mistake" | "unlearned" | "planned" | "normal";

export type StatusFilterKey = "all" | "due" | "starred" | "unlearned" | "needsFix" | "mistake";

export function isNeedsFix(card: QuestionCard): boolean {
	return (
		card.errors.length > 0 ||
		card.duplicateId === true ||
		card.stem.trim() === "" ||
		card.answer.trim() === ""
	);
}

export function libStatus(
	card: QuestionCard,
	state: QuestionState | undefined,
	today: string
): LibStatus {
	if (isNeedsFix(card)) return "needsFix";
	if (state?.due && state.due <= today) return "due";
	if ((state?.lapses ?? 0) > 0) return "mistake";
	if (!state || state.step === -1) return "unlearned";
	if (state.due) return "planned";
	return "normal";
}

export function statusLabel(status: LibStatus): { text: string; cls: string } {
	switch (status) {
		case "needsFix":
			return { text: "需完善", cls: "is-fix" };
		case "due":
			return { text: "到期", cls: "is-due" };
		case "mistake":
			return { text: "错题", cls: "is-mistake" };
		case "unlearned":
			return { text: "未练", cls: "is-new" };
		case "planned":
			return { text: "已排期", cls: "is-planned" };
		default:
			return { text: "已掌握", cls: "is-planned" };
	}
}

/** 卡片脚注日期文案（DESIGN-v2 附录 A）；无 due 返回空串，避免与「未练」状态重复。 */
export function dueLine(state: QuestionState | undefined, today: string): string {
	if (!state || !isValidDateString(state.due)) return "";
	const due = state.due;
	if (due < today) return `已到期 ${Math.abs(diffDays(due, today))} 天`;
	if (due === today) return "今天到期";
	return `复习 ${due}`;
}

export interface StatusCounts {
	all: number;
	due: number;
	starred: number;
	unlearned: number;
	needsFix: number;
	mistake: number;
}

export function statusCounts(
	cards: QuestionCard[],
	data: ZaptraceData,
	today: string
): StatusCounts {
	const counts: StatusCounts = {
		all: cards.length,
		due: 0,
		starred: 0,
		unlearned: 0,
		needsFix: 0,
		mistake: 0,
	};
	for (const card of cards) {
		const state = data.questions[card.qid];
		if (state?.due && state.due <= today) counts.due++;
		if (state?.star) counts.starred++;
		if (!state || state.step === -1) counts.unlearned++;
		if (isNeedsFix(card)) counts.needsFix++;
		if ((state?.lapses ?? 0) > 0) counts.mistake++;
	}
	return counts;
}

export function todayAnswered(data: ZaptraceData, today: string): number {
	return data.reviewLog.filter((entry) => entry.at.slice(0, 10) === today).length;
}

export function matchesStatus(
	card: QuestionCard,
	state: QuestionState | undefined,
	filter: StatusFilterKey,
	today: string
): boolean {
	switch (filter) {
		case "all":
			return true;
		case "due":
			return Boolean(state?.due && state.due <= today);
		case "starred":
			return Boolean(state?.star);
		case "unlearned":
			return !state || state.step === -1;
		case "needsFix":
			return isNeedsFix(card);
		case "mistake":
			return (state?.lapses ?? 0) > 0;
		default:
			return true;
	}
}
