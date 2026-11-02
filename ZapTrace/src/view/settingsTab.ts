import { App, PluginSettingTab, Setting } from "obsidian";
import type ZapTracePlugin from "../main.ts";
import { openTaxonomyModal } from "./taxonomyPanel.ts";

/** 设置页（DESIGN §12.2）。 */
export class ZaptraceSettingsTab extends PluginSettingTab {
	private readonly plugin: ZapTracePlugin;

	constructor(app: App, plugin: ZapTracePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "ZapTrace 设置" });

		if (this.plugin.store.readOnly) {
			const warn = containerEl.createEl("div", { cls: "zt-settings-warning" });
			warn.setText(
				"当前为只读模式（data.json 版本高于插件或结构损坏），设置与评分不会保存。请先备份并修复 data.json。"
			);
		}

		new Setting(containerEl)
			.setName("分类设置")
			.setDesc("管理科目与子科目；只影响标签编辑器里的可选项，不改写已有题卡。")
			.addButton((button) =>
				button.setButtonText("编辑分类").onClick(() => openTaxonomyModal(this.plugin))
			);

		new Setting(containerEl)
			.setName("题卡目录")
			.setDesc("限定扫描范围；留空表示扫描全库。")
			.addText((text) =>
				text
					.setPlaceholder("例如 数学/题库")
					.setValue(this.plugin.settings.cardFolder)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ cardFolder: value.trim() });
					})
			);

		new Setting(containerEl)
			.setName("默认科目")
			.setDesc("题卡没有 subject 时使用；留空则取所在文件夹名。")
			.addText((text) =>
				text.setValue(this.plugin.settings.defaultSubject).onChange(async (value) => {
					await this.plugin.updateSettings({ defaultSubject: value.trim() });
				})
			);

		new Setting(containerEl)
			.setName("每日复习上限")
			.setDesc("今日队列/组卷的最大题数（默认 20，不复用学习系统的 8 条上限）。")
			.addText((text) =>
				text.setValue(String(this.plugin.settings.dailyReviewLimit)).onChange(async (value) => {
					const parsed = Number.parseInt(value, 10);
					if (!Number.isFinite(parsed)) return;
					await this.plugin.updateSettings({
						dailyReviewLimit: Math.max(1, Math.min(500, parsed)),
					});
				})
			);

		new Setting(containerEl)
			.setName("日期模式")
			.setDesc("本地：设备时区；固定：Asia/Shanghai。")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({ local: "本地时区", fixed: "固定 Asia/Shanghai" })
					.setValue(this.plugin.settings.dateMode)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ dateMode: value === "fixed" ? "fixed" : "local" });
					})
			);

		new Setting(containerEl)
			.setName("必须作答后才能看答案")
			.setDesc("开启后，练习时需点「我写完了」才揭晓答案。")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.requireAnswerBeforeReveal).onChange(async (value) => {
					await this.plugin.updateSettings({ requireAnswerBeforeReveal: value });
				})
			);

		new Setting(containerEl)
			.setName("实时预览")
			.setDesc("compact：显示只读缩略卡；source：保留源码块。")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({ compact: "只读缩略卡", source: "显示源码" })
					.setValue(this.plugin.settings.livePreview)
					.onChange(async (value) => {
						await this.plugin.updateSettings({
							livePreview: value === "source" ? "source" : "compact",
						});
					})
			);

		new Setting(containerEl)
			.setName("外观主题")
			.setDesc("auto 跟随 Obsidian；mubu-dark 使用幕布暗色令牌。")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({ auto: "跟随 Obsidian", "mubu-dark": "幕布暗色" })
					.setValue(this.plugin.settings.theme)
					.onChange(async (value) => {
						await this.plugin.updateSettings({
							theme: value === "mubu-dark" ? "mubu-dark" : "auto",
						});
					})
			);

		new Setting(containerEl)
			.setName("重建索引")
			.setDesc("重新扫描全库的 ```zaptrace 题卡。")
			.addButton((button) =>
				button.setButtonText("立即重建").onClick(async () => {
					await this.plugin.rebuildIndex();
				})
			);
	}
}
