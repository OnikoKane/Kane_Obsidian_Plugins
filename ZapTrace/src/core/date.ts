/**
 * 日期工具（纯函数，不依赖 Obsidian / moment）。
 *
 * DESIGN §8.3 要求「日历日」运算并禁止手写 `+86400000`。这里统一用
 * `Date.UTC(y, m-1, d + days)` 做日历分量运算 —— 只处理 YYYY-MM-DD 日期，
 * 不涉及时分秒，因此不受夏令时影响，结果与 `moment(date).add(days, "day")`
 * 一致；全部纯函数，可在 node:test 里直接覆盖跨月/跨年/闰年边界。
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateString(value: string | null | undefined): value is string {
	if (typeof value !== "string") return false;
	const match = DATE_RE.exec(value);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12 || day < 1 || day > 31) return false;
	const probe = new Date(Date.UTC(year, month - 1, day));
	return (
		probe.getUTCFullYear() === year &&
		probe.getUTCMonth() === month - 1 &&
		probe.getUTCDate() === day
	);
}

function pad2(value: number): string {
	return value < 10 ? `0${value}` : String(value);
}

export function formatUtcDate(date: Date): string {
	return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
		date.getUTCDate()
	)}`;
}

/** 在日期字符串上加 N 个日历日。 */
export function addDays(dateStr: string, days: number): string {
	if (!isValidDateString(dateStr)) {
		throw new Error(`addDays: 非法日期 ${String(dateStr)}`);
	}
	const [year, month, day] = dateStr.split("-").map(Number);
	const shifted = new Date(Date.UTC(year, month - 1, day + days));
	return formatUtcDate(shifted);
}

/** 设备本地时区的今天（YYYY-MM-DD）。 */
export function todayString(now: Date = new Date()): string {
	return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** 固定 Asia/Shanghai 的今天（dateMode = fixed）。 */
export function fixedTodayString(now: Date = new Date()): string {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return formatter.format(now);
}

/** 本地时区带偏移的 ISO 8601，例如 2026-11-02T14:10:33+08:00。 */
export function localIsoWithOffset(now: Date = new Date()): string {
	const offsetMinutes = -now.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const abs = Math.abs(offsetMinutes);
	const offset = `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
	return (
		`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}` +
		`T${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}${offset}`
	);
}

/** to - from 的天数差（只用于展示「N 天后」，不参与排期计算）。 */
export function diffDays(from: string, to: string): number {
	if (!isValidDateString(from) || !isValidDateString(to)) return 0;
	const [fy, fm, fd] = from.split("-").map(Number);
	const [ty, tm, td] = to.split("-").map(Number);
	const a = Date.UTC(fy, fm - 1, fd);
	const b = Date.UTC(ty, tm - 1, td);
	return Math.round((b - a) / 86400000);
}

/** 到期判定：due <= today（含今天）。 */
export function isDue(due: string | null | undefined, today: string): boolean {
	if (!isValidDateString(due)) return false;
	return due <= today;
}
