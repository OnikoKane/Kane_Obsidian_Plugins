import type {
	CardFilter,
	QuestionCard,
	QuestionState,
	SortKey,
	ZaptraceData,
} from "./types.ts";
import { addDays, isDue } from "./date.ts";

/** 题集筛选与排序（纯内存，DESIGN §6.2）。 */

export function stateOf(data: ZaptraceData, qid: string): QuestionState | undefined {
	return data.questions[qid];
}

export function matchesFilter(
	card: QuestionCard,
	state: QuestionState | undefined,
	filter: CardFilter,
	today: string
): boolean {
	if (filter.starredOnly && !(state?.star ?? false)) return false;
	if (filter.subject && card.subject !== filter.subject) return false;
	if (filter.tags.length > 0) {
		for (const tag of filter.tags) {
			if (!card.tags.includes(tag)) return false;
		}
	}

	const search = filter.search.trim().toLowerCase();
	if (search !== "") {
		const haystack = `${card.stem}\n${card.tags.join(" ")}`.toLowerCase();
		if (!haystack.includes(search)) return false;
	}

	switch (filter.time) {
		case "all":
			break;
		case "overdue":
			if (!state || !state.due) return false;
			if (!(state.due < today)) return false;
			break;
		case "today":
			if (!state || state.due !== today) return false;
			break;
		case "week": {
			// 「7 天内」= 未来 7 天（不含今天与已到期），与「今天到期 / 已到期」互补
			const limit = addDays(today, 7);
			if (!state || !state.due) return false;
			if (!(state.due > today && state.due <= limit)) return false;
			break;
		}
		case "unrated":
			if (state?.due) return false;
			break;
	}
	return true;
}

export function filterCards(
	cards: QuestionCard[],
	data: ZaptraceData,
	filter: CardFilter,
	today: string
): QuestionCard[] {
	return cards.filter((card) =>
		matchesFilter(card, data.questions[card.qid], filter, today)
	);
}

function compareDue(
	a: QuestionState | undefined,
	b: QuestionState | undefined
): number {
	const da = a?.due ?? null;
	const db = b?.due ?? null;
	if (da === db) return 0;
	if (da === null) return 1;
	if (db === null) return -1;
	return da < db ? -1 : 1;
}

export function sortCards(
	cards: QuestionCard[],
	data: ZaptraceData,
	sort: SortKey,
	_today: string
): QuestionCard[] {
	const copy = [...cards];
	copy.sort((a, b) => {
		const sa = data.questions[a.qid];
		const sb = data.questions[b.qid];
		switch (sort) {
			case "starred": {
				const starredA = sa?.star ? 1 : 0;
				const starredB = sb?.star ? 1 : 0;
				if (starredA !== starredB) return starredB - starredA;
				const due = compareDue(sa, sb);
				if (due !== 0) return due;
				return a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0;
			}
			case "recent": {
				const ta = sa?.firstSeenAt ?? "";
				const tb = sb?.firstSeenAt ?? "";
				if (ta !== tb) return ta < tb ? 1 : -1;
				return a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0;
			}
			case "subject": {
				const c = a.subject.localeCompare(b.subject, "zh-Hans-CN");
				if (c !== 0) return c;
				const due = compareDue(sa, sb);
				if (due !== 0) return due;
				return a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0;
			}
			case "due":
			default: {
				const due = compareDue(sa, sb);
				if (due !== 0) return due;
				return a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0;
			}
		}
	});
	return copy;
}

export function emptyFilter(): CardFilter {
	return { search: "", tags: [], subject: null, time: "all", starredOnly: false };
}
