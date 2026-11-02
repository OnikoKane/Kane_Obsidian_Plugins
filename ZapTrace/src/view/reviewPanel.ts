import { Component } from "obsidian";
import type { PluginContext } from "./pluginContext.ts";
import type { QuestionCard, ReviewLogEntry } from "../core/types.ts";
import { RATING_LABELS } from "../core/types.ts";
import { addDays } from "../core/date.ts";
import { firstLine } from "../core/format.ts";
import { clearElement, createButton } from "./dom.ts";
import { createRenderScope, type RenderScope } from "./renderOwner.ts";

/**
 * 独立复习视图（DESIGN-v2 §5.5.3；复习算法与口径完全不变，只换视觉外壳）。
 */
export class ReviewPanel {
	private readonly host: HTMLElement;
	private readonly plugin: PluginContext;
	private readonly ownerComponent: Component;
	private scope: RenderScope | null = null;
	private showWeekLog = false;

	constructor(host: HTMLElement, plugin: PluginContext, ownerComponent: Component) {
		this.host = host;
		this.plugin = plugin;
		this.ownerComponent = ownerComponent;
	}

	private beginRender(): void {
		if (this.scope) {
			this.scope.unload();
			this.scope = null;
		}
		this.scope = createRenderScope(this.ownerComponent, this.host);
	}

	refresh(): void {
		this.beginRender();
		clearElement(this.host);
		const root = document.createElement("div");
		root.className = "pd-review";
		this.host.appendChild(root);

		const today = this.plugin.today();
		const cards = this.plugin.getCards();
		const dueCards = cards
			.filter((card) => {
				const state = this.plugin.getState(card.qid);
				return Boolean(state && state.due && state.due <= today);
			})
			.sort((a, b) => {
				const sa = this.plugin.getState(a.qid);
				const sb = this.plugin.getState(b.qid);
				const da = sa?.due ?? "";
				const db = sb?.due ?? "";
				if (da !== db) return da < db ? -1 : 1;
				const la = sa?.lapses ?? 0;
				const lb = sb?.lapses ?? 0;
				if (la !== lb) return lb - la;
				return a.qid < b.qid ? -1 : 1;
			});

		this.renderHead(root, dueCards.length);
		this.renderGroups(root, dueCards);

		const divider = document.createElement("div");
		divider.className = "pd-divider";
		root.appendChild(divider);
		this.renderLog(root, today);
	}

	private renderHead(host: HTMLElement, count: number): void {
		const head = document.createElement("div");
		head.className = "pd-review-card pd-review-head";
		const number = document.createElement("div");
		number.className = "pd-review-count";
		number.textContent = String(count);
		const label = document.createElement("div");
		label.className = "pd-review-label";
		label.textContent = "今日到期";
		head.append(number, label);
		const limit = this.plugin.settings.dailyReviewLimit;
		if (count > limit) {
			const more = document.createElement("div");
			more.className = "pd-review-more";
			more.textContent = `+${count - limit} 顺延（每日上限 ${limit}）`;
			head.appendChild(more);
		}
		createButton(head, {
			label: "随机练一题",
			cls: "pd-btn",
			onClick: () => this.practiceRandom(),
		});
		host.appendChild(head);
	}

	private renderGroups(host: HTMLElement, dueCards: QuestionCard[]): void {
		if (dueCards.length === 0) {
			const empty = document.createElement("div");
			empty.className = "pd-empty pd-empty-small";
			const title = document.createElement("div");
			title.className = "pd-empty-title";
			title.textContent = "今日无到期，去练一题？";
			empty.appendChild(title);
			createButton(empty, {
				label: "随机练一题",
				cls: "pd-btn",
				onClick: () => this.practiceRandom(),
			});
			host.appendChild(empty);
			return;
		}

		const groups = new Map<string, QuestionCard[]>();
		for (const card of dueCards) {
			const list = groups.get(card.subject);
			if (list) list.push(card);
			else groups.set(card.subject, [card]);
		}

		const limit = this.plugin.settings.dailyReviewLimit;
		const subjects = Array.from(groups.keys()).sort((a, b) =>
			a.localeCompare(b, "zh-Hans-CN")
		);
		for (const subject of subjects) {
			const list = groups.get(subject) ?? [];
			const group = document.createElement("div");
			group.className = "pd-group";

			const header = document.createElement("div");
			header.className = "pd-group-head";
			const toggle = document.createElement("button");
			toggle.type = "button";
			toggle.className = "pd-group-toggle";
			const controls = `pd-group-body-${subject.replace(/[^\w\u4e00-\u9fa5]/g, "")}`;
			toggle.setAttribute("aria-expanded", "false");
			toggle.setAttribute("aria-controls", controls);
			const name = document.createElement("span");
			name.className = "pd-group-name";
			name.textContent = subject;
			const count = document.createElement("span");
			count.className = "pd-group-count";
			count.textContent = String(list.length);
			toggle.append(name, count);
			header.appendChild(toggle);

			createButton(header, {
				label: "开始组卷",
				cls: "pd-btn pd-btn-small",
				onClick: () => {
					void this.plugin.startPractice(list.slice(0, limit));
				},
			});

			const body = document.createElement("div");
			body.className = "pd-group-body";
			body.id = controls;
			body.hidden = true;
			let filled = false;
			toggle.addEventListener("click", () => {
				const expanded = toggle.getAttribute("aria-expanded") === "true";
				toggle.setAttribute("aria-expanded", String(!expanded));
				body.hidden = expanded;
				if (!expanded && !filled) {
					filled = true;
					for (const card of list) {
						const row = document.createElement("button");
						row.type = "button";
						row.className = "pd-review-row";
						const title = document.createElement("span");
						title.className = "pd-review-title";
						title.textContent = firstLine(card.stem) || "（空题干）";
						const state = this.plugin.getState(card.qid);
						const due = document.createElement("span");
						due.className = "pd-review-due";
						due.textContent = state?.due ?? "";
						row.append(title, due);
						row.addEventListener("click", () => {
							void this.plugin.startPractice([card]);
						});
						body.appendChild(row);
					}
				}
			});

			group.append(header, body);
			host.appendChild(group);
		}
	}

	private renderLog(host: HTMLElement, today: string): void {
		const wrap = document.createElement("div");
		wrap.className = "pd-log";
		const header = document.createElement("div");
		header.className = "pd-log-head";
		const title = document.createElement("div");
		title.className = "pd-log-title";
		title.textContent = "时间记录";
		header.appendChild(title);
		createButton(header, {
			label: this.showWeekLog ? "只看今天" : "近 7 天",
			cls: "pd-btn pd-btn-small",
			onClick: () => {
				this.showWeekLog = !this.showWeekLog;
				this.refresh();
			},
		});
		wrap.appendChild(header);

		const from = this.showWeekLog ? addDays(today, -6) : today;
		const entries = this.plugin.data.reviewLog
			.filter((entry) => {
				const date = entry.at.slice(0, 10);
				return date >= from && date <= today;
			})
			.slice(-60)
			.reverse();

		if (entries.length === 0) {
			const empty = document.createElement("div");
			empty.className = "pd-empty pd-empty-tiny";
			empty.textContent = "暂无练习记录。";
			wrap.appendChild(empty);
			host.appendChild(wrap);
			return;
		}

		let lastDate = "";
		for (const entry of entries) {
			const date = entry.at.slice(0, 10);
			if (date !== lastDate) {
				lastDate = date;
				const dateLabel = document.createElement("div");
				dateLabel.className = "pd-log-date";
				dateLabel.textContent = date;
				wrap.appendChild(dateLabel);
			}
			wrap.appendChild(this.buildLogRow(entry));
		}
		host.appendChild(wrap);
	}

	private buildLogRow(entry: ReviewLogEntry): HTMLElement {
		const row = document.createElement("button");
		row.type = "button";
		row.className = "pd-log-row";
		const time = document.createElement("span");
		time.className = "pd-log-time";
		time.textContent = entry.at.slice(11, 16);
		const rating = document.createElement("span");
		rating.className = `pd-log-rating pd-log-${entry.rating}`;
		rating.textContent = RATING_LABELS[entry.rating];
		const subject = document.createElement("span");
		subject.className = "pd-log-subject";
		subject.textContent = entry.subject;
		row.append(time, rating, subject);
		row.addEventListener("click", () => {
			const card = this.plugin.getCardByQid(entry.qid);
			if (card) void this.plugin.startPractice([card]);
		});
		return row;
	}

	private practiceRandom(): void {
		const cards = this.plugin.getCards();
		if (cards.length === 0) return;
		const random = cards[Math.floor(Math.random() * cards.length)];
		void this.plugin.startPractice([random]);
	}
}
