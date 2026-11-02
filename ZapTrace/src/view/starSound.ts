/**
 * 星标点击音效（DESIGN-v3.2 §3.2）：本地 Web Audio 单 oscillator，
 * 失败静默、不阻塞、不抛错。
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
	try {
		const ctor =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!ctor) return null;
		if (!ctx) ctx = new ctor();
		if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
		return ctx;
	} catch {
		return null;
	}
}

/** 一次极短「嗒」声；任何失败静默。 */
export function playStarClick(): void {
	try {
		const ac = getCtx();
		if (!ac) return;
		const t = ac.currentTime;
		const osc = ac.createOscillator();
		const gain = ac.createGain();
		osc.type = "triangle";
		osc.frequency.setValueAtTime(880, t);
		osc.frequency.exponentialRampToValueAtTime(660, t + 0.05);
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(0.08, t + 0.004);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
		osc.connect(gain).connect(ac.destination);
		osc.start(t);
		osc.stop(t + 0.07);
	} catch {
		/* 静默 */
	}
}

/** 插件卸载时释放 AudioContext（失败忽略）。 */
export function closeStarSound(): void {
	try {
		if (ctx) {
			void ctx.close().catch(() => undefined);
			ctx = null;
		}
	} catch {
		/* 静默 */
	}
}
