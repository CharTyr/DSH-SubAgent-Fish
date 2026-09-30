// ---------------------------------------------------------------------------
// 小鱼头像：插件里唯一画鱼的地方。
//
// 鱼不是图片，是 fishSvg() 现场生成的 SVG 字符串；同一个 id 永远得到同一条鱼
// （见 ../fish/identity.js）。
//
// 游动交给画鱼引擎自己的全局循环：它每 0.4 秒扫一遍页面上的
// `svg.fish-swim[data-fish-id]`，统一驱动所有鱼的尾巴、花纹和裁剪轮廓。
// 所以这里只要把 SVG 放进 DOM 就行，不必自己开 requestAnimationFrame，
// 也不必关心组件何时卸载——节点一离开页面，循环下一轮就不会再动它。
//
// 本文件由 tools/build-client.mjs 与其它源码拼进 lib/client.js，共用同一个作用域。
// ---------------------------------------------------------------------------

/** 注入样式用的 tag 标识（与 DSH 自己的插件同一套做法，便于去重）。 */
const FISH_CSS_TAG = 'dsh-subagent-fish/fish.css'

const FISH_CSS = `
.dsf-avatar {
  /* --dsf-size 是鱼本身的宽度；引擎把鱼画在 100×100 画布中央、占 84%，所以盒子取 1.16 倍 */
  --dsf-size: 24px;
  position: relative;
  flex: none;
  width: calc(var(--dsf-size) * 1.16);
  height: calc(var(--dsf-size) * 1.16);
  display: inline-grid;
  place-items: center;
  vertical-align: middle;
  transition: opacity .25s ease, filter .25s ease;
}
.dsf-avatar > svg { display: block; width: 100%; height: 100%; }
/* 状态只靠鱼自己的明暗表达，不额外加圈、不加底色 */
.dsf-avatar[data-state="done"] > svg { opacity: .85; }
.dsf-avatar[data-state="failed"] > svg { filter: saturate(.18); opacity: .5; }

/* 对比度兜底：只有当这条鱼的底色与它落座的面板底色对比度不足 3:1 时，
   才补一层极淡的反向轮廓。哪些鱼需要由 JS 按真实对比度算出来（见 haloNeed），
   不是按「看着暗」猜的——DSH 的调色板整体偏中间调，绝大多数鱼并不需要。 */
body[data-ds-dark-theme] .dsf-avatar[data-halo="on-dark"] > svg,
body[data-ds-dark-theme] .dsf-avatar[data-halo="both"] > svg {
  filter: drop-shadow(0 0 .7px rgba(255, 255, 255, .6)) drop-shadow(0 0 .7px rgba(255, 255, 255, .35));
}
body:not([data-ds-dark-theme]) .dsf-avatar[data-halo="on-light"] > svg,
body:not([data-ds-dark-theme]) .dsf-avatar[data-halo="both"] > svg {
  filter: drop-shadow(0 0 .7px rgba(0, 0, 0, .45));
}
/* 预览页用的强制描边开关 */
.dsf-avatar[data-rim="on"] > svg {
  filter: drop-shadow(0 0 .55px rgba(0, 0, 0, .8)) drop-shadow(0 0 .55px rgba(0, 0, 0, .5));
}
.dsf-chip { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
.dsf-chip > .dsf-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---- better-sidebar 里的「子代理 · 小鱼」整页（E） ---- */
.dsf-page { display: flex; flex-direction: column; gap: 10px; padding: 12px 10px; font-size: 13px; color: var(--dsw-alias-label-primary); }
.dsf-root { display: flex; align-items: center; gap: 9px; padding: 0 4px 10px; border-bottom: .5px solid var(--dsw-alias-border-l2); }
.dsf-root-body { display: flex; flex-direction: column; min-width: 0; }
.dsf-root-title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsf-root-sub { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.dsf-list { display: flex; flex-direction: column; }
.dsf-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 6px; border: 0; border-radius: var(--dsw-radius-md);
  background: transparent; font: inherit; color: inherit; text-align: left;
  cursor: pointer; min-width: 0;
}
.dsf-row:hover, .dsf-row:focus-visible { background: var(--dsw-alias-interactive-bg-hover); }
.dsf-row-body { display: flex; flex-direction: column; min-width: 0; }
.dsf-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsf-row-sub { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.dsf-empty { color: var(--dsw-alias-label-tertiary); font-size: 12px; margin: 4px 6px; }
`

/** 把样式挂到 <head>，重复调用只会有一个标签。 */
function installFishCss() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(FISH_CSS_TAG)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-subagent-fish'
  tag.dataset.pluginCss = FISH_CSS_TAG
  tag.textContent = FISH_CSS
  document.head.appendChild(tag)
}

/**
 * 小鱼实际会落座的两种面板底色，取自 DSH 主题：
 * 深色的 `bg-layer-2`（#2c2c2e）与浅色的 `bg-base`（#fff）。
 */
const SURFACE_ON_DARK = '#2c2c2e'
const SURFACE_ON_LIGHT = '#ffffff'
/** 图形元素相对背景的最低对比度（WCAG 1.4.11 对非文本内容的要求）。 */
const MIN_CONTRAST = 3

/** WCAG 相对亮度。 */
function relativeLuminance(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex))
  if (match === null) return undefined
  const value = Number.parseInt(match[1], 16)
  const channel = (raw) => {
    const c = raw / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255)
}

/** 两个相对亮度之间的 WCAG 对比度。 */
function contrastRatio(a, b) {
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 这条鱼需不需要补一层轮廓。
 *
 * 按**真实对比度**算：与深色面板、浅色面板分别比一次，低于 3:1 的那一侧
 * 才需要反向轮廓。DSH 的调色板整体偏中间调，所以多数鱼两侧都够；只有最暗的
 * 那几条（例如 #5A5FD6）在深色界面上会掉到 2.7:1。
 *
 * @param hex - 鱼的底色 `#rrggbb`。
 * @returns `'on-dark'` / `'on-light'` / `'both'` / `undefined`（不用处理）。
 */
function haloNeed(hex) {
  const luma = relativeLuminance(hex)
  if (luma === undefined) return undefined
  const onDark = contrastRatio(luma, relativeLuminance(SURFACE_ON_DARK)) < MIN_CONTRAST
  const onLight = contrastRatio(luma, relativeLuminance(SURFACE_ON_LIGHT)) < MIN_CONTRAST
  if (onDark && onLight) return 'both'
  if (onDark) return 'on-dark'
  if (onLight) return 'on-light'
  return undefined
}

/**
 * 同一条鱼的 SVG 只生成一次。
 *
 * 尺寸不进缓存键：SVG 是矢量的，显示多大由 CSS 决定，所以改尺寸不必重画。
 * 这也让「同一屏里重复出现的同一条鱼」共用同一段标记。
 */
const fishAvatarCache = new Map()

function fishAvatarMarkup(identity) {
  const key = `${identity.seed}|${identity.pattern}|${identity.patternSeed}|${identity.strength}`
  let markup = fishAvatarCache.get(key)
  if (markup === undefined) {
    markup = fishSvg(identity.seed, {
      size: 64,
      pattern: identity.pattern,
      patternSeed: identity.patternSeed,
      strength: identity.strength,
    })
    fishAvatarCache.set(key, markup)
  }
  return markup
}

/**
 * 一个子代理的小鱼头像。
 *
 * @param props.id - 决定鱼的身份的稳定 id（子代理会话 id，或 `main`）。
 * @param props.size - 鱼本身的宽度，px；默认 24。
 * @param props.state - `running` / `done` / `failed`，只影响明暗，不影响鱼本身。
 * @param props.rim - `on` 时加一层极细描边（深色底上的深色鱼用）。
 */
function FishAvatar(props) {
  const { id, size = 24, state, rim, className } = props
  const identity = React.useMemo(() => fishIdentity(id), [id])
  const html = React.useMemo(() => ({ __html: fishAvatarMarkup(identity) }), [identity])
  const style = React.useMemo(() => ({ '--dsf-size': `${size}px` }), [size])
  return React.createElement('span', {
    className: className === undefined ? 'dsf-avatar' : `dsf-avatar ${className}`,
    style,
    title: props.title === undefined ? identityLabel(identity) : props.title,
    'data-state': state,
    'data-halo': haloNeed(identity.hex),
    'data-rim': rim,
    dangerouslySetInnerHTML: html,
  })
}
