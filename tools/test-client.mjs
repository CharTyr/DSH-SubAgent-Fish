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
const bundleSource = readFileSync(join(ROOT, 'lib/client.js'), 'utf8')
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
  body: {},
  querySelector: () => null,
  // The decorator scans for rows; there are none in a headless run, so it must
  // find zero and quietly stop.
  querySelectorAll: () => [],
  createElement: () => ({ dataset: {}, textContent: '', isConnected: true, setAttribute() {}, insertBefore() {} }),
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
// The decorator observes the DOM. A stub is enough here — the real behaviour is
// checked against real markup by tools/render-rows-check.mjs.
sandbox.MutationObserver = class { observe() {} disconnect() {} }
sandbox.queueMicrotask = (fn) => fn()

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
let sidebarRowDisposer = null

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
        effect: (fn) => { const dispose = fn(); if (typeof dispose === 'function') sidebarRowDisposer = dispose },
        betterSidebar: { registerTab: (descriptor) => { betterSidebarRegistration = descriptor; return () => {} } },
        // The decorator reads the session list and starts observing; hand it a
        // usable shape so the call path really runs.
        sessions: { list: { getSnapshot: () => ({ byId: {}, projectionsBySession: {} }), subscribe: () => () => {} } },
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
check('no tab is registered any more (the extra page is gone)', betterSidebarRegistration === null)
check('the betterSidebar service is used to install the row decorator', typeof sidebarRowDisposer === 'function')

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
// E — the row decorator.
//
// The decorator is exercised against real markup in a browser by
// tools/render-rows-check.mjs. What is checked here is what it depends on:
// that it ships, and that it anchors on things better-sidebar is unlikely to
// change — ARIA semantics, not hashed CSS class names.
// ---------------------------------------------------------------------------
console.log('\nE · subagent row decorator')
check('the row decorator is in the shipped bundle', bundleSource.includes('installSidebarRowFish'))
check('it anchors on ARIA, not on hashed class names', bundleSource.includes('[role="treeitem"][aria-level]'))
check('it still requires the subagent-only label element', bundleSource.includes('_subagentLabel'))
check('it gives up instead of scanning forever', bundleSource.includes('MAX_EMPTY_SCANS'))
check('it cleans up after itself on unload', bundleSource.includes('disposed = true'))
check('animation follows the run state, not the artwork', bundleSource.includes('function shouldFishSwim'))
check('idle fish are emitted without swim hooks', bundleSource.includes('still: !animated'))
check('a stalled engine loop is woken again', bundleSource.includes('ensureFishSwimming'))
check('there is a low-frequency heartbeat as a backstop', bundleSource.includes('ensureSwimHeartbeat'))
// Identity: the whole point is that it is stable and spread out.
// ---------------------------------------------------------------------------
console.log('\nidentity (through the rendered surface)')
/** Render one tab title and hand back its fish markup. `running` decides motion. */
const markupFor = (childId, running = true) => render(Title({
  useTabInfo: () => ({ tab: { title: 't', contentId: `dsh-resource://subagentchat/session/${childId}` } }),
  useSessionStatus: (selector) => selector(new Map([[childId, { running }]])),
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
check('a running subagent\'s fish carries the swim hooks', first.includes('fish-swim') && first.includes('data-fish-id'))
check('a finished subagent\'s fish carries none, so it stays still',
  !markupFor('child-a', false).includes('fish-swim') && !markupFor('child-a', false).includes('data-fish-id'))
// The two renderings must differ ONLY in the motion hooks. The clip id is a
// per-call serial, so it has to be normalised too — it says nothing about the fish.
const withoutMotion = (markup) => markup
  .replace(/ fish-swim/g, '')
  .replace(/ data-fish-id="\d+"/g, '')
  .replace(/pattern-clip-\d+/g, 'pattern-clip-N')
check('both states draw the same fish, only the motion differs',
  withoutMotion(markupFor('child-a', true)) === withoutMotion(markupFor('child-a', false)))
check('a patterned fish carries its clipped markings', first.includes('fish-clip') || first.includes('fish-mark') === false)

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
