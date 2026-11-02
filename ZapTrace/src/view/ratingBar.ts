import type { Rating } from "../core/types.ts";
import { RATING_LABELS, RATINGS } from "../core/types.ts";
import { ratingPreview } from "../core/format.ts";

/**
 * 评分条（DESIGN §10.6）。只有调用方在 revealed 之后才创建它（H4）。
 * 语义：radiogroup + radio；←/→ 移动焦点，Enter/Space 由原生 button 触发。
 */
export function buildRatingBar(step: number, onRate: (rating: Rating) => void): HTMLElement {
	const bar = document.createElement("div");
	bar.className = "zt-rating";
	bar.setAttribute("role", "radiogroup");
	bar.setAttribute("aria-label", "回忆评分");

	const buttons: HTMLButtonElement[] = [];
	RATINGS.forEach((rating, index) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "zt-rating-btn";
		button.dataset.rating = rating;
		button.setAttribute("role", "radio");
		button.setAttribute("aria-checked", "false");
		button.setAttribute("tabindex", index === 0 ? "0" : "-1");

		const label = document.createElement("span");
		label.className = "zt-rating-label";
		label.textContent = RATING_LABELS[rating];
		const preview = document.createElement("span");
		preview.className = "zt-rating-preview";
		preview.textContent = ratingPreview(step, rating);
		button.append(label, preview);

		button.addEventListener("click", () => onRate(rating));
		button.addEventListener("keydown", (event) => {
			if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
				event.preventDefault();
				const delta = event.key === "ArrowRight" ? 1 : -1;
				const next = (index + delta + buttons.length) % buttons.length;
				buttons.forEach((item, i) => item.setAttribute("tabindex", i === next ? "0" : "-1"));
				buttons[next].focus();
			}
		});
		buttons.push(button);
		bar.appendChild(button);
	});

	return bar;
}
