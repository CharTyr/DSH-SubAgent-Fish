// 本文件来自本仓库作者的 MaiWork 项目（prototype/fish-patterns/gif.js），原样复制，
// 只加了这段说明。作者即版权人，因此可以按本仓库的协议一并分发。
//
// 独立纯 JS GIF89a 编码器：无依赖、不联网、同步执行。它的正确性由原作者那侧的
// test-gif.mjs 保证 —— 那个测试自带一个逐块解析 + LZW 解码的 GIF 读取器，
// 会把编码结果反过来解一遍逐帧比对，不是只看文件头。
//
// tools/build-logo.mjs 用它把逐帧 RGBA 打成 logo.gif。

// gif.js — 独立纯 JS GIF89a 编码器。
// 无依赖、不联网、同步执行，可直接以 <script type="module"> 在浏览器内联使用。
//
//   import { encodeGif } from './gif.js';
//   const bytes = encodeGif({ width, height, frames, delay = 6, loop = 0 });
//
//   width/height  画布尺寸，整数 1..65535
//   frames        逐帧 Uint8ClampedArray RGBA，长度必须恰好 width*height*4
//   delay         每帧延迟，单位 1/100 秒（centisecond），整数 0..65535，默认 6
//   loop          循环次数：0 = 无限循环（默认）；null = 不写 Netscape 扩展（只播一次）
//   返回          完整 GIF 文件的 Uint8Array
//
// 颜色策略（按上层约定）：统计全部帧里 alpha >= 128 的 RGB 直方图，
// 最高频的 255 种颜色进入 8bit 全局调色板（index 0 保留为透明色，
// 透明像素指 alpha < 128）；其余低频色映射为调色板内平方距离最近
// 的颜色，并按颜色缓存结果。小鱼是有限平涂色，高频色逐位精确保留。

const U16MAX = 65535;

export function encodeGif({ width, height, frames, delay = 6, loop = 0 } = {}) {
  if (!Number.isInteger(width) || width < 1 || width > U16MAX) throw new RangeError('width must be an integer in 1..65535');
  if (!Number.isInteger(height) || height < 1 || height > U16MAX) throw new RangeError('height must be an integer in 1..65535');
  if (!Array.isArray(frames) || frames.length < 1) throw new TypeError('frames must be a non-empty array of Uint8ClampedArray');
  if (!Number.isInteger(delay) || delay < 0 || delay > U16MAX) throw new RangeError('delay must be an integer in 0..65535 centiseconds');
  if (!(loop === null || (Number.isInteger(loop) && loop >= 0 && loop <= U16MAX))) throw new RangeError('loop must be null or an integer in 0..65535');

  const npix = width * height;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (!(f instanceof Uint8ClampedArray) || f.length !== npix * 4) throw new TypeError(`frame ${i} must be a Uint8ClampedArray of width*height*4 bytes`);
  }

  // ---- 跨帧直方图，选最高频 255 种不透明颜色 ----
  const hist = new Map(); // rgb24 -> count（按插入顺序保持稳定名次）
  for (const f of frames) {
    for (let i = 0, o = 0; i < npix; i++, o += 4) {
      if (f[o + 3] >= 128) {
        const k = (f[o] << 16) | (f[o + 1] << 8) | f[o + 2];
        hist.set(k, (hist.get(k) || 0) + 1);
      }
    }
  }
  const colors = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255).map(e => e[0]);
  const nC = colors.length;
  const exact = new Map();
  const cr = new Uint8Array(nC), cg = new Uint8Array(nC), cb = new Uint8Array(nC);
  for (let i = 0; i < nC; i++) {
    const k = colors[i];
    cr[i] = k >> 16 & 255; cg[i] = k >> 8 & 255; cb[i] = k & 255;
    exact.set(k, i + 1);
  }
  const missCache = new Map();
  const nearest = k => {
    const r = k >> 16 & 255, g = k >> 8 & 255, b = k & 255;
    let best = 1, bd = Infinity;
    for (let i = 0; i < nC; i++) {
      const dr = r - cr[i], dg = g - cg[i], db = b - cb[i];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = i + 1; }
    }
    return best;
  };
  const indexOf = k => {
    let v = exact.get(k);
    if (v === undefined) { v = missCache.get(k); if (v === undefined) { v = nearest(k); missCache.set(k, v); } }
    return v;
  };

  const parts = [];
  // ---- Header + Logical Screen Descriptor（8bit 全局调色板，256 项）----
  parts.push(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, width & 255, width >> 8, height & 255, height >> 8, 0xF7, 0, 0]));
  const gct = new Uint8Array(768); // index 0 = 保留透明槽 [0,0,0]
  for (let i = 0; i < nC; i++) { const k = colors[i], o = (i + 1) * 3; gct[o] = k >> 16 & 255; gct[o + 1] = k >> 8 & 255; gct[o + 2] = k & 255; }
  parts.push(gct);
  // ---- Netscape 循环扩展（loop:null 时省略）----
  if (loop !== null) {
    parts.push(Uint8Array.from([0x21, 0xFF, 0x0B, 0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30, 0x03, 0x01, loop & 255, loop >> 8, 0x00]));
  }
  const dlo = delay & 255, dhi = delay >> 8;
  const idx = new Uint8Array(npix);
  for (const f of frames) {
    // RGBA -> 调色板索引（alpha < 128 -> 0 透明）
    for (let i = 0, o = 0; i < npix; i++, o += 4) idx[i] = f[o + 3] < 128 ? 0 : indexOf((f[o] << 16) | (f[o + 1] << 8) | f[o + 2]);
    // Graphic Control Extension：disposal=2（恢复背景），透明 index 0，逐帧 delay
    parts.push(Uint8Array.from([0x21, 0xF9, 0x04, 0x09, dlo, dhi, 0x00, 0x00]));
    // Image Descriptor（无局部调色板、不交错）
    parts.push(Uint8Array.from([0x2C, 0, 0, 0, 0, width & 255, width >> 8, height & 255, height >> 8, 0x00]));
    parts.push(Uint8Array.from([0x08])); // LZW minimum code size = 8
    const comp = lzwEncode(idx);
    for (let s = 0; s < comp.length; s += 255) { // 数据子块：每块 1..255 字节
      const n = Math.min(255, comp.length - s);
      parts.push(Uint8Array.from([n]));
      parts.push(comp.subarray(s, s + n));
    }
    parts.push(Uint8Array.from([0x00])); // 块终止
  }
  parts.push(Uint8Array.from([0x3B])); // trailer

  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// GIF LZW 压缩（变长码、LSB 在前）。码表用 Map 存「前缀码*256+下一索引」，
// 码长随表大小 9 -> 12 位增长。表达到 4095 项就发 clear 码重置：发出的码
// 恒小于 4096，clear 也总在双方码计数达到上限之前出现——严格实现 Kwirk
// 规则的解码器、把 clear 视为完全清空的解码器、以及在码宽边界上实现略有
// 差异的解码器都能安全解码。
function lzwEncode(indices) {
  const CLEAR = 256, EOI = 257, LIMIT = 4095;
  const bytes = new Uint8Array(indices.length * 2 + 16); // 码数不超过像素数+2，每码至多 12 位
  let n = 0, acc = 0, nbits = 0, size, codeSize, table;
  const emit = code => {
    acc |= code << nbits; nbits += codeSize;
    while (nbits >= 8) { bytes[n++] = acc & 255; acc >>>= 8; nbits -= 8; }
  };
  const reset = () => { table = new Map(); size = EOI + 1; codeSize = 9; };
  reset();
  emit(CLEAR);
  let pending = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = pending * 256 + k;
    const found = table.get(key);
    if (found !== undefined) { pending = found; continue; }
    emit(pending);
    if (size >= LIMIT) { emit(CLEAR); reset(); } else { table.set(key, size); size++; if (size > (1 << codeSize)) codeSize++; }
    pending = k;
  }
  emit(pending);
  emit(EOI);
  if (nbits > 0) bytes[n++] = acc & 255;
  return bytes.subarray(0, n);
}
