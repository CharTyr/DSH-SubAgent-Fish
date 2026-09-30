#!/usr/bin/env node
/**
 * Generate the project logo — one green betta, no pattern, swimming.
 *
 * The logo is not drawn by hand: it is the same `fishSvg()` the plugin uses,
 * pinned to one identity so it never drifts. Three artifacts come out of it:
 *
 *   logo.svg   the animated original. GitHub runs no JavaScript, but it does
 *              render an SVG's own SMIL animation, so the swim is BAKED: every
 *              frame the runtime loop would have computed with `swimPose()` is
 *              written into the file as an <animate>/<animateTransform> list.
 *              Crisp at any size, and if a viewer ignores SMIL it simply shows
 *              the first frame — a graceful failure.
 *   logo.gif   the guaranteed-animated raster, for anywhere SVG animation is
 *              stripped. Larger and honestly uglier at the edges.
 *   logo.png   the static first frame, 512×512 on transparency.
 *
 * The swim loop must close exactly on itself, so the tempo is normalised for
 * the logo (surge 2s, bob 1s, one tail beat per second) instead of the fish's
 * own random values — those are not commensurate and would leave a visible
 * seam. `assertSeamless()` proves the wrap is exact rather than trusting it.
 *
 * Usage:  node tools/build-logo.mjs [--svg-only]
 *         CHROME=/path/to/chrome node tools/build-logo.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { decodePng } from './png.mjs'
import { encodeGif } from './gif.js'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The logo's identity: green betta (`#5CC87A` is palette index 0), round eyes, no markings. */
const SPECIES = 'betta'
const COLOR_INDEX = 0
const EYES = 'dots'
const BASE = 'logofish00'
const PNG_SIZE = 512
const GIF_SIZE = 240
/** Rendered at 2× then box-filtered down, so the GIF's hard alpha edge still lands sub-pixel. */
const CELL = GIF_SIZE * 2
const FRAMES = 25
/** Normalised tempo; see the header. hz(betta) × beat = 1.0 exactly. */
const LOOP_SECONDS = 2
const BEAT = 1.25

const { customSeed, fishSvg, swimGeom, swimPose, FISH_COLORS } =
  await import(join(ROOT, 'src/fish/engine.js'))

const seed = customSeed({ species: SPECIES, color: COLOR_INDEX, eyes: EYES, base: BASE })
// `still: false` registers the swim geometry so swimPose can be asked for poses.
const baseSvg = fishSvg(seed, { size: 128, pattern: 'none', title: 'DSH SubAgent Fish' })
const geom = { ...swimGeom(1), surge: LOOP_SECONDS, bob: LOOP_SECONDS / 2, beat: BEAT, lag: 0 }

/** Pose times: N steps plus the closing frame, so SMIL wraps with no jump. */
const times = Array.from({ length: FRAMES + 1 }, (_, index) => (index * LOOP_SECONDS) / FRAMES)
const poses = times.map((time) => swimPose(geom, time))

/** The wrap must be exact: the last pose has to equal the first, numerically. */
function assertSeamless() {
  const first = poses[0]
  const last = poses[poses.length - 1]
  for (const key of ['d', 'head', 'body']) {
    const normalize = (text) => text.replace(/-?\d+\.?\d*/g, (n) => Number(n).toFixed(3))
    if (normalize(first[key]) !== normalize(last[key])) {
      throw new Error(`logo loop does not close: "${key}" differs at t=0 and t=${LOOP_SECONDS}\n${first[key]}\n${last[key]}`)
    }
  }
}
assertSeamless()

/** Split the engine's combined body transform into the two SMIL can animate. */
function splitBody(transform) {
  const match = /^translate\(([^)]+)\)\s*rotate\(([^)]+)\)$/.exec(transform)
  if (match === null) throw new Error(`unexpected swim transform: ${transform}`)
  return { translate: match[1], rotate: match[2] }
}
const bodies = poses.map((pose) => splitBody(pose.body))
const nums = (values) => values.join(';')

// --- bake the animation into the SVG ---------------------------------------
// The runtime keeps two decimals; the logo is never shown large enough to
// tell, and dropping to one roughly a third off the file.
const roundPath = (d) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10))
const bodyPath = poses.map((pose) => roundPath(pose.d))

let svg = baseSvg
  .replace(' fish-swim', '')
  .replace(/ data-fish-id="\d+"/, '')
  .replace('<svg class="fish"', `<svg class="fish" data-logo="dsh-subagent-fish"`)

const keyTimes = times.map((_, index) => (index / FRAMES).toFixed(4)).join(';')
/** One SMIL timing wrapper; only the payload differs between the three uses. */
const timing = `dur="${LOOP_SECONDS}s" repeatCount="indefinite" calcMode="linear" keyTimes="${keyTimes}"`
const animate = (attributeName, values) =>
  `<animate attributeName="${attributeName}" ${timing} values="${values}"/>`
const animateTransform = (type, values) =>
  `<animateTransform attributeName="transform" type="${type}" ${timing} values="${values}"/>`

// 1. the eyes ride the head wave (a single translate)
const headOpen = svg.indexOf('<g class="fish-head"')
const headInsert = svg.indexOf('>', headOpen) + 1
svg = svg.slice(0, headInsert)
  + animateTransform('translate', nums(poses.map((pose) => pose.head)))
  + svg.slice(headInsert)

// 2. the body outline morphs. An <animate> child needs a real element, so the
//    self-closing <path .../> becomes <path ...>…</path>.
const bodyAt = svg.indexOf('<path class="fish-body"')
const bodyClose = svg.indexOf('/>', bodyAt)
svg = svg.slice(0, bodyClose)
  + '>'
  + animate('d', nums(bodyPath))
  + '</path>'
  + svg.slice(bodyClose + 2)

// 3. translate (bob) and rotate (pitch) are two different transform types, so
//    they need two nested groups; wrap the existing body in the inner one.
const bobAt = svg.indexOf('<g class="fish-bob"')
const bobInsert = svg.indexOf('>', bobAt) + 1
const bobEnd = svg.lastIndexOf('</g>')
svg = svg.slice(0, bobInsert)
  + animateTransform('translate', nums(bodies.map((body) => body.translate)))
  + '<g class="fish-pitch">'
  + animateTransform('rotate', nums(bodies.map((body) => body.rotate)))
  + svg.slice(bobInsert, bobEnd)
  + '</g>'
  + svg.slice(bobEnd)

const banner = `<!-- 本文件由 tools/build-logo.mjs 生成，不要手改。
     用的就是插件里同一个 fishSvg()：绿色斗鱼（${FISH_COLORS[COLOR_INDEX]}）、圆眼、无花纹。
     游动是烘焙进来的 SMIL 动画 —— ${FRAMES} 帧 / ${LOOP_SECONDS} 秒无缝循环，
     每一帧都是引擎的 swimPose() 算出来的，和界面上那条鱼同一套动作。
     GitHub 不跑 JavaScript，但会播放 SVG 自带的动画；不支持的话就停在第一帧。 -->
`
writeFileSync(join(ROOT, 'logo.svg'), banner + svg + '\n')
console.log(`wrote logo.svg (${svg.length} bytes, ${FRAMES} baked frames, ${LOOP_SECONDS}s seamless loop)`)

if (process.argv.includes('--svg-only')) process.exit(0)

// --- rasterise through Chrome ----------------------------------------------
const CHROME_CANDIDATES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)
const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
if (chrome === undefined) {
  console.log('no Chrome found; set CHROME=/path/to/chrome to also emit logo.png / logo.gif')
  process.exit(0)
}

const shoot = (page, out, size, extra = []) => {
  const pagePath = join(ROOT, '.logo-render.html')
  writeFileSync(pagePath, page)
  try {
    execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars',
      `--window-size=${size},${size}`,
      '--virtual-time-budget=2500',
      ...extra,
      `--screenshot=${join(ROOT, out)}`,
      `file://${pagePath}`,
    ], { stdio: 'ignore' })
  } finally {
    rmSync(pagePath, { force: true })
  }
}

// Static PNG: the first frame, transparent, frozen.
const still = fishSvg(seed, { size: PNG_SIZE, pattern: 'none', still: true })
/** Read the body colour straight out of the markup, so the GIF can never disagree. */
const fishColour = (() => {
  const match = /<path class="fish-body" d="[^"]*" fill="#([0-9A-Fa-f]{6})"/.exec(still)
  if (match === null) throw new Error('cannot find the body fill in the generated SVG')
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
})()
shoot(
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block;width:${PNG_SIZE}px;height:${PNG_SIZE}px}</style></head><body>${still}</body></html>`,
  'logo.png', PNG_SIZE, ['--default-background-color=00000000'],
)
console.log(`wrote logo.png (${PNG_SIZE}×${PNG_SIZE}, transparent)`)

// --- GIF: the form GitHub actually animates --------------------------------
// GitHub does not run a repository SVG's own animation, so the README needs a
// raster. Every baked pose goes into one page as a grid, one screenshot comes
// back, and the cells are sliced apart — one Chrome launch instead of 25.
const COLUMNS = 5
const ROWS = Math.ceil(FRAMES / COLUMNS)
const cells = poses.slice(0, FRAMES).map((pose, index) => {
  const body = bodies[index]
  const frame = still
    .replace(/(<g class="fish-bob"[^>]*>)/, `$1<g transform="translate(${body.translate}) rotate(${body.rotate})">`)
    .replace(/(<g class="fish-head"[^>]*)>/, `$1 transform="${pose.head}">`)
    .replace(/(<path class="fish-body" d=")[^"]*(")/, `$1${roundPath(pose.d)}$2`)
  return `<div class="f">${frame}</div>`
}).join('')

shoot(
  `<!doctype html><html><head><meta charset="utf-8"><style>
   html,body{margin:0;background:transparent}
   .grid{display:grid;grid-template-columns:repeat(${COLUMNS},${CELL}px);grid-auto-rows:${CELL}px;width:${COLUMNS * CELL}px}
   .f{width:${CELL}px;height:${CELL}px}
   .f svg{display:block;width:${CELL}px;height:${CELL}px}
   </style></head><body><div class="grid">${cells}</div></body></html>`,
  '.logo-frames.png', CELL * COLUMNS, ['--default-background-color=00000000'],
)

const grid = decodePng(readFileSync(join(ROOT, '.logo-frames.png')))
if (grid.width < COLUMNS * CELL || grid.height < ROWS * CELL) {
  throw new Error(`frame grid too small: ${grid.width}×${grid.height}, need ${COLUMNS * CELL}×${ROWS * CELL}`)
}

/** The one opaque colour the logo uses, read back from the static render. */
const [fishR, fishG, fishB] = fishColour

const frames = []
for (let index = 0; index < FRAMES; index++) {
  const originX = (index % COLUMNS) * CELL
  const originY = Math.floor(index / COLUMNS) * CELL
  const frame = new Uint8ClampedArray(GIF_SIZE * GIF_SIZE * 4)
  for (let y = 0; y < GIF_SIZE; y++) {
    for (let x = 0; x < GIF_SIZE; x++) {
      // Average the 2×2 source block's coverage, then threshold: GIF alpha is
      // one bit, so the only choice is where that bit flips.
      let coverage = 0
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sx = originX + x * 2 + dx
          const sy = originY + y * 2 + dy
          coverage += grid.rgba[(sy * grid.width + sx) * 4 + 3]
        }
      }
      const offset = (y * GIF_SIZE + x) * 4
      if (coverage / 4 >= 128) {
        frame[offset] = fishR
        frame[offset + 1] = fishG
        frame[offset + 2] = fishB
        frame[offset + 3] = 255
      }
    }
  }
  frames.push(frame)
}

const gif = encodeGif({ width: GIF_SIZE, height: GIF_SIZE, frames, delay: 8, loop: 0 })
writeFileSync(join(ROOT, 'logo.gif'), gif)
rmSync(join(ROOT, '.logo-frames.png'), { force: true })
console.log(`wrote logo.gif (${GIF_SIZE}×${GIF_SIZE}, ${FRAMES} frames @ 8cs = ${(FRAMES * 8) / 100}s, transparent)`)
