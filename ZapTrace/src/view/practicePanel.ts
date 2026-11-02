import { Component, MarkdownRenderer } from "obsidian";
import type { PluginContext } from "./pluginContext.ts";
import type { QuestionCard, Rating } from "../core/types.ts";
import { PracticeSession } from "../core/practice.ts";
import { buildRatingBar } from "./ratingBar.ts";
import { createButton, createCollapsible, clearElement } from "./dom.ts";
import { createRenderScope, type RenderScope } from "./renderOwner.ts";

/**
 * 左栏练习区（DESIGN §7.1 / §10.3）。
 *
 * H4 门禁：
 * - viewing 态：只渲染题干；答案/笔记/评分条 DOM 都不存在；
 * - `handleKeydown` 只在 `session.canRate` 时接受 1–4；
 * - 真正的写盘只发生在 `session.rate()` 内部（非 revealed 返回 null）。
 */
export class PracticePanel {
	private readonly host: HTMLElement;
	private readonly plugin: PluginContext;
	private readonly ownerComponent: Component;
	private scope: RenderScope | null = null;
	private session: PracticeSession | null = null;
	private status: string | null = null;

	constructor(host: HTMLElement, plugin: PluginContext, ownerComponent: Component) {
		this.host = host;
		this.plugin = plugin;
		this.ownerComponent = ownerComponent;
	}

	/** 卸载上一轮渲染作用域，再为这一轮新建（MarkdownRenderer 生命周期）。 */
	private beginRender(): RenderScope {
		if (this.scope) {
			this.scope.unload();
			this.scope = null;
		}
		this.scope = createRenderScope(this.ownerComponent, this.host);
		return this.scope;
	}

	hasSession(): boolean {
		return this.session !== null && !this.session.finished;
	}

	start(cards: QuestionCard[]): void {
		this.session = new PracticeSession(cards);
		this.status = null;
		this.session.markShown(Date.now());
		this.render();
	}

	stop(): void {
		this.session = null;
		this.status = null;
		this.render();
	}

	/** 返回 true 表示按键已消费。 */
	handleKeydown(event: KeyboardEvent): boolean {
		// 输入控件内一律不处理快捷键（H4：焦点在搜索框时按 1–4 不能评分）
		if (this.isTypingTarget(event.target)) return false;
		const session = this.session;
		if (!session || session.finished) return false;
		if (event.key >= "1" && event.key <= "4") {
			if (!session.canRate) return false; // H4：未揭晓直接不响应
			event.preventDefault();
			const map: Rating[] = ["again", "hard", "good", "easy"];
			this.rate(map[Number(event.key) - 1]);
			return true;
		}
		if (event.key === "Enter" && session.canReveal) {
			const active = document.activeElement;
			if (active instanceof HTMLButtonElement) return false;
			event.preventDefault();
			this.reveal();
			return true;
		}
		return false;
	}

	private isTypingTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName.toLowerCase();
		return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
	}

	render(): void {
		const scope = this.beginRender();
		clearElement(this.host);
		const session = this.session;
		if (!session) {
			this.renderIdle();
			return;
		}
		if (session.finished) {
			this.renderSummary();
			return;
		}
		const card = session.current;
		if (!card) {
			this.renderSummary();
			return;
		}

		const wrap = document.createElement("div");
		wrap.className = "zt-practice";

		// 进度
		const progress = document.createElement("div");
		progress.className = "zt-progress";
		const text = document.createElement("span");
		text.className = "zt-progress-text";
		text.textContent = `${session.progress().position} / ${session.progress().total}`;
		const track = document.createElement("div");
		track.className = "zt-progress-track";
		const fill = document.createElement("div");
		fill.className = "zt-progress-fill";
		fill.style.width = `${(session.position / Math.max(session.total, 1)) * 100}%`;
		track.appendChild(fill);
		progress.append(text, track);
		wrap.appendChild(progress);

		// 题干
		const stem = document.createElement("div");
		stem.className = "zt-practice-stem";
		void MarkdownRenderer.render(
			this.plugin.app,
			card.stem,
			stem,
			card.file,
			scope
		);
		wrap.appendChild(stem);

		if (session.canReveal) {
			const actions = document.createElement("div");
			actions.className = "zt-practice-actions";
			const revealLabel = this.plugin.settings.requireAnswerBeforeReveal
				? "我写完了，显示答案"
				: "显示答案";
			createButton(actions, {
				label: revealLabel,
				cls: "zt-button zt-button-primary",
				onClick: () => this.reveal(),
			});
			createButton(actions, {
				label: "跳过",
				cls: "zt-button zt-button-ghost",
				onClick: () => this.skip(),
			});
			wrap.appendChild(actions);
			const hint = document.createElement("div");
			hint.className = "zt-practice-hint";
			hint.textContent = "先在纸上/心里作答，再揭晓答案。";
			wrap.appendChild(hint);
		} else {
			// 揭晓后才注入答案与笔记 DOM
			const answerBox = document.createElement("div");
			answerBox.className = "zt-answer";
			const answerLabel = document.createElement("div");
			answerLabel.className = "zt-answer-label";
			answerLabel.textContent = "答案";
			answerBox.appendChild(answerLabel);
			const answerBody = document.createElement("div");
			answerBox.appendChild(answerBody);
			if (card.answer.trim() === "") {
				answerBody.textContent = "⚠ 缺少答案分节";
				answerBody.classList.add("zt-card-error");
			} else {
				void MarkdownRenderer.render(
					this.plugin.app,
					card.answer,
					answerBody,
					card.file,
					scope
				);
			}
			wrap.appendChild(answerBox);

			if (card.notes.trim() !== "") {
				createCollapsible(wrap, "个人笔记", {
					onFirstOpen: (content) =>
						void MarkdownRenderer.render(
							this.plugin.app,
							card.notes,
							content,
							card.file,
							scope
						),
				});
			}
			if (card.aiNotes.trim() !== "") {
				createCollapsible(wrap, "AI 笔记", {
					onFirstOpen: (content) =>
						void MarkdownRenderer.render(
							this.plugin.app,
							card.aiNotes,
							content,
							card.file,
							scope
						),
				});
			}

			if (this.status) {
				const status = document.createElement("div");
				status.className = "zt-rate-status";
				status.setAttribute("aria-live", "polite");
				status.textContent = this.status;
				wrap.appendChild(status);
			}

			if (session.canRate) {
				const bar = buildRatingBar(this.plugin.getState(card.qid)?.step ?? -1, (rating) =>
					this.rate(rating)
				);
				wrap.appendChild(bar);
				const hint = document.createElement("div");
				hint.className = "zt-practice-hint";
				hint.textContent = "1–4 快捷键评分 · ←/→ 移动 · Enter 确认";
				wrap.appendChild(hint);
			}
		}

		this.host.appendChild(wrap);
	}

	private renderIdle(): void {
		const empty = document.createElement("div");
		empty.className = "zt-empty";
		const title = document.createElement("div");
		title.className = "zt-empty-title";
		title.textContent = "选一道题开始练习";
		const hint = document.createElement("div");
		hint.className = "zt-empty-hint";
		hint.textContent = "从「题集」点一行，或在「复习」里按科目开始。";
		empty.append(title, hint);
		this.host.appendChild(empty);
	}

	private renderSummary(): void {
		const session = this.session;
		const empty = document.createElement("div");
		empty.className = "zt-empty";
		const title = document.createElement("div");
		title.className = "zt-empty-title";
		title.textContent = "本组完成";
		const hint = document.createElement("div");
		hint.className = "zt-empty-hint";
		hint.textContent = session ? session.summary() : "";
		empty.append(title, hint);
		createButton(empty, {
			label: "再练一题",
			cls: "zt-button zt-button-ghost",
			onClick: () => {
				const cards = this.plugin.getCards();
				if (cards.length === 0) return;
				const random = cards[Math.floor(Math.random() * cards.length)];
				this.start([random]);
			},
		});
		this.host.appendChild(empty);
	}

	private reveal(): void {
		const session = this.session;
		if (!session) return;
		if (!session.reveal()) return;
		this.render();
	}

	private skip(): void {
		const session = this.session;
		if (!session) return;
		session.skip();
		if (!session.finished) session.markShown(Date.now());
		this.status = null;
		this.render();
	}

	private rate(rating: Rating): void {		const session = this.session;
		if (!session) return;
		const card = session.current;
		if (!card) return;
		const result = session.rate(this.plugin.data, rating, {
			today: this.plugin.today(),
			at: this.plugin.nowIso(),
			elapsedMs: session.elapsedMs(Date.now()),
		});
		if (!result) return; // 未揭晓 / 已评分：不写盘
		this.plugin.requestSave();
		this.status = `已安排：${result.due} 复习`;
		this.render();
		window.setTimeout(() => {
			const active = this.session;
			if (!active || active.phase !== "rated") return;
			active.advance();
			this.status = null;
			if (!active.finished) active.markShown(Date.now());
			this.render();
			this.plugin.refreshAll();
		}, 320);
	}
}
