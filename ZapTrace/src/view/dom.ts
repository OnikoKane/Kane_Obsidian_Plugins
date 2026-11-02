import { setIcon } from "obsidian";

/**
 * 通用 DOM 小工具（视图层）。
 *
 * C7：折块 id 用自增序号，绝不用含 `:` / `.` 的 qid。
 * Quiet Cards：同时保留 `zt-collapse*` 行为钩子与 `pd-fold*` 视觉类（dual-class）。
 */

let collapseSeq = 0;

export interface CollapsibleOptions {
	startsOpen?: boolean;
	/** 右侧计数文案（如「答案 2 行 · 笔记 1 行」） */
	count?: string;
	/** 首次展开时渲染内容（懒渲染，防偷看 + 省性能） */
	onFirstOpen?: (content: HTMLElement) => void | Promise<void>;
	/** 用户开合时回调（用于持久化 foldOpen） */
	onToggle?: (open: boolean) => void;
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
	root.className = "zt-collapse pd-fold";
	root.setAttribute("data-open", options.startsOpen ? "true" : "false");

	const id = `zt-collapse-${++collapseSeq}`;

	const header = document.createElement("button");
	header.type = "button";
	header.className = "zt-collapse-header pd-fold-head";
	header.setAttribute("aria-expanded", options.startsOpen ? "true" : "false");
	header.setAttribute("aria-controls", id);

	const chevron = document.createElement("span");
	chevron.className = "zt-collapse-chevron pd-fold-chevron";
	chevron.setAttribute("aria-hidden", "true");
	setIcon(chevron, "chevron-right");

	const text = document.createElement("span");
	text.className = "zt-collapse-label pd-fold-label";
	text.textContent = label;
	header.append(chevron, text);

	if (options.count) {
		const count = document.createElement("span");
		count.className = "pd-fold-count";
		count.textContent = options.count;
		header.appendChild(count);
	}

	const bodyWrap = document.createElement("div");
	bodyWrap.className = "zt-collapse-body pd-fold-body";
	bodyWrap.id = id;
	const content = document.createElement("div");
	content.className = "zt-collapse-inner pd-fold-content";
	bodyWrap.appendChild(content);

	root.append(header, bodyWrap);

	let loaded = false;
	const setOpen = (open: boolean): void => {
		const wasOpen = root.getAttribute("data-open") === "true";
		root.setAttribute("data-open", open ? "true" : "false");
		header.setAttribute("aria-expanded", open ? "true" : "false");
		if (open && !loaded) {
			loaded = true;
			void options.onFirstOpen?.(content);
		}
		if (wasOpen !== open) options.onToggle?.(open);
	};

	header.addEventListener("click", () => {
		setOpen(root.getAttribute("data-open") !== "true");
	});

	// 初始就是展开态（如题库卡 foldOpen 默认 true）时立即渲染内容
	if (options.startsOpen) {
		loaded = true;
		void options.onFirstOpen?.(content);
	}

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
	button.className = options.cls ?? "pd-btn";
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
	cls = "pd-icon-btn"
): HTMLButtonElement {
	return createButton(parent, { label: "", icon, ariaLabel, onClick, cls });
}

/** 清空一个容器（不销毁其监听器以外的东西）。 */
export function clearElement(el: HTMLElement): void {
	while (el.firstChild) el.removeChild(el.firstChild);
}
