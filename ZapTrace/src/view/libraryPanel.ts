import { Component, setIcon } from "obsidian";
import type { PluginContext } from "./pluginContext.ts";
import type { CardFilter, QuestionCard, SortKey } from "../core/types.ts";
import { emptyFilter, filterCards, sortCards } from "../core/filter.ts";
import { clearElement, createButton } from "./dom.ts";
import { openMenu } from "./menu.ts";
import { ReviewPanel } from "./reviewPanel.ts";
import { QUESTION_TEMPLATE } from "../template.ts";
import { toPreviewText } from "./plainText.ts";
import {
	dueLine,
	libStatus,
	matchesStatus,
	statusCounts,
	statusLabel,
	todayAnswered,
	type StatusFilterKey,
} from "./libStatus.ts";

/**
 * 题库页（DESIGN-v2 §5）：页头 / 状态 chips / 筛选 / 分段视图（题卡流 · 紧凑表格 · 独立复习）。
 * 全部基于现有数据派生，不新增字段，不写任何 Markdown。
 */

type ViewMode = "cards" | "table" | "review";

interface StatusChipDef {
	key: StatusFilterKey;
	label: string;
	count: number;
}

export class LibraryPage {
	private readonly host: HTMLElement;
	private readonly plugin: PluginContext;
	private readonly ownerComponent: Component;

	private filter: CardFilter = emptyFilter();
	private sort: SortKey = "due";
	private statusFilter: StatusFilterKey = "all";
	private viewMode: ViewMode = "cards";

	private searchInput: HTMLInputElement | null = null;
	private subjectSelect: HTMLSelectElement | null = null;
	private sortSelect: HTMLSelectElement | null = null;
	private countEl: HTMLElement | null = null;
	private statusWrap: HTMLElement | null = null;
	private tagsWrap: HTMLElement | null = null;
	private ctaButton: HTMLButtonElement | null = null;
	private segButtons: HTMLButtonElement[] = [];
	private cardsHost: HTMLElement | null = null;
	private tableHost: HTMLElement | null = null;
	private reviewHost: HTMLElement | null = null;
	private panels: Record<ViewMode, HTMLElement> | null = null;
	private reviewPanel: ReviewPanel;
	private entered = new Set<string>();

	constructor(host: HTMLElement, plugin: PluginContext, ownerComponent: Component) {
		this.host = host;
		this.plugin = plugin;
		this.ownerComponent = ownerComponent;
		this.build();
		this.reviewPanel = new ReviewPanel(this.reviewHost as HTMLElement, plugin, ownerComponent);
	}

	/* ---------------- 骨架 ---------------- */

	private build(): void {
		const header = document.createElement("header");
		header.className = "pd-lib-header";
		const heading = document.createElement("h1");
		heading.className = "pd-h1";
		heading.textContent = "题库";
		const count = document.createElement("span");
		count.className = "pd-count";
		const search = document.createElement("input");
		search.type = "search";
		search.className = "pd-search";
		search.placeholder = "搜索题干 / 知识点 / 科目";
		search.setAttribute("aria-label", "搜索题干或标签");
		search.addEventListener("input", () => {
			this.filter.search = search.value;
			this.renderCards();
			this.renderTable();
		});
		const cta = document.createElement("button");
		cta.type = "button";
		cta.className = "pd-btn is-primary pd-cta";
		cta.addEventListener("click", () => this.onCta());
		const actions = document.createElement("div");
		actions.className = "pd-header-actions";
		createButton(actions, {
			label: "",
			icon: "refresh-cw",
			ariaLabel: "重建索引",
			cls: "pd-icon-btn",
			onClick: () => {
				void this.plugin.rebuildIndex();
			},
		});
		createButton(actions, {
			label: "",
			icon: "settings",
			ariaLabel: "设置",
			cls: "pd-icon-btn",
			onClick: () => this.plugin.openSettings(),
		});
		header.append(heading, count, search, cta, actions);
		this.host.appendChild(header);
		this.countEl = count;
		this.searchInput = search;
		this.ctaButton = cta;

		const statusbar = document.createElement("div");
		statusbar.className = "pd-statusbar";
		statusbar.setAttribute("role", "group");
		statusbar.setAttribute("aria-label", "状态筛选");
		this.host.appendChild(statusbar);
		this.statusWrap = statusbar;

		const filterbar = document.createElement("div");
		filterbar.className = "pd-filterbar";

		const subjectField = document.createElement("label");
		subjectField.className = "pd-field";
		const subjectLabel = document.createElement("span");
		subjectLabel.className = "pd-label";
		subjectLabel.textContent = "科目";
		const subjectSelect = document.createElement("select");
		subjectSelect.className = "pd-select";
		subjectSelect.setAttribute("aria-label", "科目筛选");
		subjectSelect.addEventListener("change", () => {
			this.filter.subject = subjectSelect.value === "" ? null : subjectSelect.value;
			this.renderCards();
			this.renderTable();
		});
		subjectField.append(subjectLabel, subjectSelect);
		this.subjectSelect = subjectSelect;

		const sortField = document.createElement("label");
		sortField.className = "pd-field";
		const sortLabel = document.createElement("span");
		sortLabel.className = "pd-label";
		sortLabel.textContent = "排序";
		const sortSelect = document.createElement("select");
		sortSelect.className = "pd-select";
		sortSelect.setAttribute("aria-label", "排序");
		for (const [value, label] of [
			["due", "按到期"],
			["starred", "收藏优先"],
			["recent", "最近新增"],
			["subject", "按科目"],
		] as Array<[SortKey, string]>) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = label;
			sortSelect.appendChild(option);
		}
		sortSelect.addEventListener("change", () => {
			this.sort = sortSelect.value as SortKey;
			this.renderCards();
			this.renderTable();
		});
		sortField.append(sortLabel, sortSelect);
		this.sortSelect = sortSelect;

		const tagsGroup = document.createElement("div");
		tagsGroup.className = "pd-tagfilter";
		tagsGroup.setAttribute("role", "group");
		tagsGroup.setAttribute("aria-label", "标签筛选");
		this.tagsWrap = tagsGroup;

		filterbar.append(subjectField, sortField, tagsGroup);
		const clear = createButton(filterbar, {
			label: "清除筛选",
			cls: "pd-btn",
			onClick: () => this.clearFilters(),
		});
		clear.classList.add("pd-clear");
		this.host.appendChild(filterbar);

		const seg = document.createElement("div");
		seg.className = "pd-seg";
		seg.setAttribute("role", "tablist");
		seg.setAttribute("aria-label", "视图");
		const defs: Array<[ViewMode, string]> = [
			["cards", "题卡流"],
			["table", "紧凑表格"],
			["review", "独立复习"],
		];
		defs.forEach(([mode, label], index) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "pd-seg-btn";
			button.setAttribute("role", "tab");
			button.setAttribute("aria-selected", String(mode === this.viewMode));
			button.setAttribute("aria-controls", `pd-panel-${mode}`);
			button.id = `pd-tab-${mode}`;
			button.textContent = label;
			button.tabIndex = mode === this.viewMode ? 0 : -1;
			button.addEventListener("click", () => this.setView(mode));
			button.addEventListener("keydown", (event) => {
				if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
				event.preventDefault();
				const delta = event.key === "ArrowRight" ? 1 : -1;
				const next = (index + delta + defs.length) % defs.length;
				this.setView(defs[next][0]);
				this.segButtons[next]?.focus();
			});
			seg.appendChild(button);
			this.segButtons.push(button);
		});
		this.host.appendChild(seg);

		const content = document.createElement("div");
		content.className = "pd-content";

		const cardsPanel = document.createElement("div");
		cardsPanel.className = "pd-view";
		cardsPanel.id = "pd-panel-cards";
		cardsPanel.setAttribute("role", "tabpanel");
		cardsPanel.setAttribute("aria-labelledby", "pd-tab-cards");
		const gridHost = document.createElement("div");
		gridHost.className = "pd-grid";
		gridHost.setAttribute("role", "list");
		cardsPanel.appendChild(gridHost);

		const tablePanel = document.createElement("div");
		tablePanel.className = "pd-view";
		tablePanel.id = "pd-panel-table";
		tablePanel.setAttribute("role", "tabpanel");
		tablePanel.setAttribute("aria-labelledby", "pd-tab-table");

		const reviewPanel = document.createElement("div");
		reviewPanel.className = "pd-view";
		reviewPanel.id = "pd-panel-review";
		reviewPanel.setAttribute("role", "tabpanel");
		reviewPanel.setAttribute("aria-labelledby", "pd-tab-review");

		content.append(cardsPanel, tablePanel, reviewPanel);
		this.host.appendChild(content);

		this.cardsHost = gridHost;
		this.tableHost = tablePanel;
		this.reviewHost = reviewPanel;
		this.panels = { cards: cardsPanel, table: tablePanel, review: reviewPanel };
	}

	/* ---------------- 公共接口 ---------------- */

	refresh(): void {
		this.syncHeader();
		this.renderStatusChips();
		this.syncSubjectOptions();
		this.renderTagChips();
		this.renderCards();
		this.renderTable();
		if (this.viewMode === "review") this.reviewPanel.refresh();
		this.applyViewVisibility();
	}

	focusSearch(): void {
		this.searchInput?.focus();
	}

	setView(mode: ViewMode): void {
		this.viewMode = mode;
		this.applyViewVisibility();
		this.segButtons.forEach((button, index) => {
			const key = (["cards", "table", "review"] as ViewMode[])[index];
			const selected = key === mode;
			button.setAttribute("aria-selected", String(selected));
			button.tabIndex = selected ? 0 : -1;
		});
		if (mode === "review") this.reviewPanel.refresh();
	}

	/* ---------------- 页头 / 状态 ---------------- */

	private syncHeader(): void {
		const cards = this.plugin.getCards();
		const today = this.plugin.today();
		if (this.countEl) this.countEl.textContent = `全部题目 · ${cards.length} 题`;
		const due = cards.filter((card) => {
			const state = this.plugin.getState(card.qid);
			return Boolean(state?.due && state.due <= today);
		});
		if (this.ctaButton) {
			this.ctaButton.textContent =
				due.length > 0
					? `继续上次复习 · 今日已作答 ${todayAnswered(this.plugin.data, today)} 题`
					: "随机练一题";
		}
	}

	private onCta(): void {
		const today = this.plugin.today();
		const due = this.plugin
			.getCards()
			.filter((card) => {
				const state = this.plugin.getState(card.qid);
				return Boolean(state?.due && state.due <= today);
			})
			.sort((a, b) => {
				const sa = this.plugin.getState(a.qid);
				const sb = this.plugin.getState(b.qid);
				const da = sa?.due ?? "";
				const db = sb?.due ?? "";
				if (da !== db) return da < db ? -1 : 1;
				return (sb?.lapses ?? 0) - (sa?.lapses ?? 0);
			});
		if (due.length > 0) {
			void this.plugin.startPractice(due.slice(0, this.plugin.settings.dailyReviewLimit));
			return;
		}
		const cards = this.plugin.getCards();
		if (cards.length === 0) return;
		void this.plugin.startPractice([cards[Math.floor(Math.random() * cards.length)]]);
	}

	private renderStatusChips(): void {
		const wrap = this.statusWrap;
		if (!wrap) return;
		clearElement(wrap);
		const cards = this.plugin.getCards();
		const today = this.plugin.today();
		const counts = statusCounts(cards, this.plugin.data, today);
		const defs: StatusChipDef[] = [
			{ key: "all", label: "全部题目", count: counts.all },
			{ key: "due", label: "到期复习", count: counts.due },
			{ key: "starred", label: "已收藏", count: counts.starred },
			{ key: "unlearned", label: "未练", count: counts.unlearned },
			{ key: "needsFix", label: "需完善", count: counts.needsFix },
			{ key: "mistake", label: "错题", count: counts.mistake },
		];
		for (const def of defs) {
			const chip = document.createElement("button");
			chip.type = "button";
			chip.className = "pd-chip";
			chip.setAttribute("aria-pressed", String(this.statusFilter === def.key));
			const label = document.createElement("span");
			label.textContent = def.label;
			const count = document.createElement("span");
			count.className = "pd-chip-count";
			count.textContent = String(def.count);
			chip.append(label, count);
			chip.addEventListener("click", () => {
				this.statusFilter = this.statusFilter === def.key ? "all" : def.key;
				this.renderStatusChips();
				this.renderCards();
				this.renderTable();
			});
			wrap.appendChild(chip);
		}
	}

	private syncSubjectOptions(): void {
		const select = this.subjectSelect;
		if (!select) return;
		const current = this.filter.subject ?? "";
		clearElement(select);
		const all = document.createElement("option");
		all.value = "";
		all.textContent = "全部科目";
		select.appendChild(all);
		const subjects = new Set<string>();
		for (const card of this.plugin.getCards()) subjects.add(card.subject);
		for (const subject of Array.from(subjects).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))) {
			const option = document.createElement("option");
			option.value = subject;
			option.textContent = subject;
			select.appendChild(option);
		}
		select.value = current;
		if (select.value !== current) this.filter.subject = null;
	}

	private renderTagChips(): void {
		const wrap = this.tagsWrap;
		if (!wrap) return;
		clearElement(wrap);
		const tags = new Set<string>();
		for (const card of this.plugin.getCards()) for (const tag of card.tags) tags.add(tag);
		for (const tag of Array.from(tags).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))) {
			const chip = document.createElement("button");
			chip.type = "button";
			chip.className = "pd-chip pd-chip-tag";
			chip.textContent = tag;
			const active = this.filter.tags.includes(tag);
			chip.setAttribute("aria-pressed", String(active));
			chip.addEventListener("click", () => {
				this.filter.tags = active
					? this.filter.tags.filter((item) => item !== tag)
					: [...this.filter.tags, tag];
				this.renderTagChips();
				this.renderCards();
				this.renderTable();
			});
			wrap.appendChild(chip);
		}
	}

	private clearFilters(): void {
		this.filter = emptyFilter();
		this.statusFilter = "all";
		this.sort = "due";
		if (this.searchInput) this.searchInput.value = "";
		if (this.subjectSelect) this.subjectSelect.value = "";
		if (this.sortSelect) this.sortSelect.value = "due";
		this.renderStatusChips();
		this.syncSubjectOptions();
		this.renderTagChips();
		this.renderCards();
		this.renderTable();
	}

	/* ---------------- 数据 ---------------- */

	private computeFiltered(): QuestionCard[] {
		const today = this.plugin.today();
		const cards = this.plugin
			.getCards()
			.filter((card) => matchesStatus(card, this.plugin.getState(card.qid), this.statusFilter, today));
		const filtered = filterCards(cards, this.plugin.data, this.filter, today);
		return sortCards(filtered, this.plugin.data, this.sort, today);
	}

	/* ---------------- 题卡流 ---------------- */

	private renderCards(): void {
		const grid = this.cardsHost;
		if (!grid) return;
		clearElement(grid);
		const all = this.plugin.getCards();
		const cards = this.computeFiltered();
		if (all.length === 0) {
			this.renderEmpty(grid, "还没有题卡。复制模板，粘进任意笔记。", true);
			return;
		}
		if (cards.length === 0) {
			this.renderEmpty(grid, "没有符合条件的题。", false);
			return;
		}
		let index = 0;
		for (const card of cards) {
			const isEnter = index < 5 && !this.entered.has(card.qid);
			if (index < 5) this.entered.add(card.qid);
			index++;
			grid.appendChild(this.buildQCard(card, isEnter));
		}
	}

	private buildQCard(card: QuestionCard, isEnter: boolean): HTMLElement {
		const today = this.plugin.today();
		const state = this.plugin.getState(card.qid);
		const qcard = document.createElement("div");
		qcard.className = "pd-qcard" + (isEnter ? " is-enter" : "");
		qcard.dataset.qid = card.qid;
		qcard.setAttribute("role", "listitem");

		const main = document.createElement("div");
		main.className = "pd-qcard-main";
		main.setAttribute("role", "button");
		main.tabIndex = 0;
		const preview = toPreviewText(card.stem) || "（空题干）";
		main.setAttribute("aria-label", `练习：${preview.slice(0, 30)}`);

		const head = document.createElement("div");
		head.className = "pd-qcard-head";
		head.appendChild(this.buildTags(card));
		main.appendChild(head);

		const stem = document.createElement("div");
		stem.className = "pd-qcard-stem";
		stem.textContent = preview;
		main.appendChild(stem);

		const foot = document.createElement("div");
		foot.className = "pd-qcard-foot";
		const badge = statusLabel(libStatus(card, state, today));
		const chip = document.createElement("span");
		chip.className = `pd-status ${badge.cls}`;
		chip.textContent = badge.text;
		const due = document.createElement("span");
		due.className = "pd-qcard-due";
		due.textContent = dueLine(state, today);
		const source = document.createElement("span");
		source.className = "pd-qcard-source";
		source.textContent = card.source ? `出处：${card.source}` : card.pdf ? "PDF" : "";
		foot.append(chip, due, source);
		main.appendChild(foot);
		main.addEventListener("click", () => {
			void this.plugin.startPractice([card]);
		});
		main.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				void this.plugin.startPractice([card]);
			}
		});

		const tools = document.createElement("div");
		tools.className = "pd-qcard-tools";
		const detail = document.createElement("button");
		detail.type = "button";
		detail.className = "pd-qcard-detail";
		detail.textContent = "查看详情";
		detail.addEventListener("click", (event) => {
			event.stopPropagation();
			void this.plugin.openSource(card);
		});
		const more = document.createElement("button");
		more.type = "button";
		more.className = "pd-icon-btn";
		more.setAttribute("aria-label", "更多操作");
		more.setAttribute("aria-haspopup", "menu");
		setIcon(more, "more-horizontal");
		more.addEventListener("click", (event) => {
			event.stopPropagation();
			this.openCardMenu(more, card);
		});
		tools.append(detail, more);

		qcard.append(main, tools);
		return qcard;
	}

	/* ---------------- 紧凑表格 ---------------- */

	private renderTable(): void {
		const host = this.tableHost;
		if (!host) return;
		clearElement(host);
		const all = this.plugin.getCards();
		const cards = this.computeFiltered();
		if (all.length === 0 || cards.length === 0) {
			this.renderEmpty(host, all.length === 0 ? "还没有题卡。" : "没有符合条件的题。", all.length === 0);
			return;
		}
		const table = document.createElement("div");
		table.className = "pd-table";
		table.setAttribute("role", "list");
		const head = document.createElement("div");
		head.className = "pd-thead";
		for (const label of ["", "题干", "科目", "标签", "状态", "复习", ""]) {
			const cell = document.createElement("span");
			cell.textContent = label;
			head.appendChild(cell);
		}
		table.appendChild(head);

		const today = this.plugin.today();
		for (const card of cards) table.appendChild(this.buildRow(card, today));
		host.appendChild(table);
	}

	private buildRow(card: QuestionCard, today: string): HTMLElement {
		const state = this.plugin.getState(card.qid);
		const starred = state?.star ?? card.starInitial;
		const row = document.createElement("div");
		row.className = "pd-trow";
		row.setAttribute("role", "listitem");

		const star = document.createElement("button");
		star.type = "button";
		star.className = "pd-icon-btn pd-star" + (starred ? " is-active" : "");
		star.setAttribute("aria-label", starred ? "取消收藏" : "收藏");
		star.setAttribute("aria-pressed", String(starred));
		setIcon(star, "star");
		star.addEventListener("click", () => {
			const next = this.plugin.toggleStar(card.qid);
			star.classList.toggle("is-active", next);
			star.setAttribute("aria-pressed", String(next));
			this.plugin.requestSave();
			this.renderStatusChips();
			this.renderCards();
			this.renderTable();
		});

		const main = document.createElement("button");
		main.type = "button";
		main.className = "pd-trow-main";
		const title = document.createElement("span");
		title.className = "pd-trow-title";
		title.textContent = toPreviewText(card.stem) || "（空题干）";
		main.appendChild(title);
		main.addEventListener("click", () => {
			void this.plugin.startPractice([card]);
		});

		const subject = document.createElement("span");
		subject.className = "pd-trow-meta";
		subject.textContent = card.subject;
		const tags = document.createElement("span");
		tags.className = "pd-trow-meta";
		tags.textContent = card.tags.slice(0, 2).join(" · ");
		const badge = statusLabel(libStatus(card, state, today));
		const status = document.createElement("span");
		status.className = `pd-status ${badge.cls}`;
		status.textContent = badge.text;
		const due = document.createElement("span");
		due.className = "pd-trow-meta";
		due.textContent = dueLine(state, today);

		const more = document.createElement("button");
		more.type = "button";
		more.className = "pd-icon-btn";
		more.setAttribute("aria-label", "更多操作");
		setIcon(more, "more-horizontal");
		more.addEventListener("click", (event) => {
			event.stopPropagation();
			this.openCardMenu(more, card);
		});

		row.append(star, main, subject, tags, status, due, more);
		return row;
	}

	/* ---------------- 菜单 / 标签 / 空态 ---------------- */

	private openCardMenu(anchor: HTMLElement, card: QuestionCard): void {
		const starred = this.plugin.getState(card.qid)?.star ?? card.starInitial;
		openMenu(anchor, [
			{
				label: starred ? "取消收藏" : "收藏",
				icon: "star",
				onSelect: () => {
					this.plugin.toggleStar(card.qid);
					this.plugin.requestSave();
					this.renderStatusChips();
					this.renderCards();
					this.renderTable();
				},
			},
			{
				label: "打开原文",
				icon: "external-link",
				onSelect: () => {
					void this.plugin.openSource(card);
				},
			},
			{
				label: "复制题干",
				icon: "copy",
				onSelect: () => {
					void navigator.clipboard.writeText(card.stem);
				},
			},
		]);
	}

	private buildTags(card: QuestionCard): HTMLElement {
		const tags = document.createElement("div");
		tags.className = "pd-tags";
		const subject = document.createElement("span");
		subject.className = "pd-tag is-subject";
		subject.textContent = card.subject || "未分类";
		tags.appendChild(subject);
		const topics = card.tags.slice(0, 3);
		for (const tag of topics) {
			const chip = document.createElement("span");
			chip.className = "pd-tag is-topic";
			chip.textContent = tag;
			tags.appendChild(chip);
		}
		if (card.tags.length > topics.length) {
			const more = document.createElement("span");
			more.className = "pd-tag is-topic";
			more.textContent = `+${card.tags.length - topics.length}`;
			tags.appendChild(more);
		}
		if (card.pdf) {
			const pdf = document.createElement("span");
			pdf.className = "pd-tag is-topic";
			pdf.textContent = "PDF";
			tags.appendChild(pdf);
		}
		return tags;
	}

	private renderEmpty(container: HTMLElement, message: string, showTemplate: boolean): void {
		const empty = document.createElement("div");
		empty.className = "pd-empty";
		const title = document.createElement("div");
		title.className = "pd-empty-title";
		title.textContent = message;
		empty.appendChild(title);
		if (showTemplate) {
			createButton(empty, {
				label: "复制模板",
				cls: "pd-btn",
				onClick: () => {
					void navigator.clipboard.writeText(QUESTION_TEMPLATE);
				},
			});
			const details = document.createElement("details");
			details.className = "pd-template-preview";
			const summary = document.createElement("summary");
			summary.textContent = "查看模板";
			const pre = document.createElement("pre");
			pre.textContent = QUESTION_TEMPLATE;
			details.append(summary, pre);
			empty.appendChild(details);
		} else {
			createButton(empty, {
				label: "清除筛选",
				cls: "pd-btn",
				onClick: () => this.clearFilters(),
			});
		}
		container.appendChild(empty);
	}

	private applyViewVisibility(): void {
		if (!this.panels) return;
		for (const mode of ["cards", "table", "review"] as ViewMode[]) {
			this.panels[mode].hidden = mode !== this.viewMode;
		}
	}
}
