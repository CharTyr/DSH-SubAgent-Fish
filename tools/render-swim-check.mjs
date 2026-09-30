#!/usr/bin/env node
/**
 * Prove the SHIPPED bundle's fish actually swim — in a browser, without DSH.
 *
 * `tools/render-preview.mjs` captures the bundle's markup as a still image, so
 * it can never answer "does it move?". This page does: it loads the real
 * `lib/client.js` as the DSH client loader would, calls `apply()` against a fake
 * client context, renders the two registered components into the DOM, and then
 * simply gets out of the way — the fish engine's own requestAnimationFrame loop
 * takes over, exactly as it does inside DSH.
 *
 * The only stand-in is React: the components need `createElement` / `useMemo` /
 * `useSyncExternalStore`, none of which care about the animation. Everything
 * the animation depends on — the engine, the SVG it emits, the `fish-swim` +
 * `data-fish-id` hooks the loop scans for — is the shipped bytes.
 *
 * Output is a local scratch page (see .gitignore); screenshot it twice at
 * different times and diff the pixels to confirm motion.
 *
 * Usage:  node tools/render-swim-check.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = readFileSync(join(ROOT, 'lib/client.js'), 'utf8')
const css = (() => {
  // The plugin injects its stylesheet through document.head.appendChild; this
  // pulls the same text out of the shipped bundle so the page is styled by it.
  const match = /const FISH_CSS = `([\s\S]*?)`\n/.exec(bundle)
  if (match === null) throw new Error('cannot find FISH_CSS in the built bundle')
  return match[1]
})()

const page = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>swim check</title>
<style>
html,body{margin:0;background:#16161a;font-family:-apple-system,"PingFang SC",sans-serif;color:#e8e8ec}
.wrap{padding:22px}
h2{font-size:13px;font-weight:400;color:#8b8b93;margin:0 0 12px}
.strip{display:flex;gap:10px;align-items:center;margin-bottom:26px}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 4px;border-radius:999px;border:1px solid #34343c;background:#1f1f25;font-size:12px}
.card{max-width:420px;border:1px solid #2c2c33;border-radius:10px;padding:14px}
${css}
</style></head>
<body><div class="wrap">
  <h2>D · 右侧栏子代理标签（插件真实输出，由引擎自身的循环驱动）</h2>
  <div class="strip" id="tabs"></div>
  <h2>E · better-sidebar 子代理页</h2>
  <div class="card" id="page"></div>
</div>

<script>
/* --- 最小 React 替身：动画完全不依赖它 --- */
var React = {
  Fragment: Symbol('fragment'),
  createElement: function (type, props) {
    var children = Array.prototype.slice.call(arguments, 2);
    return { type: type, props: Object.assign({}, props || {}, {
      children: children.length <= 1 ? children[0] : children }) };
  },
  useMemo: function (f) { return f() },
  useRef: function (i) { return { current: i } },
  useState: function (i) { return [typeof i === 'function' ? i() : i, function () {}] },
  useEffect: function () {},
  useSyncExternalStore: function (_s, get) { return get() },
};

/* --- 模块加载器替身：只负责抓住 factory --- */
var captured = { exports: null };
window.__ModuleLoader__ = { load: function (entry) {
  captured.exports = entry.factory(function (id) {
    if (id === 'react') return React;
    throw new Error('unexpected require: ' + id);
  });
} };

/* --- 把 React 元素树建进 DOM --- */
function toDom(node) {
  if (node === null || node === undefined || node === false) return null;
  if (typeof node === 'string' || typeof node === 'number') return document.createTextNode(String(node));
  if (Array.isArray(node)) {
    var frag = document.createDocumentFragment();
    node.forEach(function (child) { var built = toDom(child); if (built) frag.appendChild(built); });
    return frag;
  }
  if (typeof node.type === 'function') return toDom(node.type(node.props || {}));
  if (node.type === React.Fragment) return toDom(node.props.children);
  var el = document.createElement(node.type);
  Object.keys(node.props).forEach(function (key) {
    var value = node.props[key];
    if (key === 'children' || key === 'dangerouslySetInnerHTML') return;
    if (value === null || value === undefined || value === false) return;
    if (key.indexOf('on') === 0) return;
    if (key === 'style' && typeof value === 'object') {
      Object.keys(value).forEach(function (property) {
        el.style.setProperty(property.indexOf('--') === 0 ? property
          : property.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase() }), value[property]);
      });
      return;
    }
    if (key === 'className') { el.className = String(value); return; }
    el.setAttribute(key, String(value));
  });
  if (node.props.dangerouslySetInnerHTML) { el.innerHTML = node.props.dangerouslySetInnerHTML.__html; return el; }
  var kids = toDom(node.props.children);
  if (kids) el.appendChild(kids);
  return el;
}
</script>

<script>${bundle}</script>

<script>
/* --- 和 tools/test-client.mjs 同一份夹具：真实形状的会话列表 --- */
var now = Date.now();
var list = {
  byId: {
    root: { id: 'root', displayTitle: '主会话 · 做一个 DSH 小鱼插件', running: true },
    'c-docs': { id: 'c-docs', displayTitle: '子代理 · 调研 DSH 插件开发文档', parentId: 'root', origin: 'subagent', running: true },
    'c-docs-1': { id: 'c-docs-1', displayTitle: '抓取 slots 章节', parentId: 'c-docs', origin: 'subagent', running: false },
    'c-install': { id: 'c-install', displayTitle: '把插件装进 web profile', parentId: 'root', origin: 'subagent', running: false },
  },
  projectionsBySession: {
    root: { state: 'ready', error: null, values: { subagentCatalog: [
      { id: 'c-docs', createdAt: now - 214000, mode: 'continuable', label: '调研 DSH 插件开发文档' },
      { id: 'c-install', createdAt: now - 96000, mode: 'one-shot', label: '把插件装进 web profile' },
    ] } },
    'c-docs': { state: 'ready', error: null, values: { subagentCatalog: [
      { id: 'c-docs-1', createdAt: now - 12000, mode: 'one-shot', label: '抓取 slots 章节' },
    ] } },
  },
};

var slots = {};
var betterTab = null;
captured.exports.apply({
  effect: function (fn) { fn() },
  slots: {
    inject: function (key, callback) { slots[key] = callback().component; return function () {} },
    register: function (spec, component) { return { spec: spec, component: component } },
  },
  inject: function (services, callback) {
    if (services.indexOf('betterSidebar') === -1) return;
    callback({ effect: function (fn) { fn() },
      betterSidebar: { registerTab: function (descriptor) { betterTab = descriptor; return function () {} } } });
  },
});

var Title = slots['sidebar.right.pane.tab.title'];
var tabs = [
  { title: '调研文档', child: 'c-docs', running: true },
  { title: '安装插件', child: 'c-install', running: false },
];
var strip = document.getElementById('tabs');
tabs.forEach(function (tab) {
  var pill = document.createElement('span');
  pill.className = 'pill';
  pill.appendChild(toDom(Title({
    useTabInfo: function () { return { tab: { title: tab.title, contentId: 'dsh-resource://subagentchat/session/' + tab.child } } },
    useSessionStatus: function (selector) { var m = new Map(); m.set(tab.child, { running: tab.running }); return selector(m) },
  })));
  strip.appendChild(pill);
});

document.getElementById('page').appendChild(toDom(betterTab.component({
  ctx: { sessions: { list: { getSnapshot: function () { return list }, subscribe: function () { return function () {} } } } },
  scope: { sessionId: 'c-docs-1' },
})));

/* 让页面自己报告：引擎认出了几条会游的鱼，鱼身路径有没有随时间变化。
   写进 DOM 是为了能用 --dump-dom 读出来，不靠猜。 */
var probe = document.createElement('div');
probe.id = 'probe';
document.body.appendChild(probe);
var samples = [];

function tick() {
  var live = Array.prototype.slice.call(document.querySelectorAll('svg.fish-swim[data-fish-id]'));
  var ids = live.map(function (el) { return el.dataset.fishId });
  var body = live[0] && live[0].querySelector('.fish-body');
  samples.push(body ? body.getAttribute('d').slice(0, 48) : '');
  probe.textContent = JSON.stringify({
    animatedFish: live.length,
    distinctGeoms: ids.filter(function (v, i) { return ids.indexOf(v) === i }).length,
    hasRaf: typeof requestAnimationFrame === 'function',
    pathChanges: samples.filter(function (v, i) { return i > 0 && v !== samples[i - 1] }).length,
    samples: samples.length,
    first: samples[0],
    last: samples[samples.length - 1],
  });
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
</script>
</body></html>
`

writeFileSync(join(ROOT, 'preview/swim-check.html'), page)
console.log(`wrote preview/swim-check.html (${page.length} bytes)`)
