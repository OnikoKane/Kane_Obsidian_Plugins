/**
 * 独立验收补充测试（reviewer 自建，不属于开发实现的测试集）。
 *
 * 目的：在开发 tests/ 之外，用不同的边界用例独立复核 H1/H2 去重、筛选日期边界、
 * CRLF、深层嵌套围栏、迁移默认版本、练习门禁与 Star 初始值等易回归点。
 * 运行：npm.cmd test（会被 tests/**\/*.test.ts 一并执行）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { scanZaptraceBlocks, parseBlockInner } from "../../src/core/parse.ts";
import { buildIndex } from "../../src/core/index.ts";
import { migrateData, createDefaultData, ensureQuestionFromCard, setStar } from "../../src/core/state.ts";
import { matchesFilter, emptyFilter } from "../../src/core/filter.ts";
import { PracticeSession } from "../../src/core/practice.ts";
import type { QuestionCard } from "../../src/core/types.ts";

function cardMd(idLine: string | null, stem: string, answer: string, extra: string[] = []): string {
  const lines = ["```zaptrace"];
  if (idLine) lines.push(idLine);
  for (const e of extra) lines.push(e);
  lines.push("### 题干", stem, "### 答案", answer, "```");
  return lines.join("\n");
}

test("REVIEW-A [H1] 跨文件同文重复题：两张卡、状态键不同、与文件顺序无关", () => {
  const same = cardMd(null, "同一道题", "答");
  const i1 = buildIndex([
    { path: "a.md", content: same },
    { path: "b.md", content: same },
  ]);
  const i2 = buildIndex([
    { path: "b.md", content: same },
    { path: "a.md", content: same },
  ]);
  assert.equal(i1.cards.length, 2);
  assert.equal(new Set(i1.cards.map((c) => c.qid)).size, 2, "两张卡 qid 必须不同");
  assert.notEqual(i1.cards[0].key, i1.cards[1].key, "索引键必须不同");

  // 与输入顺序无关：按 key 映射 qid 必须一致
  const m1 = new Map(i1.cards.map((c) => [c.key, c.qid]));
  const m2 = new Map(i2.cards.map((c) => [c.key, c.qid]));
  for (const [key, qid] of m1) assert.equal(m2.get(key), qid, `key ${key} 的 qid 跨输入顺序应一致`);
  // a.md 字典序在前 → 持有原始 qid；b.md 被确定性加后缀
  assert.match(m1.get("a.md#0")!, /^auto:[0-9a-f]{12}$/);
  assert.match(m1.get("b.md#0")!, /^auto:[0-9a-f]{12}-[0-9a-f]{6}$/);
});

test("REVIEW-B 时间筛选边界：今天到期 / 已到期 / 7 天内 互不重叠", () => {
  const today = "2026-11-02";
  const data = createDefaultData("0.1.0");
  const card: QuestionCard = {
    key: "x.md#0", blockIndex: 0, qid: "x", explicitId: "x", duplicateId: false,
    subject: "s", tags: [], source: "", difficulty: null,
    type: "short", options: [], correct: [], pdf: "", extra: {},
    starInitial: false, stem: "题", answer: "答", notes: "", aiNotes: "",
    file: "x.md", line: 1, endLine: 5, errors: [], stemHash: "0123456789ab",
  };
  ensureQuestionFromCard(data, card, "2026-11-02T00:00:00+08:00");

  const at = (due: string | null) => {
    data.questions.x.due = due;
    return {
      today: matchesFilter(card, data.questions.x, { ...emptyFilter(), time: "today" }, today),
      overdue: matchesFilter(card, data.questions.x, { ...emptyFilter(), time: "overdue" }, today),
      week: matchesFilter(card, data.questions.x, { ...emptyFilter(), time: "week" }, today),
      unrated: matchesFilter(card, data.questions.x, { ...emptyFilter(), time: "unrated" }, today),
    };
  };
  // 昨天 → 只算已到期
  assert.deepEqual(at("2026-11-01"), { today: false, overdue: true, week: false, unrated: false });
  // 今天 → 只算今天到期，不算已到期
  assert.deepEqual(at(today), { today: true, overdue: false, week: false, unrated: false });
  // today+7 → 属于 7 天内
  assert.deepEqual(at("2026-11-09"), { today: false, overdue: false, week: true, unrated: false });
  // today+8 → 不属于 7 天内
  assert.deepEqual(at("2026-11-10"), { today: false, overdue: false, week: false, unrated: false });
  // 无排期 → 未练
  assert.deepEqual(at(null), { today: false, overdue: false, week: false, unrated: true });
});

test("REVIEW-C CRLF 行尾不应污染题干/答案", () => {
  const md = ["```zaptrace", "id: crlf", "### 题干", "题面行", "### 答案", "答案行", "```"].join("\r\n");
  const cards = scanZaptraceBlocks("crlf.md", md).cards;
  assert.equal(cards.length, 1);
  assert.equal(cards[0].stem.trim(), "题面行");
  assert.equal(cards[0].answer.trim(), "答案行");
  assert.ok(!cards[0].stem.includes("\r"));
});

test("REVIEW-D 外层 5 反引号套内层 4 反引号代码块不截断", () => {
  const lines = [
    "`````zaptrace",
    "id: nest-5",
    "---",
    "### 题干",
    "题",
    "### 答案",
    "````ts",
    "const x = 1;",
    "````",
    "`````",
  ];
  const cards = scanZaptraceBlocks("nest.md", lines.join("\n")).cards;
  assert.equal(cards.length, 1);
  assert.match(cards[0].answer, /const x = 1/);
  assert.match(cards[0].answer, /````ts/);
  assert.equal(cards[0].qid, "nest-5");
});

test("REVIEW-E 缺 schemaVersion 视作版本 1，不迁移也不只读", () => {
  const r = migrateData({ questions: {} }, "0.1.0");
  assert.equal(r.migrated, false);
  assert.equal(r.readOnly, false);
  assert.equal(r.structurallyInvalid, false);
  assert.equal(r.data.schemaVersion, 1);
});

test("REVIEW-F 练习门禁：重复 reveal 返回 false；评分后不可再评", () => {
  const card = scanZaptraceBlocks("p.md", cardMd("id: p1", "题", "答")).cards[0];
  const data = createDefaultData("0.1.0");
  const s = new PracticeSession([card]);
  assert.equal(s.reveal(), true);
  assert.equal(s.reveal(), false, "已揭晓后再次 reveal 应为 false");
  const r = s.rate(data, "good", { today: "2026-11-02", at: "2026-11-02T10:00:00+08:00", elapsedMs: 1 });
  assert.ok(r);
  assert.equal(s.rate(data, "easy", { today: "2026-11-02", at: "2026-11-02T10:00:01+08:00", elapsedMs: 1 }), null);
  assert.equal(data.reviewLog.length, 1, "只允许写一次 reviewLog");
});

test("REVIEW-G 头部 star 只是首次收录初始值，之后以 data.json 为准", () => {
  const card = scanZaptraceBlocks("s.md", cardMd("id: st1", "题", "答", ["star: true"])).cards[0];
  assert.equal(card.starInitial, true);
  const data = createDefaultData("0.1.0");
  let state = ensureQuestionFromCard(data, card, "2026-11-02T00:00:00+08:00");
  assert.equal(state.star, true);
  setStar(data, "st1", false);
  // 再次索引（ensure）不应把 star 重置回头部值
  state = ensureQuestionFromCard(data, card, "2026-11-02T01:00:00+08:00");
  assert.equal(state.star, false, "已取消收藏后重新索引不应复活");
});

test("REVIEW-H 自动 ID 只依赖题干：改答案/笔记/标签不换 qid", () => {
  const a = scanZaptraceBlocks("a.md", cardMd(null, "同一题干", "答案一", ["tags: 甲"])).cards[0];
  const b = scanZaptraceBlocks("b.md", cardMd(null, "同一题干", "答案二", ["tags: 乙"])).cards[0];
  assert.equal(a.qid, b.qid);
  assert.equal(a.stemHash, b.stemHash);
});
