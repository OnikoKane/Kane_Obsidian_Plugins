import { App, Modal, Notice } from "obsidian";
import type { PluginContext } from "./pluginContext.ts";
import type { TaxonomyCategory, TaxonomyConfig } from "../core/taxonomy.ts";
import { normalizeTaxonomy } from "../core/taxonomy.ts";

/** 分类设置面板（DESIGN-v3.2 §1.3）：草稿编辑，保存才写入 settings.taxonomy。 */

export function openTaxonomyModal(plugin: PluginContext): void {
	new TaxonomyModal(plugin.app, plugin).open();
}

class TaxonomyModal extends Modal {
	private readonly plugin: PluginContext;
	private draft: TaxonomyCategory[] = [];
	private container!: HTMLElement;
	private errorEl!: HTMLElement;
	private saveBtn!: HTMLButtonElement;
	private saved = false;
	private readOnly = false;
	/** 本次草稿里的小标签重命名（保存时同步改写题卡） */
	private renames: Array<{ category: string; subject: string; from: string; to: string }> = [];

	constructor(app: App, plugin: PluginContext) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		this.modalEl.addClass("pd-root", "pd-modal-host");
		this.contentEl.addClass("pd-modal");
		this.contentEl.empty();
		this.readOnly = this.plugin.isReadOnly();
		this.draft = normalizeTaxonomy(
			JSON.parse(JSON.stringify(this.plugin.settings.taxonomy)) as unknown
		).categories;

		const title = document.createElement("h2");
		title.className = "pd-modal-title";
		title.textContent = "分类设置";
		const sub = document.createElement("p");
		sub.className = "pd-modal-sub";
		sub.textContent = "管理科目 > 子科目 > 小标签；只影响选择器，不改写已有题卡。";
		this.contentEl.append(title, sub);

		this.container = document.createElement("div");
		this.container.className = "pd-taxonomy-list";
		this.contentEl.appendChild(this.container);

		const addCategoryRow = document.createElement("div");
		addCategoryRow.className = "pd-taxonomy-add";
		const categoryInput = document.createElement("input");
		categoryInput.className = "pd-modal-input";
		categoryInput.placeholder = "新增科目";
		categoryInput.setAttribute("aria-label", "新增科目");
		const addCategory = document.createElement("button");
		addCategory.type = "button";
		addCategory.className = "pd-btn";
		addCategory.textContent = "添加";
		addCategory.addEventListener("click", () => {
			this.addCategory(categoryInput.value);
			categoryInput.value = "";
		});
		categoryInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				this.addCategory(categoryInput.value);
				categoryInput.value = "";
			}
		});
		addCategoryRow.append(categoryInput, addCategory);
		this.contentEl.appendChild(addCategoryRow);

		const suggestions = document.createElement("div");
		suggestions.className = "pd-taxonomy-suggestions";
		this.contentEl.appendChild(suggestions);
		this.renderSuggestions = () => {
			suggestions.empty();
			const configuredCats = new Set(this.draft.map((item) => item.name));
			const unconfiguredCats = new Set<string>();
			const unconfiguredSubjects = new Map<string, Set<string>>();
			const unconfiguredTags = new Map<string, { cat: string; subject: string; tags: Set<string> }>();
			for (const card of this.plugin.getCards()) {
				const cat = card.category || "数学";
				if (!configuredCats.has(cat)) unconfiguredCats.add(cat);
				const target = this.draft.find((item) => item.name === cat);
				if (target && card.subject && !target.subjects.includes(card.subject)) {
					const set = unconfiguredSubjects.get(cat) ?? new Set<string>();
					set.add(card.subject);
					unconfiguredSubjects.set(cat, set);
				}
				// 科目与子科目都已配置，但小标签还没进库 → 提供“加入”建议
				if (target && card.subject && target.subjects.includes(card.subject)) {
					const known = new Set(target.subjectTags[card.subject] ?? []);
					const key = `${cat}\u0000${card.subject}`;
					const entry = unconfiguredTags.get(key) ?? {
						cat,
						subject: card.subject,
						tags: new Set<string>(),
					};
					for (const tag of card.tags) {
						if (tag.trim() !== "" && !known.has(tag)) entry.tags.add(tag);
					}
					if (entry.tags.size > 0) unconfiguredTags.set(key, entry);
				}
			}
			if (
				unconfiguredCats.size === 0 &&
				unconfiguredSubjects.size === 0 &&
				unconfiguredTags.size === 0
			) {
				return;
			}
			const label = document.createElement("div");
			label.className = "pd-form-hint";
			label.textContent = "题卡中出现但未配置：";
			suggestions.appendChild(label);
			for (const cat of unconfiguredCats) {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "pd-chip";
				button.textContent = cat;
				button.addEventListener("click", () => {
					this.addCategory(cat);
					this.renderAll();
				});
				suggestions.appendChild(button);
			}
			for (const [cat, subjects] of unconfiguredSubjects) {
				for (const subject of subjects) {
					const button = document.createElement("button");
					button.type = "button";
					button.className = "pd-chip";
					button.textContent = `${cat} · ${subject}`;
					button.addEventListener("click", () => {
						const target = this.draft.find((item) => item.name === cat);
						if (target && !target.subjects.includes(subject)) target.subjects.push(subject);
						this.renderAll();
					});
					suggestions.appendChild(button);
				}
			}
			for (const entry of unconfiguredTags.values()) {
				const target = this.draft.find((item) => item.name === entry.cat);
				if (!target) continue;
				for (const tag of entry.tags) {
					const button = document.createElement("button");
					button.type = "button";
					button.className = "pd-chip pd-chip-tag";
					button.textContent = `${entry.cat} · ${entry.subject} · ${tag}`;
					button.addEventListener("click", () => {
						const list = target.subjectTags[entry.subject] ?? [];
						if (!list.includes(tag)) target.subjectTags[entry.subject] = [...list, tag];
						this.renderAll();
					});
					suggestions.appendChild(button);
				}
			}
		};

		this.errorEl = document.createElement("div");
		this.errorEl.className = "pd-modal-error";
		this.errorEl.setAttribute("role", "status");
		this.errorEl.setAttribute("aria-live", "polite");
		this.contentEl.appendChild(this.errorEl);

		const actions = document.createElement("div");
		actions.className = "pd-modal-actions";
		const cancel = document.createElement("button");
		cancel.type = "button";
		cancel.className = "pd-btn";
		cancel.textContent = "取消";
		cancel.addEventListener("click", () => this.close());
		this.saveBtn = document.createElement("button");
		this.saveBtn.type = "button";
		this.saveBtn.className = "pd-btn is-primary";
		this.saveBtn.textContent = "保存";
		this.saveBtn.addEventListener("click", () => void this.doSave());
		actions.append(cancel, this.saveBtn);
		this.contentEl.appendChild(actions);

		if (this.readOnly) {
			this.saveBtn.disabled = true;
			this.errorEl.textContent = "只读模式，暂不能保存";
		}
		this.renderAll();
	}

	private renderSuggestions: () => void = () => undefined;

	private renderList(): void {
		if (!this.container) return;
		this.container.empty();
		if (this.draft.length === 0) {
			const empty = document.createElement("div");
			empty.className = "pd-empty pd-empty-small";
			empty.textContent = "还没有科目。添加一个，或从下方「未配置」加入。";
			this.container.appendChild(empty);
		}
		for (const category of this.draft) {
			const block = document.createElement("div");
			block.className = "pd-taxonomy-cat";
			const head = document.createElement("div");
			head.className = "pd-taxonomy-cat-head";
			const name = document.createElement("span");
			name.className = "pd-taxonomy-name";
			name.textContent = category.name;
			const remove = document.createElement("button");
			remove.type = "button";
			remove.className = "pd-btn pd-btn-small";
			remove.textContent = "删除";
			remove.addEventListener("click", () => {
				const used = this.plugin.getCards().some((card) => (card.category || "数学") === category.name);
				if (used && !window.confirm(`「${category.name}」仍有卡片在使用；删除只影响选择器，不改题卡。继续？`)) {
					return;
				}
				this.draft = this.draft.filter((item) => item.name !== category.name);
				this.renderAll();
			});
			head.append(name, remove);

			const subjectRow = document.createElement("div");
			subjectRow.className = "pd-taxonomy-subjects";
			const label = document.createElement("span");
			label.className = "pd-form-hint";
			label.textContent = "子科目 / 小标签：";
			subjectRow.appendChild(label);
			for (const subject of category.subjects) {
				subjectRow.appendChild(this.buildSubjectRow(category, subject));
			}
			const input = document.createElement("input");
			input.className = "pd-modal-input pd-taxonomy-subject-input";
			input.placeholder = "添加子科目";
			input.setAttribute("aria-label", `为 ${category.name} 添加子科目`);
			const add = document.createElement("button");
			add.type = "button";
			add.className = "pd-btn pd-btn-small";
			add.textContent = "添加";
			const addSubject = (): void => {
				const value = input.value.trim();
				if (value === "") return;
				if (category.subjects.includes(value)) {
					this.setError("该子科目已存在");
					return;
				}
				category.subjects.push(value);
				input.value = "";
				this.setError("");
				this.renderAll();
			};
			add.addEventListener("click", addSubject);
			input.addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					addSubject();
				}
			});
			subjectRow.append(input, add);

			block.append(head, subjectRow);
			this.container.appendChild(block);
		}
	}

	/** 一个子科目一行：子科目 chip + 它的小标签 + 内联新增输入。 */
	private buildSubjectRow(category: TaxonomyCategory, subject: string): HTMLElement {
		const row = document.createElement("div");
		row.className = "pd-taxonomy-subject";

		const chip = document.createElement("span");
		chip.className = "pd-tag is-subject pd-tag-selected-chip pd-taxonomy-subject-chip";
		const text = document.createElement("span");
		text.textContent = subject;
		const removeSubject = document.createElement("button");
		removeSubject.type = "button";
		removeSubject.className = "pd-tag-remove";
		removeSubject.setAttribute("aria-label", `移除子科目 ${subject}`);
		removeSubject.textContent = "×";
		removeSubject.addEventListener("click", () => {
			category.subjects = category.subjects.filter((item) => item !== subject);
			delete category.subjectTags[subject];
			this.renderAll();
		});
		chip.append(text, removeSubject);
		row.appendChild(chip);

		const tags = category.subjectTags[subject] ?? [];
		for (const tag of tags) {
			const tagChip = document.createElement("span");
			tagChip.className = "pd-tag is-topic pd-tag-selected-chip";
			// 点标签名即可重命名；保存后同步改写题卡头部 tags
			const tagText = document.createElement("span");
			tagText.className = "pd-tag-name";
			tagText.setAttribute("role", "button");
			tagText.tabIndex = 0;
			tagText.textContent = tag;
			const beginEdit = (): void => this.editSubjectTag(tagChip, category, subject, tag);
			tagText.addEventListener("click", beginEdit);
			tagText.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					beginEdit();
				}
			});
			const removeTag = document.createElement("button");
			removeTag.type = "button";
			removeTag.className = "pd-tag-remove";
			removeTag.setAttribute("aria-label", `移除小标签 ${tag}`);
			removeTag.textContent = "×";
			removeTag.addEventListener("click", () => {
				category.subjectTags[subject] = tags.filter((item) => item !== tag);
				this.renderAll();
			});
			tagChip.append(tagText, removeTag);
			row.appendChild(tagChip);
		}

		const addChip = document.createElement("button");
		addChip.type = "button";
		addChip.className = "pd-tag-add";
		addChip.textContent = "+ 添加小标签";
		addChip.disabled = this.readOnly;
		addChip.addEventListener("click", () =>
			this.beginAddSubjectTag(row, addChip, category, subject)
		);
		row.appendChild(addChip);
		return row;
	}

	/** 虚线「+ 添加小标签」→ 就地展开输入框；Enter/失焦提交，Esc 取消。 */
	private beginAddSubjectTag(
		row: HTMLElement,
		chip: HTMLElement,
		category: TaxonomyCategory,
		subject: string
	): void {
		const input = document.createElement("input");
		input.className = "pd-modal-input pd-tag-add-input";
		input.placeholder = "新小标签";
		input.setAttribute("aria-label", `为 ${category.name} · ${subject} 添加小标签`);
		chip.hidden = true;
		row.insertBefore(input, chip);
		input.focus();
		let finished = false;
		const commit = (save: boolean): void => {
			if (finished) return;
			finished = true;
			const value = input.value.trim();
			if (save && value !== "") {
				const list = category.subjectTags[subject] ?? [];
				if (list.includes(value)) {
					this.setError("该小标签已存在");
					this.renderAll();
					return;
				}
				category.subjectTags[subject] = [...list, value];
				this.setError("");
			}
			this.renderAll();
		};
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				commit(true);
			} else if (event.key === "Escape") {
				event.preventDefault();
				commit(false);
			}
		});
		input.addEventListener("blur", () => commit(true));
	}

	/** 把小标签 chip 就地变成输入框；Enter/失焦提交，Esc 取消。 */
	private editSubjectTag(
		chip: HTMLElement,
		category: TaxonomyCategory,
		subject: string,
		oldName: string
	): void {
		const input = document.createElement("input");
		input.className = "pd-modal-input pd-taxonomy-tag-input pd-tag-inline-input";
		input.value = oldName;
		input.setAttribute("aria-label", `重命名小标签 ${oldName}`);
		chip.textContent = "";
		chip.appendChild(input);
		input.focus();
		input.select();
		let finished = false;
		const commit = (save: boolean): void => {
			if (finished) return;
			finished = true;
			const value = input.value.trim();
			if (!save || value === "" || value === oldName) {
				this.renderAll();
				return;
			}
			const list = category.subjectTags[subject] ?? [];
			if (list.includes(value)) {
				this.setError("该小标签已存在");
				this.renderAll();
				return;
			}
			category.subjectTags[subject] = list.map((tag) => (tag === oldName ? value : tag));
			this.recordRename(category.name, subject, oldName, value);
			this.setError("");
			this.renderAll();
		};
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				commit(true);
			} else if (event.key === "Escape") {
				event.preventDefault();
				commit(false);
			}
		});
		input.addEventListener("blur", () => commit(true));
	}

	/** 合并连续重命名（A→B→C 记为 A→C；改回原名则移除）。 */
	private recordRename(category: string, subject: string, from: string, to: string): void {
		const existing = this.renames.find(
			(rename) => rename.category === category && rename.subject === subject && rename.to === from
		);
		if (existing) {
			if (existing.from === to) {
				this.renames = this.renames.filter((rename) => rename !== existing);
			} else {
				existing.to = to;
			}
			return;
		}
		this.renames.push({ category, subject, from, to });
	}

	private renderAll(): void {
		this.renderList();
		this.renderSuggestions();
		this.validate();
	}

	private addCategory(raw: string): void {
		const name = raw.trim();
		if (name === "") {
			this.setError("科目名称不能为空");
			return;
		}
		if (this.draft.some((item) => item.name === name)) {
			this.setError("该科目已存在");
			return;
		}
		this.draft.push({ name, subjects: [], subjectTags: {} });
		this.setError("");
		this.renderAll();
	}

	private validate(): void {
		const names = new Set<string>();
		for (const category of this.draft) {
			if (category.name.trim() === "") {
				this.setError("存在空的科目名称");
				return;
			}
			if (names.has(category.name)) {
				this.setError("存在重复的科目名称");
				return;
			}
			names.add(category.name);
		}
		this.setError("");
	}

	private setError(message: string): void {
		if (this.errorEl) this.errorEl.textContent = message;
	}

	private async doSave(): Promise<void> {
		if (this.readOnly) return;
		this.validate();
		if (this.errorEl.textContent !== "") return;
		this.saveBtn.disabled = true;
		const taxonomy: TaxonomyConfig = {
			categories: this.draft.map((category) => {
				const subjectTags: Record<string, string[]> = {};
				for (const subject of category.subjects) {
					const tags = category.subjectTags[subject] ?? [];
					if (tags.length > 0) subjectTags[subject] = [...tags];
				}
				return {
					...(category as Record<string, unknown>),
					name: category.name,
					subjects: [...category.subjects],
					subjectTags,
				};
			}),
			seeded: true,
		};
		try {
			await this.plugin.saveSettings({ ...this.plugin.settings, taxonomy });
			if (this.renames.length > 0) {
				const count = await this.plugin.syncTagRenames(this.renames);
				if (count > 0) new Notice(`已同步 ${count} 道题的小标签`);
			}
			this.saved = true;
			this.plugin.refreshAll();
			this.close();
		} catch (error) {
			this.saveBtn.disabled = false;
			this.setError(`保存失败：${String(error)}`);
		}
	}

	close(): void {
		if (!this.saved && JSON.stringify(this.draft) !== JSON.stringify(this.plugin.settings.taxonomy.categories)) {
			const confirmed = window.confirm("放弃未保存的分类修改？");
			if (!confirmed) return;
		}
		super.close();
	}
}
