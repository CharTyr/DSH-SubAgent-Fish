#!/usr/bin/env node
/**
 * Emit `lib/client.js` — the browser half of the plugin.
 *
 * A DSH client bundle is NOT a plain ES module. The host serves it to
 * `@deepseek-ai/dsh-client-modules`, which evaluates it as a classic script
 * that must call `window.__ModuleLoader__.load({ id, factory })` and hand back
 * a CommonJS-ish `exports` object carrying `apply` (and `inject`). React and
 * the other shared packages arrive through the factory's `require`.
 *
 * So this build does what a real bundler would: it wraps the sources in that
 * envelope and concatenates them in dependency order with their `import`/
 * `export` keywords stripped, giving every module one shared scope. The fish
 * engine and the identity module are the SAME files the preview page uses.
 *
 * Usage:  node tools/build-client.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const PLUGIN_ID = 'dsh-subagent-fish'

/** Sources in dependency order; later files may use earlier files' names. */
const PARTS = [
  'src/fish/engine.js',
  'src/fish/identity.js',
  'src/client/fish-avatar.js',
  'src/client/subagent-tab-title.js',
  'src/client/better-sidebar-rows.js',
  'src/client/index.js',
]

/** Strip module syntax so every part shares the factory's single scope. */
function asSharedScope(path) {
  const text = readFileSync(join(ROOT, path), 'utf8')
  if (text.includes('</script>')) throw new Error(`${path} contains </script>`)
  return `// ---- ${path} ----\n${text
    .replace(/^import\s[^\n]*\n/gm, '')
    .replace(/^export\s*\{[^}]*\};?[ \t]*\n?/gm, '')
    .replace(/^export\s+/gm, '')}`
}

for (const part of PARTS) {
  if (!existsSync(join(ROOT, part))) throw new Error(`missing source: ${part}`)
}

const body = PARTS.map(asSharedScope).join('\n')

const bundle = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(PLUGIN_ID)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let React = require("react");

${body}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
`

writeFileSync(join(ROOT, 'lib/client.js'), bundle)
console.log(`wrote lib/client.js (${bundle.length} bytes)`)

// The node half. This plugin is pure UI: it exists so the package appears in
// the host cordis.yml / Loader, exactly like DSH's own client-ui packages.
const host = `/**
 * dsh-subagent-fish, node half. Pure UI plugin: the empty apply exists so the
 * package appears in the host cordis.yml / Loader; the browser half ships via
 * exports["./client"], discovered through the package.json dsh.client
 * declaration. There is no host-side behaviour — a subagent's fish is a pure
 * function of its session id, and every input it needs (the session list and
 * the subagent catalog projection) is already on the client.
 */
/** Host plugin body. */
export function apply() {}
`
writeFileSync(join(ROOT, 'lib/index.js'), host)
console.log(`wrote lib/index.js (${host.length} bytes)`)
