/**
 * 纯 TypeScript SHA-1。
 *
 * 为什么不用 node:crypto：插件运行在 Obsidian 渲染进程，核心模块又要能在
 * node:test 中被直接导入；自带实现同时满足两边，且不引入任何运行时依赖。
 */

/** 对 UTF-8 文本计算 SHA-1，返回 40 位小写十六进制。 */
export function sha1Hex(input: string): string {
	const bytes = new TextEncoder().encode(input);
	const bitLength = bytes.length * 8;
	// 至少补一个 0x80，再补零到 56 mod 64，末尾 8 字节存位长
	const blockCount = Math.floor((bytes.length + 8) / 64) + 1;
	const buffer = new Uint8Array(blockCount * 64);
	buffer.set(bytes);
	buffer[bytes.length] = 0x80;

	const view = new DataView(buffer.buffer);
	// 64 位位长，拆成高低 32 位（大端）
	view.setUint32(buffer.length - 8, Math.floor(bitLength / 0x100000000), false);
	view.setUint32(buffer.length - 4, bitLength >>> 0, false);

	let h0 = 0x67452301;
	let h1 = 0xefcdab89;
	let h2 = 0x98badcfe;
	let h3 = 0x10325476;
	let h4 = 0xc3d2e1f0;

	const w = new Uint32Array(80);

	for (let offset = 0; offset < buffer.length; offset += 64) {
		for (let i = 0; i < 16; i++) {
			w[i] = view.getUint32(offset + i * 4, false);
		}
		for (let i = 16; i < 80; i++) {
			const n = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
			w[i] = ((n << 1) | (n >>> 31)) >>> 0;
		}

		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;
		let e = h4;

		for (let i = 0; i < 80; i++) {
			let f: number;
			let k: number;
			if (i < 20) {
				f = (b & c) | (~b & d);
				k = 0x5a827999;
			} else if (i < 40) {
				f = b ^ c ^ d;
				k = 0x6ed9eba1;
			} else if (i < 60) {
				f = (b & c) | (b & d) | (c & d);
				k = 0x8f1bbcdc;
			} else {
				f = b ^ c ^ d;
				k = 0xca62c1d6;
			}
			const temp =
				((((a << 5) | (a >>> 27)) >>> 0) + (f >>> 0) + e + k + w[i]) >>> 0;
			e = d;
			d = c;
			c = ((b << 30) | (b >>> 2)) >>> 0;
			b = a;
			a = temp;
		}

		h0 = (h0 + a) >>> 0;
		h1 = (h1 + b) >>> 0;
		h2 = (h2 + c) >>> 0;
		h3 = (h3 + d) >>> 0;
		h4 = (h4 + e) >>> 0;
	}

	return [h0, h1, h2, h3, h4]
		.map((value) => value.toString(16).padStart(8, "0"))
		.join("");
}
