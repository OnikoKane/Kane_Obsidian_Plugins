import type { Rating } from "./types.ts";
import { isValidDateString } from "./date.ts";

/**
 * 间隔阶梯（DESIGN §8.2）。STEP_DAYS[max(step,0)] 即本次间隔天数。
 */
export const STEP_DAYS: readonly number[] = [1, 3, 7, 15, 30] as const;

export const MIN_STEP = -1;
export const MAX_STEP = 4;

export interface RatingOutcome {
	/** 评分后的 step（-1..4） */
	step: number;
	/** 本次间隔天数 */
	days: number;
	/** 是否记一次 lapse（只有 again） */
	lapse: boolean;
}

/** 把任意输入收敛到合法 step 范围。 */
export function clampStep(step: number): number {
	if (!Number.isFinite(step)) return MIN_STEP;
	const rounded = Math.round(step);
	if (rounded < MIN_STEP) return MIN_STEP;
	if (rounded > MAX_STEP) return MAX_STEP;
	return rounded;
}

/**
 * 四档评分状态转移表 —— 唯一事实来源，实现严格照此。
 *
 * | step | again | hard | good | easy |
 * | -1   | -1/1  | -1/1 | 0/1  | 1/3  |
 * | 0    | -1/1  | -1/1 | 1/3  | 2/7  |
 * | 1    | -1/1  | 0/1  | 2/7  | 3/15 |
 * | 2    | -1/1  | 1/3  | 3/15 | 4/30 |
 * | 3    | -1/1  | 2/7  | 4/30 | 4/30 |
 * | 4    | -1/1  | 3/15 | 4/30 | 4/30 |
 */
export function applyRating(step: number, rating: Rating): RatingOutcome {
	const current = clampStep(step);
	if (rating === "again") {
		return { step: MIN_STEP, days: STEP_DAYS[0], lapse: true };
	}
	let next: number;
	if (rating === "hard") {
		next = Math.max(MIN_STEP, current - 1);
	} else if (rating === "good") {
		next = Math.min(MAX_STEP, current + 1);
	} else {
		next = Math.min(MAX_STEP, current + 2);
	}
	return {
		step: next,
		days: STEP_DAYS[Math.max(next, 0)],
		lapse: false,
	};
}

/** 评分预览：「N 天后」，用于评分条小字。 */
export function previewDays(step: number, rating: Rating): number {
	return applyRating(step, rating).days;
}

/** 校验并返回 interval 天数（内部使用）。 */
export function assertDue(due: string): string {
	if (!isValidDateString(due)) {
		throw new Error(`非法到期日 ${due}`);
	}
	return due;
}
