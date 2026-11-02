import type { PluginContext } from "./pluginContext.ts";
import type { QuestionCard } from "../core/types.ts";

/**
 * 共享个人笔记编辑器（阅读卡 / 题库卡同一组件，DESIGN-v3 §3.4 / §5）。
 * 保存走 plugin.saveNotes（只替换目标 zaptrace 块的「### 个人笔记」节）。
 */

let noteSeq = 0;

export interface NoteEditorOptions {
	compact?: boolean;
}

function pad2(value: number): string {
	return value < 10 ? `0${value}` : String(value);
}

/** 支持 ISO 字符串（插件保存的 notesUpdatedAt）或 epoch ms（文件 mtime）。 */
function formatTime(value: string | number | null): string {
	if (value === null || value === undefined || value === "") return "";
	if (typeof value === "number") {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "";
		return `更新于 ${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
			date.getDate()
		)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		// 非标准 ISO：退化为截断显示
		return `更新于 ${value.slice(0, 16).replace("T", " ")}`;
	}
	return `更新于 ${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(
		parsed.getDate()
	)} ${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
}

export function createNoteEditor(
	plugin: PluginContext,
	card: QuestionCard,
	parent: HTMLElement,
	options: NoteEditorOptions = {}
): HTMLElement {
	const root = document.createElement("div");
	root.className = "pd-note-block" + (options.compact ? " pd-note-block-compact" : "");

	const head = document.createElement("div");
	head.className = "pd-note-head";
	const label = document.createElement("label");
	label.className = "pd-note-label";
	label.textContent = "个人笔记";
	const id = `zt-note-${++noteSeq}`;
	label.htmlFor = id;
	const time = document.createElement("span");
	time.className = "pd-note-time";
	head.append(label, time);

	const textarea = document.createElement("textarea");
	textarea.className = "pd-note-input";
	textarea.id = id;
	textarea.value = card.notes;
	textarea.placeholder = "写点什么…（支持 Markdown 与 $公式$）";
	textarea.setAttribute("aria-label", "编辑个人笔记（Markdown）");
	if (options.compact) textarea.rows = 2;

	const actions = document.createElement("div");
	actions.className = "pd-note-actions";
	const save = document.createElement("button");
	save.type = "button";
	save.className = "pd-btn is-primary pd-btn-small";
	save.textContent = "保存";
	const cancel = document.createElement("button");
	cancel.type = "button";
	cancel.className = "pd-btn pd-btn-small";
	cancel.textContent = "取消";
	const status = document.createElement("span");
	status.className = "pd-note-status";
	status.setAttribute("aria-live", "polite");
	actions.append(save, cancel, status);

	root.append(head, textarea, actions);

	const readOnly = plugin.isReadOnly();
	const updateTime = (): void => {
		const state = plugin.getState(card.qid);
		const hasNotes = card.notes.trim() !== "";
		// 插件内保存过 → 用 notesUpdatedAt；否则非空笔记回退到目标文件 mtime
		const timestamp = state?.notesUpdatedAt ?? (hasNotes ? plugin.getFileMtime(card.file) : null);
		if (hasNotes && timestamp !== null && timestamp !== undefined) {
			time.textContent = formatTime(timestamp);
			time.hidden = false;
		} else {
			time.textContent = "";
			time.hidden = true;
		}
	};

	const isDirty = (): boolean => textarea.value !== card.notes;
	const refreshButtons = (): void => {
		save.disabled = readOnly || !isDirty();
		cancel.disabled = readOnly || !isDirty();
		textarea.readOnly = readOnly;
	};

	textarea.addEventListener("input", () => {
		refreshButtons();
		if (!readOnly && isDirty()) {
			status.textContent = "未保存";
			status.classList.remove("is-error");
		} else if (!readOnly) {
			status.textContent = "";
		}
	});

	cancel.addEventListener("click", () => {
		textarea.value = card.notes;
		status.textContent = "";
		status.classList.remove("is-error");
		textarea.removeAttribute("aria-invalid");
		refreshButtons();
	});

	let saving = false;
	const doSave = async (): Promise<void> => {
		if (readOnly || saving) return;
		if (!isDirty()) {
			status.textContent = "内容未变化";
			return;
		}
		saving = true;
		status.textContent = "保存中…";
		status.classList.remove("is-error");
		save.disabled = true;
		cancel.disabled = true;
		const draft = textarea.value;
		const result = await plugin.saveNotes(card, draft);
		saving = false;
		if (result.ok) {
			card.notes = draft;
			updateTime();
			refreshButtons();
			status.textContent =
				draft.trim() === "" ? "已清除笔记" : `已保存 ${new Date().toTimeString().slice(0, 5)}`;
			textarea.removeAttribute("aria-invalid");
		} else {
			status.textContent = `保存失败：${result.error ?? "未知错误"}`;
			status.classList.add("is-error");
			textarea.setAttribute("aria-invalid", "true");
			refreshButtons();
		}
	};

	save.addEventListener("click", () => {
		void doSave();
	});

	textarea.addEventListener("keydown", (event) => {
		if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
			event.preventDefault();
			void doSave();
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			if (isDirty() && !readOnly) {
				textarea.value = card.notes;
				status.textContent = "已取消修改";
			}
			refreshButtons();
			event.stopPropagation();
		}
	});

	if (readOnly) {
		status.textContent = "只读模式，暂不能保存";
		root.title = "data.json 处于只读模式";
	}
	updateTime();
	refreshButtons();
	return root;
}
