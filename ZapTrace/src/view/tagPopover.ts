import { setIcon } from "obsidian";
import type { PluginContext } from "./pluginContext.ts";
import type { QuestionCard } from "../core/types.ts";
import { taxonomySubjects } from "../core/taxonomy.ts";

/**
 * 标签编辑 popover（DESIGN-v3.2 §2，非 modal）：
 * 大科目/子科目只能选 taxonomy 已配置值；标签可自由新增。
 */

let active:
	| { el: HTMLElement; anchor: HTMLElement; close: (force?: boolean) => void }
	| null = null;

function closeActive(force = true): void {
	active?.close(force);
}

export function openTagPopover(
	anchor: HTMLElement,
	plugin: PluginContext,
	card: QuestionCard
): void {
	if (active && active.anchor === anchor) {
		active.close();
		return;
	}
	if (active) active.close();

	const taxonomy = plugin.settings.taxonomy;
	const readOnly = plugin.isReadOnly();
	const initial = {
		category: card.category || "数学",
		subject: card.subject || "",
		tags: [...card.tags],
	};
	let category = initial.category;
	let subject = initial.subject;
	let tags = [...initial.tags];

	const root = document.createElement("div");
	root.className = "pd-root pd-popover pd-tag-popover";
	root.setAttribute("role", "dialog");
	root.setAttribute("aria-label", "编辑标签");

	const head = document.createElement("div");
	head.className = "pd-popover-head";
	const title = document.createElement("span");
	title.className = "pd-popover-title";
	title.textContent = "标签";
	const closeBtn = document.createElement("button");
	closeBtn.type = "button";
	closeBtn.className = "pd-icon-btn";
	closeBtn.setAttribute("aria-label", "关闭");
	setIcon(closeBtn, "x");
	head.append(title, closeBtn);
	root.appendChild(head);

	const categoryRow = row(root, "大科目");
	const categorySelect = select(categoryRow);
	const subjectRow = row(root, "子科目");
	const subjectSelect = select(subjectRow);
	const tagsRow = row(root, "已选标签", true);
	const selected = document.createElement("div");
	selected.className = "pd-tag-selected";
	const input = document.createElement("input");
	input.className = "pd-pop-input";
	input.placeholder = "输入标签，回车添加";
	input.setAttribute("aria-label", "添加标签");
	const datalistId = `pd-tag-options-${Date.now()}`;
	const datalist = document.createElement("datalist");
	datalist.id = datalistId;
	input.setAttribute("list", datalistId);
	tagsRow.append(selected, input, datalist);

	const hint = document.createElement("div");
	hint.className = "pd-pop-hint";
	hint.textContent = "大科目/子科目需在「分类设置」中添加；标签可自由新增";
	const error = document.createElement("div");
	error.className = "pd-pop-error";
	error.setAttribute("role", "status");
	error.setAttribute("aria-live", "polite");
	const actions = document.createElement("div");
	actions.className = "pd-pop-actions";
	const cancel = document.createElement("button");
	cancel.type = "button";
	cancel.className = "pd-btn pd-btn-small";
	cancel.textContent = "取消";
	const save = document.createElement("button");
	save.type = "button";
	save.className = "pd-btn is-primary pd-btn-small";
	save.textContent = "保存";
	actions.append(cancel, save);
	root.append(hint, error, actions);
	document.body.appendChild(root);

	const names = taxonomy.categories.map((item) => item.name);
	const isConfigured = (name: string): boolean => names.includes(name);

	const renderCategoryOptions = (): void => {
		categorySelect.empty();
		const placeholder = document.createElement("option");
		placeholder.value = "";
		placeholder.textContent = "请选择";
		categorySelect.appendChild(placeholder);
		for (const name of names) {
			const option = document.createElement("option");
			option.value = name;
			option.textContent = name;
			categorySelect.appendChild(option);
		}
		if (category && !isConfigured(category)) {
			const option = document.createElement("option");
			option.value = category;
			option.textContent = `（未配置）${category}`;
			option.disabled = true;
			categorySelect.appendChild(option);
		}
		categorySelect.value = category;
		categorySelect.disabled = readOnly;
	};

	const renderSubjectOptions = (): void => {
		subjectSelect.empty();
		const blank = document.createElement("option");
		blank.value = "";
		blank.textContent = "（留空）";
		subjectSelect.appendChild(blank);
		const options = isConfigured(category) ? taxonomySubjects(taxonomy, category) : [];
		for (const name of options) {
			const option = document.createElement("option");
			option.value = name;
			option.textContent = name;
			subjectSelect.appendChild(option);
		}
		if (subject && !options.includes(subject)) {
			const option = document.createElement("option");
			option.value = subject;
			option.textContent = `（未配置）${subject}`;
			option.disabled = true;
			subjectSelect.appendChild(option);
		}
		subjectSelect.value = subject;
		subjectSelect.disabled = readOnly || !category;
		subjectSelect.setAttribute("aria-disabled", String(subjectSelect.disabled));
		subjectSelect.title = category ? "" : "请先选择大科目";
	};

	const refreshSuggestions = (): void => {
		datalist.empty();
		const set = new Set<string>();
		for (const item of plugin.getCards()) {
			if ((item.category || "数学") !== category) continue;
			for (const tag of item.tags) if (!tags.includes(tag)) set.add(tag);
		}
		for (const tag of [...set].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))) {
			const option = document.createElement("option");
			option.value = tag;
			datalist.appendChild(option);
		}
	};

	const renderTags = (): void => {
		selected.empty();
		for (const tag of tags) {
			const chip = document.createElement("span");
			chip.className = "pd-tag is-topic pd-tag-selected-chip";
			const label = document.createElement("span");
			label.textContent = tag;
			const remove = document.createElement("button");
			remove.type = "button";
			remove.className = "pd-tag-remove";
			remove.setAttribute("aria-label", `移除标签 ${tag}`);
			remove.textContent = "×";
			remove.disabled = readOnly;
			remove.addEventListener("click", () => {
				tags = tags.filter((item) => item !== tag);
				renderTags();
				refreshSuggestions();
				updateSaveState();
			});
			chip.append(label, remove);
			selected.appendChild(chip);
		}
		if (tags.length === 0) {
			const empty = document.createElement("span");
			empty.className = "pd-pop-empty";
			empty.textContent = "暂无标签";
			selected.appendChild(empty);
		}
	};

	const addTag = (raw: string): void => {
		const value = raw.trim();
		if (value === "" || tags.includes(value)) return;
		tags = [...tags, value];
		renderTags();
		refreshSuggestions();
		updateSaveState();
	};

	const isDirty = (): boolean =>
		category !== initial.category ||
		subject !== initial.subject ||
		tags.join("\u0000") !== initial.tags.join("\u0000");

	const updateSaveState = (): void => {
		save.disabled = readOnly || !category || !isDirty();
	};

	categorySelect.addEventListener("change", () => {
		category = categorySelect.value;
		subject = "";
		renderSubjectOptions();
		renderTags();
		refreshSuggestions();
		updateSaveState();
	});
	subjectSelect.addEventListener("change", () => {
		subject = subjectSelect.value;
		updateSaveState();
	});
	input.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			addTag(input.value);
			input.value = "";
			return;
		}
		if (event.key === "Backspace" && input.value === "" && tags.length > 0) {
			event.preventDefault();
			tags = tags.slice(0, -1);
			renderTags();
			refreshSuggestions();
			updateSaveState();
		}
	});

	const requestClose = (force = false): void => {
		if (!force && isDirty()) {
			const confirmed = window.confirm("放弃未保存的标签修改？");
			if (!confirmed) return;
		}
		document.removeEventListener("mousedown", onOutside, true);
		document.removeEventListener("keydown", onKeyDown, true);
		window.removeEventListener("scroll", reposition, true);
		window.removeEventListener("resize", reposition);
		root.remove();
		anchor.setAttribute("aria-expanded", "false");
		if (active && active.el === root) active = null;
		if (anchor.isConnected) anchor.focus();
	};

	const doSave = async (): Promise<void> => {
		if (readOnly) {
			error.textContent = "只读模式，暂不能保存";
			return;
		}
		if (!category) {
			error.textContent = "请先选择大科目（需在分类设置中添加）";
			return;
		}
		save.disabled = true;
		cancel.disabled = true;
		error.textContent = "保存中…";
		const result = await plugin.saveMetadata(card, { category, subject, tags });
		if (!result.ok) {
			error.textContent = `保存失败：${result.error ?? "未知错误"}`;
			save.disabled = false;
			cancel.disabled = false;
			return;
		}
		if (!result.changed) {
			// 内容未变化：直接关闭
		}
		requestClose(true);
	};

	save.addEventListener("click", () => {
		void doSave();
	});
	cancel.addEventListener("click", () => requestClose());
	closeBtn.addEventListener("click", () => requestClose());

	const onOutside = (event: MouseEvent): void => {
		if (!root.contains(event.target as Node) && !anchor.contains(event.target as Node)) {
			requestClose();
		}
	};
	const onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") {
			event.preventDefault();
			requestClose();
		} else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
			event.preventDefault();
			void doSave();
		}
	};

	const reposition = (): void => {
		if (!anchor.isConnected) {
			requestClose(true);
			return;
		}
		if (window.innerWidth < 480) {
			root.style.left = "";
			root.style.top = "";
			return;
		}
		const rect = anchor.getBoundingClientRect();
		const width = root.offsetWidth || 320;
		const height = root.offsetHeight || 0;
		let left = rect.right - width;
		left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
		let top = rect.bottom + 6;
		if (top + height > window.innerHeight - 8) {
			top = Math.max(8, rect.top - height - 6);
		}
		root.style.left = `${Math.round(left)}px`;
		root.style.top = `${Math.round(top)}px`;
	};

	renderCategoryOptions();
	renderSubjectOptions();
	renderTags();
	refreshSuggestions();
	updateSaveState();
	anchor.setAttribute("aria-expanded", "true");

	document.addEventListener("mousedown", onOutside, true);
	document.addEventListener("keydown", onKeyDown, true);
	window.addEventListener("scroll", reposition, true);
	window.addEventListener("resize", reposition);
	root.classList.add("is-open");
	reposition();
	active = { el: root, anchor, close: (force?: boolean) => requestClose(force) };
	window.setTimeout(() => categorySelect.focus(), 0);
}

function row(parent: HTMLElement, labelText: string, tall = false): HTMLElement {
	const rowEl = document.createElement("div");
	rowEl.className = "pd-pop-row" + (tall ? " is-tall" : "");
	const label = document.createElement("span");
	label.className = "pd-pop-label";
	label.textContent = labelText;
	rowEl.appendChild(label);
	parent.appendChild(rowEl);
	return rowEl;
}

function select(parent: HTMLElement): HTMLSelectElement {
	const el = document.createElement("select");
	el.className = "pd-pop-select";
	parent.appendChild(el);
	return el;
}

/** 关闭当前 popover（如视图卸载）。 */
export function closeTagPopover(): void {
	closeActive(true);
}
