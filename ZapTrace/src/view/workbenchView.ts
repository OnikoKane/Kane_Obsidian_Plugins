import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type { PluginContext, WorkbenchHandle } from "./pluginContext.ts";
import type { QuestionCard } from "../core/types.ts";
import { PracticePanel } from "./practicePanel.ts";
import { LibraryPage } from "./libraryPanel.ts";
import { clearElement } from "./dom.ts";
import { closeAllMenus } from "./menu.ts";

export const VIEW_TYPE_ZAPTRACE = "zaptrace-workbench";

type TabKey = "practice" | "library" | "review";

/**
 * 题库工作台（DESIGN-v2 §5）：单页题库 + 右侧练习抽屉（≥1440 分栏 / <1440 覆盖 / <720 全屏）。
 * 练习行为、评分门禁、复习算法全部沿用原实现。
 */
export class ZaptraceView extends ItemView implements WorkbenchHandle {
	private readonly plugin: PluginContext;
	private library!: LibraryPage;
	private practice!: PracticePanel;
	private drawer: HTMLElement | null = null;
	private mask: HTMLElement | null = null;
	private triggerEl: HTMLElement | null = null;
	private unregister: (() => void) | null = null;
	private drawerOpen = false;
	private resumeButton: HTMLButtonElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: PluginContext) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ZAPTRACE;
	}

	getDisplayText(): string {
		return "ZapTrace";
	}

	getIcon(): string {
		return "library";
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		clearElement(root);
		root.classList.add("pd-root", "pd-workbench", "zaptrace-workbench");
		root.setAttribute("role", "region");
		root.setAttribute("aria-label", "ZapTrace 题库");
		root.tabIndex = -1;

		const body = document.createElement("div");
		body.className = "pd-lib-body";

		const main = document.createElement("div");
		main.className = "pd-lib-main";
		body.appendChild(main);

		const drawer = document.createElement("aside");
		drawer.className = "pd-drawer";
		drawer.setAttribute("role", "complementary");
		drawer.setAttribute("aria-label", "练习");
		const drawerHead = document.createElement("div");
		drawerHead.className = "pd-drawer-head";
		const drawerTitle = document.createElement("h2");
		drawerTitle.className = "pd-drawer-title";
		drawerTitle.textContent = "练习";
		const closeBtn = document.createElement("button");
		closeBtn.type = "button";
		closeBtn.className = "pd-icon-btn";
		closeBtn.setAttribute("aria-label", "关闭练习");
		setIcon(closeBtn, "x");
		closeBtn.addEventListener("click", () => this.closeDrawer());
		drawerHead.append(drawerTitle, closeBtn);
		const drawerBody = document.createElement("div");
		drawerBody.className = "pd-drawer-body";
		drawer.append(drawerHead, drawerBody);
		body.appendChild(drawer);
		root.appendChild(body);

		const mask = document.createElement("div");
		mask.className = "pd-drawer-mask";
		mask.addEventListener("click", () => this.closeDrawer());
		root.appendChild(mask);

		this.library = new LibraryPage(main, this.plugin, this);
		this.practice = new PracticePanel(drawerBody, this.plugin, this);
		this.drawer = drawer;
		this.mask = mask;

		const resume = document.createElement("button");
		resume.type = "button";
		resume.className = "pd-btn is-primary pd-resume";
		resume.textContent = "继续练习";
		resume.hidden = true;
		resume.addEventListener("click", () => {
			this.openDrawer();
			this.practice.render();
		});
		root.appendChild(resume);
		this.resumeButton = resume;

		this.registerDomEvent(root, "keydown", (event) => {
			if (event.key === "Escape" && this.drawerOpen) {
				event.preventDefault();
				this.closeDrawer();
				return;
			}
			if (this.drawerOpen && this.practice.handleKeydown(event)) return;
			if (event.key === "/" && !this.isTypingTarget(event.target)) {
				event.preventDefault();
				this.library.focusSearch();
			}
		});

		this.unregister = this.plugin.registerWorkbench(this);
		this.refreshAll();
	}

	async onClose(): Promise<void> {
		closeAllMenus();
		this.unregister?.();
		this.unregister = null;
		clearElement(this.contentEl);
	}

	/* ---------------- WorkbenchHandle ---------------- */

	refreshAll(): void {
		this.library.refresh();
		this.practice.render();
	}

	startPractice(cards: QuestionCard[]): void {
		if (cards.length === 0) return;
		this.triggerEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		this.openDrawer();
		this.practice.start(cards);
		const first = this.drawer?.querySelector<HTMLElement>(
			".pd-practice-actions button, .pd-practice button"
		);
		first?.focus();
	}

	setActiveTab(tab: TabKey): void {
		if (tab === "practice") {
			this.openDrawer();
			return;
		}
		this.library.setView(tab === "review" ? "review" : "cards");
	}

	/* ---------------- 抽屉 ---------------- */

	private openDrawer(): void {
		this.drawerOpen = true;
		this.contentEl.classList.add("is-drawer-open");
		if (this.drawer) {
			this.drawer.hidden = false;
			const overlay = window.innerWidth < 1440;
			this.drawer.setAttribute("role", overlay ? "dialog" : "complementary");
			if (overlay) this.drawer.setAttribute("aria-modal", "true");
			else this.drawer.removeAttribute("aria-modal");
		}
		if (this.mask) this.mask.hidden = false;
		if (this.resumeButton) this.resumeButton.hidden = true;
	}

	private closeDrawer(): void {
		this.drawerOpen = false;
		this.contentEl.classList.remove("is-drawer-open");
		if (this.drawer) this.drawer.hidden = true;
		if (this.mask) this.mask.hidden = true;
		// 关闭不丢当前会话：保留 PracticePanel 内存状态，提供「继续练习」入口
		if (this.resumeButton) this.resumeButton.hidden = !this.practice.hasActiveSession;
		if (this.triggerEl && this.triggerEl.isConnected) this.triggerEl.focus();
		this.triggerEl = null;
	}

	private isTypingTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName.toLowerCase();
		return tag === "input" || tag === "textarea" || target.isContentEditable;
	}
}
