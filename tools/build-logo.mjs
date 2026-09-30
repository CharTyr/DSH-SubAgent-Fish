#!/usr/bin/env node
/**
 * Generate the project logo — one green betta, no pattern.
 *
 * The logo is not drawn by hand: it is the same `fishSvg()` the plugin uses,
 * pinned to one identity so it never drifts. `logo.svg` is written directly;
 * `logo.png` is that SVG screenshotted by headless Chrome on a transparent
 * background, because GitHub renders a raster `<img>` more predictably across
 * its surfaces (social preview, mobile, dark mode).
 *
 * Usage:  node tools/build-logo.mjs [--svg-only]
 *         CHROME=/path/to/chrome node tools/build-logo.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The logo's identity: green betta (`#5CC87A` is palette index 0), round eyes, no markings. */
const SPECIES = 'betta'
const COLOR_INDEX = 0
const EYES = 'dots'
const BASE = 'logofish00'
const PNG_SIZE = 512

// The engine and the identity module are plain ESM with no browser imports at
// module scope, so Node can take them directly.
const { customSeed, fishSvg, FISH_COLORS } = await import(join(ROOT, 'src/fish/engine.js'))

const seed = customSeed({ species: SPECIES, color: COLOR_INDEX, eyes: EYES, base: BASE })
const svg = fishSvg(seed, { size: 128, pattern: 'none', still: true, title: 'DSH SubAgent Fish' })

const banner = `<!-- 本文件由 tools/build-logo.mjs 生成，不要手改。
     用的就是插件里同一个 fishSvg()：绿色斗鱼（${FISH_COLORS[COLOR_INDEX]}）、圆眼、无花纹。 -->
`
writeFileSync(join(ROOT, 'logo.svg'), banner + svg + '\n')
console.log(`wrote logo.svg (${svg.length} bytes)`)

if (process.argv.includes('--svg-only')) process.exit(0)

// --- raster: hand the SVG to Chrome and read the pixels back ---------------
const CHROME_CANDIDATES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)
const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
if (chrome === undefined) {
  console.log('no Chrome found; set CHROME=/path/to/chrome to also emit logo.png')
  process.exit(0)
}

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:transparent}
svg{display:block;width:${PNG_SIZE}px;height:${PNG_SIZE}px}
</style></head><body>${svg}</body></html>`
const pagePath = join(ROOT, '.logo-render.html')
writeFileSync(pagePath, page)
try {
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--default-background-color=00000000',
    `--window-size=${PNG_SIZE},${PNG_SIZE}`,
    '--virtual-time-budget=2000',
    `--screenshot=${join(ROOT, 'logo.png')}`,
    `file://${pagePath}`,
  ], { stdio: 'ignore' })
} finally {
  writeFileSync(pagePath, '')
}
const { rmSync } = await import('node:fs')
rmSync(pagePath, { force: true })
console.log(`wrote logo.png (${PNG_SIZE}×${PNG_SIZE}, transparent)`)
