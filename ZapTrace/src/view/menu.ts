import { setIcon } from "obsidian";

/** Quiet Cards 弹出菜单（DESIGN-v2 §4.2 / §6 .pd-menu）。 */

export interface MenuItem {
	label: string;
	icon?: string;
	danger?: boolean;
	onSelect: () => void;
}

let activeMenu: HTMLElement | null = null;
let activeCleanup: (() => void) | null = null;

function closeActiveMenu(): void {
	if (activeCleanup) {
		activeCleanup();
		activeCleanup = null;
	}
	if (activeMenu) {
		activeMenu.remove();
		activeMenu = null;
	}
}

/** 在锚点元素右下方打开菜单（放不下翻到上方）。 */
export function openMenu(anchor: HTMLElement, items: MenuItem[]): void {
	closeActiveMenu();
	if (items.length === 0) return;

	const menu = document.createElement("div");
	// 菜单挂在 body 上，必须自带 .pd-root 才能拿到 --pd-* 令牌
	menu.className = "pd-root pd-menu";
	menu.setAttribute("role", "menu");
	menu.style.visibility = "hidden";

	for (const item of items) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = `pd-menu-item${item.danger ? " is-danger" : ""}`;
		button.setAttribute("role", "menuitem");
		if (item.icon) {
			const iconWrap = document.createElement("span");
			iconWrap.className = "pd-menu-icon";
			setIcon(iconWrap, item.icon);
			button.appendChild(iconWrap);
		}
		const label = document.createElement("span");
		label.textContent = item.label;
		button.appendChild(label);
		button.addEventListener("click", (event) => {
			event.stopPropagation();
			closeActiveMenu();
			item.onSelect();
		});
		menu.appendChild(button);
	}

	document.body.appendChild(menu);
	const rect = anchor.getBoundingClientRect();
	const width = menu.offsetWidth || 196;
	const height = menu.offsetHeight || 0;
	let left = rect.right - width;
	if (left < 8) left = 8;
	let top = rect.bottom + 6;
	if (top + height > window.innerHeight - 8) {
		top = Math.max(8, rect.top - height - 6);
	}
	menu.style.left = `${Math.round(left)}px`;
	menu.style.top = `${Math.round(top)}px`;
	menu.style.visibility = "visible";

	const onPointerDown = (event: MouseEvent): void => {
		if (!menu.contains(event.target as Node)) closeActiveMenu();
	};
	const onKeyDown = (event: KeyboardEvent): void => {
		const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>(".pd-menu-item"));
		const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
		if (event.key === "Escape") {
			event.preventDefault();
			closeActiveMenu();
			anchor.focus();
			return;
		}
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const delta = event.key === "ArrowDown" ? 1 : -1;
			const next = (currentIndex + delta + buttons.length) % buttons.length;
			buttons[next]?.focus();
		}
	};

	document.addEventListener("mousedown", onPointerDown, true);
	document.addEventListener("keydown", onKeyDown, true);
	activeMenu = menu;
	activeCleanup = () => {
		document.removeEventListener("mousedown", onPointerDown, true);
		document.removeEventListener("keydown", onKeyDown, true);
	};
	menu.querySelector<HTMLButtonElement>(".pd-menu-item")?.focus();
}

/** 页面卸载时调用，确保不残留浮层。 */
export function closeAllMenus(): void {
	closeActiveMenu();
}
