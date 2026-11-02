import { test } from "node:test";
import assert from "node:assert/strict";

import { StateStore, type DataAdapter } from "../src/store/stateStore.ts";
import { migrateData } from "../src/core/state.ts";

class FakeAdapter implements DataAdapter {
	saved: unknown[] = [];
	backups: string[] = [];
	raw: unknown;
	constructor(raw: unknown) {
		this.raw = raw;
	}
	async load(): Promise<unknown> {
		return this.raw;
	}
	async save(data: unknown): Promise<void> {
		this.saved.push(data);
	}
	async backup(name: string, _content: string): Promise<void> {
		this.backups.push(name);
	}
}

test("损坏数据 → 安全模式只读，且绝不写盘", async () => {
	const adapter = new FakeAdapter({ schemaVersion: 1, questions: "oops" });
	const store = new StateStore(adapter, "0.1.0");
	const result = await store.load();
	assert.equal(result.structurallyInvalid, true);
	assert.equal(store.readOnly, true);
	store.markDirty();
	await store.flush();
	assert.equal(adapter.saved.length, 0);
});

test("未来版本 → 只读，且绝不写盘", async () => {
	const adapter = new FakeAdapter({ schemaVersion: 99, questions: {} });
	const store = new StateStore(adapter, "0.1.0");
	const result = await store.load();
	assert.equal(result.readOnly, true);
	store.updateSettings({ ...store.data.settings, dailyReviewLimit: 5 });
	await store.flush();
	assert.equal(adapter.saved.length, 0);
	assert.equal(store.data.settings.dailyReviewLimit, 20);
});

test("schemaVersion 0 迁移前备份并落盘一次", async () => {
	const adapter = new FakeAdapter({
		schemaVersion: 0,
		questions: { q1: { step: 1, reviews: [] } },
		reviewLog: [],
	});
	const store = new StateStore(adapter, "0.1.0");
	const result = await store.load();
	assert.equal(result.migrated, true);
	assert.equal(adapter.backups.length, 1);
	assert.match(adapter.backups[0], /^data\.backup-v0-\d+\.json$/);
	assert.equal(adapter.saved.length, 1);
});

test("顶层 / 设置 / 单题 / meta 未知字段迁移后全部保留", () => {
	const raw = {
		schemaVersion: 1,
		extraTop: { a: 1 },
		settings: { theme: "auto", customFlag: true },
		questions: { q1: { step: 1, myNote: "keep", reviews: [] } },
		meta: { x: 1 },
		reviewLog: [],
	};
	const result = migrateData(raw, "0.1.0");
	const data = result.data as unknown as Record<string, unknown>;
	assert.deepEqual(data.extraTop, { a: 1 });
	assert.equal((data.settings as Record<string, unknown>).customFlag, true);
	const question = (data.questions as Record<string, Record<string, unknown>>).q1;
	assert.equal(question.myNote, "keep");
	assert.equal((data.meta as Record<string, unknown>).x, 1);
});

test("step 越界（手改 5 / -2）加载时钳制到 -1..4", () => {
	const result = migrateData(
		{
			schemaVersion: 1,
			questions: {
				high: { step: 5, reviews: [] },
				low: { step: -2, reviews: [] },
			},
		},
		"0.1.0"
	);
	assert.equal(result.data.questions.high.step, 4);
	assert.equal(result.data.questions.low.step, -1);
});

test("正常数据不会被误标只读", async () => {
	const adapter = new FakeAdapter({ schemaVersion: 1, questions: {}, reviewLog: [] });
	const store = new StateStore(adapter, "0.1.0");
	const result = await store.load();
	assert.equal(result.readOnly, false);
	assert.equal(result.structurallyInvalid, false);
	store.markDirty();
	await store.flush();
	assert.equal(adapter.saved.length, 1);
});

test("保存失败保持 dirty=true，下一次 flush 重试成功", async () => {
	let attempts = 0;
	const saved: unknown[] = [];
	const adapter: DataAdapter = {
		load: async () => ({ schemaVersion: 1, questions: {}, reviewLog: [] }),
		save: async (data) => {
			attempts++;
			if (attempts === 1) throw new Error("disk full");
			saved.push(data);
		},
		backup: async () => undefined,
	};
	const store = new StateStore(adapter, "0.1.0");
	await store.load();
	store.markDirty();

	// 第一次 flush：save 抛错 → 不应有成功保存，但 dirty 必须保留
	const originalError = console.error;
	console.error = () => undefined;
	try {
		await store.flush();
	} finally {
		console.error = originalError;
	}
	assert.equal(saved.length, 0);
	assert.equal(attempts, 1);

	// 第二次 flush：因为 dirty 仍为 true，应重试并成功
	await store.flush();
	assert.equal(saved.length, 1);
	assert.equal(attempts, 2);
});

test("保存过程中产生新改动时不会丢失 dirty", async () => {
	const release: { fn?: () => void } = {};
	let blockFirst = true;
	const saved: unknown[] = [];
	const adapter: DataAdapter = {
		load: async () => ({ schemaVersion: 1, questions: {}, reviewLog: [] }),
		save: async (data) => {
			saved.push(data);
			if (blockFirst) {
				blockFirst = false;
				await new Promise<void>((resolve) => {
					release.fn = resolve;
				});
			}
		},
		backup: async () => undefined,
	};
	const store = new StateStore(adapter, "0.1.0");
	await store.load();
	store.markDirty();
	const first = store.saveNow();
	store.markDirty(); // 保存进行中又有新改动
	release.fn?.();
	await first;
	await store.flush();
	assert.equal(saved.length, 2);
});
