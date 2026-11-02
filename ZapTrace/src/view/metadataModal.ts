import { App, Modal, Notice, setIcon } from "obsidian";
import type { PluginContext } from "./pluginContext.ts";
import type { QuestionCard } from "../core/types.ts";

/** 分类与标签编辑模态（DESIGN-v3.1 §2）。 */

export function openMetadataEditor(
	plugin: PluginContext,
	card: QuestionCard,
	anchor?: HTMLElement
): void {
	const modal = new MetadataEditorModal(plugin.app, plugin, card, anchor);
	modal.open();
}

export function parseTags(raw: string): string[] {
	const parts = raw
		.split(/[,，、]/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
	return [...new Set(parts)];
}

class MetadataEditorModal extends Modal {
	private readonly plugin: PluginContext;
	private readonly card: QuestionCard;
	private readonly anchor?: HTMLElement;

	private categoryInput!: HTMLInputElement;
	private subjectInput!: HTMLInputElement;
	private tagsInput!: HTMLInputElement;
	private preview!: HTMLElement;
	private errorEl!: HTMLElement;
	private saveBtn!: HTMLButtonElement;
	private cancelBtn!: HTMLButtonElement;
	private initial = { category: "", subject: "", tags: "" };
	private saved = false;

	constructor(app: App, plugin: PluginContext, card: QuestionCard, anchor?: HTMLElement) {
		super(app);
		this.plugin = plugin;
		this.card = card;
		this.anchor = anchor;
	}

	onOpen(): void {
		this.modalEl.addClass("pd-root", "pd-modal-host");
		this.contentEl.addClass("pd-modal");
		this.titleEl.setText("");
		this.contentEl.empty();

		const head = document.createElement("div");
		head.className = "pd-modal-head";
		const title = document.createElement("h2");
		title.className = "pd-modal-title";
		title.id = "pd-meta-title";
		title.textContent = "编辑分类与标签";
		const sub = document.createElement("p");
		sub.className = "pd-modal-sub";
		sub.textContent = "仅修改题卡头部；不改题干/答案/笔记。留空 = 回退推断值。";
		head.append(title, sub);
		this.contentEl.appendChild(head);

		const form = document.createElement("form");
		form.className = "pd-meta-form";
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			void this.doSave();
		});

		const categories = this.unique(
			this.plugin.getCards().map((item) => item.category ?? "数学")
		);
		const subjects = this.unique(this.plugin.getCards().map((item) => item.subject));
		const tags = this.unique(this.plugin.getCards().flatMap((item) => item.tags));

		this.categoryInput = this.buildRow(form, {
			id: "pd-meta-category",
			label: "大科目",
			value: this.card.category ?? "数学",
			listId: "pd-meta-category-list",
			suggestions: categories,
		});
		this.subjectInput = this.buildRow(form, {
			id: "pd-meta-subject",
			label: "子科目",
			value: this.card.subject ?? "",
			listId: "pd-meta-subject-list",
			suggestions: subjects,
		});
		this.tagsInput = this.buildRow(form, {
			id: "pd-meta-tags",
			label: "章节 / 知识点",
			value: this.card.tags.join(", "),
			listId: "pd-meta-tags-list",
			suggestions: tags,
			describedBy: "pd-meta-tags-hint",
		});

		// 标签实时预览 + 提示
		const tagsRow = this.tagsInput.closest(".pd-form-row") as HTMLElement;
		this.preview = document.createElement("div");
		this.preview.className = "pd-tags-preview";
		const hint = document.createElement("div");
		hint.className = "pd-form-hint";
		hint.id = "pd-meta-tags-hint";
		hint.textContent = "用中英文逗号或顿号分隔，如：导数, 极限";
		tagsRow.append(this.preview, hint);

		this.errorEl = document.createElement("div");
		this.errorEl.className = "pd-modal-error";
		this.errorEl.setAttribute("role", "status");
		this.errorEl.setAttribute("aria-live", "polite");
		form.appendChild(this.errorEl);

		const actions = document.createElement("div");
		actions.className = "pd-modal-actions";
		this.cancelBtn = document.createElement("button");
		this.cancelBtn.type = "button";
		this.cancelBtn.className = "pd-btn";
		this.cancelBtn.textContent = "取消";
		this.cancelBtn.addEventListener("click", () => this.close());
		this.saveBtn = document.createElement("button");
		this.saveBtn.type = "submit";
		this.saveBtn.className = "pd-btn is-primary";
		this.saveBtn.textContent = "保存";
		actions.append(this.cancelBtn, this.saveBtn);
		form.appendChild(actions);
		this.contentEl.appendChild(form);

		this.initial = {
			category: this.categoryInput.value,
			subject: this.subjectInput.value,
			tags: this.tagsInput.value,
		};

		const onInput = (): void => {
			for (const input of [this.categoryInput, this.subjectInput, this.tagsInput]) {
				input.value = input.value.replace(/[\r\n]+/g, " ");
			}
			this.updatePreview();
			this.updateSaveState();
		};
		for (const input of [this.categoryInput, this.subjectInput, this.tagsInput]) {
			input.addEventListener("input", onInput);
		}

		form.addEventListener("keydown", (event) => {
			if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
				event.preventDefault();
				void this.doSave();
			}
		});

		if (this.plugin.isReadOnly()) {
			for (const input of [this.categoryInput, this.subjectInput, this.tagsInput]) {
				input.readOnly = true;
			}
			this.saveBtn.disabled = true;
			this.errorEl.textContent = "只读模式，暂不能保存";
		}

		this.updatePreview();
		this.updateSaveState();
		window.setTimeout(() => this.categoryInput.focus(), 0);
	}

	private buildRow(
		parent: HTMLElement,
		options: {
			id: string;
			label: string;
			value: string;
			listId: string;
			suggestions: string[];
			describedBy?: string;
		}
	): HTMLInputElement {
		const row = document.createElement("div");
		row.className = "pd-form-row" + (options.id === "pd-meta-tags" ? " is-tall" : "");
		const label = document.createElement("label");
		label.className = "pd-field-label";
		label.htmlFor = options.id;
		label.textContent = options.label;
		const input = document.createElement("input");
		input.className = "pd-modal-input";
		input.id = options.id;
		input.maxLength = 120;
		input.value = options.value;
		if (options.describedBy) input.setAttribute("aria-describedby", options.describedBy);
		const list = document.createElement("datalist");
		list.id = options.listId;
		for (const suggestion of options.suggestions) {
			if (!suggestion) continue;
			const option = document.createElement("option");
			option.value = suggestion;
			list.appendChild(option);
		}
		input.setAttribute("list", options.listId);
		row.append(label, input, list);
		parent.appendChild(row);
		return input;
	}

	private unique(values: string[]): string[] {
		return [...new Set(values.filter((value) => value && value.trim() !== ""))].sort((a, b) =>
			a.localeCompare(b, "zh-Hans-CN")
		);
	}

	private updatePreview(): void {
		if (!this.preview) return;
		this.preview.empty();
		for (const tag of parseTags(this.tagsInput.value)) {
			const chip = document.createElement("span");
			chip.className = "pd-tag is-topic";
			chip.textContent = tag;
			this.preview.appendChild(chip);
		}
	}

	private isDirty(): boolean {
		return (
			this.categoryInput.value !== this.initial.category ||
			this.subjectInput.value !== this.initial.subject ||
			this.tagsInput.value !== this.initial.tags
		);
	}

	private updateSaveState(): void {
		if (!this.saveBtn) return;
		this.saveBtn.disabled = this.plugin.isReadOnly() || !this.isDirty();
	}

	private async doSave(): Promise<void> {
		if (this.plugin.isReadOnly()) {
			this.errorEl.textContent = "只读模式，暂不能保存";
			return;
		}
		if (!this.isDirty()) {
			new Notice("ZapTrace: 内容未变化");
			this.saved = true;
			this.close();
			return;
		}
		this.saveBtn.disabled = true;
		this.cancelBtn.disabled = true;
		this.errorEl.textContent = "保存中…";
		const result = await this.plugin.saveMetadata(this.card, {
			category: this.categoryInput.value.trim(),
			subject: this.subjectInput.value.trim(),
			tags: parseTags(this.tagsInput.value),
		});
		if (!result.ok) {
			this.errorEl.textContent = `保存失败：${result.error ?? "未知错误"}`;
			this.saveBtn.disabled = false;
			this.cancelBtn.disabled = false;
			return;
		}
		this.saved = true;
		if (!result.changed) new Notice("ZapTrace: 内容未变化");
		this.close();
	}

	close(): void {
		if (!this.saved && this.isDirty()) {
			const confirmed = window.confirm("放弃未保存的修改？");
			if (!confirmed) return;
		}
		super.close();
	}

	onClose(): void {
		if (this.anchor && this.anchor.isConnected) this.anchor.focus();
	}
}
