/**
 * Subagent → fish identity.
 *
 * One subagent is always the SAME fish: the identity is a pure function of the
 * agent's stable id, so reopening a session, reloading the page, or restarting
 * DSH redraws exactly the same creature. Nothing here is random at draw time.
 *
 * The pick is deliberately spread across every axis the engine exposes —
 * species, palette, eye style, body pattern and the per-fish random stream
 * that decides its silhouette — so a list of subagents reads as a shoal of
 * distinct individuals rather than one fish recoloured.
 */
import { FISH_SPECIES, FISH_COLORS, FISH_EYES, customSeed, fishTraits } from './engine.js'

/** Every body pattern the engine can draw, in menu order. */
export const PATTERNS = ['none', 'spots', 'stripes', 'belly', 'scales', 'patches', 'ribbon', 'rings', 'marble']

/** Human-readable pattern names (zh-CN), for settings surfaces. */
export const PATTERN_NAMES = {
  none: '纯色',
  spots: '斑点',
  stripes: '条纹',
  belly: '背腹双色',
  scales: '鳞片',
  patches: '色块',
  ribbon: '波纹',
  rings: '环斑',
  marble: '流线纹',
}

/** Species keys in engine-declaration order. */
const SPECIES_KEYS = Object.keys(FISH_SPECIES)
/** Eye-style keys in engine-declaration order. */
const EYE_KEYS = Object.keys(FISH_EYES)

/** FNV-1a, 32-bit: a small, stable string hash (never the platform's Math.random). */
function hash32(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: turns one 32-bit hash into a repeatable stream of picks. */
function stream(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Base36 text of exactly 10 safe characters — the shape the engine's seed grammar accepts. */
function baseToken(value) {
  return (value.toString(36) + '0000000000').slice(0, 10)
}

/**
 * The fish belonging to `id`.
 *
 * @param id - a subagent id (a session id, a tool-call id, or any stable label).
 *   The special id `main` is reserved for the top-level agent.
 * @param overrides - optional fields to force (`species`, `color`, `eyes`, `pattern`, `strength`).
 * @returns the identity, plus the engine seed string and the body colour.
 */
export function fishIdentity(id, overrides = {}) {
  const key = String(id ?? '')
  const r = stream(hash32(key))
  // One extra draw keeps the stream aligned when a caller overrides a field,
  // so forcing the pattern never reshuffles the fish's body.
  const pick = (values, forced) => {
    const drawn = values[Math.floor(r() * values.length)]
    return forced !== undefined && forced !== null ? forced : drawn
  }
  const identity = {
    id: key,
    species: pick(SPECIES_KEYS, overrides.species),
    color: colorIndex(pick(FISH_COLORS.map((_, index) => index), overrides.color)),
    eyes: pick(EYE_KEYS, overrides.eyes),
    pattern: pick(PATTERNS, overrides.pattern),
    base: baseToken(hash32(`${key}#body`)),
    patternSeed: baseToken(hash32(`${key}#pattern`)),
    strength: overrides.strength ?? 0.34 + 0.34 * r(),
  }
  identity.seed = identitySeed(identity)
  identity.hex = FISH_COLORS[identity.color]
  return identity
}

function colorIndex(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(FISH_COLORS.length - 1, Math.trunc(n)))
}

/**
 * The engine seed that pins every axis of an identity.
 * @param identity - a {@link fishIdentity} result (or any object with the same fields).
 * @returns the `c-…` seed string `fishSvg` understands.
 */
export function identitySeed(identity) {
  return customSeed({
    species: identity.species,
    color: identity.color,
    eyes: identity.eyes,
    base: identity.base,
  })
}

/**
 * A short human label for an identity's species and pattern, e.g. `鳗 · 斑点`.
 * @param identity - a {@link fishIdentity} result.
 * @returns the label.
 */
export function identityLabel(identity) {
  const species = FISH_SPECIES[identity.species] ?? identity.species
  const pattern = PATTERN_NAMES[identity.pattern] ?? identity.pattern
  return `${species} · ${pattern}`
}

/**
 * The body colour the engine will actually paint, resolved from a seed.
 * @param seed - any seed string.
 * @returns a CSS colour.
 */
export function seedHex(seed) {
  return fishTraits(seed).color
}
