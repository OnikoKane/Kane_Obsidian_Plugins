import { Component, MarkdownRenderer, setIcon } from "obsidian";
import type { PluginContext } from "./pluginContext.ts";
import type { QuestionCard } from "../core/types.ts";
import { createCollapsible, createButton } from "./dom.ts";
import { openMenu } from "./menu.ts";
import { toPreviewText } from "./plainText.ts";

export interface RenderCardOptions {
	plugin: PluginContext;
	card: QuestionCard;
	host: HTMLElement;
	/** 渲染 owner（MarkdownRenderer 生命周期） */
	owner: Component;
	/** Live Preview 只读缩略卡 */
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

function lineCount(text: string): number {
	return text.split(/\r?\n/).filter((line) => line.trim() !== "").length;
}

function buildTags(card: QuestionCard): HTMLElement {
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
	return tags;
}

function buildCardMenuButton(plugin: PluginContext, card: QuestionCard): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "pd-icon-btn pd-card-more";
	button.dataset.tool = "more";
	button.setAttribute("aria-label", "更多操作");
	button.setAttribute("aria-haspopup", "menu");
	setIcon(button, "more-horizontal");
	button.addEventListener("click", (event) => {
		event.stopPropagation();
		const starred = plugin.getState(card.qid)?.star ?? card.starInitial;
		openMenu(button, [
			{
				label: starred ? "取消收藏" : "收藏",
				icon: "star",
				onSelect: () => {
					plugin.toggleStar(card.qid);
					plugin.requestSave();
				},
			},
			{
				label: "打开原文",
				icon: "external-link",
				onSelect: () => {
					void plugin.openSource(card);
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
	});
	return button;
}

/** 阅读视图 Quiet Card（DESIGN-v2 §4）。答案与笔记为 38px 扁平折叠行，懒渲染。 */
export function renderQuestionCard(options: RenderCardOptions): HTMLElement {
	const { plugin, card, host, owner, compact } = options;
	const root = document.createElement("div");
	root.className = "pd-root pd-card zt-card";
	root.dataset.qid = card.qid;
	root.dataset.file = card.file;

	if (compact) {
		root.classList.add("pd-compact");
		const title = document.createElement("div");
		title.className = "pd-compact-title";
		title.textContent = toPreviewText(card.stem, 80) || "（空题干）";
		const hint = document.createElement("div");
		hint.className = "pd-compact-hint";
		hint.textContent = "实时预览只读 · 在阅读视图或工作台作答";
		const actions = document.createElement("div");
		actions.className = "pd-actions";
		createButton(actions, {
			label: "打开工作台练习",
			cls: "pd-btn",
			onClick: () => {
				void plugin.startPractice([card]);
			},
		});
		createButton(actions, {
			label: "定位原文",
			cls: "pd-btn",
			onClick: () => {
				void plugin.openSource(card);
			},
		});
		root.append(title, hint, actions);
		host.appendChild(root);
		return root;
	}

	// 头部：标签 + hover 工具
	const head = document.createElement("div");
	head.className = "pd-card-head";
	head.appendChild(buildTags(card));
	const tools = document.createElement("div");
	tools.className = "pd-card-tools";
	tools.appendChild(buildCardMenuButton(plugin, card));
	head.appendChild(tools);
	root.appendChild(head);

	// 题干
	const stem = document.createElement("div");
	stem.className = "pd-stem pd-body";
	renderMarkdown(plugin, card.stem, stem, card.file, owner);
	root.appendChild(stem);

	// 语法/重复问题（红字无红底）
	if (card.errors.length > 0) {
		const errors = document.createElement("div");
		errors.className = "pd-card-error";
		errors.setAttribute("role", "status");
		for (const message of card.errors) {
			const line = document.createElement("div");
			line.textContent = message;
			errors.appendChild(line);
		}
		root.appendChild(errors);
	}

	// 三条 38px 扁平折叠行
	const folds = document.createElement("div");
	folds.className = "pd-folds";
	root.appendChild(folds);

	const answerLines = lineCount(card.answer);
	createCollapsible(folds, "答案", {
		count: answerLines > 0 ? `${answerLines} 行` : undefined,
		onFirstOpen: (content) => {
			if (card.answer.trim() === "") {
				const missing = document.createElement("div");
				missing.className = "pd-card-error";
				missing.textContent = "缺少答案分节";
				content.appendChild(missing);
				return;
			}
			renderMarkdown(plugin, card.answer, content, card.file, owner);
		},
	});
	if (card.notes.trim() !== "") {
		createCollapsible(folds, "个人笔记", {
			count: `${lineCount(card.notes)} 行`,
			onFirstOpen: (content) => renderMarkdown(plugin, card.notes, content, card.file, owner),
		});
	}
	if (card.aiNotes.trim() !== "") {
		createCollapsible(folds, "AI 笔记", {
			count: `${lineCount(card.aiNotes)} 行`,
			onFirstOpen: (content) => renderMarkdown(plugin, card.aiNotes, content, card.file, owner),
		});
	}

	// 底部：出处 + 操作（同一基线）
	const foot = document.createElement("div");
	foot.className = "pd-card-foot";
	const source = document.createElement("span");
	source.className = "pd-source";
	if (card.source) {
		const prefix = document.createElement("span");
		prefix.className = "pd-source-prefix";
		prefix.textContent = "出处：";
		source.appendChild(prefix);
		source.appendChild(document.createTextNode(card.source));
		source.title = card.source;
	}
	foot.appendChild(source);
	const actions = document.createElement("div");
	actions.className = "pd-actions";
	createButton(actions, {
		label: "定位原文",
		cls: "pd-btn",
		onClick: () => {
			void plugin.openSource(card);
		},
	});
	createButton(actions, {
		label: "练习此卡",
		cls: "pd-btn is-primary",
		onClick: () => {
			void plugin.startPractice([card]);
		},
	});
	foot.appendChild(actions);
	root.appendChild(foot);

	host.appendChild(root);
	return root;
}
