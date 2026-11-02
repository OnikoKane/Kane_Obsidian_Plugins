import { setIcon } from "obsidian";

/**
 * 通用 DOM 小工具（视图层）。
 *
 * 注意（C7）：折块的 `id` 用自增序号，绝不直接用含 `:` / `.` 的 qid，
 * 避免 `querySelector` / `aria-controls` 的选择器转义坑；qid 只放 `data-qid`。
 */

let collapseSeq = 0;

export interface CollapsibleOptions {
	startsOpen?: boolean;
	/** 首次展开时渲染内容（懒渲染，防偷看 + 省性能） */
	onFirstOpen?: (content: HTMLElement) => void | Promise<void>;
}

export interface CollapsibleHandle {
	root: HTMLElement;
	header: HTMLButtonElement;
	content: HTMLElement;
	isOpen(): boolean;
	setOpen(open: boolean): void;
}

export function createCollapsible(
	parent: HTMLElement,
	label: string,
	options: CollapsibleOptions = {}
): CollapsibleHandle {
	const root = document.createElement("div");
	root.className = "zt-collapse";
	root.setAttribute("data-open", options.startsOpen ? "true" : "false");

	const id = `zt-collapse-${++collapseSeq}`;

	const header = document.createElement("button");
	header.type = "button";
	header.className = "zt-collapse-header";
	header.setAttribute("aria-expanded", options.startsOpen ? "true" : "false");
	header.setAttribute("aria-controls", id);

	const dot = document.createElement("span");
	dot.className = "zt-collapse-dot";
	dot.setAttribute("aria-hidden", "true");
	const chevron = document.createElement("span");
	chevron.className = "zt-collapse-chevron";
	chevron.setAttribute("aria-hidden", "true");
	const text = document.createElement("span");
	text.className = "zt-collapse-label";
	text.textContent = label;
	header.append(dot, chevron, text);

	const bodyWrap = document.createElement("div");
	bodyWrap.className = "zt-collapse-body";
	bodyWrap.id = id;
	const content = document.createElement("div");
	content.className = "zt-collapse-inner";
	bodyWrap.appendChild(content);

	root.append(header, bodyWrap);

	let loaded = false;
	const setOpen = (open: boolean): void => {
		root.setAttribute("data-open", open ? "true" : "false");
		header.setAttribute("aria-expanded", open ? "true" : "false");
		if (open && !loaded) {
			loaded = true;
			void options.onFirstOpen?.(content);
		}
	};

	header.addEventListener("click", () => {
		setOpen(root.getAttribute("data-open") !== "true");
	});

	parent.appendChild(root);
	return {
		root,
		header,
		content,
		isOpen: () => root.getAttribute("data-open") === "true",
		setOpen,
	};
}

export function createButton(
	parent: HTMLElement,
	options: {
		label: string;
		cls?: string;
		icon?: string;
		ariaLabel?: string;
		onClick?: () => void;
	}
): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.className = options.cls ?? "zt-button";
	if (options.icon) setIcon(button, options.icon);
	if (options.ariaLabel) button.setAttribute("aria-label", options.ariaLabel);
	if (options.label) {
		const span = document.createElement("span");
		span.textContent = options.label;
		button.appendChild(span);
	}
	if (options.onClick) button.addEventListener("click", options.onClick);
	parent.appendChild(button);
	return button;
}

export function createIconButton(
	parent: HTMLElement,
	icon: string,
	ariaLabel: string,
	onClick: () => void,
	cls = "zt-icon-button"
): HTMLButtonElement {
	return createButton(parent, { label: "", icon, ariaLabel, onClick, cls });
}

/** 清空一个容器（不销毁其监听器以外的东西）。 */
export function clearElement(el: HTMLElement): void {
	while (el.firstChild) el.removeChild(el.firstChild);
}
