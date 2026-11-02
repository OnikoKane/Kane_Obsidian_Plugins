import { QUESTION_TYPE_LABELS, type QuestionCard } from "../core/types.ts";

/**
 * 单选 / 多选 / 判断的选择 UI（阅读卡、题库卡、练习抽屉共用）。
 * 选择只存在于当前渲染实例，不写 Markdown / data.json；揭晓答案后锁定并染色。
 */

export interface ChoiceHandle {
	root: HTMLElement;
	selection(): string[];
	/** 揭晓答案：标出正确项/选错项（可随选择变化重新标记，不锁定） */
	mark(): void;
	/** 锁定交互（练习抽屉揭晓后使用） */
	lock(): void;
}

export interface ChoiceOptions {
	compact?: boolean;
	/** 初始已选（例如揭晓答案后重渲染时保留用户作答） */
	selection?: string[];
	onChange?: (selection: string[]) => void;
	/** 提供后渲染「提交答案」按钮：点击时回调当前作答 */
	onSubmit?: (selection: string[]) => void;
}

export function renderChoices(card: QuestionCard, options: ChoiceOptions = {}): ChoiceHandle | null {
	if (card.type === "short" || card.options.length < 2) return null;

	const allowed = new Set(card.options.map((option) => option.label));
	let selected = (options.selection ?? []).filter((label) => allowed.has(label));
	let locked = false;
	const root = document.createElement("div");
	root.className = "pd-choices" + (options.compact ? " is-compact" : "");
	root.setAttribute("role", card.type === "multiple" ? "group" : "radiogroup");
	root.setAttribute("aria-label", card.type === "multiple" ? "多选题选项" : "选项");
	const typeLabel = document.createElement("div");
	typeLabel.className = "pd-choice-type";
	typeLabel.textContent = `${QUESTION_TYPE_LABELS[card.type]}题`;
	root.appendChild(typeLabel);
	const buttons = new Map<string, HTMLButtonElement>();

	const sync = (): void => {
		for (const [label, button] of buttons) {
			button.setAttribute("aria-checked", String(selected.includes(label)));
			button.classList.toggle("is-selected", selected.includes(label));
		}
		if (submitBtn) submitBtn.disabled = locked || selected.length === 0;
	};

	const toggle = (label: string): void => {
		if (locked) return;
		if (card.type === "multiple") {
			selected = selected.includes(label)
				? selected.filter((item) => item !== label)
				: [...selected, label];
		} else {
			selected = selected.includes(label) ? [] : [label];
		}
		sync();
		options.onChange?.([...selected]);
	};

	for (const option of card.options) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "pd-choice";
		button.dataset.label = option.label;
		button.setAttribute("role", card.type === "multiple" ? "checkbox" : "radio");
		button.setAttribute("aria-checked", "false");
		if (card.type !== "judge") {
			const key = document.createElement("span");
			key.className = "pd-choice-key";
			key.textContent = option.label;
			button.appendChild(key);
		}
		const text = document.createElement("span");
		text.className = "pd-choice-text";
		text.textContent = option.text;
		button.appendChild(text);
		button.addEventListener("click", (event) => {
			event.stopPropagation();
			toggle(option.label);
		});
		buttons.set(option.label, button);
		root.appendChild(button);
	}

	// 「提交答案」：卡内作答用（练习抽屉有自己的流程，不传 onSubmit）
	let submitBtn: HTMLButtonElement | null = null;
	if (options.onSubmit) {
		submitBtn = document.createElement("button");
		submitBtn.type = "button";
		submitBtn.className = "pd-choice-submit";
		submitBtn.textContent = "提交答案";
		submitBtn.disabled = selected.length === 0;
		submitBtn.addEventListener("click", (event) => {
			event.stopPropagation();
			if (locked || selected.length === 0) return;
			options.onSubmit?.([...selected]);
		});
		root.appendChild(submitBtn);
	}
	sync();

	return {
		root,
		selection: () => [...selected],
		mark: () => {
			const correct = new Set(card.correct);
			for (const [label, button] of buttons) {
				button.classList.toggle("is-correct", correct.has(label));
				button.classList.toggle("is-wrong", selected.includes(label) && !correct.has(label));
			}
			root.classList.add("is-revealed");
			if (submitBtn) submitBtn.hidden = true;
		},
		lock: () => {
			locked = true;
			for (const button of buttons.values()) button.disabled = true;
		},
	};
}

/** 「正确答案：A、C」文案；简答题返回空串。 */
export function answerKeyText(card: QuestionCard): string {
	if (card.type === "short" || card.correct.length === 0) return "";
	return `正确答案：${card.correct.join("、")}`;
}
