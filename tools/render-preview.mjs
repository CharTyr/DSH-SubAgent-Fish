#!/usr/bin/env node
/**
 * Render the SHIPPED bundle to a static page, so the plugin's real DOM and its
 * real stylesheet can be looked at in a browser without booting DSH.
 *
 * This is not the mock preview (`preview/index.html`) — that one hand-draws what
 * the surfaces look like. This tool evaluates `lib/client.js` exactly as the DSH
 * client loader would, captures the stylesheet `apply()` injects and the two
 * components it registers, renders them against a realistic session list, and
 * serialises the resulting element tree to HTML.
 *
 * What it proves: the component tree, the CSS (sizes, spacing, states, tree
 * indentation) and the real fish SVG, as shipped.
 * What it does NOT prove: that DSH mounts the plugin and dispatches the slots —
 * only a DSH restart can show that. The fish here are static: the swim loop
 * lives in the engine and is exercised by `preview/index.html`.
 *
 * Usage:  node tools/render-preview.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const React = {
  Fragment: Symbol('react.fragment'),
  createElement: (type, props, ...children) => ({
    type,
    props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
  }),
  useMemo: (factory) => factory(),
  useRef: (initial) => ({ current: initial }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}

const styleTags = []
const sandbox = {
  React,
  console,
  document: {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: '', isConnected: true }),
    head: { appendChild: (tag) => styleTags.push(tag) },
  },
  Math, Date, JSON, Object, Array, Number, String, Symbol, Set, Map, Error,
}
sandbox.window = sandbox
sandbox.globalThis = sandbox

let entry = null
sandbox.__ModuleLoader__ = {
  load(value) {
    entry = value
    entry.exports = value.factory((id) => {
      if (id === 'react') return React
      throw new Error(`unexpected require("${id}")`)
    })
  },
}
runInContext(readFileSync(join(ROOT, 'lib/client.js'), 'utf8'), createContext(sandbox))

// --- apply() against a fake client context, capturing what it contributes -----
const slots = new Map()
let betterTab = null
entry.exports.apply({
  effect: (fn) => { fn() },
  slots: {
    inject: (key, callback) => { slots.set(key, callback().component); return () => {} },
    register: (spec, component) => ({ spec, component }),
  },
  inject: (services, callback) => {
    if (!services.includes('betterSidebar')) return
    callback({
      effect: (fn) => { fn() },
      betterSidebar: { registerTab: (descriptor) => { betterTab = descriptor; return () => {} } },
    })
  },
})

const css = styleTags[0]?.textContent ?? ''

// --- render helper (react-free): resolve components, keep host elements ------
function render(node) {
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(render)
  const { type, props } = node
  if (typeof type === 'function') return render(type(props ?? {}))
  if (type === React.Fragment) return render(props.children)
  return { type, props: { ...props, children: render(props.children) } }
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input'])
/** `paddingLeft` → `padding-left`; `--customProp` is passed through untouched. */
function cssProperty(name) {
  return name.startsWith('--') ? name : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function toHtml(node) {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return escapeHtml(String(node))
  if (Array.isArray(node)) return node.map(toHtml).join('')
  const { type, props } = node
  const attrs = []
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'dangerouslySetInnerHTML' || key.startsWith('on')) continue
    if (value === undefined || value === null || value === false) continue
    if (key === 'style' && typeof value === 'object') {
      // React takes camelCase style keys and emits kebab-case; a faithful
      // serialiser must do the same or the declaration is silently dropped.
      // Custom properties (`--x`) keep their name.
      const declarations = Object.entries(value)
        .map(([property, setting]) => `${cssProperty(property)}:${setting}`)
        .join(';')
      attrs.push(`style="${escapeHtml(declarations)}"`)
      continue
    }
    attrs.push(`${key === 'className' ? 'class' : key}="${escapeHtml(String(value))}"`)
  }
  const inner = props.dangerouslySetInnerHTML?.__html ?? toHtml(props.children)
  const open = `<${type}${attrs.length === 0 ? '' : ` ${attrs.join(' ')}`}>`
  return VOID_TAGS.has(type) ? open : `${open}${inner}</${type}>`
}

// --- realistic fixtures ------------------------------------------------------
const now = Date.now()
const list = {
  byId: {
    root: { id: 'root', displayTitle: '主会话 · 做一个 DSH 小鱼插件', running: true },
    'c-docs': { id: 'c-docs', displayTitle: '子代理 · 调研 DSH 插件开发文档', parentId: 'root', origin: 'subagent', running: true },
    'c-docs-1': { id: 'c-docs-1', displayTitle: '抓取 slots 章节', parentId: 'c-docs', origin: 'subagent', running: false },
    'c-install': { id: 'c-install', displayTitle: '把插件装进 web profile', parentId: 'root', origin: 'subagent', running: false },
    'c-visual': { id: 'c-visual', displayTitle: '校对四处的视觉一致性', parentId: 'root', origin: 'subagent', running: false },
  },
  projectionsBySession: {
    root: { state: 'ready', error: null, values: { subagentCatalog: [
      { id: 'c-docs', createdAt: now - 214000, mode: 'continuable', label: '调研 DSH 插件开发文档' },
      { id: 'c-install', createdAt: now - 96000, mode: 'one-shot', label: '把插件装进 web profile' },
      { id: 'c-visual', createdAt: now - 40000, mode: 'one-shot', label: '校对四处的视觉一致性' },
    ] } },
    'c-docs': { state: 'ready', error: null, values: { subagentCatalog: [
      { id: 'c-docs-1', createdAt: now - 12000, mode: 'one-shot', label: '抓取 slots 章节' },
    ] } },
  },
}

const Title = slots.get('sidebar.right.pane.tab.title')
const tabStrip = [
  { title: '调研文档', child: 'c-docs', running: true },
  { title: '安装插件', child: 'c-install', running: false },
  { title: '校对视觉', child: 'c-visual', running: false },
].map(({ title, child, running }) => render(Title({
  useTabInfo: () => ({ tab: { title, contentId: `dsh-resource://subagentchat/session/${child}` } }),
  useSessionStatus: (selector) => selector(new Map([[child, { running }]])),
})))

const page = render(betterTab.component({
  ctx: { sessions: { list: { getSnapshot: () => list, subscribe: () => () => {} } } },
  scope: { sessionId: 'c-docs-1' },
}))

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>插件真实输出 · dsh-subagent-fish</title>
<style>
:root { color-scheme: dark; }
body { margin: 0; padding: 28px; background: #16161a; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
h2 { color: #cfcfd4; font-size: 13px; font-weight: 500; margin: 0 0 10px; }
h2 code { color: #7c7c85; font-weight: 400; font-size: 11px; }
.stage { margin-bottom: 30px; border: 1px solid #2c2c33; border-radius: 10px; padding: 16px; }
.tabstrip { display: inline-flex; align-items: center; gap: 4px; }
.tab-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 4px; border-radius: 999px; border: 1px solid transparent; font-size: 12px; color: #9a9aa3; }
.tab-pill.active { border-color: #34343c; background: #1f1f25; color: #e8e8ec; }
/* ---- 以下是插件自己注入的样式，原样使用 ---- */
${css}
</style></head>
<body data-ds-dark-theme>
<h2>D · 右侧栏子代理标签 —— 插件的真实输出 <code>sidebar.right.pane.tab.title</code></h2>
<div class="stage"><div class="tabstrip">
  <span class="tab-pill active">${toHtml(tabStrip[0])}</span>
  <span class="tab-pill">${toHtml(tabStrip[1])}</span>
  <span class="tab-pill">${toHtml(tabStrip[2])}</span>
</div></div>

<h2>E · better-sidebar 子代理页 —— 插件的真实输出 <code>ctx.betterSidebar.registerTab()</code></h2>
<div class="stage" style="max-width:420px">${toHtml(page)}</div>
</body></html>
`

writeFileSync(join(ROOT, 'preview/plugin-render.html'), html)
console.log(`wrote preview/plugin-render.html (${html.length} bytes)`)
console.log(`captured ${css.length} bytes of the plugin's own stylesheet`)
