import { ItemView, WorkspaceLeaf } from "obsidian";
import type { PluginContext, WorkbenchHandle } from "./pluginContext.ts";
import type { QuestionCard } from "../core/types.ts";
import { PracticePanel } from "./practicePanel.ts";
import { LibraryPanel } from "./libraryPanel.ts";
import { ReviewPanel } from "./reviewPanel.ts";
import { createButton, clearElement } from "./dom.ts";

export const VIEW_TYPE_ZAPTRACE = "zaptrace-workbench";

type TabKey = "practice" | "library" | "review";

/**
 * 三栏工作台（DESIGN §2）。桌面三栏；< 900px 收为单栏 + 底部 Tab（无 JS 依赖，纯 CSS + class 切换）。
 */
export class ZaptraceView extends ItemView implements WorkbenchHandle {
	private readonly plugin: PluginContext;
	private practice!: PracticePanel;
	private library!: LibraryPanel;
	private review!: ReviewPanel;
	private badgeEl: HTMLElement | null = null;
	private sections: Record<TabKey, HTMLElement> | null = null;
	private tabButtons: Record<TabKey, HTMLButtonElement> | null = null;
	private activeTab: TabKey = "practice";
	private unregister: (() => void) | null = null;

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
		return "graduation-cap";
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		clearElement(root);
		root.classList.add("zaptrace-workbench");
		root.setAttribute("role", "region");
		root.setAttribute("aria-label", "ZapTrace");
		root.tabIndex = -1;

		// 顶栏
		const topbar = document.createElement("header");
		topbar.className = "zt-topbar";
		const title = document.createElement("div");
		title.className = "zt-title";
		title.textContent = "ZapTrace";
		const badge = document.createElement("span");
		badge.className = "zt-topbar-badge";
		badge.setAttribute("aria-live", "polite");
		this.badgeEl = badge;
		const actions = document.createElement("div");
		actions.className = "zt-topbar-actions";
		createButton(actions, {
			label: "重建索引",
			cls: "zt-button zt-button-ghost zt-button-small",
			icon: "refresh-cw",
			onClick: () => {
				void this.plugin.rebuildIndex();
			},
		});
		createButton(actions, {
			label: "设置",
			cls: "zt-button zt-button-ghost zt-button-small",
			icon: "settings",
			onClick: () => this.plugin.openSettings(),
		});
		topbar.append(title, badge, actions);
		root.appendChild(topbar);

		// 三栏
		const columns = document.createElement("div");
		columns.className = "zt-columns";

		const buildSection = (tab: TabKey, heading: string): HTMLElement => {
			const section = document.createElement("section");
			section.className = `zt-panel zt-panel-${tab}`;
			section.dataset.tab = tab;
			const head = document.createElement("h2");
			head.className = "zt-panel-title";
			head.textContent = heading;
			const body = document.createElement("div");
			body.className = "zt-panel-body";
			section.append(head, body);
			columns.appendChild(section);
			return body;
		};

		const practiceBody = buildSection("practice", "练习");
		const libraryBody = buildSection("library", "题集");
		const reviewBody = buildSection("review", "复习");
		root.appendChild(columns);

		this.practice = new PracticePanel(practiceBody, this.plugin, this);
		this.library = new LibraryPanel(libraryBody, this.plugin, this);
		this.review = new ReviewPanel(reviewBody, this.plugin, this);

		this.sections = {
			practice: practiceBody.parentElement as HTMLElement,
			library: libraryBody.parentElement as HTMLElement,
			review: reviewBody.parentElement as HTMLElement,
		};

		// 移动端底部 Tab
		const tabs = document.createElement("nav");
		tabs.className = "zt-tabs";
		tabs.setAttribute("role", "tablist");
		const tabButtons = {} as Record<TabKey, HTMLButtonElement>;
		const labels: Array<[TabKey, string]> = [
			["practice", "练习"],
			["library", "题集"],
			["review", "复习"],
		];
		for (const [tab, label] of labels) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "zt-tab";
			button.setAttribute("role", "tab");
			button.setAttribute("aria-selected", String(tab === this.activeTab));
			button.textContent = label;
			button.addEventListener("click", () => this.setActiveTab(tab));
			tabs.appendChild(button);
			tabButtons[tab] = button;
		}
		this.tabButtons = tabButtons;
		root.appendChild(tabs);

		this.registerDomEvent(root, "keydown", (event) => {
			if (this.practice.handleKeydown(event)) return;
			if (event.key === "/" && !this.isTypingTarget(event.target)) {
				event.preventDefault();
				this.library.focusSearch();
			}
		});

		this.unregister = this.plugin.registerWorkbench(this);
		this.setActiveTab("practice");
		this.refreshAll();
	}

	async onClose(): Promise<void> {
		this.unregister?.();
		this.unregister = null;
		clearElement(this.contentEl);
	}

	refreshAll(): void {
		const today = this.plugin.today();
		const dueCount = this.plugin.getCards().filter((card) => {
			const state = this.plugin.getState(card.qid);
			return Boolean(state && state.due && state.due <= today);
		}).length;
		if (this.badgeEl) this.badgeEl.textContent = `今日复习 ${dueCount}`;
		this.practice.render();
		this.library.refresh();
		this.review.refresh();
	}

	startPractice(cards: QuestionCard[]): void {
		if (cards.length === 0) return;
		this.setActiveTab("practice");
		this.practice.start(cards);
		this.contentEl.focus();
	}

	setActiveTab(tab: TabKey): void {
		this.activeTab = tab;
		if (this.sections) {
			for (const key of Object.keys(this.sections) as TabKey[]) {
				this.sections[key].classList.toggle("is-active", key === tab);
			}
		}
		if (this.tabButtons) {
			for (const key of Object.keys(this.tabButtons) as TabKey[]) {
				this.tabButtons[key].setAttribute("aria-selected", String(key === tab));
			}
		}
	}

	private isTypingTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName.toLowerCase();
		return tag === "input" || tag === "textarea" || target.isContentEditable;
	}
}
