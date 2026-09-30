#!/usr/bin/env node
/**
 * Regenerate `src/fish/engine.js` from the MaiWork production fish engine.
 *
 * The fish artwork is NOT re-implemented here. This tool reads the single
 * authoritative source —
 *
 *   <MaiWork>/plugin/CharTyr_MaiWork/maiwork/console/static/js/fish.js
 *
 * — and wraps it with the two capabilities the console does not need but an
 * avatar does:
 *
 *   1. body patterns (procedural markings, clipped to the live body outline),
 *   2. a live pause switch, so a caller can freeze every fish in place.
 *
 * The transformation is the same one the standalone prototype
 * (`MaiWork/prototype/fish-patterns/build.py`) performs, so the preview, the
 * prototype, and the shipped console all draw the same fish. Every patch
 * asserts on its anchor: if upstream moves, this tool fails loudly instead of
 * emitting a subtly wrong engine.
 *
 * Usage:  node tools/sync-engine.mjs [--check]
 *         --check  fail (exit 1) when src/fish/engine.js is out of date.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

/** The MaiWork checkout holding the production engine and pattern module. */
const MAIWORK = process.env.MAIWORK_ROOT ?? '/Volumes/Somemore/projects/MaiWork'
const PROD_FISH = join(MAIWORK, 'plugin/CharTyr_MaiWork/maiwork/console/static/js/fish.js')
const MARKINGS = join(MAIWORK, 'prototype/fish-patterns/markings.js')
const OUT = join(ROOT, 'src/fish/engine.js')

function readRequired(path) {
  if (!existsSync(path)) {
    throw new Error(`missing upstream source: ${path}\nSet MAIWORK_ROOT if the checkout moved.`)
  }
  return readFileSync(path, 'utf8')
}

/** Replace one unique anchor; count !== 1 means upstream drifted. */
function patchOnce(source, oldText, newText) {
  const count = source.split(oldText).length - 1
  if (count !== 1) {
    throw new Error(
      `upstream changed (${count} matches, expected 1): ${oldText.slice(0, 70)}…\n` +
        'Inspect the production engine before rebuilding.',
    )
  }
  return source.replace(oldText, newText)
}

function build() {
  let source = readRequired(PROD_FISH)

  // Per-mount clip ids must not collide when several fish share a page.
  source = patchOnce(source, 'const PI = Math.PI;', 'let patternSerial = 0;\nconst PI = Math.PI;')

  // Record the pattern geometry alongside the body outline.
  source = patchOnce(
    source,
    '    pts, ts: ss.map',
    "    markings: makeMarkings(opts.pattern || 'none', `${base}#${opts.patternSeed ?? ''}`, {pts, ax, n: nrm}),\n" +
      '    strength: Math.max(0, Math.min(1, Number(opts.strength ?? .55))),\n' +
      '    pts, ts: ss.map',
  )

  // A pattern or strength change is a different fish to the swim registry.
  source = patchOnce(
    source,
    '`${seed}|${opts.species || ""}|${opts.eyes || ""}`',
    '`${seed}|${opts.species || ""}|${opts.eyes || ""}|${opts.pattern || "none"}|${opts.patternSeed ?? ""}|${opts.strength ?? .55}`',
  )

  // Emit the markings, clipped to the body contour.
  source = patchOnce(
    source,
    '  if (id) startSwimLoop();',
    '  if (id) startSwimLoop();\n' +
      '  const clipId = `pattern-clip-${++patternSerial}`;\n' +
      '  const marksSvg = geom.markings.length ? `<defs><clipPath id="${clipId}"><path class="fish-clip" d="${smoothPath(pts)}"/></clipPath></defs><g clip-path="url(#${clipId})" opacity="${geom.strength}">${geom.markings.map(m => `<path class="fish-mark" d="${smoothPath(m.pts)}" fill="${m.light ? \'#fff\' : \'#172d3c\'}"/>`).join("")}</g>` : "";',
  )
  source = patchOnce(source, '    + `<g class="fish-head" fill="#fff"', '    + marksSvg\n    + `<g class="fish-head" fill="#fff"')

  // Marking vertices must ride the same swim displacement as the body, or the
  // pattern slides out from under the fish while it moves.
  source = patchOnce(
    source,
    '    d: smoothPath(pts, 2),',
    '    d: smoothPath(pts, 2),\n' +
      '    markings: g.markings.map(m => smoothPath(m.pts.map(p => {\n' +
      '      const u = Math.max(0, Math.min(1, (g.sHead - (p[0] * g.ax[0] + p[1] * g.ax[1])) / g.span));\n' +
      '      const w = sway(u);\n' +
      '      return [p[0] + g.n[0] * w, p[1] + g.n[1] * w];\n' +
      '    }), 2)),',
  )
  source = patchOnce(source, '    style: SWIM[species]', '    sHead, span, ax,\n    style: SWIM[species]')

  // The frame loop must also refresh the clip contour and every marking.
  source = patchOnce(
    source,
    '        heads: [...el.querySelectorAll(".fish-head")],',
    '        heads: [...el.querySelectorAll(".fish-head")],\n        clip: el.querySelector(".fish-clip"), marks: [...el.querySelectorAll(".fish-mark")],',
  )
  source = patchOnce(
    source,
    '      x.body.setAttribute("d", p.d);',
    '      x.body.setAttribute("d", p.d);\n      if (x.clip) x.clip.setAttribute("d", p.d);\n      x.marks.forEach((mark, i) => mark.setAttribute("d", p.markings[i]));',
  )

  // Global freeze switch, honoured every frame so a reduced-motion change
  // landing while the page is open takes effect immediately.
  source = patchOnce(
    source,
    '    const sec = now / 1000;',
    '    if (globalThis.fishPaused || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)) {\n' +
      '      requestAnimationFrame(tick); return;\n' +
      '    }\n' +
      '    const sec = now / 1000;',
  )

  // The loop gives up after five fishless scans; only fishSvg() ever restarts
  // it, so a caller that caches its markup (this plugin does) can end up with
  // perfectly good fish that never move. Exporting the starter lets a caller
  // say "there are fish now" without re-generating the artwork.
  source += '\nexport { startSwimLoop };\n'
  source += '\n' + readRequired(MARKINGS)

  const banner =
    '// GENERATED FILE — do not edit.\n' +
    '// Produced by tools/sync-engine.mjs from the MaiWork production engine:\n' +
    `//   ${PROD_FISH}\n` +
    `//   ${MARKINGS}\n` +
    '// Run `node tools/sync-engine.mjs` to regenerate.\n\n'

  return banner + source
}

const generated = build()

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (current !== generated) {
    console.error('src/fish/engine.js is out of date — run: node tools/sync-engine.mjs')
    process.exit(1)
  }
  console.log('src/fish/engine.js is up to date')
} else {
  writeFileSync(OUT, generated)
  console.log(`wrote src/fish/engine.js (${generated.length} bytes)`)
}
