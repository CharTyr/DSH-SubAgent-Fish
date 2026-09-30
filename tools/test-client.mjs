#!/usr/bin/env node
/**
 * Headless checks over the BUILT browser bundle (`lib/client.js`).
 *
 * The bundle is a real artifact with a real contract — it must register itself
 * as `dsh-subagent-fish` through `window.__ModuleLoader__`, hand back `apply`
 * and `inject`, and its `apply` must contribute exactly the two slots this
 * plugin claims. This evaluates the shipped file (not the sources) inside a VM
 * with the browser globals it touches, then renders both components against a
 * fake React and a fake session list.
 *
 * Usage:  node tools/test-client.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SUBAGENT_TAB_ID = '@deepseek-ai/dsh-client-ui-subagent'

let failures = 0
function check(name, condition, detail) {
  if (condition) {
    console.log(`  ok   ${name}`)
    return
  }
  failures += 1
  console.log(`  FAIL ${name}${detail === undefined ? '' : ` — ${detail}`}`)
}
function equal(name, actual, expected) {
  check(name, Object.is(actual, expected), `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`)
}

// ---------------------------------------------------------------------------
// A React stub: just enough for the two components (memo, external store).
// ---------------------------------------------------------------------------
const React = {
  Fragment: Symbol('react.fragment'),
  createElement(type, props, ...children) {
    return { type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children } }
  },
  useMemo: (factory) => factory(),
  useRef: (initial) => ({ current: initial }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}

/**
 * Resolve an element tree the way React would: invoke function components and
 * flatten fragments, leaving host elements with rendered children. Without
 * this, `createElement(FishAvatar, ...)` is just an inert element.
 */
function render(node) {
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(render)
  const { type, props } = node
  if (typeof type === 'function') return render(type(props ?? {}))
  if (type === React.Fragment) return render(props.children)
  return { type, props: { ...props, children: render(props.children) } }
}

const styleTags = []
const documentStub = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, textContent: '', isConnected: true }),
  head: { appendChild: (tag) => styleTags.push(tag) },
}

const sandbox = {
  React,
  document: documentStub,
  console,
  setTimeout,
  clearTimeout,
  Math,
  Date,
  JSON,
  Object,
  Array,
  Number,
  String,
  Symbol,
  Set,
  Map,
  Error,
}
sandbox.window = sandbox
sandbox.globalThis = sandbox

let registered = null
sandbox.__ModuleLoader__ = {
  load(entry) {
    registered = entry
    registered.exports = entry.factory((id) => {
      if (id === 'react') return React
      throw new Error(`unexpected require("${id}")`)
    })
  },
}

// ---------------------------------------------------------------------------
// Load the shipped bundle.
// ---------------------------------------------------------------------------
console.log('bundle contract')
runInContext(readFileSync(join(ROOT, 'lib/client.js'), 'utf8'), createContext(sandbox))

check('registers itself via __ModuleLoader__.load', registered !== null)
equal('registers under its package id', registered?.id, 'dsh-subagent-fish')
equal('exports apply', typeof registered?.exports?.apply, 'function')
check('exports inject', Array.isArray(registered?.exports?.inject), JSON.stringify(registered?.exports?.inject))
check('inject includes slots', registered?.exports?.inject?.includes('slots'))

// ---------------------------------------------------------------------------
// apply() against a fake client context.
// ---------------------------------------------------------------------------
console.log('\napply() contributions')
const slotRegistrations = []
let betterSidebarRequested = false
let betterSidebarRegistration = null

const ctx = {
  effect: (fn) => { fn() },
  slots: {
    inject(key, callback) {
      const registration = callback()
      slotRegistrations.push({ key, registration })
      return () => {}
    },
    register(spec, component) {
      return { spec, component }
    },
  },
  inject(services, callback) {
    if (services.includes('betterSidebar')) {
      betterSidebarRequested = true
      // Simulate dsh-better-sidebar being mounted: its public service appears.
      callback({
        effect: (fn) => { fn() },
        betterSidebar: { registerTab: (descriptor) => { betterSidebarRegistration = descriptor; return () => {} } },
      })
    }
  },
}

registered.exports.apply(ctx)

check('injects the injected stylesheet', styleTags.length === 1)
check('stylesheet is namespaced to this plugin', styleTags[0]?.dataset?.plugin === 'dsh-subagent-fish')

const titleSlot = slotRegistrations.find((entry) => entry.key === 'sidebar.right.pane.tab.title')
check('registers the right-sidebar tab title slot', titleSlot !== undefined)
equal('tab title slot is keyed by the subagent chat tab type', titleSlot?.registration?.spec?.key, SUBAGENT_TAB_ID)

check('asks for the optional betterSidebar service', betterSidebarRequested)
check('registers a better-sidebar tab', betterSidebarRegistration !== null)
equal('better-sidebar tab id', betterSidebarRegistration?.id, 'dsh-subagent-fish:shoal')
check('better-sidebar tab is single-instance', betterSidebarRegistration?.single === true)
check('better-sidebar tab declares a component', typeof betterSidebarRegistration?.component === 'function')

// ---------------------------------------------------------------------------
// D — the tab title.
// ---------------------------------------------------------------------------
console.log('\nD · subagent chat tab title')
const Title = titleSlot.registration.component

const withFish = render(Title({
  useTabInfo: () => ({ tab: { title: '调研 DSH 插件开发文档', contentId: 'dsh-resource://subagentchat/session/child-42' } }),
  useSessionStatus: (selector) => selector(new Map([['child-42', { running: true }]])),
}))
const avatar = withFish.props.children[0]
equal('renders a fish avatar', avatar?.props?.className, 'dsf-avatar')
check('fish is generated deterministically from the child session id', typeof avatar?.props?.dangerouslySetInnerHTML?.__html === 'string' && avatar.props.dangerouslySetInnerHTML.__html.includes('fish-body'))
equal('running subagent gets the running state', avatar?.props?.['data-state'], 'running')
equal('keeps the original title text', withFish.props.children[1]?.props?.children, '调研 DSH 插件开发文档')

// The hook must be called even when the address carries no child id — otherwise
// a tab that navigates would change the component's hook count mid-life.
let hookCalls = 0
const nonSubagent = render(Title({
  useTabInfo: () => ({ tab: { title: 'x', contentId: 'dsh-resource://file/a.md' } }),
  useSessionStatus: (selector) => { hookCalls += 1; return selector(new Map()) },
}))
equal('status hook is still called for a non-subagent tab', hookCalls, 1)
equal('and that tab still shows its plain title', nonSubagent, 'x')

const foreignTab = render(Title({
  useTabInfo: () => ({ tab: { title: '某个别的标签', contentId: 'dsh-resource://file/README.md' } }),
}))
equal('a non-subagent tab is left untouched', foreignTab, '某个别的标签')

// ---------------------------------------------------------------------------
// E — the better-sidebar page.
// ---------------------------------------------------------------------------
console.log('\nE · better-sidebar subagent page')
const ShoalTab = betterSidebarRegistration.component

// Mirrors the real SidebarSessionList: summaries carry id/displayTitle/parentId/
// origin/running, and the catalog lives per parent in projectionsBySession.
const fakeList = {
  byId: {
    'root-1': { id: 'root-1', displayTitle: '主会话 · 做一个 DSH 小鱼插件', running: true },
    'child-a': { id: 'child-a', displayTitle: '子代理 A', parentId: 'root-1', origin: 'subagent', running: true },
    'child-a1': { id: 'child-a1', displayTitle: '子代理 A1', parentId: 'child-a', origin: 'subagent', running: false },
    'child-b': { id: 'child-b', displayTitle: '子代理 B', parentId: 'root-1', origin: 'subagent', running: false },
  },
  projectionsBySession: {
    'root-1': { state: 'ready', values: { subagentCatalog: [
      { id: 'child-a', label: '调研 DSH 插件开发文档', mode: 'continuable', createdAt: Date.now() - 120000 },
      { id: 'child-b', label: '把插件装进 web profile', mode: 'one-shot', createdAt: Date.now() - 60000 },
    ] } },
    'child-a': { state: 'ready', values: { subagentCatalog: [
      { id: 'child-a1', label: '抓取 slots 章节', mode: 'one-shot', createdAt: Date.now() - 30000 },
    ] } },
  },
}
const page = render(ShoalTab({
  ctx: { sessions: { list: { getSnapshot: () => fakeList, subscribe: () => () => {} } } },
  scope: { sessionId: 'child-a1' },
}))

const [rootBlock, listBlock] = page.props.children
const rootTitle = rootBlock.props.children[1].props.children[0].props.children
const rootSub = rootBlock.props.children[1].props.children[1].props.children
const rows = listBlock.props.children

equal('walks up to the root from a nested subagent', rootTitle, '主会话 · 做一个 DSH 小鱼插件')
equal('root line counts the whole tree', rootSub, '3 个子代理 · 1 个在跑')
equal('renders one row per subagent, at every depth', Array.isArray(rows) ? rows.length : -1, 3)
// Depth-first: a parent is followed by its own children, then its siblings.
equal('row 1 is the first child, at depth 0', rows[0].props.style.paddingLeft, '14px')
equal('row 2 is that child\'s own child, one level deeper', rows[1].props.style.paddingLeft, '32px')
equal('row 3 is back out at depth 0', rows[2].props.style.paddingLeft, '14px')
equal('row 1 label', rows[0].props.children[1].props.children[0].props.children, '调研 DSH 插件开发文档')
equal('row 2 label', rows[1].props.children[1].props.children[0].props.children, '抓取 slots 章节')
equal('row 3 label', rows[2].props.children[1].props.children[0].props.children, '把插件装进 web profile')
equal('running subagent is marked running', rows[0].props.children[0].props['data-state'], 'running')
equal('finished subagent is not', rows[1].props.children[0].props['data-state'], 'done')
check('every row carries a real fish', rows.every((row) => row.props.children[0].props.dangerouslySetInnerHTML.__html.includes('fish-body')))

const emptyPage = render(ShoalTab({
  ctx: { sessions: { list: { getSnapshot: () => ({ byId: { solo: { id: 'solo', displayTitle: '孤单会话', running: false } }, projectionsBySession: {} }), subscribe: () => () => {} } } },
  scope: { sessionId: 'solo' },
}))
check('an agent with no subagents renders an empty state', emptyPage.props.children[1].props.children.includes('还没有派出过子代理'))

// ---------------------------------------------------------------------------
// Identity: the whole point is that it is stable and spread out.
// ---------------------------------------------------------------------------
console.log('\nidentity (through the rendered surface)')
const markupFor = (childId) => render(Title({
  useTabInfo: () => ({ tab: { title: 't', contentId: `dsh-resource://subagentchat/session/${childId}` } }),
})).props.children[0].props.dangerouslySetInnerHTML.__html

const first = markupFor('child-a')
check('same subagent always renders byte-identical fish', first === markupFor('child-a'))
check('different subagents render different fish', first !== markupFor('child-b'))
// Contrast bail-out: only fish that genuinely fall below 3:1 against a panel
// colour get a halo — the decision must follow measurement, not a guess.
const srgb = (raw) => { const c = raw / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const lumaOf = (hex) => { const n = Number.parseInt(hex.slice(1), 16); return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255) }
const ratio = (a, b) => { const hi = Math.max(a, b), lo = Math.min(a, b); return (hi + 0.05) / (lo + 0.05) }

const probes = Array.from({ length: 120 }, (_, i) => {
  const element = render(Title({
    useTabInfo: () => ({ tab: { title: 't', contentId: `dsh-resource://subagentchat/session/probe-${i}` } }),
  }))
  const avatar = element.props.children[0]
  // The palette hex is not exposed on the element; recover it from the body fill.
  const hex = /fill="(#[0-9A-Fa-f]{6})"/.exec(avatar.props.dangerouslySetInnerHTML.__html)?.[1]
  return { halo: avatar.props['data-halo'], hex }
})

check('every probe resolved to a colour and a verdict',
  probes.every((p) => typeof p.hex === 'string' && ['on-dark', 'on-light', 'both', undefined].includes(p.halo)))

const expected = (hex) => {
  const onDark = ratio(lumaOf(hex), lumaOf('#2c2c2e')) < 3
  const onLight = ratio(lumaOf(hex), lumaOf('#ffffff')) < 3
  if (onDark && onLight) return 'both'
  if (onDark) return 'on-dark'
  if (onLight) return 'on-light'
  return undefined
}
const mismatches = probes.filter((p) => p.halo !== expected(p.hex))
check('the halo verdict matches an independent contrast computation', mismatches.length === 0,
  JSON.stringify(mismatches.slice(0, 3)))

const needing = probes.filter((p) => p.halo !== undefined)
check('the palette is not uniformly failing (halo is the exception, not the rule)',
  needing.length > 0 && needing.length < probes.length,
  `${needing.length}/${probes.length} need a halo`)

const worst = probes.map((p) => ({ ...p, r: ratio(lumaOf(p.hex), lumaOf('#2c2c2e')) })).sort((a, b) => a.r - b.r)[0]
check('the worst fish really is below 3:1 on the dark panel and is marked',
  worst.r < 3 && worst.halo !== undefined && worst.halo !== 'on-light',
  `${worst.hex} at ${worst.r.toFixed(2)}:1 -> ${worst.halo}`)

check('the markup really is a fish', first.includes('fish-body') && first.includes('fish-head'))
check('the fish is animated (registered with the swim loop)', first.includes('fish-swim') && first.includes('data-fish-id'))
check('a patterned fish carries its clipped markings', first.includes('fish-clip') || first.includes('fish-mark') === false)

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
