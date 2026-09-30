window.__ModuleLoader__.load({
	id: "dsh-subagent-fish",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let React = require("react");

// ---- src/fish/engine.js ----
// GENERATED FILE — do not edit.
// Produced by tools/sync-engine.mjs from the MaiWork production engine:
//   /Volumes/Somemore/projects/MaiWork/plugin/CharTyr_MaiWork/maiwork/console/static/js/fish.js
//   /Volumes/Somemore/projects/MaiWork/prototype/fish-patterns/markings.js
// Run `node tools/sync-engine.mjs` to regenerate.

// MaiWork 网页 · 程序生成的小鱼头像。
// 同一个种子永远画出同一条鱼：一整块圆润纯色 + 一对白色眼睛，透明底、不带影子，默认像真鱼一样游（见文件末尾）。
// 做法：按鱼种在轮廓上撒点（身体、尾巴、鳍），各点随机偏一点，再用平滑曲线连成一圈。

const FISH_COLORS = [
  "#5CC87A", "#F0A03C", "#EE6C33", "#8B5CF0", "#6E6E73", "#52B8A4",
  "#3F7CF2", "#1FA3F5", "#F2609A", "#F2B92B", "#9BC63B", "#FF8A70",
  "#5A5FD6", "#2FC4B2", "#B98150", "#B18CF5", "#E84B5A", "#4BA3C7",
];
// 颜色的中文名（定制时读屏 / 提示用），和上面一一对应
const FISH_COLOR_NAMES = [
  "草绿", "橙", "橘红", "紫", "灰", "青绿",
  "蓝", "天蓝", "粉", "金黄", "黄绿", "珊瑚",
  "靛蓝", "碧绿", "棕", "淡紫", "红", "湖蓝",
];

// 字符串 → 32 位整数（cyrb53 的简化版），再喂给 mulberry32 做可复现的随机数。
function hashSeed(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

function rng(seed) {
  let a = hashSeed(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let patternSerial = 0;
const PI = Math.PI;
const TOP = 1.5 * PI;   // 背（y 向下，角度顺时针：0 = 鼻尖，π/2 = 肚子，π = 尾巴，3π/2 = 背）
const BOTTOM = 0.5 * PI;

// 每个鱼种：给出身体、尾巴、鳍、眼睛位置的参数范围。u(lo, hi) 取随机值，ok(p) 按概率。
const SPECIES = {
  pebble: { name: "圆圆鱼", make: (u, ok) => ({
    a: u(30, 34), b: u(27, 31), taper: u(0, 0.1), tailW: 0.3,
    tail: { type: "fork", L: u(13, 17), S: u(11, 14) },
    fins: ok(0.6) ? [{ at: TOP + u(-0.2, 0.1), h: u(0.1, 0.16), w: 0.3 }] : [],
    eye: { t: -0.55, k: 0.55 } }) },
  classic: { name: "小鲫鱼", make: (u, ok) => ({
    a: u(36, 40), b: u(21, 25), taper: u(0.1, 0.2), tailW: 0.28,
    tail: { type: "fork", L: u(17, 22), S: u(13, 16) },
    fins: [{ at: TOP - u(0, 0.25), h: u(0.22, 0.3), w: 0.26 }, ...(ok(0.5) ? [{ at: BOTTOM + 0.3, h: 0.16, w: 0.2 }] : [])],
    eye: { t: -0.45, k: 0.6 } }) },
  eel: { name: "长条鳗", make: (u) => ({
    a: u(42, 48), b: u(12, 14.5), n: 2.4, taper: u(0.05, 0.15), tailW: 0.55,
    tail: { type: "round", L: u(11, 14), S: u(11, 13) }, fins: [],
    wave: { amp: u(3, 5), ph: u(0, 2 * PI) },
    eye: { t: -0.35, k: 0.45 } }) },
  disc: { name: "神仙鱼", make: (u) => ({
    a: u(22, 26), b: u(26, 30), taper: u(0, 0.12), tailW: 0.3,
    tail: { type: "fan", L: u(11, 14), S: u(11, 14) },
    fins: [{ at: TOP - u(0.05, 0.25), h: u(0.4, 0.55), w: 0.22 }, { at: BOTTOM + u(0.05, 0.25), h: u(0.35, 0.5), w: 0.22 }],
    eye: { t: -0.6, k: 0.5 } }) },
  drop: { name: "水滴鱼", make: (u, ok) => ({
    a: u(32, 36), b: u(24, 28), taper: u(0.38, 0.5), tailW: 0.24,
    tail: { type: "spade", L: u(13, 17), S: u(7, 9) },
    fins: ok(0.4) ? [{ at: TOP + 0.2, h: 0.12, w: 0.3 }] : [],
    eye: { t: -0.55, k: 0.5 } }) },
  goldfish: { name: "金鱼", make: (u) => ({
    a: u(25, 29), b: u(23, 26), taper: u(0.05, 0.15), tailW: 0.34,
    tail: { type: "fan", L: u(22, 27), S: u(21, 26) },
    fins: [{ at: TOP - u(0, 0.2), h: u(0.22, 0.32), w: 0.28 }],
    eye: { t: -0.55, k: 0.55 } }) },
  puffer: { name: "河豚", make: (u) => ({
    a: u(28, 31), b: u(28, 31), taper: 0, tailW: 0.24,
    tail: { type: "fork", L: u(8, 10), S: u(7, 9) },
    ripple: { s: u(0.08, 0.12), k: Math.round(u(11, 15)) }, fins: [],
    eye: { t: -0.7, k: 0.42 } }) },
  sunfish: { name: "翻车鱼", make: (u) => ({
    a: u(30, 33), b: u(26, 29), taper: u(0, 0.1), tailW: 0.8,
    tail: { type: "none", L: u(9, 12), S: u(17, 20) },
    fins: [{ at: TOP - u(0.4, 0.55), h: u(0.5, 0.62), w: 0.2 }, { at: BOTTOM + u(0.4, 0.55), h: u(0.5, 0.62), w: 0.2 }],
    eye: { t: -0.6, k: 0.5 } }) },
  shark: { name: "小鲨", make: (u) => ({
    a: u(42, 46), b: u(16, 19), taper: u(0.12, 0.2), tailW: 0.22,
    tail: { type: "shark", L: u(20, 24), S: u(16, 19) },
    fins: [{ at: TOP + u(-0.05, 0.1), h: u(0.75, 0.9), w: 0.13 }, { at: BOTTOM - 0.25, h: 0.35, w: 0.12 }],
    eye: { t: -0.33, k: 0.6 } }) },
  betta: { name: "斗鱼", make: (u) => ({
    a: u(24, 27), b: u(17, 20), taper: u(0.05, 0.15), tailW: 0.45,
    tail: { type: "ribbon", L: u(27, 32), S: u(14, 17) },
    fins: [{ at: TOP - u(0.25, 0.4), h: u(0.6, 0.8), w: 0.34 }, { at: BOTTOM + u(0.25, 0.4), h: u(0.6, 0.8), w: 0.34 }],
    eye: { t: -0.45, k: 0.55 } }) },
  angler: { name: "灯笼鱼", make: (u) => ({
    a: u(30, 33), b: u(25, 28), n: 2.2, taper: u(0.3, 0.4), tailW: 0.3,
    tail: { type: "round", L: u(11, 13), S: u(9, 11) }, fins: [],
    lure: { reach: u(0.75, 0.95), lift: u(0.9, 1.1) },
    eye: { t: -0.4, k: 0.52 } }) },
  boxfish: { name: "箱鲀", make: (u) => ({
    a: u(29, 33), b: u(22, 25), n: 4, taper: u(0, 0.08), tailW: 0.32,
    tail: { type: "round", L: u(11, 13), S: u(9, 11) }, fins: [],
    eye: { t: -0.5, k: 0.55 } }) },
};

const FISH_SPECIES = Object.fromEntries(Object.entries(SPECIES).map(([k, v]) => [k, v.name]));

// 尾巴的点（相对尾巴根 xr、中线 0），顺时针：从下往上。
function tailPoints(t, xr) {
  const { L, S } = t;
  const P = (fx, fy) => [xr - L * fx, S * fy];
  switch (t.type) {
    case "fork": return [P(0.95, 1), P(0.5, 0.05), P(0.95, -1)];
    case "fan": return [P(0.65, 1), P(1, 0.5), P(0.82, 0), P(1, -0.5), P(0.65, -1)];
    case "round": return [P(0.55, 0.85), P(1, 0), P(0.55, -0.85)];
    case "spade": return [P(0.45, 0.6), P(1, 0), P(0.45, -0.6)];
    case "none": return [P(0.4, 0.75), P(0.7, 0.3), P(0.45, 0), P(0.7, -0.3), P(0.4, -0.75)];
    case "shark": return [P(0.7, 0.75), P(0.35, 0), P(1, -1.1)];
    case "ribbon": return [P(0.35, 1.25), P(0.95, 1.05), P(1.1, 0.25), P(0.9, -0.45), P(0.5, -1.05)];
    default: return [];
  }
}

function build(spec) {
  const { a, b, n = 2, taper = 0, tailW, fins = [], ripple } = spec;
  const e = 2 / n;
  const sp = (v) => Math.sign(v) * Math.abs(v) ** e;
  const P = (th, withFins = true) => {
    const c = Math.cos(th), s = Math.sin(th);
    let f = 1;
    if (withFins) for (const fin of fins) f += fin.h * Math.exp(-(((th - fin.at) / fin.w) ** 2));
    if (ripple) f += ripple.s * (0.5 + 0.5 * Math.cos(ripple.k * th)) ** 3;
    return [a * sp(c) * f, b * sp(s) * (1 + taper * c) * f];
  };
  const N = 26, pts = [];
  for (let i = 0; i <= N; i++) pts.push(P((PI - tailW) * (i / N)));
  const bot = P(PI - tailW), top = P(PI + tailW);
  pts.push(...tailPoints(spec.tail, Math.min(bot[0], top[0])));
  for (let i = 0; i < N; i++) pts.push(P(PI + tailW + (PI - tailW) * (i / N)));
  const eyeP = P(spec.eye.t, false);
  const eye = [eyeP[0] * spec.eye.k + a * 0.12, eyeP[1] * spec.eye.k];
  let lure = null;
  if (spec.lure) {
    const root = P(2 * PI - 0.95, false);
    lure = { root, tip: [a * spec.lure.reach + 4, -b * spec.lure.lift - 6] };
  }
  return { pts, eye, lure };
}

// 闭合的 Catmull-Rom 平滑曲线 → 三次贝塞尔路径。
function smoothPath(pts, digits = 1) {
  const n = pts.length, f = (v) => v.toFixed(digits);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}

// 眼睛的神态。每个 draw(ev) 画一只眼（以 (0,0) 为中心），wink 返回 [前眼, 后眼]。
const f1 = (v) => v.toFixed(1);
const slash = (len, lean, w = 4.6) => {
  const dx = (Math.sin(lean) * len) / 2, dy = (Math.cos(lean) * len) / 2;
  return `<line x1="${f1(-dx)}" y1="${f1(-dy)}" x2="${f1(dx)}" y2="${f1(dy)}" fill="none" stroke-width="${w}"/>`;
};
const arc = (w, h, sw = 3.6) => `<path d="M${f1(-w)} ${f1(h / 2)}Q0 ${f1(-h * 1.3)} ${f1(w)} ${f1(h / 2)}" fill="none" stroke-width="${sw}"/>`;
const DEG = PI / 180;
const EYES = {
  slash:   { name: "斜眼",   weight: 6, draw: (ev) => slash(ev(7.5, 9.5), -ev(12, 22) * DEG) },
  upright: { name: "直眼",   weight: 2, draw: (ev) => slash(ev(7.5, 9.5), ev(-3, 3) * DEG) },
  lean:    { name: "反斜",   weight: 1, draw: (ev) => slash(ev(7.5, 9), ev(12, 20) * DEG) },
  big:     { name: "大眼",   weight: 1, draw: (ev) => slash(ev(10.5, 12), -ev(8, 16) * DEG, 5.6) },
  tiny:    { name: "小眼",   weight: 1, draw: (ev) => slash(ev(4.5, 5.5), -ev(5, 15) * DEG, 4) },
  dots:    { name: "圆点",   weight: 2, draw: (ev) => `<circle r="${f1(ev(3.1, 3.7))}" stroke="none"/>` },
  beads:   { name: "椭圆",   weight: 1, draw: (ev) => `<ellipse rx="${f1(ev(2.4, 2.8))}" ry="${f1(ev(4, 4.8))}" stroke="none"/>` },
  happy:   { name: "笑眼",   weight: 2, draw: (ev) => arc(ev(3.2, 3.8), ev(3, 3.6)) },
  sleepy:  { name: "困",     weight: 1, draw: (ev) => `<path d="M-3 -0.6Q0 ${f1(ev(2.6, 3.2))} 3 -0.6" fill="none" stroke-width="3.2"/>` },
  flat:    { name: "眯眼",   weight: 1, draw: (ev) => `<line x1="-2.4" y1="0" x2="2.4" y2="0" fill="none" stroke-width="3.6"/>` },
  wink:    { name: "眨眼",   weight: 1, draw: (ev) => [slash(ev(7.5, 9), -ev(12, 20) * DEG), arc(3.2, 3)] },
};
const FISH_EYES = Object.fromEntries(Object.entries(EYES).map(([k, v]) => [k, v.name]));

function eyeTraits(seed, opts = {}) {
  const E = rng(`${seed}#eyes`);
  const total = Object.values(EYES).reduce((n, e) => n + e.weight, 0);
  let x = E() * total, eyes = "slash";
  for (const [k, e] of Object.entries(EYES)) { if ((x -= e.weight) < 0) { eyes = k; break; } }
  if (opts.eyes && EYES[opts.eyes]) eyes = opts.eyes;
  return { eyes, E };
}

// 定制的鱼（管理员在设置 → 专岗里挑的）：种子末尾是 c-<鱼种>-<颜色序号>-<眼神>-<底子>，
// 例如 agent:news:c-shark-3-dots-ab12。底子决定鳍的大小、歪头这些细节；
// 鱼身的随机数只看「前缀 + 底子」，所以只换颜色 / 眼神时鱼的样子不变。
const CUSTOM_RE = /(^|:)c-([a-z]+)-(\d{1,2})-([a-z]+)-([A-Za-z0-9_]{0,10})$/;
const FISH_BASE_RE = /^[A-Za-z0-9_]{0,10}$/;
function parseCustom(seed) {
  const s = String(seed == null ? "" : seed);
  const m = s.match(CUSTOM_RE);
  if (!m || !SPECIES[m[2]] || !EYES[m[4]] || Number(m[3]) >= FISH_COLORS.length) return null;
  return { species: m[2], color: Number(m[3]), eyes: m[4], base: m[5], baseSeed: s.slice(0, m.index + m[1].length) + m[5] };
}
const customSeed = ({ species, color, eyes, base = "" }) => `c-${species}-${Number(color) || 0}-${eyes}-${base}`;

// 种子 → 鱼的特征（种类、颜色等），不画图。opts.species / opts.eyes 可以指定（预览用）。
function fishTraits(seed, opts = {}) {
  const c = parseCustom(seed);
  const base = c ? c.baseSeed : seed;
  const R = rng(base);
  const keys = Object.keys(SPECIES);
  let species;
  if (c) { R(); species = c.species; }   // 照样抽一次，和没定制时同一串随机数，原样保存不变样
  else species = opts.species && SPECIES[opts.species] ? opts.species : keys[Math.floor(R() * keys.length)];
  if (c && opts.species && SPECIES[opts.species]) species = opts.species;
  let color = FISH_COLORS[Math.floor(R() * FISH_COLORS.length)];
  if (c) color = FISH_COLORS[c.color];
  const { eyes } = eyeTraits(base, c && !opts.eyes ? { ...opts, eyes: c.eyes } : opts);
  return { species, name: SPECIES[species].name, color, eyes, eyeName: EYES[eyes].name, R, base, custom: !!c };
}

function fishSvg(seed, opts = {}) {
  const { species, color, R, base, custom } = fishTraits(seed, opts);
  const c = custom ? parseCustom(seed) : null;
  const eyeOpts = c && !opts.eyes ? { ...opts, eyes: c.eyes } : opts;
  const u = (lo, hi) => lo + (hi - lo) * R();
  const ok = (p) => R() < p;
  const spec = SPECIES[species].make(u, ok);
  let { pts, eye, lure } = build(spec);

  // 长条鱼身体带一点波浪
  if (spec.wave) {
    const fq = (2 * PI) / (spec.a * 1.7);
    const wv = (p) => [p[0], p[1] + spec.wave.amp * Math.sin(p[0] * fq + spec.wave.ph)];
    pts = pts.map(wv); eye = wv(eye);
  }
  // 整体稍微歪一点头
  const rot = u(-8, 8) * (PI / 180), cr = Math.cos(rot), sr = Math.sin(rot);
  const rt = (p) => [p[0] * cr - p[1] * sr, p[0] * sr + p[1] * cr];
  pts = pts.map(rt); eye = rt(eye);
  if (lure) lure = { root: rt(lure.root), tip: rt(lure.tip) };

  // 缩放进 100×100 的画布，居中
  const all = lure ? [...pts, [lure.tip[0] + 5, lure.tip[1] - 5], [lure.tip[0] - 5, lure.tip[1] + 5]] : pts;
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const sc = Math.min(84 / (maxx - minx), 76 / (maxy - miny));
  const tx = 50 - ((minx + maxx) / 2) * sc, ty = 50 - ((miny + maxy) / 2) * sc;
  const T = (p) => [p[0] * sc + tx, p[1] * sc + ty];
  pts = pts.map(T);

  // 眼睛：白色、大小固定（不随鱼身缩放），像同一家族；神态另用一串随机数，换眼神不影响鱼身
  const f = (v) => v.toFixed(1);
  const [ex, ey] = T(eye);
  const { eyes: eyeStyle, E } = eyeTraits(base, eyeOpts);
  const ev = (lo, hi) => lo + (hi - lo) * E();
  const gap = ev(9, 11.5) * (eyeStyle === "dots" || eyeStyle === "beads" ? 0.95 : 1);
  const one = EYES[eyeStyle].draw(ev);
  const drawn = eyeStyle === "wink" ? [one[0], one[1]] : [one, one];
  const deg = (rot * 180) / PI;
  const place = (x, y, g) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)})">${g}</g>`;
  const e2 = [ex - gap * cr, ey - gap * sr];
  const eyesSvg = place(ex, ey, drawn[0]) + place(e2[0], e2[1], drawn[1]);

  const size = opts.size || 64;
  let lureSvg = "";
  if (lure) {
    const r0 = T(lure.root), r1 = T(lure.tip);
    const mid = [(r0[0] + r1[0]) / 2 - 2, Math.min(r0[1], r1[1]) - 6];
    lureSvg = `<path d="M${f(r0[0])} ${f(r0[1])}Q${f(mid[0])} ${f(mid[1])} ${f(r1[0])} ${f(r1[1])}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/><circle cx="${f(r1[0])}" cy="${f(r1[1])}" r="4.2" fill="${color}"/>`;
  }
  const label = opts.title ? `<title>${String(opts.title).replace(/[<&>"]/g, "")}</title>` : "";

  // 游动用的几何：每个轮廓点离鱼头多远（0 = 鼻尖，1 = 尾巴尖），往哪边摆（垂直于鱼身）。
  const ax = [cr, sr], nrm = [-sr, cr];
  const along = (p) => p[0] * ax[0] + p[1] * ax[1];
  const ss = pts.map(along), sHead = Math.max(...ss), sTail = Math.min(...ss), span = sHead - sTail || 1;
  const M = rng(`${base}#swim`);   // 节奏另用一串随机数，不影响鱼身；每条鱼快慢、起步不同
  const geom = {
    markings: makeMarkings(opts.pattern || 'none', `${base}#${opts.patternSeed ?? ''}`, {pts, ax, n: nrm}),
    strength: Math.max(0, Math.min(1, Number(opts.strength ?? .55))),
    pts, ts: ss.map((s) => (sHead - s) / span), n: nrm, eyeT: (sHead - along([ex, ey])) / span,
    sHead, span, ax,
    style: SWIM[species] || SWIM.classic, cx: 50, cy: 50,
    beat: 0.9 + M() * 0.35, bob: 2.8 + M() * 1.4, surge: 5.5 + M() * 3, lag: M() * 20,
  };
  const id = opts.still ? 0 : registerSwim(`${seed}|${opts.species || ""}|${opts.eyes || ""}|${opts.pattern || "none"}|${opts.patternSeed ?? ""}|${opts.strength ?? .55}`, geom);
  if (id) startSwimLoop();
  const clipId = `pattern-clip-${++patternSerial}`;
  const marksSvg = geom.markings.length ? `<defs><clipPath id="${clipId}"><path class="fish-clip" d="${smoothPath(pts)}"/></clipPath></defs><g clip-path="url(#${clipId})" opacity="${geom.strength}">${geom.markings.map(m => `<path class="fish-mark" d="${smoothPath(m.pts)}" fill="${m.light ? '#fff' : '#172d3c'}"/>`).join("")}</g>` : "";
  return `<svg class="fish${id ? " fish-swim" : ""}"${id ? ` data-fish-id="${id}"` : ""} viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="${opts.title ? "false" : "true"}">${label}`
    + `<g class="fish-bob">`
    + (lureSvg ? `<g class="fish-head">${lureSvg}</g>` : "")
    + `<path class="fish-body" d="${smoothPath(pts)}" fill="${color}"/>`
    + marksSvg
    + `<g class="fish-head" fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">${eyesSvg}</g>`
    + `</g></svg>`;
}

// ---------------------------------------------------------------------------
// 游动：不是整块晃，而是像真鱼一样——一道波从头传到尾，鱼头几乎不动、越往尾巴摆得越大；
// 时快时慢（摆几下、再滑行一会儿），游快时尾巴摆得更大；身体随上浮下沉微微抬头低头。
// 不同鱼种游法不同：长条鳗整条身子扭，箱鲀、河豚、翻车鱼只有尾巴扑腾。
// amp 尾巴摆幅（画布单位）、pow 摆幅从头到尾的增长曲线、waves 身上同时有几成波、hz 每秒摆几次。
const SWIM = {
  pebble:   { amp: 3.6, pow: 2.2, waves: 0.55, hz: 1.5 },
  classic:  { amp: 4.2, pow: 2.0, waves: 0.6,  hz: 1.3 },
  eel:      { amp: 4.2, pow: 1.0, waves: 1.15, hz: 1.0 },
  disc:     { amp: 3.0, pow: 2.6, waves: 0.5,  hz: 1.2 },
  drop:     { amp: 4.2, pow: 2.4, waves: 0.6,  hz: 1.4 },
  goldfish: { amp: 3.8, pow: 2.4, waves: 0.6,  hz: 1.0 },
  puffer:   { amp: 2.6, pow: 4.0, waves: 0.4,  hz: 2.2 },
  sunfish:  { amp: 2.4, pow: 3.5, waves: 0.4,  hz: 0.9 },
  shark:    { amp: 4.0, pow: 1.8, waves: 0.7,  hz: 1.0 },
  betta:    { amp: 4.6, pow: 2.2, waves: 0.8,  hz: 0.8 },
  angler:   { amp: 3.2, pow: 2.6, waves: 0.55, hz: 1.2 },
  boxfish:  { amp: 2.6, pow: 4.0, waves: 0.4,  hz: 2.0 },
};

// 某一时刻（秒）的姿态。纯函数：同一条鱼同一时刻永远一样，方便测试。
function swimPose(g, time) {
  const t = time + g.lag, st = g.style, TAU = 2 * PI;
  // 时快时慢：速度在 0.45～1.55 倍之间慢慢起伏；相位是速度的积分，所以变速是连续的，不会突然跳。
  const W = TAU / g.surge, c = 0.55;
  const phase = TAU * st.hz * g.beat * (t + (c * Math.sin(W * t)) / W);
  const effort = 0.5 + 0.5 * Math.cos(W * t);          // 1 = 正在用力游，0 = 滑行
  const A = st.amp * (0.45 + 0.55 * effort);
  const env = (u) => 0.05 + 0.95 * u ** st.pow;
  const sway = (u) => env(u) * A * Math.sin(phase - st.waves * TAU * u);
  const pts = g.pts.map((p, i) => {
    const w = sway(g.ts[i]);
    return [p[0] + g.n[0] * w, p[1] + g.n[1] * w];
  });
  const hw = sway(g.eyeT);
  // 上浮下沉 + 抬头低头（上浮时鼻尖微微朝上），用力游时往前送一点
  const b = (TAU * t) / g.bob;
  const y = 1.8 * Math.sin(b), pitch = 2.2 * Math.cos(b), x = 0.9 * (effort - 0.5);
  return {
    d: smoothPath(pts, 2),
    markings: g.markings.map(m => smoothPath(m.pts.map(p => {
      const u = Math.max(0, Math.min(1, (g.sHead - (p[0] * g.ax[0] + p[1] * g.ax[1])) / g.span));
      const w = sway(u);
      return [p[0] + g.n[0] * w, p[1] + g.n[1] * w];
    }), 2)),
    head: `translate(${(g.n[0] * hw).toFixed(2)} ${(g.n[1] * hw).toFixed(2)})`,
    body: `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${pitch.toFixed(2)} ${g.cx} ${g.cy})`,
  };
}

const SWIM_GEOMS = new Map();   // id → 几何
const SWIM_IDS = new Map();     // 种子 → id（同一条鱼只存一份）
function registerSwim(key, geom) {
  let id = SWIM_IDS.get(key);
  if (id == null) { id = SWIM_IDS.size + 1; SWIM_IDS.set(key, id); }
  SWIM_GEOMS.set(id, geom);
  return id;
}
const swimGeom = (id) => SWIM_GEOMS.get(Number(id));

// 全页一个动画循环：每 0.4 秒（或页面重画后）重新找一遍页面上会游的鱼；连续一阵子找不到就停，下次画鱼再启动。
// 系统开了「减少动态效果」就不动；标签页在后台时浏览器自己会暂停。
let swimOn = false;
function startSwimLoop() {
  if (swimOn || typeof requestAnimationFrame !== "function" || typeof document === "undefined" || typeof document.querySelectorAll !== "function") return;
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  swimOn = true;
  let items = [], lastScan = -1e9, empty = 0;
  const tick = (now) => {
    // 页面重画后旧的鱼会被换掉：发现有鱼离开页面就立刻重找，不等 0.4 秒
    if (now - lastScan > 400 || items.some((x) => !x.body.isConnected)) {
      lastScan = now;
      items = [...document.querySelectorAll("svg.fish-swim[data-fish-id]")].map((el) => ({
        g: swimGeom(el.dataset.fishId), body: el.querySelector(".fish-body"), bob: el.querySelector(".fish-bob"),
        heads: [...el.querySelectorAll(".fish-head")],
        clip: el.querySelector(".fish-clip"), marks: [...el.querySelectorAll(".fish-mark")],
      })).filter((x) => x.g && x.body);
      empty = items.length ? 0 : empty + 1;
      if (empty > 5) { swimOn = false; return; }
    }
    if (globalThis.fishPaused || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      requestAnimationFrame(tick); return;
    }
    const sec = now / 1000;
    for (const x of items) {
      const p = swimPose(x.g, sec);
      x.body.setAttribute("d", p.d);
      if (x.clip) x.clip.setAttribute("d", p.d);
      x.marks.forEach((mark, i) => mark.setAttribute("d", p.markings[i]));
      x.bob && x.bob.setAttribute("transform", p.body);
      for (const h of x.heads) h.setAttribute("transform", p.head);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}


// Procedural contours, not a library of preset pictures or fixed grids.
// Work in the actual fish's head–tail frame. Every point later shares its swim displacement.
function makeMarkings(pattern, seed, fish) {
  if (pattern === 'none') return [];
  const R = rng(`${seed}#${pattern}`), result = [];
  const u = (lo, hi) => lo + (hi - lo) * R();
  const count = (lo, hi) => Math.floor(u(lo, hi + 1));
  const light = R() < .38;
  const project = (p, axis) => p[0] * axis[0] + p[1] * axis[1];
  const xs = fish.pts.map(p => project(p, fish.ax));
  const ys = fish.pts.map(p => project(p, fish.n));
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const width = Math.max(...xs) - x0, height = Math.max(...ys) - y0;
  const world = ([x,y]) => {
    const a=x0+x*width, b=y0+y*height;
    return [fish.ax[0]*a+fish.n[0]*b, fish.ax[1]*a+fish.n[1]*b];
  };
  const outline = fish.pts.map(p => [(project(p,fish.ax)-x0)/width,(project(p,fish.n)-y0)/height]);
  const inside = ([x,y]) => {
    let yes=false;
    for(let i=0,j=outline.length-1;i<outline.length;j=i++) {
      const a=outline[i],b=outline[j];
      if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) yes=!yes;
    }
    return yes;
  };
  const polygon = (points, pale=light) => result.push({pts:points.map(world),light:pale});
  // A seeded smooth field supplies irregularity without frame-by-frame flickering.
  const field = () => {
    const phase=u(0,6.28), phase2=u(0,6.28), freq=u(.65,1.9), amplitude=u(.008,.04);
    return t => amplitude*(Math.sin(t*6.28*freq+phase)+.35*Math.sin(t*6.28*freq*2.3+phase2));
  };
  const centres = (wanted, spacing) => {
    const picked=[];
    const left=u(.18,.28), right=u(.64,.74), low=u(.2,.34), high=u(.67,.82);
    for(let attempt=0;attempt<1000 && picked.length<wanted;attempt++) {
      const p=[u(left,right),u(low,high)];
      if(inside(p) && picked.every(q=>Math.hypot((q[0]-p[0])*width,(q[1]-p[1])*height)>spacing)) picked.push(p);
    }
    return picked;
  };
  const blob = (p,rx,ry,angle,irregularity=0) => {
    const phase=u(0,6.28), lobes=count(2,5), cr=Math.cos(angle),sr=Math.sin(angle);
    return Array.from({length:24},(_,i)=>{
      const a=i/24*6.283185, r=1+irregularity*Math.sin(a*lobes+phase);
      const x=Math.cos(a)*rx*r, y=Math.sin(a)*ry*r;
      return [p[0]+cr*x-sr*y,p[1]+sr*x+cr*y];
    });
  };
  if(pattern==='spots' || pattern==='patches' || pattern==='rings') {
    const patches=pattern==='patches', rings=pattern==='rings';
    const wanted=patches?count(3,6):rings?count(4,9):count(7,19);
    for(const p of centres(wanted,patches?16:rings?12:u(6,10))) {
      const rx=patches?u(.075,.15):rings?u(.04,.065):u(.018,.05);
      const ry=rx*u(.6,1.35), angle=u(-1.2,1.2), noise=patches?u(.15,.4):u(.02,.15);
      const outer=blob(p,rx,ry,angle,noise);
      if(rings) {
        // Bridge a reversed inner contour to cut a true ring, not a filled dot.
        const ratio=u(.5,.72), inner=outer.map(q=>[p[0]+(q[0]-p[0])*ratio,p[1]+(q[1]-p[1])*ratio]).reverse();
        polygon([...outer,outer[0],inner[0],...inner,inner[0],outer[0]]);
      } else polygon(outer);
    }
  } else if(pattern==='stripes') {
    const n=count(2,5), start=u(.17,.27), end=u(.6,.73), tilt=u(-.2,.2);
    for(let i=0;i<n;i++) {
      const x=start+(end-start)*(i+.5)/n+u(-.025,.025), w=u(.028,.075), bend=field();
      const left=[],right=[];
      for(let j=0;j<=24;j++) {
        const y=-.15+j/24*1.3, at=x+tilt*(y-.5)+bend(y);
        const breadth=w*(.65+.35*Math.sin(j/24*Math.PI));
        left.push([at-breadth/2,y]);right.push([at+breadth/2,y]);
      }
      polygon([...left,...right.reverse()]);
    }
  } else if(pattern==='belly') {
    const level=u(.44,.7), slope=u(-.18,.18), bend=field();
    const boundary=Array.from({length:32},(_,i)=>{
      const x=-.15+i/31*1.3;
      return [x,level+slope*(x-.5)+bend(x)];
    });
    polygon([...boundary,[1.2,1.3],[-.2,1.3]],true);
  } else if(pattern==='scales') {
    // Deliberate negative space: a handful of large, separated crescents, never a grid.
    for(const p of centres(count(4,9),u(11,14))) {
      const rx=u(.048,.075),ry=u(.065,.11),thickness=u(.1,.19),arc=u(.72,1.16),angle=u(-.55,.55);
      const outer=[],inner=[],cr=Math.cos(angle),sr=Math.sin(angle);
      const point=(a,k)=>{
        const x=Math.cos(a)*rx*k,y=Math.sin(a)*ry*k;
        return [p[0]+cr*x-sr*y,p[1]+sr*x+cr*y];
      };
      for(let j=0;j<=12;j++) {
        const a=-arc+j/12*arc*2;
        outer.push(point(a,1));inner.push(point(a,1-thickness));
      }
      polygon([...outer,...inner.reverse()],true);
    }
  } else if(pattern==='ribbon' || pattern==='marble') {
    const marble=pattern==='marble', n=marble?count(3,6):count(1,2);
    const slope=u(-.24,.24),left=u(.02,.18),right=u(.7,.95);
    for(let i=0;i<n;i++) {
      const level=marble?u(.25,.8):u(.4,.65), w=marble?u(.009,.024):u(.045,.11);
      const bend=field(), top=[],bottom=[],phase=u(0,6.28);
      for(let j=0;j<=32;j++) {
        const t=j/32,x=left+(right-left)*t;
        const y=level+slope*(x-.5)+bend(x)*2;
        const thickness=w*(.3+.7*Math.sin(t*Math.PI))*(.85+.15*Math.sin(t*9+phase));
        top.push([x,y-thickness/2]);bottom.push([x,y+thickness/2]);
      }
      polygon([...top,...bottom.reverse()]);
    }
  }
  return result;
}

// ---- src/fish/identity.js ----
/**
 * Subagent → fish identity.
 *
 * One subagent is always the SAME fish: the identity is a pure function of the
 * agent's stable id, so reopening a session, reloading the page, or restarting
 * DSH redraws exactly the same creature. Nothing here is random at draw time.
 *
 * The pick is deliberately spread across every axis the engine exposes —
 * species, palette, eye style, body pattern and the per-fish random stream
 * that decides its silhouette — so a list of subagents reads as a shoal of
 * distinct individuals rather than one fish recoloured.
 */

/** Every body pattern the engine can draw, in menu order. */
const PATTERNS = ['none', 'spots', 'stripes', 'belly', 'scales', 'patches', 'ribbon', 'rings', 'marble']

/** Human-readable pattern names (zh-CN), for settings surfaces. */
const PATTERN_NAMES = {
  none: '纯色',
  spots: '斑点',
  stripes: '条纹',
  belly: '背腹双色',
  scales: '鳞片',
  patches: '色块',
  ribbon: '波纹',
  rings: '环斑',
  marble: '流线纹',
}

/** Species keys in engine-declaration order. */
const SPECIES_KEYS = Object.keys(FISH_SPECIES)
/** Eye-style keys in engine-declaration order. */
const EYE_KEYS = Object.keys(FISH_EYES)

/** FNV-1a, 32-bit: a small, stable string hash (never the platform's Math.random). */
function hash32(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: turns one 32-bit hash into a repeatable stream of picks. */
function stream(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Base36 text of exactly 10 safe characters — the shape the engine's seed grammar accepts. */
function baseToken(value) {
  return (value.toString(36) + '0000000000').slice(0, 10)
}

/**
 * The fish belonging to `id`.
 *
 * @param id - a subagent id (a session id, a tool-call id, or any stable label).
 *   The special id `main` is reserved for the top-level agent.
 * @param overrides - optional fields to force (`species`, `color`, `eyes`, `pattern`, `strength`).
 * @returns the identity, plus the engine seed string and the body colour.
 */
function fishIdentity(id, overrides = {}) {
  const key = String(id ?? '')
  const r = stream(hash32(key))
  // One extra draw keeps the stream aligned when a caller overrides a field,
  // so forcing the pattern never reshuffles the fish's body.
  const pick = (values, forced) => {
    const drawn = values[Math.floor(r() * values.length)]
    return forced !== undefined && forced !== null ? forced : drawn
  }
  const identity = {
    id: key,
    species: pick(SPECIES_KEYS, overrides.species),
    color: colorIndex(pick(FISH_COLORS.map((_, index) => index), overrides.color)),
    eyes: pick(EYE_KEYS, overrides.eyes),
    pattern: pick(PATTERNS, overrides.pattern),
    base: baseToken(hash32(`${key}#body`)),
    patternSeed: baseToken(hash32(`${key}#pattern`)),
    strength: overrides.strength ?? 0.34 + 0.34 * r(),
  }
  identity.seed = identitySeed(identity)
  identity.hex = FISH_COLORS[identity.color]
  return identity
}

function colorIndex(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(FISH_COLORS.length - 1, Math.trunc(n)))
}

/**
 * The engine seed that pins every axis of an identity.
 * @param identity - a {@link fishIdentity} result (or any object with the same fields).
 * @returns the `c-…` seed string `fishSvg` understands.
 */
function identitySeed(identity) {
  return customSeed({
    species: identity.species,
    color: identity.color,
    eyes: identity.eyes,
    base: identity.base,
  })
}

/**
 * A short human label for an identity's species and pattern, e.g. `鳗 · 斑点`.
 * @param identity - a {@link fishIdentity} result.
 * @returns the label.
 */
function identityLabel(identity) {
  const species = FISH_SPECIES[identity.species] ?? identity.species
  const pattern = PATTERN_NAMES[identity.pattern] ?? identity.pattern
  return `${species} · ${pattern}`
}

/**
 * The body colour the engine will actually paint, resolved from a seed.
 * @param seed - any seed string.
 * @returns a CSS colour.
 */
function seedHex(seed) {
  return fishTraits(seed).color
}

// ---- src/client/fish-avatar.js ----
// ---------------------------------------------------------------------------
// 小鱼头像：插件里唯一画鱼的地方。
//
// 鱼不是图片，是 fishSvg() 现场生成的 SVG 字符串；同一个 id 永远得到同一条鱼
// （见 ../fish/identity.js）。
//
// 游动交给画鱼引擎自己的全局循环：它每 0.4 秒扫一遍页面上的
// `svg.fish-swim[data-fish-id]`，统一驱动所有鱼的尾巴、花纹和裁剪轮廓。
// 所以这里只要把 SVG 放进 DOM 就行，不必自己开 requestAnimationFrame，
// 也不必关心组件何时卸载——节点一离开页面，循环下一轮就不会再动它。
//
// 本文件由 tools/build-client.mjs 与其它源码拼进 lib/client.js，共用同一个作用域。
// ---------------------------------------------------------------------------

/**
 * 挂在别人行上的那颗鱼多大（px）。想调大小就改这里 —— 它是唯一的一处。
 * 参照物：better-sidebar 的行里，标签 13px、状态点 7px、整行约 32px 高。
 */
const ROW_FISH_SIZE = 26

/** 注入样式用的 tag 标识（与 DSH 自己的插件同一套做法，便于去重）。 */
const FISH_CSS_TAG = 'dsh-subagent-fish/fish.css'

const FISH_CSS = `
.dsf-avatar {
  /* --dsf-size 是鱼本身的宽度；引擎把鱼画在 100×100 画布中央、占 84%，所以盒子取 1.16 倍 */
  --dsf-size: 24px;
  position: relative;
  flex: none;
  width: calc(var(--dsf-size) * 1.16);
  height: calc(var(--dsf-size) * 1.16);
  display: inline-grid;
  place-items: center;
  vertical-align: middle;
  transition: opacity .25s ease, filter .25s ease;
}
.dsf-avatar > svg { display: block; width: 100%; height: 100%; }
/* 状态只靠鱼自己的明暗表达，不额外加圈、不加底色 */
.dsf-avatar[data-state="done"] > svg { opacity: .85; }
.dsf-avatar[data-state="failed"] > svg { filter: saturate(.18); opacity: .5; }

/* 对比度兜底：只有当这条鱼的底色与它落座的面板底色对比度不足 3:1 时，
   才补一层极淡的反向轮廓。哪些鱼需要由 JS 按真实对比度算出来（见 haloNeed），
   不是按「看着暗」猜的——DSH 的调色板整体偏中间调，绝大多数鱼并不需要。 */
body[data-ds-dark-theme] .dsf-avatar[data-halo="on-dark"] > svg,
body[data-ds-dark-theme] .dsf-avatar[data-halo="both"] > svg {
  filter: drop-shadow(0 0 .7px rgba(255, 255, 255, .6)) drop-shadow(0 0 .7px rgba(255, 255, 255, .35));
}
body:not([data-ds-dark-theme]) .dsf-avatar[data-halo="on-light"] > svg,
body:not([data-ds-dark-theme]) .dsf-avatar[data-halo="both"] > svg {
  filter: drop-shadow(0 0 .7px rgba(0, 0, 0, .45));
}
/* 预览页用的强制描边开关 */
.dsf-avatar[data-rim="on"] > svg {
  filter: drop-shadow(0 0 .55px rgba(0, 0, 0, .8)) drop-shadow(0 0 .55px rgba(0, 0, 0, .5));
}
.dsf-chip { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
.dsf-chip > .dsf-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---- 挂在 better-sidebar 子代理行上的小鱼（E） ---- */
/* 行本身是 better-sidebar 渲染的，这里只负责那颗鱼：紧贴状态点左侧，
   尺寸跟着行的字号走，不改变行高。 */
.dsf-row-fish {
  display: inline-flex;
  align-items: center;
  flex: none;
  margin-right: 2px;
}
.dsf-row-fish > svg { display: block; width: ${ROW_FISH_SIZE}px; height: ${ROW_FISH_SIZE}px; }
.dsf-row-fish[data-dsf-state="done"] > svg { opacity: .8; }

.dsf-page { display: flex; flex-direction: column; gap: 10px; padding: 12px 10px; font-size: 13px; color: var(--dsw-alias-label-primary); }
.dsf-root { display: flex; align-items: center; gap: 9px; padding: 0 4px 10px; border-bottom: .5px solid var(--dsw-alias-border-l2); }
.dsf-root-body { display: flex; flex-direction: column; min-width: 0; }
.dsf-root-title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsf-root-sub { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.dsf-list { display: flex; flex-direction: column; }
.dsf-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 6px; border: 0; border-radius: var(--dsw-radius-md);
  background: transparent; font: inherit; color: inherit; text-align: left;
  cursor: pointer; min-width: 0;
}
.dsf-row:hover, .dsf-row:focus-visible { background: var(--dsw-alias-interactive-bg-hover); }
.dsf-row-body { display: flex; flex-direction: column; min-width: 0; }
.dsf-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsf-row-sub { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.dsf-empty { color: var(--dsw-alias-label-tertiary); font-size: 12px; margin: 4px 6px; }
`

/** 把样式挂到 <head>，重复调用只会有一个标签。 */
function installFishCss() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(FISH_CSS_TAG)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-subagent-fish'
  tag.dataset.pluginCss = FISH_CSS_TAG
  tag.textContent = FISH_CSS
  document.head.appendChild(tag)
}

/**
 * 小鱼实际会落座的两种面板底色，取自 DSH 主题：
 * 深色的 `bg-layer-2`（#2c2c2e）与浅色的 `bg-base`（#fff）。
 */
const SURFACE_ON_DARK = '#2c2c2e'
const SURFACE_ON_LIGHT = '#ffffff'
/** 图形元素相对背景的最低对比度（WCAG 1.4.11 对非文本内容的要求）。 */
const MIN_CONTRAST = 3

/** WCAG 相对亮度。 */
function relativeLuminance(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex))
  if (match === null) return undefined
  const value = Number.parseInt(match[1], 16)
  const channel = (raw) => {
    const c = raw / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255)
}

/** 两个相对亮度之间的 WCAG 对比度。 */
function contrastRatio(a, b) {
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 这条鱼需不需要补一层轮廓。
 *
 * 按**真实对比度**算：与深色面板、浅色面板分别比一次，低于 3:1 的那一侧
 * 才需要反向轮廓。DSH 的调色板整体偏中间调，所以多数鱼两侧都够；只有最暗的
 * 那几条（例如 #5A5FD6）在深色界面上会掉到 2.7:1。
 *
 * @param hex - 鱼的底色 `#rrggbb`。
 * @returns `'on-dark'` / `'on-light'` / `'both'` / `undefined`（不用处理）。
 */
function haloNeed(hex) {
  const luma = relativeLuminance(hex)
  if (luma === undefined) return undefined
  const onDark = contrastRatio(luma, relativeLuminance(SURFACE_ON_DARK)) < MIN_CONTRAST
  const onLight = contrastRatio(luma, relativeLuminance(SURFACE_ON_LIGHT)) < MIN_CONTRAST
  if (onDark && onLight) return 'both'
  if (onDark) return 'on-dark'
  if (onLight) return 'on-light'
  return undefined
}

/**
 * 同一条鱼的 SVG 只生成一次。
 *
 * 尺寸不进缓存键：SVG 是矢量的，显示多大由 CSS 决定，所以改尺寸不必重画。
 * 这也让「同一屏里重复出现的同一条鱼」共用同一段标记。
 */
const fishAvatarCache = new Map()

function fishAvatarMarkup(identity, animated = true) {
  const key = `${identity.seed}|${identity.pattern}|${identity.patternSeed}|${identity.strength}|${animated ? 'swim' : 'still'}`
  let markup = fishAvatarCache.get(key)
  if (markup === undefined) {
    markup = fishSvg(identity.seed, {
      size: 64,
      pattern: identity.pattern,
      patternSeed: identity.patternSeed,
      strength: identity.strength,
      // 只有正在跑的子代理才带游动标记。不带标记的鱼引擎完全看不见，
      // 也就永远不会动 —— 这比「动起来再冻住」省事，也不会留下半动的状态。
      still: !animated,
    })
    fishAvatarCache.set(key, markup)
  }
  return markup
}

/**
 * 一条鱼的动画开关由它对应的子代理状态决定：在跑就游，不在跑就静着。
 *
 * 这样「动」本身就是信息 —— 一眼能看出谁还在干活，而不是一屏都在扭。
 *
 * @param state - `'running'` 或其它（已结束 / 失败）。
 * @returns 是否让这条鱼游动。
 */
function shouldFishSwim(state) {
  return state === 'running'
}

/**
 * 告诉画鱼引擎「现在页面上有鱼了」。
 *
 * 引擎的循环连续 5 轮扫不到鱼就会自己停下（省电），而它只在 fishSvg() 被调用时
 * 才会重启。本插件把生成好的 SVG 缓存了起来，同一条鱼第二次出现时走缓存、
 * fishSvg 不会被调用 —— 于是切走再切回来、或者页面重画之后，循环已经停了却
 * 没人叫醒它，鱼就成了静止的。所以每次把鱼放进 DOM 后都显式叫一次。
 *
 * 重复调用是安全的：引擎自己用 swimOn 挡着，不会开出第二个循环。
 */
function ensureFishSwimming() {
  if (typeof startSwimLoop !== 'function') return
  ensureSwimHeartbeat()
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // 只说一次，免得刷屏；这条对排查「为什么不动」很关键。
    if (globalThis.__dsfMotionNotice !== true) {
      globalThis.__dsfMotionNotice = true
      console.info('[dsh-subagent-fish] 系统开启了「减少动态效果」，小鱼保持静止。')
    }
    return
  }
  startSwimLoop()
}

/**
 * 低频兜底：只要页面上还有该游的鱼，就保证循环是活的。
 *
 * 引擎的循环连续 5 轮扫不到鱼就会自己停下（省电），而它只在 fishSvg() 被调用时
 * 才重启；本插件缓存了生成好的 SVG，所以「原来全是静止的鱼、某个子代理突然开跑」
 * 这种情形下没人叫醒它。每 2 秒一次 querySelector 的代价可以忽略。
 */
let swimHeartbeat = null
function ensureSwimHeartbeat() {
  if (swimHeartbeat !== null || typeof setInterval !== 'function') return
  swimHeartbeat = setInterval(() => {
    if (typeof document === 'undefined') return
    if (document.querySelector('svg.fish-swim[data-fish-id]') !== null) ensureFishSwimming()
  }, 2000)
}

/**
 * 一个子代理的小鱼头像。
 *
 * @param props.id - 决定鱼的身份的稳定 id（子代理会话 id，或 `main`）。
 * @param props.size - 鱼本身的宽度，px；默认 24。
 * @param props.state - `running` / `done` / `failed`，只影响明暗，不影响鱼本身。
 * @param props.rim - `on` 时加一层极细描边（深色底上的深色鱼用）。
 */
function FishAvatar(props) {
  const { id, size = 24, state, rim, className } = props
  const identity = React.useMemo(() => fishIdentity(id), [id])
  const animated = shouldFishSwim(state)
  const html = React.useMemo(
    () => ({ __html: fishAvatarMarkup(identity, animated) }),
    [identity, animated],
  )
  const style = React.useMemo(() => ({ '--dsf-size': `${size}px` }), [size])
  // 挂上去之后再叫醒循环：缓存命中时 fishSvg 不会跑，只能靠这里。
  if (typeof React.useEffect === 'function') {
    React.useEffect(() => { if (animated) ensureFishSwimming() })
  }
  return React.createElement('span', {
    className: className === undefined ? 'dsf-avatar' : `dsf-avatar ${className}`,
    style,
    title: props.title === undefined ? identityLabel(identity) : props.title,
    'data-state': state,
    'data-halo': haloNeed(identity.hex),
    'data-rim': rim,
    dangerouslySetInnerHTML: html,
  })
}

// ---- src/client/subagent-tab-title.js ----
// ---------------------------------------------------------------------------
// D · 右侧栏的子代理标签
//
// DSH 把「每个标签的标题画什么」单独开了一个按类型分发的插槽
// （`sidebar.right.pane.tab.title`，keyed）。子代理对话的标签类型是
// `@deepseek-ai/dsh-client-ui-subagent`，而它自己**没有**占用这个插槽——
// 所以标签上写什么是我们说了算，而标签正文（真正的对话内容）一点都不用碰。
//
// 标签的地址形如 dsh-resource://subagentchat/session/<子会话 id>，
// 这个 id 就是那条鱼的身份来源：同一个子代理的标签，鱼永远是同一条。
//
// 本文件由 tools/build-client.mjs 拼进 lib/client.js，共用同一个作用域。
// ---------------------------------------------------------------------------

/** 子代理对话标签的类型 id（= dsh-client-ui-subagent 的注册 id）。 */
const SUBAGENT_CHAT_TAB_ID = '@deepseek-ai/dsh-client-ui-subagent'
/**
 * 标签上那颗鱼多大（px）。想调大小就改这里。
 * 标签本身约 28px 高、字 12px，所以别调太大。
 */
const TAB_FISH_SIZE = 20

/** 子代理对话地址的前缀；后半段就是子会话 id。 */
const SUBAGENT_CHAT_PREFIX = 'dsh-resource://subagentchat/session/'

/**
 * 从标签地址里取出子会话 id。
 * @param address - 标签的 contentId。
 * @returns 子会话 id；地址不是子代理对话时返回 undefined。
 */
function subagentSessionIdOf(address) {
  if (typeof address !== 'string' || !address.startsWith(SUBAGENT_CHAT_PREFIX)) return undefined
  const id = address.slice(SUBAGENT_CHAT_PREFIX.length)
  return id.length === 0 ? undefined : decodeURIComponent(id)
}

/**
 * 子代理标签的标题：小鱼 + 原来的名字。
 *
 * 地址不是子代理对话时原样返回标题 —— 这样即使 DSH 以后改了地址格式，
 * 最坏也只是没有鱼，不会把标签弄坏。
 */
function SubagentFishTabTitle(props) {
  const { useTabInfo, useSessionStatus } = props
  const info = useTabInfo()
  const tab = info.tab
  const childId = subagentSessionIdOf(tab.contentId)
  // 这个 hook 必须**无条件**调用：只有「prop 在不在」是稳定的，
  // 拿 childId 去决定调不调，会让同一个组件在两次渲染里 hook 数量不同。
  const hasStatus = typeof useSessionStatus === 'function'
  const running = hasStatus
    ? useSessionStatus((statuses) => childId !== undefined && statuses?.get?.(childId)?.running === true)
    : undefined
  if (childId === undefined) return tab.title
  return React.createElement(
    'span',
    { className: 'dsf-chip' },
    React.createElement(FishAvatar, { id: childId, size: TAB_FISH_SIZE, state: running === true ? 'running' : undefined }),
    React.createElement('span', { className: 'dsf-label' }, tab.title),
  )
}

// ---- src/client/better-sidebar-rows.js ----
// ---------------------------------------------------------------------------
// E · 把小鱼挂到 dsh-better-sidebar「任务管理」页已有的子代理行上
//
// 为什么是这种方式，而不是像原来那样注册一个新标签页：
//
//   - 那个页面是 better-sidebar 内置的 `subagent` 标签（中文名「任务管理」），
//     渲染的是它自己的 SubagentView，**每一行没有留任何扩展口**；
//   - 想用同 id 顶掉它也不行 —— 它的 registerTab 遇到重复 id 会直接抛错
//     （"tab type already registered"），内置标签走的是同一个注册表。
//
// 所以只剩一条路：等它把行渲染出来，再把鱼插进去。这是全插件唯一一处依赖
// 别人 DOM 的地方，因此写得尽量防守：
//
//   - 锚点用 role="treeitem" + aria-level 这组 ARIA 语义，而不是 CSS 类名；
//   - 必须同时找得到子代理行专有的标签元素才动手，所以不会误伤文件树等
//     别的 treeitem；
//   - 从行里的文字反查子代理 id，查不到就**什么都不做**，绝不猜；
//   - better-sidebar 升级把这套结构改掉时，最坏的结果是鱼不出现，
//     不会把它的页面弄坏。
//
// 本文件由 tools/build-client.mjs 拼进 lib/client.js，共用同一个作用域。
// ---------------------------------------------------------------------------

/** 子代理行的锚点：ARIA 树节点。 */
const SUBAGENT_ROW_SELECTOR = '[role="treeitem"][aria-level]'
/** 子代理行独有的标签元素（类名带内容哈希前缀，所以只匹配后缀）。 */
const SUBAGENT_LABEL_SELECTOR = '[class*="_subagentLabel"]'
/** 处理过的行打上这个标记，重复扫描不会插第二条。 */
const ROW_MARK = 'dsfFishId'
/** 连续多少次扫描一个子代理行都没找到，就彻底放弃（避免永远空转）。 */
const MAX_EMPTY_SCANS = 40

/**
 * 从会话列表里建「行文字 → 子代理 id」的索引。
 *
 * 命名规则与 better-sidebar 自己完全一致（entry.label → displayTitle → id），
 * 否则行里显示的名字和这里算出来的对不上，鱼就挂不上去。
 *
 * @param list - ctx.sessions.list 的快照。
 * @returns label → sessionId。
 */
function subagentIdsByLabel(list) {
  const byLabel = new Map()
  const projections = list?.projectionsBySession
  if (projections === null || typeof projections !== 'object') return byLabel
  for (const projection of Object.values(projections)) {
    const entries = projection?.values?.subagentCatalog
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      if (entry === null || typeof entry !== 'object' || typeof entry.id !== 'string') continue
      const summary = list.byId?.[entry.id]
      const label = entry.label ?? summary?.displayTitle ?? entry.id
      if (typeof label === 'string' && label.length > 0 && !byLabel.has(label)) {
        byLabel.set(label, entry.id)
      }
    }
  }
  return byLabel
}

/** 一条行对应的鱼该是什么状态。 */
function rowFishState(list, sessionId) {
  return list?.byId?.[sessionId]?.running === true ? 'running' : 'done'
}

/**
 * 装好这套「往行上挂鱼」的观察器。
 *
 * @param ctx - 客户端 cordis 上下文（只需要 ctx.sessions）。
 * @returns 卸载函数：断开观察、并把自己插进去的鱼收干净。
 */
function installSidebarRowFish(ctx) {
  const sessions = ctx.sessions
  // 少任何一个前提就安静地什么都不做。这一处是整个插件唯一碰别人 DOM 的地方，
  // 绝不能因为环境缺个 API 就把 apply() 抛出去 —— 那会连带 D 一起失效。
  if (sessions === undefined || sessions === null) return () => {}
  if (typeof document === 'undefined' || typeof MutationObserver !== 'function') return () => {}

  let pending = false
  let emptyScans = 0
  let disposed = false

  /** 扫描并给尚未挂鱼的行补上鱼。 */
  const decorate = () => {
    pending = false
    if (disposed) return
    const rows = document.querySelectorAll(`${SUBAGENT_ROW_SELECTOR}`)
    if (rows.length === 0) return
    const list = sessions.list.getSnapshot()
    const byLabel = subagentIdsByLabel(list)
    let touched = 0
    for (const row of rows) {
      const labelElement = row.querySelector(SUBAGENT_LABEL_SELECTOR)
      if (labelElement === null) continue
      const label = labelElement.textContent?.trim()
      if (label === undefined || label.length === 0) continue
      const sessionId = byLabel.get(label)
      // 查不到就不动它 —— 宁可少挂一条鱼，也不要挂错人。
      if (sessionId === undefined) continue
      const state = rowFishState(list, sessionId)
      const existing = row.querySelector('.dsf-row-fish')
      if (existing !== null) {
        // 行还在，但状态变了（开跑或跑完）：换掉这条鱼，让它开始 / 停止游动。
        if (existing.getAttribute('data-dsf-state') === state) continue
        existing.innerHTML = fishAvatarMarkup(fishIdentity(sessionId), shouldFishSwim(state))
        existing.setAttribute('data-dsf-state', state)
        touched += 1
        continue
      }
      const host = document.createElement('span')
      host.className = 'dsf-row-fish'
      host.setAttribute('data-dsf-state', state)
      host.innerHTML = fishAvatarMarkup(fishIdentity(sessionId), shouldFishSwim(state))
      row.insertBefore(host, row.firstChild)
      row.setAttribute(ROW_MARK, sessionId)
      touched += 1
    }
    if (touched > 0) {
      emptyScans = 0
      // 行是别的插件画的，它的重画会把鱼换掉；这里动完之后必须显式叫醒游动
      // 循环 —— 缓存命中时 fishSvg 不会跑，循环停了就没人重启它。
      // 只有真的挂了「该游的鱼」才需要叫。
      if (rows.length > 0) ensureFishSwimming()
      return
    }
    // 没有任何一行认得出来：可能是这个页面根本没打开，也可能 better-sidebar
    // 换了结构。数够次数就停，不长期占着观察器。
    const anyMarked = document.querySelector(`[${ROW_MARK}]`) !== null
    if (!anyMarked && ++emptyScans > MAX_EMPTY_SCANS) observer.disconnect()
  }

  /** 合并同一轮里的多次 DOM 变动。 */
  const schedule = () => {
    if (pending || disposed) return
    pending = true
    queueMicrotask(decorate)
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })

  // 会话列表本身的变化（跑完 / 新起子代理）也要跟着刷新状态。
  const unsubscribe = typeof sessions.list.subscribe === 'function'
    ? sessions.list.subscribe(schedule)
    : () => {}
  schedule()

  return () => {
    disposed = true
    observer.disconnect()
    unsubscribe()
    for (const row of document.querySelectorAll(`[${ROW_MARK}]`)) {
      row.querySelector('.dsf-row-fish')?.remove()
      row.removeAttribute(ROW_MARK)
    }
  }
}

// ---- src/client/index.js ----
// ---------------------------------------------------------------------------
// 插件浏览器侧入口。
//
// 只做两件事，都是「加」而不是「换」：
//
//   D · 右侧栏的子代理对话标签上画该子代理的小鱼
//       （sidebar.right.pane.tab.title，按标签类型分发；DSH 自己没占这个位置）
//   E · 往 dsh-better-sidebar「任务管理」页已有的子代理行上挂小鱼
//       （它没留行级扩展口，同 id 接管又会抛错，所以只能在渲染出来的行上挂 ——
//         详见 better-sidebar-rows.js 的说明）
//
// 没有主机侧逻辑：鱼的身份是子代理 id 的纯函数，数据也都在客户端已有的会话列表里。
//
// 本文件由 tools/build-client.mjs 拼进 lib/client.js。
// ---------------------------------------------------------------------------

/** 这条插件用到的客户端服务。betterSidebar 是可选依赖，单独探测。 */
const inject = ['slots', 'sessions']

/**
 * 装 D：子代理对话标签的小鱼。
 * @param ctx - 客户端 cordis 上下文。
 */
function registerSubagentTabTitles(ctx) {
  ctx.effect(
    () => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab.title',
      key: SUBAGENT_CHAT_TAB_ID,
    }, SubagentFishTabTitle)),
    'subagent-fish: subagent chat tab titles',
  )
}

/**
 * 装 E：往 better-sidebar 的子代理行上挂鱼。
 *
 * 用 ctx.inject 等 betterSidebar 服务出现再动手——没装 better-sidebar 时这段
 * 永远不执行，D 照常工作，其余功能一点不受影响。
 *
 * @param ctx - 客户端 cordis 上下文。
 */
function registerSidebarRows(ctx) {
  ctx.inject(['betterSidebar'], (scope) => {
    scope.effect(() => installSidebarRowFish(scope), 'subagent-fish: sidebar subagent rows')
  })
}

/**
 * 插件主体：装样式，然后挂上 D 与 E。
 * @param ctx - 客户端 cordis 上下文。
 */
function apply(ctx) {
  installFishCss()
  registerSubagentTabTitles(ctx)
  registerSidebarRows(ctx)
}


		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
