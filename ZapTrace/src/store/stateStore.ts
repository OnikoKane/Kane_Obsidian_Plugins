import type { ZaptraceData, ZaptraceSettings } from "../core/types.ts";
import { createDefaultData, migrateData, type MigrationResult } from "../core/state.ts";

/**
 * data.json 的唯一读写入口（DESIGN §9）。
 *
 * - 读：load() → 迁移/校验 → 内存数据
 * - 写：markDirty() 防抖 350ms 保存；flush() 立即落盘
 * - 迁移前备份到插件目录
 * - 只读模式（版本过新/结构损坏）下绝不写盘
 */

export interface DataAdapter {
	load(): Promise<unknown>;
	save(data: unknown): Promise<void>;
	backup(name: string, content: string): Promise<void>;
}

export class StateStore {
	data: ZaptraceData;
	readOnly = false;
	issues: string[] = [];
	private readonly adapter: DataAdapter;
	private readonly pluginVersion: string;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private dirty = false;
	private saving: Promise<void> | null = null;
	/** 写入版本号：保证保存过程中新产生的改动不会被误清 dirty */
	private revision = 0;

	constructor(adapter: DataAdapter, pluginVersion: string) {
		this.adapter = adapter;
		this.pluginVersion = pluginVersion;
		this.data = createDefaultData(pluginVersion);
	}

	async load(): Promise<MigrationResult> {
		const raw = await this.adapter.load();
		const result = migrateData(raw, this.pluginVersion);
		this.data = result.data;
		this.readOnly = result.readOnly;
		this.issues = result.issues;

		if (result.migrated && raw !== null && raw !== undefined) {
			try {
				const name = `data.backup-v${result.fromVersion}-${Date.now()}.json`;
				await this.adapter.backup(name, JSON.stringify(raw, null, 2));
			} catch (error) {
				console.error("[ZapTrace] 迁移备份失败", error);
			}
			await this.saveNow();
		}
		return result;
	}

	updateSettings(next: ZaptraceSettings): void {
		if (this.readOnly) return;
		this.data.settings = { ...next };
		this.markDirty();
	}

	/** 标记需要保存（防抖）。只读模式下丢弃写入。 */
	markDirty(): void {
		if (this.readOnly) return;
		this.revision++;
		this.dirty = true;
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.timer = null;
			void this.saveNow();
		}, 350);
	}

	async flush(): Promise<void> {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (this.dirty) await this.saveNow();
	}

	async saveNow(): Promise<void> {
		if (this.readOnly) return;
		if (this.saving) {
			await this.saving;
		}
		const revisionAtStart = this.revision;
		this.data.meta.pluginVersion = this.pluginVersion;
		this.saving = (async () => {
			try {
				await this.adapter.save(this.data);
				// 保存期间若有新改动（revision 变化），保持 dirty 以便下一轮再写
				if (this.revision === revisionAtStart) {
					this.dirty = false;
				} else {
					this.dirty = true;
				}
			} catch (error) {
				// 保存失败：保持 dirty=true，允许后续 flush/下轮重试（REVIEW-implementation §4）
				this.dirty = true;
				console.error("[ZapTrace] 保存 data.json 失败，保留 dirty 以便重试", error);
			} finally {
				this.saving = null;
			}
		})();
		await this.saving;
	}
}
