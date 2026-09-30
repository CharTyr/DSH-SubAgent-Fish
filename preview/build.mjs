#!/usr/bin/env node
/**
 * Build the offline preview page.
 *
 * Everything is inlined so `preview/index.html` opens by double-click, with no
 * server, no bundler and no network — the same contract the fish prototype
 * keeps. The fish engine and the identity module are the SAME files the plugin
 * ships, only stripped of their ESM import/export keywords and concatenated in
 * dependency order, so the preview can never drift from the real thing.
 *
 * Usage:  node preview/build.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

/** Strip module syntax so several modules can share one classic <script> scope. */
function asClassicScript(path) {
  return readFileSync(path, 'utf8')
    .replace(/^import\s[^\n]*\n/gm, '')
    .replace(/^export\s+/gm, '')
}

const engine = asClassicScript(join(ROOT, 'src/fish/engine.js'))
const identity = asClassicScript(join(ROOT, 'src/fish/identity.js'))
const theme = readFileSync(join(HERE, 'dsh-theme.css'), 'utf8')
const template = readFileSync(join(HERE, 'template.html'), 'utf8')

const html = template
  .replace('/*__THEME__*/', () => theme)
  .replace('/*__ENGINE__*/', () => engine)
  .replace('/*__IDENTITY__*/', () => identity)

if (html.includes('__ENGINE__') || html.includes('__IDENTITY__') || html.includes('__THEME__')) {
  throw new Error('a placeholder survived substitution — check template.html')
}
for (const forbidden of ['</script>', '</style>']) {
  if (engine.includes(forbidden) || identity.includes(forbidden) || theme.includes(forbidden)) {
    throw new Error(`inlined source contains ${forbidden} and would break the page`)
  }
}

writeFileSync(join(HERE, 'index.html'), html)
console.log(`wrote preview/index.html (${html.length} bytes)`)
