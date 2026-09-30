#!/usr/bin/env node
/**
 * Exercise the row decorator against real markup, in a browser.
 *
 * The decorator is the one part of this plugin that reaches into another
 * plugin's DOM, so it needs a test that actually has a DOM. This page rebuilds
 * dsh-better-sidebar's subagent rows faithfully — copied from
 * `src/client/SubagentView.tsx`: `role="treeitem"` + `aria-level` on the row, a
 * state dot, and `subagentContent > subagentLabel + subagentSecondary` inside —
 * then loads the SHIPPED bundle and lets `apply()` decorate it.
 *
 * It also plants a decoy: a file-tree-shaped `role="treeitem"` with no subagent
 * label, which must NOT be touched.
 *
 * Reports through the DOM so `--dump-dom` can read the verdict.
 *
 * Usage:  node tools/render-rows-check.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = readFileSync(join(ROOT, 'lib/client.js'), 'utf8')

/** The three subagents the fake catalog will describe. */
const ROWS = [
  { id: 'c-docs', label: '调研 DSH 插件开发文档', secondary: '可续接 · 空闲', level: 1, running: true },
  { id: 'c-docs-1', label: '抓取 slots 章节', secondary: '一次性 · 空闲', level: 2, running: false },
  { id: 'c-install', label: '把插件装进 web profile', secondary: '一次性 · 空闲', level: 1, running: false },
]

const rowHtml = ROWS.map((row) => `
  <div class="wxwsGW_subagentNode">
    <div role="treeitem" tabindex="0" aria-level="${row.level}"
         aria-label="${row.label} ${row.secondary}"
         class="wxwsGW_subagentRow">
      <span class="wxwsGW_subagentDot"></span>
      <span class="wxwsGW_subagentContent">
        <span class="wxwsGW_subagentLabel">${row.label}</span>
        <span class="wxwsGW_subagentSecondary">${row.secondary}</span>
      </span>
    </div>
  </div>`).join('')

const page = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>row decorator check</title>
<style>
html,body{margin:0;background:#16161a;font-family:-apple-system,"PingFang SC",sans-serif;color:#e8e8ec}
.wrap{padding:20px;display:flex;gap:40px}
h2{font-size:13px;font-weight:400;color:#8b8b93;margin:0 0 10px}
.tree{min-width:320px}
/* 下面是 better-sidebar 那套结构的近似样式，只为看得清，不参与断言 */
.wxwsGW_subagentNode{margin:2px 0}
.wxwsGW_subagentRow{display:flex;align-items:flex-start;gap:6px;padding:6px 8px;border-radius:8px;cursor:pointer}
.wxwsGW_subagentRow:hover{background:#1f1f25}
.wxwsGW_subagentDot{width:7px;height:7px;border-radius:50%;background:#3ecf8e;flex:none;margin-top:7px}
.wxwsGW_subagentContent{display:flex;flex-direction:column;min-width:0}
.wxwsGW_subagentLabel{font-size:13px}
.wxwsGW_subagentSecondary{font-size:11px;color:#8b8b93}
[aria-level="2"]{margin-left:22px}
/* 诱饵：文件树的行 */
.wxwsGW_fileRow{display:flex;align-items:center;gap:6px;padding:6px 8px;font-size:13px;color:#9a9aa3}
</style></head>
<body><div class="wrap">
  <div class="tree">
    <h2>子代理行（应当被挂上鱼）</h2>
    <div role="tree" id="subagents">${rowHtml}</div>
  </div>
  <div class="tree">
    <h2>诱饵：文件树的行（必须原样不动）</h2>
    <div role="tree" id="files">
      <div role="treeitem" aria-level="1" class="wxwsGW_fileRow" aria-label="README.md">
        <span class="wxwsGW_fileName">README.md</span>
      </div>
      <div role="treeitem" aria-level="1" class="wxwsGW_fileRow" aria-label="src/">
        <span class="wxwsGW_fileName">src/</span>
      </div>
    </div>
  </div>
</div>
<div id="probe" style="padding:16px;font-size:12px;color:#8b8b93"></div>

<script>
var React = { Fragment: Symbol('f'), createElement: function (t, p) { return { type: t, props: Object.assign({}, p || {}, { children: Array.prototype.slice.call(arguments, 2) }) } },
  useMemo: function (f) { return f() }, useRef: function (i) { return { current: i } }, useState: function (i) { return [i, function () {}] },
  useEffect: function () {}, useSyncExternalStore: function (_s, g) { return g() } };
var captured = { exports: null };
window.__ModuleLoader__ = { load: function (e) { captured.exports = e.factory(function (id) {
  if (id === 'react') return React; throw new Error('unexpected require: ' + id); }); } };
</script>

<script>${bundle}</script>

<script>
var now = Date.now();
var list = {
  byId: {
    root: { id: 'root', displayTitle: '主会话', running: true },
    'c-docs': { id: 'c-docs', displayTitle: '子代理 · 调研 DSH 插件开发文档', parentId: 'root', origin: 'subagent', running: true },
    'c-docs-1': { id: 'c-docs-1', displayTitle: '抓取 slots 章节', parentId: 'c-docs', origin: 'subagent', running: false },
    'c-install': { id: 'c-install', displayTitle: '把插件装进 web profile', parentId: 'root', origin: 'subagent', running: false },
  },
  projectionsBySession: {
    root: { state: 'ready', error: null, values: { subagentCatalog: [
      { id: 'c-docs', createdAt: now - 200000, mode: 'continuable', label: '调研 DSH 插件开发文档' },
      { id: 'c-install', createdAt: now - 90000, mode: 'one-shot', label: '把插件装进 web profile' },
    ] } },
    'c-docs': { state: 'ready', error: null, values: { subagentCatalog: [
      { id: 'c-docs-1', createdAt: now - 10000, mode: 'one-shot', label: '抓取 slots 章节' },
    ] } },
  },
};
captured.exports.apply({
  effect: function (fn) { fn() },
  slots: { inject: function () { return function () {} }, register: function (s, c) { return { spec: s, component: c } } },
  inject: function (services, callback) {
    if (services.indexOf('betterSidebar') === -1) return;
    callback({ effect: function (fn) { fn() },
      betterSidebar: { registerTab: function () { return function () {} } },
      sessions: { list: { getSnapshot: function () { return list }, subscribe: function () { return function () {} } } } });
  },
});

setTimeout(function () {
  var subagentRows = document.querySelectorAll('#subagents [role="treeitem"][aria-level]');
  var decorated = document.querySelectorAll('#subagents .dsf-row-fish');
  var decoyRows = document.querySelectorAll('#files [role="treeitem"][aria-level]');
  var decoyTouched = document.querySelectorAll('#files .dsf-row-fish');
  var ids = Array.prototype.map.call(decorated, function (el) {
    return el.parentElement.getAttribute('dsfFishId') });
  document.getElementById('probe').textContent = JSON.stringify({
    subagentRows: subagentRows.length,
    decorated: decorated.length,
    fishIds: ids,
    decoyRows: decoyRows.length,
    decoyTouched: decoyTouched.length,
    animatedFish: document.querySelectorAll('svg.fish-swim[data-fish-id]').length,
  });
}, 120);
</script>
</body></html>
`

writeFileSync(join(ROOT, 'preview/rows-check.html'), page)
console.log(`wrote preview/rows-check.html (${page.length} bytes)`)
