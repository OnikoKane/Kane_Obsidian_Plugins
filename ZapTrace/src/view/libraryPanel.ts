import { Component, setIcon } from "obsidian";
import type { PluginContext } from "./pluginContext.ts";
import type { CardFilter, QuestionCard, SortKey, TimeFilterKind } from "../core/types.ts";
import { emptyFilter, filterCards, sortCards } from "../core/filter.ts";
import { dueBadge, firstLine } from "../core/format.ts";
import { clearElement, createButton } from "./dom.ts";
import { createRenderScope, type RenderScope } from "./renderOwner.ts";
import { QUESTION_TEMPLATE } from "../template.ts";

/**
 * 中栏题集（DESIGN §6 / §10.4）。
 * 所有筛选纯内存完成，不写任何文件。
 */
export class LibraryPanel {
	private readonly host: HTMLElement;
	private readonly plugin: PluginContext;
	private readonly ownerComponent: Component;
	private scope: RenderScope | null = null;
	private filter: CardFilter = emptyFilter();
	private sort: SortKey = "due";

	private searchInput: HTMLInputElement | null = null;
	private subjectSelect: HTMLSelectElement | null = null;
	private timeSelect: HTMLSelectElement | null = null;
	private sortSelect: HTMLSelectElement | null = null;
	private tagsRow: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;

	constructor(host: HTMLElement, plugin: PluginContext, ownerComponent: Component) {
		this.host = host;
		this.plugin = plugin;
		this.ownerComponent = ownerComponent;
		this.build();
	}

	/** 每轮刷新前卸载上一轮渲染作用域（当前行无 Markdown 渲染，仍统一生命周期）。 */
	private beginRender(): void {
		if (this.scope) {
			this.scope.unload();
			this.scope = null;
		}
		this.scope = createRenderScope(this.ownerComponent, this.host);
	}

	private build(): void {
		const filters = document.createElement("div");
		filters.className = "zt-filters";

		const search = document.createElement("input");
		search.type = "search";
		search.className = "zt-input zt-search";
		search.placeholder = "搜索题干 / 标签";
		search.setAttribute("aria-label", "搜索题干或标签");
		search.addEventListener("input", () => {
			this.filter.search = search.value;
			this.renderList();
		});
		this.searchInput = search;
		filters.appendChild(search);

		this.subjectSelect = this.createSelect(filters, "科目", [
			{ value: "", label: "全部科目" },
		], (value) => {
			this.filter.subject = value === "" ? null : value;
			this.renderList();
		});

		this.timeSelect = this.createSelect(
			filters,
			"时间",
			[
				{ value: "all", label: "全部时间" },
				{ value: "today", label: "今天到期" },
				{ value: "overdue", label: "已到期" },
				{ value: "week", label: "7 天内" },
				{ value: "unrated", label: "未练" },
			],
			(value) => {
				this.filter.time = value as TimeFilterKind;
				this.renderList();
			}
		);

		this.sortSelect = this.createSelect(
			filters,
			"排序",
			[
				{ value: "due", label: "按到期" },
				{ value: "starred", label: "收藏优先" },
				{ value: "recent", label: "最近新增" },
				{ value: "subject", label: "按科目" },
			],
			(value) => {
				this.sort = value as SortKey;
				this.renderList();
			}
		);

		// PDF 来源：首版预留、置灰（DESIGN §6.2）
		const pdfWrap = document.createElement("label");
		pdfWrap.className = "zt-field zt-disabled";
		const pdfLabel = document.createElement("span");
		pdfLabel.className = "zt-field-label";
		pdfLabel.textContent = "PDF 来源";
		const pdfSelect = document.createElement("select");
		pdfSelect.className = "zt-select";
		pdfSelect.disabled = true;
		pdfSelect.setAttribute("aria-disabled", "true");
		const pdfOption = document.createElement("option");
		pdfOption.textContent = "PDF 来源（预留）";
		pdfSelect.appendChild(pdfOption);
		pdfWrap.append(pdfLabel, pdfSelect);
		filters.appendChild(pdfWrap);

		createButton(filters, {
			label: "清除筛选",
			cls: "zt-button zt-button-ghost",
			onClick: () => this.clearFilters(),
		});

		const summary = document.createElement("div");
		summary.className = "zt-list-summary";
		this.countEl = summary;
		filters.appendChild(summary);
		this.host.appendChild(filters);

		const tagsRow = document.createElement("div");
		tagsRow.className = "zt-tag-filter";
		tagsRow.setAttribute("role", "group");
		tagsRow.setAttribute("aria-label", "标签筛选");
		this.tagsRow = tagsRow;
		this.host.appendChild(tagsRow);

		const list = document.createElement("div");
		list.className = "zt-list";
		list.setAttribute("role", "list");
		this.listEl = list;
		this.host.appendChild(list);
	}

	private createSelect(
		parent: HTMLElement,
		labelText: string,
		options: Array<{ value: string; label: string }>,
		onChange: (value: string) => void
	): HTMLSelectElement {
		const wrap = document.createElement("label");
		wrap.className = "zt-field";
		const label = document.createElement("span");
		label.className = "zt-field-label";
		label.textContent = labelText;
		const select = document.createElement("select");
		select.className = "zt-select";
		select.setAttribute("aria-label", labelText);
		for (const option of options) {
			const el = document.createElement("option");
			el.value = option.value;
			el.textContent = option.label;
			select.appendChild(el);
		}
		select.addEventListener("change", () => onChange(select.value));
		wrap.append(label, select);
		parent.appendChild(wrap);
		return select;
	}

	focusSearch(): void {
		this.searchInput?.focus();
	}

	private clearFilters(): void {
		this.filter = emptyFilter();
		if (this.searchInput) this.searchInput.value = "";
		if (this.subjectSelect) this.subjectSelect.value = "";
		if (this.timeSelect) this.timeSelect.value = "all";
		this.renderTags();
		this.renderList();
	}

	refresh(): void {
		this.beginRender();
		// 更新科目下拉（保留当前选择）
		if (this.subjectSelect) {
			const current = this.filter.subject ?? "";
			clearElement(this.subjectSelect);
			const all = document.createElement("option");
			all.value = "";
			all.textContent = "全部科目";
			this.subjectSelect.appendChild(all);
			for (const subject of this.plugin.getCards().length > 0 ? this.collectSubjects() : []) {
				const option = document.createElement("option");
				option.value = subject;
				option.textContent = subject;
				this.subjectSelect.appendChild(option);
			}
			this.subjectSelect.value = current;
			if (this.subjectSelect.value !== current) this.filter.subject = null;
		}
		this.renderTags();
		this.renderList();
	}

	private collectSubjects(): string[] {
		const set = new Set<string>();
		for (const card of this.plugin.getCards()) set.add(card.subject);
		return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
	}

	private renderTags(): void {
		const row = this.tagsRow;
		if (!row) return;
		clearElement(row);
		const tags = new Set<string>();
		for (const card of this.plugin.getCards()) for (const tag of card.tags) tags.add(tag);
		const sorted = Array.from(tags).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
		if (sorted.length === 0) return;
		for (const tag of sorted) {
			const chip = document.createElement("button");
			chip.type = "button";
			chip.className = "zt-chip";
			chip.textContent = tag;
			const active = this.filter.tags.includes(tag);
			chip.setAttribute("aria-pressed", String(active));
			if (active) chip.classList.add("is-active");
			chip.addEventListener("click", () => {
				if (this.filter.tags.includes(tag)) {
					this.filter.tags = this.filter.tags.filter((item) => item !== tag);
				} else {
					this.filter.tags = [...this.filter.tags, tag];
				}
				this.renderTags();
				this.renderList();
			});
			row.appendChild(chip);
		}
	}

	private renderList(): void {
		const list = this.listEl;
		if (!list) return;
		clearElement(list);
		const today = this.plugin.today();
		const all = this.plugin.getCards();
		const filtered = filterCards(all, this.plugin.data, this.filter, today);
		const sorted = sortCards(filtered, this.plugin.data, this.sort, today);

		if (this.countEl) {
			this.countEl.textContent = `${sorted.length} / ${all.length} 题`;
		}

		if (all.length === 0) {
			this.renderEmpty(list, "还没有题卡。复制下面的模板，粘进任意笔记。", true);
			return;
		}
		if (sorted.length === 0) {
			this.renderEmpty(list, "没有符合条件的题。", false);
			return;
		}

		for (const card of sorted) {
			list.appendChild(this.buildRow(card, today));
		}
	}

	private renderEmpty(container: HTMLElement, message: string, showTemplate: boolean): void {
		const empty = document.createElement("div");
		empty.className = "zt-empty zt-empty-small";
		const title = document.createElement("div");
		title.className = "zt-empty-title";
		title.textContent = message;
		empty.appendChild(title);
		if (showTemplate) {
			createButton(empty, {
				label: "复制模板",
				cls: "zt-button zt-button-ghost",
				onClick: () => {
					void navigator.clipboard.writeText(QUESTION_TEMPLATE);
				},
			});
			const details = document.createElement("details");
			details.className = "zt-template-preview";
			const summary = document.createElement("summary");
			summary.textContent = "查看模板";
			const pre = document.createElement("pre");
			pre.textContent = QUESTION_TEMPLATE;
			details.append(summary, pre);
			empty.appendChild(details);
		} else {
			createButton(empty, {
				label: "清除筛选",
				cls: "zt-button zt-button-ghost",
				onClick: () => this.clearFilters(),
			});
		}
		container.appendChild(empty);
	}

	private buildRow(card: QuestionCard, today: string): HTMLElement {
		const row = document.createElement("div");
		row.className = "zt-row";
		row.dataset.qid = card.qid;
		row.setAttribute("role", "listitem");

		const open = document.createElement("button");
		open.type = "button";
		open.className = "zt-row-open";
		open.setAttribute("aria-label", `练习：${firstLine(card.stem)}`);

		const title = document.createElement("span");
		title.className = "zt-row-title";
		title.textContent = firstLine(card.stem) || "（空题干）";

		const meta = document.createElement("span");
		meta.className = "zt-row-meta";
		const parts = [card.subject, ...card.tags];
		meta.textContent = parts.filter((part) => part).join(" · ");

		const badge = document.createElement("span");
		const state = this.plugin.getState(card.qid);
		const due = dueBadge(state, today);
		badge.className = `zt-badge zt-badge-${due.tone}`;
		badge.textContent = due.text;

		if (card.pdf) {
			const pdf = document.createElement("span");
			pdf.className = "zt-badge zt-badge-muted";
			pdf.textContent = "PDF";
			open.append(title, meta, pdf, badge);
		} else {
			open.append(title, meta, badge);
		}
		open.addEventListener("click", () => {
			void this.plugin.startPractice([card]);
		});

		const star = document.createElement("button");
		star.type = "button";
		star.className = "zt-star zt-star-small";
		const starred = state?.star ?? false;
		star.setAttribute("aria-label", "收藏");
		star.setAttribute("aria-pressed", String(starred));
		if (starred) star.classList.add("is-active");
		setIcon(star, "star");
		star.addEventListener("click", (event) => {
			event.stopPropagation();
			const now = this.plugin.toggleStar(card.qid);
			star.setAttribute("aria-pressed", String(now));
			star.classList.toggle("is-active", now);
			this.plugin.requestSave();
			if (this.filter.starredOnly) this.renderList();
		});

		if (card.duplicateId) {
			const dup = document.createElement("span");
			dup.className = "zt-badge zt-badge-danger";
			dup.textContent = "重复";
			dup.title = card.errors.join("；");
			open.appendChild(dup);
		}

		const locate = document.createElement("button");
		locate.type = "button";
		locate.className = "zt-icon-button zt-row-locate";
		locate.setAttribute("aria-label", "打开原文");
		locate.title = "打开原文并定位到题卡行";
		setIcon(locate, "crosshair");
		locate.addEventListener("click", (event) => {
			event.stopPropagation();
			void this.plugin.openSource(card);
		});

		row.append(open, locate, star);
		return row;
	}
}
