#!/usr/bin/env node
/**
 * Confirm the RUNNING dsh web server is actually serving this plugin's browser
 * half — the one thing that cannot be checked offline.
 *
 * `dsh web` gates everything behind a launch token that lives only in process
 * memory, and the client roster is injected straight into the index document as
 * `window.__DSH_BOOT__`. So given the URL the server printed at startup, this:
 *
 *   1. redeems the token for the browser cookie,
 *   2. pulls the index document,
 *   3. reads the composed client-module graph out of it,
 *   4. asserts this package has a row, and that the URL in that row really does
 *      serve our bundle,
 *   5. reports where the row sits relative to dsh-better-sidebar, whose service
 *      the sidebar page registers against.
 *
 * Usage:  node tools/verify-live.mjs 'http://127.0.0.1:3080/?token=...'
 *         node tools/verify-live.mjs --offline      # wiring checks only
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_ID = 'dsh-subagent-fish'
const SIDEBAR_ID = 'dsh-better-sidebar'

let failures = 0
const check = (name, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

// ---------------------------------------------------------------------------
// Offline half: the profile wiring. Always worth checking.
// ---------------------------------------------------------------------------
console.log('profile wiring')
const profileDir = join(process.env.DSH_HOME ?? join(process.env.HOME ?? '', '.dsh'), 'profiles', process.env.DSH_PROFILE ?? 'web')
let profile
try {
  profile = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
} catch (error) {
  console.log(`  FAIL cannot read ${profileDir}/package.json — ${error.message}`)
  process.exit(1)
}
const bundles = profile?.dsh?.profile?.bundles ?? []
check('package is a profile dependency', typeof profile.dependencies?.[PLUGIN_ID] === 'string', JSON.stringify(profile.dependencies?.[PLUGIN_ID]))
check('package is in the bundle stack', bundles.includes(PLUGIN_ID), bundles.join(', '))
const mine = bundles.indexOf(PLUGIN_ID)
const sidebar = bundles.indexOf(SIDEBAR_ID)
check('bundle stack places it after dsh-better-sidebar', sidebar === -1 || mine > sidebar, `sidebar@${sidebar}, mine@${mine}`)

// The built bundle must exist and carry the contract the loader expects.
const bundlePath = join(ROOT, 'lib/client.js')
const source = readFileSync(bundlePath, 'utf8')
check('lib/client.js declares the module-loader contract', source.includes('window.__ModuleLoader__.load(') && source.includes(`id: "${PLUGIN_ID}"`))
check('lib/client.js exports apply', /exports\.apply\s*=/.test(source))
check('lib/client.js registers the subagent tab-title slot', source.includes('sidebar.right.pane.tab.title'))
check('lib/client.js registers the better-sidebar page', source.includes('"betterSidebar"') || source.includes("'betterSidebar'"))

// The loader resolves the row by NAME from the profile directory, so the package
// has to be reachable there and its manifest has to satisfy the client-module
// scan — the same three things `dsh-client-modules` checks before it will serve
// a browser half. A restart is the only way to act on this, so check it first.
console.log('\nclient half, as the profile would load it')
const { existsSync, realpathSync } = await import('node:fs')
const installed = join(profileDir, 'node_modules', PLUGIN_ID)
check('package resolves from the profile directory', existsSync(installed), installed)
if (existsSync(installed)) {
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
  const declaration = manifest.dsh?.client
  check('declares dsh.client', declaration !== undefined && typeof declaration === 'object')
  check("dsh.client.platform is 'web'", declaration?.platform === 'web', String(declaration?.platform))
  const clientEntry = manifest.exports?.['./client']
  const clientRel = typeof clientEntry === 'string' ? clientEntry : clientEntry?.default
  check('exports["./client"] resolves to a string path', typeof clientRel === 'string', JSON.stringify(clientEntry))
  check('that file exists', typeof clientRel === 'string' && existsSync(join(installed, clientRel)), String(clientRel))
  check('main entry exists', existsSync(join(installed, manifest.main ?? '')), String(manifest.main))
  check('the bundle patch exists', existsSync(join(installed, manifest.dsh?.bundle?.patch ?? '')), String(manifest.dsh?.bundle?.patch))
  check('the installed bundle registers under the package name',
    typeof clientRel === 'string' && readFileSync(join(installed, clientRel), 'utf8').includes(`id: ${JSON.stringify(PLUGIN_ID)}`))
  console.log(`  (installed via ${realpathSync(installed).startsWith(ROOT) ? 'a link to this repo' : realpathSync(installed)})`)
}

const target = process.argv.find((argument) => argument.startsWith('http'))
if (target === undefined) {
  console.log('\nno URL given — skipping the live half.')
  console.log("pass the URL `dsh web` printed at startup, e.g. node tools/verify-live.mjs 'http://127.0.0.1:3080/?token=…'")
  process.exit(failures === 0 ? 0 : 1)
}

// ---------------------------------------------------------------------------
// Live half: redeem the token, read the graph the server actually composed.
// ---------------------------------------------------------------------------
const base = new URL(target)
const origin = base.origin

console.log(`\nlive server ${origin}`)
const redeem = await fetch(target, { redirect: 'manual' })
check('token accepted (expected a 303 to the clean URL)', redeem.status === 303, `got ${redeem.status}`)
const setCookie = redeem.headers.getSetCookie?.() ?? []
const cookie = setCookie.map((entry) => entry.split(';')[0]).join('; ')
check('server issued a session cookie', cookie.length > 0, setCookie[0] ?? '(none)')
if (redeem.status !== 303 || cookie.length === 0) {
  console.log('\ncannot continue without a valid token URL.')
  process.exit(1)
}

const index = await fetch(`${origin}/`, { headers: { cookie } })
const html = await index.text()
check('index document served', index.ok, `HTTP ${index.status}`)
check('index carries the client boot graph', html.includes('__DSH_BOOT__'))

// Pull the graph out by brace-matching from the first `{` after the name.
let graph = null
const at = html.indexOf('__DSH_BOOT__')
if (at !== -1) {
  const start = html.indexOf('{', at)
  let depth = 0
  let end = -1
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) { end = i + 1; break }
    }
  }
  if (end !== -1) {
    try { graph = JSON.parse(html.slice(start, end)) } catch { graph = null }
  }
}
check('boot graph parsed', graph !== null)

const rows = graph?.rows ?? graph?.graphRows ?? []
const rowOf = (id) => rows.find((row) => row.id === id)
const mineRow = rowOf(PLUGIN_ID)
check(`${PLUGIN_ID} is in the served client roster`, mineRow !== undefined,
  rows.length === 0 ? 'no rows found — the graph shape may have changed' : `roster: ${rows.map((r) => r.id).join(', ')}`)

if (mineRow !== undefined) {
  const url = new URL(mineRow.url, `${origin}/`)
  const served = await fetch(url, { headers: { cookie } })
  const body = await served.text()
  check('its bundle URL serves', served.ok, `HTTP ${served.status} ${url.pathname}`)
  check('the served bundle is ours', body.includes(PLUGIN_ID) && body.includes('__ModuleLoader__.load'))
  check('the served bundle carries both registrations',
    body.includes('sidebar.right.pane.tab.title') && body.includes('betterSidebar'))
}

const sidebarRow = rowOf(SIDEBAR_ID)
check('dsh-better-sidebar is also in the roster (the sidebar page needs it)', sidebarRow !== undefined)

console.log(failures === 0
  ? '\nlive checks passed — the server is serving this plugin to the browser.'
  : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
