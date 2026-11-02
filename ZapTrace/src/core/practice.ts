import type { QuestionCard, Rating, ZaptraceData } from "./types.ts";
import { recordReview, type ReviewContext, type ReviewResult } from "./state.ts";

/**
 * 练习会话状态机（H4，REVIEW-design §2）：
 *
 *   viewing（只显示题干，评分条不渲染、键盘 1–4 不响应、无写盘路径）
 *      └─ reveal() ─► revealed（可评分）
 *                        └─ rate() ─► rated（本题结束）
 *
 * 这是纯逻辑类，不依赖 DOM；UI 只负责根据 phase 决定渲染什么。
 * `rate()` 在非 revealed 状态**直接返回 null，不触碰 data.json**。
 */

export type PracticePhase = "viewing" | "revealed" | "rated";

export interface PracticeProgress {
	position: number;
	total: number;
}

export class PracticeSession {
	readonly queue: QuestionCard[];
	private cursor = 0;
	phase: PracticePhase = "viewing";
	readonly counts: Record<Rating, number> = {
		again: 0,
		hard: 0,
		good: 0,
		easy: 0,
	};
	private shownAt: number | null = null;

	constructor(cards: QuestionCard[]) {
		this.queue = [...cards];
	}

	get total(): number {
		return this.queue.length;
	}

	get position(): number {
		return this.cursor;
	}

	get finished(): boolean {
		return this.cursor >= this.queue.length;
	}

	get current(): QuestionCard | null {
		return this.queue[this.cursor] ?? null;
	}

	get canReveal(): boolean {
		return this.phase === "viewing" && this.current !== null;
	}

	get canRate(): boolean {
		return this.phase === "revealed" && this.current !== null;
	}

	progress(): PracticeProgress {
		return { position: Math.min(this.cursor + 1, this.total), total: this.total };
	}

	/** 记录「题干显示时刻」，用于 elapsedMs。重复调用不覆盖。 */
	markShown(nowMs: number): void {
		if (this.shownAt === null) this.shownAt = nowMs;
	}

	reveal(): boolean {
		if (this.phase !== "viewing") return false;
		this.phase = "revealed";
		return true;
	}

	/**
	 * 评分。**只有 revealed 状态才允许**；viewing / rated 状态返回 null，
	 * 且不会调用 recordReview，因此 data.json 不会被写（H4 硬约束）。
	 */
	rate(data: ZaptraceData, rating: Rating, ctx: ReviewContext): ReviewResult | null {
		const card = this.current;
		if (!card) return null;
		if (this.phase !== "revealed") return null;
		const result = recordReview(data, card, rating, ctx);
		this.counts[rating] += 1;
		this.phase = "rated";
		return result;
	}

	/** 进入下一题；返回是否还有题可练。 */
	advance(): boolean {
		this.cursor += 1;
		this.phase = "viewing";
		this.shownAt = null;
		return !this.finished;
	}

	/** 跳过本题（不写 data.json）。 */
	skip(): boolean {
		return this.advance();
	}

	elapsedMs(nowMs: number): number | null {
		if (this.shownAt === null) return null;
		return Math.max(0, nowMs - this.shownAt);
	}

	summary(): string {
		const { again, hard, good, easy } = this.counts;
		const total = again + hard + good + easy;
		return `本次 ${total} 题，忘记 ${again} / 困难 ${hard} / 想起 ${good} / 秒答 ${easy}`;
	}
}
