import { Component, MarkdownRenderer, setIcon } from "obsidian";
import type { PluginContext } from "./pluginContext.ts";
import type { QuestionCard } from "../core/types.ts";
import { createCollapsible, createButton } from "./dom.ts";
import { firstLine } from "../core/format.ts";

export interface RenderCardOptions {
	plugin: PluginContext;
	card: QuestionCard;
	host: HTMLElement;
	/**
	 * 本轮渲染的 owner（MarkdownRenderer 生命周期，REVIEW-implementation §3-①）：
	 * 阅读视图传 `ctx.addChild(new RenderScope(el))`；工作台传该面板本轮的 scope。
	 */
	owner: Component;
	/** Live Preview 下的只读缩略卡 */
	compact?: boolean;
}

function renderMarkdown(
	plugin: PluginContext,
	text: string,
	el: HTMLElement,
	sourcePath: string,
	owner: Component
): void {
	void MarkdownRenderer.render(plugin.app, text, el, sourcePath, owner);
}

function buildMeta(plugin: PluginContext, card: QuestionCard, host: HTMLElement): void {
	const meta = document.createElement("div");
	meta.className = "zt-card-meta";
	const subject = document.createElement("span");
	subject.className = "zt-card-subject";
	subject.textContent = card.subject;
	meta.appendChild(subject);
	for (const tag of card.tags) {
		const chip = document.createElement("span");
		chip.className = "zt-tag";
		chip.textContent = tag;
		meta.appendChild(chip);
	}
	if (card.duplicateId) {
		const warn = document.createElement("span");
		warn.className = "zt-badge zt-badge-danger";
		warn.textContent = "重复已隔离";
		meta.appendChild(warn);
	}
	host.appendChild(meta);
}

function buildStarButton(plugin: PluginContext, card: QuestionCard): HTMLButtonElement {
	const state = plugin.getState(card.qid);
	const starred = state ? state.star : card.starInitial;
	const button = document.createElement("button");
	button.type = "button";
	button.className = "zt-star";
	button.setAttribute("aria-label", "收藏");
	button.setAttribute("aria-pressed", String(starred));
	if (starred) button.classList.add("is-active");
	setIcon(button, "star");
	button.addEventListener("click", () => {
		const now = plugin.toggleStar(card.qid);
		button.setAttribute("aria-pressed", String(now));
		button.classList.toggle("is-active", now);
		plugin.requestSave();
	});
	return button;
}

function buildLocateButton(
	plugin: PluginContext,
	card: QuestionCard,
	cls?: string
): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.className = cls ?? "zt-button zt-button-ghost zt-button-small";
	button.setAttribute("aria-label", "定位原文");
	setIcon(button, "crosshair");
	const text = document.createElement("span");
	text.textContent = "定位原文";
	button.appendChild(text);
	button.addEventListener("click", (event) => {
		event.stopPropagation();
		void plugin.openSource(card);
	});
	return button;
}

/** 阅读视图题卡（DESIGN §10.2）。答案与笔记默认折叠且懒渲染。 */
export function renderQuestionCard(options: RenderCardOptions): HTMLElement {
	const { plugin, card, host, owner, compact } = options;
	const root = document.createElement("div");
	root.className = "zt-card";
	root.dataset.qid = card.qid;
	root.dataset.file = card.file;

	if (compact) {
		root.classList.add("zt-card-compact");
		const title = document.createElement("div");
		title.className = "zt-card-compact-title";
		title.textContent = firstLine(card.stem) || "（空题干）";
		const hint = document.createElement("div");
		hint.className = "zt-card-compact-hint";
		hint.textContent = "实时预览只读 · 在阅读视图或工作台作答评分";
		const actions = document.createElement("div");
		actions.className = "zt-card-compact-actions";
		createButton(actions, {
			label: "打开工作台练习",
			cls: "zt-button",
			onClick: () => {
				void plugin.startPractice([card]);
			},
		});
		actions.appendChild(buildLocateButton(plugin, card));
		root.append(title, hint, actions);
		host.appendChild(root);
		return root;
	}

	// 头部：科目 + 标签 + Star
	const head = document.createElement("div");
	head.className = "zt-card-head";
	buildMeta(plugin, card, head);
	head.appendChild(buildStarButton(plugin, card));
	root.appendChild(head);

	// 题干（始终可见）
	const stem = document.createElement("div");
	stem.className = "zt-stem";
	renderMarkdown(plugin, card.stem, stem, card.file, owner);
	root.appendChild(stem);

	// 语法错误提示
	if (card.errors.length > 0) {
		const errors = document.createElement("div");
		errors.className = "zt-card-error";
		errors.setAttribute("role", "status");
		for (const message of card.errors) {
			const line = document.createElement("div");
			line.textContent = `⚠ ${message}`;
			errors.appendChild(line);
		}
		root.appendChild(errors);
	}

	// 答案（默认折叠，懒渲染；懒渲染复用同一 owner）
	createCollapsible(root, "答案", {
		onFirstOpen: (content) => {
			if (card.answer.trim() === "") {
				const missing = document.createElement("div");
				missing.className = "zt-card-error";
				missing.textContent = "⚠ 缺少答案分节";
				content.appendChild(missing);
				return;
			}
			renderMarkdown(plugin, card.answer, content, card.file, owner);
		},
	});

	if (card.notes.trim() !== "") {
		createCollapsible(root, "个人笔记", {
			onFirstOpen: (content) => renderMarkdown(plugin, card.notes, content, card.file, owner),
		});
	}
	if (card.aiNotes.trim() !== "") {
		createCollapsible(root, "AI 笔记", {
			onFirstOpen: (content) => renderMarkdown(plugin, card.aiNotes, content, card.file, owner),
		});
	}

	// 底部：出处 + 定位原文 + 练习
	const footer = document.createElement("div");
	footer.className = "zt-card-foot";
	const source = document.createElement("span");
	source.className = "zt-card-source";
	source.textContent = card.source ? `出处：${card.source}` : "";
	footer.appendChild(source);
	footer.appendChild(buildLocateButton(plugin, card));
	createButton(footer, {
		label: "练习此卡",
		cls: "zt-button zt-button-ghost",
		onClick: () => {
			void plugin.startPractice([card]);
		},
	});
	root.appendChild(footer);

	host.appendChild(root);
	return root;
}
